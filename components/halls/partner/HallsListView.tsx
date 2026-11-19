'use client';

/**
 * Lot 10b (point 3) : « Mes salles » de la propriétaire (GET /api/partner/halls).
 * Chaque salle : photo principale, nom, statut en mots avec son ton et son explication (statusHint du serveur), motif
 * si elle est refusée ou suspendue, réservations à venir ; actions Voir, Modifier, Calendrier, « Renvoyer en
 * validation » (refusée), retirer de la vente ou remettre, supprimer (useHallActions). Liens vers les recettes et
 * l'ajout d'une salle. États : chargement, erreur avec « Réessayer », aucune salle.
 * Lot 10b (correctifs, point 2) : salle refusée : bandeau d'erreur avec le motif tel quel et bouton principal
 * « Corriger et renvoyer » (ouvre la modification, qui enregistre puis renvoie en validation) ; « Renvoyer sans
 * modifier » reste possible. Salle suspendue : motif dans un bandeau.
 */
import React from 'react';
import { Building2, CalendarDays, Eye, MapPin, Pencil, PencilLine, Plus, Send, Trash2, Users, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useServerData } from '@/components/partner/useServerData';
import { fcfaText } from '@/lib/halls/views';
import { formatInteger } from '@/lib/format';
import { HallListSkeleton } from './HallSkeletons';
import { showsReason, toneVariant, type PartnerHallRow } from './hall-api';
import { useHallActions } from './useHallActions';

function upcomingText(n: number): string {
    if (n <= 0) return 'Aucune réservation à venir';
    return n === 1 ? '1 réservation à venir' : `${formatInteger(n)} réservations à venir`;
}

