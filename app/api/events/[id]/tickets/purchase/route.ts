import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { EventService } from '@/lib/events/event.service';

/**
 * POST /api/events/[id]/tickets/purchase
 * Achat atomique de billet sans risque de survente
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Connexion requise pour acheter un billet.' }, { status: 401 });
        }

        const { id: eventId } = await params;
        const body = await request.json();
        const { categoryId, orderId } = body;

        if (!categoryId) {
            return NextResponse.json({ error: 'La catégorie de billet est requise.' }, { status: 400 });
        }

        const purchaseResult = await EventService.purchaseTicketAtomic({
            eventId,
            categoryId,
            userId: user.id,
            orderId,
        });

        return NextResponse.json({
            success: true,
            ticket: purchaseResult.ticket,
            financials: purchaseResult.financials,
        });
    } catch (error: unknown) {
        console.error('[API events/[id]/tickets/purchase POST] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Échec de l\'achat du billet.' },
            { status: 400 }
        );
    }
}
