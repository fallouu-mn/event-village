/**
 * Lot 8, tâche 8.3 d, anomalie A3, puis lot 9 bis, tâche 1 (T16, règle changée par la consigne : B1 à B4, contrat 4.1)
 * — « Versements à reprendre » : GET /api/admin/refunds?state=to_retry et les décisions POST /api/admin/cashouts/[id]/resend
 * et …/mark-paid (la route refunds/[id]/retry est supprimée, B4).
 *  1. droits de la liste : 401 sans session, 403 sans refunds.manage (client, partenaire, ADMIN sans la permission,
 *     ADMIN SUSPENDU), 200 avec la permission et pour le SUPERADMIN ;
 *  2. périmètre exact (oracle SQL écrit à part, B1) : remboursements ECHOUE, tout INCERTAIN, tout A_ENVOYER bloqué, à
 *     envoyer ou envoyé depuis plus de 30 min, tous types, retraits compris ; ni retrait ECHOUE, ni CONFIRME, ni récent ;
 *  3. ligne par ligne (champs du contrat 4.1) : montant, état, titre de l'événement, bénéficiaire masqué, can_resend et
 *     can_mark_paid, motif en français ; ni numéro complet, ni erreur brute de SamirPay, ni code de blocage ;
 *  4. l'identifiant renvoyé est celui de « Renvoyer » (justification) : deuxième envoi compté sur le numéro du payeur,
 *     la ligne quitte la liste ;
 *  5. 100 lignes au plus, `total` ;
 *  6. statique : /admin/finance monte RefundsToRetry, qui relit la liste, n'appelle « Renvoyer » et « Marquer versé »
 *     que depuis un ConfirmDialog, envoie la justification et affiche le refus du serveur, n'offre chaque bouton que
 *     sous can_resend ou can_mark_paid et renvoie le cas incertain au support SamirPay.
 *
 * Rouge jusqu'à fix(9b.1) (S-V) et fix(9b.1e) (E-V) : forme de la liste (contrat 4.1), périmètre, routes de décision
 * absentes (import dynamique). Titres et lignes des 5 tests cités par la matrice gardés (D-out 7.1, règle 5). Les
 * envois sont comptés par numéro de payeur neuf. L'administrateur de la suite est suspendu en fin de suite.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import ts from 'typescript';
import { CashoutService } from '../../lib/payments/cashout.service';
import { maskPhone } from '../../lib/payments/payer-phone';
import { inspect } from '../helpers/db';
import { bearer, signInAs } from '../helpers/fixtures';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { BASE_URL } from './helpers';
import { authed, type RouteResult } from './acces-helpers';
import { buyConfirmed, createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { callsOf, fakePay, importModule, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { newAdminWith } from './terrain-helpers';
import type { TestAdmin } from './notif-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const ROUTE = '../../app/api/admin/refunds/route';
const FULL_BALANCE = 10_000_000;
const PANEL = 'components/admin/RefundsToRetry.tsx';
const FINANCE_PAGE = 'app/admin/finance/page.tsx';
const DECISION_ROUTE = (action: 'resend' | 'mark-paid'): string => `../../app/api/admin/cashouts/[id]/${action}/route`;
const ITEM_KEYS = [
    'advice', 'amount', 'beneficiary', 'block_label', 'can_mark_not_sent', 'can_mark_paid', 'can_resend', 'event_title', 'id', 'kind', 'kind_label', 'since', 'state', 'state_label',
];
/** Code technique en capitales, jamais affiché (Conventions, Textes). */
const RAW_CODE = /\b[A-Z]{2,}(?:_[A-Z]+)+\b/;

let partner: TestPartner;
let ev: SaleEvent;
let eventTitle: string;
let admin: TestAdmin;
let ready = false;

const createdAccounts: string[] = [];

interface Refundable { buyer: Buyer; ticketId: string; cashoutId: string; refundId: string }

