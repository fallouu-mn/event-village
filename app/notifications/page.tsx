'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  Info,
  RefreshCw,
  Settings2,
  ShoppingBag,
  Ticket,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TabPanel, useTabParam, type TabItem } from '@/components/ui/Tabs';
import { ScrollableTabs } from '@/components/ui/ScrollableTabs';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { TONE_ICON, type Tone } from '@/components/ui/tones';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { formatDateTime, toDate } from '@/lib/format';
import { internalActionUrl } from '@/lib/notifications/action-url';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  notificationTypeMeta,
  type NotificationCategory,
} from '@/lib/notifications/notification-types';

/**
 * Centre de notifications du compte (lot 6, contrats N2 et N3).
 *  - Source unique : GET /api/notifications, paginé par le serveur (20 par page) : même ensemble pour la
 *    liste, le total et le compteur des non lues ; non lues d'abord (tri du serveur).
 *  - Onglets dans ?tab= : « Toutes », « Non lues » (filter=unread) et une catégorie (category=…), chacun
 *    servi par le serveur ; aucun filtrage ni tri dans le navigateur.
 *  - Libellés par notificationTypeMeta (jamais la valeur brute du type) ; « Voir le détail » seulement si
 *    le serveur renvoie un lien interne (actionUrl).
 *  - Temps réel par useRealtimeRefresh : toute notification reçue ou lue ailleurs recharge la page courante.
 */

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

const PAGE_SIZE = 20;
const TABS = ['toutes', 'non-lues', ...NOTIFICATION_CATEGORIES] as const;
type TabKey = typeof TABS[number];

const CATEGORY_ICON: Record<NotificationCategory, { icon: React.ElementType; tone: Tone }> = {
  event: { icon: CalendarClock, tone: 'info' },
  ticket: { icon: Ticket, tone: 'brand' },
  payment: { icon: Wallet, tone: 'success' },
  order: { icon: ShoppingBag, tone: 'neutral' },
  account: { icon: UserRound, tone: 'neutral' },
  alert: { icon: AlertTriangle, tone: 'warning' },
  info: { icon: Info, tone: 'neutral' },
};

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

interface PageResult {
  notifications: NotificationItem[];
  unreadCount: number;
  total: number;
  page: number;
}

type LoadResult = ({ ok: true } & PageResult) | { ok: false; message: string };

/** Filtre de l'onglet, servi par le serveur : non lues, ou une catégorie traduite en types par la route. */
function tabFilterOf(tab: TabKey): string {
  if (tab === 'non-lues') return '&filter=unread';
  if (tab === 'toutes') return '&filter=all';
  return `&category=${encodeURIComponent(tab)}`;
}

function toItem(raw: unknown): NotificationItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const n = raw as Record<string, unknown>;
  if (typeof n.id !== 'string') return null;
  return {
    id: n.id,
    type: typeof n.type === 'string' ? n.type : 'SYSTEM',
    title: typeof n.title === 'string' ? n.title : '',
    content: typeof n.content === 'string' ? n.content : '',
    isRead: n.isRead === true,
    actionUrl: internalActionUrl(n.actionUrl),
    createdAt: typeof n.createdAt === 'string' ? n.createdAt : '',
  };
}

