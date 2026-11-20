'use client';

/**
 * Lot 7 (7.3, D4, contrat 3.5) — bandeau « paiement déjà en attente » de la page d'un événement.
 *
 * Lit GET /api/checkout/pending?eventId=<id> : paiement de billets PENDING du compte de la session pour cet événement.
 * C'est EXACTEMENT la garde du serveur (checkout_create_payment, migration 20261111000005 : même compte, même événement,
 * cible TICKET, statut PENDING), qui refuse un second paiement (409 PAYMENT_PENDING) tant que le premier n'est ni
 * confirmé, ni annulé, ni échoué, ni expiré, même après l'échéance de la réservation des places.
 *
 * Design 1b (point 7) : le bandeau RESTE tant que le serveur bloque un nouvel achat (plus de disparition à l'échéance de
 * la réservation : le serveur bloque encore) ; il est relu toutes les 15 s quand la page est visible, au retour sur la
 * page et à la demande de la billetterie, et disparaît dès que le serveur ne bloque plus. Deux actions : « Suivre le
 * paiement » (/paiement/<id>) et « Annuler ce paiement » (confirmation, POST /api/payments/<id>/cancel ; le serveur
 * vérifie d'abord auprès de l'opérateur : 409 « vient d'être confirmé » ou « n'est plus en attente », 503 « vérification
 * impossible », dits en mots simples).
 * Un échec de lecture est journalisé et n'affiche rien : la garde du serveur reste seule juge, et la fenêtre de paiement
 * affiche le refus 409 avec le même lien.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { PaymentCountdown } from '@/components/event-page/Countdowns';
import { LinkButton } from '@/components/ui/LinkButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatFcfa, formatTime } from '@/lib/format';
import {
  isRecord,
  isSamirPayOperator,
  nonEmptyString,
  operatorLabel,
  paymentStatusPath,
  readAmount,
  readJsonBody,
  serverErrorCode,
  serverErrorMessage,
} from '@/lib/payments/payment-client';

export interface PendingTicketPaymentView {
  paymentId: string;
  amount: number | null;
  operatorName: string | null;
  expiresAt: string | null;
  statusPath: string;
}

export interface PendingPaymentBannerProps {
  eventId: string;
  /** Lecture faite seulement pour un visiteur connecté (la route exige une session). */
  enabled: boolean;
  /** Change de valeur pour relire le paiement en attente. */
  refreshKey?: number;
  /** Paiement en attente lu (ou null), pour la page qui veut adapter son bouton d'achat. */
  onChange?: (pending: PendingTicketPaymentView | null) => void;
  /** Paiement confirmé au moment de l'annulation : destination des billets (par défaut, Mes billets). */
  ticketsHref?: string;
  className?: string;
}

/** Relecture pendant qu'un paiement est en attente, page visible (le serveur peut le clore à tout moment). */
const POLL_MS = 15_000;

function readPending(body: unknown): PendingTicketPaymentView | null {
  if (!isRecord(body) || !isRecord(body.pending)) return null;
  const p = body.pending;
  const paymentId = nonEmptyString(p.payment_id);
  if (!paymentId) return null;
  const statusPath = paymentStatusPath(p.status_page_url, paymentId);
  if (!statusPath) return null;
  return {
    paymentId,
    amount: readAmount(p.amount),
    operatorName: isSamirPayOperator(p.operator) ? operatorLabel(p.operator) : null,
    expiresAt: nonEmptyString(p.expires_at),
    statusPath,
  };
}

