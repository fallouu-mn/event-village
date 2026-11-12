'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { RefreshCw, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { EventCard, cityLabel } from '@/components/events/EventCard';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select, TextInput } from '@/components/ui/Field';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { EVENT_CATEGORIES } from '@/lib/constants/event-categories';
import { readCatalog, type CatalogEvent } from '@/lib/events/catalog-client';
import { foldText } from '@/lib/text/fold';

/**
 * Catalogue public (lot 5, tâches 5.3 et 5.13 ; contrats E, O3, O5).
 *  - Source unique : GET /api/events (PUBLIE dont la fin est à venir, prix « à partir de » calculé par le
 *    serveur ; sans catégorie achetable : « Bientôt en vente »).
 *  - Temps réel : le résumé public public_event_state (publication, suspension, annulation, fin) ;
 *    chaque signal recharge la liste par le serveur, sans recharger la page. Indicateur « En direct » /
 *    « Hors ligne ».
 *  - Recherche, catégorie et ville sont appliquées par le serveur (lot 9, A28), la recherche après 300 ms sans
 *    frappe. Seul le tri reste ici. Un compteur de séquence écarte une réponse lente devenue obsolète : une
 *    requête annulée serait une panne pour la garde réseau de l'e2e.
 */

type SortKey = 'date' | 'price-asc' | 'price-desc';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'date', label: 'Date la plus proche' },
  { value: 'price-asc', label: 'Prix croissant' },
  { value: 'price-desc', label: 'Prix décroissant' },
];

const ALL = 'tous';
const SEARCH_DEBOUNCE_MS = 300;

/** Prix croissant ou décroissant ; « Bientôt en vente » (sans prix) toujours en fin de liste. */
function byPrice(direction: 1 | -1) {
  return (a: CatalogEvent, b: CatalogEvent): number => {
    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return (a.price - b.price) * direction;
  };
}

function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface" aria-hidden="true">
      <div className="aspect-[16/10] w-full bg-surface-sunken motion-safe:animate-pulse" />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="h-4 w-1/3 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-5 w-3/4 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-4 w-1/2 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-11 w-full rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

