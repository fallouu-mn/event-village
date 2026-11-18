import { EVENT_CATEGORIES } from '@/lib/constants/event-categories';
import { isFree, matchesWhen, type FilterableEvent } from '@/lib/events/catalog-filters';

/**
 * Design 1b (point 3) — sections de l'accueil, calculées sur le catalogue public (fonctions pures, testées sans base).
 * Chaque section n'existe que si elle a au moins un événement réel ; aucun chiffre n'est inventé (les nombres affichés
 * sont des comptes du catalogue).
 *  - « En ce moment » : événements en cours au moment du rendu, plus ceux qui commencent dans les 12 heures (le téléphone
 *    fait apparaître la rangée à la bonne minute, page ouverte) ;
 *  - « Cette semaine » : aujourd'hui et les six jours suivants (même règle que le filtre de l'Explorer) ;
 *  - « Gratuits » : au moins une catégorie gratuite achetable ;
 *  - « Par catégorie » : une rangée par catégorie qui a des événements, dans l'ordre d'EVENT_CATEGORIES.
 */

export const HOME_LIVE_HORIZON_MS = 12 * 3_600_000;
export const HOME_LIVE_MAX = 12;
export const HOME_WEEK_MAX = 6;
export const HOME_FREE_MAX = 8;
export const HOME_CATEGORY_MAX = 4;

export interface HomeSection<T> {
    events: T[];
    /** Nombre total d'événements de la section dans le catalogue (lien « Tout voir »). */
    total: number;
}

export interface HomeCategorySection<T> extends HomeSection<T> {
    id: string;
    label: string;
}

export interface HomeSections<T> {
    /** Candidats de « En ce moment » (en cours ou qui commencent dans les 12 heures), par heure de début. */
    liveCandidates: T[];
    /** Identifiants en cours au moment du rendu (état initial de la rangée, identique au rendu serveur). */
    liveAtRender: string[];
    week: HomeSection<T>;
    free: HomeSection<T>;
    byCategory: HomeCategorySection<T>[];
}

type HomeEvent = FilterableEvent & { id: string };

function section<T>(all: T[], max: number): HomeSection<T> {
    return { events: all.slice(0, max), total: all.length };
}

/** Vrai entre le début (compris) et la fin retenue (exclue). */
export function isLiveAtMs(evt: Pick<FilterableEvent, 'startsAt' | 'endsAt'>, now: number): boolean {
    const start = Date.parse(evt.startsAt);
    const end = Date.parse(evt.endsAt);
    return Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end;
}

export function homeSections<T extends HomeEvent>(catalog: readonly T[], now: Date): HomeSections<T> {
    const t = now.getTime();
    const upcoming = catalog.filter((e) => Date.parse(e.endsAt) > t);
    const liveCandidates = upcoming
        .filter((e) => Date.parse(e.startsAt) <= t + HOME_LIVE_HORIZON_MS)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
        .slice(0, HOME_LIVE_MAX);
    return {
        liveCandidates,
        liveAtRender: liveCandidates.filter((e) => isLiveAtMs(e, t)).map((e) => e.id),
        week: section(upcoming.filter((e) => matchesWhen(e, 'semaine', now)), HOME_WEEK_MAX),
        free: section(upcoming.filter(isFree), HOME_FREE_MAX),
        byCategory: EVENT_CATEGORIES
            .map((c) => ({ id: c.id as string, label: c.label as string, ...section(upcoming.filter((e) => e.category === c.id), HOME_CATEGORY_MAX) }))
            .filter((s) => s.total > 0),
    };
}
