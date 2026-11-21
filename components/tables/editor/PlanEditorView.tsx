'use client';

/**
 * Lot 11b — plan de salle d'un établissement : tables et zones actives placées sur le plan partagé (FloorPlan, mode
 * edit : doigt, souris, clavier, boutons), « Montrer le plan aux clients » (Switch), « Enregistrer » (PUT
 * /api/partner/venues/[id]/plan { enabled, tables[{id, x, y, shape, rotation}], zones[{id, x, y, w, h}] }). La base
 * revérifie tout (positions dans le cadre, tables de cet établissement, une table placée au moins pour montrer le plan).
 * Garde avant de quitter avec un plan non enregistré.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Hand, LayoutDashboard, Save, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { useServerData } from '@/components/partner/useServerData';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { FloorPlan, type FloorPlanTable, type FloorPlanZone } from '@/components/tables/plan/FloorPlan';
import { PlanSkeleton } from './EditorSkeletons';
import { apiMessage, putJson, type OwnVenue } from './venue-api';

interface PlanState { enabled: boolean; tables: FloorPlanTable[]; zones: FloorPlanZone[] }

function planOf(v: OwnVenue): PlanState {
    return {
        enabled: v.floorPlan,
        tables: v.tables.filter((t) => t.isActive).map((t) => ({
            id: t.id,
            number: t.number,
            capacity: t.capacity,
            minCapacity: t.minCapacity,
            x: t.plan ? t.plan.x : null,
            y: t.plan ? t.plan.y : null,
            shape: t.shape === 'RONDE' || t.shape === 'RECTANGLE' ? t.shape : 'CARREE',
            rotation: Number.isFinite(t.rotation) ? t.rotation : 0,
        })),
        zones: v.zones.filter((z) => z.isActive).map((z) => ({
            id: z.id,
            name: z.name,
            x: z.plan ? z.plan.x : null,
            y: z.plan ? z.plan.y : null,
            w: z.plan ? z.plan.w : null,
            h: z.plan ? z.plan.h : null,
        })),
    };
}

function payloadOf(p: PlanState) {
    return {
        enabled: p.enabled,
        tables: p.tables.map((t) => ({
            id: t.id,
            x: t.x === null || t.y === null ? null : t.x,
            y: t.x === null || t.y === null ? null : t.y,
            shape: t.shape,
            rotation: ((Math.round(t.rotation / 15) * 15) % 360 + 360) % 360,
        })),
        zones: p.zones.map((z) => {
            const placed = z.x !== null && z.y !== null && z.w !== null && z.h !== null;
            return { id: z.id, x: placed ? z.x : null, y: placed ? z.y : null, w: placed ? z.w : null, h: placed ? z.h : null };
        }),
    };
}

export function PlanEditorView({ venueId }: { venueId: string }) {
    const toast = useToast();
    const url = `/api/partner/venues/${encodeURIComponent(venueId)}`;
    const editHref = `/partner/tables/edition/${encodeURIComponent(venueId)}`;
    const { data, error, loading, refreshing, reload } = useServerData<{ venue: OwnVenue }>(url);
    const [start, setStart] = useState<PlanState | null>(null);
    const [plan, setPlan] = useState<PlanState | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [resetOpen, setResetOpen] = useState(false);

    useEffect(() => {
        if (!data?.venue) return;
        const p = planOf(data.venue);
        setStart(p);
        setPlan(p);
        // Relu après un enregistrement ou un « Réessayer » : la base fait foi
    }, [data?.venue]);

    const dirty = !!plan && !!start && JSON.stringify(payloadOf(plan)) !== JSON.stringify(payloadOf(start));
    const describe = useCallback(() => ['Les positions du plan de salle'], []);
    const unsaved = useUnsavedGuard(dirty && !saving, describe);
    const placedCount = useMemo(() => plan?.tables.filter((t) => t.x !== null && t.y !== null).length ?? 0, [plan]);

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <PlanSkeleton />
                <span className="sr-only">Chargement du plan de salle…</span>
            </div>
        );
    }

    if (error || !data?.venue) {
        return (
            <div className="mx-auto w-full max-w-6xl">
                <PageHeader back={{ href: '/partner/tables', label: 'Mes établissements' }} title="Plan de salle" />
                <ErrorState title="Plan indisponible" description={error ?? 'Cet établissement n’a pas pu être chargé.'} onRetry={() => void reload()} isRetrying={refreshing} />
            </div>
        );
    }

    const venue = data.venue;
    const current = plan ?? planOf(venue);
    const enabledWithoutTables = current.enabled && placedCount === 0;

    const save = async () => {
        if (saving || !plan) return;
        if (enabledWithoutTables) {
            setSaveError('Placez au moins une table sur le plan avant de le montrer aux clients.');
            return;
        }
        setSaving(true);
        setSaveError(null);
        try {
            await putJson(`${url}/plan`, payloadOf(plan));
            setStart(plan);
            toast.success(plan.enabled ? 'Plan enregistré : il est montré aux clients.' : 'Plan enregistré.');
            await reload();
        } catch (err) {
            setSaveError(apiMessage(err, 'Le plan n’a pas été enregistré. Réessayez.'));
        } finally {
            setSaving(false);
        }
    };

    const saveButton = (
        <Button type="button" leftIcon={<Save size={18} />} onClick={() => void save()} isLoading={saving} disabled={saving || !dirty}>
            {saving ? 'Enregistrement…' : dirty ? 'Enregistrer le plan' : 'Plan enregistré'}
        </Button>
    );

    return (
        <div className="mx-auto w-full max-w-6xl pb-10">
            <PageHeader
                back={{ href: editHref, label: 'Retour à l’établissement' }}
                title="Plan de salle"
                description={venue.name}
                actions={current.tables.length > 0 ? saveButton : undefined}
            />

            {current.tables.length === 0 ? (
                <EmptyState
                    icon={<LayoutDashboard size={28} />}
                    title="Aucune table à placer"
                    description="Ajoutez d’abord vos tables dans la fiche de l’établissement, puis revenez les placer sur le plan."
                    actionLabel="Ajouter des tables"
                    actionHref={editHref}
                    illustrated
                />
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="rounded-2xl border border-border bg-card p-4">
                        <Switch
                            id="plan-montre"
                            label="Montrer le plan aux clients"
                            description={placedCount > 0
                                ? `Les clients choisissent leur table sur le plan au moment de réserver. ${placedCount} table${placedCount > 1 ? 's' : ''} placée${placedCount > 1 ? 's' : ''} sur ${current.tables.length}.`
                                : 'Placez au moins une table pour pouvoir montrer le plan.'}
                            checked={current.enabled}
                            onChange={(enabled) => { setSaveError(null); setPlan({ ...current, enabled }); }}
                            error={enabledWithoutTables ? 'Placez au moins une table sur le plan avant de le montrer.' : undefined}
                        />
                    </div>

                    <StatusBanner tone="info" icon={<Hand size={20} />} title="Faites glisser les tables du doigt ou à la souris">
                        Touchez une table ou une zone pour la tourner, changer sa forme, l’agrandir ou la retirer. Au clavier : flèches pour déplacer (Majuscule pour aller plus vite), R pour tourner.
                    </StatusBanner>

                    <FloorPlan
                        mode="edit"
                        ariaLabel={`Plan de salle de ${venue.name}`}
                        tables={current.tables}
                        zones={current.zones}
                        onChange={(tables, zones) => { setSaveError(null); setPlan({ ...current, tables, zones }); }}
                    />

                    {saveError && (
                        <StatusBanner tone="danger" announce="alert" title="Plan non enregistré">
                            <span className="block break-words">{saveError}</span>
                        </StatusBanner>
                    )}

                    <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
                        {dirty && (
                            <Button type="button" variant="ghost" leftIcon={<Undo2 size={18} />} onClick={() => setResetOpen(true)} disabled={saving}>
                                Annuler les changements
                            </Button>
                        )}
                        <p className="text-sm text-muted-foreground sm:mr-auto" aria-live="polite">
                            {dirty ? 'Changements non enregistrés.' : 'Tout est enregistré.'}
                        </p>
                        {saveButton}
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={resetOpen}
                onClose={() => setResetOpen(false)}
                onConfirm={() => { setPlan(start); setSaveError(null); setResetOpen(false); }}
                title="Annuler les changements du plan ?"
                message="Les tables et les zones reviennent à leur place enregistrée."
                confirmLabel="Annuler les changements"
                cancelLabel="Continuer à placer"
                variant="warning"
            />
            <ConfirmDialog
                isOpen={unsaved.open}
                onClose={unsaved.stay}
                onConfirm={unsaved.leave}
                title="Quitter sans enregistrer le plan ?"
                message="Les tables déplacées depuis le dernier enregistrement reviendront à leur place."
                confirmLabel="Quitter sans enregistrer"
                cancelLabel="Rester sur le plan"
                variant="warning"
            />
        </div>
    );
}
