'use client';

import { useMemo, useState } from 'react';
import { LayoutTemplate, Monitor, Smartphone } from 'lucide-react';
import { FloorPlan, type FloorPlanTable, type FloorPlanZone } from '@/components/tables/plan/FloorPlan';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/components/ui/cn';
import { AREAS, EDGE, GRID_STEP, TEMPLATES, templatePositions, type TemplateArea, type TemplateId } from './plan-templates';
import type { TableShape, TableState, TableTypeRow } from './types';

/**
 * Lot 11c-c — plan des tables d'un événement en édition : le plan partagé du lot 11b (FloorPlan, mode édition : doigt,
 * souris, clavier, flèches du panneau), les zones d'accès en rectangles, des gabarits en un geste, l'alignement
 * automatique sur une grille douce (pas de 2,5 % dans le sens du déplacement, coupable), « Montrer le plan aux clients »
 * et l'aperçu « vue client » sur téléphone et sur ordinateur.
 */

export interface DraftTable {
    key: string;
    id: string | null;
    number: number;
    type_id: string;
    zone_id: string | null;
    x: number | null;
    y: number | null;
    shape: TableShape;
    rotation: number;
    state: TableState;
    ever_sold: boolean;
}

export interface DraftZone { id: string; name: string; x: number | null; y: number | null; w: number | null; h: number | null }

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Alignement dans le sens du déplacement : un pas de clavier de 1 % avance d'un pas de grille, jamais sur place. */
function directionalSnap(before: number | null, after: number | null): number | null {
    if (after === null || before === null || after === before) return after;
    const step = after > before ? Math.ceil(after / GRID_STEP) : Math.floor(after / GRID_STEP);
    return round1(Math.min(100 - EDGE, Math.max(EDGE, step * GRID_STEP)));
}

export interface PlanWorkbenchProps {
    tables: DraftTable[];
    zones: DraftZone[];
    types: TableTypeRow[];
    readOnly: boolean;
    planEnabled: boolean;
    onChange: (tables: DraftTable[], zones: DraftZone[]) => void;
    onPlanEnabledChange: (next: boolean) => void;
}

