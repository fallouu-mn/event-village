'use client';

import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    AlertTriangle,
    ArrowRight,
    Bell,
    CalendarClock,
    Check,
    CheckCheck,
    Info,
    Settings2,
    ShoppingBag,
    Ticket,
    UserRound,
    Wallet,
    X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { TONE_ICON, type Tone } from '@/components/ui/tones';
import { formatShortDate, toDate } from '@/lib/format';
import { internalActionUrl } from '@/lib/notifications/action-url';
import { notificationTypeMeta, type NotificationCategory } from '@/lib/notifications/notification-types';

/** Notification telle que la renvoie GET /api/notifications (lot 6, contrat N2). */
export interface InAppNotification {
    id: string;
    userId: string;
    type: string;
    title: string;
    content: string;
    status: string;
    isRead: boolean;
    readAt?: string | null;
    /** Chemin interne déjà filtré par le serveur (internalActionUrl), sinon null. */
    actionUrl: string | null;
    createdAt: string;
}

type BellFilter = 'ALL' | 'UNREAD';

/** Icône et ton par catégorie (mêmes catégories que la page /notifications : notificationTypeMeta). */
const CATEGORY_ICON: Record<NotificationCategory, { icon: React.ElementType; tone: Tone }> = {
    event: { icon: CalendarClock, tone: 'info' },
    ticket: { icon: Ticket, tone: 'brand' },
    payment: { icon: Wallet, tone: 'success' },
    order: { icon: ShoppingBag, tone: 'neutral' },
    account: { icon: UserRound, tone: 'neutral' },
    alert: { icon: AlertTriangle, tone: 'warning' },
    info: { icon: Info, tone: 'neutral' },
};

/** Compteur affiché sur la pastille (le même texte figure dans le nom accessible du bouton). */
function badgeText(count: number): string {
    return count > 99 ? '99+' : String(count);
}

/** Date relative courte : « À l’instant », « Il y a 5 min », « Hier »… puis la date à Dakar. Date illisible : « — ». */
function formatRelativeTime(isoDate: string): string {
    const date = toDate(isoDate);
    if (!date) return formatShortDate(null);
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMin < 1) return 'À l’instant';
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    return formatShortDate(date);
}

/** Lecture défensive d'une notification de l'API : le lien est revérifié (chemin interne seulement). */
function toNotification(raw: unknown): InAppNotification | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const n = raw as Record<string, unknown>;
    if (typeof n.id !== 'string') return null;
    return {
        id: n.id,
        userId: typeof n.userId === 'string' ? n.userId : '',
        type: typeof n.type === 'string' ? n.type : 'SYSTEM',
        title: typeof n.title === 'string' ? n.title : '',
        content: typeof n.content === 'string' ? n.content : '',
        status: typeof n.status === 'string' ? n.status : '',
        isRead: n.isRead === true,
        readAt: typeof n.readAt === 'string' ? n.readAt : null,
        actionUrl: internalActionUrl(n.actionUrl),
        createdAt: typeof n.createdAt === 'string' ? n.createdAt : '',
    };
}

/**
 * Cloche des notifications de l'en-tête (lot 6, contrat N3) :
 *  - liste et compteur portent sur le même ensemble (notifications de l'application du compte), servis par
 *    le serveur : « Toutes » par /api/notifications?limit=20, « Non lues » par ?limit=20&filter=unread
 *    (aucun filtrage dans le navigateur) ; non lues d'abord (tri du serveur) ;
 *  - libellés et icônes par notificationTypeMeta (comme la page /notifications), aucun code brut ;
 *  - un clic n'ouvre que le lien interne renvoyé par le serveur (actionUrl), jamais une adresse externe ;
 *  - bouton de 44 × 44 px dont le nom accessible contient le compteur visible ; pastille sur le ton plein
 *    de la marque ; panneau sur les tokens ; filtres en boutons à bascule (aria-pressed) ;
 *  - pied : « Voir toutes les notifications » et « Préférences » ; temps réel par useRealtimeRefresh.
 */
