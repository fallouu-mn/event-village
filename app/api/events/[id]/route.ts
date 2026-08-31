import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events/[id]
 * Récupère le détail complet d'un événement publié et ses catégories de billets
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const eventId = params.id;
        if (!eventId) {
            return NextResponse.json({ error: 'ID événement requis.' }, { status: 400 });
        }

        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId);
        if (!isUuid) {
            return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
        }

        const supabase = getServiceRoleClient();

        const { data: event, error } = await supabase
            .from('events')
            .select(`
                id,
                title,
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
                partners(id, company_name, commercial_name, logo_url),
                ticket_categories(id, name, price, total_quantity, sold_quantity, description)
            `)
            .eq('id', eventId)
            .maybeSingle();

        if (error || !event) {
            return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
        }

        const startDate = new Date(event.start_date);
        const dateFormatted = startDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        const timeFormatted = event.start_time ? event.start_time.substring(0, 5) : '20:00';

        const partnerData = Array.isArray(event.partners) ? event.partners[0] : event.partners;

        return NextResponse.json({
            event: {
                id: event.id,
                title: event.title,
                description: event.description || 'Aucune description disponible pour cet événement.',
                subtitle: partnerData?.commercial_name || partnerData?.company_name || 'Organisateur Officiel',
                organizer: {
                    id: partnerData?.id,
                    name: partnerData?.commercial_name || partnerData?.company_name || 'Organisateur Officiel',
                    avatar: partnerData?.logo_url || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
                },
                posterUrl: event.image_url || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
                dateFormatted,
                time: timeFormatted,
                venue: event.location || 'Dakar, Sénégal',
                category: 'CONCERT',
                status: event.status,
                categories: (event.ticket_categories || []).map((cat: any) => ({
                    id: cat.id,
                    name: cat.name,
                    price: Number(cat.price),
                    priceFormatted: `${Number(cat.price).toLocaleString('fr-FR')} FCFA`,
                    totalQuantity: cat.total_quantity,
                    soldQuantity: cat.sold_quantity,
                    isSoldOut: (cat.sold_quantity || 0) >= cat.total_quantity,
                    description: cat.description || '',
                    perks: cat.name.toUpperCase().includes('VIP')
                        ? ['Accès Carré VIP', 'Coupe-file & Entrée prioritaire', 'Billet électronique QR sécurisé']
                        : ['Accès général fosse & gradins', 'Billet électronique QR sécurisé'],
                })),
            },
        });
    } catch (err: unknown) {
        console.error('[API /api/events/[id]] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
