'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  Bus,
  CalendarDays,
  Car,
  ClipboardList,
  Compass,
  ExternalLink,
  MapPin,
  Minus,
  Navigation,
  Phone,
  Plus,
  RefreshCw,
  SearchX,
  Share2,
  ShieldCheck,
  Ticket,
  Undo2,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { StatusBanner, type StatusBannerTone } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { PendingPaymentBanner } from '@/components/payment/PendingPaymentBanner';
import {
  isRecord,
  isUncertainOutcome,
  nonEmptyString,
  readAmount,
  readCheckoutQuote,
  readJsonBody,
  readPaymentError,
  serverErrorMessage,
  useIdempotencyKey,
  type CheckoutQuote,
} from '@/lib/payments/payment-client';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { eventImageSrc, isProjectStorageImage } from '@/lib/events/event-image';
import { formatDate, formatDateTime, formatFcfa } from '@/lib/format';

const EventMap = dynamic(
  () => import('@/components/ui/EventMap').then((m) => ({ default: m.EventMap })),
  { ssr: false, loading: () => <MapPlaceholder /> },
);

// Lot 7 (7.3, 7.5) : la modale de paiement (formulaire, opérateurs, Modal) n'est chargée qu'au premier
// « Acheter » ; aucune valeur de son module n'est importée statiquement (aides dans lib/payments/payment-client).
const PaymentModal = dynamic(
  () => import('@/components/payment/PaymentModal').then((m) => ({ default: m.PaymentModal })),
  { ssr: false },
);

function MapPlaceholder() {
  return <div className="h-48 w-full rounded-xl bg-surface-sunken motion-safe:animate-pulse sm:h-56" aria-hidden="true" />;
}

/**
 * Carte du lieu chargée seulement quand son emplacement approche de l'écran (IntersectionObserver, marge de
 * 200 px) : Leaflet et ses tuiles ne pèsent ni sur le premier affichage ni sur le réseau d'un visiteur qui ne
 * descend pas jusqu'au lieu. Sans IntersectionObserver (navigateur ancien), la carte est chargée tout de suite.
 */
function EventMapWhenVisible(props: { latitude: number; longitude: number; venueName: string }) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const node = holderRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return <div ref={holderRef}>{visible ? <EventMap {...props} /> : <MapPlaceholder />}</div>;
}

/**
 * Page publique d'un événement (lot 5, tâches 5.3 et 5.13 ; contrats E, O1, O3, O5, Q).
 *  - Source unique : GET /api/events/[id]. 404 (brouillon, en attente, validé, inconnu) → page
 *    « Événement introuvable » ; autre échec → état d'erreur avec « Réessayer ».
 *  - Bandeau StatusBanner alimenté par `banner` (suspendu, annulé, terminé) ; pour un événement annulé,
 *    l'avis public et l'information de remboursement (`cancellation`), jamais le motif interne.
 *  - Module d'achat rendu seulement si `purchasable` ; sinon, les formules restent lisibles sans achat.
 *  - Stock en tranches du serveur : « Disponible », « Plus que N places », « Complet ».
 *  - Temps réel : public_event_state et public_category_stock de cet événement (filtre event_id) ;
 *    chaque signal recharge la fiche par le serveur, sans recharger la page.
 *  - Montants du panier : devis serveur (/api/checkout/quote), jamais calculés ici.
 *  - Lot 7 (7.3, E4) : bandeau PendingPaymentBanner (paiement déjà en attente, GET /api/checkout/pending) ;
 *    reprise du panier d'un paiement échoué (?reprise=<paiement>) ; PaymentModal et EventMap en next/dynamic,
 *    la carte n'étant chargée qu'à l'approche de sa zone (IntersectionObserver).
 *  - Lot 9 bis (R36, R104 ; contrat 5.25 et 5.41, B59, B91, D-txt E.41) : fin de l'événement (`endFormatted`, servie
 *    seulement si une date de fin est saisie) sous « Date et heure » ; billetterie fermée expliquée par le serveur
 *    (`salesEnded` : vente en ligne terminée ; `hasHeldSeats` : places retenues par des paiements en cours, qui peuvent
 *    se libérer) ; panier gardé 30 minutes dans sessionStorage (`ev-cart:{id}`) quand l'achat renvoie à la connexion,
 *    rétabli au retour dans la limite de ce qui est encore achetable, puis effacé.
 */

type Availability = 'AVAILABLE' | 'LOW' | 'SOLD_OUT';
type BannerKind = 'SUSPENDU' | 'ANNULE' | 'TERMINE';

interface PublicCategory {
  id: string;
  name: string;
  price: number;
  description?: string;
  availability: Availability;
  remainingHint: number | null;
  isAvailable: boolean;
  saleStarted: boolean;
  saleEnded: boolean;
  saleStart: string | null;
  saleEnd: string | null;
  maxPerOrder: number;
}

interface ProgramItem {
  id?: string;
  time?: string | null;
  kind?: string | null;
  title?: string | null;
  participant?: string | null;
  description?: string | null;
  day?: string | null;
}

interface PublicEvent {
  id: string;
  title: string;
  categoryLabel?: string | null;
  description: string;
  organizer?: { id?: string; name: string; avatar?: string | null } | null;
  posterUrl: string | null;
  dateFormatted: string;
  time: string;
  /** Fin lisible (« jusqu’à 23:00 », « jusqu’au samedi 14 novembre à 02:00 »), absente sans date de fin saisie. */
  endFormatted?: string;
  venue: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  purchasable: boolean;
  banner: { kind: BannerKind; title: string; message: string } | null;
  cancellation?: { publicNotice: string; cancelledAt: string; refundInfo: string };
  isFullySoldOut: boolean;
  /** Une catégorie a des places retenues par un paiement en cours (elles peuvent se libérer). */
  hasHeldSeats?: boolean;
  /** Toutes les ventes en ligne sont closes. */
  salesEnded?: boolean;
  program: ProgramItem[];
  practicalInfo?: {
    address?: string | null;
    accessNotes?: string | null;
    parking?: string | null;
    contactPhone?: string | null;
    /** Lot 9 ter (R96) : numéro E.164 du lien d'appel, null pour une ancienne saisie libre. */
    contactPhoneTel?: string | null;
    rules?: string | null;
  } | null;
  categories: PublicCategory[];
}

