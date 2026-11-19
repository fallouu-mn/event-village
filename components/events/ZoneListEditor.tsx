'use client';

/**
 * Finition 2b (B, E-23) — liste des zones et des portes, contrôlée : un seul rendu pour l'étape « Contrôle à l'entrée »
 * du formulaire (création : catégories désignées par leur clé locale, enregistrées avec l'événement) et pour
 * l'enregistrement des zones d'un événement existant (ZonesEditor : catégories par identifiant, PUT …/zones). Extrait de
 * ZonesEditor (lot 9 ter, 9t.15) sans changement de rendu : nom, type (Entrée / Contrôle), catégories admises (pastille
 * et nom de la couleur, jamais la couleur seule), portes. Les règles sont celles de la base ; `errors` place sous leur
 * champ les refus de l'écran ou du serveur (clés « zones.<i>.name », « zones.<i>.category_ids », « zones.<i>.gates »,
 * « zones.<i>.gates.<j>.name »).
 */
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { isScanCategoryColor, SCAN_CATEGORY_COLOR_LABELS, ZONE_KIND_LABELS, type ZoneKind } from '@/lib/scan/scan-result';
import { ScanColorDot } from './ScanColorPicker';

export interface ZoneDraftGate { key: string; id?: string; name: string; inUse: boolean }
export interface ZoneDraft { key: string; id?: string; name: string; kind: ZoneKind; categoryKeys: string[]; gates: ZoneDraftGate[] }
export interface ZoneCategory { key: string; name: string; color: string | null; active: boolean }

export const ZONE_KIND_HELP: Record<ZoneKind, string> = {
    ENTREE: 'Composte le billet : la personne entre.',
    CONTROLE: 'Vérifie la catégorie sans composter. Un billet jamais composté est signalé « Pas encore entré ».',
};

export const MAX_ZONES = 20;

/** Finition 2b (B) : texte d'un événement sans zone, le même à la création et en modification. */
export const SINGLE_ENTRANCE_TEXT = 'Une seule entrée : chaque contrôleur laisse entrer toutes les catégories.';

interface ZoneListEditorProps {
    /** Préfixe des identifiants des champs (`${prefix}-z<i>-name`, `-c<j>`, `-g<j>`). */
    prefix: string;
    zones: ZoneDraft[];
    categories: ZoneCategory[];
    editable: boolean;
    busy: boolean;
    onChange: (zones: ZoneDraft[]) => void;
    newKey: () => string;
    errors?: Readonly<Record<string, string>>;
}

