import { unstable_cache } from 'next/cache';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getCategoryLabel } from '@/lib/constants/event-categories';
import { formatEventEnd } from '@/lib/events/catalog.server';
import { eventEndAt } from '@/lib/events/event-end';
import { eventStartAt } from '@/lib/events/live-status';
import { lowStockThreshold } from '@/lib/events/low-stock.server';
import { isEventId, isPublicEvent, type PublicEventStatus } from '@/lib/events/public-status';
import { posterBlurOrNull, posterColorOrFallback } from '@/lib/events/poster-color';
import { isScanCategoryColor } from '@/lib/scan/scan-result';
import { formatSnPhone, toSenegaleseContactE164 } from '@/lib/validations/auth';
import {
    POSTPONEMENT_MIN_MS,
    REFUND_INFO,
    withClock,
    type BannerKind,
    type ProgramItem,
    type PublicCategory,
    type PublicEventDetail,
    type RefundRule,
} from '@/lib/events/event-detail';

/**
 * Design 1b (points 1, 6, 11) — lecture serveur de la fiche publique d'un événement, source unique de GET /api/events/[id]
 * (toujours à jour : temps réel de la fiche) et de la page app/events/[id] (préparée par le serveur, mise en cache 60 s).
 *
 * Règles reprises de la route (lot 5, contrat E ; lots 9 bis et 9 ter) :
 *  - BROUILLON, EN_ATTENTE, VALIDE, inconnu, identifiant illisible, TERMINE sans publication : null (404 pour tous) ;
 *  - PUBLIE, SUSPENDU, ANNULE, TERMINE : `purchasable` (PUBLIE, fin à venir, une catégorie achetable), `banner` ; ANNULE :
 *    `cancellation { publicNotice, cancelledAt, refundInfo }`, jamais le motif interne ;
 *  - catégories actives et vendues en ligne seulement ; stock en tranches (AVAILABLE, LOW avec le restant, SOLD_OUT).
 * Ajouts du design 1b :
 *  - `scanColor` de chaque catégorie (couleur du contrôle, palette fermée) ;
 *  - `counterSale` : vrai si une catégorie active est vendue au guichet avec des places, l'événement publié et pas fini ;
 *    rien d'autre sur le guichet (ni nom, ni prix, ni quantité, ni caisse) ;
 *  - `refund` : la ligne « Remboursement » seulement quand une règle vraie s'applique : annulation (event_cancel →
 *    refund_request, espèces par l'organisateur) ou report de plus de 24 h d'un événement qui n'a pas commencé
 *    (ticket_postponement_refund_open, lue sur event_start_changes : anciens débuts seulement, jamais l'auteur) ;
 *  - `startsAt`, `endsAt` : début et fin retenue (« En cours » calculé sur le téléphone).
 * Une erreur de lecture est levée (EventDetailUnavailable) : jamais présentée comme une absence (L49).
 */

export class EventDetailUnavailable extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'EventDetailUnavailable';
    }
}

type SheetBannerKind = Exclude<PublicEventStatus, 'PUBLIE'>;

