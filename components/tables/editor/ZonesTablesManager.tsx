'use client';

/**
 * Lot 11b — zones et tables d'un établissement existant, enregistrées une à une par les routes existantes :
 * POST /api/partner/tables ({ type: 'zone', venue_id, name } ou { venue_id, table_number, capacity, min_capacity,
 * zone_id }), PATCH /api/partner/tables/[id] (même corps, `type: 'zone'` pour une zone ; `is_active` pour désactiver),
 * DELETE /api/partner/tables/[id] (`?type=zone` pour une zone). Une suppression refusée (élément réservé) propose
 * « Désactiver » : la table ou la zone n'est plus proposée, les réservations faites restent.
 * Chaque changement relit l'établissement (onChanged) : l'écran montre toujours ce qui est enregistré.
 */
import { useState } from 'react';
import { Check, EyeOff, LayoutGrid, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Select, TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { sendJson } from '@/components/partner/fetch-json';
import { apiMessage, wholeNumber, type OwnVenueTable, type OwnVenueZone } from './venue-api';

const API = '/api/partner/tables';

/** Erreur d'une ligne : texte de la route (déjà en français simple), proposition de désactiver si l'élément est réservé. */
interface RowError { text: string; offerDeactivate: boolean }
type Pending = { kind: 'zone' | 'table'; id: string; label: string } | null;

function tableFields(number: string, capacity: string, min: string): { error: string | null; body: { table_number: string; capacity: number; min_capacity: number } | null } {
    const num = number.trim();
    const cap = wholeNumber(capacity);
    const mn = min.trim() ? wholeNumber(min) : 1;
    if (!num) return { error: 'Indiquez le numéro de la table.', body: null };
    if (num.length > 20) return { error: 'Numéro : 20 caractères au plus.', body: null };
    if (cap === null || cap < 1 || cap > 50) return { error: 'Places : de 1 à 50.', body: null };
    if (mn === null || mn < 1 || mn > cap) return { error: 'Minimum : de 1 jusqu’au nombre de places.', body: null };
    return { error: null, body: { table_number: num, capacity: cap, min_capacity: mn } };
}

function ZoneRow({ zone, busy, error, onRename, onToggle, onDelete }: {
    zone: OwnVenueZone; busy: boolean; error: RowError | undefined;
    onRename: (name: string) => void; onToggle: () => void; onDelete: () => void;
}) {
    const [name, setName] = useState(zone.name);
    const changed = name.trim() !== zone.name && name.trim().length > 0;
    return (
        <li className={cn('rounded-xl border p-3', zone.isActive ? 'border-border bg-card' : 'border-border bg-background')}>
            <div className="flex flex-wrap items-end gap-2">
                <TextInput
                    id={`zone-${zone.id}-nom`}
                    label={zone.isActive ? 'Nom de la zone' : 'Nom de la zone (désactivée)'}
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    fieldClassName="min-w-0 flex-1 basis-48"
                    autoComplete="off"
                />
                <div className="flex items-center gap-1">
                    {changed && (
                        <Button type="button" size="sm" isLoading={busy} disabled={busy} leftIcon={<Check size={16} />} onClick={() => onRename(name.trim())}>
                            Enregistrer
                        </Button>
                    )}
                    <IconButton aria-label={zone.isActive ? `Désactiver la zone ${zone.name}` : `Réactiver la zone ${zone.name}`} variant="secondary" onClick={onToggle} disabled={busy}>
                        {zone.isActive ? <EyeOff size={18} /> : <RotateCcw size={18} />}
                    </IconButton>
                    <IconButton aria-label={`Supprimer la zone ${zone.name}`} variant="danger" onClick={onDelete} disabled={busy}>
                        <Trash2 size={18} />
                    </IconButton>
                </div>
            </div>
            {!zone.isActive && <p className="mt-2 text-sm text-muted-foreground">Zone désactivée : les clients ne peuvent plus la choisir.</p>}
            {error && <RowErrorText error={error} onDeactivate={zone.isActive ? onToggle : undefined} busy={busy} />}
        </li>
    );
}

function TableRow({ table, zones, busy, error, onSave, onToggle, onDelete }: {
    table: OwnVenueTable; zones: OwnVenueZone[]; busy: boolean; error: RowError | undefined;
    onSave: (body: Record<string, unknown>) => void; onToggle: () => void; onDelete: () => void;
}) {
    const [number, setNumber] = useState(table.number);
    const [capacity, setCapacity] = useState(String(table.capacity));
    const [min, setMin] = useState(table.minCapacity > 1 ? String(table.minCapacity) : '');
    const [zoneId, setZoneId] = useState(table.zoneId ?? '');
    const [localError, setLocalError] = useState<string | null>(null);
    const changed = number.trim() !== table.number || capacity.trim() !== String(table.capacity)
        || (min.trim() || '1') !== String(table.minCapacity || 1) || zoneId !== (table.zoneId ?? '');
    const zoneOptions = [{ value: '', label: 'Sans zone' }, ...zones.filter((z) => z.isActive || z.id === table.zoneId).map((z) => ({ value: z.id, label: z.name }))];
    const save = () => {
        const f = tableFields(number, capacity, min);
        if (!f.body) { setLocalError(f.error); return; }
        setLocalError(null);
        onSave({ ...f.body, zone_id: zoneId || null });
    };
    const id = `table-${table.id}`;
    return (
        <li className={cn('rounded-xl border p-3', table.isActive ? 'border-border bg-card' : 'border-border bg-background')}>
            {!table.isActive && (
                <div className="mb-2"><Badge variant="neutral" size="sm">Désactivée</Badge></div>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.3fr)_auto] sm:items-end">
                <TextInput id={`${id}-numero`} label="Numéro" maxLength={20} value={number} onChange={(e) => setNumber(e.target.value)} autoComplete="off" />
                <TextInput id={`${id}-places`} label="Places" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} autoComplete="off" />
                <TextInput id={`${id}-minimum`} label="Minimum" inputMode="numeric" placeholder="1" value={min} onChange={(e) => setMin(e.target.value)} autoComplete="off" />
                {zones.length > 0
                    ? <Select id={`${id}-zone`} label="Zone" options={zoneOptions} value={zoneId} onChange={(e) => setZoneId(e.target.value)} />
                    : <span className="hidden sm:block" aria-hidden="true" />}
                <div className="col-span-2 flex flex-wrap items-center justify-end gap-1 sm:col-span-1">
                    {changed && (
                        <Button type="button" size="sm" isLoading={busy} disabled={busy} leftIcon={<Check size={16} />} onClick={save}>
                            Enregistrer
                        </Button>
                    )}
                    <IconButton aria-label={table.isActive ? `Désactiver la table ${table.number}` : `Réactiver la table ${table.number}`} variant="secondary" onClick={onToggle} disabled={busy}>
                        {table.isActive ? <EyeOff size={18} /> : <RotateCcw size={18} />}
                    </IconButton>
                    <IconButton aria-label={`Supprimer la table ${table.number}`} variant="danger" onClick={onDelete} disabled={busy}>
                        <Trash2 size={18} />
                    </IconButton>
                </div>
            </div>
            {localError && <p role="alert" className="mt-2 text-sm font-medium text-danger-text">{localError}</p>}
            {error && <RowErrorText error={error} onDeactivate={table.isActive ? onToggle : undefined} busy={busy} />}
        </li>
    );
}

