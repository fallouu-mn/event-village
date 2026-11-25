'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Banknote, Clock, DoorOpen, Lock, Printer, UserCheck, Users } from 'lucide-react';
import { FloorPlan, type FloorPlanTable, type FloorPlanZone } from '@/components/tables/plan/FloorPlan';
import { KpiCard } from '@/components/ui/KpiCard';
import { LinkButton } from '@/components/ui/LinkButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { cn } from '@/components/ui/cn';
import { formatFcfa, formatInteger, formatTime } from '@/lib/format';
import { SeatsGauge } from './SeatsGauge';
import { STATE_LABEL, type TableBookingRow, type TableState, type TablesReport } from './types';

/**
 * Lot 11c-c — onglet « Tables » du pilotage : plan coloré par état (libre, en paiement, vendue, invités arrivés), avec
 * une icône et une légende en plus de la couleur ; liste triable (numéro, type, titulaire en prénom et initiale, places
 * envoyées, places entrées) ; recette des tables hors frais ; « Mis à jour à … » (heure de lecture en base). Relu comme
 * le reste du pilotage (signal temps réel des catégories de l'événement). Chaque nombre vient du serveur.
 */

type SortKey = 'number' | 'type' | 'holder' | 'given' | 'entered';

interface Row {
    key: string;
    number: number;
    typeName: string;
    zone: string | null;
    state: TableState;
    booking: TableBookingRow | null;
}

const COLUMNS: ReadonlyArray<{ key: SortKey; label: string; align?: 'right' }> = [
    { key: 'number', label: 'N°' },
    { key: 'type', label: 'Type' },
    { key: 'holder', label: 'Titulaire' },
    { key: 'given', label: 'Places envoyées', align: 'right' },
    { key: 'entered', label: 'Places entrées', align: 'right' },
];

const STATE_ICON = { LIBRE: null, EN_ATTENTE: Clock, VENDUE: Lock } as const;

const givenText = (b: TableBookingRow): string => `${formatInteger(b.counts.given)}${b.counts.pending > 0 ? ` (+${formatInteger(b.counts.pending)} en attente)` : ''}`;
const enteredText = (b: TableBookingRow): string => `${formatInteger(b.counts.entered)}/${formatInteger(b.seats)}`;

const tableColumns: DataColumn<Row>[] = [
    { key: 'number', header: 'N°', render: (r) => <span className="text-base font-bold tabular-nums text-foreground-strong">{r.number}</span> },
    { key: 'type', header: 'Type', render: (r) => (r.zone ? `${r.typeName} · ${r.zone}` : r.typeName) },
    { key: 'holder', header: 'Titulaire', render: (r) => r.booking?.holder ?? '—' },
    { key: 'given', header: 'Places envoyées', align: 'right', render: (r) => <span className="tabular-nums">{r.booking ? givenText(r.booking) : '—'}</span> },
    { key: 'entered', header: 'Places entrées', align: 'right', render: (r) => <span className="font-semibold tabular-nums">{r.booking ? enteredText(r.booking) : '—'}</span> },
    { key: 'state', header: 'État', render: (r) => STATE_LABEL[r.state] },
];

function compare(a: Row, b: Row, key: SortKey): number {
    switch (key) {
        case 'type': return a.typeName.localeCompare(b.typeName, 'fr') || a.number - b.number;
        case 'holder': return (a.booking?.holder ?? '￿').localeCompare(b.booking?.holder ?? '￿', 'fr') || a.number - b.number;
        case 'given': return (a.booking?.counts.given ?? -1) - (b.booking?.counts.given ?? -1) || a.number - b.number;
        case 'entered': return (a.booking?.counts.entered ?? -1) - (b.booking?.counts.entered ?? -1) || a.number - b.number;
        default: return a.number - b.number;
    }
}

