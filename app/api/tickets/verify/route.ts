import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/verify
 * Vérification en direct d'un QR code de billet par un Contrôleur ou Partenaire
 */
export async function POST(req: NextRequest) {
    try {
        let body: { qrCode?: string; ticketNumber?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const rawCode = body.qrCode?.trim() || body.ticketNumber?.trim();
        if (!rawCode) {
            return NextResponse.json({ error: 'Code de billet ou QR code requis.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // 1. Recherche du billet dans public.tickets avec jointures
        const { data: ticket, error: ticketErr } = await supabase
            .from('tickets')
            .select(`
                id,
                ticket_number,
                qr_code_token,
                status,
                price_paid,
                seat_number,
                used_at,
                created_at,
                event_id,
                user_id,
                events (id, title, start_date, location_name),
                ticket_tiers (id, name, price)
            `)
            .or(`ticket_number.eq.${rawCode},qr_code_token.eq.${rawCode}`)
            .maybeSingle();

        if (ticketErr || !ticket) {
            return NextResponse.json({
                status: 'invalid',
                message: 'Billet inexistant ou QR Code non reconnu.',
            });
        }

        const eventData = ticket.events as any;
        const tierData = ticket.ticket_tiers as any;

        // 2. Si le billet a déjà été validé
        if (ticket.status === 'UTILISE') {
            const checkedTime = ticket.used_at
                ? new Date(ticket.used_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                : 'Aujourd\'hui';

            return NextResponse.json({
                status: 'already_used',
                message: 'Billet déjà validé et utilisé précédemment.',
                ticketInfo: {
                    ticketNumber: ticket.ticket_number,
                    eventTitle: eventData?.title || 'Événement Event Village',
                    holderName: 'Porteur de Billet',
                    category: tierData?.name || 'Pass Standard',
                    checkedInAt: `Validé à ${checkedTime}`,
                },
            });
        }

        // 3. Si le billet a été annulé ou remboursé
        if (ticket.status === 'ANNULE' || ticket.status === 'REMETTRE_EN_VENTE') {
            return NextResponse.json({
                status: 'invalid',
                message: 'Ce billet a été annulé ou remboursé.',
            });
        }

        // 4. Validation réussie du billet
        const now = new Date().toISOString();
        await supabase
            .from('tickets')
            .update({
                status: 'UTILISE',
                used_at: now,
            })
            .eq('id', ticket.id);

        // 5. Journal d'audit du scan
        await AdminService.logAudit({
            userId: ticket.user_id || 'controller-scan',
            userRole: 'CONTROLEUR',
            action: 'TICKET_SCAN',
            objectType: 'tickets',
            objectId: ticket.id,
            newValue: { status: 'UTILISE', scanned_at: now },
            metadata: { ticket_number: ticket.ticket_number, event_id: ticket.event_id },
        });

        // 6. Calcul des statistiques du jour pour ce contrôleur/événement
        const { data: todayScans } = await supabase
            .from('tickets')
            .select('id')
            .eq('event_id', ticket.event_id)
            .eq('status', 'UTILISE');

        const { data: totalTickets } = await supabase
            .from('tickets')
            .select('id')
            .eq('event_id', ticket.event_id)
            .neq('status', 'ANNULE');

        const checkedInCount = todayScans?.length || 1;
        const totalExpected = totalTickets?.length || 1;

        return NextResponse.json({
            status: 'valid',
            message: 'Accès autorisé ! Billet validé avec succès.',
            ticketInfo: {
                ticketNumber: ticket.ticket_number,
                eventTitle: eventData?.title || 'Événement Event Village',
                holderName: 'Porteur Validé',
                category: tierData?.name || 'Pass Officiel',
                checkedInAt: 'À l’instant',
            },
            stats: {
                checkedInCount,
                totalExpected,
            },
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
