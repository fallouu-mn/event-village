'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { KeyRound, LogOut, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { OtpInput } from '@/components/auth/OtpInput';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatRetryDelay, retryAfterOf } from '@/lib/format-delay';

/**
 * Lot 9 quinquies (A3 : AUTH-05 ; A4 : AUTH-04) — fenêtre de sécurité de l'administration.
 *
 *  - À l'ouverture de /admin : GET /api/admin/step-up ; sur un nouvel appareil, ou après 12 h, la page attend le code
 *    administrateur reçu par SMS (et le mot de passe d'abord si la session a plus de 12 h).
 *  - Après 30 minutes sans activité (minuterie locale, et tout refus 403 ADMIN_PASSWORD_REQUIRED ou ADMIN_SMS_REQUIRED
 *    renvoyé par une route), la fenêtre redemande le mot de passe PAR-DESSUS la page : rien n'est perdu, l'action
 *    interrompue se relance une fois la fenêtre fermée.
 *  - Le serveur décide toujours (lib/admin/step-up.ts) : la fenêtre ne fait qu'aider.
 * Saisie du code : 6 cases, collage, clavier numérique, « one-time-code » (OtpInput) ; mot de passe : « current-password ».
 */

type Required = 'ADMIN_PASSWORD_REQUIRED' | 'ADMIN_SMS_REQUIRED' | null;
interface Status { required: Required; reason: string | null; idleMinutes: number; phone: string | null }

const STEP_UP_CODES = new Set(['ADMIN_PASSWORD_REQUIRED', 'ADMIN_SMS_REQUIRED']);
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

