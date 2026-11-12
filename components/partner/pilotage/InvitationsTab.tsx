'use client';

import React, { useRef, useState } from 'react';
import { Ban, Pencil, Plus, Send, Ticket, Trash2 } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select, TextInput } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { KpiCardSkeleton } from '@/components/ui/KpiCard';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { toSenegaleseE164 } from '@/lib/validations/auth';
import { MAX_GUEST_NAME_LENGTH, MAX_INVITATION_PHONES, MAX_INVITATION_QUANTITY } from '@/lib/validations/invitation';
import { PilotageSection } from './PilotageBlocks';
import type { PilotageSales } from './types';

type Category = PilotageSales['by_category'][number];

interface InvitationRow {
    ticket_id: string;
    category: string;
    created_at: string;
    price: number;
    channel: string;
    status_label: string;
    phone_masked: string | null;
    can_cancel: boolean;
    /** Lot 9 ter (9t.17) : nom de l'invité, montré au contrôleur qui consulte la liste des invités. */
    guest_name?: string | null;
}

interface InvitationsPage {
    items: InvitationRow[];
    page: number;
    page_size: number;
    total_count: number;
}

interface SendResponse {
    ok: true;
    ticket_count: number;
    phone_count: number;
}

/** Envoi vérifié, en attente de la confirmation. */
interface Draft {
    categoryId: string;
    categoryName: string;
    phones: string[];
    /** Lot 9 ter : nom de chaque numéro (null : sans nom), dans l'ordre des numéros. */
    guestNames: Array<string | null>;
    quantity: number;
}

/** Lot 9 ter (9t.17) : une ligne du formulaire, numéro et nom facultatif. */
interface GuestLine { key: number; phone: string; name: string }

interface SendFailure {
    tone: 'danger' | 'warning';
    title: string;
    lines: string[];
    field?: { name: 'category' | 'phones' | 'quantity'; message: string; line?: number; guestName?: boolean };
    /** Le stock ou l'historique affiché peut être dépassé : à relire. */
    refresh?: boolean;
}

/** Statuts où le serveur accepte un envoi (contrat 5.1, étape 4) ; la RPC reste seule juge. */
const SENDABLE_STATUSES: ReadonlySet<string> = new Set(['PUBLIE', 'VALIDE']);

/** Annulation refusée parce que la ligne affichée n'est plus à jour : la boîte se ferme et la liste est relue. */
const STALE_CANCEL_CODES: ReadonlySet<string> = new Set(['TICKET_NOT_FOUND', 'TICKET_ALREADY_USED', 'TICKET_NOT_CANCELLABLE']);

const STATUS_VARIANT: Readonly<Record<string, BadgeVariant>> = {
    Envoyée: 'info',
    'Entrée validée': 'success',
    Annulée: 'neutral',
};

const QUANTITY_OPTIONS = Array.from({ length: MAX_INVITATION_QUANTITY }, (_, index) => {
    const value = String(index + 1);
    return { value, label: value };
});

const PHONE_FORMAT_HELP = 'saisissez un numéro sénégalais à 9 chiffres (par exemple 77 123 45 67).';

function plural(count: number, singular: string, several: string): string {
    return `${formatInteger(count)} ${count > 1 ? several : singular}`;
}

/** Même masque que le serveur (contrat 5.1) : la confirmation ne réaffiche pas les numéros complets. */
function maskPhone(e164: string): string {
    return `+221***${e164.slice(-2)}`;
}

/**
 * Mêmes règles que `CreateInvitationsSchema` (10 au plus, format sénégalais, distincts une fois normalisés, nom de 60
 * caractères au plus). Une ligne entièrement vide est ignorée ; l'erreur désigne sa ligne.
 */
