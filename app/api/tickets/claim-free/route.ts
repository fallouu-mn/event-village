import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/events/event.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/claim-free
 * Réservation d'un billet gratuit (price = 0) sans passer par la passerelle de paiement.
 * Authentification obligatoire. Vérifie côté serveur que le billet est bien gratuit.
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Authentification requise pour réserver un billet.' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { categoryId } = body;

        if (!categoryId || typeof categoryId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'categoryId requis.' },
                { status: 400 }
            );
        }

        const supabase = getServiceRoleClient();
        const { data: category, error: catErr } = await supabase
            .from('ticket_categories')
            .select('id, price, event_id')
            .eq('id', categoryId)
            .single();

        if (catErr || !category) {
            return NextResponse.json(
                { success: false, error: 'Catégorie de billet introuvable.' },
                { status: 404 }
            );
        }

        if (Number(category.price) !== 0) {
            return NextResponse.json(
                { success: false, error: 'Ce billet n\'est pas gratuit. Utilisez le parcours de paiement standard.' },
                { status: 400 }
            );
        }

        const result = await EventService.purchaseTicketAtomic({
            eventId: category.event_id,
            categoryId: category.id,
            userId: user.id,
            paymentConfirmed: true,
        });

        return NextResponse.json({
            success: true,
            ticket: {
                id: result.ticket.id,
                ticket_number: result.ticket.ticket_number,
                qr_code: result.ticket.qr_code,
                status: result.ticket.status,
            },
        }, { status: 201 });
    } catch (error: unknown) {
        console.error('[API /api/tickets/claim-free] Erreur:', error instanceof Error ? error.message : 'unknown');
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Erreur lors de la réservation du billet gratuit.' },
            { status: 400 }
        );
    }
}
