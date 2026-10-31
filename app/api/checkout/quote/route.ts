import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { quoteTickets } from '@/lib/finance/engine';

export const dynamic = 'force-dynamic';

const QuoteSchema = z.object({
    eventId: z.string().uuid(),
    items: z.array(z.object({ categoryId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(20),
    operator: z.enum(['WAVE', 'ORANGE_MONEY']).optional().nullable(),
});

/**
 * POST /api/checkout/quote — devis d'un panier de billets (lot 3.2), sans session.
 * Sous-total (prix faciaux), frais de service et total à payer viennent du moteur financier
 * (prix lus en base) : l'interface les affiche tels quels et ne recalcule jamais de frais.
 * Les revenus internes (agrégateur, revenu net Event Village) ne sont pas exposés.
 */
export async function POST(req: NextRequest) {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
    }
    const parsed = QuoteSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Panier invalide.', details: parsed.error.flatten() }, { status: 400 });
    }
    try {
        const quote = await quoteTickets(
            parsed.data.eventId,
            parsed.data.items.map((i) => ({ category_id: i.categoryId, quantity: i.quantity })),
            parsed.data.operator ?? null,
        );
        if (!quote.ok) return NextResponse.json({ error: quote.message, code: quote.code }, { status: 400 });
        const b = quote.breakdown;
        return NextResponse.json({
            event_id: quote.eventId,
            currency: 'XOF',
            lines: b.lines.map((l) => ({
                category_id: l.category_id,
                unit_price: l.unit_price,
                quantity: l.quantity,
                unit_service_fee: l.unit_service_fee,
                line_facial: l.line_facial,
                line_service_fee: l.line_service_fee,
                line_total: l.line_total,
            })),
            facial_amount: b.facial_amount,
            service_fee: b.service_fee,
            service_fee_rate: b.service_fee_rate,
            total_amount: b.total_amount,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API /api/checkout/quote] devis impossible :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Devis momentanément indisponible.' }, { status: 500 });
    }
}
