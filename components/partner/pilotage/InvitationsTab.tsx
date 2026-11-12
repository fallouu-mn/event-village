'use client';

import React, { useRef, useState } from 'react';
import { Ban, Send, Ticket } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select, Textarea } from '@/components/ui/Field';
import { KpiCardSkeleton } from '@/components/ui/KpiCard';
import { Pagination } from '@/components/ui/Pagination';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { ApiError, errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { toSenegaleseE164 } from '@/lib/validations/auth';
import { MAX_INVITATION_PHONES, MAX_INVITATION_QUANTITY } from '@/lib/validations/invitation';
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
    quantity: number;
}

interface SendFailure {
    tone: 'danger' | 'warning';
    title: string;
    lines: string[];
    field?: { name: 'category' | 'phones' | 'quantity'; message: string };
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

function phoneLines(text: string): string[] {
    return text.split('\n').map((line) => line.trim()).filter(Boolean);
}

/** Mêmes règles que `CreateInvitationsSchema` (10 au plus, format sénégalais, distincts une fois normalisés). */
function readPhones(text: string): { phones: string[]; error?: string } {
    const lines = phoneLines(text);
    if (lines.length === 0) return { phones: [], error: 'Saisissez au moins un numéro de téléphone.' };
    if (lines.length > MAX_INVITATION_PHONES) return { phones: [], error: `${MAX_INVITATION_PHONES} numéros au plus par envoi.` };
    const phones: string[] = [];
    for (let index = 0; index < lines.length; index += 1) {
        const phone = toSenegaleseE164(lines[index]);
        if (!phone) return { phones: [], error: `Numéro ${index + 1} : ${PHONE_FORMAT_HELP}` };
        if (phones.includes(phone)) return { phones: [], error: `Numéro ${index + 1} : ce numéro figure deux fois dans la liste.` };
        phones.push(phone);
    }
    return { phones };
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
    if (field === 'phones') return { name: 'phones', message: err.message };
    const line = /^phones\.(\d+)$/.exec(field);
    return line ? { name: 'phones', message: `Numéro ${Number(line[1]) + 1} : ${err.message}` } : undefined;
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
    const phonesRef = useRef<HTMLTextAreaElement>(null);
    const [categoryId, setCategoryId] = useState('');
    const [phonesText, setPhonesText] = useState('');
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
    const lineCount = phoneLines(phonesText).length;

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
        const { phones, error: nextPhonesError } = readPhones(phonesText);
        setCategoryError(nextCategoryError);
        setPhonesError(nextPhonesError);
        if (nextCategoryError || !category) {
            categoryRef.current?.focus();
            return;
        }
        if (nextPhonesError) {
            phonesRef.current?.focus();
            return;
        }
        setDraft({ categoryId: category.category_id, categoryName: category.name, phones, quantity: Number(quantity) });
    };

    const send = async (): Promise<void> => {
        if (!draft) return;
        setSending(true);
        try {
            const res = await sendJson<SendResponse>(`/api/partner/events/${eventId}/invitations`, 'POST', {
                category_id: draft.categoryId,
                phones: draft.phones,
                quantity: draft.quantity,
            });
            setSent({ tickets: res.ticket_count, phones: res.phone_count });
            setPhonesText('');
            setDraft(null);
            onChanged();
        } catch (err) {
            const next = sendFailure(err);
            setFailure(next);
            if (next.field?.name === 'category') setCategoryError(next.field.message);
            if (next.field?.name === 'phones') setPhonesError(next.field.message);
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
            <form onSubmit={review} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5" noValidate>
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
                <Textarea
                    ref={phonesRef}
                    label="Numéros de téléphone"
                    hint={`Un numéro par ligne, ${MAX_INVITATION_PHONES} au plus par envoi.`}
                    aside={<span className="tabular-nums">{lineCount} / {MAX_INVITATION_PHONES}</span>}
                    placeholder={'77 123 45 67\n78 123 45 68'}
                    required
                    rows={4}
                    inputMode="tel"
                    autoComplete="off"
                    spellCheck={false}
                    value={phonesText}
                    error={phonesError}
                    onChange={(e) => {
                        setPhonesText(e.target.value);
                        setPhonesError(undefined);
                    }}
                    onBlur={() => {
                        if (phonesText.trim()) setPhonesError(readPhones(phonesText).error);
                    }}
                />

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
                        <div className="flex items-baseline justify-between gap-3 border-b border-border py-2">
                            <dt className="text-fg-muted">{draft.phones.length > 1 ? 'Numéros' : 'Numéro'}</dt>
                            <dd className="min-w-0 text-right font-semibold tabular-nums text-fg">{draft.phones.map(maskPhone).join(', ')}</dd>
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
        { key: 'date', header: 'Envoi', render: (row) => <time dateTime={row.created_at}>{formatDateTime(row.created_at)}</time> },
        { key: 'channel', header: 'Canal et prix', render: (row) => `${row.channel} · ${formatFcfa(row.price)}` },
        { key: 'status', header: 'Statut', render: (row) => <Badge variant={STATUS_VARIANT[row.status_label] ?? 'neutral'}>{row.status_label}</Badge> },
        {
            key: 'action',
            header: 'Action',
            align: 'right',
            render: (row) => (row.can_cancel ? (
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
