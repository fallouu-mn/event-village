/**
 * R19 — Lot 5, sécurité urgente A3 et A5.
 *  A3. ticket_categories : anon et les clients ne lisent que les catégories is_active AND is_visible
 *      d'un événement dans un statut public (PUBLIE, SUSPENDU, ANNULE, TERMINE) ; le partenaire
 *      propriétaire et les admins lisent tout ; le partenaire B ne lit pas les catégories non publiques
 *      de A. Ici, sur le seul événement non public du seed (A_BROUILLON) ; les catégories masquées ou
 *      inactives, absentes du seed, sont couvertes par tests/parcours/dette-categories-publiques.test.ts.
 *  A5. ticket_transfers : plus d'INSERT REST (la création passe par la RPC ticket_transfer_initiate,
 *      section C1), ni par anon ni par un compte connecté.
 *
 * Rouge avant correctif :
 *  - supabase/migrations/0003_rls.sql:141-146 : ticket_categories_read_public USING (is_active = TRUE
 *    OR propriétaire OR is_admin()) : la catégorie active du brouillon A_BROUILLON est lisible par
 *    anon, un client et le partenaire B ;
 *  - supabase/migrations/20260908000001_ticket_transfers_p2p.sql:98-104 : ticket_transfers_insert
 *    WITH CHECK (from_user_id = auth.uid() OR is_admin()), avec les privilèges par défaut de Supabase :
 *    un compte connecté insère un transfert PENDING, y compris sur le billet d'autrui (l'index unique
 *    des PENDING bloque alors le vrai porteur). Le refus pour anon est déjà en place (aucune politique
 *    pour anon) : garde-fou.
 *
 * Si une insertion passe (base non corrigée), l'ADMIN du seed la supprime dans un finally (politique
 * ticket_transfers_delete_admin), pour ne pas bloquer le billet du seed.
 * (Clé anon + signInWithPassword uniquement.)
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { FIXTURE_EVENTS } from '../helpers/fixture-data';
import { anonClient, assertDenied, publicEvent, signInFixture } from './helpers';

type Row = Record<string, unknown>;

/** Événement non public du seed et ses catégories, découverts par son propriétaire (partenaire A). */
async function draftCategories(): Promise<{ eventId: string; categoryIds: string[] }> {
    const a = await signInFixture('PARTNER_A');
    const { data: ev, error } = await a.client.from('events').select('id, status').eq('slug', FIXTURE_EVENTS.A_BROUILLON.slug).single();
    assert.equal(error, null, `lecture du brouillon par son propriétaire : ${error?.message}`);
    assert.equal(ev.status, 'BROUILLON', 'précondition : A_BROUILLON est un brouillon');
    const { data: cats, error: catErr } = await a.client.from('ticket_categories').select('id, is_active').eq('event_id', ev.id);
    assert.equal(catErr, null, `lecture des catégories du brouillon par son propriétaire : ${catErr?.message}`);
    const ids = (cats ?? []).map((c) => String(c.id)).sort();
    assert.ok(ids.length > 0, 'précondition : le brouillon du seed a au moins une catégorie (lisible par son propriétaire)');
    assert.ok((cats ?? []).some((c) => c.is_active === true), 'précondition : catégorie active sur le brouillon');
    return { eventId: String(ev.id), categoryIds: ids };
}

function assertPermissionDenied(error: PostgrestError, what: string): void {
    assert.ok(error.code === '42501' || /permission denied/i.test(error.message),
        `${what} : refus de permission ou zéro ligne attendus, reçu code=${error.code} message=${error.message}`);
}

async function assertNoCategories(client: SupabaseClient, ids: string[], label: string): Promise<void> {
    const { data, error } = await client.from('ticket_categories').select('id, event_id').in('id', ids);
    if (error) {
        assertPermissionDenied(error, `${label} : lecture des catégories du brouillon`);
        return;
    }
    assert.deepEqual(data ?? [], [], `${label} : ${(data ?? []).length} catégorie(s) d’un événement non public lisible(s)`);
}

