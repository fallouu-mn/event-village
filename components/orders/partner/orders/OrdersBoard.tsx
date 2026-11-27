'use client';

/**
 * Lot 12c — écran des commandes de la partenaire (/partner/orders), outil de travail du restaurant, aussi sur une tablette
 * posée au comptoir.
 *  - Seule source : GET /api/partner/orders (commandes transmises : payées, ou payables à la remise ; jamais une commande
 *    non payée), relu toutes les 5 s tant que la page est visible (usePolledJson). Plus aucun temps réel par la base.
 *  - Tablette et ordinateur : colonnes par étape (Reçues, En préparation, Prêtes, En route) ; la carte glisse d'une
 *    colonne à l'autre (transition de vue du navigateur, coupée si « réduire les animations »). Téléphone : onglets par
 *    étape avec leurs compteurs.
 *  - Nouvelle commande : son et vibration (useOrderSound, après un premier toucher), animation d'arrivée et halo.
 *  - « Ma journée » : GET /api/partner/orders/day, relu toutes les 30 s.
 *  - Actions rapides par PATCH /api/partner/orders/[id] ; le refus du serveur est affiché tel quel.
 * Contre-vérification du lot 12c :
 *  - point 9 : à partir de 1 280 px, colonnes d'au moins 18 rem côte à côte dans une zone qui défile proprement à
 *    l'horizontale si la place manque (menu latéral ouvert à 1 440 px) ; numéro de commande sur une ligne ;
 *  - point 10 : mode comptoir (plein écran, sans menu, très grands boutons, écran gardé allumé si le navigateur le
 *    permet, sinon un message simple ; sortie en un geste : bouton « Quitter » ou Échap) ;
 *  - point 11 : rappel sonore 5 et 2 minutes avant la fin du délai de réponse (même interrupteur que le son) ;
 *  - point 12 : « Plus de … » en un geste dans « Ma journée » (DaySummary).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { BellRing, Bike, ClipboardList, LogOut, MonitorSmartphone, Volume2, VolumeX, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { formatDateTime, formatFcfa, formatTime } from '@/lib/format';
import { BOARD_COLUMNS, ORDER_MODE_LABELS, boardColumnOf, type BoardColumn } from '@/lib/orders/partner-ui';
import { Badge } from '@/components/ui/Badge';
import { DaySummary } from './DaySummary';
import { OrderCard, STATE_BADGE, shortOrderNumber, type QuickAction } from './OrderCard';
import { useOrderSound } from './useOrderSound';
import { usePolledJson, useServerClock } from './usePolledJson';
import type { DayReply, OrdersReply, PartnerOrder } from './order-types';

const POLL_MS = 5_000;
const DAY_MS = 30_000;
const CLOSED_MS = 30_000;
/** Durée pendant laquelle une nouvelle commande reste surlignée. */
const FRESH_MS = 60_000;

type ViewTab = 'en-cours' | 'terminees';

type ViewTransitionDocument = Document & { startViewTransition?: (cb: () => void) => unknown };

/** Rappels sonores avant la fin du délai de réponse, en minutes (du plus proche au plus lointain). */
const REMINDERS_MIN = [2, 5] as const;

interface WakeLockSentinelLike { release: () => Promise<void> }
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };
type WakeState = 'pending' | 'on' | 'unavailable';

/** Mode comptoir : écran gardé allumé tant que le mode est ouvert (repris au retour sur la page), si le navigateur le permet. */
function useWakeLock(active: boolean): WakeState {
    const [state, setState] = useState<WakeState>('pending');
    useEffect(() => {
        if (!active) return undefined;
        let sentinel: WakeLockSentinelLike | null = null;
        let alive = true;
        const lock = async () => {
            const api = (navigator as WakeLockNavigator).wakeLock;
            if (!api) {
                setState('unavailable');
                return;
            }
            if (document.visibilityState !== 'visible') return;
            try {
                const s = await api.request('screen');
                if (alive) {
                    sentinel = s;
                    setState('on');
                } else {
                    void s.release().catch(() => undefined);
                }
            } catch (err) {
                console.warn('[comptoir] écran non gardé allumé :', err instanceof Error ? err.message : String(err));
                if (alive) setState('unavailable');
            }
        };
        const onVisible = () => { if (document.visibilityState === 'visible') void lock(); };
        void lock();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            alive = false;
            document.removeEventListener('visibilitychange', onVisible);
            if (sentinel) void sentinel.release().catch(() => undefined);
            setState('pending');
        };
    }, [active]);
    return state;
}

