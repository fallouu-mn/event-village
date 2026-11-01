'use client';

import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Bell,
    Check,
    CheckCheck,
    Ticket,
    DollarSign,
    Gift,
    Shield,
    FileText,
    ArrowRight,
    X,
    type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { formatShortDate, toDate } from '@/lib/format';

export interface InAppNotification {
    id: string;
    userId: string;
    type: string;
    title: string;
    content: string;
    channel?: string;
    status: string;
    isRead: boolean;
    readAt?: string;
    metadata?: Record<string, any>;
    createdAt: string;
}

/** Icône et ton de chaque type de notification (tokens du système de design ; type inconnu : cloche neutre). */
const TYPE_ICONS: Record<string, { icon: LucideIcon; className: string }> = {
    KYC: { icon: FileText, className: 'bg-warning-bg text-warning-fg' },
    PAYMENT: { icon: DollarSign, className: 'bg-success-bg text-success-fg' },
    TICKET: { icon: Ticket, className: 'bg-brand-bg text-brand-fg' },
    REFERRAL: { icon: Gift, className: 'bg-info-bg text-info-fg' },
    SECURITY: { icon: Shield, className: 'bg-danger-bg text-danger-fg' },
};
const DEFAULT_TYPE_ICON = { icon: Bell, className: 'bg-surface-sunken text-fg-muted' };

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

/**
 * Cloche des notifications de l'en-tête (relecture des captures du run 50) :
 *  - bouton de 44 × 44 px ; le compteur visible fait partie du nom accessible (« Notifications, 87 non
 *    lues » : WCAG 2.5.3, règle axe label-content-name-mismatch) ;
 *  - pastille sur le ton plein de la marque (texte blanc 5,18:1 ; l'ancien #FF5722 donnait 3,16:1) ;
 *  - panneau sur les tokens : chaque notification est un vrai bouton, « Marquer comme lue » est un
 *    bouton icône de 44 px nommé, filtres en boutons à bascule (aria-pressed) ;
 *  - aucune animation hors prefers-reduced-motion.
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
    const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
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
     * Liste et compteur relus par le serveur (GET /api/notifications : compteur = notifications PUSH non lues,
     * statut READ et read_at). Une réponse en échec est journalisée et l'affichage précédent est conservé.
     */
    const fetchNotifications = useCallback(async () => {
        if (!isUserLoggedIn) return;
        try {
            const res = await fetch('/api/notifications?limit=20');
            if (!res.ok) {
                console.warn(`[NotificationBell] chargement des notifications refusé (HTTP ${res.status})`);
                return;
            }
            const data = await res.json();
            if (Array.isArray(data.notifications)) {
                setNotifications(data.notifications);
                setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
            }
        } catch (err) {
            console.warn('[NotificationBell] Erreur chargement:', err);
        }
    }, [isUserLoggedIn]);

    // Chargement initial, indépendant de l'état de la connexion temps réel
    useEffect(() => {
        if (!isUserLoggedIn || !user?.id) return;
        void fetchNotifications();
    }, [isUserLoggedIn, user?.id, fetchNotifications]);

    // Temps réel (lot 5, contrat O3) : une notification reçue ou lue ailleurs (INSERT, UPDATE) recharge la
    // liste et le compteur ; rechargement aussi à la connexion et à chaque reconnexion.
    useRealtimeRefresh({
        channelKey: `notifications-bell-${user?.id ?? 'anonyme'}`,
        subscriptions: [{ table: 'notifications', filter: `user_id=eq.${user?.id ?? ''}` }],
        onSignal: fetchNotifications,
        enabled: isUserLoggedIn && !!user?.id,
    });

    const handleMarkAsRead = async (notif: InAppNotification) => {
        if (notif.isRead) return;

        // Mise à jour optimiste, relue sur le serveur en cas d'échec
        setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, isRead: true, status: 'READ' } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        try {
            const res = await fetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH' });
            if (!res.ok) {
                console.error(`[NotificationBell] marquage comme lue refusé (HTTP ${res.status})`);
                await fetchNotifications();
            }
        } catch (err) {
            console.error('[NotificationBell] Erreur markAsRead:', err);
            await fetchNotifications();
        }
    };

    const handleMarkAllAsRead = async () => {
        setIsMarkingAll(true);
        // Mise à jour optimiste, relue sur le serveur en cas d'échec
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, status: 'READ' })));
        setUnreadCount(0);

        try {
            const res = await fetch('/api/notifications', { method: 'PATCH' });
            if (!res.ok) {
                console.error(`[NotificationBell] marquage de toutes les notifications refusé (HTTP ${res.status})`);
                await fetchNotifications();
            }
        } catch (err) {
            console.error('[NotificationBell] Erreur markAllAsRead:', err);
            await fetchNotifications();
        } finally {
            setIsMarkingAll(false);
        }
    };

    const handleNotificationClick = async (notif: InAppNotification) => {
        await handleMarkAsRead(notif);
        setIsOpen(false);

        const actionUrl = notif.metadata?.actionUrl;
        if (actionUrl) {
            router.push(actionUrl);
        }
    };

    const visibleNotifs = filter === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications;
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
                        <button type="button" aria-pressed={filter === 'ALL'} onClick={() => setFilter('ALL')} className={filterClass(filter === 'ALL')}>
                            Toutes
                        </button>
                        <button type="button" aria-pressed={filter === 'UNREAD'} onClick={() => setFilter('UNREAD')} className={filterClass(filter === 'UNREAD')}>
                            {`Non lues (${unreadCount})`}
                        </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto overscroll-contain">
                        {visibleNotifs.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                                <Bell size={24} className="text-fg-muted" aria-hidden="true" />
                                <p className="text-sm font-semibold text-fg">
                                    {filter === 'UNREAD' ? 'Aucune notification non lue' : 'Aucune notification'}
                                </p>
                                <p className="text-sm text-fg-muted">
                                    Vos alertes d’activité, validations et réservations s’afficheront ici.
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-border">
                                {visibleNotifs.map((notif) => {
                                    const meta = TYPE_ICONS[notif.type] ?? DEFAULT_TYPE_ICON;
                                    const Icon = meta.icon;
                                    return (
                                        <li key={notif.id} className={cn('flex items-start gap-1 pr-2', !notif.isRead && 'bg-brand-bg')}>
                                            <button
                                                type="button"
                                                onClick={() => void handleNotificationClick(notif)}
                                                className="flex min-h-11 min-w-0 flex-1 items-start gap-3 p-3 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                            >
                                                <span className={cn('mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', meta.className)} aria-hidden="true">
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
                                                    <span className="line-clamp-2 text-sm text-fg-muted">{notif.content}</span>
                                                    {notif.metadata?.actionUrl && (
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

                    <div className="border-t border-border p-2 text-center">
                        <Link
                            href="/notifications"
                            onClick={() => setIsOpen(false)}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-brand-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            Voir toutes les notifications
                        </Link>
                    </div>
                </section>
            )}
        </div>
    );
}
