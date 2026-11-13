'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { PasswordStrengthChecklist, allPasswordCriteriaMet } from '@/components/auth/PasswordStrengthChecklist';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { PASSWORD_HINT } from '@/lib/auth/password-rules';

/**
 * Lot 9 bis, tâche 42 (R85 ; contrat 4.4, 5.42, B89) — « Changer mon mot de passe » une fois connecté.
 *
 * Trois champs (actuel, nouveau, confirmation), envoyés à `POST /api/account/password { current_password, new_password }`.
 * Le serveur vérifie l'actuel, pose le nouveau, ferme les autres sessions et garde celle-ci ; sur 200, la boîte dit le
 * message de la route (« Mot de passe modifié. Vos autres appareils sont déconnectés. ») et appelle `onChanged`.
 * Chaque refus est dit près du champ concerné (mot de passe actuel incorrect, nouveau trop faible ou identique) ou, s'il
 * ne vise aucun champ (trop d'essais, session, panne), dans un bandeau annoncé ; rien n'est relancé automatiquement.
 *
 * Contrôles avant l'envoi (mêmes règles que le serveur, `StrongPasswordSchema`) : actuel saisi, nouveau robuste,
 * confirmation identique ; le premier champ en défaut reçoit le focus.
 *
 * Chargement : l'appelant l'importe par `import()` à l'ouverture (contrat 1, boîtes nouvelles hors du premier chargement) :
 *   const PasswordChangeDialog = dynamic(() => import('@/components/profile/PasswordChangeDialog')
 *       .then((m) => m.PasswordChangeDialog), { ssr: false });
 *
 * Les mots de passe ne sont gardés que le temps de la saisie : vidés à l'ouverture, à la fermeture et après l'envoi.
 * Collage et gestionnaires de mots de passe permis (`autoComplete`, WCAG 3.3.8).
 */

export interface PasswordChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Mot de passe changé : message du serveur, à dire par l'appelant s'il le souhaite. */
  onChanged?: (message: string) => void;
}

type FieldName = 'current' | 'next' | 'confirm';
type FieldErrors = Partial<Record<FieldName, string>>;

// Lot 9 quinquies (A7) : aide de la règle commune (lib/auth/password-rules.ts)
const STRENGTH_HINT = PASSWORD_HINT;
const SUCCESS_FALLBACK = 'Mot de passe modifié. Vos autres appareils sont déconnectés.';

/** Message de la route ; délai d'attente ajouté quand le serveur le donne (429). */
function refusalMessage(err: unknown): string {
  const base = errorMessage(err, 'Votre mot de passe n’a pas pu être changé. Réessayez dans un instant.');
  if (err instanceof ApiError && err.status === 429) {
    const wait = err.body?.retryAfterSeconds;
    if (typeof wait === 'number' && wait > 0) return `${base} Nouvel essai possible dans ${Math.ceil(wait / 60)} min.`;
  }
  return base;
}

/** Champ visé par un refus du serveur, ou null quand le refus ne concerne aucun champ. */
function fieldOf(err: unknown): FieldName | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === 'PASSWORD_INCORRECT') return 'current';
  if (err.code === 'WEAK_PASSWORD' || err.code === 'PASSWORD_UNCHANGED') return 'next';
  if (err.code === 'INVALID_FIELD') {
    const field = err.body?.field;
    if (field === 'current_password') return 'current';
    if (field === 'new_password') return 'next';
  }
  return null;
}

