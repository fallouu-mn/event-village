'use client';

import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { usePageSettled } from '@/hooks/usePageSettled';
import { setUnreadCount as publishUnread } from '@/components/notifications/unread-store';
import { cn } from '@/components/ui/cn';
import { internalActionUrl } from '@/lib/notifications/action-url';
import type { NotificationPanelProps } from '@/components/layout/NotificationPanel';

/**
 * Lot 7 (7.5), design 1e — le panneau (liste groupée par jour, libellés des types, pastilles, dates) n'est pas dans le
 * JavaScript de chaque page : components/layout/NotificationPanel.tsx, chargé au survol ou au focus de la cloche, et au plus
 * tard à l'ouverture. Le bouton, le compteur des non lues et le temps réel restent chargés avec la page.
 */
type PanelComponent = React.ComponentType<NotificationPanelProps>;
let panelModule: Promise<PanelComponent> | null = null;

function loadPanelModule(): Promise<PanelComponent> {
    if (!panelModule) {
        panelModule = import('@/components/layout/NotificationPanel')
            .then((m) => m.default)
            .catch((err: unknown) => {
                panelModule = null; // nouvel essai possible ; l'erreur remonte à l'appelant
                throw err;
            });
    }
    return panelModule;
}

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

export type BellFilter = 'ALL' | 'UNREAD';

