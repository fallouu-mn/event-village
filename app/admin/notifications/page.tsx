'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, ChevronRight, MessageSquareText, RefreshCw, Search, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select, TextInput } from '@/components/ui/Field';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/KpiCard';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ScrollableTabs } from '@/components/ui/ScrollableTabs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TabPanel, useTabParam, type TabItem } from '@/components/ui/Tabs';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { formatDateTime, formatInteger } from '@/lib/format';
import {
  OUTBOX_CHANNELS,
  OUTBOX_STATUSES,
  OUTBOX_TYPE_LABELS,
  outboxChannelLabel,
  outboxReasonLabel,
  outboxStatusLabel,
  outboxTypeLabel,
  type OutboxStatus,
} from '@/lib/notifications/outbox-labels';

/**
 * Supervision des notifications (lot 6, contrats L2 à L4).
 *  - Liste : GET /api/admin/notifications (filtres statut, canal, type, période, recherche ; 20 par page),
 *    destinataire masqué par le serveur ; compteurs par statut servis par le serveur (onglets).
 *  - Compteurs : GET /api/admin/notifications/stats (SMS du jour et seuil d'alerte, SMS du mois, par jour et
 *    par canal) ; aucun chiffre n'est calculé dans le navigateur.
 *  - Libellés humains (lib/notifications/outbox-labels.ts) : aucun code de statut, de canal, de type ni de motif.
 *  - Accès : permission notifications.read ; un 403 donne un état « Accès refusé » distinct de l'erreur.
 *  - En direct : un signal admin d'échec d'envoi ou de volume de SMS recharge la liste et les compteurs.
 *  - « Relancer » n'est jamais proposé ici : seulement sur le détail d'une notification en échec.
 */

interface OutboxItem {
  id: string;
  created_at: string;
  type: string;
  channel: string;
  status: string;
  reason: string | null;
  attempts: number;
  recipient_masked: string;
  event_title: string | null;
  sent_at: string | null;
}

interface ListBody {
  items: OutboxItem[];
  page: number;
  total: number;
  counts: Partial<Record<OutboxStatus, number>>;
}

interface DayRow {
  day: string;
  channel: string;
  sent: number;
  failed: number;
  skipped: number;
  uncertain: number;
  cancelled: number;
}

interface StatsBody {
  days: number;
  byDay: DayRow[];
  smsMonth: { month: string; sent: number; uncertain: number; otp: number };
  smsToday: number;
  threshold: number | null;
}

type Fetched<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

const PAGE_SIZE = 20;
const STATUS_TABS = ['tous', ...OUTBOX_STATUSES] as const;
type StatusTab = typeof STATUS_TABS[number];
const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';
const FORBIDDEN_MESSAGE = "Vous n'avez pas la permission de consulter les notifications.";

const TYPE_OPTIONS = Object.entries(OUTBOX_TYPE_LABELS)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
const CHANNEL_OPTIONS = OUTBOX_CHANNELS.map((c) => ({ value: c, label: outboxChannelLabel(c) }));

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v ?? 0) || 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

