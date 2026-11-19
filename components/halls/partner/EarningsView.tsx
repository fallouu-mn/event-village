'use client';

/**
 * Lot 10b (point 3) : recettes des salles de la propriétaire (GET /api/partner/halls/earnings, lues dans le grand
 * livre : ventes moins remboursements). Totaux « disponible » et « à venir » et chaque ligne (salle, période, état,
 * payé, remboursé, recette, date de disponibilité ou « Disponible ») viennent tels quels de la route : aucun montant
 * calculé ici. Le retrait se fait depuis /partner/finance. États : chargement, erreur avec « Réessayer », aucune recette.
 */
import React from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { useServerData } from '@/components/partner/useServerData';
import { dakarDate, fcfaText } from '@/lib/halls/views';
import { EarningsSkeleton } from './HallSkeletons';
import { periodOf, type EarningRow, type EarningsBody } from './hall-api';

function availability(row: EarningRow): React.ReactNode {
    if (row.available) return <Badge variant="success" icon={<CheckCircle2 size={12} />}>Disponible</Badge>;
    if (row.availableAt) return <span className="text-sm text-foreground-strong">{`Le ${dakarDate(row.availableAt)}`}</span>;
    return <span className="text-sm text-muted-foreground">Sans recette</span>;
}

/** Nom de la salle, lien vers le détail de la réservation. */
function ReservationLink({ row }: { row: EarningRow }) {
    return (
        <Link
            href={`/partner/halls/reservations/${encodeURIComponent(row.reservationId)}`}
            className="inline-flex min-h-11 items-center font-semibold text-primary-text underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            {row.hallName}
            <span className="sr-only">{`, voir la réservation : ${periodOf(row)}`}</span>
        </Link>
    );
}

const COLUMNS: DataColumn<EarningRow>[] = [
    {
        key: 'salle',
        header: 'Salle',
        hideOnCard: true,
        render: (r) => <ReservationLink row={r} />,
    },
    {
        key: 'periode',
        header: 'Période',
        render: (r) => periodOf(r),
    },
    { key: 'etat', header: 'État', render: (r) => r.stateLabel },
    { key: 'paye', header: 'Payé', align: 'right', className: 'tabular-nums whitespace-nowrap', render: (r) => fcfaText(r.paidAmount) },
    { key: 'rembourse', header: 'Remboursé', align: 'right', className: 'tabular-nums whitespace-nowrap', render: (r) => fcfaText(r.refundedAmount) },
    {
        key: 'recette',
        header: 'Votre recette',
        align: 'right',
        className: 'tabular-nums whitespace-nowrap',
        render: (r) => <span className="font-bold">{fcfaText(r.earned)}</span>,
    },
    { key: 'dispo', header: 'Disponibilité', render: availability },
];

export function EarningsView() {
    const { data, error, loading, refreshing, reload } = useServerData<EarningsBody>('/api/partner/halls/earnings');

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <EarningsSkeleton />
                <span className="sr-only">Chargement des recettes…</span>
            </div>
        );
    }

    const rows = Array.isArray(data?.rows) ? data.rows : [];

    return (
        <div className="mx-auto w-full max-w-5xl pb-10">
            <PageHeader
                back={{ href: '/partner/halls', label: 'Mes salles' }}
                title="Recettes des salles"
                description="Ce que vos salles vous rapportent, réservation par réservation, une fois les remboursements déduits. Chaque recette devient disponible à la date indiquée, après la fin de la réservation."
                actions={<LinkButton href="/partner/finance" leftIcon={<Wallet size={18} />}>Retirer mes gains</LinkButton>}
            />

            {error && !data ? (
                <ErrorState
                    title="Les recettes n’ont pas pu être chargées"
                    description={error}
                    onRetry={() => void reload()}
                    isRetrying={refreshing}
                />
            ) : (
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <KpiCard
                            label="Disponible"
                            value={fcfaText(data?.availableTotal)}
                            hint="À retirer depuis Finances."
                            tone="success"
                            icon={<CheckCircle2 size={18} />}
                        />
                        <KpiCard
                            label="À venir"
                            value={fcfaText(data?.upcomingTotal)}
                            hint="Disponible après la fin des réservations concernées."
                            tone="info"
                            icon={<Clock size={18} />}
                        />
                    </div>

                    <section aria-labelledby="recettes-liste" className="flex flex-col gap-3">
                        <h2 id="recettes-liste" className="text-lg font-bold text-foreground-strong">Par réservation</h2>
                        <DataList
                            items={rows}
                            columns={COLUMNS}
                            getKey={(r) => r.reservationId}
                            caption="Recettes des salles, par réservation"
                            cardTitle={(r) => <ReservationLink row={r} />}
                            empty={(
                                <EmptyState
                                    icon={<Wallet size={28} />}
                                    title="Aucune recette pour le moment"
                                    description="Les recettes apparaissent dès qu’un client paie une réservation de l’une de vos salles."
                                    actionLabel="Voir mes salles"
                                    actionHref="/partner/halls"
                                />
                            )}
                        />
                    </section>
                </div>
            )}
        </div>
    );
}
