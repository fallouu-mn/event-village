/**
 * Lot 9, tâche 9.3, A27 (contrat 3.2, 5.4, L42, D-sec 7) — le trigger anti-boucle du parrainage couvre aussi l'UPDATE de
 * sponsor_id et de referred_id, quel que soit le rôle. parrainage-gardes.test.ts:14 relevait cette limite.
 *
 * Par `db` (rôle postgres, transaction annulée) et par `service` (service_role, PostgREST). Par service, les lignes sont
 * réelles : sur le code actuel l'UPDATE réussit et valide une boucle ; le finally retire les lignes de la suite, sinon
 * la remontée récursive du trigger (UNION ALL) ne se terminerait plus pour ces comptes.
 *
 * Rouge avant correctif : UPDATE accepté (trigger sur INSERT seulement, 0011_referral_codes.sql:108). after() :
 * assertLot9Invariants, rouge jusqu'à M2 et M4.
 * Verts dès l'écriture (témoins, signalés) : changement de parrain sans boucle, UPDATE d'is_active, sponsor_id réécrit à
 * l'identique dans une chaîne : aucun faux positif.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Client } from 'pg';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { newBuyer, service, type Buyer } from './paiement-helpers';

let a: Buyer;
let b: Buyer;
let c: Buyer;
let d: Buyer;

before(async () => {
    a = await newBuyer('boucle-a');
    b = await newBuyer('boucle-b');
    c = await newBuyer('boucle-c');
    d = await newBuyer('boucle-d');
});

after(async () => {
    await assertLot9Invariants('parrainage-boucle-update');
});

const LOOP_MESSAGE = /Parrainage circulaire interdit/;

const relationRow = (sponsor: Buyer, referred: Buyer): Record<string, unknown> => ({
    sponsor_id: sponsor.userId, referred_id: referred.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
    rate_n1_at_creation: 4, rate_n2_at_creation: 1.5, duration_months: 24, expires_at: new Date(Date.now() + 730 * 24 * 3600_000).toISOString(), is_active: true,
});

async function relate(db: Client, sponsor: Buyer, referred: Buyer): Promise<void> {
    await db.query(
        `INSERT INTO public.referral_relationships
             (sponsor_id, referred_id, referral_type, sponsor_status_at_creation, rate_n1_at_creation, rate_n2_at_creation,
              duration_months, expires_at, is_active)
         VALUES ($1, $2, 'CLIENT_TO_CLIENT', 'STANDARD', 4, 1.5, 24, now() + interval '24 months', TRUE)`,
        [sponsor.userId, referred.userId],
    );
}

function assertLoopRefused(err: { code?: string; message?: string }): boolean {
    assert.equal(err.code, 'P0001', `code : ${String(err.code)} ${String(err.message)}`);
    assert.match(String(err.message), LOOP_MESSAGE);
    return true;
}

async function sponsorOf(db: Client, referred: Buyer): Promise<string> {
    const { rows } = await db.query<{ sponsor_id: string }>('SELECT sponsor_id FROM public.referral_relationships WHERE referred_id = $1', [referred.userId]);
    assert.equal(rows.length, 1, 'une relation');
    return rows[0].sponsor_id;
}

describe('A27 — rôle postgres, transaction annulée', () => {
    test('UPDATE sponsor_id qui ferme une boucle : P0001', async () => {
        await inRolledBackTransaction(async (db) => {
            await relate(db, a, b);
            await relate(db, b, c);
            await assert.rejects(
                db.query('UPDATE public.referral_relationships SET sponsor_id = $1 WHERE referred_id = $2', [c.userId, b.userId]),
                assertLoopRefused,
            );
        });
    });

    test('UPDATE referred_id qui ferme une boucle : P0001', async () => {
        await inRolledBackTransaction(async (db) => {
            await relate(db, a, b);
            await relate(db, b, c);
            await relate(db, c, d);
            await assert.rejects(
                db.query('UPDATE public.referral_relationships SET referred_id = $1 WHERE referred_id = $2', [a.userId, d.userId]),
                assertLoopRefused,
            );
        });
    });

    test('témoin : changement de parrain sans boucle accepté (vert dès l’écriture)', async () => {
        await inRolledBackTransaction(async (db) => {
            await relate(db, a, b);
            await db.query('UPDATE public.referral_relationships SET sponsor_id = $1 WHERE referred_id = $2', [d.userId, b.userId]);
            assert.equal(await sponsorOf(db, b), d.userId, 'parrain changé');
        });
    });

    test('témoin : UPDATE d’is_active et sponsor_id réécrit à l’identique, dans une chaîne, acceptés (vert dès l’écriture)', async () => {
        await inRolledBackTransaction(async (db) => {
            await relate(db, a, b);
            await relate(db, b, c);
            await db.query('UPDATE public.referral_relationships SET is_active = FALSE WHERE referred_id = $1', [c.userId]);
            await db.query('UPDATE public.referral_relationships SET sponsor_id = $1 WHERE referred_id = $2', [b.userId, c.userId]);
            assert.equal(await sponsorOf(db, c), b.userId, 'relation inchangée');
        });
    });
});

/** Relations réelles de la suite, retirées quoi qu'il arrive : une boucle validée bloquerait le trigger pour ces comptes. */
async function withRelations<T>(relations: Array<[Buyer, Buyer]>, fn: (ids: string[]) => Promise<T>): Promise<T> {
    const { data, error } = await service.from('referral_relationships').insert(relations.map(([s, r]) => relationRow(s, r))).select('id');
    assert.equal(error, null, `relations : ${error?.message}`);
    const ids = (data ?? []).map((row) => String(row.id));
    assert.equal(ids.length, relations.length, 'relations écrites');
    try {
        return await fn(ids);
    } finally {
        const { error: delErr } = await service.from('referral_relationships').delete().in('id', ids);
        assert.equal(delErr, null, `retrait des relations de la suite : ${delErr?.message}`);
    }
}