/** Installation commune aux suites à base ; les contrôles statiques de fin de fichier n'en ont pas besoin. */
async function setup(): Promise<void> {
    if (ready) return;
    partner = await newPartner('a3');
    ev = await createPartnerEvent(partner.partnerId, 'a3', [{ name: 'Standard', price: 5000, total: 40 }]);
    const { data, error } = await service.from('events').select('title').eq('id', ev.eventId).single();
    assert.equal(error, null, `événement : ${error?.message}`);
    eventTitle = String(data.title);
    admin = await newAdminWith(['refunds.manage'], { label: 'a3' });
    createdAccounts.push(admin.userId);
    ready = true;
}

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    if (createdAccounts.length > 0) {
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).in('id', createdAccounts).eq('status', 'ACTIF');
        assert.equal(error, null, `suspension des comptes de la suite : ${error?.message}`);
    }
    await assertRecetteInvariants('admin-remboursements');
});

// ── Appels ─────────────────────────────────────────────────────────────────

async function listHandler(): Promise<Handler> {
    let mod: { GET?: Handler };
    try {
        mod = await importModule(ROUTE);
    } catch (err) {
        assert.fail(`GET /api/admin/refunds absente : app/api/admin/refunds/route.ts (contrat 3.10, fix(8.3-A3s)) — ${String((err as Error).message).split('\n')[0]}`);
    }
    assert.equal(typeof mod.GET, 'function', 'app/api/admin/refunds/route.ts : GET non exporté');
    return mod.GET!;
}