export function PlanWorkbench({ tables, zones, types, readOnly, planEnabled, onChange, onPlanEnabledChange }: PlanWorkbenchProps) {
    const seatsOf = useMemo(() => new Map(types.map((t) => [t.id, t.seats])), [types]);
    const nameOf = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);
    const [snapOn, setSnapOn] = useState(true);
    const [tplType, setTplType] = useState<string>(types[0]?.id ?? '');
    const [tpl, setTpl] = useState<TemplateId>('rangees');
    const [area, setArea] = useState<TemplateArea>('tout');
    const [preview, setPreview] = useState<'telephone' | 'ordinateur' | null>(null);
    const [showError, setShowError] = useState<string | null>(null);

    const unplaced = tables.filter((t) => t.x === null || t.y === null).length;
    const tplCount = tables.filter((t) => t.type_id === (tplType || types[0]?.id)).length;

    const floorTables: FloorPlanTable[] = tables.map((t) => ({
        id: t.key,
        number: String(t.number),
        capacity: seatsOf.get(t.type_id) ?? 2,
        x: t.x,
        y: t.y,
        shape: t.shape,
        rotation: t.rotation,
        state: readOnly ? (t.state === 'LIBRE' ? 'LIBRE' : t.state === 'EN_ATTENTE' ? 'ATTENDUE' : 'PRISE') : null,
        hint: nameOf.get(t.type_id),
    }));
    const floorZones: FloorPlanZone[] = zones.map((z) => ({ id: z.id, name: z.name, x: z.x, y: z.y, w: z.w, h: z.h }));

    const onPlanChange = (next: FloorPlanTable[], nextZones: FloorPlanZone[]) => {
        const byKey = new Map(next.map((t) => [t.id, t]));
        const updated = tables.map((t) => {
            const n = byKey.get(t.key);
            if (!n) return t;
            const moved = t.x !== null && t.y !== null && n.x !== null && n.y !== null;
            return {
                ...t,
                x: snapOn && moved ? directionalSnap(t.x, n.x) : n.x,
                y: snapOn && moved ? directionalSnap(t.y, n.y) : n.y,
                shape: n.shape,
                rotation: n.rotation,
            };
        });
        const zoneById = new Map(nextZones.map((z) => [z.id, z]));
        onChange(updated, zones.map((z) => {
            const n = zoneById.get(z.id);
            return n ? { ...z, x: n.x, y: n.y, w: n.w, h: n.h } : z;
        }));
    };

    const applyTemplate = () => {
        const typeId = tplType || types[0]?.id;
        const mine = tables.filter((t) => t.type_id === typeId).sort((a, b) => a.number - b.number);
        const points = templatePositions(tpl, mine.length, area);
        const pos = new Map(mine.map((t, i) => [t.key, points[i]]));
        onChange(tables.map((t) => {
            const p = pos.get(t.key);
            return p ? { ...t, x: p.x, y: p.y, shape: tpl === 'carre' ? 'CARREE' : t.shape } : t;
        }), zones);
    };

    const togglePlan = (next: boolean) => {
        if (next && unplaced > 0) {
            setShowError(`Placez toutes les tables sur le plan avant de le montrer aux clients : ${unplaced === 1 ? '1 table reste' : `${unplaced} tables restent`} à placer.`);
            return;
        }
        setShowError(null);
        onPlanEnabledChange(next);
    };

    const previewTables: FloorPlanTable[] = floorTables.map((t, i) => ({ ...t, state: tables[i].state === 'LIBRE' ? 'LIBRE' : 'PRISE', hint: undefined }));

    return (
        <div className="flex flex-col gap-4">
            {!readOnly && types.length > 0 && (
                <section aria-labelledby="gabarits-titre" className="rounded-2xl border border-border bg-card p-4">
                    <h4 id="gabarits-titre" className="mb-3 inline-flex items-center gap-2 text-base font-semibold text-foreground-strong">
                        <LayoutTemplate size={18} aria-hidden="true" /> Gabarits en un geste
                    </h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                        <Select id="gab-type" label="Type de table" value={tplType || types[0]?.id} onChange={(e) => setTplType(e.target.value)}
                            options={types.map((t) => ({ value: t.id, label: t.name }))} />
                        <Select id="gab-forme" label="Disposition" value={tpl} onChange={(e) => setTpl(e.target.value as TemplateId)}
                            options={TEMPLATES.map((x) => ({ value: x.id, label: x.label(Math.max(1, tplCount)) }))} />
                        <Select id="gab-zone" label="Où" value={area} onChange={(e) => setArea(e.target.value as TemplateArea)}
                            options={AREAS.map((a) => ({ value: a.id, label: a.label }))} />
                        <Button type="button" variant="secondary" onClick={applyTemplate} disabled={tplCount === 0}>Disposer</Button>
                    </div>
                    <Switch className="mt-3" label="Aligner sur la grille" checked={snapOn} onChange={setSnapOn}
                        description="Les tables déplacées se posent sur une grille douce : les rangées restent droites." />
                </section>
            )}

            <FloorPlan
                tables={floorTables}
                zones={floorZones}
                mode={readOnly ? 'view' : 'edit'}
                onChange={onPlanChange}
                ariaLabel="Plan des tables de l’événement"
                labels={{ PRISE: { legend: 'Vendue', spoken: 'vendue' }, ATTENDUE: { legend: 'En paiement', spoken: 'en cours de paiement' } }}
            />

            <section aria-label="Plan montré aux clients" className="rounded-2xl border border-border bg-card p-4">
                <Switch
                    id="plan-montre"
                    label="Montrer le plan aux clients"
                    checked={planEnabled}
                    onChange={togglePlan}
                    disabled={readOnly}
                    error={showError ?? undefined}
                    description={planEnabled
                        ? 'Les clients choisissent leur table sur le plan.'
                        : 'Sans plan, le client choisit un type de table et reçoit la plus petite table libre.'}
                />
                {unplaced > 0 && !showError && (
                    <p className="mt-2 text-sm text-muted-foreground">
                        {unplaced === 1 ? '1 table reste à placer' : `${unplaced} tables restent à placer`} (liste « À placer » sous le plan).
                    </p>
                )}
                <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="Aperçu de la vue client">
                    <span className="text-sm font-semibold text-muted-foreground">Vue client :</span>
                    <Button type="button" size="sm" variant={preview === 'telephone' ? 'primary' : 'secondary'} aria-pressed={preview === 'telephone'}
                        leftIcon={<Smartphone size={16} />} onClick={() => setPreview((p) => (p === 'telephone' ? null : 'telephone'))}>Téléphone</Button>
                    <Button type="button" size="sm" variant={preview === 'ordinateur' ? 'primary' : 'secondary'} aria-pressed={preview === 'ordinateur'}
                        leftIcon={<Monitor size={16} />} onClick={() => setPreview((p) => (p === 'ordinateur' ? null : 'ordinateur'))}>Ordinateur</Button>
                </div>
                {preview && (
                    <div className="mt-4 animate-in fade-in" data-vue-client={preview}>
                        <div className={cn('mx-auto rounded-3xl border-4 border-input bg-background p-3', preview === 'telephone' ? 'max-w-sm' : 'w-full')}>
                            <p className="mb-2 text-sm font-semibold text-foreground-strong">Choisissez votre table</p>
                            <FloorPlan tables={previewTables} zones={floorZones} mode="view" ariaLabel="Aperçu du plan tel que le client le voit" />
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">Aperçu : les tables vendues ou en paiement apparaissent « Déjà prise ».</p>
                    </div>
                )}
            </section>
        </div>
    );
}
