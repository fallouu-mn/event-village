/**
 * Lot 9 ter, tâche 9t.3 (consigne 0.3, contrat A.2) — « Constater non versé ».
 * Un versement INCERTAIN sans identifiant SamirPay (délai dépassé au transfert) ne sort aujourd'hui que par « Marquer
 * versé » : « Renvoyer » le refuse (NOT_RESENDABLE, M/20261109000007:231-235). Le contrat ajoute la RPC
 * cashout_admin_not_sent (F7, M05), la route POST /api/admin/cashouts/[id]/not-sent (SUPERADMIN, mot de passe saisi
 * depuis moins de 10 minutes dans la même session, référence du support 1 à 100 caractères, motif 10 à 500) et le
 * champ can_mark_not_sent de GET /api/admin/refunds?state=to_retry :
 *  1. droits : ADMIN refunds.manage → 403 SUPERADMIN_ONLY ; SUPERADMIN sans saisie récente, ou saisie d'une autre
 *     session du même compte → 403 PASSWORD_CONFIRMATION_REQUIRED ; rien ne change ;
 *  2. saisies : référence absente ou de 101 caractères → 400 SUPPORT_REFERENCE_REQUIRED ; motif de 9 caractères →
 *     400 REASON_REQUIRED ; aucun effet ;
 *  3. constat d'un remboursement : ECHOUE (référence, motif, heure, auteur), remboursement FAILED, billet toujours
 *     REMBOURSEMENT_EN_COURS, audit CASHOUT_NOT_SENT (7 clés) et transition INCERTAIN → ECHOUE de même created_at,
 *     aucun appel SamirPay, liste à jour (« Non versé (constaté avec le support SamirPay) »), refundDelayed gardé ;
 *  4. jamais de renvoi automatique (reprise et cron de retard) ;
 *  5. « Renvoyer » après constat : un seul nouvel envoi, nouvel identifiant SamirPay, constat gardé ; nouveau refus
 *     → « Refusé par l’opérateur » ;
 *  6. constat d'un retrait : versement ECHOUE, retrait REJECTED, RETRAIT_ANNULE du brut, solde rendu,
 *     WITHDRAWAL_REJECTED, ligne retirée de la liste ;
 *  7. refus métier : INCERTAIN avec identifiant → 409 PROVIDER_ID_KNOWN ; A_ENVOYER, ECHOUE, CONFIRME → 409
 *     NOT_UNCERTAIN ; identifiant inconnu → 404 CASHOUT_NOT_FOUND ; aucun effet ;
 *  8. concurrence : double clic [200, 409] ; deux SUPERADMIN, le second attend le verrou puis NOT_UNCERTAIN ;
 *     variante retrait ; un seul audit, une seule transition, une seule alerte par destinataire et canal ;
 *  9. écran (statique) : bouton sous can_mark_not_sent, appel depuis onConfirm du ConfirmDialog seulement, référence
 *     de 100 caractères, PasswordConfirmDialog chargé par import().
 * Rouge avant correctif : route absente (import dynamique, échec qui la nomme), RPC absente (42883), colonnes
 * not_sent_* et champ can_mark_not_sent absents, écran sans le bouton (components/admin/RefundsToRetry.tsx:221-253).
 * Montage : remboursements de billets demandés par la partenaire (CashoutService.requestTicketRefund, patron
 * ticketRefund de versements-reprise) puis envoyés sous cashoutMode 'timeout' (INCERTAIN sans identifiant) ; retraits
 * par withdrawal_request puis envoi 'timeout'. Envois comptés par numéro neuf. Deux SUPERADMIN neufs S1 et S2 et un
 * ADMIN refunds.manage, suspendus en fin de suite. Fin de suite : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import ts from 'typescript';
import { CashoutService } from '../../lib/payments/cashout.service';
import { openConcurrentClient, waitForLockWaiters } from '../helpers/db';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { confirmPassword, STRONG_PASSWORD } from './helpers';
import { authed, ticketRow, type RouteResult } from './acces-helpers';
import { buyConfirmed, createPartnerEvent, newPartner, withSettings, type TestPartner } from './finance-helpers';
import { callsOf, fakePay, importModule, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { outboxRows, type TestAdmin } from './notif-helpers';
import { newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const FULL_BALANCE = 10_000_000;
const PRICE = 5_000;
const NOT_SENT_ROUTE = '../../app/api/admin/cashouts/[id]/not-sent/route';
const RESEND_ROUTE = '../../app/api/admin/cashouts/[id]/resend/route';
const LIST_ROUTE = '../../app/api/admin/refunds/route';
const TICKETS_ROUTE = '../../app/api/tickets/route';
const PANEL = 'components/admin/RefundsToRetry.tsx';
const REFERENCE = 'SUP-2026-11-0042';
const REASON = 'Le support SamirPay confirme que ce transfert n’est jamais parti (test du lot 9 ter)';
const RESEND_REASON = 'Renvoi après constat du support SamirPay (test du lot 9 ter)';
/** Champs d'une ligne de « Versements à reprendre » (contrat A.2.3). */
const ITEM_KEYS = ['advice', 'amount', 'beneficiary', 'block_label', 'can_mark_not_sent', 'can_mark_paid', 'can_resend', 'event_title', 'id', 'kind', 'kind_label', 'since', 'state', 'state_label'];
const NOT_SENT_KEYS = ['amount', 'attempt_count', 'kind', 'last_error', 'previous_status', 'reason', 'reference'];
const TEXTS = {
    SUPERADMIN_ONLY: 'Seul un superadmin peut constater qu’un versement n’est pas parti.',
    SUPPORT_REFERENCE_REQUIRED: 'Indiquez la référence du support SamirPay (100 caractères au plus).',
    REASON_REQUIRED: 'Indiquez la raison (10 caractères au moins).',
    NOT_UNCERTAIN: 'Ce versement n’est plus à l’issue incertaine : relisez la liste.',
    PROVIDER_ID_KNOWN: 'SamirPay a un identifiant pour ce versement : son statut fait foi. Renvoyez-le (le statut est relu d’abord) ou marquez-le versé.',
    CASHOUT_NOT_FOUND: 'Versement introuvable.',
} as const;
const WITHDRAWAL_RULES = { 'finance.withdrawal_fee_rate': 1, 'finance.withdrawal_min_amount': 5000, 'finance.withdrawal_bank_enabled': false } as const;

