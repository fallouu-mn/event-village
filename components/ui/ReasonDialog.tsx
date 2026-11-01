'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Textarea } from './Field';

/** Longueur minimale d'un motif, alignée sur la RPC event_transition (REASON_REQUIRED, contrat D4). */
export const MIN_REASON_LENGTH = 3;

export interface ReasonDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Reçoit le motif nettoyé (trim), d'au moins MIN_REASON_LENGTH caractères. */
  onConfirm: (reason: string) => void;
  title: string;
  /** Explication sous le titre : qui verra le motif, ce qui va se passer. */
  description?: string;
  label?: string;
  hint?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
  /** Erreur renvoyée par le serveur, affichée sous le champ. */
  error?: string;
  minLength?: number;
  maxLength?: number;
}

/**
 * Saisie d'un motif obligatoire (refus, suspension) : champ étiqueté, compteur, validation de longueur
 * avant l'envoi ; le serveur revalide (REASON_REQUIRED).
 */
export const ReasonDialog: React.FC<ReasonDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  label = 'Motif',
  hint,
  placeholder,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'primary',
  isLoading = false,
  error,
  minLength = MIN_REASON_LENGTH,
  maxLength = 500,
}) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setTouched(false);
    }
  }, [isOpen]);

  const trimmed = reason.trim();
  const tooShort = trimmed.length < minLength;
  const localError = touched && tooShort ? `Le motif doit contenir au moins ${minLength} caractères.` : undefined;

  const submit = (): void => {
    setTouched(true);
    if (tooShort || isLoading) return;
    onConfirm(trimmed);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={description}
      maxWidth="md"
      busy={isLoading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading} className="flex-1 sm:flex-none">
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={submit} isLoading={isLoading} disabled={isLoading} className="flex-1 sm:flex-none">
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
      >
        <Textarea
          label={label}
          hint={hint ?? `Au moins ${minLength} caractères. Ce motif est communiqué à l’organisateur.`}
          placeholder={placeholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          minLength={minLength}
          maxLength={maxLength}
          showCount
          required
          rows={4}
          disabled={isLoading}
          error={localError ?? error}
        />
      </form>
    </Modal>
  );
};
