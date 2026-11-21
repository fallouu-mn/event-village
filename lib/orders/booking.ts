/**
 * Lot 12a — commandes : textes et réponses côté serveur. Tout l'argent et chaque étape sont calculés et verrouillés en
 * base (order_quote, order_create, order_payment_create, order_partner_action…) ; ce module ne fait que traduire pour
 * les gens (aucun code ni état en capitales dans une réponse lisible) et choisir le statut HTTP d'un refus.
 */
import { NextResponse } from 'next/server';
import { fcfa } from '@/lib/halls/booking';
import { CashoutService } from '@/lib/payments/cashout.service';

export { fcfa };

/** Libellé de chaque état d'une commande (order_state), selon son mode de remise pour l'état final. */
export const ORDER_STATE_LABELS: Readonly<Record<string, string>> = {
    EN_ATTENTE_PAIEMENT: 'En attente de paiement',
    RECUE: 'Reçue',
    ACCEPTEE: 'Acceptée',
    EN_PREPARATION: 'En préparation',
    PRETE: 'Prête',
    EN_ROUTE: 'En route',
    REMISE: 'Remise',
    NON_RETIREE: 'Non retirée',
    EXPIREE: 'Non payée à temps',
    REFUSEE: 'Refusée par l’établissement',
    SANS_REPONSE: 'Sans réponse de l’établissement',
    ANNULEE_CLIENT: 'Annulée par le client',
    ANNULEE_PARTENAIRE: 'Annulée par l’établissement',
    ANNULEE_EV: 'Annulée par Event Village',
};

export function orderStateLabel(state: unknown, mode?: unknown): string {
    if (state === 'REMISE') return mode === 'LIVRAISON' ? 'Livrée' : mode === 'SUR_PLACE' ? 'Servie' : 'Retirée';
    return typeof state === 'string' && ORDER_STATE_LABELS[state] ? ORDER_STATE_LABELS[state] : 'État inconnu';
}

/**
 * Étapes du suivi (complément du 21/11, expérience du lot 12b) : chaque étape avec son heure, ou null si elle n'est pas
 * encore franchie. « En route » n'existe que pour une livraison.
 */
export function orderTimeline(view: Record<string, unknown>): Array<{ key: string; label: string; at: string | null }> {
    const steps = (view.steps ?? {}) as Record<string, string | undefined>;
    const mode = view.mode;
    const list: Array<{ key: string; label: string; at: string | null }> = [
        { key: 'RECUE', label: 'Reçue', at: steps.received_at ?? null },
        { key: 'ACCEPTEE', label: 'Acceptée', at: steps.accepted_at ?? null },
        { key: 'EN_PREPARATION', label: 'En préparation', at: steps.preparing_at ?? null },
        { key: 'PRETE', label: 'Prête', at: steps.ready_at ?? null },
    ];
    if (mode === 'LIVRAISON') list.push({ key: 'EN_ROUTE', label: 'En route', at: steps.en_route_at ?? null });
    list.push({ key: 'REMISE', label: orderStateLabel('REMISE', mode), at: steps.handed_over_at ?? null });
    return list;
}

/** Vue d'une commande pour une réponse : libellé de l'état et étapes ajoutés, rien de technique retiré du reste. */
export function orderResponse(view: Record<string, unknown>): Record<string, unknown> {
    return { ...view, stateLabel: orderStateLabel(view.state, view.mode), timeline: orderTimeline(view) };
}

/** Statut HTTP d'un refus des fonctions de la base (le message, lui, est déjà en français simple). */
export function orderRefusalStatus(code: unknown): number {
    switch (code) {
        case 'VENUE_NOT_FOUND':
        case 'ORDER_NOT_FOUND':
        case 'PRODUCT_NOT_FOUND':
        case 'COURIER_NOT_FOUND':
        case 'INVITATION_NOT_FOUND':
        case 'ACCOUNT_NOT_FOUND':
        case 'SERVICE_CLOSED':
            return 404;
        case 'ACCOUNT_NOT_ACTIVE':
        case 'FORBIDDEN':
        case 'PARTNER_SUSPENDED':
        case 'PARTNER_NOT_VALIDATED':
        case 'OWN_VENUE':
            return 403;
        case 'TOO_MANY_UNPAID':
        case 'PAYER_PENDING_LIMIT':
        case 'TOO_MANY_CODES':
        case 'TOO_MANY_PORTIONS':
        case 'TOO_MANY_INVITES':
            return 429;
        case 'INVALID_ITEM':
        case 'INVALID_QUANTITY':
        case 'INVALID_OPTION':
        case 'INVALID_PAYMENT':
        case 'INVALID_PART':
        case 'INVALID_TIME':
        case 'INVALID_PHONE':
        case 'INVALID_ACTION':
        case 'INVALID_ORIGIN':
        case 'INVALID_MINUTES':
        case 'INVALID_ETA':
        case 'INVALID_SETTINGS':
        case 'INVALID_MODES':
        case 'INVALID_DEPOSIT':
        case 'INVALID_PREP':
        case 'INVALID_PORTIONS':
        case 'INVALID_DECISION':
        case 'INVALID_ANSWER':
        case 'EMPTY_CART':
        case 'CART_TOO_BIG':
        case 'ADDRESS_REQUIRED':
        case 'PHONE_REQUIRED':
        case 'SPOT_REQUIRED':
        case 'REASON_REQUIRED':
        case 'OPERATOR_REQUIRED':
        case 'REGULATED_PRODUCT':
            return 400;
        default:
            return 409;
    }
}

