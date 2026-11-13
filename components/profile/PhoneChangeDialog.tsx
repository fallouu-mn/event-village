'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { MessageSquareText, Phone, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { OtpInput } from '@/components/auth/OtpInput';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { INVALID_SN_PHONE_MESSAGE, toSenegaleseE164 } from '@/lib/validations/auth';
import { formatRetryDelay, retryAfterOf } from '@/lib/format-delay';

/** Boîte « mot de passe » chargée à la demande (lot 9 bis, R57 ; contrat 5.13 : hors du premier chargement). */
const PasswordConfirmDialog = dynamic(
  () => import('@/components/auth/PasswordConfirmDialog').then((m) => m.PasswordConfirmDialog),
  { ssr: false },
);

/**
 * Changement du numéro du compte (lot 9, tâche 9.2, contrat 4.3 et 5.3). Deux étapes :
 *  1. POST /api/account/phone/start { phone } : le code part par SMS au NOUVEAU numéro ;
 *  2. POST /api/account/phone/confirm { phone, code } : le numéro change, les autres sessions sont fermées et
 *     l'ancien numéro est prévenu par SMS.
 * Tant que le code n'est pas confirmé, le numéro actuel reste celui du compte. Le code n'est conservé que le temps
 * de la saisie. Un refus affiche le message français de la route ; il n'y a aucune relance automatique.
 * Lot 9 bis (R57, contrat 4.2 et 5.13) : les deux routes exigent un mot de passe saisi sur la session depuis moins de
 * 10 minutes (403 PASSWORD_CONFIRMATION_REQUIRED, avant tout SMS). Ce refus ouvre PasswordConfirmDialog ; une fois le
 * mot de passe accepté, la même étape est relancée une fois, à la demande de la personne (elle a cliqué « Confirmer »).
 */

interface PhoneChangeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Appelé une fois le numéro changé, avant la fermeture. */
  onChanged: () => void;
}

type Step = 'phone' | 'code';

/** Codes qui concernent le numéro saisi : le message s'affiche sous le champ. */
const PHONE_FIELD_CODES = new Set(['INVALID_FIELD', 'PHONE_TAKEN', 'PHONE_UNCHANGED']);

/** Message de la route, avec le délai d'attente quand le serveur le donne (429). */
function refusalMessage(err: unknown): string {
  const base = errorMessage(err);
  if (err instanceof ApiError && err.status === 429) {
    // Lot 9 quinquies (B3 : E-56) : délai réel en secondes, minutes ou heures
    const wait = retryAfterOf(err.body);
    if (wait) return `${base} ${formatRetryDelay(wait)}`;
  }
  return base;
}

