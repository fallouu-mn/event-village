'use client';

/**
 * Lot 11b : les tables maintenant (planning d'aujourd'hui). État de chaque table à l'heure du serveur, lu dans les
 * réservations du jour (aucune donnée inventée) : « Client arrivé » (réservation arrivée, créneau en cours), « Client
 * attendu » (réservation qui tient la table, de 1 h avant l'heure à la fin du créneau), sinon « Libre » avec la prochaine
 * heure prévue. Si le plan est montré : FloorPlan en mode lecture, chaque table ouvre sa réservation ; sinon (ou pour les
 * tables pas encore placées) une liste compacte.
 */
import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';
import { FloorPlan, type FloorPlanTable, type FloorPlanZone, type FloorTableState } from '@/components/tables/plan/FloorPlan';
import { cn } from '@/components/ui/cn';
import { guestsText, hmText, instantHm } from '@/lib/tables/views';
import { endMs, startMs, type PartnerTableReservationView, type PlanningTable, type PlanningZone } from './venue-api';

interface TableNow {
    table: PlanningTable;
    state: 'ARRIVEE' | 'ATTENDUE' | 'LIBRE';
    current: PartnerTableReservationView | null;
    next: PartnerTableReservationView | null;
    hint: string;
}

const HOLDS = new Set(['EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION', 'CONFIRMEE']);

function shapeOf(s: string | null): FloorPlanTable['shape'] {
    return s === 'CARREE' || s === 'RECTANGLE' ? s : 'RONDE';
}

export function tablesNow(tables: PlanningTable[], reservations: PartnerTableReservationView[], now: number): TableNow[] {
    return tables.filter((t) => t.isActive).map((table) => {
        const mine = reservations.filter((r) => r.tableId === table.id).sort((a, b) => startMs(a) - startMs(b));
        const arrived = mine.find((r) => r.state === 'ARRIVEE' && now < endMs(r)) ?? null;
        const expected = arrived ? null : mine.find((r) => HOLDS.has(r.state) && now >= startMs(r) - 3_600_000 && now < endMs(r)) ?? null;
        const next = mine.find((r) => HOLDS.has(r.state) && startMs(r) > now && r !== expected) ?? null;
        if (arrived) {
            return { table, state: 'ARRIVEE', current: arrived, next, hint: `${guestsText(arrived.guests)}, ${arrived.client.name}${arrived.arrivedAt ? `, arrivés à ${instantHm(arrived.arrivedAt)}` : ''}` };
        }
        if (expected) {
            return { table, state: 'ATTENDUE', current: expected, next, hint: `${guestsText(expected.guests)} à ${hmText(expected.time)}, ${expected.client.name}` };
        }
        return { table, state: 'LIBRE', current: null, next, hint: next ? `prochaine réservation à ${hmText(next.time)}` : 'aucune autre réservation aujourd’hui' };
    });
}

const LIST_TONE: Record<TableNow['state'], { label: string; cls: string }> = {
    ARRIVEE: { label: 'Client arrivé', cls: 'border-info-border bg-info-soft text-info-text' },
    ATTENDUE: { label: 'Client attendu', cls: 'border-warning-border bg-warning-soft text-warning-text' },
    LIBRE: { label: 'Libre', cls: 'border-success-border bg-success-soft text-success-text' },
};

export function TablesNow({ tables, zones, reservations, now, showPlan }: {
    tables: PlanningTable[];
    zones: PlanningZone[];
    reservations: PartnerTableReservationView[];
    now: number;
    showPlan: boolean;
}) {
    const router = useRouter();
    // Recalcul à la minute (l'état d'une table change à l'heure ronde du créneau, pas à la seconde)
    const minute = Math.floor(now / 60_000);
    const rows = useMemo(() => tablesNow(tables, reservations, minute * 60_000), [tables, reservations, minute]);
    const placed = rows.filter((r) => r.table.plan !== null);
    const unplaced = showPlan ? rows.filter((r) => r.table.plan === null) : rows;
    const counts = {
        ARRIVEE: rows.filter((r) => r.state === 'ARRIVEE').length,
        ATTENDUE: rows.filter((r) => r.state === 'ATTENDUE').length,
        LIBRE: rows.filter((r) => r.state === 'LIBRE').length,
    };

    const open = (tableId: string) => {
        const row = rows.find((r) => r.table.id === tableId);
        const target = row?.current ?? row?.next;
        if (target) router.push(`/partner/tables/reservations/${encodeURIComponent(target.id)}`);
    };

    const planTables: FloorPlanTable[] = placed.map((r) => ({
        id: r.table.id,
        number: r.table.number,
        capacity: r.table.capacity,
        minCapacity: r.table.minCapacity,
        x: r.table.plan?.x ?? null,
        y: r.table.plan?.y ?? null,
        shape: shapeOf(r.table.shape),
        rotation: r.table.rotation,
        state: r.state as FloorTableState,
        hint: r.hint,
    }));
    const planZones: FloorPlanZone[] = zones.filter((z) => z.plan !== null).map((z) => ({
        id: z.id, name: z.name, x: z.plan?.x ?? null, y: z.plan?.y ?? null, w: z.plan?.w ?? null, h: z.plan?.h ?? null,
    }));

    if (rows.length === 0) return null;

    return (
        <section aria-labelledby="planning-tables" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 id="planning-tables" className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                    <LayoutGrid size={20} className="text-muted-foreground" aria-hidden="true" />
                    Les tables maintenant
                </h2>
                <p className="text-sm text-muted-foreground tabular-nums">
                    {[`${counts.LIBRE} libre${counts.LIBRE > 1 ? 's' : ''}`, `${counts.ATTENDUE} attendue${counts.ATTENDUE > 1 ? 's' : ''}`, `${counts.ARRIVEE} occupée${counts.ARRIVEE > 1 ? 's' : ''}`].join(' · ')}
                </p>
            </div>

            {showPlan && planTables.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
                    <FloorPlan tables={planTables} zones={planZones} mode="view" onSelect={open} ariaLabel="Plan de salle : état des tables maintenant" />
                    <p className="mt-2 text-sm text-muted-foreground">Touchez une table pour ouvrir sa réservation.</p>
                </div>
            )}

            {unplaced.length > 0 && (
                <>
                    {showPlan && planTables.length > 0 && <p className="text-sm font-semibold text-foreground-strong">Tables pas encore placées sur le plan</p>}
                    <ul className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                        {unplaced.map((r) => {
                            const tone = LIST_TONE[r.state];
                            const target = r.current ?? r.next;
                            const body = (
                                <>
                                    <span className="flex items-center justify-between gap-2">
                                        <span className="text-base font-bold text-foreground-strong">{`Table ${r.table.number}`}</span>
                                        <span className={cn('rounded-md border px-2 py-0.5 text-sm font-semibold', tone.cls)}>{tone.label}</span>
                                    </span>
                                    <span className="block text-sm leading-snug text-muted-foreground">{r.hint}</span>
                                </>
                            );
                            return (
                                <li key={r.table.id}>
                                    {target ? (
                                        <button
                                            type="button"
                                            onClick={() => open(r.table.id)}
                                            className="flex min-h-11 w-full cursor-pointer flex-col gap-1 rounded-xl border border-border bg-card px-3 py-2.5 text-left transition-colors duration-fast ease-standard hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        >
                                            {body}
                                        </button>
                                    ) : (
                                        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card px-3 py-2.5">{body}</div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
        </section>
    );
}
