'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Building2, CalendarDays, Package, RefreshCw, ShoppingBag, Ticket, TrendingUp, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { FilterChip } from '@/components/ui/FilterChip';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TextInput } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { ApiError, fetchJson } from '@/components/partner/fetch-json';
import { useFeatureFlags } from '@/lib/features/client';
import { formatFcfa, formatInteger, formatPercent } from '@/lib/format';

/**
 * Statistiques de ventes de l'organisatrice (design 1c).
 *  - Jetons de la charte seulement (aucune couleur en dur) ; chaque barre a son libellé, son montant et sa part : la
 *    couleur ne porte jamais seule l'information.
 *  - « Recettes nettes » : seul nom du net (ventes en ligne de la période moins les remboursements, lu dans le grand livre
 *    par GET /api/partner/stats ; espèces et invitations hors du compte).
 *  - Commandes, salles, tables et produits : affichés seulement si le service est ouvert (useFeatureFlags), comme le menu.
 *  - Statuts en mots (StatusBadge pour les événements, libellés pour les commandes), jamais en code brut.
 */
interface StatsData {
    period: { from: string | null; to: string | null };
    stats: {
        events: { total: number; byStatus: Record<string, number> };
        tickets: { total: number; sold: number; used: number; revenue: number };
        hallReservations: { total: number; confirmed: number; revenue: number };
        orders: {
            total: number;
            completed: number;
            revenue: number;
            avgBasket: number;
            byStatus: Record<string, number>;
        };
        products: { total: number; active: number };
        revenue: { total: number; tickets: number; orders: number; halls: number; tables?: number };
    };
}

type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'custom';

function getPeriodDates(period: Exclude<PeriodKey, 'custom'>): { from: string; to: string } {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    if (period === '7d') start.setDate(start.getDate() - 7);
    else if (period === '30d') start.setDate(start.getDate() - 30);
    else if (period === 'month') start.setDate(1);
    return { from: start.toISOString(), to: endOfDay.toISOString() };
}

const PERIOD_LABELS: Record<PeriodKey, string> = {
    today: 'Aujourd’hui',
    '7d': '7 derniers jours',
    '30d': '30 derniers jours',
    month: 'Mois en cours',
    custom: 'Personnalisée',
};

const ORDER_STATUS_LABELS: Record<string, string> = {
    EN_ATTENTE: 'En attente',
    CONFIRMEE: 'Confirmée',
    EN_PREPARATION: 'En préparation',
    PRETE: 'Prête',
    EN_LIVRAISON: 'En livraison',
    LIVREE: 'Livrée',
    ANNULEE: 'Annulée',
    REJETEE: 'Refusée',
};

/** Barre de répartition : longueur proportionnelle, jamais seule (libellé, montant et part à côté). */
function ShareBar({ value, max, className }: { value: number; max: number; className: string }) {
    const pct = max > 0 && value > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
    return (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className={cn('h-full rounded-full', className)} style={{ width: `${pct}%` }} />
        </div>
    );
}

