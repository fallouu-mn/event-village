'use client';

/**
 * Lot 12c — « Ma journée » : chiffres servis par GET /api/partner/orders/day (order_partner_day, calculés en base) :
 * commandes reçues aujourd'hui, à accepter, recette des commandes remises (payé en ligne, payé sur place), plats bientôt
 * épuisés. Rien n'est additionné ici.
 */
import React from 'react';
import { AlarmClock, Flame, ReceiptText, Wallet } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { formatFcfa, formatInteger } from '@/lib/format';
import type { DayReply } from './order-types';

export function DaySummary({ day, loading }: { day: DayReply['day'] | null; loading: boolean }) {
    return (
        <section aria-labelledby="journee-titre" className="space-y-3">
            <h2 id="journee-titre" className="text-lg font-bold text-foreground-strong">Ma journée</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label="Commandes reçues aujourd’hui"
                    value={day ? formatInteger(day.receivedToday) : '—'}
                    hint={day ? `${formatInteger(day.openNow)} en cours` : undefined}
                    icon={<ReceiptText size={18} />}
                    tone="brand"
                    loading={loading && !day}
                />
                <KpiCard
                    label="À accepter"
                    value={day ? formatInteger(day.toAccept) : '—'}
                    hint={day && day.toAccept > 0 ? 'Répondez avant la fin du délai' : 'Rien en attente'}
                    icon={<AlarmClock size={18} />}
                    tone={day && day.toAccept > 0 ? 'warning' : 'neutral'}
                    loading={loading && !day}
                />
                <KpiCard
                    label="Recette du jour"
                    value={day ? formatFcfa(day.revenueToday) : '—'}
                    hint={day ? `${formatInteger(day.handedToday)} ${day.handedToday > 1 ? 'remises' : 'remise'} · en ligne ${formatFcfa(day.paidOnlineToday)} · sur place ${formatFcfa(day.onsiteToday)}` : undefined}
                    icon={<Wallet size={18} />}
                    tone="success"
                    loading={loading && !day}
                    className="col-span-2 lg:col-span-1"
                />
                <div className="col-span-2 flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:p-5 lg:col-span-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Flame size={18} className="text-warning-text" aria-hidden="true" />
                        Bientôt épuisés
                    </p>
                    {!day ? (
                        <p className="text-sm text-muted-foreground">{loading ? 'Chargement…' : '—'}</p>
                    ) : day.low.length === 0 ? (
                        <p className="text-sm text-foreground">Rien ne manque pour le moment.</p>
                    ) : (
                        <ul className="space-y-1">
                            {day.low.slice(0, 5).map((p) => (
                                <li key={`${p.kind}-${p.productId}`} className="flex items-baseline justify-between gap-2 text-sm">
                                    <span className="min-w-0 break-words font-semibold text-foreground-strong">{p.name}</span>
                                    <span className={p.left === 0 ? 'flex-shrink-0 font-bold text-danger-text' : 'flex-shrink-0 font-semibold text-warning-text'}>
                                        {p.left === 0 ? 'Épuisé' : <span className="tabular-nums">{`${formatInteger(p.left)} ${p.kind === 'PORTIONS' ? 'portion' : 'unité'}${p.left > 1 ? 's' : ''}`}</span>}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </section>
    );
}
