'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Compass, Minus, Plus, RefreshCw, ShieldCheck, Store, Ticket, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
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
import { formatDateTime, formatFcfa } from '@/lib/format';
import {
  fromPriceLabel,
  nextSaleBoundary,
  priceLabel,
  readPublicEventDetail,
  refundRuleApplies,
  type PublicCategory,
  type PublicEventDetail,
} from '@/lib/events/event-detail';
import { CATEGORY_STRIPE, CATEGORY_STRIPE_NONE } from './category-colors';
import { onPending, requestPendingRefresh, TICKETS_AFTER_PURCHASE } from './signals';

// Lot 7 (7.3, 7.5) : la fenêtre de paiement (formulaire, opérateurs, Modal) n'est chargée qu'au premier « Acheter » ;
// aucune valeur de son module n'est importée statiquement (aides dans lib/payments/payment-client).
const PaymentModal = dynamic(
  () => import('@/components/payment/PaymentModal').then((m) => ({ default: m.PaymentModal })),
  { ssr: false },
);

/**
 * Design 1b (points 6, 7, 11) — billetterie de la fiche : îlot du navigateur posé sur la page préparée par le serveur.
 *
 *  - Rendu serveur avec la fiche publique en cache (aucune session, panier vide) ; dès le chargement, la fiche est relue
 *    sur GET /api/events/[id] (sans cache) par le temps réel (public_event_state et public_category_stock de cet
 *    événement, filtre event_id ; un signal à la connexion), puis à chaque signal et à chaque ouverture ou fin de vente
 *    (nextSaleBoundary). Aucun abonnement aux lignes de vente.
 *  - Catégories en cartes avec leur couleur du contrôle (liseré), prix, disponibilité vraie (« Disponible », « Plus que N
 *    places », « Complet »), quantités ; montants par le devis serveur (/api/checkout/quote), jamais calculés ici.
 *  - Achat seulement si la vente en ligne est ouverte (`purchasable` de la route ; la décision finale reste
 *    ticket_sale_problems au paiement) ; sinon « Billets au guichet sur place » seulement si la route le dit
 *    (`counterSale`, un booléen sans donnée de caisse).
 *  - Ligne « Remboursement » seulement quand une règle vraie s'applique (`refund` : annulation, ou report de plus de 24 h
 *    jusqu'au début de l'événement).
 *  - Barre d'achat fixe sur téléphone dès l'ouverture (« Billetterie / Dès … » + « Choisir mes billets », qui amène aux
 *    catégories), puis le détail, le total et « Acheter (2) » ; place réservée en bas : elle ne masque jamais le contenu.
 *    Un seul grand bouton en dégradé par écran : la barre sur téléphone, le bouton du panneau sur ordinateur.
 *  - Lot 7 (E4) : reprise du panier d'un paiement échoué (?reprise=<paiement>) ; lot 9 bis (R104, B91) : panier gardé
 *    30 minutes dans sessionStorage (`ev-cart:{id}`) le temps d'une connexion, rétabli au retour dans la limite de ce qui
 *    est encore achetable, puis effacé.
 *  - Après un achat réussi (panier gratuit, ou paiement confirmé sur /paiement/<id>) : /tickets?tab=a-venir&fete=1.
 */

type QuoteState =
  | { kind: 'idle' }
  | { kind: 'loading'; key: string }
  | { kind: 'ready'; key: string; quote: CheckoutQuote }
  | { kind: 'error'; key: string; message: string };

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';
const CART_KEY_PREFIX = 'ev-cart:';
const CART_TTL_MS = 30 * 60 * 1000;
const PAYMENT_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readRetryItems(body: unknown): Array<{ categoryId: string; quantity: number }> | null {
  if (!isRecord(body) || !Array.isArray(body.items)) return null;
  return body.items.flatMap((raw: unknown) => {
    if (!isRecord(raw)) return [];
    const categoryId = nonEmptyString(raw.category_id);
    const quantity = readAmount(raw.quantity);
    return categoryId && quantity !== null && quantity > 0 ? [{ categoryId, quantity: Math.floor(quantity) }] : [];
  });
}

