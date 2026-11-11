/**
 * Lot 8, tâche 8.3 d, anomalie A11 (contrat 13.4, CDC §104) — preuve de l'anti-fraude du parrainage : auto-parrainage
 * et boucles, sans test jusqu'ici. GARDE-FOUS ANNONCÉS VERTS DÈS L'ÉCRITURE (AR7) : le code n'est pas changé, tout rouge
 * est une anomalie à instruire.
 *  1. inscription avec son propre code : refusée comme code inconnu (lot 9 bis, R86), aucun compte ; témoin : le code d'un autre crée la relation ;
 *  2. base : chk_no_self_referral refuse sponsor = filleul ;
 *  3. boucles, trigger check_no_circular_referral : A → B → A et A → B → C → A refusées ; la chaîne A → B → C reste
 *     permise (témoin) ;
 *  4. uq_referred_user : un filleul n'a qu'un parrain ;
 *  5. clé anon, jeton du client : ni s'auto-parrainer, ni changer son parrain.
 *
 * Écritures de relations aux points 2 à 4 dans inRolledBackTransaction, comme les violations fabriquées ; comptes réels
 * au point 1 : suite qui écrit, annoncée verte, donc assertTerrainInvariants (Conventions).
 * Limite relevée, sans correctif ici : le trigger de boucle n'est posé que sur INSERT (0011_referral_codes.sql:108) ;
 * un UPDATE service_role de sponsor_id n'est pas contrôlé. Aucune route ne le fait et le point 5 prouve qu'un client ne
 * le peut pas.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import type { Client } from 'pg';
import { inRolledBackTransaction } from '../helpers/db';
import { bearer } from '../helpers/fixtures';
import { randomSenegalPhone } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { assertTerrainInvariants, registerClientFlow } from './terrain-helpers';

let a: Buyer;
let b: Buyer;
let c: Buyer;

before(async () => {
    a = await newBuyer('gardes-a');
    b = await newBuyer('gardes-b');
    c = await newBuyer('gardes-c');
});

after(async () => {
    await assertTerrainInvariants('parrainage-gardes');
});

let ipSeq = 0;
/** Adresse réservée à la suite : les quotas d'inscription par IP ne se mélangent pas à ceux des autres suites. */
function freshIp(): Record<string, string> {
    ipSeq += 1;
    return { 'x-forwarded-for': `198.51.100.${60 + ipSeq}` };
}

async function codeOwner(code: string): Promise<string | null> {
    const { data, error } = await service.from('users').select('id').eq('referral_code', code).maybeSingle();
    assert.equal(error, null, `code ${code} : ${error?.message}`);
    return data?.id ?? null;
}

/** Numéro neuf dont le code `EV-<6 derniers chiffres>` n'est encore à personne (les fins de numéro peuvent se répéter). */
async function phoneWithFreeCode(): Promise<{ phone: string; code: string }> {
    for (let i = 0; i < 5; i += 1) {
        const phone = randomSenegalPhone('77');
        const code = `EV-${phone.slice(-6)}`;
        if (await codeOwner(code) === null) return { phone, code };
    }
    return assert.fail('aucun numéro à code libre en 5 essais');
}

async function relations(referredId: string): Promise<Array<{ sponsor_id: string }>> {
    const { data, error } = await service.from('referral_relationships').select('sponsor_id').eq('referred_id', referredId);
    assert.equal(error, null, `relations de ${referredId} : ${error?.message}`);
    return data ?? [];
}

async function relate(db: Client, sponsor: Buyer, referred: Buyer): Promise<void> {
    await db.query(
        `INSERT INTO public.referral_relationships
             (sponsor_id, referred_id, referral_type, sponsor_status_at_creation, rate_n1_at_creation, rate_n2_at_creation,
              duration_months, expires_at, is_active)
         VALUES ($1, $2, 'CLIENT_TO_CLIENT', 'STANDARD', 4, 1.5, 24, now() + interval '24 months', TRUE)`,
        [sponsor.userId, referred.userId],
    );
}

function clientOf(user: Buyer) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: bearer(user.accessToken) },
    });
}

