'use client';

/**
 * Finition 2b (B, E-23) — étape 5 « Contrôle à l'entrée (facultatif) » de la création d'un événement.
 *  - Sans réglage : « Une seule entrée : chaque contrôleur laisse entrer toutes les catégories. » (aucune zone) ;
 *  - « Plusieurs portes ou zones » : la liste partagée ZoneListEditor (nom, type, catégories admises, portes), préparée
 *    avec une zone « Entrée générale » qui admet toutes les catégories et une porte « Porte principale » ;
 *  - couleurs au contrôle des catégories (modifiables ici comme à l'étape Billets).
 * Rien n'est enregistré ici : les zones partent avec l'événement (catégories désignées par leur ordre), dans la même
 * transaction ; les règles (et leurs textes) sont celles de l'enregistrement des zones.
 */
import React from 'react';
import { DoorOpen, LayoutGrid, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { ScanCategoryColor } from '@/lib/scan/scan-result';
import { ScanColorSelect } from './ScanColorPicker';
import { MAX_ZONES, SINGLE_ENTRANCE_TEXT, ZoneListEditor, type ZoneDraft } from './ZoneListEditor';

export interface EntryControlCategory { key: string; name: string; scan_color: string; is_active: boolean }

interface EntryControlStepProps {
    prefix: string;
    categories: ReadonlyArray<EntryControlCategory>;
    /** null : une seule entrée (aucune zone). */
    zones: ZoneDraft[] | null;
    onZonesChange: (zones: ZoneDraft[] | null) => void;
    onColorChange: (categoryKey: string, color: ScanCategoryColor) => void;
    newKey: () => string;
    errors: Readonly<Record<string, string>>;
}

export function EntryControlStep({ prefix, categories, zones, onZonesChange, onColorChange, newKey, errors }: EntryControlStepProps) {
    const multiple = zones !== null;
    const choose = (next: 'single' | 'multiple') => {
        if (next === 'single') {
            onZonesChange(null);
            return;
        }
        if (multiple) return;
        onZonesChange([{
            key: newKey(),
            name: 'Entrée générale',
            kind: 'ENTREE',
            categoryKeys: categories.map((c) => c.key),
            gates: [{ key: newKey(), name: 'Porte principale', inUse: false }],
        }]);
    };
    const choiceClass = (active: boolean) => cn(
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors duration-200',
        active ? 'border-primary-text bg-primary-soft' : 'border-border bg-card hover:bg-muted',
    );

    return (
        <div className="flex flex-col gap-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
                Facultatif. Vous pourrez modifier les portes, les zones et les couleurs plus tard, depuis l’événement.
            </p>

            <fieldset id={`${prefix}-choix`} tabIndex={-1} className="flex flex-col gap-3 focus-visible:outline-none">
                <legend className="mb-1 text-base font-semibold text-foreground-strong">Portes et zones</legend>
                <label className={choiceClass(!multiple)}>
                    <input type="radio" name={`${prefix}-choix`} checked={!multiple} onChange={() => choose('single')}
                        className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-primary" />
                    <span className="flex min-w-0 items-start gap-3">
                        <DoorOpen size={20} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="text-sm font-semibold text-foreground-strong">{SINGLE_ENTRANCE_TEXT}</span>
                    </span>
                </label>
                <label className={choiceClass(multiple)}>
                    <input type="radio" name={`${prefix}-choix`} checked={multiple} onChange={() => choose('multiple')}
                        className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer accent-primary" />
                    <span className="flex min-w-0 items-start gap-3">
                        <LayoutGrid size={20} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-semibold text-foreground-strong">Plusieurs portes ou zones</span>
                            <span className="text-sm leading-snug text-muted-foreground">Par exemple une entrée générale et un carré VIP vérifié à sa porte.</span>
                        </span>
                    </span>
                </label>
                {errors.zones && <p role="alert" className="text-sm font-medium text-danger-text">{errors.zones}</p>}
            </fieldset>

            {multiple && zones && (
                <div className="flex flex-col gap-3">
                    <ZoneListEditor
                        prefix={prefix}
                        zones={zones}
                        categories={categories.map((c) => ({ key: c.key, name: c.name, color: c.scan_color, active: c.is_active }))}
                        editable
                        busy={false}
                        onChange={(next) => onZonesChange(next.length > 0 ? next : null)}
                        newKey={newKey}
                        errors={errors}
                    />
                    {zones.length < MAX_ZONES && (
                        <div>
                            <Button type="button" variant="outline" leftIcon={<Plus size={18} />}
                                onClick={() => onZonesChange([...zones, { key: newKey(), name: '', kind: 'ENTREE', categoryKeys: [], gates: [{ key: newKey(), name: '', inUse: false }] }])}>
                                Ajouter une zone
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <section aria-labelledby={`${prefix}-couleurs`} className="flex flex-col gap-3 rounded-2xl border border-border p-4">
                <h3 id={`${prefix}-couleurs`} className="text-base font-semibold text-foreground-strong">Couleurs au contrôle</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">Bande de couleur montrée au contrôleur avec le nom de la catégorie.</p>
                {categories.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Ajoutez d’abord une catégorie de billets, à l’étape Billets.</p>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {categories.map((c, i) => (
                            <ScanColorSelect
                                key={c.key}
                                id={`${prefix}-couleur-${i}`}
                                label={c.name.trim() || `Catégorie ${i + 1}`}
                                value={c.scan_color}
                                onChange={(color) => onColorChange(c.key, color)}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
