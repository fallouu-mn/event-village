'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw, RotateCcw, Search } from 'lucide-react';
import { EventCard, cityLabel } from '@/components/events/EventCard';
import { CardTransitions } from '@/components/events/CardLink';
import { CardLiveBadges } from '@/components/events/CardLiveBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { Select, TextInput } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { EVENT_CATEGORIES } from '@/lib/constants/event-categories';
import { readCatalog, type CatalogFilters } from '@/lib/events/catalog-client';
import type { CatalogEventDto } from '@/lib/events/catalog.server';
import {
  applyCatalogFilters,
  catalogSearchParams,
  EXPLORE_PAGE_SIZE,
  exploreHref,
  hasActiveFilters,
  type CatalogFilterState,
  type CatalogWhen,
} from '@/lib/events/catalog-filters';
import { foldText } from '@/lib/text/fold';

/**
 * Explorer, partie écran (design 1b, point 5 ; lot 5, contrats E, O3, O5 ; lot 9, A28).
 *  - Filtres en puces (`aria-pressed`) : date (aujourd'hui, ce week-end, cette semaine), gratuit, catégorie ; ville et tri
 *    en listes. Chaque choix est écrit dans l'adresse ; la page serveur répond avec la liste filtrée. En attendant, la
 *    liste affichée est restreinte aussitôt sur le téléphone avec la même règle (lib/events/catalog-filters.ts) : un
 *    filtre ajouté se voit tout de suite ; un filtre retiré attend la réponse du serveur (liste estompée, « Recherche… »).
 *  - Recherche envoyée après 300 ms sans frappe.
 *  - « Voir plus » : page suivante (12 cartes de plus), lien utilisable sans JavaScript ; nombre affiché annoncé.
 *  - Temps réel : résumé public public_event_state ; chaque signal relit GET /api/events (sans cache) avec les filtres
 *    en cours, sans recharger la page. Aucune requête n'est annulée : un compteur de séquence écarte une réponse dépassée.
 *  - Bouton Liste / Carte : prévu (SHOW_MAP_TOGGLE), non rendu tant que la carte réelle n'existe pas.
 */

/** Bouton « Liste / Carte » : à passer à true quand la page Carte réelle existera (lot Carte). Rien n'est rendu avant. */
export const SHOW_MAP_TOGGLE = false;

const SEARCH_DEBOUNCE_MS = 300;

const WHEN_CHIPS: Array<{ value: CatalogWhen; label: string }> = [
  { value: 'aujourdhui', label: 'Aujourd’hui' },
  { value: 'weekend', label: 'Ce week-end' },
  { value: 'semaine', label: 'Cette semaine' },
];

const SORT_OPTIONS = [
  { value: 'date', label: 'Date la plus proche' },
  { value: 'prix', label: 'Prix croissant' },
];

/** Clé stable des filtres (adresse sans la page). */
function filtersKey(f: CatalogFilterState): string {
  return catalogSearchParams({ ...f, page: 1 }).toString();
}

/** Filtres pour GET /api/events (mêmes noms que les écrans existants pour la ville et la catégorie). */
function apiFilters(f: CatalogFilterState): CatalogFilters {
  return { q: f.q, city: f.ville ?? undefined, category: f.categorie ?? undefined, quand: f.quand, gratuit: f.gratuit, tri: f.tri };
}

interface LiveList {
  key: string;
  events: CatalogEventDto[];
  total: number;
  cities: string[];
}