export function NotificationBell() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const panelId = useId();
    const titleId = useId();
    const [mounted, setMounted] = useState<boolean>(false);
    const [notifications, setNotifications] = useState<InAppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
    const [filter, setFilter] = useState<BellFilter>('ALL');
    const [loadError, setLoadError] = useState<boolean>(false);
    const filterRef = useRef<BellFilter>('ALL');
    const requestSeq = useRef(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const bellRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
                bellRef.current?.focus();
            }
        };
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const isUserLoggedIn = mounted && (isAuthenticated || !!user);

    /**
     * Liste (20 premières de l'onglet) et compteur des non lues relus par le serveur, sur le même ensemble.
     * Une réponse en échec est journalisée, signalée dans le panneau, et l'affichage précédent est conservé.
     */
    const fetchNotifications = useCallback(async () => {
        if (!isUserLoggedIn) return;
        const seq = ++requestSeq.current;
        try {
            const res = filterRef.current === 'UNREAD'
                ? await fetch('/api/notifications?limit=20&filter=unread')
                : await fetch('/api/notifications?limit=20');
            if (seq !== requestSeq.current) return;
            if (!res.ok) {
                console.warn(`[NotificationBell] chargement des notifications refusé (HTTP ${res.status})`);
                setLoadError(true);
                return;
            }
            const data = await res.json() as { notifications?: unknown; unreadCount?: unknown };
            if (seq !== requestSeq.current) return;
            if (!Array.isArray(data.notifications)) {
                console.warn('[NotificationBell] réponse sans liste de notifications');
                setLoadError(true);
                return;
            }
            setNotifications(data.notifications.map(toNotification).filter((n): n is InAppNotification => n !== null));
            setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
            setLoadError(false);
        } catch (err) {
            console.warn('[NotificationBell] chargement des notifications impossible :', err instanceof Error ? err.message : String(err));
            if (seq === requestSeq.current) setLoadError(true);
        }
    }, [isUserLoggedIn]);

    // Chargement initial, indépendant de l'état de la connexion temps réel
    useEffect(() => {
        if (!isUserLoggedIn || !user?.id) return;
        void fetchNotifications();
    }, [isUserLoggedIn, user?.id, fetchNotifications]);

    // Temps réel : une notification reçue ou lue ailleurs (INSERT, UPDATE) recharge la liste et le compteur ;
    // rechargement aussi à la connexion et à chaque reconnexion.
    useRealtimeRefresh({
        channelKey: `notifications-bell-${user?.id ?? 'anonyme'}`,
        subscriptions: [{ table: 'notifications', filter: `user_id=eq.${user?.id ?? ''}` }],
        onSignal: fetchNotifications,
        enabled: isUserLoggedIn && !!user?.id,
    });

    const changeFilter = (next: BellFilter) => {
        if (next === filterRef.current) return;
        filterRef.current = next;
        setFilter(next);
        void fetchNotifications();
    };

    const handleMarkAsRead = async (notif: InAppNotification) => {
        if (notif.isRead) return;

        // Mise à jour optimiste, relue sur le serveur dans tous les cas (l'onglet « Non lues » change)
        setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, isRead: true, status: 'READ' } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        try {
            const res = await fetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH' });
            if (!res.ok) {
                console.error(`[NotificationBell] marquage comme lue refusé (HTTP ${res.status})`);
            }
        } catch (err) {
            console.error('[NotificationBell] marquage comme lue impossible :', err instanceof Error ? err.message : String(err));
        }
        await fetchNotifications();
    };

    const handleMarkAllAsRead = async () => {
        setIsMarkingAll(true);
        // Mise à jour optimiste, relue sur le serveur ensuite
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, status: 'READ' })));
        setUnreadCount(0);

        try {
            const res = await fetch('/api/notifications', { method: 'PATCH' });
            if (!res.ok) {
                console.error(`[NotificationBell] marquage de toutes les notifications refusé (HTTP ${res.status})`);
            }
        } catch (err) {
            console.error('[NotificationBell] marquage de toutes les notifications impossible :', err instanceof Error ? err.message : String(err));
        } finally {
            await fetchNotifications();
            setIsMarkingAll(false);
        }
    };

    const handleNotificationClick = async (notif: InAppNotification) => {
        const target = internalActionUrl(notif.actionUrl);
        setIsOpen(false);
        if (target) router.push(target);
        await handleMarkAsRead(notif);
    };

    const showBadge = mounted && unreadCount > 0;
    const countText = badgeText(unreadCount);
    const bellLabel = showBadge
        ? `Notifications, ${countText} non lue${unreadCount > 1 ? 's' : ''}`
        : 'Notifications';

    const filterClass = (active: boolean) => cn(
        'inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-brand-bg font-semibold text-brand-fg' : 'text-fg-muted hover:bg-surface-sunken hover:text-fg',
    );

    const footerLinkClass = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                ref={bellRef}
                type="button"
                onClick={() => {
                    if (!isUserLoggedIn) {
                        router.push('/login');
                        return;
                    }
                    setIsOpen(!isOpen);
                    if (!isOpen) void fetchNotifications();
                }}
                className={cn(
                    'relative inline-flex h-11 w-11 min-h-11 min-w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface-sunken text-fg',
                    'transition-colors duration-200 hover:text-brand-fg',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                )}
                aria-label={bellLabel}
                aria-expanded={isUserLoggedIn ? isOpen : undefined}
                aria-controls={isOpen ? panelId : undefined}
            >
                <Bell size={18} aria-hidden="true" />
                {showBadge && (
                    <small className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand px-1 text-caption font-bold tabular-nums leading-none text-on-brand ring-2 ring-surface">
                        {countText}
                    </small>
                )}
            </button>

            {isOpen && (
                <section
                    id={panelId}
                    aria-labelledby={titleId}
                    className="fixed inset-x-3 top-16 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised text-fg shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
                >
                    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
                        <h2 id={titleId} className="text-base font-semibold text-fg">Notifications</h2>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleMarkAllAsRead}
                                    disabled={isMarkingAll}
                                    aria-busy={isMarkingAll || undefined}
                                    className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-brand-fg transition-colors hover:bg-brand-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <CheckCheck size={16} aria-hidden="true" />
                                    Tout marquer comme lu
                                </button>
                            )}
                            <IconButton
                                aria-label="Fermer les notifications"
                                onClick={() => {
                                    setIsOpen(false);
                                    bellRef.current?.focus();
                                }}
                            >
                                <X size={18} />
                            </IconButton>
                        </div>
                    </div>

                    <div className="flex gap-2 border-b border-border px-3 py-1.5" role="group" aria-label="Filtrer les notifications">
                        <button type="button" aria-pressed={filter === 'ALL'} onClick={() => changeFilter('ALL')} className={filterClass(filter === 'ALL')}>
                            Toutes
                        </button>
                        <button type="button" aria-pressed={filter === 'UNREAD'} onClick={() => changeFilter('UNREAD')} className={filterClass(filter === 'UNREAD')}>
                            {`Non lues (${unreadCount})`}
                        </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto overscroll-contain">
                        {loadError && (
                            <p role="status" className="border-b border-border bg-warning-bg px-4 py-2 text-sm text-warning-fg">
                                Notifications non mises à jour : la liste affichée est celle du dernier chargement.
                            </p>
                        )}
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                                <Bell size={24} className="text-fg-muted" aria-hidden="true" />
                                <p className="text-sm font-semibold text-fg">
                                    {filter === 'UNREAD' ? 'Aucune notification non lue' : 'Aucune notification'}
                                </p>
                                <p className="text-sm text-fg-muted">
                                    Billets, rappels, remboursements et changements d’événement s’afficheront ici.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border">
                                {notifications.map((notif) => {
                                    const meta = notificationTypeMeta(notif.type);
                                    const { icon: Icon, tone } = CATEGORY_ICON[meta.category];
                                    const showTypeLabel = meta.label.trim().toLowerCase() !== notif.title.trim().toLowerCase();
                                    return (
                                        <li key={notif.id} className={cn('flex items-start gap-1 pr-2', !notif.isRead && 'bg-brand-bg')}>
                                            <button
                                                type="button"
                                                onClick={() => void handleNotificationClick(notif)}
                                                className="flex min-h-11 min-w-0 flex-1 items-start gap-3 p-3 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                            >
                                                <span className={cn('mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', TONE_ICON[tone])} aria-hidden="true">
                                                    <Icon size={16} />
                                                </span>
                                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                    <span className="flex items-start justify-between gap-2">
                                                        <span className={cn('min-w-0 text-sm text-fg', notif.isRead ? 'font-medium' : 'font-semibold')}>
                                                            {!notif.isRead && <span className="sr-only">Non lue : </span>}
                                                            {notif.title}
                                                        </span>
                                                        <time dateTime={notif.createdAt} className="flex-shrink-0 whitespace-nowrap text-caption text-fg-muted">
                                                            {formatRelativeTime(notif.createdAt)}
                                                        </time>
                                                    </span>
                                                    {showTypeLabel && (
                                                        <span>
                                                            <Badge variant="neutral" size="sm">{meta.label}</Badge>
                                                        </span>
                                                    )}
                                                    {notif.content && notif.content !== notif.title && (
                                                        <span className="line-clamp-2 text-sm text-fg-muted">{notif.content}</span>
                                                    )}
                                                    {notif.actionUrl && (
                                                        <span className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-brand-fg">
                                                            Consulter
                                                            <ArrowRight size={14} aria-hidden="true" />
                                                        </span>
                                                    )}
                                                </span>
                                            </button>
                                            {!notif.isRead && (
                                                <IconButton
                                                    aria-label={`Marquer comme lue : ${notif.title}`}
                                                    className="mt-1.5"
                                                    onClick={() => void handleMarkAsRead(notif)}
                                                >
                                                    <Check size={18} />
                                                </IconButton>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border p-2">
                        <Link href="/notifications" onClick={() => setIsOpen(false)} className={footerLinkClass}>
                            Voir toutes les notifications
                        </Link>
                        <Link href="/profile/notifications" onClick={() => setIsOpen(false)} className={footerLinkClass}>
                            <Settings2 size={16} aria-hidden="true" />
                            Préférences
                        </Link>
                    </div>
                </section>
            )}
        </div>
    );
}
