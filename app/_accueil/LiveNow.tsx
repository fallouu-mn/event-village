'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Design 1b (point 11) — rangée « En ce moment » de l'accueil, affinée sur le téléphone. Le serveur rend les candidats
 * (en cours, ou qui commencent dans les 12 heures) et l'état au moment du rendu (`liveAtRender`) : le premier affichage
 * est identique au HTML en cache, sans saut. Puis le téléphone recalcule à partir des heures et pose une seule minuterie
 * sur le prochain changement (début ou fin) : la rangée et chaque carte apparaissent ou disparaissent à la bonne minute,
 * page ouverte, malgré le cache de 60 s. Rangée absente quand rien n'est en cours. Design 1d : une rangée absente du HTML
 * n'est pas insérée au chargement (aucun saut de mise en page), seulement page ouverte.
 */

export interface LiveTimes {
  id: string;
  startsAt: string;
  endsAt: string;
}

const LiveIds = createContext<ReadonlySet<string>>(new Set());

function liveAt(items: LiveTimes[], now: number): Set<string> {
  return new Set(items.filter((i) => Date.parse(i.startsAt) <= now && now < Date.parse(i.endsAt)).map((i) => i.id));
}

/** Prochain début ou fin après `now`, ou null. */
function nextChange(items: LiveTimes[], now: number): number | null {
  let next: number | null = null;
  for (const i of items) {
    for (const t of [Date.parse(i.startsAt), Date.parse(i.endsAt)]) {
      if (Number.isFinite(t) && t > now && (next === null || t < next)) next = t;
    }
  }
  return next;
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of Array.from(a)) if (!b.has(v)) return false;
  return true;
}

export function LiveNowSection({ items, liveAtRender, children, labelledBy }: {
  items: LiveTimes[];
  liveAtRender: string[];
  children: React.ReactNode;
  labelledBy: string;
}) {
  const [live, setLive] = useState<ReadonlySet<string>>(() => new Set(liveAtRender));
  const key = items.map((i) => `${i.id}|${i.startsAt}|${i.endsAt}`).join(',');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Design 1d (run 481, saut de 0,642 au chargement) : une rangée ABSENTE du HTML en cache n'est pas insérée au
    // chargement (avec les cartes d'affiche 4:5, elle pousserait toute la page d'environ 540 px). Les cartes portent déjà
    // « En cours », et la page régénérée (60 s au plus) l'aura. Page ouverte, les changements suivants s'appliquent à la
    // bonne minute, comme avant ; un événement fini est toujours retiré.
    let atLoad = true;
    const tick = (): void => {
      const now = Date.now();
      const current = liveAt(items, now);
      const holdBack = atLoad && liveAtRender.length === 0;
      atLoad = false;
      if (!holdBack) setLive((prev) => (sameSet(prev, current) ? prev : current));
      const next = nextChange(items, now);
      if (next === null) return;
      // setTimeout plafonne à ~24,8 jours ; +250 ms pour tomber après l'instant exact
      timer = setTimeout(tick, Math.min(Math.max(1_000, next - now + 250), 2_000_000_000));
    };
    tick();
    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      if (timer) clearTimeout(timer);
      tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (live.size === 0) return null;
  return (
    <LiveIds.Provider value={live}>
      <section aria-labelledby={labelledBy} className="space-y-4">
        {children}
      </section>
    </LiveIds.Provider>
  );
}

/** Carte de la rangée, montrée seulement pendant que l'événement est en cours. */
export function LiveNowItem({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const live = useContext(LiveIds);
  if (!live.has(id)) return null;
  return <li className={className}>{children}</li>;
}
