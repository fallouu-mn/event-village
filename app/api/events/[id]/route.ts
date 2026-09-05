import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getCategoryLabel } from '@/lib/constants/event-categories';

export const dynamic = 'force-dynamic';

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
                slug,
                title,
                category,
                description,
                location,
                city,
                latitude,
                longitude,
                start_date,
                start_time,
                end_date,
                end_time,
                image_url,
                gallery_urls,
                capacity,
                status,
                program,
                practical_info,
                created_at,
                partner_id,
                partners(id, company_name, commercial_name, logo_url),
                ticket_categories(id, name, price, total_quantity, sold_quantity, description, is_active, is_visible, sale_start, sale_end, max_per_order)
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

        const activeTicketCategories = (event.ticket_categories || [])
            .filter((cat: any) => cat.is_active !== false && cat.is_visible !== false)
            .map((cat: any) => {
                const price = Number(cat.price);
                const now = new Date();
                const saleStarted = !cat.sale_start || new Date(cat.sale_start) <= now;
                const saleEnded = cat.sale_end ? new Date(cat.sale_end) < now : false;

                return {
                    id: cat.id,
                    name: cat.name,
                    price,
                    priceFormatted: price === 0 ? 'Gratuit' : `${price.toLocaleString('fr-FR')} FCFA`,
                    isFree: price === 0,
                    totalQuantity: cat.total_quantity,
                    soldQuantity: cat.sold_quantity || 0,
                    isSoldOut: (cat.sold_quantity || 0) >= cat.total_quantity,
                    saleOpen: saleStarted && !saleEnded,
                    saleStarted,
                    saleEnded,
                    saleStart: cat.sale_start || null,
                    saleEnd: cat.sale_end || null,
                    maxPerOrder: cat.max_per_order ?? 10,
                    description: cat.description || '',
                    perks: cat.name.toUpperCase().includes('VIP')
                        ? ['Accès Carré VIP', 'Coupe-file & Entrée prioritaire', 'Billet électronique QR sécurisé']
                        : ['Accès général fosse & gradins', 'Billet électronique QR sécurisé'],
                };
            });

        const practicalInfo = event.practical_info as {
            address?: string;
            accessNotes?: string;
            parking?: string;
            contactPhone?: string;
            rules?: string;
        } | null;

        return NextResponse.json({
            event: {
                id: event.id,
                slug: event.slug || event.id,
                title: event.title,
                category: event.category || null,
                categoryLabel: getCategoryLabel(event.category),
                description: event.description || 'Aucune description disponible pour cet événement.',
                subtitle: partnerData?.commercial_name || partnerData?.company_name || 'Organisateur Officiel',
                organizer: {
                    id: partnerData?.id,
                    name: partnerData?.commercial_name || partnerData?.company_name || 'Organisateur Officiel',
                    avatar: partnerData?.logo_url || null,
                },
                posterUrl: event.image_url || null,
                galleryUrls: event.gallery_urls || [],
                dateFormatted,
                time: timeFormatted,
                venue: event.location || 'Dakar, Sénégal',
                city: event.city || null,
                latitude: event.latitude || null,
                longitude: event.longitude || null,
                capacity: event.capacity || null,
                status: event.status,
                program: (event.program as any[]) || [],
                practicalInfo: {
                    address: practicalInfo?.address || null,
                    accessNotes: practicalInfo?.accessNotes || null,
                    parking: practicalInfo?.parking || null,
                    contactPhone: practicalInfo?.contactPhone || null,
                    rules: practicalInfo?.rules || null,
                },
                categories: activeTicketCategories,
            },
        });
    } catch (err: unknown) {
        console.error('[API /api/events/[id]] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