describe('A27 — service_role, PostgREST', () => {
    test('UPDATE sponsor_id qui ferme une boucle : P0001, relation inchangée', async () => {
        await withRelations([[a, b], [b, c]], async ([ab]) => {
            const { error } = await service.from('referral_relationships').update({ sponsor_id: c.userId }).eq('id', ab);
            assert.ok(error, 'UPDATE accepté : boucle créée (A27)');
            assert.equal(error.code, 'P0001', `${error.code} ${error.message}`);
            assert.match(error.message, LOOP_MESSAGE);
            const { data } = await service.from('referral_relationships').select('sponsor_id').eq('id', ab).single();
            assert.equal(data?.sponsor_id, a.userId, 'parrain inchangé');
        });
    });

    test('UPDATE referred_id qui ferme une boucle : P0001, relation inchangée', async () => {
        await withRelations([[a, b], [b, c], [c, d]], async ([, , cd]) => {
            const { error } = await service.from('referral_relationships').update({ referred_id: a.userId }).eq('id', cd);
            assert.ok(error, 'UPDATE accepté : boucle créée (A27)');
            assert.equal(error.code, 'P0001', `${error.code} ${error.message}`);
            assert.match(error.message, LOOP_MESSAGE);
            const { data } = await service.from('referral_relationships').select('referred_id').eq('id', cd).single();
            assert.equal(data?.referred_id, d.userId, 'filleul inchangé');
        });
    });

    test('témoins : changement de parrain sans boucle et is_active acceptés (verts dès l’écriture)', async () => {
        await withRelations([[a, b]], async ([ab]) => {
            const moved = await service.from('referral_relationships').update({ sponsor_id: d.userId }).eq('id', ab);
            assert.equal(moved.error, null, `changement de parrain : ${moved.error?.message}`);
            const inactive = await service.from('referral_relationships').update({ is_active: false }).eq('id', ab);
            assert.equal(inactive.error, null, `is_active : ${inactive.error?.message}`);
            const { data } = await service.from('referral_relationships').select('sponsor_id, is_active').eq('id', ab).single();
            assert.deepEqual([data?.sponsor_id, data?.is_active], [d.userId, false]);
        });
    });
});