export function TablesPilotage({ eventId, report, doorHref }: { eventId: string; report: TablesReport; doorHref: string }) {
    const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'number', dir: 1 });
    const [selected, setSelected] = useState<string | null>(null);

    const rows: Row[] = useMemo(() => {
        const typeName = new Map(report.types.map((t) => [t.id, t.name]));
        const zoneName = new Map(report.zones.map((z) => [z.id, z.name]));
        const active = new Map(report.bookings.filter((b) => b.status === 'ACTIVE').map((b) => [b.table_id, b]));
        return report.tables.map((t) => ({
            key: t.id, number: t.number, typeName: typeName.get(t.type_id) ?? '', zone: t.zone_id ? zoneName.get(t.zone_id) ?? null : null,
            state: t.state, booking: active.get(t.id) ?? null,
        }));
    }, [report]);

    const sorted = useMemo(() => [...rows].sort((a, b) => compare(a, b, sort.key) * sort.dir), [rows, sort]);
    const sel = selected ? rows.find((r) => r.key === selected) ?? null : null;

    const floorTables: FloorPlanTable[] = report.tables.map((t) => {
        const b = rows.find((r) => r.key === t.id)?.booking ?? null;
        const seats = report.types.find((x) => x.id === t.type_id)?.seats ?? 2;
        return {
            id: t.id, number: String(t.number), capacity: seats, x: t.x === null ? null : Number(t.x), y: t.y === null ? null : Number(t.y),
            shape: t.shape, rotation: t.rotation,
            state: t.state === 'LIBRE' ? 'LIBRE' : t.state === 'EN_ATTENTE' ? 'ATTENDUE' : b && b.counts.entered > 0 ? 'ARRIVEE' : 'PRISE',
            hint: b ? `${b.holder ?? 'Titulaire'}, ${b.counts.entered} sur ${b.seats} entrés` : STATE_LABEL[t.state],
        };
    });
    const floorZones: FloorPlanZone[] = report.zones.map((z) => ({ id: z.id, name: z.name, x: z.x === null ? null : Number(z.x), y: z.y === null ? null : Number(z.y), w: z.w === null ? null : Number(z.w), h: z.h === null ? null : Number(z.h) }));
    const totals = report.totals;

    if (report.types.length === 0) {
        return (
            <EmptyState
                icon={<Users size={28} />}
                title="Aucune table pour cet événement"
                description="Ajoutez des types de tables depuis la modification de l’événement, étape « Billets », onglet « Tables »."
                actionLabel="Modifier l’événement"
                actionHref={`/partner/events/${eventId}/edit`}
            />
        );
    }

    const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

    return (
        <div className="flex flex-col gap-5" data-tables-pilotage="">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                    Mis à jour à <time dateTime={report.read_at} className="font-semibold tabular-nums text-foreground-strong">{formatTime(report.read_at)}</time>
                </p>
                <div className="flex flex-wrap gap-2">
                    <LinkButton href={doorHref} variant="secondary" leftIcon={<DoorOpen size={18} />}>Liste de la porte</LinkButton>
                    <LinkButton href={`${doorHref}?imprimer=1`} variant="ghost" leftIcon={<Printer size={18} />}>Imprimer</LinkButton>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Tables vendues" value={`${formatInteger(totals.sold)} sur ${formatInteger(totals.tables)}`} countUp={{ to: totals.sold, format: 'integer' }}
                    hint={`${formatInteger(totals.held)} en paiement · ${formatInteger(totals.free)} libres`} tone="brand" icon={<Lock size={20} />} />
                <KpiCard label="Places entrées" value={`${formatInteger(totals.entered_seats)} sur ${formatInteger(totals.sold_seats)}`} countUp={{ to: totals.entered_seats, format: 'integer' }}
                    hint="Places des tables vendues" tone="info" icon={<UserCheck size={20} />} />
                <KpiCard label="Recette des tables" value={formatFcfa(totals.revenue)} countUp={{ to: totals.revenue, format: 'fcfa' }}
                    hint="Hors frais de service, sans commission" tone="success" icon={<Banknote size={20} />} />
                <KpiCard label="Tables remboursées" value={formatInteger(totals.refunded)} hint={totals.refunded > 0 ? formatFcfa(totals.refunded_amount) : 'Aucune'} tone="neutral" />
            </div>

            <SeatsGauge gauge={report.gauge} />

            <section aria-labelledby="pil-plan-titre" className="flex flex-col gap-3">
                <h3 id="pil-plan-titre" className="text-lg font-bold text-foreground-strong">{totals.placed > 0 ? 'Plan des tables' : 'Tables'}</h3>
                {totals.placed > 0 ? (
                    <FloorPlan
                        tables={floorTables}
                        zones={floorZones}
                        mode="view"
                        selectedId={selected}
                        onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
                        ariaLabel="Plan des tables : état de chaque table"
                        labels={{
                            PRISE: { legend: 'Vendue', spoken: 'vendue' },
                            ATTENDUE: { legend: 'En paiement', spoken: 'en cours de paiement' },
                            ARRIVEE: { legend: 'Vendue, invités arrivés', spoken: 'vendue, invités arrivés' },
                        }}
                    />
                ) : (
                    <ul className="grid grid-cols-3 gap-2 xs:grid-cols-4 md:grid-cols-6 lg:grid-cols-8" aria-label="État de chaque table">
                        {rows.map((r) => {
                            const Icon = STATE_ICON[r.state];
                            return (
                                <li key={r.key}>
                                    <button type="button" onClick={() => setSelected((cur) => (cur === r.key ? null : r.key))} aria-pressed={selected === r.key}
                                        className={cn('flex min-h-16 w-full flex-col items-center justify-center rounded-xl border-2 p-2 text-center transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            r.state === 'LIBRE' ? 'border-success-border bg-success-soft text-success-text' : r.state === 'EN_ATTENTE' ? 'border-warning-border bg-warning-soft text-warning-text' : 'border-border bg-muted text-foreground-strong',
                                            selected === r.key && 'ring-2 ring-primary')}>
                                        <span className="inline-flex items-center gap-1 text-lg font-bold tabular-nums">{Icon && <Icon size={14} aria-hidden="true" />}{r.number}</span>
                                        <span className="text-sm font-medium">{STATE_LABEL[r.state]}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {sel && (
                    <div className="animate-in fade-in rounded-2xl border border-primary bg-card p-4" role="status" aria-live="polite" data-table-choisie={sel.number}>
                        <p className="text-base font-bold text-foreground-strong">Table {sel.number} · {sel.zone ?? sel.typeName}</p>
                        {sel.booking ? (
                            <p className="mt-1 text-sm tabular-nums text-foreground">
                                {sel.booking.holder ?? 'Titulaire'} · {formatInteger(sel.booking.counts.given)} place(s) envoyée(s)
                                {sel.booking.counts.pending > 0 ? `, ${formatInteger(sel.booking.counts.pending)} en attente` : ''} · {formatInteger(sel.booking.counts.entered)}/{formatInteger(sel.booking.seats)} entrés
                            </p>
                        ) : (
                            <p className="mt-1 text-sm text-foreground">{STATE_LABEL[sel.state]}</p>
                        )}
                    </div>
                )}
            </section>

            <section aria-labelledby="pil-liste-titre" className="flex flex-col gap-3">
                <h3 id="pil-liste-titre" className="text-lg font-bold text-foreground-strong">Liste des tables</h3>
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Trier les tables">
                    <span className="text-sm font-semibold text-muted-foreground">Trier par :</span>
                    {COLUMNS.map((c) => {
                        const active = sort.key === c.key;
                        const Icon = active ? (sort.dir === 1 ? ArrowUp : ArrowDown) : ArrowUpDown;
                        return (
                            <button key={c.key} type="button" onClick={() => toggleSort(c.key)} aria-pressed={active}
                                aria-label={active ? `${c.label}, ordre ${sort.dir === 1 ? 'croissant' : 'décroissant'}` : c.label}
                                className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-pill border px-3 text-sm font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    active ? 'border-primary bg-primary-soft text-primary-text' : 'border-border bg-card text-foreground')}>
                                {c.label}<Icon size={14} aria-hidden="true" />
                            </button>
                        );
                    })}
                </div>
                <DataList
                    items={sorted}
                    getKey={(r) => r.key}
                    caption="Tables de l’événement"
                    breakpoint="lg"
                    columns={tableColumns}
                    renderCard={(r) => (
                        <div className={cn('rounded-2xl border border-border bg-card p-3', selected === r.key && 'border-primary')}>
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-base font-bold text-foreground-strong">Table {r.number} <span className="font-normal text-muted-foreground">· {r.zone ?? r.typeName}</span></p>
                                <span className="text-sm font-semibold text-foreground">{STATE_LABEL[r.state]}</span>
                            </div>
                            {r.booking && (
                                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm tabular-nums">
                                    <dt className="text-muted-foreground">Titulaire</dt><dd className="break-words text-foreground-strong">{r.booking.holder ?? '—'}</dd>
                                    <dt className="text-muted-foreground">Envoyées</dt><dd className="text-foreground-strong">{givenText(r.booking)}</dd>
                                    <dt className="text-muted-foreground">Entrées</dt><dd className="font-semibold text-foreground-strong">{enteredText(r.booking)}</dd>
                                </dl>
                            )}
                        </div>
                    )}
                />
            </section>
        </div>
    );
}
