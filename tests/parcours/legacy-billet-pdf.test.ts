/**
 * Lot 8, tâche 8.2 v — droits du PDF de billet, GET /api/tickets/[id]/pdf. Cas portés de
 * tests/legacy/ticket-pdf-and-exports.test.ts (tableau 12.1, ligne 22 : T2 à T6) : les tests modernes ne testent
 * que le propriétaire (acces-qr:258, finance-affichage:142), qui couvrent T1 et T7.
 *  1. témoin : le porteur télécharge son billet (200, application/pdf, %PDF-) ;
 *  2. T2, un tiers connecté : 403, aucun document ;
 *  3. T3, sans session : 401 AUTH_REQUIRED ;
 *  4. T4, billet inconnu : 404 ;
 *  5. T5, billet ANNULE (gratuit), REMBOURSEMENT_EN_COURS puis REMBOURSE (payant, par le vrai remboursement) : 400,
 *     « n'est plus valide » ;
 *  6. T6, billet transféré par les vraies RPC : verrouillé pendant le transfert (400), puis l'ancien porteur 403 et
 *     le nouveau porteur 200.
 *
 * Écarts au legacy, tous plus proches du code réel : billets, transfert et remboursements passent par les RPC et le
 * checkout (le legacy écrivait statuts et user_id en base) ; UUID du projet distant et LEGACY_TEST_PASSWORD
 * remplacés par des comptes neufs.
 *
 * Annoncée verte dès l'écriture (port, section 12.1) : tout rouge est une anomalie à instruire (8.3 d). Suite
 * verte à l'écriture : assertTerrainInvariants, pas assertRecetteInvariants (Conventions).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as ticketPdf } from '../../app/api/tickets/[id]/pdf/route';
import { CashoutService } from '../../lib/payments/cashout.service';
import { BASE_URL, routeContext } from './helpers';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { authed, ticketRow } from './acces-helpers';
import { markPhoneVerified } from './notif-helpers';
import { assertTerrainInvariants, issueFreeTicket } from './terrain-helpers';

type Row = Record<string, unknown>;

interface PdfResult { status: number; type: string; bytes: Buffer; json: Row }

const STALE = /n'est plus valide/;
/** Anomalie A23 (8.3 d) : app/api/tickets/[id]/pdf/route.ts:75 affichait le statut technique du billet. */
const RAW_STATUS = /\bANNULE\b|REMBOURSEMENT_EN_COURS|\bREMBOURSE\b|statut\s*:/;

let partner: TestPartner;
let ev: SaleEvent;
let owner: Buyer;

before(async () => {
    partner = await newPartner('legacy-pdf');
    ev = await createPartnerEvent(partner.partnerId, 'legacy-pdf', [
        { name: 'Standard', price: 5000, total: 20 },
        { name: 'Invitation', price: 0, total: 20 },
    ]);
    owner = await newBuyer('legacy-pdf-porteur');
});

after(async () => {
    await assertTerrainInvariants('legacy-billet-pdf');
});

async function pdfOf(user: Buyer | null, ticketId: string): Promise<PdfResult> {
    const path = `/api/tickets/${ticketId}/pdf`;
    const req = user ? authed(path, 'GET', user) : new NextRequest(`${BASE_URL}${path}`);
    const res = await ticketPdf(req, routeContext({ id: ticketId }));
    const bytes = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get('content-type') ?? '';
    const json = type.includes('application/json') ? JSON.parse(bytes.toString('utf8')) as Row : {};
    return { status: res.status, type, bytes, json };
}

function show(r: PdfResult): string {
    return `HTTP ${r.status} ${r.type} ${JSON.stringify(r.json).slice(0, 300)}`;
}

function assertNoDocument(r: PdfResult, label: string): void {
    assert.ok(!r.bytes.subarray(0, 5).toString('latin1').startsWith('%PDF'), `${label} : aucun document ne doit partir`);
    assert.equal(typeof r.json.error, 'string', `${label} : message d'erreur attendu, ${show(r)}`);
}

async function paidTicket(): Promise<string> {
    const { tickets } = await buyConfirmed(owner, ev, [['Standard', 1]]);
    assert.equal(tickets.length, 1, 'un billet émis par le checkout');
    return String(tickets[0].id);
}

