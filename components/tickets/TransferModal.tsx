'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Clock, HelpCircle, Lock, MessageCircle, Send, Share2, ShieldCheck } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { deleteOfflineLots } from '@/lib/tickets/offline-store';
import { siteUrl, transferMessage, transferWhatsappUrl } from '@/components/tickets/transfer-whatsapp';

/** Boîte « mot de passe » chargée à la demande (lot 9 bis, R57 ; contrat 5.13 : hors du premier chargement). */
const PasswordConfirmDialog = dynamic(
  () => import('@/components/auth/PasswordConfirmDialog').then((m) => m.PasswordConfirmDialog),
  { ssr: false },
);

/**
 * Transfert d'un billet (lot 6, contrat B5 et amendement 2 : vers un numéro de téléphone seulement).
 *
 *  - Un seul champ, « Numéro de téléphone du destinataire » : l'adresse email n'est jamais vérifiée, elle
 *    ne désigne donc plus un destinataire (le serveur refuse une cible email, 400 RECIPIENT_PHONE_REQUIRED).
 *  - Aucun lien de réclamation : le destinataire reçoit un SMS qui l'envoie vers « Mes billets » ; il se
 *    connecte avec ce numéro (vérifié par un code) et accepte le billet dans l'onglet « Reçus ».
 *  - Le numéro est normalisé et validé par le serveur ; le navigateur ne fait qu'un contrôle de forme.
 *  - Modale partagée (components/ui/Modal : focus, Échap, Fermer de 44 px), tokens du système de design.
 *  - Lot 7 (7.1) : au succès, le lot de codes hors ligne du billet est supprimé du téléphone (la version du
 *    secret tournera à l'acceptation ; d'ici là, le billet verrouillé n'a plus de code d'entrée).
 *  - Lot 9 bis (R57, contrat 4.2 et 5.13) : la route refuse en 403 PASSWORD_CONFIRMATION_REQUIRED quand le mot de passe
 *    n'a pas été saisi sur la session depuis moins de 10 minutes. Ce refus ouvre PasswordConfirmDialog ; une fois le mot
 *    de passe accepté (clic « Confirmer »), le même transfert, vers le même numéro, repart une fois.
 *  - Design 1b (point 8) : après l'envoi, « Prévenir par WhatsApp » ouvre la conversation avec le numéro du destinataire
 *    retenu par le serveur (wa.me, chiffres E.164 sans « + »), message avec l'adresse du site (configuration
 *    NEXT_PUBLIC_APP_URL), l'adresse où accepter le billet et la vraie échéance du transfert (expires_at du serveur) ;
 *    numéro inconnu : repli « Prévenir mon proche » (partage du téléphone ou copie du message).
 */

export interface TransferTicketData {
  id: string;
  ticketNumber: string;
  eventTitle: string;
  dateFormatted?: string;
  timeFormatted?: string;
  seat?: string;
  venue?: string;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: TransferTicketData | null;
  onTransferSuccess: (ticketId: string) => void;
  onOpenExplainer?: () => void;
  /** Lot 11c-b : numéro prérempli (carnet du téléphone, place d'une table). */
  initialRecipient?: string;
  /**
   * Lot 11c-b : place d'une table : champ « Prénom de l'invité » (facultatif), gardé sur ce téléphone seulement par
   * l'écran appelant après un envoi réussi (le serveur ne reçoit que le numéro).
   */
  guestName?: { initial?: string; onSent: (name: string) => void };
}

interface TransferSuccess {
  ticketNumber: string;
  recipient: string;
  expiresAt: string;
}

const HELP_TEXT = 'Le destinataire recevra un SMS. Il devra se connecter avec ce numéro pour accepter le billet sous 48 h.';
const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';
/** Code du refus « mot de passe récent exigé » (lib/auth/password-confirm.ts). */
const PASSWORD_CONFIRMATION_REQUIRED = 'PASSWORD_CONFIRMATION_REQUIRED';

/** Contrôle de forme seulement (8 à 15 chiffres, indicatif facultatif) ; la validation fait foi côté serveur. */
function looksLikePhone(value: string): boolean {
  return /^\+?\d{8,15}$/.test(value.replace(/[\s\-().]/g, ''));
}

