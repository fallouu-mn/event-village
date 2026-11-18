/**
 * Lot 5 (contrat Q) — classes Tailwind des tons, sur les tokens sémantiques uniquement. Partagées par
 * StatusBadge, StatusBanner et KpiCard pour qu'un même ton ait le même rendu partout.
 */

export type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'warning-strong' | 'danger' | 'muted';

/** Pastille ou bandeau : fond doux, texte contrasté (≥ 6,8:1), bordure. */
export const TONE_SOFT: Record<Tone, string> = {
    neutral: 'bg-background text-foreground-strong border-border',
    brand: 'bg-primary-soft text-primary-text border-primary-text/30',
    info: 'bg-info-soft text-info-text border-info-border',
    success: 'bg-success-soft text-success-text border-success-border',
    warning: 'bg-warning-soft text-warning-text border-warning-border',
    'warning-strong': 'bg-warning text-on-tone border-warning',
    danger: 'bg-danger-soft text-danger-text border-danger-border',
    muted: 'bg-transparent text-muted-foreground border-border border-dashed',
};

/** Pastille d'icône (KpiCard, bandeaux) : couleur du ton sur fond doux. */
export const TONE_ICON: Record<Tone, string> = {
    neutral: 'bg-background text-muted-foreground',
    brand: 'bg-primary-soft text-primary-text',
    info: 'bg-info-soft text-info-text',
    success: 'bg-success-soft text-success-text',
    warning: 'bg-warning-soft text-warning-text',
    'warning-strong': 'bg-warning text-on-tone',
    danger: 'bg-danger-soft text-danger-text',
    muted: 'bg-background text-muted-foreground',
};

/** Point de couleur (pastilles de statut) : ne porte jamais seul l'information, le libellé l'accompagne. */
export const TONE_DOT: Record<Tone, string> = {
    neutral: 'bg-muted-foreground',
    brand: 'bg-primary',
    info: 'bg-info',
    success: 'bg-success',
    warning: 'bg-warning',
    'warning-strong': 'bg-on-tone',
    danger: 'bg-danger',
    muted: 'bg-muted-foreground/60',
};
