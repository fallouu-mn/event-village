'use client';

/**
 * Lot 10b (point 3) : « Mes réservations » de salles. Deux onglets dans l'adresse (?tab=) : « À venir » (réservations
 * qui tiennent une date à venir, la plus proche d'abord) et « Passées et annulées ». Chaque réservation : salle, date(s),
 * état en mots et ton de la route (jamais un code), montant payé sur le total, échéance du solde mise en avant quand il
 * en reste un, heure limite de paiement pendant l'attente, lien vers le détail. Montants lus dans la réponse.
 */
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AlarmClock, CalendarDays, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { TabPanel, Tabs, useTabParam } from '@/components/ui/Tabs';
import { eventImageSrc } from '@/lib/events/event-image';
import { dakarDate, dakarTime, fcfaText, periodText } from '@/lib/halls/views';
import type { ReservationView } from '@/lib/halls/queries';
import { badgeVariantOf, capitalize } from './format';

export type ReservationTab = 'a-venir' | 'passees';
const TABS: readonly ReservationTab[] = ['a-venir', 'passees'];
const PREFIX = 'mes-salles';

function ReservationItem({ r }: { r: ReservationView }) {
    const period = capitalize(periodText({ start_date: r.startDate, end_date: r.endDate, start_time: r.startTime, end_time: r.endTime }));
    return (
        <Link
            href={`/halls/reservations/${r.id}`}
            className="group flex gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow duration-fast ease-standard hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <div className="relative hidden h-20 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted min-[400px]:block">
                <Image src={eventImageSrc(r.hallPhoto)} alt="" fill sizes="96px" loading="lazy" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariantOf(r.stateTone)}>{r.stateLabel}</Badge>
                </div>
                <h3 className="break-words text-base font-bold text-foreground-strong group-hover:underline group-hover:underline-offset-4">{r.hallName}</h3>
                <p className="flex items-start gap-1.5 text-sm text-foreground">
                    <CalendarDays size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{period}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                    {'Payé : '}
                    <span className="font-semibold tabular-nums text-foreground-strong">{fcfaText(r.paidAmount)}</span>
                    {` sur ${fcfaText(r.totalAmount)}`}
                    {r.refundedAmount > 0 && <span>{` · remboursé : ${fcfaText(r.refundedAmount)}`}</span>}
                </p>
                {r.balanceDueAt && r.remainingAmount > 0 && (
                    <p className="flex items-start gap-1.5 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-text">
                        <AlarmClock size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>{`Solde de ${fcfaText(r.remainingAmount)} à payer avant le ${dakarDate(r.balanceDueAt)} à ${dakarTime(r.balanceDueAt)}`}</span>
                    </p>
                )}
                {r.holdExpiresAt && (
                    <p className="flex items-start gap-1.5 rounded-lg border border-warning-border bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-text">
                        <AlarmClock size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>{`À payer avant ${dakarTime(r.holdExpiresAt)} pour garder la date`}</span>
                    </p>
                )}
            </div>
            <ChevronRight size={20} className="mt-1 flex-shrink-0 self-center text-muted-foreground" aria-hidden="true" />
        </Link>
    );
}

export function ReservationsView({ reservations, initialTab }: { reservations: ReservationView[]; initialTab: ReservationTab }) {
    const [tab, setTab] = useTabParam<ReservationTab>(TABS, 'a-venir', 'tab', initialTab);
    const upcoming = reservations
        .filter((r) => r.live && r.upcoming)
        .sort((a, b) => (a.startDate + (a.startTime ?? '')).localeCompare(b.startDate + (b.startTime ?? '')));
    const past = reservations
        .filter((r) => !(r.live && r.upcoming))
        .sort((a, b) => (b.startDate + (b.startTime ?? '')).localeCompare(a.startDate + (a.startTime ?? '')));
    const shown = tab === 'a-venir' ? upcoming : past;

    return (
        <div className="space-y-2">
            <PageHeader
                title="Mes réservations"
                description="Vos salles de fête réservées : dates, paiements et solde à régler."
                back={{ href: '/halls', label: 'Salles de fête' }}
                actions={<LinkButton href="/halls" variant="secondary" leftIcon={<Search size={18} />}>Trouver une salle</LinkButton>}
            />
            <Tabs
                ariaLabel="Mes réservations de salle"
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
                            icon={<CalendarDays size={28} />}
                            title="Aucune réservation à venir"
                            description="Trouvez une salle libre à votre date : le prix exact s’affiche avant de payer."
                            actionLabel="Trouver une salle"
                            actionHref="/halls"
                        />
                    ) : (
                        <EmptyState
                            icon={<CalendarDays size={28} />}
                            title="Aucune réservation passée ou annulée"
                            description="Vos anciennes réservations de salle s’afficheront ici."
                        />
                    )
                ) : (
                    <ul className="space-y-3">
                        {shown.map((r) => (
                            <li key={r.id}>
                                <ReservationItem r={r} />
                            </li>
                        ))}
                    </ul>
                )}
            </TabPanel>
        </div>
    );
}
