'use client';

import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { eventCountdown, paymentCountdown, saleCloseCountdown, type Countdown } from '@/lib/events/countdown';

/**
 * Design 1d (point 4) — comptes à rebours de la fiche, calculés dans le navigateur APRÈS le chargement : le premier rendu
 * (serveur et navigateur) ne montre rien, puis l'heure du téléphone prend le relais (comme withClock ; aucune heure dans
 * la page en cache, aucune erreur d'hydratation). Une minuterie par compte, recalée sur le prochain changement utile
 * (chaque seconde le dernier jour, à la minute avant, plus rien après).
 * Lecteurs d'écran : le texte visible (qui peut changer chaque seconde) leur est caché ; ils lisent `spoken`, à la minute
 * près, sans annonce automatique (aucune zone « live »).
 */
function useCountdown(compute: (now: number) => Countdown, deps: ReadonlyArray<string | boolean | null>): Countdown | null {
  const [state, setState] = useState<Countdown | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const tick = (): void => {
      const next = compute(Date.now());
      setState((prev) => (prev && prev.text === next.text && prev.spoken === next.spoken && prev.kind === next.kind ? prev : next));
      if (next.nextIn !== null) timer = window.setTimeout(tick, Math.min(next.nextIn, 2_000_000_000));
    };
    tick();
    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      window.clearTimeout(timer);
      tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // compute est recréée à chaque rendu : seules ses entrées (deps) relancent la minuterie
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function CountdownText({ countdown, className, icon = true }: { countdown: Countdown | null; className?: string; icon?: boolean }) {
  if (!countdown?.text) return null;
  return (
    <p className={cn('inline-flex items-center gap-2 tabular-nums', className)}>
      {icon && <Timer size={16} className="flex-shrink-0" aria-hidden="true" />}
      <span aria-hidden="true">{countdown.text}</span>
      <span className="sr-only">{countdown.spoken}</span>
    </p>
  );
}

/** Début de l'événement : rien à plus de 7 jours, « Commence dans 2 j 4 h », horloge le dernier jour, « En cours ». */
export function EventCountdown({ startsAt, endsAt, enabled = true, className }: { startsAt: string; endsAt: string; enabled?: boolean; className?: string }) {
  const countdown = useCountdown((now) => (enabled ? eventCountdown(now, startsAt, endsAt) : { kind: 'none', text: null, spoken: null, nextIn: null }), [startsAt, endsAt, enabled]);
  // « En cours » est déjà dit sur l'affiche (LiveOnPoster)
  return countdown?.kind === 'live' ? null : <CountdownText countdown={countdown} className={className} />;
}

/** Fin des ventes en ligne proche (48 h au plus) : « Ventes closes dans … ». */
export function SaleCloseCountdown({ saleEnd, className }: { saleEnd: string | null; className?: string }) {
  const countdown = useCountdown((now) => saleCloseCountdown(now, saleEnd), [saleEnd]);
  return <CountdownText countdown={countdown} className={className} />;
}

/** Paiement en attente : « 12 min 05 s pour finir le paiement ». */
export function PaymentCountdown({ expiresAt, className }: { expiresAt: string | null; className?: string }) {
  const countdown = useCountdown((now) => paymentCountdown(now, expiresAt), [expiresAt]);
  return <CountdownText countdown={countdown} className={className} />;
}
