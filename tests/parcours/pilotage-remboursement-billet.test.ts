/**
 * Lot 8, tâche 8.3 d, anomalie A4 (contrat 3.11, 13.4, L89 ; CDC §41, §82) — remboursement d'un billet sans écran :
 * POST /api/partner/events/[id]/tickets/[ticketId]/refund est testé (finance-remboursement-billet) mais n'a aucun
 * appelant. Le pilotage cherche le billet par son numéro, puis demande un motif et une seconde confirmation.
 *  1. droits de GET /api/partner/events/[id]/tickets/lookup?number=TCK-… (ceux de la route de remboursement) :
 *     propriétaire 200, ADMIN 200, autre partenaire 403, contrôleur 403, client 403, sans session 401, compte
 *     SUSPENDU 403 ;
 *  2. 404 TICKET_NOT_FOUND : numéro inconnu, billet d'un autre événement du même partenaire, billet d'un autre
 *     partenaire présenté sur son propre événement ;
 *  3. fiche exacte, champs du contrat seulement (ni qr_code, ni téléphone, ni nom complet) ; refund_mode CASHOUT,
 *     ORGANISATEUR, AUCUN selon le billet, comme ticket_refund_request ;
 *  4. la fiche sert au remboursement : son id est accepté par la route, prix + frais = montant remboursé, et elle
 *     dit ensuite que le billet n'est plus remboursable ;
 *  5. statique : TicketRefundPanel monté dans l'onglet Ventes, motif (ReasonDialog) puis ConfirmDialog, et le POST
 *     ne part que du second : aucune autre action de l'écran n'y mène.
 *
 * Rouge avant correctif : 1 à 4 par fix(8.3-A4s) (S5, route absente), 5 par fix(8.3-A4e) (E0).
 * Non figé, signalé : `refundable` d'un billet gratuit VALIDE (le contrat ne le dit pas ; la RPC l'annule sans argent).
 * Le billet espèces est écrit comme dans finance-remboursement-billet (cashSale), canal COUNTER en plus.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import ts from 'typescript';
import { POST as refundRoute } from '../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route';
import { bearer, signInAs } from '../helpers/fixtures';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { authed, createTimedEvent, scan, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import { buyConfirmed, createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { BASE_URL } from './helpers';
import { importModule, newBuyer, service, setFakeMode, type Buyer, type SaleEvent } from './paiement-helpers';
import { issueFreeTicket, newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const ROUTE = '../../app/api/partner/events/[id]/tickets/lookup/route';
const PRICE = 5000;
const TICKET_KEYS = ['category', 'holder_short', 'id', 'price', 'refund_closed_reason', 'refund_mode', 'refundable', 'sale_channel', 'service_fee', 'status', 'ticket_number']; // lot 9 bis (R11, contrat 4.1) : + refund_closed_reason
const PANEL = 'components/partner/pilotage/TicketRefundPanel.tsx';
const SALES_TAB = 'components/partner/pilotage/SalesTab.tsx';

let partner: TestPartner;
let other: TestPartner;
let ev: SaleEvent;
let sibling: SaleEvent;
let otherEvent: SaleEvent;
let buyer: Buyer;
let bought: Row;
let ready = false;

/** Installation commune aux suites à base ; les contrôles statiques de fin de fichier n'en ont pas besoin. */
async function setup(): Promise<void> {
    if (ready) return;
    partner = await newPartner('a4');
    other = await newPartner('a4-autre');
    ev = await createPartnerEvent(partner.partnerId, 'a4', [{ name: 'Standard', price: PRICE, total: 30 }, { name: 'Offerte', price: 0, total: 5 }]);
    sibling = await createPartnerEvent(partner.partnerId, 'a4-voisin', [{ name: 'Standard', price: PRICE, total: 5 }]);
    otherEvent = await createPartnerEvent(other.partnerId, 'a4-etranger', [{ name: 'Standard', price: PRICE, total: 5 }]);
    buyer = await newBuyer('a4', { firstName: 'Aminata', lastName: 'Rembourse' });
    ({ tickets: [bought] } = await buyConfirmed(buyer, ev, [['Standard', 1]]));
    ready = true;
}

after(async () => {
    setFakeMode('cashoutMode', 'success');
    await assertRecetteInvariants('pilotage-remboursement-billet');
});

