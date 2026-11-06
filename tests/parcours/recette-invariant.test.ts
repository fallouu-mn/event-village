/**
 * Lot 8, tâche 8.2 d — invariants (r) et (s) (contrat 14.2 et 14.3, L39, L40 ; écrivain W3 ; (t) :
 * canaux-invariant.test.ts). Modèle finance-invariant.test.ts : dans une transaction annulée, chaque règle détecte
 * une violation fabriquée exprès, à côté d'un témoin qui n'en est pas une (sinon un invariant toujours vide, ou
 * toujours plein, ne prouverait rien). Après ROLLBACK, aucune ligne fabriquée ne reste.
 *
 * Fabrication (contrat 14.3) : INSERT payments en partner_id nul (pas de crédit VENTE par le trigger) ;
 * stock_reservations au statut CONVERTED (held_quantity intact) ; catégorie et événement réels ; instants écrits
 * comme données. Acheteurs neufs, sans parrain : aucune commission réelle ne se mêle aux lignes fabriquées.
 *
 * Écart au contrat, signalé : le cas « net NULL » exige de lever NOT NULL sur payments.net_event_village_revenue
 * dans la transaction annulée (0001_initial_schema.sql:534, jamais levé depuis). La colonne n'est pas publiée en
 * temps réel (payments est retirée de supabase_realtime au lot 5) ; (r) reste fail-closed si la contrainte tombe.
 *
 * Rouge avant correctif : tous les cas, par recetteViolations, qui contrôle le schéma d'abord : l'échec nomme
 * chaque objet absent du lot 8 (colonnes, triggers, payment_duplicate_of), jamais une erreur Postgres brute.
 * Passe au vert quand M1, M3 et M4 sont livrés (section 18.2). 8.2 d n'a pas de correctif propre.
 * Vert dès l'écriture : aucun.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction } from '../helpers/db';
import { assertRecetteInvariants, recetteViolations, type RecetteViolation } from '../helpers/recette-invariants';
import { createSaleEvent, newBuyer, type Buyer, type SaleEvent } from './paiement-helpers';

let ev: SaleEvent;
let buyer: Buyer;
let otherBuyer: Buyer;
let sponsor: Buyer;
/** Identifiants fabriqués dans les transactions annulées : le dernier cas vérifie qu'aucun ne survit. */
const fabricated = new Set<string>();

before(async () => {
    ev = await createSaleEvent('recette-invariant', [
        { name: 'Standard', price: 1_000, total: 50 },
        { name: 'VIP', price: 5_000, total: 50 },
    ]);
    buyer = await newBuyer('recette-inv', { firstName: 'Khady', lastName: 'Acheteuse' });
    otherBuyer = await newBuyer('recette-inv-autre', { firstName: 'Awa', lastName: 'Autre' });
    sponsor = await newBuyer('recette-inv-parrain', { firstName: 'Ibrahima', lastName: 'Parrain' });
});

after(async () => {
    await assertRecetteInvariants('recette-invariant');
});

// ── Fabrication ────────────────────────────────────────────────────────────

const T0 = Date.parse('2026-06-01T10:00:00Z');
const at = (minutes: number): string => new Date(T0 + minutes * 60_000).toISOString();

interface PaymentSpec {
    client?: string;
    status?: string;
    net?: number | null;
    refundedNet?: number;
    createdAt?: string;
    paidAt?: string | null;
    metadata?: Record<string, unknown>;
}

async function insertPayment(db: Client, spec: PaymentSpec = {}): Promise<string> {
    const id = randomUUID();
    fabricated.add(id);
    await db.query(
        `INSERT INTO public.payments (id, transaction_id, client_id, event_id, payment_target, amount, status, is_platform_payment,
                                      facial_amount, service_fee, aggregator_fee, net_event_village_revenue, partner_payout_amount,
                                      refunded_net_revenue, operator, payer_phone, created_at, paid_at, metadata)
         VALUES ($1, $2, $3, $4, 'TICKET', 1050, $5, true, 1000, 50, 15.75, $6, 1000, $7, 'WAVE', $8, $9, $10, $11::jsonb)`,
        [id, `TX-RECETTE-${id}`, spec.client ?? buyer.userId, ev.eventId, spec.status ?? 'SUCCESS', spec.net === undefined ? 34.25 : spec.net,
            spec.refundedNet ?? 0, buyer.phone9, spec.createdAt ?? at(0), spec.paidAt === undefined ? at(10) : spec.paidAt, JSON.stringify(spec.metadata ?? {})]);
    return id;
}

