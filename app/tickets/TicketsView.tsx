'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { HelpCircle, RefreshCw, Sparkles, Ticket, WifiOff } from 'lucide-react';
import { TicketCard, type TicketCardProps } from '@/components/tickets/TicketCard';
import { TicketThumb } from '@/components/tickets/TicketThumb';
import { TABS, type TabKey } from './tabs';
import { TicketWallet, useMinuteNow } from '@/components/tickets/TicketWallet';
import { byStart } from '@/components/tickets/wallet';
import type { TransferTicketData } from '@/components/tickets/TransferModal';
import { IncomingTransfers, readIncomingTransfers, type IncomingTransfersData } from '@/components/tickets/IncomingTransfers';
import { reconcileWithServerTickets } from '@/components/tickets/OfflineTicketsSync';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Skeleton, SKELETON_CARD } from '@/components/ui/Skeleton';
import { cn } from '@/components/ui/cn';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { PageHeader } from '@/components/ui/PageHeader';
// Design 1d : tirer pour actualiser importé directement (run 489 : un morceau à part coûtait un rendu de plus)
import { PullToRefresh } from '@/components/tickets/PullToRefresh';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TabPanel, useTabParam } from '@/components/ui/Tabs';
import { ScrollableTabs } from '@/components/ui/ScrollableTabs';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { usePageSettled } from '@/hooks/usePageSettled';
import type { OfflineAvailability } from '@/lib/tickets/offline-clock';
import { isActiveUpcoming, TICKETS_UPCOMING_PARAM } from '@/lib/tickets/periode';
import { loadMyTables } from '@/components/event-tables/client/load';

// Lot 7 (7.5) : les modales ne sont chargées qu'à leur ouverture (poids JS de /tickets).
const TransferModal = dynamic(() => import('@/components/tickets/TransferModal').then((m) => m.TransferModal), { ssr: false });
const TransferExplainerModal = dynamic(() => import('@/components/tickets/TransferExplainerModal').then((m) => m.TransferExplainerModal), { ssr: false });
// Design 1b (point 8) : petite fête après l'achat, chargée seulement avec ?fete=1 (contrat avec le lot FICHE).
const PurchaseCelebration = dynamic(() => import('@/components/tickets/PurchaseCelebration').then((m) => m.PurchaseCelebration), { ssr: false });
// Lot 11c-b : « Ma table » chargée seulement à l'ouverture de l'onglet « Tables » (chargeur unique du module)
const MyTables = dynamic(() => loadMyTables().then((m) => m.MyTables), {
  ssr: false,
  loading: () => <div className="h-48 rounded-2xl bg-muted" aria-busy="true"><span className="sr-only">Chargement de vos tables…</span></div>,
});

/**
 * Mes billets (lot 5, tâche 5.13 ; contrats O3, O5, Q).
 *  - Source unique : GET /api/tickets (billets du compte de la session).
 *  - Temps réel : les billets du porteur (filtre user_id : émission, compostage, transfert,
 *    remboursement) et ses notifications (transfert reçu ou accepté) ; chaque signal recharge la liste
 *    par le serveur, sans recharger la page. Indicateur « En direct » / « Hors ligne ».
 *  - Onglets dans ?tab= : à venir, tous, historique (simple tri de la liste reçue, aucun agrégat), et
 *    « Reçus » (lot 6, contrat B5 et amendement 2 : transferts entrants vers le numéro vérifié du compte,
 *    GET /api/tickets/transfers/incoming, acceptation par « Accepter le billet », confirmation du numéro par
 *    code SMS). Le SMS d'un transfert renvoie vers /tickets?tab=recus.
 *  - Lot 7 (7.1, contrat 5.2) : chaque carte reçoit la disponibilité hors ligne du serveur (`offline`) ; après
 *    chaque chargement réussi, les billets enregistrés sur le téléphone sont réconciliés avec la liste (billet
 *    disparu, transféré ou d'une autre version : lot supprimé). Lien « Afficher mes billets hors ligne » en
 *    navigation complète (<a href>, servie par le service worker sans réseau).
 *  - Lot 9 bis : R45 (A10) au premier chargement, un billet reçu qui attend et aucun onglet demandé dans l'URL
 *    ouvrent « Reçus » (les SMS gardent leur lien) ; R25, R66, R32, B9 : la carte reçoit ce que le serveur sert
 *    (codeVisible, transferAllowed, eventNotice, prix, frais, refundDelayed, postponementRefund).
 *  - Design 1b (point 8) : portefeuille façon Wallet (TicketWallet : on glisse d'un billet à l'autre, boutons et flèches
 *    du clavier) ; « À venir » trié du plus proche au plus lointain (le jour J, le QR du prochain billet d'abord, E-58) ;
 *    compte à rebours à la minute (une minuterie pour la page) ; petite fête après un achat (?fete=1, paramètre retiré
 *    ensuite).
 *  - Design 1b (point 1, performance) : chargement côté navigateur, choisi parce que cette page est personnelle : le HTML
 *    servi ne contient AUCUNE donnée du compte (rien de personnel ne peut finir dans un cache, et le service worker du
 *    contrat 5.3 reste tel quel). Pour afficher vite : la liste est demandée dès le montage, en parallèle de la lecture
 *    de la session et du profil (avant : après /api/auth/me) ; la réponse n'est utilisée qu'une fois le compte connu, et
 *    jamais si personne n'est connecté ; GET /api/tickets répond « private, no-store ». Plus de grande affiche avant le
 *    contenu (vignette de 56 px) ; squelettes à la taille de la carte (aucun saut) ; modales, QR en grand et fête chargés
 *    à la demande (budget JS de /tickets).
 */

