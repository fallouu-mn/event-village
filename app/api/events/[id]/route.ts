import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getCategoryLabel } from '@/lib/constants/event-categories';
import { formatEventEnd } from '@/lib/events/catalog.server';
import { eventEndAt } from '@/lib/events/event-end';
import { lowStockThreshold } from '@/lib/events/low-stock.server';
import { isEventId, isPublicEvent, type PublicEventStatus } from '@/lib/events/public-status';
import { formatSnPhone, toSenegaleseContactE164 } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

type BannerKind = Exclude<PublicEventStatus, 'PUBLIE'>;

const BANNERS: Record<BannerKind, { title: string; message: string }> = {
    SUSPENDU: {
        title: 'Événement suspendu',
        message: 'La billetterie est momentanément fermée par l’organisation. Les billets déjà achetés restent valables ; vous serez informé de la suite.',
    },
    ANNULE: {
        title: 'Événement annulé',
        message: 'Cet événement n’aura pas lieu. Les billets payés en ligne sont remboursés automatiquement.',
    },
    TERMINE: {
        title: 'Événement terminé',
        message: 'Cet événement a eu lieu. La billetterie est fermée.',
    },
};

const REFUND_INFO =
    'Les billets payés en ligne sont remboursés automatiquement sur le compte Mobile Money utilisé pour l’achat, '
    + 'frais de service compris. Les billets réglés en espèces sont remboursés par l’organisateur.';

const NOT_FOUND = () => NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });

