import React from 'react';
import Link from 'next/link';
import { Button } from './Button';
import { AlertCircle, FolderSearch, RefreshCw } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Aucun élément trouvé',
  description = 'Il n’y a aucune donnée à afficher pour le moment.',
  actionLabel,
  actionHref,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-xs my-4">
      <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center mb-4 shadow-inner">
        {icon || <FolderSearch size={28} />}
      </div>
      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mb-5 leading-relaxed">{description}</p>
      
      {actionLabel && actionHref && (
        <Link href={actionHref}>
          <Button variant="primary" size="sm">{actionLabel}</Button>
        </Link>
      )}

      {actionLabel && !actionHref && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
};

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Une erreur est survenue',
  description = 'Impossible de charger ces informations. Veuillez vérifier votre connexion ou réessayer.',
  onRetry,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-3xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 backdrop-blur-xs my-4">
      <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
        <AlertCircle size={28} />
      </div>
      <h3 className="text-base font-bold text-red-950 dark:text-red-200 mb-1">{title}</h3>
      <p className="text-xs text-red-700/80 dark:text-red-300/70 max-w-sm mb-5 leading-relaxed">{description}</p>

      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw size={14} />}
        >
          Réessayer
        </Button>
      )}
    </div>
  );
};