export const TransferModal: React.FC<TransferModalProps> = ({ isOpen, onClose, ticket, onTransferSuccess, onOpenExplainer, initialRecipient, guestName }) => {
  const { session } = useAuth();
  const toast = useToast();
  const [recipient, setRecipient] = useState(initialRecipient ?? '');
  const [guest, setGuest] = useState(guestName?.initial ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<TransferSuccess | null>(null);
  /** Numéro du transfert refusé faute de mot de passe récent : la boîte « mot de passe » est ouverte. */
  const [pendingRecipient, setPendingRecipient] = useState<string | null>(null);

  if (!ticket) return null;

  const reset = () => {
    setRecipient('');
    setFieldError(null);
    setServerError(null);
    setSuccess(null);
    setPendingRecipient(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const shareMessage = (): string => transferMessage({ eventTitle: ticket.eventTitle, expiresAt: success?.expiresAt, site: siteUrl() });
  const whatsappUrl = success
    ? transferWhatsappUrl({ phone: success.recipient, eventTitle: ticket.eventTitle, expiresAt: success.expiresAt, site: siteUrl() })
    : null;

  const handleShare = async () => {
    const text = shareMessage();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Billet ${ticket.eventTitle}`, text });
        return;
      } catch (err) {
        // Partage fermé par l'utilisateur : rien à signaler ; toute autre erreur passe à la copie.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn('[TransferModal] partage natif impossible, copie du message :', err instanceof Error ? err.message : String(err));
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Message copié : collez-le dans la conversation de votre choix.');
    } catch (err) {
      console.error('[TransferModal] copie du message impossible :', err instanceof Error ? err.message : String(err));
      toast.error('Le message n’a pas pu être copié. Prévenez votre proche directement.');
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const value = recipient.trim();
    if (!value) {
      setFieldError('Saisissez le numéro de téléphone du destinataire.');
      return;
    }
    if (!looksLikePhone(value)) {
      setFieldError('Numéro invalide : saisissez un numéro de téléphone (par exemple 77 123 45 67).');
      return;
    }
    setFieldError(null);
    await send(value);
  };

  /** Envoi du transfert ; relancé tel quel après la confirmation du mot de passe. */
  const send = async (value: string) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ recipient: value }),
      });
      let data: { success?: boolean; error?: unknown; code?: unknown; transfer?: { ticket_number?: unknown; recipient?: unknown; expires_at?: unknown } } = {};
      try {
        data = await res.json();
      } catch (err) {
        console.error(`[TransferModal] réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
        setServerError(`Réponse inattendue du serveur (erreur ${res.status}).`);
        return;
      }
      if (res.status === 403 && data.code === PASSWORD_CONFIRMATION_REQUIRED) {
        setPendingRecipient(value);
        return;
      }
      if (!res.ok || data.success !== true || !data.transfer) {
        setServerError(typeof data.error === 'string' && data.error ? data.error : 'Le transfert n’a pas pu être lancé. Réessayez.');
        return;
      }
      const result: TransferSuccess = {
        ticketNumber: typeof data.transfer.ticket_number === 'string' ? data.transfer.ticket_number : ticket.ticketNumber,
        recipient: typeof data.transfer.recipient === 'string' ? data.transfer.recipient : value,
        expiresAt: typeof data.transfer.expires_at === 'string' ? data.transfer.expires_at : '',
      };
      setSuccess(result);
      guestName?.onSent(guest);
      toast.success(`Transfert lancé vers ${result.recipient}.`);
      // Lot 7 (7.1, contrat 5.2) : le billet n'est plus présentable par ce téléphone, son lot hors ligne est supprimé.
      deleteOfflineLots(ticket.id).catch((err: unknown) => {
        console.warn('[TransferModal] lot hors ligne du billet non supprimé :', err instanceof Error ? err.message : String(err));
      });
      onTransferSuccess(ticket.id);
    } catch (err) {
      console.error('[TransferModal] transfert injoignable :', err instanceof Error ? err.message : String(err));
      setServerError(NETWORK_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = success ? (
    <div className="flex w-full flex-wrap justify-end gap-2">
      {whatsappUrl ? (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'secondary' })}>
          <MessageCircle size={18} aria-hidden="true" className="text-success-text" />
          Prévenir par WhatsApp
        </a>
      ) : (
        <Button variant="secondary" onClick={() => void handleShare()} leftIcon={<Share2 size={18} aria-hidden="true" />}>
          Prévenir mon proche
        </Button>
      )}
      <Button variant="primary" onClick={handleClose}>
        Terminer
      </Button>
    </div>
  ) : (
    <div className="flex w-full flex-wrap justify-end gap-2">
      <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
        Annuler
      </Button>
      <Button
        variant="primary"
        type="submit"
        form="transfert-billet"
        isLoading={isSubmitting}
        leftIcon={<Send size={18} aria-hidden="true" />}
      >
        Envoyer le billet
      </Button>
    </div>
  );

  return (
    <>
    {pendingRecipient !== null && (
      <PasswordConfirmDialog
        isOpen
        onClose={() => {
          setPendingRecipient(null);
          setServerError('Transfert interrompu : votre mot de passe est demandé pour continuer.');
        }}
        onConfirmed={() => {
          const value = pendingRecipient;
          setPendingRecipient(null);
          void send(value);
        }}
        actionHint="Le billet sera envoyé juste après."
      />
    )}
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Transférer ce billet"
      subtitle={`Billet ${ticket.ticketNumber}${ticket.seat ? ` · ${ticket.seat}` : ''}`}
      icon={<Send size={20} aria-hidden="true" />}
      footer={footer}
      busy={isSubmitting}
      maxWidth="lg"
    >
      {success ? (
        <div className="space-y-4">
          <StatusBanner tone="success" title="Transfert lancé">
            Le billet est réservé pour le numéro {success.recipient}, qui va recevoir un SMS.
          </StatusBanner>
          <dl className="space-y-3 rounded-2xl border border-border bg-background p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Événement</dt>
              <dd className="min-w-0 break-words font-semibold text-foreground-strong">{ticket.eventTitle}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Clock size={16} aria-hidden="true" />
                À accepter avant
              </dt>
              <dd className="font-semibold text-foreground-strong tabular-nums">{success.expiresAt ? formatDateTime(success.expiresAt) : '48 h après l’envoi'}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Lock size={16} aria-hidden="true" />
                Votre billet
              </dt>
              <dd className="font-semibold text-foreground-strong">Verrouillé jusqu’à l’acceptation</dd>
            </div>
          </dl>
          <p className="text-sm leading-relaxed text-muted-foreground">
            S’il n’est pas accepté sous 48 h, le billet vous revient automatiquement. Vous pouvez annuler le transfert depuis la carte du billet tant qu’il n’est pas accepté.
          </p>
        </div>
      ) : (
        <form id="transfert-billet" noValidate onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div className="rounded-2xl border border-border bg-background p-4 text-sm">
            <p className="font-semibold text-foreground-strong">{ticket.eventTitle}</p>
            {(ticket.dateFormatted || ticket.timeFormatted) && (
              <p className="mt-1 text-muted-foreground">
                {[ticket.dateFormatted, ticket.timeFormatted ? `à ${ticket.timeFormatted}` : null].filter(Boolean).join(' ')}
              </p>
            )}
            {ticket.venue && <p className="mt-1 text-muted-foreground">{ticket.venue}</p>}
            <p className="mt-2 font-semibold text-success-text">Transfert gratuit</p>
          </div>

          {guestName && (
            <TextInput
              label="Prénom de l’invité (facultatif)"
              autoComplete="off"
              maxLength={40}
              value={guest}
              onChange={(e) => setGuest(e.target.value)}
              disabled={isSubmitting}
              hint="Gardé sur ce téléphone seulement, pour reconnaître la place en attente."
            />
          )}

          <TextInput
            label="Numéro de téléphone du destinataire"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              if (fieldError) setFieldError(null);
            }}
            placeholder="77 123 45 67"
            disabled={isSubmitting}
            hint={HELP_TEXT}
            error={fieldError ?? undefined}
          />

          {serverError && (
            <StatusBanner tone="danger" announce="alert" title="Transfert impossible">
              {serverError}
            </StatusBanner>
          )}

          <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm text-foreground-strong">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={18} className="text-primary-text" aria-hidden="true" />
              Ce qui se passe ensuite
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Dès l’acceptation, un nouveau QR code est créé pour votre proche ; le vôtre ne sert plus.</li>
              <li>Sans acceptation sous 48 h, le billet vous revient automatiquement.</li>
              <li>Vous pouvez annuler le transfert tant qu’il n’est pas accepté.</li>
            </ul>
          </div>

          {onOpenExplainer && (
            <Button type="button" variant="ghost" onClick={onOpenExplainer} leftIcon={<HelpCircle size={18} aria-hidden="true" />}>
              Comment fonctionne le transfert ?
            </Button>
          )}
        </form>
      )}
    </Modal>
    </>
  );
};
