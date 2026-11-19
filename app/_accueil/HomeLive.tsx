'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { emitCatalogSignal } from '@/components/events/catalogSignal';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { usePageSettled } from '@/hooks/usePageSettled';

/** Une page régénérée au plus toutes les 60 s : la relire plus souvent ne montrerait rien de neuf. */
const REFRESH_MIN_INTERVAL_MS = 61_000;

/**
 * Design 1b (point 1) — temps réel de l'accueil, en îlot client qui ne bloque pas l'affichage (contrat O5 du lot 5 :
 * publication, suspension, annulation ou fin d'un événement). Abonnement au seul résumé public public_event_state
 * (aucune ligne de vente). Sur un signal : les sections préparées par le serveur sont relues (router.refresh, au plus une
 * fois par minute, la page étant régénérée toutes les 60 s ; un signal reçu entre-temps est rejoué à l'échéance) et
 * « Près de chez vous » se relit (emitCatalogSignal). Le premier signal, envoyé à la connexion, est ignoré : la page vient
 * d'être servie.
 */
export function HomeLive() {
  const router = useRouter();
  const connected = useRef(false);
  const lastRefresh = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    lastRefresh.current = Date.now();
    return () => {
      if (pending.current) clearTimeout(pending.current);
    };
  }, []);

  const onSignal = useCallback(() => {
    if (!connected.current) {
      connected.current = true;
      return;
    }
    emitCatalogSignal();
    if (pending.current) return;
    const wait = Math.max(0, lastRefresh.current + REFRESH_MIN_INTERVAL_MS - Date.now());
    pending.current = setTimeout(() => {
      pending.current = null;
      lastRefresh.current = Date.now();
      router.refresh();
    }, wait);
  }, [router]);

  // Design 1b (décision du 18/11) : abonnement ouvert une fois la page chargée et le téléphone libre
  const settled = usePageSettled();
  const { status } = useRealtimeRefresh({
    channelKey: 'accueil-public',
    subscriptions: [{ table: 'public_event_state' }],
    onSignal,
    enabled: settled,
  });

  return <LiveIndicator status={status} />;
}
