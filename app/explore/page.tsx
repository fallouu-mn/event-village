import type { Metadata } from 'next';
import { ExploreView } from './ExploreView';
import { cachedCatalogEvents } from '@/lib/events/catalog-cache.server';
import { catalogCities, type CatalogEventDto } from '@/lib/events/catalog.server';
import { applyCatalogFilters, paginate, parseCatalogParams } from '@/lib/events/catalog-filters';

/**
 * Catalogue public, Explorer (lot 5, tâches 5.3 et 5.13 ; contrats E, O3, O5 ; design 1b, points 1 et 5).
 *  - Page préparée par le serveur : filtres lus dans l'adresse (`?q=&quand=aujourdhui|weekend|semaine&categorie=&gratuit=1
 *    &ville=&tri=prix&page=`), catalogue lu sous cache de 60 s (lib/events/catalog-cache.server.ts, le même pour tous),
 *    filtré et découpé ici par les fonctions pures de lib/events/catalog-filters.ts (mêmes règles que GET /api/events).
 *    Aucune donnée personnelle : la session n'est pas lue.
 *  - L'écran (ExploreView, îlot client) applique un filtre aussitôt choisi pendant que le serveur répond, puis affiche
 *    la réponse du serveur ; temps réel sur le résumé public public_event_state (relecture par GET /api/events, sans cache).
 *  - Pagination : « Voir plus » (lien vers la page suivante, utilisable sans JavaScript) ajoute 12 cartes.
 */
export const metadata: Metadata = {
  title: 'Explorer les événements — Event Village',
  description: 'Concerts, festivals, soirées et rencontres à venir au Sénégal : filtrez par date, catégorie, ville ou gratuité.',
};

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ExplorePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const filters = parseCatalogParams(await searchParams);
  let catalog: CatalogEventDto[] | null = null;
  try {
    catalog = await cachedCatalogEvents();
  } catch (err) {
    console.error('[explorer] catalogue indisponible :', err instanceof Error ? err.message : String(err));
  }
  const results = catalog ? applyCatalogFilters(catalog, filters, new Date()) : [];
  const { shown, total, hasMore, page } = paginate(results, filters.page);

  return (
    <ExploreView
      filters={{ ...filters, page }}
      events={shown}
      total={total}
      hasMore={hasMore}
      cities={catalog ? catalogCities(catalog) : []}
      failed={catalog === null}
    />
  );
}