/**
 * GET /api/events/[id] — fiche publique (lot 5, contrat E).
 *  - BROUILLON, EN_ATTENTE, VALIDE : 404 pour tous (l'aperçu du propriétaire passe par /api/partner/events/[id]) ;
 *    lot 9 ter (R106 a) : TERMINE sans publication (ended_unpublished) aussi ;
 *  - PUBLIE, SUSPENDU, ANNULE, TERMINE : 200 avec `purchasable` (PUBLIE, fin à venir, au moins une catégorie
 *    achetable) et `banner` (null pour PUBLIE) ; ANNULE : `cancellation { publicNotice, cancelledAt, refundInfo }`,
 *    jamais le motif interne ;
 *  - catégories actives et vendues en ligne seulement ; stock en tranches (AVAILABLE, LOW avec le restant, SOLD_OUT),
 *    calculé sur les compteurs de la catégorie (réservations comprises), sans lecture des paiements ;
 *  - lot 9 ter (R96) : `practicalInfo.contactPhone` formaté (« 77 123 45 67 », sinon la valeur telle quelle) et
 *    `practicalInfo.contactPhoneTel` (E.164 du numéro sénégalais, null sinon).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const eventId = params.id;
        if (!isEventId(eventId)) return NOT_FOUND();

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
                ended_unpublished,
                program,
                practical_info,
                created_at,
                partner_id,
                partners(id, company_name, commercial_name, logo_url),
                ticket_categories(id, name, price, total_quantity, sold_quantity, held_quantity, description, is_active, sale_online, sale_start, sale_end, max_per_order)
            `)
            .eq('id', eventId)
            .maybeSingle();

        if (error) {
            console.error('[API /api/events/[id]] lecture de l’événement impossible :', error.message);
            return NextResponse.json({ error: 'Impossible de charger l’événement.' }, { status: 500 });
        }
        // Lot 9 ter (R106 a) : un événement terminé sans avoir été publié répond 404, comme un statut non public.
        if (!isPublicEvent(event)) return NOT_FOUND();

        const status = String(event.status) as PublicEventStatus;
        const now = new Date();
        const ended = eventEndAt(event).getTime() <= now.getTime();
        const threshold = await lowStockThreshold();

        const startDate = new Date(event.start_date);
        const dateFormatted = startDate.toLocaleDateString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'Africa/Dakar',
        });
        const timeFormatted = event.start_time ? event.start_time.substring(0, 5) : '20:00';
        const endFormatted = formatEventEnd(event);
        const partnerData = Array.isArray(event.partners) ? event.partners[0] : event.partners;

        type CategoryRow = {
            id: string; name: string; price: number | string; total_quantity: number | null; sold_quantity: number | null;
            held_quantity: number | null; description: string | null; is_active: boolean; sale_online: boolean;
            sale_start: string | null; sale_end: string | null; max_per_order: number | null;
        };
        const rows = ((event.ticket_categories ?? []) as CategoryRow[]).filter((c) => c.is_active === true && c.sale_online === true);

        const categories = rows.map((cat) => {
            const price = Number(cat.price);
            const saleStarted = !cat.sale_start || new Date(cat.sale_start) <= now;
            const saleEnded = cat.sale_end ? new Date(cat.sale_end) <= now : false;
            const saleOpen = saleStarted && !saleEnded;
            const remaining = Math.max(0, Number(cat.total_quantity ?? 0) - Number(cat.sold_quantity ?? 0) - Number(cat.held_quantity ?? 0));
            const availability: 'AVAILABLE' | 'LOW' | 'SOLD_OUT' = remaining === 0 ? 'SOLD_OUT' : remaining <= threshold ? 'LOW' : 'AVAILABLE';
            const isSoldOut = availability === 'SOLD_OUT';
            const isAvailable = status === 'PUBLIE' && !ended && saleOpen && !isSoldOut;
            return {
                id: cat.id,
                name: cat.name,
                price,
                priceFormatted: price === 0 ? 'Gratuit' : `${price.toLocaleString('fr-FR')} F CFA`,
                isFree: price === 0,
                availability,
                /** Restant affiché seulement dans la tranche « bientôt complet » (contrat O). */
                remainingHint: availability === 'LOW' ? remaining : null,
                ...(availability === 'LOW' ? { availableQuantity: remaining } : availability === 'SOLD_OUT' ? { availableQuantity: 0 } : {}),
                status: isSoldOut ? 'SOLD_OUT' : 'ACTIVE',
                isSoldOut,
                isHeld: false,
                isClosed: false,
                isAvailable,
                saleOpen,
                saleStarted,
                saleEnded,
                saleStart: cat.sale_start || null,
                saleEnd: cat.sale_end || null,
                maxPerOrder: cat.max_per_order ?? 10,
                description: cat.description || '',
            };
        });

        const hasAvailableTickets = categories.some((c) => c.isAvailable);
        const purchasable = status === 'PUBLIE' && !ended && hasAvailableTickets;
        const isFullySoldOut = categories.length > 0 && categories.every((c) => c.isSoldOut);
        // Lot 9 bis (R104, D-txt 2) : la fiche dit pourquoi rien n'est en vente. Places retenues par des paiements en
        // cours (elles peuvent se libérer) ; ventes en ligne closes pour toutes les catégories (« Revenez bientôt » faux).
        const hasHeldSeats = rows.some((c) => Number(c.held_quantity ?? 0) > 0);
        const salesEnded = categories.length > 0 && categories.every((c) => c.saleEnded);
        const banner = status === 'PUBLIE' ? null : { kind: status, ...BANNERS[status] };

        let cancellation: { publicNotice: string; cancelledAt: string; refundInfo: string } | undefined;
        if (status === 'ANNULE') {
            const { data: c, error: cErr } = await supabase
                .from('event_cancellations')
                .select('public_notice, cancelled_at')
                .eq('event_id', event.id)
                .maybeSingle();
            if (cErr) {
                console.error('[API /api/events/[id]] annulation illisible :', cErr.message);
                return NextResponse.json({ error: 'Impossible de charger l’événement.' }, { status: 500 });
            }
            cancellation = {
                publicNotice: c?.public_notice || BANNERS.ANNULE.message,
                cancelledAt: c?.cancelled_at ?? String(event.created_at),
                refundInfo: REFUND_INFO,
            };
        }

        const practicalInfo = event.practical_info as {
            address?: string;
            accessNotes?: string;
            parking?: string;
            contactPhone?: string;
            rules?: string;
        } | null;
        // Lot 9 ter (R96) : numéro de contact affiché « 77 123 45 67 » et lien tel: en E.164 ; une ancienne saisie libre
        // non reconnue est affichée telle quelle, sans lien E.164 (la page ne fait aucun formatage : pas de code client).
        const contactPhoneRaw = practicalInfo?.contactPhone || null;

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
                // Lot 9 bis (R36, B59) : fin montrée seulement si une date de fin est saisie.
                ...(endFormatted ? { endFormatted } : {}),
                venue: event.location || 'Dakar, Sénégal',
                city: event.city || null,
                latitude: event.latitude || null,
                longitude: event.longitude || null,
                capacity: event.capacity || null,
                status,
                purchasable,
                banner,
                ...(cancellation ? { cancellation } : {}),
                isFullySoldOut,
                hasHeldSeats,
                salesEnded,
                hasAvailableTickets,
                program: (event.program as unknown[]) || [],
                practicalInfo: {
                    address: practicalInfo?.address || null,
                    accessNotes: practicalInfo?.accessNotes || null,
                    parking: practicalInfo?.parking || null,
                    contactPhone: contactPhoneRaw ? (formatSnPhone(contactPhoneRaw) ?? contactPhoneRaw) : null,
                    contactPhoneTel: contactPhoneRaw ? toSenegaleseContactE164(contactPhoneRaw) : null,
                    rules: practicalInfo?.rules || null,
                },
                categories,
            },
        });
    } catch (err: unknown) {
        console.error('[API /api/events/[id]] Exception:', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500 });
    }
}
