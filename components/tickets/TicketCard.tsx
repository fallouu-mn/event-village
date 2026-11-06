'use client';

/**
 * Carte billet du client (lot 4 ; système de design du lot 5, contrat Q). Le QR affiché est le payload du
 * code dynamique servi par /api/tickets/[id]/live-code (« EVT1:<UUID>:<code> »), renouvelé au changement
 * de pas indiqué par le serveur (expires_in) : aucun QR statique, jamais. Sans code à jour (réseau
 * coupé), la carte le dit et rappelle l'entrée sans téléphone (numéro du billet et pièce d'identité au
 * contrôle). Partage (WhatsApp, lien) : le lien de l'événement uniquement, jamais le numéro du billet.
 *
 * Statut du billet : pastille et message lus dans TICKET_STATUS_META (lib/tickets/ticket-status.ts),
 * jamais la valeur brute de l'enum.
 *
 * Lot 7 (7.1, contrat 5.2) : billet disponible hors ligne.
 *  - Indicateur `data-ev-offline-state` (OfflineStatusBadge) : « Disponible hors ligne » seulement quand le lot
 *    de la version courante est enregistré ET la page hors ligne en cache (D35).
 *  - Téléchargement à l'affichage quand le serveur dit le billet disponible (`offline` de /api/tickets),
 *    dédoublonné avec la synchronisation (OfflineTicketsSync).
 *  - Réseau coupé pendant l'affichage : le QR vient du lot local, au code de l'heure du serveur (écart mesuré),
 *    renouvelé à chaque pas ; la règle liveCodeStale est conservée (jamais de QR figé).
 *  - Chaque réponse réussie du live-code remesure l'écart d'horloge (server_time) et met le lot à jour.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import {
  Share2,
  Download,
  CheckCircle2,
  Send,
  Lock,
  RotateCcw,
  HelpCircle,
  Clock,
  MessageCircle,
  WifiOff,
  IdCard,
  QrCode,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { TONE_SOFT } from '@/components/ui/tones';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatDateTime } from '@/lib/format';
import { TICKET_STATUS_META, type TicketStatus } from '@/lib/tickets/ticket-status';
import {
  offlineIndicator,
  offsetFromFetch,
  pickOfflineCode,
  type OfflineAvailability,
  type OfflineLot,
} from '@/lib/tickets/offline-clock';
import { getOfflineLot, hasCachedOfflineShell, OFFLINE_SHELL_PATH, updateLotClock } from '@/lib/tickets/offline-store';
import { ensureOfflineLot, OFFLINE_LOTS_CHANGED, requestOfflineShell } from '@/components/tickets/OfflineTicketsSync';
import { OfflineStatusBadge } from '@/components/tickets/offline/OfflineStatusBadge';

export interface TicketCardProps {
  id: string;
  /** Événement du billet : cible du lien partagé (/events/<id>). */
  eventId: string;
  ticketNumber: string;
  eventTitle: string;
  eventSubtitle?: string;
  eventImageUrl: string;
  dateFormatted: string;
  timeFormatted: string;
  venue: string;
  seat?: string;
  status: TicketStatus;
  usedAt?: string;
  isTransferLocked?: boolean;
  activeTransfer?: {
    id: string;
    recipient: string;
    expires_at: string;
  } | null;
  /** Lot 7 (7.1, contrat 3.2) : disponibilité hors ligne décidée par le serveur (GET /api/tickets). */
  offline?: OfflineAvailability | null;
  onTransferClick?: () => void;
  onCancelTransferSuccess?: () => void;
  onOpenExplainer?: () => void;
}

/** Code dynamique servi par le serveur : payload, fin du pas courant (horloge locale) et durée d'un pas. */
interface LiveCode {
  payload: string;
  expiresAt: number;
  stepMs: number;
}

const OFFLINE_RETRY_MS = 5_000;
/** Écart d'horloge remesuré par le live-code : le lot local n'est réécrit qu'au-delà de cette différence. */
const CLOCK_RESYNC_THRESHOLD_MS = 2_000;

