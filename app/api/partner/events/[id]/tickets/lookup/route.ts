import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireEventAccess } from '@/lib/auth/event-access';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { isEventId } from '@/lib/events/public-status';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type RefundMode = 'CASHOUT' | 'ORGANISATEUR' | 'AUCUN';

interface TicketRow {
    id: string;
    ticket_number: string;
    price: number | string | null;
    service_fee: number | string | null;
    status: string;
    sale_channel: string | null;
    user_id: string | null;
    payment_id: string | null;
    ticket_categories: { name: string } | null;
}

interface PaymentRow {
    status: string;
    is_platform_payment: boolean | null;
}

const NUMBER_MIN = 4;
const NUMBER_MAX = 60;
/** Vente au guichet sans compte : même mention que le scan (ticket_scan). */
const COUNTER_HOLDER = 'Vente au guichet';
const CASHOUT_PAYMENT_STATUSES = new Set(['SUCCESS', 'PARTIAL']);

function ticketNotFound(): PublicError {
    return new PublicError('Billet introuvable pour cet événement.', 'TICKET_NOT_FOUND', 404);
}

/** Prénom et initiale du nom : la fiche n'expose jamais le nom complet. */
function shortName(firstName: string | null, lastName: string | null): string | null {
    const first = (firstName ?? '').trim();
    const initial = Array.from((lastName ?? '').trim())[0]?.toUpperCase();
    const short = [first, initial ? `${initial}.` : ''].filter(Boolean).join(' ');
    return short || null;
}

/** Mêmes branches que ticket_refund_request : gratuit, payé hors plateforme ou sans paiement, payé en ligne. */
function refundModeOf(price: number, payment: PaymentRow | null): RefundMode {
    if (price === 0) return 'AUCUN';
    return payment?.is_platform_payment ? 'CASHOUT' : 'ORGANISATEUR';
}

/**
 * Lot 9 bis (R11, B21, contrat 4.1) : même règle que ticket_refund_request (M06), lue sans verrou pour l'écran. Après la
 * fin de l'événement, la propriétaire ne rembourse plus (EVENT_ENDED) ; un admin muni de refunds.manage (ou le
 * SUPERADMIN) le peut toujours ; un événement ANNULE suit l'annulation, sans règle de date.
 */
async function refundClosedReason(
    supabase: ReturnType<typeof getServiceRoleClient>, eventId: string, status: string, actorId: string, actorIsAdmin: boolean,
): Promise<'EVENT_ENDED' | null> {
    if (actorIsAdmin || status === 'ANNULE') return null;
    const { data: canRefund, error: canErr } = await supabase.rpc('admin_can', { p_actor: actorId, p_permission: 'refunds.manage' });
    if (canErr) throw new Error(`admin_can : ${canErr.message}`);
    if (canRefund === true) return null;
    const { data: endAt, error: endErr } = await supabase.rpc('event_end_at', { p_event_id: eventId });
    if (endErr) throw new Error(`event_end_at de ${eventId} : ${endErr.message}`);
    if (typeof endAt !== 'string') throw new Error(`event_end_at de ${eventId} : fin illisible`);
    return Date.now() > Date.parse(endAt) ? 'EVENT_ENDED' : null;
}

/**
 * Lecture sans verrou, pour l'affichage : ticket_refund_request recontrôle sous verrou au POST. Un billet gratuit
 * VALIDE est remboursable au sens de la RPC : elle l'annule sans argent, `refund_mode` AUCUN le dit à l'écran.
 */
function isRefundable(status: string, mode: RefundMode, payment: PaymentRow | null): boolean {
    if (status !== 'VALIDE') return false;
    return mode !== 'CASHOUT' || CASHOUT_PAYMENT_STATUSES.has(String(payment?.status));
}