export function ExploreView({ filters, events: serverEvents, total: serverTotal, hasMore: serverHasMore, cities: serverCities, failed }: {
  filters: CatalogFilterState;
  events: CatalogEventDto[];
  total: number;
  hasMore: boolean;
  cities: string[];
  failed: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const serverKey = filtersKey(filters);

  /** Filtres choisis à l'écran (en avance sur la réponse du serveur), null quand l'écran suit l'adresse. */
  const [draft, setDraft] = useState<CatalogFilterState | null>(null);
  const [query, setQuery] = useState(filters.q);
  const [live, setLive] = useState<LiveList | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const loadSeq = useRef(0);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  /** Dernier texte envoyé par la recherche : une réponse plus ancienne n'efface pas ce qui est en train d'être tapé. */
  const sentQuery = useRef(filters.q);

  // Réponse du serveur arrivée (nouvelle adresse) : l'écran suit de nouveau l'adresse, sauf si un choix plus récent
  // attend encore sa réponse. Une adresse changée d'ailleurs (retour arrière) remet le champ de recherche à jour.
  useEffect(() => {
    setDraft((current) => (current && filtersKey(current) !== serverKey ? current : null));
    if (filters.q !== sentQuery.current) {
      sentQuery.current = filters.q;
      setQuery(filters.q);
    }
  }, [serverKey, filters.q]);

  const shown = draft ?? filters;

  const navigate = useCallback((next: CatalogFilterState) => {
    sentQuery.current = next.q;
    setDraft(next);
    startTransition(() => {
      router.replace(exploreHref(next), { scroll: false });
    });
  }, [router]);

  /** Nouveau filtre : retour à la première page. */
  const choose = (patch: Partial<CatalogFilterState>) => navigate({ ...shown, ...patch, page: 1 });

  // Recherche : envoyée après le délai de frappe.
  useEffect(() => {
    const next = query.trim();
    if (next === shown.q) return undefined;
    const timer = window.setTimeout(() => navigate({ ...shown, q: next, page: 1 }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, shown, navigate]);

  // Temps réel : relecture par le serveur avec les filtres en cours, la liste reste affichée pendant la lecture.
  const refreshEvents = useCallback(async () => {
    const seq = ++loadSeq.current;
    const current = filtersRef.current;
    const result = await readCatalog('catalogue', apiFilters(current));
    if (seq !== loadSeq.current) return;
    if (!result.ok) {
      setRefreshError(result.message);
      return;
    }
    setRefreshError(null);
    setLive({
      key: filtersKey(current),
      events: result.events.slice(0, current.page * EXPLORE_PAGE_SIZE) as unknown as CatalogEventDto[],
      total: result.total,
      cities: result.cities,
    });
  }, []);

  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: 'catalogue-public',
    subscriptions: [{ table: 'public_event_state' }],
    onSignal: refreshEvents,
  });

  const fresh = live && live.key === serverKey ? live : null;
  const events = fresh ? fresh.events : serverEvents;
  const total = fresh ? fresh.total : serverTotal;
  const cities = fresh ? fresh.cities : serverCities;
  const hasMore = fresh ? fresh.events.length < fresh.total : serverHasMore;

  // Filtre choisi, réponse du serveur pas encore arrivée : la liste est restreinte tout de suite (même règle que le serveur).
  const visible = useMemo(
    () => (draft && filtersKey(draft) !== serverKey ? applyCatalogFilters(events, draft, new Date()) : events),
    [draft, serverKey, events],
  );

  const serverFiltersActive = hasActiveFilters(filters);
  const filtersActive = hasActiveFilters(shown) || shown.tri !== 'date';
  const waiting = isPending;

  // Ville choisie sous la forme du catalogue quand une ville a la même forme pliée (« Thiès » et « THIES »).
  const selectedCity = shown.ville ? cities.find((value) => foldText(value) === foldText(shown.ville ?? '')) ?? shown.ville : '';
  const cityOptions = useMemo(() => {
    const values = selectedCity && !cities.includes(selectedCity) ? [...cities, selectedCity] : cities;
    return values
      .map((value) => ({ value, label: cityLabel(value) ?? value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr-FR'));
  }, [cities, selectedCity]);

  const resetFilters = () => {
    setQuery('');
    navigate({ ...shown, q: '', quand: null, categorie: null, gratuit: false, ville: null, tri: 'date', page: 1 });
  };

  const countLabel = waiting
    ? 'Recherche…'
    : total === 0
      ? 'Aucun événement'
      : visible.length < total
        ? `${visible.length} sur ${total} événements`
        : total === 1 ? '1 événement' : `${total} événements`;

  const nextHref = exploreHref({ ...filters, page: filters.page + 1 });

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <CardTransitions />
      <CardLiveBadges />
      <PageHeader
        title="Explorer les événements"
        description="Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même."
        actions={<LiveIndicator status={liveStatus} />}
      />

      <section aria-label="Recherche et filtres" className="space-y-4">
        <div className="relative">
          <TextInput
            label="Rechercher un événement"
            hideLabel
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={120}
            placeholder="Titre, lieu, organisateur…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-12 pl-11"
          />
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>

        <div role="group" aria-label="Date et prix" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {WHEN_CHIPS.map((w) => (
            <FilterChip key={w.value} pressed={shown.quand === w.value} onClick={() => choose({ quand: shown.quand === w.value ? null : w.value })} className="ev-press">
              {w.label}
            </FilterChip>
          ))}
          <FilterChip pressed={shown.gratuit} onClick={() => choose({ gratuit: !shown.gratuit })} className="ev-press">
            Gratuit
          </FilterChip>
        </div>

        <div role="group" aria-label="Catégorie" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <FilterChip pressed={shown.categorie === null} onClick={() => choose({ categorie: null })} className="ev-press">
            Toutes les catégories
          </FilterChip>
          {EVENT_CATEGORIES.map((c) => (
            <FilterChip key={c.id} pressed={shown.categorie === c.id} onClick={() => choose({ categorie: shown.categorie === c.id ? null : c.id })} className="ev-press">
              {c.label}
            </FilterChip>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
          <Select
            label="Ville"
            value={selectedCity}
            onChange={(e) => choose({ ville: e.target.value || null })}
            options={[{ value: '', label: 'Toutes les villes' }, ...cityOptions]}
          />
          <Select
            label="Trier par"
            value={shown.tri}
            onChange={(e) => choose({ tri: e.target.value === 'prix' ? 'prix' : 'date' })}
            options={SORT_OPTIONS}
          />
        </div>
      </section>

      {refreshError && !failed && (
        <StatusBanner
          tone="warning"
          announce="alert"
          title="La liste n’a pas pu être mise à jour"
          action={(
            <Button variant="secondary" size="sm" onClick={() => void refreshEvents()} leftIcon={<RefreshCw size={16} />}>
              Réessayer
            </Button>
          )}
        >
          {refreshError} Les événements affichés sont ceux du dernier chargement.
        </StatusBanner>
      )}

      <section aria-labelledby="resultats-titre" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="resultats-titre" className="text-base font-semibold text-foreground-strong tabular-nums" aria-live="polite">
            {failed ? 'Liste indisponible' : countLabel}
          </h2>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={resetFilters} leftIcon={<RotateCcw size={16} />}>
              Effacer les filtres
            </Button>
          )}
        </div>

        {failed ? (
          <ErrorState
            title="Impossible d’afficher les événements"
            description="Le catalogue n’a pas pu être chargé. Vérifiez votre connexion, puis réessayez."
            onRetry={() => startTransition(() => router.refresh())}
            isRetrying={isPending}
          />
        ) : visible.length > 0 ? (
          <>
            <ul
              className={cn('ev-stagger grid grid-cols-1 gap-5 transition-opacity duration-base sm:grid-cols-2 xl:grid-cols-3', waiting && 'opacity-60')}
              aria-busy={waiting || undefined}
            >
              {visible.map((evt, i) => (
                <li key={evt.id}>
                  <EventCard
                    id={evt.id}
                    title={evt.title}
                    subtitle={evt.subtitle}
                    imageUrl={evt.imageUrl}
                    dateFormatted={evt.dateFormatted}
                    dayNumber={evt.dayNumber}
                    monthShort={evt.monthShort}
                    timeFormatted={evt.timeFormatted}
                    venue={evt.venue}
                    city={evt.city}
                    categoryLabel={evt.categoryLabel}
                    price={evt.price}
                    paidFrom={evt.paidFrom}
                    saleLabel={evt.saleLabel}
                    stock={evt.stock}
                    startsAt={evt.startsAt}
                    endsAt={evt.endsAt}
                    priority={i === 0}
                  />
                </li>
              ))}
            </ul>
            {hasMore && !waiting && (
              <div className="flex justify-center pt-2">
                <LinkButton
                  href={nextHref}
                  variant="secondary"
                  onClick={(e) => {
                    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    startTransition(() => router.replace(nextHref, { scroll: false }));
                  }}
                >
                  Voir plus d’événements
                </LinkButton>
              </div>
            )}
          </>
        ) : waiting ? (
          <p className="py-10 text-center text-base text-muted-foreground">Recherche…</p>
        ) : events.length === 0 && !serverFiltersActive ? (
          <EmptyState
            title="Aucun événement à venir pour le moment"
            description="Les prochains événements apparaîtront ici dès leur publication, sans recharger la page."
          />
        ) : (
          <EmptyState
            title="Aucun événement ne correspond à votre recherche"
            description="Modifiez la recherche ou les filtres pour voir plus d’événements."
            actionLabel="Effacer les filtres"
            onAction={resetFilters}
          />
        )}
      </section>
    </div>
  );
}
