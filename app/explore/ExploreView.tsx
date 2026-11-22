'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { RefreshCw, RotateCcw, Search } from 'lucide-react';
import { EventCard, cityLabel } from '@/components/events/EventCard';
import { CardTransitions } from '@/components/events/CardLink';
import { CardLiveBadges } from '@/components/events/CardLiveBadge';
import { CardFavoritesLazy as CardFavorites } from '@/components/events/CardFavoritesLazy';
import { CategoryChipsBar } from '@/components/events/CategoryChipsBar';
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
import { addRecentSearch, clearRecentSearches, readRecentSearches } from '@/lib/device/device-prefs';
import { readCatalog, type CatalogFilters } from '@/lib/events/catalog-client';
import type { CatalogEventDto } from '@/lib/events/catalog.server';
import {
  applyCatalogFilters,
  catalogSearchParams,
  EXPLORE_PAGE_SIZE,
  exploreHref,
  hasActiveFilters,
  whenRange,
  type CatalogFilterState,
  type CatalogWhen,
} from '@/lib/events/catalog-filters';
import { exploreModeHref, type ExploreMode } from '@/lib/events/explore-view';
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
 *  - Lot Carte B (B2) : onglets Liste / Carte / Calendrier (indicateur orange qui glisse, ViewTabs ci-dessous : mêmes règles
 *    que components/ui/Tabs, sans son module partagé, plus lourd pour le premier chargement), mêmes filtres partagés, choix
 *    gardé dans l'adresse (`?vue=`, lib/events/explore-view.ts). La carte et le calendrier sont chargés à l'ouverture de
 *    leur onglet seulement (next/dynamic, module unique components/explore/lazy.ts) : rien au premier chargement
 *    d'Explorer. Tuiles indisponibles :
 *    retour à la Liste avec un message simple. Les signaux temps réel relisent aussi la carte et le calendrier ouverts (un
 *    événement suspendu ou annulé en disparaît).
 */

const VIEW_TABS: Array<{ id: ExploreMode; label: string }> = [
  { id: 'liste', label: 'Liste' },
  { id: 'carte', label: 'Carte' },
  { id: 'calendrier', label: 'Calendrier' },
];
const TABS_PREFIX = 'explorer';

/** Place réservée pendant le chargement de la carte ou du calendrier (même hauteur : aucun saut de mise en page). */
function ViewSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="flex h-[62vh] min-h-[20rem] items-center justify-center rounded-xl border border-border bg-muted text-base text-muted-foreground lg:h-[70vh]">
      {label}
    </div>
  );
}

const ExploreMap = dynamic(() => import('@/components/explore/lazy').then((m) => m.ExploreMap), {
  ssr: false,
  loading: () => <ViewSkeleton label="Chargement de la carte…" />,
});
const ExploreCalendar = dynamic(() => import('@/components/explore/lazy').then((m) => m.ExploreCalendar), {
  ssr: false,
  loading: () => <ViewSkeleton label="Chargement du calendrier…" />,
});

const tabId = (mode: ExploreMode): string => `${TABS_PREFIX}-onglet-${mode}`;
const tabPanelId = (mode: ExploreMode): string => `${TABS_PREFIX}-panneau-${mode}`;

/**
 * Onglets des vues (contrat Q, comme components/ui/Tabs) : role tablist et tab, aria-selected, tabulation itinérante,
 * flèches gauche et droite, Début et Fin ; cibles de 44 px ; indicateur orange qui glisse (translateX + scaleX d'une barre
 * de 1 px, transform seulement, 250 ms, coupé si « réduire les animations ») ; avant la première mesure, la bordure de
 * l'onglet choisi tient lieu d'indicateur (rendu du serveur, aucun saut).
 */
