import React from 'react';
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
  className?: string;
}

/** Indicateur chiffré (contrat Q) : libellé, valeur, précision ; le calcul se fait côté serveur. */
export const KpiCard: React.FC<KpiCardProps> = ({ label, value, hint, tone = 'neutral', icon, loading = false, className }) => {
  if (loading) return <KpiCardSkeleton className={className} />;
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-sm font-medium leading-snug text-fg-muted">{label}</p>
        {icon && (
          <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', TONE_ICON[tone])} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p className="break-words text-2xl font-bold leading-tight tracking-tight text-fg tabular-nums">{value}</p>
      {hint && <p className="text-sm leading-snug text-fg-muted">{hint}</p>}
    </div>
  );
};

export interface KpiCardSkeletonProps {
  className?: string;
}

/** Squelette d'un KpiCard (même gabarit), annoncé comme chargement. */
export const KpiCardSkeleton: React.FC<KpiCardSkeletonProps> = ({ className }) => (
  <div
    className={cn('flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5', className)}
    role="status"
    aria-busy="true"
    aria-label="Chargement de l’indicateur"
  >
    <div className="flex items-start justify-between gap-3">
      <span className="h-4 w-28 rounded bg-surface-sunken motion-safe:animate-pulse" />
      <span className="h-9 w-9 rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
    </div>
    <span className="h-8 w-24 rounded bg-surface-sunken motion-safe:animate-pulse" />
    <span className="h-4 w-36 rounded bg-surface-sunken motion-safe:animate-pulse" />
  </div>
);