function saveCart(eventId: string, cart: Record<string, number>): void {
  if (Object.keys(cart).length === 0) return;
  try {
    sessionStorage.setItem(`${CART_KEY_PREFIX}${eventId}`, JSON.stringify({ at: Date.now(), cart }));
  } catch (err) {
    console.warn('[événement] panier non gardé (stockage du navigateur indisponible) :', err instanceof Error ? err.message : String(err));
  }
}

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

/** Tranche de stock et état de la vente d'une catégorie, en mots (la couleur ne porte jamais seule le sens). */
function availabilityOf(cat: PublicCategory): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (cat.availability === 'SOLD_OUT') return { label: 'Complet', tone: 'danger' };
  if (!cat.saleStarted) {
    return { label: cat.saleStart ? `Vente à partir du ${formatDateTime(cat.saleStart)}` : 'Bientôt en vente', tone: 'neutral' };
  }
  if (cat.saleEnded) return { label: 'Vente en ligne terminée', tone: 'neutral' };
  if (cat.availability === 'LOW' && cat.remainingHint !== null) {
    return { label: cat.remainingHint > 1 ? `Plus que ${cat.remainingHint} places` : 'Plus qu’une place', tone: 'warning' };
  }
  return { label: 'Disponible', tone: 'success' };
}

const AVAILABILITY_TEXT: Record<'success' | 'warning' | 'danger' | 'neutral', string> = {
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
  neutral: 'text-muted-foreground',
};

const limitFor = (cat: PublicCategory): number => Math.max(0, Math.min(cat.maxPerOrder || 10, cat.remainingHint ?? Number.POSITIVE_INFINITY));

function closedMessage(event: PublicEventDetail, ended: boolean): string {
  if (event.banner) return 'La vente de billets est fermée pour cet événement.';
  if (ended) return 'Cet événement est terminé : la billetterie est fermée.';
  if (event.salesEnded) return 'La vente en ligne est terminée pour cet événement.';
  if (event.isFullySoldOut) {
    return event.hasHeldSeats
      ? 'Toutes les places en ligne sont vendues ou en cours de paiement. Des places peuvent se libérer : cette page se met à jour d’elle-même.'
      : 'Toutes les places en ligne ont été vendues.';
  }
  return 'Aucune catégorie n’est en vente en ligne pour le moment. Revenez bientôt : cette page se met à jour d’elle-même.';
}

function CategoryStripe({ cat }: { cat: PublicCategory }) {
  return (
    <span
      aria-hidden="true"
      className={cn('absolute inset-y-0 left-0 w-1.5 ring-1 ring-inset ring-input', cat.scanColor ? CATEGORY_STRIPE[cat.scanColor] : CATEGORY_STRIPE_NONE)}
    />
  );
}

function PayMethods() {
  return (
    <p className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
      <span>Paiement</span>
      <span className="rounded-md bg-op-wave px-2 py-0.5 text-sm font-bold text-on-op">Wave</span>
      <span>ou</span>
      <span className="rounded-md bg-op-orange-money px-2 py-0.5 text-sm font-bold text-on-op">Orange Money</span>
    </p>
  );
}

