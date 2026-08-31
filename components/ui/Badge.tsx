import React from 'react';
import { clsx } from 'clsx';

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
  const variants = {
    default: 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-700',
    brand: 'bg-[#FF5722]/15 text-[#FF5722] dark:text-[#FF5722] border-[#FF5722]/30 font-black',
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    danger: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
    info: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
    neutral: 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 font-bold rounded-md gap-1',
    md: 'text-xs px-2.5 py-1 font-bold rounded-lg gap-1.5',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center border uppercase tracking-wider select-none leading-none',
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

    // 🔴 REJET / ANNULATION / ÉCHEC / SUSPENSION / RUPTURE
    case 'FAILED':
    case 'ECHEC':
    case 'REJETE':
    case 'REJETEE':
    case 'ANNULE':
    case 'ANNULEE':
    case 'CANCELLED':
    case 'SUSPENDU':
    case 'EPUISE':
    case 'INDISPONIBLE':
    case 'REFUNDED':
    case 'REMBOURSE':
      variant = 'danger';
      if (norm === 'REFUNDED' || norm === 'REMBOURSE') label = 'REMBOURSÉ';
      else if (norm === 'CANCELLED') label = 'ANNULÉ';
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
      label = '⭐ AMBASSADEUR';
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
