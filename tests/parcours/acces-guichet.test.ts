/**
 * Lot 4, tâche 4.6 — vente au guichet en espèces (constat payment-security-15, lot 2 §2.8 ; CDC §11, §55,
 * §76). Contrat : section E de la conception du lot 4.
 *  - POST /api/controller/counter-sale { eventId, items: [{ categoryId, quantity }], buyerPhone? } →
 *    counter_sale(p jsonb) : réglage access.counter_sale_enabled, contrôleur AFFECTÉ avec can_accept_cash,
 *    caisse OUVERT, contrôles ticket_sale_problems, stock sous verrou ;
 *  - paiement hors plateforme au prix facial rattaché à la caisse (fin_offline, ESPECES, shift_id), billets
 *    avec payment_id ; lot 5 (contrat C7, décision de l'utilisateur) : billets UTILISE sans compte (canal
 *    COUNTER), jamais au vendeur ni au compte du buyerPhone, Idempotency-Key obligatoire ; total
 *    attendu de la caisse incrémenté ; aucune écriture au grand livre ;
 *  - /api/events/[id]/tickets/purchase supprimée (410 depuis le lot 2).
 * Interprétations (contrat muet) : refus = HTTP 4xx (ou ok: false), jamais 5xx ni effet de bord ;
 * buyerPhone au format E.164 (+221…), comme users.phone.
 * La route est nouvelle : importée dynamiquement. La suite crée son partenaire, ses événements et ses
 * contrôleurs.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { randomSenegalPhone } from './helpers';
import { categoryState, eventTickets, importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { ledgerOf, newPartner, paymentRow, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, openShift, shiftRow, withAccessSettings, type RouteResult } from './acces-helpers';

const STANDARD = 3000;
const FIN_OFFLINE_ZERO = ['service_fee', 'aggregator_fee', 'gross_event_village_revenue', 'net_event_village_revenue', 'partner_payout_amount'];

let partner: TestPartner;
let ev: SaleEvent;
let seller: Buyer;

before(async () => {
    partner = await newPartner('guichet');
    ev = await createTimedEvent(partner.partnerId, 'guichet', [
        { name: 'Standard', price: STANDARD, total: 40 },
        { name: 'Inactive', price: 2000, total: 10, isActive: false },
        { name: 'Rare', price: 4000, total: 1 },
    ]);
    seller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'guichet' });
});

after(async () => {
    await assertAccessInvariants('acces-guichet');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function invoke(handler: (req: NextRequest, ctx?: unknown) => Promise<Response>, req: NextRequest): Promise<RouteResult> {
    const res = await handler(req);
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

async function counterSale(user: Buyer, body: Record<string, unknown>): Promise<RouteResult> {
    let mod: { POST?: (req: NextRequest) => Promise<Response> };
    try {
        mod = await importModule('../../app/api/controller/counter-sale/route');
    } catch (err) {
        assert.fail(`POST /api/controller/counter-sale absente (contrat E du lot 4) : ${err instanceof Error ? err.message : String(err)}`);
    }
    assert.equal(typeof mod.POST, 'function', 'POST /api/controller/counter-sale : gestionnaire POST exporté');
    // Lot 5 (C7) : Idempotency-Key obligatoire, une clé neuve par vente
    return invoke(mod.POST!, authed('/api/controller/counter-sale', 'POST', user, body, { 'idempotency-key': randomUUID() }));
}

function items(...list: Array<[string, number]>): Array<{ categoryId: string; quantity: number }> {
    return list.map(([name, quantity]) => ({ categoryId: ev.categories[name].id, quantity }));
}

async function openShiftsOf(userId: string, eventId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('controller_shifts').select('*').eq('controller_id', userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisses ouvertes : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

async function openCashShift(user: Buyer, eventId: string): Promise<string> {
    const existing = await openShiftsOf(user.userId, eventId);
    if (existing.length === 1) return existing[0].id as string;
    const res = await openShift(user, eventId);
    assert.equal(res.status, 200, `ouverture de caisse : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    const rows = await openShiftsOf(user.userId, eventId);
    assert.equal(rows.length, 1, `une caisse OUVERT pour ce vendeur et cet événement (trouvé : ${rows.length})`);
    return rows[0].id as string;
}

async function shiftPayments(shiftId: string): Promise<string[]> {
    const { data, error } = await service.from('payments').select('id').eq('shift_id', shiftId).order('created_at');
    assert.equal(error, null, `paiements de la caisse : ${error?.message}`);
    return (data ?? []).map((p) => p.id as string);
}

interface Snapshot { ticketIds: string[]; sold: Record<string, number>; shiftTotal: number | null; payments: string[] }

async function snapshot(event: SaleEvent, shiftId: string | null): Promise<Snapshot> {
    const sold: Record<string, number> = {};
    for (const [name, c] of Object.entries(event.categories)) sold[name] = (await categoryState(c.id)).sold;
    return {
        ticketIds: (await eventTickets(event.eventId)).map((t) => t.id as string).sort(),
        sold,
        shiftTotal: shiftId ? Number((await shiftRow(shiftId)).expected_cash_total) : null,
        payments: shiftId ? await shiftPayments(shiftId) : [],
    };
}

function assertRefused(res: RouteResult, label: string): void {
    assert.ok(res.status < 500, `${label} : erreur serveur HTTP ${res.status} ${JSON.stringify(res.body)}`);
    assert.ok(res.status >= 400 || res.body.ok === false, `${label} : vente refusée attendue, reçu HTTP ${res.status} ${JSON.stringify(res.body)}`);
}

async function assertNothingSold(event: SaleEvent, shiftId: string | null, before: Snapshot, label: string): Promise<void> {
    const afterSnap = await snapshot(event, shiftId);
    assert.deepEqual(afterSnap.ticketIds, before.ticketIds, `${label} : aucun billet émis`);
    assert.deepEqual(afterSnap.sold, before.sold, `${label} : stock inchangé`);
    assert.equal(afterSnap.shiftTotal, before.shiftTotal, `${label} : total attendu de la caisse inchangé`);
    assert.deepEqual(afterSnap.payments, before.payments, `${label} : aucun paiement rattaché à la caisse`);
}

/** Vente réussie : le seul nouveau paiement de la caisse et ses billets. */
async function saleOutcome(shiftId: string, before: Snapshot): Promise<{ payment: Record<string, unknown>; tickets: Array<Record<string, unknown>> }> {
    const fresh = (await shiftPayments(shiftId)).filter((id) => !before.payments.includes(id));
    assert.equal(fresh.length, 1, `un paiement hors plateforme créé et rattaché à la caisse (trouvé : ${fresh.length})`);
    const payment = await paymentRow(fresh[0]);
    const { data, error } = await service.from('tickets').select('*').eq('payment_id', fresh[0]).order('created_at');
    assert.equal(error, null, `billets de la vente : ${error?.message}`);
    return { payment, tickets: (data ?? []) as Array<Record<string, unknown>> };
}