type TicketStatus = TicketCardProps['status'];

export interface MyTicket {
  id: string;
  eventId: string;
  ticketNumber: string;
  eventTitle: string;
  eventSubtitle?: string;
  eventImageUrl: string | null;
  dateFormatted: string;
  timeFormatted: string;
  venue: string;
  seat?: string;
  status: TicketStatus;
  usedAt?: string;
  isUpcoming: boolean;
  isTransferLocked?: boolean;
  activeTransfer?: TicketCardProps['activeTransfer'];
  offline?: OfflineAvailability | null;
  price?: number;
  serviceFee?: number;
  saleChannel?: string | null;
  eventStatus?: string;
  codeVisible?: boolean;
  transferAllowed?: boolean;
  eventNotice?: string | null;
  refundDelayed?: boolean;
  postponementRefund?: TicketCardProps['postponementRefund'];
  startsAt?: string | null;
  endsAt?: string | null;
  categoryColor?: string | null;
  /** Lot 11c-b : place d'une table d'événement (« Table 12 · Carré VIP ») ; bookingId pour le titulaire, invitedBy pour un invité. */
  table?: { label: string; bookingId: string | null; invitedBy: string | null } | null;
}

type TicketTabKey = Exclude<TabKey, 'recus' | 'tables'>;

const EMPTY_COPY: Record<TicketTabKey, { title: string; description: string }> = {
  'a-venir': {
    title: 'Aucun billet à venir',
    description: 'Vos prochains billets apparaîtront ici dès l’achat, sans recharger la page.',
  },
  tous: {
    title: 'Vous n’avez encore aucun billet',
    description: 'Choisissez un événement dans le catalogue : votre billet arrive ici aussitôt payé.',
  },
  historique: {
    title: 'Aucun billet dans l’historique',
    description: 'Les billets utilisés, remboursés ou d’événements passés apparaîtront ici.',
  },
};

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

/** Design 1e (point B) : liste reçue et si elle est COMPLÈTE (tous les billets) ou limitée aux billets à venir. */
export interface TicketList { tickets: MyTicket[]; complete: boolean }

type LoadResult = { ok: true; tickets: MyTicket[]; complete: boolean } | { ok: false; message: string };

/** Portefeuille affiché par 10 billets ; la suite au défilement (ou par le bouton). */
const WALLET_PAGE = 10;

type Scope = 'a-venir' | 'tout';