/** Compteur affiché sur la pastille (le même texte figure dans le nom accessible du bouton). */
function badgeText(count: number): string {
    return count > 99 ? '99+' : String(count);
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
 * Cloche des notifications de l'en-tête (lot 6, contrat N3 ; design 1e) :
 *  - liste et compteur portent sur le même ensemble (notifications de l'application du compte), servis par
 *    le serveur : « Toutes » par /api/notifications?limit=20, « Non lues » par ?limit=20&filter=unread
 *    (aucun filtrage dans le navigateur) ; non lues d'abord (tri du serveur) ;
 *  - libellés et icônes par notificationTypeMeta dans le panneau (comme la page /notifications), aucun code brut ;
 *  - un clic n'ouvre que le lien interne renvoyé par le serveur (actionUrl), jamais une adresse externe ;
 *  - bouton de 44 × 44 px dont le nom accessible contient le compteur visible ; pastille sur le ton plein de la marque,
 *    qui s'anime une fois à chaque nouveau nombre ; compteur partagé avec le point de la barre du bas ;
 *  - panneau qui glisse (components/layout/NotificationPanel.tsx) ; pied « Voir toutes les notifications » et
 *    « Préférences » ; temps réel par useRealtimeRefresh, ouvert une fois la page chargée.
 */
function NotificationBellView() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const panelId = useId();
    const titleId = useId();
    const [mounted, setMounted] = useState<boolean>(false);
    const [notifications, setNotifications] = useState<InAppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [panelShown, setPanelShown] = useState<boolean>(false);
    const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);
    const [filter, setFilter] = useState<BellFilter>('ALL');
    const [loadError, setLoadError] = useState<boolean>(false);
    const [Panel, setPanel] = useState<PanelComponent | null>(null);
    const [panelError, setPanelError] = useState<boolean>(false);
    const filterRef = useRef<BellFilter>('ALL');
    const requestSeq = useRef(0);
    const bellRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const isUserLoggedIn = mounted && (isAuthenticated || !!user);

    // Design 1e (point 2) : le compteur est partagé avec le point de l'onglet « Notifications » de la barre du bas
    useEffect(() => { publishUnread(isUserLoggedIn ? unreadCount : 0); }, [isUserLoggedIn, unreadCount]);

    /** Fermeture animée (280 ms, aucune si « réduire les animations »), puis retrait du panneau et focus rendu à la cloche. */
    const closePanel = useCallback(() => {
        setPanelShown(false);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.setTimeout(() => { setIsOpen(false); bellRef.current?.focus(); }, reduce ? 0 : 280);
    }, []);

    // Ouverture : la page ne défile plus derrière ; le panneau glisse vers sa place à l'image suivante ; Échap le referme
    useEffect(() => {
        if (!isOpen || !Panel) return undefined;
        document.documentElement.classList.add('ev-notif-ouvert');
        let inner = 0;
        const outer = window.requestAnimationFrame(() => { inner = window.requestAnimationFrame(() => setPanelShown(true)); });
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel(); };
        window.addEventListener('keydown', onKey);
        return () => {
            window.cancelAnimationFrame(outer);
            window.cancelAnimationFrame(inner);
            window.removeEventListener('keydown', onKey);
            document.documentElement.classList.remove('ev-notif-ouvert');
        };
    }, [isOpen, Panel, closePanel]);

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
    // Design 1e (vitesse) : abonnement ouvert une fois la page chargée et le téléphone libre, comme Mes billets (avant :
    // pendant le chargement de chaque page) ; le compteur est lu tout de suite par le chargement initial ci-dessus.
    const settled = usePageSettled();
    useRealtimeRefresh({
        channelKey: `notifications-bell-${user?.id ?? 'anonyme'}`,
        subscriptions: [{ table: 'notifications', filter: `user_id=eq.${user?.id ?? ''}` }],
        onSignal: fetchNotifications,
        enabled: isUserLoggedIn && !!user?.id && settled,
    });

    /** Charge le panneau (survol, focus, ouverture) ; un échec est journalisé et affiché près de la cloche. */
    const loadPanel = useCallback(() => {
        if (Panel) return;
        loadPanelModule()
            .then((component) => {
                setPanel(() => component);
                setPanelError(false);
            })
            .catch((err: unknown) => {
                console.error('[NotificationBell] chargement du panneau des notifications impossible :', err instanceof Error ? err.message : String(err));
                setPanelError(true);
            });
    }, [Panel]);

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
        closePanel();
        if (target) router.push(target);
        await handleMarkAsRead(notif);
    };

    const showBadge = mounted && unreadCount > 0;
    const countText = badgeText(unreadCount);
    const bellLabel = showBadge
        ? `Notifications, ${countText} non lue${unreadCount > 1 ? 's' : ''}`
        : 'Notifications';

    return (
        <div className="relative">
            <button
                ref={bellRef}
                type="button"
                onClick={() => {
                    if (!isUserLoggedIn) {
                        router.push('/login');
                        return;
                    }
                    if (isOpen) { closePanel(); return; }
                    setIsOpen(true);
                    loadPanel();
                    void fetchNotifications();
                }}
                onPointerEnter={isUserLoggedIn ? loadPanel : undefined}
                onFocus={isUserLoggedIn ? loadPanel : undefined}
                className={cn(
                    'relative inline-flex h-11 w-11 min-h-11 min-w-11 flex-shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-background text-foreground-strong',
                    'transition-colors duration-200 hover:text-primary-text',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                )}
                aria-label={bellLabel}
                aria-expanded={isUserLoggedIn ? isOpen : undefined}
                aria-controls={isOpen ? panelId : undefined}
            >
                <Bell size={18} aria-hidden="true" />
                {showBadge && (
                    // Design 1e : le compteur s'anime une fois à chaque nouveau nombre (clé = nombre), jamais en boucle
                    <small key={countText} className="ev-count-pop absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-caption font-bold tabular-nums leading-none text-primary-foreground ring-2 ring-card">
                        {countText}
                    </small>
                )}
            </button>

            {isOpen && Panel && (
                <Panel
                    panelId={panelId}
                    titleId={titleId}
                    shown={panelShown}
                    onClose={closePanel}
                    notifications={notifications}
                    unreadCount={unreadCount}
                    filter={filter}
                    onFilter={changeFilter}
                    loadError={loadError}
                    isMarkingAll={isMarkingAll}
                    onMarkAll={() => void handleMarkAllAsRead()}
                    onOpenNotification={(n) => void handleNotificationClick(n)}
                    onMarkRead={(n) => void handleMarkAsRead(n)}
                />
            )}
            {isOpen && !Panel && (
                <div role={panelError ? 'alert' : 'status'} className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-border bg-popover p-4 text-sm text-foreground-strong shadow-lg">
                    {panelError ? (
                        <div className="flex flex-col gap-2">
                            <p className="font-semibold">La liste des notifications ne peut pas s’afficher pour le moment.</p>
                            <p className="text-muted-foreground">Vérifiez votre connexion, puis réessayez.</p>
                            <div className="flex gap-2">
                                <button type="button" onClick={loadPanel} className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-primary-text hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Réessayer</button>
                                <button type="button" onClick={() => setIsOpen(false)} className="inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Fermer</button>
                            </div>
                        </div>
                    ) : 'Chargement des notifications…'}
                </div>
            )}
        </div>
    );
}

/** Design 1e (vitesse) : sans propriété, la cloche ne se redessine plus à chaque rendu de la coquille (seulement sur son état et la session). */
export const NotificationBell = React.memo(NotificationBellView);
