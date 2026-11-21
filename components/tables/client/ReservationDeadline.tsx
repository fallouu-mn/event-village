'use client';

/**
 * Lot 11b (écrans du client) : échéance d'une réservation de table, en clair, avec compte à rebours :
 *  - acompte à payer : « Il vous reste 12 min pour payer l'acompte » (délai passé : « Délai pour payer dépassé ») ;
 *  - demande en attente : « Réponse avant 21 h 30 · reste 1 h 12 » ;
 *  - confirmée et à venir : « Table gardée jusqu'à 20 h 30 » (et « Venue confirmée » après « J'arrive »).
 * Heures et délais lus dans la réservation (route), jamais recalculés ici ; `now` vient de useNow.
 */
import React from 'react';
import { AlarmClock, CheckCircle2, Hourglass, Timer } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { hmText, instantHm } from '@/lib/tables/views';
import type { TableReservationView } from '@/lib/tables/queries';
import { remainingText } from './format';
import { msUntil } from './useNow';

type DeadlineInput = Pick<TableReservationView, 'state' | 'upcoming' | 'holdExpiresAt' | 'responseDueAt' | 'heldUntil' | 'clientComing'>;

export function ReservationDeadline({ r, now, size = 'sm' }: { r: DeadlineInput; now: number | null; size?: 'sm' | 'md' }) {
    const text = size === 'md' ? 'text-base' : 'text-sm';
    const box = cn('flex items-start gap-1.5 rounded-lg border px-3 py-2 font-semibold', text);
    const icon = size === 'md' ? 18 : 16;

    if (r.state === 'EN_ATTENTE_PAIEMENT' && r.holdExpiresAt) {
        const left = msUntil(r.holdExpiresAt, now);
        if (left !== null && left <= 0) {
            return (
                <p className={cn(box, 'border-border bg-muted text-muted-foreground')}>
                    <AlarmClock size={icon} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>Délai pour payer dépassé : la table est libérée.</span>
                </p>
            );
        }
        return (
            <p className={cn(box, 'border-warning-border bg-warning-soft text-warning-text')}>
                <AlarmClock size={icon} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>
                    {left !== null
                        ? <>Il vous reste <span className="tabular-nums">{remainingText(left)}</span> pour payer l’acompte</>
                        : <>Acompte à payer avant <span className="tabular-nums">{instantHm(r.holdExpiresAt)}</span></>}
                </span>
            </p>
        );
    }
    if (r.state === 'EN_ATTENTE_ACCEPTATION' && r.responseDueAt) {
        const left = msUntil(r.responseDueAt, now);
        return (
            <p className={cn(box, 'border-info-border bg-info-soft text-info-text')}>
                <Hourglass size={icon} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span className="tabular-nums">
                    {`Réponse avant ${instantHm(r.responseDueAt)}`}
                    {left !== null && left > 0 && <span className="font-normal">{` · reste ${remainingText(left)}`}</span>}
                </span>
            </p>
        );
    }
    if (r.state === 'CONFIRMEE' && r.upcoming) {
        return (
            <p className={cn(box, r.clientComing ? 'border-success-border bg-success-soft text-success-text' : 'border-border bg-muted text-foreground-strong')}>
                {r.clientComing
                    ? <CheckCircle2 size={icon} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    : <Timer size={icon} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />}
                <span className="tabular-nums">
                    {r.clientComing ? `Venue confirmée · table gardée jusqu’à ${hmText(r.heldUntil)}` : `Table gardée jusqu’à ${hmText(r.heldUntil)}`}
                </span>
            </p>
        );
    }
    return null;
}
