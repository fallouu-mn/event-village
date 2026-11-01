import React from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, PauseCircle, type LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { TONE_SOFT, type Tone } from './tones';

export type StatusBannerTone = Extract<Tone, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> | 'suspended';

export interface StatusBannerProps {
  tone: StatusBannerTone;
  title: React.ReactNode;
  /** Explication (motif de refus ou de suspension, avis d'annulation…). */
  children?: React.ReactNode;
  /** Action liée (LinkButton, Button). */
  action?: React.ReactNode;
  /** Icône personnalisée (décorative). */
  icon?: React.ReactNode;
  /**
   * Annonce : « status » (poli, par défaut) pour un bandeau présent au chargement ; « alert » pour un
   * message qui apparaît à la suite d'une action et doit interrompre.
   */
  announce?: 'status' | 'alert';
  className?: string;
}

const TONES: Record<StatusBannerTone, string> = {
  neutral: TONE_SOFT.neutral,
  info: TONE_SOFT.info,
  success: TONE_SOFT.success,
  warning: TONE_SOFT.warning,
  danger: TONE_SOFT.danger,
  suspended: TONE_SOFT.warning,
};

const ICONS: Record<StatusBannerTone, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
  suspended: PauseCircle,
};

/**
 * Bandeau d'état (contrat Q, E) : événement suspendu, annulé ou terminé sur la page publique, motif de
 * refus ou de suspension sur la carte de l'organisateur. Annoncé aux lecteurs d'écran.
 */
export const StatusBanner: React.FC<StatusBannerProps> = ({ tone, title, children, action, icon, announce = 'status', className }) => {
  const Icon = ICONS[tone];
  return (
    <div
      role={announce === 'alert' ? 'alert' : 'status'}
      className={cn('flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-start', TONES[tone], className)}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 flex-shrink-0" aria-hidden="true">
          {icon ?? <Icon size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-snug">{title}</p>
          {children && <div className="mt-1 break-words text-sm leading-relaxed">{children}</div>}
        </div>
      </div>
      {action && <div className="flex flex-shrink-0 flex-wrap gap-2 sm:ml-auto">{action}</div>}
    </div>
  );
};
