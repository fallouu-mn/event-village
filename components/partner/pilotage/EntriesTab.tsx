'use client';

import React, { useEffect, useState } from 'react';
import { Ban, DoorOpen, Gauge, ListChecks, Store, Users } from 'lucide-react';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { KpiCard, KpiCardSkeleton } from '@/components/ui/KpiCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatDateTime, formatInteger, formatTime } from '@/lib/format';
import { scanReasonLabel } from '@/lib/scan/scan-result';
import { useServerData } from '@/components/partner/useServerData';
import { EntriesBreakdown } from './EntriesBreakdown';
import { BarList, PilotageSection } from './PilotageBlocks';
import { dakarLocalToIso, formatPerMinute, incidentLabel, type EntriesViews, type PilotageEntries } from './types';

type ScannerRow = PilotageEntries['by_scanner'][number];
type RepeatedRow = PilotageEntries['repeated_attempts'][number];
type IncidentRow = PilotageEntries['incidents'][number];
type AlertRow = PilotageEntries['alerts'][number];

function Moment({ at, timeOnly = false }: { at: string | null; timeOnly?: boolean }) {
    if (!at) return <span className="text-fg-muted">Aucune</span>;
    return <time dateTime={at} className="tabular-nums">{timeOnly ? formatTime(at) : formatDateTime(at)}</time>;
}

