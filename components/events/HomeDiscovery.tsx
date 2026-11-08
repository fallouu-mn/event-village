'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { EventCard, cityLabel } from '@/components/events/EventCard';
import { useAuth } from '@/components/providers/AuthProvider';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select, type SelectOption } from '@/components/ui/Field';
import { readCatalog, readPopular, type CatalogEvent } from '@/lib/events/catalog-client';
import { readLocalCity, writeLocalCity } from '@/lib/events/city-preference';

/**
 * Accueil, sections de découverte (lot 9, 9.1 ; contrat 4.2, 5.2).
 *  - Populaires : classement du serveur (7 jours, cache 60 s). Vide : section absente. Panne : erreur avec « Réessayer ».
 *  - Près de chez vous : événements de la ville choisie, jamais déduite de la position de l'appareil. Connecté : ville
 *    du profil, écrite par la route. Visiteur : ville gardée sur l'appareil. Le rendu initial ne dépend d'aucune des
 *    deux (squelette jusqu'à la fin de la lecture de session), pour un rendu serveur identique.
 * Sur mobile, chaque liste défile à l'intérieur de sa section (10 cartes empilées repousseraient tout le reste).
 */

const NEARBY_LIMIT = 8;
const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';
const SAVE_FAILED_MESSAGE = 'La ville n’a pas pu être enregistrée. Réessayez dans un instant.';

const TITLE = 'text-2xl font-bold tracking-tight text-fg';
// Sur mobile, la liste défile jusqu'aux bords de l'écran (-mx-4 annule la gouttière de la page).
const RAIL = '-mx-4 flex snap-x scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:snap-none sm:scroll-px-0 sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4';
const RAIL_ITEM = 'w-[82%] flex-none snap-start sm:w-auto';

function EventRail({ events, busy = false }: { events: CatalogEvent[]; busy?: boolean }) {
  return (
    <ul className={RAIL} aria-busy={busy || undefined}>
      {events.map((evt) => (
        <li key={evt.id} className={RAIL_ITEM}>
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
            priority={false}
          />
        </li>
      ))}
    </ul>
  );
}

