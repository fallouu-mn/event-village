import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getCategoryLabel } from '@/lib/constants/event-categories';
import { eventEndAt } from '@/lib/events/event-end';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events — catalogue public (accueil, explorer). Lot 5 (contrat E) :
 *  - seulement les événements PUBLIE dont la fin (event_end_at : fin renseignée, sinon début à 23:59
 *    Africa/Dakar) est à venir ; un événement en cours reste listé ;
 *  - prix « à partir de » calculé sur les catégories actives ET visibles ; sans catégorie achetable :
 *    aucun prix (price null) et « Bientôt en vente », jamais « Gratuit » ;
 *  - aucune donnée de stock ni catégorie masquée exposée.
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = getServiceRoleClient();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('q')?.trim().toLowerCase();
        const category = searchParams.get('category');
        const city = searchParams.get('city');

        let query = supabase
            .from('events')
            .select(`
                id,
                slug,
                title,
                category,
                description,
                location,
                city,
                start_date,
                start_time,
                end_date,
                end_time,
                image_url,
                status,
                created_at,
                partner_id,
                partners(company_name, commercial_name),
                ticket_categories(price, is_active, is_visible)
            `)
            .eq('status', 'PUBLIE')
            .order('start_date', { ascending: true });

        const { data: events, error } = await query;

        if (error) {
            console.error('[API /api/events] Erreur Supabase:', error);
            return NextResponse.json({ error: 'Impossible de charger les événements.' }, { status: 500 });
        }

        const now = Date.now();
        const upcoming = (events || []).filter((evt: any) => eventEndAt(evt).getTime() > now);
        const formatted = upcoming.map((evt: any) => {
            const startDate = new Date(evt.start_date);
            const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];
            const monthShort = months[startDate.getMonth()] || 'SEP';
            const dayNumber = String(startDate.getDate()).padStart(2, '0');
            const timeFormatted = evt.start_time ? evt.start_time.substring(0, 5) : '20:00';
            const dateFormatted = `${dayNumber} ${monthShort} ${startDate.getFullYear()}`;

            const buyable = (evt.ticket_categories || []).filter((c: any) => c.is_active === true && c.is_visible === true);
            const minPrice: number | null = buyable.length > 0
                ? Math.min(...buyable.map((c: any) => Number(c.price)))
                : null;

            return {
                id: evt.id,
                slug: evt.slug || evt.id,
                title: evt.title,
                subtitle: evt.partners?.commercial_name || evt.partners?.company_name || 'Event Village',
                imageUrl: evt.image_url || null,
                dateFormatted,
                dayNumber,
                monthShort,
                timeFormatted,
                venue: evt.location || 'Dakar, Sénégal',
                category: evt.category || null,
                categoryLabel: getCategoryLabel(evt.category),
                city: (evt.city || 'DAKAR').toUpperCase(),
                price: minPrice,
                priceFormatted: minPrice === null
                    ? 'Bientôt en vente'
                    : minPrice === 0 ? 'Gratuit' : `${minPrice.toLocaleString('fr-FR')} F CFA`,
                onSaleSoon: minPrice === null,
                status: evt.status,
            };
        });

        // Filtrage en mémoire pour recherche et ville si demandés
        let results = formatted;
        if (search) {
            results = results.filter(e =>
                e.title.toLowerCase().includes(search) ||
                e.venue.toLowerCase().includes(search) ||
                e.subtitle.toLowerCase().includes(search)
            );
        }
        if (category && category !== 'ALL') {
            results = results.filter(e => e.category === category);
        }
        if (city && city !== 'ALL') {
            results = results.filter(e => e.city === city);
        }

        return NextResponse.json({ events: results });
    } catch (err: unknown) {
        console.error('[API /api/events] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