/**
 * GET /api/partner/events/[id]/tickets/lookup?number=TCK-… — fiche d'un billet à rembourser (lot 8, anomalie A4,
 * contrat 3.11). Droits de POST …/tickets/[ticketId]/refund : le partenaire propriétaire de l'événement [id], ou un
 * ADMIN muni de refunds.manage, ou le SUPERADMIN (lot 9 bis, R2). Un billet d'un autre événement répond 404. Rien d'autre que le contrat : ni QR, ni téléphone,
 * ni nom complet. Le numéro est lu comme à la saisie manuelle du scan : sans espaces autour, en capitales.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;

    try {
        if (!serverIsAdmin(user) && !user.roles.includes('PARTENAIRE')) {
            throw new PublicError('Seul l’organisateur de l’événement ou un administrateur peut consulter ce billet.', 'FORBIDDEN', 403);
        }
        const { id: eventId } = await Promise.resolve(context.params);
        // Lot 9 bis (R2, B31, décision D2) : la fiche sert le panneau de remboursement, un admin doit avoir refunds.manage.
        const access = await requireEventAccess(user, eventId, 'refunds.manage');
        if (access.kind === 'DENIED') return access.response;
        const isAdmin = access.kind === 'ADMIN';
        const number = (req.nextUrl.searchParams.get('number') ?? '').trim().toUpperCase();
        if (number.length < NUMBER_MIN || number.length > NUMBER_MAX) {
            throw new PublicError('Saisissez le numéro complet du billet.', 'INVALID_TICKET_NUMBER', 400);
        }
        if (!isEventId(eventId)) throw ticketNotFound();

        const supabase = getServiceRoleClient();
        const { data: event, error: eErr } = await supabase
            .from('events')
            .select('id, status, partners!inner(user_id)')
            .eq('id', eventId)
            .maybeSingle();
        if (eErr) throw new Error(`événement ${eventId} : ${eErr.message}`);
        if (!event) throw ticketNotFound();
        const owner = event.partners as unknown as { user_id: string };
        if (!isAdmin && owner.user_id !== user.id) {
            throw new PublicError('Cet événement ne vous appartient pas.', 'FORBIDDEN', 403);
        }
        const closedReason = await refundClosedReason(supabase, eventId, String(event.status), user.id, isAdmin);

        const { data, error: tErr } = await supabase
            .from('tickets')
            .select('id, ticket_number, price, service_fee, status, sale_channel, user_id, payment_id, ticket_categories(name)')
            .eq('event_id', eventId)
            .eq('ticket_number', number)
            .maybeSingle();
        if (tErr) throw new Error(`billet de l'événement ${eventId} : ${tErr.message}`);
        if (!data) throw ticketNotFound();
        const ticket = data as unknown as TicketRow;
        const price = Number(ticket.price ?? 0);

        let payment: PaymentRow | null = null;
        if (ticket.payment_id) {
            const { data: pay, error: pErr } = await supabase
                .from('payments')
                .select('status, is_platform_payment')
                .eq('id', ticket.payment_id)
                .maybeSingle();
            if (pErr) throw new Error(`paiement du billet ${ticket.id} : ${pErr.message}`);
            payment = pay as PaymentRow | null;
        }

        let holder: string | null = COUNTER_HOLDER;
        if (ticket.user_id) {
            const { data: account, error: uErr } = await supabase
                .from('users')
                .select('first_name, last_name')
                .eq('id', ticket.user_id)
                .maybeSingle();
            if (uErr) throw new Error(`porteur du billet ${ticket.id} : ${uErr.message}`);
            holder = shortName(account?.first_name ?? null, account?.last_name ?? null);
        }

        const refundMode = refundModeOf(price, payment);
        return NextResponse.json({
            ticket: {
                id: ticket.id,
                ticket_number: ticket.ticket_number,
                category: ticket.ticket_categories?.name ?? null,
                price,
                service_fee: Number(ticket.service_fee ?? 0),
                status: ticket.status,
                sale_channel: ticket.sale_channel,
                holder_short: holder,
                refundable: closedReason === null && isRefundable(ticket.status, refundMode, payment),
                refund_mode: refundMode,
                refund_closed_reason: closedReason,
            },
        });
    } catch (err) {
        return apiFailure('GET /api/partner/events/[id]/tickets/lookup', err, { message: 'Recherche du billet momentanément indisponible.', code: 'TICKET_LOOKUP_UNAVAILABLE' });
    }
}
