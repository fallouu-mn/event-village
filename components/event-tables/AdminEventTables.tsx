'use client';

import { History, Map as MapIcon } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { Badge } from '@/components/ui/Badge';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { SeatsGauge } from './SeatsGauge';
import { useTablesReport } from './useTablesReport';
import { plural, type TableBookingRow, type TableTypeRow } from './types';

/**
 * Lot 11c-c — tables d'un événement sur la fiche de l'administration (GET /api/admin/events/[id]/tables, events.read) :
 * types de tables, jauge en places, tables vendues et remboursées, historique des changements signalés après
 * validation (avis ADMIN_EVENT_TABLES_CHANGED, dont le lien mène à cette fiche). Lecture seule ; rien n'est affiché pour
 * un événement sans table. Composant léger (aucun plan) : la fiche ne charge pas les écrans de l'organisatrice.
 */

const REFUND_ORIGIN: Readonly<Record<string, string>> = {
    EVENT_CANCELLED: 'Annulation de l’événement',
    POSTPONEMENT: 'Report : demande du titulaire',
    PAYMENT_REFUND: 'Paiement remboursé',
};

const typeColumns: DataColumn<TableTypeRow>[] = [
    { key: 'name', header: 'Type', render: (t) => t.name, hideOnCard: true },
    { key: 'seats', header: 'Places', align: 'right', render: (t) => formatInteger(t.seats) },
    { key: 'price', header: 'Prix de la table', align: 'right', render: (t) => formatFcfa(t.price) },
    { key: 'per', header: 'Par personne', align: 'right', render: (t) => formatFcfa(t.price_per_person) },
    { key: 'tables', header: 'Tables', align: 'right', render: (t) => `${formatInteger(t.sold_tables)} ${plural(t.sold_tables, 'vendue', 'vendues')} / ${formatInteger(t.total_tables)}` },
    { key: 'state', header: 'Vente', render: (t) => (t.is_active ? 'En vente' : 'Arrêtée') },
];

const refundColumns: DataColumn<TableBookingRow>[] = [
    { key: 'number', header: 'Table', render: (b) => `Table ${b.table_number}`, hideOnCard: true },
    { key: 'type', header: 'Type', render: (b) => b.type_name },
    { key: 'holder', header: 'Titulaire', render: (b) => b.holder ?? '—' },
    { key: 'amount', header: 'Montant', align: 'right', render: (b) => formatFcfa(b.price) },
    { key: 'origin', header: 'Motif', render: (b) => (b.refund_origin ? REFUND_ORIGIN[b.refund_origin] ?? 'Remboursement' : 'Remboursement') },
    { key: 'at', header: 'Le', render: (b) => (b.refunded_at ? formatDateTime(b.refunded_at) : '—') },
];

export function AdminEventTables({ eventId }: { eventId: string }) {
    const { data, error } = useTablesReport(eventId, 0, true);
    if (error) {
        return (
            <section aria-labelledby="fiche-tables" className="rounded-2xl border border-border bg-card p-5">
                <h2 id="fiche-tables" className="mb-2 text-lg font-bold tracking-tight text-foreground-strong">Tables</h2>
                <p role="alert" className="text-sm text-danger-text">{error}</p>
            </section>
        );
    }
    if (!data || (data.types.length === 0 && data.bookings.length === 0)) return null;
    const refunded = data.bookings.filter((b) => b.status === 'REFUNDED');
    const changes = data.changes ?? [];
    const t = data.totals;

    return (
        <section aria-labelledby="fiche-tables" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5" data-admin-tables="">
            <h2 id="fiche-tables" className="text-lg font-bold tracking-tight text-foreground-strong">Tables</h2>
            <SeatsGauge gauge={data.gauge} className="border-0 bg-background" />
            <dl className="grid grid-cols-2 gap-3 tabular-nums md:grid-cols-4">
                {[
                    ['Tables vendues', `${formatInteger(t.sold)} sur ${formatInteger(t.tables)}`],
                    ['Recette hors frais', formatFcfa(t.revenue)],
                    ['Tables remboursées', formatInteger(t.refunded)],
                    ['Montant remboursé', formatFcfa(t.refunded_amount)],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-background p-3">
                        <dt className="text-sm text-muted-foreground">{label}</dt>
                        <dd className="text-lg font-bold tabular-nums text-foreground-strong">{value}</dd>
                    </div>
                ))}
            </dl>
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <MapIcon size={16} aria-hidden="true" /> Plan {data.plan_enabled ? 'montré aux clients' : 'non montré : le client reçoit la plus petite table libre du type choisi'}.
            </p>

            <DataList items={data.types} columns={typeColumns} getKey={(x) => x.id} caption="Types de tables" cardTitle={(x) => x.name} breakpoint="xl" />

            <div className="flex flex-col gap-2">
                <h3 className="text-base font-semibold text-foreground-strong">Tables remboursées</h3>
                {refunded.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune table remboursée.</p>
                ) : (
                    <DataList items={refunded} columns={refundColumns} getKey={(b) => `${b.table_id}-${b.sold_at}`} caption="Tables remboursées" cardTitle={(b) => `Table ${b.table_number}`} breakpoint="xl" />
                )}
            </div>

            <div className="flex flex-col gap-2" id="tables-historique">
                <h3 className="inline-flex items-center gap-2 text-base font-semibold text-foreground-strong">
                    <History size={18} aria-hidden="true" /> Changements après validation
                </h3>
                {changes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun changement des tables signalé après la validation.</p>
                ) : (
                    <>
                        <p className="text-sm text-muted-foreground">Chaque ligne est un enregistrement de l’organisatrice signalé à l’équipe ; la fiche montre l’état actuel.</p>
                        <ol className="flex flex-col gap-1">
                            {changes.map((c, i) => (
                                <li key={c.at} className="flex items-center gap-2 text-sm text-foreground">
                                    {i === 0 && <Badge variant="warning">Dernier</Badge>}
                                    <time dateTime={c.at} className="tabular-nums">{formatDateTime(c.at)}</time>
                                </li>
                            ))}
                        </ol>
                    </>
                )}
            </div>
        </section>
    );
}
