'use client';

import React, { useEffect, useId, useState } from 'react';
import { Eye, EyeOff, KeyRound, LogIn } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { TextInput } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { PasswordStrengthChecklist, allPasswordCriteriaMet } from '@/components/auth/PasswordStrengthChecklist';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { PASSWORD_HINT } from '@/lib/auth/password-rules';

/**
 * Lot 9 quinquies (A2 : AUTH-02, T2) — page publique du lien d'activation d'un compte créé par un administrateur,
 * `{APP_URL}/activation?t=<jeton>` (servie sans session par le middleware).
 *
 *  - Le jeton est lu une fois dans l'adresse, gardé en mémoire, puis retiré de la barre d'adresse (history.replaceState).
 *  - Aucun référent transmis (<meta name="referrer" content="no-referrer">).
 *  - Rien n'est validé au chargement (un aperçu de lien ne consomme pas le jeton) : seulement sur « Activer mon compte »
 *    (POST /api/auth/activate { token, password }), qui n'ouvre aucune session ; la personne se connecte ensuite.
 *  - Règle commune du mot de passe (liste de contrôle), confirmation, affichage du mot de passe.
 */

type Phase = 'ready' | 'sending' | 'done' | 'refused';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const INVALID_LINK = 'Ce lien d’activation n’est pas valable. Demandez un nouveau lien à l’administrateur qui a créé votre compte.';

export default function ActivationPage() {
  const passwordHelpId = useId();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [message, setMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('t');
    setToken(raw && TOKEN_RE.test(raw) ? raw : null);
    if (url.searchParams.has('t')) {
      url.searchParams.delete('t');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => {
    if (phase === 'done' || phase === 'refused') document.getElementById('activation-suite')?.focus();
  }, [phase]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || phase === 'sending') return;
    setFieldError(null);
    if (!allPasswordCriteriaMet(password)) {
      setFieldError('Le mot de passe ne respecte pas encore la règle ci-dessous.');
      return;
    }
    if (password !== confirm) {
      setFieldError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setPhase('sending');
    setMessage(null);
    try {
      const reply = await sendJson<{ ok: true; message?: string }>('/api/auth/activate', 'POST', { token, password });
      setToken(null);
      setPassword('');
      setConfirm('');
      setMessage(reply.message ?? 'Compte activé. Connectez-vous avec votre numéro et votre mot de passe.');
      setPhase('done');
    } catch (err) {
      console.error('[ActivationPage] activation refusée :', err instanceof ApiError ? `${err.status} ${err.code ?? ''}` : String(err));
      if (err instanceof ApiError && err.status === 400 && err.body?.field === 'password') {
        setFieldError(errorMessage(err, 'Ce mot de passe est refusé. Choisissez-en un autre.'));
        setPhase('ready');
        return;
      }
      const final = err instanceof ApiError && err.status >= 400 && err.status < 500;
      setMessage(errorMessage(err, 'L’activation n’a pas pu aboutir. Réessayez dans un instant.'));
      if (final) setToken(null);
      setPhase(final ? 'refused' : 'ready');
    }
  };

  const missing = token === null && phase === 'ready';

  return (
    <div className="flex justify-center py-4 sm:py-8">
      <meta name="referrer" content="no-referrer" />
      <div className="w-full max-w-lg space-y-5">
        <div className="flex justify-center">
          <Logo variant="full" />
        </div>
        <PageHeader
          title="Activer mon compte"
          description="Votre compte Event Village a été créé par un administrateur. Choisissez votre mot de passe : vous seul le connaîtrez."
          className="pb-0 sm:pb-0"
        />

        <div className="space-y-5 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-8">
          {phase === 'done' && (
            <StatusBanner tone="success" title="Compte activé">{message}</StatusBanner>
          )}
          {(phase === 'refused' || missing) && (
            <StatusBanner tone="danger" announce="alert" title="Activation impossible">
              {missing ? INVALID_LINK : message}
            </StatusBanner>
          )}
          {phase !== 'done' && phase !== 'refused' && !missing && message && (
            <StatusBanner tone="danger" announce="alert" title="Activation interrompue">{message}</StatusBanner>
          )}

          {(phase === 'ready' || phase === 'sending') && !missing && (
            <form className="space-y-4" onSubmit={(e) => void submit(e)} noValidate>
              <div className="flex items-end gap-2">
                <TextInput
                  label="Nouveau mot de passe"
                  type={show ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  hint={PASSWORD_HINT}
                  error={fieldError ?? undefined}
                  aria-describedby={passwordHelpId}
                  fieldClassName="min-w-0 flex-1"
                />
                <IconButton
                  aria-label={show ? 'Masquer les mots de passe' : 'Afficher les mots de passe'}
                  aria-pressed={show}
                  variant="ghost"
                  onClick={() => setShow((v) => !v)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </IconButton>
              </div>
              <PasswordStrengthChecklist password={password} id={passwordHelpId} />
              <TextInput
                label="Confirmer le mot de passe"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button type="submit" variant="primary" size="lg" fullWidth isLoading={phase === 'sending'} disabled={!token} leftIcon={<KeyRound size={18} />}>
                Activer mon compte
              </Button>
            </form>
          )}

          {(phase === 'done' || phase === 'refused' || missing) && (
            <LinkButton id="activation-suite" href="/login" variant={phase === 'done' ? 'primary' : 'secondary'} size="lg" fullWidth leftIcon={<LogIn size={18} />}>
              Aller à la connexion
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  );
}
