'use client';

import React from 'react';
import { Bike, ChevronRight, Clock, LogIn, MapPin, Store, UserPlus, Wallet } from 'lucide-react';
import Link from '@/components/ui/IntentLink';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useAuth } from '@/components/providers/AuthProvider';
import { usePolledJson } from '@/components/orders/partner/orders/usePolledJson';
import { formatFcfa } from '@/lib/format';
import { errorMessage } from '@/components/partner/fetch-json';
import { COURIER_PATHS, GROUP_LABELS, GROUP_ORDER, courierStateLabel, groupOf, hourText, readDay, type CourierDelivery } from './courier-view';

/**
 * Lot 12d — livraisons du jour du livreur (/courier/orders) : GET /api/courier/orders relu toutes les 15 secondes tant que
 * la page est visible. Invitations en attente en tête, puis les livraisons en cours groupées (en route, client absent,
 * prêtes à partir, en cuisine), puis celles terminées aujourd'hui. Adresse affichée ; le téléphone du client n'apparaît
 * que pendant la livraison, dans la page de la livraison. « À encaisser » : montant servi par la base, tel quel.
 */

const POLL_MS = 15_000;

function DeliveryCard({ d }: { d: CourierDelivery }) {
    const group = groupOf(d);
    const at = d.estimatedAt ?? d.scheduledFor;
    return (
        <li>
            <Link
                href={COURIER_PATHS.order(d.id)}
                className={cn(
                    'flex min-h-14 items-stretch gap-3 rounded-3xl border-2 bg-card p-4 transition-colors duration-fast ease-standard hover:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
                    group === 'ABSENT' ? 'border-warning-border' : group === 'ROUTE' ? 'border-primary' : 'border-border',
                )}
                aria-label={`Livraison ${d.orderNumber}, ${courierStateLabel(d)}, ${d.venueName}`}
            >
                <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-lg font-extrabold tabular-nums text-foreground-strong">{d.orderNumber}</span>
                        <span className={cn('rounded-full border px-2.5 py-0.5 text-sm font-bold', group === 'ABSENT' ? 'border-warning-border bg-warning-soft text-warning-text' : 'border-border bg-muted text-foreground-strong')}>
                            {courierStateLabel(d)}
                        </span>
                    </div>
                    <p className="flex items-center gap-2 text-base font-semibold text-foreground-strong">
                        <Store size={18} aria-hidden="true" className="flex-shrink-0 text-muted-foreground" />
                        <span className="min-w-0 break-words">{d.venueName}{d.zoneName ? ` · ${d.zoneName}` : ''}</span>
                    </p>
                    {d.address && (
                        <p className="flex items-start gap-2 text-base text-foreground-strong">
                            <MapPin size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                            <span className="min-w-0 break-words">{d.address}</span>
                        </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                        {at && (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground-strong">
                                <Clock size={16} aria-hidden="true" className="text-muted-foreground" />Prévue vers {hourText(at)}
                            </span>
                        )}
                        {d.balanceDue > 0 && (
                            <span className="inline-flex items-center gap-1.5 font-bold tabular-nums text-warning-text">
                                <Wallet size={16} aria-hidden="true" />À encaisser : {formatFcfa(d.balanceDue)}
                            </span>
                        )}
                    </div>
                </div>
                <ChevronRight size={24} aria-hidden="true" className="flex-shrink-0 self-center text-muted-foreground" />
            </Link>
        </li>
    );
}

export function CourierDay() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const polled = usePolledJson<unknown>(authLoading || !isAuthenticated ? null : COURIER_PATHS.apiDay, POLL_MS);
    const day = polled.data ? readDay(polled.data) : null;

    if (!authLoading && !isAuthenticated) {
        return (
            <div className="mx-auto max-w-2xl pb-24 pt-2 lg:pb-12">
                <PageHeader title="Mes livraisons" />
                <EmptyState
                    icon={<LogIn size={28} />}
                    title="Connectez-vous"
                    description="Vos livraisons s’affichent une fois connecté avec le compte invité par l’établissement."
                    actionLabel="Se connecter"
                    actionHref={`/login?redirect=${encodeURIComponent(COURIER_PATHS.home)}`}
                />
            </div>
        );
    }

    const groups = GROUP_ORDER.map((g) => ({ g, list: (day?.active ?? []).filter((d) => groupOf(d) === g) })).filter((x) => x.list.length > 0);

    return (
        <div className="mx-auto max-w-2xl space-y-6 pb-24 pt-2 lg:pb-12">
            <PageHeader title="Mes livraisons" description="Les livraisons qui vous sont confiées aujourd’hui." />

            {!polled.online && (
                <StatusBanner tone="warning" title="Pas de réseau">L’écran se remet à jour dès son retour.</StatusBanner>
            )}

            {polled.loading && !day ? (
                <div role="status" aria-busy="true" className="space-y-3">
                    <Skeleton className="h-32 rounded-3xl" />
                    <Skeleton className="h-32 rounded-3xl" />
                    <span className="sr-only">Chargement de vos livraisons…</span>
                </div>
            ) : polled.error && !day ? (
                <ErrorState title="Livraisons indisponibles" description={errorMessage(polled.error, 'Vos livraisons ne se chargent pas. Réessayez.')} onRetry={() => void polled.reload()} />
            ) : day ? (
                <>
                    {day.invitations.length > 0 && (
                        <section aria-labelledby="invitations-titre" className="space-y-3">
                            <h2 id="invitations-titre" className="text-lg font-bold text-foreground-strong">Invitations à répondre</h2>
                            <ul className="space-y-3">
                                {day.invitations.map((inv) => (
                                    <li key={inv.id}>
                                        <Link
                                            href={COURIER_PATHS.invitation(inv.id)}
                                            className="flex min-h-14 items-center gap-3 rounded-3xl border-2 border-primary bg-primary-soft p-4 text-primary-text focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring"
                                        >
                                            <UserPlus size={22} aria-hidden="true" className="flex-shrink-0" />
                                            <span className="min-w-0 flex-1 break-words text-base font-bold">{inv.partnerName} vous invite à livrer</span>
                                            <ChevronRight size={22} aria-hidden="true" className="flex-shrink-0" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {groups.length === 0 && day.done.length === 0 && (
                        <EmptyState
                            icon={<Bike size={28} />}
                            title="Aucune livraison pour le moment"
                            description="Quand l’établissement vous confie une commande, elle apparaît ici et vous êtes prévenu."
                        />
                    )}

                    {groups.map(({ g, list }) => (
                        <section key={g} aria-labelledby={`groupe-${g}`} className="space-y-3">
                            <h2 id={`groupe-${g}`} className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                                {GROUP_LABELS[g]}
                                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm tabular-nums text-foreground-strong">{list.length}</span>
                            </h2>
                            <ul className="space-y-3">{list.map((d) => <DeliveryCard key={d.id} d={d} />)}</ul>
                        </section>
                    ))}

                    {day.done.length > 0 && (
                        <section aria-labelledby="terminees-titre" className="space-y-3">
                            <h2 id="terminees-titre" className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                                Terminées aujourd’hui
                                <span className="rounded-full bg-muted px-2.5 py-0.5 text-sm tabular-nums text-foreground-strong">{day.done.length}</span>
                            </h2>
                            <ul className="divide-y divide-border rounded-3xl border border-border bg-card">
                                {day.done.map((d) => (
                                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4">
                                        <div className="min-w-0">
                                            <p className="font-bold tabular-nums text-foreground-strong">{d.orderNumber}</p>
                                            <p className="break-words text-sm text-muted-foreground">{d.venueName}{d.zoneName ? ` · ${d.zoneName}` : ''}</p>
                                        </div>
                                        <div className="text-right text-sm">
                                            <p className="font-semibold text-foreground-strong">{d.stateLabel}{d.closedAt ? ` à ${hourText(d.closedAt)}` : ''}</p>
                                            {d.onsiteAmount !== null && d.onsiteAmount > 0 && (
                                                <p className="text-muted-foreground tabular-nums">Reste reçu : {formatFcfa(d.onsiteAmount)}</p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </>
            ) : null}
        </div>
    );
}
