'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { PendingPaymentBanner, type PendingTicketPaymentView } from '@/components/payment/PendingPaymentBanner';
import { emitPending, onPendingRefresh, TICKETS_AFTER_PURCHASE } from './signals';

/**
 * Design 1b (point 7) — emplacement du bandeau « paiement en attente » sur la fiche : îlot du navigateur, monté après le
 * chargement, seulement pour une personne connectée (la page en cache n'en contient rien). Il prévient la billetterie
 * (signals.ts) et se relit quand elle le demande (fermeture de la fenêtre de paiement).
 */
export function PendingPaymentSlot({ eventId }: { eventId: string }) {
  const { isAuthenticated, isLoading } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => onPendingRefresh(eventId, () => setRefreshKey((n) => n + 1)), [eventId]);

  const handleChange = useCallback(
    (pending: PendingTicketPaymentView | null) => emitPending({ eventId, statusPath: pending?.statusPath ?? null }),
    [eventId],
  );

  if (isLoading || !isAuthenticated) return null;
  return (
    <PendingPaymentBanner
      eventId={eventId}
      enabled={isAuthenticated}
      refreshKey={refreshKey}
      onChange={handleChange}
      ticketsHref={TICKETS_AFTER_PURCHASE}
      className="ev-sheet-up"
    />
  );
}