function HallCard({ hall, first, actions }: { hall: PartnerHallRow; first: boolean; actions: ReturnType<typeof useHallActions> }) {
    const href = `/partner/halls/${encodeURIComponent(hall.id)}`;
    const photo = Array.isArray(hall.images) ? hall.images.find((u) => typeof u === 'string' && u) ?? null : null;
    const busy = actions.busyId === hall.id;
    const refused = hall.validation_status === 'REFUSEE';
    const ref = { id: hall.id, name: hall.name };
    const titleId = `salle-${hall.id}`;
    const meta = [
        hall.city,
        hall.capacity ? `${formatInteger(hall.capacity)} personnes` : null,
        hall.price_per_day ? `${fcfaText(hall.price_per_day)} par jour` : null,
    ].filter(Boolean).join(' · ');

    return (
        <article aria-labelledby={titleId} className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm sm:flex-row" aria-busy={busy}>
            <div className="relative aspect-[16/10] w-full flex-shrink-0 bg-muted sm:aspect-auto sm:w-56">
                {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- photo de la salle (stockage du projet), cadre fixe réservé
                    <img src={photo} alt="" loading={first ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-cover sm:absolute sm:inset-0" />
                ) : (
                    <div className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Building2 size={28} aria-hidden="true" />
                        <span className="text-sm">Aucune photo</span>
                    </div>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={toneVariant(hall.statusTone)}>{hall.statusLabel}</Badge>
                    {!hall.is_active && <Badge variant="neutral">Retirée de la vente</Badge>}
                </div>
                <div className="min-w-0">
                    <h2 id={titleId} className="break-words text-lg font-bold leading-snug text-foreground-strong">{hall.name}</h2>
                    {meta && <p className="mt-1 text-sm text-muted-foreground tabular-nums">{meta}</p>}
                    {hall.address && (
                        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MapPin size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{hall.address}</span>
                        </p>
                    )}
                </div>
                {hall.statusHint && <p className="text-sm leading-relaxed text-foreground">{hall.statusHint}</p>}
                {refused ? (
                    <StatusBanner tone="danger" title="Salle refusée : motif de l’équipe d’Event Village">
                        <span className="block whitespace-pre-line break-words text-base font-medium text-foreground-strong">
                            {hall.validation_reason?.trim() || 'Aucun motif n’a été transmis.'}
                        </span>
                    </StatusBanner>
                ) : showsReason(hall.validation_status) && hall.validation_reason ? (
                    <StatusBanner tone="suspended" title="Motif de l’équipe d’Event Village">
                        <span className="block whitespace-pre-line break-words text-base font-medium text-foreground-strong">{hall.validation_reason}</span>
                    </StatusBanner>
                ) : null}
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground-strong">
                    <CalendarDays size={16} className="flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    {upcomingText(hall.upcomingCount)}
                </p>

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {refused && (
                        <LinkButton href={`${href}/edit`} size="sm" leftIcon={<PencilLine size={16} />} aria-describedby={titleId}>Corriger et renvoyer</LinkButton>
                    )}
                    <LinkButton href={href} variant="secondary" size="sm" leftIcon={<Eye size={16} />} aria-describedby={titleId}>Voir</LinkButton>
                    {!refused && (
                        <LinkButton href={`${href}/edit`} variant="secondary" size="sm" leftIcon={<Pencil size={16} />} aria-describedby={titleId}>Modifier</LinkButton>
                    )}
                    <LinkButton href={`${href}#calendrier`} variant="ghost" size="sm" leftIcon={<CalendarDays size={16} />} aria-describedby={titleId}>Calendrier</LinkButton>
                    {refused && (
                        <Button variant="secondary" size="sm" leftIcon={<Send size={16} />} aria-describedby={titleId} isLoading={busy} disabled={actions.busyId !== null} onClick={() => void actions.submit(ref)}>
                            Renvoyer sans modifier
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={actions.busyId !== null}
                        onClick={() => actions.ask(hall.is_active ? 'deactivate' : 'activate', ref)}
                        aria-describedby={titleId}
                    >
                        {hall.is_active ? 'Retirer de la vente' : 'Remettre en vente'}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 size={16} />}
                        className="text-danger-text hover:bg-danger-soft"
                        disabled={actions.busyId !== null}
                        onClick={() => actions.ask('delete', ref)}
                        aria-describedby={titleId}
                    >
                        Supprimer
                    </Button>
                </div>
            </div>
        </article>
    );
}

export function HallsListView() {
    const { data, error, loading, refreshing, reload } = useServerData<{ halls: PartnerHallRow[] }>('/api/partner/halls');
    const actions = useHallActions({ onChanged: () => void reload() });

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <HallListSkeleton />
                <span className="sr-only">Chargement de vos salles…</span>
            </div>
        );
    }

    const halls = Array.isArray(data?.halls) ? data.halls : [];
    const upcoming = halls.reduce((n, h) => n + (h.upcomingCount > 0 ? 1 : 0), 0);

    return (
        <div className="mx-auto w-full max-w-5xl pb-10">
            <PageHeader
                title="Mes salles"
                description={halls.length > 0
                    ? `${halls.length === 1 ? '1 salle' : `${formatInteger(halls.length)} salles`}${upcoming > 0 ? `, dont ${upcoming === 1 ? '1 avec' : `${formatInteger(upcoming)} avec`} des réservations à venir` : ''}.`
                    : 'Vos salles de fête, leur statut et leurs réservations.'}
                actions={(
                    <>
                        <LinkButton href="/partner/halls/recettes" variant="secondary" leftIcon={<Wallet size={18} />}>Recettes</LinkButton>
                        <LinkButton href="/partner/halls/new" leftIcon={<Plus size={18} />}>Ajouter une salle</LinkButton>
                    </>
                )}
            />

            {actions.banner}

            {error && !data ? (
                <ErrorState
                    title="Vos salles n’ont pas pu être chargées"
                    description={error}
                    onRetry={() => void reload()}
                    isRetrying={refreshing}
                />
            ) : halls.length === 0 ? (
                <EmptyState
                    icon={<Building2 size={28} />}
                    title="Aucune salle pour le moment"
                    description="Ajoutez votre première salle : elle sera vérifiée par l’équipe d’Event Village avant d’être visible des clients."
                    actionLabel="Ajouter une salle"
                    actionHref="/partner/halls/new"
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {error && (
                        <p role="alert" className="text-sm font-medium text-danger-text">
                            La liste n’a pas pu être actualisée : elle peut ne pas être à jour.
                        </p>
                    )}
                    {halls.map((h, i) => <HallCard key={h.id} hall={h} first={i === 0} actions={actions} />)}
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Users size={16} aria-hidden="true" />
                        Les coordonnées d’un client s’affichent dans le détail d’une réservation, une fois l’acompte payé.
                    </p>
                </div>
            )}

            {actions.dialog}
        </div>
    );
}
