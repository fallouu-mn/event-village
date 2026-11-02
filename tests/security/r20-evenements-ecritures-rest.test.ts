/**
 * R20 — Lot 6, tâche 6.0 b (contrat A2, S2 groupe Dette) : plus aucune écriture REST sur events, ni par un
 * ADMIN connecté, ni par le partenaire propriétaire. La politique events_admin_manage (FOR ALL, is_admin())
 * est supprimée et les privilèges INSERT, UPDATE, DELETE, TRUNCATE de la table sont révoqués pour anon et
 * authenticated : chaque écriture est refusée par la base avec le code 42501 (privilège), et aucune ligne
 * n'est touchée. Les écritures légitimes passent par les routes serveur et les RPC.
 *
 * Cibles, choisies pour ne rien détruire si la base n'est pas corrigée :
 *  - DELETE de l'ADMIN sur A_PUBLIE, qui porte le billet du seed (tickets.event_id ON DELETE RESTRICT) : une
 *    suppression acceptée par la RLS échoue sur la clé étrangère (23503), l'événement reste ; la précondition
 *    vérifie la présence d'au moins un billet avant l'essai ;
 *  - DELETE de l'ADMIN sur un identifiant inexistant : sans privilège, la base refuse même sans ligne visée ;
 *  - INSERT de l'ADMIN : si l'écriture passe, la ligne (forcée en BROUILLON) est supprimée par le même
 *    chemin REST dans un finally ;
 *  - UPDATE de start_date sur le brouillon du seed A_BROUILLON : si l'écriture passe, la date d'origine est
 *    remise par le même chemin REST dans un finally (comme R17) ;
 *  - partenaire A sur son propre brouillon : DELETE, UPDATE de start_date, INSERT.
 *
 * Rouge avant correctif :
 *  - events_admin_manage (supabase/migrations/20261031000005_lot1b4_partenaire_ecritures.sql:21-22) laisse
 *    l'ADMIN insérer, modifier et supprimer par REST (DELETE de A_PUBLIE : 23503 et non 42501 ; DELETE d'un
 *    identifiant inexistant, UPDATE : acceptés) ;
 *  - aucun REVOKE sur events (grep « ON public.events » dans supabase/migrations) : le partenaire n'a aucune
 *    politique d'écriture, ses DELETE et UPDATE renvoient 0 ligne sans erreur au lieu d'un refus 42501.
 * Déjà vert (couverture, signalé) : INSERT du partenaire refusé par la RLS (42501 « new row violates
 * row-level security policy », comme R9).
 * Suite de sécurité : clé anon et signInWithPassword seulement (tests/security/anon-uniquement.test.ts) ; elle
 * n'appelle donc pas assertNotificationInvariants, qui passe par la connexion directe et l'envoyeur.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { FIXTURE_EVENTS } from '../helpers/fixture-data';
import { signInFixture, uniqueSuffix, ZERO_UUID } from './helpers';

type Row = Record<string, unknown>;

const PRIVILEGE_DENIED = '42501';

interface WriteResult {
    data: unknown;
    error: PostgrestError | null;
}

/** Refus de privilège attendu (42501), jamais une réponse vide ni une autre erreur. */
function assertPrivilegeDenied(res: WriteResult, what: string): void {
    const rows = Array.isArray(res.data) ? res.data.length : res.data ? 1 : 0;
    assert.ok(res.error, `${what} : acceptée par la base (${rows} ligne(s) renvoyée(s) : ${JSON.stringify(res.data)}), attendu un refus ${PRIVILEGE_DENIED}`);
    assert.equal(res.error.code, PRIVILEGE_DENIED,
        `${what} : refus attendu ${PRIVILEGE_DENIED} (privilège d'écriture révoqué sur events), obtenu ${res.error.code} ${res.error.message}`);
}

async function eventBySlug(client: SupabaseClient, slug: string): Promise<Row | null> {
    const { data, error } = await client.from('events').select('id, status, start_date, start_time, partner_id').eq('slug', slug).maybeSingle();
    assert.equal(error, null, `lecture de l'événement ${slug} : ${error?.message}`);
    return (data ?? null) as Row | null;
}

