/**
 * Lot 9 ter, tâche 9t.12 b (consigne 0.8, R106 b ; contrat 5.B 9t.12 (b), 4.2 B.3, B.5 point 9, décision B-D22) — un seul
 * rapport de clôture : GET /api/partner/reports/closing sert le corps de pilotage_closing tel quel (`report.closing`), les
 * catégories de pilotage_sales (`salesByCategory`) et un `ticketsSummary` lu dans ces sources ; le PDF reprend les mêmes
 * libellés que l'onglet Clôture ; la fenêtre de clôture et l'onglet rendent un même composant ClosingReportSummary.
 *
 * Montage : partenaire neuve, événement PUBLIE (début dans 1 h, fenêtre de contrôle ouverte), jauge déclarée 50,
 * Standard 5 000 F ×10 ; 3 achats en ligne d'un billet, 1 vente en espèces (paiement hors plateforme rattaché au compte,
 * patron finance-remboursement-billet), 1 invitation (route), remboursement d'un billet en ligne (route de la
 * partenaire, versement envoyé puis confirmé), 1 scan accepté d'un billet en ligne et 1 scan refusé (billet remboursé)
 * par un contrôleur affecté. Attendu (contrat) : vendus 3 (hors invitations), invitations 1, capacité mise en vente 10
 * (quotas actifs), entrées 1, guichet 0, refus 1, absents 3 (billets VALIDE : en ligne non scanné, espèces, invitation).
 *
 * Rouge avant correctif (S-E fix(9t.12) : lib/partner/partner-dashboard.service.ts, route ; E-B : ClosingReportSummary) :
 * deux calculs, getClosingReportData compte les invitations dans les vendus (:790), prend events.capacity (:792) et
 * compte les billets UTILISE comme entrées (:791) ; `closing` absent ; le PDF n'a pas les libellés de l'onglet ;
 * ClosingReportSummary.tsx absent. Témoin 5 vert. after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { routeContext } from './helpers';
import { categoryState, fakePay, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, cashoutsByKey, confirmCashouts, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { authed, newController, scan, ticketPayload, withAccessSettings } from './acces-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;

const ROOT = process.cwd();
const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 5_000, total: 10 }];
const CLOSING_ROUTE = '../../app/api/partner/reports/closing/route';
const PDF_ROUTE = '../../app/api/partner/reports/closing/pdf/route';
const REFUND_ROUTE = '../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route';
const INVITE_ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const WINDOW = { 'access.scan_window_before_hours': 6, 'access.scan_window_after_hours': 6 } as const;

let partner: TestPartner;
let ev: DraftEvent;

/** Vente espèces : paiement hors plateforme SUCCESS rattaché au compte, billet VALIDE, stock vendu + 1. */
async function cashTicket(buyer: Buyer): Promise<string> {
    const cat = ev.categories[STANDARD];
    const { data: pay, error: payErr } = await service.from('payments').insert({
        transaction_id: `TX-CASH-9T12-${randomUUID()}`, client_id: buyer.userId, partner_id: partner.partnerId,
        payment_target: 'TICKET', amount: cat.price, currency: 'XOF', is_platform_payment: false,
        offline_payment_method: 'ESPECES', payment_method: 'CASH', status: 'SUCCESS', paid_at: new Date().toISOString(),
        metadata: { event_id: ev.eventId },
    }).select('id').single();
    assert.equal(payErr, null, `paiement espèces : ${payErr?.message}`);
    const { data: t, error: tErr } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: buyer.userId, payment_id: pay.id,
        ticket_number: `TCK-CASH-${randomUUID().slice(0, 12).toUpperCase()}`, price: cat.price,
        qr_code: `EV-QR-TEST-${randomUUID()}`, status: 'VALIDE',
    }).select('id').single();
    assert.equal(tErr, null, `billet espèces : ${tErr?.message}`);
    const state = await categoryState(cat.id);
    const { error: soldErr } = await service.from('ticket_categories').update({ sold_quantity: state.sold + 1 }).eq('id', cat.id);
    assert.equal(soldErr, null, `stock vendu : ${soldErr?.message}`);
    return String(t.id);
}