describe('8.2 v — PDF du billet : droits et états (cas portés, T2 à T6)', () => {
    test('témoin : le porteur télécharge son billet (200, application/pdf)', async () => {
        const r = await pdfOf(owner, await paidTicket());
        assert.equal(r.status, 200, show(r));
        assert.equal(r.type, 'application/pdf', show(r));
        assert.equal(r.bytes.subarray(0, 5).toString('latin1'), '%PDF-', 'en-tête PDF');
    });

    test('T2 : un tiers connecté → 403, aucun document', async () => {
        const stranger = await newBuyer('legacy-pdf-tiers');
        const r = await pdfOf(stranger, await paidTicket());
        assert.equal(r.status, 403, show(r));
        assert.match(String(r.json.error), /pas le propriétaire/, show(r));
        assertNoDocument(r, 'tiers');
    });

    test('T3 : sans session → 401 AUTH_REQUIRED, aucun document', async () => {
        const r = await pdfOf(null, await paidTicket());
        assert.equal(r.status, 401, show(r));
        assert.equal(r.json.code, 'AUTH_REQUIRED', show(r));
        assertNoDocument(r, 'sans session');
    });

    test('T4 : billet inconnu → 404, aucun document', async () => {
        const r = await pdfOf(owner, randomUUID());
        assert.equal(r.status, 404, show(r));
        assert.equal(r.json.error, 'Billet introuvable.', show(r));
        assertNoDocument(r, 'billet inconnu');
    });

    test('T5 : billet ANNULE, REMBOURSEMENT_EN_COURS puis REMBOURSE → 400, aucun document', async () => {
        const freeId = await issueFreeTicket(ev.eventId, ev.categories.Invitation.id, owner);
        const { data, error } = await service.rpc('ticket_refund_request', { p_ticket_id: freeId, p_actor: partner.userId, p_reason: 'Annulation du billet gratuit (lot 8)' });
        assert.equal(error, null, `annulation du billet gratuit : ${error?.message}`);
        assert.equal((data as Row | null)?.ok, true, JSON.stringify(data));
        assert.equal((await ticketRow(freeId)).status, 'ANNULE', 'précondition : billet gratuit ANNULE');
        const cancelled = await pdfOf(owner, freeId);
        assert.equal(cancelled.status, 400, `billet ANNULE : ${show(cancelled)}`);
        assert.match(String(cancelled.json.error), STALE, show(cancelled));
        assert.doesNotMatch(String(cancelled.json.error), RAW_STATUS, `aucun statut brut dans le message : ${show(cancelled)}`);
        assertNoDocument(cancelled, 'billet ANNULE');

        const paidId = await paidTicket();
        const refund = await CashoutService.requestTicketRefund({ ticketId: paidId, actorId: partner.userId, reason: 'Remboursement du billet (lot 8)' });
        assert.equal(refund.ok, true, JSON.stringify(refund));
        assert.equal(refund.mode, 'CASHOUT', 'billet payé en ligne : versement');
        assert.equal((await ticketRow(paidId)).status, 'REMBOURSEMENT_EN_COURS', 'précondition : remboursement en cours');
        const pending = await pdfOf(owner, paidId);
        assert.equal(pending.status, 400, `billet REMBOURSEMENT_EN_COURS : ${show(pending)}`);
        assert.match(String(pending.json.error), STALE, show(pending));
        assert.doesNotMatch(String(pending.json.error), RAW_STATUS, `aucun statut brut dans le message : ${show(pending)}`);

        assert.equal((await CashoutService.send(refund.cashout!.id)).status, 'CONFIRME', 'versement confirmé');
        assert.equal((await ticketRow(paidId)).status, 'REMBOURSE', 'précondition : billet remboursé');
        const refunded = await pdfOf(owner, paidId);
        assert.equal(refunded.status, 400, `billet REMBOURSE : ${show(refunded)}`);
        assert.match(String(refunded.json.error), STALE, show(refunded));
        assert.doesNotMatch(String(refunded.json.error), RAW_STATUS, `aucun statut brut dans le message : ${show(refunded)}`);
        assertNoDocument(refunded, 'billet REMBOURSE');
    });

    test('T6 : billet transféré → verrouillé pendant le transfert, puis ancien porteur 403 et nouveau porteur 200', async () => {
        const ticketId = await paidTicket();
        const recipient = await newBuyer('legacy-pdf-dest', { firstName: 'Mariama', lastName: 'Destinataire' });
        await markPhoneVerified(recipient.userId);
        const { data: started, error: startErr } = await service.rpc('ticket_transfer_initiate', {
            p: { ticket_id: ticketId, actor_id: owner.userId, recipient: recipient.phoneE164, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() },
        });
        assert.equal(startErr, null, `ticket_transfer_initiate : ${startErr?.message}`);
        assert.equal((started as Row | null)?.ok, true, `transfert refusé : ${JSON.stringify(started)}`);

        const locked = await pdfOf(owner, ticketId);
        assert.equal(locked.status, 400, `transfert en attente : ${show(locked)}`);
        assert.match(String(locked.json.error), /verrouillé/, show(locked));
        assertNoDocument(locked, 'transfert en attente');

        const { data: accepted, error: acceptErr } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: (started as Row).transfer_id, actor_id: recipient.userId } });
        assert.equal(acceptErr, null, `ticket_transfer_accept : ${acceptErr?.message}`);
        assert.equal((accepted as Row | null)?.ok, true, `acceptation refusée : ${JSON.stringify(accepted)}`);
        assert.equal((await ticketRow(ticketId)).user_id, recipient.userId, 'précondition : billet au destinataire');

        const former = await pdfOf(owner, ticketId);
        assert.equal(former.status, 403, `ancien porteur : ${show(former)}`);
        assertNoDocument(former, 'ancien porteur');
        const current = await pdfOf(recipient, ticketId);
        assert.equal(current.status, 200, `nouveau porteur : ${show(current)}`);
        assert.equal(current.type, 'application/pdf', show(current));
        assert.equal(current.bytes.subarray(0, 5).toString('latin1'), '%PDF-', 'en-tête PDF');
    });
});
