'use client';

import React from 'react';
import { Ban, DoorOpen, HandCoins, Store } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/KpiCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatDateTime, formatInteger, formatTime } from '@/lib/format';
import { scanReasonLabel } from '@/lib/scan/scan-result';
import { useServerData } from '@/components/partner/useServerData';
import { BarList, PilotageSection } from './PilotageBlocks';
import { dakarLocalToIso, incidentLabel, type PilotageEntries } from './types';

type ScannerRow = PilotageEntries['by_scanner'][number];
type RepeatedRow = PilotageEntries['repeated_attempts'][number];
type IncidentRow = PilotageEntries['incidents'][number];

function Moment({ at, timeOnly = false }: { at: string | null; timeOnly?: boolean }) {
    if (!at) return <span className="text-fg-muted">Aucune</span>;
    return <time dateTime={at}>{timeOnly ? formatTime(at) : formatDateTime(at)}</time>;
}

const SCANNER_COLUMNS: DataColumn<ScannerRow>[] = [
    { key: 'name', header: 'Contrôleur', hideOnCard: true, render: (s) => <span className="font-semibold">{s.name}</span> },
    { key: 'entry_point', header: 'Point d’entrée', render: (s) => s.entry_point || <span className="text-fg-muted">Non précisé</span> },
    { key: 'accepted', header: 'Entrées', align: 'right', render: (s) => formatInteger(s.accepted) },
    { key: 'refused', header: 'Refus', align: 'right', render: (s) => formatInteger(s.refused) },
    { key: 'incidents', header: 'Incidents', align: 'right', render: (s) => formatInteger(s.incidents) },
    { key: 'last', header: 'Dernière activité', render: (s) => <Moment at={s.last_activity_at} /> },
];

const REPEATED_COLUMNS: DataColumn<RepeatedRow>[] = [
    { key: 'ticket', header: 'Billet', hideOnCard: true, render: (r) => <span className="font-semibold">{r.ticket_number || 'Billet sans numéro affiché'}</span> },
    { key: 'category', header: 'Catégorie', render: (r) => r.category || 'Catégorie inconnue' },
    { key: 'attempts', header: 'Tentatives', align: 'right', render: (r) => formatInteger(r.attempts) },
    { key: 'last_result', header: 'Dernier résultat', render: (r) => r.last_result_label || scanReasonLabel(r.last_result) },
    { key: 'last_at', header: 'Dernière tentative', render: (r) => <Moment at={r.last_at} timeOnly /> },
];

const INCIDENT_COLUMNS: DataColumn<IncidentRow>[] = [
    { key: 'name', header: 'Contrôleur', hideOnCard: true, render: (i) => <span className="font-semibold">{i.name}</span> },
    { key: 'kind', header: 'Incident', render: (i) => incidentLabel(i.kind) },
    { key: 'count', header: 'Nombre', align: 'right', render: (i) => formatInteger(i.count) },
    { key: 'last_at', header: 'Dernier', render: (i) => <Moment at={i.last_at} timeOnly /> },
];

/**
 * Onglet Entrées en direct (contrat I) : rafraîchi par la page à chaque signal temps réel (ticket_scans,
 * scan_incidents), sans recharger. Tous les comptages viennent de pilotage_entries.
 */
