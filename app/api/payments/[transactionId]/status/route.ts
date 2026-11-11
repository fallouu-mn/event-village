import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { holdMinutesOf, paymentDeadlineOf } from '@/lib/payments/checkout.service';
import { loadPayment, reconcilePayment, type PaymentRecord } from '@/lib/payments/confirmation.service';
import { maskPhone } from '@/lib/payments/payer-phone';
import { isDeliverableEmail, isEmailEnabled } from '@/lib/notifications/channels';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Lot 9 bis (H1, B102) : un FAILED non définitif (moins de 2 h, provider_final faux) se relit aussi chez SamirPay. */
const RECONCILABLE = new Set(['PENDING', 'EXPIRED', 'CANCELLED', 'FAILED']);
const NOTIFICATION_CHANNELS = ['IN_APP', 'PUSH', 'EMAIL', 'SMS'] as const;

interface StatusItem { category_id: string; category_name: string | null; quantity: number }

/**
 * Lot 9 bis (R1, B9, B11 ; délégation 8.3, fix(9b.1-SH)) : un remboursement de ce paiement est retardé s'il n'est pas
 * versé et qu'il est bloqué (hors simulation), refusé, incertain ou signalé en retard (delay_flagged_at, posé par
 * cashouts_flag_delayed après 30 minutes) : même règle que l'avis REFUND_DELAYED. Erreur de lecture levée.
 */
async function refundDelayedOf(paymentId: string): Promise<boolean> {
    const { data, error } = await getServiceRoleClient().from('cashouts')
        .select('status, blocked_reason, delay_flagged_at')
        .eq('payment_id', paymentId)
        .in('kind', ['REFUND', 'EVENT_CANCELLATION_REFUND', 'TICKET_REFUND'])
        .in('status', ['A_ENVOYER', 'ENVOYE', 'INCERTAIN', 'ECHOUE']);
    if (error) throw new Error(`lecture des remboursements du paiement : ${error.message}`);
    return (data ?? []).some((c) => c.status === 'INCERTAIN' || c.status === 'ECHOUE' || c.delay_flagged_at !== null
        || (c.blocked_reason !== null && c.blocked_reason !== 'SIMULATED'));
}

/** Lien de succès selon la cible (D62 : un abonnement ne mène jamais vers /orders). */
function successUrl(target: string): string {
    if (target === 'TICKET') return '/tickets';
    if (target === 'SUBSCRIPTION') return '/partner/subscription';
    return '/orders';
}

/** Lien « Réessayer le paiement » : la page de l'événement préremplit le panier (?reprise=<paiement>). */
function retryUrl(payment: PaymentRecord): string | null {
    if (payment.payment_target === 'TICKET') return payment.event_id ? `/events/${payment.event_id}?reprise=${payment.id}` : null;
    if (payment.payment_target === 'SUBSCRIPTION') return '/partner/subscription';
    return null;
}

/**
 * Lignes du panier : payments.metadata.checkout_items (écrit par le checkout depuis le lot 3), sinon les
 * réservations de stock du paiement ; noms des catégories lus en base. Une erreur de lecture est levée.
 */
async function itemsOf(payment: PaymentRecord): Promise<StatusItem[]> {
    if (payment.payment_target !== 'TICKET') return [];
    const supabase = getServiceRoleClient();
    const raw = payment.metadata?.checkout_items;
    let lines: Array<{ category_id: string; quantity: number }> = [];
    if (Array.isArray(raw)) {
        lines = raw
            .map((l) => l as { category_id?: unknown; quantity?: unknown })
            .filter((l) => typeof l.category_id === 'string' && Number.isInteger(Number(l.quantity)) && Number(l.quantity) > 0)
            .map((l) => ({ category_id: String(l.category_id), quantity: Number(l.quantity) }));
    }
    if (lines.length === 0) {
        const { data, error } = await supabase.from('stock_reservations').select('category_id, quantity').eq('payment_id', payment.id);
        if (error) throw new Error(`lecture des réservations du paiement : ${error.message}`);
        const byCat = new Map<string, number>();
        for (const r of data ?? []) byCat.set(String(r.category_id), (byCat.get(String(r.category_id)) ?? 0) + Number(r.quantity));
        lines = Array.from(byCat, ([category_id, quantity]) => ({ category_id, quantity }));
    }
    if (lines.length === 0) return [];
    const { data: cats, error: catErr } = await supabase.from('ticket_categories').select('id, name').in('id', lines.map((l) => l.category_id));
    if (catErr) throw new Error(`lecture des catégories du paiement : ${catErr.message}`);
    const nameOf = new Map((cats ?? []).map((c) => [String(c.id), String(c.name)]));
    return lines.map((l) => ({ category_id: l.category_id, category_name: nameOf.get(l.category_id) ?? null, quantity: l.quantity }));
}

/** Événement d'un achat de billets (titre, début à l'heure de Dakar), null pour une autre cible. */
async function eventOf(payment: PaymentRecord): Promise<{ id: string; title: string; start_at: string | null } | null> {
    if (payment.payment_target !== 'TICKET' || !payment.event_id) return null;
    const supabase = getServiceRoleClient();
    const { data: ev, error } = await supabase.from('events').select('id, title').eq('id', payment.event_id).maybeSingle();
    if (error) throw new Error(`lecture de l'événement du paiement : ${error.message}`);
    if (!ev) return null;
    const { data: startAt, error: startErr } = await supabase.rpc('event_start_at', { p_event: payment.event_id });
    if (startErr) throw new Error(`début de l'événement du paiement : ${startErr.message}`);
    return { id: String(ev.id), title: String(ev.title), start_at: startAt ? String(startAt) : null };
}

