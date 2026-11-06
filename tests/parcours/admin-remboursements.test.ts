/**
 * Lot 8, tâche 8.3 d, anomalie A3 (contrat 3.10, 13.4, L88 ; CDC §41, §131) — relance d'un remboursement bloqué sans
 * écran : POST /api/admin/refunds/[id]/retry n'a aucun appelant et la notification ADMIN_REFUND_TO_RETRY mène à
 * /admin/finance, où aucun bouton n'existe.
 *  1. droits de GET /api/admin/refunds?state=to_retry : 401 sans session, 403 sans refunds.manage (client, partenaire,
 *     ADMIN sans la permission, ADMIN SUSPENDU), 200 avec la permission et pour le SUPERADMIN ;
 *  2. périmètre exact (oracle SQL écrit à part) : remboursements ECHOUE, INCERTAIN, A_ENVOYER avec blocked_reason ; ni
 *     retrait, ni CONFIRME, ni ENVOYE, ni A_ENVOYER sans blocage ;
 *  3. ligne par ligne : montant, état, titre de l'événement, numéro masqué, can_retry (ECHOUE ou SOLDE_INSUFFISANT),
 *     motif en français ; ni numéro complet, ni erreur brute de SamirPay, ni code de blocage dans la réponse ;
 *  4. la clé renvoyée est celle qu'attend la relance : refund_id relancé, deuxième envoi compté sur le numéro du
 *     payeur, la ligne quitte la liste ;
 *  5. 100 lignes au plus, `truncated` ;
 *  6. statique : /admin/finance monte RefundsToRetry, qui relit la liste, n'appelle la relance que depuis un
 *     ConfirmDialog, lit le résultat dans le corps (la route répond 200 avec success: false), n'offre le bouton
 *     « Relancer » que sous can_retry et écrit « à vérifier auprès de SamirPay ».
 *
 * Rouge avant correctif : 1 à 5 par fix(8.3-A3s) (S5, route absente), 6 par fix(8.3-A3e) (E3). Les envois sont comptés
 * par numéro de payeur neuf, jamais globalement. L'administrateur de la suite est suspendu en fin de suite (il ne
 * reçoit plus d'alertes, comme securite-admin-lot7).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import ts from 'typescript';
import { POST as retryRoute } from '../../app/api/admin/refunds/[id]/retry/route';
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
const ITEM_KEYS = [
    'amount', 'can_retry', 'cashout_id', 'created_at', 'event_title', 'kind', 'phone_masked', 'reason_label', 'refund_id', 'state',
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

async function listed(): Promise<{ items: Row[]; truncated: unknown; raw: string }> {
    const r = await list(admin.accessToken);
    assert.equal(r.status, 200, show(r));
    assert.ok(Array.isArray(r.body.items), `items : ${show(r)}`);
    return { items: r.body.items as Row[], truncated: r.body.truncated, raw: JSON.stringify(r.body) };
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
    SELECT count(*)::int AS n FROM public.cashouts
     WHERE kind IN ('REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND')
       AND (status IN ('ECHOUE', 'INCERTAIN') OR (status = 'A_ENVOYER' AND blocked_reason IS NOT NULL))`;

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
        assert.equal(typeof r5.body.truncated, 'boolean', `truncated : ${show(r5)}`);

        const superadmin = await signInAs('SUPERADMIN');
        const r6 = await list(superadmin.accessToken);
        assert.equal(r6.status, 200, `SUPERADMIN : ${show(r6)}`);
    });
});

// ── 2 à 4. Contenu ─────────────────────────────────────────────────────────

describe('A3 — liste des remboursements à reprendre (contrat 3.10)', () => {
    let failed: Refundable;
    let uncertain: Refundable;
    let noBalance: Refundable;
    let noOperator: { cashoutId: string; refundId: string };
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

        const confirmed = await refundable('confirme');
        assert.equal(await sentIn('success', confirmed), 'CONFIRME', 'précondition : versement confirmé');
        excluded.push({ what: 'CONFIRME', cashoutId: confirmed.cashoutId });

        const pending = await refundable('envoye');
        assert.equal(await sentIn('pending', pending), 'ENVOYE', 'précondition : versement en attente');
        excluded.push({ what: 'ENVOYE', cashoutId: pending.cashoutId });

        const notSent = await refundable('a-envoyer');
        excluded.push({ what: 'A_ENVOYER sans blocage', cashoutId: notSent.cashoutId });

        const { data: withdrawal, error } = await service.from('cashouts').insert({
            kind: 'WITHDRAWAL', idempotency_key: `WITHDRAWAL-A3-${randomUUID()}`, amount: 1000, status: 'ECHOUE',
        }).select('id').single();
        assert.equal(error, null, `retrait de test : ${error?.message}`);
        excluded.push({ what: 'retrait ECHOUE', cashoutId: withdrawal.id });
    });

    function item(items: Row[], cashoutId: string): Row {
        const found = items.find((i) => i.cashout_id === cashoutId);
        assert.ok(found, `cashout ${cashoutId} absent de la liste`);
        return found;
    }

    async function assertCommon(row: Row, cashoutId: string, refundId: string): Promise<void> {
        const db = await cashoutRow(cashoutId);
        assert.deepEqual(Object.keys(row).sort(), ITEM_KEYS, `champs de la ligne : ${JSON.stringify(row)}`);
        assert.equal(row.refund_id, refundId);
        assert.equal(row.kind, db.kind);
        assert.equal(Number(row.amount), Number(db.amount));
        assert.equal(new Date(String(row.created_at)).getTime(), new Date(String(db.created_at)).getTime(), 'created_at du cashout');
    }

    test('périmètre exact : le nombre de lignes est celui de l’oracle, aucune opération hors périmètre', async () => {
        const count = await scopeCount();
        assert.ok(count >= 4 && count <= 100, `précondition : ${count} remboursements à reprendre en base (4 à 100 attendus)`);
        const { items, truncated } = await listed();
        assert.equal(items.length, count, `lignes rendues ≠ oracle (${count})`);
        assert.equal(truncated, false, 'liste complète : truncated faux');
        for (const e of excluded) {
            assert.equal(items.some((i) => i.cashout_id === e.cashoutId), false, `${e.what} ne doit pas figurer dans la liste`);
        }
    });

    test('refus de SamirPay : état ECHOUE, relance possible, titre de l’événement, numéro masqué', async () => {
        const { items } = await listed();
        const row = item(items, failed.cashoutId);
        await assertCommon(row, failed.cashoutId, failed.refundId);
        assert.equal(row.kind, 'TICKET_REFUND');
        assert.equal(row.state, 'ECHOUE');
        assert.equal(row.can_retry, true);
        assert.equal(row.event_title, eventTitle);
        assert.equal(row.phone_masked, maskPhone(failed.buyer.phone9));
    });

    test('issue incertaine : état INCERTAIN, jamais de relance', async () => {
        const { items } = await listed();
        const row = item(items, uncertain.cashoutId);
        await assertCommon(row, uncertain.cashoutId, uncertain.refundId);
        assert.equal(row.state, 'INCERTAIN');
        assert.equal(row.can_retry, false, 'l’argent a pu partir : aucun renvoi');
        assert.equal(row.phone_masked, maskPhone(uncertain.buyer.phone9));
    });

    test('solde insuffisant : état BLOQUE, relance possible, motif en français', async () => {
        const { items } = await listed();
        const row = item(items, noBalance.cashoutId);
        await assertCommon(row, noBalance.cashoutId, noBalance.refundId);
        assert.equal(row.state, 'BLOQUE');
        assert.equal(row.can_retry, true);
        assert.equal(typeof row.reason_label, 'string', 'motif du blocage');
        assert.ok(String(row.reason_label).length > 0, 'motif du blocage vide');
        assert.doesNotMatch(String(row.reason_label), RAW_CODE, 'code technique affiché');
    });

    test('opérateur inconnu : état BLOQUE, relance impossible, aucun numéro ni événement à montrer', async () => {
        const { items } = await listed();
        const row = item(items, noOperator.cashoutId);
        await assertCommon(row, noOperator.cashoutId, noOperator.refundId);
        assert.equal(row.state, 'BLOQUE');
        assert.equal(row.can_retry, false, 'seul le blocage SOLDE_INSUFFISANT se relance');
        assert.doesNotMatch(String(row.reason_label), RAW_CODE, 'code technique affiché');
        assert.equal(row.event_title, null);
        assert.ok(row.phone_masked === null || row.phone_masked === maskPhone(null), `numéro inconnu : ${JSON.stringify(row.phone_masked)}`);
    });

    test('jamais de numéro complet, d’erreur brute de SamirPay ni de code de blocage dans la réponse', async () => {
        const failedRow = await cashoutRow(failed.cashoutId);
        const uncertainRow = await cashoutRow(uncertain.cashoutId);
        assert.ok(failedRow.last_error, 'précondition : erreur brute enregistrée');
        assert.ok(uncertainRow.last_error, 'précondition : erreur brute enregistrée');
        const { raw } = await listed();
        for (const r of [failed, uncertain, noBalance]) {
            assert.equal(raw.includes(r.buyer.phone9), false, `numéro complet ${r.buyer.phone9} dans la réponse`);
            assert.equal(raw.includes(r.buyer.phoneE164), false, `numéro complet ${r.buyer.phoneE164} dans la réponse`);
        }
        assert.equal(raw.includes(String(failedRow.last_error)), false, 'erreur brute du refus renvoyée au navigateur');
        assert.equal(raw.includes(String(uncertainRow.last_error)), false, 'erreur brute du délai renvoyée au navigateur');
        assert.equal(raw.includes('SOLDE_INSUFFISANT'), false, 'code de blocage renvoyé au navigateur');
    });

    test('tri par created_at, dans un seul sens', async () => {
        const { items } = await listed();
        const times = items.map((i) => new Date(String(i.created_at)).getTime());
        const asc = times.every((t, i) => i === 0 || t >= times[i - 1]);
        const desc = times.every((t, i) => i === 0 || t <= times[i - 1]);
        assert.ok(asc || desc, `lignes non triées : ${items.map((i) => i.created_at).join(', ')}`);
    });

    test('le refund_id de la liste est celui de la relance : deuxième envoi, CONFIRME, la ligne quitte la liste', async () => {
        const before0 = callsOf('sendCashout').filter((c) => c.args.phoneNumber === failed.buyer.phone9).length;
        assert.equal(before0, 1, 'précondition : un envoi refusé');
        const { items } = await listed();
        const row = item(items, failed.cashoutId);

        const res = await retryRoute(authed(`/api/admin/refunds/${String(row.refund_id)}/retry`, 'POST', admin), { params: { id: String(row.refund_id) } });
        const body = await res.json() as Row;
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(body.success, true, JSON.stringify(body));

        assert.equal((await cashoutRow(failed.cashoutId)).status, 'CONFIRME');
        assert.equal(callsOf('sendCashout').filter((c) => c.args.phoneNumber === failed.buyer.phone9).length, 2, 'un seul nouvel envoi');
        const after0 = await listed();
        assert.equal(after0.items.some((i) => i.cashout_id === failed.cashoutId), false, 'la ligne relancée quitte la liste');
    });

    test('100 lignes au plus : truncated vrai au-delà, faux une fois revenu sous le plafond', async () => {
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
            assert.equal(capped.truncated, true, 'liste tronquée signalée');
        } finally {
            const { error: delErr } = await service.from('cashouts').delete().like('idempotency_key', `${key}-%`);
            assert.equal(delErr, null, `retrait des lignes de test : ${delErr?.message}`);
        }
        assert.equal((await listed()).truncated, false, 'sous le plafond : truncated faux');
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
    return text.replace(/&apos;|&#39;|&rsquo;|’/g, '\'').replace(/[\s  ]+/g, ' ').trim();
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

const isRetryCall = (text: string): boolean => /\bfetch\(/.test(text) && /\/api\/admin\/refunds\/\$\{[^}]+\}\/retry/.test(text);

describe('A3 — écran : /admin/finance monte le panneau de relance (statique)', () => {
    test('/admin/finance importe et rend RefundsToRetry', () => {
        const sf = parseFile(FINANCE_PAGE);
        assert.ok(nodesOf(sf, (n) => ts.isImportDeclaration(n) && (n.moduleSpecifier as ts.StringLiteral).text === '@/components/admin/RefundsToRetry').length === 1,
            `${FINANCE_PAGE} n'importe pas @/components/admin/RefundsToRetry`);
        assert.ok(nodesOf(sf, (n) => tagName(n) === 'RefundsToRetry').length === 1, `${FINANCE_PAGE} ne rend pas <RefundsToRetry />`);
    });

    test('le panneau lit GET /api/admin/refunds?state=to_retry', () => {
        const sf = parseFile(PANEL);
        assert.match(code(sf), /\/api\/admin\/refunds\?state=to_retry/, `${PANEL} ne lit pas la liste`);
    });

    test('la relance part seulement d’un ConfirmDialog, jamais directement d’un bouton', () => {
        const sf = parseFile(PANEL);
        assert.ok(reaches(sf, sf, isRetryCall), `${PANEL} n'appelle pas POST /api/admin/refunds/<id>/retry`);
        const handlers = nodesOf(sf, ts.isJsxAttribute).filter((a) => /^on[A-Z]/.test((a as ts.JsxAttribute).name.getText())) as ts.JsxAttribute[];
        const direct = handlers.filter((a) => a.initializer !== undefined && reaches(sf, a.initializer, isRetryCall));
        assert.ok(direct.length > 0, `${PANEL} : aucun gestionnaire ne mène à la relance`);
        const outside = direct.filter((a) => !(a.name.getText() === 'onConfirm' && ownerTag(a) === 'ConfirmDialog'));
        assert.deepEqual(outside.map((a) => code(sf, a)), [], 'relance hors du ConfirmDialog');
    });

    test('le résultat est lu dans le corps : la route répond 200 avec success: false', () => {
        const sf = parseFile(PANEL);
        const fns = localFunctions(sf);
        const retry = Array.from(fns.values()).find((f) => isRetryCall(code(sf, f)));
        assert.ok(retry, `${PANEL} : fonction de relance introuvable`);
        assert.match(code(sf, retry), /\.success\b/, 'le panneau doit lire success dans la réponse : res.ok ne prouve pas l’envoi');
        assert.match(code(sf, retry), /\.message\b/, 'le panneau doit afficher le message de la réponse');
    });

    test('« Relancer » n’existe que sous can_retry, et le cas incertain renvoie à SamirPay', () => {
        const sf = parseFile(PANEL);
        const buttons = nodesOf(sf, (n) => tagName(n) === 'Button' && ts.isJsxElement(n) && clean(n.children.map((c) => (ts.isJsxText(c) ? c.text : '')).join(' ')).includes('Relancer'));
        assert.ok(buttons.length > 0, `${PANEL} : bouton « Relancer » absent`);
        for (const b of buttons) {
            assert.equal(attribute(b, 'disabled') !== undefined && /can_retry/.test(code(sf, attribute(b, 'disabled')!)), false, 'contrat : pas de bouton grisé, le bouton n’existe pas sans can_retry');
            let guarded = false;
            for (let p: ts.Node | undefined = b.parent; p && !guarded; p = p.parent) {
                if (isFunctionNode(p)) guarded = /can_retry/.test(code(sf, p));
                else if (ts.isConditionalExpression(p) || ts.isBinaryExpression(p)) guarded = /can_retry/.test(code(sf, ts.isConditionalExpression(p) ? p.condition : p.left));
            }
            assert.ok(guarded, 'bouton « Relancer » rendu sans condition sur can_retry');
        }
        const texts = nodesOf(sf, (n) => ts.isJsxText(n) || ts.isStringLiteralLike(n)).map((n) => clean((n as ts.LiteralLikeNode).text));
        assert.ok(texts.some((t) => t.toLowerCase().includes('à vérifier auprès de samirpay')), `${PANEL} : mention « à vérifier auprès de SamirPay » absente`);
    });
});
