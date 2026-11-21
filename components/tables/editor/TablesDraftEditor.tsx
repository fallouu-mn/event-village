'use client';

/**
 * Lot 11b — zones et tables d'un nouvel établissement (création en une fois : POST /api/partner/venues avec
 * zones[{key, name}] et tables[{number, capacity, min_capacity?, zone_key?}]). Ajout rapide « 5 tables de 4 » : numéros
 * qui suivent le plus grand numéro déjà saisi. Rien n'est envoyé ici : le formulaire de l'établissement envoie le tout.
 */
import { useRef, useState } from 'react';
import { LayoutGrid, Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Select, TextInput } from '@/components/ui/Field';
import { wholeNumber } from './venue-api';

export interface DraftZone { key: string; name: string }
export interface DraftTable { key: string; number: string; capacity: string; min: string; zoneKey: string }

export const LIMITS_TABLES = { zones: 20, tables: 200, zoneName: 80, number: 20, capacity: 50 } as const;

/** Contrôles de l'écran : erreurs par clé (« zone:<clé> », « table:<clé>:number|capacity|min ») et d'ensemble (« tables »). */
export function validateDraftTables(zones: DraftZone[], tables: DraftTable[]): Record<string, string> {
    const e: Record<string, string> = {};
    const zoneNames = new Set<string>();
    for (const z of zones) {
        const n = z.name.trim();
        if (!n) e[`zone:${z.key}`] = 'Donnez un nom à la zone, ou retirez-la.';
        else if (n.length > LIMITS_TABLES.zoneName) e[`zone:${z.key}`] = `${LIMITS_TABLES.zoneName} caractères au plus.`;
        else if (zoneNames.has(n.toLowerCase())) e[`zone:${z.key}`] = 'Deux zones portent ce nom.';
        zoneNames.add(n.toLowerCase());
    }
    if (zones.length > LIMITS_TABLES.zones) e.zones = `${LIMITS_TABLES.zones} zones au plus.`;
    const numbers = new Set<string>();
    for (const t of tables) {
        const n = t.number.trim();
        if (!n) e[`table:${t.key}:number`] = 'Numéro manquant.';
        else if (n.length > LIMITS_TABLES.number) e[`table:${t.key}:number`] = `${LIMITS_TABLES.number} caractères au plus.`;
        else if (numbers.has(n.toLowerCase())) e[`table:${t.key}:number`] = 'Numéro déjà pris.';
        numbers.add(n.toLowerCase());
        const cap = wholeNumber(t.capacity);
        if (cap === null || cap < 1 || cap > LIMITS_TABLES.capacity) e[`table:${t.key}:capacity`] = 'De 1 à 50 places.';
        if (t.min.trim()) {
            const min = wholeNumber(t.min);
            if (min === null || min < 1) e[`table:${t.key}:min`] = 'Au moins 1.';
            else if (cap !== null && min > cap) e[`table:${t.key}:min`] = 'Pas plus que la capacité.';
        }
    }
    if (tables.length === 0) e.tables = 'Ajoutez au moins une table.';
    else if (tables.length > LIMITS_TABLES.tables) e.tables = `${LIMITS_TABLES.tables} tables au plus.`;
    return e;
}

export function parseDraftTables(raw: unknown): { zones: DraftZone[]; tables: DraftTable[] } | null {
    const r = raw as { zones?: unknown; tables?: unknown } | null;
    if (!r || !Array.isArray(r.zones) || !Array.isArray(r.tables)) return null;
    const s = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : null);
    const zones: DraftZone[] = [];
    for (const z of r.zones.slice(0, LIMITS_TABLES.zones * 2)) {
        const o = z as Record<string, unknown> | null;
        const key = s(o?.key, 40);
        const name = s(o?.name, 200);
        if (key === null || name === null) return null;
        zones.push({ key, name });
    }
    const tables: DraftTable[] = [];
    for (const t of r.tables.slice(0, LIMITS_TABLES.tables * 2)) {
        const o = t as Record<string, unknown> | null;
        const key = s(o?.key, 40);
        const number = s(o?.number, 60);
        const capacity = s(o?.capacity, 10);
        const min = s(o?.min, 10);
        const zoneKey = s(o?.zoneKey, 40);
        if (key === null || number === null || capacity === null || min === null || zoneKey === null) return null;
        tables.push({ key, number, capacity, min, zoneKey: zones.some((z) => z.key === zoneKey) ? zoneKey : '' });
    }
    return { zones, tables };
}

/** Plus grand numéro entier déjà saisi (pour numéroter la suite). */
function nextNumber(tables: DraftTable[]): number {
    const nums = tables.map((t) => Number(t.number.trim())).filter((n) => Number.isInteger(n) && n > 0);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
}

