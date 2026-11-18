'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { EventCard, cityLabel } from '@/components/events/EventCard';
import { useAuth } from '@/components/providers/AuthProvider';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select, type SelectOption } from '@/components/ui/Field';
import { readCatalog, type CatalogEvent } from '@/lib/events/catalog-client';
import { readLocalCity, writeLocalCity } from '@/lib/events/city-preference';
import { useCatalogSignal } from './catalogSignal';

/**
 * Accueil, « Près de chez vous » (lot 9, 9.1 ; contrat 4.2, 5.2 ; design 1b, point 3).
 *  - Événements de la ville choisie, jamais déduite de la position de l'appareil. Connecté : ville du profil, écrite par
 *    la route. Visiteur : ville gardée sur l'appareil. Îlot client chargé après la page : l'accueil est préparé par le
 *    serveur et mis en cache 60 s, la ville d'une personne n'entre jamais dans ce HTML partagé. Le rendu initial ne
 *    dépend d'aucune des deux (squelette jusqu'à la fin de la lecture de session).
 *  - Design 1b : « Populaires » n'est plus lu ici. Les plus vendus (classement du serveur, 7 jours, cache 60 s) sont
 *    rendus par le serveur, en repli de la rangée « À la une » quand le Superadmin n'a rien choisi (app/page.tsx).
 *  - `liveTick` : signaux temps réel de l'accueil (public_event_state), reçus de l'îlot HomeLive par useCatalogSignal ;
 *    chaque signal relit la liste (badges de stock à jour), sans abonnement de plus.
 * Sur téléphone, la liste défile au doigt à l'intérieur de sa section (scroll-snap, sans JavaScript).
 */

const NEARBY_LIMIT = 8;
const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';
const SAVE_FAILED_MESSAGE = 'La ville n’a pas pu être enregistrée. Réessayez dans un instant.';

/**
 * Lot 9 bis (ex-10.0 e ; contrat 5.45, B94) : clé de ville sans accent ni casse, pour que la ville du profil
 * (« Thiès ») et celle du catalogue (« THIES ») ne fassent qu'une option. Pliage en ligne, sans importer
 * lib/text/fold : seules les villes passent ici, déjà dédoublonnées par le serveur.
 */
const cityKey = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

const TITLE = 'text-xl font-bold tracking-tight text-foreground-strong sm:text-2xl';
// Sur téléphone, la liste défile jusqu'aux bords de l'écran (-mx-4 annule la gouttière de la page).
const RAIL = '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:snap-none sm:scroll-px-0 sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-4';
const RAIL_ITEM = 'w-[78%] flex-none snap-start sm:w-auto';
const RAIL_SIZES = '(max-width: 640px) 78vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 300px';

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
            paidFrom={evt.paidFrom}
            saleLabel={evt.saleLabel}
            stock={evt.stock}
            startsAt={evt.startsAt}
            endsAt={evt.endsAt}
            sizes={RAIL_SIZES}
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
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="aspect-[16/10] w-full bg-muted motion-safe:animate-pulse" />
            <div className="space-y-3 p-4">
              <div className="h-4 w-1/3 rounded-md bg-muted motion-safe:animate-pulse" />
              <div className="h-5 w-3/4 rounded-md bg-muted motion-safe:animate-pulse" />
              <div className="h-11 w-full rounded-xl bg-muted motion-safe:animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
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

function NearbySection({ cities, liveTick }: { cities: string[]; liveTick: number }) {
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

  const load = useCallback(async (target: string, silent = false) => {
    const seq = ++loadSeq.current;
    if (!silent) setPhase('loading');
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

  // Relue à chaque signal de l'accueil (liveTick), sans squelette : la liste ou l'état vide restent affichés.
  const tickRef = useRef(liveTick);
  useEffect(() => {
    if (liveTick === tickRef.current) return;
    tickRef.current = liveTick;
    if (city) void load(city, true);
  }, [liveTick, city, load]);

  const retry = async () => {
    if (!city) return;
    setIsRetrying(true);
    try {
      await load(city);
    } finally {
      setIsRetrying(false);
    }
  };

  // Ville choisie sous la forme du catalogue quand il la connaît (même clé pliée), sinon telle quelle.
  const selected = city ? cities.find((v) => cityKey(v) === cityKey(city)) ?? city : null;

  const options = useMemo<SelectOption[]>(() => {
    const values = new Set(cities);
    if (selected) values.add(selected);
    const list = Array.from(values)
      .map((value) => ({ value, label: cityLabel(value) ?? value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr-FR'));
    return selected ? list : [{ value: '', label: 'Choisir une ville', disabled: true }, ...list];
  }, [cities, selected]);

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

  if (cityReady && !city && cities.length === 0) return null;

  const cityName = cityLabel(city) ?? '';

  return (
    <section aria-labelledby="proches-titre" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id="proches-titre" className={TITLE}>Près de chez vous</h2>
          <p className="text-sm text-muted-foreground">Les prochains événements dans votre ville.</p>
        </div>
        {cityReady ? (
          <Select
            label="Votre ville"
            fieldClassName="w-full sm:w-64"
            value={savingCity ?? selected ?? ''}
            disabled={savingCity !== null}
            onChange={(e) => void choose(e.target.value)}
            options={options}
            error={saveError}
          />
        ) : (
          <div className="h-11 w-full rounded-xl bg-muted motion-safe:animate-pulse sm:w-64" aria-hidden="true" />
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
 * « Près de chez vous », sous les sections du catalogue de l'accueil.
 * `cities` : villes du catalogue, données par la page serveur (publiques, les mêmes pour tous).
 */
export function HomeDiscovery({ cities }: { cities: string[] }) {
  const liveTick = useCatalogSignal();
  return <NearbySection cities={cities} liveTick={liveTick} />;
}