function Panel({ title, icon, children, aside }: { title: string; icon: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
    const id = `stats-${title.toLowerCase().normalize('NFD').replace(/[^a-z]+/g, '-')}`;
    return (
        <section aria-labelledby={id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={id} className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">{icon}</span>
                    {title}
                </h2>
                {aside}
            </div>
            {children}
        </section>
    );
}

function Row({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
    return (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-border py-2 first:border-t-0">
            <dt className="min-w-0 break-words text-sm text-muted-foreground">{label}</dt>
            <dd className={cn('text-sm tabular-nums text-foreground-strong', strong && 'font-bold')}>{value}</dd>
        </div>
    );
}

export default function PartnerStatsPage() {
    const flags = useFeatureFlags();
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activePeriod, setActivePeriod] = useState<PeriodKey>('30d');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [customError, setCustomError] = useState<string | null>(null);

    const fetchStats = useCallback(async (period: PeriodKey, cfrom?: string, cto?: string) => {
        let from: string;
        let to: string;
        if (period === 'custom') {
            if (!cfrom || !cto) {
                setCustomError('Choisissez une date de début et une date de fin.');
                return;
            }
            if (cfrom > cto) {
                setCustomError('La date de début doit précéder la date de fin.');
                return;
            }
            setCustomError(null);
            from = new Date(`${cfrom}T00:00:00`).toISOString();
            to = new Date(`${cto}T23:59:59`).toISOString();
        } else {
            ({ from, to } = getPeriodDates(period));
        }
        setLoading(true);
        setError(null);
        try {
            const data = await fetchJson<StatsData>(`/api/partner/stats?${new URLSearchParams({ from, to })}`);
            setStats(data);
        } catch (err: unknown) {
            console.error('[statistiques] lecture', err);
            setError(err instanceof ApiError ? err.message : 'Impossible de charger les statistiques.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activePeriod !== 'custom') void fetchStats(activePeriod);
    }, [activePeriod, fetchStats]);

    const refresh = () => void fetchStats(activePeriod, customFrom, customTo);
    const s = stats?.stats;
    const showOrders = flags?.orders === true;
    const showHalls = flags?.halls === true;
    const showTables = flags?.tables === true;

    const channels = s
        ? [
            { key: 'tickets', label: 'Billetterie', value: s.revenue.tickets, bar: 'bg-primary', shown: true },
            { key: 'orders', label: 'Commandes', value: s.revenue.orders, bar: 'bg-info', shown: showOrders },
            { key: 'halls', label: 'Salles', value: s.revenue.halls, bar: 'bg-success', shown: showHalls },
            { key: 'tables', label: 'Tables', value: s.revenue.tables ?? 0, bar: 'bg-warning', shown: showTables },
        ].filter((c) => c.shown)
        : [];
    const channelMax = Math.max(0, ...channels.map((c) => c.value));
    const channelTotal = channels.reduce((n, c) => n + Math.max(0, c.value), 0);
    const orderStatuses = s ? Object.entries(s.orders.byStatus) : [];
    const orderMax = Math.max(0, ...orderStatuses.map(([, n]) => n));

    return (
        <div className="mx-auto max-w-5xl space-y-6 pb-16">
            <PageHeader
                title="Statistiques de ventes"
                description="Vos recettes et vos billets sur la période choisie. Les ventes en espèces et les invitations n’y figurent pas."
                actions={(
                    <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={16} />} onClick={refresh} disabled={loading}>
                        Actualiser
                    </Button>
                )}
            />

            <section aria-labelledby="stats-periode" className="space-y-3">
                <h2 id="stats-periode" className="text-base font-semibold text-foreground-strong">Période</h2>
                <div className="flex flex-wrap gap-2">
                    {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((p) => (
                        <FilterChip key={p} pressed={activePeriod === p} onClick={() => setActivePeriod(p)}>
                            {PERIOD_LABELS[p]}
                        </FilterChip>
                    ))}
                </div>
                {activePeriod === 'custom' && (
                    <form
                        noValidate
                        className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void fetchStats('custom', customFrom, customTo);
                        }}
                    >
                        <TextInput id="stats-du" type="date" label="Du" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} required />
                        <TextInput id="stats-au" type="date" label="Au" value={customTo} onChange={(e) => setCustomTo(e.target.value)} required
                            error={customError ?? undefined} />
                        <Button type="submit" variant="primary">Afficher</Button>
                    </form>
                )}
            </section>

            {error && !loading && (
                <ErrorState title="Statistiques indisponibles" description={error} onRetry={refresh} />
            )}

            {loading && (
                <div role="status" aria-busy="true" aria-label="Chargement des statistiques" className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {[0, 1, 2, 3].map((i) => <KpiCardSkeleton key={i} />)}
                    </div>
                    <Skeleton className="h-48 rounded-2xl" />
                </div>
            )}

            {s && !loading && !error && (
                <>
                    <section aria-labelledby="stats-indicateurs">
                        <h2 id="stats-indicateurs" className="sr-only">Indicateurs</h2>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <KpiCard
                                label="Recettes nettes"
                                value={formatFcfa(s.revenue.total)}
                                hint="Ventes en ligne de la période, remboursements déduits."
                                tone="success"
                                icon={<TrendingUp size={18} />}
                            />
                            <KpiCard
                                label="Billets vendus"
                                value={formatInteger(s.tickets.sold)}
                                hint={`Dont ${formatInteger(s.tickets.used)} déjà utilisés à l’entrée.`}
                                tone="info"
                                icon={<Ticket size={18} />}
                            />
                            {showOrders && (
                                <KpiCard label="Commandes" value={formatInteger(s.orders.total)} hint={`${formatInteger(s.orders.completed)} livrées.`} tone="brand" icon={<ShoppingBag size={18} />} />
                            )}
                            {showHalls && (
                                <KpiCard label="Réservations de salle" value={formatInteger(s.hallReservations.confirmed)} hint="Confirmées sur la période." tone="neutral" icon={<Building2 size={18} />} />
                            )}
                        </div>
                    </section>

                    {channels.length > 1 && (
                        <Panel title="Répartition des recettes nettes" icon={<TrendingUp size={18} />}>
                            <ul className="flex flex-col gap-4">
                                {channels.map((c) => (
                                    <li key={c.key} className="flex flex-col gap-1.5">
                                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                            <span className="text-sm font-semibold text-foreground-strong">{c.label}</span>
                                            <span className="text-sm tabular-nums text-foreground-strong">
                                                <span className="font-bold">{formatFcfa(c.value)}</span>
                                                <span className="text-muted-foreground">{` · ${channelTotal > 0 && c.value > 0 ? formatPercent(c.value / channelTotal) : formatPercent(0)}`}</span>
                                            </span>
                                        </div>
                                        <ShareBar value={c.value} max={channelMax} className={c.bar} />
                                    </li>
                                ))}
                            </ul>
                        </Panel>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Panel title="Billetterie" icon={<Ticket size={18} />}>
                            <dl>
                                <Row label="Billets vendus" value={formatInteger(s.tickets.sold)} strong />
                                <Row label="Billets utilisés à l’entrée" value={formatInteger(s.tickets.used)} />
                                <Row label="Recettes nettes de la billetterie" value={formatFcfa(s.revenue.tickets)} strong />
                            </dl>
                            <p className="text-sm text-muted-foreground">Billets des événements créés sur la période.</p>
                        </Panel>

                        <Panel title="Événements" icon={<CalendarDays size={18} />} aside={<span className="text-sm tabular-nums text-muted-foreground">{`${formatInteger(s.events.total)} créés sur la période`}</span>}>
                            {Object.keys(s.events.byStatus).length === 0 ? (
                                <p className="text-sm text-muted-foreground">Aucun événement créé sur la période.</p>
                            ) : (
                                <ul className="flex flex-col">
                                    {Object.entries(s.events.byStatus).map(([status, count]) => (
                                        <li key={status} className="flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0">
                                            <StatusBadge domain="event" status={status} size="md" />
                                            <span className="text-sm font-semibold tabular-nums text-foreground-strong">{formatInteger(count)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    </div>

                    {showOrders && s.orders.total > 0 && (
                        <Panel title="Commandes par statut" icon={<ShoppingBag size={18} />} aside={<span className="text-sm tabular-nums text-muted-foreground">{`${formatInteger(s.orders.total)} au total`}</span>}>
                            <ul className="flex flex-col gap-3">
                                {orderStatuses.map(([status, count]) => (
                                    <li key={status} className="flex flex-col gap-1.5">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="text-sm font-semibold text-foreground-strong">{ORDER_STATUS_LABELS[status] ?? 'Autre statut'}</span>
                                            <span className="text-sm font-bold tabular-nums text-foreground-strong">{formatInteger(count)}</span>
                                        </div>
                                        <ShareBar value={count} max={orderMax} className="bg-info" />
                                    </li>
                                ))}
                            </ul>
                            {s.orders.avgBasket > 0 && (
                                <dl className="border-t border-border pt-2">
                                    <Row label="Panier moyen" value={formatFcfa(s.orders.avgBasket)} />
                                    <Row label="Commandes livrées" value={formatInteger(s.orders.completed)} />
                                </dl>
                            )}
                        </Panel>
                    )}

                    {showOrders && (
                        <Panel title="Catalogue de produits" icon={<Package size={18} />}>
                            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {[
                                    { label: 'Produits', value: s.products.total },
                                    { label: 'Disponibles', value: s.products.active },
                                    { label: 'Indisponibles', value: s.products.total - s.products.active },
                                ].map((p) => (
                                    <div key={p.label} className="rounded-xl bg-muted px-4 py-3">
                                        <dt className="text-sm text-muted-foreground">{p.label}</dt>
                                        <dd className="text-xl font-bold tabular-nums text-foreground-strong">{formatInteger(p.value)}</dd>
                                    </div>
                                ))}
                            </dl>
                        </Panel>
                    )}

                    {showTables && (s.revenue.tables ?? 0) !== 0 && (
                        <Panel title="Tables" icon={<UtensilsCrossed size={18} />}>
                            <dl>
                                <Row label="Recettes nettes des tables" value={formatFcfa(s.revenue.tables ?? 0)} strong />
                            </dl>
                        </Panel>
                    )}
                </>
            )}
        </div>
    );
}