export function PasswordChangeDialog({ isOpen, onClose, onChanged }: PasswordChangeDialogProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const currentRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);

  const clearSecrets = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  useEffect(() => {
    if (isOpen) {
      clearSecrets();
      setVisible(false);
      setErrors({});
      setError(null);
      setDone(null);
    }
  }, [isOpen]);

  // Le formulaire disparaît au succès : le focus va au message, sinon il serait perdu hors de la boîte.
  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  const focusField = (field: FieldName) => {
    const ref = field === 'current' ? currentRef : field === 'next' ? nextRef : confirmRef;
    ref.current?.focus();
  };

  const handleClose = () => {
    if (isSending) return;
    clearSecrets();
    onClose();
  };

  const validate = (): FieldErrors => {
    const found: FieldErrors = {};
    if (!current) found.current = 'Saisissez votre mot de passe actuel.';
    if (!next) found.next = 'Saisissez le nouveau mot de passe.';
    else if (!allPasswordCriteriaMet(next)) found.next = `Mot de passe trop faible : ${STRENGTH_HINT}`;
    else if (next === current) found.next = 'Le nouveau mot de passe doit être différent de l’actuel.';
    if (!confirm) found.confirm = 'Saisissez de nouveau le nouveau mot de passe.';
    else if (next && confirm !== next) found.confirm = 'Les deux saisies du nouveau mot de passe sont différentes.';
    return found;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || done) return;
    setError(null);
    const found = validate();
    setErrors(found);
    const first = (['current', 'next', 'confirm'] as const).find((f) => found[f]);
    if (first) {
      focusField(first);
      return;
    }
    setIsSending(true);
    try {
      const reply = await sendJson<{ ok: true; message?: string }>('/api/account/password', 'POST', {
        current_password: current,
        new_password: next,
      });
      clearSecrets();
      const message = typeof reply?.message === 'string' && reply.message ? reply.message : SUCCESS_FALLBACK;
      setDone(message);
      onChanged?.(message);
    } catch (err) {
      console.error('[PasswordChangeDialog] changement refusé :', err instanceof ApiError ? `${err.status} ${err.code ?? ''}` : String(err));
      const message = refusalMessage(err);
      const field = fieldOf(err);
      if (field === 'current') setCurrent('');
      if (field) {
        setErrors({ [field]: message });
        focusField(field);
      } else {
        setError(message);
      }
    } finally {
      setIsSending(false);
    }
  };

  const toggle = (
    <IconButton
      type="button"
      variant="ghost"
      aria-label={visible ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
      aria-pressed={visible}
      onClick={() => setVisible((v) => !v)}
    >
      {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
    </IconButton>
  );
  const type = visible ? 'text' : 'password';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Changer mon mot de passe"
      subtitle="Les autres appareils seront déconnectés ; celui-ci reste connecté."
      icon={<KeyRound size={20} aria-hidden="true" />}
      busy={isSending}
      maxWidth="sm"
      initialFocusRef={currentRef as React.RefObject<HTMLElement>}
      footer={
        done ? (
          <div className="flex w-full justify-end">
            <Button type="button" variant="primary" onClick={handleClose}>
              Fermer
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSending}>
              Annuler
            </Button>
            <Button type="submit" form="changement-mot-de-passe" variant="primary" isLoading={isSending}>
              Changer le mot de passe
            </Button>
          </div>
        )
      }
    >
      {done ? (
        <div ref={doneRef} tabIndex={-1} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <StatusBanner tone="success" announce="status" title="Mot de passe changé">
            {done}
          </StatusBanner>
        </div>
      ) : (
        <form id="changement-mot-de-passe" noValidate onSubmit={(e) => void submit(e)} className="space-y-4">
          <TextInput
            ref={currentRef}
            label="Mot de passe actuel"
            type={type}
            autoComplete="current-password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              if (errors.current) setErrors((v) => ({ ...v, current: undefined }));
            }}
            error={errors.current}
            disabled={isSending}
            required
            aside={toggle}
          />
          <div className="space-y-2">
            <TextInput
              ref={nextRef}
              label="Nouveau mot de passe"
              type={type}
              autoComplete="new-password"
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                if (errors.next) setErrors((v) => ({ ...v, next: undefined }));
              }}
              error={errors.next}
              hint={STRENGTH_HINT}
              disabled={isSending}
              required
            />
            <PasswordStrengthChecklist password={next} />
          </div>
          <TextInput
            ref={confirmRef}
            label="Confirmer le nouveau mot de passe"
            type={type}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              if (errors.confirm) setErrors((v) => ({ ...v, confirm: undefined }));
            }}
            error={errors.confirm}
            disabled={isSending}
            required
          />
          {error && (
            <StatusBanner tone="danger" announce="alert" title="Changement impossible">
              {error}
            </StatusBanner>
          )}
        </form>
      )}
    </Modal>
  );
}

export default PasswordChangeDialog;