export function TablesDraftEditor({ idPrefix, zones, tables, onChange, errors }: {
    idPrefix: string;
    zones: DraftZone[];
    tables: DraftTable[];
    onChange: (zones: DraftZone[], tables: DraftTable[]) => void;
    errors: Record<string, string>;
}) {
    const seq = useRef(0);
    const newKey = (p: string) => `${p}${Date.now().toString(36)}${(seq.current += 1)}`;
    const [quickCount, setQuickCount] = useState('5');
    const [quickCapacity, setQuickCapacity] = useState('4');
    const [quickZone, setQuickZone] = useState('');
    const [quickError, setQuickError] = useState<string | null>(null);
    const [notice, setNotice] = useState('');

    const zoneOptions = [{ value: '', label: 'Sans zone' }, ...zones.map((z) => ({ value: z.key, label: z.name.trim() || 'Zone sans nom' }))];

    const addZone = () => {
        if (zones.length >= LIMITS_TABLES.zones) return;
        const key = newKey('z');
        onChange([...zones, { key, name: '' }], tables);
        window.setTimeout(() => document.getElementById(`${idPrefix}-zone-${key}`)?.focus(), 30);
    };
    const removeZone = (key: string) => {
        onChange(zones.filter((z) => z.key !== key), tables.map((t) => (t.zoneKey === key ? { ...t, zoneKey: '' } : t)));
        setNotice('Zone retirée. Ses tables restent, sans zone.');
    };

    const addTable = () => {
        if (tables.length >= LIMITS_TABLES.tables) return;
        const key = newKey('t');
        const last = tables[tables.length - 1];
        onChange(zones, [...tables, { key, number: String(nextNumber(tables)), capacity: last?.capacity ?? '4', min: '', zoneKey: last?.zoneKey ?? '' }]);
        window.setTimeout(() => document.getElementById(`${idPrefix}-table-${key}-capacite`)?.focus(), 30);
    };
    const quickAdd = () => {
        const count = wholeNumber(quickCount);
        const capacity = wholeNumber(quickCapacity);
        if (count === null || count < 1 || count > 50) { setQuickError('Nombre de tables : de 1 à 50.'); return; }
        if (capacity === null || capacity < 1 || capacity > LIMITS_TABLES.capacity) { setQuickError('Places par table : de 1 à 50.'); return; }
        if (tables.length + count > LIMITS_TABLES.tables) { setQuickError(`${LIMITS_TABLES.tables} tables au plus : il reste ${LIMITS_TABLES.tables - tables.length} places.`); return; }
        setQuickError(null);
        const start = nextNumber(tables);
        const added = Array.from({ length: count }, (_, i) => ({ key: newKey('t'), number: String(start + i), capacity: String(capacity), min: '', zoneKey: quickZone }));
        onChange(zones, [...tables, ...added]);
        setNotice(`${count} table${count > 1 ? 's' : ''} de ${capacity} ajoutée${count > 1 ? 's' : ''}, numéros ${start} à ${start + count - 1}.`);
    };
    const setTable = (key: string, patch: Partial<DraftTable>) => onChange(zones, tables.map((t) => (t.key === key ? { ...t, ...patch } : t)));
    const removeTable = (key: string, number: string) => {
        onChange(zones, tables.filter((t) => t.key !== key));
        setNotice(`Table ${number} retirée.`);
    };
    const totalSeats = tables.reduce((s, t) => s + (wholeNumber(t.capacity) ?? 0), 0);

    return (
        <div className="flex flex-col gap-6">
            {/* Zones */}
            <div className="flex flex-col gap-3">
                <div>
                    <h3 className="text-base font-semibold text-foreground-strong">Zones <span className="font-normal text-muted-foreground">(facultatif)</span></h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">Terrasse, salle, étage, coin VIP : le client peut choisir où s’asseoir.</p>
                </div>
                {zones.length > 0 && (
                    <ul className="flex flex-col gap-2">
                        {zones.map((z, i) => (
                            <li key={z.key} className="flex items-start gap-2">
                                <TextInput
                                    id={`${idPrefix}-zone-${z.key}`}
                                    label={`Nom de la zone ${i + 1}`}
                                    hideLabel
                                    maxLength={LIMITS_TABLES.zoneName}
                                    value={z.name}
                                    placeholder="Par exemple : Terrasse"
                                    onChange={(e) => onChange(zones.map((x) => (x.key === z.key ? { ...x, name: e.target.value } : x)), tables)}
                                    error={errors[`zone:${z.key}`]}
                                    fieldClassName="min-w-0 flex-1"
                                    autoComplete="off"
                                />
                                <IconButton aria-label={`Retirer la zone ${z.name.trim() || i + 1}`} variant="danger" onClick={() => removeZone(z.key)}>
                                    <Trash2 size={18} />
                                </IconButton>
                            </li>
                        ))}
                    </ul>
                )}
                {errors.zones && <p className="text-sm font-medium text-danger-text">{errors.zones}</p>}
                {zones.length < LIMITS_TABLES.zones && (
                    <div>
                        <Button type="button" variant="secondary" size="sm" leftIcon={<Plus size={16} />} onClick={addZone}>Ajouter une zone</Button>
                    </div>
                )}
            </div>

            {/* Ajout rapide */}
            <div className="rounded-xl border border-border bg-background p-4">
                <h3 className="inline-flex items-center gap-2 text-base font-semibold text-foreground-strong">
                    <LayoutGrid size={18} aria-hidden="true" className="text-primary-text" />
                    Ajout rapide
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">Ajoutez plusieurs tables identiques d’un coup, numérotées à la suite.</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
                    <TextInput id={`${idPrefix}-rapide-nombre`} label="Tables" inputMode="numeric" value={quickCount} onChange={(e) => setQuickCount(e.target.value)} autoComplete="off" />
                    <TextInput id={`${idPrefix}-rapide-places`} label="Places chacune" inputMode="numeric" value={quickCapacity} onChange={(e) => setQuickCapacity(e.target.value)} autoComplete="off" />
                    {zones.length > 0 ? (
                        <Select id={`${idPrefix}-rapide-zone`} label="Zone" options={zoneOptions} value={quickZone} onChange={(e) => setQuickZone(e.target.value)} fieldClassName="col-span-2 sm:col-span-1" />
                    ) : <span className="hidden sm:block" aria-hidden="true" />}
                    <Button type="button" onClick={quickAdd} leftIcon={<Plus size={16} />} className="col-span-2 sm:col-span-1">
                        {`Ajouter ${wholeNumber(quickCount) ?? ''} table${(wholeNumber(quickCount) ?? 0) > 1 ? 's' : ''} de ${wholeNumber(quickCapacity) ?? ''}`.replace(/\s+/g, ' ')}
                    </Button>
                </div>
                {quickError && <p role="alert" className="mt-2 text-sm font-medium text-danger-text">{quickError}</p>}
            </div>

            {/* Tables */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground-strong">Tables</h3>
                    <p className="inline-flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
                        <Users size={14} aria-hidden="true" />
                        {`${tables.length} table${tables.length > 1 ? 's' : ''} · ${totalSeats} place${totalSeats > 1 ? 's' : ''}`}
                    </p>
                </div>
                {tables.length > 0 && (
                    <ul className="flex flex-col gap-2">
                        {tables.map((t) => (
                            <li key={t.key} className="rounded-xl border border-border bg-card p-3">
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_auto] sm:items-start">
                                    <TextInput
                                        id={`${idPrefix}-table-${t.key}-numero`}
                                        label="Numéro"
                                        maxLength={LIMITS_TABLES.number}
                                        value={t.number}
                                        onChange={(e) => setTable(t.key, { number: e.target.value })}
                                        error={errors[`table:${t.key}:number`]}
                                        autoComplete="off"
                                    />
                                    <TextInput
                                        id={`${idPrefix}-table-${t.key}-capacite`}
                                        label="Places"
                                        inputMode="numeric"
                                        value={t.capacity}
                                        onChange={(e) => setTable(t.key, { capacity: e.target.value })}
                                        error={errors[`table:${t.key}:capacity`]}
                                        autoComplete="off"
                                    />
                                    <TextInput
                                        id={`${idPrefix}-table-${t.key}-minimum`}
                                        label="Minimum"
                                        inputMode="numeric"
                                        value={t.min}
                                        placeholder="1"
                                        onChange={(e) => setTable(t.key, { min: e.target.value })}
                                        error={errors[`table:${t.key}:min`]}
                                        autoComplete="off"
                                    />
                                    {zones.length > 0 ? (
                                        <Select
                                            id={`${idPrefix}-table-${t.key}-zone`}
                                            label="Zone"
                                            options={zoneOptions}
                                            value={t.zoneKey}
                                            onChange={(e) => setTable(t.key, { zoneKey: e.target.value })}
                                        />
                                    ) : <span className="hidden sm:block" aria-hidden="true" />}
                                    <div className="flex items-end justify-end sm:self-end">
                                        <IconButton aria-label={`Retirer la table ${t.number.trim() || ''}`.trim()} variant="danger" onClick={() => removeTable(t.key, t.number.trim())}>
                                            <Trash2 size={18} />
                                        </IconButton>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
                {errors.tables && <p id={`${idPrefix}-tables-erreur`} className="text-sm font-medium text-danger-text">{errors.tables}</p>}
                {tables.length < LIMITS_TABLES.tables && (
                    <div>
                        <Button id={`${idPrefix}-table-ajout`} type="button" variant="secondary" size="sm" leftIcon={<Plus size={16} />} onClick={addTable}>Ajouter une table</Button>
                    </div>
                )}
                <p className="text-sm leading-relaxed text-muted-foreground">
                    « Minimum » : le plus petit groupe accepté à cette table (laissez vide pour 1). Vous pourrez placer les tables sur un plan de salle après la validation.
                </p>
            </div>
            <p className="sr-only" aria-live="polite">{notice}</p>
        </div>
    );
}
