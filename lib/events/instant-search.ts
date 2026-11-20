/**
 * Design 1d (point 9) — recherche instantanée : résultats pendant la saisie, calculés par le serveur sur le catalogue
 * public (même règle que la recherche d'Explorer : titre, lieu, organisateur, ville, comparés sur leur forme pliée),
 * 8 résultats au plus. Aucune donnée personnelle. Module sans dépendance serveur (route et tests).
 */
import { cardPrice, cardWhen } from '@/lib/events/catalog-display';
import type { CatalogEventDto } from '@/lib/events/catalog.server';
import { isProjectStorageImage } from '@/lib/events/event-image';
import { foldText } from '@/lib/text/fold';

export const INSTANT_SEARCH_LIMIT = 8;
export const INSTANT_SEARCH_MIN = 2;
export const INSTANT_SEARCH_MAX = 60;

export interface InstantResult {
    id: string;
    title: string;
    /** « sam. 21 nov. · 20:00 ». */
    when: string;
    /** « Dakar · Grand Théâtre ». */
    place: string;
    price: string;
    imageUrl: string | null;
    posterColor: string;
}

export interface InstantSearchResponse {
    q: string;
    results: InstantResult[];
    /** Nombre total de correspondances (« Voir les 12 résultats »). */
    total: number;
}

/** Saisie nettoyée : caractères de contrôle retirés, espaces regroupés, 60 caractères au plus. */
export function cleanInstantQuery(raw: string | null | undefined): string {
    return String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, INSTANT_SEARCH_MAX);
}

function cityLabel(city: string | null | undefined): string {
    if (!city) return '';
    return city.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_m, sep: string, ch: string) => `${sep}${ch.toUpperCase()}`);
}

export function instantSearch(events: readonly CatalogEventDto[], rawQuery: string | null | undefined): InstantSearchResponse {
    const q = cleanInstantQuery(rawQuery);
    const folded = foldText(q);
    if (folded.length < INSTANT_SEARCH_MIN) return { q, results: [], total: 0 };
    const matches = events.filter((e) => [e.title, e.venue, e.subtitle ?? '', e.city ?? ''].some((field) => foldText(field).includes(folded)));
    return {
        q,
        total: matches.length,
        results: matches.slice(0, INSTANT_SEARCH_LIMIT).map((e) => {
            const price = cardPrice({ price: e.price, paidFrom: e.paidFrom, saleLabel: e.saleLabel });
            return {
                id: e.id,
                title: e.title,
                when: cardWhen(e.startsAt, e.timeFormatted),
                place: [cityLabel(e.city), e.venue].filter(Boolean).join(' · '),
                price: [price.lead, price.value].filter(Boolean).join(' '),
                imageUrl: isProjectStorageImage(e.imageUrl) ? e.imageUrl : null,
                posterColor: e.posterColor,
            };
        }),
    };
}
