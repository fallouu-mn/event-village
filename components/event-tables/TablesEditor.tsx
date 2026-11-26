'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Armchair, Copy, ListOrdered, Lock, Map as MapIcon, Pencil, Plus, Rows3, Save, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select, TextInput } from '@/components/ui/Field';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { ApiError, errorMessage, fetchJson, sendJson } from '@/components/partner/fetch-json';
import { formatFcfa, formatInteger, formatShortDate } from '@/lib/format';
import { SeatsGauge } from './SeatsGauge';
import { TableTypeDialog } from './TableTypeDialog';
import { PlanWorkbench, type DraftTable, type DraftZone } from './PlanWorkbench';
import { nextFreeNumber, renumber } from './plan-templates';
import { plural, STATE_LABEL, type TableTypeRow, type TablesReport } from './types';

/**
 * Lot 11c-c — onglet « Tables » de la billetterie (organisatrice) : types de tables, tables numérotées, zones d'accès,
 * plan facultatif et jauge en places. Tout vient de GET …/tables/report ; chaque écriture passe par les routes du lot
 * 11c-a (types : POST, PATCH, DELETE ; tables, zones et plan montré : PUT tout ou rien), puis tout est relu. Les refus du
 * serveur s'affichent tels quels.
 * États : prix et places figés après la première vente ou attente (champs verrouillés, raison écrite) ; table vendue ou
 * en paiement : numéro et type verrouillés, jamais retirée ; lecture seule si le serveur refuse les écritures
 * (edit_refusal : en attente de validation, fiche ou événement suspendu, terminé, annulé, service fermé).
 */

export interface TablesEditorProps {
    eventId: string;
    report: TablesReport;
    reload: () => Promise<void>;
    /** Changements non enregistrés (garde de sortie du formulaire). */
    onDirtyChange?: (labels: string[]) => void;
}

let seq = 0;
const newKey = () => `nt${++seq}`;

function draftFrom(report: TablesReport): { tables: DraftTable[]; zones: DraftZone[]; plan: boolean } {
    return {
        tables: report.tables.map((t) => ({ key: t.id, id: t.id, number: t.number, type_id: t.type_id, zone_id: t.zone_id, x: t.x === null ? null : Number(t.x), y: t.y === null ? null : Number(t.y), shape: t.shape, rotation: t.rotation, state: t.state, ever_sold: t.ever_sold })),
        zones: report.zones.map((z) => ({ id: z.id, name: z.name, x: z.x === null ? null : Number(z.x), y: z.y === null ? null : Number(z.y), w: z.w === null ? null : Number(z.w), h: z.h === null ? null : Number(z.h) })),
        plan: report.plan_enabled,
    };
}

const signature = (d: { tables: DraftTable[]; zones: DraftZone[]; plan: boolean }) =>
    JSON.stringify([d.plan, d.tables.map((t) => [t.id, t.number, t.type_id, t.zone_id, t.x, t.y, t.shape, t.rotation]), d.zones.map((z) => [z.id, z.x, z.y, z.w, z.h])]);

/** Table qui ne change plus de numéro ni de type, et ne se retire pas (vendue, en paiement, ou déjà vendue une fois). */
const isFixed = (t: DraftTable) => t.state !== 'LIBRE' || t.ever_sold;