describe('A11 — auto-parrainage (§104)', () => {
    test('inscription avec son propre code : refusée comme code inconnu (lot 9 bis, R86, B87), aucun compte, aucune relation', async () => {
        const { phone, code } = await phoneWithFreeCode();
        const flow = await registerClientFlow({ phone, referralCode: code, headers: freshIp() }, { expectOk: false });
        assert.equal(flow.start.status, 200, `démarrage : ${JSON.stringify(flow.start.body)}`); assert.equal(flow.register?.status, 400, `code encore à personne : ${JSON.stringify(flow.register?.body)}`); assert.equal(flow.register?.body.code, 'REFERRAL_CODE_UNKNOWN');
        assert.equal(flow.userId, null, 'aucun compte créé'); assert.equal(await codeOwner(code), null, 'le code saisi n’est toujours à personne : pas de compte qui se parraine lui-même');
    });

    test('témoin : le code d’un autre compte crée la relation', async () => {
        const { data, error } = await service.from('users').select('referral_code').eq('id', a.userId).single();
        assert.equal(error, null, `code du parrain : ${error?.message}`);
        const flow = await registerClientFlow({ referralCode: String(data.referral_code), headers: freshIp() });
        assert.deepEqual(await relations(flow.userId!), [{ sponsor_id: a.userId }], 'une relation vers le parrain');
    });

    test('base : sponsor = filleul refusé par chk_no_self_referral', async () => {
        await inRolledBackTransaction(async (db) => {
            await assert.rejects(relate(db, a, a), (err: { code?: string; constraint?: string }) => {
                assert.equal(err.code, '23514', `erreur attendue : violation de contrainte (${String(err.code)})`);
                assert.equal(err.constraint, 'chk_no_self_referral');
                return true;
            });
        });
    });

    test('clé anon, jeton du client : s’auto-parrainer est refusé, rien n’est écrit', async () => {
        const client = clientOf(b);
        const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
        const { error } = await client.from('referral_relationships').insert({
            sponsor_id: b.userId, referred_id: b.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: 4, rate_n2_at_creation: 1.5, duration_months: 24, expires_at: expires, is_active: true,
        });
        assert.ok(error, 'insertion directe acceptée');
        assert.match(`${error.code} ${error.message}`, /42501|row-level security|permission denied/i, `refus inattendu : ${error.code} ${error.message}`);
        assert.deepEqual(await relations(b.userId), [], 'aucune relation écrite');
    });
});

describe('A11 — boucles (§104)', () => {
    test('A → B puis B → A : refusé, « Parrainage circulaire interdit »', async () => {
        await inRolledBackTransaction(async (db) => {
            await relate(db, a, b);
            await assert.rejects(relate(db, b, a), (err: { code?: string; message?: string }) => {
                assert.equal(err.code, 'P0001', `code : ${String(err.code)}`);
                assert.match(String(err.message), /Parrainage circulaire interdit/);
                return true;
            });
        });
    });

    test('A → B → C → A : refusé ; témoin : la chaîne A → B → C reste permise', async () => {
        await inRolledBackTransaction(async (db) => {
            await relate(db, a, b);
            await relate(db, b, c);
            const { rows } = await db.query<{ n: number }>(
                'SELECT count(*)::int AS n FROM public.referral_relationships WHERE referred_id = ANY($1::uuid[])',
                [[b.userId, c.userId]],
            );
            assert.equal(rows[0].n, 2, 'chaîne de deux niveaux enregistrée');
            await assert.rejects(relate(db, c, a), (err: { code?: string; message?: string }) => {
                assert.equal(err.code, 'P0001', `code : ${String(err.code)}`);
                assert.match(String(err.message), /Parrainage circulaire interdit/);
                return true;
            });
        });
    });

    test('un filleul n’a qu’un parrain : second parrain refusé par uq_referred_user', async () => {
        await inRolledBackTransaction(async (db) => {
            await relate(db, a, c);
            await assert.rejects(relate(db, b, c), (err: { code?: string; constraint?: string }) => {
                assert.equal(err.code, '23505', `code : ${String(err.code)}`);
                assert.equal(err.constraint, 'uq_referred_user');
                return true;
            });
        });
    });

    test('clé anon, jeton du filleul : changer de parrain ou de taux n’a aucun effet', async () => {
        const referred = await newBuyer('gardes-filleul');
        const expires = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
        const { error: relErr } = await service.from('referral_relationships').insert({
            sponsor_id: c.userId, referred_id: referred.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: 4, rate_n2_at_creation: 1.5, duration_months: 24, expires_at: expires, is_active: true,
        });
        assert.equal(relErr, null, `relation de départ : ${relErr?.message}`);

        const { error, data } = await clientOf(referred).from('referral_relationships')
            .update({ sponsor_id: a.userId, rate_n1_at_creation: 99 }).eq('referred_id', referred.userId).select('id');
        if (error) assert.match(`${error.code} ${error.message}`, /42501|row-level security|permission denied/i, `refus inattendu : ${error.code} ${error.message}`);
        else assert.deepEqual(data, [], 'aucune ligne modifiable');

        const { data: row, error: readErr } = await service.from('referral_relationships').select('sponsor_id, rate_n1_at_creation').eq('referred_id', referred.userId).single();
        assert.equal(readErr, null, `relation relue : ${readErr?.message}`);
        assert.equal(row.sponsor_id, c.userId, 'parrain inchangé');
        assert.equal(Number(row.rate_n1_at_creation), 4, 'taux inchangé');
    });
});