export function ZoneListEditor({ prefix, zones, categories, editable, busy, onChange, newKey, errors = {} }: ZoneListEditorProps) {
    const updateZone = (key: string, patch: Partial<ZoneDraft>): void => {
        onChange(zones.map((z) => (z.key === key ? { ...z, ...patch } : z)));
    };
    const updateGate = (zoneKey: string, gateKey: string, name: string): void => {
        onChange(zones.map((z) => (z.key === zoneKey ? { ...z, gates: z.gates.map((g) => (g.key === gateKey ? { ...g, name } : g)) } : z)));
    };
    const toggleCategory = (zoneKey: string, categoryKey: string, checked: boolean): void => {
        onChange(zones.map((z) => (z.key !== zoneKey ? z : {
            ...z,
            categoryKeys: checked ? Array.from(new Set([...z.categoryKeys, categoryKey])) : z.categoryKeys.filter((k) => k !== categoryKey),
        })));
    };

    return (
        <ol className="flex flex-col gap-3" aria-label="Zones de l’événement">
            {zones.map((zone, zi) => {
                const zoneId = `${prefix}-z${zi}`;
                const label = zone.name.trim() || `n° ${zi + 1}`;
                const categoriesError = errors[`zones.${zi}.category_ids`];
                const gatesError = errors[`zones.${zi}.gates`];
                return (
                    <li key={zone.key} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
                        <TextInput
                            id={`${zoneId}-name`}
                            label="Nom de la zone"
                            required
                            maxLength={40}
                            value={zone.name}
                            disabled={!editable || busy}
                            onChange={(e) => updateZone(zone.key, { name: e.target.value })}
                            error={errors[`zones.${zi}.name`]}
                        />

                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-1 text-sm font-semibold text-foreground-strong">Type</legend>
                            {(Object.keys(ZONE_KIND_LABELS) as ZoneKind[]).map((kind) => (
                                <label key={kind} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3">
                                    <input
                                        type="radio"
                                        name={`${zoneId}-kind`}
                                        value={kind}
                                        checked={zone.kind === kind}
                                        disabled={!editable || busy}
                                        onChange={() => updateZone(zone.key, { kind })}
                                        className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-primary"
                                    />
                                    <span className="flex min-w-0 flex-col">
                                        <span className="text-sm font-semibold text-foreground-strong">{ZONE_KIND_LABELS[kind]}</span>
                                        <span className="text-sm leading-snug text-muted-foreground">{ZONE_KIND_HELP[kind]}</span>
                                    </span>
                                </label>
                            ))}
                        </fieldset>

                        <fieldset className="flex flex-col gap-1" aria-describedby={categoriesError ? `${zoneId}-c-erreur` : undefined}>
                            <legend className="mb-1 text-sm font-semibold text-foreground-strong">Catégories admises</legend>
                            {categories.length === 0 && <p className="text-sm text-muted-foreground">Aucune catégorie de billets pour le moment.</p>}
                            {categories.map((c, ci) => {
                                const color = isScanCategoryColor(c.color) ? c.color : null;
                                return (
                                    <label key={c.key} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground-strong">
                                        <input
                                            id={`${zoneId}-c${ci}`}
                                            type="checkbox"
                                            checked={zone.categoryKeys.includes(c.key)}
                                            disabled={!editable || busy}
                                            onChange={(e) => toggleCategory(zone.key, c.key, e.target.checked)}
                                            className="h-5 w-5 flex-shrink-0 cursor-pointer rounded border-input accent-primary"
                                        />
                                        <ScanColorDot color={color} />
                                        <span className="min-w-0 break-words">
                                            <span className="font-semibold">{c.name.trim() || `Catégorie ${ci + 1}`}</span>
                                            {color && <span className="text-muted-foreground"> · {SCAN_CATEGORY_COLOR_LABELS[color]}</span>}
                                            {!c.active && <span className="text-muted-foreground"> · vente fermée</span>}
                                        </span>
                                    </label>
                                );
                            })}
                            {categoriesError && <p id={`${zoneId}-c-erreur`} className="text-sm font-medium text-danger-text">{categoriesError}</p>}
                        </fieldset>

                        <div className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-foreground-strong">Portes</p>
                            <ul className="flex flex-col gap-2">
                                {zone.gates.map((gate, gi) => (
                                    <li key={gate.key} className="flex items-end gap-2">
                                        <TextInput
                                            id={`${zoneId}-g${gi}`}
                                            label="Nom de la porte"
                                            maxLength={40}
                                            value={gate.name}
                                            disabled={!editable || busy}
                                            hint={gate.inUse ? 'Déjà utilisée au contrôle' : undefined}
                                            error={errors[`zones.${zi}.gates.${gi}.name`]}
                                            onChange={(e) => updateGate(zone.key, gate.key, e.target.value)}
                                            fieldClassName="min-w-0 flex-1"
                                        />
                                        {editable && !gate.inUse && (
                                            <IconButton
                                                aria-label={`Retirer la porte ${gate.name.trim() || `n° ${gi + 1}`}`}
                                                variant="ghost"
                                                disabled={busy}
                                                onClick={() => updateZone(zone.key, { gates: zone.gates.filter((g) => g.key !== gate.key) })}
                                            >
                                                <Trash2 size={18} />
                                            </IconButton>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {gatesError && <p className="text-sm font-medium text-danger-text">{gatesError}</p>}
                            {editable && (
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="ghost" size="sm" leftIcon={<Plus size={16} />} disabled={busy}
                                        onClick={() => updateZone(zone.key, { gates: [...zone.gates, { key: newKey(), name: '', inUse: false }] })}>
                                        Ajouter une porte
                                    </Button>
                                    <Button variant="ghost" size="sm" leftIcon={<Trash2 size={16} />} disabled={busy} className="text-danger-text"
                                        onClick={() => onChange(zones.filter((z) => z.key !== zone.key))}>
                                        {`Retirer la zone ${label}`}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
