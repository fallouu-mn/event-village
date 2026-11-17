'use client';

/**
 * Lot 9 ter (9t.15, consigne 1, contrat C.1.4) — éditeur des zones et des portes d'un événement, monté dans l'onglet
 * Équipe du pilotage, au-dessus des contrôleurs. Configuration lue sur GET /api/partner/events/[id]/zones (lecture faite
 * par l'onglet, passée ici) et enregistrée en entier par PUT du même chemin : la RPC event_zones_save décide de tout
 * (droits, statut, noms, doublons, zone sans porte ou sans catégorie, porte déjà utilisée au contrôle) et rend son texte,
 * affiché tel quel avec le focus sur le champ en cause. `can_edit` et `edit_block` viennent du serveur.
 *
 * Sans zone, une seule entrée « Entrée » admet toutes les catégories (rien à régler). « Configurer des zones » prépare,
 * sans rien enregistrer, une zone « Entrée » qui admet toutes les catégories avec une porte « Entrée ». Chaque catégorie
 * est nommée, précédée de sa pastille de couleur et du nom de la couleur (jamais la couleur seule).
 * Finition 2b (B, E-23) : la liste des zones est le composant partagé ZoneListEditor (même rendu que l'étape « Contrôle à
 * l'entrée » de la création) ; monté dans l'étape « Contrôle à l'entrée » du formulaire de modification (et non plus
 * dans l'onglet Équipe du pilotage) ; le refus du serveur s'affiche aussi sous son champ.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DoorOpen, LayoutGrid, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorState } from '@/components/ui/EmptyState';
import { KpiCardSkeleton } from '@/components/ui/KpiCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { ApiError, errorMessage, fetchJson } from '@/components/partner/fetch-json';
import { PilotageSection } from '@/components/partner/pilotage/PilotageBlocks';
import { formatInteger } from '@/lib/format';
import type { ZoneKind } from '@/lib/scan/scan-result';
import { MAX_ZONES, SINGLE_ENTRANCE_TEXT, ZoneListEditor, type ZoneDraft } from '@/components/events/ZoneListEditor';

/** Réponse de GET (et de PUT) /api/partner/events/[id]/zones (contrat 4.3, F30). */
export interface ZonesConfig {
    event_id: string;
    configured: boolean;
    can_edit: boolean;
    edit_block: string | null;
    zones: Array<{
        id: string;
        name: string;
        kind: ZoneKind;
        position: number;
        category_ids: string[];
        gates: Array<{ id: string; name: string; in_use: boolean; controller_count: number }>;
    }>;
    categories: Array<{ id: string; name: string; is_active: boolean; scan_color: string | null; entry_instruction: string | null }>;
    controllers: Array<{ user_id: string; name: string; gate_id: string | null; gate_change_allowed: boolean }>;
    /** Nombre de contrôleurs sans porte sur un événement à zones, compté par event_zones_get. */
    controllers_without_gate: number;
}

/** Zones lues → brouillon de la liste partagée (catégories désignées par leur identifiant). */
function draftOf(config: ZonesConfig): ZoneDraft[] {
    return config.zones.map((z) => ({
        key: z.id,
        id: z.id,
        name: z.name,
        kind: z.kind as ZoneKind,
        categoryKeys: [...z.category_ids].sort(),
        gates: z.gates.map((g) => ({ key: g.id, id: g.id, name: g.name, inUse: g.in_use })),
    }));
}

/** Empreinte comparable d'un brouillon (modifications non enregistrées). */
function signature(zones: ZoneDraft[]): string {
    return JSON.stringify(zones.map((z) => [z.id ?? null, z.name, z.kind, [...z.categoryKeys].sort(), z.gates.map((g) => [g.id ?? null, g.name])]));
}

export interface ZonesEditorProps {
    eventId: string;
    config: ZonesConfig | null;
    loading: boolean;
    error: string | null;
    refreshing: boolean;
    reload: () => Promise<void>;
    /** Configuration enregistrée (réponse du PUT) : l'onglet la garde et relit l'équipe. */
    onSaved: (config: ZonesConfig) => void;
}