function readLines(lines: GuestLine[]): { phones: string[]; guestNames: Array<string | null>; error?: string; line?: number } {
    const phones: string[] = [];
    const guestNames: Array<string | null> = [];
    for (let index = 0; index < lines.length; index += 1) {
        const raw = lines[index].phone.trim();
        const name = lines[index].name.trim();
        if (!raw && !name) continue;
        const phone = toSenegaleseE164(raw);
        if (!phone) return { phones: [], guestNames: [], error: `Numéro ${index + 1} : ${PHONE_FORMAT_HELP}`, line: index };
        if (phones.includes(phone)) return { phones: [], guestNames: [], error: `Numéro ${index + 1} : ce numéro figure deux fois dans la liste.`, line: index };
        if (name.length > MAX_GUEST_NAME_LENGTH) return { phones: [], guestNames: [], error: 'Le nom de l’invité ne doit pas dépasser 60 caractères.', line: index };
        phones.push(phone);
        guestNames.push(name || null);
    }
    if (phones.length === 0) return { phones, guestNames, error: 'Saisissez au moins un numéro de téléphone.', line: 0 };
    return { phones, guestNames };
}

function categoryOption(category: Category): { value: string; label: string; disabled: boolean } {
    let availability = plural(category.remaining, 'restant', 'restants');
    if (!category.is_active) availability = 'vente fermée';
    else if (category.remaining <= 0) availability = 'complet';
    return { value: category.category_id, label: `${category.name} · ${availability}`, disabled: !category.is_active || category.remaining <= 0 };
}

function retryDelay(seconds: unknown): string | null {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value <= 0) return null;
    const minutes = Math.ceil(value / 60);
    if (minutes < 60) return `Nouvel essai possible dans environ ${plural(minutes, 'minute', 'minutes')}.`;
    return `Nouvel essai possible dans environ ${plural(Math.ceil(minutes / 60), 'heure', 'heures')}.`;
}

function invalidField(err: ApiError): SendFailure['field'] {
    const field = typeof err.body?.field === 'string' ? err.body.field : '';
    if (field === 'category_id') return { name: 'category', message: err.message };
    if (field === 'quantity') return { name: 'quantity', message: err.message };
    if (field === 'phones' || field === 'guest_names') return { name: 'phones', message: err.message };
    const line = /^(phones|guest_names)\.(\d+)$/.exec(field);
    if (!line) return undefined;
    const index = Number(line[2]);
    return line[1] === 'phones'
        ? { name: 'phones', message: `Numéro ${index + 1} : ${err.message}`, line: index }
        : { name: 'phones', message: err.message, line: index, guestName: true };
}

/** Réponse d'échec de l'envoi, par code (contrat 4.1). Les textes viennent de la liste blanche des routes. */
function sendFailure(err: unknown): SendFailure {
    if (!(err instanceof ApiError)) return { tone: 'danger', title: 'Envoi impossible', lines: ['Une erreur est survenue. Réessayez.'] };
    switch (err.code) {
        case 'INVALID_FIELD':
            return { tone: 'danger', title: 'Vérifiez le formulaire', lines: [err.message], field: invalidField(err) };
        case 'QUOTA_EXCEEDED':
            return { tone: 'warning', title: 'Limite d’envoi atteinte', lines: [err.message, retryDelay(err.body?.retry_after_seconds)].filter((line): line is string => line !== null) };
        case 'SALE_CHECK_FAILED':
            return { tone: 'danger', title: 'Envoi refusé', lines: [err.message], refresh: true };
        case 'EVENT_NOT_ACTIVE':
            return { tone: 'warning', title: 'Envoi fermé pour cet événement', lines: [err.message] };
        case 'FORBIDDEN':
            return { tone: 'danger', title: 'Action non autorisée', lines: [err.message] };
        case 'NETWORK_ERROR':
            // La réponse s'est perdue : l'envoi a pu aboutir, et le relancer doublerait billets et SMS.
            return { tone: 'warning', title: 'Envoi non confirmé', lines: ['La connexion a été interrompue. Consultez l’historique ci-dessous avant de recommencer.'], refresh: true };
        default:
            return { tone: 'danger', title: 'Envoi impossible', lines: [err.message] };
    }
}

