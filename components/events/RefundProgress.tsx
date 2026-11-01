'use client';

import React from 'react';
import { BadgeCheck, Hourglass, RefreshCw, RotateCcw, SearchCheck, Wallet } from 'lucide-react';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/KpiCard';
import { ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { formatFcfa, formatInteger } from '@/lib/format';
import { useServerData } from '@/components/partner/useServerData';

/**
 * Lot 5 (tâche 5.8, contrat J et D6) — avancement des remboursements d'un événement annulé.
 * API fixée (la zone admin l'importe) : <RefundProgress eventId isAdmin />.
 * Lu sur GET /api/partner/events/[id]/cancellation → { progress } (propriétaire ou admin) : versés, en
 * cours, en vérification, plus « à reprendre » pour l'admin (la route ne le sert qu'aux admins), et les
 * espèces que l'organisateur rembourse lui-même. Aucun calcul dans le navigateur.
 */

export interface RefundProgressProps {
    eventId: string;
    isAdmin: boolean;
    className?: string;
}

interface CountAndTotal {
    count: number;
    total: number;
}

interface CancellationProgress {
    paid: CountAndTotal;
    in_progress: CountAndTotal;
    verifying: CountAndTotal;
    to_retry?: CountAndTotal;
    organizer_cash: CountAndTotal;
}

function refundsHint(c: CountAndTotal): string {
    return c.count === 1 ? '1 remboursement' : `${formatInteger(c.count)} remboursements`;
}

export function RefundProgress({ eventId, isAdmin, className }: RefundProgressProps) {
    const { data, error, loading, refreshing, reload } = useServerData<{ progress?: CancellationProgress; impact?: unknown }>(
        `/api/partner/events/${eventId}/cancellation`,
    );
    const progress = data?.progress ?? null;

    if (!loading && !error && !progress) return null;

    return (
        <section aria-labelledby={`remboursements-${eventId}`} className={className}>
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 id={`remboursements-${eventId}`} className="text-lg font-bold text-fg">Remboursements</h2>
                    <p className="text-sm text-fg-muted">Avancement des remboursements des billets payés en ligne après l’annulation.</p>
                </div>
                <IconButton aria-label="Actualiser l’avancement des remboursements" onClick={() => void reload()} isLoading={refreshing} variant="secondary">
                    <RefreshCw size={18} />
                </IconButton>
            </div>

            {loading && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                </div>
            )}

            {!loading && error && (
                <ErrorState title="Avancement indisponible" description={error} onRetry={() => void reload()} className="my-0" />
            )}

            {!loading && !error && progress && (
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <KpiCard label="Versés" value={formatFcfa(progress.paid.total)} hint={refundsHint(progress.paid)} tone="success" icon={<BadgeCheck size={18} />} />
                        <KpiCard label="En cours" value={formatFcfa(progress.in_progress.total)} hint={refundsHint(progress.in_progress)} tone="info" icon={<Hourglass size={18} />} />
                        <KpiCard
                            label="En vérification"
                            value={formatFcfa(progress.verifying.total)}
                            hint={`${refundsHint(progress.verifying)} : issue à confirmer auprès de l’opérateur`}
                            tone="warning"
                            icon={<SearchCheck size={18} />}
                        />
                        {isAdmin && progress.to_retry && (
                            <KpiCard
                                label="À reprendre"
                                value={formatFcfa(progress.to_retry.total)}
                                hint={`${refundsHint(progress.to_retry)} échoués ou bloqués, à reprendre`}
                                tone="danger"
                                icon={<RotateCcw size={18} />}
                            />
                        )}
                    </div>
                    {progress.organizer_cash.count > 0 && (
                        <KpiCard
                            label="Espèces à rembourser par l’organisateur"
                            value={formatFcfa(progress.organizer_cash.total)}
                            hint={`${refundsHint(progress.organizer_cash)} à régler directement aux participants payés en espèces`}
                            tone="neutral"
                            icon={<Wallet size={18} />}
                        />
                    )}
                </div>
            )}
        </section>
    );
}

export default RefundProgress;
