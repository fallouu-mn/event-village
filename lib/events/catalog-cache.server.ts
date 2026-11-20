import { unstable_cache } from 'next/cache';
import type { CatalogEventDto } from '@/lib/events/catalog.server';
import { readCatalogEvents } from '@/lib/events/catalog-read.server';

/**
 * Design 1b (point 1) — catalogue public mis en cache 60 s pour les pages serveur (accueil, Explorer). À l'intérieur
 * d'unstable_cache, les lectures Supabase (fetch sans cache) ne rendent pas la page dynamique : l'accueil reste une page
 * préparée par le serveur et régénérée au plus toutes les 60 s. Aucune donnée personnelle n'entre ici.
 */

/** Durée du cache des pages publiques (secondes). */
export const PUBLIC_REVALIDATE_SECONDS = 60;

const cachedRead = unstable_cache(readCatalogEvents, ['catalogue-public', 'v2'], { revalidate: PUBLIC_REVALIDATE_SECONDS, tags: ['catalogue-public'] });

/**
 * Catalogue mis en cache 60 s pour les pages serveur. Les événements terminés depuis la lecture sont retirés à chaque
 * appel (la fin retenue est dans la carte) : rien de fini ne reste affiché à cause du cache. Une panne n'est pas gardée.
 */
export async function cachedCatalogEvents(now = Date.now()): Promise<CatalogEventDto[]> {
    const events = await cachedRead();
    return events.filter((e) => Date.parse(e.endsAt) > now);
}
