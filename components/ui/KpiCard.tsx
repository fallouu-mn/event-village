'use client';

import React, { useEffect, useLayoutEffect, useState } from 'react';
import { formatFcfa, formatInteger } from '@/lib/format';
import { cn } from './cn';
import { TONE_ICON, type Tone } from './tones';

export type KpiTone = Extract<Tone, 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'danger'>;

export interface KpiCardProps {
  label: string;
  /** Valeur déjà formatée (lib/format : formatFcfa, formatInteger, formatPercent…). */
  value: React.ReactNode;
  /** Précision sous la valeur (« dont 12 au guichet », « sur 300 places »). */
  hint?: React.ReactNode;
  tone?: KpiTone;
  icon?: React.ReactNode;
  /** Chargement : squelette de même taille (pas de saut de mise en page). */
  loading?: boolean;
  /**
   * Design 1c : la valeur compte de 0 jusqu'à ce nombre à la première apparition (≈ 700 ms, une fois par montage),
   * au format donné ; `value` reste la valeur affichée et lue (texte final exact). Rien ne bouge si le téléphone
   * demande de réduire les animations.
   */
  countUp?: { to: number; format: KpiCountFormat };
  className?: string;
}

export type KpiCountFormat = 'fcfa' | 'integer';

const COUNT_FORMATS: Record<KpiCountFormat, (n: number) => string> = {
  fcfa: (n) => formatFcfa(n),
  integer: (n) => formatInteger(n),
};

/** Durée du comptage (direction.md § 4 : mouvement qui arrive, courbe qui décélère). */
export const KPI_COUNT_UP_MS = 700;

// Avant l'affichage côté navigateur (pas d'éclair de la valeur finale avant le 0) ; effet simple côté serveur.
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Design 1c — chiffre qui compte de 0 à sa valeur, une seule fois par montage (effet sans dépendance),
 * requestAnimationFrame, courbe qui décélère. Pendant le comptage, le chiffre animé est masqué aux lecteurs d'écran
 * (aria-hidden) et la valeur réelle leur est donnée (sr-only) ; la valeur finale, invisible, réserve la place (même
 * cellule de grille, chiffres de largeur fixe) : aucun saut de mise en page. Une fois fini, ou si le téléphone demande
 * de réduire les animations (la CI de bout en bout tourne ainsi), il ne reste que la valeur réelle, en texte simple.
 * Les valeurs intermédiaires ne sont qu'un dessin : la valeur affichée à la fin est `children`, servie telle quelle.
 */
function KpiCountUp({ to, format, children }: { to: number; format: KpiCountFormat; children: React.ReactNode }) {
  // null : valeur réelle affichée en texte simple (rendu serveur, animation finie ou coupée)
  const [frame, setFrame] = useState<string | null>(null);

  useBeforePaint(() => {
    if (!Number.isFinite(to) || to === 0 || prefersReducedMotion()) return undefined;
    const fmt = COUNT_FORMATS[format];
    let raf = 0;
    let start: number | null = null;
    setFrame(fmt(0));
    const step = (now: number) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / KPI_COUNT_UP_MS);
      if (t >= 1) {
        setFrame(null);
        return;
      }
      const eased = 1 - Math.pow(1 - t, 3);
      setFrame(fmt(Math.round(to * eased)));
      raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(raf);
      setFrame(null);
    };
    // Une seule fois par montage : une nouvelle valeur (données rechargées) s'affiche telle quelle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (frame === null) return <>{children}</>;
  return (
    <>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true" className="inline-grid">
        <span className="invisible [grid-area:1/1]">{children}</span>
        <span className="[grid-area:1/1]">{frame}</span>
      </span>
    </>
  );
}

/** Indicateur chiffré (contrat Q) : libellé, valeur, précision ; le calcul se fait côté serveur. */
export const KpiCard: React.FC<KpiCardProps> = ({ label, value, hint, tone = 'neutral', icon, loading = false, countUp, className }) => {
  if (loading) return <KpiCardSkeleton className={className} />;
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        {/* Césure : à 390 px, un mot long (« Encaissements ») débordait sous l'icône (relecture du run 77) */}
        <p className="min-w-0 break-words text-sm font-medium leading-snug text-muted-foreground hyphens-auto">{label}</p>
        {icon && (
          <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', TONE_ICON[tone])} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className="break-words text-2xl font-bold leading-tight tracking-tight text-foreground-strong tabular-nums">
        {countUp ? <KpiCountUp to={countUp.to} format={countUp.format}>{value}</KpiCountUp> : value}
      </p>
      {hint && <p className="text-sm leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
};

export interface KpiCardSkeletonProps {
  className?: string;
}

/** Squelette d'un KpiCard (même gabarit), annoncé comme chargement. */
export const KpiCardSkeleton: React.FC<KpiCardSkeletonProps> = ({ className }) => (
  <div
    className={cn('flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:p-5', className)}
    role="status"
    aria-busy="true"
    aria-label="Chargement de l’indicateur"
  >
    <div className="flex items-start justify-between gap-3">
      <span className="h-4 w-28 rounded bg-background motion-safe:animate-pulse" />
      <span className="h-9 w-9 rounded-xl bg-background motion-safe:animate-pulse" />
    </div>
    <span className="h-8 w-24 rounded bg-background motion-safe:animate-pulse" />
    <span className="h-4 w-36 rounded bg-background motion-safe:animate-pulse" />
  </div>
);