export function EntriesTab({ eventId, signal }: { eventId: string; signal: number }) {
    const { data, error, loading, refreshing, reload } = useServerData<PilotageEntries>(`/api/partner/events/${eventId}/pilotage/entries`, signal);

    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" role="status" aria-busy="true" aria-label="Chargement des entrées">
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
                <KpiCardSkeleton />
            </div>
        );
    }
    if (error || !data) {
        return <ErrorState title="Entrées indisponibles" description={error ?? undefined} onRetry={() => void reload()} isRetrying={refreshing} />;
    }

    const maxEntryPoint = Math.max(0, ...data.by_entry_point.map((e) => e.accepted));
    const maxCategory = Math.max(0, ...data.by_category.map((c) => c.accepted));
    const maxQuarter = Math.max(0, ...data.by_quarter.map((q) => q.accepted));
    const maxRefusal = Math.max(0, ...data.refusals_by_reason.map((r) => r.count));

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <KpiCard label="Entrées validées" value={formatInteger(data.total)} hint="Scans acceptés, guichet compris" tone="success" icon={<DoorOpen size={18} />} />
                <KpiCard label="Au guichet" value={formatInteger(data.counter)} hint="Billets vendus et compostés sur place" tone="info" icon={<Store size={18} />} />
                <KpiCard label="Refus" value={formatInteger(data.refused)} hint="Tentatives refusées au contrôle" tone="danger" icon={<Ban size={18} />} />
                <KpiCard label="Encaissements en attente" value={formatInteger(data.cash_pending)} hint="Billets à régler sur place présentés, pas encore encaissés" tone="warning" icon={<HandCoins size={18} />} />
            </div>

            {data.repeated_attempts.length > 0 && (
                <PilotageSection title="Tentatives multiples" description="Même billet présenté plusieurs fois en moins de dix minutes, ou billet déjà utilisé.">
                    <StatusBanner tone="warning" title="Billets présentés plusieurs fois">
                        Vérifiez ces billets avec vos contrôleurs : il peut s’agir d’une capture d’écran partagée.
                    </StatusBanner>
                    <DataList
                        items={data.repeated_attempts}
                        columns={REPEATED_COLUMNS}
                        getKey={(r) => r.ticket_id}
                        caption="Billets présentés plusieurs fois"
                        cardTitle={(r) => REPEATED_COLUMNS[0].render(r)}
                    />
                </PilotageSection>
            )}

            <PilotageSection title="Par contrôleur" description="Entrées, refus et incidents de chaque compte qui a scanné.">
                <DataList
                    items={data.by_scanner}
                    columns={SCANNER_COLUMNS}
                    getKey={(s) => s.scanner_id}
                    caption="Entrées par contrôleur"
                    cardTitle={(s) => SCANNER_COLUMNS[0].render(s)}
                    empty={<EmptyState title="Aucun scan pour le moment" description="Les entrées s’affichent ici dès le premier scan, sans recharger la page." className="my-0" />}
                />
            </PilotageSection>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PilotageSection title="Par point d’entrée">
                    <BarList
                        ariaLabel="Entrées par point d’entrée"
                        unit={['entrée', 'entrées']}
                        max={maxEntryPoint}
                        emptyLabel="Aucune entrée pour le moment."
                        items={data.by_entry_point.map((e, i) => ({
                            key: `${e.entry_point ?? 'sans-point'}-${i}`,
                            label: e.entry_point || 'Point d’entrée non précisé',
                            value: e.accepted,
                            detail: e.refused > 0 ? `${formatInteger(e.refused)} refus` : undefined,
                        }))}
                    />
                </PilotageSection>
                <PilotageSection title="Par catégorie">
                    <BarList
                        ariaLabel="Entrées par catégorie"
                        unit={['entrée', 'entrées']}
                        max={maxCategory}
                        emptyLabel="Aucune catégorie."
                        items={data.by_category.map((c) => ({ key: c.category_id, label: c.name, value: c.accepted }))}
                    />
                </PilotageSection>
                <PilotageSection title="Flux par quart d’heure" description="Heure de Dakar.">
                    <BarList
                        ariaLabel="Entrées par quart d’heure"
                        unit={['entrée', 'entrées']}
                        max={maxQuarter}
                        emptyLabel="Aucun passage pour le moment."
                        items={data.by_quarter.map((q) => {
                            const iso = dakarLocalToIso(q.start);
                            return {
                                key: q.start,
                                label: iso ? <time dateTime={iso}>{formatDateTime(iso)}</time> : 'Horaire inconnu',
                                value: q.accepted,
                                detail: q.refused > 0 ? `${formatInteger(q.refused)} refus` : undefined,
                            };
                        })}
                    />
                </PilotageSection>
                <PilotageSection title="Refus par motif">
                    <BarList
                        ariaLabel="Refus par motif"
                        unit="refus"
                        max={maxRefusal}
                        emptyLabel="Aucun refus."
                        items={data.refusals_by_reason.map((r) => ({ key: r.result, label: r.label || scanReasonLabel(r.result), value: r.count }))}
                    />
                </PilotageSection>
            </div>

            <PilotageSection title="Incidents techniques" description="Coupures réseau, délais dépassés ou erreurs du serveur rencontrés par les scanners (sans effet sur les billets).">
                <DataList
                    items={data.incidents}
                    columns={INCIDENT_COLUMNS}
                    getKey={(i) => `${i.scanner_id}-${i.kind}`}
                    caption="Incidents techniques par contrôleur"
                    cardTitle={(i) => INCIDENT_COLUMNS[0].render(i)}
                    empty={<p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">Aucun incident technique.</p>}
                />
            </PilotageSection>
        </div>
    );
}