export default function ExplorePage() {
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);

  const [query, setQuery] = useState('');
  /** Texte envoyé au serveur, après le délai de frappe ; null tant que ?q= n'est pas lu. */
  const [serverQuery, setServerQuery] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(ALL);
  const [city, setCity] = useState<string>(ALL);
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersPanelId = useId();

  /** Filtres courants, lus par load : un signal temps réel recharge avec les filtres en cours. */
  const filtersRef = useRef({ q: '', city: ALL, category: ALL });
  /** Seule la dernière requête écrit. */
  const loadSeq = useRef(0);
  const hasListRef = useRef(false);

  /**
   * Chargement de la liste. « initial » (premier affichage, « Réessayer ») : un échec affiche l'écran
   * d'erreur. « silent » (signal temps réel, reconnexion, changement de filtre) : la liste reste affichée,
   * l'échec est signalé par un bandeau avec « Réessayer ».
   */
  const load = useCallback(async (mode: 'initial' | 'silent') => {
    const seq = ++loadSeq.current;
    const result = await readCatalog('catalogue', filtersRef.current);
    if (seq !== loadSeq.current) return;
    setIsFiltering(false);
    if (result.ok) {
      hasListRef.current = true;
      setEvents(result.events);
      setCities(result.cities);
      setLoadError(null);
      setRefreshError(null);
      setPhase('ready');
      return;
    }
    if (mode === 'initial') {
      setLoadError(result.message);
      setPhase('error');
    } else {
      setRefreshError(result.message);
    }
  }, []);

  const refreshEvents = useCallback(() => load('silent'), [load]);

  // Recherche lancée depuis l'accueil (/explore?q=…) : lue une fois, sans Suspense (page statique). Elle part
  // avec le premier chargement : une seule requête.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')?.slice(0, 120) ?? '';
    if (q) setQuery(q);
    setServerQuery(q.trim());
  }, []);

  useEffect(() => {
    if (serverQuery === null) return undefined;
    const next = query.trim();
    if (next === serverQuery) return undefined;
    const timer = window.setTimeout(() => setServerQuery(next), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, serverQuery]);

  // Le texte part après le délai de frappe ; la ville et la catégorie partent aussitôt.
  useEffect(() => {
    if (serverQuery === null) return;
    filtersRef.current = { q: serverQuery, city, category };
    if (hasListRef.current) setIsFiltering(true);
    void load(hasListRef.current ? 'silent' : 'initial');
  }, [serverQuery, city, category, load]);

  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: 'catalogue-public',
    subscriptions: [{ table: 'public_event_state' }],
    onSignal: refreshEvents,
  });

  const retry = async () => {
    setIsRetrying(true);
    try {
      await load('initial');
    } finally {
      setIsRetrying(false);
    }
  };

  // Lot 9 bis (ex-10.0 e ; contrat 5.45, B94) : la ville choisie prend la forme du catalogue quand une ville a la même
  // forme pliée (« Thiès » et « THIES » ne font qu'une option) ; elle n'est ajoutée à la liste que sinon.
  const selectedCity = city === ALL ? ALL : cities.find((value) => foldText(value) === foldText(city)) ?? city;
  const cityOptions = useMemo(() => {
    const values = selectedCity !== ALL && !cities.includes(selectedCity) ? [...cities, selectedCity] : cities;
    return values
      .map((value) => ({ value, label: cityLabel(value) ?? value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr-FR'));
  }, [cities, selectedCity]);

  const visible = useMemo(() => {
    if (sortBy === 'price-asc') return [...events].sort(byPrice(1));
    if (sortBy === 'price-desc') return [...events].sort(byPrice(-1));
    return events;
  }, [events, sortBy]);

  const serverFiltersActive = Boolean(serverQuery) || category !== ALL || city !== ALL;
  const filtersActive = query.trim() !== '' || serverFiltersActive || sortBy !== 'date';
  /** Choix rangés sous « Filtres et tri » : le bouton les annonce quand le panneau est replié. */
  const choiceCount = [city !== ALL, category !== ALL, sortBy !== 'date'].filter(Boolean).length;

  const resetFilters = () => {
    setQuery('');
    setServerQuery('');
    setCategory(ALL);
    setCity(ALL);
    setSortBy('date');
  };

  const resultLabel = visible.length === 0
    ? 'Aucun événement'
    : visible.length === 1 ? '1 événement' : `${visible.length} événements`;

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Explorer les événements"
        description="Concerts, festivals, soirées et rencontres à venir au Sénégal. La liste se met à jour d’elle-même."
        actions={<LiveIndicator status={liveStatus} />}
      />

      <section aria-label="Recherche et filtres" className="rounded-3xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative">
            <TextInput
              label="Rechercher un événement"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              placeholder="Titre, lieu, organisateur…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-11"
            />
            <Search size={18} className="pointer-events-none absolute bottom-3 left-3.5 text-fg-muted" aria-hidden="true" />
          </div>

          {/* Mobile : ville, tri et catégories repliés, pour que les événements soient sur le premier écran (relecture du run 111). */}
          <Button
            variant="secondary"
            fullWidth
            className="md:hidden"
            leftIcon={<SlidersHorizontal size={18} aria-hidden="true" />}
            aria-expanded={filtersOpen}
            aria-controls={filtersPanelId}
            onClick={() => setFiltersOpen((open) => !open)}
          >
            {choiceCount > 0 ? `Filtres et tri (${choiceCount})` : 'Filtres et tri'}
          </Button>

          <div id={filtersPanelId} className={cn('grid-cols-1 gap-4 md:contents', filtersOpen ? 'grid' : 'hidden')}>
            <Select
              label="Ville"
              value={selectedCity}
              onChange={(e) => setCity(e.target.value)}
              options={[{ value: ALL, label: 'Toutes les villes' }, ...cityOptions]}
            />
            <Select
              label="Trier par"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              options={SORT_OPTIONS}
            />

            <div role="group" aria-label="Catégorie" className="flex flex-wrap gap-2 md:col-span-3">
              {[{ id: ALL, label: 'Toutes les catégories' }, ...EVENT_CATEGORIES].map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCategory(c.id)}
                    className={cn(
                      'inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold transition-colors duration-200',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                      active
                        ? 'border-brand bg-brand text-on-brand'
                        : 'border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-sunken',
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {refreshError && phase === 'ready' && (
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
          <h2 id="resultats-titre" className="text-base font-semibold text-fg" aria-live="polite">
            {phase === 'loading' ? 'Chargement des événements…' : isFiltering ? 'Recherche…' : resultLabel}
          </h2>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={resetFilters} leftIcon={<RotateCcw size={16} />}>
              Effacer les filtres
            </Button>
          )}
        </div>

        {phase === 'error' ? (
          <ErrorState
            title="Impossible d’afficher les événements"
            description={loadError ?? 'Le catalogue n’a pas pu être chargé. Vérifiez votre connexion, puis réessayez.'}
            onRetry={() => void retry()}
            isRetrying={isRetrying}
          />
        ) : phase === 'loading' ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
            {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
          </div>
        ) : visible.length > 0 ? (
          <ul
            className={cn('grid grid-cols-1 gap-5 transition-opacity duration-200 sm:grid-cols-2 xl:grid-cols-3', isFiltering && 'opacity-60')}
            aria-busy={isFiltering || undefined}
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
                  saleLabel={evt.saleLabel}
                  stock={evt.stock}
                  priority={i < 3}
                />
              </li>
            ))}
          </ul>
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
