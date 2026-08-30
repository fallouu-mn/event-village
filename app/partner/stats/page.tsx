'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart3,
    Ticket,
    ShoppingBag,
    Building2,
    Calendar,
    TrendingUp,
    Users,
    RefreshCw,
    AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

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
        revenue: { total: number; tickets: number; orders: number; halls: number };
    };
}

type PeriodKey = 'today' | '7d' | '30d' | 'month' | 'custom';

function getPeriodDates(period: PeriodKey): { from: string; to: string } {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toISO = (d: Date) => d.toISOString();

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    if (period === 'today') {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return { from: toISO(start), to: toISO(endOfDay) };
    }
    if (period === '7d') {
        const start = new Date(now);
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return { from: toISO(start), to: toISO(endOfDay) };
    }
    if (period === '30d') {
        const start = new Date(now);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        return { from: toISO(start), to: toISO(endOfDay) };
    }
    if (period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return { from: toISO(start), to: toISO(endOfDay) };
    }
    // custom — caller handles
    return { from: '', to: '' };
    void pad; // suppress unused
}

const PERIOD_LABELS: Record<PeriodKey, string> = {
    today: "Aujourd'hui",
    '7d': '7 derniers jours',
    '30d': '30 derniers jours',
    month: 'Mois en cours',
    custom: 'Personnalisé',
};

const ORDER_STATUS_COLORS: Record<string, string> = {
    EN_ATTENTE: 'bg-amber-400',
    CONFIRMEE: 'bg-blue-400',
    EN_PREPARATION: 'bg-orange-400',
    PRETE: 'bg-cyan-400',
    EN_LIVRAISON: 'bg-indigo-400',
    LIVREE: 'bg-emerald-500',
    ANNULEE: 'bg-red-400',
    REJETEE: 'bg-rose-600',
};

function MiniBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
    const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
    return (
        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
            <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
        </div>
    );
}

