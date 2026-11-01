'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { TextInput } from './Field';
import { cn } from './cn';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Texte court sous le titre. */
  message?: string;
  /** Contenu détaillé (impact d'une annulation, liste des conséquences…). */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  /** Action en cours : boutons désactivés, fermeture bloquée. */
  isLoading?: boolean;
  /** Texte à retaper pour confirmer (le titre de l'événement à annuler) ; comparé après trim. */
  requireText?: string;
  /** Libellé du champ de confirmation (par défaut : « Pour confirmer, saisissez … »). */
  requireTextLabel?: string;
  /** Désactive la confirmation (champs de la modale incomplets). */
  confirmDisabled?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const ICON_TONE = {
  danger: 'bg-danger-bg text-danger-fg',
  warning: 'bg-warning-bg text-warning-fg',
  default: 'bg-brand-bg text-brand-fg',
} as const;

/**
 * Confirmation (contrat Q) construite sur Modal : contenu libre (children), saisie de confirmation
 * (requireText) et état de chargement qui bloque la fermeture.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  children,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  isLoading = false,
  requireText,
  requireTextLabel,
  confirmDisabled = false,
  maxWidth = 'sm',
}) => {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (isOpen) setTyped('');
  }, [isOpen]);

  const textMatches = !requireText || typed.trim() === requireText.trim();
  const canConfirm = textMatches && !confirmDisabled && !isLoading;
  const Icon = variant === 'default' ? Info : AlertTriangle;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth={maxWidth}
      busy={isLoading}
      role="alertdialog"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading} className="flex-1 sm:flex-none">
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              if (canConfirm) onConfirm();
            }}
            disabled={!canConfirm}
            isLoading={isLoading}
            className="flex-1 sm:flex-none"
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {message && (
          <div className="flex items-start gap-3">
            <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', ICON_TONE[variant])} aria-hidden="true">
              <Icon size={20} />
            </div>
            <p className="pt-2 text-sm leading-relaxed text-fg-muted">{message}</p>
          </div>
        )}
        {children}
        {requireText && (
          <TextInput
            label={requireTextLabel ?? `Pour confirmer, saisissez « ${requireText} »`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={isLoading}
            error={typed.trim().length > 0 && !textMatches ? 'Le texte saisi ne correspond pas.' : undefined}
            data-autofocus="true"
          />
        )}
      </div>
    </Modal>
  );
};