/** Tablette et ordinateur (768 px et plus) : colonnes ; téléphone : onglets. Une seule disposition rendue à la fois. */
function useWideScreen(): boolean | null {
    const [wide, setWide] = useState<boolean | null>(null);
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 768px)');
        const sync = () => setWide(mq.matches);
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);
    return wide;
}

/**
 * Mode comptoir : fenêtre native plein écran (<dialog>, comme le QR en grand des billets) qui défile elle-même. Le
 * navigateur garde le focus dedans, Échap la ferme ; le focus revient au bouton qui l'a ouverte. Run 749 : la fenêtre
 * plein écran du système de design coupe ce qui dépasse (corps sans défilement propre).
 */
function CounterDialog({ open, onClose, subtitle, children }: { open: boolean; onClose: () => void; subtitle: string; children: React.ReactNode }) {
    const ref = useRef<HTMLDialogElement>(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog || !open) return undefined;
        const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
        const onCancel = (e: Event) => {
            e.preventDefault();
            closeRef.current();
        };
        dialog.addEventListener('cancel', onCancel);
        return () => {
            dialog.removeEventListener('cancel', onCancel);
            if (dialog.open) dialog.close();
            returnFocus?.focus();
        };
    }, [open]);
    return (
        <dialog
            ref={ref}
            aria-labelledby="comptoir-titre"
            className="m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto overscroll-contain border-0 bg-background p-0 text-foreground backdrop:bg-scrim/60"
        >
            {open && (
                <>
                    <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">
                            <MonitorSmartphone size={20} />
                        </span>
                        <div className="min-w-0">
                            <h2 id="comptoir-titre" className="text-lg font-bold text-foreground-strong">Mode comptoir</h2>
                            <p className="text-sm text-muted-foreground">{subtitle}</p>
                        </div>
                    </header>
                    {children}
                </>
            )}
        </dialog>
    );
}