const BANNERS: Record<SheetBannerKind, { title: string; message: string }> = {
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

type CategoryRow = {
    id: string; name: string; price: number | string; total_quantity: number | null; sold_quantity: number | null;
    held_quantity: number | null; description: string | null; is_active: boolean; sale_online: boolean;
    sale_counter: boolean | null; sale_start: string | null; sale_end: string | null; max_per_order: number | null;
    scan_color: string | null;
};

function remainingOf(c: CategoryRow): number {
    return Math.max(0, Number(c.total_quantity ?? 0) - Number(c.sold_quantity ?? 0) - Number(c.held_quantity ?? 0));
}

/**
 * Fiche publique à l'heure donnée (route de l'API, lue sans cache) : l'instantané sans heure, puis withClock.
 * null : événement non public. Lève EventDetailUnavailable si la base ne répond pas.
 */
export async function buildPublicEventDetail(eventId: string, now: Date = new Date()): Promise<PublicEventDetail | null> {
    const snapshot = await buildPublicEventSnapshot(eventId);
    return snapshot ? withClock(snapshot, now) : null;
}

/**
 * Design 1c bis (point 3, erreur 418) — fiche publique SANS HEURE, la seule mise en cache : les faits (dates de vente,
 * début, fin, statut, stock, report de plus de 24 h, catégorie vendue au guichet) sans aucun état qui dépend de
 * l'heure (withClock(…, null) : horloge inconnue). La billetterie applique l'heure du téléphone après le chargement.
 */
export async function buildPublicEventSnapshot(eventId: string): Promise<PublicEventDetail | null> {
    if (!isEventId(eventId)) return null;
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
            poster_color,
            poster_blur,
            gallery_urls,
            capacity,
            status,
            ended_unpublished,
            program,
            practical_info,
            created_at,
            partner_id,
            partners(id, company_name, commercial_name, logo_url),
            ticket_categories(id, name, price, total_quantity, sold_quantity, held_quantity, description, is_active, sale_online, sale_counter, sale_start, sale_end, max_per_order, scan_color)
        `)
        .eq('id', eventId)
        .maybeSingle();
    if (error) throw new EventDetailUnavailable(`lecture de l’événement impossible : ${error.message}`);
    // Lot 9 ter (R106 a) : un événement terminé sans avoir été publié répond comme un statut non public.
    if (!isPublicEvent(event)) return null;

    const status = String(event.status) as PublicEventStatus;
    const times = { start_date: String(event.start_date), start_time: event.start_time ?? null, end_date: event.end_date ?? null, end_time: event.end_time ?? null };
    const startsAt = eventStartAt(times);
    const endsAt = eventEndAt(times);
    let threshold: number;
    try {
        threshold = await lowStockThreshold();
    } catch (err) {
        throw new EventDetailUnavailable(err instanceof Error ? err.message : String(err));
    }

    const dateFormatted = new Date(event.start_date).toLocaleDateString('fr-FR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Africa/Dakar',
    });
    const timeFormatted = event.start_time ? String(event.start_time).substring(0, 5) : '20:00';
    const endFormatted = formatEventEnd(event);
    const partnerData = Array.isArray(event.partners) ? event.partners[0] : event.partners;

    const allRows = (event.ticket_categories ?? []) as CategoryRow[];
    const rows = allRows.filter((c) => c.is_active === true && c.sale_online === true);

    const categories: PublicCategory[] = rows.map((cat) => {
        const price = Number(cat.price);
        const remaining = remainingOf(cat);
        const availability: PublicCategory['availability'] = remaining === 0 ? 'SOLD_OUT' : remaining <= threshold ? 'LOW' : 'AVAILABLE';
        const isSoldOut = availability === 'SOLD_OUT';
        return {
            id: cat.id,
            name: cat.name,
            price,
            priceFormatted: price === 0 ? 'Gratuit' : `${price.toLocaleString('fr-FR')} F CFA`,
            isFree: price === 0,
            availability,
            remainingHint: availability === 'LOW' ? remaining : null,
            ...(availability === 'LOW' ? { availableQuantity: remaining } : availability === 'SOLD_OUT' ? { availableQuantity: 0 } : {}),
            status: isSoldOut ? 'SOLD_OUT' : 'ACTIVE',
            isSoldOut,
            isHeld: false,
            isClosed: false,
            // Sans heure : withClock les calcule (route de l'API : heure du serveur ; billetterie : heure du téléphone)
            isAvailable: false,
            saleOpen: false,
            saleStarted: false,
            saleEnded: false,
            saleStart: cat.sale_start || null,
            saleEnd: cat.sale_end || null,
            maxPerOrder: cat.max_per_order ?? 10,
            description: cat.description || '',
            scanColor: isScanCategoryColor(cat.scan_color) ? cat.scan_color : null,
        };
    });

    const isFullySoldOut = categories.length > 0 && categories.every((c) => c.isSoldOut);
    // Lot 9 bis (R104, D-txt 2) : places retenues par des paiements en cours ; ventes en ligne closes partout.
    const hasHeldSeats = rows.some((c) => Number(c.held_quantity ?? 0) > 0);
    // Design 1b (point 11) : guichet sur place, en un seul booléen ; design 1c bis : sans heure (withClock ajoute « publié et
    // pas fini »).
    const counterCapable = allRows.some((c) => c.is_active === true && c.sale_counter === true && remainingOf(c) > 0);
    const banner = status === 'PUBLIE' ? null : { kind: status as BannerKind, ...BANNERS[status as SheetBannerKind] };

    let cancellation: PublicEventDetail['cancellation'];
    let refund: RefundRule | null = null;
    if (status === 'ANNULE') {
        const { data: c, error: cErr } = await supabase
            .from('event_cancellations')
            .select('public_notice, cancelled_at')
            .eq('event_id', event.id)
            .maybeSingle();
        if (cErr) throw new EventDetailUnavailable(`annulation illisible : ${cErr.message}`);
        cancellation = {
            publicNotice: c?.public_notice || BANNERS.ANNULE.message,
            cancelledAt: c?.cancelled_at ?? String(event.created_at),
            refundInfo: REFUND_INFO,
        };
        refund = { kind: 'ANNULATION', text: REFUND_INFO };
    }
    let postponedOver24h = false;
    if (status === 'PUBLIE' || status === 'SUSPENDU') {
        // Report de plus de 24 h (ticket_postponement_refund_open) : le début actuel dépasse un ancien début de plus de 24 h.
        const { data: changes, error: chErr } = await supabase
            .from('event_start_changes')
            .select('old_start_at')
            .eq('event_id', event.id);
        if (chErr) throw new EventDetailUnavailable(`reports illisibles : ${chErr.message}`);
        const postponed = (changes ?? []).some((row) => {
            const old = Date.parse(String((row as { old_start_at?: unknown }).old_start_at ?? ''));
            return Number.isFinite(old) && startsAt.getTime() - old > POSTPONEMENT_MIN_MS;
        });
        // Le remboursement d'un report vaut jusqu'au début : withClock le dit à l'heure donnée, jamais la fiche en cache
        postponedOver24h = postponed;
    }

    const practicalInfo = event.practical_info as {
        address?: string; accessNotes?: string; parking?: string; contactPhone?: string; rules?: string;
    } | null;
    // Lot 9 ter (R96) : numéro de contact affiché « 77 123 45 67 » et lien tel: en E.164 ; une ancienne saisie libre
    // non reconnue est affichée telle quelle, sans lien E.164.
    const contactPhoneRaw = practicalInfo?.contactPhone || null;
    const organizerName = partnerData?.commercial_name || partnerData?.company_name || 'Organisateur Officiel';

    return withClock({
        id: event.id,
        slug: event.slug || event.id,
        title: event.title,
        category: event.category || null,
        categoryLabel: getCategoryLabel(event.category),
        description: event.description || 'Aucune description disponible pour cet événement.',
        subtitle: organizerName,
        organizer: { id: partnerData?.id, name: organizerName, avatar: partnerData?.logo_url || null },
        posterUrl: event.image_url || null,
        posterColor: posterColorOrFallback(event.poster_color),
        posterBlur: posterBlurOrNull(event.poster_blur),
        galleryUrls: event.gallery_urls || [],
        dateFormatted,
        time: timeFormatted,
        ...(endFormatted ? { endFormatted } : {}),
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        venue: event.location || 'Dakar, Sénégal',
        city: event.city || null,
        latitude: event.latitude || null,
        longitude: event.longitude || null,
        capacity: event.capacity || null,
        status,
        purchasable: false,
        banner,
        ...(cancellation ? { cancellation } : {}),
        isFullySoldOut,
        hasHeldSeats,
        salesEnded: false,
        hasAvailableTickets: false,
        counterSale: false,
        refund,
        clockKnown: false,
        counterCapable,
        postponedOver24h,
        program: ((event.program as ProgramItem[] | null) || []),
        practicalInfo: {
            address: practicalInfo?.address || null,
            accessNotes: practicalInfo?.accessNotes || null,
            parking: practicalInfo?.parking || null,
            contactPhone: contactPhoneRaw ? (formatSnPhone(contactPhoneRaw) ?? contactPhoneRaw) : null,
            contactPhoneTel: contactPhoneRaw ? toSenegaleseContactE164(contactPhoneRaw) : null,
            rules: practicalInfo?.rules || null,
        },
        categories,
    }, null);
}

/** Durée du cache des pages publiques (consigne commune : 60 s). */
export const PUBLIC_SHEET_REVALIDATE_SECONDS = 60;

type CachedRead = { kind: 'public'; event: PublicEventDetail } | { kind: 'not-public' };

/**
 * Lecture mise en cache 60 s (cache de données de Next, `unstable_cache`) : les lectures Supabase sans cache restent à
 * l'intérieur, la page peut donc être préparée une fois et resservie. Une panne lève une erreur DANS la fonction
 * mise en cache : rien n'est gardé, la lecture suivante réessaie. Le cache ne contient que la fiche publique (aucune
 * session, aucun cookie lu).
 */
const cachedRead = unstable_cache(
    async (eventId: string): Promise<CachedRead> => {
        // Design 1c bis : seule la fiche sans heure est mise en cache (erreur 418)
        const event = await buildPublicEventSnapshot(eventId);
        return event ? { kind: 'public', event } : { kind: 'not-public' };
    },
    // Design 1c bis : forme changée (fiche sans heure) ; design 1d : couleur et image floutée de l'affiche. Nouvelle clé,
    // aucune ancienne entrée relue
    ['fiche-publique-v3'],
    { revalidate: PUBLIC_SHEET_REVALIDATE_SECONDS, tags: ['fiche-publique'] },
);

/** Hors du serveur Next (tests en Node), le cache de données n'existe pas : lecture directe, même résultat. */
function isMissingIncrementalCache(err: unknown): boolean {
    return err instanceof Error && err.message.includes('incrementalCache missing');
}

export type PublicSheetRead = CachedRead | { kind: 'unavailable' };

/**
 * Fiche publique pour la page (et le contrôle 404 de son layout) : `public`, `not-public` (identifiant illisible sans
 * lecture en base) ou `unavailable` (panne journalisée, jamais confondue avec une absence).
 */
export async function readPublicSheet(eventId: string): Promise<PublicSheetRead> {
    if (!isEventId(eventId)) return { kind: 'not-public' };
    try {
        try {
            return await cachedRead(eventId);
        } catch (err) {
            if (!isMissingIncrementalCache(err)) throw err;
            const event = await buildPublicEventSnapshot(eventId);
            return event ? { kind: 'public', event } : { kind: 'not-public' };
        }
    } catch (err) {
        console.error('[fiche publique] lecture impossible :', err instanceof Error ? err.message : String(err));
        return { kind: 'unavailable' };
    }
}
