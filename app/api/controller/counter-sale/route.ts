import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { toSenegaleseE164 } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

const IDEMPOTENCY_KEY = /^[A-Za-z0-9_-]{8,100}$/;
const EventId = z.string().uuid();
const COUNTER_SALE_KEY = 'access.counter_sale_enabled';

/**
 * GET /api/controller/counter-sale?event_id=… — ce que l'écran du guichet doit savoir, servi par le serveur
 * (lot 7, D53, contrat 3.3) : `enabled` (réglage access.counter_sale_enabled), `can_accept_cash` (permission
 * espèces de l'affectation), `open_shift` (caisse OUVERT du contrôleur, ou null) et les catégories vendables
 * (actives) avec leur prix et leur disponibilité (total − vendus − réservés). Contrôleur non affecté à
 * l'événement : 403 NOT_ASSIGNED (comme la vente). Aucun total n'est calculé dans le navigateur : le devis
 * passe par POST /api/controller/counter-sale/quote.
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const params = new URL(req.url).searchParams;
    const parsed = EventId.safeParse(params.get('event_id') ?? params.get('eventId'));
    if (!parsed.success) {
        return NextResponse.json({ error: 'event_id requis (identifiant d’événement).', code: 'INVALID_EVENT' }, { status: 400 });
    }
    const eventId = parsed.data;
    const supabase = getServiceRoleClient();
    try {
        const [assignment, setting, shift, categories] = await Promise.all([
            supabase.from('event_controllers').select('can_accept_cash').eq('event_id', eventId).eq('user_id', session.user.id).maybeSingle(),
            supabase.from('platform_settings').select('value').eq('key', COUNTER_SALE_KEY).maybeSingle(),
            supabase.from('controller_shifts').select('id, opened_at, opening_float_amount, expected_cash_total')
                .eq('controller_id', session.user.id).eq('event_id', eventId).eq('status', 'OUVERT').maybeSingle(),
            supabase.from('ticket_categories').select('id, name, price, total_quantity, sold_quantity, held_quantity')
                .eq('event_id', eventId).eq('is_active', true).order('price', { ascending: true }).order('name', { ascending: true }),
        ]);
        if (assignment.error) throw new Error(`affectation : ${assignment.error.message}`);
        if (setting.error) throw new Error(`réglage ${COUNTER_SALE_KEY} : ${setting.error.message}`);
        if (shift.error) throw new Error(`caisse ouverte : ${shift.error.message}`);
        if (categories.error) throw new Error(`catégories : ${categories.error.message}`);
        if (!assignment.data) {
            return NextResponse.json({ error: 'Vente réservée au contrôleur affecté à l’événement.', code: 'NOT_ASSIGNED' }, { status: 403 });
        }
        const enabled = (setting.data?.value as { value?: unknown } | null | undefined)?.value;
        if (typeof enabled !== 'boolean') {
            throw new Error(`réglage ${COUNTER_SALE_KEY} absent ou non booléen : ${JSON.stringify(setting.data?.value ?? null)}`);
        }
        const open = shift.data;
        return NextResponse.json({
            enabled,
            can_accept_cash: assignment.data.can_accept_cash === true,
            open_shift: open ? {
                id: open.id,
                opened_at: open.opened_at,
                opening_float_amount: Number(open.opening_float_amount),
                expected_cash_total: Number(open.expected_cash_total),
                expected_cash_in_drawer: Number(open.opening_float_amount) + Number(open.expected_cash_total),
            } : null,
            categories: (categories.data ?? []).map((c) => ({
                id: c.id,
                name: c.name,
                price: Number(c.price),
                available: Math.max(0, Number(c.total_quantity) - Number(c.sold_quantity) - Number(c.held_quantity ?? 0)),
            })),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API /api/controller/counter-sale GET] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Lecture du guichet momentanément impossible.', code: 'COUNTER_SALE_READ_FAILED' }, { status: 500 });
    }
}

const BodySchema = z.object({
    eventId: z.string().uuid(),
    items: z.array(z.object({ categoryId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(10),
    buyerPhone: z.string().trim().min(8).max(20).optional().nullable(),
});

const REFUSAL_STATUS: Record<string, number> = {
    INVALID_INPUT: 400,
    IDEMPOTENCY_KEY_REQUIRED: 400,
    INVALID_PHONE: 400,
    COUNTER_SALE_DISABLED: 403,
    NOT_ASSIGNED: 403,
    NO_CASH_PERMISSION: 403,
    NO_OPEN_SHIFT: 409,
    EVENT_CLOSED: 409,
    SALE_CHECK_FAILED: 409,
    INVALID_ITEMS: 400,
};

type SaleReply = Record<string, unknown> & {
    ok?: boolean;
    code?: string;
    message?: string;
    replayed?: boolean;
    payment_id?: string;
    transaction_id?: string;
    ticket_ids?: string[];
    amount?: number;
    shift_id?: string;
};

/**
 * POST /api/controller/counter-sale — vente au guichet en espèces = entrée immédiate (lot 5, C7).
 * En-tête Idempotency-Key obligatoire (une même clé rejouée rend la même vente, sans nouvelle écriture).
 * Contrôleur affecté à l'événement avec la permission espèces et une caisse ouverte ; contrôles de vente
 * (catégorie active, stock sous verrou) ; dans la même transaction (RPC counter_sale) : billets sans
 * compte au statut UTILISE, une entrée acceptée par billet (méthode COUNTER), paiement hors plateforme
 * au prix facial rattaché à la caisse, total attendu de la caisse incrémenté. Aucun rattachement au
 * compte du numéro saisi ; le vendeur n'est jamais porteur. Lot 6 (J1.3) : le reçu SMS au numéro fourni
 * est mis en file dans la même transaction (boîte d'envoi, quota par caisse) : `receipt_queued` dit qu'il
 * est en file (ou déjà parti), `receipt_refusal` donne le motif s'il a été écarté dès la vente ; un échec
 * d'envoi n'annule jamais la vente (relances de l'envoyeur).
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;

    const key = req.headers.get('idempotency-key')?.trim() ?? '';
    if (!IDEMPOTENCY_KEY.test(key)) {
        return NextResponse.json({ error: 'En-tête Idempotency-Key obligatoire.', code: 'IDEMPOTENCY_KEY_REQUIRED' }, { status: 400 });
    }
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Vente invalide : événement et catégories requis.', code: 'INVALID_BODY' }, { status: 400 });
    }
    let buyerE164: string | null = null;
    if (parsed.data.buyerPhone) {
        buyerE164 = toSenegaleseE164(parsed.data.buyerPhone);
        if (!buyerE164) {
            return NextResponse.json({ error: 'Numéro de l’acheteur invalide : mobile sénégalais attendu.', code: 'INVALID_PHONE' }, { status: 400 });
        }
    }

    let sale: SaleReply;
    try {
        const { data, error } = await rpcWithRetry<SaleReply>('counter_sale', {
            p: {
                seller_id: session.user.id,
                event_id: parsed.data.eventId,
                items: parsed.data.items.map((i) => ({ category_id: i.categoryId, quantity: i.quantity })),
                buyer_phone: buyerE164 ? buyerE164.slice(4) : null,
                idempotency_key: key,
            },
        });
        if (error || !data) throw new Error(`counter_sale : ${error?.message ?? 'réponse vide'}`);
        sale = data;
    } catch (err) {
        console.error('[API /api/controller/counter-sale] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Vente momentanément indisponible.', code: 'COUNTER_SALE_FAILED' }, { status: 500 });
    }
    if (sale.ok !== true) {
        const code = String(sale.code ?? 'COUNTER_SALE_REFUSED');
        return NextResponse.json({ ...sale, error: String(sale.message ?? 'Vente refusée.'), code }, { status: REFUSAL_STATUS[code] ?? 400 });
    }

    // La vente est acquise : un état du reçu illisible est journalisé et signalé, jamais une erreur (un
    // vendeur qui croirait la vente perdue la referait).
    const receiptKnown = typeof sale.receipt_queued === 'boolean';
    if (!receiptKnown) {
        console.error(`[API /api/controller/counter-sale] réponse de counter_sale sans état du reçu (vente ${sale.payment_id}).`);
    }
    return NextResponse.json({
        ...sale,
        receipt_requested: !!buyerE164,
        receipt_queued: receiptKnown ? sale.receipt_queued : false,
        receipt_refusal: !receiptKnown ? 'RECEIPT_STATE_UNKNOWN' : typeof sale.receipt_refusal === 'string' ? sale.receipt_refusal : null,
    });
}
