'use client';

/**
 * Lot 11b (écrans du client) : confirmation après la réservation d'une table, avec une coche qui se dessine (motion-safe)
 * et l'état en clair :
 *  - confirmée : « Table réservée », « Table gardée jusqu'à 20 h 30 » ;
 *  - demande envoyée (acceptation manuelle) : « Réponse avant 21 h 30 · reste 1 h 12 » (compte à rebours) ;
 *  - acompte à payer : « Il vous reste 12 min pour payer l'acompte » (compte à rebours de l'attente) et « Payer
 *    l'acompte » (fenêtre de paiement existante, cible TABLE_RESERVATION) ; délai passé : la table est libérée.
 * Montants lus dans la réponse de POST /api/restaurants/reserve-table (acompte, frais, total figés en base). L'état
 * exact est relu ensuite sur GET /api/tables/reservations/[id] (heure de garde de la table, paiement possible).
 */
import React, { useEffect, useRef } from 'react';
import { AlarmClock, CalendarCheck, Clock, Hourglass, MapPin, Users } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import { dayText, fcfaText, guestsText, hmText, instantHm } from '@/lib/tables/views';
import type { ClientTableReservationDetail } from '@/lib/tables/queries';
import { capitalize, durationText, remainingText } from './format';
import { SuccessCheck } from './SuccessCheck';
import { TablePayButton } from './TablePayButton';
import { msUntil, useNow } from './useNow';

export interface CreatedReservation {
    id: string;
    venueName: string;
    tableNumber: string | null;
    guests: number;
    date: string;
    time: string;
    endTime: string | null;
    depositAmount: number;
    serviceFee: number;
    totalToPay: number;
    holdExpiresAt: string | null;
    responseDueAt: string | null;
    cancellation: string;
}

type Kind = 'pay' | 'request' | 'confirmed' | 'other';

function kindOf(created: CreatedReservation, detail: ClientTableReservationDetail | null): Kind {
    const state = detail?.state;
    if (state) {
        if (state === 'EN_ATTENTE_PAIEMENT') return 'pay';
        if (state === 'EN_ATTENTE_ACCEPTATION') return 'request';
        if (state === 'CONFIRMEE') return 'confirmed';
        return 'other';
    }
    if (created.holdExpiresAt) return 'pay';
    if (created.responseDueAt) return 'request';
    return 'confirmed';
}

function Line({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <li className="flex items-start gap-3 text-base text-foreground">
            <span className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true">{icon}</span>
            <span className="min-w-0">{children}</span>
        </li>
    );
}

