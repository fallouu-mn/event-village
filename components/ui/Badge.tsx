import React from 'react';
import { clsx } from 'clsx';
import { TONE_SOFT } from './tones';

export type BadgeVariant = 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  icon,
}) => {
  // Lot 5 (contrat Q) : tons sur les tokens sémantiques (components/ui/tones.ts), 12 px au moins.
  const variants: Record<BadgeVariant, string> = {
    default: TONE_SOFT.neutral,
    brand: TONE_SOFT.brand,
    success: TONE_SOFT.success,
    warning: TONE_SOFT.warning,
    danger: TONE_SOFT.danger,
    info: TONE_SOFT.info,
    neutral: 'bg-surface-sunken text-fg-muted border-border',
  };

  const sizes = {
    sm: 'text-caption px-2 py-0.5 font-semibold rounded-md gap-1',
    md: 'text-caption px-2.5 py-1 font-semibold rounded-lg gap-1.5',
  };

  return (
    <span
      // Lot 6 (contrat A6) : texte de 12 px admis par le contrôle des captures (pastille, MASTER.md).
      data-ev-caption=""
      className={clsx(
        'inline-flex items-center border select-none leading-tight',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

export interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '', size = 'sm' }) => {
  const norm = (status || '').toUpperCase();

  let variant: BadgeVariant = 'neutral';
  let label = status;

  switch (norm) {
    // 🟢 SUCCÈS / VALIDÉ / CONFIRMÉ / PAYÉ / DISPONIBLE / EN LIGNE
    case 'VALIDE':
    case 'PUBLIE':
    case 'CONFIRMEE':
    case 'CONFIRME':
    case 'SUCCESS':
    case 'PAID':
    case 'ACTIF':
    case 'DISPONIBLE':
    case 'LIVREE':
      variant = 'success';
      if (norm === 'SUCCESS') label = 'PAYÉ';
      else if (norm === 'PUBLIE') label = 'EN LIGNE';
      else label = norm.replace(/_/g, ' ');
      break;

    // 🟠 EN ATTENTE / TRANSITION / MORATOIRE / BROUILLON / PARTIEL
    case 'PENDING':
    case 'EN_ATTENTE':
    case 'PROCESSING':
    case 'EN_PREPARATION':
    case 'PRETE':
    case 'EN_LIVRAISON':
    case 'BROUILLON':
    case 'MORATOIRE':
    case 'PARTIAL':
      variant = 'warning';
      if (norm === 'PENDING') label = 'EN ATTENTE';
      else if (norm === 'PARTIAL') label = 'PARTIEL';
      else if (norm === 'MORATOIRE') label = 'MORATOIRE 48H';
      else label = norm.replace(/_/g, ' ');
      break;

    // 🔴 REJET / ANNULATION / ÉCHEC / SUSPENSION / RUPTURE / SUPPRESSION
    case 'FAILED':
    case 'ECHEC':
    case 'REJETE':
    case 'REJETEE':
    case 'ANNULE':
    case 'ANNULEE':
    case 'CANCELLED':
    case 'SUSPENDU':
    case 'SUPPRIME':
    case 'SUPPRIMEE':
    case 'EPUISE':
    case 'INDISPONIBLE':
    case 'REFUNDED':
    case 'REMBOURSE':
      variant = 'danger';
      if (norm === 'REFUNDED' || norm === 'REMBOURSE') label = 'REMBOURSÉ';
      else if (norm === 'CANCELLED') label = 'ANNULÉ';
      else if (norm === 'SUPPRIME' || norm === 'SUPPRIMEE') label = 'SUPPRIMÉ (RGPD)';
      else label = norm.replace(/_/g, ' ');
      break;

    // 🔵 INFO / UTILISÉ / TERMINÉ / OCCUPÉ
    case 'UTILISE':
    case 'TERMINE':
    case 'TERMINEE':
    case 'OCCUPE':
      variant = 'info';
      if (norm === 'UTILISE') label = 'COMPOSTÉ';
      else label = norm.replace(/_/g, ' ');
      break;

    // ⭐ IDENTITÉ / AMBASSADEUR / PREMIUM
    case 'AMBASSADEUR':
      variant = 'brand';
      label = 'AMBASSADEUR';
      break;
    case 'PREMIUM':
    case 'FOUNDER':
      variant = 'brand';
      label = norm;
      break;

    default:
      variant = 'neutral';
      label = status || 'NON DÉFINI';
  }

  return <Badge variant={variant} size={size} className={className}>{label}</Badge>;
};
