import { getFeatureFlags } from '@/lib/features/flags';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { dishVisual } from './dish-visual';
import type {
    MenuHours, MenuOption, MenuProduct, MenuSpot, MenuWindow, MenuZone, OrderMode, ProductAvailability, VenueMenu,
} from './menu-types';

/**
 * Lot 12b — lecture de la carte des plats d'un établissement (order_venue_menu, rôle de service). Rien n'est servi si le
 * service des commandes est fermé, si l'établissement n'est pas listé (inactif, non validé, partenaire non VALIDE) ou
 * s'il ne prend pas de commande : null, que la route et la page rendent en 404. Un identifiant qui n'est pas un UUID
 * complet n'est jamais lu (un identifiant partiel répond 404 : tests/audit/cv11a-4-droits.test.ts:339-346).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const rows = (v: unknown): Row[] => (Array.isArray(v) ? v.filter((x): x is Row => !!x && typeof x === 'object') : []);
const MODES: readonly OrderMode[] = ['LIVRAISON', 'RETRAIT', 'SUR_PLACE'];
const AVAILABILITY: readonly ProductAvailability[] = ['DISPONIBLE', 'INDISPONIBLE', 'EPUISE', 'SUSPENDU'];

function option(r: Row): MenuOption {
    return { id: String(r.id), name: String(r.name ?? ''), price: num(r.price) };
}

function product(r: Row, categories: Map<string, string>): MenuProduct {
    const availability = AVAILABILITY.includes(r.availability as ProductAvailability) ? (r.availability as ProductAvailability) : 'INDISPONIBLE';
    return {
        id: String(r.id),
        name: String(r.name ?? ''),
        description: str(r.description),
        price: num(r.price),
        image: str(r.image),
        visual: dishVisual(categories.get(String(r.category_id ?? '')) ?? null, str(r.name)),
        categoryId: str(r.category_id),
        availability,
        regulated: r.regulated === true,
        inReview: r.in_review === true,
        orderable: r.orderable === true,
        daily: r.daily === true,
        portionsLeft: r.portions_left === null || r.portions_left === undefined ? null : num(r.portions_left),
        portionsTotal: r.portions_total === null || r.portions_total === undefined ? null : num(r.portions_total),
        options: rows(r.options).map(option),
    };
}

/** Mise en forme de la réponse de order_venue_menu (champs inconnus ignorés, jamais rendus tels quels). */
export function venueMenuFrom(data: unknown): VenueMenu | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as Row;
    const venue = (d.venue ?? {}) as Row;
    const ordering = (d.ordering ?? {}) as Row;
    if (typeof venue.id !== 'string') return null;
    const categoryNames = new Map(rows(d.categories).map((c) => [String(c.id), String(c.name ?? '')]));
    return {
        venue: {
            id: venue.id,
            name: String(venue.name ?? ''),
            kind: String(venue.kind ?? 'RESTAURANT'),
            city: str(venue.city),
            address: str(venue.address),
            description: str(venue.description),
            photos: Array.isArray(venue.photos) ? venue.photos.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [],
        },
        ordering: {
            modes: (Array.isArray(ordering.modes) ? ordering.modes : []).filter((m): m is OrderMode => MODES.includes(m as OrderMode)),
            depositPercent: ordering.deposit_percent === null || ordering.deposit_percent === undefined ? null : num(ordering.deposit_percent),
            payOnHandover: ordering.pay_on_handover === true,
            prepMinutes: num(ordering.prep_minutes),
            serviceFeeRate: num(ordering.service_fee_rate),
            asapAvailable: ordering.asap_available === true,
            closedUntil: typeof ordering.closed_until === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(ordering.closed_until) ? ordering.closed_until : null,
            now: String(ordering.now ?? ''),
            windows: (Array.isArray(ordering.windows) ? ordering.windows : [])
                .filter((w): w is [string, string] => Array.isArray(w) && typeof w[0] === 'string' && typeof w[1] === 'string')
                .map((w): MenuWindow => [w[0], w[1]]),
        },
        hours: (Array.isArray(d.hours) ? d.hours : [])
            .filter((h): h is [number, string, string] => Array.isArray(h) && h.length === 3)
            .map((h): MenuHours => [Number(h[0]), String(h[1]), String(h[2])]),
        zones: rows(d.zones).map((z): MenuZone => ({ id: String(z.id), name: String(z.name ?? ''), fee: num(z.fee), minOrder: num(z.min_order) })),
        spots: rows(d.spots).map((s): MenuSpot => ({ id: String(s.id), label: String(s.label ?? ''), zone: str(s.zone) })),
        categories: rows(d.categories).map((c) => ({ id: String(c.id), name: String(c.name ?? '') })),
        products: rows(d.products).map((r) => product(r, categoryNames)),
    };
}

/** Carte des plats d'un établissement, ou null (introuvable, non listé, fermé à la commande, service fermé). */
export async function readVenueMenu(venueId: string): Promise<VenueMenu | null> {
    if (!UUID_RE.test(venueId)) return null;
    const { data, error } = await getServiceRoleClient().rpc('order_venue_menu', { p_venue_id: venueId });
    if (error) throw new Error(`order_venue_menu : ${error.message}`);
    return venueMenuFrom(data);
}

/**
 * L'établissement prend-il des commandes en ligne en ce moment ? (bouton « Commander » de la fiche de l'établissement).
 * Mêmes conditions que la carte des plats, sans la lire en entier.
 */
export async function venueTakesOrders(venueId: string): Promise<boolean> {
    if (!UUID_RE.test(venueId)) return false;
    const flags = await getFeatureFlags();
    if (!flags.orders) return false;
    const { data: venue, error } = await getServiceRoleClient()
        .from('venues').select('id, orders_open, is_active, validation_status, partners!inner(status)')
        .eq('id', venueId).maybeSingle();
    if (error) throw new Error(`établissement illisible : ${error.message}`);
    const partner = (venue as Row | null)?.partners as Row | Row[] | undefined;
    const partnerStatus = Array.isArray(partner) ? partner[0]?.status : partner?.status;
    return !!venue && venue.orders_open === true && venue.is_active === true
        && venue.validation_status === 'VALIDEE' && partnerStatus === 'VALIDE';
}
