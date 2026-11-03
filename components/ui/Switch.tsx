'use client';

import React, { useId } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { cn } from './cn';

/**
 * Bascule partagée (lot 6, contrat H4) : un bouton `role="switch"` (lu « activé / désactivé » par les
 * lecteurs d'écran), libellé visible lié par `htmlFor` / `id`, aide et erreur reliées par
 * `aria-describedby`, zone cliquable de 44 px au moins (la ligne entière : libellé et bascule), état de
 * chargement (`aria-busy`, bascule inactive pendant l'enregistrement) et état d'erreur annoncé.
 * L'état coché est porté par la position du curseur ET par le texte « Activé » / « Désactivé » : la couleur
 * ne porte jamais seule l'information.
 */

export interface SwitchProps {
  /** Libellé visible de la ligne (« SMS », « Notifications push »…). */
  label: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Aide sous le libellé. */
  description?: React.ReactNode;
  /** Enregistrement en cours : la bascule reste visible mais inactive, annoncée occupée. */
  loading?: boolean;
  /** Message d'erreur près de la bascule, relié par aria-describedby. */
  error?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({ label, checked, onChange, description, loading = false, error, disabled = false, id, className }: SwitchProps) {
  const generated = useId();
  const controlId = id ?? `bascule-${generated}`;
  const descriptionId = description ? `${controlId}-aide` : undefined;
  const errorId = error ? `${controlId}-erreur` : undefined;
  const describedBy = [errorId, descriptionId].filter(Boolean).join(' ') || undefined;
  const inactive = disabled || loading;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex min-h-11 items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor={controlId} className={cn('block cursor-pointer text-sm font-semibold text-fg', inactive && 'cursor-not-allowed')}>
            {label}
          </label>
          {description && (
            <p id={descriptionId} className="text-sm leading-snug text-fg-muted">
              {description}
            </p>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <span className="text-sm text-fg-muted" aria-hidden="true">
            {checked ? 'Activé' : 'Désactivé'}
          </span>
          <button
            id={controlId}
            type="button"
            role="switch"
            aria-checked={checked}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            aria-busy={loading || undefined}
            disabled={inactive}
            onClick={() => onChange(!checked)}
            className={cn(
              'relative inline-flex h-11 min-h-11 w-16 flex-shrink-0 cursor-pointer items-center rounded-full p-1',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            <span
              className={cn(
                'relative inline-flex h-7 w-14 items-center rounded-full border transition-colors duration-200',
                checked ? 'border-brand bg-brand' : 'border-border-strong bg-surface-sunken',
              )}
              aria-hidden="true"
            >
              <span
                className={cn(
                  'absolute left-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface shadow-sm transition-transform duration-200',
                  checked ? 'translate-x-7' : 'translate-x-0',
                )}
              >
                {loading && <Loader2 size={14} className="text-fg-muted motion-safe:animate-spin" />}
              </span>
            </span>
          </button>
        </div>
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm font-medium leading-snug text-danger-fg">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