/**
 * Canaux de la confirmation réellement prévus (D58) : canaux du registre pour le type envoyé à la
 * confirmation (PURCHASE_CONFIRMED pour des billets, PAYMENT_SUCCESS sinon), moins l'email si le canal est
 * désactivé ou si le compte n'a qu'une adresse technique, moins le SMS sans numéro (payeur pour des billets).
 */
async function receiptChannels(payment: PaymentRecord, accountEmail: string | undefined, accountPhone: string | undefined): Promise<string[]> {
    const type = payment.payment_target === 'TICKET' ? 'PURCHASE_CONFIRMED' : 'PAYMENT_SUCCESS';
    const { data, error } = await getServiceRoleClient().from('notification_types').select('channels').eq('type', type).maybeSingle();
    if (error) throw new Error(`lecture du registre des notifications (${type}) : ${error.message}`);
    if (!data) throw new Error(`type de notification ${type} absent du registre`);
    const planned = new Set(((data.channels ?? []) as string[]).map(String));
    const smsPhone = payment.payment_target === 'TICKET' ? payment.payer_phone : accountPhone;
    return NOTIFICATION_CHANNELS.filter((c) => {
        if (!planned.has(c)) return false;
        if (c === 'EMAIL') return isEmailEnabled() && isDeliverableEmail(accountEmail);
        if (c === 'SMS') return Boolean(smsPhone);
        return true;
    });
}

/**
 * GET /api/payments/[id]/status — statut d'un paiement, pour son propriétaire uniquement.
 * Lecture seule : si le paiement n'est pas final, elle peut demander une réconciliation (statut
 * SamirPay avec l'identifiant enregistré, puis la même RPC que le webhook) ; elle n'écrit jamais
 * elle-même un statut. Identifiant : UUID du paiement, recherche par égalité (filtre D1 du lot 1C corrigé).
 * Lot 7 (7.3, contrat 3.5, D58) : la page d'attente dit ce que le client va recevoir et comment reprendre :
 * target_type, event, ticket_count, items, payer_phone_masked (jamais le numéro en clair), receipt_channels,
 * success_url, retry_url.
 * Lot 9 bis (R1, B9) : refundDelayed (un remboursement de ce paiement est retardé : « Remboursement retardé, l’équipe
 * Event Village s’en occupe. »).
 * Lot 9 bis (H2, B103) : holdMinutes (durée de garde appliquée au paiement) et paymentDeadline (création + 60 minutes,
 * validité SamirPay : la page suit le paiement jusque-là).
 */
export async function GET(req: NextRequest, context: { params: Promise<{ transactionId: string }> | { transactionId: string } }) {
    const { transactionId: id } = await Promise.resolve(context?.params);
    if (!id || !UUID.test(id)) {
        return NextResponse.json({ error: 'Identifiant de paiement invalide.' }, { status: 400 });
    }
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        let payment = await loadPayment(id);
        if (!payment || payment.client_id !== session.user.id) {
            return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
        }
        const row = payment as unknown as Record<string, unknown>;
        const lastCheck = row.last_reconciled_at ? new Date(String(row.last_reconciled_at)).getTime() : 0;
        const due = Date.now() - lastCheck >= getServerEnv().STATUS_POLL_RECONCILE_SECONDS * 1000;
        if (RECONCILABLE.has(payment.status) && !row.provider_final && payment.external_transaction_id && due) {
            await reconcilePayment(payment, 'STATUS_POLL');
            payment = (await loadPayment(id))!;
        }
        const { data: tickets, error } = await getServiceRoleClient().from('tickets').select('id').eq('payment_id', id);
        if (error) throw new Error(`lecture des billets : ${error.message}`);
        const [items, event, channels, refundDelayed] = await Promise.all([
            itemsOf(payment),
            eventOf(payment),
            receiptChannels(payment, session.user.email, session.user.phone),
            refundDelayedOf(payment.id),
        ]);
        const ticketIds = (tickets ?? []).map((t) => t.id);
        const view = payment as unknown as Record<string, unknown>;
        return NextResponse.json({
            payment_id: payment.id,
            status: payment.status,
            amount: Number(payment.amount),
            facial_amount: view.facial_amount === null || view.facial_amount === undefined ? null : Number(view.facial_amount),
            // Paiement antérieur au lot 3 (sans répartition enregistrée) : frais inconnus, pas 0
            service_fee: view.facial_amount === null || view.facial_amount === undefined ? null : Number(view.service_fee ?? 0),
            refunded_amount: Number(view.refunded_amount ?? 0),
            refundDelayed,
            currency: payment.currency ?? 'XOF',
            operator: view.operator ?? null,
            expires_at: view.held_expires_at ?? null,
            holdMinutes: payment.payment_target === 'TICKET' ? holdMinutesOf(view) : null,
            paymentDeadline: paymentDeadlineOf(view),
            ticket_ids: ticketIds,
            target_type: payment.payment_target,
            event,
            ticket_count: payment.payment_target === 'TICKET'
                ? (items.length > 0 ? items.reduce((s, i) => s + i.quantity, 0) : ticketIds.length)
                : 0,
            items,
            payer_phone_masked: payment.payer_phone ? maskPhone(payment.payer_phone) : null,
            receipt_channels: channels,
            success_url: successUrl(payment.payment_target),
            retry_url: retryUrl(payment),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error(`[API /api/payments/${id}/status] erreur interne :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Statut momentanément indisponible.' }, { status: 500 });
    }
}
