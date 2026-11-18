/**
 * Design 1b (point 7) — signaux entre les îlots de la fiche (navigateur seulement) : le bandeau de paiement en attente
 * (en haut de page) dit à la billetterie (colonne de droite, barre du bas) s'il y a un paiement en attente, et la
 * billetterie lui demande de relire après la fermeture de la fenêtre de paiement. Événements de fenêtre : aucune donnée
 * gardée, rien dans le HTML en cache.
 */

export interface PendingSignal {
  eventId: string;
  /** Chemin de suivi /paiement/<id>, ou null s'il n'y a plus de paiement en attente. */
  statusPath: string | null;
}

const PENDING = 'ev:fiche-paiement-en-attente';
const REFRESH = 'ev:fiche-relire-paiement';

export function emitPending(signal: PendingSignal): void {
  window.dispatchEvent(new CustomEvent<PendingSignal>(PENDING, { detail: signal }));
}

export function onPending(eventId: string, handler: (statusPath: string | null) => void): () => void {
  const listener = (e: Event): void => {
    const detail = (e as CustomEvent<PendingSignal>).detail;
    if (detail && detail.eventId === eventId) handler(detail.statusPath);
  };
  window.addEventListener(PENDING, listener);
  return () => window.removeEventListener(PENDING, listener);
}

export function requestPendingRefresh(eventId: string): void {
  window.dispatchEvent(new CustomEvent<string>(REFRESH, { detail: eventId }));
}

export function onPendingRefresh(eventId: string, handler: () => void): () => void {
  const listener = (e: Event): void => {
    if ((e as CustomEvent<string>).detail === eventId) handler();
  };
  window.addEventListener(REFRESH, listener);
  return () => window.removeEventListener(REFRESH, listener);
}

/** Destination après un achat réussi (paiement confirmé ou panier gratuit) : Mes billets, la petite fête du lot BILLETS. */
export const TICKETS_AFTER_PURCHASE = '/tickets?tab=a-venir&fete=1';