async function readTickets(scope: Scope): Promise<LoadResult> {
  let res: Response;
  try {
    res = await fetch(`/api/tickets${scope === 'a-venir' ? `?${TICKETS_UPCOMING_PARAM}` : ''}`, { cache: 'no-store' });
  } catch (err) {
    console.error('[Mes billets] liste injoignable :', err instanceof Error ? err.message : String(err));
    return { ok: false, message: NETWORK_MESSAGE };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch (err) {
    console.error(`[Mes billets] réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return { ok: false, message: `Réponse inattendue du serveur (erreur ${res.status}).` };
  }
  const payload = (typeof body === 'object' && body !== null ? body : {}) as { tickets?: unknown; error?: unknown };
  if (!res.ok) {
    const message = typeof payload.error === 'string' && payload.error ? payload.error : `Vos billets n’ont pas pu être chargés (erreur ${res.status}).`;
    return { ok: false, message };
  }
  if (!Array.isArray(payload.tickets)) {
    console.error('[Mes billets] réponse sans liste de billets :', body);
    return { ok: false, message: 'Réponse inattendue du serveur.' };
  }
  return { ok: true, tickets: payload.tickets as MyTicket[], complete: scope === 'tout' };
}

/** Squelette à la forme de la carte Wallet (talon, informations, QR de 216 px, encadré), aucun saut à l'arrivée. */
function TicketSkeleton() {
  return (
    <div className={cn(SKELETON_CARD, 'overflow-hidden rounded-2xl')} aria-hidden="true">
      <div className="flex gap-3 bg-muted px-4 pb-6 pt-4">
        <Skeleton className="h-14 w-14 flex-shrink-0 bg-card" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-1/3 bg-card" />
          <Skeleton className="h-6 w-3/4 bg-card" />
          <Skeleton className="h-4 w-1/2 bg-card" />
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="col-span-2 h-11" />
        </div>
        <Skeleton className="mx-auto h-[216px] w-[216px] rounded-2xl" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}

/** Retire ?fete=1 de l'adresse sans recharger ni déplacer la page (l'onglet demandé reste). */
function dropCelebrationParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('fete')) return;
  url.searchParams.delete('fete');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Décision du 19/11 : liste lue par le serveur (app/tickets/page.tsx) et envoyée dans la même réponse (`ticketsPromise`) ;
 * run 426 : attendre la liste avant d'envoyer la page retardait l'en-tête (affichage principal 2,52 s) et l'hydratation du
 * portefeuille rendu par le serveur pesait ; l'en-tête et le squelette partent donc tout de suite, la liste suit (null si le
 * serveur n'a pu la lire : chargement côté navigateur comme avant) ; `initialTab` et `serverNow` rendent le premier rendu
 * identique côté serveur et navigateur.
 */
export function TicketsView({ ticketsPromise, initialTab, serverNow }: { ticketsPromise?: Promise<TicketList | null>; initialTab?: TabKey; serverNow?: number }) {
  const { user, profile, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;
  const [tab, setTab] = useTabParam(TABS, 'a-venir', 'tab', initialTab);
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const [incoming, setIncoming] = useState<IncomingTransfersData>({ items: [], phoneVerificationRequired: false });
  const [incomingPhase, setIncomingPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [incomingError, setIncomingError] = useState<string | null>(null);
  const [isRetryingIncoming, setIsRetryingIncoming] = useState(false);

  const [transferTicket, setTransferTicket] = useState<TransferTicketData | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const now = useMinuteNow(serverNow);

  // Design 1b (point 8) : retour d'un paiement réussi (/tickets?tab=a-venir&fete=1) : petite fête une fois les billets
  // affichés, puis le paramètre est retiré (un rechargement ne la rejoue pas).
  const [celebrate, setCelebrate] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('fete') === '1') setCelebrate(true);
  }, []);
  const endCelebration = useCallback(() => {
    setCelebrate(false);
    dropCelebrationParam();
  }, []);

  // Design 1b (point 1) : liste demandée dès le montage, sans attendre la session ni le profil (même cookie de session
  // que le fournisseur de session). La réponse n'est lue qu'une fois le compte connu (effet de chargement ci-dessous).
  const earlyRef = useRef<Promise<LoadResult> | null>(null);
  useEffect(() => {
    // liste lue par le serveur : rien à demander ; sinon, à venir seulement sur l'onglet par défaut (design 1e)
    if (!ticketsPromise) earlyRef.current = readTickets(!initialTab || initialTab === 'a-venir' ? 'a-venir' : 'tout');
  }, [ticketsPromise, initialTab]);

  // Design 1b (run 420, temps de blocage de Mes billets) : une relecture identique (rattrapage du temps réel à la
  // connexion, synchronisation) ne remplace plus la liste : sans cela, chaque réponse redessinait tout le portefeuille
  // (tâches de 69 à 97 ms au téléphone de référence). Le contenu change : la liste est remplacée, comme avant.
  const ticketsJsonRef = useRef<string | null>(null);
  const incomingJsonRef = useRef<string | null>(null);
  /** Seule écriture de la liste : remplacée seulement si son contenu change (lecture du serveur ou du navigateur). */
  // Design 1e (point B) : liste complète reçue (sinon : billets à venir seulement). Une liste complète ne redevient jamais partielle.
  const [complete, setComplete] = useState(false);
  const completeRef = useRef(false);
  const applyList = useCallback((list: MyTicket[], isComplete: boolean) => {
    if (completeRef.current && !isComplete) return; // relecture partielle arrivée après la liste complète : ignorée
    const json = JSON.stringify(list);
    if (json !== ticketsJsonRef.current) {
      ticketsJsonRef.current = json;
      setTickets(list);
    }
    if (isComplete && !completeRef.current) {
      completeRef.current = true;
      setComplete(true);
    }
  }, []);

  /** « initial » : écran d'erreur si l'échec survient ; « silent » : la liste reste, un bandeau le signale. */
  const load = useCallback(async (mode: 'initial' | 'silent', early?: Promise<LoadResult> | null) => {
    // Réponse anticipée gardée seulement si elle a réussi (session encore à renouveler : nouvelle demande, même règle).
    const anticipated = early ? await early : null;
    // Design 1e : relecture à la même portée (à venir tant que la liste complète n'a pas été demandée)
    const result = anticipated?.ok ? anticipated : await readTickets(completeRef.current ? 'tout' : 'a-venir');
    if (result.ok) {
      applyList(result.tickets, result.complete);
      setLoadError(null);
      setRefreshError(null);
      setPhase('ready');
      return;
    }
    if (mode === 'initial') {
      setLoadError(result.message);
      setPhase('error');
    } else {
      setRefreshError(result.message);
    }
  }, [applyList]);

  const refreshTickets = useCallback(() => load('silent'), [load]);

  // Lot 7 (7.1) : réconciliation des billets enregistrés hors ligne après chaque chargement réussi. Design 1e (point B) :
  // avec la liste COMPLÈTE seulement (elle efface les billets absents de la liste : jamais avec les seuls billets à venir) ;
  // l'enregistrement de tous les billets reste fait en arrière-plan par la synchronisation (OfflineTicketsSync), inchangée.
  useEffect(() => {
    if (phase !== 'ready' || !userId || !complete) return;
    void reconcileWithServerTickets(userId, tickets);
  }, [phase, tickets, userId, complete]);

  // Design 1e (point B) : « Tous mes billets » et « Historique » chargent la liste complète à leur première ouverture
  const [fullError, setFullError] = useState<string | null>(null);
  const [fullAttempt, setFullAttempt] = useState(0);
  useEffect(() => {
    if (tab === 'a-venir' || complete) return undefined;
    if (tab === 'recus' || tab === 'tables' || phase !== 'ready') return undefined;
    let alive = true;
    setFullError(null);
    void readTickets('tout').then((result) => {
      if (!alive) return;
      if (result.ok) applyList(result.tickets, true);
      else setFullError(result.message);
    });
    return () => { alive = false; };
  }, [tab, complete, phase, applyList, fullAttempt]);

  // Design 1e (point B) : portefeuille par 10 billets, la suite au défilement ; remis à 10 à chaque onglet
  const [limit, setLimit] = useState(WALLET_PAGE);
  useEffect(() => { setLimit(WALLET_PAGE); }, [tab]);
  const more = useCallback(() => setLimit((l) => l + WALLET_PAGE), []);

  /** R45 : la bascule vers « Reçus » n'a lieu qu'une fois, au premier chargement. */
  const autoTabDoneRef = useRef(false);

  /** Billets reçus : erreur affichée dans l'onglet « Reçus », la liste précédente reste sinon. */
  const loadIncoming = useCallback(async (mode: 'initial' | 'silent') => {
    const result = await readIncomingTransfers();
    if (result.ok) {
      const next = { items: result.items, phoneVerificationRequired: result.phoneVerificationRequired };
      const json = JSON.stringify(next);
      if (json !== incomingJsonRef.current) {
        incomingJsonRef.current = json;
        setIncoming(next);
      }
      setIncomingError(null);
      setIncomingPhase('ready');
      // R45 (A10) : un billet attend et aucun onglet n'est demandé (lien du SMS ou ouverture directe) → « Reçus »
      if (mode === 'initial' && !autoTabDoneRef.current) {
        autoTabDoneRef.current = true;
        if (result.items.length > 0 && !new URLSearchParams(window.location.search).has('tab')) setTab('recus');
      }
      return;
    }
    setIncomingError(result.message);
    if (mode === 'initial') setIncomingPhase('error');
  }, [setTab]);

  const refreshAll = useCallback(async () => {
    await Promise.all([load('silent'), loadIncoming('silent')]);
  }, [load, loadIncoming]);

  // Compte connu (sans attendre le profil) : billets et billets reçus. La réponse anticipée ne sert qu'au premier compte vu.
  useEffect(() => {
    if (!userId) return;
    const early = earlyRef.current;
    earlyRef.current = null;
    // Liste préparée par le serveur : seulement les billets reçus (la liste se relit au temps réel et à la demande)
    if (!ticketsPromise) void load('initial', early);
    void loadIncoming('initial');
  }, [userId, load, loadIncoming, ticketsPromise]);

  // Liste lue par le serveur, arrivée dans la même réponse ; absente (pas de session, échec) : lue ici comme avant
  useEffect(() => {
    if (!ticketsPromise) return undefined;
    let alive = true;
    ticketsPromise.then((list) => {
      if (!alive) return;
      if (!list) { void load('initial'); return; }
      applyList(list.tickets, list.complete);
      setLoadError(null);
      setPhase('ready');
    }, () => { if (alive) void load('initial'); });
    return () => { alive = false; };
  }, [ticketsPromise, load, applyList]);

  // Temps réel (contrat O5) : billets du porteur et notifications (transfert reçu, accepté, annulé). Design 1b (décision
  // du 18/11) : abonnement ouvert une fois la page chargée et le téléphone libre.
  const pageSettled = usePageSettled();
  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: `mes-billets-${userId ?? 'anonyme'}`,
    subscriptions: [
      { table: 'tickets', filter: `user_id=eq.${userId ?? ''}` },
      { table: 'notifications', filter: `user_id=eq.${userId ?? ''}`, event: 'INSERT' },
    ],
    onSignal: refreshAll,
    enabled: Boolean(userId) && pageSettled,
  });

  const retry = async () => {
    setIsRetrying(true);
    try {
      await load('initial');
    } finally {
      setIsRetrying(false);
    }
  };

  const retryIncoming = async () => {
    setIsRetryingIncoming(true);
    try {
      await loadIncoming('initial');
    } finally {
      setIsRetryingIncoming(false);
    }
  };

  const shown = useMemo(() => {
    if (tab === 'a-venir') return tickets.filter(isActiveUpcoming).sort(byStart);
    if (tab === 'historique') return tickets.filter((t) => !isActiveUpcoming(t));
    return tickets;
  }, [tickets, tab]);

  // Lot 11c-b : onglet « Tables » seulement pour le titulaire d'une table (ou demandé dans l'adresse : lien des avis)
  const hasTables = useMemo(() => tickets.some((t) => Boolean(t.table?.bookingId)), [tickets]);
  const [tableFocus, setTableFocus] = useState<string | null>(null);
  // Table visée par l'adresse (/tickets?tab=tables#table-<vente> : avis, paiement confirmé), comme l'ancre des billets reçus
  useEffect(() => { setTableFocus(/^#table-([0-9a-f-]{36})$/i.exec(window.location.hash)?.[1] ?? null); }, []);
  const ticketInfo = useCallback((ticketId: string) => {
    const t = tickets.find((x) => x.id === ticketId);
    return t ? { ticketNumber: t.ticketNumber, seat: t.seat, dateFormatted: t.dateFormatted, timeFormatted: t.timeFormatted, venue: t.venue } : null;
  }, [tickets]);
  const openTable = useCallback((bookingId: string) => { setTableFocus(bookingId); setTab('tables'); }, [setTab]);

  const tabItems = useMemo(() => [
    { id: 'a-venir', label: 'À venir' },
    { id: 'tous', label: 'Tous mes billets' },
    { id: 'historique', label: 'Historique' },
    { id: 'recus', label: 'Reçus', ...(incomingPhase === 'ready' && incoming.items.length > 0 ? { count: incoming.items.length } : {}) },
    ...(hasTables || tab === 'tables' ? [{ id: 'tables', label: 'Tables' }] : []),
  ], [incomingPhase, incoming.items.length, hasTables, tab]);

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <EmptyState illustrated
          icon={<Ticket size={28} />}
          title="Connectez-vous pour voir vos billets"
          description="Vos billets électroniques et leur QR code d’entrée sont liés à votre compte."
          actionLabel="Se connecter"
          actionHref="/login?redirect=%2Ftickets"
        />
      </div>
    );
  }

  const empty = tab === 'recus' || tab === 'tables' ? null : EMPTY_COPY[tab];

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Mes billets"
        description="Présentez le QR code à l’entrée : il se renouvelle tout seul. Glissez d’un billet à l’autre, et touchez le QR pour l’afficher en grand."
        eyebrow={<LiveIndicator status={liveStatus} />}
        actions={(
          <>
            <a href="/billet/hors-ligne" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
              <WifiOff size={16} aria-hidden="true" />
              Mes billets sans réseau
            </a>
            <Button variant="secondary" size="sm" onClick={() => setIsExplainerOpen(true)} leftIcon={<HelpCircle size={16} />}>
              Comment marche le transfert ?
            </Button>
            <LinkButton href="/explore" size="sm" leftIcon={<Sparkles size={16} />}>
              Réserver un billet
            </LinkButton>
          </>
        )}
      />

      <ScrollableTabs
        tabs={tabItems}
        value={tab}
        onChange={(id) => setTab(id as TabKey)}
        ariaLabel="Filtrer mes billets"
        idPrefix="mes-billets"
      />

      <TabPanel idPrefix="mes-billets" tabIdValue={tab} className="space-y-4">
        {tab === 'recus' ? (
          <IncomingTransfers
            phase={incomingPhase}
            data={incoming}
            error={incomingError}
            onRetry={() => void retryIncoming()}
            isRetrying={isRetryingIncoming}
            phone={profile?.phone ?? null}
            onChanged={() => void refreshAll()}
          />
        ) : tab === 'tables' ? (
          <MyTables focusId={tableFocus} ticketInfo={ticketInfo} refreshKey={tickets} onChanged={() => void refreshAll()} />
        ) : (
        <>
        {refreshError && phase === 'ready' && (
          <StatusBanner
            tone="warning"
            announce="alert"
            title="Vos billets n’ont pas pu être mis à jour"
            action={(
              <Button variant="secondary" size="sm" onClick={() => void refreshTickets()} leftIcon={<RefreshCw size={16} />}>
                Réessayer
              </Button>
            )}
          >
            {refreshError} Les billets affichés sont ceux du dernier chargement ; le QR code reste valable.
          </StatusBanner>
        )}

        {phase === 'loading' || (tab !== 'a-venir' && !complete && !fullError) ? (
          <div className="flex items-start gap-3 overflow-hidden md:grid md:grid-cols-2 md:gap-6" aria-busy="true">
            <span className="sr-only">Chargement de vos billets…</span>
            <div className="w-[calc(100%-2rem)] shrink-0 md:w-auto"><TicketSkeleton /></div>
            <div className="w-[calc(100%-2rem)] shrink-0 md:w-auto"><TicketSkeleton /></div>
          </div>
        ) : phase === 'error' ? (
          <ErrorState
            title="Impossible d’afficher vos billets"
            description={loadError ?? NETWORK_MESSAGE}
            onRetry={() => void retry()}
            isRetrying={isRetrying}
          />
        ) : tab !== 'a-venir' && !complete ? (
          <ErrorState
            title="Impossible d’afficher vos billets"
            description={fullError ?? NETWORK_MESSAGE}
            onRetry={() => setFullAttempt((n) => n + 1)}
          />
        ) : shown.length > 0 ? (
          <>
          <TicketWallet
            label={tab === 'a-venir' ? 'Billets à venir' : tab === 'historique' ? 'Historique de vos billets' : 'Tous vos billets'}
            total={shown.length}
            onEndReached={more}
            items={shown.slice(0, limit).map((ticket, index) => ({
              key: ticket.id,
              // Décision du 19/11 (option 1) : vignette légère tant que le billet n'est pas à l'écran ou touché
              thumb: (open: () => void) => (
                <TicketThumb
                  title={ticket.eventTitle}
                  ticketNumber={ticket.ticketNumber}
                  seat={ticket.seat}
                  dateFormatted={ticket.dateFormatted}
                  timeFormatted={ticket.timeFormatted}
                  venue={ticket.venue}
                  categoryColor={ticket.categoryColor ?? null}
                  onOpen={open}
                />
              ),
              node: (
                <TicketCard
                  // Design 1b (décision du 18/11) : seul le premier billet démarre tout de suite (code, lot hors ligne, QR)
                  eager={index === 0}
                  id={ticket.id}
                  eventId={ticket.eventId}
                  ticketNumber={ticket.ticketNumber}
                  eventTitle={ticket.eventTitle}
                  eventSubtitle={ticket.eventSubtitle}
                  eventImageUrl={ticket.eventImageUrl}
                  dateFormatted={ticket.dateFormatted}
                  timeFormatted={ticket.timeFormatted}
                  venue={ticket.venue}
                  seat={ticket.seat}
                  status={ticket.status}
                  usedAt={ticket.usedAt}
                  isTransferLocked={ticket.isTransferLocked}
                  activeTransfer={ticket.activeTransfer}
                  offline={ticket.offline ?? null}
                  price={ticket.price}
                  serviceFee={ticket.serviceFee ?? 0}
                  saleChannel={ticket.saleChannel ?? null}
                  eventStatus={ticket.eventStatus}
                  codeVisible={ticket.codeVisible === true}
                  transferAllowed={ticket.transferAllowed === true}
                  eventNotice={ticket.eventNotice ?? null}
                  refundDelayed={ticket.refundDelayed === true}
                  postponementRefund={ticket.postponementRefund ?? null}
                  categoryColor={ticket.categoryColor ?? null}
                  tableInvitedBy={ticket.table?.invitedBy ?? null}
                  tableBookingId={ticket.table?.bookingId ?? null}
                  onOpenTable={openTable}
                  startsAt={ticket.startsAt ?? null}
                  endsAt={ticket.endsAt ?? null}
                  now={now}
                  onRefunded={() => void refreshTickets()}
                  onTransferClick={() =>
                    setTransferTicket({
                      id: ticket.id,
                      ticketNumber: ticket.ticketNumber,
                      eventTitle: ticket.eventTitle,
                      dateFormatted: ticket.dateFormatted,
                      timeFormatted: ticket.timeFormatted,
                      seat: ticket.seat,
                      venue: ticket.venue,
                    })
                  }
                  onCancelTransferSuccess={() => void refreshTickets()}
                  onOpenExplainer={() => setIsExplainerOpen(true)}
                />
              ),
            }))}
          />
          {shown.length > limit && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={more}>
                {`Afficher les billets suivants (${shown.length - limit} restant${shown.length - limit > 1 ? 's' : ''})`}
              </Button>
            </div>
          )}
          </>
        ) : (
          <EmptyState illustrated
            icon={<Ticket size={28} />}
            title={empty?.title}
            description={empty?.description}
            actionLabel="Explorer les événements"
            actionHref="/explore"
          />
        )}
        </>
        )}
      </TabPanel>

      {transferTicket && (
        <TransferModal
          isOpen
          onClose={() => setTransferTicket(null)}
          ticket={transferTicket}
          onTransferSuccess={() => void refreshTickets()}
          onOpenExplainer={() => {
            setTransferTicket(null);
            setIsExplainerOpen(true);
          }}
        />
      )}

      {isExplainerOpen && <TransferExplainerModal isOpen onClose={() => setIsExplainerOpen(false)} />}

      {celebrate && phase === 'ready' && <PurchaseCelebration onDone={endCelebration} />}

      {/* Design 1d (point 10) : tirer pour actualiser (écrans tactiles), même relecture que le temps réel. EN DERNIER : en
          tête de ce conteneur (space-y-6), son arrivée après le chargement donnait une marge de 24 px à l'en-tête et
          faisait descendre toute la page (run 485, saut de 0,049) */}
      <PullToRefresh onRefresh={refreshAll} />
    </div>
  );
}
