'use client';

import React, { useId } from 'react';
import { HandCoins } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePagedList } from '@/hooks/usePagedList';
import { formatDateTime, formatFcfaPrecise, toDakarDateTimeLocal } from '@/lib/format';
import type { RefundToPayLine } from '@/lib/finance/admin-lists';

/**
 * Finition 3a (E-07) — « Remboursements à verser » (#remboursements-a-verser) : remboursements demandés que les clients
 * n'ont pas encore reçus, du plus ancien au plus récent. Lecture seule ; un remboursement qui attend une décision renvoie
 * à « Versements à reprendre » (`canResume` : permission refunds.manage), où se trouvent Renvoyer et Marquer versé.
 */
export function RefundsToPayList({ canResume, refreshToken = 0 }: { canResume: boolean; refreshToken?: number }) {
    const id = useId();
    const list = usePagedList<RefundToPayLine>('/api/admin/finance/refunds-to-pay', 'remboursements à verser', true, refreshToken);

    const state = (r: RefundToPayLine) => (
        <span className="flex flex-col gap-1">
            <span className={r.needsAction ? 'font-semibold text-warning-text' : 'text-foreground-strong'}>{r.state}</span>
            {r.needsAction && canResume && (
                <a href="#versements-a-reprendre" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-text underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Traiter dans « Versements à reprendre »
                </a>
            )}
        </span>
    );

    const columns: DataColumn<RefundToPayLine>[] = [
        {
            key: 'since', header: 'Demandé le',
            render: (r) => <time dateTime={toDakarDateTimeLocal(r.since)} className="tabular-nums">{formatDateTime(r.since)}</time>,
        },
        {
            key: 'kind', header: 'Remboursement',
            render: (r) => (
                <span className="flex flex-col">
                    <span className="text-foreground-strong">{r.kind}</span>
                    {r.eventTitle && <span className="text-sm text-muted-foreground">{r.eventTitle}</span>}
                </span>
            ),
        },
        { key: 'who', header: 'Client', render: (r) => <span className="tabular-nums">{r.beneficiary ?? 'Client sans nom'}</span> },
        { key: 'amount', header: 'Montant', align: 'right', render: (r) => <span className="font-semibold tabular-nums">{formatFcfaPrecise(r.amount)}</span> },
        { key: 'state', header: 'Où il en est', render: state },
    ];

    return (
        <section id="remboursements-a-verser" aria-labelledby={`${id}-titre`} className="flex scroll-mt-20 flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h2 id={`${id}-titre`} className="text-lg font-semibold text-foreground-strong">Remboursements à verser</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    Remboursements demandés que les clients n’ont pas encore reçus. Cet argent est sur le compte SamirPay mais leur revient.
                </p>
                {list.phase === 'ready' && list.total > 0 && list.amount !== null && (
                    <p className="text-sm text-foreground-strong">
                        <span className="tabular-nums font-semibold">{list.total}</span> {list.total > 1 ? 'remboursements' : 'remboursement'} pour{' '}
                        <span className="font-semibold tabular-nums">{formatFcfaPrecise(list.amount)}</span>.
                    </p>
                )}
            </div>
            {list.phase === 'loading' && (
                <div role="status" aria-busy="true" aria-label="Chargement des remboursements à verser" className="flex flex-col gap-2">
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                </div>
            )}
            {list.phase === 'error' && (
                <ErrorState title="Remboursements à verser indisponibles" description={list.message ?? undefined} onRetry={list.reload} isRetrying={list.isReloading} />
            )}
            {list.phase === 'ready' && (
                <>
                    <DataList
                        items={list.items}
                        columns={columns} breakpoint="xl"
                        getKey={(r) => r.id}
                        caption="Remboursements à verser"
                        cardTitle={(r) => <span className="tabular-nums">{formatFcfaPrecise(r.amount)}</span>}
                        empty={<EmptyState icon={<HandCoins size={28} />} title="Aucun remboursement à verser" description="Tous les remboursements demandés ont été reçus par les clients." />}
                    />
                    <Pagination page={list.page} pageSize={list.pageSize} total={list.total} onPageChange={list.setPage} ariaLabel="Pages des remboursements à verser" />
                </>
            )}
        </section>
    );
}
