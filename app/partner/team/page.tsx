'use client';

/**
 * Équipe de contrôle du partenaire (lot 7, tâche 7.4, D66 ; contrat section 8).
 *  - Une seule lecture : GET /api/partner/team/all (useServerData). Le serveur sert les membres regroupés,
 *    leurs affectations, les comptages (members_count, assignments_count, assignments_count par membre) et
 *    les événements assignables (assignable_events : VALIDE ou PUBLIE). Aucune éligibilité ni aucun comptage
 *    n'est décidé ici ; la recherche par nom ou numéro filtre seulement la liste complète servie.
 *  - Temps réel : les changements de statut des événements (event_status_history) relancent la lecture,
 *    indicateur LiveIndicator.
 *  - Modales sur le système de design (Modal, ConfirmDialog) ; échec de lecture : ErrorState « Réessayer ».
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    Phone,
    RefreshCw,
    Search,
    Send,
    Settings,
    ShieldCheck,
    Trash2,
    UserCheck,
    UserMinus,
    UserPlus,
    Users,
    X,
} from 'lucide-react';
import { useServerData } from '@/components/partner/useServerData';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, TextInput } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { formatDateTime, formatInteger } from '@/lib/format';

/* ──────────────────────────────── Types ──────────────────────────────── */

interface AssignableEvent {
    id: string;
    title: string;
    start_at: string | null;
    status: string;
}

interface MemberAssignment {
    id: string;
    event_id: string;
    can_accept_cash: boolean;
    created_at: string;
    event: { id: string; title: string; start_at: string | null; status: string; assignable: boolean } | null;
}

interface TeamMember {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    status: string | null;
    pending_activation: boolean;
    can_accept_cash: boolean;
    assignments_count: number;
    assignments: MemberAssignment[];
}

interface TeamResponse {
    members: TeamMember[];
    members_count: number;
    assignments_count: number;
    assignable_events: AssignableEvent[];
}

interface ExistingAccountConfirmState {
    // Lot 1C.1 : le serveur ne renvoie que le nom masqué du titulaire et le numéro saisi.
    existingUser: { display_name: string; phone: string };
    eventIds: string[];
    canAcceptCash: boolean;
    message: string;
}

interface InviteReply {
    message?: string;
    requires_confirmation?: boolean;
    existing_user?: { display_name: string; phone: string };
}

/* ─────────────────────────────── Affichage ─────────────────────────────── */

function displayName(m: TeamMember): string {
    return [m.first_name, m.last_name].filter(Boolean).join(' ') || 'Contrôleur';
}