function ViewTabs({ value, onChange }: { value: ExploreMode; onChange: (mode: ExploreMode) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const index = Math.max(0, VIEW_TABS.findIndex((t) => t.id === value));
  const [bar, setBar] = useState<{ x: number; w: number } | null>(null);
  useEffect(() => {
    const measure = () => {
      const el = refs.current[index];
      if (el) setBar({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [index]);
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = VIEW_TABS.length;
    const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChange(VIEW_TABS[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div role="tablist" aria-label="Affichage des événements" aria-orientation="horizontal" className="relative flex gap-1 border-b border-border">
      {VIEW_TABS.map((t, i) => {
        const selected = i === index;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={tabId(t.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(t.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              'relative -mb-px inline-flex min-h-11 flex-shrink-0 items-center border-b-[3px] px-4 text-sm font-semibold transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              selected
                ? cn('font-bold text-foreground-strong', bar ? 'border-transparent' : 'border-brand-vif')
                : 'border-transparent text-muted-foreground hover:border-input hover:text-foreground-strong',
            )}
          >
            {t.label}
          </button>
        );
      })}
      {bar && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-1px] left-0 h-[3px] w-px origin-left bg-brand-vif motion-safe:transition-transform motion-safe:duration-slow motion-safe:ease-out"
          style={{ transform: `translateX(${bar.x}px) scaleX(${bar.w})` }}
        />
      )}
    </div>
  );
}

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

export function ExploreView({ filters, events: serverEvents, total: serverTotal, hasMore: serverHasMore, cities: serverCities, failed, mode: serverMode = 'liste' }: {
  filters: CatalogFilterState;
  events: CatalogEventDto[];
  total: number;
  hasMore: boolean;
  cities: string[];
  failed: boolean;
  mode?: ExploreMode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const serverKey = filtersKey(filters);
  /** Lot Carte B : vue choisie (aussitôt à l'écran, l'adresse suit). */
  const [mode, setMode] = useState<ExploreMode>(serverMode);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  useEffect(() => setMode(serverMode), [serverMode]);
  const [mapFailed, setMapFailed] = useState(false);
  /** Signaux temps réel reçus : la carte et le calendrier ouverts se relisent. */
  const [liveTick, setLiveTick] = useState(0);

  /** Filtres choisis à l'écran (en avance sur la réponse du serveur), null quand l'écran suit l'adresse. */
  const [draft, setDraft] = useState<CatalogFilterState | null>(null);
  const [query, setQuery] = useState(filters.q);
  /** Design 1d (point 9) : recherches récentes de l'appareil, lues après le chargement (jamais au rendu du serveur). */
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecentSearches()), []);
  const rememberQuery = () => {
    if (query.trim().length >= 2) setRecent(addRecentSearch(query));
  };
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
      router.replace(exploreModeHref(next, modeRef.current), { scroll: false });
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

  const onLiveSignal = useCallback(async () => {
    setLiveTick((t) => t + 1);
    await refreshEvents();
  }, [refreshEvents]);

  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: 'catalogue-public',
    subscriptions: [{ table: 'public_event_state' }],
    onSignal: onLiveSignal,
  });

  const chooseMode = (m: ExploreMode) => {
    if (m !== 'liste') setMapFailed(false);
    setMode(m);
    modeRef.current = m;
    startTransition(() => {
      router.replace(exploreModeHref(shown, m), { scroll: false });
    });
  };

  // Lot Carte B : filtres écrits en adresse pour la carte et le calendrier (mêmes règles que la liste), plage du week-end
  const mapQuery = useMemo(() => catalogSearchParams({ ...shown, tri: 'date', page: 1 }).toString(), [shown]);
  const weekendRange = whenRange('weekend', new Date());
  const weekend = { from: weekendRange.from.getTime(), to: weekendRange.to.getTime() };

  const onTilesFailed = useCallback(() => {
    setMapFailed(true);
    setMode('liste');
    modeRef.current = 'liste';
    router.replace(exploreModeHref(filtersRef.current, 'liste'), { scroll: false });
  }, [router]);

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
      <CardFavorites />
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
            onKeyDown={(e) => { if (e.key === 'Enter') rememberQuery(); }}
            onBlur={rememberQuery}
            className="min-h-12 pl-11"
          />
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>

        {recent.length > 0 && query.trim() === '' && (
          <div role="group" aria-label="Recherches récentes" className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <span className="flex-shrink-0 text-sm font-semibold text-muted-foreground">Récentes</span>
            {recent.map((r) => (
              <FilterChip key={r} pressed={false} onClick={() => setQuery(r)} className="ev-press">
                {r}
              </FilterChip>
            ))}
            <Button variant="ghost" size="sm" className="flex-shrink-0" onClick={() => { clearRecentSearches(); setRecent([]); }}>
              Effacer
            </Button>
          </div>
        )}

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

      {/* Design 1d (point 10) : pastilles de catégories collées en haut pendant tout le défilement de la liste (enfant direct
          de la page : un élément collant ne le reste que dans son parent), indicateur qui glisse */}
      <CategoryChipsBar selected={shown.categorie} onSelect={(categorie) => choose({ categorie })} />

      {/* Lot Carte B : trois vues, mêmes filtres ; indicateur orange qui glisse (Tabs) */}
      <ViewTabs value={mode} onChange={chooseMode} />

      {mapFailed && mode === 'liste' && (
        <StatusBanner tone="warning" announce="alert" title="La carte ne peut pas s’afficher pour le moment">
          Voici la liste des mêmes événements. Vous pourrez réessayer la carte un peu plus tard.
        </StatusBanner>
      )}

      {mode === 'carte' && (
        <div role="tabpanel" id={tabPanelId('carte')} aria-labelledby={tabId('carte')}>
          <ExploreMap filtersQuery={mapQuery} onTilesFailed={onTilesFailed} refreshKey={liveTick} />
        </div>
      )}

      {mode === 'calendrier' && (
        <div role="tabpanel" id={tabPanelId('calendrier')} aria-labelledby={tabId('calendrier')}>
          <ExploreCalendar filtersQuery={mapQuery} weekend={weekend} refreshKey={liveTick} />
        </div>
      )}

      {mode === 'liste' && refreshError && !failed && (
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

      {mode === 'liste' && (
        <section role="tabpanel" id={tabPanelId('liste')} aria-labelledby={tabId('liste')} className="space-y-4">
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
                className={cn('ev-stagger grid grid-cols-2 gap-3 transition-opacity duration-base sm:grid-cols-3 sm:gap-5 lg:grid-cols-4', waiting && 'opacity-60')}
                aria-busy={waiting || undefined}
              >
                {visible.map((evt, i) => (
                  <li key={evt.id}>
                    <EventCard
                      id={evt.id}
                      title={evt.title}
                      subtitle={evt.subtitle}
                      imageUrl={evt.imageUrl}
                      posterColor={evt.posterColor}
                      size="compact"
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
            <EmptyState illustrated
              title="Aucun événement à venir pour le moment"
              description="Les prochains événements apparaîtront ici dès leur publication, sans recharger la page."
            />
          ) : (
            <EmptyState illustrated
              title="Aucun événement ne correspond à votre recherche"
              description="Modifiez la recherche ou les filtres pour voir plus d’événements."
              actionLabel="Effacer les filtres"
              onAction={resetFilters}
            />
          )}
        </section>
      )}
    </div>
  );
}
