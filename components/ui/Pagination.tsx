'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';
import { formatInteger } from '@/lib/format';

export interface PaginationProps {
  /** Page courante, à partir de 1. */
  page: number;
  /** Taille de page (20 par défaut côté API, 50 au plus). */
  pageSize: number;
  /** Nombre total d'éléments (réponse `{ items, page, pageSize, total }`). */
  total: number;
  onPageChange: (page: number) => void;
  /** Nom accessible de la navigation. */
  ariaLabel?: string;
  /** Requête en cours : boutons désactivés. */
  isLoading?: boolean;
  className?: string;
}

/**
 * Pagination par décalage (contrat G) : Précédent, « Page X sur Y », Suivant ; boutons de 44 px ;
 * position annoncée (aria-live) à chaque changement.
 */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  ariaLabel = 'Pagination',
  isLoading = false,
  className,
}) => {
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
  const current = Math.min(Math.max(1, page), pageCount);
  if (total <= pageSize && current === 1) return null;

  return (
    <nav aria-label={ariaLabel} className={cn('flex flex-wrap items-center justify-between gap-3 pt-2', className)}>
      <Button
        variant="secondary"
        onClick={() => onPageChange(current - 1)}
        disabled={current <= 1 || isLoading}
        leftIcon={<ChevronLeft size={18} />}
      >
        Précédent
      </Button>
      <p className="text-sm text-fg-muted tabular-nums" aria-live="polite">
        Page {current} sur {pageCount}
        <span className="hidden sm:inline"> · {formatInteger(total)} résultat{total > 1 ? 's' : ''}</span>
      </p>
      <Button
        variant="secondary"
        onClick={() => onPageChange(current + 1)}
        disabled={current >= pageCount || isLoading}
        rightIcon={<ChevronRight size={18} />}
      >
        Suivant
      </Button>
    </nav>
  );
};
