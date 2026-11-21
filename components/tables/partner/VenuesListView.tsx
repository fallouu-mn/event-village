'use client';

/**
 * Lot 11b : « Mes établissements » (GET /api/partner/venues). Chaque établissement : photo, genre et ville, statut de
 * validation en mots avec son ton et son explication, motif s'il est refusé ou suspendu, nombre de tables, réservations
 * du jour, demandes à accepter (pastille), puis le bouton principal « Planning du jour » et « Modifier » (ou « Corriger
 * et renvoyer » s'il est refusé). Liens « Recettes » et « Ajouter un établissement ». Page ouverte même service fermé.
 * États : chargement (squelette), erreur avec « Réessayer », aucun établissement (état vide illustré).
 */
import React from 'react';
import { BellRing, CalendarClock, ChevronRight, LayoutGrid, MapPin, Pencil, PencilLine, Plus, Store, Utensils, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useServerData } from '@/components/partner/useServerData';
import { formatInteger } from '@/lib/format';
import { VenuesListSkeleton } from './TablesSkeletons';
import { toneVariant, type PartnerVenueRow } from './venue-api';

function Stat({ label, value, tone = 'neutral', icon }: { label: string; value: number; tone?: 'neutral' | 'warning'; icon: React.ReactNode }) {
    return (
        <div className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2',
            tone === 'warning' ? 'border border-warning-border bg-warning-soft text-warning-text' : 'bg-muted text-muted-foreground',
        )}
        >
            <span aria-hidden="true" className="order-1 flex-shrink-0">{icon}</span>
            <dt className="order-3 text-sm font-medium">{label}</dt>
            <dd className="order-2 text-base font-bold text-foreground-strong tabular-nums">{formatInteger(value)}</dd>
        </div>
    );
}

function pendingText(n: number): string {
    return n === 1 ? '1 demande à accepter' : `${formatInteger(n)} demandes à accepter`;
}

