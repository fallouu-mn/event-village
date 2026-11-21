'use client';

/**
 * Lot 11b : recettes des établissements (GET /api/partner/tables/earnings, lues dans le grand livre : acomptes encaissés
 * moins remboursements). Totaux « disponible » et « à venir » et chaque ligne (établissement, jour et heure, personnes,
 * état, payé, rendu, recette, disponibilité) viennent tels quels de la route : aucun montant calculé ici. Le paiement
 * sur place n'y figure jamais (réglé directement à l'établissement). Le retrait se fait depuis /partner/finance.
 */
import React from 'react';
import Link from 'next/link';
import { Banknote, CheckCircle2, Clock, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useServerData } from '@/components/partner/useServerData';
import { formatDate } from '@/lib/format';
import { dayText, fcfaText, guestsText, hmText } from '@/lib/tables/views';
import { TableEarningsSkeleton } from './TablesSkeletons';
import { capitalize, toneVariant, type TableEarningRow, type TableEarningsBody } from './venue-api';

function whenOf(r: TableEarningRow): string {
    return `${capitalize(dayText(String(r.date), true))} à ${hmText(String(r.time))}`;
}

function availability(r: TableEarningRow): React.ReactNode {
    if (r.available) return <Badge variant="success" icon={<CheckCircle2 size={12} aria-hidden="true" />}>Disponible</Badge>;
    if (r.availableAt) return <span className="text-sm text-foreground-strong tabular-nums">{`Le ${formatDate(r.availableAt)}`}</span>;
    return <span className="text-sm text-muted-foreground">Sans recette</span>;
}

function ReservationLink({ row }: { row: TableEarningRow }) {
    return (
        <Link
            href={`/partner/tables/reservations/${encodeURIComponent(row.reservationId)}`}
            className="inline-flex min-h-11 items-center font-semibold text-primary-text underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            {row.venueName}
            <span className="sr-only">{`, voir la réservation du ${dayText(String(row.date))} à ${hmText(String(row.time))}`}</span>
        </Link>
    );
}

const COLUMNS: DataColumn<TableEarningRow>[] = [
    { key: 'etablissement', header: 'Établissement', hideOnCard: true, render: (r) => <ReservationLink row={r} /> },
    { key: 'quand', header: 'Réservation', render: (r) => <span className="tabular-nums">{`${whenOf(r)} · ${guestsText(r.guests)}`}</span> },
    { key: 'etat', header: 'État', render: (r) => <Badge variant={toneVariant(r.tone)}>{r.stateLabel}</Badge> },
    { key: 'paye', header: 'Payé', align: 'right', className: 'tabular-nums whitespace-nowrap', render: (r) => fcfaText(r.paidAmount) },
    { key: 'rendu', header: 'Rendu', align: 'right', className: 'tabular-nums whitespace-nowrap', render: (r) => fcfaText(r.refundedAmount) },
    { key: 'recette', header: 'Votre recette', align: 'right', className: 'tabular-nums whitespace-nowrap', render: (r) => <span className="font-bold">{fcfaText(r.earned)}</span> },
    { key: 'dispo', header: 'Disponibilité', render: availability },
];

export function TableEarningsView() {
    const { data, error, loading, refreshing, reload } = useServerData<TableEarningsBody>('/api/partner/tables/earnings');

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <TableEarningsSkeleton />
                <span className="sr-only">Chargement des recettes…</span>
            </div>
        );
    }

    const rows = Array.isArray(data?.rows) ? data.rows : [];

    return (
        <div className="mx-auto w-full max-w-5xl pb-10">
            <PageHeader
                back={{ href: '/partner/tables', label: 'Mes établissements' }}
                title="Recettes des tables"
                description="Les acomptes payés en ligne par vos clients, réservation par réservation, une fois les remboursements déduits. Chaque recette devient disponible à la date indiquée, après la fin du créneau."
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
                            hint="Disponible après la fin des créneaux concernés, à la date indiquée."
                            tone="info"
                            icon={<Clock size={18} />}
                        />
                    </div>

                    <StatusBanner tone="info" icon={<Banknote size={20} />} title="Le paiement sur place n’apparaît pas ici">
                        Ce que vos clients règlent directement à l’établissement (espèces, Wave, Orange Money…) ne passe pas par Event Village. Il reste noté sur chaque réservation pour votre suivi.
                    </StatusBanner>

                    <section aria-labelledby="recettes-tables-liste" className="flex flex-col gap-3">
                        <h2 id="recettes-tables-liste" className="text-lg font-bold text-foreground-strong">Par réservation</h2>
                        <DataList
                            items={rows}
                            columns={COLUMNS}
                            getKey={(r) => r.reservationId}
                            caption="Recettes des tables, par réservation"
                            cardTitle={(r) => <ReservationLink row={r} />}
                            breakpoint="xl"
                            empty={(
                                <EmptyState
                                    icon={<Wallet size={28} />}
                                    title="Aucune recette pour le moment"
                                    description="Les recettes apparaissent dès qu’un client paie l’acompte d’une réservation. Une réservation gratuite ne donne pas de recette."
                                    actionLabel="Voir mes établissements"
                                    actionHref="/partner/tables"
                                />
                            )}
                        />
                    </section>
                </div>
            )}
        </div>
    );
}