// ── Appels ─────────────────────────────────────────────────────────────────

/** Contexte de route compatible avec params objet (Next 14) et params promesse. */
function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function lookupHandler(): Promise<Handler> {
    let mod: { GET?: Handler };
    try {
        mod = await importModule(ROUTE);
    } catch (err) {
        assert.fail(`GET …/tickets/lookup absente : app/api/partner/events/[id]/tickets/lookup/route.ts (contrat 3.11, fix(8.3-A4s)) — ${String((err as Error).message).split('\n')[0]}`);
    }
    assert.equal(typeof mod.GET, 'function', 'tickets/lookup/route.ts : GET non exporté');
    return mod.GET!;
}

async function lookup(token: string | null, eventId: string, number: unknown): Promise<RouteResult> {
    const handler = await lookupHandler();
    const url = `${BASE_URL}/api/partner/events/${eventId}/tickets/lookup?number=${encodeURIComponent(String(number))}`;
    const res = await handler(new NextRequest(url, { method: 'GET', headers: token ? bearer(token) : {} }), routeCtx({ id: eventId }));
    return { status: res.status, body: await res.json() as Row };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 500)}`;
}

function ticketOf(r: RouteResult): Row {
    assert.equal(r.status, 200, show(r));
    assert.ok(r.body.ticket && typeof r.body.ticket === 'object', `fiche absente : ${show(r)}`);
    return r.body.ticket as Row;
}

/** Vente espèces : paiement hors plateforme et billet VALIDE (patron de finance-remboursement-billet). */
async function cashTicket(): Promise<Row> {
    const payer = await newBuyer('a4-especes');
    const cat = ev.categories.Standard;
    const { data: pay, error: payErr } = await service.from('payments').insert({
        transaction_id: `TX-CASH-TEST-${randomUUID()}`, client_id: payer.userId, partner_id: partner.partnerId,
        payment_target: 'TICKET', amount: cat.price, currency: 'XOF', is_platform_payment: false,
        offline_payment_method: 'ESPECES', payment_method: 'CASH', status: 'SUCCESS', paid_at: new Date().toISOString(),
        metadata: { event_id: ev.eventId },
    }).select('id').single();
    assert.equal(payErr, null, `paiement espèces : ${payErr?.message}`);
    const { data: t, error: tErr } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: payer.userId, payment_id: pay.id, sale_channel: 'COUNTER',
        ticket_number: `TCK-CASH-${randomUUID().slice(0, 12).toUpperCase()}`, price: cat.price,
        qr_code: `EV-QR-TEST-${randomUUID()}`, status: 'VALIDE',
    }).select('*').single();
    assert.equal(tErr, null, `billet espèces : ${tErr?.message}`);
    const { data: c, error: cErr } = await service.from('ticket_categories').select('sold_quantity').eq('id', cat.id).single();
    assert.equal(cErr, null, `stock : ${cErr?.message}`);
    const { error: soldErr } = await service.from('ticket_categories').update({ sold_quantity: Number(c.sold_quantity) + 1 }).eq('id', cat.id);
    assert.equal(soldErr, null, `stock vendu : ${soldErr?.message}`);
    return t as Row;
}

// ── 1 et 2. Droits ─────────────────────────────────────────────────────────

describe('A4 — GET …/tickets/lookup : droits de la route de remboursement', () => {
    before(setup);

    test('propriétaire et ADMIN 200 ; autre partenaire, contrôleur, client 403 ; sans session 401', async () => {
        const number = bought.ticket_number;
        assert.equal(ticketOf(await lookup(partner.accessToken, ev.eventId, number)).id, bought.id, 'propriétaire');

        const adminUser = await newAdminWith(['refunds.manage'], { label: 'lookup-perm' }); const adminWithout = await newAdminWith(['events.read', 'events.write'], { label: 'lookup-sans' });
        assert.equal(ticketOf(await lookup(adminUser.accessToken, ev.eventId, number)).id, bought.id, 'ADMIN refunds.manage (lot 9 bis, R2, T28)'); const withoutRes = await lookup(adminWithout.accessToken, ev.eventId, number); assert.equal(withoutRes.status, 403, `R2 : ADMIN sans refunds.manage → 403 : ${show(withoutRes)}`); assert.equal(withoutRes.body.ticket, undefined, 'aucune fiche pour l’ADMIN sans refunds.manage');

        const foreign = await lookup(other.accessToken, ev.eventId, number);
        assert.equal(foreign.status, 403, `autre partenaire : ${show(foreign)}`);
        assert.equal(foreign.body.ticket, undefined, 'aucune fiche pour un autre partenaire');

        const controller = await signInAs('CONTROLLER_A');
        const asController = await lookup(controller.accessToken, ev.eventId, number);
        assert.equal(asController.status, 403, `contrôleur : ${show(asController)}`);

        const asClient = await lookup(buyer.accessToken, ev.eventId, number);
        assert.equal(asClient.status, 403, `client, porteur du billet : ${show(asClient)}`);

        const anonymous = await lookup(null, ev.eventId, number);
        assert.equal(anonymous.status, 401, `sans session : ${show(anonymous)}`);
    });

    test('partenaire SUSPENDU : 403 ACCOUNT_NOT_ACTIVE', async () => {
        const suspended = await newPartner('a4-suspendu');
        const own = await createPartnerEvent(suspended.partnerId, 'a4-suspendu', [{ name: 'Standard', price: PRICE, total: 5 }]);
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const r = await lookup(suspended.accessToken, own.eventId, bought.ticket_number);
        assert.equal(r.status, 403, show(r));
        assert.equal(r.body.code, 'ACCOUNT_NOT_ACTIVE', show(r));
    });

    test('404 TICKET_NOT_FOUND : numéro inconnu, autre événement du partenaire, billet d’autrui sur son propre événement', async () => {
        const unknown = await lookup(partner.accessToken, ev.eventId, `TCK-INCONNU-${randomUUID().slice(0, 8)}`);
        assert.equal(unknown.status, 404, `numéro inconnu : ${show(unknown)}`);
        assert.equal(unknown.body.code, 'TICKET_NOT_FOUND', show(unknown));

        const wrongEvent = await lookup(partner.accessToken, sibling.eventId, bought.ticket_number);
        assert.equal(wrongEvent.status, 404, `billet d’un autre événement : ${show(wrongEvent)}`);
        assert.equal(wrongEvent.body.code, 'TICKET_NOT_FOUND', show(wrongEvent));
        assert.equal(wrongEvent.body.ticket, undefined, 'aucune fiche');

        const crossPartner = await lookup(other.accessToken, otherEvent.eventId, bought.ticket_number);
        assert.equal(crossPartner.status, 404, `billet d’un autre partenaire sur son événement : ${show(crossPartner)}`);
        assert.equal(crossPartner.body.code, 'TICKET_NOT_FOUND', show(crossPartner));
    });
});

// ── 3. Fiche ───────────────────────────────────────────────────────────────

describe('A4 — fiche du billet (contrat 3.11)', () => {
    before(setup);

    test('billet payé en ligne : fiche exacte, mode CASHOUT, remboursable, rien de plus que le contrat', async () => {
        const r = await lookup(partner.accessToken, ev.eventId, bought.ticket_number);
        const t = ticketOf(r);
        assert.deepEqual(Object.keys(t).sort(), TICKET_KEYS, `champs de la fiche : ${show(r)}`);
        assert.equal(t.id, bought.id);
        assert.equal(t.ticket_number, bought.ticket_number);
        assert.equal(t.category, 'Standard');
        assert.equal(t.price, PRICE);
        assert.equal(t.service_fee, Number(bought.service_fee));
        assert.ok(Number(t.service_fee) > 0, 'précondition : frais de service sur un billet payant');
        assert.equal(t.status, 'VALIDE');
        assert.equal(t.sale_channel, 'ONLINE');
        assert.equal(t.refundable, true);
        assert.equal(t.refund_mode, 'CASHOUT');
        assert.match(String(t.holder_short), /^Aminata R\.?$/, 'prénom et initiale');
        const raw = JSON.stringify(r.body);
        assert.equal(raw.includes('Rembourse'), false, 'nom complet du porteur exposé');
        assert.equal(raw.includes(buyer.phone9), false, 'numéro du porteur exposé');
        assert.equal(raw.includes(String(bought.qr_code)), false, 'QR du billet exposé');
    });

    test('billet payé en espèces : remboursé par l’organisateur, mode ORGANISATEUR', async () => {
        const cash = await cashTicket();
        const t = ticketOf(await lookup(partner.accessToken, ev.eventId, cash.ticket_number));
        assert.equal(t.sale_channel, 'COUNTER');
        assert.equal(t.refundable, true);
        assert.equal(t.refund_mode, 'ORGANISATEUR');
    });

    test('billet gratuit : mode AUCUN, rien à verser', async () => {
        const holder = await newBuyer('a4-gratuit');
        const id = await issueFreeTicket(ev.eventId, ev.categories.Offerte.id, holder);
        const row = await ticketRow(id);
        const t = ticketOf(await lookup(partner.accessToken, ev.eventId, row.ticket_number));
        assert.equal(t.price, 0);
        assert.equal(t.refund_mode, 'AUCUN');
    });
});

// ── 4. Chaîne fiche → remboursement ────────────────────────────────────────

describe('A4 — la fiche sert au remboursement', () => {
    before(setup);

    test('id accepté par la route, prix + frais = montant remboursé, billet ensuite non remboursable', async () => {
        const client = await newBuyer('a4-chaine');
        const { tickets: [t] } = await buyConfirmed(client, ev, [['Standard', 1]]);
        const sheet = ticketOf(await lookup(partner.accessToken, ev.eventId, t.ticket_number));

        const res = await refundRoute(
            authed(`/api/partner/events/${ev.eventId}/tickets/${String(sheet.id)}/refund`, 'POST', partner, { reason: 'Client empêché, lot 8' }),
            routeCtx({ id: ev.eventId, ticketId: String(sheet.id) }),
        );
        const done = await res.json() as Row;
        assert.equal(res.status, 200, JSON.stringify(done));
        assert.equal(done.mode, sheet.refund_mode, 'mode annoncé = mode appliqué');
        assert.equal(Number(done.amount), Number(sheet.price) + Number(sheet.service_fee), 'montant annoncé = montant remboursé');

        const afterRefund = ticketOf(await lookup(partner.accessToken, ev.eventId, t.ticket_number));
        assert.equal(afterRefund.refundable, false, `billet ${String(afterRefund.status)} : plus remboursable`);
        assert.notEqual(afterRefund.status, 'VALIDE');
    });

    test('billet utilisé par un vrai scan : la fiche dit non remboursable', async () => {
        const door = await createTimedEvent(partner.partnerId, 'a4-porte', [{ name: 'Standard', price: PRICE, total: 5 }]);
        const client = await newBuyer('a4-utilise');
        const { tickets: [t] } = await buyConfirmed(client, door, [['Standard', 1]]);
        const scanned = await scan(partner, { eventId: door.eventId, payload: await ticketPayload(String(t.id)) });
        assert.equal(scanned.status, 200, show(scanned));
        assert.equal(scanned.body.result, 'valid', show(scanned));
        const sheet = ticketOf(await lookup(partner.accessToken, door.eventId, t.ticket_number));
        assert.equal(sheet.status, 'UTILISE');
        assert.equal(sheet.refundable, false);
    });

    test('A36 : refus du remboursement d’un billet utilisé, sans statut technique dans la réponse', async () => {
        const door = await createTimedEvent(partner.partnerId, 'a36-porte', [{ name: 'Standard', price: PRICE, total: 5 }]);
        const client = await newBuyer('a36-utilise');
        const { tickets: [t] } = await buyConfirmed(client, door, [['Standard', 1]]);
        const scanned = await scan(partner, { eventId: door.eventId, payload: await ticketPayload(String(t.id)) });
        assert.equal(scanned.body.result, 'valid', show(scanned));

        const res = await refundRoute(
            authed(`/api/partner/events/${door.eventId}/tickets/${String(t.id)}/refund`, 'POST', partner, { reason: 'Client empêché, lot 8' }),
            routeCtx({ id: door.eventId, ticketId: String(t.id) }),
        );
        const refused = await res.json() as Row;
        assert.equal(res.status, 409, JSON.stringify(refused));
        assert.equal(refused.code, 'TICKET_NOT_REFUNDABLE', JSON.stringify(refused));
        assert.doesNotMatch(String(refused.error), /UTILISE|VALIDE|REMBOURS[EÉ]_|[A-Z]{4,}_[A-Z]+/, 'aucun statut technique dans le message');
    });
});

// ── 5. Écran (statique) ────────────────────────────────────────────────────

function parseFile(rel: string): ts.SourceFile {
    const abs = path.join(process.cwd(), ...rel.split('/'));
    assert.ok(fs.existsSync(abs), `${rel} absent (contrat 13.4, fix(8.3-A4e))`);
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

function ownerTag(attr: ts.JsxAttribute): string | null {
    const owner = attr.parent.parent;
    return ts.isJsxOpeningElement(owner) || ts.isJsxSelfClosingElement(owner) ? owner.tagName.getText() : null;
}

function tagIs(n: ts.Node, name: string): boolean {
    return (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText() === name;
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

const isRefundCall = (text: string): boolean => /\bfetch\(/.test(text) && /\/tickets\/\$\{[^}]+\}\/refund/.test(text) && /['"]POST['"]/.test(text);

function handlers(sf: ts.SourceFile): ts.JsxAttribute[] {
    return nodesOf(sf, ts.isJsxAttribute).filter((a) => /^on[A-Z]/.test((a as ts.JsxAttribute).name.getText())) as ts.JsxAttribute[];
}

describe('A4 — écran : double confirmation avant le POST (statique)', () => {
    test('l’onglet Ventes monte TicketRefundPanel avec l’événement', () => {
        const sf = parseFile(SALES_TAB);
        assert.equal(nodesOf(sf, (n) => ts.isImportDeclaration(n) && /\/TicketRefundPanel$/.test((n.moduleSpecifier as ts.StringLiteral).text)).length, 1, `${SALES_TAB} n'importe pas TicketRefundPanel`);
        const panels = nodesOf(sf, (n) => tagIs(n, 'TicketRefundPanel'));
        assert.equal(panels.length, 1, `${SALES_TAB} ne rend pas <TicketRefundPanel />`);
        assert.match(code(sf, panels[0]), /eventId=\{eventId\}/, 'l’événement est transmis au panneau');
    });

    test('le panneau cherche par numéro, encodé, sur la route de recherche', () => {
        const sf = parseFile(PANEL);
        assert.match(code(sf), /\/tickets\/lookup\?number=\$\{encodeURIComponent\(/, `${PANEL} : recherche par numéro absente`);
    });

    test('motif par ReasonDialog puis ConfirmDialog : le POST part du second seulement', () => {
        const sf = parseFile(PANEL);
        assert.ok(nodesOf(sf, (n) => tagIs(n, 'ReasonDialog')).length >= 1, `${PANEL} : <ReasonDialog /> absent`);
        assert.ok(nodesOf(sf, (n) => tagIs(n, 'ConfirmDialog')).length >= 1, `${PANEL} : <ConfirmDialog /> absent`);
        const all = handlers(sf);
        const toRefund = all.filter((a) => a.initializer !== undefined && reaches(sf, a.initializer, isRefundCall));
        assert.ok(toRefund.length > 0, `${PANEL} : aucun gestionnaire ne mène à POST …/tickets/<id>/refund`);
        const outside = toRefund.filter((a) => !(a.name.getText() === 'onConfirm' && ownerTag(a) === 'ConfirmDialog'));
        assert.deepEqual(outside.map((a) => `${ownerTag(a)}.${a.name.getText()}`), [], 'le remboursement doit partir du seul ConfirmDialog, après le motif');
        const reason = all.filter((a) => a.name.getText() === 'onConfirm' && ownerTag(a) === 'ReasonDialog');
        assert.ok(reason.length >= 1, 'ReasonDialog sans onConfirm');
    });

    test('le motif est envoyé, et le mode et le montant sont lus sur la fiche', () => {
        const sf = parseFile(PANEL);
        const text = code(sf);
        const fn = Array.from(localFunctions(sf).values()).find((f) => isRefundCall(code(sf, f)));
        assert.ok(fn, `${PANEL} : fonction de remboursement introuvable`);
        assert.match(code(sf, fn), /\breason\b/, 'le motif part dans le corps du POST');
        assert.match(text, /\.refund_mode\b/, 'la confirmation doit dire le mode (contrat 13.4)');
        assert.match(text, /\.refundable\b/, 'un billet non remboursable ne propose aucune action');
        assert.match(text, /\.service_fee\b/, 'le montant remboursé compte les frais de service');
    });
});
