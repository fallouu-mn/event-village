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
 *
 * Lot 9 bis : la carte ne montre que ce que le serveur accepterait (GET /api/tickets, ticket_card_states).
 *  - R25, R66 (B58) : QR, live-code et billet hors ligne seulement si `codeVisible` ; sinon `eventNotice` à la place
 *    (« Événement suspendu : … », « Événement terminé. ») ; « Transférer » seulement si `transferAllowed` ; « Prix »
 *    (« Gratuit », « Invitation » ou le montant) et « Frais de service » (> 0) ; pastille de l'événement hors PUBLIE.
 *  - B9 : « Remboursement retardé, l’équipe Event Village s’en occupe. » quand `refundDelayed`.
 *  - R32 (B23) : `postponementRefund` ouvre « Me faire rembourser » (confirmation, POST /api/tickets/[id]/refund).
 *
 * Design 1b (point 8) : carte façon Wallet. Talon à la couleur de la catégorie au contrôle (`categoryColor`, jetons
 * --scan-cat-*, texte d'au moins 7:1 ; nom de la catégorie toujours écrit : la couleur ne porte jamais seule
 * l'information), vignette de l'affiche (56 px : plus de grande image avant le contenu), bord perforé, compte à rebours à
 * la minute (wallet.ts, heure du téléphone), QR de 190 px sur fond blanc qui s'ouvre en grand au toucher (QrFullscreen,
 * chargé à la demande), « Disponible sans réseau » seulement quand le lot du téléphone est réellement prêt.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
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
  Ticket as TicketIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { TONE_SOFT } from '@/components/ui/tones';
import { useAuth } from '@/components/providers/AuthProvider';
import { usePageSettled } from '@/hooks/usePageSettled';
import { formatDateTime, formatFcfa } from '@/lib/format';
import { REFUND_DELAYED_LABEL } from '@/lib/payments/payment-labels';
import { TICKET_STATUS_META, type TicketStatus } from '@/lib/tickets/ticket-status';
import {
  offlineIndicator,
  offsetFromFetch,
  pickOfflineCode,
  type OfflineAvailability,
  type OfflineLot,
} from '@/lib/tickets/offline-clock';
import { getOfflineLot, hasCachedOfflineShell, OFFLINE_SHELL_PATH, updateLotClock } from '@/lib/tickets/offline-lots';
import { ensureOfflineLot, OFFLINE_LOTS_CHANGED, requestOfflineShell } from '@/components/tickets/OfflineTicketsSync';
import { OfflineStatusBadge } from '@/components/tickets/offline/OfflineStatusBadge';
import { categoryClasses, countdownLabel } from '@/components/tickets/wallet';

// Design 1b (décision du 18/11, temps de blocage de « Mes billets ») : bibliothèque des QR chargée à la demande (au premier
// QR à dessiner), jamais avec la page ; le QR n'est recalculé que si son contenu change.
const QRCodeSVG = React.memo(dynamic(() => import('qrcode.react').then((m) => m.QRCodeSVG), {
  ssr: false,
  loading: () => <span aria-hidden="true" className="block h-[190px] w-[190px]" />,
}));

/** Secondes avant `until` (au moins `min`), renouvelées chaque seconde : seul le petit composant qui l'affiche se redessine. */
function useSecondsLeft(until: number | null, min: number): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (until === null) return undefined;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [until]);
  return until === null ? 0 : Math.max(min, Math.ceil((until - now) / 1000));
}

/** Compte à rebours du code (« 12 s ») : redessiné chaque seconde à la place de toute la carte (design 1b, run 406). */
function QrSeconds({ until, min }: { until: number; min: number }) {
  const seconds = useSecondsLeft(until, min);
  return (
    <span data-ev-qr-timer="" className="text-sm font-bold tabular-nums text-primary-text">
      <span aria-hidden="true">{seconds} s</span>
      <span className="sr-only">Nouveau code dans {seconds} secondes</span>
    </span>
  );
}