async function reserve(db: Client, paymentId: string, category: 'Standard' | 'VIP' = 'Standard', quantity = 1): Promise<void> {
    await db.query(
        `INSERT INTO public.stock_reservations (payment_id, category_id, quantity, unit_price, unit_service_fee, expires_at, status, closed_at, close_reason)
         VALUES ($1, $2, $3, 1000, 50, $4, 'CONVERTED', $4, 'CONFIRMED')`,
        [paymentId, ev.categories[category].id, quantity, at(15)]);
}

async function insertCommission(db: Client, paymentId: string, amount: number, status = 'PENDING'): Promise<void> {
    await db.query(
        `INSERT INTO public.referral_commissions (sponsor_id, referred_id, generation, referral_type, payment_id, eligible_net_revenue,
                                                  commission_rate, amount, status, idempotency_key, available_at)
         VALUES ($1, $2, 'N1', 'CLIENT_TO_CLIENT', $3, 34.25, 5, $4, $5, $6, now())`,
        [sponsor.userId, buyer.userId, paymentId, amount, status, `RECETTE-INV-${randomUUID()}`]);
}

/** Paiement marqué en double, conforme : REFUND_PENDING, remboursement du total par la RPC réelle, sans billet ni crédit. */
async function conformingDuplicate(db: Client, status = 'REFUND_PENDING'): Promise<string> {
    const id = await insertPayment(db, { status, metadata: { duplicate_of: randomUUID() } });
    await reserve(db, id);
    await db.query(`SELECT public.refund_request($1::uuid, 'Paiement en double du même panier', 'REFUND')`, [id]);
    return id;
}

const onObject = (rows: RecetteViolation[], regle: string, objet: string): RecetteViolation[] => rows.filter((r) => r.regle === regle && r.objet === objet);

/** Objet d'une ligne s1 : `<plus petit id>/<plus grand id>`. */
const pair = (a: string, b: string): string => [a, b].sort().join('/');

// ── (r) ────────────────────────────────────────────────────────────────────

describe('Invariant (r) : commissions et revenu net', () => {
    test('r1 : commission 40 sur un net de 34,25 détectée ; annulée, elle ne compte plus ; net −15 sans commission : aucune ligne', async () => {
        const { over, cancelled, negative, rows } = await inRolledBackTransaction(async (db) => {
            const a = await insertPayment(db);
            await insertCommission(db, a, 40);
            const b = await insertPayment(db);
            await insertCommission(db, b, 40, 'CANCELLED');
            const c = await insertPayment(db, { net: -15 });
            return { over: a, cancelled: b, negative: c, rows: await recetteViolations(db) };
        });
        // Une commission de 40 dépasse aussi le net effectif : r1 et r2 sortent toutes les deux
        assert.ok(onObject(rows, 'r', over).some((r) => /^commissions 40(\.00)? > revenu net 34\.25$/.test(r.detail)),
            `(r) détecte le dépassement : ${JSON.stringify(rows.filter((r) => r.regle === 'r'))}`);
        assert.deepEqual(onObject(rows, 'r', cancelled), [], 'témoin : commission annulée');
        assert.deepEqual(onObject(rows, 'r', negative), [], 'témoin : net négatif sans commission (L39)');
    });

    test('r1 : net NULL avec une commission : violation, jamais une comparaison silencieuse', async () => {
        const { id, rows } = await inRolledBackTransaction(async (db) => {
            await db.query('ALTER TABLE public.payments ALTER COLUMN net_event_village_revenue DROP NOT NULL');
            const p = await insertPayment(db, { net: null });
            await insertCommission(db, p, 1);
            return { id: p, rows: await recetteViolations(db) };
        });
        // GREATEST ignore NULL : r2 sort aussi (commission restante > 0)
        assert.ok(onObject(rows, 'r', id).some((r) => /^commissions 1(\.00)? > revenu net $/.test(r.detail)),
            `(r) détecte le net NULL : ${JSON.stringify(rows.filter((r) => r.regle === 'r'))}`);
    });

    test('r2 : net 34,25, 30 remboursés : commission 5 détectée, commission 4 acceptée', async () => {
        const { over, within, rows } = await inRolledBackTransaction(async (db) => {
            const a = await insertPayment(db, { refundedNet: 30 });
            await insertCommission(db, a, 5);
            const b = await insertPayment(db, { refundedNet: 30 });
            await insertCommission(db, b, 4);
            return { over: a, within: b, rows: await recetteViolations(db) };
        });
        const hit = onObject(rows, 'r', over);
        assert.equal(hit.length, 1, `(r) détecte le dépassement du net effectif : ${JSON.stringify(rows.filter((r) => r.regle === 'r'))}`);
        assert.match(hit[0].detail, /^commissions restantes 5(\.00)? > net effectif 4\.25$/, `détail de r2 : ${hit[0].detail}`);
        assert.deepEqual(onObject(rows, 'r', within), [], 'témoin : commission 4 sur un net effectif de 4,25');
    });
});

