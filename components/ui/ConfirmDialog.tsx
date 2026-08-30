'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'default',
  isLoading = false,
}) => {
  const iconColor = variant === 'danger'
    ? 'text-red-500'
    : variant === 'warning'
    ? 'text-amber-500'
    : 'text-[#FF5722]';

  const buttonVariant = variant === 'danger' ? 'danger' : 'primary';

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="sm">
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
          variant === 'danger'
            ? 'bg-red-50 dark:bg-red-950/30'
            : variant === 'warning'
            ? 'bg-amber-50 dark:bg-amber-950/30'
            : 'bg-orange-50 dark:bg-orange-950/30'
        }`}>
          <AlertTriangle size={24} className={iconColor} />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">
            {message}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full pt-2">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={buttonVariant}
            size="md"
            fullWidth
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