const SCANNER_NAME: DataColumn<ScannerRow> = { key: 'name', header: 'Contrôleur', hideOnCard: true, render: (s) => <span className="font-semibold">{s.name}</span> };
const SCANNER_TAIL: DataColumn<ScannerRow>[] = [
    { key: 'accepted', header: 'Entrées', align: 'right', render: (s) => formatInteger(s.accepted) },
    { key: 'refused', header: 'Refus', align: 'right', render: (s) => formatInteger(s.refused) },
    { key: 'incidents', header: 'Incidents', align: 'right', render: (s) => formatInteger(s.incidents) },
    { key: 'last', header: 'Dernière activité', render: (s) => <Moment at={s.last_activity_at} /> },
];
/** Sans zone : colonne « Point d’entrée » d'avant le lot 9 ter. */
const SCANNER_COLUMNS: DataColumn<ScannerRow>[] = [
    SCANNER_NAME,
    { key: 'entry_point', header: 'Point d’entrée', render: (s) => s.entry_point || <span className="text-fg-muted">Non précisé</span> },
    ...SCANNER_TAIL,
];
/** Événement à zones : la même colonne devient « Porte » (porte de l'affectation, servie par la base). */
const SCANNER_GATE_COLUMNS: DataColumn<ScannerRow>[] = [
    SCANNER_NAME,
    { key: 'gate', header: 'Porte', render: (s) => s.gate || <span className="text-fg-muted">Non précisée</span> },
    ...SCANNER_TAIL,
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

/** « 12 refus dans les 5 dernières minutes. » (« dans la dernière minute » pour une durée d'une minute). */
function alertWindow(a: AlertRow): string {
    const span = a.window_minutes > 1 ? `dans les ${formatInteger(a.window_minutes)} dernières minutes` : 'dans la dernière minute';
    return `${formatInteger(a.refused)} refus ${span}.`;
}

/** Contrôleurs actifs : « 3 sur 4 ». */
function activeOf(active: number, assigned: number): string {
    return `${formatInteger(active)} sur ${formatInteger(assigned)}`;
}

/**
 * Onglet Entrées en direct (contrat I) : rafraîchi par la page à chaque signal temps réel (ticket_scans,
 * scan_incidents), sans recharger, et toutes les 60 s pour ce qui dépend de l'heure (débit, contrôleurs actifs,
 * alertes de refus), même sans nouveau scan. Tous les comptages viennent de pilotage_entries ; l'alerte de refus est
 * décidée par la base (réglages access.refusal_alert_*), l'écran ne fait que l'afficher.
 */
export function EntriesTab({ eventId, signal }: { eventId: string; signal: number }) {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 60_000);
        return () => clearInterval(id);
    }, []);
    const { data, error, loading, refreshing, updatedAt, reload } = useServerData<PilotageEntries>(`/api/partner/events/${eventId}/pilotage/entries`, signal + tick);

    if (loading) {
        return (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3" role="status" aria-busy="true" aria-label="Chargement des entrées">
                <KpiCardSkeleton />
                <KpiCardSkeleton />
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

    const views: EntriesViews = {
        configured: data.configured,
        totals: { total: data.total, counter: data.counter, guest_list: data.guest_list.count, refused: data.refused, zone_checks: data.zone_checks },
        by_zone: data.by_zone,
        by_gate: data.by_gate,
        by_category: data.by_category,
        by_origin: data.by_origin,
        by_quarter: data.by_quarter,
        refusals_by_reason: data.refusals_by_reason,
        guest_list: data.guest_list,
    };
    const scannerColumns = data.configured ? SCANNER_GATE_COLUMNS : SCANNER_COLUMNS;
    const maxMinute = Math.max(0, ...data.rate.by_minute.map((m) => m.accepted));

    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                <KpiCard label="Entrées validées" value={formatInteger(data.total)} hint="Scans acceptés, guichet compris" tone="success" icon={<DoorOpen size={18} />} />
                <KpiCard label="Au guichet" value={formatInteger(data.counter)} hint="Billets vendus et validés sur place" tone="info" icon={<Store size={18} />} />
                <KpiCard label="Refus" value={formatInteger(data.refused)} hint="Tentatives refusées au contrôle" tone="danger" icon={<Ban size={18} />} />
                <KpiCard label="Liste des invités" value={formatInteger(data.guest_list.count)} hint="Entrées validées par la liste, pièce vérifiée" tone="brand" icon={<ListChecks size={18} />} />
                <KpiCard label="Débit" value={formatPerMinute(data.rate.per_minute)} hint="Moyenne des 5 dernières minutes" tone="neutral" icon={<Gauge size={18} />} />
                <KpiCard label="Contrôleurs actifs" value={activeOf(data.controllers.active, data.controllers.assigned)} hint="Un scan dans les 10 dernières minutes" tone="neutral" icon={<Users size={18} />} />
            </div>
            {updatedAt && (
                <p className="-mt-3 text-sm text-fg-muted">
                    Mis à jour à <time dateTime={updatedAt.toISOString()} className="tabular-nums">{formatTime(updatedAt)}</time>
                </p>
            )}

            {data.alerts.map((a) => (
                <StatusBanner key={a.gate_key} tone="danger" announce="alert" title={`Beaucoup de refus à ${a.name}`}>
                    {alertWindow(a)} Vérifiez avec le contrôleur : faux billets, mauvaise porte ou billets déjà utilisés.
                </StatusBanner>
            ))}

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
                    columns={scannerColumns}
                    getKey={(s) => s.scanner_id}
                    caption="Entrées par contrôleur"
                    cardTitle={(s) => SCANNER_NAME.render(s)}
                    empty={<EmptyState title="Aucun scan pour le moment" description="Les entrées s’affichent ici dès le premier scan, sans recharger la page." className="my-0" />}
                />
            </PilotageSection>

            <EntriesBreakdown views={views} live={data} ownerView />

            <PilotageSection title="Débit par minute" description="Entrées de chaque minute sur les 30 dernières minutes, heure de Dakar.">
                <BarList
                    ariaLabel="Entrées par minute"
                    unit={['entrée', 'entrées']}
                    max={maxMinute}
                    emptyLabel="Aucun passage pour le moment."
                    items={maxMinute > 0 ? data.rate.by_minute.map((m) => {
                        const iso = dakarLocalToIso(m.start);
                        return {
                            key: m.start,
                            label: iso ? <time dateTime={iso} className="tabular-nums">{formatTime(iso)}</time> : 'Horaire inconnu',
                            value: m.accepted,
                        };
                    }) : []}
                />
            </PilotageSection>

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
