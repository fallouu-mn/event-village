'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  Info,
  RefreshCw,
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
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TabPanel, Tabs, useTabParam, type TabItem } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { TONE_ICON, type Tone } from '@/components/ui/tones';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { formatDateTime, toDate } from '@/lib/format';
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  notificationTypeMeta,
  type NotificationCategory,
} from '@/lib/notifications/notification-types';

/**
 * Notifications du compte (lot 5, contrats O2, O3 et Q).
 *  - Source unique : GET /api/notifications (liste et compteur des non lues calculé par le serveur).
 *  - Type de notification : libellé et catégorie lus dans lib/notifications/notification-types.ts,
 *    jamais la valeur brute de la colonne `type`.
 *  - Temps réel : toute notification reçue ou lue ailleurs recharge la liste par le serveur.
 *  - Onglets dans ?tab= : toutes, non lues, puis une catégorie (simple tri de la liste reçue).
 */

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

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

type LoadResult = { ok: true; notifications: NotificationItem[]; unreadCount: number } | { ok: false; message: string };

async function readNotifications(): Promise<LoadResult> {
  let res: Response;
  try {
    res = await fetch('/api/notifications?limit=50', { cache: 'no-store' });
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
  const payload = (typeof body === 'object' && body !== null ? body : {}) as { notifications?: unknown; unreadCount?: unknown; error?: unknown };
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
    notifications: payload.notifications as NotificationItem[],
    unreadCount: typeof payload.unreadCount === 'number' ? payload.unreadCount : 0,
  };
}

/** Lien d'action interne seulement (« /events/… ») : une valeur externe ou un schéma javascript: est ignoré. */
function internalActionUrl(metadata: Record<string, unknown> | undefined): string | null {
  const url = metadata?.actionUrl;
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : null;
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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());

  /** « initial » : écran d'erreur si l'échec survient ; « silent » : la liste reste, un bandeau le signale. */
  const load = useCallback(async (mode: 'initial' | 'silent') => {
    const result = await readNotifications();
    setNow(Date.now());
    if (result.ok) {
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
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

  const refresh = useCallback(() => load('silent'), [load]);

  useEffect(() => {
    if (isAuthLoading || !userId) return;
    void load('initial');
  }, [isAuthLoading, userId, load]);

  // Temps réel (contrat O3) : notification reçue (INSERT) ou lue ailleurs (UPDATE), relue par le serveur.
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

  // Onglets : catégories présentes dans la liste reçue (plus l'onglet courant, pour ne pas le perdre)
  const tabItems = useMemo<TabItem[]>(() => {
    const present = new Set(notifications.map((n) => notificationTypeMeta(n.type).category));
    const items: TabItem[] = [
      { id: 'toutes', label: 'Toutes' },
      { id: 'non-lues', label: 'Non lues', count: unreadCount },
    ];
    for (const category of NOTIFICATION_CATEGORIES) {
      if (present.has(category) || tab === category) items.push({ id: category, label: NOTIFICATION_CATEGORY_LABELS[category] });
    }
    return items;
  }, [notifications, unreadCount, tab]);

  const shown = useMemo(() => {
    if (tab === 'toutes') return notifications;
    if (tab === 'non-lues') return notifications.filter((n) => !n.isRead);
    return notifications.filter((n) => notificationTypeMeta(n.type).category === tab);
  }, [notifications, tab]);

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
      ? { title: 'Aucune notification', description: 'Billets, remboursements et changements d’événement apparaîtront ici dès qu’ils vous concernent.' }
      : { title: `Aucune notification dans « ${NOTIFICATION_CATEGORY_LABELS[tab]} »`, description: 'Les notifications de cette catégorie apparaîtront ici.' };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title="Notifications"
        description="Billets, paiements, remboursements et changements d’événement : ce qui concerne votre compte, mis à jour en direct."
        eyebrow={<LiveIndicator status={liveStatus} />}
        actions={unreadCount > 0 && phase === 'ready' ? (
          <Button
            variant="secondary"
            onClick={() => void markAllAsRead()}
            isLoading={isMarkingAll}
            leftIcon={<CheckCheck size={18} aria-hidden="true" />}
          >
            Tout marquer comme lu
          </Button>
        ) : undefined}
      />

      <Tabs
        tabs={tabItems}
        value={tab}
        onChange={(id) => setTab(id as TabKey)}
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
          <ul className="space-y-3">
            {shown.map((notif) => {
              const meta = notificationTypeMeta(notif.type);
              const { icon: Icon, tone } = CATEGORY_ICON[meta.category];
              const actionUrl = internalActionUrl(notif.metadata);
              const showTypeLabel = meta.label.trim().toLowerCase() !== (notif.title ?? '').trim().toLowerCase();
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

                  {(!notif.isRead || actionUrl) && (
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
                      {actionUrl && (
                        <LinkButton
                          href={actionUrl}
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
        ) : (
          <EmptyState icon={<Bell size={28} />} title={emptyCopy.title} description={emptyCopy.description} />
        )}
      </TabPanel>
    </div>
  );
}
