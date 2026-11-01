import React from 'react';
import { AlertCircle, FolderSearch, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { LinkButton } from './LinkButton';
import { cn } from './cn';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

/** État vide (contrat Q) : message et action facultative, sur les tokens du thème. */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Aucun élément trouvé',
  description = 'Il n’y a aucune donnée à afficher pour le moment.',
  actionLabel,
  actionHref,
  onAction,
  icon,
  className,
}) => {
  return (
    <div className={cn('my-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface p-8 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-bg text-brand-fg" aria-hidden="true">
        {icon || <FolderSearch size={28} />}
      </div>
      <h3 className="mb-1 text-base font-semibold text-fg">{title}</h3>
      <p className="mb-5 max-w-sm text-sm leading-relaxed text-fg-muted">{description}</p>

      {actionLabel && actionHref && (
        <LinkButton href={actionHref} variant="primary">{actionLabel}</LinkButton>
      )}

      {actionLabel && !actionHref && onAction && (
        <Button variant="primary" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  description?: string;
  /** Obligatoire (contrat Q) : une erreur de chargement propose toujours « Réessayer ». */
  onRetry: () => void;
  /** Nouvel essai en cours. */
  isRetrying?: boolean;
  className?: string;
}

/** État d'erreur (contrat Q) : message en français, bouton « Réessayer », annoncé aux lecteurs d'écran. */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Une erreur est survenue',
  description = 'Impossible de charger ces informations. Vérifiez votre connexion, puis réessayez.',
  onRetry,
  isRetrying = false,
  className,
}) => {
  return (
    <div role="alert" className={cn('my-4 flex flex-col items-center justify-center rounded-3xl border border-danger-border bg-danger-bg p-8 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-danger-fg" aria-hidden="true">
        <AlertCircle size={28} />
      </div>
      <h3 className="mb-1 text-base font-semibold text-danger-fg">{title}</h3>
      <p className="mb-5 max-w-sm text-sm leading-relaxed text-fg">{description}</p>
      <Button variant="secondary" onClick={onRetry} isLoading={isRetrying} leftIcon={<RefreshCw size={16} />}>
        Réessayer
      </Button>
    </div>
  );
};