export function ZonesEditor({ eventId, config, loading, error, refreshing, reload, onSaved }: ZonesEditorProps) {
    const toast = useToast();
    const prefix = `zones-${eventId}`;
    const seq = useRef(0);
    const [zones, setZones] = useState<ZoneDraft[]>([]);
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    /** Finition 2b (B) : refus du serveur placé sous son champ (clé `field` de la réponse). */
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [focusField, setFocusField] = useState<string | null>(null);
    const [confirmReset, setConfirmReset] = useState(false);

    const baseline = useMemo(() => (config ? draftOf(config) : []), [config]);
    const shownBaseline = useRef<string | null>(null);
    // Nouvelle configuration lue (relecture, enregistrement) : le brouillon la suit, sauf s'il porte des modifications.
    // La référence précédente est lue AVANT d'être remplacée : React peut n'exécuter la fonction de mise à jour qu'au
    // rendu suivant, quand la ref porterait déjà la nouvelle référence (brouillon vide gardé, run 132).
    useEffect(() => {
        const previous = shownBaseline.current;
        shownBaseline.current = signature(baseline);
        setZones((current) => (previous === null || signature(current) === previous ? baseline : current));
    }, [baseline]);

    // Focus sur le champ en cause d'un refus (`field` de la réponse), une fois le bandeau rendu
    useEffect(() => {
        if (!focusField) return;
        const el = document.getElementById(focusField);
        if (el) el.focus();
        setFocusField(null);
    }, [focusField]);

    const nextKey = (): string => {
        seq.current += 1;
        return `n${seq.current}`;
    };

    if (loading) {
        return (
            <PilotageSection title="Zones et portes">
                <div role="status" aria-busy="true" aria-label="Chargement des zones">
                    <KpiCardSkeleton className="min-h-40" />
                </div>
            </PilotageSection>
        );
    }
    if (!config) {
        return (
            <PilotageSection title="Zones et portes">
                <ErrorState title="Zones indisponibles" description={error ?? undefined} onRetry={() => void reload()} isRetrying={refreshing} />
            </PilotageSection>
        );
    }

    const editable = config.can_edit;
    const dirty = signature(zones) !== signature(baseline);
    const categories = config.categories;
    // Nombre de contrôleurs sans porte compté par le serveur (event_zones_get, controllers_without_gate)
    const withoutGate = config.controllers_without_gate ?? 0;

    const changeZones = (next: ZoneDraft[]): void => {
        setZones(next);
        setFieldErrors({});
    };
    const addZone = (): void => {
        changeZones([...zones, { key: nextKey(), name: '', kind: 'ENTREE', categoryKeys: [], gates: [{ key: nextKey(), name: '', inUse: false }] }]);
    };
    /** « Configurer des zones » : brouillon d'une zone « Entrée » (toutes les catégories, une porte), rien d'enregistré. */
    const startZones = (): void => {
        changeZones([{ key: nextKey(), name: 'Entrée', kind: 'ENTREE', categoryKeys: categories.map((c) => c.id), gates: [{ key: nextKey(), name: 'Entrée', inUse: false }] }]);
    };

    const save = async (next: ZoneDraft[]): Promise<boolean> => {
        setSaving(true);
        setFailure(null);
        setFieldErrors({});
        try {
            const saved = await fetchJson<ZonesConfig & { message?: string }>(`/api/partner/events/${eventId}/zones`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    zones: next.map((z, i) => ({
                        ...(z.id ? { id: z.id } : {}),
                        name: z.name,
                        kind: z.kind,
                        position: i,
                        category_ids: z.categoryKeys,
                        gates: z.gates.map((g) => ({ ...(g.id ? { id: g.id } : {}), name: g.name })),
                    })),
                }),
            });
            toast.success(saved.message || 'Zones enregistrées.');
            // Le brouillon enregistré devient la référence (la configuration rendue le remplace)
            shownBaseline.current = null;
            onSaved(saved);
            return true;
        } catch (err) {
            const message = errorMessage(err, 'Enregistrement impossible pour le moment.');
            setFailure(message);
            const field = err instanceof ApiError && typeof err.body?.field === 'string' ? err.body.field : '';
            if (field) setFieldErrors({ [field]: message });
            const m = /^zones\.(\d+)(?:\.(name|category_ids)|\.gates\.(\d+)\.name)?$/.exec(field);
            if (m) {
                const zone = `${prefix}-z${m[1]}`;
                setFocusField(m[3] !== undefined ? `${zone}-g${m[3]}` : m[2] === 'category_ids' ? `${zone}-c0` : `${zone}-name`);
            }
            return false;
        } finally {
            setSaving(false);
        }
    };

    return (
        <PilotageSection
            title="Zones et portes"
            description="Sans zone, une seule entrée « Entrée » admet toutes les catégories : rien à régler. Ajoutez des zones pour séparer les accès (carré VIP, backstage)."
        >
            {!editable && config.edit_block && (
                <StatusBanner tone="info" title="Zones en lecture seule">{config.edit_block}</StatusBanner>
            )}
            {withoutGate > 0 && (
                <StatusBanner tone="warning" title={withoutGate > 1 ? 'Contrôleurs sans porte' : 'Contrôleur sans porte'}>
                    <span className="tabular-nums">
                        {withoutGate > 1
                            ? `${formatInteger(withoutGate)} contrôleurs sans porte : ils ne peuvent pas scanner tant que vous ne leur attribuez pas une porte.`
                            : '1 contrôleur sans porte : il ne peut pas scanner tant que vous ne lui attribuez pas une porte.'}
                    </span>
                </StatusBanner>
            )}
            {error && (
                <StatusBanner tone="warning" title="Zones peut-être dépassées" announce="alert"
                    action={<Button variant="secondary" size="sm" onClick={() => void reload()} isLoading={refreshing}>Réessayer</Button>}>
                    {error}
                </StatusBanner>
            )}

            {zones.length === 0 ? (
                <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-bg text-brand-fg" aria-hidden="true">
                            <DoorOpen size={22} />
                        </span>
                        <div className="min-w-0">
                            {/* Finition 2b (B) : même texte qu'à la création */}
                            <p className="text-base font-semibold text-fg">{SINGLE_ENTRANCE_TEXT}</p>
                        </div>
                    </div>
                    {editable && (
                        <Button variant="secondary" leftIcon={<LayoutGrid size={18} />} onClick={startZones}>Configurer des zones</Button>
                    )}
                </div>
            ) : (
                <ZoneListEditor
                    prefix={prefix}
                    zones={zones}
                    categories={categories.map((c) => ({ key: c.id, name: c.name, color: c.scan_color, active: c.is_active }))}
                    editable={editable}
                    busy={saving}
                    onChange={changeZones}
                    newKey={nextKey}
                    errors={fieldErrors}
                />
            )}

            {failure && (
                <StatusBanner tone="danger" title="Zones non enregistrées" announce="alert">{failure}</StatusBanner>
            )}

            {editable && (zones.length > 0 || config.configured) && (
                <div className="flex flex-wrap gap-2">
                    {zones.length > 0 && (
                        <Button variant="secondary" leftIcon={<Plus size={18} />} onClick={addZone} disabled={saving || zones.length >= MAX_ZONES}>
                            Ajouter une zone
                        </Button>
                    )}
                    <Button variant="primary" onClick={() => void save(zones)} isLoading={saving} disabled={!dirty}>
                        Enregistrer les zones
                    </Button>
                    {dirty && (
                        <Button variant="ghost" onClick={() => { setZones(baseline); setFailure(null); setFieldErrors({}); }} disabled={saving}>
                            Annuler les modifications
                        </Button>
                    )}
                    {config.configured && (
                        <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={saving} className="text-danger-fg">
                            Revenir à une seule entrée
                        </Button>
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmReset}
                onClose={() => setConfirmReset(false)}
                onConfirm={() => void save([]).finally(() => setConfirmReset(false))}
                title="Revenir à une seule entrée ?"
                message="Les zones et les portes seront supprimées. Tous les contrôleurs pourront de nouveau composter toutes les catégories."
                confirmLabel="Supprimer les zones"
                cancelLabel="Garder les zones"
                variant="danger"
                isLoading={saving}
            />
        </PilotageSection>
    );
}