export function EventTicketing({ initial }: { initial: PublicEventDetail }) {
  const router = useRouter();
  const toast = useToast();
  const { isAuthenticated, isLoading: isAuthLoading, session } = useAuth();
  const eventId = initial.id;

  const [event, setEvent] = useState<PublicEventDetail>(initial);
  const [gone, setGone] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentRequested, setPaymentRequested] = useState(false);
  const [isClaimingFree, setIsClaimingFree] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const repriseDoneRef = useRef(false);
  const savedCartDoneRef = useRef(false);
  const initialStatusRef = useRef(initial.status);
  const freeCheckoutAttempt = useIdempotencyKey();

  // ── Fiche à jour (sans cache) ────────────────────────────────────────────

  const refreshEvent = useCallback(async () => {
    let res: Response;
    try {
      res = await fetch(`/api/events/${encodeURIComponent(eventId)}`, { cache: 'no-store' });
    } catch (err) {
      console.error('[événement] fiche injoignable :', err instanceof Error ? err.message : String(err));
      setRefreshError(NETWORK_MESSAGE);
      return;
    }
    if (res.status === 404) {
      setGone(true);
      return;
    }
    const body = await readJsonBody(res, 'événement/fiche');
    const parsed = res.ok ? readPublicEventDetail(body) : null;
    if (!parsed) {
      console.error(`[événement] fiche illisible (HTTP ${res.status}) :`, body);
      setRefreshError(serverErrorMessage(body) ?? 'Les informations n’ont pas pu être mises à jour.');
      return;
    }
    setEvent(parsed);
    setRefreshError(null);
  }, [eventId]);

  // Temps réel (contrats O1 et O3) : résumé public de l'événement et stock en tranches de ses catégories ; chaque signal
  // (et la connexion du canal) relit la fiche par le serveur.
  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: `evenement-public-${eventId}`,
    subscriptions: [
      { table: 'public_event_state', filter: `event_id=eq.${eventId}` },
      { table: 'public_category_stock', filter: `event_id=eq.${eventId}` },
    ],
    onSignal: refreshEvent,
    enabled: !gone,
  });

  // Ouverture ou fin d'une vente, fin de l'événement : relecture au bon moment, sans attendre un signal.
  useEffect(() => {
    const next = nextSaleBoundary(event, new Date());
    if (!next) return undefined;
    const wait = Math.min(Math.max(1_000, next.getTime() - Date.now() + 1_000), 2_000_000_000);
    const timer = setTimeout(() => void refreshEvent(), wait);
    return () => clearTimeout(timer);
  }, [event, refreshEvent]);

  // Statut changé pendant la consultation (suspendu, annulé…) : la page serveur est relue (bandeau en haut).
  useEffect(() => {
    if (event.status !== initialStatusRef.current) {
      initialStatusRef.current = event.status;
      router.refresh();
    }
  }, [event.status, router]);

  // Heure du téléphone pour la ligne « Remboursement » d'un report (vraie jusqu'au début de l'événement).
  useEffect(() => {
    setNow(Date.now());
    const start = Date.parse(event.startsAt);
    const wait = start - Date.now();
    if (!Number.isFinite(wait) || wait <= 0) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(wait + 250, 2_000_000_000));
    return () => clearTimeout(timer);
  }, [event.startsAt]);

  useEffect(() => onPending(eventId, setPendingPath), [eventId]);

  // La fiche a changé : le panier ne garde que les catégories encore achetables, dans la limite.
  useEffect(() => {
    setCart((prev) => {
      if (!event.purchasable) return Object.keys(prev).length === 0 ? prev : {};
      let changed = false;
      const next: Record<string, number> = {};
      for (const [categoryId, qty] of Object.entries(prev)) {
        const cat = event.categories.find((c) => c.id === categoryId);
        const kept = Math.min(qty, cat && cat.isAvailable ? limitFor(cat) : 0);
        if (kept !== qty) changed = true;
        if (kept > 0) next[categoryId] = kept;
      }
      return changed ? next : prev;
    });
  }, [event]);

  // « Réessayer le paiement » (/paiement/<id> → /events/<id>?reprise=<paiement>) : panier prérempli, une seule fois.
  useEffect(() => {
    if (repriseDoneRef.current || isAuthLoading) return;
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
          const kept = Math.min(item.quantity, cat && cat.isAvailable ? limitFor(cat) : 0);
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
  }, [event, isAuthLoading, isAuthenticated, toast]);

  // R104 (B91) : retour de la connexion avec une sélection gardée (moins de 30 minutes), une seule fois.
  useEffect(() => {
    if (savedCartDoneRef.current) return;
    savedCartDoneRef.current = true;
    const saved = takeSavedCart(eventId);
    if (!saved || !event.purchasable) return;
    if (new URLSearchParams(window.location.search).get('reprise')) return;
    const next: Record<string, number> = {};
    for (const [categoryId, qty] of Object.entries(saved)) {
      const cat = event.categories.find((c) => c.id === categoryId);
      const kept = Math.min(qty, cat && cat.isAvailable ? limitFor(cat) : 0);
      if (kept > 0) next[categoryId] = kept;
    }
    if (Object.keys(next).length === 0) {
      toast.info('Les billets choisis avant la connexion ne sont plus disponibles.');
      return;
    }
    setCart(next);
    toast.info('Votre sélection est reprise : vérifiez-la puis continuez.');
  }, [event, eventId, toast]);

  // ── Panier et devis serveur ──────────────────────────────────────────────

  const categories = event.categories;

  const updateCartQty = (categoryId: string, delta: number) => {
    setCart((prev) => {
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat || !cat.isAvailable) return prev;
      const next = Math.max(0, Math.min(limitFor(cat), (prev[categoryId] || 0) + delta));
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

  const cartTotalQty = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const hasPaidItems = cartItems.some((item) => (item.price || 0) > 0);
  const hasFreeOnly = cartTotalQty > 0 && !hasPaidItems;
  const cartKey = cartItems.map((item) => `${item.id}:${item.qty}:${item.price ?? 0}`).sort().join('|');
  const [quoteState, setQuoteState] = useState<QuoteState>({ kind: 'idle' });
  const [quoteRetry, setQuoteRetry] = useState(0);

  useEffect(() => {
    if (!hasPaidItems) {
      setQuoteState({ kind: 'idle' });
      return undefined;
    }
    const key = cartKey;
    const items = key.split('|').map((part) => {
      const [categoryId, quantity] = part.split(':');
      return { categoryId, quantity: Number(quantity) };
    });
    const controller = new AbortController();
    setQuoteState({ kind: 'loading', key });
    // Court délai : plusieurs « + » ne déclenchent qu'une demande de devis.
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
          setQuoteState({ kind: 'error', key, message: serverErrorMessage(body) ?? 'Le total n’a pas pu être calculé.' });
          return;
        }
        const quote = readCheckoutQuote(body);
        if (!quote) {
          console.error('[événement] devis illisible :', body);
          setQuoteState({ kind: 'error', key, message: 'Le total n’a pas pu être calculé. Réessayez dans un instant.' });
          return;
        }
        setQuoteState({ kind: 'ready', key, quote });
      } catch (err) {
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

  // ── Achat ────────────────────────────────────────────────────────────────

  const goToLogin = () => {
    saveCart(eventId, cart);
    router.push(`/login?redirect=${encodeURIComponent(`/events/${eventId}`)}`);
  };

  const handleBuyClick = async () => {
    if (!event.purchasable) return;
    if (!isAuthenticated) {
      toast.info('Connectez-vous pour acheter vos billets : votre sélection est gardée.');
      goToLogin();
      return;
    }
    if (cartTotalQty === 0) return;

    // Panier entièrement gratuit : /api/checkout émet les billets tout de suite, sans opérateur.
    if (hasFreeOnly) {
      if (isClaimingFree) return;
      const payload = { eventId, items: cartItems.map((item) => ({ categoryId: item.id, quantity: item.qty })) };
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
          if (!(isRecord(body) && body.free === true)) {
            // Issue incertaine : la clé est conservée, un nouvel essai ne dupliquera pas les billets.
            console.error('[événement] réponse inattendue de la réservation gratuite :', body);
            toast.error('La réservation n’a pas pu être confirmée. Patientez un instant puis réessayez : rien ne sera réservé deux fois.');
            return;
          }
          freeCheckoutAttempt.reset();
          toast.success(cartTotalQty > 1 ? `${cartTotalQty} billets gratuits réservés.` : 'Billet gratuit réservé.');
          router.push(TICKETS_AFTER_PURCHASE);
          return;
        }
        const failure = readPaymentError(res.status, body);
        if (!isUncertainOutcome(res.status)) freeCheckoutAttempt.reset();
        if (res.status === 401) {
          toast.error(failure.message);
          goToLogin();
          return;
        }
        if (failure.code === 'OPERATOR_REQUIRED') {
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
        if (failure.code === 'INSUFFICIENT_STOCK' || failure.code === 'SALE_CHECK_FAILED') void refreshEvent();
      } catch (err) {
        console.error('[événement] réservation gratuite impossible :', err);
        toast.error(NETWORK_MESSAGE);
      } finally {
        setIsClaimingFree(false);
      }
      return;
    }

    // Panier avec au moins un billet payant : la fenêtre de paiement envoie TOUT le panier (gratuits compris). Le total
    // affiché est celui du devis serveur à jour.
    if (!quote) {
      if (quoteError) toast.error(quoteError, { onRetry: () => setQuoteRetry((n) => n + 1) });
      else toast.info('Calcul du total en cours : patientez un instant.');
      return;
    }
    setPaymentRequested(true);
    setIsPaymentOpen(true);
  };

  const plural = cartTotalQty > 1 ? 's' : '';
  const panelBuyLabel = isClaimingFree
    ? 'Réservation en cours…'
    : hasFreeOnly
      ? `Réserver ${cartTotalQty} billet${plural} gratuit${plural}`
      : quote
        ? `Acheter ${cartTotalQty} billet${plural} (${formatFcfa(quote.totalAmount)})`
        : quoteError ? 'Total indisponible' : 'Calcul du total…';
  const barBuyLabel = isClaimingFree ? 'Réservation…' : hasFreeOnly ? `Réserver (${cartTotalQty})` : `Acheter (${cartTotalQty})`;
  const buyBlocked = (hasPaidItems && !quote) || pendingPath !== null;

  const goToCategories = () => {
    const heading = document.getElementById('billetterie-titre');
    if (!heading) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    heading.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    heading.focus({ preventScroll: true });
  };

  const fromPrice = fromPriceLabel(categories);
  // Annulation : toujours vraie. Report : vrai au rendu (fiche lue avant le début), puis retiré au début sur le téléphone.
  const refund = event.refund && (now === null || refundRuleApplies(event.refund, event.startsAt, new Date(now))) ? event.refund : null;
  const ended = now !== null && Date.parse(event.endsAt) <= now;
  const purchasable = event.purchasable && !gone;
  const counterOnly = !purchasable && event.counterSale && !event.banner && !gone;

  // Barre du téléphone : vente en ligne ouverte, ou guichet sur place à signaler. Rien pour un événement suspendu,
  // annulé ou terminé (le bandeau de la page le dit).
  const barKind: 'choose' | 'buy' | 'pending' | 'counter' | null = !purchasable
    ? (counterOnly && !ended ? 'counter' : null)
    : pendingPath ? 'pending' : cartTotalQty > 0 ? 'buy' : 'choose';
  const cartSummary = cartItems.map((item) => `${item.qty} × ${item.name}`).join(', ');
  const barAmount = hasFreeOnly ? 'Gratuit' : quote ? formatFcfa(quote.totalAmount) : quoteError ? 'Total indisponible' : 'Calcul du total…';

  // ── Rendu ────────────────────────────────────────────────────────────────

  const refundBlock = refund && (
    <div className="space-y-3 rounded-xl border border-info-border bg-info-soft p-4 text-info-text">
      <p className="flex items-center gap-2 text-base font-semibold">
        <Undo2 size={18} aria-hidden="true" />
        Remboursement
      </p>
      <p className="text-sm leading-relaxed">{refund.text}</p>
      <LinkButton href="/tickets" variant="secondary" size="sm">
        Voir mes billets
      </LinkButton>
    </div>
  );

  return (
    <>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="billetterie-titre" tabIndex={-1} className="scroll-mt-24 text-xl font-bold tracking-tight text-foreground-strong focus:outline-none">
              Billetterie
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {purchasable ? 'Choisissez vos billets : places mises à jour en direct.' : closedMessage(event, ended)}
            </p>
          </div>
          {/* Événement suspendu, annulé ou terminé : « En direct » se lisait comme « l'événement a lieu en ce moment »
              (relecture du run 77) ; seuls « Connexion… » et « Hors ligne » restent alors affichés. */}
          {!(event.banner && liveStatus === 'live') && <LiveIndicator status={liveStatus} className="flex-shrink-0" />}
        </div>

        {refreshError && (
          <StatusBanner
            tone="warning"
            announce="alert"
            title="La billetterie n’a pas pu être mise à jour"
            action={(
              <Button variant="secondary" size="sm" onClick={() => void refreshEvent()} leftIcon={<RefreshCw size={16} />}>
                Réessayer
              </Button>
            )}
          >
            {refreshError} Les informations affichées sont celles du dernier chargement.
          </StatusBanner>
        )}

        {gone && (
          <StatusBanner tone="neutral" title="Événement indisponible">
            Cet événement n’est plus ouvert au public.
          </StatusBanner>
        )}

        {counterOnly && !ended && (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">
              <Store size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground-strong">Billets au guichet sur place</p>
              <p className="text-sm text-muted-foreground">Achetez vos billets à l’entrée de l’événement.</p>
            </div>
          </div>
        )}

        {categories.length > 0 && (
          <ul className="ev-stagger space-y-3" aria-label="Catégories de billets">
            {categories.map((cat) => {
              const qty = cart[cat.id] || 0;
              const canBuy = purchasable && cat.isAvailable;
              const avail = availabilityOf(cat);
              const line = quoteLineFor(cat.id);
              return (
                <li
                  key={cat.id}
                  className={cn(
                    'relative overflow-hidden rounded-xl border py-4 pl-5 pr-4 transition-colors duration-200',
                    !canBuy ? 'border-border bg-muted' : qty > 0 ? 'border-primary-text bg-primary-soft' : 'border-border bg-card',
                  )}
                >
                  <CategoryStripe cat={cat} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words text-base font-semibold text-foreground-strong">{cat.name}</h3>
                      <p className="text-lg font-bold tabular-nums text-foreground-strong">{priceLabel(cat.price)}</p>
                      {!event.banner && <p className={cn('mt-0.5 text-sm font-medium', AVAILABILITY_TEXT[avail.tone])}>{avail.label}</p>}
                      {cat.description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{cat.description}</p>}
                    </div>
                    {canBuy && (
                      <div className="flex flex-shrink-0 items-center gap-2" role="group" aria-label={`Quantité ${cat.name}`}>
                        <IconButton aria-label={`Retirer un billet ${cat.name}`} variant="secondary" onClick={() => updateCartQty(cat.id, -1)} disabled={qty <= 0}>
                          <Minus size={18} />
                        </IconButton>
                        <output className="w-7 text-center text-base font-bold tabular-nums text-foreground-strong" aria-live="polite">
                          {qty}
                        </output>
                        <IconButton aria-label={`Ajouter un billet ${cat.name}`} variant="secondary" onClick={() => updateCartQty(cat.id, 1)} disabled={qty >= limitFor(cat)}>
                          <Plus size={18} />
                        </IconButton>
                      </div>
                    )}
                  </div>
                  {qty > 0 && cat.price > 0 && (
                    <p className="mt-2 text-sm tabular-nums text-muted-foreground">
                      {qty} × {priceLabel(cat.price)}
                      {line ? ` : ${formatFcfa(line.lineFacial)}` : ''}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {purchasable && (
          cartTotalQty > 0 ? (
            <div className="space-y-3 border-t border-border pt-4">
              {hasPaidItems && (
                <dl className="space-y-1.5 text-sm" aria-busy={quoteLoading || undefined}>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">Billets</dt>
                    <dd className="whitespace-nowrap font-semibold tabular-nums text-foreground-strong">
                      {quote ? formatFcfa(quote.facialAmount) : <span className="inline-block h-4 w-16 rounded bg-muted align-middle motion-safe:animate-pulse" aria-hidden="true" />}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted-foreground">Frais de service</dt>
                    <dd className="whitespace-nowrap font-semibold tabular-nums text-foreground-strong">
                      {quote ? formatFcfa(quote.serviceFee) : <span className="inline-block h-4 w-12 rounded bg-muted align-middle motion-safe:animate-pulse" aria-hidden="true" />}
                    </dd>
                  </div>
                </dl>
              )}
              <div className="flex items-baseline justify-between gap-3" aria-live="polite">
                <span className="text-sm font-semibold text-muted-foreground">
                  Total ({cartTotalQty} billet{plural})
                </span>
                <span className={cn('text-xl font-bold tabular-nums', hasFreeOnly ? 'text-success-text' : 'text-foreground-strong')}>
                  {hasFreeOnly ? 'Gratuit' : quote ? formatFcfa(quote.totalAmount) : quoteError ? 'Indisponible' : (
                    <>
                      <span className="sr-only">Calcul du total en cours…</span>
                      <span className="inline-block h-6 w-24 rounded-lg bg-muted align-middle motion-safe:animate-pulse" aria-hidden="true" />
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

              {pendingPath && (
                <p className="rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-sm font-medium text-warning-text">
                  Un paiement est déjà en attente pour cet événement : suivez-le ou annulez-le avant d’en lancer un autre.
                </p>
              )}

              {/* Un seul grand bouton par écran : sur téléphone, c'est celui de la barre du bas ; ici, bouton principal. */}
              <Button
                variant="primary"
                size="lg"
                fullWidth
                className="lg:hidden"
                disabled={isClaimingFree || buyBlocked}
                isLoading={isClaimingFree}
                onClick={() => void handleBuyClick()}
                leftIcon={<Ticket size={18} />}
              >
                {panelBuyLabel}
              </Button>
              <Button
                variant="gradient"
                fullWidth
                className="ev-press hidden lg:inline-flex"
                disabled={isClaimingFree || buyBlocked}
                isLoading={isClaimingFree}
                onClick={() => void handleBuyClick()}
                leftIcon={<Ticket size={20} />}
              >
                {panelBuyLabel}
              </Button>
              {hasPaidItems && (
                <p className="text-center text-sm leading-relaxed text-muted-foreground">
                  Frais de service inclus dans le total, affiché avant le paiement.
                </p>
              )}
            </div>
          ) : (
            <p className="border-t border-border pt-4 text-sm text-muted-foreground">
              Choisissez au moins un billet avec le bouton « + ».
            </p>
          )
        )}

        {purchasable && (
          <div className="space-y-2">
            <PayMethods />
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck size={16} className="flex-shrink-0 text-success-text" aria-hidden="true" />
              Billet avec QR code dans Mes billets, dès le paiement
            </p>
          </div>
        )}

        {refundBlock}

        {!purchasable && (
          <LinkButton href="/explore" variant="secondary" fullWidth leftIcon={<Compass size={18} />}>
            Voir d’autres événements
          </LinkButton>
        )}

        {/* Place réservée sous la barre d'achat du téléphone : elle ne masque jamais le contenu. */}
        {barKind && <div aria-hidden="true" className="h-20 lg:hidden" />}
      </div>

      {/* Barre d'achat du téléphone, collée à la barre de navigation du bas : 53 px (bordure 1, marge haute 4, liens 48) plus
          la zone sûre, que .safe-bottom ajoute à la navigation (AppLayout). Hauteur relevée sur la capture du run 98. */}
      {barKind && (
        <div
          role="region"
          aria-label="Achat des billets"
          className="fixed inset-x-0 bottom-[calc(3.3125rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-card px-4 py-2.5 shadow-lg lg:hidden"
        >
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-muted-foreground">
                {barKind === 'buy' ? cartSummary : barKind === 'pending' ? 'Paiement en attente' : 'Billetterie'}
              </p>
              <p className="truncate text-base font-bold tabular-nums text-foreground-strong" aria-live="polite">
                {barKind === 'buy'
                  ? barAmount
                  : barKind === 'pending'
                    ? 'Suivez-le ou annulez-le'
                    : barKind === 'counter'
                      ? 'Billets au guichet sur place'
                      : fromPrice ?? 'Billets en vente'}
              </p>
            </div>
            {barKind === 'choose' && (
              <Button variant="gradient" className="ev-press flex-shrink-0 px-5" onClick={goToCategories}>
                Choisir mes billets
              </Button>
            )}
            {barKind === 'buy' && (
              <Button
                variant="gradient"
                className="ev-press flex-shrink-0 px-5"
                disabled={isClaimingFree || buyBlocked}
                isLoading={isClaimingFree}
                onClick={() => void handleBuyClick()}
              >
                {barBuyLabel}
              </Button>
            )}
            {barKind === 'pending' && pendingPath && (
              <LinkButton href={pendingPath} variant="gradient" className="ev-press flex-shrink-0 px-5">
                Suivre le paiement
              </LinkButton>
            )}
          </div>
        </div>
      )}

      {/* Paiement Mobile Money : panier complet (payants et gratuits) par /api/checkout */}
      {paymentRequested && (
        <PaymentModal
          isOpen={isPaymentOpen && purchasable}
          onClose={() => {
            setIsPaymentOpen(false);
            requestPendingRefresh(eventId);
          }}
          eventId={eventId}
          checkoutItems={cartItems.map((item) => ({ categoryId: item.id, quantity: item.qty, label: item.name }))}
          quote={quote}
          title={`${event.title} (${cartItems.map((item) => `${item.qty} × ${item.name}`).join(' + ')})`}
          onPaymentSuccess={() => {
            setIsPaymentOpen(false);
            router.push(TICKETS_AFTER_PURCHASE);
          }}
        />
      )}
    </>
  );
}