function displayPhone(phone: string | null): string {
    return (phone ?? '').replace(/^\+221/, '').replace(/(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
}

function plural(n: number, one: string, many: string): string {
    return `${formatInteger(n)} ${n > 1 ? many : one}`;
}

/* ─────────────────────── Liste d'événements à cocher ─────────────────────── */

interface EventChoice {
    id: string;
    title: string;
    start_at: string | null;
    status: string;
    /** Faux : affectation existante sur un événement qui n'accepte plus de contrôleur (à retirer). */
    assignable: boolean;
}

function EventChecklist({ legend, choices, selectedIds, onToggle, name }: {
    legend: React.ReactNode;
    choices: EventChoice[];
    selectedIds: string[];
    onToggle: (id: string, assignable: boolean) => void;
    name: string;
}) {
    return (
        <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-fg">{legend}</legend>
            <ul className="max-h-60 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-surface-sunken p-1.5">
                {choices.map((ev) => {
                    const checked = selectedIds.includes(ev.id);
                    const disabled = !ev.assignable && !checked;
                    return (
                        <li key={ev.id}>
                            <label
                                className={cn(
                                    'flex min-h-12 items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors duration-200',
                                    checked ? 'border-brand-fg bg-brand-bg' : 'border-transparent bg-surface',
                                    disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-border-strong',
                                )}
                            >
                                <span className="flex min-w-0 items-center gap-2.5">
                                    <input
                                        type="checkbox"
                                        name={name}
                                        value={ev.id}
                                        checked={checked}
                                        disabled={disabled}
                                        onChange={() => onToggle(ev.id, ev.assignable)}
                                        className="h-5 w-5 flex-shrink-0 cursor-pointer accent-brand"
                                    />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-semibold text-fg">{ev.title}</span>
                                        {ev.start_at && (
                                            <time dateTime={ev.start_at} className="block text-sm text-fg-muted">{formatDateTime(ev.start_at)}</time>
                                        )}
                                    </span>
                                </span>
                                <span className="flex flex-shrink-0 flex-col items-end gap-1">
                                    <StatusBadge domain="event" status={ev.status} size="sm" />
                                    {!ev.assignable && <span className="text-sm font-medium text-warning-fg">À retirer</span>}
                                </span>
                            </label>
                        </li>
                    );
                })}
            </ul>
        </fieldset>
    );
}

/* ──────────────────────────────── Page ──────────────────────────────── */

export default function PartnerTeamPage() {
    const toast = useToast();

    // Temps réel (lot 5, contrat O3) : statuts des événements du partenaire, par leur historique (publié, RLS
    // propriétaire). event_controllers et events ne sont pas dans la publication.
    const [signal, setSignal] = useState(0);
    const bump = useCallback(() => setSignal((n) => n + 1), []);
    const { status: liveStatus } = useRealtimeRefresh({
        channelKey: 'partner-team-statuts',
        subscriptions: [{ table: 'event_status_history', event: 'INSERT' }],
        onSignal: bump,
    });
    const { data, error, loading, refreshing, reload } = useServerData<TeamResponse>('/api/partner/team/all', signal);

    const members = useMemo(() => data?.members ?? [], [data]);
    const assignableEvents = useMemo(() => data?.assignable_events ?? [], [data]);

    const [filterEvent, setFilterEvent] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Invitation
    const [showInvite, setShowInvite] = useState(false);
    const [invFirstName, setInvFirstName] = useState('');
    const [invLastName, setInvLastName] = useState('');
    const [invEmail, setInvEmail] = useState('');
    const [invPhone, setInvPhone] = useState('');
    const [invEventIds, setInvEventIds] = useState<string[]>([]);
    const [invCanCash, setInvCanCash] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [invError, setInvError] = useState<{ phone?: string; events?: string; form?: string }>({});
    const [existingAccountConfirm, setExistingAccountConfirm] = useState<ExistingAccountConfirmState | null>(null);
    const [confirmingPromotion, setConfirmingPromotion] = useState(false);
    const [resendingId, setResendingId] = useState<string | null>(null);

    // Modification des affectations
    const [editMember, setEditMember] = useState<TeamMember | null>(null);
    const [editEventIds, setEditEventIds] = useState<string[]>([]);
    const [editCanCash, setEditCanCash] = useState(false);
    const [updatingAssignments, setUpdatingAssignments] = useState(false);

    // Confirmations
    const [confirmRemoveSingle, setConfirmRemoveSingle] = useState<{ assignmentId: string; eventId: string; eventTitle: string; ctrlName: string } | null>(null);
    const [confirmRemoveAll, setConfirmRemoveAll] = useState<{ controllerId: string; ctrlName: string; eventCount: number } | null>(null);
    const [confirmDeleteCtrl, setConfirmDeleteCtrl] = useState<{ controllerId: string; ctrlName: string } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Un seul événement assignable : il est présélectionné à l'invitation.
    useEffect(() => {
        if (assignableEvents.length === 1) setInvEventIds([assignableEvents[0].id]);
    }, [assignableEvents]);

    // Filtre réinitialisé si l'événement choisi n'est plus assignable.
    useEffect(() => {
        if (filterEvent !== 'all' && !assignableEvents.some((e) => e.id === filterEvent)) setFilterEvent('all');
    }, [filterEvent, assignableEvents]);

    // Recherche locale sur la liste complète servie (filtre de saisie, pas un chiffre).
    const visibleMembers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return members.filter((m) => {
            if (filterEvent !== 'all' && !m.assignments.some((a) => a.event_id === filterEvent)) return false;
            if (!q) return true;
            return displayName(m).toLowerCase().includes(q) || (m.phone ?? '').toLowerCase().includes(q);
        });
    }, [members, filterEvent, searchQuery]);

    const resetInvite = () => {
        setInvFirstName('');
        setInvLastName('');
        setInvEmail('');
        setInvPhone('');
        setInvCanCash(false);
        setInvError({});
        setInvEventIds(assignableEvents.length === 1 ? [assignableEvents[0].id] : []);
    };

    /* ───────────── Invitation ───────────── */

    const toggleInviteEvent = (id: string) => {
        setInvEventIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
        setInvError((prev) => ({ ...prev, events: undefined }));
    };

    const toggleAllInviteEvents = () => {
        setInvEventIds(invEventIds.length === assignableEvents.length ? [] : assignableEvents.map((e) => e.id));
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (inviting) return;
        const phoneSanitized = invPhone.replace(/\s/g, '');
        const next: typeof invError = {};
        if (!/^(7[0-8])\d{7}$/.test(phoneSanitized)) next.phone = 'Numéro sénégalais de 9 chiffres requis (ex : 77 123 45 67).';
        if (invEventIds.length === 0) next.events = 'Sélectionnez au moins un événement.';
        setInvError(next);
        if (next.phone || next.events) return;

        setInviting(true);
        try {
            const reply = await sendJson<InviteReply>('/api/partner/team/invite', 'POST', {
                event_ids: invEventIds,
                phone: phoneSanitized,
                first_name: invFirstName.trim() || 'Contrôleur',
                last_name: invLastName.trim() || '',
                email: invEmail.trim() || undefined,
                can_accept_cash: invCanCash,
            });
            if (reply.requires_confirmation && reply.existing_user) {
                setExistingAccountConfirm({ existingUser: reply.existing_user, eventIds: [...invEventIds], canAcceptCash: invCanCash, message: reply.message ?? '' });
                return;
            }
            toast.success(reply.message || 'Contrôleur invité : il reçoit son code par SMS.');
            setShowInvite(false);
            resetInvite();
            await reload();
        } catch (err) {
            console.error('[équipe] invitation impossible :', err);
            setInvError({ form: errorMessage(err, 'L’invitation n’a pas pu être envoyée.') });
        } finally {
            setInviting(false);
        }
    };

    const handleConfirmPromotion = async () => {
        if (!existingAccountConfirm || confirmingPromotion) return;
        setConfirmingPromotion(true);
        try {
            const reply = await sendJson<InviteReply>('/api/partner/team/invite', 'POST', {
                event_ids: existingAccountConfirm.eventIds,
                phone: existingAccountConfirm.existingUser.phone,
                can_accept_cash: existingAccountConfirm.canAcceptCash,
                confirm_promotion: true,
            });
            toast.success(reply.message || 'Rôle de contrôleur attribué.');
            setExistingAccountConfirm(null);
            setShowInvite(false);
            resetInvite();
            await reload();
        } catch (err) {
            console.error('[équipe] attribution du rôle impossible :', err);
            toast.error(errorMessage(err, 'Le rôle de contrôleur n’a pas pu être attribué.'));
        } finally {
            setConfirmingPromotion(false);
        }
    };

    const handleResendInvite = async (m: TeamMember) => {
        const first = m.assignments[0];
        if (!first || resendingId || actionLoading) return;
        setResendingId(m.user_id);
        try {
            const reply = await sendJson<InviteReply>('/api/partner/team/invite', 'POST', {
                event_id: first.event_id,
                phone: m.phone,
                first_name: m.first_name || 'Contrôleur',
                last_name: m.last_name || '',
                resend: true,
                can_accept_cash: first.can_accept_cash,
            });
            toast.success(reply.message || 'Invitation renvoyée par SMS.');
        } catch (err) {
            console.error('[équipe] renvoi de l’invitation impossible :', err);
            toast.error(errorMessage(err, 'L’invitation n’a pas pu être renvoyée.'));
        } finally {
            setResendingId(null);
        }
    };

    /* ───────────── Affectations ───────────── */

    const openEdit = (m: TeamMember) => {
        setEditMember(m);
        setEditEventIds(m.assignments.map((a) => a.event_id));
        setEditCanCash(m.can_accept_cash);
    };

    // Événements proposés : les assignables servis, plus les affectations actuelles devenues non assignables.
    const editChoices: EventChoice[] = useMemo(() => {
        if (!editMember) return [];
        const out: EventChoice[] = assignableEvents.map((e) => ({ ...e, assignable: true }));
        for (const a of editMember.assignments) {
            if (a.event && !a.event.assignable && !out.some((c) => c.id === a.event_id)) {
                out.push({ id: a.event.id, title: a.event.title, start_at: a.event.start_at, status: a.event.status, assignable: false });
            }
        }
        return out;
    }, [editMember, assignableEvents]);

    const toggleEditEvent = (id: string, assignable: boolean) => {
        setEditEventIds((prev) => {
            if (prev.includes(id)) return prev.filter((x) => x !== id);
            return assignable ? [...prev, id] : prev;
        });
    };

    const handleSaveAssignments = async () => {
        if (!editMember || updatingAssignments) return;
        setUpdatingAssignments(true);
        try {
            await sendJson('/api/partner/team/assignments', 'PATCH', {
                controller_id: editMember.user_id,
                event_ids: editEventIds,
                can_accept_cash: editCanCash,
            });
            toast.success('Affectations mises à jour.');
            setEditMember(null);
            await reload();
        } catch (err) {
            console.error('[équipe] mise à jour des affectations impossible :', err);
            toast.error(errorMessage(err, 'Les affectations n’ont pas pu être mises à jour.'));
        } finally {
            setUpdatingAssignments(false);
        }
    };

    const runAction = async (url: string, success: string, fallback: string, close: () => void) => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            const reply = await sendJson<{ message?: string }>(url, 'DELETE');
            toast.success(reply.message || success);
            close();
            await reload();
        } catch (err) {
            console.error(`[équipe] ${url} :`, err);
            toast.error(errorMessage(err, fallback));
        } finally {
            setActionLoading(false);
        }
    };

    /* ───────────── Rendu ───────────── */

    const columns: DataColumn<TeamMember>[] = [
        {
            key: 'member',
            header: 'Membre',
            render: (m) => (
                <div className="min-w-0">
                    <p className="truncate font-semibold text-fg">{displayName(m)}</p>
                    <p className="flex items-center gap-1.5 font-mono text-sm text-fg-muted">
                        <Phone size={14} aria-hidden="true" /> {displayPhone(m.phone)}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-muted">
                        {m.can_accept_cash
                            ? <><CheckCircle2 size={14} className="text-success-fg" aria-hidden="true" /> Encaissement espèces autorisé</>
                            : <><AlertCircle size={14} aria-hidden="true" /> Sans encaissement espèces</>}
                    </p>
                </div>
            ),
        },
        {
            key: 'state',
            header: 'État',
            render: (m) => (m.pending_activation
                ? <Badge variant="warning" size="sm">Activation en attente</Badge>
                : <Badge variant="success" size="sm">Actif</Badge>),
        },
        {
            key: 'events',
            header: 'Événements',
            render: (m) => (
                <div className="space-y-1.5">
                    <p className="text-sm text-fg-muted">{plural(m.assignments_count, 'événement', 'événements')}</p>
                    <ul className="flex flex-wrap gap-1.5">
                        {m.assignments.map((a) => {
                            const title = a.event?.title ?? 'Événement';
                            return (
                                <li key={a.id} className="inline-flex max-w-full items-center gap-1 rounded-lg border border-border bg-surface-sunken pl-2.5 text-sm text-fg">
                                    <CalendarDays size={14} className="flex-shrink-0 text-brand-fg" aria-hidden="true" />
                                    <span className="truncate">{title}</span>
                                    <IconButton
                                        aria-label={`Retirer ${displayName(m)} de ${title}`}
                                        variant="danger"
                                        disabled={actionLoading}
                                        onClick={() => setConfirmRemoveSingle({ assignmentId: a.id, eventId: a.event_id, eventTitle: title, ctrlName: displayName(m) })}
                                    >
                                        <X size={16} />
                                    </IconButton>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ),
        },
        {
            key: 'actions',
            header: 'Actions',
            align: 'right',
            render: (m) => (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" leftIcon={<Settings size={16} aria-hidden="true" />} onClick={() => openEdit(m)} disabled={actionLoading || updatingAssignments}>
                        Gérer
                    </Button>
                    <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Send size={16} aria-hidden="true" />}
                        onClick={() => void handleResendInvite(m)}
                        isLoading={resendingId === m.user_id}
                        disabled={actionLoading}
                    >
                        Renvoyer le SMS
                    </Button>
                    <IconButton
                        aria-label={`Retirer ${displayName(m)} de tous vos événements`}
                        title="Retirer de tous les événements"
                        variant="secondary"
                        disabled={actionLoading}
                        onClick={() => setConfirmRemoveAll({ controllerId: m.user_id, ctrlName: displayName(m), eventCount: m.assignments_count })}
                    >
                        <UserMinus size={18} />
                    </IconButton>
                    <IconButton
                        aria-label={`Supprimer ${displayName(m)} de l’équipe`}
                        title="Supprimer de l’équipe"
                        variant="danger"
                        disabled={actionLoading}
                        onClick={() => setConfirmDeleteCtrl({ controllerId: m.user_id, ctrlName: displayName(m) })}
                    >
                        <Trash2 size={18} />
                    </IconButton>
                </div>
            ),
        },
    ];

    const filtersActive = filterEvent !== 'all' || searchQuery.trim() !== '';

    return (
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-24 sm:px-6">
            <PageHeader
                eyebrow={<LiveIndicator status={liveStatus} />}
                title="Équipe de contrôle"
                description={data
                    ? `${plural(data.members_count, 'membre', 'membres')} · ${plural(data.assignments_count, 'affectation', 'affectations')} sur vos événements.`
                    : 'Les contrôleurs qui scannent les billets à l’entrée de vos événements.'}
                actions={
                    <>
                        <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<RefreshCw size={16} aria-hidden="true" />}
                            onClick={() => void reload()}
                            isLoading={refreshing}
                            disabled={loading}
                        >
                            Actualiser
                        </Button>
                        <Button variant="primary" size="sm" leftIcon={<UserPlus size={16} aria-hidden="true" />} onClick={() => setShowInvite(true)} disabled={!data}>
                            Inviter un contrôleur
                        </Button>
                    </>
                }
            />

            {error && !data ? (
                <ErrorState title="Équipe indisponible" description={error} onRetry={() => void reload()} isRetrying={loading || refreshing} />
            ) : loading || !data ? (
                <div className="space-y-3" role="status" aria-busy="true">
                    <span className="sr-only">Chargement de l’équipe…</span>
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                </div>
            ) : (
                <>
                    {error && (
                        <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg p-3 text-sm text-danger-fg">
                            {error} La liste affichée est celle de la dernière lecture réussie.
                        </p>
                    )}

                    {data.members_count > 0 && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                            <TextInput
                                label="Rechercher un contrôleur"
                                type="search"
                                placeholder="Nom ou numéro"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aside={<Search size={16} aria-hidden="true" />}
                            />
                            <Select
                                label="Événement"
                                value={filterEvent}
                                onChange={(e) => setFilterEvent(e.target.value)}
                                options={[{ value: 'all', label: 'Tous les événements' }, ...assignableEvents.map((ev) => ({ value: ev.id, label: ev.title }))]}
                            />
                        </div>
                    )}

                    <DataList
                        items={visibleMembers}
                        columns={columns}
                        getKey={(m) => m.user_id}
                        caption="Membres de l’équipe de contrôle et leurs affectations"
                        cardTitle={(m) => displayName(m)}
                        empty={filtersActive && data.members_count > 0 ? (
                            <EmptyState
                                title="Aucun contrôleur ne correspond"
                                description="Modifiez la recherche ou choisissez « Tous les événements »."
                                actionLabel="Effacer les filtres"
                                onAction={() => {
                                    setSearchQuery('');
                                    setFilterEvent('all');
                                }}
                                icon={<Search size={28} />}
                            />
                        ) : (
                            <EmptyState
                                title="Aucun contrôleur dans votre équipe"
                                description="Invitez vos contrôleurs : ils reçoivent un code par SMS et scannent les billets à l’entrée."
                                actionLabel={assignableEvents.length > 0 ? 'Inviter un premier contrôleur' : undefined}
                                onAction={assignableEvents.length > 0 ? () => setShowInvite(true) : undefined}
                                icon={<Users size={28} />}
                            />
                        )}
                    />
                </>
            )}

            {/* Retrait d'un événement */}
            <ConfirmDialog
                isOpen={!!confirmRemoveSingle}
                onClose={() => setConfirmRemoveSingle(null)}
                onConfirm={() => confirmRemoveSingle && void runAction(
                    `/api/partner/team/${encodeURIComponent(confirmRemoveSingle.eventId)}?assignmentId=${encodeURIComponent(confirmRemoveSingle.assignmentId)}`,
                    'Contrôleur retiré de cet événement.',
                    'Le retrait n’a pas pu être fait.',
                    () => setConfirmRemoveSingle(null),
                )}
                title="Retirer de cet événement ?"
                message={`${confirmRemoveSingle?.ctrlName ?? ''} ne pourra plus contrôler « ${confirmRemoveSingle?.eventTitle ?? ''} ». Ses autres affectations et l’historique de ses scans sont conservés.`}
                confirmLabel="Retirer de l’événement"
                variant="danger"
                isLoading={actionLoading}
            />

            {/* Retrait de tous les événements */}
            <ConfirmDialog
                isOpen={!!confirmRemoveAll}
                onClose={() => setConfirmRemoveAll(null)}
                onConfirm={() => confirmRemoveAll && void runAction(
                    `/api/partner/team/all?controllerId=${encodeURIComponent(confirmRemoveAll.controllerId)}`,
                    'Contrôleur retiré de tous vos événements.',
                    'Le retrait n’a pas pu être fait.',
                    () => setConfirmRemoveAll(null),
                )}
                title="Retirer de tous vos événements ?"
                message={`${confirmRemoveAll?.ctrlName ?? ''} sera retiré de ${confirmRemoveAll ? plural(confirmRemoveAll.eventCount, 'événement', 'événements') : ''}. Son compte et son historique restent intacts.`}
                confirmLabel="Retirer de tous les événements"
                variant="danger"
                isLoading={actionLoading}
            />

            {/* Suppression du contrôleur */}
            <ConfirmDialog
                isOpen={!!confirmDeleteCtrl}
                onClose={() => setConfirmDeleteCtrl(null)}
                onConfirm={() => confirmDeleteCtrl && void runAction(
                    `/api/partner/team/controller/${encodeURIComponent(confirmDeleteCtrl.controllerId)}`,
                    'Contrôleur supprimé de l’équipe.',
                    'La suppression n’a pas pu être faite.',
                    () => setConfirmDeleteCtrl(null),
                )}
                title="Supprimer le contrôleur de l’équipe ?"
                message={`Les accès de ${confirmDeleteCtrl?.ctrlName ?? ''} au scanner sont révoqués immédiatement et sa session est fermée. Pour le réintégrer, une nouvelle invitation sera nécessaire.`}
                confirmLabel="Supprimer le contrôleur"
                variant="danger"
                isLoading={actionLoading}
            />

            {/* Modification des affectations */}
            <Modal
                isOpen={!!editMember}
                onClose={() => setEditMember(null)}
                title="Gérer les affectations"
                subtitle={editMember ? `Contrôleur : ${displayName(editMember)}` : undefined}
                icon={<Settings size={20} aria-hidden="true" />}
                maxWidth="md"
                busy={updatingAssignments}
                footer={
                    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="secondary" onClick={() => setEditMember(null)} disabled={updatingAssignments}>Annuler</Button>
                        <Button variant="primary" onClick={() => void handleSaveAssignments()} isLoading={updatingAssignments}>Enregistrer</Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    {editChoices.length === 0 ? (
                        <p className="text-sm text-fg-muted">Aucun événement validé ou publié n’accepte de contrôleur pour le moment.</p>
                    ) : (
                        <EventChecklist
                            legend={<>Événements autorisés ({editEventIds.length} sur {data?.assignable_events.length ?? 0} assignables)</>}
                            choices={editChoices}
                            selectedIds={editEventIds}
                            onToggle={toggleEditEvent}
                            name="edit-events"
                        />
                    )}
                    <Switch
                        label="Autoriser l’encaissement des espèces"
                        description="Le contrôleur peut encaisser un billet payable à l’entrée et vendre au guichet."
                        checked={editCanCash}
                        onChange={setEditCanCash}
                        disabled={updatingAssignments}
                    />
                </div>
            </Modal>

            {/* Invitation */}
            <Modal
                isOpen={showInvite}
                onClose={() => setShowInvite(false)}
                title="Inviter un contrôleur"
                subtitle="Il reçoit un code d’activation par SMS."
                icon={<UserPlus size={20} aria-hidden="true" />}
                maxWidth="md"
                busy={inviting}
            >
                <form onSubmit={handleInvite} noValidate className="space-y-4">
                    {invError.form && (
                        <p role="alert" className="rounded-xl border border-danger-border bg-danger-bg p-3 text-sm text-danger-fg">{invError.form}</p>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TextInput label="Prénom" aside="Facultatif" placeholder="Ex : Moussa" autoComplete="off" value={invFirstName} onChange={(e) => setInvFirstName(e.target.value)} />
                        <TextInput label="Nom" aside="Facultatif" placeholder="Ex : Diop" autoComplete="off" value={invLastName} onChange={(e) => setInvLastName(e.target.value)} />
                    </div>
                    <TextInput
                        label="Numéro du contrôleur"
                        required
                        type="tel"
                        inputMode="tel"
                        placeholder="77 123 45 67"
                        value={invPhone}
                        error={invError.phone}
                        onChange={(e) => {
                            setInvPhone(e.target.value);
                            setInvError((prev) => ({ ...prev, phone: undefined }));
                        }}
                        className="font-mono"
                    />
                    <TextInput label="Email" aside="Facultatif" type="email" placeholder="controleur@email.com" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} />

                    {assignableEvents.length === 0 ? (
                        <div className="space-y-2 rounded-xl border border-warning-border bg-warning-bg p-4 text-sm text-warning-fg">
                            <p className="font-semibold">Aucun événement disponible</p>
                            <p>Un contrôleur ne peut être affecté qu’à un événement validé ou publié. Faites valider un événement pour l’affecter.</p>
                            <LinkButton href="/partner/events" variant="secondary" size="sm">Voir mes événements</LinkButton>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <EventChecklist
                                legend={<>Événements à assigner <span className="text-danger-fg" aria-hidden="true">*</span> ({invEventIds.length} sur {assignableEvents.length})</>}
                                choices={assignableEvents.map((ev) => ({ ...ev, assignable: true }))}
                                selectedIds={invEventIds}
                                onToggle={toggleInviteEvent}
                                name="invite-events"
                            />
                            {assignableEvents.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={toggleAllInviteEvents}>
                                    {invEventIds.length === assignableEvents.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                                </Button>
                            )}
                            {invError.events && <p role="alert" className="text-sm font-medium text-danger-fg">{invError.events}</p>}
                        </div>
                    )}

                    <Switch
                        label="Encaissement des espèces"
                        description="Autorise l’encaissement à l’entrée et la vente au guichet."
                        checked={invCanCash}
                        onChange={setInvCanCash}
                        disabled={inviting}
                    />

                    <Button type="submit" variant="primary" fullWidth size="lg" isLoading={inviting} disabled={assignableEvents.length === 0}>
                        {invEventIds.length > 1 ? `Inviter sur ${invEventIds.length} événements` : 'Inviter le contrôleur'}
                    </Button>
                </form>
            </Modal>

            {/* Compte existant : attribution du rôle sans doublon */}
            <Modal
                isOpen={!!existingAccountConfirm}
                onClose={() => setExistingAccountConfirm(null)}
                title="Compte existant"
                subtitle="Attribution du rôle de contrôleur, sans nouveau compte"
                icon={<UserCheck size={20} aria-hidden="true" />}
                busy={confirmingPromotion}
                footer={
                    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="secondary" onClick={() => setExistingAccountConfirm(null)} disabled={confirmingPromotion}>Annuler</Button>
                        <Button variant="primary" onClick={() => void handleConfirmPromotion()} isLoading={confirmingPromotion}>Attribuer le rôle de contrôleur</Button>
                    </div>
                }
            >
                {existingAccountConfirm && (
                    <div className="space-y-4">
                        <dl className="space-y-2 rounded-xl border border-border bg-surface-sunken p-4 text-sm">
                            <div className="flex justify-between gap-3">
                                <dt className="text-fg-muted">Titulaire du compte</dt>
                                <dd className="font-semibold text-fg">{existingAccountConfirm.existingUser.display_name}</dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-fg-muted">Numéro</dt>
                                <dd className="font-mono text-fg">{existingAccountConfirm.existingUser.phone}</dd>
                            </div>
                        </dl>
                        <div className="space-y-1.5 rounded-xl border border-success-border bg-success-bg p-4 text-sm leading-relaxed text-success-fg">
                            <p className="flex items-center gap-1.5 font-semibold">
                                <ShieldCheck size={16} aria-hidden="true" /> Un seul compte, rien n’est perdu
                            </p>
                            <p>Cette personne garde ses billets, commandes et son portefeuille, et accède en plus au scanner de vos événements.</p>
                            {existingAccountConfirm.message && <p>{existingAccountConfirm.message}</p>}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