export function AdminStepUpGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [opened, setOpened] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastInput = useRef<number>(Date.now());

  const refresh = useCallback(async (): Promise<Status | null> => {
    try {
      const res = await fetch('/api/admin/step-up', { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as (Status & { error?: string }) | null;
      if (!res.ok || !body) {
        setLoadError(body?.error ?? 'Vérification de la session momentanément impossible. Rechargez la page.');
        return null;
      }
      setLoadError(null);
      setStatus(body);
      if (!body.required) setOpened(true);
      return body;
    } catch (err) {
      console.error('[AdminStepUpGate] état de la session illisible :', err instanceof Error ? err.message : String(err));
      setLoadError('Connexion impossible. Vérifiez votre réseau puis rechargez la page.');
      return null;
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Tout refus d'étape de sécurité renvoyé par une route ouvre la fenêtre (la page reste affichée dessous).
  useEffect(() => {
    const original = window.fetch;
    const patched: typeof window.fetch = async (...args) => {
      const res = await original(...args);
      if (res.status === 403) {
        res.clone().json().then((b: { code?: string } | null) => {
          if (b?.code && STEP_UP_CODES.has(b.code)) void refresh();
        }).catch(() => undefined);
      }
      return res;
    };
    window.fetch = patched;
    return () => { if (window.fetch === patched) window.fetch = original; };
  }, [refresh]);

  // Minuterie d'inactivité locale : la fenêtre se rouvre d'elle-même à l'échéance (le serveur l'exige aussi).
  useEffect(() => {
    const touch = () => { lastInput.current = Date.now(); };
    for (const e of ACTIVITY_EVENTS) window.addEventListener(e, touch, { passive: true });
    const timer = window.setInterval(() => {
      const idle = (status?.idleMinutes ?? 30) * 60_000;
      if (opened && !status?.required && Date.now() - lastInput.current > idle) {
        setStatus((s) => (s ? { ...s, required: 'ADMIN_PASSWORD_REQUIRED', reason: 'IDLE' } : s));
      }
    }, 30_000);
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, touch);
      window.clearInterval(timer);
    };
  }, [opened, status]);

  const done = async () => {
    lastInput.current = Date.now();
    await refresh();
  };

  return (
    <>
      {opened ? children : (
        <div className="mx-auto max-w-lg py-10" aria-busy={!loadError}>
          {loadError
            ? <StatusBanner tone="danger" announce="alert" title="Administration indisponible">{loadError}</StatusBanner>
            : <p className="text-center text-sm text-fg-muted">Vérification de la session d’administration…</p>}
        </div>
      )}
      {status?.required && (
        <StepUpDialog required={status.required} reason={status.reason} phone={status.phone} onDone={() => void done()} />
      )}
    </>
  );
}

function StepUpDialog({ required, reason, phone, onDone }: { required: Exclude<Required, null>; reason: string | null; phone: string | null; onDone: () => void }) {
  const errorId = useId();
  const { signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setError(null); setCode(''); setPassword(''); }, [required]);

  const failure = (err: unknown, fallback: string) => {
    const wait = err instanceof ApiError && err.status === 429 ? retryAfterOf(err.body) : null;
    setError(wait ? `${errorMessage(err, fallback)} ${formatRetryDelay(wait)}` : errorMessage(err, fallback));
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true); setError(null);
    try {
      await sendJson('/api/admin/step-up', 'POST', { password });
      onDone();
    } catch (err) {
      failure(err, 'Mot de passe non vérifié. Réessayez.');
    } finally { setBusy(false); }
  };

  const sendCode = async () => {
    setBusy(true); setError(null);
    try {
      await sendJson('/api/admin/step-up/sms', 'POST', {});
      setCodeSent(true);
    } catch (err) {
      failure(err, 'Le code n’a pas pu être envoyé. Réessayez.');
    } finally { setBusy(false); }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true); setError(null);
    try {
      await sendJson('/api/admin/step-up/sms', 'POST', { code });
      onDone();
    } catch (err) {
      failure(err, 'Code refusé. Réessayez.');
    } finally { setBusy(false); }
  };

  const isPassword = required === 'ADMIN_PASSWORD_REQUIRED';
  const title = isPassword ? 'Confirmez votre mot de passe' : 'Code administrateur';
  const subtitle = isPassword
    ? (reason === 'IDLE'
      ? 'Votre session d’administration est restée sans activité. Votre page est gardée : saisissez votre mot de passe pour continuer.'
      : 'Par sécurité, votre mot de passe est redemandé toutes les 12 heures dans l’administration.')
    : (reason === 'DEVICE_12H'
      ? 'Par sécurité, un nouveau code est demandé toutes les 12 heures.'
      : 'Première ouverture de l’administration sur cet appareil : un code vous est envoyé par SMS.');

  return (
    <Modal
      isOpen
      onClose={() => undefined}
      closeOnOverlayClick={false}
      role="alertdialog"
      title={title}
      subtitle={subtitle}
      icon={isPassword ? <KeyRound size={20} /> : <ShieldCheck size={20} />}
      maxWidth="md"
      busy={busy}
    >
      <div className="space-y-4">
        {error && <StatusBanner tone="danger" announce="alert" title="Vérification impossible"><span id={errorId}>{error}</span></StatusBanner>}
        {isPassword ? (
          <form className="space-y-4" onSubmit={(e) => void submitPassword(e)}>
            <TextInput label="Mot de passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" variant="primary" size="lg" fullWidth isLoading={busy} leftIcon={<KeyRound size={18} />}>Continuer</Button>
          </form>
        ) : !codeSent ? (
          <div className="space-y-4">
            <p className="text-sm text-fg">Le code part par SMS{phone ? ` au ${phone}` : ''}. Ne le donnez à personne.</p>
            <Button type="button" variant="primary" size="lg" fullWidth isLoading={busy} onClick={() => void sendCode()} leftIcon={<MessageSquareText size={18} />}>
              Recevoir le code par SMS
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => void submitCode(e)}>
            <p className="text-sm text-fg">Saisissez les 6 chiffres reçus{phone ? ` au ${phone}` : ''}. Le code est valable 10 minutes.</p>
            <OtpInput value={code} onChange={setCode} disabled={busy} hasError={!!error} describedBy={error ? errorId : undefined} />
            <Button type="submit" variant="primary" size="lg" fullWidth isLoading={busy} disabled={code.length !== 6} leftIcon={<ShieldCheck size={18} />}>
              Valider le code
            </Button>
            <Button type="button" variant="ghost" size="sm" fullWidth onClick={() => void sendCode()} disabled={busy}>Recevoir un nouveau code</Button>
          </form>
        )}
        <Button type="button" variant="ghost" size="sm" fullWidth disabled={busy} leftIcon={<LogOut size={16} />}
          onClick={() => { void signOut().then(() => { window.location.assign('/login'); }); }}>
          Se déconnecter
        </Button>
      </div>
    </Modal>
  );
}
