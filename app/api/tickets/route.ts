import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets
 * Récupère tous les billets réels de l'utilisateur connecté avec QR code et informations d'événement.
 * L'utilisateur est celui de la session (lot 1B.6) : le paramètre historique `userId` n'est
 * accepté que s'il désigne ce même compte.
 */
export async function GET(req: NextRequest) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const effectiveUserId = activeSession.user.id;

        const queryUserId = new URL(req.url).searchParams.get('userId');
        if (queryUserId && queryUserId !== effectiveUserId) {
            console.warn(`[API /api/tickets] userId ${queryUserId} demandé par le compte ${effectiveUserId} : refusé`);
            return NextResponse.json({ error: 'Vous ne pouvez consulter que vos propres billets.', code: 'FORBIDDEN_OTHER_USER' }, { status: 403 });
        }

        const supabase = getServiceRoleClient();

        const { data: tickets, error } = await supabase
            .from('tickets')
            .select(`
                id,
                ticket_number,
                price,
                status,
                checked_in_at,
                transfer_locked,
                created_at,
                event_id,
                events(id, title, location, city, start_date, start_time, image_url, partners(company_name, commercial_name)),
                category_id,
                ticket_categories(id, name, price)
            `)
            .eq('user_id', effectiveUserId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[API /api/tickets] Erreur Supabase:', error);
            return NextResponse.json({ error: 'Impossible de charger vos billets.' }, { status: 500 });
        }

        // Récupérer les transferts actifs en attente pour ces billets
        const ticketIds = (tickets || []).map((t: any) => t.id);
        const pendingTransfersMap: Record<string, { id: string; recipient: string; expires_at: string }> = {};

        if (ticketIds.length > 0) {
            const nowIso = new Date().toISOString();
            const { data: pendingTransfers } = await supabase
                .from('ticket_transfers')
                .select('id, ticket_id, to_phone_or_email, expires_at, status')
                .in('ticket_id', ticketIds)
                .eq('status', 'PENDING')
                .gt('expires_at', nowIso);

            (pendingTransfers || []).forEach((tr: any) => {
                const target = tr.to_phone_or_email || '';
                let masked = '***';
                if (target.includes('@')) {
                    const [local, domain] = target.split('@');
                    const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : `${local.charAt(0)}***`;
                    masked = `${maskedLocal}@${domain || '***'}`;
                } else if (target.length >= 8) {
                    masked = `${target.slice(0, 4)}***${target.slice(-2)}`;
                }
                pendingTransfersMap[tr.ticket_id] = {
                    id: tr.id,
                    recipient: masked,
                    expires_at: tr.expires_at,
                };
            });
        }

        const formatted = (tickets || []).map((t: any) => {
            const startDate = t.events?.start_date ? new Date(t.events.start_date) : new Date();
            const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];
            const monthShort = months[startDate.getMonth()] || 'SEP';
            const dayNumber = String(startDate.getDate()).padStart(2, '0');
            const timeFormatted = t.events?.start_time ? t.events.start_time.substring(0, 5) : '20:00';
            const dateFormatted = `${dayNumber} ${monthShort} ${startDate.getFullYear()}`;
            const isUpcoming = t.status === 'VALIDE' && startDate.getTime() >= Date.now();
            const activeTransfer = pendingTransfersMap[t.id] || null;
            const isTransferLocked = Boolean(t.transfer_locked) || Boolean(activeTransfer);

            return {
                id: t.id,
                eventId: t.event_id,
                ticketNumber: t.ticket_number,
                eventTitle: t.events?.title || 'Événement',
                eventSubtitle: t.events?.partners?.commercial_name || t.events?.partners?.company_name || 'Organisateur',
                eventImageUrl: t.events?.image_url || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
                dateFormatted,
                timeFormatted,
                rawStartDate: t.events?.start_date || null,
                venue: t.events?.location || 'Dakar, Sénégal',
                seat: t.ticket_categories?.name || 'Pass Standard',
                status: t.status,
                usedAt: t.checked_in_at,
                isUpcoming,
                isTransferLocked,
                activeTransfer,
            };
        });

        return NextResponse.json({ tickets: formatted });
    } catch (err: unknown) {
        console.error('[API /api/tickets] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
