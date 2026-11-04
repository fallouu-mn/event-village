'use client';

import React from 'react';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { KpiCardSkeleton } from '@/components/ui/KpiCard';
import { formatFcfa, formatInteger, formatShortDate } from '@/lib/format';
import { useServerData } from '@/components/partner/useServerData';
import { BarList, PilotageSection } from './PilotageBlocks';
import type { PilotageSales } from './types';

type CategoryRow = PilotageSales['by_category'][number];

const COLUMNS: DataColumn<CategoryRow>[] = [
    {
        key: 'name',
        header: 'Catégorie',
        hideOnCard: true,
        render: (c) => (
            <span className="font-semibold">
                {c.name}
                {!c.is_active && <span className="ml-2 font-normal text-fg-muted">(inactive)</span>}
                {c.is_active && !c.is_visible && <span className="ml-2 font-normal text-fg-muted">(masquée)</span>}
            </span>
        ),
    },
    { key: 'price', header: 'Prix', align: 'right', render: (c) => formatFcfa(c.price) },
    { key: 'sold', header: 'Vendus', align: 'right', render: (c) => formatInteger(c.sold) },
    { key: 'in_payment', header: 'En cours de paiement', align: 'right', render: (c) => formatInteger(c.in_payment) },
    { key: 'invitations', header: 'Invitations', align: 'right', render: (c) => formatInteger(c.invitations) },
    // Catégorie inactive : plus aucune place en vente (remaining = 0 côté serveur). « 0 / 40 » contredisait la
    // formule affichée au-dessus de la liste (relecture du run 77).
    { key: 'remaining', header: 'Restants', align: 'right', render: (c) => (c.is_active ? `${formatInteger(c.remaining)} / ${formatInteger(c.total)}` : 'Vente fermée') },
    { key: 'revenue', header: 'Recettes en ligne', align: 'right', render: (c) => formatFcfa(c.revenue_online) },
];

/** Onglet Ventes (contrat I) : par catégorie (vendus, en cours de paiement, restants) et jour par jour. */
export function SalesTab({ eventId, signal }: { eventId: string; signal: number }) {
    const { data, error, loading, refreshing, reload } = useServerData<PilotageSales>(`/api/partner/events/${eventId}/pilotage/sales`, signal);

    if (loading) {
        return (
            <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Chargement des ventes">
                <KpiCardSkeleton className="min-h-40" />
                <KpiCardSkeleton className="min-h-40" />
            </div>
        );
    }
    if (error || !data) {
        return <ErrorState title="Ventes indisponibles" description={error ?? undefined} onRetry={() => void reload()} isRetrying={refreshing} />;
    }

    const maxDay = Math.max(0, ...data.by_day.map((d) => d.sold));

    return (
        <div className="flex flex-col gap-6">
            <PilotageSection title="Par catégorie" description="Restants = quota de la catégorie moins les ventes, les invitations et les paiements en cours. Une catégorie inactive n’a plus de place en vente.">
                <DataList
                    items={data.by_category}
                    columns={COLUMNS}
                    getKey={(c) => c.category_id}
                    caption="Ventes par catégorie de billets"
                    cardTitle={(c) => COLUMNS[0].render(c)}
                    empty={<EmptyState title="Aucune catégorie" description="Ajoutez une catégorie de billets depuis la fiche de l’événement." className="my-0" />}
                />
            </PilotageSection>

            <PilotageSection title="Évolution jour par jour" description="Billets vendus chaque jour, à l’heure de Dakar.">
                <BarList
                    ariaLabel="Ventes par jour"
                    unit={['billet', 'billets']}
                    max={maxDay}
                    emptyLabel="Aucune vente pour le moment."
                    items={data.by_day.map((d) => ({
                        key: d.day,
                        label: <time dateTime={d.day}>{formatShortDate(d.day)}</time>,
                        value: d.sold,
                        detail: d.sold_cash > 0 ? `dont ${formatInteger(d.sold_cash)} en espèces` : undefined,
                    }))}
                />
            </PilotageSection>
        </div>
    );
}
