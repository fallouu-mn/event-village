import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/events/event.service';
import { NotificationService } from '@/lib/notifications/notification.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/claim-free
 * Réservation d'un ou plusieurs billets gratuits (price = 0) sans passer par la passerelle de paiement.
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
        const { categoryId, quantity } = body;

        if (!categoryId || typeof categoryId !== 'string') {
            return NextResponse.json(
                { success: false, error: 'categoryId requis.' },
                { status: 400 }
            );
        }

        const qty = typeof quantity === 'number' && quantity > 0 && quantity <= 20 ? quantity : 1;

        const supabase = getServiceRoleClient();
        const { data: category, error: catErr } = await supabase
            .from('ticket_categories')
            .select('id, price, event_id, name')
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

        const result = await EventService.reserveTicketsAtomic({
            eventId: category.event_id,
            categoryId: category.id,
            quantity: qty,
            userId: user.id,
            paymentConfirmed: true,
        });

        const createdTickets = (result?.tickets || []).map((t: any) => ({
            id: t.id,
            ticket_number: t.ticket_number,
            qr_code: t.qr_code,
            status: t.status,
        }));
        const ticketNumbers = createdTickets.map((t: any) => t.ticket_number);

        // Déclencher les notifications (In-App + SMS + Email Client & Organisateur)
        if (createdTickets.length > 0) {
            try {
                await NotificationService.sendTicketPurchaseNotifications({
                    userId: user.id,
                    eventId: category.event_id,
                    categoryId: category.id,
                    ticketCount: createdTickets.length,
                    ticketNumbers,
                    totalAmount: 0,
                    clientPhone: user.phone,
                    clientEmail: user.email,
                    clientName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Client',
                });
            } catch (notifErr) {
                console.error('[claim-free] Erreur notifications:', notifErr);
            }
        }

        return NextResponse.json({
            success: true,
            tickets: createdTickets,
            ticket: createdTickets[0],
            count: createdTickets.length,
        }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Erreur lors de la réservation du billet gratuit.';
        console.error('[API /api/tickets/claim-free] Erreur:', msg);
        const isSoldOut = msg.includes('Épuisé') || msg.includes('disponible') || msg.includes('insuffisant');
        return NextResponse.json(
            {
                success: false,
                code: isSoldOut ? 'TICKET_CATEGORY_SOLD_OUT' : 'CLAIM_FAILED',
                error: msg,
                message: msg,
            },
            { status: 400 }
        );
    }
}
