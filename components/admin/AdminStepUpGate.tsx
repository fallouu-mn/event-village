'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { KeyRound, LifeBuoy, LogOut, MessageSquareText, ShieldCheck, Smartphone } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { OtpInput } from '@/components/auth/OtpInput';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatRetryDelay, retryAfterOf } from '@/lib/format-delay';
import { INPUT_AGE_HEADER } from '@/lib/admin/input-age';

/**
 * Lot 9 quinquies (A3 : AUTH-05 ; A4 : AUTH-04) — fenêtre de sécurité de l'administration.
 *
 *  - À l'ouverture de /admin : GET /api/admin/step-up ; sur un nouvel appareil, ou après 12 h, la fenêtre demande le code
 *    administrateur reçu par SMS (et le mot de passe d'abord si la session a plus de 12 h). La page est rendue tout de
 *    suite, côté serveur compris, et la fenêtre se pose par-dessus : ses lectures sont refusées par le serveur tant que
 *    l'étape manque, puis la page est rechargée une fois l'étape passée. (Run 171 : rendue seulement après la lecture de
 *    l'état, la page créait ses champs de date hors du document, et Chrome les affichait en mm/dd/yyyy malgré lang="fr".)
 *  - Après 30 minutes sans activité (minuterie locale, et tout refus 403 ADMIN_PASSWORD_REQUIRED ou ADMIN_SMS_REQUIRED
 *    renvoyé par une route), la fenêtre redemande le mot de passe PAR-DESSUS la page : rien n'est perdu, l'action
 *    interrompue se relance une fois la fenêtre fermée.
 *  - Le serveur décide toujours (lib/admin/step-up.ts) : la fenêtre ne fait qu'aider.
 * Saisie du code : 6 cases, collage, clavier numérique, « one-time-code » (OtpInput) ; mot de passe : « current-password ».
 *
 * Finition 3d (point 1) :
 *  - chaque appel /api/ de la page porte l'âge de la dernière saisie (en-tête x-ev-input-age, lib/admin/input-age.ts) :
 *    une relecture automatique faite sans saisie depuis plus d'une minute ne compte plus comme une activité côté serveur,
 *    une page laissée ouverte ne garde donc plus la session éveillée ;
 *  - la fenêtre sert aussi sur les pages partenaire et contrôleur d'un compte admin, où le serveur applique désormais la
 *    même règle des 30 minutes : AdminStepUpOverlay (sans enfants), chargé à la demande par AdminAccountStepUp pour un
 *    compte admin seulement, posé à côté de la page (rien n'est remonté, rien n'est ajouté au code d'un contrôleur).
 *
 * Finition 3d (point 2) :
 *  - « J'ai perdu mon téléphone » dans la fenêtre du code administrateur : mot de passe et code de secours remplacent le
 *    SMS (POST /api/admin/step-up/recovery, SUPERADMIN seulement ; un ADMIN est invité à s'adresser au Superadmin), puis
 *    la page « Sécurité du compte » mène au changement de son numéro (/admin/securite?numero=1) ;
 *  - après le code reçu par SMS, un SUPERADMIN qui n'a aucun code de secours se les voit proposer (« Plus tard » possible).
 */

type Required = 'ADMIN_PASSWORD_REQUIRED' | 'ADMIN_SMS_REQUIRED' | null;
interface Status { required: Required; reason: string | null; idleMinutes: number; phone: string | null }

const STEP_UP_CODES = new Set(['ADMIN_PASSWORD_REQUIRED', 'ADMIN_SMS_REQUIRED']);
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/** Appel /api/ de la même origine : copie de l'appel avec l'âge de la dernière saisie, en secondes. Autre appel : inchangé. */
function withInputAge(input: RequestInfo | URL, init: RequestInit | undefined, ageSecs: number): [RequestInfo | URL, RequestInit | undefined] {
  let url: URL;
  try {
    url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href);
  } catch {
    return [input, init];
  }
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return [input, init];
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set(INPUT_AGE_HEADER, String(Math.max(0, ageSecs)));
  return [input, { ...init, headers }];
}

