/**
 * Audit de sécurité du module événements — AUD-06 : les aides RLS is_partner_owner(), has_role(), is_controller() et
 * auth_user_role() ignorent le statut du compte ; impact mesuré sur un partenaire SUSPENDU.
 *
 * is_partner_owner (0003_rls.sql:33-38) : `partners.id = p AND user_id = auth.uid()`, sans statut du compte ni du
 * partenaire. Politiques qui s'en servent sans autre condition de statut : tickets_read
 * (20261103000001_lot6_dette.sql:118), payments_read (0003_rls.sql:274), refunds_read (0003_rls.sql:287),
 * event_cancellations_select (20261031000005:34), participant_exports_owner_admin_select (20261102000005:51),
 * events_read_public (20261110000007:221, brouillons compris). La suspension (partner_status_set) passe users.status à
 * SUSPENDU et révoque les sessions, mais un jeton d'accès déjà émis reste accepté par PostgREST jusqu'à son expiration
 * (jwt_expiry = 3600 s, supabase/config.toml) : PostgREST ne vérifie que la signature et la date.
 * À comparer : is_admin() exige ACTIF depuis le lot 9 ter (20261110000001_lot9ter_rls.sql:116-117), et les politiques de
 * ticket_scans, scan_incidents, notifications et controller_shifts ajoutent un test de statut (lot 6).
 *
 * Test ROUGE tant que la faille existe : après la suspension du partenaire par la RPC de l'administration, son jeton ne
 * lit plus les billets ni les paiements (numéro du payeur compris) de son événement.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { newBuyer, service } from '../parcours/paiement-helpers';
import { buyConfirmed, createPartnerEvent, newPartner, superadminId } from '../parcours/finance-helpers';

function asUser(accessToken: string) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
}

describe('AUD-06 — partenaire suspendu : lectures REST qui ignorent le statut (is_partner_owner)', () => {
    test('le jeton d\'un partenaire suspendu ne lit plus les billets ni les paiements de ses acheteurs', async () => {
        const partner = await newPartner('aud-susp');
        const ev = await createPartnerEvent(partner.partnerId, 'aud suspendu', [{ name: 'Std', price: 1_000, total: 5 }]);
        const buyer = await newBuyer('aud-susp-acheteur');
        const purchase = await buyConfirmed(buyer, ev, [['Std', 1]]);
        assert.equal(purchase.tickets.length, 1, 'précondition : un billet vendu');

        const before = await asUser(partner.accessToken).from('tickets').select('id').eq('event_id', ev.eventId);
        assert.equal(before.error, null, `précondition : lecture des billets par le partenaire actif : ${before.error?.message}`);
        assert.equal(before.data?.length, 1, 'précondition : le partenaire actif lit le billet de son événement');

        const { data: reply, error } = await service.rpc('partner_status_set', {
            p: { partner_id: partner.partnerId, actor_id: await superadminId(), status: 'SUSPENDU', reason: 'Audit de sécurité AUD-06' },
        });
        assert.equal(error, null, `suspension : ${error?.message}`);
        assert.equal((reply as { ok?: boolean }).ok, true, `suspension refusée : ${JSON.stringify(reply)}`);
        const { data: u } = await service.from('users').select('status').eq('id', partner.userId).single();
        const { data: p } = await service.from('partners').select('status').eq('id', partner.partnerId).single();
        console.log(`[AUD-06] après partner_status_set : users.status=${u?.status} partners.status=${p?.status} réponse=${JSON.stringify(reply).slice(0, 200)}`);
        assert.equal(u?.status, 'SUSPENDU', 'précondition : compte du partenaire suspendu');

        const client = asUser(partner.accessToken);
        const tickets = await client.from('tickets').select('*').eq('event_id', ev.eventId);
        const payments = await client.from('payments').select('*').eq('id', purchase.payment.id);
        const leaked = (payments.data ?? []).map((row) => Object.fromEntries(Object.entries(row as Record<string, unknown>)
            .filter(([k]) => /phone|client_id|amount|status/.test(k))));
        console.log(`[AUD-06] jeton du partenaire suspendu : billets lus=${tickets.data?.length ?? 0} (erreur ${tickets.error?.message ?? 'aucune'}) ; paiements lus=${payments.data?.length ?? 0} (erreur ${payments.error?.message ?? 'aucune'}) ; colonnes : ${JSON.stringify(leaked)}`);
        assert.deepEqual({ tickets: tickets.data?.length ?? 0, payments: payments.data?.length ?? 0 }, { tickets: 0, payments: 0 },
            'un partenaire SUSPENDU lit encore, avec son jeton, les billets et les paiements de ses acheteurs (is_partner_owner ignore le statut)');
    });
});