let s1: TestAdmin;
let s2: TestAdmin;
let refundAdmin: TestAdmin;
let shared: { partner: TestPartner; ev: SaleEvent } | null = null;

before(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    s1 = await newAdminWith([], { role: 'SUPERADMIN', label: '9ter-nv-s1' });
    s2 = await newAdminWith([], { role: 'SUPERADMIN', label: '9ter-nv-s2' });
    refundAdmin = await newAdminWith(['refunds.manage'], { label: '9ter-nv-adm' });
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = FULL_BALANCE;
    const ids = [s1, s2, refundAdmin].filter(Boolean).map((a) => a.userId);
    const { error } = await service.from('users').update({ status: 'SUSPENDU' }).in('id', ids).eq('status', 'ACTIF');
    assert.equal(error, null, `administrateurs de la suite suspendus : ${error?.message}`);
    await assertLot9terInvariants('argent9ter-non-verse');
});

// ── Outils ─────────────────────────────────────────────────────────────────

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

function idContext(id: string): { params: Promise<{ id: string }> & { id: string } } {
    return { params: Object.assign(Promise.resolve({ id }), { id }) };
}

async function asResult(res: Response): Promise<RouteResult> {
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) as Row : {};
    } catch (err) {
        body = { raw: text.slice(0, 2000), parseError: (err as Error).message };
    }
    return { status: res.status, body };
}

async function withCashoutMode<T>(mode: string, fn: () => Promise<T>): Promise<T> {
    setFakeMode('cashoutMode', mode);
    try {
        return await fn();
    } finally {
        setFakeMode('cashoutMode', 'success');
    }
}

/** Seconde session du même compte (connexion par mot de passe, clé anon). */
async function otherSession(user: Buyer): Promise<Buyer> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email: user.email, password: STRONG_PASSWORD });
    assert.equal(error, null, `seconde session de ${user.userId} : ${error?.message}`);
    return { ...user, accessToken: data.session!.access_token };
}