// ── (s) ────────────────────────────────────────────────────────────────────

describe('Invariant (s) : aucun paiement réussi en double non remboursé', () => {
    test('s1 : deux SUCCESS, même panier, périodes recoupées, détectés ; rachat, panier différent, autre compte et second remboursé : aucune ligne', async () => {
        const ids = await inRolledBackTransaction(async (db) => {
            const keptPair = async (a: PaymentSpec, b: PaymentSpec, cb: (x: string, y: string) => Promise<void>): Promise<[string, string]> => {
                const x = await insertPayment(db, a);
                const y = await insertPayment(db, b);
                await cb(x, y);
                return [x, y];
            };
            const sameBasket = async (x: string, y: string): Promise<void> => {
                await reserve(db, x, 'Standard', 2);
                await reserve(db, x, 'VIP', 1);
                await reserve(db, y, 'VIP', 1);
                await reserve(db, y, 'Standard', 2);
            };
            const overlap = await keptPair({ createdAt: at(0), paidAt: at(10) }, { createdAt: at(5), paidAt: at(15) }, sameBasket);
            const rebuy = await keptPair({ createdAt: at(100), paidAt: at(110) }, { createdAt: at(120), paidAt: at(130) }, sameBasket);
            const otherCart = await keptPair({ createdAt: at(200), paidAt: at(210) }, { createdAt: at(205), paidAt: at(215) }, async (x, y) => {
                await reserve(db, x, 'Standard', 1);
                await reserve(db, y, 'Standard', 2);
            });
            const otherAccount = await keptPair({ createdAt: at(300), paidAt: at(310) }, { client: otherBuyer.userId, createdAt: at(305), paidAt: at(315) }, sameBasket);
            const refunded = await keptPair({ createdAt: at(400), paidAt: at(410) }, { status: 'REFUNDED', createdAt: at(405), paidAt: at(415) }, sameBasket);
            return { overlap, rebuy, otherCart, otherAccount, refunded, rows: await recetteViolations(db) };
        });
        const s = ids.rows.filter((r) => r.regle === 's');
        assert.deepEqual(onObject(s, 's', pair(...ids.overlap)).map((r) => r.detail), ['deux paiements conservés pour le même panier'], `(s) détecte le doublon : ${JSON.stringify(s)}`);
        for (const [label, p] of [['rachat après confirmation', ids.rebuy], ['panier différent', ids.otherCart], ['autre compte', ids.otherAccount], ['second REFUNDED', ids.refunded]] as const) {
            assert.deepEqual(onObject(s, 's', pair(...p)), [], `témoin : ${label}`);
        }
    });

    test('s2 : paiement en double REFUND_PENDING conforme : aucune ligne (témoin) ; REFUNDED aussi', async () => {
        const { pending, refunded, rows } = await inRolledBackTransaction(async (db) => {
            const a = await conformingDuplicate(db);
            const b = await conformingDuplicate(db, 'REFUNDED');
            return { pending: a, refunded: b, rows: await recetteViolations(db) };
        });
        assert.deepEqual(onObject(rows, 's', pending), [], 'REFUND_PENDING conforme');
        assert.deepEqual(onObject(rows, 's', refunded), [], 'REFUNDED conforme');
    });

    test('s2 : paiement en double au statut SUCCESS détecté', async () => {
        const { id, rows } = await inRolledBackTransaction(async (db) => {
            const p = await conformingDuplicate(db, 'SUCCESS');
            return { id: p, rows: await recetteViolations(db) };
        });
        assert.deepEqual(onObject(rows, 's', id).map((r) => r.detail), ['paiement en double au statut SUCCESS'], `(s) : ${JSON.stringify(rows.filter((r) => r.regle === 's'))}`);
    });

    test('s2 : paiement en double avec un billet détecté', async () => {
        const { id, rows } = await inRolledBackTransaction(async (db) => {
            const p = await conformingDuplicate(db);
            await db.query(
                `INSERT INTO public.tickets (event_id, category_id, user_id, payment_id, ticket_number, price, service_fee, qr_code, status)
                 VALUES ($1, $2, $3, $4, $5, 1000, 50, $6, 'REMBOURSEMENT_EN_COURS')`,
                [ev.eventId, ev.categories.Standard.id, buyer.userId, p, `TCK-RECETTE-${randomUUID().slice(0, 12).toUpperCase()}`, `EV-QR-${randomUUID().replace(/-/g, '')}`]);
            return { id: p, rows: await recetteViolations(db) };
        });
        assert.deepEqual(onObject(rows, 's', id).map((r) => r.detail), ['paiement en double avec billets'], `(s) : ${JSON.stringify(rows.filter((r) => r.regle === 's'))}`);
    });

    test('s2 : paiement en double sans remboursement du total détecté', async () => {
        const { id, rows } = await inRolledBackTransaction(async (db) => {
            const p = await insertPayment(db, { status: 'REFUND_PENDING', metadata: { duplicate_of: randomUUID() } });
            return { id: p, rows: await recetteViolations(db) };
        });
        assert.deepEqual(onObject(rows, 's', id).map((r) => r.detail), ['paiement en double sans remboursement du total'], `(s) : ${JSON.stringify(rows.filter((r) => r.regle === 's'))}`);
    });

    test('s2 : paiement en double crédité détecté, par une VENTE au grand livre ou par une commission non annulée', async () => {
        const { sale, commission, rows } = await inRolledBackTransaction(async (db) => {
            const a = await conformingDuplicate(db);
            await db.query(
                `INSERT INTO public.finance_ledger (owner_id, account_kind, entry_type, amount, available_at, source_key, description)
                 VALUES ($1, 'ORGANISATEUR', 'VENTE', 1000, now(), $2, 'violation fabriquée')`,
                [sponsor.userId, `VENTE-${a}`]);
            const b = await conformingDuplicate(db);
            await insertCommission(db, b, 1);
            return { sale: a, commission: b, rows: await recetteViolations(db) };
        });
        assert.deepEqual(onObject(rows, 's', sale).map((r) => r.detail), ['paiement en double crédité'], `(s) VENTE : ${JSON.stringify(rows.filter((r) => r.regle === 's'))}`);
        assert.deepEqual(onObject(rows, 's', commission).map((r) => r.detail), ['paiement en double crédité'], `(s) commission : ${JSON.stringify(rows.filter((r) => r.regle === 's'))}`);
    });
});

// ── Après ROLLBACK ─────────────────────────────────────────────────────────

describe('Invariants (r)(s) après annulation des transactions', () => {
    test('aucune ligne fabriquée ne reste dans recetteViolations()', async () => {
        assert.ok(fabricated.size > 0, 'les cas précédents ont fabriqué des paiements');
        const rows = await recetteViolations();
        const left = rows.filter((r) => r.objet.split('/').some((id) => fabricated.has(id)));
        assert.deepEqual(left, [], 'ligne fabriquée après ROLLBACK');
    });
});