/** Réponse d'un refus de la base : message en français simple, code pour l'écran, statut HTTP. */
export function orderRefusal(r: Record<string, unknown> | null | undefined, fallback: string): NextResponse {
    const body: Record<string, unknown> = { success: false, error: r?.message ?? fallback, code: r?.code };
    for (const k of ['product_id', 'minimum', 'balance_due', 'attempts_left', 'payment_id']) {
        if (r && r[k] !== undefined) body[k] = r[k];
    }
    return NextResponse.json(body, { status: orderRefusalStatus(r?.code), headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Envoi immédiat des remboursements créés par une annulation, un refus ou une commande sans réponse (Wave, Orange
 * Money, chemin des billets). Un envoi en échec n'arrête rien et n'est jamais relancé ici : il est repris par la tâche
 * des versements (cashouts_to_resume), qui ne relance jamais un versement incertain.
 */
export async function sendOrderRefunds(ids: unknown): Promise<void> {
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
        try {
            await CashoutService.send(String(id));
        } catch (err) {
            console.error(`[commandes] envoi du remboursement ${String(id)} en échec :`, err instanceof Error ? err.message : String(err));
        }
    }
}

/**
 * Code de remise émis par la base (prête à retirer, en route, nouveau code) : envoyé tout de suite au client par SMS
 * (ORDER_HANDOVER_CODE, journal sans le code), puis retiré de la réponse : il n'est jamais rendu au navigateur (ni à la
 * partenaire, ni au livreur, ni au client), jamais stocké en clair, jamais mis dans la boîte d'envoi. Un envoi en échec
 * n'annule pas l'étape : le client demande un nouveau code depuis sa commande.
 */
export async function deliverHandoverCode(r: Record<string, unknown>, actorId: string): Promise<void> {
    const code = r.handover_code;
    const fields = ['handover_code', 'handover_step', 'handover_ref', 'client_id', 'client_phone', 'order_number'];
    try {
        if (typeof code !== 'string') return;
        const phone = typeof r.client_phone === 'string' ? r.client_phone : '';
        const step = r.handover_step === 'RETRAIT' || r.handover_step === 'LIVRAISON' ? r.handover_step : 'NOUVEAU';
        if (!phone) {
            console.error(`[commandes] code de remise de la commande ${String(r.order_id)} non envoyé : aucun numéro sur le compte du client.`);
            return;
        }
        const { mTargetService } = await import('@/lib/sms/mtarget.service');
        const sent = await mTargetService.sendOrderCode(phone, code, String(r.order_number ?? ''), step, {
            actorId,
            // Contre-vérification (T9) : une référence par envoi (commande, étape, nouveaux codes demandés), donc une ligne
            // de journal par SMS du code ; le code lui-même n'est jamais journalisé
            log: {
                type: 'ORDER_HANDOVER_CODE', ref: typeof r.handover_ref === 'string' ? r.handover_ref : String(r.order_id),
                userId: typeof r.client_id === 'string' ? r.client_id : null, actorId,
            },
        });
        if (!sent.success) console.error(`[commandes] code de remise de la commande ${String(r.order_id)} non envoyé : ${sent.code ?? sent.error ?? 'refus'}`);
    } catch (err) {
        console.error(`[commandes] code de remise de la commande ${String(r.order_id)} non envoyé :`, err instanceof Error ? err.message : String(err));
    } finally {
        for (const k of fields) delete r[k];
    }
}

/** Message rendu au client qui annule. */
export function orderCancelMessage(r: { refund_amount?: unknown }): string {
    const refund = Number(r.refund_amount ?? 0);
    return refund > 0 ? `Commande annulée. Vous êtes remboursé de ${fcfa(refund)} sur votre compte de paiement.` : 'Commande annulée.';
}

/** Entrée de order_quote / order_create : seuls des choix, jamais un montant (un prix ou un total envoyé est ignoré). */
export function orderInput(clientId: string | null, body: Record<string, unknown>): Record<string, unknown> {
    const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
    const items = Array.isArray(body.items) ? body.items.slice(0, 31).map((raw) => {
        const it = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
        return {
            product_id: text(it.productId),
            quantity: typeof it.quantity === 'number' || typeof it.quantity === 'string' ? it.quantity : null,
            option_ids: Array.isArray(it.optionIds) ? it.optionIds.filter((x) => typeof x === 'string').slice(0, 11) : [],
            notes: text(it.notes),
        };
    }) : null;
    return {
        client_id: clientId,
        venue_id: text(body.venueId),
        mode: text(body.mode),
        payment: text(body.payment),
        items,
        zone_id: text(body.zoneId),
        address: text(body.address),
        phone: text(body.phone),
        onsite_table_id: text(body.onsiteTableId),
        onsite_label: text(body.onsiteLabel),
        scheduled_for: text(body.scheduledFor),
        notes: text(body.notes),
    };
}

export const UUID_RE =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Corps JSON d'une requête, ou null s'il est illisible. */
export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
    try {
        const body = await req.json();
        return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

export function invalidBody(): NextResponse {
    return NextResponse.json({ success: false, error: 'Demande illisible. Réessayez.', code: 'INVALID_BODY' }, { status: 400 });
}

export function orderNotFound(): NextResponse {
    return NextResponse.json({ success: false, error: 'Commande introuvable.', code: 'ORDER_NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}
