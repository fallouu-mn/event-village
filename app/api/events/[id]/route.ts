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

        // Calculer les réservations temporaires (Hold Cart) actives pour cet événement
        const { data: activeHolds } = await supabase
            .from('payments')
            .select('metadata, created_at, held_expires_at')
            .eq('payment_target', 'TICKET')
            .eq('status', 'PENDING');

        const now = new Date();
        const categoryHeldMap: Record<string, number> = {};
        for (const p of activeHolds || []) {
            const expiresAt = p.held_expires_at || p.metadata?.held_expires_at;
            const isStillActive = expiresAt
                ? new Date(expiresAt).getTime() > now.getTime()
                : (now.getTime() - new Date(p.created_at).getTime()) < 10 * 60 * 1000;

            if (isStillActive) {
                if (p.metadata?.checkout_items && Array.isArray(p.metadata.checkout_items)) {
                    for (const item of p.metadata.checkout_items) {
                        categoryHeldMap[item.categoryId] = (categoryHeldMap[item.categoryId] || 0) + Number(item.quantity || 1);
                    }
                } else if (p.metadata?.category_id) {
                    categoryHeldMap[p.metadata.category_id] = (categoryHeldMap[p.metadata.category_id] || 0) + Number(p.metadata.quantity || 1);
                }
            }
        }

        const formattedTicketCategories = (event.ticket_categories || [])
            .filter((cat: any) => cat.is_visible !== false)
            .map((cat: any) => {
                const price = Number(cat.price);
                const saleStarted = !cat.sale_start || new Date(cat.sale_start) <= now;
                const saleEnded = cat.sale_end ? new Date(cat.sale_end) < now : false;
                const saleOpen = saleStarted && !saleEnded;
                const totalQuantity = Number(cat.total_quantity || 0);
                const soldQuantity = Number(cat.sold_quantity || 0);
                const dbHeldQuantity = Number(cat.held_quantity || 0);
                const heldQuantity = Math.max(dbHeldQuantity, categoryHeldMap[cat.id] || 0);
                const availableQuantity = Math.max(0, totalQuantity - soldQuantity - heldQuantity);
                const isSoldOut = soldQuantity >= totalQuantity;
                const isHeld = !isSoldOut && (soldQuantity + heldQuantity) >= totalQuantity;
                const isClosed = cat.is_active === false;
                const isAvailable = !isClosed && !isSoldOut && !isHeld && availableQuantity > 0 && saleOpen;

                const categoryStatus: 'ACTIVE' | 'SOLD_OUT' | 'HELD' | 'CLOSED' = isClosed
                    ? 'CLOSED'
                    : isSoldOut
                    ? 'SOLD_OUT'
                    : isHeld
                    ? 'HELD'
                    : 'ACTIVE';

                return {
                    id: cat.id,
                    name: cat.name,
                    price,
                    priceFormatted: price === 0 ? 'Gratuit' : `${price.toLocaleString('fr-FR')} FCFA`,
                    isFree: price === 0,
                    totalQuantity,
                    soldQuantity,
                    heldQuantity,
                    availableQuantity,
                    status: categoryStatus,
                    isSoldOut,
                    isHeld,
                    isClosed,
                    isAvailable,
                    saleOpen,
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

        const isFullySoldOut = formattedTicketCategories.length > 0 &&
            formattedTicketCategories.every((cat) => cat.isSoldOut || cat.isClosed);
        const hasAvailableTickets = formattedTicketCategories.some((cat) => cat.isAvailable);

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
                isFullySoldOut,
                hasAvailableTickets,
                program: (event.program as any[]) || [],
                practicalInfo: {
                    address: practicalInfo?.address || null,
                    accessNotes: practicalInfo?.accessNotes || null,
                    parking: practicalInfo?.parking || null,
                    contactPhone: practicalInfo?.contactPhone || null,
                    rules: practicalInfo?.rules || null,
                },
                categories: formattedTicketCategories,
            },
        });
    } catch (err: unknown) {
        console.error('[API /api/events/[id]] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}
