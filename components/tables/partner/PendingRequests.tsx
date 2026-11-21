'use client';

/**
 * Lot 11b : demandes à accepter (tous les jours), en tête du planning. Chaque demande : jour et heure, personnes, table
 * ou zone, prénom du client, téléphone cliquable, demande particulière, acompte déjà payé (montant de la route), et le
 * compte à rebours jusqu'à l'échéance de réponse (« Répondez avant 21 h 30 · reste 1 h 12 »), puis « Accepter » et
 * « Refuser » (motif obligatoire). Sans réponse à temps, la base annule la demande et rembourse le client.
 */
import React from 'react';
import Link from 'next/link';
import { BellRing, Check, ChevronRight, Phone, StickyNote, Timer, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { fcfaText, guestsText, hmText } from '@/lib/tables/views';
import { useClock } from './useClock';
import { capitalize, dayOf, dueText, relativeDay, remainingText, telHref, type PartnerTableReservationView } from './venue-api';
import type { ReservationActions } from './useReservationActions';

/** Compte à rebours de la réponse : mis à jour toutes les 10 secondes (le texte est à la minute). */
export function ResponseCountdown({ dueAt, skewMs, className }: { dueAt: string; skewMs: number; className?: string }) {
    const now = useClock(skewMs, 10_000);
    const due = Date.parse(dueAt);
    if (Number.isNaN(due)) return null;
    const left = due - now;
    const today = dayOf(now);
    if (left <= 0) {
        return (
            <p className={cn('flex items-start gap-2 text-sm font-semibold text-danger-text', className)}>
                <Timer size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                Délai de réponse dépassé : la demande va être annulée et le client remboursé.
            </p>
        );
    }
    const urgent = left < 15 * 60_000;
    return (
        <p className={cn('flex items-start gap-2 text-sm font-semibold', urgent ? 'text-danger-text' : 'text-warning-text', className)}>
            <Timer size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span className="tabular-nums">
                {`Répondez avant ${dueText(dueAt, today)}`}
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, </span>
                {`reste ${remainingText(left)}`}
            </span>
        </p>
    );
}

function RequestCard({ r, today, skewMs, actions, highlighted }: {
    r: PartnerTableReservationView;
    today: string;
    skewMs: number;
    actions: ReservationActions;
    highlighted: boolean;
}) {
    const titleId = `demande-${r.id}-titre`;
    const busy = actions.busyId === r.id;
    const place = [r.tableNumber ? `Table ${r.tableNumber}` : null, r.zoneName].filter(Boolean).join(' · ');

    return (
        <li
            id={`demande-${r.id}`}
            className={cn(
                'scroll-mt-24 rounded-2xl border bg-card p-4 shadow-sm transition-[background-color,border-color,box-shadow] duration-slow ease-standard sm:p-5',
                highlighted ? 'border-primary bg-primary-soft ring-2 ring-primary' : 'border-warning-border',
            )}
            aria-labelledby={titleId}
            aria-busy={busy || undefined}
        >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <h3 id={titleId} className="min-w-0 text-lg font-bold leading-snug text-foreground-strong">
                    <span className="block text-sm font-semibold text-muted-foreground">{capitalize(relativeDay(r.date, today))}</span>
                    <span className="tabular-nums">{`${hmText(r.time)} · ${guestsText(r.guests)}`}</span>
                </h3>
                {r.responseDueAt && <ResponseCountdown dueAt={r.responseDueAt} skewMs={skewMs} className="sm:max-w-xs sm:justify-end sm:text-right" />}
            </div>

            <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                <div className="flex min-w-0 gap-1.5">
                    <dt className="text-muted-foreground">Client :</dt>
                    <dd className="min-w-0 break-words font-semibold text-foreground-strong">{r.client.name}</dd>
                </div>
                <div className="flex min-w-0 gap-1.5">
                    <dt className="text-muted-foreground">Place :</dt>
                    <dd className="min-w-0 break-words font-semibold text-foreground-strong">{place || 'Table attribuée à l’acceptation'}</dd>
                </div>
                {r.paidAmount > 0 && (
                    <div className="flex min-w-0 gap-1.5">
                        <dt className="text-muted-foreground">Acompte payé :</dt>
                        <dd className="font-semibold text-foreground-strong tabular-nums">{fcfaText(r.paidAmount)}</dd>
                    </div>
                )}
            </dl>

            {r.notes && (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-sm leading-relaxed text-foreground">
                    <StickyNote size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 whitespace-pre-line break-words">{r.notes}</span>
                </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:flex sm:flex-wrap">
                <Button
                    size="lg"
                    className="px-4"
                    leftIcon={<Check size={20} />}
                    isLoading={busy && actions.busyAction === 'ACCEPTER'}
                    disabled={actions.busyId !== null}
                    onClick={() => actions.run('ACCEPTER', r)}
                    aria-describedby={titleId}
                >
                    Accepter
                </Button>
                <Button
                    size="lg"
                    variant="secondary"
                    leftIcon={<X size={20} />}
                    className="px-4 text-danger-text"
                    disabled={actions.busyId !== null}
                    onClick={() => actions.run('REFUSER', r)}
                    aria-describedby={titleId}
                >
                    Refuser
                </Button>
                {r.client.phone && (
                    <a
                        href={telHref(r.client.phone)}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[360px]:col-span-2 sm:col-span-1"
                    >
                        <Phone size={18} aria-hidden="true" />
                        <span className="tabular-nums">{`Appeler ${r.client.phone}`}</span>
                    </a>
                )}
                <Link
                    href={`/partner/tables/reservations/${encodeURIComponent(r.id)}`}
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold text-foreground-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-[360px]:col-span-2 sm:col-span-1"
                >
                    Détail
                    <span className="sr-only">{` de la demande de ${r.client.name}, ${hmText(r.time)}`}</span>
                    <ChevronRight size={18} aria-hidden="true" />
                </Link>
            </div>
        </li>
    );
}

export function PendingRequests({ items, today, skewMs, actions, highlighted }: {
    items: PartnerTableReservationView[];
    today: string;
    skewMs: number;
    actions: ReservationActions;
    highlighted: ReadonlySet<string>;
}) {
    if (items.length === 0) return null;
    return (
        <section aria-labelledby="planning-demandes" className="flex flex-col gap-3">
            <h2 id="planning-demandes" className="flex items-center gap-2 text-lg font-bold text-foreground-strong">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning-soft text-warning-text" aria-hidden="true">
                    <BellRing size={18} />
                </span>
                {items.length === 1 ? 'Une demande à accepter' : `${items.length} demandes à accepter`}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
                Sans réponse avant l’heure indiquée, la demande est annulée et le client remboursé.
            </p>
            <ul className="flex flex-col gap-3">
                {items.map((r) => (
                    <RequestCard key={r.id} r={r} today={today} skewMs={skewMs} actions={actions} highlighted={highlighted.has(r.id)} />
                ))}
            </ul>
        </section>
    );
}
