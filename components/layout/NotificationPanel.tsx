'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
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
import { Badge } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { TONE_ICON, type Tone } from '@/components/ui/tones';
import { formatShortDate, toDate } from '@/lib/format';
import { notificationTypeMeta, type NotificationCategory } from '@/lib/notifications/notification-types';
import type { BellFilter, InAppNotification } from '@/components/notifications/NotificationBell';

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

/** Jour civil à Dakar (AAAA-MM-JJ) d'un instant. */
const DAKAR_DAY = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Africa/Dakar', year: 'numeric', month: '2-digit', day: '2-digit' });
const DAKAR_LONG = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Design 1e — avis groupés par jour, dans l'ordre reçu du serveur : « Aujourd'hui », « Hier », puis « Mercredi 18
 * novembre » (heure de Dakar). Date illisible : « Plus ancien ».
 */
export function groupByDay(items: InAppNotification[], now: Date = new Date()): Array<{ label: string; items: InAppNotification[] }> {
    const today = DAKAR_DAY.format(now);
    const yesterday = DAKAR_DAY.format(new Date(now.getTime() - 86_400_000));
    const groups: Array<{ label: string; items: InAppNotification[] }> = [];
    for (const n of items) {
        const d = new Date(n.createdAt);
        const day = Number.isNaN(d.getTime()) ? null : DAKAR_DAY.format(d);
        const raw = day === null ? 'Plus ancien' : day === today ? 'Aujourd’hui' : day === yesterday ? 'Hier' : DAKAR_LONG.format(d);
        const label = raw.charAt(0).toUpperCase() + raw.slice(1);
        const existing = groups.find((g) => g.label === label);
        if (existing) existing.items.push(n); else groups.push({ label, items: [n] });
    }
    return groups;
}

export interface NotificationPanelProps {
    panelId: string;
    titleId: string;
    /** Vrai une image après le montage : le panneau glisse vers sa place ; faux : il repart (fermeture animée). */
    shown: boolean;
    onClose: () => void;
    notifications: InAppNotification[];
    unreadCount: number;
    filter: BellFilter;
    onFilter: (next: BellFilter) => void;
    loadError: boolean;
    isMarkingAll: boolean;
    onMarkAll: () => void;
    onOpenNotification: (n: InAppNotification) => void;
    onMarkRead: (n: InAppNotification) => void;
}

/**
 * Design 1e — panneau des notifications de la cloche (coquille commune), chargé à la première intention (survol, focus,
 * ouverture) : rien dans le JavaScript de chaque page.
 *  - glisse depuis la droite sur tablette et ordinateur (voile cliquable), monte du bas en plein écran sur téléphone et se
 *    ferme en glissant vers le bas (liste en haut ; en deçà de 110 px, il revient) ; 280 ms, transform seulement ;
 *  - fenêtre modale : Tab tourne dans le panneau, Échap et « Fermer les notifications » le referment (la cloche) ;
 *  - avis groupés par jour, non lues d'abord (tri du serveur), « Tout marquer comme lu », filtres « Toutes » / « Non lues » ;
 *  - chaque avis mène au lien interne servi par le serveur (actionUrl), jamais à une adresse externe.
 */
