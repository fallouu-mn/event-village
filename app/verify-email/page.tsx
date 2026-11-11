'use client';

import React, { useEffect, useState } from 'react';
import { MailCheck, UserRound } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';

/**
 * Lot 9 bis, tâche 48 (R87 ; contrat 4.6, 5.48 ; discovery-9bis-email 2.3 et 5) — page publique du lien de
 * vérification d'adresse, `{APP_URL}/verify-email?t=<jeton>` (servie sans session par le middleware).
 *
 *  - Le jeton est lu une fois dans l'adresse, gardé en mémoire seulement, puis retiré de la barre d'adresse
 *    (history.replaceState) : il ne reste ni dans l'historique ni dans une capture d'écran.
 *  - Aucun référent n'est transmis (<meta name="referrer" content="no-referrer">, en plus de l'en-tête global).
 *  - RIEN n'est validé au chargement : les antivirus de messagerie ouvrent les liens et videraient le jeton. La
 *    validation part seulement sur « Confirmer mon adresse » (POST /api/account/email/verify { token }), qui n'ouvre
 *    aucune session.
 *  - Issues dites en clair (textes de discovery-9bis-email 5) ; un lien refusé (non valable, expiré, déjà servi,
 *    adresse prise) ne propose plus le bouton, seulement d'aller au profil pour demander un nouveau lien ; une panne
 *    garde le bouton pour réessayer.
 *
 * La page reste un composant client : la consigne des fichiers du lot (tests/helpers/design-files.ts, une seule page
 * déclarée) ne permet pas de séparer une page serveur et son bouton ; la balise referrer est donc rendue ici.
 */

type Phase = 'ready' | 'sending' | 'verified' | 'refused' | 'failed';

/** Issues définitives : le lien ne servira plus, un nouveau lien se demande depuis le profil. */
const REFUSALS: Readonly<Record<string, string>> = {
  EMAIL_LINK_INVALID: 'Ce lien n’est pas valable. Demandez un nouveau lien depuis votre profil.',
  EMAIL_LINK_EXPIRED: 'Ce lien a expiré (24 heures). Demandez un nouveau lien depuis votre profil.',
  EMAIL_LINK_USED: 'Ce lien a déjà servi.',
  EMAIL_TAKEN: 'Cette adresse est déjà vérifiée sur un autre compte Event Village.',
};

const SUCCESS_TEXT = 'Adresse vérifiée. Vous recevrez désormais vos billets et vos confirmations par email.';

/** Forme d'un jeton émis par le serveur (même règle que isVerificationToken) ; sinon le lien est d'emblée non valable. */
const TOKEN_RE = /^[A-Za-z0-9_-]{43,256}$/;

export default function VerifyEmailPage() {
  /** undefined : adresse pas encore lue ; null : aucun jeton exploitable dans le lien. */
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>('ready');
  const [message, setMessage] = useState<string | null>(null);

  // Lecture du jeton puis retrait de l'adresse, sans aucun appel au serveur.
  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('t');
    setToken(raw && TOKEN_RE.test(raw) ? raw : null);
    if (url.searchParams.has('t')) {
      url.searchParams.delete('t');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  // Issue définitive : le bouton disparaît, le focus va sur « Ouvrir mon profil », juste après l'issue (annoncée par
  // son bandeau). Une panne garde le bouton et son focus pour réessayer.
  useEffect(() => {
    if (phase === 'verified' || phase === 'refused') document.getElementById('verification-profil')?.focus();
  }, [phase]);

  const confirm = async () => {
    if (!token || phase === 'sending') return;
    setPhase('sending');
    setMessage(null);
    try {
      await sendJson<{ ok: true }>('/api/account/email/verify', 'POST', { token });
      setToken(null);
      setPhase('verified');
    } catch (err) {
      console.error('[VerifyEmailPage] validation refusée :', err instanceof ApiError ? `${err.status} ${err.code ?? ''}` : String(err));
      const known = err instanceof ApiError && err.code ? REFUSALS[err.code] : undefined;
      // 4xx de la route : le lien ne servira plus (EMAIL_CONFLICT compris) ; 5xx et réseau : on peut réessayer.
      const final = known !== undefined || (err instanceof ApiError && err.status >= 400 && err.status < 500);
      setMessage(known ?? errorMessage(err, 'La vérification n’a pas pu aboutir. Réessayez dans un instant.'));
      if (final) setToken(null);
      setPhase(final ? 'refused' : 'failed');
    }
  };

  const missing = token === null && phase === 'ready';
  const canConfirm = phase === 'ready' || phase === 'sending' || phase === 'failed';

  return (
    <div className="flex justify-center py-4 sm:py-8">
      <meta name="referrer" content="no-referrer" />
      <div className="w-full max-w-lg space-y-5">
        <div className="flex justify-center">
          <Logo variant="full" />
        </div>
        <PageHeader
          title="Vérifier mon adresse email"
          description="Confirmez l’adresse indiquée pour votre compte Event Village. Rien n’est validé tant que vous n’avez pas appuyé sur le bouton."
          className="pb-0 sm:pb-0"
        />

        <div className="space-y-5 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-8">
          <div className="space-y-4">
            {phase === 'verified' && (
              <StatusBanner tone="success" title="Adresse vérifiée">
                {SUCCESS_TEXT}
              </StatusBanner>
            )}
            {(phase === 'refused' || missing) && (
              <StatusBanner tone="danger" announce="alert" title="Vérification impossible">
                {missing ? REFUSALS.EMAIL_LINK_INVALID : message}
              </StatusBanner>
            )}
            {phase === 'failed' && message && (
              <StatusBanner tone="danger" announce="alert" title="Vérification interrompue">
                {message}
              </StatusBanner>
            )}
          </div>

          {canConfirm && !missing && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => void confirm()}
              isLoading={phase === 'sending'}
              disabled={!token}
              leftIcon={<MailCheck size={18} />}
            >
              Confirmer mon adresse
            </Button>
          )}

          {(phase === 'verified' || phase === 'refused' || missing) && (
            <LinkButton id="verification-profil" href="/profile" variant={phase === 'verified' ? 'primary' : 'secondary'} size="lg" fullWidth leftIcon={<UserRound size={18} />}>
              Ouvrir mon profil
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  );
}
