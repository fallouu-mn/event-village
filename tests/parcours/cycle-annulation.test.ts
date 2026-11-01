/**
 * Lot 5, tâches 5.2 et 5.8 (serveur) — annulation transactionnelle d'un événement (events-cdc-9,
 * partner-ux-2) et point A6 (IDOR du résumé d'annulation). Contrat : sections D6, A6 et U.
 *  - event_cancel(p) { event_id, actor_id, public_notice, internal_reason, confirm_title } : une seule
 *    transaction ; PUBLIE, VALIDE ou SUSPENDU (sinon TRANSITION_NOT_ALLOWED) ; titre retapé égal au titre
 *    après trim (sinon TITLE_MISMATCH) ; avis public ≥ 10 caractères et motif interne ≥ 3 ; écritures :
 *    event_cancellations (UNIQUE(event_id)), historique (canal CANCELLATION), ANNULE, refund_request par
 *    paiement en ligne et ticket_refund_request pour le reste ; renvoie { ok, cashout_ids[] }, l'envoi suit
 *    le commit ; une transition ordinaire vers ANNULE répond CANCELLATION_REQUIRED ;
 *  - routes POST /api/partner/events/[id]/cancel et /api/admin/events/[id]/cancel
 *    { publicNotice, internalReason, confirmTitle } ;
 *  - practical_info.cancellation n'est plus écrit ; la seule source est event_cancellations, et le motif
 *    interne n'est jamais public ;
 *  - event_cancellation_impact(p) → { tickets: { online, cash, free, invitations }, buyers,
 *    online_refund_total, cash_refund_total, pending_payments } ; event_cancellation_progress(p) →
 *    { paid, in_progress, verifying, to_retry (admin seul), organizer_cash: { count, total } } ;
 *  - GET /api/partner/events/[id]/cancellation → { impact | progress } : propriétaire ou admin, sinon 404 ;
 *  - confirmation d'un paiement sur un événement SUSPENDU (ou TERMINE) : refusée et remboursée.
 * Rouge avant correctif :
 *  - event_cancel, event_cancellation_impact et event_cancellation_progress n'existent pas (grep vide dans
 *    supabase/migrations), ni event_transition (création des événements par createEventInStatus) ;
 *  - l'annulation est une orchestration TS non transactionnelle qui refuse SUSPENDU
 *    (lib/events/event-cancellation.service.ts:139), avale l'erreur d'INSERT de event_cancellations
 *    (l.163-165), copie le motif interne dans practical_info.cancellation (l.168-177) ; les routes ne
 *    demandent pas le titre (app/api/partner/events/[id]/cancel/route.ts:6-9) ;
 *  - event_cancellations n'a pas d'UNIQUE(event_id) (index simple, 20260910000001…sql) ;
 *  - résumé : la propriété n'est vérifiée que pour le rôle PARTENAIRE (event-cancellation.service.ts:388),
 *    la route ne filtre aucun rôle (app/api/partner/events/[id]/cancellation/route.ts:10-21) : un client
 *    lit le résumé (IDOR), le partenaire B reçoit 403 et non 404 ; aucun avancement par cashout ;
 *  - payment_confirm ne bloque que ANNULE (supabase/migrations/20261101000003_lot3_moteur.sql:309) : un
 *    paiement confirmé après une suspension émet ses billets.
 * La suite crée ses partenaires, acheteurs, ADMIN et événements ; le faux SamirPay est remis en mode
 * « success » après chaque envoi piloté.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { anonClient, disposeClients } from '../helpers/realtime';
import { CashoutService } from '../../lib/payments/cashout.service';
import {
    cart, categoryState, checkout, deliverWebhook, eventTickets, importModule, newBuyer, paymentById, providerSays, service, setFakeMode,
    type Buyer, type CategorySpec, type PaymentRow,
} from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import {
    advanceEventTo, assertRpcOk, createEventInStatus, eventHistory, eventStatus, rpcCancel, rpcTransition,
    type DraftEvent, type DraftEventOptions, type EventHistoryRow, type EventStatus, type RpcBody, type RpcCall,
} from './cycle-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
interface Reply { status: number; body: Record<string, unknown> }
type Row = Record<string, unknown>;

const PRICE = 5000;
const VIP_PRICE = 12_000;
const CATS: CategorySpec[] = [
    { name: 'Standard', price: PRICE, total: 40 },
    { name: 'VIP', price: VIP_PRICE, total: 10 },
];

let owner: TestPartner;
let partnerB: TestPartner;
let admin: Buyer;
let superadmin: string;

before(async () => {
    setFakeMode('cashoutMode', 'success');
    owner = await newPartner('cycleannul');
    partnerB = await newPartner('cycleannulb');
    admin = await newEventsAdmin('cycleannul');
    superadmin = await superadminId();
});

after(async () => {
    setFakeMode('cashoutMode', 'success');
    await assertLifecycleInvariants('cycle-annulation');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function newEventsAdmin(label: string): Promise<Buyer> {
    const user = await newBuyer(`adm-${label}`, { firstName: 'Mame', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    for (const permission of ['events.read', 'events.write', 'refunds.manage']) {
        const { error: pErr } = await service.from('admin_permissions').upsert({ user_id: user.userId, permission }, { onConflict: 'user_id,permission' });
        assert.equal(pErr, null, `permission ${permission} : ${pErr?.message}`);
    }
    return user;
}

function eventIn(label: string, target: EventStatus, opts: DraftEventOptions = {}, categories: CategorySpec[] = CATS): Promise<DraftEvent> {
    return createEventInStatus(owner, label, categories, target, { startsInHours: 48, ...opts });
}

function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function loadHandler(rel: string, method: 'GET' | 'POST'): Promise<Handler> {
    let mod: Record<string, unknown>;
    try {
        mod = await importModule(rel);
    } catch (err) {
        assert.fail(`route ${rel} absente : ${err instanceof Error ? err.message : String(err)}`);
    }
    assert.equal(typeof mod[method], 'function', `${rel} : ${method} non exporté`);
    return mod[method] as Handler;
}

async function callRoute(handler: Handler, req: NextRequest, ctx: unknown): Promise<Reply> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Record<string, unknown>;
    try {
        body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(r: Reply): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

interface CancelBody { publicNotice: string; internalReason: string; confirmTitle: string }

function cancelBody(ev: DraftEvent, overrides: Partial<CancelBody> = {}): CancelBody {
    return {
        publicNotice: 'L’événement est annulé : chaque acheteur est remboursé automatiquement.',
        internalReason: 'Salle indisponible (test du lot 5)',
        confirmTitle: ev.title,
        ...overrides,
    };
}

async function partnerCancel(eventId: string, who: Buyer, body: CancelBody): Promise<Reply> {
    const h = await loadHandler('../../app/api/partner/events/[id]/cancel/route', 'POST');
    return callRoute(h, jsonRequest(`/api/partner/events/${eventId}/cancel`, 'POST', who.accessToken, body), routeCtx({ id: eventId }));
}

async function adminCancel(eventId: string, who: Buyer, body: CancelBody): Promise<Reply> {
    const h = await loadHandler('../../app/api/admin/events/[id]/cancel/route', 'POST');
    return callRoute(h, jsonRequest(`/api/admin/events/${eventId}/cancel`, 'POST', who.accessToken, body), routeCtx({ id: eventId }));
}

async function cancellationRead(eventId: string, who: Buyer): Promise<Reply> {
    const h = await loadHandler('../../app/api/partner/events/[id]/cancellation/route', 'GET');
    return callRoute(h, jsonRequest(`/api/partner/events/${eventId}/cancellation`, 'GET', who.accessToken), routeCtx({ id: eventId }));
}

async function cancellationsOf(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('event_cancellations').select('*').eq('event_id', eventId);
    assert.equal(error, null, `event_cancellations : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function cashoutsOf(paymentIds: string[]): Promise<Row[]> {
    const { data, error } = await service.from('cashouts').select('*').in('payment_id', paymentIds);
    assert.equal(error, null, `cashouts : ${error?.message}`);
    return (data ?? []) as Row[];
}

function lastRow(rows: EventHistoryRow[]): EventHistoryRow {
    assert.ok(rows.length > 0, 'historique vide');
    return rows[rows.length - 1];
}

function historyView(r: EventHistoryRow): Row {
    return { old: r.old_status, next: r.new_status, actor: r.actor_id, role: r.actor_role, channel: r.channel };
}

/** Rien n'a été écrit par une annulation refusée. */
async function assertNothingCancelled(eventId: string, status: EventStatus, historyLength: number, paymentIds: string[], label: string): Promise<void> {
    assert.equal(await eventStatus(eventId), status, `${label} : statut inchangé`);
    assert.deepEqual(await cancellationsOf(eventId), [], `${label} : aucune ligne event_cancellations`);
    assert.equal((await eventHistory(eventId)).length, historyLength, `${label} : aucune ligne d’historique`);
    if (paymentIds.length) assert.deepEqual(await cashoutsOf(paymentIds), [], `${label} : aucun remboursement demandé`);
    const valid = (await eventTickets(eventId)).filter((t) => t.status === 'VALIDE');
    assert.ok(valid.length > 0 || paymentIds.length === 0, `${label} : billets toujours VALIDE`);
}

