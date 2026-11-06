import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { rpcWithRetry } from '@/lib/payments/rpc';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    eventId: z.string().uuid(),
    items: z.array(z.object({ categoryId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(10),
});

/** Mêmes statuts que POST /api/controller/counter-sale (refus de la RPC counter_sale_quote). */
const REFUSAL_STATUS: Record<string, number> = {
    INVALID_INPUT: 400,
    INVALID_ITEMS: 400,
    COUNTER_SALE_DISABLED: 403,
    NOT_ASSIGNED: 403,
    NO_CASH_PERMISSION: 403,
    NO_OPEN_SHIFT: 409,
    EVENT_CLOSED: 409,
    CATEGORY_NOT_SOLD_AT_COUNTER: 409,
};

type QuoteReply = {
    ok?: boolean;
    code?: string;
    message?: string;
    problems?: unknown;
    total?: unknown;
    lines?: Array<{ category_id?: unknown; name?: unknown; unit_price?: unknown; quantity?: unknown; amount?: unknown }>;
};

/**
 * POST /api/controller/counter-sale/quote — devis du guichet (lot 7, D53, contrat 3.3) :
 * `{ eventId, items: [{ categoryId, quantity }] }` → total et lignes calculés par le serveur (RPC
 * counter_sale_quote : mêmes contrôles que la vente, sans écriture, sans verrou). Catégorie non vendable
 * (inactive, introuvable, quantité ou stock) → 400 INVALID_ITEMS avec le détail ; catégorie non vendue au
 * guichet → 409 CATEGORY_NOT_SOLD_AT_COUNTER ; aucun total.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Devis invalide : événement et catégories requis.', code: 'INVALID_BODY' }, { status: 400 });
    }

    let quote: QuoteReply;
    try {
        const { data, error } = await rpcWithRetry<QuoteReply>('counter_sale_quote', {
            p: {
                seller_id: session.user.id,
                event_id: parsed.data.eventId,
                items: parsed.data.items.map((i) => ({ category_id: i.categoryId, quantity: i.quantity })),
            },
        });
        if (error || !data) throw new Error(`counter_sale_quote : ${error?.message ?? 'réponse vide'}`);
        quote = data;
    } catch (err) {
        console.error('[API /api/controller/counter-sale/quote] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Devis momentanément indisponible.', code: 'QUOTE_FAILED' }, { status: 500 });
    }
    if (quote.ok !== true) {
        const code = String(quote.code ?? 'QUOTE_REFUSED');
        return NextResponse.json(
            { error: String(quote.message ?? 'Devis refusé.'), code, ...(quote.problems !== undefined ? { problems: quote.problems } : {}) },
            { status: REFUSAL_STATUS[code] ?? 400 });
    }
    return NextResponse.json({
        total: Number(quote.total ?? 0),
        lines: (quote.lines ?? []).map((l) => ({
            category_id: String(l.category_id),
            name: String(l.name ?? ''),
            unit_price: Number(l.unit_price ?? 0),
            quantity: Number(l.quantity ?? 0),
            amount: Number(l.amount ?? 0),
        })),
    }, { headers: { 'Cache-Control': 'no-store' } });
}
