import { exploreHref, type CatalogFilterState } from '@/lib/events/catalog-filters';

/**
 * Lot Carte B (B2) — vue d'Explorer gardée dans l'adresse : `?vue=carte` ou `?vue=calendrier` (la Liste, vue par défaut,
 * n'écrit rien). Mêmes filtres partagés pour les trois vues.
 */
export const EXPLORE_MODES = ['liste', 'carte', 'calendrier'] as const;
export type ExploreMode = typeof EXPLORE_MODES[number];

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

export function parseExploreMode(params: RawParams): ExploreMode {
    const raw = params instanceof URLSearchParams ? params.get('vue') : params.vue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value === 'carte' || value === 'calendrier' ? value : 'liste';
}

/** Adresse de l'Explorer pour ces filtres et cette vue. */
export function exploreModeHref(f: Partial<CatalogFilterState>, mode: ExploreMode): string {
    const base = exploreHref(f);
    if (mode === 'liste') return base;
    return `${base}${base.includes('?') ? '&' : '?'}vue=${mode}`;
}