export function TablesEditor({ eventId, report, reload, onDirtyChange }: TablesEditorProps) {
    const toast = useToast();
    const [draft, setDraft] = useState(() => draftFrom(report));
    const baseline = useRef(signature(draftFrom(report)));
    const [view, setView] = useState<'plan' | 'liste'>('plan');
    const [dialog, setDialog] = useState<{ open: boolean; type: TableTypeRow | null }>({ open: false, type: null });
    const [toDelete, setToDelete] = useState<TableTypeRow | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [addType, setAddType] = useState<string>('');
    const [copyFrom, setCopyFrom] = useState<string>('');

    const dirty = signature(draft) !== baseline.current;
    const readOnly = report.edit_refusal !== null;
    const typeById = useMemo(() => new Map(report.types.map((t) => [t.id, t])), [report.types]);

    // Relecture du serveur : le brouillon repart de la réponse, sauf s'il porte des changements non enregistrés
    useEffect(() => {
        const fresh = draftFrom(report);
        const previous = baseline.current;
        baseline.current = signature(fresh);
        setDraft((current) => (signature(current) === previous ? fresh : current));
    }, [report]);

    useEffect(() => {
        onDirtyChange?.(dirty ? ['Tables et plan'] : []);
    }, [dirty, onDirtyChange]);
    useEffect(() => () => onDirtyChange?.([]), [onDirtyChange]);

    const patchTable = (key: string, patch: Partial<DraftTable>) => {
        setSaveError(null);
        setDraft((d) => ({ ...d, tables: d.tables.map((t) => (t.key === key ? { ...t, ...patch } : t)) }));
    };

    const save = async () => {
        setBusy('save');
        setSaveError(null);
        try {
            await fetchJson(`/api/partner/events/${eventId}/tables`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_enabled: draft.plan,
                    tables: draft.tables.map((t) => ({ id: t.id, type_id: t.type_id, number: t.number, zone_id: t.zone_id, x: t.x, y: t.y, shape: t.shape, rotation: t.rotation })),
                    zones: draft.zones.map((z) => ({ id: z.id, x: z.x, y: z.y, w: z.w, h: z.h })),
                }),
            });
            baseline.current = signature(draft);
            toast.success('Tables et plan enregistrés.');
            await reload();
        } catch (err) {
            setSaveError(errorMessage(err, 'Enregistrement des tables impossible pour le moment.'));
        } finally {
            setBusy(null);
        }
    };

    const cancel = () => {
        setSaveError(null);
        setDraft(draftFrom(report));
    };

    const afterTypeSaved = useCallback(async (message: string) => {
        setDialog({ open: false, type: null });
        toast.success(message);
        await reload();
    }, [reload, toast]);

    const toggleSale = async (t: TableTypeRow) => {
        setBusy(`vente-${t.id}`);
        try {
            await sendJson(`/api/partner/events/${eventId}/tables/types/${t.id}`, 'PATCH', { is_active: !t.is_active });
            toast.success(t.is_active ? `Vente de « ${t.name} » arrêtée.` : `« ${t.name} » remis en vente.`);
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Changement impossible pour le moment.'));
        } finally {
            setBusy(null);
        }
    };

    const removeType = async () => {
        if (!toDelete) return;
        setBusy(`suppr-${toDelete.id}`);
        try {
            await sendJson(`/api/partner/events/${eventId}/tables/types/${toDelete.id}`, 'DELETE');
            toast.success(`Type « ${toDelete.name} » retiré avec ses tables.`);
            setToDelete(null);
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Suppression impossible pour le moment.'));
        } finally {
            setBusy(null);
        }
    };

    const copyTables = async () => {
        if (!copyFrom) return;
        setBusy('copie');
        try {
            const r = await sendJson<{ types: number; tables: number }>(`/api/partner/events/${eventId}/tables/copy`, 'POST', { from_event_id: copyFrom });
            toast.success(`${formatInteger(r.tables)} tables copiées (${r.types === 1 ? '1 type' : `${formatInteger(r.types)} types`}). Vérifiez les prix avant la vente.`);
            await reload();
        } catch (err) {
            toast.error(err instanceof ApiError ? err.message : errorMessage(err, 'Copie impossible pour le moment.'));
        } finally {
            setBusy(null);
        }
    };

    const addTable = () => {
        const typeId = addType || report.types[0]?.id;
        if (!typeId) return;
        const number = nextFreeNumber(draft.tables.map((t) => t.number));
        if (number === null) {
            setSaveError('Les numéros de 1 à 999 sont tous pris.');
            return;
        }
        setDraft((d) => ({ ...d, tables: [...d.tables, { key: newKey(), id: null, number, type_id: typeId, zone_id: null, x: null, y: null, shape: 'RONDE', rotation: 0, state: 'LIBRE', ever_sold: false }] }));
    };

    const renumberAll = () => {
        const order = [...draft.tables].sort((a, b) => (a.y ?? 999) - (b.y ?? 999) || (a.x ?? 999) - (b.x ?? 999) || a.number - b.number);
        const map = renumber(order.map((t) => ({ key: t.key, number: t.number, fixed: isFixed(t) })));
        setDraft((d) => ({ ...d, tables: d.tables.map((t) => ({ ...t, number: map.get(t.key) ?? t.number })) }));
    };

    const sources = report.copy_sources ?? [];
    const zoneOptions = [{ value: '', label: 'Aucune zone' }, ...report.zones.map((z) => ({ value: z.id, label: z.name }))];

    return (
        <div className="flex flex-col gap-6" data-tables-editeur="">
            <SeatsGauge gauge={report.gauge} />

            {readOnly && report.edit_refusal && (
                <StatusBanner tone={report.edit_refusal.code === 'WITHDRAW_TO_EDIT' ? 'warning' : report.edit_refusal.code === 'EVENT_SUSPENDED' || report.edit_refusal.code === 'PARTNER_SUSPENDED' ? 'suspended' : 'neutral'}
                    title="Tables en lecture seule" icon={<Lock size={20} />}>
                    {report.edit_refusal.message}
                </StatusBanner>
            )}

            <section aria-labelledby="types-titre" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 id="types-titre" className="text-lg font-bold text-foreground-strong">Types de tables</h3>
                    {!readOnly && report.types.length > 0 && (
                        <Button variant="secondary" leftIcon={<Plus size={18} />} onClick={() => setDialog({ open: true, type: null })}>Ajouter un type</Button>
                    )}
                </div>

                {report.types.length === 0 ? (
                    <div className="flex flex-col gap-3">
                        <EmptyState
                            illustrated
                            title="Créez votre premier type de table"
                            description="Par exemple « Carré VIP » : 6 places, 150 000 F la table, une bouteille comprise. Chaque invité recevra son billet."
                            actionLabel={readOnly ? undefined : 'Créer un type de table'}
                            onAction={readOnly ? undefined : () => setDialog({ open: true, type: null })}
                            className="my-0"
                        />
                        {!readOnly && sources.length > 0 && (
                            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-[1fr_auto] md:items-end">
                                <Select id="copie-source" label="Ou reprendre les tables d’un événement précédent" value={copyFrom} placeholder="Choisir un événement"
                                    onChange={(e) => setCopyFrom(e.target.value)}
                                    options={sources.map((s) => ({ value: s.event_id, label: `${s.title}${s.start_at ? ` (${formatShortDate(s.start_at)})` : ''} — ${formatInteger(s.tables)} tables` }))}
                                    hint="Types, numéros et positions sont copiés ; les zones d’accès, propres à chaque événement, ne le sont pas." />
                                <Button variant="secondary" leftIcon={<Copy size={18} />} onClick={() => void copyTables()} disabled={!copyFrom} isLoading={busy === 'copie'}>Copier</Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {report.types.map((t) => (
                            <li key={t.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 animate-in fade-in" data-type-table={t.name}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="break-words text-base font-bold text-foreground-strong">{t.name}</p>
                                        <p className="text-sm tabular-nums text-muted-foreground">
                                            {formatInteger(t.seats)} places · {t.total_tables === 1 ? '1 table' : `${formatInteger(t.total_tables)} tables`} · {formatInteger(t.type_seats)} places en tout
                                        </p>
                                    </div>
                                    <Badge variant={t.is_active ? 'success' : 'neutral'}>{t.is_active ? 'En vente' : 'Vente arrêtée'}</Badge>
                                </div>
                                <p className="text-base text-foreground-strong">
                                    <span className="text-xl font-bold tabular-nums">{formatFcfa(t.price)}</span> la table,
                                    <span className="tabular-nums text-muted-foreground"> soit {formatFcfa(t.price_per_person)} par personne{t.price_per_person_exact ? '' : ' (arrondi)'}</span>
                                </p>
                                {(t.included_text || t.onsite_note) && (
                                    <dl className="grid grid-cols-1 gap-1 text-sm">
                                        {t.included_text && <div><dt className="inline font-semibold text-foreground-strong">Compris : </dt><dd className="inline break-words text-foreground">{t.included_text}</dd></div>}
                                        {t.onsite_note && <div><dt className="inline font-semibold text-foreground-strong">Sur place : </dt><dd className="inline break-words text-foreground">{t.onsite_note}</dd></div>}
                                    </dl>
                                )}
                                <p className="text-sm tabular-nums text-foreground">
                                    {formatInteger(t.sold_tables)} {plural(t.sold_tables, 'vendue', 'vendues')} · {formatInteger(t.held_tables)} en paiement · {formatInteger(t.free_tables)} {plural(t.free_tables, 'libre', 'libres')}
                                </p>
                                {t.locked && (
                                    <p className="inline-flex items-start gap-1.5 text-sm text-muted-foreground"><Lock size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />Prix et places figés : une table est vendue ou en cours de paiement.</p>
                                )}
                                {!readOnly && (
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" variant="secondary" leftIcon={<Pencil size={16} />} onClick={() => setDialog({ open: true, type: t })}>Modifier</Button>
                                        <Button size="sm" variant="ghost" onClick={() => void toggleSale(t)} isLoading={busy === `vente-${t.id}`}>
                                            {t.is_active ? 'Arrêter la vente' : 'Remettre en vente'}
                                        </Button>
                                        {!t.ever_sold && !t.locked && (
                                            <Button size="sm" variant="ghost" className="text-danger-text" leftIcon={<Trash2 size={16} />} onClick={() => setToDelete(t)}>Retirer</Button>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {report.types.length > 0 && (
                <section aria-labelledby="tables-titre" className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 id="tables-titre" className="text-lg font-bold text-foreground-strong">Tables et plan</h3>
                        <p className="text-sm tabular-nums text-muted-foreground">{report.totals.tables === 1 ? '1 table enregistrée' : `${formatInteger(report.totals.tables)} tables enregistrées`}</p>
                    </div>
                    <Tabs
                        tabs={[{ id: 'plan', label: 'Plan' }, { id: 'liste', label: 'Liste et numéros' }]}
                        value={view}
                        onChange={(id) => setView(id as 'plan' | 'liste')}
                        ariaLabel="Vue des tables"
                        idPrefix="tables-vue"
                    />
                    <TabPanel idPrefix="tables-vue" tabIdValue={view}>
                        {view === 'plan' ? (
                            <PlanWorkbench
                                tables={draft.tables}
                                zones={draft.zones}
                                types={report.types}
                                readOnly={readOnly}
                                planEnabled={draft.plan}
                                onChange={(tables, zones) => { setSaveError(null); setDraft((d) => ({ ...d, tables, zones })); }}
                                onPlanEnabledChange={(plan) => { setSaveError(null); setDraft((d) => ({ ...d, plan })); }}
                            />
                        ) : (
                            <div className="flex flex-col gap-3">
                                {!readOnly && (
                                    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-end">
                                        <Select id="ajout-type" label="Ajouter une table du type" value={addType || report.types[0]?.id}
                                            onChange={(e) => setAddType(e.target.value)} options={report.types.map((t) => ({ value: t.id, label: t.name }))} fieldClassName="md:flex-1" />
                                        <Button variant="secondary" leftIcon={<Plus size={18} />} onClick={addTable}>Ajouter une table</Button>
                                        <Button variant="ghost" leftIcon={<ListOrdered size={18} />} onClick={renumberAll}>Renuméroter</Button>
                                    </div>
                                )}
                                {!readOnly && (
                                    <p className="text-sm text-muted-foreground">« Renuméroter » range les tables de haut en bas puis de gauche à droite sur le plan ; une table vendue garde son numéro.</p>
                                )}
                                <ul className="flex flex-col gap-2" aria-label="Tables de l’événement">
                                    {[...draft.tables].sort((a, b) => a.number - b.number).map((t) => {
                                        const fixed = isFixed(t);
                                        const reason = fixed ? (t.state === 'LIBRE' ? 'Déjà vendue une fois : gardée.' : `${STATE_LABEL[t.state]} : numéro et type figés.`) : null;
                                        return (
                                            <li key={t.key} className="grid grid-cols-[5.5rem_1fr] items-end gap-3 rounded-2xl border border-border bg-card p-3 md:grid-cols-[6rem_1fr_1fr_auto_auto]" data-table-ligne={t.number}>
                                                <TextInput id={`num-${t.key}`} type="number" inputMode="numeric" min={1} max={999} label="N°" value={String(t.number)}
                                                    disabled={readOnly || fixed}
                                                    onChange={(e) => { const n = Number(e.target.value); if (Number.isInteger(n)) patchTable(t.key, { number: n }); }} />
                                                <Select id={`type-${t.key}`} label="Type" value={t.type_id} disabled={readOnly || fixed}
                                                    onChange={(e) => patchTable(t.key, { type_id: e.target.value })} options={report.types.map((x) => ({ value: x.id, label: x.name }))} />
                                                <Select id={`zone-${t.key}`} label="Zone d’accès" value={t.zone_id ?? ''} disabled={readOnly}
                                                    onChange={(e) => patchTable(t.key, { zone_id: e.target.value || null })} options={zoneOptions} fieldClassName="col-span-2 md:col-span-1" />
                                                <div className="flex min-h-12 items-center">
                                                    <Badge variant={t.state === 'VENDUE' ? 'info' : t.state === 'EN_ATTENTE' ? 'warning' : 'success'}>{STATE_LABEL[t.state]}</Badge>
                                                </div>
                                                <div className="flex min-h-12 items-center justify-end">
                                                    {!readOnly && !fixed && (
                                                        <IconButton aria-label={`Retirer la table ${t.number}`} variant="danger"
                                                            onClick={() => setDraft((d) => ({ ...d, tables: d.tables.filter((x) => x.key !== t.key) }))}>
                                                            <Trash2 size={18} />
                                                        </IconButton>
                                                    )}
                                                </div>
                                                {reason && <p className="col-span-2 text-sm text-muted-foreground md:col-span-5">{reason}</p>}
                                                {!fixed && typeById.get(t.type_id) === undefined && <p className="col-span-2 text-sm text-danger-text">Type inconnu : rechargez la page.</p>}
                                            </li>
                                        );
                                    })}
                                </ul>
                                {draft.tables.length === 0 && (
                                    <EmptyState icon={<Armchair size={28} />} title="Aucune table" description="Ajoutez une table à un type pour commencer." className="my-0" />
                                )}
                            </div>
                        )}
                    </TabPanel>

                    {(dirty || saveError) && !readOnly && (
                        <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-border bg-popover p-4 shadow-lg animate-in zoom-in-95 sm:flex-row sm:items-center sm:justify-between" role="region" aria-label="Enregistrer les tables">
                            <div className="min-w-0">
                                {saveError ? (
                                    <p role="alert" className="text-sm font-medium text-danger-text">{saveError}</p>
                                ) : (
                                    <p className="text-sm font-medium text-foreground-strong">Changements non enregistrés sur les tables et le plan.</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" leftIcon={<Undo2 size={18} />} onClick={cancel} disabled={busy === 'save'}>Annuler</Button>
                                <Button variant="primary" leftIcon={<Save size={18} />} onClick={() => void save()} isLoading={busy === 'save'} disabled={!dirty}>Enregistrer les tables</Button>
                            </div>
                        </div>
                    )}
                </section>
            )}

            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                {view === 'plan' ? <MapIcon size={16} aria-hidden="true" /> : <Rows3 size={16} aria-hidden="true" />}
                Aucune commission sur les tables. Le client paie la table en entier, plus les frais de service habituels ; chaque invité reçoit son billet.
            </p>

            <TableTypeDialog
                eventId={eventId}
                open={dialog.open}
                type={dialog.type}
                onClose={() => setDialog({ open: false, type: null })}
                onSaved={(m) => void afterTypeSaved(m)}
            />
            <ConfirmDialog
                isOpen={toDelete !== null}
                onClose={() => setToDelete(null)}
                onConfirm={() => void removeType()}
                title="Retirer ce type de table ?"
                message={toDelete ? `« ${toDelete.name} » et ses ${formatInteger(toDelete.total_tables)} tables seront retirés. Aucune n’a été vendue.` : undefined}
                confirmLabel="Retirer"
                variant="danger"
                isLoading={busy !== null && busy.startsWith('suppr-')}
            />
        </div>
    );
}