function VenueCard({ venue, first }: { venue: PartnerVenueRow; first: boolean }) {
    const href = `/partner/tables/${encodeURIComponent(venue.id)}`;
    const editHref = `/partner/tables/edition/${encodeURIComponent(venue.id)}`;
    const refused = venue.status === 'REFUSEE';
    const suspended = venue.status === 'SUSPENDUE';
    const titleId = `etablissement-${venue.id}`;
    const meta = [venue.kindLabel, venue.city].filter(Boolean).join(' · ');

    return (
        <article aria-labelledby={titleId} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:flex-row">
            <div className="relative aspect-[16/10] w-full flex-shrink-0 bg-muted sm:aspect-auto sm:w-56">
                {venue.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- photo de l'établissement (stockage du projet), cadre fixe réservé
                    <img src={venue.photo} alt="" loading={first ? 'eager' : 'lazy'} decoding="async" className="h-full w-full object-cover sm:absolute sm:inset-0" />
                ) : (
                    <div className="flex h-full min-h-32 w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Store size={28} aria-hidden="true" />
                        <span className="text-sm">Aucune photo</span>
                    </div>
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={toneVariant(venue.statusTone)}>{venue.statusLabel}</Badge>
                    {!venue.isActive && <Badge variant="neutral">Désactivé</Badge>}
                    {venue.pendingCount > 0 && (
                        <Badge variant="warning" icon={<BellRing size={12} aria-hidden="true" />}>{pendingText(venue.pendingCount)}</Badge>
                    )}
                </div>
                <div className="min-w-0">
                    <h2 id={titleId} className="break-words text-lg font-bold leading-snug text-foreground-strong">{venue.name}</h2>
                    {meta && <p className="mt-1 text-sm text-muted-foreground">{meta}</p>}
                    {venue.address && (
                        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MapPin size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{venue.address}</span>
                        </p>
                    )}
                </div>

                {refused ? (
                    <StatusBanner tone="danger" title="Refusé : motif de l’équipe d’Event Village">
                        <span className="block whitespace-pre-line break-words text-base font-medium text-foreground-strong">
                            {venue.reason?.trim() || 'Aucun motif n’a été transmis.'}
                        </span>
                    </StatusBanner>
                ) : suspended ? (
                    <StatusBanner tone="suspended" title="Suspendu par l’équipe d’Event Village">
                        <span className="block">{venue.statusHint}</span>
                        {venue.reason && <span className="mt-1 block whitespace-pre-line break-words font-medium text-foreground-strong">{venue.reason}</span>}
                    </StatusBanner>
                ) : venue.status !== 'VALIDEE' && venue.statusHint ? (
                    <p className="text-sm leading-relaxed text-foreground">{venue.statusHint}</p>
                ) : null}

                <dl className="flex flex-wrap gap-2">
                    <Stat label={venue.tablesCount === 1 ? 'table' : 'tables'} value={venue.tablesCount} icon={<LayoutGrid size={16} />} />
                    <Stat label={venue.todayCount === 1 ? 'réservation aujourd’hui' : 'réservations aujourd’hui'} value={venue.todayCount} icon={<CalendarClock size={16} />} />
                    <Stat label="à accepter" value={venue.pendingCount} tone={venue.pendingCount > 0 ? 'warning' : 'neutral'} icon={<BellRing size={16} />} />
                </dl>

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    <LinkButton href={href} rightIcon={<ChevronRight size={18} />} aria-describedby={titleId}>Planning du jour</LinkButton>
                    {refused ? (
                        <LinkButton href={editHref} variant="secondary" leftIcon={<PencilLine size={18} />} aria-describedby={titleId}>Corriger et renvoyer</LinkButton>
                    ) : (
                        <LinkButton href={editHref} variant="secondary" leftIcon={<Pencil size={18} />} aria-describedby={titleId}>Modifier</LinkButton>
                    )}
                </div>
            </div>
        </article>
    );
}

export function VenuesListView() {
    const { data, error, loading, refreshing, reload } = useServerData<{ venues: PartnerVenueRow[] }>('/api/partner/venues');

    if (loading && !data) {
        return (
            <div role="status" aria-busy="true">
                <VenuesListSkeleton />
                <span className="sr-only">Chargement de vos établissements…</span>
            </div>
        );
    }

    const venues = Array.isArray(data?.venues) ? data.venues : [];
    const pending = venues.reduce((n, v) => n + (v.pendingCount > 0 ? v.pendingCount : 0), 0);
    const today = venues.reduce((n, v) => n + (v.todayCount > 0 ? v.todayCount : 0), 0);

    const description = venues.length === 0
        ? 'Vos restaurants, bars et espaces : le planning du jour, les demandes et les recettes.'
        : [
            venues.length === 1 ? '1 établissement' : `${formatInteger(venues.length)} établissements`,
            today === 0 ? 'aucune réservation aujourd’hui' : today === 1 ? '1 réservation aujourd’hui' : `${formatInteger(today)} réservations aujourd’hui`,
        ].join(' · ') + '.';

    return (
        <div className="mx-auto w-full max-w-5xl pb-10">
            <PageHeader
                title="Mes établissements"
                description={description}
                actions={(
                    <>
                        <LinkButton href="/partner/tables/recettes" variant="secondary" leftIcon={<Wallet size={18} />}>Recettes</LinkButton>
                        <LinkButton href="/partner/tables/edition/nouveau" leftIcon={<Plus size={18} />}>Ajouter un établissement</LinkButton>
                    </>
                )}
            />

            {error && !data ? (
                <ErrorState
                    title="Vos établissements n’ont pas pu être chargés"
                    description={error}
                    onRetry={() => void reload()}
                    isRetrying={refreshing}
                />
            ) : venues.length === 0 ? (
                <EmptyState
                    icon={<Utensils size={28} />}
                    title="Aucun établissement pour le moment"
                    description="Ajoutez votre restaurant, votre bar ou votre espace avec ses tables : il sera vérifié par l’équipe d’Event Village avant d’être réservable."
                    actionLabel="Ajouter un établissement"
                    actionHref="/partner/tables/edition/nouveau"
                />
            ) : (
                <div className="flex flex-col gap-4">
                    {error && (
                        <p role="alert" className="text-sm font-medium text-danger-text">
                            La liste n’a pas pu être actualisée : elle peut ne pas être à jour.
                        </p>
                    )}
                    {pending > 0 && (
                        <StatusBanner tone="warning" title={pending === 1 ? 'Une demande attend votre réponse' : `${formatInteger(pending)} demandes attendent votre réponse`}>
                            Ouvrez le planning de l’établissement concerné pour accepter ou refuser. Sans réponse à temps, la demande est annulée et le client remboursé.
                        </StatusBanner>
                    )}
                    {venues.map((v, i) => <VenueCard key={v.id} venue={v} first={i === 0} />)}
                </div>
            )}
        </div>
    );
}