export function BookingConfirmation({ created, detail, manual, responseMinutes }: {
    created: CreatedReservation;
    detail: ClientTableReservationDetail | null;
    /** Acceptation manuelle par l'établissement (après le paiement de l'acompte, s'il y en a un). */
    manual: boolean;
    responseMinutes: number;
}) {
    const kind = kindOf(created, detail);
    const holdAt = detail?.holdExpiresAt ?? created.holdExpiresAt;
    const dueAt = detail?.responseDueAt ?? created.responseDueAt;
    const now = useNow(kind === 'pay' ? 1000 : 30_000);
    const holdLeft = msUntil(holdAt, now);
    const dueLeft = msUntil(dueAt, now);
    const expired = kind === 'pay' && holdLeft !== null && holdLeft <= 0;
    const canPay = kind === 'pay' && !expired && (detail ? detail.canPay : true);
    const heading = useRef<HTMLHeadingElement | null>(null);

    useEffect(() => {
        heading.current?.focus();
    }, []);

    const title = kind === 'pay'
        ? (expired ? 'Le délai pour payer est passé' : 'Table gardée, il reste l’acompte')
        : kind === 'request' ? 'Demande envoyée'
            : kind === 'confirmed' ? 'Table réservée'
                : (detail?.stateLabel ?? 'Réservation enregistrée');
    const tone = kind === 'confirmed' ? 'success' : kind === 'request' ? 'info' : 'warning';

    return (
        <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 pt-2 text-center">
                <SuccessCheck tone={expired ? 'warning' : tone} />
                <h2 id="reserver-titre" ref={heading} tabIndex={-1} className="text-2xl font-extrabold leading-tight text-foreground-strong focus-visible:outline-none">
                    {title}
                </h2>
                {kind === 'confirmed' && (
                    <p className="text-base text-foreground">
                        {detail?.heldUntil
                            ? <>Votre table est gardée jusqu’à <strong className="tabular-nums text-foreground-strong">{hmText(detail.heldUntil)}</strong>.</>
                            : 'L’établissement vous attend.'}
                    </p>
                )}
                {kind === 'request' && (
                    <p className="text-base text-foreground">L’établissement doit accepter votre demande. Vous recevez un avis dès qu’il répond.</p>
                )}
            </div>

            {kind === 'pay' && !expired && (
                <div className="space-y-3 rounded-2xl border border-warning-border bg-warning-soft p-4">
                    <p className="flex items-start gap-2 text-base font-semibold text-warning-text" role="timer" aria-live="off">
                        <AlarmClock size={20} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                        <span>
                            {holdLeft !== null
                                ? <>Il vous reste <span className="tabular-nums">{remainingText(holdLeft)}</span> pour payer l’acompte</>
                                : 'Payez l’acompte pour garder la table'}
                        </span>
                    </p>
                    <p className="text-sm text-warning-text">Sans paiement à temps, la table est libérée pour d’autres clients.</p>
                </div>
            )}
            {expired && (
                <div className="rounded-2xl border border-border bg-muted p-4 text-sm text-foreground">
                    La table a été libérée. Vous pouvez refaire une réservation depuis la fiche de l’établissement.
                </div>
            )}
            {kind === 'request' && dueAt && (
                <div className="flex items-start gap-2 rounded-2xl border border-info-border bg-info-soft p-4 text-base font-semibold text-info-text">
                    <Hourglass size={20} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>
                        <span className="tabular-nums">{`Réponse avant ${instantHm(dueAt)}`}</span>
                        {dueLeft !== null && dueLeft > 0 && <span className="font-normal tabular-nums">{` · reste ${remainingText(dueLeft)}`}</span>}
                    </span>
                </div>
            )}

            <ul className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <Line icon={<MapPin size={18} />}><span className="font-semibold text-foreground-strong">{created.venueName}</span></Line>
                <Line icon={<CalendarCheck size={18} />}>{capitalize(dayText(created.date))}</Line>
                <Line icon={<Clock size={18} />}>
                    <span className="tabular-nums">{created.endTime ? `${hmText(created.time)} à ${hmText(created.endTime)}` : hmText(created.time)}</span>
                </Line>
                <Line icon={<Users size={18} />}>
                    {guestsText(created.guests)}
                    {created.tableNumber && <span className="text-muted-foreground">{` · table ${created.tableNumber}`}</span>}
                </Line>
            </ul>

            {created.depositAmount > 0 && (
                <dl className="divide-y divide-border rounded-2xl border border-border px-4">
                    <div className="flex items-start justify-between gap-4 py-2.5">
                        <dt className="text-sm text-foreground">Acompte</dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground-strong">{fcfaText(created.depositAmount)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-2.5">
                        <dt className="text-sm text-foreground">Frais de service</dt>
                        <dd className="text-sm font-semibold tabular-nums text-foreground-strong">{fcfaText(created.serviceFee)}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-4 py-2.5">
                        <dt className="text-base font-semibold text-foreground-strong">Total à payer</dt>
                        <dd className="text-lg font-bold tabular-nums text-foreground-strong">{fcfaText(created.totalToPay)}</dd>
                    </div>
                </dl>
            )}

            {canPay && (
                <div className="space-y-2">
                    <TablePayButton reservationId={created.id} venueName={created.venueName} depositAmount={created.depositAmount} />
                    <p className="text-sm text-muted-foreground">
                        {manual
                            ? `Paiement par Wave ou Orange Money. Ensuite, l’établissement a ${durationText(responseMinutes)} pour accepter ; s’il refuse, l’acompte vous est rendu.`
                            : 'Paiement par Wave ou Orange Money. La table est confirmée dès le paiement reçu.'}
                    </p>
                </div>
            )}

            <p className="rounded-xl bg-muted px-4 py-3 text-sm text-foreground">{created.cancellation}</p>

            <div className="flex flex-col gap-2 sm:flex-row">
                <LinkButton href={`/tables/reservations/${created.id}`} variant={canPay ? 'secondary' : 'primary'} fullWidth>
                    Voir ma réservation
                </LinkButton>
                <LinkButton href="/tables/reservations" variant="ghost" fullWidth>
                    Mes réservations
                </LinkButton>
            </div>
        </div>
    );
}