export function AdminStepUpGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastInput = useRef<number>(Date.now());
  // Page ouverte alors qu'une étape manquait : ses premières lectures ont été refusées, elle est rechargée après l'étape
  const lockedAtLoad = useRef<boolean | null>(null);
  const { hasRole } = useAuth();
  // Finition 3d (point 2b) : proposition des codes de secours après la double vérification d'un SUPERADMIN qui n'en a pas
  const [offerCodes, setOfferCodes] = useState(false);

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
      if (lockedAtLoad.current === null) lockedAtLoad.current = body.required !== null;
      return body;
    } catch (err) {
      console.error('[AdminStepUpGate] état de la session illisible :', err instanceof Error ? err.message : String(err));
      setLoadError('Connexion impossible. Vérifiez votre réseau puis rechargez la page.');
      return null;
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // Tout refus d'étape de sécurité renvoyé par une route ouvre la fenêtre (la page reste affichée dessous).
  // Finition 3d (point 1) : chaque appel /api/ porte l'âge de la dernière saisie.
  useEffect(() => {
    const original = window.fetch;
    const patched: typeof window.fetch = async (input, init) => {
      const [i, n] = withInputAge(input, init, Math.floor((Date.now() - lastInput.current) / 1000));
      const res = await original(i, n);
      if (res.status === 403) {
        res.clone().json().then((b: { code?: string } | null) => {
          if (b?.code && STEP_UP_CODES.has(b.code)) void refresh();
        }).catch((err: unknown) => {
          // Corps non JSON : ce refus n'est pas une étape de sécurité, rien à ouvrir
          console.debug('[AdminStepUpGate] refus 403 sans corps JSON :', err instanceof Error ? err.message : String(err));
        });
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
      if (status && !status.required && Date.now() - lastInput.current > idle) {
        setStatus((s) => (s ? { ...s, required: 'ADMIN_PASSWORD_REQUIRED', reason: 'IDLE' } : s));
      }
    }, 30_000);
    return () => {
      for (const e of ACTIVITY_EVENTS) window.removeEventListener(e, touch);
      window.clearInterval(timer);
    };
  }, [status]);

  const done = async () => {
    lastInput.current = Date.now();
    const wasSms = status?.required === 'ADMIN_SMS_REQUIRED';
    const next = await refresh();
    if (!next || next.required) return;
    if (wasSms && hasRole('SUPERADMIN') && (await hasNoBackupCodes())) {
      setOfferCodes(true);
      return;
    }
    if (lockedAtLoad.current) window.location.reload();
  };

  const later = () => {
    setOfferCodes(false);
    if (lockedAtLoad.current) window.location.reload();
  };

  return (
    <>
      {loadError && (
        <div className="mx-auto max-w-lg px-4 pt-6">
          <StatusBanner tone="danger" announce="alert" title="Administration indisponible">{loadError}</StatusBanner>
        </div>
      )}
      {children}
      {status?.required && (
        <StepUpDialog required={status.required} reason={status.reason} phone={status.phone} onDone={() => void done()} />
      )}
      {offerCodes && !status?.required && <BackupCodesOffer onLater={later} />}
    </>
  );
}

/**
 * Finition 3d (point 1) — la même fenêtre sans enfants, posée à côté d'une page partenaire ou contrôleur d'un compte admin
 * (chargée à la demande par AdminAccountStepUp) : état de la session, âge de la dernière saisie sur chaque appel /api/,
 * minuterie d'inactivité et saisie du mot de passe ou du code, sans remonter la page.
 */
export function AdminStepUpOverlay() {
  return <AdminStepUpGate>{null}</AdminStepUpGate>;
}

/** Le SUPERADMIN n'a aucun code de secours valable (lecture refusée ou illisible : rien n'est proposé). */
async function hasNoBackupCodes(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/security/backup-codes', { cache: 'no-store' });
    if (!res.ok) return false;
    const body = (await res.json().catch(() => null)) as { remaining?: number } | null;
    return Number(body?.remaining ?? -1) === 0;
  } catch {
    return false;
  }
}