async function fetchJson<T>(url: string, parse: (body: unknown) => T | null, what: string): Promise<Fetched<T>> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (err) {
    console.error(`[Supervision des notifications] ${what} injoignable :`, err instanceof Error ? err.message : String(err));
    return { ok: false, status: 0, message: NETWORK_MESSAGE };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch (err) {
    console.error(`[Supervision des notifications] ${what} illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return { ok: false, status: res.status, message: `Réponse inattendue du serveur (erreur ${res.status}).` };
  }
  if (!res.ok) {
    const message = isRecord(body) && typeof body.error === 'string' && body.error ? body.error : `Chargement impossible (erreur ${res.status}).`;
    return { ok: false, status: res.status, message };
  }
  const data = parse(body);
  if (!data) {
    console.error(`[Supervision des notifications] ${what} : réponse inattendue`, body);
    return { ok: false, status: res.status, message: 'Réponse inattendue du serveur.' };
  }
  return { ok: true, data };
}

function parseList(body: unknown): ListBody | null {
  if (!isRecord(body) || !Array.isArray(body.items)) return null;
  const items: OutboxItem[] = body.items.flatMap((raw: unknown) => {
    if (!isRecord(raw) || typeof raw.id !== 'string') return [];
    return [{
      id: raw.id,
      created_at: str(raw.created_at) ?? '',
      type: str(raw.type) ?? '',
      channel: str(raw.channel) ?? '',
      status: str(raw.status) ?? '',
      reason: str(raw.reason),
      attempts: num(raw.attempts),
      recipient_masked: str(raw.recipient_masked) ?? 'Destinataire inconnu',
      event_title: str(raw.event_title),
      sent_at: str(raw.sent_at),
    }];
  });
  const counts: Partial<Record<OutboxStatus, number>> = {};
  if (isRecord(body.counts)) {
    for (const s of OUTBOX_STATUSES) if (body.counts[s] !== undefined) counts[s] = num(body.counts[s]);
  }
  return { items, page: num(body.page) || 1, total: num(body.total), counts };
}

function parseStats(body: unknown): StatsBody | null {
  if (!isRecord(body) || !Array.isArray(body.by_day) || !isRecord(body.sms_month)) return null;
  const byDay: DayRow[] = body.by_day.flatMap((raw: unknown) => {
    if (!isRecord(raw) || typeof raw.day !== 'string' || typeof raw.channel !== 'string') return [];
    return [{
      day: raw.day,
      channel: raw.channel,
      sent: num(raw.sent),
      failed: num(raw.failed),
      skipped: num(raw.skipped),
      uncertain: num(raw.uncertain),
      cancelled: num(raw.cancelled),
    }];
  });
  const m = body.sms_month;
  return {
    days: num(body.days),
    byDay,
    smsMonth: { month: str(m.month) ?? '', sent: num(m.sent), uncertain: num(m.uncertain), otp: num(m.otp) },
    smsToday: num(body.sms_today),
    threshold: typeof body.threshold === 'number' ? body.threshold : null,
  };
}

/** Jour de Dakar « AAAA-MM-JJ » renvoyé par le serveur, affiché « 3 nov. 2026 » (sans conversion de fuseau). */
function formatDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return '—';
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function formatMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return 'ce mois-ci';
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15));
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-2xl border border-border bg-surface motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

export default function AdminNotificationsPage() {
  const [status, setStatus] = useTabParam(STATUS_TABS, 'tous', 'status');
  const [channel, setChannel] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const [list, setList] = useState<ListBody | null>(null);
  const [listPhase, setListPhase] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [listError, setListError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [stats, setStats] = useState<StatsBody | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const requestSeq = useRef(0);

  // Recherche : anti-rebond de 300 ms, retour en page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listUrl = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status !== 'tous') params.set('status', status);
    if (channel) params.set('channel', channel);
    if (type) params.set('type', type);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (q) params.set('q', q);
    return `/api/admin/notifications?${params.toString()}`;
  }, [page, status, channel, type, from, to, q]);

  const loadList = useCallback(async (mode: 'initial' | 'silent') => {
    const seq = ++requestSeq.current;
    setIsFetching(true);
    const res = await fetchJson(listUrl, parseList, 'liste');
    if (seq !== requestSeq.current) return;
    setIsFetching(false);
    if (res.ok) {
      setList(res.data);
      setListError(null);
      setRefreshError(null);
      setListPhase('ready');
      return;
    }
    if (res.status === 403) {
      setListPhase('forbidden');
      return;
    }
    if (mode === 'initial' || !list) {
      setListError(res.message);
      setListPhase('error');
    } else {
      setRefreshError(res.message);
    }
  }, [listUrl, list]);

  const loadStats = useCallback(async () => {
    const res = await fetchJson('/api/admin/notifications/stats?days=14', parseStats, 'compteurs');
    if (res.ok) {
      setStats(res.data);
      setStatsError(null);
    } else if (res.status !== 403) {
      setStatsError(res.message);
    }
  }, []);

  useEffect(() => {
    void loadList(list ? 'silent' : 'initial');
    // La liste se recharge quand les filtres changent (listUrl) ; `list` n'est lu qu'à l'appel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listUrl]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadList('silent'), loadStats()]);
  }, [loadList, loadStats]);

  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: 'admin-notifications',
    subscriptions: [{ table: 'admin_signals', event: 'INSERT', filter: 'kind=in.(NOTIFICATION_FAILED,SMS_DAILY_THRESHOLD)' }],
    onSignal: refreshAll,
  });

  const retry = async () => {
    setIsRetrying(true);
    try {
      await Promise.all([loadList('initial'), loadStats()]);
    } finally {
      setIsRetrying(false);
    }
  };

  const tabs = useMemo<TabItem[]>(() => [
    { id: 'tous', label: 'Toutes' },
    ...OUTBOX_STATUSES.map((s) => ({
      id: s,
      label: outboxStatusLabel(s),
      ...(list?.counts[s] !== undefined ? { count: list.counts[s] } : {}),
    })),
  ], [list]);

  const columns: DataColumn<OutboxItem>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (n) => <time dateTime={n.created_at} className="whitespace-nowrap tabular-nums">{formatDateTime(n.created_at)}</time>,
    },
    {
      key: 'type',
      header: 'Type',
      render: (n) => (
        <span className="block min-w-0">
          <span className="block font-semibold">{outboxTypeLabel(n.type)}</span>
          {n.event_title && <span className="block text-fg-muted">{n.event_title}</span>}
        </span>
      ),
    },
    { key: 'canal', header: 'Canal', render: (n) => outboxChannelLabel(n.channel) },
    { key: 'destinataire', header: 'Destinataire', render: (n) => <span className="break-words">{n.recipient_masked}</span> },
    { key: 'statut', header: 'Statut', render: (n) => <StatusBadge domain="notification" status={n.status} size="sm" /> },
    { key: 'motif', header: 'Motif', render: (n) => outboxReasonLabel(n.reason) ?? '—' },
    {
      key: 'detail',
      header: 'Détail',
      hideOnCard: true,
      render: (n) => (
        <LinkButton href={`/admin/notifications/${n.id}`} variant="ghost" size="sm" rightIcon={<ChevronRight size={16} aria-hidden="true" />} aria-label={`Voir le détail : ${outboxTypeLabel(n.type)}, ${formatDateTime(n.created_at)}`}>
          Voir
        </LinkButton>
      ),
    },
  ];

  const renderCard = (n: OutboxItem) => (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 font-semibold text-fg">{outboxTypeLabel(n.type)}</p>
        <StatusBadge domain="notification" status={n.status} size="sm" />
      </div>
      {n.event_title && <p className="text-fg-muted">{n.event_title}</p>}
      <p className="text-fg">
        {outboxChannelLabel(n.channel)} · <span className="break-words">{n.recipient_masked}</span>
      </p>
      {n.reason && <p className="text-fg-muted">{outboxReasonLabel(n.reason)}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <time dateTime={n.created_at} className="tabular-nums text-fg-muted">{formatDateTime(n.created_at)}</time>
        <LinkButton href={`/admin/notifications/${n.id}`} variant="secondary" size="sm" rightIcon={<ChevronRight size={16} aria-hidden="true" />}>
          Voir le détail
        </LinkButton>
      </div>
    </div>
  );

  const dayColumns: DataColumn<DayRow>[] = [
    { key: 'jour', header: 'Jour', render: (d) => formatDay(d.day) },
    { key: 'canal', header: 'Canal', render: (d) => outboxChannelLabel(d.channel) },
    { key: 'envoyees', header: 'Envoyées', align: 'right', render: (d) => <span className="tabular-nums">{formatInteger(d.sent)}</span> },
    { key: 'echecs', header: 'En échec', align: 'right', render: (d) => <span className="tabular-nums">{formatInteger(d.failed)}</span> },
    { key: 'non-envoyees', header: 'Non envoyées', align: 'right', render: (d) => <span className="tabular-nums">{formatInteger(d.skipped)}</span> },
    { key: 'incertaines', header: 'Incertaines', align: 'right', render: (d) => <span className="tabular-nums">{formatInteger(d.uncertain)}</span> },
    { key: 'annulees', header: 'Annulées', align: 'right', render: (d) => <span className="tabular-nums">{formatInteger(d.cancelled)}</span> },
  ];

  const resetFilters = () => {
    setChannel('');
    setType('');
    setFrom('');
    setTo('');
    setSearchInput('');
    setQ('');
    setPage(1);
  };
  const hasFilters = Boolean(channel || type || from || to || q || status !== 'tous');

  if (listPhase === 'forbidden') {
    return (
      <div className="space-y-6 pb-24 lg:pb-12">
        <PageHeader title="Notifications" description="Supervision des envois : application, SMS, email et notifications push." />
        <EmptyState
          icon={<ShieldOff size={28} />}
          title="Accès refusé"
          description={FORBIDDEN_MESSAGE}
          actionLabel="Retour à l’administration"
          actionHref="/admin/dashboard"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Notifications"
        description="Supervision des envois : application, SMS, email et notifications push. Les chiffres sont ceux du serveur, en jours de Dakar."
        eyebrow={<LiveIndicator status={liveStatus} />}
      />

      <section aria-labelledby="notif-compteurs" className="space-y-3">
        <h2 id="notif-compteurs" className="sr-only">Compteurs</h2>
        {statsError && !stats && (
          <StatusBanner
            tone="warning"
            title="Compteurs indisponibles"
            action={(
              <Button variant="secondary" size="sm" onClick={() => void loadStats()} leftIcon={<RefreshCw size={16} aria-hidden="true" />}>
                Réessayer
              </Button>
            )}
          >
            {statsError}
          </StatusBanner>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats ? (
            <>
              <KpiCard
                label="SMS aujourd'hui"
                value={formatInteger(stats.smsToday)}
                hint={stats.threshold !== null ? `Seuil d’alerte : ${formatInteger(stats.threshold)} par jour` : 'Seuil d’alerte non réglé'}
                tone={stats.threshold !== null && stats.smsToday >= stats.threshold ? 'warning' : 'neutral'}
                icon={<MessageSquareText size={20} aria-hidden="true" />}
              />
              <KpiCard
                label="SMS ce mois-ci"
                value={formatInteger(stats.smsMonth.sent)}
                hint={`Envoyés en ${formatMonth(stats.smsMonth.month)}, dont ${formatInteger(stats.smsMonth.otp)} codes ; et ${formatInteger(stats.smsMonth.uncertain)} à la remise incertaine, facturés par le fournisseur`}
                tone="info"
                icon={<BellRing size={20} aria-hidden="true" />}
              />
            </>
          ) : statsError ? null : (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="notif-liste" className="space-y-4">
        <h2 id="notif-liste" className="text-lg font-semibold text-fg">Envois</h2>

        <ScrollableTabs
          tabs={tabs}
          value={status}
          onChange={(id) => {
            setPage(1);
            setStatus(id as StatusTab);
          }}
          ariaLabel="Filtrer par statut"
          idPrefix="notif-statut"
        />

        <form role="search" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3">
          <TextInput
            label="Rechercher"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Numéro, email ou titre de l’événement"
            fieldClassName="sm:col-span-2 lg:col-span-3"
          />
          <Select
            label="Canal"
            value={channel}
            onChange={(e) => { setChannel(e.target.value); setPage(1); }}
            options={[{ value: '', label: 'Tous les canaux' }, ...CHANNEL_OPTIONS]}
          />
          <Select
            label="Type"
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            options={[{ value: '', label: 'Tous les types' }, ...TYPE_OPTIONS]}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Du" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
            <TextInput label="Au" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
          {hasFilters && (
            <div className="sm:col-span-2 lg:col-span-3">
              <Button type="button" variant="ghost" size="sm" leftIcon={<Search size={16} aria-hidden="true" />} onClick={() => { resetFilters(); setStatus('tous'); }}>
                Effacer les filtres
              </Button>
            </div>
          )}
        </form>

        <TabPanel idPrefix="notif-statut" tabIdValue={status} className="space-y-4">
          {refreshError && listPhase === 'ready' && (
            <StatusBanner
              tone="warning"
              announce="alert"
              title="La liste n’a pas pu être mise à jour"
              action={(
                <Button variant="secondary" size="sm" onClick={() => void loadList('silent')} leftIcon={<RefreshCw size={16} aria-hidden="true" />}>
                  Réessayer
                </Button>
              )}
            >
              {refreshError} Les lignes affichées sont celles du dernier chargement.
            </StatusBanner>
          )}

          {listPhase === 'loading' ? (
            <div aria-busy="true">
              <span className="sr-only">Chargement des notifications…</span>
              <ListSkeleton />
            </div>
          ) : listPhase === 'error' ? (
            <ErrorState
              title="Liste des notifications indisponible"
              description={listError ?? NETWORK_MESSAGE}
              onRetry={() => void retry()}
              isRetrying={isRetrying}
            />
          ) : list && list.items.length > 0 ? (
            <div className="space-y-3" aria-busy={isFetching || undefined}>
              <DataList
                items={list.items}
                columns={columns}
                getKey={(n) => n.id}
                caption="Notifications de la boîte d’envoi"
                renderCard={renderCard}
              />
              <Pagination
                page={list.page}
                pageSize={PAGE_SIZE}
                total={list.total}
                onPageChange={setPage}
                isLoading={isFetching}
                ariaLabel="Pages des notifications"
              />
            </div>
          ) : (
            <EmptyState
              icon={<BellRing size={28} />}
              title={hasFilters ? 'Aucune notification pour ces filtres' : 'Aucune notification'}
              description={hasFilters ? 'Modifiez ou effacez les filtres pour élargir la recherche.' : 'Les envois de la plateforme apparaîtront ici dès la première notification.'}
            />
          )}
        </TabPanel>
      </section>

      <section aria-labelledby="notif-par-jour" className="space-y-3">
        <div className="space-y-1">
          <h2 id="notif-par-jour" className="text-lg font-semibold text-fg">Par jour et par canal</h2>
          <p className="text-sm text-fg-muted">
            {stats ? `${formatInteger(stats.days)} derniers jours, jours de Dakar.` : 'Derniers jours, jours de Dakar.'}
          </p>
        </div>
        {stats ? (
          <DataList
            items={stats.byDay}
            columns={dayColumns}
            getKey={(d) => `${d.day}-${d.channel}`}
            caption="Notifications par jour et par canal"
            cardTitle={(d) => `${formatDay(d.day)} · ${outboxChannelLabel(d.channel)}`}
            empty={<p className="rounded-2xl border border-border bg-surface p-4 text-sm text-fg-muted">Aucun envoi terminé sur la période.</p>}
          />
        ) : statsError ? (
          <ErrorState title="Compteurs indisponibles" description={statsError} onRetry={() => void loadStats()} />
        ) : (
          <div aria-busy="true">
            <span className="sr-only">Chargement des compteurs…</span>
            <ListSkeleton />
          </div>
        )}
      </section>
    </div>
  );
}
