'use client';

import React, { useId } from 'react';
import { ShieldCheck } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePagedList } from '@/hooks/usePagedList';
import { formatDate, formatFcfaPrecise, toDakarDateTimeLocal } from '@/lib/format';
import type { DebtLine } from '@/lib/finance/admin-lists';

/**
 * Finition 3a (E-38) — « Créances » (#creances) : ce que des partenaires ou des parrains doivent encore à Event
 * Village, repris automatiquement sur leurs prochains gains ; de la plus ancienne à la plus récente. Bloc à part : une
 * créance n'est jamais déduite des autres chiffres. L'avis « Créance sur un compte » mène ici.
 */
export function DebtsList({ refreshToken = 0 }: { refreshToken?: number }) {
    const id = useId();
    const list = usePagedList<DebtLine>('/api/admin/finance/debts', 'créances', true, refreshToken);

    const columns: DataColumn<DebtLine>[] = [
        {
            key: 'who', header: 'Qui',
            render: (d) => (
                <span className="flex flex-col">
                    <span className="font-semibold text-fg">{d.who}</span>
                    <span className="text-sm text-fg-muted">{d.whoKind}</span>
                </span>
            ),
        },
        {
            key: 'why', header: 'Pourquoi',
            render: (d) => (
                <span className="flex flex-col">
                    <span className="text-fg">{d.reason}</span>
                    {d.eventTitle && <span className="text-sm text-fg-muted">{d.eventTitle}</span>}
                </span>
            ),
        },
        { key: 'since', header: 'Depuis le', render: (d) => <time dateTime={toDakarDateTimeLocal(d.since)} className="tabular-nums">{formatDate(d.since)}</time> },
        {
            key: 'remaining', header: 'Reste dû', align: 'right',
            render: (d) => (
                <span className="flex flex-col items-end">
                    <span className="font-semibold tabular-nums">{formatFcfaPrecise(d.remaining)}</span>
                    {d.amount !== d.remaining && <span className="text-sm text-fg-muted tabular-nums">sur {formatFcfaPrecise(d.amount)}</span>}
                </span>
            ),
        },
    ];

    return (
        <section id="creances" aria-labelledby={`${id}-titre`} className="flex scroll-mt-20 flex-col gap-4 rounded-3xl border border-border bg-surface p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h2 id={`${id}-titre`} className="text-lg font-semibold text-fg">Créances</h2>
                <p className="text-sm leading-relaxed text-fg-muted">
                    Ce que des partenaires ou des parrains doivent encore à Event Village. C’est repris automatiquement sur leurs prochains gains ;
                    ce n’est pas sur le compte SamirPay et ce n’est déduit d’aucun autre chiffre.
                </p>
                {list.phase === 'ready' && list.total > 0 && list.amount !== null && (
                    <p className="text-sm text-fg">
                        À récupérer : <span className="font-semibold tabular-nums">{formatFcfaPrecise(list.amount)}</span> sur{' '}
                        <span className="tabular-nums">{list.total}</span> {list.total > 1 ? 'créances' : 'créance'}.
                    </p>
                )}
            </div>
            {list.phase === 'loading' && (
                <div role="status" aria-busy="true" aria-label="Chargement des créances" className="flex flex-col gap-2">
                    <Skeleton className="h-16 rounded-2xl" />
                    <Skeleton className="h-16 rounded-2xl" />
                </div>
            )}
            {list.phase === 'error' && <ErrorState title="Créances indisponibles" description={list.message ?? undefined} onRetry={list.reload} isRetrying={list.isReloading} />}
            {list.phase === 'ready' && (
                <>
                    <DataList
                        items={list.items}
                        columns={columns}
                        getKey={(d) => d.id}
                        caption="Créances"
                        cardTitle={(d) => d.who}
                        empty={<EmptyState icon={<ShieldCheck size={28} />} title="Aucune créance" description="Personne ne doit d’argent à Event Village." />}
                    />
                    <Pagination page={list.page} pageSize={list.pageSize} total={list.total} onPageChange={list.setPage} ariaLabel="Pages des créances" />
                </>
            )}
        </section>
    );
}
