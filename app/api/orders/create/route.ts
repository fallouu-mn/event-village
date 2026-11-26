import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, requireVerifiedPhone } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';
import { fcfa, invalidBody, orderInput, orderRefusal, orderStateLabel, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/** Clé d'idempotence (en-tête Idempotency-Key), même forme que l'achat de billets et de tables. */
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

/** Montant affiché par l'écran (comparaison seulement) : entier positif, sinon ignoré. */
function shownAmount(v: unknown): number | null {
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100_000_000 ? v : null;
}

/**
 * POST /api/orders/create { venueId, mode, payment?, items: [{ productId, quantity, optionIds?, notes? }], zoneId?,
 * address?, phone?, onsiteTableId?, onsiteLabel?, scheduledFor?, notes?, expectedTotal?, expectedToPay? }
 * En-tête facultatif Idempotency-Key (8 à 128 caractères).
 * Lot 4.0 : session ACTIVE obligatoire ; le client est toujours le compte de la session.
 * Lot 12a : une seule fonction en base, order_create, fait tout sous le verrou de l'établissement puis du client :
 * établissement validé et ouvert à la vente, partenaire VALIDE, produits de cet établissement, jamais réglementés,
 * prix et suppléments relus en base, stock et portions pris une seule fois, zone et minimum, heure dans les horaires,
 * plafond des commandes non payées. Aucun montant n'est lu dans le corps (un prix ou un total envoyé est ignoré).
 * Lot 12b : par order_create_checked (enveloppe, aucune recopie) : même demande (même clé) → même commande, jamais une
 * seconde (double clic, deux onglets, rejeu) ; total et montant à payer AFFICHÉS par l'écran (expectedTotal,
 * expectedToPay, comparaison seulement) différents du devis de la base → rien n'est créé, refus « Le prix de votre
 * commande a changé : … Vérifiez avant de payer. » avec les nouveaux montants (même règle que les tables du 11c-b).
 * Avant le lot 12a : total calculé par la route à partir des produits de n'importe quelle partenaire, quantités non
 * bornées, aucun produit réglementé refusé.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        // Lot 9 quater (A2) : numéro prouvé par un code SMS exigé avant toute action qui engage de l'argent
        const unverified = requireVerifiedPhone(session.user);
        if (unverified) return unverified;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', 'POST /api/orders/create');
        if (closed) return closed;

        const body = await readJson(req);
        if (!body) return invalidBody();
        const key = req.headers.get('idempotency-key');
        if (key !== null && !IDEMPOTENCY_KEY.test(key.trim())) {
            return NextResponse.json({ success: false, error: 'Demande illisible : rechargez la page et réessayez.', code: 'INVALID_IDEMPOTENCY_KEY' }, { status: 400 });
        }
        const p = {
            ...orderInput(session.user.id, body),
            client_request_key: key?.trim() || null,
            expected_total: shownAmount(body.expectedTotal),
            expected_to_pay: shownAmount(body.expectedToPay),
        };
        const supabase = getServiceRoleClient();
        const { data, error } = await supabase.rpc('order_create_checked', { p });
        if (error) throw new Error(`order_create_checked : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) {
            if (r?.code === 'ORDER_PRICE_CHANGED') {
                const total = Number(r.total);
                return NextResponse.json({
                    success: false,
                    error: `Le prix de votre commande a changé : ${fcfa(total)}. Vérifiez avant de payer.`,
                    code: 'ORDER_PRICE_CHANGED',
                    total,
                    toPayNow: Number(r.to_pay_now),
                }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
            }
            return orderRefusal(r, 'Commande impossible pour le moment.');
        }
        // Même demande déjà reçue : la commande existante, lue comme le suivi (rien de nouveau n'est créé)
        if (r.duplicate === true) {
            const { data: view, error: viewErr } = await supabase.rpc('order_view', { p: { order_id: r.order_id, actor_id: session.user.id, as: 'CLIENT' } });
            if (viewErr) throw new Error(`order_view : ${viewErr.message}`);
            const v = (view ?? {}) as Record<string, unknown>;
            const amounts = (v.amounts ?? {}) as Record<string, unknown>;
            return NextResponse.json({
                success: true,
                duplicate: true,
                order: {
                    id: r.order_id,
                    orderNumber: v.order_number,
                    state: v.state,
                    stateLabel: orderStateLabel(v.state, v.mode),
                    mode: v.mode,
                    payment: v.payment_type,
                    goodsTotal: Number(amounts.goods_total ?? 0),
                    toPayNow: amounts.to_pay_now === undefined ? 0 : Number(amounts.to_pay_now),
                    balanceDue: Number(amounts.balance_due ?? 0),
                    holdExpiresAt: v.hold_expires_at ?? null,
                },
            }, { status: 200 });
        }
        return NextResponse.json({
            success: true,
            order: {
                id: r.order_id,
                orderNumber: r.order_number,
                state: r.order_state,
                stateLabel: orderStateLabel(r.order_state, r.mode),
                venueName: r.venue_name,
                mode: r.mode,
                payment: r.payment,
                lines: r.lines,
                itemsAmount: Number(r.items_amount),
                deliveryFee: Number(r.delivery_fee),
                goodsTotal: Number(r.goods_total),
                depositPercent: r.deposit_percent ?? null,
                serviceFee: Number(r.first_fee),
                toPayNow: Number(r.to_pay_now),
                balanceDue: Number(r.balance_due),
                scheduledFor: r.scheduled_for,
                asap: r.asap,
                holdExpiresAt: r.hold_expires_at ?? null,
                responseDueAt: r.response_due_at ?? null,
            },
        }, { status: 201 });
    } catch (err: unknown) {
        return apiFailure('POST /api/orders/create', err, { message: 'Commande impossible pour le moment. Réessayez.', code: 'ORDER_CREATE_FAILED' });
    }
}
