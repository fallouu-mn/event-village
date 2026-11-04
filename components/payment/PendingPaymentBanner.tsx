'use client';

/**
 * Lot 7 (7.3, D4, contrat 3.5) — bandeau « paiement déjà en attente » de la page d'un événement.
 *
 * Lit GET /api/checkout/pending?eventId=<id> (paiement de billets PENDING, réservation non échue, du compte
 * de la session seulement). S'il y en a un, le bandeau propose « Suivre le paiement » vers /paiement/<id>
 * au lieu d'un second achat (que le serveur refuserait de toute façon : 409 PAYMENT_PENDING). Le bandeau
 * disparaît à l'échéance de la réservation. Lecture relancée quand `refreshKey` change (fermeture de la
 * modale de paiement, par exemple).
 * Un échec de lecture est journalisé et n'affiche rien : la garde du serveur reste seule juge, et la modale
 * affiche le refus 409 avec le même lien.
 */

import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { LinkButton } from '@/components/ui/LinkButton';
import { formatFcfa, formatTime } from '@/lib/format';
import { isRecord, isSamirPayOperator, nonEmptyString, operatorLabel, paymentStatusPath, readAmount, readJsonBody } from '@/lib/payments/payment-client';

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
  className?: string;
}

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

export function PendingPaymentBanner({ eventId, enabled, refreshKey = 0, onChange, className }: PendingPaymentBannerProps) {
  const [pending, setPending] = useState<PendingTicketPaymentView | null>(null);

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
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error('[PendingPaymentBanner] lecture du paiement en attente impossible :', err instanceof Error ? err.message : String(err));
        setPending(null);
      }
    })();
    return () => controller.abort();
  }, [enabled, eventId, refreshKey]);

  // Réservation échue : le paiement ne bloque plus un nouvel achat, le bandeau disparaît.
  useEffect(() => {
    if (!pending?.expiresAt) return;
    const remaining = Date.parse(pending.expiresAt) - Date.now();
    if (!Number.isFinite(remaining)) return;
    if (remaining <= 0) {
      setPending(null);
      return;
    }
    const timer = setTimeout(() => setPending(null), Math.min(remaining, 2_147_000_000));
    return () => clearTimeout(timer);
  }, [pending]);

  useEffect(() => {
    onChange?.(pending);
  }, [pending, onChange]);

  if (!pending) return null;

  const amount = pending.amount !== null ? formatFcfa(pending.amount) : null;
  const via = pending.operatorName ? ` par ${pending.operatorName}` : '';

  return (
    <StatusBanner
      tone="warning"
      title="Un paiement est déjà en attente pour cet événement"
      icon={<Clock size={20} />}
      className={className}
      action={(
        <LinkButton href={pending.statusPath} variant="secondary" size="sm">
          Suivre le paiement
        </LinkButton>
      )}
    >
      <p>
        {amount ? `Paiement de ${amount}${via}` : `Paiement${via}`}
        {pending.expiresAt ? (
          <>
            {' '}à valider avant <time dateTime={pending.expiresAt}>{formatTime(pending.expiresAt)}</time>.
          </>
        ) : '.'}{' '}
        Suivez-le au lieu d’en lancer un autre : vos billets arrivent dès sa confirmation.
      </p>
    </StatusBanner>
  );
}