export function OrdersBoard() {
    const toast = useToast();
    const sound = useOrderSound();
    const [view, setView] = useState<ViewTab>('en-cours');
    const [column, setColumn] = useState<BoardColumn>('RECUES');
    const [busyId, setBusyId] = useState<string | null>(null);
    const [fresh, setFresh] = useState<Record<string, number>>({});
    const [counter, setCounter] = useState(false);
    const reminded = useRef<Set<string>>(new Set());
    const seen = useRef<Set<string> | null>(null);
    const columns = useRef<Map<string, BoardColumn | null>>(new Map());
    const wide = useWideScreen();

    // Mise à jour des commandes : une carte qui change d'étape glisse vers sa colonne (transition de vue, si permise)
    const apply = useCallback((update: () => void, next: OrdersReply) => {
        const moved = next.orders.some((o) => columns.current.has(o.id) && columns.current.get(o.id) !== boardColumnOf(o.state));
        columns.current = new Map(next.orders.map((o) => [o.id, boardColumnOf(o.state)]));
        const doc = document as ViewTransitionDocument;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (moved && !reduce && typeof doc.startViewTransition === 'function') {
            doc.startViewTransition(() => flushSync(update));
        } else {
            update();
        }
    }, []);

    const open = usePolledJson<OrdersReply>('/api/partner/orders?filter=open', POLL_MS, apply);
    const day = usePolledJson<DayReply>('/api/partner/orders/day', DAY_MS);
    const closed = usePolledJson<OrdersReply>(view === 'terminees' ? '/api/partner/orders?filter=closed' : null, CLOSED_MS);
    const now = useServerClock(open.skewMs);

    const orders = useMemo(() => open.data?.orders ?? [], [open.data]);

    // Nouvelles commandes (jamais vues, à accepter) : son, vibration, surlignage. Rien au premier chargement.
    const { ring } = sound;
    const reloadDay = day.reload;
    useEffect(() => {
        if (!open.data) return;
        const ids = open.data.orders.map((o) => o.id);
        if (seen.current === null) {
            seen.current = new Set(ids);
            return;
        }
        const arrived = open.data.orders.filter((o) => !seen.current!.has(o.id) && o.state === 'RECUE');
        for (const id of ids) seen.current.add(id);
        if (arrived.length === 0) return;
        ring();
        const at = Date.now();
        setFresh((f) => ({ ...f, ...Object.fromEntries(arrived.map((o) => [o.id, at])) }));
        void reloadDay();
    }, [open.data, ring, reloadDay]);

    // Le surlignage s'efface au bout d'une minute
    useEffect(() => {
        const ids = Object.keys(fresh);
        if (ids.length === 0) return undefined;
        const t = setTimeout(() => {
            const limit = Date.now() - FRESH_MS;
            setFresh((f) => Object.fromEntries(Object.entries(f).filter(([, at]) => at > limit)));
        }, 5_000);
        return () => clearTimeout(t);
    }, [fresh]);

    // Rappel 5 et 2 minutes avant la fin du délai de réponse : un son par relecture, un message par commande et par seuil
    const { remind } = sound;
    useEffect(() => {
        const due: string[] = [];
        for (const o of orders) {
            if (o.state !== 'RECUE' || !o.response_due_at) continue;
            const left = Date.parse(o.response_due_at) - now;
            if (Number.isNaN(left) || left <= 0) continue;
            const step = REMINDERS_MIN.find((m) => left <= m * 60_000);
            if (step === undefined || reminded.current.has(`${o.id}:${step}`)) continue;
            // Un seuil passé vaut aussi pour les seuils plus lointains (pas de rappel « 5 minutes » après celui de 2)
            for (const m of REMINDERS_MIN) if (m >= step) reminded.current.add(`${o.id}:${m}`);
            due.push(`Commande ${shortOrderNumber(o.order_number)} : plus que ${step} minutes pour répondre.`);
        }
        if (due.length === 0) return;
        remind();
        for (const message of due) toast.warning(message);
    }, [orders, now, remind, toast]);

    // Mode comptoir : plein écran du navigateur dans le geste, sortie en un geste (bouton « Quitter » ou Échap)
    const wake = useWakeLock(counter);
    const enterCounter = useCallback(() => {
        setCounter(true);
        const el = document.documentElement;
        if (typeof el.requestFullscreen === 'function' && !document.fullscreenElement) {
            el.requestFullscreen().catch((err: unknown) => console.warn('[comptoir] plein écran refusé :', err instanceof Error ? err.message : String(err)));
        }
    }, []);
    const leaveCounter = useCallback(() => {
        setCounter(false);
        if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
            document.exitFullscreen().catch((err: unknown) => console.warn('[comptoir] sortie du plein écran :', err instanceof Error ? err.message : String(err)));
        }
    }, []);
    // La sortie du plein écran par le navigateur (Échap) laisse le mode comptoir ouvert (fenêtre plein écran sans menu) :
    // « Quitter le mode comptoir » ou un second Échap le ferment (run 743 : un navigateur qui sort aussitôt du plein écran
    // refermait le mode dès son ouverture)

    const byColumn = useMemo(() => {
        const m: Record<BoardColumn, PartnerOrder[]> = { RECUES: [], PREPARATION: [], PRETES: [], EN_ROUTE: [] };
        for (const o of orders) {
            const c = boardColumnOf(o.state);
            if (c) m[c].push(o);
        }
        // Plus ancienne en tête : la première arrivée est la première servie
        for (const c of Object.keys(m) as BoardColumn[]) m[c].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
        return m;
    }, [orders]);

    const quick = useCallback(async (order: PartnerOrder, action: QuickAction) => {
        setBusyId(order.id);
        try {
            await sendJson(`/api/partner/orders/${order.id}`, 'PATCH', { action });
            toast.success(action === 'ACCEPTER' ? 'Commande acceptée : le client est prévenu.' : action === 'PREPARER' ? 'Préparation commencée.' : 'Commande prête : le client est prévenu.');
            await Promise.all([open.reload(), day.reload()]);
        } catch (err) {
            toast.error(errorMessage(err, 'Action impossible pour le moment.'));
            await open.reload();
        } finally {
            setBusyId(null);
        }
    }, [toast, open, day]);

    const counts = Object.fromEntries(BOARD_COLUMNS.map((c) => [c.id, byColumn[c.id].length])) as Record<BoardColumn, number>;

    const renderColumn = (c: (typeof BOARD_COLUMNS)[number], large = false) => (
        <div className="space-y-3">
            {byColumn[c.id].length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">{c.empty}</p>
            ) : (
                byColumn[c.id].map((o) => (
                    <OrderCard key={o.id} order={o} now={now} fresh={o.id in fresh} busy={busyId === o.id} readOnly={false} onQuick={quick} large={large} />
                ))
            )}
        </div>
    );

    // Colonnes par étape : 2 sur tablette ; à partir de 1 280 px (et en mode comptoir), côte à côte, 18 rem au moins
    // chacune, dans une zone qui défile à l'horizontale quand la place manque (jamais la page entière)
    const renderBoard = (large: boolean) => (
        <div
            role="region"
            aria-label="Commandes par étape"
            tabIndex={0}
            className="-mx-1 overflow-x-auto rounded-2xl px-1 pb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <div className={cn('grid gap-4', large
                ? 'auto-cols-[minmax(18rem,1fr)] grid-flow-col'
                : 'grid-cols-2 xl:auto-cols-[minmax(18rem,1fr)] xl:grid-flow-col xl:grid-cols-none')}>
                {BOARD_COLUMNS.map((c) => (
                    <section key={c.id} aria-labelledby={`colonne-${large ? 'comptoir-' : ''}${c.id}`} className="min-w-0 rounded-2xl bg-muted/60 p-3">
                        <h2 id={`colonne-${large ? 'comptoir-' : ''}${c.id}`} className={cn('mb-3 flex items-center justify-between gap-2 px-1 font-bold text-foreground-strong', large ? 'text-xl' : 'text-base')}>
                            {c.label}
                            <span className="rounded-full bg-card px-2.5 py-0.5 text-sm font-bold tabular-nums text-foreground-strong">{counts[c.id]}</span>
                        </h2>
                        {renderColumn(c, large)}
                    </section>
                ))}
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-24 lg:pb-12">
            <PageHeader
                title="Commandes"
                description="Gardez cette page ouverte : chaque nouvelle commande sonne et s’affiche ici, mise à jour toutes les 5 secondes."
                actions={
                    <>
                        {sound.enabled && !sound.ready && (
                            <Button variant="primary" leftIcon={<BellRing size={18} />} onClick={sound.unlock}>Activer le son</Button>
                        )}
                        <IconButton
                            variant="secondary"
                            aria-label={sound.enabled ? 'Couper le son des nouvelles commandes' : 'Remettre le son des nouvelles commandes'}
                            aria-pressed={!sound.enabled}
                            onClick={() => {
                                sound.setEnabled(!sound.enabled);
                                if (!sound.enabled) sound.unlock();
                            }}
                        >
                            {sound.enabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                        </IconButton>
                        <Button variant="secondary" leftIcon={<MonitorSmartphone size={18} aria-hidden="true" />} onClick={enterCounter}>Mode comptoir</Button>
                        <LinkButton href="/partner/orders/livreurs" variant="secondary" leftIcon={<Bike size={18} />}>Livreurs</LinkButton>
                    </>
                }
            />

            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
                {!open.online ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-warning-text"><WifiOff size={16} aria-hidden="true" />Hors ligne : l’écran se remet à jour au retour du réseau</span>
                ) : open.updatedAt ? (
                    <span>Mis à jour à <span className="tabular-nums">{formatTime(open.updatedAt)}</span>{sound.enabled ? (sound.ready ? ' · son activé' : ' · touchez l’écran pour activer le son') : ' · son coupé'}</span>
                ) : (
                    <span>Chargement des commandes…</span>
                )}
            </p>

            {day.data?.partnerStatus === 'SUSPENDU' && (
                <StatusBanner tone="suspended" title="Votre fiche est suspendue">
                    Vos commandes restent visibles, mais vous ne pouvez plus les accepter, les préparer ni les remettre. Contactez le support.
                </StatusBanner>
            )}

            <DaySummary day={day.data?.day ?? null} loading={day.loading} readOnly={day.data?.partnerStatus === 'SUSPENDU'} onChanged={day.reload} />

            {open.error && open.data && (
                <StatusBanner tone="warning" title="Mise à jour impossible pour le moment">{errorMessage(open.error)}</StatusBanner>
            )}

            <Tabs
                ariaLabel="Commandes en cours ou terminées"
                idPrefix="commandes-vue"
                value={view}
                onChange={(id) => setView(id as ViewTab)}
                tabs={[
                    { id: 'en-cours', label: 'En cours', count: orders.length },
                    { id: 'terminees', label: 'Terminées' },
                ]}
            />

            <TabPanel idPrefix="commandes-vue" tabIdValue="en-cours" className={view === 'en-cours' ? '' : 'hidden'}>
                {(open.loading && !open.data) || wide === null ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" role="status" aria-busy="true">
                        <span className="sr-only">Chargement des commandes…</span>
                        {BOARD_COLUMNS.map((c) => <div key={c.id} className="h-48 rounded-2xl bg-muted motion-safe:animate-pulse" />)}
                    </div>
                ) : open.error && !open.data ? (
                    <ErrorState title="Commandes indisponibles" description={errorMessage(open.error)} onRetry={() => void open.reload()} />
                ) : orders.length === 0 ? (
                    <EmptyState
                        illustrated
                        icon={<ClipboardList size={28} />}
                        title="Aucune commande en cours"
                        description="Gardez cette page ouverte : la prochaine commande sonnera et apparaîtra ici."
                    />
                ) : (
                    !wide ? (
                        /* Téléphone : un onglet par étape, avec son compteur */
                        <div>
                            <Tabs
                                ariaLabel="Étapes des commandes"
                                idPrefix="commandes-etape"
                                value={column}
                                onChange={(id) => setColumn(id as BoardColumn)}
                                tabs={BOARD_COLUMNS.map((c) => ({ id: c.id, label: c.label, count: counts[c.id] }))}
                            />
                            {BOARD_COLUMNS.map((c) => (
                                <TabPanel key={c.id} idPrefix="commandes-etape" tabIdValue={c.id} className={cn('pt-4', column === c.id ? '' : 'hidden')}>
                                    {renderColumn(c)}
                                </TabPanel>
                            ))}
                        </div>
                    ) : (
                        /* Tablette et ordinateur : colonnes par étape */
                        renderBoard(false)
                    )
                )}
            </TabPanel>

            <CounterDialog
                open={counter}
                onClose={leaveCounter}
                subtitle={open.online
                    ? (open.updatedAt ? `Mis à jour à ${formatTime(open.updatedAt)}${sound.enabled ? '' : ' · son coupé'}` : 'Chargement des commandes…')
                    : 'Hors ligne : l’écran se remet à jour au retour du réseau'}
            >
                <div className="space-y-4 p-4 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {wake === 'unavailable' ? (
                            <p className="text-base text-warning-text" role="status">
                                Cet appareil peut se mettre en veille : réglez sa mise en veille sur « jamais » pendant le service.
                            </p>
                        ) : (
                            <p className="text-base text-muted-foreground" role="status">
                                {wake === 'on' ? 'L’écran reste allumé tant que ce mode est ouvert.' : 'Les nouvelles commandes sonnent et s’affichent ici.'}
                            </p>
                        )}
                        <Button variant="secondary" size="lg" className="min-h-16 px-8 text-lg" leftIcon={<LogOut size={22} aria-hidden="true" />} onClick={leaveCounter}>
                            Quitter le mode comptoir
                        </Button>
                    </div>
                    {orders.length === 0 ? (
                        <EmptyState
                            illustrated
                            icon={<ClipboardList size={28} />}
                            title="Aucune commande en cours"
                            description="La prochaine commande sonnera et apparaîtra ici."
                        />
                    ) : !wide ? (
                        <div className="space-y-6">
                            {BOARD_COLUMNS.filter((c) => counts[c.id] > 0).map((c) => (
                                <section key={c.id} aria-labelledby={`comptoir-${c.id}`}>
                                    <h2 id={`comptoir-${c.id}`} className="mb-3 text-xl font-bold text-foreground-strong">
                                        {c.label} <span className="tabular-nums text-muted-foreground">({counts[c.id]})</span>
                                    </h2>
                                    {renderColumn(c, true)}
                                </section>
                            ))}
                        </div>
                    ) : (
                        renderBoard(true)
                    )}
                </div>
            </CounterDialog>

            <TabPanel idPrefix="commandes-vue" tabIdValue="terminees" className={view === 'terminees' ? '' : 'hidden'}>
                {view !== 'terminees' ? null : closed.loading && !closed.data ? (
                    <div className="h-40 rounded-2xl bg-muted motion-safe:animate-pulse" role="status" aria-busy="true">
                        <span className="sr-only">Chargement des commandes terminées…</span>
                    </div>
                ) : closed.error && !closed.data ? (
                    <ErrorState title="Commandes terminées indisponibles" description={errorMessage(closed.error)} onRetry={() => void closed.reload()} />
                ) : (closed.data?.orders ?? []).length === 0 ? (
                    <EmptyState icon={<ClipboardList size={28} />} title="Aucune commande terminée" description="Les commandes remises, refusées ou annulées s’afficheront ici." />
                ) : (
                    <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
                        {(closed.data?.orders ?? []).map((o) => (
                            <li key={o.id}>
                                <LinkButton
                                    href={`/partner/orders/${o.id}`}
                                    variant="ghost"
                                    fullWidth
                                    className="h-auto justify-between rounded-none px-4 py-3 text-left"
                                    aria-label={`Commande ${o.order_number}, ${o.stateLabel}`}
                                >
                                    <span className="flex w-full flex-wrap items-center justify-between gap-2">
                                        <span className="flex min-w-0 flex-col">
                                            <span className="text-base font-bold tabular-nums text-foreground-strong">{shortOrderNumber(o.order_number)}</span>
                                            <span className="text-sm text-muted-foreground">
                                                {ORDER_MODE_LABELS[o.mode] ?? 'Commande'} · <time dateTime={o.created_at} className="tabular-nums">{formatDateTime(o.created_at)}</time>
                                            </span>
                                        </span>
                                        <span className="flex items-center gap-3">
                                            <Badge variant={STATE_BADGE[o.state] ?? 'neutral'}>{o.stateLabel}</Badge>
                                            <span className="text-base font-bold tabular-nums text-foreground-strong">{formatFcfa(o.amounts?.goods_total)}</span>
                                        </span>
                                    </span>
                                </LinkButton>
                            </li>
                        ))}
                    </ul>
                )}
            </TabPanel>
        </div>
    );
}