async function partnerA(): Promise<{ client: SupabaseClient; userId: string; partnerId: string }> {
    const a = await signInFixture('PARTNER_A');
    const { data, error } = await a.client.from('partners').select('id').eq('user_id', a.userId).single();
    assert.equal(error, null, `lecture de sa fiche partenaire : ${error?.message}`);
    return { client: a.client, userId: a.userId, partnerId: String(data.id) };
}

function insertPayload(partnerId: string, slug: string): Row {
    return {
        partner_id: partnerId,
        title: 'R20 événement créé hors serveur',
        slug,
        description: 'Tentative de création directe par REST',
        start_date: '2027-03-15',
        start_time: '20:00:00',
        end_date: '2027-03-15',
        end_time: '23:00:00',
        location: 'Dakar',
        city: 'Dakar',
        capacity: 50,
        status: 'PUBLIE',
        category: 'CONCERT',
    };
}

/** Date du brouillon du seed remise par le même chemin REST si une écriture a été acceptée (base non corrigée). */
async function restoreDraftDate(client: SupabaseClient, id: string, original: Row): Promise<void> {
    const now = await eventBySlug(client, FIXTURE_EVENTS.A_BROUILLON.slug);
    if (now && now.start_date === original.start_date && now.start_time === original.start_time) return;
    const { error } = await client.from('events').update({ start_date: original.start_date, start_time: original.start_time }).eq('id', id);
    assert.equal(error, null, `remise en état de la date de A_BROUILLON : ${error?.message}`);
}

// ── ADMIN ──────────────────────────────────────────────────────────────────

describe('R20 — ADMIN connecté : aucune écriture REST sur events', () => {
    test('DELETE de A_PUBLIE (billets émis) → refus 42501, événement intact', async () => {
        const admin = await signInFixture('ADMIN');
        const ev = await eventBySlug(admin.client, FIXTURE_EVENTS.A_PUBLIE.slug);
        assert.ok(ev, 'précondition : A_PUBLIE lisible par l’ADMIN');
        const { data: tickets, error: tErr } = await admin.client.from('tickets').select('id').eq('event_id', String(ev.id)).limit(1);
        assert.equal(tErr, null, `lecture des billets de A_PUBLIE : ${tErr?.message}`);
        assert.ok((tickets ?? []).length >= 1, 'précondition : A_PUBLIE porte au moins un billet (sinon l’essai pourrait supprimer l’événement du seed)');

        const res = await admin.client.from('events').delete().eq('id', String(ev.id)).select('id');
        const after = await eventBySlug(admin.client, FIXTURE_EVENTS.A_PUBLIE.slug);
        assert.ok(after, 'A_PUBLIE supprimé par REST');
        assert.equal(after.status, ev.status, 'statut de A_PUBLIE modifié');
        assertPrivilegeDenied(res, 'DELETE REST de A_PUBLIE par l’ADMIN');
    });

    test('DELETE d’un identifiant inexistant → refus 42501 (privilège révoqué, sans ligne visée)', async () => {
        const admin = await signInFixture('ADMIN');
        const res = await admin.client.from('events').delete().eq('id', ZERO_UUID).select('id');
        assertPrivilegeDenied(res, 'DELETE REST par l’ADMIN (identifiant inexistant)');
    });

    test('INSERT d’un événement → refus 42501, aucune ligne créée', async () => {
        const admin = await signInFixture('ADMIN');
        const a = await partnerA();
        const slug = `r20-admin-${uniqueSuffix().toLowerCase()}`;
        try {
            const res = await admin.client.from('events').insert(insertPayload(a.partnerId, slug)).select('id, status');
            assert.equal(await eventBySlug(admin.client, slug), null, `événement créé par REST : ${JSON.stringify(res.data)}`);
            assertPrivilegeDenied(res, 'INSERT REST d’un événement par l’ADMIN');
        } finally {
            const left = await eventBySlug(admin.client, slug);
            if (left) {
                const { error } = await admin.client.from('events').delete().eq('id', String(left.id));
                assert.equal(error, null, `nettoyage de l'événement ${slug} créé par REST : ${error?.message}`);
            }
        }
    });

    test('UPDATE de start_date du brouillon A_BROUILLON → refus 42501, date inchangée', async () => {
        const admin = await signInFixture('ADMIN');
        const ev = await eventBySlug(admin.client, FIXTURE_EVENTS.A_BROUILLON.slug);
        assert.ok(ev, 'précondition : A_BROUILLON lisible par l’ADMIN');
        try {
            const res = await admin.client.from('events').update({ start_date: '2099-12-31' }).eq('id', String(ev.id)).select('id, start_date');
            const now = await eventBySlug(admin.client, FIXTURE_EVENTS.A_BROUILLON.slug);
            assert.ok(now, 'A_BROUILLON introuvable après l’essai');
            assert.equal(now.start_date, ev.start_date, `date de A_BROUILLON changée par REST : ${JSON.stringify(res.data)}`);
            assertPrivilegeDenied(res, 'UPDATE REST de start_date par l’ADMIN');
        } finally {
            await restoreDraftDate(admin.client, String(ev.id), ev);
        }
    });
});