/** Devis serveur du panier courant (clé = panier et prix affichés au moment de la demande). */
type QuoteState =
  | { kind: 'idle' }
  | { kind: 'loading'; key: string }
  | { kind: 'ready'; key: string; quote: CheckoutQuote }
  | { kind: 'error'; key: string; message: string };

type Phase = 'loading' | 'ready' | 'not-found' | 'error';

const BANNER_TONE: Record<BannerKind, StatusBannerTone> = {
  SUSPENDU: 'suspended',
  ANNULE: 'danger',
  TERMINE: 'neutral',
};

const PROGRAM_KIND_LABEL: Record<string, string> = {
  ARTISTE: 'Artiste',
  INTERVENANT: 'Intervenant',
  ACTIVITE: 'Activité',
};

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';
/** R104 (B91) : panier gardé le temps d'une connexion (sessionStorage, propre à l'onglet). */
const CART_KEY_PREFIX = 'ev-cart:';
const CART_TTL_MS = 30 * 60 * 1000;
const PAYMENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lignes du panier d'un paiement à reprendre (« Réessayer le paiement », ?reprise=<paiement>) : champ items
 * de GET /api/payments/<id>/status ; null si la réponse ne respecte pas le contrat.
 */
function readRetryItems(body: unknown): Array<{ categoryId: string; quantity: number }> | null {
  if (!isRecord(body) || !Array.isArray(body.items)) return null;
  return body.items.flatMap((raw: unknown) => {
    if (!isRecord(raw)) return [];
    const categoryId = nonEmptyString(raw.category_id);
    const quantity = readAmount(raw.quantity);
    return categoryId && quantity !== null && quantity > 0 ? [{ categoryId, quantity: Math.floor(quantity) }] : [];
  });
}

/** Garde la sélection avant le passage par la connexion ; stockage indisponible : journalisé, la page continue. */
function saveCart(eventId: string, cart: Record<string, number>): void {
  if (Object.keys(cart).length === 0) return;
  try {
    sessionStorage.setItem(`${CART_KEY_PREFIX}${eventId}`, JSON.stringify({ at: Date.now(), cart }));
  } catch (err) {
    console.warn('[événement] panier non gardé (stockage du navigateur indisponible) :', err instanceof Error ? err.message : String(err));
  }
}