function sessionIdOf(user: Buyer): string {
    const claims = JSON.parse(Buffer.from(user.accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: unknown };
    assert.equal(typeof claims.session_id, 'string', 'session_id présent dans le jeton');
    return String(claims.session_id);
}

async function notSentHandler(): Promise<Handler> {
    let mod: { POST?: Handler };
    try {
        mod = await importModule(NOT_SENT_ROUTE);
    } catch (err) {
        assert.fail(`route POST /api/admin/cashouts/[id]/not-sent absente : app/api/admin/cashouts/[id]/not-sent/route.ts (contrat A.2.3, fix(9t.3)) — ${String((err as Error).message).split('\n')[0]}`);
    }
    assert.equal(typeof mod.POST, 'function', 'app/api/admin/cashouts/[id]/not-sent/route.ts : POST non exporté');
    return mod.POST!;
}

async function notSent(cashoutId: string, user: Buyer, body: Row): Promise<RouteResult> {
    const handler = await notSentHandler();
    return asResult(await handler(authed(`/api/admin/cashouts/${cashoutId}/not-sent`, 'POST', user, body), idContext(cashoutId)));
}

async function resend(cashoutId: string, user: Buyer, reason: string): Promise<RouteResult> {
    const { POST } = (await importModule(RESEND_ROUTE)) as { POST: Handler };
    return asResult(await POST(authed(`/api/admin/cashouts/${cashoutId}/resend`, 'POST', user, { reason }), idContext(cashoutId)));
}

async function toResume(user: Buyer): Promise<Row[]> {
    const { GET } = (await importModule(LIST_ROUTE)) as { GET: Handler };
    const r = await asResult(await GET(authed('/api/admin/refunds?state=to_retry', 'GET', user)));
    assert.equal(r.status, 200, `GET /api/admin/refunds?state=to_retry : ${show(r)}`);
    assert.ok(Array.isArray(r.body.items), `items : ${show(r)}`);
    return r.body.items as Row[];
}

function listed(items: Row[], cashoutId: string, what: string): Row {
    const found = items.find((i) => i.id === cashoutId);
    assert.ok(found, `${what} : versement ${cashoutId} absent de « Versements à reprendre » (${items.length} ligne(s))`);
    assert.deepEqual(Object.keys(found).sort(), ITEM_KEYS, `${what} : champs de la ligne (contrat A.2.3) ${JSON.stringify(found)}`);
    return found;
}

async function cashoutRow(id: string): Promise<Row> {
    const { data, error } = await service.from('cashouts').select('*').eq('id', id).single();
    assert.equal(error, null, `versement ${id} : ${error?.message}`);
    return data as Row;
}

/** Colonnes du constat (M05) : leur absence fait échouer la lecture en la nommant. */
async function notSentColumns(id: string): Promise<Row> {
    const { data, error } = await service.from('cashouts').select('status, not_sent_reference, not_sent_reason, not_sent_at, not_sent_by').eq('id', id).single();
    assert.equal(error, null, `colonnes not_sent_* de cashouts (migration 20261110000005, contrat A.2.2) : ${error?.message}`);
    return data as Row;
}

async function auditsOf(action: string, cashoutId: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('*').eq('action', action).eq('object_id', cashoutId).order('created_at');
    assert.equal(error, null, `journal ${action} : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Lignes d'audit de trg_audit_cashouts pour une transition donnée du versement. */
async function transitions(cashoutId: string, from: string, to: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('*').eq('object_type', 'cashouts').eq('object_id', cashoutId)
        .eq('old_value->>status', from).eq('new_value->>status', to);
    assert.equal(error, null, `journal des transitions du versement ${cashoutId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

function sendsTo(phone9: unknown): number {
    return callsOf('sendCashout').filter((c) => c.args.phoneNumber === phone9).length;
}

/** Chaque (destinataire, canal) au plus une fois parmi ces lignes. */
function perRecipientChannel(rows: Array<{ recipient_user_id: string | null; recipient_phone: string | null; channel: string }>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of rows) {
        const k = `${r.recipient_user_id ?? r.recipient_phone}:${r.channel}`;
        out[k] = (out[k] ?? 0) + 1;
    }
    return out;
}

async function sharedSale(): Promise<{ partner: TestPartner; ev: SaleEvent }> {
    if (shared) return shared;
    const partner = await newPartner('9ter-non-verse');
    const ev = await createPartnerEvent(partner.partnerId, '9ter non verse', [{ name: 'Standard', price: PRICE, total: 80 }]);
    shared = { partner, ev };
    return shared;
}

interface Refund { buyer: Buyer; ticketId: string; cashoutId: string; refundId: string }

/** Billet payé par un acheteur neuf puis remboursé par la partenaire : TICKET_REFUND A_ENVOYER, rien n'est parti. */
async function ticketRefund(label: string): Promise<Refund> {
    const { partner, ev } = await sharedSale();
    const buyer = await newBuyer(`9ter-nv-${label}`);
    const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 1]]);
    const ticketId = String(tickets[0].id);
    const out = await CashoutService.requestTicketRefund({ ticketId, actorId: partner.userId, reason: `Lot 9 ter ${label}` });
    assert.equal(out.ok, true, `remboursement refusé : ${JSON.stringify(out)}`);
    const cashout = out.cashout!;
    assert.equal(cashout.status, 'A_ENVOYER', 'précondition : à envoyer');
    const row = await cashoutRow(cashout.id);
    return { buyer, ticketId, cashoutId: cashout.id, refundId: String(row.refund_id) };
}

/** Remboursement envoyé sous délai dépassé : INCERTAIN sans identifiant SamirPay (patron versements-reprise:503-505). */
async function uncertainRefund(label: string): Promise<Refund> {
    const r = await ticketRefund(label);
    assert.equal((await withCashoutMode('timeout', () => CashoutService.send(r.cashoutId))).status, 'INCERTAIN', 'précondition : issue incertaine');
    const row = await cashoutRow(r.cashoutId);
    assert.deepEqual({ status: row.status, id: row.samirpay_transaction_id }, { status: 'INCERTAIN', id: null }, 'précondition : INCERTAIN sans identifiant');
    return r;
}

interface Withdrawal { partner: TestPartner; withdrawalId: string; cashoutId: string; gross: number }

/** Partenaire neuve, deux billets vendus (10 000 F disponibles), retrait de 10 000 F envoyé sous délai dépassé. */
async function uncertainWithdrawal(label: string): Promise<Withdrawal> {
    const partner = await newPartner(`9ter-nv-ret-${label}`);
    const ev = await createPartnerEvent(partner.partnerId, `9ter nv ret ${label}`, [{ name: 'Standard', price: PRICE, total: 10 }]);
    await withSettings({ 'finance.payout_hold_enabled': false }, async () => buyConfirmed(await newBuyer(`9ter-nv-ret-${label}`), ev, [['Standard', 2]]));
    const out = await withSettings(WITHDRAWAL_RULES, async () => {
        const { data, error } = await service.rpc('withdrawal_request', {
            p: { user_id: partner.userId, account_kind: 'ORGANISATEUR', gross_amount: 10_000, method: 'MOBILE_MONEY', operator: 'WAVE', phone_number: partner.phone9, client_key: randomUUID() },
        });
        assert.equal(error, null, `withdrawal_request : ${error?.message}`);
        return (data ?? {}) as Row;
    });
    assert.equal(out.ok, true, `retrait refusé : ${JSON.stringify(out)}`);
    const cashoutId = String(out.cashout_id);
    assert.equal((await withCashoutMode('timeout', () => CashoutService.send(cashoutId))).status, 'INCERTAIN', 'précondition : retrait à l’issue incertaine');
    return { partner, withdrawalId: String(out.withdrawal_id), cashoutId, gross: 10_000 };
}

