'use client';

import React, { useEffect, useRef } from 'react';
import { Send, Users } from 'lucide-react';
import { LinkButton } from '@/components/ui/LinkButton';
import { AddToCalendar } from '@/components/tickets/AddToCalendar';
import { SuccessCheck } from '@/components/tables/client/SuccessCheck';
import { formatFcfa } from '@/lib/format';
import type { TablesEventInfo } from '@/components/event-page/TicketingSwitch';

/**
 * Lot 11c-b — confirmation d'une table payée : coche qui se dessine, carte de la table, puis tout de suite « Envoyez vos 5
 * places » (vers « Ma table »). Légère vibration si le téléphone la propose et que la personne n'a pas demandé à réduire
 * les animations. « Ajouter à mon agenda », comme après l'achat de billets. Le titre reçoit le focus (lecteur d'écran).
 */
export interface ConfirmedTable {
    bookingId: string;
    label: string;
    seats: number;
    amount: number;
    /** Places à envoyer aux invités, servies par « Ma table » (invite_left). */
    inviteLeft: number;
}

export function TableConfirmed({ table, event }: { table: ConfirmedTable; event: TablesEventInfo }) {
    const titleRef = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        titleRef.current?.focus();
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduce && typeof navigator.vibrate === 'function') navigator.vibrate(60);
    }, []);
    return (
        <div className="space-y-5 text-center">
            <SuccessCheck className="mx-auto" />
            <div className="space-y-1">
                <h3 ref={titleRef} tabIndex={-1} className="text-xl font-bold tracking-tight text-foreground-strong focus:outline-none">
                    Votre table est réservée
                </h3>
                <p className="text-sm text-muted-foreground">Chaque invité aura son propre billet, avec son QR code.</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-primary bg-primary-soft p-4 text-left">
                <p className="text-sm font-medium text-primary-text">{event.title}</p>
                <p className="mt-1 text-2xl font-extrabold tracking-tight text-foreground-strong">{table.label}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground-strong">
                    <span className="inline-flex items-center gap-1.5"><Users size={16} aria-hidden="true" />{table.seats} places</span>
                    <span className="tabular-nums">Total payé : {formatFcfa(table.amount)}</span>
                </p>
            </div>
            <LinkButton href={`/tickets?tab=tables#table-${table.bookingId}`} variant="gradient" fullWidth leftIcon={<Send size={18} />}>
                {table.inviteLeft > 1 ? `Envoyez vos ${table.inviteLeft} places` : table.inviteLeft === 1 ? 'Envoyez votre place' : 'Voir ma table'}
            </LinkButton>
            <AddToCalendar eventId={event.id} title={event.title} startsAt={event.startsAt} endsAt={event.endsAt} location={event.location} />
        </div>
    );
}