function RowErrorText({ error, onDeactivate, busy }: { error: RowError; onDeactivate?: () => void; busy: boolean }) {
    return (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-danger-border bg-danger-soft px-3 py-2">
            <p className="min-w-0 flex-1 basis-48 break-words text-sm font-medium text-danger-text">{error.text}</p>
            {error.offerDeactivate && onDeactivate && (
                <Button type="button" variant="secondary" size="sm" leftIcon={<EyeOff size={16} />} onClick={onDeactivate} disabled={busy}>Désactiver</Button>
            )}
        </div>
    );
}

export function ZonesTablesManager({ venueId, zones, tables, onChanged }: {
    venueId: string;
    zones: OwnVenueZone[];
    tables: OwnVenueTable[];
    onChanged: () => Promise<void> | void;
}) {
    const toast = useToast();
    const [busy, setBusy] = useState<string | null>(null);
    const [rowErrors, setRowErrors] = useState<Record<string, RowError>>({});
    const [pending, setPending] = useState<Pending>(null);
    const [newZone, setNewZone] = useState('');
    const [zoneError, setZoneError] = useState<string | null>(null);
    const [newNumber, setNewNumber] = useState('');
    const [newCapacity, setNewCapacity] = useState('4');
    const [newMin, setNewMin] = useState('');
    const [newZoneId, setNewZoneId] = useState('');
    const [addError, setAddError] = useState<string | null>(null);
    const [quickCount, setQuickCount] = useState('5');
    const [quickCapacity, setQuickCapacity] = useState('4');
    const [quickError, setQuickError] = useState<string | null>(null);
    const [progress, setProgress] = useState<string | null>(null);
    const [showInactive, setShowInactive] = useState(false);

    const activeTables = tables.filter((t) => t.isActive);
    const inactiveTables = tables.filter((t) => !t.isActive);
    const activeZones = zones.filter((z) => z.isActive);
    const zoneOptions = [{ value: '', label: 'Sans zone' }, ...activeZones.map((z) => ({ value: z.id, label: z.name }))];
    const seats = activeTables.reduce((s, t) => s + t.capacity, 0);

    const nextNumber = (): number => {
        const nums = tables.map((t) => Number(t.number)).filter((n) => Number.isInteger(n) && n > 0);
        return nums.length > 0 ? Math.max(...nums) + 1 : 1;
    };

    const clearError = (key: string) => setRowErrors((e) => {
        if (!e[key]) return e;
        const next = { ...e };
        delete next[key];
        return next;
    });

    const run = async (key: string, fn: () => Promise<unknown>, ok: string, fail: string, offerDeactivate = false): Promise<boolean> => {
        setBusy(key);
        clearError(key);
        try {
            await fn();
            await onChanged();
            toast.success(ok);
            return true;
        } catch (err) {
            setRowErrors((e) => ({ ...e, [key]: { text: apiMessage(err, fail), offerDeactivate } }));
            return false;
        } finally {
            setBusy(null);
        }
    };

    const addZone = async () => {
        const name = newZone.trim();
        if (!name) { setZoneError('Écrivez le nom de la zone.'); return; }
        if (zones.some((z) => z.name.trim().toLowerCase() === name.toLowerCase())) { setZoneError('Une zone porte déjà ce nom.'); return; }
        setZoneError(null);
        setBusy('zone:new');
        try {
            await sendJson(API, 'POST', { type: 'zone', venue_id: venueId, name });
            setNewZone('');
            await onChanged();
            toast.success(`Zone « ${name} » ajoutée.`);
        } catch (err) {
            setZoneError(apiMessage(err, 'La zone n’a pas été ajoutée. Réessayez.'));
        } finally {
            setBusy(null);
        }
    };

    const addTable = async () => {
        const f = tableFields(newNumber || String(nextNumber()), newCapacity, newMin);
        if (!f.body) { setAddError(f.error); return; }
        setAddError(null);
        setBusy('table:new');
        try {
            await sendJson(API, 'POST', { venue_id: venueId, ...f.body, zone_id: newZoneId || null });
            setNewNumber('');
            await onChanged();
            toast.success(`Table ${f.body.table_number} ajoutée.`);
        } catch (err) {
            setAddError(apiMessage(err, 'La table n’a pas été ajoutée. Réessayez.'));
        } finally {
            setBusy(null);
        }
    };

    const quickAdd = async () => {
        const count = wholeNumber(quickCount);
        const capacity = wholeNumber(quickCapacity);
        if (count === null || count < 1 || count > 50) { setQuickError('Nombre de tables : de 1 à 50.'); return; }
        if (capacity === null || capacity < 1 || capacity > 50) { setQuickError('Places par table : de 1 à 50.'); return; }
        setQuickError(null);
        setBusy('table:quick');
        const start = nextNumber();
        let done = 0;
        try {
            for (let i = 0; i < count; i += 1) {
                setProgress(`Ajout de la table ${i + 1} sur ${count}…`);
                await sendJson(API, 'POST', { venue_id: venueId, table_number: String(start + i), capacity, min_capacity: 1, zone_id: newZoneId || null });
                done += 1;
            }
            toast.success(`${count} table${count > 1 ? 's' : ''} de ${capacity} ajoutée${count > 1 ? 's' : ''}.`);
        } catch (err) {
            setQuickError(`${done > 0 ? `${done} table${done > 1 ? 's' : ''} ajoutée${done > 1 ? 's' : ''}, puis arrêt : ` : ''}${apiMessage(err, 'les tables n’ont pas été ajoutées. Réessayez.')}`);
        } finally {
            setProgress(null);
            setBusy(null);
            await onChanged();
        }
    };

    const confirmDelete = async () => {
        if (!pending) return;
        const p = pending;
        setPending(null);
        const key = `${p.kind}:${p.id}`;
        await run(
            key,
            () => sendJson(`${API}/${encodeURIComponent(p.id)}${p.kind === 'zone' ? '?type=zone' : ''}`, 'DELETE'),
            `${p.label} supprimée.`,
            `${p.label} n’a pas pu être supprimée. Si elle a des réservations, désactivez-la.`,
            true,
        );
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Zones */}
            <div className="flex flex-col gap-3">
                <div>
                    <h3 className="text-base font-semibold text-foreground-strong">Zones</h3>
                    <p className="text-sm text-muted-foreground">Terrasse, salle, étage : le client peut choisir où s’asseoir.</p>
                </div>
                {zones.length > 0 && (
                    <ul className="flex flex-col gap-2">
                        {zones.map((z) => (
                            <ZoneRow
                                key={`${z.id}:${z.name}:${z.isActive}`}
                                zone={z}
                                busy={busy === `zone:${z.id}`}
                                error={rowErrors[`zone:${z.id}`]}
                                onRename={(name) => void run(`zone:${z.id}`, () => sendJson(`${API}/${encodeURIComponent(z.id)}`, 'PATCH', { type: 'zone', name }), 'Zone renommée.', 'La zone n’a pas été renommée. Réessayez.')}
                                onToggle={() => void run(`zone:${z.id}`, () => sendJson(`${API}/${encodeURIComponent(z.id)}`, 'PATCH', { type: 'zone', is_active: !z.isActive }), z.isActive ? 'Zone désactivée.' : 'Zone réactivée.', 'Changement non enregistré. Réessayez.')}
                                onDelete={() => setPending({ kind: 'zone', id: z.id, label: `La zone « ${z.name} »` })}
                            />
                        ))}
                    </ul>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                    <TextInput
                        id="zone-nouvelle"
                        label="Nouvelle zone"
                        maxLength={80}
                        value={newZone}
                        onChange={(e) => { setNewZone(e.target.value); setZoneError(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addZone(); } }}
                        placeholder="Par exemple : Terrasse"
                        error={zoneError ?? undefined}
                        fieldClassName="min-w-0 flex-1"
                        autoComplete="off"
                    />
                    <Button type="button" variant="secondary" leftIcon={<Plus size={16} />} onClick={() => void addZone()} isLoading={busy === 'zone:new'} disabled={busy !== null} className="sm:mt-7">
                        Ajouter la zone
                    </Button>
                </div>
            </div>

            {/* Tables */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-base font-semibold text-foreground-strong">Tables</h3>
                    <p className="inline-flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
                        <Users size={14} aria-hidden="true" />
                        {`${activeTables.length} table${activeTables.length > 1 ? 's' : ''} proposée${activeTables.length > 1 ? 's' : ''} · ${seats} place${seats > 1 ? 's' : ''}`}
                    </p>
                </div>
                {activeTables.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                        {activeTables.map((t) => (
                            <TableRow
                                key={`${t.id}:${t.number}:${t.capacity}:${t.minCapacity}:${t.zoneId ?? ''}:${t.isActive}`}
                                table={t}
                                zones={zones}
                                busy={busy === `table:${t.id}`}
                                error={rowErrors[`table:${t.id}`]}
                                onSave={(body) => void run(`table:${t.id}`, () => sendJson(`${API}/${encodeURIComponent(t.id)}`, 'PATCH', body), `Table ${String(body.table_number)} enregistrée.`, 'La table n’a pas été enregistrée. Réessayez.')}
                                onToggle={() => void run(`table:${t.id}`, () => sendJson(`${API}/${encodeURIComponent(t.id)}`, 'PATCH', { is_active: false }), `Table ${t.number} désactivée.`, 'Changement non enregistré. Réessayez.')}
                                onDelete={() => setPending({ kind: 'table', id: t.id, label: `La table ${t.number}` })}
                            />
                        ))}
                    </ul>
                ) : (
                    <p className="rounded-xl border border-dashed border-input bg-background p-4 text-sm text-muted-foreground">
                        Aucune table proposée : ajoutez-en une ci-dessous pour recevoir des réservations.
                    </p>
                )}

                <div className="rounded-xl border border-border bg-background p-4">
                    <h4 className="text-base font-semibold text-foreground-strong">Ajouter une table</h4>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1.3fr)_auto] sm:items-end">
                        <TextInput id="table-nouvelle-numero" label="Numéro" maxLength={20} value={newNumber} placeholder={String(nextNumber())} onChange={(e) => setNewNumber(e.target.value)} autoComplete="off" />
                        <TextInput id="table-nouvelle-places" label="Places" inputMode="numeric" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} autoComplete="off" />
                        <TextInput id="table-nouvelle-minimum" label="Minimum" inputMode="numeric" placeholder="1" value={newMin} onChange={(e) => setNewMin(e.target.value)} autoComplete="off" />
                        {activeZones.length > 0
                            ? <Select id="table-nouvelle-zone" label="Zone" options={zoneOptions} value={newZoneId} onChange={(e) => setNewZoneId(e.target.value)} />
                            : <span className="hidden sm:block" aria-hidden="true" />}
                        <Button type="button" leftIcon={<Plus size={16} />} onClick={() => void addTable()} isLoading={busy === 'table:new'} disabled={busy !== null} className="col-span-2 sm:col-span-1">
                            Ajouter
                        </Button>
                    </div>
                    {addError && <p role="alert" className="mt-2 text-sm font-medium text-danger-text">{addError}</p>}

                    <div className="mt-4 border-t border-border pt-4">
                        <p className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-strong">
                            <LayoutGrid size={16} aria-hidden="true" className="text-primary-text" />
                            Ajout rapide, numéros à la suite{activeZones.length > 0 ? ', dans la zone choisie ci-dessus' : ''}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                            <TextInput id="table-rapide-nombre" label="Tables" inputMode="numeric" value={quickCount} onChange={(e) => setQuickCount(e.target.value)} autoComplete="off" />
                            <TextInput id="table-rapide-places" label="Places chacune" inputMode="numeric" value={quickCapacity} onChange={(e) => setQuickCapacity(e.target.value)} autoComplete="off" />
                            <Button type="button" variant="secondary" leftIcon={<Plus size={16} />} onClick={() => void quickAdd()} isLoading={busy === 'table:quick'} disabled={busy !== null} className="col-span-2 sm:col-span-1">
                                {`Ajouter ${wholeNumber(quickCount) ?? ''} table${(wholeNumber(quickCount) ?? 0) > 1 ? 's' : ''} de ${wholeNumber(quickCapacity) ?? ''}`.replace(/\s+/g, ' ')}
                            </Button>
                        </div>
                        <p className="sr-only" aria-live="polite">{progress ?? ''}</p>
                        {progress && <p className="mt-2 text-sm text-muted-foreground" aria-hidden="true">{progress}</p>}
                        {quickError && <p role="alert" className="mt-2 break-words text-sm font-medium text-danger-text">{quickError}</p>}
                    </div>
                </div>

                {inactiveTables.length > 0 && (
                    <div className="flex flex-col gap-2">
                        <Button type="button" variant="ghost" size="sm" aria-expanded={showInactive} onClick={() => setShowInactive((s) => !s)} className="self-start">
                            {showInactive ? 'Masquer les tables désactivées' : `Voir les tables désactivées (${inactiveTables.length})`}
                        </Button>
                        {showInactive && (
                            <ul className="flex flex-col gap-2">
                                {inactiveTables.map((t) => (
                                    <TableRow
                                        key={`${t.id}:${t.number}:${t.capacity}:${t.minCapacity}:${t.zoneId ?? ''}:${t.isActive}`}
                                        table={t}
                                        zones={zones}
                                        busy={busy === `table:${t.id}`}
                                        error={rowErrors[`table:${t.id}`]}
                                        onSave={(body) => void run(`table:${t.id}`, () => sendJson(`${API}/${encodeURIComponent(t.id)}`, 'PATCH', body), `Table ${String(body.table_number)} enregistrée.`, 'La table n’a pas été enregistrée. Réessayez.')}
                                        onToggle={() => void run(`table:${t.id}`, () => sendJson(`${API}/${encodeURIComponent(t.id)}`, 'PATCH', { is_active: true }), `Table ${t.number} réactivée.`, 'Changement non enregistré. Réessayez.')}
                                        onDelete={() => setPending({ kind: 'table', id: t.id, label: `La table ${t.number}` })}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            <ConfirmDialog
                isOpen={pending !== null}
                onClose={() => setPending(null)}
                onConfirm={() => void confirmDelete()}
                title={pending?.kind === 'zone' ? 'Supprimer cette zone ?' : 'Supprimer cette table ?'}
                message={pending?.kind === 'zone'
                    ? `${pending.label} sera supprimée. Ses tables restent, sans zone. Pour la retirer sans rien supprimer, désactivez-la.`
                    : `${pending?.label ?? 'La table'} sera supprimée. Une table qui a des réservations ne peut pas l’être : désactivez-la plutôt, elle ne sera plus proposée.`}
                confirmLabel="Supprimer"
                cancelLabel="Garder"
                variant="danger"
            />
        </div>
    );
}