async function balance(ownerId: string): Promise<Row> {
    const { data, error } = await service.rpc('finance_account_balance', { p_owner: ownerId, p_kind: 'ORGANISATEUR' });
    assert.equal(error, null, `finance_account_balance : ${error?.message}`);
    return (data ?? {}) as Row;
}

/** SUPERADMIN dont la session a une saisie récente du mot de passe (deuxième contrôle, D9). */
async function confirmed(admin: TestAdmin): Promise<TestAdmin> {
    await confirmPassword(admin, STRONG_PASSWORD);
    return admin;
}

/** Constat réussi par S1 (préalable des cas 4, 5). */
async function constated(label: string): Promise<Refund> {
    const r = await uncertainRefund(label);
    const res = await notSent(r.cashoutId, await confirmed(s1), { reference: REFERENCE, reason: REASON });
    assert.equal(res.status, 200, `constat préalable : ${show(res)}`);
    return r;
}

async function assertUntouched(cashoutId: string, status: string, what: string): Promise<void> {
    const row = await notSentColumns(cashoutId);
    assert.deepEqual(row, { status, not_sent_reference: null, not_sent_reason: null, not_sent_at: null, not_sent_by: null }, `${what} : aucun effet`);
    assert.deepEqual(await auditsOf('CASHOUT_NOT_SENT', cashoutId), [], `${what} : aucun audit CASHOUT_NOT_SENT`);
}

// ── Cas avec base ──────────────────────────────────────────────────────────

