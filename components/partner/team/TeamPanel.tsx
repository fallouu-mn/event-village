'use client';

/**
 * Finition 1 (E-10, E-11, E-13 à E-21) — la seule liste de l'équipe, sur /partner/team (scope="all" : tous les
 * événements) et dans l'onglet Équipe du pilotage (scope="event" : un événement). Une seule lecture : GET
 * /api/partner/team. Sur téléphone, des cartes ; sur ordinateur, un tableau. Chaque personne : nom, numéro avec
 * « Appeler » et « WhatsApp », état écrit et daté, porte ou point d'entrée et espèces par événement (résumé exact sur la
 * ligne), actions écrites en toutes lettres. Invitations en attente, expirées, refusées et annulées des 30 derniers jours.
 * Boutons d'action seulement si le serveur dit can_manage ; un admin hors de sa fiche donne un motif (journal).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Phone, RefreshCw, Search, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataList } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Select, TextInput } from '@/components/ui/Field';
import { KpiCardSkeleton } from '@/components/ui/KpiCard';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import type { RealtimeStatus } from '@/hooks/useRealtimeRefresh';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { formatTime } from '@/lib/format';
import { errorMessage, sendJson } from '@/components/partner/fetch-json';
import { useServerData } from '@/components/partner/useServerData';
import { ActionDialog, InviteDialog, SettingsDialog } from './TeamDialogs';
import { GateAdmits } from './CategoryPills';
import { LinkButton } from '@/components/ui/LinkButton';
import {
    displayPhone, entriesText, eventWhen, firstNameOf, invitationState, invitationWhatsappMessage, memberName, memberState, placeOf,
    telHref, whatsappHref, whatsappMessage,
} from './team-format';
import { removedFromText, type TeamAssignment, type TeamInvitation, type TeamMember, type TeamScope, type TeamView } from './team-types';
import { eveningCashText, eveningEntriesText } from '@/lib/shifts/evening-format';

type Filter = 'all' | 'ready' | 'pending' | 'nogate' | 'followup';
const FILTERS: Array<{ id: Filter; label: string }> = [
    { id: 'all', label: 'Tous' },
    { id: 'ready', label: 'Prêts' },
    { id: 'pending', label: 'En attente' },
    { id: 'nogate', label: 'Sans porte' },
    { id: 'followup', label: 'À relancer' },
];

type Pending =
    | { kind: 'remove-event'; member: TeamMember; slot: TeamAssignment }
    | { kind: 'remove-team'; member: TeamMember }
    | { kind: 'resend-activation'; member: TeamMember }
    | { kind: 'resend-invitation'; invitation: TeamInvitation }
    | { kind: 'cancel-invitation'; invitation: TeamInvitation }
    | { kind: 'clear-invitation'; invitation: TeamInvitation };

export interface TeamPanelProps {
    scope: TeamScope;
    /** Onglet du pilotage : l'événement. */
    eventId?: string;
    /** Page d'un admin : l'organisateur (?partnerId=). */
    partnerId?: string | null;
    /** Signal temps réel ou « Actualiser » du parent : relance la lecture. */
    signal?: number;
    /** Onglet du pilotage : ouvre un autre onglet (« Caisse », « Entrées »). */
    onOpenTab?: (tab: 'caisse' | 'entrees') => void;
    /** État du canal temps réel du parent ; l'indicateur dit l'heure de la dernière lecture (l'équipe n'est pas suivie en direct). */
    liveStatus?: RealtimeStatus;
}

function ContactButtons({ phone, message, name }: { phone: string | null; message: string; name: string }) {
    const tel = telHref(phone);
    const wa = whatsappHref(phone, message);
    if (!tel || !wa) return null;
    return (
        <div className="flex flex-wrap gap-2">
            <a href={tel} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-fg hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Appeler ${name}`}>
                <Phone size={16} aria-hidden="true" />
                <span>Appeler</span>
            </a>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold text-fg hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Écrire à ${name} sur WhatsApp`}>
                <MessageCircle size={16} aria-hidden="true" />
                <span>WhatsApp</span>
            </a>
        </div>
    );
}

