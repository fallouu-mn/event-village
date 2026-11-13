'use client';

import React, { useState } from 'react';
import { KeyRound, MessageSquareText, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatRetryDelay, retryAfterOf } from '@/lib/format-delay';

/**
 * Confirmation du numéro du compte par un code SMS (lot 6, contrat B5 et amendement 2).
 *
 * Un billet transféré n'est montré qu'au compte dont le numéro a été vérifié par un code : c'est la seule
 * preuve de possession du numéro. Parcours : POST /api/auth/send-otp { phone, purpose: 'LOGIN' } (le code
 * part par SMS au numéro du compte), puis POST /api/auth/verify-otp { phone, otpCode, purpose: 'LOGIN' }
 * qui pose phone_verified_at. Le code n'est jamais conservé dans le navigateur au-delà de la saisie.
 * Les refus du serveur (code faux ou expiré, trop de tentatives) sont affichés tels quels, en français.
 */

interface PhoneVerifyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Numéro du compte connecté (forme lue sur le profil) ; absent : la vérification est impossible. */
  phone: string | null | undefined;
  /** Appelé une fois le numéro confirmé : la liste des billets reçus est rechargée. */
  onVerified: () => void;
}

type Step = 'intro' | 'code';

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

async function serverMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json() as { error?: unknown; retryAfterSeconds?: unknown };
    const base = typeof body.error === 'string' && body.error ? body.error : fallback;
    // Lot 9 quinquies (B3 : E-56) : délai réel envoyé par le serveur, en secondes, minutes ou heures
    const wait = retryAfterOf(body);
    if (res.status === 429 && wait) return `${base} ${formatRetryDelay(wait)}`;
    return base;
  } catch (err) {
    console.error(`[PhoneVerifyDialog] réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return fallback;
  }
}

export function PhoneVerifyDialog({ isOpen, onClose, phone, onVerified }: PhoneVerifyDialogProps) {
  const [step, setStep] = useState<Step>('intro');
  const [otpCode, setOtpCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const busy = isSending || isVerifying;

  const reset = () => {
    setStep('intro');
    setOtpCode('');
    setError(null);
    setInfo(null);
  };

  const handleClose = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const sendCode = async () => {
    if (!phone) return;
    setIsSending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'LOGIN' }),
      });
      if (!res.ok) {
        setError(await serverMessage(res, `Le code n’a pas pu être envoyé (erreur ${res.status}).`));
        return;
      }
      setStep('code');
      setOtpCode('');
      setInfo('Code envoyé par SMS. Il reste valable 10 minutes.');
    } catch (err) {
      console.error('[PhoneVerifyDialog] envoi du code injoignable :', err instanceof Error ? err.message : String(err));
      setError(NETWORK_MESSAGE);
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!phone) return;
    const code = otpCode.replace(/\D/g, '');
    if (code.length !== 6) {
      setError('Saisissez les 6 chiffres du code reçu par SMS.');
      return;
    }
    setIsVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otpCode: code, purpose: 'LOGIN' }),
      });
      if (!res.ok) {
        setError(await serverMessage(res, `Le code n’a pas pu être vérifié (erreur ${res.status}).`));
        return;
      }
      reset();
      onVerified();
      onClose();
    } catch (err) {
      console.error('[PhoneVerifyDialog] vérification injoignable :', err instanceof Error ? err.message : String(err));
      setError(NETWORK_MESSAGE);
    } finally {
      setIsVerifying(false);
    }
  };

  const footer = !phone ? (
    <div className="flex w-full justify-end">
      <Button variant="primary" onClick={handleClose}>Fermer</Button>
    </div>
  ) : step === 'intro' ? (
    <div className="flex w-full flex-wrap justify-end gap-2">
      <Button variant="ghost" onClick={handleClose} disabled={busy}>Annuler</Button>
      <Button variant="primary" onClick={() => void sendCode()} isLoading={isSending} leftIcon={<MessageSquareText size={18} aria-hidden="true" />}>
        Recevoir le code
      </Button>
    </div>
  ) : (
    <div className="flex w-full flex-wrap justify-end gap-2">
      <Button variant="ghost" onClick={() => void sendCode()} isLoading={isSending} disabled={isVerifying} leftIcon={<RefreshCw size={18} aria-hidden="true" />}>
        Renvoyer le code
      </Button>
      <Button variant="primary" type="submit" form="verification-numero" isLoading={isVerifying} disabled={isSending} leftIcon={<ShieldCheck size={18} aria-hidden="true" />}>
        Confirmer
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Confirmer mon numéro"
      subtitle="Un code par SMS prouve que ce numéro est bien le vôtre."
      icon={<KeyRound size={20} aria-hidden="true" />}
      footer={footer}
      busy={busy}
      maxWidth="md"
    >
      <div className="space-y-4">
        {!phone ? (
          <StatusBanner tone="warning" title="Aucun numéro sur votre compte">
            Ajoutez d’abord un numéro de téléphone à votre compte pour recevoir les billets qui vous sont transférés.
          </StatusBanner>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-fg">
              Nous envoyons un code à 6 chiffres au <strong className="font-semibold tabular-nums">{phone}</strong>. Une fois le numéro confirmé, les billets qui vous ont été transférés s’affichent dans l’onglet « Reçus ».
            </p>
            {info && !error && <StatusBanner tone="info" title={info} />}
            {step === 'code' && (
              <form id="verification-numero" noValidate onSubmit={(e) => void verifyCode(e)}>
                <TextInput
                  label="Code reçu par SMS"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]*"
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (error) setError(null);
                  }}
                  disabled={isVerifying}
                  className="tracking-widest tabular-nums"
                  hint="6 chiffres, valable 10 minutes."
                />
              </form>
            )}
            {error && (
              <StatusBanner tone="danger" announce="alert" title="Vérification impossible">
                {error}
              </StatusBanner>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
