import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Design 1b (décision 2 de l'utilisateur) — invalidation immédiate des pages publiques en cache (60 s) quand un événement
 * change : statut (publication, suspension, réactivation, annulation, clôture, retrait), date, heure, lieu, catégories,
 * « À la une ». Sans cela, la fiche, l'accueil et l'Explorer montraient l'ancien état jusqu'à 60 s (run 376, recette
 * acte 7 : avis d'annulation absent de la fiche).
 *
 * Étiquettes des caches de données (unstable_cache) :
 *  - `fiche-publique` : fiche (lib/events/event-detail.server.ts) ;
 *  - `catalogue-public` : catalogue lu par l'accueil et l'Explorer (lib/events/catalog-cache.server.ts) ;
 *  - `accueil` : « À la une » et « Populaires » (app/_accueil/data.server.ts).
 * Pages préparées (cache de route) : `/`, `/explore`, `/events/<id>`.
 *
 * Jamais bloquant : appelé APRÈS l'écriture réussie ; une invalidation impossible (appel hors du serveur Next : tests en
 * Node) est journalisée et l'action reste acquise (le cache expire de toute façon en 60 s).
 */
export const PUBLIC_CACHE_TAGS = ['fiche-publique', 'catalogue-public', 'accueil'] as const;

export interface Revalidators {
    tag: (tag: string) => void;
    path: (path: string) => void;
}

const NEXT_REVALIDATORS: Revalidators = { tag: (t) => revalidateTag(t), path: (p) => revalidatePath(p) };

/** Rend la liste de ce qui a été invalidé (`tag:…`, `path:…`). */
export function invalidatePublicEvent(eventId: string | null, why: string, r: Revalidators = NEXT_REVALIDATORS): string[] {
    const done: string[] = [];
    const failed: string[] = [];
    const attempt = (label: string, fn: () => void): void => {
        try {
            fn();
            done.push(label);
        } catch {
            failed.push(label);
        }
    };
    for (const tag of PUBLIC_CACHE_TAGS) attempt(`tag:${tag}`, () => r.tag(tag));
    const paths = ['/', '/explore', ...(eventId && /^[0-9a-f-]{36}$/i.test(eventId) ? [`/events/${eventId}`] : [])];
    for (const p of paths) attempt(`path:${p}`, () => r.path(p));
    if (failed.length > 0 && done.length === 0) {
        // Hors du serveur Next (tests en Node) : rien à invalider, le cache n'existe pas
        console.info(`[public-cache] ${why} : invalidation sans objet hors du serveur Next (${failed.length} entrée(s))`);
    } else if (failed.length > 0) {
        console.error(`[public-cache] ${why} : invalidation partielle, en échec : ${failed.join(', ')}`);
    }
    return done;
}