function InvitationForm({ eventId, categories, onChanged }: { eventId: string; categories: Category[]; onChanged: () => void }) {
    const categoryRef = useRef<HTMLSelectElement>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const lineSeq = useRef(1);
    const [categoryId, setCategoryId] = useState('');
    const [lines, setLines] = useState<GuestLine[]>([{ key: 0, phone: '', name: '' }]);
    /** Ligne en erreur (numéro ou nom), pour placer le message sous le bon champ. */
    const [errorLine, setErrorLine] = useState<{ line: number; guestName: boolean } | null>(null);
    const [quantity, setQuantity] = useState('1');
    const [categoryError, setCategoryError] = useState<string | undefined>(undefined);
    const [phonesError, setPhonesError] = useState<string | undefined>(undefined);
    const [quantityError, setQuantityError] = useState<string | undefined>(undefined);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [sending, setSending] = useState(false);
    const [failure, setFailure] = useState<SendFailure | null>(null);
    const [sent, setSent] = useState<{ tickets: number; phones: number } | null>(null);

    // Toute catégorie est admise ; celles sans canal de vente viennent en premier (consigne 9.0).
    const withoutChannel = categories.filter((c) => !c.sale_online && !c.sale_counter);
    const withChannel = categories.filter((c) => c.sale_online || c.sale_counter);
    const groups = [
        { label: 'Sans canal de vente', items: withoutChannel },
        { label: 'En vente en ligne ou au guichet', items: withChannel },
    ];
    const lineCount = lines.length;

    /** Focus sur le champ en cause (numéro ou nom de la ligne). */
    const focusLine = (line: number, guestName = false): void => {
        setTimeout(() => formRef.current?.querySelector<HTMLInputElement>(`[data-line="${line}-${guestName ? 'name' : 'phone'}"]`)?.focus(), 0);
    };
    const updateLine = (key: number, patch: Partial<GuestLine>): void => {
        setLines((list) => list.map((l) => (l.key === key ? { ...l, ...patch } : l)));
        setPhonesError(undefined);
        setErrorLine(null);
    };
    const clearOutcome = (): void => {
        setFailure(null);
        setSent(null);
    };

    const review = (e: React.FormEvent): void => {
        e.preventDefault();
        clearOutcome();
        setQuantityError(undefined);
        const category = categories.find((c) => c.category_id === categoryId);
        const nextCategoryError = category && !categoryOption(category).disabled ? undefined : 'Choisissez une catégorie encore disponible.';
        const { phones, guestNames, error: nextPhonesError, line } = readLines(lines);
        setCategoryError(nextCategoryError);
        setPhonesError(nextPhonesError);
        const nameError = nextPhonesError?.startsWith('Le nom') === true;
        setErrorLine(nextPhonesError && line !== undefined ? { line, guestName: nameError } : null);
        if (nextCategoryError || !category) {
            categoryRef.current?.focus();
            return;
        }
        if (nextPhonesError) {
            focusLine(line ?? 0, nameError);
            return;
        }
        setDraft({ categoryId: category.category_id, categoryName: category.name, phones, guestNames, quantity: Number(quantity) });
    };

    const send = async (): Promise<void> => {
        if (!draft) return;
        setSending(true);
        try {
            const res = await sendJson<SendResponse>(`/api/partner/events/${eventId}/invitations`, 'POST', {
                category_id: draft.categoryId,
                phones: draft.phones,
                quantity: draft.quantity,
                // Lot 9 ter : noms envoyés seulement si au moins un est saisi (sinon, envoi identique au lot 9)
                ...(draft.guestNames.some((n) => n !== null) ? { guest_names: draft.guestNames } : {}),
            });
            setSent({ tickets: res.ticket_count, phones: res.phone_count });
            setLines([{ key: lineSeq.current++, phone: '', name: '' }]);
            setDraft(null);
            onChanged();
        } catch (err) {
            const next = sendFailure(err);
            setFailure(next);
            if (next.field?.name === 'category') setCategoryError(next.field.message);
            if (next.field?.name === 'phones') {
                setPhonesError(next.field.message);
                if (next.field.line !== undefined) {
                    setErrorLine({ line: next.field.line, guestName: next.field.guestName === true });
                    focusLine(next.field.line, next.field.guestName === true);
                }
            }
            if (next.field?.name === 'quantity') setQuantityError(next.field.message);
            setDraft(null);
            if (next.refresh) onChanged();
        } finally {
            setSending(false);
        }
    };

    return (
        <PilotageSection
            title="Inviter par SMS"
            description="Chaque numéro reçoit un SMS avec un lien vers Mes billets. Sans compte, ses billets l’attendent jusqu’à son inscription avec ce numéro."
        >
            <form ref={formRef} onSubmit={review} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5" noValidate>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-start">
                    <Select
                        ref={categoryRef}
                        label="Catégorie"
                        hint="Toute catégorie peut être distribuée ; les places sont prises sur son stock."
                        placeholder="Choisir une catégorie"
                        required
                        value={categoryId}
                        error={categoryError}
                        onChange={(e) => {
                            setCategoryId(e.target.value);
                            setCategoryError(undefined);
                        }}
                    >
                        {groups.map((group) => group.items.length > 0 && (
                            <optgroup key={group.label} label={group.label}>
                                {group.items.map((category) => {
                                    const option = categoryOption(category);
                                    return <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>;
                                })}
                            </optgroup>
                        ))}
                    </Select>
                    <Select
                        label="Billets par numéro"
                        options={QUANTITY_OPTIONS}
                        value={quantity}
                        error={quantityError}
                        onChange={(e) => {
                            setQuantity(e.target.value);
                            setQuantityError(undefined);
                        }}
                    />
                </div>
                <fieldset className="flex flex-col gap-3">
                    <legend className="mb-1 flex w-full items-baseline justify-between gap-3 text-sm font-semibold text-fg">
                        <span>Numéros de téléphone</span>
                        <span className="font-normal tabular-nums text-fg-muted">{lineCount} / {MAX_INVITATION_PHONES}</span>
                    </legend>
                    <ol className="flex flex-col gap-3">
                        {lines.map((line, index) => {
                            const lineError = errorLine?.line === index ? phonesError : undefined;
                            return (
                                <li key={line.key} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-surface-sunken p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-start">
                                    <TextInput
                                        data-line={`${index}-phone`}
                                        label={`Numéro ${index + 1}`}
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="off"
                                        placeholder="77 123 45 67"
                                        required={index === 0}
                                        value={line.phone}
                                        error={lineError && !errorLine?.guestName ? lineError : undefined}
                                        onChange={(e) => updateLine(line.key, { phone: e.target.value })}
                                    />
                                    <TextInput
                                        data-line={`${index}-name`}
                                        label={`Nom de l’invité ${index + 1}`}
                                        hint="Facultatif, 60 caractères au plus. Montré au contrôleur qui consulte la liste des invités."
                                        aside={<span className="tabular-nums">{line.name.length} / {MAX_GUEST_NAME_LENGTH}</span>}
                                        maxLength={MAX_GUEST_NAME_LENGTH}
                                        autoComplete="off"
                                        value={line.name}
                                        error={lineError && errorLine?.guestName ? lineError : undefined}
                                        onChange={(e) => updateLine(line.key, { name: e.target.value })}
                                    />
                                    {lines.length > 1 && (
                                        <IconButton
                                            aria-label={`Retirer le numéro ${index + 1}`}
                                            variant="ghost"
                                            className="sm:mt-7"
                                            onClick={() => { setLines((list) => list.filter((l) => l.key !== line.key)); setPhonesError(undefined); setErrorLine(null); }}
                                        >
                                            <Trash2 size={18} />
                                        </IconButton>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                    {phonesError && !errorLine && <p role="alert" className="text-sm font-medium text-danger-fg">{phonesError}</p>}
                    <div>
                        <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Plus size={16} />}
                            disabled={lines.length >= MAX_INVITATION_PHONES}
                            onClick={() => setLines((list) => [...list, { key: lineSeq.current++, phone: '', name: '' }])}
                        >
                            Ajouter un numéro
                        </Button>
                    </div>
                </fieldset>

                {failure && (
                    <StatusBanner tone={failure.tone} title={failure.title} announce="alert">
                        {failure.lines.map((line) => <p key={line}>{line}</p>)}
                    </StatusBanner>
                )}
                {sent && (
                    <StatusBanner tone="success" title="Invitations envoyées">
                        {plural(sent.tickets, 'billet', 'billets')} pour {plural(sent.phones, 'numéro', 'numéros')}.
                    </StatusBanner>
                )}

                <div>
                    <Button type="submit" variant="primary" leftIcon={<Send size={18} />} disabled={sending}>
                        Envoyer les invitations
                    </Button>
                </div>
            </form>

            <ConfirmDialog
                isOpen={draft !== null}
                onClose={() => setDraft(null)}
                onConfirm={() => void send()}
                title="Confirmer l’envoi"
                message="Un SMS part aussitôt vers chaque numéro et les places sont prises sur le stock de la catégorie."
                isLoading={sending}
                maxWidth="md"
            >
                {draft && (
                    <dl className="rounded-2xl border border-border bg-surface-sunken px-4 py-1 text-sm">
                        <div className="flex items-baseline justify-between gap-3 border-b border-border py-2">
                            <dt className="text-fg-muted">Catégorie</dt>
                            <dd className="min-w-0 break-words text-right font-semibold text-fg">{draft.categoryName}</dd>
                        </div>
                        <div className="flex flex-col gap-1 border-b border-border py-2">
                            <dt className="flex justify-between gap-3 text-fg-muted"><span>{draft.phones.length > 1 ? 'Numéros' : 'Numéro'}</span><span>Invité</span></dt>
                            {draft.phones.map((phone, index) => (
                                <dd key={phone} className="flex items-baseline justify-between gap-3">
                                    <span className="font-semibold tabular-nums text-fg">{maskPhone(phone)}</span>
                                    <span className="min-w-0 break-words text-right text-fg">{draft.guestNames[index] ?? '—'}</span>
                                </dd>
                            ))}
                        </div>
                        <div className="flex items-baseline justify-between gap-3 border-b border-border py-2">
                            <dt className="text-fg-muted">Billets par numéro</dt>
                            <dd className="font-semibold tabular-nums text-fg">{formatInteger(draft.quantity)}</dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-3 py-2">
                            <dt className="text-fg-muted">Billets au total</dt>
                            <dd className="font-semibold tabular-nums text-fg">{formatInteger(draft.phones.length * draft.quantity)}</dd>
                        </div>
                    </dl>
                )}
            </ConfirmDialog>
        </PilotageSection>
    );
}

function InvitationHistory({
    eventId,
    page,
    onPageChange,
    signal,
    onCancelled,
}: {
    eventId: string;
    page: number;
    onPageChange: (page: number) => void;
    signal: number;
    onCancelled: () => void;
}) {
    const toast = useToast();
    const { data, error, loading, refreshing, reload } = useServerData<InvitationsPage>(`/api/partner/events/${eventId}/invitations?page=${page}`, signal);
    const [target, setTarget] = useState<InvitationRow | null>(null);
    const [cancelling, setCancelling] = useState(false);
    /** Lot 9 ter (9t.17) : nom de l'invité modifié dans une fenêtre (invitation encore annulable). */
    const [naming, setNaming] = useState<InvitationRow | null>(null);
    const [nameValue, setNameValue] = useState('');
    const [nameError, setNameError] = useState<string | undefined>(undefined);
    const [savingName, setSavingName] = useState(false);

    const openNaming = (row: InvitationRow): void => {
        setNaming(row);
        setNameValue(row.guest_name ?? '');
        setNameError(undefined);
    };

    const saveName = async (): Promise<void> => {
        if (!naming) return;
        setSavingName(true);
        setNameError(undefined);
        try {
            await sendJson(`/api/partner/events/${eventId}/invitations/${naming.ticket_id}`, 'PATCH', { guest_name: nameValue.trim() || null });
            toast.success('Nom de l’invité enregistré.');
            setNaming(null);
            await reload();
        } catch (err) {
            setNameError(errorMessage(err, 'Modification impossible pour le moment.'));
        } finally {
            setSavingName(false);
        }
    };

    const confirmCancel = async (): Promise<void> => {
        if (!target) return;
        setCancelling(true);
        try {
            await sendJson(`/api/partner/events/${eventId}/invitations/${target.ticket_id}/cancel`, 'POST');
            toast.success('Invitation annulée : la place revient au stock.');
            setTarget(null);
            onCancelled();
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Annulation impossible pour le moment.'));
            if (err instanceof ApiError && err.code !== null && STALE_CANCEL_CODES.has(err.code)) {
                setTarget(null);
                await reload();
            }
        } finally {
            setCancelling(false);
        }
    };

    const columns: DataColumn<InvitationRow>[] = [
        { key: 'category', header: 'Catégorie', hideOnCard: true, render: (row) => <span className="font-semibold">{row.category}</span> },
        { key: 'phone', header: 'Numéro', render: (row) => <span className="tabular-nums">{row.phone_masked ?? 'Numéro masqué'}</span> },
        { key: 'guest', header: 'Invité', render: (row) => <span className="break-words">{row.guest_name || '—'}</span> },
        { key: 'date', header: 'Envoi', render: (row) => <time dateTime={row.created_at}>{formatDateTime(row.created_at)}</time> },
        { key: 'channel', header: 'Canal et prix', render: (row) => `${row.channel} · ${formatFcfa(row.price)}` },
        { key: 'status', header: 'Statut', render: (row) => <Badge variant={STATUS_VARIANT[row.status_label] ?? 'neutral'}>{row.status_label}</Badge> },
        {
            key: 'action',
            header: 'Action',
            align: 'right',
            render: (row) => (row.can_cancel ? (
                <span className="flex flex-wrap justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Pencil size={16} />}
                        aria-label={`Modifier le nom de l’invité de ${row.phone_masked ?? row.category}`}
                        onClick={() => openNaming(row)}
                    >
                        Modifier le nom
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Ban size={16} />}
                        aria-label={`Annuler l’invitation de ${row.phone_masked ?? row.category}`}
                        onClick={() => setTarget(row)}
                        className="text-danger-fg"
                    >
                        Annuler l’invitation
                    </Button>
                </span>
            ) : <span className="text-fg-muted">Aucune</span>),
        },
    ];

    let content: React.ReactNode;
    if (loading) {
        content = (
            <div role="status" aria-busy="true" aria-label="Chargement de l’historique des invitations">
                <KpiCardSkeleton className="min-h-40" />
            </div>
        );
    } else if (!data) {
        content = <ErrorState title="Historique indisponible" description={error ?? undefined} onRetry={() => void reload()} isRetrying={refreshing} />;
    } else {
        content = (
            <>
                {error && (
                    <StatusBanner tone="warning" title="Liste peut-être dépassée" announce="alert" action={<Button variant="secondary" size="sm" onClick={() => void reload()}>Réessayer</Button>}>
                        {error}
                    </StatusBanner>
                )}
                <DataList
                    items={data.items}
                    columns={columns}
                    getKey={(row) => row.ticket_id}
                    caption="Historique des invitations"
                    cardTitle={(row) => row.category}
                    empty={<EmptyState title="Aucune invitation pour le moment" description="Elles apparaîtront ici dès le premier envoi." icon={<Ticket size={28} />} className="my-0" />}
                />
                <Pagination page={data.page} pageSize={data.page_size} total={data.total_count} onPageChange={onPageChange} isLoading={refreshing} ariaLabel="Pages des invitations" />
            </>
        );
    }

    return (
        <PilotageSection title="Historique des invitations" description="Les numéros sont masqués. Une invitation non scannée peut être annulée : la place revient au stock et l’invité est prévenu par SMS.">
            {content}

            <ConfirmDialog
                isOpen={target !== null}
                onClose={() => setTarget(null)}
                onConfirm={() => void confirmCancel()}
                title="Annuler cette invitation ?"
                message={target ? `Le billet ${target.category} de ${target.phone_masked ?? 'ce numéro'} ne sera plus valable. La place revient au stock et l’invité est prévenu par SMS.` : undefined}
                confirmLabel="Annuler l’invitation"
                cancelLabel="Garder l’invitation"
                variant="danger"
                isLoading={cancelling}
                maxWidth="md"
            />

            <Modal
                isOpen={naming !== null}
                onClose={() => { if (!savingName) setNaming(null); }}
                title="Nom de l’invité"
                busy={savingName}
                maxWidth="md"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setNaming(null)} disabled={savingName} className="flex-1 sm:flex-none">Annuler</Button>
                        <Button variant="primary" onClick={() => void saveName()} isLoading={savingName} className="flex-1 sm:flex-none">Enregistrer</Button>
                    </>
                }
            >
                <TextInput
                    label="Nom de l’invité"
                    hint="Facultatif, 60 caractères au plus. Montré au contrôleur qui consulte la liste des invités."
                    aside={<span className="tabular-nums">{nameValue.length} / {MAX_GUEST_NAME_LENGTH}</span>}
                    maxLength={MAX_GUEST_NAME_LENGTH}
                    autoComplete="off"
                    value={nameValue}
                    error={nameError}
                    onChange={(e) => { setNameValue(e.target.value); setNameError(undefined); }}
                />
            </Modal>
        </PilotageSection>
    );
}

/**
 * Lot 9, tâche 9.0 (contrat 4.1, 5.1) — onglet Invitations du pilotage : envoi par numéro, confirmé dans une boîte, et
 * historique paginé. Catégories et restants viennent de /pilotage/sales ; droits, stock et quotas sont décidés par la RPC.
 * Le formulaire reste monté quand une relecture échoue : une saisie en cours n'est jamais perdue.
 */
export function InvitationsTab({ eventId, eventStatus, signal }: { eventId: string; eventStatus: string; signal: number }) {
    const sales = useServerData<PilotageSales>(`/api/partner/events/${eventId}/pilotage/sales`, signal);
    const [page, setPage] = useState(1);
    const [historyTick, setHistoryTick] = useState(0);

    const onSent = (): void => {
        setPage(1);
        setHistoryTick((n) => n + 1);
        void sales.reload();
    };

    let form: React.ReactNode;
    if (!SENDABLE_STATUSES.has(eventStatus)) {
        form = (
            <StatusBanner tone="info" title="Envoi d’invitations indisponible">
                Les invitations ne peuvent être envoyées que pour un événement validé ou publié.
            </StatusBanner>
        );
    } else if (sales.loading) {
        form = (
            <div role="status" aria-busy="true" aria-label="Chargement des catégories">
                <KpiCardSkeleton className="min-h-40" />
            </div>
        );
    } else if (!sales.data) {
        form = <ErrorState title="Catégories indisponibles" description={sales.error ?? undefined} onRetry={() => void sales.reload()} isRetrying={sales.refreshing} />;
    } else if (sales.data.by_category.length === 0) {
        form = <EmptyState title="Aucune catégorie" description="Ajoutez une catégorie de billets depuis la fiche de l’événement." className="my-0" />;
    } else {
        form = <InvitationForm eventId={eventId} categories={sales.data.by_category} onChanged={onSent} />;
    }

    return (
        <div className="flex flex-col gap-6">
            {form}
            <InvitationHistory eventId={eventId} page={page} onPageChange={setPage} signal={signal + historyTick} onCancelled={() => void sales.reload()} />
        </div>
    );
}