export default function PartnerStatsPage() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activePeriod, setActivePeriod] = useState<PeriodKey>('30d');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const fetchStats = useCallback(async (period: PeriodKey, cfrom?: string, cto?: string) => {
        setLoading(true);
        setError(null);
        try {
            let from = '';
            let to = '';
            if (period === 'custom') {
                from = cfrom || '';
                to = cto || '';
                if (!from || !to) { setLoading(false); return; }
                // Convert date inputs (YYYY-MM-DD) to ISO
                from = new Date(from + 'T00:00:00').toISOString();
                to = new Date(to + 'T23:59:59').toISOString();
            } else {
                const dates = getPeriodDates(period);
                from = dates.from;
                to = dates.to;
            }

            const params = new URLSearchParams({ from, to });
            const res = await fetch(`/api/partner/stats?${params}`);
            const data = await res.json();
            if (data.success) {
                setStats(data);
            } else {
                setError(data.error || 'Erreur de chargement.');
            }
        } catch {
            setError('Impossible de charger les statistiques.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activePeriod !== 'custom') {
            fetchStats(activePeriod);
        }
    }, [activePeriod, fetchStats]);

    const handleCustomApply = () => {
        fetchStats('custom', customFrom, customTo);
    };

    const s = stats?.stats;
    const totalRevenue = s?.revenue.total || 0;
    const maxOrderStatus = s ? Math.max(...Object.values(s.orders.byStatus || {}), 1) : 1;
    const maxRevChannel = totalRevenue > 0 ? totalRevenue : 1;

    return (
        <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-[#FF5722]" />
                        Statistiques
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                        Données réelles isolées à votre espace partenaire
                    </p>
                </div>
                <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    onClick={() => fetchStats(activePeriod, customFrom, customTo)}
                    disabled={loading}
                >
                    Actualiser
                </Button>
            </div>

            {/* Period selector */}
            <div className="space-y-2">
                <div className="flex gap-1.5 flex-wrap">
                    {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((p) => (
                        <button
                            key={p}
                            onClick={() => setActivePeriod(p)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                                activePeriod === p
                                    ? 'bg-[#FF5722] text-white border-[#FF5722]'
                                    : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:border-[#FF5722]/50'
                            }`}
                        >
                            {PERIOD_LABELS[p]}
                        </button>
                    ))}
                </div>

                {activePeriod === 'custom' && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <input
                            type="date"
                            value={customFrom}
                            onChange={(e) => setCustomFrom(e.target.value)}
                            className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                        />
                        <span className="text-xs text-slate-400">→</span>
                        <input
                            type="date"
                            value={customTo}
                            onChange={(e) => setCustomTo(e.target.value)}
                            className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-white"
                        />
                        <Button variant="primary" size="sm" onClick={handleCustomApply}>
                            Appliquer
                        </Button>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-3 text-xs text-red-700 dark:text-red-300">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* Loading skeleton */}
            {loading && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-20 rounded-2xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />
                        ))}
                    </div>
                    <div className="h-48 rounded-2xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />
                </div>
            )}

            {s && !loading && (
                <>
                    {/* KPI Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'CA Total', value: `${totalRevenue.toLocaleString('fr-FR')} F`, icon: TrendingUp, color: 'text-[#FF5722]', bg: 'bg-orange-50 dark:bg-orange-950/20' },
                            { label: 'Billets vendus', value: s.tickets.sold, icon: Ticket, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
                            { label: 'Commandes', value: s.orders.total, icon: ShoppingBag, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20' },
                            { label: 'Réservations salles', value: s.hallReservations.confirmed, icon: Building2, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/20' },
                        ].map((kpi) => {
                            const Icon = kpi.icon;
                            return (
                                <div key={kpi.label} className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                                    <div className={`w-8 h-8 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                                        <Icon className={`w-4 h-4 ${kpi.color}`} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{kpi.label}</div>
                                        <div className={`text-lg font-black mt-0.5 ${kpi.color}`}>{kpi.value}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Revenue by channel */}
                    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-4">
                        <h2 className="text-sm font-black text-slate-900 dark:text-white">Répartition des revenus</h2>
                        <div className="space-y-3">
                            {[
                                { label: 'Billetterie', value: s.revenue.tickets, icon: Ticket, color: 'bg-emerald-500' },
                                { label: 'Commandes', value: s.revenue.orders, icon: ShoppingBag, color: 'bg-blue-500' },
                                { label: 'Salles', value: s.revenue.halls, icon: Building2, color: 'bg-violet-500' },
                            ].map(({ label, value, icon: Icon, color }) => (
                                <div key={label} className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-slate-50 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                                        <Icon className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between text-[11px]">
                                            <span className="font-semibold text-slate-700 dark:text-zinc-300">{label}</span>
                                            <span className="font-black text-slate-900 dark:text-white">{value.toLocaleString('fr-FR')} FCFA</span>
                                        </div>
                                        <MiniBar value={value} max={maxRevChannel} colorClass={color} />
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 w-8 text-right">
                                        {totalRevenue > 0 ? `${Math.round((value / totalRevenue) * 100)}%` : '0%'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Orders by status */}
                    {s.orders.total > 0 && (
                        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-black text-slate-900 dark:text-white">Commandes par statut</h2>
                                <Badge variant="neutral" size="sm">{s.orders.total} au total</Badge>
                            </div>
                            <div className="space-y-2">
                                {Object.entries(s.orders.byStatus).map(([status, count]) => (
                                    <div key={status} className="flex items-center gap-3">
                                        <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 w-28 flex-shrink-0">
                                            {status.replace(/_/g, ' ')}
                                        </span>
                                        <MiniBar value={count} max={maxOrderStatus} colorClass={ORDER_STATUS_COLORS[status] || 'bg-slate-400'} />
                                        <span className="text-[11px] font-black text-slate-900 dark:text-white w-6 text-right">{count}</span>
                                    </div>
                                ))}
                            </div>
                            {s.orders.avgBasket > 0 && (
                                <div className="text-[11px] text-slate-500 dark:text-zinc-400 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                    Panier moyen : <span className="font-black text-slate-700 dark:text-zinc-200">{s.orders.avgBasket.toLocaleString('fr-FR')} FCFA</span>
                                    {' · '}
                                    Commandes livrées : <span className="font-black text-emerald-600 dark:text-emerald-400">{s.orders.completed}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Events & Tickets */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-3">
                            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-[#FF5722]" />
                                Événements
                            </h2>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">{s.events.total}</div>
                            <div className="space-y-1">
                                {Object.entries(s.events.byStatus).map(([status, count]) => (
                                    <div key={status} className="flex justify-between text-[11px]">
                                        <span className="text-slate-500 dark:text-zinc-400">{status}</span>
                                        <span className="font-bold text-slate-700 dark:text-zinc-300">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-3">
                            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Ticket className="w-4 h-4 text-[#FF5722]" />
                                Billetterie
                            </h2>
                            <div className="text-2xl font-black text-slate-900 dark:text-white">{s.tickets.sold} vendus</div>
                            <div className="space-y-1 text-[11px]">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-zinc-400">Billets utilisés</span>
                                    <span className="font-bold text-slate-700 dark:text-zinc-300">{s.tickets.used}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 dark:text-zinc-400">Revenus billetterie</span>
                                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                                        {s.tickets.revenue.toLocaleString('fr-FR')} FCFA
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Products */}
                    <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5">
                        <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-[#FF5722]" />
                            Catalogue Produits
                        </h2>
                        <div className="flex items-center gap-4 text-sm">
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</div>
                                <div className="text-xl font-black text-slate-900 dark:text-white">{s.products.total}</div>
                            </div>
                            <div className="w-px h-8 bg-slate-100 dark:bg-zinc-800" />
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disponibles</div>
                                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{s.products.active}</div>
                            </div>
                            <div className="w-px h-8 bg-slate-100 dark:bg-zinc-800" />
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hors stock</div>
                                <div className="text-xl font-black text-amber-600">{s.products.total - s.products.active}</div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
