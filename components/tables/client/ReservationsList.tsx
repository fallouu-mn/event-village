'use client';

/**
 * Lot 11b (écrans du client) : « Mes réservations » de tables. Deux onglets dans l'adresse (?tab=) : « À venir »
 * (réservations qui tiennent une table à venir, la plus proche d'abord) et « Passées et annulées ». Chaque
 * réservation : établissement (photo), état en mots et ton de la route (jamais un code), jour, heure, personnes, table,
 * échéance avec compte à rebours (acompte à payer, réponse attendue, table gardée jusqu'à…), lien vers le détail.
 */
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Search, UtensilsCrossed } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { TabPanel, Tabs, useTabParam } from '@/components/ui/Tabs';
import { eventImageSrc } from '@/lib/events/event-image';
import { fcfaText } from '@/lib/tables/views';
import type { TableReservationView } from '@/lib/tables/queries';
import { ReservationDeadline } from './ReservationDeadline';
import { badgeVariantOf, reservationLine } from './format';
import { useNow } from './useNow';

export type ReservationTab = 'a-venir' | 'passees';
const TABS: readonly ReservationTab[] = ['a-venir', 'passees'];
const PREFIX = 'mes-tables';

function ReservationItem({ r, now }: { r: TableReservationView; now: number | null }) {
    const where = [r.tableNumber ? `Table ${r.tableNumber}` : null, r.zoneName].filter(Boolean).join(' · ');
    return (
        <Link
            href={`/tables/reservations/${r.id}`}
            className="group flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow duration-fast ease-standard hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <div className="relative hidden h-20 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted min-[400px]:block">
                <Image src={eventImageSrc(r.venuePhoto)} alt="" fill sizes="96px" loading="lazy" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
                <Badge variant={badgeVariantOf(r.tone)}>{r.stateLabel}</Badge>
                <h3 className="break-words text-base font-bold text-foreground-strong group-hover:underline group-hover:underline-offset-4">{r.venueName}</h3>
                <p className="flex items-start gap-1.5 text-sm text-foreground">
                    <CalendarDays size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="tabular-nums">{reservationLine(r.date, r.time, r.guests)}</span>
                </p>
                {(where || r.venueCity) && <p className="break-words text-sm text-muted-foreground">{[where, r.venueCity].filter(Boolean).join(' · ')}</p>}
                {r.depositAmount > 0 && (
                    <p className="text-sm text-muted-foreground">
                        {'Acompte : '}
                        <span className="font-semibold tabular-nums text-foreground-strong">{fcfaText(r.depositAmount)}</span>
                        {r.paidAmount > 0 ? ' · payé' : ''}
                        {r.refundedAmount > 0 && <span>{` · remboursé : ${fcfaText(r.refundedAmount)}`}</span>}
                    </p>
                )}
                {r.live && r.upcoming && <ReservationDeadline r={r} now={now} />}
            </div>
            <ChevronRight size={20} className="mt-1 flex-shrink-0 self-center text-muted-foreground" aria-hidden="true" />
        </Link>
    );
}

export function ReservationsList({ reservations, initialTab }: { reservations: TableReservationView[]; initialTab: ReservationTab }) {
    const [tab, setTab] = useTabParam<ReservationTab>(TABS, 'a-venir', 'tab', initialTab);
    const upcoming = reservations
        .filter((r) => r.live && r.upcoming)
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    const past = reservations
        .filter((r) => !(r.live && r.upcoming))
        .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
    const shown = tab === 'a-venir' ? upcoming : past;
    const hasHold = upcoming.some((r) => r.state === 'EN_ATTENTE_PAIEMENT');
    const now = useNow(hasHold ? 1000 : 30_000);

    return (
        <div className="space-y-2">
            <PageHeader
                title="Mes réservations"
                description="Vos tables réservées : jour, heure, état et ce qu’il reste à faire."
                back={{ href: '/tables', label: 'Réserver une table' }}
                actions={<LinkButton href="/tables" variant="secondary" leftIcon={<Search size={18} />}>Réserver une table</LinkButton>}
            />
            <Tabs
                ariaLabel="Mes réservations de table"
                idPrefix={PREFIX}
                value={tab}
                onChange={(id) => setTab(id === 'passees' ? 'passees' : 'a-venir')}
                tabs={[
                    { id: 'a-venir', label: 'À venir', count: upcoming.length },
                    { id: 'passees', label: 'Passées et annulées', count: past.length },
                ]}
            />
            <TabPanel idPrefix={PREFIX} tabIdValue={tab} className="pt-4">
                {shown.length === 0 ? (
                    tab === 'a-venir' ? (
                        <EmptyState
                            icon={<UtensilsCrossed size={28} />}
                            title="Aucune table réservée"
                            description="Choisissez un restaurant, un bar ou un espace, puis votre heure : la réservation prend moins d’une minute."
                            actionLabel="Réserver une table"
                            actionHref="/tables"
                        />
                    ) : (
                        <EmptyState
                            icon={<CalendarDays size={28} />}
                            title="Aucune réservation passée ou annulée"
                            description="Vos anciennes réservations de table s’afficheront ici."
                        />
                    )
                ) : (
                    <ul className="ev-stagger space-y-3">
                        {shown.map((r) => (
                            <li key={r.id}>
                                <ReservationItem r={r} now={now} />
                            </li>
                        ))}
                    </ul>
                )}
            </TabPanel>
        </div>
    );
}