/** Billet payé hors plateforme (espèces) : paiement SUCCESS non plateforme et billet VALIDE rattaché. */
async function offlineTicket(holder: Buyer, ev: DraftEvent, category: string): Promise<{ paymentId: string; ticketId: string }> {
    const cat = ev.categories[category];
    const { data: pay, error } = await service.from('payments').insert({
        transaction_id: `TX-CASH-CYCLE-${randomUUID()}`, client_id: holder.userId, partner_id: owner.partnerId, event_id: ev.eventId,
        payment_target: 'TICKET', amount: cat.price, currency: 'XOF', is_platform_payment: false,
        offline_payment_method: 'ESPECES', payment_method: 'CASH', status: 'SUCCESS', paid_at: new Date().toISOString(),
        metadata: { event_id: ev.eventId },
    }).select('id').single();
    assert.equal(error, null, `paiement espèces : ${error?.message}`);
    const ticketId = await insertTicket(holder, ev, category, { payment_id: pay.id });
    return { paymentId: pay.id as string, ticketId };
}

/** Billet VALIDE inséré directement (espèces, gratuit ou invitation), stock vendu incrémenté. */
async function insertTicket(holder: Buyer, ev: DraftEvent, category: string, extra: Row = {}): Promise<string> {
    const cat = ev.categories[category];
    const { data, error } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: holder.userId, price: cat.price, status: 'VALIDE',
        ticket_number: `TCK-CYCLE-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
        qr_code: `EV-QR-CYCLE-${randomUUID()}`,
        ...extra,
    }).select('id').single();
    assert.equal(error, null, `billet ${category} : ${error?.message}`);
    const state = await categoryState(cat.id);
    const { error: soldErr } = await service.from('ticket_categories').update({ sold_quantity: state.sold + 1 }).eq('id', cat.id);
    assert.equal(soldErr, null, `stock vendu : ${soldErr?.message}`);
    return data.id as string;
}

async function rpcJson(name: string, p: Row): Promise<RpcCall> {
    const { data, error } = await service.rpc(name, { p });
    return { data: (data ?? null) as RpcBody | null, error };
}

/** Compteur d'avancement : nombre de remboursements (ou objet { count, … }). */
function countOf(v: unknown): number {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && 'count' in v) return Number((v as { count: unknown }).count);
    return Number.NaN;
}

// ── Annulation par statut ──────────────────────────────────────────────────

describe('5.2 / 5.8 Annulation transactionnelle (event_cancel) par statut', () => {
    test('SUSPENDU → ANNULE accepté avec remboursements (route partenaire)', async () => {
        const ev = await eventIn('suspannul', 'PUBLIE');
        const b1 = await newBuyer('cyc-sa-1');
        const b2 = await newBuyer('cyc-sa-2');
        const p1 = await buyConfirmed(b1, ev, [['Standard', 1]]);
        const p2 = await buyConfirmed(b2, ev, [['Standard', 1], ['VIP', 1]], 'ORANGE_MONEY');
        await advanceEventTo(ev.eventId, 'SUSPENDU', { suspendReason: 'Contrôle de sécurité de la salle' });

        const body = cancelBody(ev);
        const r = await partnerCancel(ev.eventId, owner, body);
        assert.equal(r.status, 200, `annulation d’un événement SUSPENDU : ${show(r)}`);
        assert.equal(await eventStatus(ev.eventId), 'ANNULE');

        const rows = await cancellationsOf(ev.eventId);
        assert.equal(rows.length, 1, `une ligne event_cancellations : ${JSON.stringify(rows)}`);
        assert.equal(rows[0].cancelled_by, owner.userId, 'auteur de l’annulation');
        assert.equal(rows[0].internal_reason, body.internalReason, 'motif interne enregistré');
        assert.equal(rows[0].public_notice, body.publicNotice, 'avis public enregistré');

        assert.deepEqual(
            historyView(lastRow(await eventHistory(ev.eventId))),
            { old: 'SUSPENDU', next: 'ANNULE', actor: owner.userId, role: 'PARTENAIRE', channel: 'CANCELLATION' },
            'historique : SUSPENDU → ANNULE par le partenaire, canal CANCELLATION',
        );

        const payments = [p1.payment, p2.payment];
        const cashouts = await cashoutsOf(payments.map((p) => p.id));
        assert.equal(cashouts.length, 2, `un remboursement par paiement en ligne : ${JSON.stringify(cashouts)}`);
        for (const p of payments) {
            const c = cashouts.find((x) => x.payment_id === p.id);
            assert.ok(c, `remboursement du paiement ${p.id}`);
            assert.equal(c.idempotency_key, `REFUND-${p.id}`);
            assert.equal(Number(c.amount), Number(p.amount), 'remboursement du total payé par le client');
        }
        const stillValid = (await eventTickets(ev.eventId)).filter((t) => t.status === 'VALIDE');
        assert.deepEqual(stillValid.map((t) => t.id), [], 'plus aucun billet VALIDE');
    });

    test('PUBLIE → ANNULE (route partenaire, titre retapé avec des espaces) et VALIDE → ANNULE (route admin)', async () => {
        const pub = await eventIn('pubannul', 'PUBLIE');
        const r1 = await partnerCancel(pub.eventId, owner, cancelBody(pub, { confirmTitle: `  ${pub.title}  ` }));
        assert.equal(r1.status, 200, `annulation d’un événement PUBLIE : ${show(r1)}`);
        assert.equal(await eventStatus(pub.eventId), 'ANNULE');
        assert.deepEqual(
            historyView(lastRow(await eventHistory(pub.eventId))),
            { old: 'PUBLIE', next: 'ANNULE', actor: owner.userId, role: 'PARTENAIRE', channel: 'CANCELLATION' },
        );

        const val = await eventIn('valannul', 'VALIDE');
        const r2 = await adminCancel(val.eventId, admin, cancelBody(val));
        assert.equal(r2.status, 200, `annulation d’un événement VALIDE par l’admin : ${show(r2)}`);
        assert.equal(await eventStatus(val.eventId), 'ANNULE');
        assert.deepEqual(
            historyView(lastRow(await eventHistory(val.eventId))),
            { old: 'VALIDE', next: 'ANNULE', actor: admin.userId, role: 'ADMIN', channel: 'CANCELLATION' },
        );
        assert.equal((await cancellationsOf(val.eventId))[0]?.cancelled_by, admin.userId, 'annulation enregistrée au nom de l’admin');
    });

    test('titre retapé faux → TITLE_MISMATCH, rien d’écrit ; avis public ou motif interne trop courts refusés', async () => {
        const ev = await eventIn('titre', 'PUBLIE');
        const buyer = await newBuyer('cyc-titre');
        const sale = await buyConfirmed(buyer, ev, [['Standard', 1]]);
        const historyLength = (await eventHistory(ev.eventId)).length;
        const paymentIds = [sale.payment.id];

        for (const [label, confirmTitle] of [['titre suivi d’un mot', `${ev.title} X`], ['titre en majuscules', ev.title.toUpperCase()], ['titre vide', '']]) {
            const call = await rpcCancel(ev.eventId, owner.userId, cancelBody(ev, { confirmTitle }));
            assert.equal(call.error, null, `${label} : refus métier attendu : ${call.error?.message}`);
            assert.equal(call.data?.ok, false, `${label} : refus attendu, reçu ${JSON.stringify(call.data)}`);
            assert.equal(call.data?.code, 'TITLE_MISMATCH', `${label} : ${JSON.stringify(call.data)}`);
            await assertNothingCancelled(ev.eventId, 'PUBLIE', historyLength, paymentIds, label);
        }
        const r = await partnerCancel(ev.eventId, owner, cancelBody(ev, { confirmTitle: 'Un autre titre' }));
        assert.equal(r.status, 400, `route partenaire, titre faux : ${show(r)}`);
        assert.equal(r.body.code, 'TITLE_MISMATCH', show(r));
        await assertNothingCancelled(ev.eventId, 'PUBLIE', historyLength, paymentIds, 'route, titre faux');

        for (const [label, overrides] of [
            ['avis public de 6 caractères', { publicNotice: 'Annulé' }],
            ['motif interne de 2 caractères', { internalReason: 'ab' }],
        ] as Array<[string, Partial<CancelBody>]>) {
            const call = await rpcCancel(ev.eventId, owner.userId, cancelBody(ev, overrides));
            assert.ok(!(call.error === null && call.data?.ok === true), `${label} : annulation acceptée ${JSON.stringify(call.data)}`);
            await assertNothingCancelled(ev.eventId, 'PUBLIE', historyLength, paymentIds, label);
        }
    });

    test('ANNULE par event_transition → CANCELLATION_REQUIRED (RPC et route), rien d’écrit', async () => {
        const ev = await eventIn('transannul', 'PUBLIE');
        const historyLength = (await eventHistory(ev.eventId)).length;
        for (const [label, actor, reason] of [['partenaire', owner.userId, undefined], ['SUPERADMIN', superadmin, 'Motif de test']] as Array<[string, string, string | undefined]>) {
            const call = await rpcTransition(ev.eventId, actor, 'ANNULE', reason);
            assert.equal(call.error, null, `${label} : refus métier attendu : ${call.error?.message}`);
            assert.equal(call.data?.ok, false, `${label} : ${JSON.stringify(call.data)}`);
            assert.equal(call.data?.code, 'CANCELLATION_REQUIRED', `${label} : ${JSON.stringify(call.data)}`);
        }
        const h = await loadHandler('../../app/api/partner/events/[id]/transition/route', 'POST');
        const r = await callRoute(h, jsonRequest(`/api/partner/events/${ev.eventId}/transition`, 'POST', owner.accessToken, { to: 'ANNULE' }), routeCtx({ id: ev.eventId }));
        assert.ok(r.status >= 400 && r.status < 500, `route partenaire → ANNULE : ${show(r)}`);
        assert.equal(r.body.code, 'CANCELLATION_REQUIRED', show(r));
        await assertNothingCancelled(ev.eventId, 'PUBLIE', historyLength, [], 'transition vers ANNULE');
    });

    test('une seule annulation : deux annulations simultanées → une seule acceptée ; UNIQUE(event_id) en base', async () => {
        const ev = await eventIn('double', 'PUBLIE');
        const input = cancelBody(ev);
        const calls = await Promise.all([rpcCancel(ev.eventId, owner.userId, input), rpcCancel(ev.eventId, superadmin, input)]);
        const accepted = calls.filter((c) => c.error === null && c.data?.ok === true);
        assert.equal(accepted.length, 1, `une seule annulation acceptée : ${JSON.stringify(calls)}`);
        const refused = calls.find((c) => !(c.error === null && c.data?.ok === true));
        assert.ok(refused, 'une annulation refusée');
        assert.equal(refused.error, null, `refus métier (verrou puis statut), pas une erreur Postgres : ${refused.error?.message}`);
        assert.equal(refused.data?.code, 'TRANSITION_NOT_ALLOWED', JSON.stringify(refused.data));

        assert.equal((await cancellationsOf(ev.eventId)).length, 1, 'une seule ligne event_cancellations');
        const cancellations = (await eventHistory(ev.eventId)).filter((r) => r.channel === 'CANCELLATION');
        assert.equal(cancellations.length, 1, `une seule ligne d’historique CANCELLATION : ${JSON.stringify(cancellations)}`);

        const again = await rpcCancel(ev.eventId, owner.userId, input);
        assert.equal(again.data?.code, 'TRANSITION_NOT_ALLOWED', `seconde annulation : ${JSON.stringify(again)}`);

        const unique = await inspect(async (db) => (await db.query<{ n: number }>(
            `SELECT count(*)::int AS n
               FROM pg_index i
               JOIN pg_class c ON c.oid = i.indrelid
               JOIN pg_namespace ns ON ns.oid = c.relnamespace
               JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = i.indkey[0]
              WHERE ns.nspname = 'public' AND c.relname = 'event_cancellations'
                AND i.indisunique AND i.indnkeyatts = 1 AND i.indpred IS NULL AND a.attname = 'event_id'`)).rows[0].n);
        assert.equal(unique, 1, 'index UNIQUE(event_id) sur event_cancellations');
    });

    test('practical_info.cancellation n’est plus écrit ; le motif interne reste dans event_cancellations et n’est jamais public', async () => {
        const ev = await eventIn('motifinterne', 'PUBLIE');
        const SECRET = `Litige avec le prestataire son ${randomUUID()}`;
        const r = await partnerCancel(ev.eventId, owner, cancelBody(ev, { internalReason: SECRET }));
        assert.equal(r.status, 200, `annulation : ${show(r)}`);
        assert.ok(!JSON.stringify(r.body).includes(SECRET), `réponse de la route sans le motif interne : ${show(r)}`);

        const { data: row, error } = await service.from('events').select('practical_info, description, title').eq('id', ev.eventId).single();
        assert.equal(error, null, error?.message);
        const info = (row.practical_info ?? {}) as Row;
        assert.equal(info.cancellation, undefined, `practical_info.cancellation écrit : ${JSON.stringify(info)}`);
        assert.ok(!JSON.stringify(row).includes(SECRET), 'aucune colonne de events ne porte le motif interne');
        assert.equal((await cancellationsOf(ev.eventId))[0]?.internal_reason, SECRET, 'motif interne dans event_cancellations');

        const publicRoute = await loadHandler('../../app/api/events/[id]/route', 'GET');
        const pub = await callRoute(publicRoute, jsonRequest(`/api/events/${ev.eventId}`, 'GET', null), routeCtx({ id: ev.eventId }));
        assert.equal(pub.status, 200, `fiche publique d’un événement annulé : ${show(pub)}`);
        assert.ok(!JSON.stringify(pub.body).includes(SECRET), 'fiche publique sans le motif interne');

        const anon = anonClient();
        try {
            const a = await anon.from('events').select('*').eq('id', ev.eventId);
            assert.ok(!JSON.stringify(a.data ?? []).includes(SECRET), 'lecture anon de events sans le motif interne');
            const c = await anon.from('event_cancellations').select('*').eq('event_id', ev.eventId);
            assert.deepEqual(c.data ?? [], [], `event_cancellations illisible par anon : ${JSON.stringify(c)}`);
        } finally {
            await disposeClients(anon);
        }
    });
});

// ── Impact et avancement (jeu connu) ───────────────────────────────────────

describe('5.8 Impact et avancement des remboursements', () => {
    let ev: DraftEvent;
    let online: Array<{ buyer: Buyer; payment: PaymentRow }>;

    before(async () => {
        ev = await eventIn('impact', 'PUBLIE', {}, [
            { name: 'Standard', price: PRICE, total: 40 },
            { name: 'VIP', price: VIP_PRICE, total: 10 },
            { name: 'Gratuit', price: 0, total: 10 },
            { name: 'Invitation', price: 0, total: 10 },
        ]);
        const b1 = await newBuyer('cyc-imp-1');
        const b2 = await newBuyer('cyc-imp-2');
        const b3 = await newBuyer('cyc-imp-3');
        const b4 = await newBuyer('cyc-imp-4');
        online = [
            { buyer: b1, payment: (await buyConfirmed(b1, ev, [['Standard', 1]])).payment },
            { buyer: b2, payment: (await buyConfirmed(b2, ev, [['Standard', 2]], 'ORANGE_MONEY')).payment },
            { buyer: b3, payment: (await buyConfirmed(b3, ev, [['VIP', 1]])).payment },
            { buyer: b4, payment: (await buyConfirmed(b4, ev, [['Standard', 1]])).payment },
        ];
        // Les autres billets sont portés par les mêmes acheteurs : 4 acheteurs distincts quelle que soit la lecture.
        await offlineTicket(b1, ev, 'Standard');
        await insertTicket(b2, ev, 'Gratuit', { sale_channel: 'FREE' });
        await insertTicket(b3, ev, 'Invitation', { sale_channel: 'INVITATION' });
        const pending = await checkout(b4, cart(ev.eventId, [[ev.categories.Standard.id, 1]], b4));
        assert.equal(pending.status, 200, `paiement en attente : HTTP ${pending.status} ${JSON.stringify(pending.body)}`);
        assert.equal(pending.payment?.status, 'PENDING', 'paiement laissé en attente (aucun webhook)');
    });

    test('impact exact sur un jeu connu : 5 billets en ligne, 1 espèces, 1 gratuit, 1 invitation, 4 acheteurs, montants', async () => {
        const want = {
            online: 5, cash: 1, free: 1, invitations: 1, buyers: 4,
            online_refund_total: online.reduce((s, o) => s + Number(o.payment.amount), 0),
            cash_refund_total: PRICE,
            pending_payments: 1,
        };
        const view = (x: Row): Row => {
            const t = (x.tickets ?? {}) as Row;
            return {
                online: Number(t.online), cash: Number(t.cash), free: Number(t.free), invitations: Number(t.invitations), buyers: Number(x.buyers),
                online_refund_total: Number(x.online_refund_total), cash_refund_total: Number(x.cash_refund_total), pending_payments: Number(x.pending_payments),
            };
        };
        const impact = assertRpcOk(await rpcJson('event_cancellation_impact', { event_id: ev.eventId, actor_id: owner.userId }), 'event_cancellation_impact (propriétaire)');
        assert.deepEqual(view(impact), want, `impact : ${JSON.stringify(impact)}`);

        const r = await cancellationRead(ev.eventId, owner);
        assert.equal(r.status, 200, `lecture de l’impact par le propriétaire : ${show(r)}`);
        assert.ok(r.body.impact && typeof r.body.impact === 'object', `{ impact } avant l’annulation : ${show(r)}`);
        assert.deepEqual(view(r.body.impact as Row), want, `impact servi par la route : ${show(r)}`);
        assert.equal(await eventStatus(ev.eventId), 'PUBLIE', 'la lecture de l’impact n’annule rien');
    });

    test('avancement : versés, en cours, en vérification ; « à reprendre » pour l’admin seul ; espèces de l’organisateur', async () => {
        const cancelled = assertRpcOk(await rpcCancel(ev.eventId, owner.userId, cancelBody(ev)), 'event_cancel (sans envoi : les cashouts suivent le commit)');
        assert.ok(Array.isArray(cancelled.cashout_ids) && cancelled.cashout_ids.length === 4, `cashout_ids des 4 paiements en ligne : ${JSON.stringify(cancelled)}`);
        const rows = await cashoutsOf(online.map((o) => o.payment.id));
        assert.equal(rows.length, 4, `4 remboursements : ${JSON.stringify(rows)}`);
        assert.ok(rows.every((c) => c.status === 'A_ENVOYER'), `aucun envoi dans la transaction : ${JSON.stringify(rows.map((c) => c.status))}`);
        const cashoutOf = (i: number): string => {
            const c = rows.find((x) => x.payment_id === online[i].payment.id);
            assert.ok(c, `remboursement du paiement en ligne n° ${i + 1}`);
            return String(c.id);
        };

        // Envois pilotés un par un par le module de cashout (faux SamirPay)
        const modes: Array<[number, string, string]> = [[0, 'success', 'CONFIRME'], [1, 'pending', 'ENVOYE'], [2, 'timeout-after-send', 'INCERTAIN'], [3, 'rejected', 'ECHOUE']];
        try {
            for (const [i, mode] of modes) {
                setFakeMode('cashoutMode', mode);
                await CashoutService.send(cashoutOf(i));
            }
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        const after1 = await cashoutsOf(online.map((o) => o.payment.id));
        for (const [i, , status] of modes) {
            assert.equal(after1.find((c) => c.id === cashoutOf(i))?.status, status, `cashout ${i + 1} : ${status}`);
        }

        const view = (x: Row, withRetry: boolean): Row => {
            const cash = (x.organizer_cash ?? {}) as Row;
            const out: Row = {
                paid: countOf(x.paid), in_progress: countOf(x.in_progress), verifying: countOf(x.verifying),
                organizer_cash: { count: Number(cash.count), total: Number(cash.total) },
            };
            if (withRetry) out.to_retry = countOf(x.to_retry);
            return out;
        };
        const base = { paid: 1, in_progress: 1, verifying: 1, organizer_cash: { count: 1, total: PRICE } };

        const asAdmin = assertRpcOk(await rpcJson('event_cancellation_progress', { event_id: ev.eventId, actor_id: admin.userId }), 'avancement (admin)');
        assert.deepEqual(view(asAdmin, true), { ...base, to_retry: 1 }, `avancement vu par l’admin : ${JSON.stringify(asAdmin)}`);
        const asOwner = assertRpcOk(await rpcJson('event_cancellation_progress', { event_id: ev.eventId, actor_id: owner.userId }), 'avancement (propriétaire)');
        assert.deepEqual(view(asOwner, false), base, `avancement vu par le propriétaire : ${JSON.stringify(asOwner)}`);
        assert.equal(asOwner.to_retry, undefined, `« à reprendre » réservé à l’admin : ${JSON.stringify(asOwner)}`);

        const r1 = await cancellationRead(ev.eventId, owner);
        assert.equal(r1.status, 200, `lecture de l’avancement par le propriétaire : ${show(r1)}`);
        assert.ok(r1.body.progress && typeof r1.body.progress === 'object', `{ progress } après l’annulation : ${show(r1)}`);
        assert.deepEqual(view(r1.body.progress as Row, false), base, show(r1));
        assert.equal((r1.body.progress as Row).to_retry, undefined, `route : « à reprendre » masqué au partenaire : ${show(r1)}`);
        const r2 = await cancellationRead(ev.eventId, admin);
        assert.equal(r2.status, 200, `lecture de l’avancement par l’admin : ${show(r2)}`);
        assert.deepEqual(view(r2.body.progress as Row, true), { ...base, to_retry: 1 }, show(r2));
    });
});

// ── A6 : lecture réservée ──────────────────────────────────────────────────

describe('A6 Lecture de l’impact et de l’avancement réservée au propriétaire et aux admins', () => {
    test('GET /api/partner/events/[id]/cancellation : 404 pour un client et pour le partenaire B ; 200 pour le propriétaire et l’admin', async () => {
        const ev = await eventIn('a6', 'PUBLIE');
        const client = await newBuyer('cyc-a6');
        for (const [label, who] of [['client', client], ['partenaire B', partnerB]] as Array<[string, Buyer]>) {
            const r = await cancellationRead(ev.eventId, who);
            assert.equal(r.status, 404, `${label} : 404 attendu, ${show(r)}`);
            assert.equal(r.body.impact, undefined, `${label} : aucun impact servi`);
            assert.equal(r.body.progress, undefined, `${label} : aucun avancement servi`);
            const rpc = await rpcJson('event_cancellation_impact', { event_id: ev.eventId, actor_id: who.userId });
            assert.ok(!(rpc.error === null && rpc.data?.ok === true), `${label} : event_cancellation_impact accepté ${JSON.stringify(rpc.data)}`);
            assert.equal(rpc.data?.tickets, undefined, `${label} : aucun chiffre rendu par la RPC`);
        }
        const mine = await cancellationRead(ev.eventId, owner);
        assert.equal(mine.status, 200, `propriétaire : ${show(mine)}`);
        const adm = await cancellationRead(ev.eventId, admin);
        assert.equal(adm.status, 200, `admin : ${show(adm)}`);
    });
});

// ── D6 : confirmation après suspension ou fin ──────────────────────────────

describe('D6 Paiement confirmé sur un événement suspendu ou terminé', () => {
    async function confirmAfter(ev: DraftEvent, label: string, move: () => Promise<unknown>): Promise<void> {
        const buyer = await newBuyer(`cyc-conf-${label}`);
        const res = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        assert.equal(res.status, 200, `${label} : checkout ${JSON.stringify(res.body)}`);
        const payment = res.payment!;
        await move();
        providerSays(payment, 'SUCCESS');
        const hook = await deliverWebhook(payment);
        assert.ok(hook.status < 500, `${label} : webhook HTTP ${hook.status}`);
        const mine = (await eventTickets(ev.eventId)).filter((t) => t.user_id === buyer.userId);
        assert.deepEqual(mine.map((t) => t.status), [], `${label} : aucun billet émis`);
        const p = await paymentById(payment.id);
        assert.ok(['REFUND_PENDING', 'REFUNDED'].includes(p.status), `${label} : paiement remboursé, statut ${p.status}`);
        const cashouts = await cashoutsOf([payment.id]);
        assert.equal(cashouts.length, 1, `${label} : un remboursement : ${JSON.stringify(cashouts)}`);
        assert.equal(cashouts[0].idempotency_key, `REFUND-${payment.id}`);
        assert.equal(Number(cashouts[0].amount), Number(payment.amount), `${label} : montant payé remboursé`);
    }

    test('paiement confirmé après la suspension de l’événement → refusé et remboursé', async () => {
        const ev = await eventIn('confsusp', 'PUBLIE');
        await confirmAfter(ev, 'suspension', () => advanceEventTo(ev.eventId, 'SUSPENDU', { suspendReason: 'Contrôle de sécurité' }));
        assert.equal(await eventStatus(ev.eventId), 'SUSPENDU');
    });

    test('paiement confirmé après la fin manuelle (TERMINE) → refusé et remboursé', async () => {
        const ev = await eventIn('conftermine', 'PUBLIE', { startsInHours: -1 });
        await confirmAfter(ev, 'fin', async () => assertRpcOk(await rpcTransition(ev.eventId, superadmin, 'TERMINE'), 'fin manuelle'));
        assert.equal(await eventStatus(ev.eventId), 'TERMINE');
    });
});