/** Relit et efface la sélection gardée ; null si absente, illisible ou plus vieille que 30 minutes. */
function takeSavedCart(eventId: string): Record<string, number> | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(`${CART_KEY_PREFIX}${eventId}`);
    if (raw !== null) sessionStorage.removeItem(`${CART_KEY_PREFIX}${eventId}`);
  } catch (err) {
    console.warn('[événement] panier gardé illisible (stockage du navigateur indisponible) :', err instanceof Error ? err.message : String(err));
    return null;
  }
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!isRecord(saved) || typeof saved.at !== 'number' || !isRecord(saved.cart)) return null;
    if (Date.now() - saved.at > CART_TTL_MS) return null;
    const cart: Record<string, number> = {};
    for (const [categoryId, qty] of Object.entries(saved.cart)) {
      if (typeof qty === 'number' && Number.isInteger(qty) && qty > 0) cart[categoryId] = qty;
    }
    return cart;
  } catch (err) {
    console.warn('[événement] panier gardé illisible :', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Tranche de stock et état de la vente d'une formule, en mots (la couleur ne porte jamais seule le sens). */
function availabilityOf(cat: PublicCategory): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (cat.availability === 'SOLD_OUT') return { label: 'Complet', tone: 'danger' };
  if (!cat.saleStarted) {
    return { label: cat.saleStart ? `Vente à partir du ${formatDateTime(cat.saleStart)}` : 'Bientôt en vente', tone: 'neutral' };
  }
  if (cat.saleEnded) return { label: 'Vente terminée', tone: 'neutral' };
  if (cat.availability === 'LOW' && cat.remainingHint !== null) {
    return { label: cat.remainingHint > 1 ? `Plus que ${cat.remainingHint} places` : 'Plus qu’une place', tone: 'warning' };
  }
  return { label: 'Disponible', tone: 'success' };
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function priceLabel(price: number): string {
  return price === 0 ? 'Gratuit' : formatFcfa(price);
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || 'EV';
}

function readPublicEvent(body: unknown): PublicEvent | null {
  if (typeof body !== 'object' || body === null) return null;
  const event = (body as { event?: unknown }).event;
  if (typeof event !== 'object' || event === null) return null;
  const e = event as Partial<PublicEvent>;
  if (typeof e.id !== 'string' || typeof e.title !== 'string' || typeof e.purchasable !== 'boolean') return null;
  return {
    ...(e as PublicEvent),
    categories: Array.isArray(e.categories) ? e.categories : [],
    program: Array.isArray(e.program) ? e.program : [],
    banner: e.banner ?? null,
  };
}

function PageSkeleton() {
  return (
    <div className="space-y-6 pb-24 lg:pb-12" aria-busy="true" aria-label="Chargement de l’événement">
      <div className="h-11 w-48 rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="aspect-[16/9] w-full rounded-3xl bg-surface-sunken motion-safe:animate-pulse" />
          <div className="h-9 w-3/4 rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="h-20 rounded-2xl bg-surface-sunken motion-safe:animate-pulse" />
            <div className="h-20 rounded-2xl bg-surface-sunken motion-safe:animate-pulse" />
          </div>
          <div className="h-40 rounded-3xl bg-surface-sunken motion-safe:animate-pulse" />
        </div>
        <div className="h-96 rounded-3xl bg-surface-sunken motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

/** URL d'un événement inexistant ou non public (brouillon, en attente, validé) : page 404 propre. */
function EventNotFound() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-lg flex-col items-center justify-center gap-4 px-2 pb-24 text-center lg:pb-12">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-bg text-brand-fg" aria-hidden="true">
        <SearchX size={32} />
      </span>
      <p className="text-sm font-semibold text-fg-muted">Erreur 404</p>
      <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">Événement introuvable</h1>
      <p className="text-base leading-relaxed text-fg-muted">
        Cet événement n’existe pas ou n’est pas ouvert au public. Vérifiez le lien reçu, ou parcourez les événements à venir.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <LinkButton href="/explore" leftIcon={<Compass size={18} />}>
          Voir les événements
        </LinkButton>
        <LinkButton href="/" variant="secondary">
          Retour à l’accueil
        </LinkButton>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-surface p-4">
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-fg-muted">{label}</p>
        <div className="break-words text-base font-semibold text-fg">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-3xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-fg">
        {icon && <span className="text-brand-fg" aria-hidden="true">{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}

function PracticalRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-fg-muted" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-fg">{label}</p>
        <div className="whitespace-pre-line break-words text-sm leading-relaxed text-fg-muted">{children}</div>
      </div>
    </div>
  );
}

const AVAILABILITY_TEXT: Record<'success' | 'warning' | 'danger' | 'neutral', string> = {
  success: 'text-success-fg',
  warning: 'text-warning-fg',
  danger: 'text-danger-fg',
  neutral: 'text-fg-muted',
};

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const toast = useToast();
  const { isAuthenticated, isLoading: isAuthLoading, session } = useAuth();
  const eventId = params.id;

  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  // La modale (module chargé à la demande) n'est montée qu'à la première ouverture.
  const [paymentRequested, setPaymentRequested] = useState(false);
  // Relecture du bandeau « paiement déjà en attente » (fermeture de la modale).
  const [pendingRefresh, setPendingRefresh] = useState(0);
  const repriseDoneRef = useRef(false);
  const savedCartDoneRef = useRef(false);
  const [isClaimingFree, setIsClaimingFree] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  // Clé d'idempotence du panier gratuit : conservée tant que le panier et l'issue incertaine ne changent pas.
  const freeCheckoutAttempt = useIdempotencyKey();

  // ── Chargement de la fiche publique ──────────────────────────────────────

  /**
   * « initial » (premier affichage, « Réessayer ») : un échec affiche l'état d'erreur. « silent » (signal
   * temps réel, reconnexion, stock changé) : la fiche reste affichée, l'échec est signalé par un bandeau.
   * 404 : page introuvable dans les deux cas.
   */
  const loadEvent = useCallback(async (mode: 'initial' | 'silent') => {
    let res: Response;
    try {
      res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, { cache: 'no-store' });
    } catch (err) {
      console.error('[événement] fiche injoignable :', err instanceof Error ? err.message : String(err));
      if (mode === 'initial') {
        setLoadError(NETWORK_MESSAGE);
        setPhase('error');
      } else {
        setRefreshError(NETWORK_MESSAGE);
      }
      return;
    }
    if (res.status === 404) {
      setEvent(null);
      setPhase('not-found');
      return;
    }
    const body = await readJsonBody(res, 'événement/fiche');
    const parsed = res.ok ? readPublicEvent(body) : null;
    if (!parsed) {
      const message = serverErrorMessage(body) ?? (res.ok ? 'Réponse inattendue du serveur.' : `L’événement n’a pas pu être chargé (erreur ${res.status}).`);
      if (mode === 'initial') {
        setLoadError(message);
        setPhase('error');
      } else {
        setRefreshError(message);
      }
      return;
    }
    setEvent(parsed);
    setLoadError(null);
    setRefreshError(null);
    setPhase('ready');
  }, [eventId]);

  const refreshEvent = useCallback(() => loadEvent('silent'), [loadEvent]);

  useEffect(() => {
    void loadEvent('initial');
  }, [loadEvent]);

  // Temps réel (contrats O1 et O3) : résumé public de l'événement (statut, dates, lieu, prix) et stock en
  // tranches de ses catégories ; chaque signal recharge la fiche publique. Aucun abonnement aux lignes de
  // vente (ticket_categories, billets, paiements).
  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: `evenement-public-${eventId}`,
    subscriptions: [
      { table: 'public_event_state', filter: `event_id=eq.${eventId}` },
      { table: 'public_category_stock', filter: `event_id=eq.${eventId}` },
    ],
    onSignal: refreshEvent,
    enabled: Boolean(eventId) && phase !== 'not-found',
  });

  // La fiche a changé (stock, statut) : le panier ne garde que les formules encore achetables, dans la limite.
  useEffect(() => {
    if (!event) return;
    setCart((prev) => {
      if (!event.purchasable) return Object.keys(prev).length === 0 ? prev : {};
      let changed = false;
      const next: Record<string, number> = {};
      for (const [categoryId, qty] of Object.entries(prev)) {
        const cat = event.categories.find((c) => c.id === categoryId);
        const limit = cat && cat.isAvailable ? Math.min(cat.maxPerOrder || 10, cat.remainingHint ?? Number.POSITIVE_INFINITY) : 0;
        const kept = Math.min(qty, limit);
        if (kept !== qty) changed = true;
        if (kept > 0) next[categoryId] = kept;
      }
      return changed ? next : prev;
    });
  }, [event]);

  // « Réessayer le paiement » (/paiement/<id> → /events/<id>?reprise=<paiement>) : le panier du paiement échoué
  // est prérempli, dans la limite de ce qui est encore achetable. Une seule fois par chargement de page.
  useEffect(() => {
    if (repriseDoneRef.current || phase !== 'ready' || !event || isAuthLoading) return;
    repriseDoneRef.current = true;
    const reprise = new URLSearchParams(window.location.search).get('reprise');
    if (!reprise || !PAYMENT_ID_RE.test(reprise) || !isAuthenticated || !event.purchasable) return;
    void (async () => {
      try {
        const res = await fetch(`/api/payments/${reprise}/status`, { cache: 'no-store' });
        const body = await readJsonBody(res, 'événement/reprise');
        const items = res.ok ? readRetryItems(body) : null;
        if (!items) {
          console.error(`[événement] panier à reprendre illisible (HTTP ${res.status}) :`, body);
          toast.error('Le panier précédent n’a pas pu être repris : choisissez à nouveau vos billets.');
          return;
        }
        const next: Record<string, number> = {};
        let reduced = false;
        for (const item of items) {
          const cat = event.categories.find((c) => c.id === item.categoryId);
          const limit = cat && cat.isAvailable ? Math.max(0, Math.min(cat.maxPerOrder || 10, cat.remainingHint ?? Number.POSITIVE_INFINITY)) : 0;
          const kept = Math.min(item.quantity, limit);
          if (kept < item.quantity) reduced = true;
          if (kept > 0) next[item.categoryId] = (next[item.categoryId] ?? 0) + kept;
        }
        if (Object.keys(next).length === 0) {
          toast.error('Les billets de votre panier précédent ne sont plus disponibles.');
          return;
        }
        setCart(next);
        toast.info(reduced
          ? 'Panier précédent repris en partie (places limitées) : vérifiez-le puis relancez le paiement.'
          : 'Panier précédent repris : vérifiez-le puis relancez le paiement.');
      } catch (err) {
        console.error('[événement] reprise du panier impossible :', err instanceof Error ? err.message : String(err));
        toast.error('Connexion impossible : le panier précédent n’a pas pu être repris.');
      }
    })();
  }, [phase, event, isAuthLoading, isAuthenticated, toast]);

  // R104 (B91) : retour de la connexion avec une sélection gardée (moins de 30 minutes) : elle est rétablie dans la
  // limite de ce qui est encore achetable. Une seule fois par chargement ; la reprise d'un paiement échoué l'emporte.
  useEffect(() => {
    if (savedCartDoneRef.current || phase !== 'ready' || !event) return;
    savedCartDoneRef.current = true;
    const saved = takeSavedCart(eventId);
    if (!saved || !event.purchasable) return;
    if (new URLSearchParams(window.location.search).get('reprise')) return;
    const next: Record<string, number> = {};
    for (const [categoryId, qty] of Object.entries(saved)) {
      const cat = event.categories.find((c) => c.id === categoryId);
      const limit = cat && cat.isAvailable ? Math.max(0, Math.min(cat.maxPerOrder || 10, cat.remainingHint ?? Number.POSITIVE_INFINITY)) : 0;
      const kept = Math.min(qty, limit);
      if (kept > 0) next[categoryId] = kept;
    }
    if (Object.keys(next).length === 0) {
      toast.info('Les billets choisis avant la connexion ne sont plus disponibles.');
      return;
    }
    setCart(next);
    toast.info('Votre sélection est reprise : vérifiez-la puis continuez.');
  }, [phase, event, eventId, toast]);

  const retry = async () => {
    setIsRetrying(true);
    try {
      await loadEvent('initial');
    } finally {
      setIsRetrying(false);
    }
  };

  // ── Panier et devis serveur ──────────────────────────────────────────────

  const categories = event?.categories ?? [];

  const limitFor = (cat: PublicCategory): number => Math.max(0, Math.min(cat.maxPerOrder || 10, cat.remainingHint ?? Number.POSITIVE_INFINITY));

  const updateCartQty = (categoryId: string, delta: number) => {
    setCart((prev) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat || !cat.isAvailable) return prev;
      const current = prev[categoryId] || 0;
      const next = Math.max(0, Math.min(limitFor(cat), current + delta));
      if (next === 0) {
        const { [categoryId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [categoryId]: next };
    });
  };

  const cartItems = Object.entries(cart)
    .map(([catId, qty]) => {
      const cat = categories.find((c) => c.id === catId);
      return cat ? { ...cat, qty } : null;
    })
    .filter((item): item is PublicCategory & { qty: number } => item !== null);

  // Nombre de billets du panier (quantités choisies) ; les montants viennent du devis serveur.
  const cartTotalQty = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const hasPaidItems = cartItems.some((item) => (item.price || 0) > 0);
  const hasFreeOnly = cartTotalQty > 0 && !hasPaidItems;

  // Empreinte du panier (catégories, quantités et prix affichés) : un devis ne vaut que pour elle.
  const cartKey = cartItems
    .map((item) => `${item.id}:${item.qty}:${item.price ?? 0}`)
    .sort()
    .join('|');
  const [quoteState, setQuoteState] = useState<QuoteState>({ kind: 'idle' });
  const [quoteRetry, setQuoteRetry] = useState(0);

  useEffect(() => {
    if (!eventId || !hasPaidItems) {
      setQuoteState({ kind: 'idle' });
      return;
    }
    const key = cartKey;
    // Corps de la demande reconstruit depuis l'empreinte (identifiant:quantité:prix affiché).
    const items = key.split('|').map((part) => {
      const [categoryId, quantity] = part.split(':');
      return { categoryId, quantity: Number(quantity) };
    });
    const controller = new AbortController();
    setQuoteState({ kind: 'loading', key });
    // Court délai : plusieurs clics « + » ne déclenchent qu'une demande de devis.
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/checkout/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, items }),
          signal: controller.signal,
        });
        const body = await readJsonBody(res, 'événement/devis');
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setQuoteState({
            kind: 'error',
            key,
            message: serverErrorMessage(body) ?? `Le total n’a pas pu être calculé (erreur ${res.status}).`,
          });
          return;
        }
        const quote = readCheckoutQuote(body);
        if (!quote) {
          console.error('[événement] devis illisible :', body);
          setQuoteState({ kind: 'error', key, message: 'Réponse inattendue du serveur pour le calcul du total.' });
          return;
        }
        setQuoteState({ kind: 'ready', key, quote });
      } catch (err) {
        // Demande remplacée par un panier plus récent : son résultat ne sert plus.
        if (controller.signal.aborted) return;
        console.error('[événement] devis impossible :', err);
        setQuoteState({ kind: 'error', key, message: 'Connexion impossible : le total n’a pas pu être calculé.' });
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [eventId, cartKey, hasPaidItems, quoteRetry]);

  const quote = quoteState.kind === 'ready' && quoteState.key === cartKey ? quoteState.quote : null;
  const quoteLoading = hasPaidItems && !quote && (quoteState.kind === 'loading' || quoteState.kind === 'idle');
  const quoteError = hasPaidItems && quoteState.kind === 'error' && quoteState.key === cartKey ? quoteState.message : null;
  const quoteLineFor = (categoryId: string) => quote?.lines.find((line) => line.categoryId === categoryId) ?? null;

  // ── États de la page ─────────────────────────────────────────────────────

  if (phase === 'loading') return <PageSkeleton />;
  if (phase === 'not-found') return <EventNotFound />;
  if (phase === 'error' || !event) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <ErrorState
          title="Impossible d’afficher l’événement"
          description={loadError ?? NETWORK_MESSAGE}
          onRetry={() => void retry()}
          isRetrying={isRetrying}
        />
        <div className="flex justify-center">
          <LinkButton href="/explore" variant="ghost" leftIcon={<ArrowLeft size={18} />}>
            Retour aux événements
          </LinkButton>
        </div>
      </div>
    );
  }

  // ── Achat ────────────────────────────────────────────────────────────────

  const handleBuyClick = async () => {
    if (!event.purchasable) return;
    if (!isAuthenticated) {
      toast.error('Connectez-vous pour acheter un billet.');
      saveCart(eventId, cart);
      router.push(`/login?redirect=${encodeURIComponent(`/events/${eventId}`)}`);
      return;
    }
    if (cartTotalQty === 0) return;

    // Panier entièrement gratuit : /api/checkout émet les billets tout de suite, sans opérateur.
    if (hasFreeOnly) {
      if (isClaimingFree) return;
      const payload = {
        eventId,
        items: cartItems.map((item) => ({ categoryId: item.id, quantity: item.qty })),
      };
      const idempotencyKey = freeCheckoutAttempt.keyFor(JSON.stringify(payload));
      setIsClaimingFree(true);
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        const body = await readJsonBody(res, 'événement/checkout');

        if (res.ok) {
          const isFreeConfirmation = typeof body === 'object' && body !== null && (body as { free?: unknown }).free === true;
          if (!isFreeConfirmation) {
            // Issue incertaine : la clé est conservée, un nouvel essai ne dupliquera pas les billets.
            console.error('[événement] réponse inattendue du checkout gratuit :', body);
            toast.error('Réponse inattendue du serveur. Patientez un instant puis réessayez.');
            return;
          }
          freeCheckoutAttempt.reset();
          toast.success(cartTotalQty > 1 ? `${cartTotalQty} billets gratuits réservés.` : 'Billet gratuit réservé.');
          router.push('/tickets');
          return;
        }

        const failure = readPaymentError(res.status, body);
        if (!isUncertainOutcome(res.status)) freeCheckoutAttempt.reset();
        if (res.status === 401) {
          toast.error(failure.message);
          saveCart(eventId, cart);
          router.push(`/login?redirect=${encodeURIComponent(`/events/${eventId}`)}`);
          return;
        }
        if (failure.code === 'OPERATOR_REQUIRED') {
          // Le serveur a calculé un montant à payer : les prix affichés n'étaient plus à jour.
          toast.error('Le prix de ce panier a changé : vérifiez le récapitulatif puis relancez.');
          void refreshEvent();
          return;
        }
        toast.error(
          failure.problems.length > 0
            ? failure.problems
                .map((problem) => {
                  const name = cartItems.find((item) => item.id === problem.categoryId)?.name;
                  return name ? `${name} : ${problem.message}` : problem.message;
                })
                .join(' ')
            : failure.message,
        );
        if (failure.code === 'INSUFFICIENT_STOCK' || failure.code === 'SALE_CHECK_FAILED') {
          void refreshEvent();
        }
      } catch (err) {
        // Issue incertaine : la clé est conservée pour le prochain essai.
        console.error('[événement] réservation gratuite impossible :', err);
        toast.error(NETWORK_MESSAGE);
      } finally {
        setIsClaimingFree(false);
      }
      return;
    }

    // Panier avec au moins un billet payant : PaymentModal envoie TOUT le panier (gratuits compris,
    // émis à la confirmation du paiement). Le total affiché est celui du devis serveur à jour.
    if (!quote) {
      toast.error(quoteError ?? 'Calcul du total en cours : patientez un instant.');
      return;
    }
    setPaymentRequested(true);
    setIsPaymentOpen(true);
  };

  const buyLabel = (compact: boolean): string => {
    if (isClaimingFree) return 'Réservation en cours…';
    const plural = cartTotalQty > 1 ? 's' : '';
    if (hasFreeOnly) return compact ? `Réserver (${cartTotalQty})` : `Réserver ${cartTotalQty} billet${plural} gratuit${plural}`;
    if (quote) return compact ? `Acheter (${formatFcfa(quote.totalAmount)})` : `Acheter ${cartTotalQty} billet${plural} (${formatFcfa(quote.totalAmount)})`;
    if (quoteError) return 'Total indisponible';
    return 'Calcul du total…';
  };
  const buyBlocked = hasPaidItems && !quote;

  const share = async () => {
    const url = window.location.href;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: event.title, url });
      } catch (err) {
        // Partage annulé par l'utilisateur : rien à signaler ; toute autre erreur est affichée.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('[événement] partage impossible :', err);
        toast.error('Le partage n’a pas abouti. Copiez l’adresse de la page.');
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien de l’événement copié.');
    } catch (err) {
      console.error('[événement] copie du lien impossible :', err);
      toast.error('Le lien n’a pas pu être copié. Copiez l’adresse de la page.');
    }
  };

  const showMobileBar = event.purchasable && cartTotalQty > 0;
  const place = [event.venue, event.city].filter(Boolean).join(', ');
  const info = event.practicalInfo ?? null;
  const program = event.program.filter((item) => item && item.title);
  const hasCoordinates = typeof event.latitude === 'number' && typeof event.longitude === 'number';

  // ── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className={cn('space-y-6', showMobileBar ? 'pb-48 lg:pb-12' : 'pb-24 lg:pb-12')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LinkButton href="/explore" variant="ghost" size="sm" leftIcon={<ArrowLeft size={18} />} className="-ml-3">
          Retour aux événements
        </LinkButton>
        <div className="flex items-center gap-2">
          {/* Événement suspendu, annulé ou terminé : « En direct » (le canal temps réel) se lisait comme
              « l'événement a lieu en ce moment » (relecture du run 77). La page reste abonnée ; seuls
              « Connexion… » et « Hors ligne » restent affichés. */}
          {!(event.banner && liveStatus === 'live') && <LiveIndicator status={liveStatus} />}
          <IconButton aria-label="Partager l’événement" variant="secondary" onClick={() => void share()}>
            <Share2 size={18} />
          </IconButton>
        </div>
      </div>

      {event.banner && (
        <StatusBanner tone={BANNER_TONE[event.banner.kind]} title={event.banner.title}>
          <p>{event.banner.message}</p>
          {event.cancellation && (
            <div className="mt-3 space-y-1 rounded-xl border border-danger-border bg-surface p-3 text-fg">
              <p className="font-semibold">Message de l’organisateur</p>
              <p className="whitespace-pre-line">{event.cancellation.publicNotice}</p>
              <p className="text-fg-muted">
                Annulé le <time dateTime={event.cancellation.cancelledAt}>{formatDateTime(event.cancellation.cancelledAt)}</time>
              </p>
            </div>
          )}
        </StatusBanner>
      )}

      {isAuthenticated && (
        <PendingPaymentBanner eventId={eventId} enabled={isAuthenticated} refreshKey={pendingRefresh} />
      )}

      {refreshError && (
        <StatusBanner
          tone="warning"
          announce="alert"
          title="La page n’a pas pu être mise à jour"
          action={(
            <Button variant="secondary" size="sm" onClick={() => void refreshEvent()} leftIcon={<RefreshCw size={16} />}>
              Réessayer
            </Button>
          )}
        >
          {refreshError} Les informations affichées sont celles du dernier chargement.
        </StatusBanner>
      )}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-border bg-surface-sunken shadow-sm">
            <Image
              src={eventImageSrc(event.posterUrl)}
              alt={`Affiche de l’événement ${event.title}`}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 66vw"
            />
          </div>

          <header className="space-y-3">
            {event.categoryLabel && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brand">{event.categoryLabel}</Badge>
              </div>
            )}
            <h1 className="break-words text-3xl font-bold leading-tight tracking-tight text-fg sm:text-4xl">{event.title}</h1>
            {event.organizer?.name && (
              <p className="text-base text-fg-muted">
                Organisé par <span className="font-semibold text-fg">{event.organizer.name}</span>
              </p>
            )}
          </header>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoTile icon={<CalendarDays size={20} />} label="Date et heure">
              {capitalize(event.dateFormatted)} à&nbsp;{event.time}
              {event.endFormatted && (
                <span className="block text-sm font-normal text-fg-muted">{capitalize(event.endFormatted)}</span>
              )}
            </InfoTile>
            <InfoTile icon={<MapPin size={20} />} label="Lieu">
              {place}
            </InfoTile>
          </div>

          <Section title="À propos de l’événement">
            <p className="whitespace-pre-line break-words text-base leading-relaxed text-fg-muted">{event.description}</p>
          </Section>

          {program.length > 0 && (
            <Section title="Programme" icon={<CalendarDays size={20} />}>
              <ol className="space-y-4 border-l-2 border-border pl-5">
                {program.map((item, idx) => (
                  <li key={item.id || `${item.time ?? ''}-${idx}`} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-brand" aria-hidden="true" />
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      {(item.day || item.time) && (
                        <p className="text-sm font-semibold tabular-nums text-brand-fg">
                          {[item.day ? formatDate(item.day) : null, item.time].filter(Boolean).join(' à ')}
                        </p>
                      )}
                      {item.kind && PROGRAM_KIND_LABEL[item.kind] && (
                        <Badge variant="neutral" size="sm">{PROGRAM_KIND_LABEL[item.kind]}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-base font-semibold text-fg">{item.title}</p>
                    {item.participant && <p className="text-sm text-fg">{item.participant}</p>}
                    {item.description && <p className="mt-0.5 text-sm leading-relaxed text-fg-muted">{item.description}</p>}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {(hasCoordinates || info?.address || info?.accessNotes || info?.parking || info?.contactPhone || info?.rules) && (
            <Section title="Lieu et accès" icon={<MapPin size={20} />}>
              <div>
                <p className="text-base font-semibold text-fg">{event.venue}</p>
                {info?.address && <p className="text-sm text-fg-muted">{info.address}</p>}
              </div>

              {hasCoordinates && (
                <>
                  <EventMapWhenVisible latitude={event.latitude as number} longitude={event.longitude as number} venueName={event.venue} />
                  <LinkButton
                    href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`}
                    external
                    variant="secondary"
                    leftIcon={<Navigation size={18} />}
                    rightIcon={<ExternalLink size={16} />}
                  >
                    Voir l’itinéraire
                  </LinkButton>
                </>
              )}

              {(info?.accessNotes || info?.parking || info?.contactPhone || info?.rules) && (
                <div className="space-y-4 border-t border-border pt-4">
                  {info?.accessNotes && (
                    <PracticalRow icon={<Bus size={18} />} label="Accès et transports">{info.accessNotes}</PracticalRow>
                  )}
                  {info?.parking && (
                    <PracticalRow icon={<Car size={18} />} label="Stationnement">{info.parking}</PracticalRow>
                  )}
                  {info?.contactPhone && (
                    <PracticalRow icon={<Phone size={18} />} label="Contact de l’organisateur">
                      <a
                        href={`tel:${info.contactPhoneTel ?? info.contactPhone.replace(/\s+/g, '')}`}
                        className="inline-flex min-h-11 items-center font-semibold text-brand-fg underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {info.contactPhone}
                      </a>
                    </PracticalRow>
                  )}
                  {info?.rules && (
                    <PracticalRow icon={<ClipboardList size={18} />} label="Règlement et consignes">{info.rules}</PracticalRow>
                  )}
                </div>
              )}
            </Section>
          )}

          {event.organizer?.name && (
            <section className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-5">
              <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-brand-bg text-base font-bold text-brand-fg">
                {isProjectStorageImage(event.organizer.avatar) ? (
                  <Image src={event.organizer.avatar} alt="" fill className="object-cover" sizes="48px" />
                ) : (
                  <span aria-hidden="true">{initialsOf(event.organizer.name)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-fg-muted">Organisateur</p>
                <h2 className="truncate text-base font-bold text-fg">{event.organizer.name}</h2>
              </div>
            </section>
          )}
        </div>

        {/* Billetterie */}
        <aside aria-labelledby="billetterie-titre" className="min-w-0 space-y-5 rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-6 lg:sticky lg:top-20">
          {event.purchasable ? (
            <>
              <div>
                <h2 id="billetterie-titre" className="text-lg font-bold tracking-tight text-fg">Choisissez vos billets</h2>
                <p className="mt-1 text-sm text-fg-muted">Places et disponibilités mises à jour en direct.</p>
              </div>

              <ul className="space-y-3">
                {categories.map((cat) => {
                  const qty = cart[cat.id] || 0;
                  const limit = limitFor(cat);
                  const avail = availabilityOf(cat);
                  const line = quoteLineFor(cat.id);
                  return (
                    <li
                      key={cat.id}
                      className={cn(
                        'rounded-2xl border-2 p-4 transition-colors duration-200',
                        !cat.isAvailable ? 'border-border bg-surface-sunken' : qty > 0 ? 'border-brand-fg bg-brand-bg' : 'border-border',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-base font-semibold text-fg">{cat.name}</h3>
                          <p className="text-base font-bold tabular-nums text-fg">{priceLabel(cat.price)}</p>
                          <p className={cn('mt-0.5 text-sm font-medium', AVAILABILITY_TEXT[avail.tone])}>{avail.label}</p>
                          {cat.description && <p className="mt-1 text-sm leading-relaxed text-fg-muted">{cat.description}</p>}
                        </div>
                        {cat.isAvailable && (
                          <div className="flex flex-shrink-0 items-center gap-2" role="group" aria-label={`Quantité ${cat.name}`}>
                            <IconButton
                              aria-label={`Retirer un billet ${cat.name}`}
                              variant="secondary"
                              onClick={() => updateCartQty(cat.id, -1)}
                              disabled={qty <= 0}
                            >
                              <Minus size={18} />
                            </IconButton>
                            <output className="w-7 text-center text-base font-bold tabular-nums text-fg" aria-live="polite">
                              {qty}
                            </output>
                            <IconButton
                              aria-label={`Ajouter un billet ${cat.name}`}
                              variant="secondary"
                              onClick={() => updateCartQty(cat.id, 1)}
                              disabled={qty >= limit}
                            >
                              <Plus size={18} />
                            </IconButton>
                          </div>
                        )}
                      </div>
                      {qty > 0 && cat.price > 0 && (
                        <p className="mt-2 text-sm tabular-nums text-fg-muted">
                          {qty} × {priceLabel(cat.price)}
                          {line ? ` : ${formatFcfa(line.lineFacial)}` : ''}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>

              {cartTotalQty > 0 ? (
                <div className="space-y-3 border-t border-border pt-4">
                  {hasPaidItems && (
                    <dl className="space-y-1.5 text-sm" aria-busy={quoteLoading || undefined}>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-fg-muted">Billets</dt>
                        <dd className="whitespace-nowrap font-semibold tabular-nums text-fg">
                          {quote ? formatFcfa(quote.facialAmount) : <span className="inline-block h-4 w-16 rounded bg-surface-sunken align-middle motion-safe:animate-pulse" aria-hidden="true" />}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-fg-muted">Frais de service</dt>
                        <dd className="whitespace-nowrap font-semibold tabular-nums text-fg">
                          {quote ? formatFcfa(quote.serviceFee) : <span className="inline-block h-4 w-12 rounded bg-surface-sunken align-middle motion-safe:animate-pulse" aria-hidden="true" />}
                        </dd>
                      </div>
                    </dl>
                  )}
                  <div className="flex items-baseline justify-between gap-3" aria-live="polite">
                    <span className="text-sm font-semibold text-fg-muted">
                      Total ({cartTotalQty} billet{cartTotalQty > 1 ? 's' : ''})
                    </span>
                    <span className={cn('text-xl font-bold tabular-nums', hasFreeOnly ? 'text-success-fg' : 'text-fg')}>
                      {hasFreeOnly ? 'Gratuit' : quote ? formatFcfa(quote.totalAmount) : quoteError ? '—' : (
                        <>
                          <span className="sr-only">Calcul du total en cours…</span>
                          <span className="inline-block h-6 w-24 rounded-lg bg-surface-sunken align-middle motion-safe:animate-pulse" aria-hidden="true" />
                        </>
                      )}
                    </span>
                  </div>

                  {quoteError && (
                    <StatusBanner
                      tone="danger"
                      announce="alert"
                      title="Total indisponible"
                      action={(
                        <Button variant="secondary" size="sm" onClick={() => setQuoteRetry((n) => n + 1)} leftIcon={<RefreshCw size={16} />}>
                          Réessayer
                        </Button>
                      )}
                    >
                      {quoteError}
                    </StatusBanner>
                  )}

                  <Button
                    variant="primary"
                    size="lg"
                    fullWidth
                    disabled={isClaimingFree || buyBlocked}
                    isLoading={isClaimingFree}
                    onClick={() => void handleBuyClick()}
                    leftIcon={<Ticket size={18} />}
                  >
                    {buyLabel(false)}
                  </Button>
                  {hasPaidItems && (
                    <p className="text-center text-sm leading-relaxed text-fg-muted">
                      Paiement Wave ou Orange Money. Frais de service calculés par Event Village sur chaque billet.
                    </p>
                  )}
                  <p className="flex items-center justify-center gap-2 text-sm text-fg-muted">
                    <ShieldCheck size={16} className="flex-shrink-0 text-success-fg" aria-hidden="true" />
                    Billet avec QR code émis dès le paiement
                  </p>
                </div>
              ) : (
                <p className="border-t border-border pt-4 text-sm text-fg-muted">
                  Choisissez au moins un billet avec le bouton « + ».
                </p>
              )}
            </>
          ) : (
            <>
              <div>
                <h2 id="billetterie-titre" className="text-lg font-bold tracking-tight text-fg">Billetterie</h2>
                <p className="mt-1 text-sm text-fg-muted">
                  {event.banner
                    ? 'La vente de billets est fermée pour cet événement.'
                    : event.salesEnded
                      ? 'La vente en ligne est terminée pour cet événement.'
                      : event.isFullySoldOut
                        ? (event.hasHeldSeats
                          ? 'Toutes les places sont vendues ou en cours de paiement. Des places peuvent se libérer : cette page se met à jour d’elle-même.'
                          : 'Toutes les places ont été vendues.')
                        : 'Aucune catégorie n’est en vente pour le moment. Revenez bientôt : cette page se met à jour d’elle-même.'}
                </p>
              </div>

              {event.cancellation && (
                <div className="space-y-3 rounded-2xl border border-info-border bg-info-bg p-4 text-info-fg">
                  <p className="flex items-center gap-2 text-base font-semibold">
                    <Undo2 size={18} aria-hidden="true" />
                    Remboursement
                  </p>
                  <p className="text-sm leading-relaxed">{event.cancellation.refundInfo}</p>
                  <LinkButton href="/tickets" variant="secondary" size="sm">
                    Voir mes billets
                  </LinkButton>
                </div>
              )}

              {categories.length > 0 && (
                <ul className="space-y-2" aria-label="Formules">
                  {categories.map((cat) => {
                    const avail = availabilityOf(cat);
                    return (
                      <li key={cat.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface-sunken p-4">
                        <div className="min-w-0">
                          <p className="break-words text-base font-semibold text-fg">{cat.name}</p>
                          {!event.banner && <p className={cn('text-sm font-medium', AVAILABILITY_TEXT[avail.tone])}>{avail.label}</p>}
                        </div>
                        <p className="whitespace-nowrap text-base font-bold tabular-nums text-fg">{priceLabel(cat.price)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}

              <LinkButton href="/explore" variant="secondary" fullWidth leftIcon={<Compass size={18} />}>
                Voir d’autres événements
              </LinkButton>
            </>
          )}
        </aside>
      </div>

      {/* Barre d'achat mobile, collée à la barre de navigation du bas : 53 px (bordure 1, marge haute 4, liens 48) plus
          la zone sûre, que .safe-bottom ajoute à la navigation (AppLayout). Hauteur relevée sur la capture du run 98. */}
      {showMobileBar && (
        <div className="fixed inset-x-0 bottom-[calc(3.3125rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface px-4 py-3 shadow-lg lg:hidden">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={isClaimingFree || buyBlocked}
            isLoading={isClaimingFree}
            onClick={() => void handleBuyClick()}
            leftIcon={<Ticket size={18} />}
          >
            {buyLabel(true)}
          </Button>
        </div>
      )}

      {/* Paiement Mobile Money — panier complet (payants et gratuits) via /api/checkout */}
      {paymentRequested && (
        <PaymentModal
          isOpen={isPaymentOpen && event.purchasable}
          onClose={() => {
            setIsPaymentOpen(false);
            setPendingRefresh((n) => n + 1);
          }}
          eventId={eventId}
          checkoutItems={cartItems.map((item) => ({ categoryId: item.id, quantity: item.qty, label: item.name }))}
          quote={quote}
          title={`${event.title} (${cartItems.map((item) => `${item.qty} × ${item.name}`).join(' + ')})`}
          onPaymentSuccess={() => {
            setIsPaymentOpen(false);
            router.push('/tickets');
          }}
        />
      )}
    </div>
  );
}
