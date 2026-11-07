'use client';

import React, { useState } from 'react';
import { AlertTriangle, Lock, Plus, Ticket, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TextInput, Textarea } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { CATEGORY_CHANNEL_HELP, categoryChannelLabel } from '@/lib/events/category-channels';
import { formatInteger, toDakarDateTimeLocal } from '@/lib/format';
import { DEFAULT_MAX_PER_ORDER, EVENT_LIMITS } from '@/lib/validations/event';

/**
 * Lot 5 (contrats F1, F4, F6) — billetterie du formulaire d'événement.
 *  - CategoryFields : champs d'une catégorie de billets, partagés par la création (envoyés avec l'événement)
 *    et par l'édition ;
 *  - EventTicketingManager : en édition, chaque catégorie s'enregistre par les routes dédiées
 *    (POST /categories, PATCH et DELETE /categories/[categoryId]) avec les verrous visibles
 *    (« Prix verrouillé : 12 billets vendus ») et les refus du serveur affichés près de leur champ.
 */

export type Row = Record<string, unknown>;

export const CATEGORY_FIELDS = [
    'name', 'description', 'price', 'total_quantity', 'max_per_order', 'sale_start', 'sale_end', 'sale_online', 'sale_counter', 'is_active',
] as const;
export type CategoryField = (typeof CATEGORY_FIELDS)[number];

export const CATEGORY_FIELD_LABELS: Record<CategoryField, string> = {
    name: 'Nom de la catégorie',
    description: 'Détail affiché aux acheteurs',
    price: 'Prix (F CFA)',
    total_quantity: 'Quantité mise en vente',
    max_per_order: 'Maximum de billets par commande',
    sale_start: 'Début de la vente',
    sale_end: 'Fin de la vente',
    sale_online: 'Vendue en ligne',
    sale_counter: 'Vendue au guichet',
    is_active: 'Catégorie active',
};

export interface CategoryDraft {
    /** Clé stable de l'interface (identifiants des champs, erreurs). */
    key: string;
    /** Identifiant en base (null tant que la catégorie n'est pas créée). */
    id: string | null;
    name: string;
    description: string;
    price: string;
    total_quantity: string;
    max_per_order: string;
    sale_start: string;
    sale_end: string;
    sale_online: boolean;
    sale_counter: boolean;
    is_active: boolean;
    /** Billets vendus et réservés en cours de paiement (lus en base, jamais calculés ici). */
    sold: number;
    held: number;
}

export type CategoryErrors = Partial<Record<CategoryField, string>>;

let keySeq = 0;
/** Clé locale unique (identifiants de champs). */
export function localKey(prefix: string): string {
    keySeq += 1;
    return `${prefix}${keySeq}`;
}

export function categoryFieldId(key: string, field: CategoryField): string {
    return `billet-${key}-${field}`;
}

export function newCategoryDraft(): CategoryDraft {
    return {
        key: localKey('c'),
        id: null,
        name: '',
        description: '',
        price: '',
        total_quantity: '',
        max_per_order: String(DEFAULT_MAX_PER_ORDER),
        sale_start: '',
        sale_end: '',
        sale_online: true,
        sale_counter: true,
        is_active: true,
        sold: 0,
        held: 0,
    };
}

function text(v: unknown): string {
    return typeof v === 'string' ? v : '';
}

