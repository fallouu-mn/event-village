'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';
import { formatInteger } from '@/lib/format';
import type { TablesGauge } from './types';

/**
 * Lot 11c-c — jauge en places d'un événement, lue sur la réponse du serveur (private.event_seats_gauge, règle unique de
 * la base) : « 180 places sur 200 : 120 en billets, 60 en tables ». Barre en deux teintes (billets, tables) dont chaque
 * part est aussi écrite en nombre (la couleur n'est jamais seule) ; la barre se remplit à l'apparition (transform,
 * 300 ms, rien ne bouge si le téléphone demande de réduire les animations). Seule la largeur des parts est déduite ici,
 * pour le dessin : chaque nombre affiché vient du serveur.
 */
export function SeatsGauge({ gauge, className, title = 'Jauge en places' }: { gauge: TablesGauge; className?: string; title?: string }) {
    const [filled, setFilled] = useState(false);
    useEffect(() => {
        const id = window.requestAnimationFrame(() => setFilled(true));
        return () => window.cancelAnimationFrame(id);
    }, []);
    const cap = gauge.capacity;
    const width = (part: number) => (cap && cap > 0 ? Math.min(100, (part / cap) * 100) : 0);
    const ticketsW = width(gauge.ticket_seats);
    const tablesW = Math.min(100 - ticketsW, width(gauge.table_seats));
    const sentence = cap === null
        ? `${formatInteger(gauge.seats)} places en vente : ${formatInteger(gauge.ticket_seats)} en billets, ${formatInteger(gauge.table_seats)} en tables`
        : `${formatInteger(gauge.seats)} places sur ${formatInteger(cap)} : ${formatInteger(gauge.ticket_seats)} en billets, ${formatInteger(gauge.table_seats)} en tables`;

    return (
        <section aria-label={title} className={cn('rounded-2xl border border-border bg-card p-4', className)} data-jauge-places="">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
                {cap !== null && gauge.free !== null && (
                    <p className="text-sm font-semibold tabular-nums text-foreground-strong">
                        {gauge.free === 0 ? 'Complet' : `${formatInteger(gauge.free)} libres`}
                    </p>
                )}
            </div>
            <p className="mt-1 text-base font-semibold tabular-nums text-foreground-strong" aria-live="polite">{sentence}</p>
            {cap !== null ? (
                <div aria-hidden="true" className="mt-3 flex h-3 w-full overflow-hidden rounded-pill bg-muted">
                    <span
                        className="h-full origin-left bg-info transition-transform duration-slow ease-out motion-reduce:transition-none"
                        style={{ width: `${ticketsW}%`, transform: `scaleX(${filled ? 1 : 0})` }}
                    />
                    <span
                        className="h-full origin-left bg-primary transition-transform duration-slow ease-out motion-reduce:transition-none"
                        style={{ width: `${tablesW}%`, transform: `scaleX(${filled ? 1 : 0})` }}
                    />
                </div>
            ) : (
                <p className="mt-2 text-sm text-warning-text">
                    Indiquez la capacité totale de l’événement à l’étape « Informations » : elle compte les places des billets et des tables.
                </p>
            )}
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground" aria-label="Détail de la jauge">
                <li className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-info" />
                    Billets <span className="font-semibold tabular-nums text-foreground-strong">{formatInteger(gauge.ticket_seats)}</span>
                </li>
                <li className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="h-3 w-3 rounded-sm bg-primary" />
                    Tables <span className="font-semibold tabular-nums text-foreground-strong">{formatInteger(gauge.table_seats)}</span>
                </li>
                {cap !== null && gauge.free !== null && (
                    <li className="inline-flex items-center gap-2">
                        <span aria-hidden="true" className="h-3 w-3 rounded-sm border border-input bg-muted" />
                        Libres <span className="font-semibold tabular-nums text-foreground-strong">{formatInteger(gauge.free)}</span>
                    </li>
                )}
            </ul>
        </section>
    );
}