export function PendingPaymentBanner({ eventId, enabled, refreshKey = 0, onChange, ticketsHref = '/tickets', className }: PendingPaymentBannerProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState<PendingTicketPaymentView | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const cancellingRef = useRef(false);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  useEffect(() => {
    if (!enabled || !eventId) {
      setPending(null);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/checkout/pending?eventId=${encodeURIComponent(eventId)}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        const body = await readJsonBody(res, 'événement/paiement en attente');
        if (controller.signal.aborted) return;
        if (!res.ok) {
          console.error(`[PendingPaymentBanner] lecture du paiement en attente refusée (HTTP ${res.status}) :`, body);
          setPending(null);
          return;
        }
        setPending(readPending(body));
        setNow(Date.now());
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[PendingPaymentBanner] lecture du paiement en attente impossible :', err instanceof Error ? err.message : String(err));
        setPending(null);
      }
    })();
    return () => controller.abort();
  }, [enabled, eventId, refreshKey, reloadKey]);

  // Tant qu'un paiement est en attente : relecture régulière (page visible) et au retour sur la page. Le bandeau ne
  // disparaît que quand le serveur ne bloque plus.
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !cancellingRef.current) reload();
    }, POLL_MS);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pending, reload]);

  // Échéance de la réservation des places : le texte change (le paiement bloque encore), le bandeau reste.
  useEffect(() => {
    if (!pending?.expiresAt) return undefined;
    const remaining = Date.parse(pending.expiresAt) - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining + 250, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    onChange?.(pending);
  }, [pending, onChange]);

  const handleCancel = async (): Promise<void> => {
    if (!pending || cancellingRef.current) return;
    cancellingRef.current = true;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(pending.paymentId)}/cancel`, { method: 'POST', credentials: 'same-origin' });
      const body = await readJsonBody(res, 'événement/annulation du paiement en attente');
      const code = serverErrorCode(body);
      if (res.ok) {
        const status = isRecord(body) ? nonEmptyString(body.status) : null;
        if (status && status !== 'CANCELLED') toast.info('Ce paiement n’était plus en attente : vous pouvez acheter à nouveau.');
        else toast.success('Paiement annulé : vos places sont libérées. Vous pouvez acheter à nouveau.');
      } else if (res.status === 409 && code === 'PAYMENT_ALREADY_CONFIRMED') {
        // Validé chez l'opérateur juste avant l'annulation : les billets sont émis, rien n'est annulé.
        toast.success('Votre paiement vient d’être confirmé : vos billets sont dans Mes billets.');
        router.push(ticketsHref);
      } else if (res.status === 409) {
        toast.info(serverErrorMessage(body) ?? 'Ce paiement n’est plus en attente.');
      } else if (res.status === 503) {
        // Vérification chez l'opérateur impossible : rien n'est annulé à l'aveugle (D4).
        toast.error('Nous n’avons pas pu vérifier ce paiement auprès de l’opérateur. Rien n’a été annulé : réessayez dans un instant.', {
          onRetry: () => setConfirmCancel(true),
        });
      } else if (res.status === 401) {
        toast.error('Votre session a expiré : reconnectez-vous pour annuler ce paiement.');
      } else {
        console.error(`[PendingPaymentBanner] annulation refusée (HTTP ${res.status}) :`, body);
        toast.error('Annulation impossible pour le moment. Réessayez dans un instant.', { onRetry: () => setConfirmCancel(true) });
      }
    } catch (err) {
      console.error('[PendingPaymentBanner] annulation impossible :', err instanceof Error ? err.message : String(err));
      toast.error('Connexion impossible : l’annulation n’a pas été envoyée. Réessayez.', { onRetry: () => setConfirmCancel(true) });
    } finally {
      cancellingRef.current = false;
      setIsCancelling(false);
      setConfirmCancel(false);
      reload();
    }
  };

  if (!pending) return null;

  const amount = pending.amount !== null ? formatFcfa(pending.amount) : null;
  const via = pending.operatorName ? ` par ${pending.operatorName}` : '';
  const expiresMs = pending.expiresAt ? Date.parse(pending.expiresAt) : Number.NaN;
  const holdOver = Number.isFinite(expiresMs) && expiresMs <= now;

  return (
    <>
      <StatusBanner
        tone="warning"
        title="Un paiement est déjà en attente pour cet événement"
        icon={<Clock size={20} />}
        className={className}
        action={(
          <div className="flex flex-wrap gap-2">
            <LinkButton href={pending.statusPath} variant="secondary" size="sm">
              Suivre le paiement
            </LinkButton>
            <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(true)} disabled={isCancelling}>
              Annuler ce paiement
            </Button>
          </div>
        )}
      >
        <p>
          {amount ? `Paiement de ${amount}${via}` : `Paiement${via}`}
          {holdOver ? (
            <>. La réservation de vos places est terminée. Si vous n’avez pas validé sur votre téléphone, annulez ce paiement pour en lancer un autre.</>
          ) : (
            <>
              {pending.expiresAt ? (
                <>
                  {' '}à valider avant <time dateTime={pending.expiresAt} className="tabular-nums">{formatTime(pending.expiresAt)}</time>.
                </>
              ) : '.'}{' '}
              Un seul paiement à la fois pour cet événement : suivez celui-ci, ou annulez-le pour en lancer un autre.
            </>
          )}
        </p>
        {/* Design 1d (point 4) : temps restant pour finir le paiement, à l'heure du téléphone (lecteurs d'écran : à la minute) */}
        {!holdOver && pending.expiresAt && <PaymentCountdown expiresAt={pending.expiresAt} className="mt-2 font-bold" />}
      </StatusBanner>
      <ConfirmDialog
        isOpen={confirmCancel}
        onClose={() => {
          if (!isCancelling) setConfirmCancel(false);
        }}
        onConfirm={() => void handleCancel()}
        title="Annuler ce paiement ?"
        message="Nous vérifions d’abord auprès de l’opérateur : si vous avez déjà validé sur votre téléphone, le paiement est confirmé et vos billets émis. Sinon, la demande est abandonnée et vos places libérées."
        confirmLabel="Annuler ce paiement"
        cancelLabel="Garder ce paiement"
        variant="danger"
        isLoading={isCancelling}
      />
    </>
  );
}