/** Lecture tolérante d'un corps JSON d'erreur : le message du serveur, ou null (jamais d'exception). */
async function readErrorMessage(res: Response, context: string): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body.error === 'string' && body.error ? body.error : null;
  } catch (err) {
    console.warn(`[TicketCard] ${context} : réponse illisible (HTTP ${res.status})`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export const TicketCard: React.FC<TicketCardProps> = ({
  id,
  eventId,
  ticketNumber,
  eventTitle,
  eventSubtitle,
  eventImageUrl,
  dateFormatted,
  timeFormatted,
  venue,
  seat = 'Fosse générale (placement libre)',
  status,
  usedAt,
  isTransferLocked = false,
  activeTransfer = null,
  offline = null,
  onTransferClick,
  onCancelTransferSuccess,
  onOpenExplainer,
}) => {
  const toast = useToast();
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id ?? null;
  const isActive = status === 'VALIDE';
  const meta = TICKET_STATUS_META[status];

  // QR dynamique : payload du live-code uniquement (aucune valeur statique de repli)
  const [liveCode, setLiveCode] = useState<LiveCode | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [liveCodeUnavailable, setLiveCodeUnavailable] = useState<string | null>(null);
  const [clock, setClock] = useState<number>(() => Date.now());
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Lot 7 (7.1) : lot de codes hors ligne enregistré sur ce téléphone
  const offlineEligible = isActive && !isTransferLocked && Boolean(userId);
  const [offlineLot, setOfflineLot] = useState<OfflineLot | null>(null);
  const [shellCached, setShellCached] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [offlineBusy, setOfflineBusy] = useState<boolean>(false);
  const offlineLotRef = useRef<OfflineLot | null>(null);
  offlineLotRef.current = offlineLot;
  const refreshOfflineRef = useRef<() => Promise<void>>(async () => undefined);

  const refreshOffline = useCallback(async () => {
    if (!offlineEligible || !userId) {
      setOfflineLot(null);
      return;
    }
    try {
      const [lot, shell] = await Promise.all([getOfflineLot(userId, id), hasCachedOfflineShell()]);
      setOfflineLot(lot);
      setShellCached(shell);
    } catch (err) {
      // Stockage indisponible (déjà journalisé par offline-store) : aucun lot, l'indicateur le dit.
      console.warn(`[TicketCard] billet ${id} : lot hors ligne illisible`, err instanceof Error ? err.message : String(err));
      setOfflineLot(null);
    }
  }, [offlineEligible, userId, id]);
  refreshOfflineRef.current = refreshOffline;

  // Lecture du lot local, puis téléchargement si le serveur dit le billet disponible et que le lot manque.
  useEffect(() => {
    if (!offlineEligible || !userId) {
      setOfflineLot(null);
      return;
    }
    let cancelled = false;
    setIsOnline(navigator.onLine);
    const run = async () => {
      await refreshOffline();
      if (cancelled || !offline?.available || !navigator.onLine) return;
      setOfflineBusy(true);
      try {
        const outcome = await ensureOfflineLot(userId, id, offline);
        if (cancelled) return;
        if (outcome.kind === 'saved' || outcome.kind === 'fresh') await refreshOffline();
        if (!(await hasCachedOfflineShell())) await requestOfflineShell();
      } finally {
        if (!cancelled) setOfflineBusy(false);
      }
    };
    void run();
    const onChanged = () => { void refreshOffline(); };
    const onOnline = () => { setIsOnline(true); void run(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener(OFFLINE_LOTS_CHANGED, onChanged);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      cancelled = true;
      window.removeEventListener(OFFLINE_LOTS_CHANGED, onChanged);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [offlineEligible, userId, id, offline, refreshOffline]);

  useEffect(() => {
    if (!isActive || isTransferLocked || !id) {
      setLiveCode(null);
      return;
    }

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleNext = (ms: number) => {
      refreshTimer = setTimeout(() => { void loadLiveCode(); }, ms);
    };

    const loadLiveCode = async () => {
      try {
        const t0 = Date.now();
        const res = await fetch(`/api/tickets/${id}/live-code`, {
          cache: 'no-store',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (cancelled) return;
        if (res.ok) {
          const t1 = Date.now();
          const data = (await res.json()) as { payload?: unknown; expires_in?: unknown; step_seconds?: unknown; server_time?: unknown };
          if (cancelled) return;
          if (typeof data.payload !== 'string' || !data.payload.startsWith('EVT1:')) {
            throw new Error('réponse du live-code sans payload');
          }
          const expiresInSeconds = Math.max(1, Number(data.expires_in) || 1);
          const stepSeconds = Math.max(expiresInSeconds, Number(data.step_seconds) || expiresInSeconds);
          setLiveCode({ payload: data.payload, expiresAt: Date.now() + expiresInSeconds * 1000, stepMs: stepSeconds * 1000 });
          setIsOffline(false);
          setLiveCodeUnavailable(null);
          resyncOfflineClock(data.server_time, t0, t1);
          // Nouveau code juste après le changement de pas annoncé par le serveur
          scheduleNext(expiresInSeconds * 1000 + 250);
          return;
        }
        if (res.status === 404 || res.status === 409) {
          // Billet transféré, composté ou annulé : plus aucun code d'entrée
          setLiveCode(null);
          setLiveCodeUnavailable('Ce billet n’a plus de code d’entrée. Actualisez la page.');
          return;
        }
        if (res.status === 429) {
          scheduleNext((Number(res.headers.get('Retry-After')) || 5) * 1000);
          return;
        }
        console.warn(`[TicketCard] code dynamique : HTTP ${res.status}`);
        setIsOffline(true);
        scheduleNext(OFFLINE_RETRY_MS);
      } catch (err) {
        if (cancelled) return;
        console.warn('[TicketCard] code dynamique indisponible :', err instanceof Error ? err.message : String(err));
        setIsOffline(true);
        scheduleNext(OFFLINE_RETRY_MS);
      }
    };

    /** Lot 7 (contrat 5.2) : écart d'horloge remesuré à chaque code reçu ; lot local réécrit s'il a changé. */
    const resyncOfflineClock = (serverTime: unknown, t0: number, t1: number) => {
      const lot = offlineLotRef.current;
      if (!lot || !userId || typeof serverTime !== 'string') return;
      let offsetMs: number;
      try {
        offsetMs = offsetFromFetch(serverTime, t0, t1);
      } catch (err) {
        console.warn('[TicketCard] écart d’horloge non mesurable :', err instanceof Error ? err.message : String(err));
        return;
      }
      if (Math.abs(offsetMs - Number(lot.offsetMs)) < CLOCK_RESYNC_THRESHOLD_MS && t1 >= Number(lot.downloadedAtDevice)) return;
      updateLotClock(userId, id, offsetMs, t1, Date.parse(serverTime))
        .then(() => refreshOfflineRef.current())
        .catch((err: unknown) => {
          console.warn('[TicketCard] écart d’horloge non enregistré :', err instanceof Error ? err.message : String(err));
        });
    };

    void loadLiveCode();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [id, isActive, isTransferLocked, accessToken, userId]);

  // Horloge du compte à rebours (affichage seulement : le rafraîchissement suit expires_in) ; aussi pour le
  // QR du lot local, renouvelé à chaque pas de l'heure du serveur.
  const usesLocalLot = isOffline && Boolean(offlineLot) && offlineEligible;
  useEffect(() => {
    if (!liveCode && !usesLocalLot) return;
    setClock(Date.now());
    const tick = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [liveCode, usesLocalLot]);

  const secondsLeft = liveCode ? Math.max(0, Math.ceil((liveCode.expiresAt - clock) / 1000)) : 0;
  // Le serveur accepte le pas voisin : au-delà, le code est périmé et n'est plus affiché
  const liveCodeStale = liveCode ? clock > liveCode.expiresAt + liveCode.stepMs : true;
  const showQr = Boolean(liveCode) && !liveCodeStale;
  // Sans code du serveur à jour (réseau coupé) : code du lot local pour l'heure du serveur, jamais figé
  const localPick = !showQr && usesLocalLot && offlineLot ? pickOfflineCode(offlineLot, clock) : null;
  const localCode = localPick && localPick.state === 'code' ? localPick : null;
  const localSecondsLeft = localCode ? Math.max(1, Math.ceil(localCode.nextChangeInMs / 1000)) : 0;
  const offlineState = offlineEligible
    ? offlineIndicator({ lot: offlineLot, offline, shellCached, online: isOnline && !isOffline })
    : null;

  const handleShareWhatsapp = () => {
    const link = `${window.location.origin}/events/${eventId}`;
    const message = `${eventTitle} sur Event Village : ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareLink = async () => {
    const link = `${window.location.origin}/events/${eventId}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: eventTitle, url: link });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn('[TicketCard] partage natif indisponible, copie du lien :', err instanceof Error ? err.message : String(err));
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Lien de l’événement copié.');
    } catch (err) {
      console.warn('[TicketCard] copie du lien impossible :', err instanceof Error ? err.message : String(err));
      toast.error('Copie impossible sur cet appareil.');
    }
  };

  const handleDownloadPdf = async () => {
    if (!isActive) {
      toast.error(meta.description);
      return;
    }
    if (isTransferLocked) {
      toast.error('Ce billet est en cours de transfert : le PDF sera disponible si le transfert est annulé.');
      return;
    }

    setIsDownloadingPdf(true);
    try {
      const res = await fetch(`/api/tickets/${id}/pdf`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });

      if (!res.ok) {
        const message = await readErrorMessage(res, 'PDF');
        toast.error(message ?? 'Le billet PDF n’a pas pu être généré. Réessayez dans un instant.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Billet-EventVillage-${ticketNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Billet PDF téléchargé.');
    } catch (err) {
      console.error('[TicketCard] téléchargement du PDF impossible :', err instanceof Error ? err.message : String(err));
      toast.error('Connexion impossible : le PDF n’a pas été téléchargé. Vérifiez votre réseau, puis réessayez.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!activeTransfer?.id) {
      toast.error('Ce transfert est introuvable. Actualisez la page.');
      setIsCancelConfirmOpen(false);
      return;
    }

    setIsCancelling(true);
    try {
      const res = await fetch(`/api/tickets/transfers/${activeTransfer.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      });

      if (res.ok) {
        toast.success('Transfert annulé : votre billet est de nouveau disponible.');
        setIsCancelConfirmOpen(false);
        onCancelTransferSuccess?.();
        return;
      }
      const message = await readErrorMessage(res, 'annulation du transfert');
      toast.error(message ?? `Le transfert n’a pas pu être annulé (erreur ${res.status}).`);
    } catch (err) {
      console.error('[TicketCard] annulation du transfert impossible :', err instanceof Error ? err.message : String(err));
      toast.error('Connexion impossible : le transfert n’a pas été annulé. Vérifiez votre réseau, puis réessayez.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <article className="mx-auto flex w-full max-w-md flex-col" aria-label={`Billet pour ${eventTitle}`}>
      {/* 1. Carte billet */}
      <div className="relative w-full overflow-hidden rounded-3xl border border-border bg-surface shadow-md">
        {/* Visuel de l'événement */}
        <div className="relative h-44 w-full overflow-hidden bg-scrim">
          <Image
            src={eventImageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 28rem) 100vw, 28rem"
          />
          <div className="absolute right-3 top-3 flex max-w-[70%] items-center gap-2">
            {isTransferLocked ? (
              <Badge variant="warning" icon={<Lock size={12} aria-hidden="true" />}>
                Transfert en attente
              </Badge>
            ) : (
              <StatusBadge domain="ticket" status={status} size="sm" />
            )}
          </div>

        </div>

        {/* Titre sous l'affiche, jamais posé dessus : une affiche porte souvent son propre texte (titre, lieu),
            que la surimpression rendait illisible et doublait (relecture du run 77, mes-billets). */}
        <div className="px-5 pt-4">
          <h2 className="text-lg font-bold leading-tight tracking-tight text-fg">{eventTitle}</h2>
          {eventSubtitle && <p className="mt-0.5 truncate text-sm font-medium text-fg-muted">{eventSubtitle}</p>}
        </div>

        {/* Ligne de découpe et ses encoches (décor) */}
        <div aria-hidden="true" className="relative mt-4">
          <span className="absolute -left-3 top-0 z-10 h-6 w-6 -translate-y-1/2 rounded-full border border-border bg-surface-sunken" />
          <span className="absolute -right-3 top-0 z-10 h-6 w-6 -translate-y-1/2 rounded-full border border-border bg-surface-sunken" />
          <div className="mx-5 border-t-2 border-dashed border-border" />
        </div>

        <div className="space-y-4 p-5">
          {/* Informations d'accès */}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
            <div className="min-w-0">
              <dt className="text-sm font-medium text-fg-muted">Date</dt>
              <dd className="mt-0.5 text-base font-semibold text-fg">{dateFormatted}</dd>
            </div>
            <div className="min-w-0 text-right">
              <dt className="text-sm font-medium text-fg-muted">Heure d’accès</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-fg">{timeFormatted}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-sm font-medium text-fg-muted">Lieu</dt>
              <dd className="mt-0.5 truncate text-base font-semibold text-fg">{venue}</dd>
            </div>
            <div className="min-w-0 text-right">
              <dt className="text-sm font-medium text-fg-muted">Emplacement</dt>
              <dd className="mt-0.5 truncate text-base font-semibold text-fg">{seat}</dd>
            </div>
          </dl>

          <div aria-hidden="true" className="border-t-2 border-dashed border-border" />

          {isTransferLocked ? (
            /* Billet verrouillé pendant un transfert */
            <div className="space-y-3 rounded-2xl border border-warning-border bg-warning-bg p-4 text-center text-warning-fg">
              <Clock size={24} aria-hidden="true" className="mx-auto motion-safe:animate-spin" style={{ animationDuration: '4s' }} />
              <div className="space-y-1">
                <h3 className="text-base font-semibold">
                  Transfert en cours vers {activeTransfer?.recipient || 'un proche'}
                </h3>
                <p className="text-sm leading-relaxed">
                  Le code d’entrée est suspendu. Dès que le destinataire accepte le billet, il lui appartient.
                </p>
              </div>

              {activeTransfer && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCancelConfirmOpen(true)}
                  leftIcon={<RotateCcw size={16} aria-hidden="true" />}
                >
                  Annuler le transfert
                </Button>
              )}
            </div>
          ) : isActive ? (
            /* QR dynamique : payload du live-code, renouvelé à chaque pas */
            <div className="flex flex-col items-center pt-1">
              {/* Fond blanc fixe sous le QR, même en thème sombre : contraste exigé par les lecteurs de QR */}
              <div
                className={cn(
                  'flex h-[178px] w-[178px] items-center justify-center rounded-2xl border border-border p-3',
                  showQr || localCode ? 'bg-white' : 'bg-surface-sunken',
                )}
              >
                {liveCode && showQr ? (
                  <QRCodeSVG value={liveCode.payload} size={152} level="M" includeMargin={false} title="QR d’entrée dynamique" />
                ) : localCode ? (
                  <span data-ev-qr-payload={localCode.payload} data-ev-qr-counter={localCode.counter} className="flex">
                    <QRCodeSVG value={localCode.payload} size={152} level="M" includeMargin={false} title="QR d’entrée, billet enregistré sur ce téléphone" />
                  </span>
                ) : liveCodeUnavailable ? (
                  <p role="status" className="px-2 text-center text-sm font-medium text-fg">{liveCodeUnavailable}</p>
                ) : isOffline ? (
                  <div role="status" className="flex flex-col items-center gap-2 px-2 text-center">
                    <WifiOff size={28} aria-hidden="true" className="text-warning-fg" />
                    <p className="text-sm font-medium text-fg">Connexion requise pour afficher le code d’entrée.</p>
                  </div>
                ) : (
                  <div role="status" className="flex flex-col items-center gap-2 text-fg-muted">
                    <QrCode size={28} aria-hidden="true" className="text-brand-fg motion-safe:animate-pulse" />
                    <span className="text-sm font-medium">Code d’entrée…</span>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-fg-muted">
                <span className="sr-only">Numéro du billet : </span>
                <span className="font-mono font-semibold tabular-nums">{ticketNumber}</span>
              </p>

              <div className="mt-3 w-full space-y-2 rounded-xl border border-border bg-surface-sunken p-3">
                <div className="flex items-center justify-between gap-2 text-sm font-semibold text-fg">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn('h-2 w-2 flex-shrink-0 rounded-full', isOffline ? 'bg-warning' : 'bg-success motion-safe:animate-pulse')}
                    />
                    {localCode ? 'Hors connexion : billet enregistré' : isOffline ? 'Hors connexion' : 'Code renouvelé toutes les 20 s'}
                  </span>
                  {(showQr || localCode) && (
                    <span className="text-sm font-bold tabular-nums text-brand-fg">
                      <span aria-hidden="true">{showQr ? secondsLeft : localSecondsLeft} s</span>
                      <span className="sr-only">Nouveau code dans {showQr ? secondsLeft : localSecondsLeft} secondes</span>
                    </span>
                  )}
                </div>
                {liveCode && showQr && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-brand-decor transition-[width] duration-1000 ease-linear"
                      style={{ width: `${Math.max(5, Math.min(100, ((secondsLeft * 1000) / liveCode.stepMs) * 100))}%` }}
                    />
                  </div>
                )}
                <p className="text-center text-sm leading-snug text-fg-muted">
                  {localCode
                    ? 'Code calculé sur ce téléphone, renouvelé toutes les 20 s. Une capture d’écran n’est pas acceptée.'
                    : isOffline
                      ? 'Le code s’affichera dès le retour du réseau. Une capture d’écran n’est pas acceptée.'
                      : 'Une capture d’écran n’est pas acceptée au contrôle.'}
                </p>
                <p className="flex items-start justify-center gap-1.5 text-center text-sm leading-snug text-fg-muted">
                  <IdCard size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0" />
                  <span>Sans téléphone : numéro du billet et pièce d’identité au contrôle.</span>
                </p>
              </div>

              {offlineState && (
                <div className="mt-3 w-full space-y-2">
                  <OfflineStatusBadge
                    state={offlineState}
                    availableFrom={offline?.available_from ?? null}
                    busy={offlineState === 'missing' && offlineBusy}
                  />
                  {offlineState === 'available' && (
                    <a
                      href={`${OFFLINE_SHELL_PATH}?id=${encodeURIComponent(id)}`}
                      className={buttonClasses({ variant: 'secondary', size: 'sm', fullWidth: true })}
                    >
                      <WifiOff size={16} aria-hidden="true" />
                      Afficher ce billet hors ligne
                    </a>
                  )}
                </div>
              )}

              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-success-fg">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Billet authentique, émis par Event Village</span>
              </p>
              <p className="mt-3 w-full rounded-xl border border-brand-fg/20 bg-brand-bg p-3 text-center text-sm font-medium text-brand-fg">
                Présentez ce code au contrôle, billet ouvert dans l’application.
              </p>
            </div>
          ) : status === 'UTILISE' ? (
            <div className="space-y-1 rounded-xl border border-border bg-surface-sunken p-3 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-fg">
                <CheckCircle2 size={16} aria-hidden="true" className="text-fg-muted" />
                <span>{meta.description}</span>
              </p>
              {usedAt && (
                <p className="text-sm text-fg-muted">
                  Contrôlé le <time dateTime={usedAt}>{formatDateTime(usedAt)}</time>
                </p>
              )}
            </div>
          ) : (
            <p className={cn('rounded-xl border p-3 text-center text-sm font-medium', TONE_SOFT[meta.tone])}>
              {meta.description}
            </p>
          )}
        </div>
      </div>

      {/* 2. Actions : transférer, partager l'événement, billet PDF, aide */}
      <div className="mt-4 grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
        {isActive && !isTransferLocked && onTransferClick && (
          <Button
            variant="primary"
            size="sm"
            onClick={onTransferClick}
            leftIcon={<Send size={16} aria-hidden="true" />}
            className="col-span-2"
          >
            Transférer
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={handleShareWhatsapp}
          leftIcon={<MessageCircle size={16} aria-hidden="true" className="text-success-fg" />}
          aria-label="Partager le lien de l’événement sur WhatsApp"
        >
          WhatsApp
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => { void handleShareLink(); }}
          leftIcon={<Share2 size={16} aria-hidden="true" />}
          aria-label="Partager ou copier le lien de l’événement"
        >
          Lien
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => { void handleDownloadPdf(); }}
          isLoading={isDownloadingPdf}
          disabled={!isActive || isTransferLocked}
          leftIcon={<Download size={16} aria-hidden="true" />}
          aria-label="Télécharger le billet en PDF"
        >
          {isDownloadingPdf ? 'Génération…' : 'PDF'}
        </Button>

        {onOpenExplainer && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenExplainer}
            leftIcon={<HelpCircle size={16} aria-hidden="true" />}
          >
            Aide au transfert
          </Button>
        )}
      </div>

      <ConfirmDialog
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={() => { void handleCancelTransfer(); }}
        title="Annuler ce transfert ?"
        message={`Le billet reste à vous et son code d’entrée revient sur cette page. ${activeTransfer?.recipient || 'Le destinataire'} ne pourra plus l’accepter.`}
        confirmLabel="Annuler le transfert"
        cancelLabel="Garder le transfert"
        variant="warning"
        isLoading={isCancelling}
      />
    </article>
  );
};