function count(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function numberText(v: unknown): string {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : '';
}

/** Catégorie lue en base (GET de l'événement, réponse des routes) → valeurs du formulaire. */
export function categoryDraftFromRow(row: Row, key?: string): CategoryDraft {
    return {
        key: key ?? localKey('c'),
        id: typeof row.id === 'string' ? row.id : null,
        name: text(row.name),
        description: text(row.description),
        price: numberText(row.price),
        total_quantity: numberText(row.total_quantity),
        max_per_order: numberText(row.max_per_order) || String(DEFAULT_MAX_PER_ORDER),
        sale_start: row.sale_start ? toDakarDateTimeLocal(String(row.sale_start)) : '',
        sale_end: row.sale_end ? toDakarDateTimeLocal(String(row.sale_end)) : '',
        sale_online: row.sale_online !== false,
        sale_counter: row.sale_counter !== false,
        is_active: row.is_active !== false,
        sold: count(row.sold_quantity),
        held: count(row.held_quantity),
    };
}

/** Saisie numérique : vide → absent (le schéma répond « obligatoire »), sinon nombre (entier contrôlé par le schéma). */
export function numberInput(raw: string): number | undefined {
    const cleaned = raw.replace(/\s/g, '').replace(',', '.');
    if (cleaned === '') return undefined;
    return Number(cleaned);
}

/** Corps d'une catégorie pour la création (avec l'événement ou par POST /categories). */
export function categoryCreateBody(d: CategoryDraft): Row {
    return {
        name: d.name,
        description: d.description.trim() === '' ? null : d.description,
        price: numberInput(d.price),
        total_quantity: numberInput(d.total_quantity),
        max_per_order: numberInput(d.max_per_order),
        sale_start: d.sale_start === '' ? null : d.sale_start,
        sale_end: d.sale_end === '' ? null : d.sale_end,
        sale_online: d.sale_online,
        sale_counter: d.sale_counter,
        is_active: d.is_active,
    };
}

/** Champs modifiés d'une catégorie existante (PATCH) : seul ce qui a changé est envoyé. */
export function categoryPatch(d: CategoryDraft, base: CategoryDraft): Row {
    const next = categoryCreateBody(d);
    const before = categoryCreateBody(base);
    const patch: Row = {};
    for (const field of CATEGORY_FIELDS) {
        if (JSON.stringify(next[field]) !== JSON.stringify(before[field])) patch[field] = next[field];
    }
    return patch;
}

function hasSales(d: CategoryDraft): boolean {
    return d.sold > 0 || d.held > 0;
}

function plural(n: number, one: string, many: string): string {
    return `${formatInteger(n)} ${n > 1 ? many : one}`;
}

/** Texte du verrou de prix : « Prix verrouillé : 12 billets vendus ». */
export function priceLockText(d: CategoryDraft): string {
    const parts: string[] = [];
    if (d.sold > 0) parts.push(plural(d.sold, 'billet vendu', 'billets vendus'));
    if (d.held > 0) parts.push(plural(d.held, 'billet en cours de paiement', 'billets en cours de paiement'));
    return `Prix verrouillé : ${parts.join(', ')}. Créez une autre catégorie pour un nouveau tarif.`;
}

// ── Champs d'une catégorie ─────────────────────────────────────────────────

interface CategoryFieldsProps {
    draft: CategoryDraft;
    onChange: (next: CategoryDraft) => void;
    errors?: CategoryErrors;
    disabled?: boolean;
    /** Affiche les verrous liés aux ventes (édition). */
    showLocks?: boolean;
}

export function CategoryFields({ draft, onChange, errors = {}, disabled = false, showLocks = false }: CategoryFieldsProps) {
    const set = <K extends keyof CategoryDraft>(field: K, value: CategoryDraft[K]) => onChange({ ...draft, [field]: value });
    const priceLocked = showLocks && draft.id !== null && hasSales(draft);
    const id = (field: CategoryField) => categoryFieldId(draft.key, field);

    const quotaHint = showLocks && hasSales(draft)
        ? `Jamais sous les ventes : ${plural(draft.sold, 'billet vendu', 'billets vendus')}, ${formatInteger(draft.held)} en cours de paiement.`
        : 'Nombre de billets de cette catégorie (1 à 100 000).';

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
                id={id('name')}
                label={CATEGORY_FIELD_LABELS.name}
                required
                maxLength={EVENT_LIMITS.categoryNameMax}
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Par exemple : Standard, VIP, Étudiant"
                error={errors.name}
                disabled={disabled}
                fieldClassName="sm:col-span-2"
            />
            <TextInput
                id={id('price')}
                label={CATEGORY_FIELD_LABELS.price}
                required
                type="number"
                inputMode="numeric"
                min={0}
                max={EVENT_LIMITS.priceMax}
                step={1}
                value={draft.price}
                onChange={(e) => set('price', e.target.value)}
                hint={priceLocked ? undefined : 'Montant entier ; 0 pour une entrée gratuite.'}
                error={errors.price}
                disabled={disabled || priceLocked}
                aside={priceLocked ? <Lock size={16} aria-hidden="true" /> : undefined}
            />
            <TextInput
                id={id('total_quantity')}
                label={CATEGORY_FIELD_LABELS.total_quantity}
                required
                type="number"
                inputMode="numeric"
                min={1}
                max={EVENT_LIMITS.quotaMax}
                step={1}
                value={draft.total_quantity}
                onChange={(e) => set('total_quantity', e.target.value)}
                hint={quotaHint}
                error={errors.total_quantity}
                disabled={disabled}
            />
            {priceLocked && (
                <p className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-bg px-3 py-2 text-sm font-medium text-warning-fg sm:col-span-2">
                    <Lock size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>{priceLockText(draft)}</span>
                </p>
            )}
            <TextInput
                id={id('max_per_order')}
                label={CATEGORY_FIELD_LABELS.max_per_order}
                type="number"
                inputMode="numeric"
                min={1}
                max={EVENT_LIMITS.maxPerOrderMax}
                step={1}
                value={draft.max_per_order}
                onChange={(e) => set('max_per_order', e.target.value)}
                hint="De 1 à 50 billets."
                error={errors.max_per_order}
                disabled={disabled}
                fieldClassName="sm:col-span-2"
            />
            <TextInput
                id={id('sale_start')}
                label={CATEGORY_FIELD_LABELS.sale_start}
                type="datetime-local"
                value={draft.sale_start}
                onChange={(e) => set('sale_start', e.target.value)}
                hint="Heure de Dakar. Vide : en vente dès la publication."
                error={errors.sale_start}
                disabled={disabled}
            />
            <TextInput
                id={id('sale_end')}
                label={CATEGORY_FIELD_LABELS.sale_end}
                type="datetime-local"
                value={draft.sale_end}
                onChange={(e) => set('sale_end', e.target.value)}
                hint="Heure de Dakar. Au plus tard à la fin de l’événement."
                error={errors.sale_end}
                disabled={disabled}
            />
            <Textarea
                id={id('description')}
                label={CATEGORY_FIELD_LABELS.description}
                rows={2}
                maxLength={EVENT_LIMITS.categoryDescriptionMax}
                showCount
                value={draft.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="Par exemple : accès à la zone devant la scène"
                error={errors.description}
                disabled={disabled}
                fieldClassName="sm:col-span-2"
            />
            <fieldset className="flex min-w-0 flex-col gap-3 sm:col-span-2">
                <legend className="text-sm font-semibold text-fg">Où vendre cette catégorie</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <ToggleField
                        id={id('sale_online')}
                        label={CATEGORY_FIELD_LABELS.sale_online}
                        hint={CATEGORY_CHANNEL_HELP.online}
                        checked={draft.sale_online}
                        onChange={(v) => set('sale_online', v)}
                        disabled={disabled}
                        error={errors.sale_online}
                    />
                    <ToggleField
                        id={id('sale_counter')}
                        label={CATEGORY_FIELD_LABELS.sale_counter}
                        hint={CATEGORY_CHANNEL_HELP.counter}
                        checked={draft.sale_counter}
                        onChange={(v) => set('sale_counter', v)}
                        disabled={disabled}
                        error={errors.sale_counter}
                    />
                </div>
                <p className="text-sm text-fg">
                    <span className="text-fg-muted">Résultat : </span>
                    <span className="font-semibold">{categoryChannelLabel(draft)}</span>
                </p>
                {!draft.sale_online && !draft.sale_counter && (
                    <p className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-bg px-3 py-2 text-sm font-medium text-warning-fg">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>{CATEGORY_CHANNEL_HELP.none}</span>
                    </p>
                )}
            </fieldset>
            <div className="sm:col-span-2">
                <ToggleField
                    id={id('is_active')}
                    label={CATEGORY_FIELD_LABELS.is_active}
                    checked={draft.is_active}
                    onChange={(v) => set('is_active', v)}
                    disabled={disabled}
                    error={errors.is_active}
                />
            </div>
        </div>
    );
}

function ToggleField({ id, label, hint, checked, onChange, disabled, error }: {
    id: string;
    label: string;
    /** Aide sous la case, reliée par aria-describedby. */
    hint?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
    error?: string;
}) {
    const hintId = hint ? `${id}-aide` : undefined;
    const errorId = error ? `${id}-erreur` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;
    return (
        <div className="flex flex-col gap-1">
            <label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-base text-fg">
                <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={describedBy}
                    className="h-5 w-5 flex-shrink-0 cursor-pointer rounded border-border-strong accent-brand"
                />
                {label}
            </label>
            {hint && <p id={hintId} className="text-sm leading-snug text-fg-muted">{hint}</p>}
            {error && <p id={errorId} className="text-sm font-medium text-danger-fg">{error}</p>}
        </div>
    );
}

// ── Réponses des routes ────────────────────────────────────────────────────

export interface ApiBody {
    success?: boolean;
    error?: string;
    code?: string;
    field?: string;
    fields?: Array<{ path?: string; code?: string; message?: string }>;
    [key: string]: unknown;
}

/** Corps JSON d'une réponse ; un corps illisible devient un message d'erreur explicite. */
export async function readApiBody(res: Response): Promise<ApiBody> {
    try {
        const body = (await res.json()) as unknown;
        return body && typeof body === 'object' ? (body as ApiBody) : { error: 'Réponse inattendue du serveur.' };
    } catch {
        return { error: res.ok ? 'Réponse inattendue du serveur.' : `Le serveur a refusé la demande (erreur ${res.status}).` };
    }
}

/** Erreurs par champ d'une réponse de route de catégorie (chemins « price », « ticket_categories.0.price »…). */
function categoryErrorsOf(body: ApiBody): CategoryErrors {
    const out: CategoryErrors = {};
    const entries = Array.isArray(body.fields) ? body.fields : [];
    const push = (path: string | undefined, message: string | undefined) => {
        if (!path || !message) return;
        const last = path.split('.').pop() as CategoryField;
        if ((CATEGORY_FIELDS as readonly string[]).includes(last) && !out[last]) out[last] = message;
    };
    for (const f of entries) push(f.path, f.message);
    if (body.field && typeof body.error === 'string') push(body.field, body.error);
    return out;
}

// ── Gestion en édition ─────────────────────────────────────────────────────

interface ManagedCategory {
    draft: CategoryDraft;
    /** Valeurs enregistrées (null : catégorie pas encore créée). */
    base: CategoryDraft | null;
    errors: CategoryErrors;
    message: { tone: 'success' | 'danger' | 'info'; text: string } | null;
    /** Le serveur propose de désactiver la catégorie (suppression impossible). */
    suggestDeactivate: boolean;
    busy: boolean;
}

interface EventTicketingManagerProps {
    eventId: string;
    initialCategories: Row[];
}

const NETWORK_MESSAGE = 'Connexion impossible : la catégorie n’a pas été enregistrée. Vérifiez votre réseau, puis réessayez.';

export function EventTicketingManager({ eventId, initialCategories }: EventTicketingManagerProps) {
    const [items, setItems] = useState<ManagedCategory[]>(() => initialCategories.map((row) => {
        const draft = categoryDraftFromRow(row);
        return { draft, base: { ...draft }, errors: {}, message: null, suggestDeactivate: false, busy: false };
    }));
    const [pendingDelete, setPendingDelete] = useState<string | null>(null);

    const update = (key: string, change: (item: ManagedCategory) => ManagedCategory) => {
        setItems((list) => list.map((item) => (item.draft.key === key ? change(item) : item)));
    };

    const addCategory = () => {
        const draft = newCategoryDraft();
        setItems((list) => [...list, { draft, base: null, errors: {}, message: null, suggestDeactivate: false, busy: false }]);
        window.requestAnimationFrame(() => document.getElementById(categoryFieldId(draft.key, 'name'))?.focus());
    };

    const applyRow = (key: string, row: Row, text: string) => {
        const draft = categoryDraftFromRow(row, key);
        update(key, () => ({ draft, base: { ...draft }, errors: {}, message: { tone: 'success', text }, suggestDeactivate: false, busy: false }));
    };

    const refuse = (key: string, body: ApiBody) => {
        update(key, (item) => ({
            ...item,
            busy: false,
            errors: categoryErrorsOf(body),
            message: { tone: 'danger', text: body.error || 'L’enregistrement de la catégorie a été refusé.' },
            suggestDeactivate: body.code === 'CATEGORY_HAS_SALES',
        }));
    };

    const send = async (key: string, url: string, init: RequestInit, onOk: (body: ApiBody) => void) => {
        update(key, (item) => ({ ...item, busy: true, message: null }));
        try {
            const res = await fetch(url, init);
            const body = await readApiBody(res);
            if (res.ok && body.success !== false) onOk(body);
            else refuse(key, body);
        } catch {
            update(key, (item) => ({ ...item, busy: false, message: { tone: 'danger', text: NETWORK_MESSAGE } }));
        }
    };

    const save = (item: ManagedCategory) => {
        const { draft, base } = item;
        const key = draft.key;
        if (draft.id === null || base === null) {
            void send(key, `/api/partner/events/${eventId}/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(categoryCreateBody(draft)),
            }, (body) => applyRow(key, (body.category as Row) ?? {}, 'Catégorie créée.'));
            return;
        }
        const patch = categoryPatch(draft, base);
        if (Object.keys(patch).length === 0) {
            update(key, (it) => ({ ...it, message: { tone: 'info', text: 'Aucune modification à enregistrer pour cette catégorie.' } }));
            return;
        }
        void send(key, `/api/partner/events/${eventId}/categories/${draft.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
        }, (body) => applyRow(key, (body.category as Row) ?? {}, 'Catégorie enregistrée.'));
    };

    const deactivate = (item: ManagedCategory) => {
        const key = item.draft.key;
        if (!item.draft.id) return;
        void send(key, `/api/partner/events/${eventId}/categories/${item.draft.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: false }),
        }, (body) => applyRow(key, (body.category as Row) ?? {}, 'Catégorie retirée de la vente.'));
    };

    const confirmDelete = async () => {
        const key = pendingDelete;
        const item = items.find((it) => it.draft.key === key);
        setPendingDelete(null);
        if (!key || !item) return;
        if (!item.draft.id) {
            setItems((list) => list.filter((it) => it.draft.key !== key));
            return;
        }
        await send(key, `/api/partner/events/${eventId}/categories/${item.draft.id}`, { method: 'DELETE' }, () => {
            setItems((list) => list.filter((it) => it.draft.key !== key));
        });
    };

    const deleting = items.find((it) => it.draft.key === pendingDelete);

    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-fg-muted">
                Chaque catégorie s’enregistre séparément. Le prix ne change plus dès qu’un billet est vendu ou réservé ; la quantité ne descend jamais sous les ventes.
            </p>

            {items.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface-sunken p-6 text-center">
                    <Ticket size={24} className="text-fg-muted" aria-hidden="true" />
                    <p className="text-sm text-fg-muted">Aucune catégorie de billets. Ajoutez-en une pour pouvoir soumettre l’événement.</p>
                </div>
            )}

            {items.map((item, index) => {
                const { draft } = item;
                const isNew = draft.id === null;
                const dirty = isNew || (item.base !== null && Object.keys(categoryPatch(draft, item.base)).length > 0);
                const sales = hasSales(draft);
                return (
                    <section
                        key={draft.key}
                        aria-labelledby={`${draft.key}-titre`}
                        className={cn('flex flex-col gap-4 rounded-2xl border bg-surface p-4 sm:p-5', isNew ? 'border-brand-fg' : 'border-border')}
                    >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h3 id={`${draft.key}-titre`} className="break-words text-base font-semibold text-fg">
                                    {draft.name.trim() || `Catégorie ${index + 1}`}
                                </h3>
                                <p className="text-sm text-fg-muted tabular-nums">
                                    {isNew
                                        ? 'Nouvelle catégorie, pas encore enregistrée'
                                        : sales
                                            ? `${plural(draft.sold, 'billet vendu', 'billets vendus')}${draft.held > 0 ? `, ${formatInteger(draft.held)} en cours de paiement` : ''}`
                                            : 'Aucun billet vendu'}
                                    {!isNew && !draft.is_active ? ' · hors vente' : ''}
                                    {item.base ? ` · ${categoryChannelLabel(item.base)}` : ''}
                                </p>
                            </div>
                            {(isNew || !sales) && (
                                <IconButton
                                    aria-label={isNew ? `Abandonner la catégorie ${index + 1}` : `Supprimer la catégorie ${draft.name.trim() || index + 1}`}
                                    variant="danger"
                                    onClick={() => setPendingDelete(draft.key)}
                                    disabled={item.busy}
                                >
                                    <Trash2 size={18} />
                                </IconButton>
                            )}
                        </div>

                        <CategoryFields
                            draft={draft}
                            onChange={(next) => update(draft.key, (it) => ({ ...it, draft: next, message: null }))}
                            errors={item.errors}
                            disabled={item.busy}
                            showLocks
                        />

                        {item.message && (
                            <StatusBanner
                                tone={item.message.tone}
                                title={item.message.text}
                                announce={item.message.tone === 'danger' ? 'alert' : 'status'}
                                action={item.suggestDeactivate && draft.is_active ? (
                                    <Button type="button" variant="secondary" size="sm" onClick={() => deactivate(item)} isLoading={item.busy}>
                                        Retirer de la vente
                                    </Button>
                                ) : undefined}
                            />
                        )}

                        <div className="flex flex-wrap justify-end gap-2">
                            <Button type="button" variant={dirty ? 'primary' : 'secondary'} onClick={() => save(item)} isLoading={item.busy} disabled={!dirty}>
                                {isNew ? 'Créer la catégorie' : 'Enregistrer la catégorie'}
                            </Button>
                        </div>
                    </section>
                );
            })}

            <div>
                <Button type="button" variant="outline" onClick={addCategory} leftIcon={<Plus size={18} />}>
                    Ajouter une catégorie
                </Button>
            </div>

            <ConfirmDialog
                isOpen={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                onConfirm={() => void confirmDelete()}
                title={deleting?.draft.id ? 'Supprimer cette catégorie ?' : 'Abandonner cette catégorie ?'}
                message={deleting?.draft.id
                    ? 'La catégorie sera supprimée définitivement. Ce n’est possible que si aucun billet n’a été vendu ni réservé.'
                    : 'Les informations saisies pour cette nouvelle catégorie seront perdues.'}
                confirmLabel={deleting?.draft.id ? 'Supprimer' : 'Abandonner'}
                cancelLabel="Garder la catégorie"
                variant="danger"
            />
        </div>
    );
}
