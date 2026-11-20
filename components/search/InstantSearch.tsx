'use client';

import React, { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/components/ui/cn';
import { addRecentSearch, clearRecentSearches, readRecentSearches } from '@/lib/device/device-prefs';
import { exploreHref } from '@/lib/events/catalog-filters';
import { INSTANT_SEARCH_MIN, type InstantResult, type InstantSearchResponse } from '@/lib/events/instant-search';

/** Attente après la dernière frappe avant de demander les résultats au serveur. */
const DEBOUNCE_MS = 250;

type State =
  | { kind: 'idle' }
  | { kind: 'loading'; q: string }
  | { kind: 'ready'; data: InstantSearchResponse }
  | { kind: 'error'; q: string };

/**
 * Design 1d (point 9) — recherche instantanée : résultats pendant la saisie, calculés par le serveur
 * (GET /api/events/search : catalogue public en cache, 8 résultats au plus), après 250 ms sans frappe ; une réponse
 * dépassée est abandonnée (AbortController). Recherches récentes gardées sur l'appareil (6 au plus), « Effacer » les
 * retire. « Entrée » ou « Voir tous les résultats » ouvre Explorer avec la recherche. Sur téléphone, la fenêtre monte du
 * bas ; le nombre de résultats est annoncé une fois la réponse arrivée (jamais à chaque frappe).
 */
export function InstantSearch({ initialQuery = '', onClose }: { initialQuery?: string; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [recent, setRecent] = useState<string[]>([]);
  const cache = useRef(new Map<string, InstantSearchResponse>());

  useEffect(() => setRecent(readRecentSearches()), []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < INSTANT_SEARCH_MIN) {
      setState({ kind: 'idle' });
      return undefined;
    }
    const known = cache.current.get(q.toLowerCase());
    if (known) {
      setState({ kind: 'ready', data: known });
      return undefined;
    }
    setState({ kind: 'loading', q });
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/events/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`réponse ${res.status}`);
        const data = (await res.json()) as InstantSearchResponse;
        cache.current.set(q.toLowerCase(), data);
        setState({ kind: 'ready', data });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.warn('[recherche] résultats indisponibles :', err instanceof Error ? err.message : String(err));
        setState({ kind: 'error', q });
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const remember = (q: string): void => {
    if (q.trim().length >= INSTANT_SEARCH_MIN) setRecent(addRecentSearch(q));
  };

  const seeAll = (q: string): void => {
    remember(q);
    onClose();
    router.push(exploreHref({ q: q.trim() }));
  };

  const results: InstantResult[] = state.kind === 'ready' ? state.data.results : [];
  const total = state.kind === 'ready' ? state.data.total : 0;
  const trimmed = query.trim();
  const announcement = state.kind === 'ready'
    ? total === 0 ? 'Aucun événement trouvé.' : total === 1 ? '1 événement trouvé.' : `${total} événements trouvés.`
    : state.kind === 'error' ? 'La recherche est momentanément indisponible.' : '';

  return (
    <Modal isOpen onClose={onClose} title="Rechercher un événement" maxWidth="2xl" initialFocusRef={inputRef as React.RefObject<HTMLElement>} sheetOnMobile>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed.length > 0) seeAll(trimmed);
        }}
        className="relative"
      >
        <label htmlFor="recherche-instantanee" className="sr-only">Rechercher un événement</label>
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          id="recherche-instantanee"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={60}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Artiste, lieu, organisateur…"
          aria-describedby="recherche-instantanee-etat"
          className="h-12 w-full rounded-xl border border-input bg-card pl-11 pr-3 text-base text-foreground-strong placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </form>

      <p id="recherche-instantanee-etat" role="status" className="sr-only">{announcement}</p>

      <div className="mt-4 min-h-40">
        {trimmed.length < INSTANT_SEARCH_MIN ? (
          recent.length > 0 ? (
            <section aria-labelledby="recherches-recentes-titre" className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h3 id="recherches-recentes-titre" className="text-sm font-semibold text-muted-foreground">Recherches récentes</h3>
                <Button variant="ghost" size="sm" onClick={() => { clearRecentSearches(); setRecent([]); }}>
                  Effacer
                </Button>
              </div>
              <ul className="space-y-1">
                {recent.map((r) => (
                  <li key={r}>
                    <button
                      type="button"
                      onClick={() => setQuery(r)}
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-base text-foreground-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Clock size={16} className="flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 break-words">{r}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Tapez au moins deux lettres : un artiste, un lieu, une ville…</p>
          )
        ) : state.kind === 'error' ? (
          <p className="py-8 text-center text-sm text-muted-foreground">La recherche est momentanément indisponible. Vérifiez votre connexion, puis réessayez.</p>
        ) : state.kind === 'ready' && results.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- symbole SVG local, servi tel quel */}
            <img src="/branding/bras-leves-symbole.svg" alt="" width={66} height={60} className="h-14 w-auto" />
            <p className="text-base font-semibold text-foreground-strong">Aucun événement ne correspond à « {trimmed} ».</p>
            <Button variant="secondary" size="sm" onClick={() => seeAll('')}>Voir tous les événements</Button>
          </div>
        ) : (
          <div aria-busy={state.kind === 'loading' || undefined} className={cn('space-y-3 transition-opacity duration-fast', state.kind === 'loading' && 'opacity-60')}>
            <ul className="space-y-1" aria-label="Résultats">
              {results.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/events/${r.id}`}
                    prefetch={false}
                    onClick={() => { remember(trimmed); onClose(); }}
                    className="flex min-h-11 items-center gap-3 rounded-xl p-2 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      style={{ '--poster': r.posterColor } as CSSProperties}
                      className="ev-poster-card relative block aspect-[4/5] w-12 flex-shrink-0 overflow-hidden rounded-lg"
                      aria-hidden="true"
                    >
                      {r.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- vignette de l'affiche (stockage du projet), chargée à la demande
                        <img src={r.imageUrl} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-base font-semibold text-foreground-strong">{r.title}</span>
                      <span className="block break-words text-sm text-muted-foreground">{[r.when, r.place].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span className="hidden flex-shrink-0 rounded-full bg-brand-vif px-2.5 py-1 text-sm font-bold text-brand-vif-foreground sm:inline">{r.price}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {total > results.length && (
              <Button variant="secondary" fullWidth onClick={() => seeAll(trimmed)} rightIcon={<ArrowRight size={16} />}>
                {`Voir les ${total} résultats`}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
