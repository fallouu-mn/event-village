'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ClipboardCheck, MapPin, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, TabPanel, useTabParam, type TabItem } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { Pagination } from '@/components/ui/Pagination';
import { TextInput } from '@/components/ui/Field';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { LinkButton } from '@/components/ui/LinkButton';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { EVENT_STATUS_META, isEventStatus, type EventStatus } from '@/lib/events/event-status';
import { formatDateTime, formatEventDateTime, toDakarDateTimeLocal } from '@/lib/format';

/**
 * Lot 5 (tâche 5.7, contrat G ; 5.13, contrat O5) — file de validation et liste des événements pour
 * l'administration.
 *  - Onglets par statut (libellés de EVENT_STATUS_META) avec les compteurs du serveur, « En attente de
 *    validation » par défaut ; l'onglet courant est porté par `?status=` (lien direct vers la file).
 *  - Recherche littérale dans le titre (anti-rebond de 300 ms), pagination serveur (20 par page).
 *  - Mise à jour en direct : une soumission (admin_signals) ou un changement de statut
 *    (event_status_history) recharge la page courante depuis le serveur, sans toucher au défilement.
 *  - Aucun chiffre calculé ici : `items`, `total` et `counts` viennent de GET /api/admin/events.
 */

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const ALL_TAB = 'TOUS';

/** Ordre des onglets : la file de validation d'abord, puis le cycle de vie. */
const TAB_ORDER = ['EN_ATTENTE', 'PUBLIE', 'VALIDE', 'SUSPENDU', 'BROUILLON', 'TERMINE', 'ANNULE', ALL_TAB] as const;
type TabValue = (typeof TAB_ORDER)[number];
const DEFAULT_TAB: TabValue = 'EN_ATTENTE';
const ID_PREFIX = 'admin-evenements';

interface AdminEventItem {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  start_time: string | null;
  location: string | null;
  city: string | null;
  submitted_at: string | null;
  created_at: string | null;
  partner: { id: string; company_name: string | null } | null;
}

interface AdminEventsResponse {
  items: AdminEventItem[];
  page: number;
  pageSize: number;
  total: number;
  counts: Partial<Record<EventStatus, number>>;
}

type Phase = 'loading' | 'ready' | 'error';

function readError(body: unknown): string | null {
  if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return null;
}

function isListResponse(body: unknown): body is AdminEventsResponse {
  return !!body && typeof body === 'object' && Array.isArray((body as AdminEventsResponse).items)
    && typeof (body as AdminEventsResponse).total === 'number';
}

function tabLabel(tab: TabValue): string {
  return tab === ALL_TAB ? 'Tous' : EVENT_STATUS_META[tab].label;
}

function ListSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement des événements" className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-3/4 max-w-sm" />
            <Skeleton className="h-4 w-1/2 max-w-xs" />
          </div>
          <Skeleton className="h-7 w-32" />
        </div>
      ))}
    </div>
  );
}

