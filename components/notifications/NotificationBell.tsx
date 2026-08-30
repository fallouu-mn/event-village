'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    ExternalLink,
    RefreshCw,
    X,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';

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

export function NotificationBell() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState<InAppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
    const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const isUserLoggedIn = isAuthenticated || !!user;

    const fetchNotifications = useCallback(async () => {
        if (!isUserLoggedIn) return;
        try {
            const res = await fetch('/api/notifications?limit=20');
            if (!res.ok) return;
            const data = await res.json();
            if (data.notifications) {
                setNotifications(data.notifications);
                setUnreadCount(data.unreadCount ?? data.notifications.filter((n: InAppNotification) => !n.isRead).length);
            }
        } catch (err) {
            console.warn('[NotificationBell] Erreur chargement:', err);
        }
    }, [isUserLoggedIn]);

    useEffect(() => {
        fetchNotifications();
        // Polling toutes les 45 secondes si l'utilisateur est connecté
        if (!isUserLoggedIn) return;
        const interval = setInterval(fetchNotifications, 45000);
        return () => clearInterval(interval);
    }, [fetchNotifications, isUserLoggedIn]);

    // Fermeture du dropdown au clic en dehors
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleMarkAsRead = async (notif: InAppNotification, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (notif.isRead) return;

        // Optimistic update
        setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, isRead: true, status: 'READ' } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        try {
            await fetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH' });
        } catch (err) {
            console.error('[NotificationBell] Erreur markAsRead:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        setIsMarkingAll(true);
        // Optimistic update
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, status: 'READ' })));
        setUnreadCount(0);

        try {
            await fetch('/api/notifications', { method: 'PATCH' });
        } catch (err) {
            console.error('[NotificationBell] Erreur markAllAsRead:', err);
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

    const formatRelativeTime = (isoDate: string) => {
        try {
            const date = new Date(isoDate);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMin = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffMin < 1) return 'À l’instant';
            if (diffMin < 60) return `Il y a ${diffMin} min`;
            if (diffHours < 24) return `Il y a ${diffHours} h`;
            if (diffDays === 1) return 'Hier';
            if (diffDays < 7) return `Il y a ${diffDays} j`;
            return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        } catch {
            return '';
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'KYC':
                return <FileText size={15} className="text-amber-500" />;
            case 'PAYMENT':
                return <DollarSign size={15} className="text-emerald-500" />;
            case 'TICKET':
                return <Ticket size={15} className="text-[#FF5722]" />;
            case 'REFERRAL':
                return <Gift size={15} className="text-purple-500" />;
            case 'SECURITY':
                return <Shield size={15} className="text-red-500" />;
            default:
                return <Bell size={15} className="text-blue-500" />;
        }
    };

    const filteredNotifs = notifications.filter((n) => {
        if (filter === 'UNREAD') return !n.isRead;
        return true;
    });

    if (!isUserLoggedIn) {
        return (
            <Link
                href="/login"
                className="relative w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] transition-all"
                aria-label="Notifications"
            >
                <Bell size={18} />
            </Link>
        );
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bouton Cloche Navbar */}
            <button
                type="button"
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) fetchNotifications();
                }}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] hover:border-[#FF5722]/40 transition-all focus:outline-none"
                aria-label="Notifications"
                aria-expanded={isOpen}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF5722] text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse ring-2 ring-white dark:ring-[#161616]">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Flottant */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50">
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] text-[10px] font-black">
                                    {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5">
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleMarkAllAsRead}
                                    disabled={isMarkingAll}
                                    className="text-[11px] font-bold text-slate-500 hover:text-[#FF5722] dark:text-zinc-400 dark:hover:text-[#FF5722] flex items-center gap-1 transition-colors"
                                    title="Tout marquer comme lu"
                                >
                                    <CheckCheck size={13} />
                                    <span>Tout lire</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Filtres Onglets */}
                    <div className="flex border-b border-slate-100 dark:border-zinc-800/80 px-3 py-1.5 gap-2 text-[11px] font-bold bg-white dark:bg-[#1E1E1E]">
                        <button
                            type="button"
                            onClick={() => setFilter('ALL')}
                            className={`px-2.5 py-1 rounded-lg transition-colors ${
                                filter === 'ALL'
                                    ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white font-black'
                                    : 'text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                            }`}
                        >
                            Toutes ({notifications.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('UNREAD')}
                            className={`px-2.5 py-1 rounded-lg transition-colors ${
                                filter === 'UNREAD'
                                    ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white font-black'
                                    : 'text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                            }`}
                        >
                            Non lues ({unreadCount})
                        </button>
                    </div>

                    {/* Corps Liste Défilable */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60">
                        {filteredNotifs.length === 0 ? (
                            <div className="py-10 px-4 text-center text-slate-400 dark:text-zinc-500 space-y-1.5">
                                <Bell size={24} className="mx-auto text-slate-300 dark:text-zinc-700" />
                                <p className="text-xs font-semibold">Aucune notification {filter === 'UNREAD' ? 'non lue' : ''}</p>
                                <p className="text-[11px] text-slate-400 dark:text-zinc-600">
                                    Vos alertes d’activités, validations et réservations s’afficheront ici.
                                </p>
                            </div>
                        ) : (
                            filteredNotifs.map((notif) => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                                        !notif.isRead
                                            ? 'bg-orange-50/40 dark:bg-orange-950/20 hover:bg-orange-50/70 dark:hover:bg-orange-950/30'
                                            : 'hover:bg-slate-50 dark:hover:bg-zinc-900/50'
                                    }`}
                                >
                                    {/* Icône Type */}
                                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        {getIcon(notif.type)}
                                    </div>

                                    {/* Contenu */}
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                        <div className="flex items-center justify-between gap-1">
                                            <p className={`text-xs truncate ${!notif.isRead ? 'font-black text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-zinc-300'}`}>
                                                {notif.title}
                                            </p>
                                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 whitespace-nowrap flex-shrink-0">
                                                {formatRelativeTime(notif.createdAt)}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-2 leading-tight">
                                            {notif.content}
                                        </p>

                                        {notif.metadata?.actionUrl && (
                                            <div className="pt-1 flex items-center gap-1 text-[10px] font-bold text-[#FF5722]">
                                                <span>Consulter</span>
                                                <ExternalLink size={10} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Pastille non lue */}
                                    {!notif.isRead && (
                                        <button
                                            type="button"
                                            onClick={(e) => handleMarkAsRead(notif, e)}
                                            title="Marquer comme lu"
                                            className="w-2 h-2 rounded-full bg-[#FF5722] flex-shrink-0 mt-2 hover:scale-150 transition-transform"
                                        />
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-2.5 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-900/80 text-center">
                        <Link
                            href="/notifications"
                            onClick={() => setIsOpen(false)}
                            className="text-xs font-bold text-[#FF5722] hover:underline"
                        >
                            Voir toutes les notifications
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