// ── Partenaire propriétaire ────────────────────────────────────────────────

describe('R20 — partenaire propriétaire : aucune écriture REST sur ses événements', () => {
    test('DELETE de son brouillon A_BROUILLON → refus 42501, brouillon intact', async () => {
        const a = await partnerA();
        const ev = await eventBySlug(a.client, FIXTURE_EVENTS.A_BROUILLON.slug);
        assert.ok(ev, 'précondition : son brouillon A_BROUILLON lisible');
        const res = await a.client.from('events').delete().eq('id', String(ev.id)).select('id');
        assert.ok(await eventBySlug(a.client, FIXTURE_EVENTS.A_BROUILLON.slug), `brouillon du seed supprimé par le partenaire : ${JSON.stringify(res.data)}`);
        assertPrivilegeDenied(res, 'DELETE REST de son brouillon par le partenaire');
    });

    test('UPDATE de start_date de son brouillon → refus 42501, date inchangée', async () => {
        const a = await partnerA();
        const admin = await signInFixture('ADMIN');
        const ev = await eventBySlug(a.client, FIXTURE_EVENTS.A_BROUILLON.slug);
        assert.ok(ev, 'précondition : son brouillon A_BROUILLON lisible');
        try {
            const res = await a.client.from('events').update({ start_date: '2099-12-31' }).eq('id', String(ev.id)).select('id, start_date');
            const now = await eventBySlug(a.client, FIXTURE_EVENTS.A_BROUILLON.slug);
            assert.ok(now, 'A_BROUILLON introuvable après l’essai');
            assert.equal(now.start_date, ev.start_date, `date du brouillon changée par le partenaire : ${JSON.stringify(res.data)}`);
            assertPrivilegeDenied(res, 'UPDATE REST de start_date par le partenaire');
        } finally {
            await restoreDraftDate(admin.client, String(ev.id), ev);
        }
    });

    test('INSERT d’un événement → refus 42501, aucune ligne créée (déjà vert : RLS, couverture)', async () => {
        const a = await partnerA();
        const admin = await signInFixture('ADMIN');
        const slug = `r20-partner-${uniqueSuffix().toLowerCase()}`;
        try {
            const res = await a.client.from('events').insert(insertPayload(a.partnerId, slug)).select('id');
            assert.equal(await eventBySlug(admin.client, slug), null, `événement créé par le partenaire en REST : ${JSON.stringify(res.data)}`);
            assertPrivilegeDenied(res, 'INSERT REST d’un événement par le partenaire');
        } finally {
            const left = await eventBySlug(admin.client, slug);
            if (left) {
                const { error } = await admin.client.from('events').delete().eq('id', String(left.id));
                assert.equal(error, null, `nettoyage de l'événement ${slug} : ${error?.message}`);
            }
        }
    });
});