describe('0.3 — « Constater non versé » (lot 9 ter, 9t.3)', () => {
    test('droits : ADMIN refunds.manage → 403 SUPERADMIN_ONLY ; SUPERADMIN sans saisie récente → 403 PASSWORD_CONFIRMATION_REQUIRED ; saisie d’une autre session du même compte → 403 ; rien ne change', async () => {
        const r = await uncertainRefund('droits');
        await confirmPassword(refundAdmin, STRONG_PASSWORD);
        const admin = await notSent(r.cashoutId, refundAdmin, { reference: REFERENCE, reason: REASON });
        assert.deepEqual({ status: admin.status, code: admin.body.code, error: admin.body.error }, { status: 403, code: 'SUPERADMIN_ONLY', error: TEXTS.SUPERADMIN_ONLY }, show(admin));

        const fresh = await notSent(r.cashoutId, s1, { reference: REFERENCE, reason: REASON });
        assert.deepEqual({ status: fresh.status, code: fresh.body.code }, { status: 403, code: 'PASSWORD_CONFIRMATION_REQUIRED' }, `SUPERADMIN sans saisie récente : ${show(fresh)}`);

        const elsewhere = await otherSession(s1);
        await confirmPassword(elsewhere, STRONG_PASSWORD);
        const other = await notSent(r.cashoutId, s1, { reference: REFERENCE, reason: REASON });
        assert.deepEqual({ status: other.status, code: other.body.code }, { status: 403, code: 'PASSWORD_CONFIRMATION_REQUIRED' }, `saisie d’une autre session du même compte : ${show(other)}`);

        await assertUntouched(r.cashoutId, 'INCERTAIN', 'refus de droits');
        assert.deepEqual(await transitions(r.cashoutId, 'INCERTAIN', 'ECHOUE'), [], 'aucune transition INCERTAIN → ECHOUE');
    });

    test('saisies : référence absente ou de 101 caractères → 400 SUPPORT_REFERENCE_REQUIRED ; motif de 9 caractères → 400 REASON_REQUIRED ; aucun effet', async () => {
        const r = await uncertainRefund('saisies');
        const admin = await confirmed(s1);
        for (const reference of [undefined, '', 'R'.repeat(101)]) {
            const bad = await notSent(r.cashoutId, admin, { reference, reason: REASON });
            assert.deepEqual({ status: bad.status, code: bad.body.code, error: bad.body.error },
                { status: 400, code: 'SUPPORT_REFERENCE_REQUIRED', error: TEXTS.SUPPORT_REFERENCE_REQUIRED }, `référence ${JSON.stringify(reference)?.slice(0, 20)} : ${show(bad)}`);
        }
        const short = await notSent(r.cashoutId, admin, { reference: REFERENCE, reason: '123456789' });
        assert.deepEqual({ status: short.status, code: short.body.code, error: short.body.error }, { status: 400, code: 'REASON_REQUIRED', error: TEXTS.REASON_REQUIRED }, show(short));
        await assertUntouched(r.cashoutId, 'INCERTAIN', 'saisies refusées');
    });

    test('constat d’un remboursement : 200, ECHOUE avec référence, motif, heure et auteur, remboursement FAILED, audit CASHOUT_NOT_SENT, aucun appel SamirPay, liste à jour', async () => {
        const r = await uncertainRefund('constat');
        const before0 = await cashoutRow(r.cashoutId);
        const admin = await confirmed(s1);
        const sends = sendsTo(before0.phone_number);
        const soldes = callsOf('getSolde').length;
        const delayedBefore = (await outboxRows({ type: 'REFUND_DELAYED', keyPrefix: `REFUND_DELAYED:${r.cashoutId}` })).length;

        const res = await notSent(r.cashoutId, admin, { reference: REFERENCE, reason: REASON });
        assert.equal(res.status, 200, show(res));
        assert.deepEqual(res.body, { ok: true, status: 'ECHOUE', kind: 'TICKET_REFUND' }, show(res));
        assert.equal(sendsTo(before0.phone_number), sends, 'aucun sendCashout');
        assert.equal(callsOf('getSolde').length, soldes, 'aucun getSolde');

        const row = await notSentColumns(r.cashoutId);
        assert.deepEqual({ status: row.status, ref: row.not_sent_reference, reason: row.not_sent_reason, by: row.not_sent_by },
            { status: 'ECHOUE', ref: REFERENCE, reason: REASON, by: s1.userId }, `constat enregistré : ${JSON.stringify(row)}`);
        assert.ok(row.not_sent_at && Number.isFinite(Date.parse(String(row.not_sent_at))), `heure du constat : ${String(row.not_sent_at)}`);
        const { data: refund, error } = await service.from('refunds').select('status').eq('id', r.refundId).single();
        assert.equal(error, null, `remboursement : ${error?.message}`);
        assert.equal(refund.status, 'FAILED', 'remboursement FAILED : il pourra être renvoyé');
        assert.equal((await ticketRow(r.ticketId)).status, 'REMBOURSEMENT_EN_COURS', 'billet toujours en cours de remboursement');

        const audits = await auditsOf('CASHOUT_NOT_SENT', r.cashoutId);
        assert.equal(audits.length, 1, `un audit CASHOUT_NOT_SENT : ${JSON.stringify(audits)}`);
        const meta = (audits[0].metadata ?? {}) as Row;
        assert.deepEqual({ user: audits[0].user_id, role: audits[0].user_role, keys: Object.keys(meta).sort() }, { user: s1.userId, role: 'SUPERADMIN', keys: NOT_SENT_KEYS }, `audit : ${JSON.stringify(audits[0])}`);
        assert.deepEqual({ reference: meta.reference, reason: meta.reason, previous: meta.previous_status, kind: meta.kind },
            { reference: REFERENCE, reason: REASON, previous: 'INCERTAIN', kind: 'TICKET_REFUND' }, `métadonnées de l’audit : ${JSON.stringify(meta)}`);
        const moved = await transitions(r.cashoutId, 'INCERTAIN', 'ECHOUE');
        assert.equal(moved.length, 1, `une transition INCERTAIN → ECHOUE journalisée : ${JSON.stringify(moved)}`);
        assert.equal(Date.parse(String(moved[0].created_at)), Date.parse(String(audits[0].created_at)), 'constat et transition dans la même transaction (même created_at, E4)');

        const line = listed(await toResume(s1), r.cashoutId, 'versement constaté');
        assert.deepEqual({ state: line.state, label: line.state_label, resend: line.can_resend, notSent: line.can_mark_not_sent }, {
            state: 'ECHOUE', label: 'Non versé (constaté avec le support SamirPay)', resend: 'NOW', notSent: false,
        }, `ligne après le constat : ${JSON.stringify(line)}`);
        assert.equal(line.advice, `Le support SamirPay a confirmé que ce versement n’est pas parti (référence ${REFERENCE}) : vous pouvez le renvoyer.`, 'conseil du versement constaté');

        const { GET } = (await importModule(TICKETS_ROUTE)) as { GET: Handler };
        const tickets = await asResult(await GET(authed('/api/tickets', 'GET', r.buyer)));
        assert.equal(tickets.status, 200, show(tickets));
        const mine = ((tickets.body.tickets ?? []) as Row[]).find((t) => t.id === r.ticketId);
        assert.ok(mine, `billet ${r.ticketId} dans /api/tickets`);
        assert.equal(mine.refundDelayed, true, `refundDelayed du billet : ${JSON.stringify(mine).slice(0, 300)}`);
        assert.equal((await outboxRows({ type: 'REFUND_DELAYED', keyPrefix: `REFUND_DELAYED:${r.cashoutId}` })).length, delayedBefore, 'aucun nouvel avis REFUND_DELAYED au client');
    });

    test('jamais de renvoi automatique : reprise et retard après le constat, toujours ECHOUE, aucun envoi', async () => {
        const r = await constated('auto');
        const row = await cashoutRow(r.cashoutId);
        const sends = sendsTo(row.phone_number);
        const { error } = await service.from('cashouts').update({ created_at: new Date(Date.now() - 31 * 60_000).toISOString() }).eq('id', r.cashoutId);
        assert.equal(error, null, `created_at reculé de 31 min : ${error?.message}`);
        await CashoutService.resumeUnsent(500);
        const { error: fErr } = await service.rpc('cashouts_flag_delayed');
        assert.equal(fErr, null, `cashouts_flag_delayed : ${fErr?.message}`);
        assert.equal((await cashoutRow(r.cashoutId)).status, 'ECHOUE', 'rien ne repart automatiquement');
        assert.equal(sendsTo(row.phone_number), sends, 'aucun sendCashout vers ce bénéficiaire');
    });

    test('Renvoyer après constat : un seul nouvel envoi, nouvel identifiant SamirPay', async () => {
        const r = await constated('renvoi');
        const before0 = await cashoutRow(r.cashoutId);
        assert.equal(before0.samirpay_transaction_id, null, 'précondition : aucun identifiant SamirPay');
        const sends = sendsTo(before0.phone_number);
        const res = await resend(r.cashoutId, refundAdmin, RESEND_REASON);
        assert.equal(res.status, 200, show(res));
        assert.equal(sendsTo(before0.phone_number), sends + 1, 'un seul nouvel envoi');
        const after0 = await cashoutRow(r.cashoutId);
        assert.equal(after0.status, 'CONFIRME', 'versé');
        assert.ok(after0.samirpay_transaction_id, 'nouvel identifiant SamirPay rendu par le nouvel envoi');
        assert.equal(Number(after0.attempt_count), Number(before0.attempt_count) + 1, 'une tentative de plus');
        const resent = await auditsOf('CASHOUT_RESENT', r.cashoutId);
        assert.equal(resent.length, 1, 'un audit CASHOUT_RESENT');
        assert.equal(((resent[0].metadata ?? {}) as Row).previous_status, 'ECHOUE', 'renvoi d’un versement constaté non versé');
        const kept = await notSentColumns(r.cashoutId);
        assert.deepEqual({ ref: kept.not_sent_reference, reason: kept.not_sent_reason, by: kept.not_sent_by }, { ref: REFERENCE, reason: REASON, by: s1.userId }, 'constat gardé après le renvoi');

        const again = await constated('renvoi-refuse');
        const res2 = await withCashoutMode('rejected', () => resend(again.cashoutId, refundAdmin, RESEND_REASON));
        assert.equal(res2.status, 200, show(res2));
        assert.equal((await cashoutRow(again.cashoutId)).status, 'ECHOUE', 'nouveau refus de l’opérateur');
        const line = listed(await toResume(s1), again.cashoutId, 'refus après renvoi');
        assert.equal(line.state_label, 'Refusé par l’opérateur', `un nouvel échec garde son libellé : ${JSON.stringify(line)}`);
    });

    test('constat d’un retrait : versement ECHOUE, retrait REJECTED, montant rendu, ligne retirée de la liste', async () => {
        const w = await uncertainWithdrawal('constat');
        const res = await notSent(w.cashoutId, await confirmed(s1), { reference: REFERENCE, reason: REASON });
        assert.equal(res.status, 200, show(res));
        assert.deepEqual(res.body, { ok: true, status: 'ECHOUE', kind: 'WITHDRAWAL' }, show(res));
        assert.equal((await cashoutRow(w.cashoutId)).status, 'ECHOUE');
        const { data: wd, error } = await service.from('withdrawals').select('status').eq('id', w.withdrawalId).single();
        assert.equal(error, null, `retrait : ${error?.message}`);
        assert.equal(wd.status, 'REJECTED', 'retrait refusé');
        const { data: back, error: lErr } = await service.from('finance_ledger').select('amount, source_key').eq('withdrawal_id', w.withdrawalId).eq('entry_type', 'RETRAIT_ANNULE');
        assert.equal(lErr, null, `grand livre : ${lErr?.message}`);
        assert.deepEqual((back ?? []).map((e) => [Number(e.amount), e.source_key]), [[w.gross, `RETRAIT-ANN-${w.withdrawalId}`]], 'brut rendu par RETRAIT_ANNULE');
        assert.equal(Number((await balance(w.partner.userId)).withdrawable), w.gross, 'montant de nouveau retirable');
        const rejected = await outboxRows({ type: 'WITHDRAWAL_REJECTED', keyPrefix: `WITHDRAWAL_REJECTED:${w.cashoutId}` });
        assert.equal(rejected.filter((x) => x.channel === 'SMS').length, 1, `un SMS WITHDRAWAL_REJECTED : ${JSON.stringify(rejected.map((x) => x.idempotency_key))}`);
        assert.ok(Object.values(perRecipientChannel(rejected)).every((n) => n === 1), 'une ligne par canal');
        assert.equal((await toResume(s1)).some((i) => i.id === w.cashoutId), false, 'retrait ECHOUE hors de la liste');
    });

    test('refus métier : INCERTAIN avec identifiant → 409 PROVIDER_ID_KNOWN ; A_ENVOYER, ECHOUE, CONFIRME → 409 NOT_UNCERTAIN ; identifiant inconnu → 404 ; aucun effet', async () => {
        const admin = await confirmed(s1);
        const known = await ticketRefund('metier-id');
        assert.equal((await withCashoutMode('pending', () => CashoutService.send(known.cashoutId))).status, 'ENVOYE', 'précondition : envoyé avec identifiant');
        const { error } = await service.from('cashouts').update({ status: 'INCERTAIN', last_error: 'délai dépassé (test)' }).eq('id', known.cashoutId);
        assert.equal(error, null, `passage INCERTAIN : ${error?.message}`);
        const withId = await notSent(known.cashoutId, admin, { reference: REFERENCE, reason: REASON });
        assert.deepEqual({ status: withId.status, code: withId.body.code, error: withId.body.error }, { status: 409, code: 'PROVIDER_ID_KNOWN', error: TEXTS.PROVIDER_ID_KNOWN }, show(withId));
        await assertUntouched(known.cashoutId, 'INCERTAIN', 'INCERTAIN avec identifiant');

        const waiting = await ticketRefund('metier-attente');
        const failed = await ticketRefund('metier-echec');
        assert.equal((await withCashoutMode('rejected', () => CashoutService.send(failed.cashoutId))).status, 'ECHOUE', 'précondition : ECHOUE');
        const paid = await ticketRefund('metier-verse');
        assert.equal((await CashoutService.send(paid.cashoutId)).status, 'CONFIRME', 'précondition : CONFIRME');
        try {
            for (const [r, status] of [[waiting, 'A_ENVOYER'], [failed, 'ECHOUE'], [paid, 'CONFIRME']] as const) {
                const res = await notSent(r.cashoutId, admin, { reference: REFERENCE, reason: REASON });
                assert.deepEqual({ status: res.status, code: res.body.code, error: res.body.error }, { status: 409, code: 'NOT_UNCERTAIN', error: TEXTS.NOT_UNCERTAIN }, `${status} : ${show(res)}`);
                await assertUntouched(r.cashoutId, status, status);
            }
            const missing = randomUUID();
            const res = await notSent(missing, admin, { reference: REFERENCE, reason: REASON });
            assert.deepEqual({ status: res.status, code: res.body.code, error: res.body.error }, { status: 404, code: 'CASHOUT_NOT_FOUND', error: TEXTS.CASHOUT_NOT_FOUND }, show(res));
        } finally {
            // Rien n'est laissé à envoyer qu'une autre suite reprendrait.
            await CashoutService.send(waiting.cashoutId);
        }
    });

    test('concurrence : double clic → [200, 409] ; deux SUPERADMIN, le second attend le verrou puis NOT_UNCERTAIN ; variante retrait ; un seul effet', async () => {
        // (a) double clic du même SUPERADMIN
        const a = await uncertainRefund('double-clic');
        const admin = await confirmed(s1);
        const both = await Promise.all([1, 2].map(() => notSent(a.cashoutId, admin, { reference: REFERENCE, reason: REASON })));
        assert.deepEqual(both.map((x) => x.status).sort(), [200, 409], `double clic : ${both.map(show).join(' | ')}`);
        assert.equal(both.find((x) => x.status === 409)?.body.code, 'NOT_UNCERTAIN', both.map(show).join(' | '));

        // (b) deux SUPERADMIN : le second attend le verrou du premier
        const b = await uncertainRefund('deux-superadmins');
        const sessionA = sessionIdOf(await confirmed(s1));
        const sessionB = sessionIdOf(await confirmed(s2));
        const input = (actor: TestAdmin, session: string): string => JSON.stringify({ cashout_id: b.cashoutId, actor_id: actor.userId, session_id: session, reference: REFERENCE, reason: REASON });
        const ca = await openConcurrentClient({ applicationName: 'ev-test-9ter-non-verse-a' });
        const cb = await openConcurrentClient({ applicationName: 'ev-test-9ter-non-verse-b' });
        try {
            const first = await ca.query<{ r: Row }>('SELECT public.cashout_admin_not_sent($1::jsonb) AS r', [input(s1, sessionA)]);
            assert.equal(first.rows[0].r.ok, true, `premier constat : ${JSON.stringify(first.rows[0].r)}`);
            const pending = cb.query<{ r: Row }>('SELECT public.cashout_admin_not_sent($1::jsonb) AS r', [input(s2, sessionB)]);
            await waitForLockWaiters([cb.pid]);
            await ca.commit();
            const second = await pending;
            assert.deepEqual({ ok: second.rows[0].r.ok, code: second.rows[0].r.code }, { ok: false, code: 'NOT_UNCERTAIN' }, `second constat : ${JSON.stringify(second.rows[0].r)}`);
            await cb.commit();
        } finally {
            await ca.close();
            await cb.close();
        }

        for (const [label, r] of [['double clic', a], ['deux SUPERADMIN', b]] as const) {
            assert.equal((await auditsOf('CASHOUT_NOT_SENT', r.cashoutId)).length, 1, `${label} : un seul audit CASHOUT_NOT_SENT`);
            assert.equal((await transitions(r.cashoutId, 'INCERTAIN', 'ECHOUE')).length, 1, `${label} : une seule transition INCERTAIN → ECHOUE`);
            const alerts = await outboxRows({ type: 'ADMIN_REFUND_TO_RETRY', keyPrefix: `ADMIN_REFUND_TO_RETRY:${r.cashoutId}:` });
            const mine = alerts.filter((x) => x.template_data.cashout_id === r.cashoutId);
            assert.ok(mine.length > 0, `${label} : alerte ADMIN_REFUND_TO_RETRY aux admins refunds.manage`);
            assert.ok(Object.values(perRecipientChannel(mine)).every((n) => n === 1), `${label} : une alerte par destinataire et canal : ${JSON.stringify(perRecipientChannel(mine))}`);
        }

        // (c) variante retrait : double clic
        const w = await uncertainWithdrawal('double-clic');
        const twice = await Promise.all([1, 2].map(() => notSent(w.cashoutId, admin, { reference: REFERENCE, reason: REASON })));
        assert.deepEqual(twice.map((x) => x.status).sort(), [200, 409], `retrait, double clic : ${twice.map(show).join(' | ')}`);
        const { data: back, error } = await service.from('finance_ledger').select('id').eq('withdrawal_id', w.withdrawalId).eq('entry_type', 'RETRAIT_ANNULE');
        assert.equal(error, null, `grand livre : ${error?.message}`);
        assert.equal((back ?? []).length, 1, 'un seul RETRAIT_ANNULE');
        const rejected = await outboxRows({ type: 'WITHDRAWAL_REJECTED', keyPrefix: `WITHDRAWAL_REJECTED:${w.cashoutId}` });
        assert.equal(rejected.filter((x) => x.channel === 'SMS').length, 1, 'un seul SMS WITHDRAWAL_REJECTED');
        assert.ok(Object.values(perRecipientChannel(rejected)).every((n) => n === 1), 'une ligne WITHDRAWAL_REJECTED par canal');
        assert.equal((await auditsOf('CASHOUT_NOT_SENT', w.cashoutId)).length, 1, 'retrait : un seul audit CASHOUT_NOT_SENT');
    });
});

