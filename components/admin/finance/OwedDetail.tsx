'use client';

import React, { useId } from 'react';
import { Users } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePagedList } from '@/hooks/usePagedList';
import { formatFcfaPrecise } from '@/lib/format';
import type { OwedLine } from '@/lib/finance/admin-lists';
import type { OwedBlock } from '@/lib/finance/admin-summary';
import { MoneyLines } from './MoneyFigure';

/** Une liste « compte par compte » (partenaires ou parrains), paginée par le serveur. */
function OwedList({ kind, refreshToken }: { kind: 'ORGANISATEUR' | 'PARRAINAGE'; refreshToken: number }) {
    const partner = kind === 'ORGANISATEUR';
    const list = usePagedList<OwedLine>(`/api/admin/finance/owed?kind=${kind}`, partner ? 'dû aux partenaires' : 'dû aux parrains', true, refreshToken);
    const columns: DataColumn<OwedLine>[] = [
        { key: 'who', header: partner ? 'Partenaire' : 'Parrain', render: (o) => <span className="font-semibold text-fg">{o.who}</span> },
        { key: 'total', header: 'Dû', align: 'right', render: (o) => <span className="font-semibold tabular-nums">{formatFcfaPrecise(o.total)}</span> },
        { key: 'now', header: 'Retirable aujourd’hui', align: 'right', render: (o) => <span className="tabular-nums">{formatFcfaPrecise(o.withdrawableNow)}</span> },
        { key: 'pending', header: 'En attente', align: 'right', render: (o) => <span className="tabular-nums">{formatFcfaPrecise(o.pending)}</span> },
        { key: 'frozen', header: 'Gelé', align: 'right', render: (o) => <span className="tabular-nums">{formatFcfaPrecise(o.frozen)}</span> },
        { key: 'progress', header: 'Retrait en cours', align: 'right', render: (o) => <span className="tabular-nums">{formatFcfaPrecise(o.withdrawalsInProgress)}</span> },
    ];
    if (list.phase === 'loading') {
        return (
            <div role="status" aria-busy="true" aria-label={partner ? 'Chargement du dû aux partenaires' : 'Chargement du dû aux parrains'} className="flex flex-col gap-2">
                <Skeleton className="h-14 rounded-2xl" />
                <Skeleton className="h-14 rounded-2xl" />
            </div>
        );
    }
    if (list.phase === 'error') {
        return <ErrorState title={partner ? 'Dû aux partenaires indisponible' : 'Dû aux parrains indisponible'} description={list.message ?? undefined} onRetry={list.reload} isRetrying={list.isReloading} />;
    }
    return (
        <>
            <DataList
                items={list.items}
                columns={columns}
                getKey={(o) => o.id}
                caption={partner ? 'Dû aux partenaires, compte par compte' : 'Dû aux parrains, compte par compte'}
                cardTitle={(o) => o.who}
                empty={<EmptyState icon={<Users size={28} />} title={partner ? 'Rien n’est dû aux partenaires' : 'Rien n’est dû aux parrains'} description="Aucun solde à verser pour le moment." />}
            />
            <Pagination page={list.page} pageSize={list.pageSize} total={list.total} onPageChange={list.setPage} ariaLabel={partner ? 'Pages des partenaires' : 'Pages des parrains'} />
        </>
    );
}

/**
 * Finition 3a (E-06) — détail de « Dû aux partenaires » (#du-aux-partenaires) : de quoi il est fait (retirable
 * aujourd'hui, en attente de la fin des événements, gelé, retraits en cours d'envoi), puis compte par compte ; même
 * chose pour les parrains (#du-aux-parrains). Chiffres à l'instant, lus sur le grand livre par le serveur.
 */
export function OwedDetail({ partners, referrers, refreshToken = 0 }: { partners: OwedBlock | null; referrers: OwedBlock | null; refreshToken?: number }) {
    const id = useId();
    return (
        <section id="du-aux-partenaires" aria-labelledby={`${id}-titre`} className="flex scroll-mt-20 flex-col gap-4 rounded-3xl border border-border bg-surface p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h2 id={`${id}-titre`} className="text-lg font-semibold text-fg">Dû aux partenaires</h2>
                <p className="text-sm leading-relaxed text-fg-muted">
                    L’argent des ventes qui appartient aux partenaires, qu’ils puissent déjà le retirer ou qu’ils attendent la fin de leurs
                    événements. Il est sur le compte SamirPay mais n’est pas à Event Village. Chiffres à l’instant.
                </p>
            </div>
            {partners && (
                <MoneyLines
                    lines={[
                        {
                            label: 'Disponible pour les partenaires',
                            value: formatFcfaPrecise(partners.available),
                            hint: <>Dont <span className="tabular-nums">{formatFcfaPrecise(partners.withdrawable_now)}</span> retirables tout de suite et <span className="tabular-nums">{formatFcfaPrecise(partners.frozen)}</span> gelés (événements suspendus, libérés à la reprise).</>,
                        },
                        { label: 'En attente de la fin des événements', value: formatFcfaPrecise(partners.pending) },
                        { label: 'Retraits en cours d’envoi', value: formatFcfaPrecise(partners.withdrawals_in_progress), hint: 'Demandés par les partenaires, pas encore confirmés par SamirPay.' },
                        { label: 'Dû aux partenaires', value: formatFcfaPrecise(partners.total), total: true },
                    ]}
                />
            )}
            <OwedList kind="ORGANISATEUR" refreshToken={refreshToken} />

            <div id="du-aux-parrains" className="flex scroll-mt-20 flex-col gap-3 border-t border-border pt-4">
                <h3 className="text-base font-semibold text-fg">Dû aux parrains</h3>
                <p className="text-sm leading-relaxed text-fg-muted">
                    Commissions de parrainage pas encore retirées : elles sont aussi sur le compte SamirPay et n’appartiennent pas à Event Village.
                    {referrers && <> Total : <span className="font-semibold text-fg tabular-nums">{formatFcfaPrecise(referrers.total)}</span>.</>}
                </p>
                <OwedList kind="PARRAINAGE" refreshToken={refreshToken} />
            </div>
        </section>
    );
}
