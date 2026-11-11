'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { HelpCircle, RefreshCw, Sparkles, Ticket, WifiOff } from 'lucide-react';
import { TicketCard, type TicketCardProps } from '@/components/tickets/TicketCard';
import type { TransferTicketData } from '@/components/tickets/TransferModal';
import { IncomingTransfers, readIncomingTransfers, type IncomingTransfersData } from '@/components/tickets/IncomingTransfers';
import { reconcileWithServerTickets } from '@/components/tickets/OfflineTicketsSync';
import { Button, buttonClasses } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TabPanel, useTabParam } from '@/components/ui/Tabs';
import { ScrollableTabs } from '@/components/ui/ScrollableTabs';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { OfflineAvailability } from '@/lib/tickets/offline-clock';

// Lot 7 (7.5) : les modales ne sont chargées qu'à leur ouverture (poids JS de /tickets).
const TransferModal = dynamic(() => import('@/components/tickets/TransferModal').then((m) => m.TransferModal), { ssr: false });
const TransferExplainerModal = dynamic(() => import('@/components/tickets/TransferExplainerModal').then((m) => m.TransferExplainerModal), { ssr: false });

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
 */

type TicketStatus = TicketCardProps['status'];

interface MyTicket {
  id: string;
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
}

const TABS = ['a-venir', 'tous', 'historique', 'recus'] as const;
type TabKey = typeof TABS[number];
type TicketTabKey = Exclude<TabKey, 'recus'>;

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

type LoadResult = { ok: true; tickets: MyTicket[] } | { ok: false; message: string };

async function readTickets(): Promise<LoadResult> {
  let res: Response;
  try {
    res = await fetch('/api/tickets', { cache: 'no-store' });
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
  return { ok: true, tickets: payload.tickets as MyTicket[] };
}

function isActiveUpcoming(t: MyTicket): boolean {
  return t.status === 'VALIDE' && t.isUpcoming;
}

function TicketSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-border bg-surface" aria-hidden="true">
      <div className="h-32 w-full bg-surface-sunken motion-safe:animate-pulse" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-2/3 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-4 w-1/2 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
        <div className="mx-auto h-40 w-40 rounded-2xl bg-surface-sunken motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const { user, profile, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;
  const [tab, setTab] = useTabParam(TABS, 'a-venir');
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

  /** « initial » : écran d'erreur si l'échec survient ; « silent » : la liste reste, un bandeau le signale. */
  const load = useCallback(async (mode: 'initial' | 'silent') => {
    const result = await readTickets();
    if (result.ok) {
      setTickets(result.tickets);
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
  }, []);

  const refreshTickets = useCallback(() => load('silent'), [load]);

  // Lot 7 (7.1) : réconciliation des billets enregistrés hors ligne après chaque chargement réussi.
  useEffect(() => {
    if (phase !== 'ready' || !userId) return;
    void reconcileWithServerTickets(userId, tickets);
  }, [phase, tickets, userId]);

  /** R45 : la bascule vers « Reçus » n'a lieu qu'une fois, au premier chargement. */
  const autoTabDoneRef = useRef(false);

  /** Billets reçus : erreur affichée dans l'onglet « Reçus », la liste précédente reste sinon. */
  const loadIncoming = useCallback(async (mode: 'initial' | 'silent') => {
    const result = await readIncomingTransfers();
    if (result.ok) {
      setIncoming({ items: result.items, phoneVerificationRequired: result.phoneVerificationRequired });
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

  useEffect(() => {
    if (isAuthLoading || !userId) return;
    void load('initial');
    void loadIncoming('initial');
  }, [isAuthLoading, userId, load, loadIncoming]);

  // Temps réel (contrat O5) : billets du porteur et notifications (transfert reçu, accepté, annulé).
  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: `mes-billets-${userId ?? 'anonyme'}`,
    subscriptions: [
      { table: 'tickets', filter: `user_id=eq.${userId ?? ''}` },
      { table: 'notifications', filter: `user_id=eq.${userId ?? ''}`, event: 'INSERT' },
    ],
    onSignal: refreshAll,
    enabled: Boolean(userId),
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
    if (tab === 'a-venir') return tickets.filter(isActiveUpcoming);
    if (tab === 'historique') return tickets.filter((t) => !isActiveUpcoming(t));
    return tickets;
  }, [tickets, tab]);

  const tabItems = useMemo(() => [
    { id: 'a-venir', label: 'À venir' },
    { id: 'tous', label: 'Tous mes billets' },
    { id: 'historique', label: 'Historique' },
    { id: 'recus', label: 'Reçus', ...(incomingPhase === 'ready' && incoming.items.length > 0 ? { count: incoming.items.length } : {}) },
  ], [incomingPhase, incoming.items.length]);

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <EmptyState
          icon={<Ticket size={28} />}
          title="Connectez-vous pour voir vos billets"
          description="Vos billets électroniques et leur QR code d’entrée sont liés à votre compte."
          actionLabel="Se connecter"
          actionHref="/login?redirect=%2Ftickets"
        />
      </div>
    );
  }

  const empty = tab === 'recus' ? null : EMPTY_COPY[tab];

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Mes billets"
        description="Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la page ouverte."
        eyebrow={<LiveIndicator status={liveStatus} />}
        actions={(
          <>
            <a href="/billet/hors-ligne" className={buttonClasses({ variant: 'secondary' })}>
              <WifiOff size={18} aria-hidden="true" />
              Afficher mes billets hors ligne
            </a>
            <Button variant="secondary" onClick={() => setIsExplainerOpen(true)} leftIcon={<HelpCircle size={18} />}>
              Comment marche le transfert ?
            </Button>
            <LinkButton href="/explore" leftIcon={<Sparkles size={18} />}>
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

        {isAuthLoading || phase === 'loading' ? (
          <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2" aria-busy="true">
            <TicketSkeleton />
            <TicketSkeleton />
          </div>
        ) : phase === 'error' ? (
          <ErrorState
            title="Impossible d’afficher vos billets"
            description={loadError ?? NETWORK_MESSAGE}
            onRetry={() => void retry()}
            isRetrying={isRetrying}
          />
        ) : shown.length > 0 ? (
          <ul className="grid grid-cols-1 items-start gap-6 md:grid-cols-2">
            {shown.map((ticket) => (
              <li key={ticket.id} className="min-w-0">
                <TicketCard
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
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
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
    </div>
  );
}
