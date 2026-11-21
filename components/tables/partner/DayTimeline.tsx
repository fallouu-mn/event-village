'use client';

/**
 * Lot 11b : frise du jour, par heure. Chaque réservation : heure et fin du créneau, personnes, table et zone, prénom du
 * client, téléphone cliquable (seulement si la route le donne), demande particulière, « A confirmé sa venue », « Table
 * gardée jusqu'à … », acompte payé et paiement sur place (montants de la route), état en mots ; actions selon l'heure
 * (règles de partnerReservation, à l'heure du serveur) : « Client arrivé », « Client absent », « Paiement sur place »,
 * « Annuler ». Une réservation close (absent, annulée, refusée…) passe dans « Réservations closes » avec « Table
 * libérée ». Aujourd'hui, un repère « Maintenant » se place entre les heures.
 */
import React from 'react';
import Link from 'next/link';
import {
    Banknote, CalendarX2, CheckCircle2, ChevronRight, Clock, Hand, Phone, ShieldCheck, StickyNote, UserCheck, UserX, Users, XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/components/ui/cn';
import { fcfaText, guestsText, hmText, instantHm } from '@/lib/tables/views';
import { actionsAt, startMs, tableFreed, telHref, toneVariant, type PartnerTableReservationView } from './venue-api';
import type { ReservationActions } from './useReservationActions';

function BookingCard({ r, now, isToday, actions, highlighted, previousDay }: {
    r: PartnerTableReservationView;
    now: number;
    isToday: boolean;
    actions: ReservationActions;
    highlighted: boolean;
    previousDay: boolean;
}) {
    const titleId = `resa-${r.id}-titre`;
    const can = actionsAt(r, now);
    const busy = actions.busyId === r.id;
    const anyBusy = actions.busyId !== null;
    const freed = tableFreed(r.state);
    const place = [r.tableNumber ? `Table ${r.tableNumber}` : 'Table à attribuer', r.zoneName].filter(Boolean).join(' · ');
    const detailHref = `/partner/tables/reservations/${encodeURIComponent(r.id)}`;
    const pendingAnswer = r.state === 'EN_ATTENTE_ACCEPTATION';
    const waitingPayment = r.state === 'EN_ATTENTE_PAIEMENT';

    return (
        <li
            id={`resa-${r.id}`}
            aria-labelledby={titleId}
            aria-busy={busy || undefined}
            className={cn(
                'scroll-mt-24 rounded-2xl border bg-card p-4 shadow-sm transition-[background-color,border-color,box-shadow] duration-slow ease-standard',
                highlighted ? 'border-primary bg-primary-soft ring-2 ring-primary' : 'border-border',
                freed && 'bg-muted shadow-none',
                r.state === 'ARRIVEE' && !highlighted && 'border-success-border',
            )}
        >
            <div className="flex gap-3 sm:gap-4">
                <div className={cn(
                    'flex w-[4.75rem] flex-shrink-0 flex-col items-center justify-center self-start rounded-xl px-1 py-2 text-center sm:w-24',
                    freed ? 'bg-card text-muted-foreground' : 'bg-muted text-foreground-strong',
                )}
                >
                    <span className={cn('whitespace-nowrap text-base font-bold leading-tight tabular-nums sm:text-lg', freed && 'line-through decoration-2')}>{hmText(r.time)}</span>
                    <small className="whitespace-nowrap text-caption text-muted-foreground tabular-nums">{`à ${hmText(r.endTime)}`}</small>
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                        <h3 id={titleId} className="min-w-0 break-words text-base font-bold leading-snug text-foreground-strong">
                            <span className="inline-flex items-center gap-1.5">
                                <Users size={16} aria-hidden="true" className="flex-shrink-0 text-muted-foreground" />
                                <span className="tabular-nums">{guestsText(r.guests)}</span>
                            </span>
                            <span aria-hidden="true" className="text-muted-foreground"> · </span>
                            <span className="sr-only">, </span>
                            <span>{r.client.name}</span>
                        </h3>
                        <Badge variant={toneVariant(r.tone)}>{r.stateLabel}</Badge>
                    </div>

                    <p className="text-sm font-semibold text-foreground">
                        {place}
                        {previousDay && <span className="font-normal text-muted-foreground"> · commencée la veille</span>}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                        {r.clientComing && !freed && r.state !== 'ARRIVEE' && (
                            <Badge variant="info" icon={<Hand size={12} aria-hidden="true" />}>A confirmé sa venue</Badge>
                        )}
                        {r.state === 'CONFIRMEE' && (
                            <Badge variant="neutral" icon={<ShieldCheck size={12} aria-hidden="true" />}>{`Table gardée jusqu’à ${hmText(r.heldUntil)}`}</Badge>
                        )}
                        {r.state === 'ARRIVEE' && r.arrivedAt && (
                            <Badge variant="success" icon={<UserCheck size={12} aria-hidden="true" />}>{`Arrivé à ${instantHm(r.arrivedAt)}`}</Badge>
                        )}
                        {waitingPayment && r.holdExpiresAt && (
                            <Badge variant="warning" icon={<Clock size={12} aria-hidden="true" />}>{`Table tenue jusqu’à ${instantHm(r.holdExpiresAt)}`}</Badge>
                        )}
                        {r.paidAmount > 0 && !freed && (
                            <Badge variant="neutral" icon={<CheckCircle2 size={12} aria-hidden="true" />}>{`Acompte payé ${fcfaText(r.paidAmount)}`}</Badge>
                        )}
                        {r.onsiteAmount !== null && r.onsiteAmount > 0 && (
                            <Badge variant="neutral" icon={<Banknote size={12} aria-hidden="true" />}>{`Payé sur place ${fcfaText(r.onsiteAmount)}`}</Badge>
                        )}
                        {freed && r.tableNumber && <Badge variant="neutral">Table libérée</Badge>}
                    </div>

                    {r.notes && (
                        <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-sm leading-relaxed text-foreground">
                            <StickyNote size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="min-w-0 whitespace-pre-line break-words">{r.notes}</span>
                        </p>
                    )}
                    {r.cancelReason && freed && (
                        <p className="text-sm leading-relaxed text-muted-foreground">{`Motif : ${r.cancelReason}`}</p>
                    )}
                    {pendingAnswer && (
                        <p className="text-sm font-medium text-warning-text">
                            <a href={`#demande-${r.id}`} className="inline-flex min-h-11 items-center underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                Répondre à cette demande, en haut de la page
                            </a>
                        </p>
                    )}
                    {waitingPayment && (
                        <p className="text-sm leading-relaxed text-muted-foreground">
                            Le client paie l’acompte. Sans paiement à temps, la table redevient libre.
                        </p>
                    )}
                    {isToday && r.state === 'CONFIRMEE' && now >= startMs(r) && !can.absent && (
                        <p className="text-sm font-medium text-warning-text">{`L’heure est passée : table gardée jusqu’à ${hmText(r.heldUntil)}. Sans le client à cette heure, vous pourrez le marquer absent.`}</p>
                    )}
                </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                {can.arrived && (
                    <Button
                        leftIcon={<UserCheck size={18} />}
                        isLoading={busy && actions.busyAction === 'ARRIVEE'}
                        disabled={anyBusy}
                        onClick={() => actions.run('ARRIVEE', r)}
                        aria-describedby={titleId}
                    >
                        Client arrivé
                    </Button>
                )}
                {can.absent && (
                    <Button variant="secondary" leftIcon={<UserX size={18} />} disabled={anyBusy} onClick={() => actions.run('ABSENT', r)} aria-describedby={titleId}>
                        Client absent
                    </Button>
                )}
                {r.client.phone && !freed && (
                    <a
                        href={telHref(r.client.phone)}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-sm font-semibold text-foreground-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <Phone size={16} aria-hidden="true" />
                        <span className="tabular-nums">{r.client.phone}</span>
                    </a>
                )}
                {can.onsite && (
                    <Button variant="ghost" leftIcon={<Banknote size={18} />} disabled={anyBusy} onClick={() => actions.run('PAIEMENT_SUR_PLACE', r)} aria-describedby={titleId}>
                        Paiement sur place
                    </Button>
                )}
                {can.cancel && !pendingAnswer && (
                    <Button variant="ghost" leftIcon={<XCircle size={18} />} className="text-danger-text hover:bg-danger-soft" disabled={anyBusy} onClick={() => actions.run('ANNULER', r)} aria-describedby={titleId}>
                        Annuler
                    </Button>
                )}
                <Link
                    href={`${detailHref}`}
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-foreground-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    Détail
                    <span className="sr-only">{` de la réservation de ${r.client.name} à ${hmText(r.time)}`}</span>
                    <ChevronRight size={18} aria-hidden="true" />
                </Link>
            </div>
        </li>
    );
}

function NowMarker({ now }: { now: number }) {
    const hm = hmText(new Date(now).toISOString().slice(11, 16));
    return (
        <li aria-hidden="true" className="flex items-center gap-2 py-1">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary" />
            <span className="whitespace-nowrap text-sm font-bold text-primary-text tabular-nums">{`Maintenant · ${hm}`}</span>
            <span className="h-px flex-1 bg-primary" />
        </li>
    );
}

interface Group { key: string; label: string; startsAt: number; items: PartnerTableReservationView[] }

function groupsOf(items: PartnerTableReservationView[], date: string): Group[] {
    const map = new Map<string, Group>();
    for (const r of items) {
        const before = r.date < date;
        const key = before ? 'veille' : r.time.slice(0, 2);
        const label = before ? 'Depuis la veille' : hmText(`${r.time.slice(0, 2)}:00`);
        const g = map.get(key) ?? { key, label, startsAt: before ? -1 : Date.parse(`${date}T${r.time.slice(0, 2)}:00:00Z`), items: [] };
        g.items.push(r);
        map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.startsAt - b.startsAt);
}

export function DayTimeline({ date, items, now, isToday, actions, highlighted }: {
    date: string;
    items: PartnerTableReservationView[];
    now: number;
    isToday: boolean;
    actions: ReservationActions;
    highlighted: ReadonlySet<string>;
}) {
    const sorted = [...items].sort((a, b) => startMs(a) - startMs(b));
    const open = sorted.filter((r) => !tableFreed(r.state));
    const closed = sorted.filter((r) => tableFreed(r.state));
    const groups = groupsOf(open, date);
    const hourNow = isToday ? Date.parse(`${date}T${new Date(now).toISOString().slice(11, 13)}:00:00Z`) : null;
    const markerIndex = hourNow === null ? -1 : (() => {
        const i = groups.findIndex((g) => g.startsAt > hourNow);
        return i === -1 ? groups.length : i;
    })();

    return (
        <div className="flex flex-col gap-4">
            {open.length === 0 ? (
                <EmptyState
                    icon={<CalendarX2 size={28} />}
                    title={isToday ? 'Aucune réservation aujourd’hui pour le moment' : 'Aucune réservation ce jour-là'}
                    description={isToday
                        ? 'Les nouvelles réservations apparaissent ici d’elles-mêmes, avec un signal discret. Gardez cette page ouverte pendant le service.'
                        : 'Choisissez un autre jour, ou revenez plus tard : les réservations s’ajoutent ici dès qu’un client réserve.'}
                />
            ) : (
                <ol className="flex flex-col gap-5" aria-label="Réservations du jour, par heure">
                    {groups.map((g, i) => (
                        <React.Fragment key={g.key}>
                            {i === markerIndex && <NowMarker now={now} />}
                            <li className="flex flex-col gap-2">
                                <h3 className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
                                    <span className="tabular-nums">{g.label}</span>
                                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                                    <span className="font-medium tabular-nums">{g.items.length === 1 ? '1 réservation' : `${g.items.length} réservations`}</span>
                                </h3>
                                <ul className="flex flex-col gap-2">
                                    {g.items.map((r) => (
                                        <BookingCard
                                            key={r.id}
                                            r={r}
                                            now={now}
                                            isToday={isToday}
                                            actions={actions}
                                            highlighted={highlighted.has(r.id)}
                                            previousDay={r.date < date}
                                        />
                                    ))}
                                </ul>
                            </li>
                        </React.Fragment>
                    ))}
                    {markerIndex === groups.length && <NowMarker now={now} />}
                </ol>
            )}

            {closed.length > 0 && (
                <details className="group rounded-2xl border border-border bg-card">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-foreground-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <span>{closed.length === 1 ? '1 réservation close' : `${closed.length} réservations closes`}</span>
                        <span className="text-muted-foreground">
                            <span className="group-open:hidden">Afficher</span>
                            <span className="hidden group-open:inline">Masquer</span>
                        </span>
                    </summary>
                    <ul className="flex flex-col gap-2 px-3 pb-3">
                        {closed.map((r) => (
                            <BookingCard key={r.id} r={r} now={now} isToday={isToday} actions={actions} highlighted={false} previousDay={r.date < date} />
                        ))}
                    </ul>
                </details>
            )}
        </div>
    );
}