// ── 9. Écran (statique, patron admin-remboursements.test.ts:476-526) ───────

function parseFile(rel: string): ts.SourceFile {
    const abs = path.join(process.cwd(), ...rel.split('/'));
    assert.ok(fs.existsSync(abs), `${rel} absent`);
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

function reaches(sf: ts.SourceFile, node: ts.Node, hit: (text: string) => boolean, fns = localFunctions(sf), seen: Set<ts.Node> = new Set()): boolean {
    if (seen.has(node)) return false;
    seen.add(node);
    if (hit(code(sf, node))) return true;
    return nodesOf(node, ts.isIdentifier).some((n) => {
        const target = fns.get((n as ts.Identifier).text);
        return target !== undefined && reaches(sf, target, hit, fns, seen);
    });
}

const isNotSentCall = (text: string): boolean => /\bfetch\(/.test(text) && /\/api\/admin\/cashouts\/\$\{[^}]+\}\/not-sent/.test(text);

/** Texte d'un élément JSX (JsxText et chaînes littérales des expressions), nettoyé. */
function jsxText(n: ts.JsxElement): string {
    return clean(nodesOf(n, (c) => ts.isJsxText(c) || (ts.isStringLiteralLike(c) && ts.isJsxExpression(c.parent))).map((c) => (c as ts.LiteralLikeNode).text).join(' '));
}

describe('0.3 — écran « Constater non versé » (statique)', () => {
    test('écran : Constater non versé sous can_mark_not_sent, dans le ConfirmDialog, référence de 100 caractères, mot de passe chargé par import()', () => {
        const sf = parseFile(PANEL);
        const flag = /can_mark_not_sent/;

        const buttons = nodesOf(sf, (n) => tagName(n) === 'Button' && ts.isJsxElement(n) && jsxText(n).includes('Constater non versé')) as ts.JsxElement[];
        assert.ok(buttons.length > 0, `${PANEL} : bouton « Constater non versé » absent`);
        const guardedButtons = buttons.filter((b) => {
            for (let p: ts.Node | undefined = b.parent; p; p = p.parent) {
                if (isFunctionNode(p)) return flag.test(code(sf, p));
                if ((ts.isConditionalExpression(p) || ts.isBinaryExpression(p)) && flag.test(code(sf, ts.isConditionalExpression(p) ? p.condition : p.left))) return true;
            }
            return false;
        });
        assert.ok(guardedButtons.length > 0, `${PANEL} : « Constater non versé » rendu sans condition sur can_mark_not_sent`);
        for (const b of buttons) {
            const disabled = attribute(b, 'disabled');
            assert.equal(disabled !== undefined && flag.test(code(sf, disabled)), false, 'contrat : bouton jamais grisé par can_mark_not_sent, absent sans lui');
        }

        assert.ok(reaches(sf, sf, isNotSentCall), `${PANEL} n'appelle pas POST /api/admin/cashouts/<id>/not-sent`);
        const handlers = nodesOf(sf, ts.isJsxAttribute).filter((a) => /^on[A-Z]/.test((a as ts.JsxAttribute).name.getText())) as ts.JsxAttribute[];
        const direct = handlers.filter((a) => a.initializer !== undefined && reaches(sf, a.initializer, isNotSentCall));
        assert.ok(direct.length > 0, `${PANEL} : aucun gestionnaire ne mène au constat`);
        const outside = direct.filter((a) => !(a.name.getText() === 'onConfirm' && ownerTag(a) === 'ConfirmDialog'));
        assert.deepEqual(outside.map((a) => code(sf, a)), [], 'constat hors du onConfirm du ConfirmDialog');

        const fields = nodesOf(sf, (n) => {
            const label = attribute(n, 'label');
            return label !== undefined && label.initializer !== undefined && clean(label.initializer.getText().replace(/^["'{`]+|["'}`]+$/g, '')) === 'Référence du support SamirPay';
        });
        assert.equal(fields.length, 1, `${PANEL} : champ « Référence du support SamirPay » attendu une fois (${fields.length})`);
        const maxLength = attribute(fields[0], 'maxLength');
        assert.equal(maxLength?.initializer?.getText(), '{100}', `${PANEL} : maxLength={100} sur la référence`);

        const staticImports = nodesOf(sf, (n) => ts.isImportDeclaration(n) && /PasswordConfirmDialog/.test((n.moduleSpecifier as ts.StringLiteral).text));
        assert.deepEqual(staticImports.map((n) => n.getText()), [], 'PasswordConfirmDialog ne doit pas être importé statiquement (budget JS)');
        const dynamicImports = nodesOf(sf, (n) => ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword
            && n.arguments.length > 0 && ts.isStringLiteralLike(n.arguments[0]) && /PasswordConfirmDialog/.test(n.arguments[0].text));
        assert.ok(dynamicImports.length > 0, `${PANEL} : PasswordConfirmDialog chargé par import() attendu`);
    });
});