/** QR en grand (chargé au toucher) avec son compte à rebours, renouvelé chaque seconde sans redessiner la carte. */
function QrFullscreenLive({ until, min, ...rest }: { until: number | null; min: number; value: string; eventTitle: string; categoryName: string; ticketNumber: string; onClose: () => void }) {
  const secondsLeft = useSecondsLeft(until, min);
  return <QrFullscreen {...rest} secondsLeft={secondsLeft} />;
}

/**
 * Démarrage du travail d'une carte (code dynamique, lot hors ligne, QR) : tout de suite pour le premier billet (`eager`) ;
 * pour les autres, quand la carte devient visible (glissée à l'écran, grille de l'ordinateur) ou quand le téléphone est
 * libre une fois la page chargée — jamais pendant le chargement de Mes billets (design 1b, décision du 18/11 ; run 420).
 * Sans réseau aussi (lot hors ligne) : rien ne dépend de la connexion ici.
 */
function useStartWhenReady(eager: boolean, ref: React.RefObject<HTMLElement | null>): boolean {
  // Run 420 : démarrage au premier moment libre, souvent avant la fin du chargement (codes et QR des billets 2 et 3 dans
  // la fenêtre mesurée) ; désormais après l'événement load puis le premier moment libre (usePageSettled), ou à l'écran.
  const settled = usePageSettled();
  const [visible, setVisible] = useState<boolean>(false);
  useEffect(() => {
    if (eager || visible) return undefined;
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') return undefined;
    const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setVisible(true); }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [eager, visible, ref]);
  return eager || settled || visible;
}

/** Design 1b (point 8) : QR en grand chargé seulement au toucher du QR (hors du premier chargement de Mes billets). */
const QrFullscreen = dynamic(() => import('@/components/tickets/QrFullscreen').then((m) => m.QrFullscreen), { ssr: false });
/** Design 1b (point 1, budget JS de /tickets) : fenêtres de confirmation (et Modal) chargées après le premier affichage. */
const ConfirmDialog = dynamic(() => import('@/components/ui/ConfirmDialog').then((m) => m.ConfirmDialog), { ssr: false });

export interface TicketCardProps {
  id: string;
  /** Événement du billet : cible du lien partagé (/events/<id>). */
  eventId: string;
  ticketNumber: string;
  eventTitle: string;
  eventSubtitle?: string;
  /** Affiche de l'événement (vignette du talon) ; absente : pictogramme. */
  eventImageUrl: string | null;
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
  /** Lot 9 bis (R25, R66) : champs servis par GET /api/tickets ; absents, rien n'est montré par défaut. */
  price?: number;
  serviceFee?: number;
  saleChannel?: string | null;
  /** Statut de l'événement (pastille hors PUBLIE, libellés de EVENT_STATUS_META). */
  eventStatus?: string;
  codeVisible?: boolean;
  transferAllowed?: boolean;
  eventNotice?: string | null;
  refundDelayed?: boolean;
  postponementRefund?: { amount: number; until: string; toOriginalBuyer: boolean } | null;
  /** Design 1b (point 8) : couleur de la catégorie au contrôle (scan_color), début et fin retenue (ISO), heure du
   *  téléphone à la minute (une seule minuterie pour toute la page). */
  categoryColor?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  now?: number;
  /** Design 1b : premier billet visible, démarré tout de suite ; les autres attendent l'affichage de la page (défaut : oui). */
  eager?: boolean;
  /** Remboursement demandé (R32) : la liste est relue. */
  onRefunded?: () => void;
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
  price,
  serviceFee = 0,
  saleChannel = null,
  eventStatus,
  codeVisible = false,
  transferAllowed = false,
  eventNotice = null,
  refundDelayed = false,
  postponementRefund = null,
  categoryColor = null,
  startsAt = null,
  endsAt = null,
  now,
  eager = true,
  onRefunded,
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
  // R25, R66 : code d'entrée montré seulement si le serveur accepterait le scan (suspendu, annulé, fenêtre fermée : non)
  const showCode = isActive && codeVisible;
  const cardRef = useRef<HTMLElement>(null);
  const started = useStartWhenReady(eager, cardRef);
  const priceLabel = saleChannel === 'INVITATION' ? 'Invitation' : price === 0 ? 'Gratuit' : price !== undefined ? formatFcfa(price) : null;

