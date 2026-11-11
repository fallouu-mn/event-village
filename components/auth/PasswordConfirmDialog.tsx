'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';

/**
 * Lot 9 bis, tâche 13 (R57 ; contrat 4.2, 5.13, B35) — saisie du mot de passe avant une action sensible.
 *
 * Les routes du transfert de billet, du changement de numéro (`phone/start`, `phone/confirm`) et du changement d'email
 * (`PATCH /api/account/profile`) refusent en 403 `PASSWORD_CONFIRMATION_REQUIRED` quand le mot de passe n'a pas été
 * saisi sur cette session depuis moins de 10 minutes. L'écran qui reçoit ce refus ouvre cette boîte ; elle envoie
 * `POST /api/account/password-confirm { password }` et, sur 200, appelle `onConfirmed` : l'appelant relance alors
 * son action, sans rien demander d'autre. Un refus (mot de passe incorrect, trop d'essais, panne) est dit dans la boîte
 * avec le message français de la route ; rien n'est relancé automatiquement.
 *
 * Chargement : l'appelant l'importe par `import()` à l'ouverture (contrat 1, boîtes nouvelles hors du premier
 * chargement), par exemple :
 *   const PasswordConfirmDialog = dynamic(() => import('@/components/auth/PasswordConfirmDialog')
 *       .then((m) => m.PasswordConfirmDialog), { ssr: false });
 * et reconnaît le refus par `err instanceof ApiError && err.code === 'PASSWORD_CONFIRMATION_REQUIRED'`
 * (`ApiError` de `components/partner/fetch-json`).
 *
 * Le mot de passe n'est gardé que le temps de la saisie : vidé à l'ouverture, à la fermeture et après l'envoi. Le
 * collage et les gestionnaires de mots de passe restent permis (`autoComplete="current-password"`, WCAG 3.3.8).
 */

/** Code du refus des routes protégées (lib/auth/password-confirm.ts). */
export const PASSWORD_CONFIRMATION_REQUIRED = 'PASSWORD_CONFIRMATION_REQUIRED';

export interface PasswordConfirmDialogProps {
  isOpen: boolean;
  /** Fermeture sans confirmation : l'action n'est pas relancée. */
  onClose: () => void;
  /** Mot de passe accepté et lié à la session pour 10 minutes : l'appelant relance son action. */
  onConfirmed: () => void;
  /** Ce qui sera fait après la saisie, dit en une phrase (ex. « Le billet sera envoyé juste après. »). */
  actionHint?: string;
}

/** Message de la route ; délai d'attente ajouté quand le serveur le donne (429). */
function refusalMessage(err: unknown): string {
  const base = errorMessage(err, 'Vérification impossible. Réessayez dans un instant.');
  if (err instanceof ApiError && err.status === 429) {
    const wait = err.body?.retryAfterSeconds;
    if (typeof wait === 'number' && wait > 0) return `${base} Nouvel essai possible dans ${Math.ceil(wait / 60)} min.`;
  }
  return base;
}

export function PasswordConfirmDialog({ isOpen, onClose, onConfirmed, actionHint }: PasswordConfirmDialogProps) {
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setVisible(false);
      setError(null);
      setFieldError(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isSending) return;
    setPassword('');
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending) return;
    if (!password) {
      setFieldError('Saisissez votre mot de passe.');
      inputRef.current?.focus();
      return;
    }
    setIsSending(true);
    setError(null);
    setFieldError(null);
    try {
      await sendJson<{ ok: true }>('/api/account/password-confirm', 'POST', { password });
      setPassword('');
      onConfirmed();
    } catch (err) {
      console.error('[PasswordConfirmDialog] confirmation refusée :', err instanceof ApiError ? `${err.status} ${err.code ?? ''}` : String(err));
      setPassword('');
      const message = refusalMessage(err);
      if (err instanceof ApiError && (err.code === 'PASSWORD_INCORRECT' || err.code === 'INVALID_FIELD')) {
        setFieldError(message);
        inputRef.current?.focus();
      } else {
        setError(message);
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Confirmez votre mot de passe"
      subtitle="Par sécurité, cette action demande votre mot de passe."
      icon={<LockKeyhole size={20} aria-hidden="true" />}
      busy={isSending}
      maxWidth="sm"
      initialFocusRef={inputRef as React.RefObject<HTMLElement>}
      footer={
        <div className="flex w-full flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSending}>
            Annuler
          </Button>
          <Button type="submit" form="confirmation-mot-de-passe" variant="primary" isLoading={isSending}>
            Confirmer
          </Button>
        </div>
      }
    >
      <form id="confirmation-mot-de-passe" noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
        <TextInput
          ref={inputRef}
          label="Mot de passe"
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldError) setFieldError(null);
          }}
          error={fieldError ?? undefined}
          disabled={isSending}
          required
          hint={actionHint ?? 'Votre saisie reste valable 10 minutes sur cet appareil.'}
          aside={
            <IconButton
              type="button"
              variant="ghost"
              aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              aria-pressed={visible}
              onClick={() => setVisible((v) => !v)}
            >
              {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
            </IconButton>
          }
        />
        {error && (
          <StatusBanner tone="danger" announce="alert" title="Confirmation impossible">
            {error}
          </StatusBanner>
        )}
      </form>
    </Modal>
  );
}

export default PasswordConfirmDialog;