async function list(token: string | null, query = '?state=to_retry'): Promise<RouteResult> {
    const handler = await listHandler();
    const res = await handler(new NextRequest(`${BASE_URL}/api/admin/refunds${query}`, { method: 'GET', headers: token ? bearer(token) : {} }));
    return { status: res.status, body: await res.json() as Row };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 500)}`;
}

async function listed(): Promise<{ items: Row[]; total: unknown; raw: string }> {
    const r = await list(admin.accessToken);
    assert.equal(r.status, 200, show(r));
    assert.ok(Array.isArray(r.body.items), `items : ${show(r)}`);
    return { items: r.body.items as Row[], total: r.body.total, raw: JSON.stringify(r.body) };
}

// ── Remboursements fabriqués par le vrai module ────────────────────────────

/** Billet payé par un acheteur neuf, remboursement demandé : cashout A_ENVOYER, pas encore envoyé. */
async function refundable(label: string): Promise<Refundable> {
    const buyer = await newBuyer(`a3-${label}`);
    const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 1]]);
    const ticketId = String(tickets[0].id);
    const out = await CashoutService.requestTicketRefund({ ticketId, actorId: partner.userId, reason: `A3 ${label} (lot 8)` });
    assert.equal(out.ok, true, `remboursement refusé : ${JSON.stringify(out)}`);
    const cashout = out.cashout!;
    assert.equal(cashout.status, 'A_ENVOYER', 'précondition : à envoyer');
    const row = await cashoutRow(cashout.id);
    assert.ok(row.refund_id, 'précondition : cashout rattaché à son remboursement');
    return { buyer, ticketId, cashoutId: cashout.id, refundId: String(row.refund_id) };
}

async function cashoutRow(id: string): Promise<Row> {
    const { data, error } = await service.from('cashouts').select('*').eq('id', id).single();
    assert.equal(error, null, `cashout ${id} : ${error?.message}`);
    return data as Row;
}

async function sentIn(mode: 'success' | 'rejected' | 'timeout' | 'pending', r: Refundable): Promise<string> {
    setFakeMode('cashoutMode', mode);
    try {
        return (await CashoutService.send(r.cashoutId)).status;
    } finally {
        setFakeMode('cashoutMode', 'success');
    }
}

/** Paiement ancien, sans opérateur connu : remboursement bloqué OPERATOR_UNKNOWN (patron de paiement-remboursement:62). */
async function blockedWithoutOperator(): Promise<{ cashoutId: string; refundId: string }> {
    const buyer = await newBuyer('a3-sans-operateur');
    const { data: pay, error } = await service.from('payments').insert({
        transaction_id: `TX-TEST-${randomUUID()}`, external_order_id: `ORD-TEST-${randomUUID()}`, client_id: buyer.userId,
        payment_target: 'TICKET', amount: 4000, facial_amount: 4000, service_fee: 0, aggregator_fee: 0, partner_payout_amount: 4000,
        gross_event_village_revenue: 0, net_event_village_revenue: 0, currency: 'XOF', is_platform_payment: true,
        status: 'REFUND_PENDING', operator: null, payer_phone: null,
    }).select('id').single();
    assert.equal(error, null, `paiement de test : ${error?.message}`);
    const cashout = await CashoutService.requestRefund({ paymentId: pay.id, reason: 'A3 sans opérateur (lot 8)' });
    assert.ok(cashout, 'cashout créé');
    assert.equal(cashout.blocked_reason, 'OPERATOR_UNKNOWN', 'précondition : blocage opérateur');
    return { cashoutId: cashout.id, refundId: String(cashout.refund_id) };
}

const REFUND_SCOPE_SQL = `
    SELECT count(*)::int AS n FROM public.cashouts WHERE simulated = false AND ((status = 'ECHOUE' AND kind <> 'WITHDRAWAL') OR status = 'INCERTAIN'
        OR (status = 'A_ENVOYER' AND (blocked_reason IS NOT NULL OR COALESCE(send_started_at, created_at) < now() - interval '30 minutes'))
        OR (status = 'ENVOYE' AND COALESCE(sent_at, created_at) < now() - interval '30 minutes'))`;

async function scopeCount(): Promise<number> {
    return inspect(async (db) => Number((await db.query<{ n: number }>(REFUND_SCOPE_SQL)).rows[0].n));
}

// ── 1. Droits ──────────────────────────────────────────────────────────────

describe('A3 — GET /api/admin/refunds : droits (permission refunds.manage)', () => {
    before(setup);

    test('sans session 401 ; client, partenaire, ADMIN sans la permission 403 ; SUSPENDU 403 ; avec la permission et SUPERADMIN 200', async () => {
        const anonymous = await list(null);
        assert.equal(anonymous.status, 401, `sans session : ${show(anonymous)}`);

        const client = await signInAs('CLIENT');
        const r1 = await list(client.accessToken);
        assert.equal(r1.status, 403, `client : ${show(r1)}`);

        const r2 = await list(partner.accessToken);
        assert.equal(r2.status, 403, `partenaire : ${show(r2)}`);

        const without = await newAdminWith(['users.read', 'payments.read'], { label: 'a3-sans' });
        createdAccounts.push(without.userId);
        const r3 = await list(without.accessToken);
        assert.equal(r3.status, 403, `ADMIN sans refunds.manage : ${show(r3)}`);

        const suspended = await newAdminWith(['refunds.manage'], { label: 'a3-suspendu' });
        createdAccounts.push(suspended.userId);
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const r4 = await list(suspended.accessToken);
        assert.equal(r4.status, 403, `ADMIN SUSPENDU : ${show(r4)}`);
        assert.equal(r4.body.code, 'ACCOUNT_NOT_ACTIVE', `ADMIN SUSPENDU : ${show(r4)}`);

        const r5 = await list(admin.accessToken);
        assert.equal(r5.status, 200, `ADMIN avec refunds.manage : ${show(r5)}`);
        assert.equal(typeof r5.body.total, 'number', `total (contrat 4.1) : ${show(r5)}`);

        const superadmin = await signInAs('SUPERADMIN');
        const r6 = await list(superadmin.accessToken);
        assert.equal(r6.status, 200, `SUPERADMIN : ${show(r6)}`);
    });
});

// ── 2 à 4. Contenu ─────────────────────────────────────────────────────────

/** Décision de l'administration (contrat 4.1, B4), route importée dynamiquement : absente avant fix(9b.1). */
async function decide(action: 'resend' | 'mark-paid', cashoutId: string, body: Row): Promise<RouteResult> {
    let mod: { POST?: Handler };
    try {
        mod = await importModule(DECISION_ROUTE(action));
    } catch (err) {
        assert.fail(`POST /api/admin/cashouts/[id]/${action} absente (contrat 4.1, B4, fix(9b.1)) — ${String((err as Error).message).split('\n')[0]}`);
    }
    assert.equal(typeof mod.POST, 'function', `app/api/admin/cashouts/[id]/${action}/route.ts : POST non exporté`);
    const res = await mod.POST!(authed(`/api/admin/cashouts/${cashoutId}/${action}`, 'POST', admin, body), { params: Object.assign(Promise.resolve({ id: cashoutId }), { id: cashoutId }) });
    return { status: res.status, body: await res.json() as Row };
}

describe('A3 — liste des remboursements à reprendre (contrat 3.10)', () => {
    let failed: Refundable;
    let uncertain: Refundable;
    let noBalance: Refundable;
    let noOperator: { cashoutId: string; refundId: string };
    let late: Refundable;
    let withdrawalId: string;
    const excluded: Array<{ what: string; cashoutId: string }> = [];

    before(async () => {
        await setup();
        failed = await refundable('echec');
        assert.equal(await sentIn('rejected', failed), 'ECHOUE', 'précondition : refus de SamirPay');
        uncertain = await refundable('incertain');
        assert.equal(await sentIn('timeout', uncertain), 'INCERTAIN', 'précondition : issue incertaine');
        noBalance = await refundable('solde');
        fakePay().balance = 0;
        try {
            assert.equal((await CashoutService.send(noBalance.cashoutId)).skipped, 'SOLDE_INSUFFISANT', 'précondition : solde vide');
        } finally {
            fakePay().balance = FULL_BALANCE;
        }
        noOperator = await blockedWithoutOperator();
        late = await refundable('en-attente');
        const aged = await service.from('cashouts').update({ created_at: new Date(Date.now() - 31 * 60_000).toISOString() }).eq('id', late.cashoutId);
        assert.equal(aged.error, null, `à envoyer depuis 31 minutes : ${aged.error?.message}`);

        const confirmed = await refundable('confirme');
        assert.equal(await sentIn('success', confirmed), 'CONFIRME', 'précondition : versement confirmé');
        excluded.push({ what: 'CONFIRME', cashoutId: confirmed.cashoutId });
        const pending = await refundable('envoye');
        assert.equal(await sentIn('pending', pending), 'ENVOYE', 'précondition : versement en attente');
        excluded.push({ what: 'ENVOYE depuis moins de 30 min', cashoutId: pending.cashoutId });
        const notSent = await refundable('a-envoyer');
        excluded.push({ what: 'A_ENVOYER sans blocage depuis moins de 30 min', cashoutId: notSent.cashoutId });

        const { data: withdrawals, error } = await service.from('cashouts').insert([
            { kind: 'WITHDRAWAL', idempotency_key: `WITHDRAWAL-A3-${randomUUID()}`, amount: 1000, status: 'ECHOUE' },
            { kind: 'WITHDRAWAL', idempotency_key: `WITHDRAWAL-A3-${randomUUID()}`, amount: 1000, status: 'INCERTAIN' },
        ]).select('id, status');
        assert.equal(error, null, `retraits de test : ${error?.message}`);
        excluded.push({ what: 'retrait ECHOUE (clos, solde rendu)', cashoutId: String(withdrawals!.find((w) => w.status === 'ECHOUE')!.id) });
        withdrawalId = String(withdrawals!.find((w) => w.status === 'INCERTAIN')!.id);
    });

    function item(items: Row[], cashoutId: string): Row {
        const found = items.find((i) => i.id === cashoutId);
        assert.ok(found, `cashout ${cashoutId} absent de la liste`);
        return found;
    }

    async function assertCommon(row: Row, cashoutId: string, refundId: string): Promise<void> {
        const db = await cashoutRow(cashoutId);
        assert.deepEqual(Object.keys(row).sort(), ITEM_KEYS, `champs de la ligne (contrat 4.1) : ${JSON.stringify(row)}`);
        assert.equal(db.refund_id, refundId, 'précondition : cashout du remboursement');
        assert.deepEqual([row.kind, Number(row.amount)], [db.kind, Number(db.amount)], 'type et montant du cashout');
        assert.ok(Date.parse(String(row.since)) >= Date.parse(String(db.created_at)) - 1000, `since ${String(row.since)} postérieur à la création ${String(db.created_at)}`);
        for (const label of [row.kind_label, row.state_label]) assert.doesNotMatch(String(label), RAW_CODE, 'libellé en français, sans code technique');
    }

    test('périmètre exact : le nombre de lignes est celui de l’oracle, aucune opération hors périmètre', async () => {
        const count = await scopeCount();
        assert.ok(count >= 6 && count <= 100, `précondition : ${count} versements à reprendre en base (6 à 100 attendus)`);
        const { items, total } = await listed();
        assert.equal(items.length, count, `lignes rendues ≠ oracle (${count})`);
        assert.equal(total, count, 'liste complète : total = lignes rendues');
        for (const e of excluded) assert.equal(items.some((i) => i.id === e.cashoutId), false, `${e.what} ne doit pas figurer dans la liste`);
        assert.equal(item(items, withdrawalId).kind, 'WITHDRAWAL', 'retrait incertain listé (retraits compris, R9)');
        assert.equal(item(items, late.cashoutId).state, 'EN_ATTENTE', 'à envoyer depuis plus de 30 min : EN_ATTENTE (R1)');
    });

    test('refus de SamirPay : état ECHOUE, relance possible, titre de l’événement, numéro masqué', async () => {
        const { items } = await listed();
        const row = item(items, failed.cashoutId);
        await assertCommon(row, failed.cashoutId, failed.refundId);
        assert.equal(row.kind, 'TICKET_REFUND');
        assert.deepEqual([row.state, row.can_resend, row.can_mark_paid], ['ECHOUE', 'NOW', true], 'refus 400 : rien n’est parti, renvoi immédiat (B3)');
        assert.equal(row.event_title, eventTitle);
        assert.ok(String(row.beneficiary).includes(maskPhone(failed.buyer.phone9)), `bénéficiaire masqué : ${String(row.beneficiary)}`);
    });

    test('issue incertaine : état INCERTAIN, jamais de relance', async () => {
        const { items } = await listed();
        const row = item(items, uncertain.cashoutId);
        await assertCommon(row, uncertain.cashoutId, uncertain.refundId);
        assert.deepEqual([row.state, row.can_resend, row.can_mark_paid], ['INCERTAIN', false, true], 'sans identifiant SamirPay : aucun renvoi, « Marquer versé » seul (B2)');
        assert.ok(String(row.beneficiary).includes(maskPhone(uncertain.buyer.phone9)), `bénéficiaire masqué : ${String(row.beneficiary)}`);
    });

    test('solde insuffisant : état BLOQUE, relance possible, motif en français', async () => {
        const { items } = await listed();
        const row = item(items, noBalance.cashoutId);
        await assertCommon(row, noBalance.cashoutId, noBalance.refundId);
        assert.deepEqual([row.state, row.can_resend, row.can_mark_paid], ['BLOQUE', 'NOW', true], 'SOLDE_INSUFFISANT : rien de débité (B5)');
        assert.equal(typeof row.block_label, 'string', 'motif du blocage');
        assert.ok(String(row.block_label).length > 0, 'motif du blocage vide');
        assert.doesNotMatch(String(row.block_label), RAW_CODE, 'code technique affiché');
    });

    test('opérateur inconnu : état BLOQUE, relance impossible, aucun numéro ni événement à montrer', async () => {
        const { items } = await listed();
        const row = item(items, noOperator.cashoutId);
        await assertCommon(row, noOperator.cashoutId, noOperator.refundId);
        assert.deepEqual([row.state, row.can_resend, row.can_mark_paid], ['BLOQUE', false, true], 'aucune destination : pas de renvoi, « Marquer versé » seul');
        assert.doesNotMatch(String(row.block_label), RAW_CODE, 'code technique affiché');
        assert.equal(row.event_title, null);
        assert.ok(row.beneficiary === null || !/[0-9]/.test(String(row.beneficiary)), `numéro inconnu, aucun chiffre à montrer : ${JSON.stringify(row.beneficiary)}`);
    });

    test('jamais de numéro complet, d’erreur brute de SamirPay ni de code de blocage dans la réponse', async () => {
        const failedRow = await cashoutRow(failed.cashoutId);
        const uncertainRow = await cashoutRow(uncertain.cashoutId);
        assert.ok(failedRow.last_error, 'précondition : erreur brute enregistrée');
        assert.ok(uncertainRow.last_error, 'précondition : erreur brute enregistrée');
        const { raw } = await listed();
        for (const r of [failed, uncertain, noBalance, late]) {
            assert.equal(raw.includes(r.buyer.phone9), false, `numéro complet ${r.buyer.phone9} dans la réponse`);
            assert.equal(raw.includes(r.buyer.phoneE164), false, `numéro complet ${r.buyer.phoneE164} dans la réponse`);
        }
        assert.equal(raw.includes(String(failedRow.last_error)), false, 'erreur brute du refus renvoyée au navigateur');
        assert.equal(raw.includes(String(uncertainRow.last_error)), false, 'erreur brute du délai renvoyée au navigateur');
        for (const c of ['SOLDE_INSUFFISANT', 'OPERATOR_UNKNOWN']) assert.equal(raw.includes(c), false, `code de blocage ${c} renvoyé au navigateur`);
    });

    test('tri du plus ancien au plus récent (since)', async () => {
        const { items } = await listed();
        const times = items.map((i) => new Date(String(i.since)).getTime());
        assert.ok(times.every((t) => Number.isFinite(t)), `since illisible : ${items.map((i) => i.since).join(', ')}`);
        assert.ok(times.every((t, i) => i === 0 || t >= times[i - 1]), `lignes non triées du plus ancien au plus récent (contrat 4.1) : ${items.map((i) => i.since).join(', ')}`);
    });

    test('le refund_id de la liste est celui de la relance : deuxième envoi, CONFIRME, la ligne quitte la liste', async () => {
        const before0 = callsOf('sendCashout').filter((c) => c.args.phoneNumber === failed.buyer.phone9).length;
        assert.equal(before0, 1, 'précondition : un envoi refusé');
        const { items } = await listed();
        const row = item(items, failed.cashoutId);

        const res = await decide('resend', String(row.id), { reason: 'Refus de l’opérateur levé, nouvel essai (test A3, lot 9 bis)' });
        assert.equal(res.status, 200, show(res));
        assert.equal(res.body.ok, true, show(res));
        assert.equal(res.body.status, 'CONFIRME', `statut rendu par « Renvoyer » (contrat 4.1) : ${show(res)}`);

        assert.equal((await cashoutRow(failed.cashoutId)).status, 'CONFIRME');
        assert.equal(callsOf('sendCashout').filter((c) => c.args.phoneNumber === failed.buyer.phone9).length, 2, 'un seul nouvel envoi');
        const after0 = await listed();
        assert.equal(after0.items.some((i) => i.id === failed.cashoutId), false, 'la ligne renvoyée quitte la liste');
    });

    test('100 lignes au plus : total au-delà, liste complète une fois revenu sous le plafond', async () => {
        const key = `REFUND-A3-PLAFOND-${randomUUID()}`;
        const room = 101 - await scopeCount();
        assert.ok(room > 0, 'précondition : moins de 101 lignes en base');
        const rows = Array.from({ length: room }, (_, i) => ({ kind: 'REFUND', idempotency_key: `${key}-${i}`, amount: 1000, status: 'INCERTAIN' }));
        const { error } = await service.from('cashouts').insert(rows);
        assert.equal(error, null, `lignes de test : ${error?.message}`);
        try {
            assert.equal(await scopeCount(), 101, 'précondition : 101 lignes dans le périmètre');
            const capped = await listed();
            assert.equal(capped.items.length, 100, '100 lignes au plus');
            assert.equal(capped.total, 101, 'total des lignes à reprendre, masquées comprises');
        } finally {
            const { error: delErr } = await service.from('cashouts').delete().like('idempotency_key', `${key}-%`);
            assert.equal(delErr, null, `retrait des lignes de test : ${delErr?.message}`);
        }
        const back = await listed();
        assert.equal(back.total, back.items.length, 'sous le plafond : toutes les lignes rendues');
    });
});

// ── 5. Écran (statique) ────────────────────────────────────────────────────

function parseFile(rel: string): ts.SourceFile {
    const abs = path.join(process.cwd(), ...rel.split('/'));
    assert.ok(fs.existsSync(abs), `${rel} absent (contrat 13.4, fix(8.3-A3e))`);
    return ts.createSourceFile(rel, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

const printer = ts.createPrinter({ removeComments: true });

function code(sf: ts.SourceFile, node: ts.Node = sf): string {
    return node === sf ? printer.printFile(sf) : printer.printNode(ts.EmitHint.Unspecified, node, sf);
}

function nodesOf(root: ts.Node, keep: (n: ts.Node) => boolean): ts.Node[] {
    const out: ts.Node[] = [];
    const visit = (n: ts.Node): void => {
        if (keep(n)) out.push(n);
        ts.forEachChild(n, visit);
    };
    visit(root);
    return out;
}

function clean(text: string): string {
    return text.replace(/&apos;|&#39;|&rsquo;|’/g, '\'').replace(/[\s  ]+/g, ' ').trim();
}

function tagName(n: ts.Node): string | null {
    if (ts.isJsxElement(n)) return n.openingElement.tagName.getText();
    if (ts.isJsxSelfClosingElement(n)) return n.tagName.getText();
    return null;
}

/** Balise qui porte un attribut JSX. */
function ownerTag(attr: ts.JsxAttribute): string | null {
    const owner = attr.parent.parent;
    return ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner) ? owner.tagName.getText() : null;
}

function attribute(n: ts.Node, name: string): ts.JsxAttribute | undefined {
    const attrs = ts.isJsxElement(n) ? n.openingElement.attributes : ts.isJsxSelfClosingElement(n) ? n.attributes : null;
    return attrs?.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === name) as ts.JsxAttribute | undefined;
}

function isFunctionNode(n: ts.Node): boolean {
    return ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n);
}

/** Fonctions locales par nom : `function f`, `const f = () => …`, `const f = useCallback(() => …)`. */
function localFunctions(sf: ts.SourceFile): Map<string, ts.Node> {
    const out = new Map<string, ts.Node>();
    for (const n of nodesOf(sf, (x) => ts.isFunctionDeclaration(x) || ts.isVariableDeclaration(x))) {
        if (ts.isFunctionDeclaration(n)) {
            if (n.name) out.set(n.name.text, n);
            continue;
        }
        const decl = n as ts.VariableDeclaration;
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        const init = decl.initializer;
        if (isFunctionNode(init)) out.set(decl.name.text, init);
        else if (ts.isCallExpression(init) && init.expression.getText() === 'useCallback' && init.arguments[0]) out.set(decl.name.text, init.arguments[0]);
    }
    return out;
}

/** `node` mène-t-il, directement ou par des fonctions locales qu'il cite, à un code qui satisfait `hit` ? */
function reaches(sf: ts.SourceFile, node: ts.Node, hit: (text: string) => boolean, fns = localFunctions(sf), seen: Set<ts.Node> = new Set()): boolean {
    if (seen.has(node)) return false;
    seen.add(node);
    if (hit(code(sf, node))) return true;
    return nodesOf(node, ts.isIdentifier).some((n) => {
        const target = fns.get((n as ts.Identifier).text);
        return target !== undefined && reaches(sf, target, hit, fns, seen);
    });
}

const isDecisionCall = (text: string): boolean => /\bfetch\(/.test(text) && /\/api\/admin\/cashouts\/\$\{[^}]+\}\/(?:resend|mark-paid)/.test(text);

describe('A3 — écran : /admin/finance monte le panneau « Versements à reprendre » (statique)', () => {
    test('/admin/finance importe et rend RefundsToRetry', () => {
        const sf = parseFile(FINANCE_PAGE);
        assert.ok(nodesOf(sf, (n) => ts.isImportDeclaration(n) && (n.moduleSpecifier as ts.StringLiteral).text === '@/components/admin/RefundsToRetry').length === 1,
            `${FINANCE_PAGE} n'importe pas @/components/admin/RefundsToRetry`);
        assert.ok(nodesOf(sf, (n) => tagName(n) === 'RefundsToRetry').length === 1, `${FINANCE_PAGE} ne rend pas <RefundsToRetry />`);
    });

    test('le panneau lit GET /api/admin/refunds?state=to_retry, titre « Versements à reprendre »', () => {
        const sf = parseFile(PANEL);
        assert.match(code(sf), /\/api\/admin\/refunds\?state=to_retry/, `${PANEL} ne lit pas la liste`);
        const texts = nodesOf(sf, (n) => ts.isJsxText(n) || ts.isStringLiteralLike(n)).map((n) => clean((n as ts.LiteralLikeNode).text));
        assert.ok(texts.includes('Versements à reprendre'), `${PANEL} : titre « Versements à reprendre » absent (5.1)`);
    });

    test('la relance part seulement d’un ConfirmDialog, jamais directement d’un bouton', () => {
        const sf = parseFile(PANEL);
        for (const action of ['resend', 'mark-paid']) assert.ok(reaches(sf, sf, (t) => isDecisionCall(t) && t.includes(`/${action}`)), `${PANEL} n'appelle pas POST /api/admin/cashouts/<id>/${action}`);
        const handlers = nodesOf(sf, ts.isJsxAttribute).filter((a) => /^on[A-Z]/.test((a as ts.JsxAttribute).name.getText())) as ts.JsxAttribute[];
        const direct = handlers.filter((a) => a.initializer !== undefined && reaches(sf, a.initializer, isDecisionCall));
        assert.ok(direct.length > 0, `${PANEL} : aucun gestionnaire ne mène à « Renvoyer » ni à « Marquer versé »`);
        const outside = direct.filter((a) => !(a.name.getText() === 'onConfirm' && ownerTag(a) === 'ConfirmDialog'));
        assert.deepEqual(outside.map((a) => code(sf, a)), [], 'décision hors du ConfirmDialog');
    });

    test('chaque décision envoie la justification et affiche le refus du serveur (message en français)', () => {
        const sf = parseFile(PANEL);
        const decisions = Array.from(localFunctions(sf).values()).filter((f) => isDecisionCall(code(sf, f)));
        assert.ok(decisions.length > 0, `${PANEL} : fonction de décision introuvable`);
        for (const f of decisions) assert.match(code(sf, f), /\breason\b/, 'la justification (reason) est envoyée au serveur');
        for (const f of decisions) assert.match(code(sf, f), /\.error\b/, 'le panneau affiche le refus du serveur (409, 400) : res.ok seul ne dit pas pourquoi');
    });

    test('« Relancer » n’existe que sous can_retry, et le cas incertain renvoie à SamirPay', () => {
        const sf = parseFile(PANEL);
        for (const [label, flag] of [['Renvoyer', /can_resend/], ['Marquer versé', /can_mark_paid/]] as const) {
            const buttons = nodesOf(sf, (n) => tagName(n) === 'Button' && ts.isJsxElement(n) && clean(n.children.map((c) => (ts.isJsxText(c) ? c.text : '')).join(' ')).includes(label));
            assert.ok(buttons.length > 0, `${PANEL} : bouton « ${label} » absent`);
            for (const b of buttons) {
                assert.equal(attribute(b, 'disabled') !== undefined && flag.test(code(sf, attribute(b, 'disabled')!)), false, `contrat : pas de bouton grisé, « ${label} » n’existe pas sans ${flag.source}`);
                let guarded = false;
                for (let p: ts.Node | undefined = b.parent; p && !guarded; p = p.parent) guarded = isFunctionNode(p) ? flag.test(code(sf, p)) : (ts.isConditionalExpression(p) || ts.isBinaryExpression(p)) && flag.test(code(sf, ts.isConditionalExpression(p) ? p.condition : p.left));
                assert.ok(guarded, `bouton « ${label} » rendu sans condition sur ${flag.source}`);
            }
        }
        assert.equal(nodesOf(sf, (n) => ts.isJsxText(n) && clean(n.text).includes('Relancer')).length, 0, '« Relancer » remplacé par « Renvoyer » et « Marquer versé » (B4)');
        const texts = nodesOf(sf, (n) => ts.isJsxText(n) || ts.isStringLiteralLike(n)).map((n) => clean((n as ts.LiteralLikeNode).text));
        assert.ok(texts.some((t) => t.toLowerCase().includes('vérifiez auprès du support samirpay')), `${PANEL} : « Vérifiez auprès du support SamirPay » absent (incertain sans identifiant, 5.1)`);
    });
});