function assertOfflineCash(p: Record<string, unknown>, amount: number, shiftId: string, label: string): void {
    assert.equal(p.is_platform_payment, false, `${label} : paiement hors plateforme`);
    assert.equal(p.status, 'SUCCESS', `${label} : paiement SUCCESS`);
    assert.equal(Number(p.amount), amount, `${label} : montant = prix facial (${amount} F)`);
    if (p.facial_amount !== null && p.facial_amount !== undefined) assert.equal(Number(p.facial_amount), amount, `${label} : facial_amount`);
    assert.equal(p.offline_payment_method, 'ESPECES', `${label} : offline_payment_method`);
    assert.equal(p.shift_id, shiftId, `${label} : rattaché à la caisse du vendeur`);
    for (const k of FIN_OFFLINE_ZERO) assert.equal(Number(p[k] ?? 0), 0, `${label} : ${k} = 0 (aucun frais ni revenu Event Village)`);
}

// ── Vente au guichet ───────────────────────────────────────────────────────

describe('Vente au guichet en espèces', () => {
    test('vente sans caisse ouverte : refusée, aucun billet ni paiement', async () => {
        const noShift = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'guichet-sans-caisse' });
        assert.equal((await openShiftsOf(noShift.userId, ev.eventId)).length, 0, 'précondition : aucune caisse ouverte');
        const before = await snapshot(ev, null);
        const res = await counterSale(noShift, { eventId: ev.eventId, items: items(['Standard', 1]) });
        assertRefused(res, 'vente sans caisse ouverte');
        await assertNothingSold(ev, null, before, 'vente sans caisse ouverte');
    });

    test('contrôleur sans permission espèces, ou non affecté à l’événement : refusé', async () => {
        // a) jamais autorisé aux espèces
        const noCash = await newController(partner, ev.eventId, { canAcceptCash: false, label: 'guichet-sans-especes' });
        let before = await snapshot(ev, null);
        assertRefused(await counterSale(noCash, { eventId: ev.eventId, items: items(['Standard', 1]) }), 'contrôleur sans permission espèces');
        await assertNothingSold(ev, null, before, 'contrôleur sans permission espèces');

        // b) permission retirée alors que sa caisse est ouverte
        const revoked = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'guichet-retire' });
        const shiftR = await openCashShift(revoked, ev.eventId);
        const { error } = await service.from('event_controllers').update({ can_accept_cash: false }).eq('event_id', ev.eventId).eq('user_id', revoked.userId);
        assert.equal(error, null, `retrait de la permission espèces : ${error?.message}`);
        before = await snapshot(ev, shiftR);
        assertRefused(await counterSale(revoked, { eventId: ev.eventId, items: items(['Standard', 1]) }), 'permission espèces retirée, caisse ouverte');
        await assertNothingSold(ev, shiftR, before, 'permission espèces retirée, caisse ouverte');

        // c) contrôleur affecté à un autre événement (caisse ouverte là-bas), pas à celui-ci
        const other = await createTimedEvent(partner.partnerId, 'guichet-autre', [{ name: 'Standard', price: STANDARD, total: 10 }]);
        const outsider = await newController(partner, other.eventId, { canAcceptCash: true, label: 'guichet-hors-evt' });
        const shiftO = await openCashShift(outsider, other.eventId);
        before = await snapshot(ev, null);
        const otherBefore = await snapshot(other, shiftO);
        assertRefused(await counterSale(outsider, { eventId: ev.eventId, items: items(['Standard', 1]) }), 'contrôleur non affecté');
        await assertNothingSold(ev, null, before, 'contrôleur non affecté');
        await assertNothingSold(other, shiftO, otherBefore, 'contrôleur non affecté (sa caisse)');
    });

    test('réglage access.counter_sale_enabled = false : refusé', async () => {
        const shiftId = await openCashShift(seller, ev.eventId);
        const before = await snapshot(ev, shiftId);
        await withAccessSettings({ 'access.counter_sale_enabled': false }, async () => {
            assertRefused(await counterSale(seller, { eventId: ev.eventId, items: items(['Standard', 1]) }), 'guichet désactivé');
        });
        await assertNothingSold(ev, shiftId, before, 'guichet désactivé');
    });

    test('vente réussie : billets payés hors plateforme au prix facial, compostés (UTILISE) sans compte, caisse créditée, revenu EV nul, aucune écriture au grand livre, stock décrémenté', async () => {
        const shiftId = await openCashShift(seller, ev.eventId);
        const before = await snapshot(ev, shiftId);
        const res = await counterSale(seller, { eventId: ev.eventId, items: items(['Standard', 2]) });
        assert.equal(res.status, 200, `vente au guichet : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.notEqual(res.body.ok, false, `vente au guichet acceptée : ${JSON.stringify(res.body)}`);

        const { payment, tickets } = await saleOutcome(shiftId, before);
        assertOfflineCash(payment, 2 * STANDARD, shiftId, 'vente au guichet');
        assert.equal(tickets.length, 2, 'deux billets émis');
        for (const t of tickets) {
            assert.equal(t.status, 'UTILISE', 'lot 5 (C7) : billet composté dès la vente (UTILISE)');
            assert.equal(t.event_id, ev.eventId, 'billet de l’événement');
            assert.equal(t.category_id, ev.categories.Standard.id, 'billet de la catégorie vendue');
            assert.equal(Number(t.price), STANDARD, 'prix facial');
            assert.equal(Number(t.service_fee ?? 0), 0, 'aucun frais de service');
            assert.equal(t.user_id ?? null, null, 'lot 5 (C7) : billet sans compte, jamais au vendeur');
            assert.equal(t.sale_channel, 'COUNTER', 'lot 5 (C7) : canal COUNTER');
        }
        const afterSnap = await snapshot(ev, shiftId);
        assert.equal(afterSnap.shiftTotal, (before.shiftTotal ?? 0) + 2 * STANDARD, 'total attendu de la caisse += 2 × prix');
        assert.equal(afterSnap.sold.Standard, before.sold.Standard + 2, 'stock décrémenté (sold_quantity + 2)');

        const { data: ledger, error } = await service.from('finance_ledger').select('id').eq('payment_id', payment.id as string);
        assert.equal(error, null, `grand livre : ${error?.message}`);
        assert.deepEqual(ledger ?? [], [], 'aucune écriture au grand livre');
        assert.deepEqual(await ledgerOf(partner.userId, 'ORGANISATEUR'), [], 'aucun crédit au compte organisateur');
    });

    test('catégorie inactive, stock insuffisant ou panier en partie impossible : refusé sans rien vendre', async () => {
        const shiftId = await openCashShift(seller, ev.eventId);
        for (const [label, cart] of [
            ['catégorie inactive', items(['Inactive', 1])],
            ['stock insuffisant', items(['Rare', 2])],
            ['panier en partie impossible', items(['Standard', 1], ['Rare', 2])],
        ] as Array<[string, ReturnType<typeof items>]>) {
            const before = await snapshot(ev, shiftId);
            assertRefused(await counterSale(seller, { eventId: ev.eventId, items: cart }), label);
            await assertNothingSold(ev, shiftId, before, label);
        }
    });

    test('lot 5 (C7) : aucun porteur, que le buyerPhone soit celui d’un compte ou inconnu (ni l’acheteur, ni le vendeur)', async () => {
        const shiftId = await openCashShift(seller, ev.eventId);
        const client = await newBuyer('guichet-client');

        let before = await snapshot(ev, shiftId);
        let res = await counterSale(seller, { eventId: ev.eventId, items: items(['Standard', 1]), buyerPhone: client.phoneE164 });
        assert.equal(res.status, 200, `vente avec buyerPhone connu : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        let out = await saleOutcome(shiftId, before);
        assert.equal(out.tickets.length, 1, 'un billet émis');
        assert.equal(out.tickets[0].user_id ?? null, null, 'buyerPhone d’un compte existant : billet sans compte (aucun rattachement)');

        before = await snapshot(ev, shiftId);
        res = await counterSale(seller, { eventId: ev.eventId, items: items(['Standard', 1]), buyerPhone: randomSenegalPhone('76') });
        assert.equal(res.status, 200, `vente avec buyerPhone inconnu : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        out = await saleOutcome(shiftId, before);
        assert.equal(out.tickets.length, 1, 'un billet émis');
        assert.equal(out.tickets[0].user_id ?? null, null, 'buyerPhone sans compte : billet sans compte (jamais au vendeur)');
    });
});

// ── Contrôles statiques et schéma ──────────────────────────────────────────

function sourceFiles(dir: string): string[] {
    const abs = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(abs)) return [];
    const out: string[] = [];
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        const full = path.join(abs, e.name);
        if (e.isDirectory()) out.push(...sourceFiles(path.relative(process.cwd(), full)));
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(path.relative(process.cwd(), full).replace(/\\/g, '/'));
    }
    return out;
}

describe('Ancienne route d’émission par le staff et RPC du guichet', () => {
    test('/api/events/[id]/tickets/purchase n’existe plus et n’est plus référencée', () => {
        const route = path.resolve(process.cwd(), 'app/api/events/[id]/tickets/purchase/route.ts');
        assert.equal(fs.existsSync(route), false, 'app/api/events/[id]/tickets/purchase/route.ts doit être supprimée (remplacée par /api/controller/counter-sale)');
        const refs = ['app', 'components', 'hooks', 'lib']
            .flatMap(sourceFiles)
            .filter((f) => /tickets\/purchase/.test(fs.readFileSync(path.resolve(process.cwd(), f), 'utf8')));
        assert.deepEqual(refs, [], `références restantes à tickets/purchase :\n${refs.join('\n')}`);
    });

    test('RPC counter_sale : SECURITY DEFINER, search_path = public, réservée au service_role', async () => {
        const rows = await inspect(async (db) => (await db.query<{ secdef: boolean; config: string[] | null; anon: boolean; auth: boolean }>(
            `SELECT p.prosecdef AS secdef, p.proconfig AS config,
                    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'counter_sale'`)).rows);
        assert.ok(rows.length > 0, 'fonction counter_sale absente');
        for (const r of rows) {
            assert.equal(r.secdef, true, 'counter_sale : SECURITY DEFINER');
            assert.ok((r.config ?? []).some((c) => /^search_path=public$/.test(c)), `counter_sale : search_path = public (${JSON.stringify(r.config)})`);
            assert.equal(r.anon, false, 'counter_sale : non exécutable par anon');
            assert.equal(r.auth, false, 'counter_sale : non exécutable par authenticated');
        }
    });
});