before(async () => {
    partner = await newPartner('rapport9t');
    ev = await createDraftEvent(partner, 'rapport-unique', CATEGORIES, { startsInHours: 1, durationHours: 4, capacity: 50 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    const online: string[] = [];
    for (let i = 0; i < 3; i++) {
        const { tickets } = await buyConfirmed(await newBuyer(`rapport-${i}`), ev, [[STANDARD, 1]]);
        online.push(String(tickets[0].id));
    }
    await cashTicket(await newBuyer('rapport-especes'));
    const inv = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations');
    const invited = await invoke(inv, authed(`/api/partner/events/${ev.eventId}/invitations`, 'POST', partner,
        { category_id: ev.categories[STANDARD].id, phones: [(await newBuyer('rapport-invite')).phoneE164], quantity: 1 }), routeContext({ id: ev.eventId }));
    assert.equal(invited.status, 200, `invitation : ${show(invited)}`);

    const refundRoute = await routeHandler(REFUND_ROUTE, 'POST', 'POST /api/partner/events/[id]/tickets/[ticketId]/refund');
    const refunded = await invoke(refundRoute, jsonRequest(`/api/partner/events/${ev.eventId}/tickets/${online[2]}/refund`, 'POST', partner.accessToken,
        { reason: 'Test 9 ter, rapport' }), routeContext({ id: ev.eventId, ticketId: online[2] }));
    for (const c of await cashoutsByKey(`REFUND-TKT-${online[2]}`)) {
        if (c.status === 'A_ENVOYER' && !c.blocked_reason) await CashoutService.send(String(c.id));
    }
    for (const c of await cashoutsByKey(`REFUND-TKT-${online[2]}`)) {
        if (c.samirpay_transaction_id) fakePay().setTransactionStatus(String(c.samirpay_transaction_id), 'SUCCESS');
    }
    await confirmCashouts();
    assert.equal(refunded.status, 200, `remboursement : ${show(refunded)}`);

    const controller = await newController(partner, ev.eventId, { label: 'rapport' });
    await withAccessSettings(WINDOW, async () => {
        const ok = await scan(controller, { eventId: ev.eventId, payload: await ticketPayload(online[0]) });
        assert.equal(ok.body.result, 'valid', `scan accepté : ${show(ok)}`);
        const ko = await scan(controller, { eventId: ev.eventId, payload: await ticketPayload(online[2]) });
        assert.equal(ko.status, 200, show(ko));
        assert.notEqual(ko.body.result, 'valid', `billet remboursé refusé : ${show(ko)}`);
    });
});

after(async () => {
    await assertLot9terInvariants('evenements-rapport-unique');
});

async function closingReport(who: Pick<Buyer, 'accessToken'>): Promise<{ status: number; body: Row }> {
    const handler = await routeHandler(CLOSING_ROUTE, 'GET', 'GET /api/partner/reports/closing');
    return invoke(handler, jsonRequest(`/api/partner/reports/closing?eventId=${ev.eventId}`, 'GET', who.accessToken));
}

async function rpcBody(name: 'pilotage_closing' | 'pilotage_sales'): Promise<Row> {
    const { data, error } = await service.rpc(name, { p: { event_id: ev.eventId, actor_id: partner.userId } });
    assert.equal(error, null, `${name} : ${error?.message}`);
    const body = (data ?? {}) as Row;
    assert.notEqual(body.ok, false, `${name} refusé : ${JSON.stringify(body)}`);
    return body;
}

function at(body: unknown, dotted: string): unknown {
    return dotted.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Row)[k] : undefined), body);
}

function withoutComputedAt(v: unknown): unknown {
    if (Array.isArray(v)) return v.map(withoutComputedAt);
    if (v && typeof v === 'object') {
        return Object.fromEntries(Object.entries(v as Row).filter(([k]) => k !== 'computed_at').map(([k, x]) => [k, withoutComputedAt(x)]));
    }
    return v;
}