export function PhoneChangeDialog({ isOpen, onClose, onChanged }: PhoneChangeDialogProps) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  /** Étape refusée faute de mot de passe récent, relancée après la confirmation (R57). */
  const [pendingStep, setPendingStep] = useState<(() => void) | null>(null);
  const busy = isSending || isConfirming;

  /** Refus « mot de passe récent exigé » : la boîte s'ouvre, l'étape sera relancée après. */
  const askPassword = (err: unknown, retry: () => void): boolean => {
    if (err instanceof ApiError && err.code === 'PASSWORD_CONFIRMATION_REQUIRED') {
      setPendingStep(() => retry);
      return true;
    }
    return false;
  };

  const reset = () => {
    setStep('phone');
    setPhone('');
    setSentTo('');
    setCode('');
    setPhoneError(null);
    setError(null);
    setInfo(null);
    setPendingStep(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  /** Envoie le code au numéro donné ; une seconde demande vaut « Renvoyer le code ». */
  const sendCode = async (target: string) => {
    setIsSending(true);
    setPhoneError(null);
    setError(null);
    setInfo(null);
    try {
      await sendJson<{ ok: true }>('/api/account/phone/start', 'POST', { phone: target });
      setSentTo(target);
      setCode('');
      setStep('code');
      setInfo('Code envoyé par SMS. Il reste valable 10 minutes.');
    } catch (err) {
      console.error('[PhoneChangeDialog] envoi du code refusé :', err instanceof Error ? err.message : String(err));
      if (askPassword(err, () => void sendCode(target))) return;
      const message = refusalMessage(err);
      if (step === 'phone' && err instanceof ApiError && err.code !== null && PHONE_FIELD_CODES.has(err.code)) setPhoneError(message);
      else setError(message);
    } finally {
      setIsSending(false);
    }
  };

  const submitPhone = (e: React.FormEvent) => {
    e.preventDefault();
    const target = toSenegaleseE164(phone);
    if (!target) {
      setPhoneError(INVALID_SN_PHONE_MESSAGE);
      return;
    }
    void sendCode(target);
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Saisissez les 6 chiffres du code reçu par SMS.');
      return;
    }
    void confirmCode(code);
  };

  const confirmCode = async (value: string) => {
    setIsConfirming(true);
    setError(null);
    setInfo(null);
    try {
      await sendJson<{ ok: true }>('/api/account/phone/confirm', 'POST', { phone: sentTo, code: value });
      reset();
      onChanged();
      onClose();
    } catch (err) {
      console.error('[PhoneChangeDialog] confirmation refusée :', err instanceof Error ? err.message : String(err));
      // Saisie du mot de passe expirée entre les deux étapes : le code reste valable, il est renvoyé tel quel après.
      if (askPassword(err, () => void confirmCode(value))) return;
      setCode('');
      setError(refusalMessage(err));
    } finally {
      setIsConfirming(false);
    }
  };

  const backToPhone = () => {
    setStep('phone');
    setCode('');
    setError(null);
    setInfo(null);
  };

  const footer = step === 'phone' ? (
    <div className="flex w-full flex-wrap justify-end gap-2">
      <Button type="button" variant="ghost" onClick={handleClose} disabled={busy}>Annuler</Button>
      <Button type="submit" form="changement-numero" variant="primary" isLoading={isSending} leftIcon={<MessageSquareText size={18} aria-hidden="true" />}>
        Recevoir le code
      </Button>
    </div>
  ) : (
    <div className="flex w-full flex-wrap justify-end gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={() => void sendCode(sentTo)}
        isLoading={isSending}
        disabled={isConfirming}
        leftIcon={<RefreshCw size={18} aria-hidden="true" />}
      >
        Renvoyer le code
      </Button>
      <Button type="submit" form="changement-numero-code" variant="primary" isLoading={isConfirming} disabled={isSending} leftIcon={<ShieldCheck size={18} aria-hidden="true" />}>
        Confirmer
      </Button>
    </div>
  );

  return (
    <>
    {pendingStep !== null && (
      <PasswordConfirmDialog
        isOpen
        onClose={() => {
          setPendingStep(null);
          setError('Changement de numéro interrompu : votre mot de passe est demandé pour continuer.');
        }}
        onConfirmed={() => {
          const retry = pendingStep;
          setPendingStep(null);
          retry();
        }}
        actionHint={step === 'phone' ? 'Le code sera envoyé à votre nouveau numéro juste après.' : 'Votre code sera vérifié juste après.'}
      />
    )}
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Changer de numéro"
      subtitle={step === 'phone' ? 'Étape 1 sur 2 : votre nouveau numéro' : 'Étape 2 sur 2 : le code reçu par SMS'}
      icon={<Phone size={20} aria-hidden="true" />}
      footer={footer}
      busy={busy}
      maxWidth="md"
    >
      <div className="space-y-4">
        {step === 'phone' ? (
          <form id="changement-numero" noValidate onSubmit={submitPhone}>
            <TextInput
              label="Nouveau numéro de téléphone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="77 123 45 67"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (phoneError) setPhoneError(null);
              }}
              error={phoneError ?? undefined}
              disabled={isSending}
              className="tabular-nums"
              hint="Votre numéro actuel reste celui du compte tant que le code n’est pas confirmé."
            />
          </form>
        ) : (
          <form id="changement-numero-code" noValidate onSubmit={(e) => void submitCode(e)} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-fg">
                Code envoyé au <strong className="font-semibold tabular-nums">{sentTo}</strong>
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={backToPhone} disabled={busy}>
                Modifier le numéro
              </Button>
            </div>
            <OtpInput
              value={code}
              onChange={(next) => {
                setCode(next);
                if (error) setError(null);
              }}
              disabled={isConfirming}
              hasError={error !== null}
            />
            <p className="text-sm text-fg-muted">Une fois le numéro changé, vos autres appareils seront déconnectés et votre ancien numéro recevra un SMS d’information.</p>
          </form>
        )}
        {info && !error && <StatusBanner tone="info" title={info} />}
        {error && (
          <StatusBanner tone="danger" announce="alert" title="Changement impossible">
            {error}
          </StatusBanner>
        )}
      </div>
    </Modal>
    </>
  );
}