describe('R19 / A3 — catégories d’un événement non public', () => {
    test('anon ne lit pas les catégories du brouillon A_BROUILLON', async () => {
        const { categoryIds } = await draftCategories();
        await assertNoCategories(anonClient(), categoryIds, 'anon');
    });

    test('compte CLIENT : ne lit pas les catégories du brouillon', async () => {
        const { categoryIds } = await draftCategories();
        const { client } = await signInFixture('CLIENT');
        await assertNoCategories(client, categoryIds, 'CLIENT');
    });

    test('partenaire B : ne lit pas les catégories non publiques de A', async () => {
        const { categoryIds } = await draftCategories();
        const { client } = await signInFixture('PARTNER_B');
        await assertNoCategories(client, categoryIds, 'partenaire B');
    });

    test('garde-fou : anon lit toujours les catégories actives et visibles de l’événement publié A_PUBLIE', async () => {
        const ev = await publicEvent('A_PUBLIE');
        assert.ok(ev.categories.Standard, 'catégorie Standard de A_PUBLIE lisible publiquement');
        assert.ok(ev.categories.VIP, 'catégorie VIP de A_PUBLIE lisible publiquement');
    });
});

// ── A5 ─────────────────────────────────────────────────────────────────────

/** Un billet du compte CLIENT du seed, lu par son porteur. */
async function clientTicket(): Promise<{ ticketId: string; ownerId: string }> {
    const { client, userId } = await signInFixture('CLIENT');
    const { data, error } = await client.from('tickets').select('id').eq('user_id', userId).limit(1);
    assert.equal(error, null, `lecture de ses billets par le CLIENT : ${error?.message}`);
    assert.ok((data ?? []).length === 1, 'précondition : le CLIENT du seed a un billet');
    return { ticketId: String(data![0].id), ownerId: userId };
}

function transferRow(ticketId: string, fromUserId: string): Row {
    return {
        ticket_id: ticketId,
        from_user_id: fromUserId,
        to_phone_or_email: '+221770009919',
        status: 'PENDING',
        claim_token_hash: randomBytes(32).toString('hex'),
        expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    };
}

/** Supprime par l'ADMIN du seed une ligne insérée à tort (base non corrigée). */
async function removeInserted(res: { data: Row[] | null; error: PostgrestError | null }): Promise<void> {
    if (res.error || !res.data || res.data.length === 0) return;
    const admin = await signInFixture('ADMIN');
    for (const row of res.data) {
        const { error } = await admin.client.from('ticket_transfers').delete().eq('id', String(row.id));
        assert.equal(error, null, `remise en état : suppression du transfert ${String(row.id)} : ${error?.message}`);
    }
}

describe('R19 / A5 — aucune insertion REST dans ticket_transfers', () => {
    test('garde-fou : anon n’insère pas de transfert', async () => {
        const { ticketId, ownerId } = await clientTicket();
        const res = await anonClient().from('ticket_transfers').insert(transferRow(ticketId, ownerId)).select('id');
        try {
            assertDenied(res.error, 'anon INSERT ticket_transfers');
        } finally {
            await removeInserted(res as { data: Row[] | null; error: PostgrestError | null });
        }
    });

    test('compte CLIENT_BIS : n’insère pas de transfert PENDING sur le billet d’un autre (déni de service du porteur)', async () => {
        const { ticketId } = await clientTicket();
        const attacker = await signInFixture('CLIENT_BIS');
        const res = await attacker.client.from('ticket_transfers').insert(transferRow(ticketId, attacker.userId)).select('id');
        try {
            assertDenied(res.error, 'CLIENT_BIS INSERT ticket_transfers (billet d’autrui)');
        } finally {
            await removeInserted(res as { data: Row[] | null; error: PostgrestError | null });
        }
    });

    test('compte CLIENT : n’insère pas de transfert sur son propre billet hors de la route (RPC seule)', async () => {
        const { ticketId } = await clientTicket();
        const owner = await signInFixture('CLIENT');
        const res = await owner.client.from('ticket_transfers').insert(transferRow(ticketId, owner.userId)).select('id');
        try {
            assertDenied(res.error, 'CLIENT INSERT ticket_transfers (son billet)');
        } finally {
            await removeInserted(res as { data: Row[] | null; error: PostgrestError | null });
        }
    });
});