  // QR dynamique : payload du live-code uniquement (aucune valeur statique de repli)
  const [liveCode, setLiveCode] = useState<LiveCode | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [liveCodeUnavailable, setLiveCodeUnavailable] = useState<string | null>(null);
  const [clock, setClock] = useState<number>(() => Date.now());
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isRefundOpen, setIsRefundOpen] = useState<boolean>(false);
  const [isRefunding, setIsRefunding] = useState<boolean>(false);
  const [isQrBig, setIsQrBig] = useState<boolean>(false);

  // Lot 7 (7.1) : lot de codes hors ligne enregistré sur ce téléphone
  const offlineEligible = showCode && !isTransferLocked && Boolean(userId);
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

  // Lecture du lot local, puis téléchargement si le serveur dit le billet disponible et que le lot manque (design 1b :
  // après l'affichage de la page, sauf pour le premier billet).
  useEffect(() => {
    if (!offlineEligible || !userId) {
      setOfflineLot(null);
      return;
    }
    if (!started) return;
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
  }, [offlineEligible, userId, id, offline, refreshOffline, started]);

  useEffect(() => {
    if (!showCode || isTransferLocked || !id) {
      setLiveCode(null);
      return;
    }
    // Design 1b : code dynamique demandé après l'affichage de la page, sauf pour le premier billet
    if (!started) return;

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
  }, [id, showCode, isTransferLocked, accessToken, userId, started]);

  // Horloge de la carte : renouvelée aux seuls instants qui changent son contenu (code périmé, pas suivant du lot local),
  // plus chaque seconde (design 1b, run 406 : toute la carte se redessinait chaque seconde). Le compte à rebours affiché
  // est un petit composant à part (QrSeconds).
  const usesLocalLot = isOffline && Boolean(offlineLot) && offlineEligible;
  useEffect(() => {
    if (usesLocalLot) setClock(Date.now());
  }, [usesLocalLot]);

  // Le serveur accepte le pas voisin : au-delà, le code est périmé et n'est plus affiché
  const liveCodeStale = liveCode ? clock > liveCode.expiresAt + liveCode.stepMs : true;
  const showQr = Boolean(liveCode) && !liveCodeStale;
  // Sans code du serveur à jour (réseau coupé) : code du lot local pour l'heure du serveur, jamais figé
  const localPick = !showQr && usesLocalLot && offlineLot ? pickOfflineCode(offlineLot, clock) : null;
  const localCode = localPick && localPick.state === 'code' ? localPick : null;
  const localChangeAt = localCode ? clock + localCode.nextChangeInMs : null;
  const nextBoundary = liveCode && showQr ? liveCode.expiresAt + liveCode.stepMs + 1 : localChangeAt !== null ? localChangeAt + 1 : null;
  useEffect(() => {
    if (nextBoundary === null) return undefined;
    const timer = setTimeout(() => setClock(Date.now()), Math.min(Math.max(0, nextBoundary - Date.now()), 2_000_000_000));
    return () => clearTimeout(timer);
  }, [nextBoundary]);
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
    if (!codeVisible) {
      toast.error(eventNotice ?? 'Le billet n’est pas présentable à l’entrée pour le moment.');
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
        toast.error(message ?? 'Le billet PDF n’a pas pu être généré. Réessayez dans un instant.', { onRetry: () => void handleDownloadPdf() });
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
      toast.error('Connexion impossible : le PDF n’a pas été téléchargé. Vérifiez votre réseau, puis réessayez.', { onRetry: () => void handleDownloadPdf() });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  /** R32 : remboursement total ouvert par un report de plus de 24 h ; refus du serveur dit tel quel. */
  const handleRefund = async () => {
    setIsRefunding(true);
    try {
      const res = await fetch(`/api/tickets/${id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
        body: JSON.stringify({ confirm: true }),
      });
      if (res.ok) {
        toast.success('Remboursement demandé : vous recevrez un SMS dès qu’il est versé.');
        setIsRefundOpen(false);
        onRefunded?.();
        return;
      }
      const message = await readErrorMessage(res, 'remboursement');
      toast.error(message ?? 'Le remboursement n’a pas pu être demandé. Réessayez dans un instant.');
    } catch (err) {
      console.error('[TicketCard] demande de remboursement impossible :', err instanceof Error ? err.message : String(err));
      toast.error('Connexion impossible : le remboursement n’a pas été demandé. Vérifiez votre réseau, puis réessayez.');
    } finally {
      setIsRefunding(false);
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
      toast.error(message ?? 'Le transfert n’a pas pu être annulé. Réessayez dans un instant.');
    } catch (err) {
      console.error('[TicketCard] annulation du transfert impossible :', err instanceof Error ? err.message : String(err));
      toast.error('Connexion impossible : le transfert n’a pas été annulé. Vérifiez votre réseau, puis réessayez.', { onRetry: () => void handleCancelTransfer() });
    } finally {
      setIsCancelling(false);
    }
  };

  const countdown = isActive ? countdownLabel(startsAt, endsAt, now ?? clock) : null;
  const band = categoryClasses(categoryColor);
  const qrValue = liveCode && showQr ? liveCode.payload : localCode ? localCode.payload : null;
  // Fin du code affiché (compte à rebours) : pas du serveur, ou pas suivant du lot local (au moins 1 s)
  const qrUntil = liveCode && showQr ? liveCode.expiresAt : localChangeAt;
  const qrMin = liveCode && showQr ? 0 : 1;

  return (
    <article ref={cardRef} className="flex w-full flex-col" aria-label={`Billet pour ${eventTitle}`} data-ev-ticket-color={categoryColor ?? 'aucune'}>
      {/* 1. Carte billet façon Wallet : talon à la couleur de la catégorie, bord perforé, QR sur fond blanc */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-card shadow-md">
        <div className={cn('px-4 pb-6 pt-4', band)}>
          <div className="flex items-start gap-3">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-card" aria-hidden="true">
              {eventImageUrl ? (
                <Image src={eventImageUrl} alt="" fill sizes="56px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-primary-text">
                  <TicketIcon size={24} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                <span className="sr-only">Catégorie : </span>
                {seat}
              </p>
              <h2 className="mt-0.5 line-clamp-2 break-words text-lg font-bold leading-snug">{eventTitle}</h2>
              {eventSubtitle && <p className="mt-0.5 truncate text-sm font-medium">{eventSubtitle}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isTransferLocked ? (
              <Badge variant="warning" icon={<Lock size={12} aria-hidden="true" />}>
                Transfert en attente
              </Badge>
            ) : (
              <StatusBadge domain="ticket" status={status} size="sm" />
            )}
            {eventStatus && eventStatus !== 'PUBLIE' && (
              <StatusBadge domain="event" status={eventStatus} size="sm" />
            )}
            {countdown && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-sm font-semibold tabular-nums text-foreground-strong">
                <Clock size={14} aria-hidden="true" className="text-primary-text" />
                {countdown}
              </span>
            )}
          </div>
        </div>

        {/* Bord perforé : deux encoches (fond de la page) et une ligne de découpe entre le talon et le billet (décor) */}
        <div aria-hidden="true" className="relative h-0">
          <span className="absolute -left-3 -top-3 z-10 h-6 w-6 rounded-full border border-border bg-background" />
          <span className="absolute -right-3 -top-3 z-10 h-6 w-6 rounded-full border border-border bg-background" />
          <div className="absolute inset-x-5 -top-px border-t-2 border-dashed border-border" />
        </div>

        <div className="space-y-4 p-4">
          {/* Informations d'accès */}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3">
            <div className="min-w-0">
              <dt className="text-sm font-medium text-muted-foreground">Date</dt>
              <dd className="mt-0.5 text-base font-semibold text-foreground-strong">{dateFormatted}</dd>
            </div>
            <div className="min-w-0 text-right">
              <dt className="text-sm font-medium text-muted-foreground">Heure d’accès</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground-strong">{timeFormatted}</dd>
            </div>
            <div className="col-span-2 min-w-0">
              <dt className="text-sm font-medium text-muted-foreground">Lieu</dt>
              <dd className="mt-0.5 truncate text-base font-semibold text-foreground-strong">{venue}</dd>
            </div>
            {priceLabel && (
              <div className="min-w-0">
                <dt className="text-sm font-medium text-muted-foreground">Prix</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground-strong">{priceLabel}</dd>
              </div>
            )}
            {serviceFee > 0 && (
              <div className="min-w-0 text-right">
                <dt className="text-sm font-medium text-muted-foreground">Frais de service</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums text-foreground-strong">{formatFcfa(serviceFee)}</dd>
              </div>
            )}
          </dl>

          {refundDelayed && (
            <p role="status" className={cn('rounded-xl border p-3 text-sm font-medium', TONE_SOFT.warning)}>{REFUND_DELAYED_LABEL}</p>
          )}
          {postponementRefund && isActive && !isTransferLocked && (
            <div className={cn('space-y-2 rounded-xl border p-3 text-sm', TONE_SOFT.info)}>
              <p className="font-medium tabular-nums">
                L’événement a été reporté de plus de 24 h : remboursement total possible ({formatFcfa(postponementRefund.amount)}, frais de service compris) jusqu’au {formatDateTime(postponementRefund.until)}.
              </p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setIsRefundOpen(true)} leftIcon={<RotateCcw size={16} aria-hidden="true" />}>
                Me faire rembourser
              </Button>
            </div>
          )}

          {isTransferLocked ? (
            /* Billet verrouillé pendant un transfert */
            <div className="space-y-3 rounded-2xl border border-warning-border bg-warning-soft p-4 text-center text-warning-text">
              <Clock size={24} aria-hidden="true" className="mx-auto" />
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
          ) : isActive && !showCode ? (
            /* R25, R66 : le serveur refuserait le scan (événement suspendu, terminé) : son message à la place du QR */
            <p role="status" className={cn('rounded-xl border p-3 text-center text-sm font-medium', TONE_SOFT.warning)}>
              {eventNotice ?? 'Le code d’entrée n’est pas disponible pour le moment.'}
            </p>
          ) : isActive ? (
            /* QR dynamique : payload du live-code, renouvelé à chaque pas ; touché, il s'ouvre en grand */
            <div className="flex flex-col items-center">
              {/* Fond blanc fixe sous le QR, même en thème sombre : contraste exigé par les lecteurs de QR */}
              {qrValue ? (
                <button
                  type="button"
                  onClick={() => setIsQrBig(true)}
                  aria-label="Agrandir le QR code en plein écran"
                  className="ev-press flex h-[216px] w-[216px] items-center justify-center rounded-2xl border border-border bg-white p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  {liveCode && showQr ? (
                    <QRCodeSVG value={liveCode.payload} size={190} level="M" includeMargin={false} title="QR d’entrée dynamique" />
                  ) : localCode ? (
                    <span data-ev-qr-payload={localCode.payload} data-ev-qr-counter={localCode.counter} className="flex">
                      <QRCodeSVG value={localCode.payload} size={190} level="M" includeMargin={false} title="QR d’entrée, billet enregistré sur ce téléphone" />
                    </span>
                  ) : null}
                </button>
              ) : (
                <div className="flex h-[216px] w-[216px] items-center justify-center rounded-2xl border border-border bg-background p-3">
                  {liveCodeUnavailable ? (
                    <p role="status" className="px-2 text-center text-sm font-medium text-foreground-strong">{liveCodeUnavailable}</p>
                  ) : isOffline ? (
                    <div role="status" className="flex flex-col items-center gap-2 px-2 text-center">
                      <WifiOff size={28} aria-hidden="true" className="text-warning-text" />
                      <p className="text-sm font-medium text-foreground-strong">Connexion requise pour afficher le code d’entrée.</p>
                    </div>
                  ) : (
                    // Décision du 18/11 : QR pas encore prêt = squelette FIXE (aucune animation continue sur Mes billets)
                    <div role="status" data-ev-qr-wait="" className="flex flex-col items-center gap-2 text-muted-foreground">
                      <QrCode size={28} aria-hidden="true" className="text-primary-text" />
                      <span className="text-sm font-medium">Code d’entrée…</span>
                    </div>
                  )}
                </div>
              )}
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="sr-only">Numéro du billet : </span>
                <span className="font-mono font-semibold tabular-nums">{ticketNumber}</span>
              </p>
              {qrValue && <p className="mt-1 text-sm text-muted-foreground">Touchez le QR pour l’agrandir.</p>}

              <div className="mt-3 w-full space-y-2 rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between gap-2 text-sm font-semibold text-foreground-strong">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={cn('h-2 w-2 flex-shrink-0 rounded-full', isOffline ? 'bg-warning' : 'bg-success')} />
                    {localCode ? 'Sans réseau : billet enregistré' : isOffline ? 'Sans réseau' : 'Code renouvelé toutes les 20 s'}
                  </span>
                  {qrValue && qrUntil !== null && <QrSeconds until={qrUntil} min={qrMin} />}
                </div>
                {/* Décision du 18/11 : plus de barre animée du pas du code (animation continue) ; le décompte en secondes suffit */}
                <p className="text-sm leading-snug text-muted-foreground">
                  {localCode
                    ? 'Code calculé sur ce téléphone. Une capture d’écran n’est pas acceptée.'
                    : isOffline
                      ? 'Le code s’affichera dès le retour du réseau. Une capture d’écran n’est pas acceptée.'
                      : 'Une capture d’écran n’est pas acceptée au contrôle.'}
                </p>
                <p className="flex items-start gap-1.5 text-sm leading-snug text-muted-foreground">
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
                      Ouvrir ce billet sans réseau
                    </a>
                  )}
                </div>
              )}

              <p className="mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-success-text">
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Billet authentique, émis par Event Village</span>
              </p>
            </div>
          ) : status === 'UTILISE' ? (
            <div className="space-y-1 rounded-xl border border-border bg-background p-3 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-foreground-strong">
                <CheckCircle2 size={16} aria-hidden="true" className="text-muted-foreground" />
                <span>{meta.description}</span>
              </p>
              {usedAt && (
                <p className="text-sm text-muted-foreground">
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
      <div className="mt-3 grid w-full grid-cols-3 gap-2">
        {isActive && !isTransferLocked && transferAllowed && onTransferClick && (
          <Button
            variant="primary"
            size="sm"
            onClick={onTransferClick}
            leftIcon={<Send size={16} aria-hidden="true" />}
            className="col-span-3"
          >
            Transférer
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={handleShareWhatsapp}
          leftIcon={<MessageCircle size={16} aria-hidden="true" className="text-success-text" />}
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
          disabled={!showCode || isTransferLocked}
          leftIcon={<Download size={16} aria-hidden="true" />}
          aria-label="Télécharger le billet en PDF"
        >
          PDF
        </Button>

        {onOpenExplainer && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenExplainer}
            leftIcon={<HelpCircle size={16} aria-hidden="true" />}
            className="col-span-3"
          >
            Aide au transfert
          </Button>
        )}
      </div>

      {isQrBig && qrValue && (
        <QrFullscreenLive
          until={qrUntil}
          min={qrMin}
          value={qrValue}
          eventTitle={eventTitle}
          categoryName={seat}
          ticketNumber={ticketNumber}
          onClose={() => setIsQrBig(false)}
        />
      )}

      {postponementRefund && (
        <ConfirmDialog
          isOpen={isRefundOpen}
          onClose={() => setIsRefundOpen(false)}
          onConfirm={() => { void handleRefund(); }}
          title="Me faire rembourser ?"
          message={postponementRefund.toOriginalBuyer
            ? `Remboursement de ${formatFcfa(postponementRefund.amount)}, frais de service compris. Le remboursement est versé à l’acheteur d’origine. Votre billet sera annulé.`
            : `Remboursement de ${formatFcfa(postponementRefund.amount)}, frais de service compris, sur le compte Mobile Money qui a payé. Votre billet sera annulé.`}
          confirmLabel="Me faire rembourser"
          cancelLabel="Garder mon billet"
          variant="warning"
          isLoading={isRefunding}
        />
      )}

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