export default function AdminEventsPage() {
  const toast = useToast();
  const [tab, setTab] = useTabParam<TabValue>(TAB_ORDER, DEFAULT_TAB, 'status');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<AdminEventsResponse | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const requestSeq = useRef(0);
  const hasData = useRef(false);

  // Recherche : appliquée 300 ms après la dernière frappe (ou tout de suite à la validation du champ).
  useEffect(() => {
    const next = searchInput.trim();
    if (next === query) return undefined;
    const timer = setTimeout(() => {
      setQuery(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, query]);

  const load = useCallback(async (silent: boolean) => {
    const seq = ++requestSeq.current;
    if (!silent) {
      setPhase('loading');
      setErrorMessage(null);
    }
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (tab !== ALL_TAB) params.set('status', tab);
    if (query) params.set('q', query);
    try {
      const res = await fetch(`/api/admin/events?${params.toString()}`, { cache: 'no-store' });
      const body: unknown = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (!res.ok || !isListResponse(body)) {
        throw new Error(readError(body) ?? 'Impossible de charger les événements pour le moment.');
      }
      setData(body);
      hasData.current = true;
      setPhase('ready');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      const message = err instanceof Error && err.message && !/fetch|network/i.test(err.message)
        ? err.message
        : 'Impossible de charger les événements. Vérifiez votre connexion, puis réessayez.';
      console.error('[admin/events] chargement de la liste en échec', err);
      if (silent && hasData.current) {
        toast.error('La liste n’a pas pu être mise à jour. Les informations affichées sont celles du dernier chargement.');
        return;
      }
      setErrorMessage(message);
      setPhase('error');
    }
  }, [page, tab, query, toast]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refreshSilently = useCallback(() => load(true), [load]);

  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: 'admin-evenements',
    subscriptions: [
      { table: 'admin_signals', event: 'INSERT' },
      { table: 'event_status_history', event: 'INSERT' },
    ],
    onSignal: refreshSilently,
  });

  const retry = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await load(false);
    } finally {
      setIsRetrying(false);
    }
  };

  const changeTab = (next: string): void => {
    if (!(TAB_ORDER as readonly string[]).includes(next)) return;
    setTab(next as TabValue);
    setPage(1);
  };

  const clearSearch = (): void => {
    setSearchInput('');
    setQuery('');
    setPage(1);
  };

  const tabs: TabItem[] = useMemo(() => TAB_ORDER.map((t) => ({
    id: t,
    label: tabLabel(t),
    count: t !== ALL_TAB && data ? Number(data.counts[t] ?? 0) : undefined,
  })), [data]);

  const columns: DataColumn<AdminEventItem>[] = [
    {
      key: 'title',
      header: 'Événement',
      render: (ev) => (
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href={`/admin/events/${ev.id}`}
            className="flex min-h-11 items-center rounded font-semibold text-fg underline-offset-4 hover:text-brand-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ev.title}
          </Link>
          {(ev.location || ev.city) && (
            <span className="text-sm text-fg-muted">{[ev.location, ev.city].filter(Boolean).join(', ')}</span>
          )}
        </div>
      ),
    },
    {
      key: 'organizer',
      header: 'Organisateur',
      render: (ev) => <span className="break-words">{ev.partner?.company_name ?? 'Organisateur inconnu'}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (ev) => <span className="whitespace-nowrap tabular-nums">{formatEventDateTime(ev.start_date, ev.start_time)}</span>,
    },
    {
      key: 'statut',
      header: 'Statut',
      render: (ev) => <StatusBadge domain="event" status={ev.status} size="sm" />,
    },
    {
      key: 'submitted',
      header: 'Soumis le',
      render: (ev) => (ev.submitted_at
        ? <time dateTime={toDakarDateTimeLocal(ev.submitted_at)} className="whitespace-nowrap text-sm tabular-nums text-fg-muted">{formatDateTime(ev.submitted_at)}</time>
        : <span className="text-sm text-fg-muted">Jamais soumis</span>),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'right',
      render: (ev) => (
        <LinkButton href={`/admin/events/${ev.id}`} variant="secondary" size="sm">
          Examiner
        </LinkButton>
      ),
    },
  ];

  const renderCard = (ev: AdminEventItem) => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/admin/events/${ev.id}`}
          className="flex min-h-11 min-w-0 items-center break-words rounded text-base font-semibold text-fg underline-offset-4 hover:text-brand-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ev.title}
        </Link>
        <StatusBadge domain="event" status={ev.status} size="sm" className="flex-shrink-0" />
      </div>
      <dl className="flex flex-col gap-1.5 text-sm text-fg-muted">
        <div className="flex items-start gap-2">
          <dt className="sr-only">Organisateur</dt>
          <dd className="font-medium text-fg">{ev.partner?.company_name ?? 'Organisateur inconnu'}</dd>
        </div>
        <div className="flex items-start gap-2">
          <dt className="mt-0.5 flex-shrink-0"><CalendarDays size={16} aria-hidden="true" /><span className="sr-only">Date</span></dt>
          <dd className="tabular-nums">{formatEventDateTime(ev.start_date, ev.start_time)}</dd>
        </div>
        {(ev.location || ev.city) && (
          <div className="flex items-start gap-2">
            <dt className="mt-0.5 flex-shrink-0"><MapPin size={16} aria-hidden="true" /><span className="sr-only">Lieu</span></dt>
            <dd className="min-w-0 break-words">{[ev.location, ev.city].filter(Boolean).join(', ')}</dd>
          </div>
        )}
        {ev.submitted_at && (
          <div className="flex items-start gap-2">
            <dt className="flex-shrink-0">Soumis le</dt>
            <dd><time dateTime={toDakarDateTimeLocal(ev.submitted_at)} className="tabular-nums">{formatDateTime(ev.submitted_at)}</time></dd>
          </div>
        )}
      </dl>
      <LinkButton href={`/admin/events/${ev.id}`} variant="secondary" fullWidth>
        Examiner la fiche
      </LinkButton>
    </div>
  );

  const emptyState = (() => {
    if (query) {
      return (
        <EmptyState
          icon={<Search size={28} />}
          title="Aucun résultat"
          description={`Aucun événement de l’onglet « ${tabLabel(tab)} » ne contient « ${query} » dans son titre.`}
          actionLabel="Effacer la recherche"
          onAction={clearSearch}
        />
      );
    }
    if (tab === 'EN_ATTENTE') {
      return (
        <EmptyState
          icon={<ClipboardCheck size={28} />}
          title="Aucun événement à valider"
          description="Les nouvelles soumissions des organisateurs apparaissent ici en direct."
        />
      );
    }
    if (tab === ALL_TAB) {
      return <EmptyState title="Aucun événement" description="Aucun organisateur n’a encore créé d’événement." />;
    }
    return (
      <EmptyState
        title={`Aucun événement « ${EVENT_STATUS_META[tab].label} »`}
        description={EVENT_STATUS_META[tab].description}
      />
    );
  })();

  const currentStatusHint = tab !== ALL_TAB && isEventStatus(tab) ? EVENT_STATUS_META[tab].description : 'Tous les événements de la plateforme, quel que soit leur statut.';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Événements"
        description="Examinez les soumissions des organisateurs, puis suivez chaque événement tout au long de son cycle de vie."
        actions={<LiveIndicator status={liveStatus} />}
      />

      <form
        role="search"
        aria-label="Rechercher un événement"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(searchInput.trim());
          setPage(1);
        }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <TextInput
          type="search"
          label="Rechercher par titre"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Titre de l’événement"
          autoComplete="off"
          maxLength={100}
          fieldClassName="flex-1 sm:max-w-md"
        />
        {searchInput && (
          <Button type="button" variant="ghost" onClick={clearSearch}>
            Effacer
          </Button>
        )}
      </form>

      <Tabs tabs={tabs} value={tab} onChange={changeTab} ariaLabel="Statut des événements" idPrefix={ID_PREFIX} />

      <TabPanel idPrefix={ID_PREFIX} tabIdValue={tab} className="flex flex-col gap-4">
        <p className="text-sm text-fg-muted">{currentStatusHint}</p>

        {phase === 'loading' && <ListSkeleton />}

        {phase === 'error' && (
          <ErrorState
            title="Liste indisponible"
            description={errorMessage ?? 'Impossible de charger les événements. Vérifiez votre connexion, puis réessayez.'}
            onRetry={() => void retry()}
            isRetrying={isRetrying}
          />
        )}

        {phase === 'ready' && data && (
          <>
            <DataList
              items={data.items}
              columns={columns}
              getKey={(ev) => ev.id}
              caption={`Événements : ${tabLabel(tab)}`}
              renderCard={renderCard}
              empty={emptyState}
            />
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(next) => {
                setPage(next);
                window.scrollTo({ top: 0 });
              }}
              ariaLabel="Pages des événements"
            />
          </>
        )}
      </TabPanel>
    </div>
  );
}