function RailSkeleton() {
  return (
    <div className={RAIL} aria-busy="true">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={RAIL_ITEM} aria-hidden="true">
          <div className="overflow-hidden rounded-3xl border border-border bg-surface">
            <div className="aspect-[16/10] w-full bg-surface-sunken motion-safe:animate-pulse" />
            <div className="space-y-3 p-4 sm:p-5">
              <div className="h-4 w-1/3 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
              <div className="h-5 w-3/4 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
              <div className="h-11 w-full rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PopularSection() {
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

  const load = useCallback(async () => {
    const result = await readPopular('accueil');
    if (result.ok) {
      setEvents(result.events);
      setPhase('ready');
      return;
    }
    setMessage(result.message);
    setPhase('error');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async () => {
    setIsRetrying(true);
    try {
      await load();
    } finally {
      setIsRetrying(false);
    }
  };

  if (phase === 'ready' && events.length === 0) return null;

  return (
    <section aria-labelledby="populaires-titre" className="space-y-5">
      <div className="space-y-1">
        <h2 id="populaires-titre" className={TITLE}>Populaires</h2>
        <p className="text-sm text-fg-muted">Les événements les plus demandés des 7 derniers jours.</p>
      </div>
      {phase === 'error' ? (
        <ErrorState
          title="Impossible d’afficher les événements populaires"
          description={message}
          onRetry={() => void retry()}
          isRetrying={isRetrying}
          className="my-0 p-5"
        />
      ) : phase === 'loading' ? <RailSkeleton /> : <EventRail events={events} />}
    </section>
  );
}

/** Écrit la ville au profil (PATCH /api/profile/city). Rend le message à afficher, ou null si elle est enregistrée. */
async function saveProfileCity(city: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch('/api/profile/city', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city }),
    });
  } catch (err) {
    console.error('[accueil] ville non enregistrée :', err instanceof Error ? err.message : String(err));
    return NETWORK_MESSAGE;
  }
  if (res.ok) return null;
  const body: unknown = await res.json().catch((err: unknown) => {
    console.error(`[accueil] réponse illisible de la ville (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return null;
  });
  const error = typeof body === 'object' && body !== null ? (body as { error?: unknown }).error : null;
  return typeof error === 'string' && error.trim() !== '' ? error : SAVE_FAILED_MESSAGE;
}

function NearbySection({ cities }: { cities: string[] | null }) {
  const { isLoading: authLoading, isAuthenticated, profile, refreshProfile } = useAuth();
  const [localCity, setLocalCity] = useState<string | null>(null);
  const [cityReady, setCityReady] = useState(false);
  const [savingCity, setSavingCity] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [events, setEvents] = useState<CatalogEvent[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const loadSeq = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    setLocalCity(readLocalCity());
    setCityReady(true);
  }, [authLoading]);

  const city = cityReady ? (profile?.city ?? localCity) : null;

  const load = useCallback(async (target: string) => {
    const seq = ++loadSeq.current;
    setPhase('loading');
    const result = await readCatalog('proches', { city: target });
    if (seq !== loadSeq.current) return;
    if (result.ok) {
      setEvents(result.events.slice(0, NEARBY_LIMIT));
      setPhase('ready');
      return;
    }
    setMessage(result.message);
    setPhase('error');
  }, []);

  useEffect(() => {
    if (city) void load(city);
  }, [city, load]);

  const retry = async () => {
    if (!city) return;
    setIsRetrying(true);
    try {
      await load(city);
    } finally {
      setIsRetrying(false);
    }
  };

  const options = useMemo<SelectOption[]>(() => {
    const values = new Set(cities ?? []);
    if (city) values.add(city);
    const list = Array.from(values)
      .map((value) => ({ value, label: cityLabel(value) ?? value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr-FR'));
    return city ? list : [{ value: '', label: 'Choisir une ville', disabled: true }, ...list];
  }, [cities, city]);

  const choose = async (value: string) => {
    setSaveError(null);
    if (!isAuthenticated) {
      writeLocalCity(value);
      setLocalCity(value);
      return;
    }
    setSavingCity(value);
    const failure = await saveProfileCity(value);
    if (failure) setSaveError(failure);
    else await refreshProfile();
    setSavingCity(null);
  };

  if (cityReady && !city && cities !== null && cities.length === 0) return null;

  const cityName = cityLabel(city) ?? '';

  return (
    <section aria-labelledby="proches-titre" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id="proches-titre" className={TITLE}>Près de chez vous</h2>
          <p className="text-sm text-fg-muted">Les prochains événements dans votre ville.</p>
        </div>
        {cityReady ? (
          <Select
            label="Votre ville"
            fieldClassName="w-full sm:w-64"
            value={savingCity ?? city ?? ''}
            disabled={savingCity !== null}
            onChange={(e) => void choose(e.target.value)}
            options={options}
            error={saveError}
          />
        ) : (
          <div className="h-11 w-full rounded-xl bg-surface-sunken motion-safe:animate-pulse sm:w-64" aria-hidden="true" />
        )}
      </div>

      {!cityReady ? (
        <RailSkeleton />
      ) : !city ? (
        <EmptyState
          icon={<MapPin size={28} />}
          title="Choisissez votre ville"
          description="Les événements proches de chez vous apparaîtront ici. Votre choix est gardé pour vos prochaines visites."
          className="my-0"
        />
      ) : phase === 'error' ? (
        <ErrorState
          title={`Impossible d’afficher les événements de ${cityName}`}
          description={message}
          onRetry={() => void retry()}
          isRetrying={isRetrying}
          className="my-0 p-5"
        />
      ) : events.length > 0 ? (
        <EventRail events={events} busy={phase === 'loading'} />
      ) : phase === 'loading' ? (
        <RailSkeleton />
      ) : (
        <EmptyState
          icon={<MapPin size={28} />}
          title={`Aucun événement à venir à ${cityName}`}
          description="Choisissez une autre ville ou parcourez tout le catalogue."
          actionLabel="Voir tous les événements"
          actionHref="/explore"
          className="my-0"
        />
      )}
    </section>
  );
}

/**
 * Populaires, puis Près de chez vous, sous « À l'affiche ».
 * `cities` : villes du catalogue, reçues de l'accueil pour éviter une requête de plus ; null tant qu'il charge.
 */
export function HomeDiscovery({ cities }: { cities: string[] | null }) {
  return (
    <>
      <PopularSection />
      <NearbySection cities={cities} />
    </>
  );
}