function ShiftAndEntries({ a, scope, onOpenTab }: { a: TeamAssignment; scope: TeamScope; onOpenTab?: TeamPanelProps['onOpenTab'] }) {
    // Cible de 44 px (règle des captures, DoD 7) : lien en ligne mais haut de 44 px
    const linkClass = 'inline-flex min-h-11 items-center font-semibold text-brand-fg underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
    const open = (tab: 'caisse' | 'entrees') => (scope === 'event' && onOpenTab
        ? <button type="button" className={linkClass} onClick={() => onOpenTab(tab)}>{tab === 'caisse' ? 'Caisse ouverte' : entriesText(a)}</button>
        : <a className={linkClass} href={`/partner/events/${a.event_id}?tab=${tab}`}>{tab === 'caisse' ? 'Caisse ouverte' : entriesText(a)}</a>);
    return (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
            {a.open_shift && open('caisse')}
            {a.entries > 0 ? open('entrees') : <span>{entriesText(a)}</span>}
        </span>
    );
}

export function TeamPanel({ scope, eventId, partnerId, signal = 0, onOpenTab, liveStatus = 'live' }: TeamPanelProps) {
    const toast = useToast();
    const [tick, setTick] = useState(0);
    const url = scope === 'event'
        ? `/api/partner/team?eventId=${encodeURIComponent(eventId ?? '')}`
        : `/api/partner/team${partnerId ? `?partnerId=${encodeURIComponent(partnerId)}` : ''}`;
    const { data, error, loading, refreshing, reload } = useServerData<TeamView>(url, signal + tick);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [eventFilter, setEventFilter] = useState('');
    const [filter, setFilter] = useState<Filter>('all');
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteSeed, setInviteSeed] = useState<{ phone?: string; eventIds: string[] } | null>(null);
    const [settingsTarget, setSettingsTarget] = useState<{ member: TeamMember; slot: TeamAssignment } | null>(null);
    const [pending, setPending] = useState<Pending | null>(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    // Relecture de secours toutes les 60 s quand l'écran est visible (acceptation, refus, expiration d'une invitation)
    useEffect(() => {
        const id = window.setInterval(() => {
            if (document.visibilityState === 'visible') setTick((t) => t + 1);
        }, 60_000);
        return () => window.clearInterval(id);
    }, []);
    useEffect(() => {
        if (data) setUpdatedAt(formatTime(new Date().toISOString()));
    }, [data]);

    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const organizer = data?.partner_name ?? 'votre organisateur';
    const canManage = data?.can_manage === true;
    const actsAsAdmin = data?.acts_as_admin === true;
    const eventOpen = scope === 'all' || (data?.event?.assignable ?? false);

    const members = useMemo(() => {
        if (!data) return [];
        const q = query.trim().toLowerCase().replace(/\s/g, '');
        return data.members
            .map((m) => ({ ...m, assignments: eventFilter ? m.assignments.filter((a) => a.event_id === eventFilter) : m.assignments }))
            .filter((m) => m.assignments.length > 0)
            .filter((m) => !q || memberName(m).toLowerCase().replace(/\s/g, '').includes(q) || (m.phone ?? '').includes(q))
            .filter((m) => {
                if (filter === 'ready') return m.account_state === 'ACTIVE';
                if (filter === 'pending') return m.account_state === 'PENDING_ACTIVATION';
                if (filter === 'nogate') return m.assignments.some((a) => !a.past && placeOf(a).missing);
                if (filter === 'followup') return false;
                return true;
            });
    }, [data, query, eventFilter, filter]);

    const invitations = useMemo(() => {
        if (!data) return [];
        return data.invitations
            .filter((i) => !eventFilter || i.events.some((e) => e.id === eventFilter))
            .filter((i) => {
                if (filter === 'followup') return i.state === 'EXPIRED' || i.state === 'DECLINED';
                if (filter === 'pending') return i.state === 'PENDING';
                return filter === 'all';
            });
    }, [data, eventFilter, filter]);

    if (loading) {
        return (
            <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Chargement de l’équipe">
                <KpiCardSkeleton className="min-h-32" />
                <KpiCardSkeleton className="min-h-32" />
                <KpiCardSkeleton className="min-h-32" />
            </div>
        );
    }
    if (error || !data) {
        return <ErrorState title="Équipe indisponible" description={error ?? undefined} onRetry={() => void reload()} isRetrying={refreshing} />;
    }

    const assignableEvents = data.events.filter((e) => e.assignable);
    const eventById = new Map(data.events.map((e) => [e.id, e]));
    const openInvite = (seed?: { phone?: string; eventIds: string[] }): void => {
        setInviteSeed(seed ?? { eventIds: scope === 'event' && eventId ? [eventId] : [] });
        setInviteOpen(true);
    };
    const ask = (p: Pending): void => {
        setReason('');
        setPending(p);
    };
    const withReason = (): Record<string, unknown> => (actsAsAdmin ? { reason: reason.trim() } : {});

    const run = async (): Promise<void> => {
        if (!pending) return;
        setBusy(true);
        try {
            if (pending.kind === 'remove-event') {
                await sendJson(`/api/partner/team/${pending.slot.event_id}?assignmentId=${encodeURIComponent(pending.slot.assignment_id)}`, 'DELETE', withReason());
                toast.success(`${memberName(pending.member)} ne contrôle plus « ${pending.slot.title} ». Il ne peut plus scanner ses billets.`);
            } else if (pending.kind === 'remove-team') {
                const scopeParam = actsAsAdmin ? `?partnerId=${encodeURIComponent(data.partner_id)}` : '';
                const reply = await sendJson<{ deactivated?: boolean }>(`/api/partner/team/controller/${pending.member.user_id}${scopeParam}`, 'DELETE', withReason());
                toast.success(reply.deactivated
                    ? `${memberName(pending.member)} est retiré de votre équipe : son accès au scanner est fermé sur tous ses téléphones.`
                    : `${memberName(pending.member)} est retiré de votre équipe : il ne peut plus scanner vos événements.`);
            } else if (pending.kind === 'resend-activation') {
                const target = pending.member.assignments.find((a) => eventById.get(a.event_id)?.assignable) ?? pending.member.assignments[0];
                const reply = await sendJson<{ message?: string }>('/api/partner/team/invite', 'POST', {
                    event_ids: [target.event_id], phone: pending.member.phone ?? '', resend: true, ...withReason(),
                });
                toast.success(reply.message ?? 'SMS renvoyé.');
            } else {
                const id = pending.invitation.id;
                const path = pending.kind === 'clear-invitation' ? `/api/partner/team/invitations/${id}` : `/api/partner/team/invitations/${id}/${pending.kind === 'resend-invitation' ? 'resend' : 'cancel'}`;
                const reply = await sendJson<{ message?: string }>(path, pending.kind === 'clear-invitation' ? 'DELETE' : 'POST', withReason());
                toast.success(reply.message ?? 'C’est fait.');
            }
            setPending(null);
            await reload();
        } catch (err) {
            toast.error(errorMessage(err, 'Action impossible pour le moment. Réessayez.'));
        } finally {
            setBusy(false);
        }
    };

    const dialog = pendingDialog(pending, data);

    const memberActions = (m: TeamMember, compact = false) => canManage && (
        <div className={cn('flex flex-wrap gap-2', compact && 'justify-end')}>
            {m.account_state === 'PENDING_ACTIVATION' && (
                <Button variant="secondary" size="sm" onClick={() => ask({ kind: 'resend-activation', member: m })}>Renvoyer le SMS d’activation</Button>
            )}
            <Button variant="ghost" size="sm" className="text-danger-fg" onClick={() => ask({ kind: 'remove-team', member: m })}>Retirer de l’équipe</Button>
        </div>
    );
    const assignmentActions = (m: TeamMember, a: TeamAssignment) => canManage && !a.past && (
        <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSettingsTarget({ member: m, slot: a })}>Modifier</Button>
            {scope === 'event' && (
                <Button variant="ghost" size="sm" className="text-danger-fg" onClick={() => ask({ kind: 'remove-event', member: m, slot: a })}>Retirer de cet événement</Button>
            )}
        </div>
    );

    const oneLine = (m: TeamMember, a: TeamAssignment) => {
        const place = placeOf(a);
        return (
            <li key={a.assignment_id} className="flex flex-col gap-2">
                {scope === 'all' && <p className="text-sm font-semibold text-fg">{`${a.title} · ${eventWhen(a.start_at)}`}</p>}
                <p className={cn('text-sm', place.missing ? 'font-semibold text-warning-fg' : 'text-fg')}>{a.gate ? `Porte : ${place.text}` : place.text}</p>
                <GateAdmits categories={a.gate?.categories ?? (a.has_zones ? null : [])} hasZones={a.has_zones} />
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={a.can_accept_cash ? 'success' : 'neutral'}>{a.can_accept_cash ? 'Espèces autorisées' : 'Sans espèces'}</Badge>
                    <ShiftAndEntries a={a} scope={scope} onOpenTab={onOpenTab} />
                </div>
                {assignmentActions(m, a)}
            </li>
        );
    };
    // Complément 10 : un événement terminé (ou annulé) passe dans « Événements passés », sans action possible
    // Complément 9 : avertissements servis par le serveur, événements à venir seulement
    const gateEvents = data.events.filter((e) => !e.past && (scope === 'event' || e.assignable));
    const gateWarnings = gateEvents.flatMap((e) => [
        ...(e.uncovered_categories.length > 0 ? [{
            key: `${e.id}-cat`, eventId: e.id,
            title: scope === 'all' ? `« ${e.title} » : catégorie en vente sans porte` : 'Catégorie en vente sans porte',
            text: `${e.uncovered_categories.map((c) => c.name).join(', ')} : aucune porte ne laisse entrer ces billets. Ajoutez la catégorie à une zone qui a une porte.`,
        }] : []),
        ...(e.gates_without_controller.length > 0 ? [{
            key: `${e.id}-gate`, eventId: e.id,
            title: scope === 'all' ? `« ${e.title} » : porte sans contrôleur` : 'Porte sans contrôleur',
            text: `${e.gates_without_controller.join(', ')} : personne ne contrôle cette porte. Choisissez-la pour un contrôleur avec « Modifier ».`,
        }] : []),
    ]);
    // Finition 2b (B, E-23) : portes, zones et couleurs se règlent à l'étape « Contrôle à l'entrée » du formulaire de
    // l'événement (avant : l'éditeur des zones sous la liste de l'onglet Équipe, qui ne changeait pas les couleurs)
    const gatesLink = (id: string, variant: 'secondary' | 'ghost') => (
        <LinkButton href={`/partner/events/${id}/edit?etape=controle`} variant={variant} size="sm">Modifier les portes et les couleurs</LinkButton>
    );

    const eventLines = (m: TeamMember) => {
        const upcoming = m.assignments.filter((a) => !a.past);
        const past = m.assignments.filter((a) => a.past);
        return (
            <div className="flex flex-col gap-3">
                {upcoming.length > 0 && (
                    <ul className="flex flex-col gap-3" aria-label={`Événements de ${memberName(m)}`}>
                        {upcoming.map((a) => oneLine(m, a))}
                    </ul>
                )}
                {past.length > 0 && (
                    <details className="rounded-xl border border-border px-3 py-2">
                        <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold text-fg-muted">
                            Événements passés
                        </summary>
                        <ul className="mt-2 flex flex-col gap-2" aria-label={`Événements passés de ${memberName(m)}`}>
                            {past.map((a) => (
                                <li key={a.assignment_id} className="text-sm text-fg-muted">
                                    <span className="block text-fg">{`${a.title} · ${eventWhen(a.start_at)}`}</span>
                                    {/* Complément 13 : mêmes chiffres que « Mes soirées » du contrôleur */}
                                    <span className="block tabular-nums">
                                        {a.evening ? `${eveningEntriesText(a.evening.entries)} · ${eveningCashText(a.evening.cash)}` : entriesText(a)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </details>
                )}
            </div>
        );
    };

    return (
        <section className="flex flex-col gap-4" aria-labelledby="equipe-titre">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h2 id="equipe-titre" className="text-lg font-semibold text-fg">{scope === 'event' ? 'Équipe de cet événement' : 'Vos contrôleurs'}</h2>
                    <p className="text-sm text-fg-muted">
                        {`${data.counts.members} contrôleur${data.counts.members > 1 ? 's' : ''} · ${data.counts.ready} prêt${data.counts.ready > 1 ? 's' : ''} · ${data.counts.pending} en attente`}
                    </p>
                    <LiveIndicator status={liveStatus} salesLive={false} updatedTime={updatedAt} className="mt-1" />
                </div>
                <div className="flex flex-wrap gap-2">
                    {scope === 'all' && (
                        <Button variant="secondary" leftIcon={<RefreshCw size={16} aria-hidden="true" />} onClick={() => void reload()} isLoading={refreshing}>Actualiser</Button>
                    )}
                    {canManage && eventOpen && assignableEvents.length > 0 && (
                        <Button variant="primary" leftIcon={<UserPlus size={18} aria-hidden="true" />} onClick={() => openInvite()}>Inviter un contrôleur</Button>
                    )}
                </div>
            </header>

            {scope === 'event' && data.event && !data.event.assignable && (
                <StatusBanner tone="neutral" title={['TERMINE', 'ANNULE'].includes(data.event.status) ? 'Événement terminé : l’équipe ne change plus.' : 'Équipe disponible après la validation'}>
                    {['TERMINE', 'ANNULE'].includes(data.event.status) ? 'La liste reste visible pour mémoire.' : 'Les contrôleurs s’ajoutent dès que l’événement est validé.'}
                </StatusBanner>
            )}
            {data.counts.without_gate > 0 && (
                <StatusBanner tone="warning" title={`${data.counts.without_gate} contrôleur${data.counts.without_gate > 1 ? 's' : ''} sans porte`}
                    action={<Button variant="secondary" size="sm" onClick={() => setFilter('nogate')}>Attribuer les portes</Button>}>
                    {data.counts.without_gate > 1 ? 'Ils ne peuvent pas scanner tant que vous ne leur attribuez pas une porte.' : 'Il ne peut pas scanner tant que vous ne lui attribuez pas une porte.'}
                </StatusBanner>
            )}
            {data.counts.to_follow_up > 0 && (
                <StatusBanner tone="info" title={`${data.counts.to_follow_up} invitation${data.counts.to_follow_up > 1 ? 's' : ''} sans réponse`}
                    action={<Button variant="secondary" size="sm" onClick={() => setFilter('followup')}>Voir</Button>}>
                    Expirées ou refusées : invitez de nouveau ou effacez-les.
                </StatusBanner>
            )}

            {gateWarnings.map((w) => (
                <StatusBanner key={w.key} tone="warning" title={w.title}
                    action={canManage ? gatesLink(w.eventId, 'secondary') : undefined}>
                    {w.text}
                </StatusBanner>
            ))}

            {gateEvents.length > 0 && (
                <details className="rounded-2xl border border-border bg-surface p-4" open={scope === 'event'}>
                    <summary className="min-h-11 cursor-pointer content-center text-base font-semibold text-fg">Portes et couleurs</summary>
                    <ul className="mt-3 flex flex-col gap-4" aria-label="Portes et couleurs des événements">
                        {gateEvents.map((e) => (
                            <li key={e.id} className="flex flex-col gap-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-fg">{`${e.title} · ${eventWhen(e.start_at)}`}</p>
                                    {canManage && gatesLink(e.id, 'ghost')}
                                </div>
                                {e.has_zones ? (
                                    <ul className="flex flex-col gap-2">
                                        {e.gates.map((g) => (
                                            <li key={g.id} className="flex flex-col gap-1">
                                                <p className="text-sm text-fg">{`${g.name} · ${g.zone_name}`}</p>
                                                <GateAdmits categories={g.categories} hasZones />
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-fg-muted">Pas de zones : chaque contrôleur laisse entrer toutes les catégories.</p>
                                )}
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {(scope === 'all' || data.counts.members >= 6) && (
                <div className="flex flex-col gap-3">
                    {scope === 'all' && (
                        <div className="grid gap-3 md:grid-cols-2">
                            <TextInput id="equipe-recherche" label="Rechercher" placeholder="Nom ou numéro" value={query} onChange={(e) => setQuery(e.target.value)} aside={<Search size={16} aria-hidden="true" />} />
                            <Select id="equipe-evenement" label="Événement" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}
                                options={[{ value: '', label: 'Tous les événements' }, ...data.events.map((e) => ({ value: e.id, label: `${e.title} · ${eventWhen(e.start_at)}${e.past ? ' (passé)' : ''}` }))]} />
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer l’équipe">
                        {FILTERS.map((f) => (
                            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
                                className={cn('inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                    filter === f.id ? 'border-brand bg-brand text-on-brand' : 'border-border bg-surface text-fg hover:bg-surface-sunken')}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Complément 12 : la partenaire en tête de son équipe ; elle scanne ses événements sans s'inviter */}
            {!actsAsAdmin && (
                <div className="flex flex-col gap-2 rounded-2xl border border-brand bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <p className="font-semibold text-fg">Vous (organisatrice) — toutes les portes</p>
                        <p className="text-sm text-fg-muted">Vous scannez vos événements dont le contrôle est ouvert, à toutes les portes ou à une porte choisie, et vous vendez au guichet.</p>
                    </div>
                    <LinkButton href="/partner/scan" variant="secondary" size="sm">Scanner les billets</LinkButton>
                </div>
            )}

            {data.members.length === 0 && data.invitations.length === 0 ? (
                <EmptyState
                    title={scope === 'event' ? 'Personne ne contrôle encore cet événement' : assignableEvents.length === 0 ? 'Pas encore d’équipe' : 'Aucun contrôleur dans votre équipe'}
                    description={scope === 'event' ? 'Invitez au moins un contrôleur par porte.' : assignableEvents.length === 0 ? 'Pour inviter un contrôleur, il faut un événement validé ou publié.' : 'Invitez vos contrôleurs : ils reçoivent un SMS et scannent les billets à l’entrée.'}
                    icon={<UserPlus size={28} aria-hidden="true" />}
                    className="my-0"
                />
            ) : (
                <>
                    {filter !== 'followup' && (
                        <>
                            {/* Téléphone : des cartes (renderCard) ; ordinateur : un tableau (DataList, système de design) */}
                            <DataList
                                items={members}
                                getKey={(m) => m.user_id}
                                caption="Contrôleurs de l’équipe"
                                renderCard={(m) => {
                                    const st = memberState(m);
                                    const name = memberName(m);
                                    return (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="break-words text-base font-semibold text-fg">{name}</p>
                                                    <p className="text-sm text-fg-muted">{st.line}</p>
                                                </div>
                                                <Badge variant={st.tone}>{st.badge}</Badge>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <p className="text-sm tabular-nums text-fg">{displayPhone(m.phone)}</p>
                                                <ContactButtons phone={m.phone} name={name} message={whatsappMessage(m, organizer, m.assignments.find((a) => !a.past), origin)} />
                                            </div>
                                            <div className="border-t border-border pt-3">{eventLines(m)}</div>
                                            {memberActions(m)}
                                        </div>
                                    );
                                }}
                                columns={[
                                    {
                                        key: 'controleur', header: 'Contrôleur', className: 'align-top',
                                        render: (m) => (
                                            <div className="flex flex-col gap-2">
                                                <div>
                                                    <p className="font-semibold text-fg">{memberName(m)}</p>
                                                    <p className="tabular-nums text-fg-muted">{displayPhone(m.phone)}</p>
                                                </div>
                                                <ContactButtons phone={m.phone} name={memberName(m)} message={whatsappMessage(m, organizer, m.assignments.find((a) => !a.past), origin)} />
                                            </div>
                                        ),
                                    },
                                    {
                                        key: 'etat', header: 'État', className: 'align-top',
                                        render: (m) => {
                                            const st = memberState(m);
                                            return (
                                                <div className="flex max-w-60 flex-col items-start gap-1">
                                                    <Badge variant={st.tone}>{st.badge}</Badge>
                                                    <p className="text-fg-muted">{st.line}</p>
                                                    {memberActions(m)}
                                                </div>
                                            );
                                        },
                                    },
                                    { key: 'evenements', header: scope === 'all' ? 'Événements, porte et espèces' : 'Porte et espèces', className: 'align-top', render: (m) => eventLines(m) },
                                ]}
                            />
                            {members.length === 0 && data.members.length > 0 && <p className="text-sm text-fg-muted">Aucun contrôleur ne correspond à ce filtre.</p>}
                        </>
                    )}

                    {invitations.length > 0 && (
                        <section className="flex flex-col gap-3" aria-labelledby="equipe-invitations">
                            <h3 id="equipe-invitations" className="text-base font-semibold text-fg">Invitations</h3>
                            <ul className="flex flex-col gap-3" aria-label="Invitations">
                                {invitations.map((inv) => {
                                    const st = invitationState(inv);
                                    return (
                                        <li key={inv.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 md:flex-row md:items-start md:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="font-semibold text-fg">{inv.display_name}</p>
                                                    <Badge variant={st.tone}>{st.badge}</Badge>
                                                </div>
                                                {inv.phone_entered && <p className="text-sm tabular-nums text-fg">{displayPhone(inv.phone_entered)}</p>}
                                                <p className="text-sm text-fg-muted">{st.line}</p>
                                            </div>
                                            <div className="flex flex-col gap-2 md:items-end">
                                                {inv.state === 'PENDING' && <ContactButtons phone={inv.phone_entered} name={inv.display_name} message={invitationWhatsappMessage(inv, organizer, origin)} />}
                                                {canManage && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {inv.state === 'PENDING' ? (
                                                            <>
                                                                <Button variant="secondary" size="sm" onClick={() => ask({ kind: 'resend-invitation', invitation: inv })}>Renvoyer l’invitation</Button>
                                                                <Button variant="ghost" size="sm" className="text-danger-fg" onClick={() => ask({ kind: 'cancel-invitation', invitation: inv })}>Annuler l’invitation</Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {inv.phone_entered && inv.events.some((e) => e.assignable) && (
                                                                    <Button variant="secondary" size="sm" onClick={() => openInvite({ phone: inv.phone_entered ?? undefined, eventIds: inv.events.filter((e) => e.assignable).map((e) => e.id) })}>Inviter de nouveau</Button>
                                                                )}
                                                                <Button variant="ghost" size="sm" onClick={() => ask({ kind: 'clear-invitation', invitation: inv })}>Effacer</Button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}
                    {filter === 'followup' && invitations.length === 0 && <p className="text-sm text-fg-muted">Aucune invitation à relancer.</p>}
                </>
            )}

            <InviteDialog
                isOpen={inviteOpen}
                onClose={() => setInviteOpen(false)}
                events={scope === 'event' ? data.events : assignableEvents}
                defaultEventIds={inviteSeed?.eventIds ?? []}
                initialPhone={inviteSeed?.phone}
                actsAsAdmin={actsAsAdmin}
                onDone={reload}
            />
            <SettingsDialog
                target={settingsTarget}
                event={settingsTarget ? eventById.get(settingsTarget.slot.event_id) : undefined}
                actsAsAdmin={actsAsAdmin}
                onClose={() => setSettingsTarget(null)}
                onDone={reload}
            />
            {dialog && (
                <ActionDialog
                    isOpen={pending !== null}
                    onClose={() => { if (!busy) setPending(null); }}
                    onConfirm={() => void run()}
                    title={dialog.title}
                    lines={dialog.lines}
                    confirmLabel={dialog.confirm}
                    variant={dialog.variant}
                    busy={busy}
                    actsAsAdmin={actsAsAdmin}
                    reason={reason}
                    onReason={setReason}
                />
            )}
        </section>
    );
}

/** Textes exacts des fenêtres de confirmation (revue d'ergonomie, section 3.2) : ce qui se passe, et c'est vrai. */
function pendingDialog(p: Pending | null, data: TeamView | undefined): { title: string; lines: string[]; confirm: string; variant: 'danger' | 'warning' | 'default' } | null {
    if (!p || !data) return null;
    switch (p.kind) {
        case 'remove-event': {
            const name = memberName(p.member);
            return {
                title: `Retirer ${name} de « ${p.slot.title} » ?`,
                lines: [
                    'Son scanner est refusé pour cet événement dès votre confirmation, même sur un téléphone déjà ouvert. Il reçoit un SMS et un avis. Ses scans déjà faits restent dans les entrées.',
                    ...(p.slot.open_shift ? [`${name} a une caisse ouverte sur cet événement : fermez-la d’abord dans l’onglet Caisse, sinon le retrait sera refusé.`] : []),
                ],
                confirm: 'Retirer de cet événement',
                variant: 'danger',
            };
        }
        case 'remove-team': {
            const name = memberName(p.member);
            const n = data.members.find((m) => m.user_id === p.member.user_id)?.assignments.length ?? p.member.assignments.length;
            return {
                title: `Retirer ${name} de votre équipe ?`,
                lines: [
                    `${removedFromText(firstNameOf(p.member), n)} et reçoit un SMS et un avis. Son scanner est refusé pour vos événements dès votre confirmation, même sur un téléphone déjà ouvert.`,
                    p.member.other_organizers
                        ? 'Il continue de contrôler pour les autres organisateurs qui l’ont invité.'
                        : 'Son accès au scanner est fermé et il est déconnecté de l’application sur tous ses téléphones, espace client compris. Il pourra se reconnecter pour ses billets.',
                    'Pour le reprendre, invitez-le de nouveau.',
                ],
                confirm: 'Retirer de l’équipe',
                variant: 'danger',
            };
        }
        case 'resend-activation':
            return {
                title: `Renvoyer le code à ${memberName(p.member)} ?`,
                lines: [`Un SMS part vers le ${displayPhone(p.member.phone)} avec un nouveau code valable 24 h ; l’ancien code ne marche plus. 3 envois au plus par jour vers ce numéro.`],
                confirm: 'Renvoyer le SMS',
                variant: 'default',
            };
        case 'resend-invitation':
            return {
                title: `Renvoyer l’invitation à ${p.invitation.display_name} ?`,
                lines: ['Un nouveau SMS part et l’invitation est prolongée de 72 h. 3 envois au plus par jour vers ce numéro.'],
                confirm: 'Renvoyer l’invitation',
                variant: 'default',
            };
        case 'cancel-invitation':
            return {
                title: `Annuler l’invitation de ${p.invitation.display_name} ?`,
                lines: ['Le lien du SMS ne mènera plus à rien : il verra « Aucune invitation en attente ». Aucun message ne lui est envoyé.'],
                confirm: 'Annuler l’invitation',
                variant: 'danger',
            };
        default:
            return {
                title: 'Effacer cette invitation ?',
                lines: ['Elle disparaît de votre équipe. Vous pourrez toujours inviter ce numéro de nouveau.'],
                confirm: 'Effacer',
                variant: 'default',
            };
    }
}
