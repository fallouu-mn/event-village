'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ChevronLeft,
  Share2,
  Heart,
  Ticket,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Navigation,
  Bus,
  Car,
  Phone,
  ClipboardList,
  ExternalLink,
  Plus,
  Minus,
  RefreshCw,
} from 'lucide-react';

const EventMap = dynamic(
  () => import('@/components/ui/EventMap').then(m => ({ default: m.EventMap })),
  { ssr: false, loading: () => <div className="w-full h-48 rounded-xl bg-slate-100 dark:bg-zinc-800 animate-pulse" /> }
);
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  PaymentModal,
  formatFcfa,
  isUncertainOutcome,
  readCheckoutQuote,
  readJsonBody,
  readPaymentError,
  serverErrorMessage,
  useIdempotencyKey,
  type CheckoutQuote,
} from '@/components/payment/PaymentModal';

/** Devis serveur du panier courant (clé = panier et prix affichés au moment de la demande). */
type QuoteState =
  | { kind: 'idle' }
  | { kind: 'loading'; key: string }
  | { kind: 'ready'; key: string; quote: CheckoutQuote }
  | { kind: 'error'; key: string; message: string };
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const toast = useToast();
  const { isAuthenticated, session } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isClaimingFree, setIsClaimingFree] = useState(false);
  const [event, setEvent] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  // Clé d'idempotence du panier gratuit : conservée tant que le panier et l'issue incertaine ne changent pas.
  const freeCheckoutAttempt = useIdempotencyKey();

  const updateCartQty = (categoryId: string, delta: number) => {
    setCart(prev => {
      const cat = (event?.categories || []).find((c: any) => c.id === categoryId);
      if (!cat) return prev;
      const current = prev[categoryId] || 0;
      const maxAllowed = Math.min(cat.maxPerOrder || 10, cat.availableQuantity ?? 10);
      const next = Math.max(0, Math.min(maxAllowed, current + delta));
      if (next === 0) {
        const { [categoryId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [categoryId]: next };
    });
  };

  const cartItems = Object.entries(cart)
    .map(([catId, qty]) => {
      const cat = (event?.categories || []).find((c: any) => c.id === catId);
      return cat ? { ...cat, qty } : null;
    })
    .filter(Boolean) as any[];

  // Nombre de billets (quantités) ; les montants viennent du devis serveur, jamais d'un calcul local.
  const cartTotalQty = cartItems.reduce((sum, item) => sum + item.qty, 0);
  const hasPaidItems = cartItems.some(item => (item.price || 0) > 0);
  const hasFreeOnly = cartTotalQty > 0 && !hasPaidItems;

  const eventId = params.id;

  // Empreinte du panier (catégories, quantités et prix affichés) : un devis ne vaut que pour elle.
  const cartKey = cartItems
    .map((item: any) => `${item.id}:${item.qty}:${item.price ?? 0}`)
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
    const items = key.split('|').map(part => {
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
  const quoteLineFor = (categoryId: string) => quote?.lines.find(line => line.categoryId === categoryId) ?? null;

  const loadEvent = React.useCallback(async (showLoading = true) => {
    if (!eventId) return;
    try {
      if (showLoading) {
        setIsLoading(true);
        setError(null);
      }
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) {
        throw new Error('Événement introuvable.');
      }
      const data = await res.json();
      setEvent(data.event);

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur chargement événement');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent(true);
  }, [loadEvent]);

  // Temps réel (lot 5, contrat O1 et O3) : le résumé public de l'événement (statut, dates, lieu, prix) et le
  // stock en tranches de ses catégories ; chaque signal recharge la fiche publique (GET /api/events/[id]).
  // Plus aucun abonnement à ticket_categories : les volumes de vente ne sont plus diffusés (arbitrage A3/O).
  useRealtimeRefresh({
    channelKey: `event-public-${eventId ?? 'inconnu'}`,
    subscriptions: [
      { table: 'public_event_state', filter: `event_id=eq.${eventId ?? ''}` },
      { table: 'public_category_stock', filter: `event_id=eq.${eventId ?? ''}` },
    ],
    onSignal: () => loadEvent(false),
    enabled: Boolean(eventId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 pb-20">
        <Skeleton className="h-9 w-40 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="w-full aspect-[16/9] rounded-3xl" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
            <Skeleton className="h-40 rounded-3xl" />
          </div>
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-md mx-auto min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/40 text-red-500 flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Événement introuvable</h2>
        <p className="text-xs text-slate-500">{error || 'Cet événement n’existe pas ou a été archivé.'}</p>
        <Link href="/explore">
          <Button variant="primary" size="md">Retour aux événements</Button>
        </Link>
      </div>
    );
  }

  const handleBuyClick = async () => {
    if (!isAuthenticated) {
      const returnUrl = `/events/${eventId}`;
      toast.error('Connectez-vous pour acheter un billet.');
      router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
      return;
    }
    if (cartTotalQty === 0) return;

    // Panier entièrement gratuit : /api/checkout émet les billets tout de suite, sans opérateur.
    if (hasFreeOnly) {
      if (isClaimingFree) return;
      const payload = {
        eventId,
        items: cartItems.map(item => ({ categoryId: item.id, quantity: item.qty })),
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
          const isFreeConfirmation =
            typeof body === 'object' && body !== null && (body as { free?: unknown }).free === true;
          if (!isFreeConfirmation) {
            // Issue incertaine : la clé est conservée, un nouvel essai ne dupliquera pas les billets.
            console.error('[événement] réponse inattendue du checkout gratuit :', body);
            toast.error('Réponse inattendue du serveur. Patientez un instant puis réessayez.');
            return;
          }
          freeCheckoutAttempt.reset();
          toast.success(
            cartTotalQty > 1
              ? `${cartTotalQty} billets gratuits réservés avec succès !`
              : 'Billet gratuit réservé avec succès !'
          );
          router.push('/tickets');
          return;
        }

        const failure = readPaymentError(res.status, body);
        if (!isUncertainOutcome(res.status)) freeCheckoutAttempt.reset();
        if (res.status === 401) {
          toast.error(failure.message);
          router.push(`/login?redirect=${encodeURIComponent(`/events/${eventId}`)}`);
          return;
        }
        if (failure.code === 'OPERATOR_REQUIRED') {
          // Le serveur a calculé un montant à payer : les prix affichés n'étaient plus à jour.
          toast.error('Le prix de ce panier a changé : vérifiez le récapitulatif puis relancez.');
          void loadEvent(false);
          return;
        }
        toast.error(
          failure.problems.length > 0
            ? failure.problems
                .map(problem => {
                  const name = cartItems.find(item => item.id === problem.categoryId)?.name;
                  return name ? `${name} : ${problem.message}` : problem.message;
                })
                .join(' ')
            : failure.message
        );
        if (failure.code === 'INSUFFICIENT_STOCK' || failure.code === 'SALE_CHECK_FAILED') {
          void loadEvent(false);
        }
      } catch (err) {
        // Issue incertaine : la clé est conservée pour le prochain essai.
        console.error('[événement] réservation gratuite impossible :', err);
        toast.error('Connexion impossible. Vérifiez votre réseau puis réessayez.');
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
    setIsPaymentOpen(true);
  };

  const buyLabel = (compact: boolean): string => {
    if (isClaimingFree) return compact ? 'Réservation...' : 'Réservation en cours...';
    const plural = cartTotalQty > 1 ? 's' : '';
    if (hasFreeOnly) {
      return compact ? `Réserver ${cartTotalQty} gratuit${plural}` : `Réserver ${cartTotalQty} billet${plural} gratuit${plural}`;
    }
    if (quote) {
      return compact ? `Acheter (${formatFcfa(quote.totalAmount)})` : `Acheter ${cartTotalQty} billet${plural} (${formatFcfa(quote.totalAmount)})`;
    }
    if (quoteError) return 'Total indisponible';
    return 'Calcul du total…';
  };
  const buyBlocked = hasPaidItems && !quote;

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] transition-all shadow-xs"
        >
          <ChevronLeft size={16} />
          <span>Retour aux événements</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:text-red-500 transition-all shadow-xs"
            aria-label="Ajouter aux favoris"
          >
            <Heart size={18} className={isLiked ? 'fill-red-500 text-red-500' : ''} />
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: event.title, url: window.location.href });
              } else {
                navigator.clipboard.writeText(window.location.href);
                toast.success('Lien copié dans le presse-papier !');
              }
            }}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] transition-all shadow-xs"
            aria-label="Partager"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* 2. Layout Responsive (2 Colonnes sur Desktop / 1 Colonne sur Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Colonne Gauche : Hero Image, Détails, Organisateur */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Poster Immersif */}
          <div className="relative w-full aspect-[16/9] sm:aspect-[16/8] rounded-3xl overflow-hidden shadow-xl border border-slate-200 dark:border-zinc-800 bg-slate-950">
            <Image
              src={event.posterUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80'}
              alt={event.title}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 66vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            {/* Badge Événement Complet si toutes les catégories sont épuisées/fermées */}
            {event.isFullySoldOut && (
              <div className="absolute top-4 right-4 z-10">
                <span className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-red-600/90 backdrop-blur-md text-white border border-red-400 shadow-lg inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  Complet
                </span>
              </div>
            )}

            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white space-y-1">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FF5722] text-white shadow-md inline-block">
                {event.categoryLabel || event.category || 'Événement'}
              </span>
              <h1 className="text-xl sm:text-3xl font-black tracking-tight drop-shadow-md">
                {event.title}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-300 font-medium drop-shadow">
                {event.subtitle}
              </p>
            </div>
          </div>

          {/* Cartes d'Informations Rapides */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0">
                <Calendar size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Date</span>
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{event.dateFormatted}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0">
                <Clock size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Heure</span>
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{event.time}</p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Lieu</span>
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{event.venue}</p>
              </div>
            </div>
          </div>

          {/* À propos de l’événement */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              À propos de l&apos;événement
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          </div>

          {/* Programme & Déroulé (§32) */}
          {event.program && event.program.length > 0 && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar size={16} className="text-[#FF5722]" />
                Programme & Déroulé
              </h2>
              <div className="relative pl-4 border-l-2 border-[#FF5722]/30 space-y-4">
                {event.program.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="relative">
                    <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-[#FF5722] border-2 border-white dark:border-[#1E1E1E]" />
                    <div className="flex items-start gap-3">
                      {item.time && (
                        <span className="text-[11px] font-black text-[#FF5722] mt-0.5 w-12 flex-shrink-0">
                          {item.time}
                        </span>
                      )}
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white">{item.title}</p>
                        {item.participant && (
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">{item.participant}</p>
                        )}
                        {item.description && (
                          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{item.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lieu & Carte (§33) */}
          {(event.latitude || event.practicalInfo?.address) && (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin size={16} className="text-[#FF5722]" />
                Lieu & Accès
              </h2>

              {event.practicalInfo?.address && (
                <div>
                  <p className="text-xs font-black text-slate-900 dark:text-white">{event.venue}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{event.practicalInfo.address}</p>
                </div>
              )}

              {event.latitude && event.longitude && (
                <>
                  <EventMap
                    latitude={event.latitude}
                    longitude={event.longitude}
                    venueName={event.venue}
                  />
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF5722] text-white text-xs font-bold hover:bg-[#e64a19] transition-all shadow-sm"
                  >
                    <Navigation size={14} />
                    Voir l&apos;itinéraire
                    <ExternalLink size={12} />
                  </a>
                </>
              )}

              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-zinc-800">
                {event.practicalInfo?.accessNotes && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bus size={13} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Accès & Transports</p>
                      <p className="text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-line">{event.practicalInfo.accessNotes}</p>
                    </div>
                  </div>
                )}

                {event.practicalInfo?.parking && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Car size={13} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Parking</p>
                      <p className="text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-line">{event.practicalInfo.parking}</p>
                    </div>
                  </div>
                )}

                {event.practicalInfo?.contactPhone && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Phone size={13} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Contact Organisateur</p>
                      <a href={`tel:${event.practicalInfo.contactPhone}`} className="text-xs font-bold text-[#FF5722] hover:underline">
                        {event.practicalInfo.contactPhone}
                      </a>
                    </div>
                  </div>
                )}

                {event.practicalInfo?.rules && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <ClipboardList size={13} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Règlement & Consignes</p>
                      <p className="text-xs text-slate-700 dark:text-zinc-300 whitespace-pre-line">{event.practicalInfo.rules}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fiche Organisateur */}
          {event.organizer && (
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-700 shadow-sm relative">
                  <Image src={event.organizer.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80'} alt={event.organizer.name} fill className="object-cover" sizes="48px" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Organisateur</span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">{event.organizer.name}</h3>
                </div>
              </div>

              <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300">
                Partenaire Certifié
              </span>
            </div>
          )}
        </div>

        {/* Colonne Droite : Formules & Module d'Achat Sticky */}
        <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-slate-200/80 dark:border-zinc-800 space-y-6 sticky top-20 shadow-md">
          {event.isFullySoldOut && (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-center space-y-1">
              <p className="text-xs font-black text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                🔴 ÉVÉNEMENT COMPLET
              </p>
              <p className="text-[11px] text-red-700 dark:text-red-300 font-medium">
                Tous les billets disponibles pour cet événement ont été vendus.
              </p>
            </div>
          )}

          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Choisissez votre formule
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              {event.isFullySoldOut
                ? 'Les réservations sont closes pour cet événement.'
                : 'Sélectionnez vos billets et validez votre commande.'}
            </p>
          </div>

          {/* Choix Formules réelles */}
          {event.categories && event.categories.length > 0 ? (
            <div className="space-y-3">
              {event.categories.map((cat: any) => {
                const isUnavailable = cat.isSoldOut || cat.isClosed || (cat.availableQuantity !== undefined && cat.availableQuantity <= 0);
                const qty = cart[cat.id] || 0;
                const maxAllowed = Math.max(1, Math.min(cat.maxPerOrder || 10, cat.availableQuantity ?? 10));
                return (
                  <div
                    key={cat.id}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      isUnavailable
                        ? 'opacity-60 cursor-not-allowed border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900'
                        : qty > 0
                        ? 'border-[#FF5722] bg-[#FF5722]/5 shadow-xs'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-black text-slate-900 dark:text-white">{cat.name}</h3>
                          {cat.name.toUpperCase().includes('VIP') && <Sparkles size={12} className="text-amber-500" />}
                        </div>
                        <span className="text-xs font-black text-[#FF5722] mt-0.5 block">{cat.priceFormatted}</span>
                        {cat.isClosed ? (
                          <span className="text-[10px] font-bold text-slate-500 block">🔒 Ventes Clôturées</span>
                        ) : cat.isSoldOut ? (
                          <span className="text-[10px] font-bold text-red-500 block">Épuisé</span>
                        ) : cat.isHeld || (cat.availableQuantity === 0 && !cat.isSoldOut) ? (
                          <span className="text-[10px] font-bold text-amber-500 dark:text-amber-400 block">
                            ⏳ En cours de réservation (réessayez dans quelques minutes)
                          </span>
                        ) : cat.availableQuantity !== undefined && cat.availableQuantity <= 5 ? (
                          <span className="text-[10px] font-bold text-amber-500 block">
                            Plus que {cat.availableQuantity} place{cat.availableQuantity > 1 ? 's' : ''} !
                          </span>
                        ) : null}
                      </div>
                      {!isUnavailable && (
                        <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-800 rounded-xl p-1 border border-slate-200 dark:border-zinc-700 shadow-xs">
                          <button
                            type="button"
                            onClick={() => updateCartQty(cat.id, -1)}
                            disabled={qty <= 0}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            aria-label={`Retirer un billet ${cat.name}`}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-7 text-center text-xs font-black text-slate-900 dark:text-white font-mono">
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(cat.id, 1)}
                            disabled={qty >= maxAllowed}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            aria-label={`Ajouter un billet ${cat.name}`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs font-medium">
              Aucune catégorie de billet configurée pour cet événement.
            </div>
          )}

          {/* Récapitulatif Panier & CTA */}
          {cartTotalQty > 0 && (
            <div className="pt-2 space-y-3">
              {/* Détail du panier : montants du devis serveur */}
              <dl className="space-y-1.5" aria-busy={quoteLoading || undefined}>
                {cartItems.map((item: any) => {
                  const line = quoteLineFor(item.id);
                  return (
                    <div key={item.id} className="flex justify-between items-baseline gap-3 text-xs">
                      <dt className="text-slate-600 dark:text-zinc-400">
                        {item.qty}x {item.name}
                      </dt>
                      <dd className="font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                        {(item.price || 0) === 0 ? (
                          'Gratuit'
                        ) : line ? (
                          formatFcfa(line.lineFacial)
                        ) : (
                          <span className="inline-block h-3 w-16 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse motion-reduce:animate-none align-middle" aria-hidden="true" />
                        )}
                      </dd>
                    </div>
                  );
                })}
                {hasPaidItems && (
                  <div className="flex justify-between items-baseline gap-3 text-xs">
                    <dt className="text-slate-600 dark:text-zinc-400">Frais de service</dt>
                    <dd className="font-bold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                      {quote ? (
                        formatFcfa(quote.serviceFee)
                      ) : (
                        <span className="inline-block h-3 w-12 rounded bg-slate-200 dark:bg-zinc-800 animate-pulse motion-reduce:animate-none align-middle" aria-hidden="true" />
                      )}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="h-px bg-slate-200 dark:bg-zinc-800" />
              <div className="flex justify-between items-baseline gap-3" aria-live="polite">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                  Total ({cartTotalQty} billet{cartTotalQty > 1 ? 's' : ''})
                </span>
                <span className={`text-xl font-black tabular-nums ${hasFreeOnly ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {hasFreeOnly ? (
                    'Gratuit'
                  ) : quote ? (
                    formatFcfa(quote.totalAmount)
                  ) : quoteError ? (
                    '—'
                  ) : (
                    <>
                      <span className="sr-only">Calcul du total en cours…</span>
                      <span className="inline-block h-6 w-24 rounded-lg bg-slate-200 dark:bg-zinc-800 animate-pulse motion-reduce:animate-none align-middle" aria-hidden="true" />
                    </>
                  )}
                </span>
              </div>

              {quoteError && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40"
                >
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{quoteError}</p>
                    <button
                      type="button"
                      onClick={() => setQuoteRetry(n => n + 1)}
                      className="inline-flex items-center gap-1.5 min-h-[44px] text-xs font-bold text-red-700 dark:text-red-300 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded-md"
                    >
                      <RefreshCw size={13} aria-hidden="true" /> Recalculer le total
                    </button>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={event.isFullySoldOut || isClaimingFree || buyBlocked}
                isLoading={isClaimingFree}
                onClick={handleBuyClick}
                leftIcon={<Ticket size={18} />}
              >
                {buyLabel(false)}
              </Button>
              {hasPaidItems && (
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 text-center leading-relaxed">
                  Frais de service payés par l’acheteur, calculés par Event Village sur chaque billet.
                </p>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500">
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>Garantie officielle Event Village • Émission QR immédiate</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CTA Mobile — visible uniquement sur mobile */}
      {cartTotalQty > 0 && !event.isFullySoldOut && (
        <div className="fixed bottom-0 left-0 w-full z-50 p-4 bg-white dark:bg-[#1E1E1E] border-t border-slate-200 dark:border-zinc-800 lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={isClaimingFree || buyBlocked}
            isLoading={isClaimingFree}
            onClick={handleBuyClick}
            leftIcon={<Ticket size={18} />}
          >
            {buyLabel(true)}
          </Button>
        </div>
      )}

      {/* Modale de Paiement SamirPay — panier complet (payants et gratuits) via /api/checkout */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        eventId={eventId}
        checkoutItems={cartItems.map((item: any) => ({ categoryId: item.id, quantity: item.qty, label: item.name }))}
        quote={quote}
        title={`${event.title} (${cartItems.map((item: any) => `${item.qty}x ${item.name}`).join(' + ')})`}
        onPaymentSuccess={() => {
          setIsPaymentOpen(false);
          router.push('/tickets');
        }}
      />
    </div>
  );
}