/** Finition 3d (point 2b) — proposition des codes de secours, juste après la double vérification. */
function BackupCodesOffer({ onLater }: { onLater: () => void }) {
  return (
    <Modal
      isOpen
      onClose={onLater}
      title="Créez vos codes de secours"
      subtitle="Si vous perdez votre téléphone, un code de secours remplace le code reçu par SMS. Sans eux, vous ne pourrez plus ouvrir l’administration."
      icon={<LifeBuoy size={20} />}
      maxWidth="md"
    >
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" fullWidth leftIcon={<KeyRound size={18} />} onClick={() => window.location.assign('/admin/securite?creer=1')}>
          Créer mes codes maintenant
        </Button>
        <Button variant="ghost" size="sm" fullWidth onClick={onLater}>Plus tard</Button>
      </div>
    </Modal>
  );
}

/**
 * Finition 3d (point 2c) — « J'ai perdu mon téléphone » : mot de passe et un code de secours. Réussi : la page « Sécurité du
 * compte » s'ouvre pour changer le numéro. Un ADMIN n'a pas de codes : on lui dit de s'adresser au Superadmin.
 */
function RecoveryForm({ onBack }: { onBack: () => void }) {
  const errorId = useId();
  const { hasRole } = useAuth();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!hasRole('SUPERADMIN')) {
    return (
      <div className="space-y-4">
        <StatusBanner tone="info" icon={<Smartphone size={20} aria-hidden="true" />} title="Téléphone perdu">
          Demandez au Superadmin de changer votre numéro de téléphone. Il vous fera saisir un code reçu sur votre nouveau numéro.
        </StatusBanner>
        <Button type="button" variant="secondary" size="sm" fullWidth onClick={onBack}>Retour au code par SMS</Button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !code.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const reply = await sendJson<{ ok?: boolean }>('/api/admin/step-up/recovery', 'POST', { password, code: code.trim() });
      if (reply.ok === true) {
        window.location.assign('/admin/securite?numero=1');
        return;
      }
      setError('Le serveur n’a pas confirmé le code de secours. Réessayez.');
    } catch (err) {
      const wait = err instanceof ApiError && err.status === 429 ? retryAfterOf(err.body) : null;
      const text = errorMessage(err, 'Mot de passe ou code de secours incorrect.');
      setError(wait ? `${text} ${formatRetryDelay(wait)}` : text);
    } finally { setBusy(false); }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => void submit(e)}>
      {error && <StatusBanner tone="danger" announce="alert" title="Accès refusé"><span id={errorId}>{error}</span></StatusBanner>}
      <p className="text-sm text-fg">Saisissez votre mot de passe et l’un de vos codes de secours. Le code ne servira qu’une fois ; un SMS d’alerte part à votre ancien numéro.</p>
      <TextInput label="Mot de passe" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      <TextInput label="Code de secours" autoComplete="off" autoCapitalize="characters" spellCheck={false} required value={code}
        onChange={(e) => setCode(e.target.value)} className="tracking-wider" />
      <Button type="submit" variant="primary" size="lg" fullWidth isLoading={busy} disabled={!password || !code.trim()} leftIcon={<LifeBuoy size={18} />}>
        Utiliser le code de secours
      </Button>
      <Button type="button" variant="ghost" size="sm" fullWidth onClick={onBack} disabled={busy}>Retour au code par SMS</Button>
    </form>
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
  const [recovery, setRecovery] = useState(false);

  useEffect(() => { setError(null); setCode(''); setPassword(''); setRecovery(false); }, [required]);

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
  const title = isPassword ? 'Confirmez votre mot de passe' : recovery ? 'J’ai perdu mon téléphone' : 'Code administrateur';
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
        {error && !recovery && <StatusBanner tone="danger" announce="alert" title="Vérification impossible"><span id={errorId}>{error}</span></StatusBanner>}
        {!isPassword && recovery ? (
          <RecoveryForm onBack={() => setRecovery(false)} />
        ) : isPassword ? (
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
        {!isPassword && !recovery && (
          <Button type="button" variant="ghost" size="sm" fullWidth disabled={busy} leftIcon={<Smartphone size={16} />} onClick={() => { setError(null); setRecovery(true); }}>
            J’ai perdu mon téléphone
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" fullWidth disabled={busy} leftIcon={<LogOut size={16} />}
          onClick={() => void signOut()}>
          Se déconnecter
        </Button>
      </div>
    </Modal>
  );
}