export default function NotificationPanel(p: NotificationPanelProps) {
    const panelRef = useRef<HTMLElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const swipeRef = useRef<{ y: number; active: boolean } | null>(null);
    const [dragY, setDragY] = useState(0);

    useEffect(() => { if (p.shown) closeRef.current?.focus({ preventScroll: true }); }, [p.shown]);

    /** Tab tourne dans le panneau (fenêtre modale). */
    const trapFocus = (e: React.KeyboardEvent) => {
        if (e.key !== 'Tab' || !panelRef.current) return;
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    /** Téléphone : glisser vers le bas (liste en haut) referme le panneau ; en deçà de 110 px, il revient en place. */
    const onSwipeStart = (e: React.TouchEvent) => {
        if (window.matchMedia('(min-width: 640px)').matches) return;
        swipeRef.current = { y: e.touches[0].clientY, active: (listRef.current?.scrollTop ?? 0) <= 0 };
    };
    const onSwipeMove = (e: React.TouchEvent) => {
        const sw = swipeRef.current;
        if (!sw?.active) return;
        setDragY(Math.max(0, e.touches[0].clientY - sw.y));
    };
    const onSwipeEnd = () => {
        const sw = swipeRef.current;
        swipeRef.current = null;
        if (!sw?.active) return;
        if (dragY > 110) p.onClose();
        setDragY(0);
    };

    const filterClass = (active: boolean) => cn(
        'inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'bg-primary-soft font-semibold text-primary-text' : 'text-muted-foreground hover:bg-background hover:text-foreground-strong',
    );
    const footerLinkClass = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

    return createPortal(
        <>
            {/* Voile (ordinateur et tablette) ; un clic le referme */}
            <div
                aria-hidden="true"
                onClick={p.onClose}
                className={cn('ev-notif-scrim fixed inset-0 z-[60] hidden bg-scrim/50 sm:block', p.shown ? 'opacity-100' : 'opacity-0')}
            />
            <section
                ref={panelRef}
                id={p.panelId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={p.titleId}
                onKeyDown={trapFocus}
                onTouchStart={onSwipeStart}
                onTouchMove={onSwipeMove}
                onTouchEnd={onSwipeEnd}
                style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
                className={cn(
                    'ev-notif-panel fixed inset-0 z-[61] flex flex-col bg-popover text-foreground-strong sm:left-auto sm:w-[26rem] sm:border-l sm:border-border sm:shadow-xl',
                    p.shown ? 'translate-x-0 translate-y-0' : 'translate-y-full sm:translate-x-full sm:translate-y-0',
                )}
            >
                <div className="flex justify-center pt-2 sm:hidden" aria-hidden="true">
                    <span className="h-1.5 w-10 rounded-full bg-border" />
                </div>
                <div className={cn('flex items-center justify-between gap-2 px-4 pb-2 pt-2 sm:pt-4', p.unreadCount > 0 ? 'pb-0' : 'border-b border-border')}>
                    <h2 id={p.titleId} className="text-lg font-bold text-foreground-strong">Notifications</h2>
                    <IconButton ref={closeRef} aria-label="Fermer les notifications" onClick={p.onClose}>
                        <X size={18} />
                    </IconButton>
                </div>
                {/* Lot 7 (D68) : sur sa propre ligne, sous le titre ; à 390 px le libellé ne passe plus à la ligne. */}
                {p.unreadCount > 0 && (
                    <div className="flex border-b border-border px-2 pb-1">
                        <button
                            type="button"
                            onClick={p.onMarkAll}
                            disabled={p.isMarkingAll}
                            aria-busy={p.isMarkingAll || undefined}
                            className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-sm font-semibold text-primary-text transition-colors hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <CheckCheck size={16} aria-hidden="true" />
                            Tout marquer comme lu
                        </button>
                    </div>
                )}

                <div className="flex gap-2 border-b border-border px-3 py-1.5" role="group" aria-label="Filtrer les notifications">
                    <button type="button" aria-pressed={p.filter === 'ALL'} onClick={() => p.onFilter('ALL')} className={filterClass(p.filter === 'ALL')}>
                        Toutes
                    </button>
                    <button type="button" aria-pressed={p.filter === 'UNREAD'} onClick={() => p.onFilter('UNREAD')} className={filterClass(p.filter === 'UNREAD')}>
                        {`Non lues (${p.unreadCount})`}
                    </button>
                </div>

                <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {p.loadError && (
                        <p role="status" className="border-b border-border bg-warning-soft px-4 py-2 text-sm text-warning-text">
                            Notifications non mises à jour : la liste affichée est celle du dernier chargement.
                        </p>
                    )}
                    {p.notifications.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                            <Bell size={24} className="text-muted-foreground" aria-hidden="true" />
                            <p className="text-sm font-semibold text-foreground-strong">
                                {p.filter === 'UNREAD' ? 'Aucune notification non lue' : 'Aucune notification'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Billets, rappels, remboursements et changements d’événement s’afficheront ici.
                            </p>
                        </div>
                    ) : (
                        groupByDay(p.notifications).map((group) => (
                            <section key={group.label} aria-label={group.label}>
                                <h3 className="sticky top-0 z-[1] border-b border-border bg-popover px-4 py-1.5 text-sm font-semibold text-muted-foreground">{group.label}</h3>
                                <ul className="divide-y divide-border">
                                    {group.items.map((notif) => {
                                        const meta = notificationTypeMeta(notif.type);
                                        const { icon: Icon, tone } = CATEGORY_ICON[meta.category];
                                        const showTypeLabel = meta.label.trim().toLowerCase() !== notif.title.trim().toLowerCase();
                                        return (
                                            <li key={notif.id} className={cn('flex items-start gap-1 pr-2', !notif.isRead && 'bg-primary-soft')}>
                                                <button
                                                    type="button"
                                                    onClick={() => p.onOpenNotification(notif)}
                                                    className="flex min-h-11 min-w-0 flex-1 items-start gap-3 p-3 text-left transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                                >
                                                    <span className={cn('mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', !notif.isRead && tone === 'brand' ? 'bg-card text-primary-text' : TONE_ICON[tone])} aria-hidden="true">
                                                        <Icon size={16} />
                                                    </span>
                                                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                        <span className="flex items-start justify-between gap-2">
                                                            <span className={cn('min-w-0 text-sm text-foreground-strong', notif.isRead ? 'font-medium' : 'font-semibold')}>
                                                                {!notif.isRead && <span className="sr-only">Non lue : </span>}
                                                                {notif.title}
                                                            </span>
                                                            <time dateTime={notif.createdAt} className="flex-shrink-0 whitespace-nowrap text-caption text-muted-foreground">
                                                                {formatRelativeTime(notif.createdAt)}
                                                            </time>
                                                        </span>
                                                        {showTypeLabel && (
                                                            <span>
                                                                <Badge variant="neutral" size="sm">{meta.label}</Badge>
                                                            </span>
                                                        )}
                                                        {notif.content && notif.content !== notif.title && (
                                                            <span className="line-clamp-3 text-sm text-muted-foreground">{notif.content}</span>
                                                        )}
                                                        {notif.actionUrl && (
                                                            <span className="inline-flex items-center gap-1 pt-1 text-sm font-semibold text-primary-text">
                                                                Consulter
                                                                <ArrowRight size={14} aria-hidden="true" />
                                                            </span>
                                                        )}
                                                    </span>
                                                </button>
                                                {!notif.isRead && (
                                                    <IconButton aria-label={`Marquer comme lue : ${notif.title}`} className="mt-1.5" onClick={() => p.onMarkRead(notif)}>
                                                        <Check size={18} />
                                                    </IconButton>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                    <Link href="/notifications" onClick={p.onClose} className={footerLinkClass}>
                        Voir toutes les notifications
                    </Link>
                    <Link href="/profile/notifications" onClick={p.onClose} className={footerLinkClass}>
                        <Settings2 size={16} aria-hidden="true" />
                        Préférences
                    </Link>
                </div>
            </section>
        </>,
        document.body,
    );
}
