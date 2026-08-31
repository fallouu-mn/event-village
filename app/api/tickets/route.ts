import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tickets
 * Récupère tous les billets réels de l'utilisateur connecté avec QR code et informations d'événement
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = getServiceRoleClient();
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        let userId: string | null = null;
        if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            userId = user?.id || null;
        }

        const { searchParams } = new URL(req.url);
        const queryUserId = searchParams.get('userId');
        const effectiveUserId = userId || queryUserId;

        if (!effectiveUserId) {
            return NextResponse.json({ error: 'Connexion requise pour consulter vos billets.' }, { status: 401 });
        }

        const { data: tickets, error } = await supabase
            .from('tickets')
            .select(`
                id,
                ticket_number,
                price,
                qr_code,
                status,
                checked_in_at,
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

        const formatted = (tickets || []).map((t: any) => {
            const startDate = t.events?.start_date ? new Date(t.events.start_date) : new Date();
            const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];
            const monthShort = months[startDate.getMonth()] || 'SEP';
            const dayNumber = String(startDate.getDate()).padStart(2, '0');
            const timeFormatted = t.events?.start_time ? t.events.start_time.substring(0, 5) : '20:00';
            const dateFormatted = `${dayNumber} ${monthShort} ${startDate.getFullYear()}`;
            const isUpcoming = startDate.getTime() >= Date.now();

            return {
                id: t.id,
                ticketNumber: t.ticket_number,
                eventTitle: t.events?.title || 'Événement',
                eventSubtitle: t.events?.partners?.commercial_name || t.events?.partners?.company_name || 'Organisateur',
                eventImageUrl: t.events?.image_url || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
                dateFormatted,
                timeFormatted,
                venue: t.events?.location || 'Dakar, Sénégal',
                seat: t.ticket_categories?.name || 'Pass Standard',
                qrCodeValue: t.qr_code,
                status: t.status,
                isUpcoming,
            };
        });

        return NextResponse.json({ tickets: formatted });
    } catch (err: unknown) {
        console.error('[API /api/tickets] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
