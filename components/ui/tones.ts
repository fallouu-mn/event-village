/**
 * Lot 5 (contrat Q) — classes Tailwind des tons, sur les tokens sémantiques uniquement. Partagées par
 * StatusBadge, StatusBanner et KpiCard pour qu'un même ton ait le même rendu partout.
 */

export type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'warning-strong' | 'danger' | 'muted';

/** Pastille ou bandeau : fond doux, texte contrasté (≥ 6,8:1), bordure. */
export const TONE_SOFT: Record<Tone, string> = {
    neutral: 'bg-surface-sunken text-fg border-border',
    brand: 'bg-brand-bg text-brand-fg border-brand-fg/30',
    info: 'bg-info-bg text-info-fg border-info-border',
    success: 'bg-success-bg text-success-fg border-success-border',
    warning: 'bg-warning-bg text-warning-fg border-warning-border',
    'warning-strong': 'bg-warning text-on-tone border-warning',
    danger: 'bg-danger-bg text-danger-fg border-danger-border',
    muted: 'bg-transparent text-fg-muted border-border border-dashed',
};

/** Pastille d'icône (KpiCard, bandeaux) : couleur du ton sur fond doux. */
export const TONE_ICON: Record<Tone, string> = {
    neutral: 'bg-surface-sunken text-fg-muted',
    brand: 'bg-brand-bg text-brand-fg',
    info: 'bg-info-bg text-info-fg',
    success: 'bg-success-bg text-success-fg',
    warning: 'bg-warning-bg text-warning-fg',
    'warning-strong': 'bg-warning text-on-tone',
    danger: 'bg-danger-bg text-danger-fg',
    muted: 'bg-surface-sunken text-fg-muted',
};

/** Point de couleur (pastilles de statut) : ne porte jamais seul l'information, le libellé l'accompagne. */
export const TONE_DOT: Record<Tone, string> = {
    neutral: 'bg-fg-muted',
    brand: 'bg-brand',
    info: 'bg-info',
    success: 'bg-success',
    warning: 'bg-warning',
    'warning-strong': 'bg-on-tone',
    danger: 'bg-danger',
    muted: 'bg-fg-muted/60',
};