describe('9t.12 b (R106) : un seul rapport de clôture', () => {
    test('la route du tableau de bord sert les chiffres de pilotage_closing (vendus hors invitations, capacité mise en vente, entrées par le contrôle)', async () => {
        const res = await closingReport(partner);
        assert.equal(res.status, 200, show(res));
        const report = res.body.report as Row;
        const closing = await rpcBody('pilotage_closing');
        assert.ok(report.closing && typeof report.closing === 'object', `report.closing servi tel quel (contrat 4.2 B.3) : clés ${Object.keys(report).join(', ')}`);
        assert.deepEqual(withoutComputedAt(report.closing), withoutComputedAt(closing), 'report.closing = corps de pilotage_closing');
        const summary = report.ticketsSummary as Row;
        // absents = closing.absents.count = billets VALIDE (M/20261102000005:815, F47 inchangée hors entries) : billet en
        // ligne non scanné, billet espèces et invitation (émise VALIDE) = 3 ; le 2 du contrat (vendus 3 − entrées 1)
        // oubliait l'invitation, non scannée (correcteur S-P, run 132).
        assert.deepEqual(summary, { sold: 3, invitations: 1, capacity: 10, entries: 1, counterEntries: 0, refused: 1, absents: 3 },
            `ticketsSummary (aujourd'hui vendus 4 invitation comprise, capacité 50) : ${JSON.stringify(summary)}`);
        const sources: Record<string, string> = {
            sold: 'report.tickets.sold', invitations: 'report.tickets.invitations', capacity: 'report.tickets.capacity',
            entries: 'report.entries.total', counterEntries: 'report.entries.counter', refused: 'report.entries.refused', absents: 'absents.count',
        };
        for (const [k, src] of Object.entries(sources)) assert.equal(Number(at(report, `ticketsSummary.${k}`)), Number(at(closing, src)), `${k} = pilotage_closing.${src}`);
        assert.equal(Number(at(report, 'financialSummary.totalNet')), Number(at(closing, 'finance.organizer_net')), 'totalNet = closing.finance.organizer_net');
    });

    test('catégories du rapport = celles de la vente (pilotage_sales.by_category)', async () => {
        const res = await closingReport(partner);
        assert.equal(res.status, 200, show(res));
        const rows = (res.body.report as Row).salesByCategory as Row[];
        const sales = (await rpcBody('pilotage_sales')).by_category as Row[];
        assert.ok(Array.isArray(rows) && rows.length === 1 && Array.isArray(sales) && sales.length === 1, `une catégorie : ${JSON.stringify({ rows, sales })}`);
        const r = rows[0];
        const s = sales[0];
        assert.deepEqual(
            [r.soldQuantity, r.invitations, r.onlineQuantity, r.cashQuantity, r.remainingQuantity, r.grossAmount].map(Number),
            [s.sold, s.invitations, s.sold_online, s.sold_cash, s.remaining, s.revenue_online].map(Number),
            `salesByCategory[0] = pilotage_sales.by_category[0] : ${JSON.stringify({ r, s })}`);
    });

    test('PDF : mêmes libellés que l\'onglet Clôture', async () => {
        const handler = await routeHandler(PDF_ROUTE, 'GET', 'GET /api/partner/reports/closing/pdf');
        const res = await handler(jsonRequest(`/api/partner/reports/closing/pdf?eventId=${ev.eventId}`, 'GET', partner.accessToken));
        assert.equal(res.status, 200, `PDF : HTTP ${res.status}`);
        const text = Buffer.from(await res.arrayBuffer()).toString('latin1');
        for (const label of ['Billets vendus (hors invitations)', 'Invitations', 'Capacit\xE9 mise en vente', 'Entr\xE9es (dont guichet)', 'Refus au contr\xF4le', 'Rapport de cl\xF4ture', 'CLOTURE-']) {
            assert.ok(text.includes(label), `PDF : libellé « ${label} » absent`);
        }
    });

    test('statique : un seul composant pour la fenêtre et l\'onglet ; getClosingReportData lit pilotage_closing et pilotage_sales, plus les billets', () => {
        for (const rel of ['components/partner/ClosingReportModal.tsx', 'components/partner/pilotage/ClosingTab.tsx']) {
            const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            assert.match(src, /import\s*\{[^}]*\bClosingReportSummary\b[^}]*\}\s*from|import\s+ClosingReportSummary\b/, `${rel} importe ClosingReportSummary`);
        }
        const svc = fs.readFileSync(path.join(ROOT, 'lib/partner/partner-dashboard.service.ts'), 'utf8');
        const start = svc.indexOf('getClosingReportData(');
        assert.ok(start >= 0, 'getClosingReportData présente');
        const next = svc.slice(start + 1).search(/\n {4}(?:public |private |protected )?(?:static )?(?:async )?\w+\s*\(/);
        const body = next >= 0 ? svc.slice(start, start + 1 + next) : svc.slice(start);
        assert.match(body, /\.rpc\(\s*['"]pilotage_closing['"]/, 'getClosingReportData appelle pilotage_closing');
        assert.match(body, /\.rpc\(\s*['"]pilotage_sales['"]/, 'getClosingReportData appelle pilotage_sales');
        assert.ok(!body.includes('ticketsOfEvents'), 'getClosingReportData ne relit plus les billets (ticketsOfEvents)');
    });

    test('témoin : une autre partenaire est refusée (403), sans aucun chiffre', async () => {
        const other = await newPartner('rapport9t-autre');
        const res = await closingReport(other);
        assert.equal(res.status, 403, show(res));
        assert.equal(res.body.report, undefined, 'aucun chiffre servi');
    });
});