async function readNotifications(tab: TabKey, page: number): Promise<LoadResult> {
  let res: Response;
  try {
    res = await fetch(`/api/notifications?page=${page}&pageSize=${PAGE_SIZE}${tabFilterOf(tab)}`, { cache: 'no-store' });
  } catch (err) {
    console.error('[Notifications] liste injoignable :', err instanceof Error ? err.message : String(err));
    return { ok: false, message: NETWORK_MESSAGE };
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch (err) {
    console.error(`[Notifications] réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
    return { ok: false, message: `Réponse inattendue du serveur (erreur ${res.status}).` };
  }
  const payload = (typeof body === 'object' && body !== null ? body : {}) as {
    notifications?: unknown; unreadCount?: unknown; total?: unknown; page?: unknown; error?: unknown;
  };
  if (!res.ok) {
    const message = typeof payload.error === 'string' && payload.error ? payload.error : `Vos notifications n’ont pas pu être chargées (erreur ${res.status}).`;
    return { ok: false, message };
  }
  if (!Array.isArray(payload.notifications)) {
    console.error('[Notifications] réponse sans liste de notifications :', body);
    return { ok: false, message: 'Réponse inattendue du serveur.' };
  }
  return {
    ok: true,
    notifications: payload.notifications.map(toItem).filter((n): n is NotificationItem => n !== null),
    unreadCount: typeof payload.unreadCount === 'number' ? payload.unreadCount : 0,
    total: typeof payload.total === 'number' ? payload.total : 0,
    page: typeof payload.page === 'number' ? payload.page : page,
  };
}

/** « À l’instant », « Il y a 12 min », « Il y a 3 h », « Hier », puis la date et l'heure à Dakar. */
function relativeTime(iso: string, now: number): string {
  const date = toDate(iso);
  if (!date) return formatDateTime(iso);
  const diffMin = Math.floor((now - date.getTime()) / 60_000);
  if (diffMin < 1) return 'À l’instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  if (diffHours < 48) return 'Hier';
  return formatDateTime(date);
}

function NotificationSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface p-4" aria-hidden="true">
      <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-surface-sunken motion-safe:animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/2 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-4 w-5/6 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
        <div className="h-4 w-1/4 rounded-md bg-surface-sunken motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id ?? null;
  const toast = useToast();
  const [tab, setTab] = useTabParam(TABS, 'toutes');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageResult>({ notifications: [], unreadCount: 0, total: 0, page: 1 });
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isPaging, setIsPaging] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  const requestSeq = useRef(0);
  const hasShownList = useRef(false);
  const viewRef = useRef<{ tab: TabKey; page: number }>({ tab, page });
  viewRef.current = { tab, page };

  /**
   * « initial » : écran d'erreur si l'échec survient ; « silent » : la liste reste, un bandeau le signale.
   * Tant qu'aucune liste n'a été affichée, un échec mène toujours à l'écran d'erreur : un rechargement
   * silencieux (temps réel) lancé pendant le premier chargement rend ce dernier caduc, et son échec laissait
   * la page en chargement sans fin (capture du run 66).
   */
  const load = useCallback(async (mode: 'initial' | 'silent') => {
    const seq = ++requestSeq.current;
    const { tab: currentTab, page: currentPage } = viewRef.current;
    const res = await readNotifications(currentTab, currentPage);
    if (seq !== requestSeq.current) return;
    setNow(Date.now());
    if (res.ok) {
      const { ok: _ok, ...data } = res;
      void _ok;
      // Page devenue vide après un marquage ou une suppression : retour à la dernière page existante.
      const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
      if (data.notifications.length === 0 && currentPage > lastPage) {
        setPage(lastPage);
        return;
      }
      setResult(data);
      setLoadError(null);
      setRefreshError(null);
      setPhase('ready');
      hasShownList.current = true;
      return;
    }
    if (mode === 'initial' || !hasShownList.current) {
      setLoadError(res.message);
      setPhase('error');
    } else {
      setRefreshError(res.message);
    }
  }, []);

  const refresh = useCallback(() => load('silent'), [load]);

  // Premier chargement, puis à chaque changement d'onglet ou de page (liste servie par le serveur).
  useEffect(() => {
    if (isAuthLoading || !userId) return;
    let cancelled = false;
    setIsPaging(true);
    void load(phase === 'ready' ? 'silent' : 'initial').finally(() => {
      if (!cancelled) setIsPaging(false);
    });
    return () => {
      cancelled = true;
    };
    // `phase` est lu à l'appel seulement : le rechargement ne dépend que de la vue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, userId, tab, page, load]);

  // Temps réel : notification reçue (INSERT) ou lue ailleurs (UPDATE), relue par le serveur.
  const { status: liveStatus } = useRealtimeRefresh({
    channelKey: `notifications-page-${userId ?? 'anonyme'}`,
    subscriptions: [{ table: 'notifications', filter: `user_id=eq.${userId ?? ''}` }],
    onSignal: refresh,
    enabled: Boolean(userId),
  });

  // Horodatages relatifs tenus à jour sans recharger la liste
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const changeTab = (id: string) => {
    setPage(1);
    setTab(id as TabKey);
  };

  const retry = async () => {
    setIsRetrying(true);
    try {
      await load('initial');
    } finally {
      setIsRetrying(false);
    }
  };

  const markAsRead = async (id: string) => {
    setPendingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (!res.ok) {
        console.error(`[Notifications] marquage comme lue refusé (HTTP ${res.status})`);
        toast.error('Cette notification n’a pas pu être marquée comme lue. Réessayez.');
        return;
      }
      await refresh();
    } catch (err) {
      console.error('[Notifications] marquage comme lue impossible :', err instanceof Error ? err.message : String(err));
      toast.error(NETWORK_MESSAGE);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const markAllAsRead = async () => {
    setIsMarkingAll(true);
    try {
      const res = await fetch('/api/notifications', { method: 'PATCH' });
      if (!res.ok) {
        console.error(`[Notifications] marquage de toutes les notifications refusé (HTTP ${res.status})`);
        toast.error('Vos notifications n’ont pas pu être marquées comme lues. Réessayez.');
        return;
      }
      toast.success('Toutes vos notifications sont marquées comme lues.');
      await refresh();
    } catch (err) {
      console.error('[Notifications] marquage de toutes les notifications impossible :', err instanceof Error ? err.message : String(err));
      toast.error(NETWORK_MESSAGE);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const tabItems = useMemo<TabItem[]>(() => [
    { id: 'toutes', label: 'Toutes' },
    { id: 'non-lues', label: 'Non lues', count: result.unreadCount },
    ...NOTIFICATION_CATEGORIES.map((category) => ({ id: category, label: NOTIFICATION_CATEGORY_LABELS[category] })),
  ], [result.unreadCount]);

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg pb-24 pt-6 lg:pb-12">
        <EmptyState
          icon={<Bell size={28} />}
          title="Connectez-vous pour voir vos notifications"
          description="Billets, remboursements et changements d’événement : tout ce qui concerne votre compte arrive ici."
          actionLabel="Se connecter"
          actionHref="/login?redirect=%2Fnotifications"
        />
      </div>
    );
  }

  const emptyCopy = tab === 'non-lues'
    ? { title: 'Aucune notification non lue', description: 'Vous avez tout lu. Les prochaines notifications apparaîtront ici sans recharger la page.' }
    : tab === 'toutes'
      ? { title: 'Aucune notification', description: 'Billets, rappels, remboursements et changements d’événement apparaîtront ici dès qu’ils vous concernent.' }
      : { title: `Aucune notification dans « ${NOTIFICATION_CATEGORY_LABELS[tab]} »`, description: 'Les notifications de cette catégorie apparaîtront ici.' };

  const shown = result.notifications;

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Notifications"
        description="Billets, rappels, paiements et changements d’événement : ce qui concerne votre compte, mis à jour en direct."
        eyebrow={<LiveIndicator status={liveStatus} />}
        actions={(
          <>
            {result.unreadCount > 0 && phase === 'ready' && (
              <Button
                variant="secondary"
                onClick={() => void markAllAsRead()}
                isLoading={isMarkingAll}
                leftIcon={<CheckCheck size={18} aria-hidden="true" />}
              >
                Tout marquer comme lu
              </Button>
            )}
            <LinkButton href="/profile/notifications" variant="ghost" leftIcon={<Settings2 size={18} aria-hidden="true" />}>
              Préférences
            </LinkButton>
          </>
        )}
      />

      <ScrollableTabs
        tabs={tabItems}
        value={tab}
        onChange={changeTab}
        ariaLabel="Filtrer mes notifications"
        idPrefix="notifications"
      />

      <TabPanel idPrefix="notifications" tabIdValue={tab} className="space-y-4">
        {refreshError && phase === 'ready' && (
          <StatusBanner
            tone="warning"
            announce="alert"
            title="Vos notifications n’ont pas pu être mises à jour"
            action={(
              <Button variant="secondary" size="sm" onClick={() => void refresh()} leftIcon={<RefreshCw size={16} aria-hidden="true" />}>
                Réessayer
              </Button>
            )}
          >
            {refreshError} La liste affichée est celle du dernier chargement.
          </StatusBanner>
        )}

        {isAuthLoading || phase === 'loading' ? (
          <div className="space-y-3" aria-busy="true">
            <span className="sr-only">Chargement de vos notifications…</span>
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
          </div>
        ) : phase === 'error' ? (
          <ErrorState
            title="Impossible d’afficher vos notifications"
            description={loadError ?? NETWORK_MESSAGE}
            onRetry={() => void retry()}
            isRetrying={isRetrying}
          />
        ) : shown.length > 0 ? (
          <>
            <ul className={cn('space-y-3', isPaging && 'opacity-70')} aria-busy={isPaging || undefined}>
              {shown.map((notif) => {
                const meta = notificationTypeMeta(notif.type);
                const { icon: Icon, tone } = CATEGORY_ICON[meta.category];
                const showTypeLabel = meta.label.trim().toLowerCase() !== notif.title.trim().toLowerCase();
                return (
                  <li
                    key={notif.id}
                    className={cn(
                      'rounded-2xl border p-4 sm:p-5',
                      notif.isRead ? 'border-border bg-surface' : 'border-brand-fg/30 bg-brand-bg',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', TONE_ICON[tone])} aria-hidden="true">
                        <Icon size={20} />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h2 className="break-words text-base font-semibold leading-snug text-fg">{notif.title}</h2>
                          {!notif.isRead && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-fg">
                              <span className="h-2 w-2 rounded-full bg-brand-decor" aria-hidden="true" />
                              Non lue
                            </span>
                          )}
                        </div>
                        {showTypeLabel && (
                          <Badge variant="neutral" size="sm">{meta.label}</Badge>
                        )}
                        {notif.content && notif.content !== notif.title && (
                          <p className="break-words text-sm leading-relaxed text-fg">{notif.content}</p>
                        )}
                        <p className="text-sm text-fg-muted">
                          <time dateTime={notif.createdAt}>{relativeTime(notif.createdAt, now)}</time>
                        </p>
                      </div>
                    </div>

                    {(!notif.isRead || notif.actionUrl) && (
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        {!notif.isRead && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void markAsRead(notif.id)}
                            isLoading={pendingIds.has(notif.id)}
                            leftIcon={<CheckCheck size={16} aria-hidden="true" />}
                          >
                            Marquer comme lue
                          </Button>
                        )}
                        {notif.actionUrl && (
                          <LinkButton
                            href={notif.actionUrl}
                            size="sm"
                            rightIcon={<ChevronRight size={16} aria-hidden="true" />}
                            onClick={() => { if (!notif.isRead) void markAsRead(notif.id); }}
                          >
                            Voir le détail
                          </LinkButton>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <Pagination
              page={result.page}
              pageSize={PAGE_SIZE}
              total={result.total}
              onPageChange={(next) => {
                setPage(next);
                window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
              }}
              isLoading={isPaging}
              ariaLabel="Pages de notifications"
            />
          </>
        ) : (
          <EmptyState icon={<Bell size={28} />} title={emptyCopy.title} description={emptyCopy.description} />
        )}
      </TabPanel>
    </div>
  );
}
