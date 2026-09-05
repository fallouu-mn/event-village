import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/controller/assignments
// Retourne tous les événements auxquels le contrôleur connecté est assigné
// avec les statistiques du jour (billets scannés / total)
export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        if (user.role !== 'CONTROLEUR' && user.role !== 'ADMIN' && user.role !== 'SUPERADMIN') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const supabase = getServiceRoleClient();

        // Assignations + infos événement
        const { data: assignments, error } = await supabase
            .from('event_controllers')
            .select(`
                id,
                can_accept_cash,
                events (
                    id,
                    title,
                    start_date,
                    start_time,
                    location,
                    status,
                    image_url
                )
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[GET assignments]', error.message);
            return NextResponse.json({ error: 'Impossible de charger vos assignations.' }, { status: 500 });
        }

        // Statistiques du jour pour chaque événement assigné
        const today = new Date().toISOString().split('T')[0];
        const enriched = await Promise.all(
            (assignments ?? []).map(async (a: any) => {
                const eventId = a.events?.id;
                const formattedEvent = a.events ? {
                    ...a.events,
                    date: a.events.start_date,
                    cover_image_url: a.events.image_url,
                } : null;

                if (!eventId) return { ...a, events: formattedEvent, stats: { scanned_today: 0, total_tickets: 0 } };

                const [{ count: scannedToday }, { count: totalTickets }] = await Promise.all([
                    supabase
                        .from('tickets')
                        .select('id', { count: 'exact', head: true })
                        .eq('event_id', eventId)
                        .eq('status', 'UTILISE')
                        .gte('checked_in_at', `${today}T00:00:00`),
                    supabase
                        .from('tickets')
                        .select('id', { count: 'exact', head: true })
                        .eq('event_id', eventId)
                        .in('status', ['VALIDE', 'UTILISE']),
                ]);

                return {
                    ...a,
                    events: formattedEvent,
                    stats: {
                        scanned_today: scannedToday ?? 0,
                        total_tickets: totalTickets ?? 0,
                    },
                };
            })
        );

        // Récupérer le nom du contrôleur
        const { data: profile } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', user.id)
            .maybeSingle();

        return NextResponse.json({
            success: true,
            assignments: enriched,
            controller: {
                id: user.id,
                first_name: profile?.first_name ?? '',
                last_name: profile?.last_name ?? '',
            },
        });
    } catch (err: unknown) {
        console.error('[API /api/controller/assignments]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}
