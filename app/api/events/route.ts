import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getCategoryLabel } from '@/lib/constants/event-categories';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events
 * Récupère tous les événements publiés pour le catalogue public B2C
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
                ticket_categories(id, name, price, total_quantity, sold_quantity, is_active)
            `)
            .eq('status', 'PUBLIE')
            .order('start_date', { ascending: true });

        const { data: events, error } = await query;

        if (error) {
            console.error('[API /api/events] Erreur Supabase:', error);
            return NextResponse.json({ error: 'Impossible de charger les événements.' }, { status: 500 });
        }

        const formatted = (events || []).map((evt: any) => {
            const startDate = new Date(evt.start_date);
            const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];
            const monthShort = months[startDate.getMonth()] || 'SEP';
            const dayNumber = String(startDate.getDate()).padStart(2, '0');
            const timeFormatted = evt.start_time ? evt.start_time.substring(0, 5) : '20:00';
            const dateFormatted = `${dayNumber} ${monthShort} ${startDate.getFullYear()}`;

            const activeCategories = (evt.ticket_categories || []).filter((c: any) => c.is_active);
            const minPrice = activeCategories.length > 0
                ? Math.min(...activeCategories.map((c: any) => Number(c.price)))
                : 0;

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
                priceFormatted: minPrice === 0 ? 'Gratuit' : `${minPrice.toLocaleString('fr-FR')} FCFA`,
                ticketCategories: activeCategories,
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
