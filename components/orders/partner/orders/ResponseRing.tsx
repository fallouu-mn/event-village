'use client';

/**
 * Lot 12c — compte à rebours du délai pour accepter une commande (15 minutes au départ, orders.response_minutes), en
 * anneau : vert, puis orange sous 5 minutes, puis rouge sous 2 minutes, TOUJOURS avec le texte (temps restant et palier),
 * jamais la couleur seule. L'anneau se vide par une transition d'une seconde (coupée si « réduire les animations » : il
 * avance alors par sauts, le texte reste). Annonce aux lecteurs d'écran seulement au changement de palier.
 */
import React from 'react';
import { cn } from '@/components/ui/cn';
import { formatCountdown, responseUrgency } from '@/lib/orders/partner-ui';

const TOTAL_MS = 15 * 60_000;
const R = 26;
const C = 2 * Math.PI * R;

const STROKE: Record<'success' | 'warning' | 'danger', string> = {
    success: 'stroke-success',
    warning: 'stroke-warning',
    danger: 'stroke-danger',
};
const TEXT: Record<'success' | 'warning' | 'danger', string> = {
    success: 'text-success-text',
    warning: 'text-warning-text',
    danger: 'text-danger-text',
};

export function ResponseRing({ dueAt, now, size = 'md' }: { dueAt: string; now: number; size?: 'md' | 'lg' }) {
    const due = Date.parse(dueAt);
    const left = Number.isNaN(due) ? 0 : due - now;
    const urgency = responseUrgency(left);
    const share = Math.min(1, Math.max(0, left / TOTAL_MS));
    const box = size === 'lg' ? 'h-24 w-24' : 'h-16 w-16';
    return (
        <div className="flex items-center gap-3">
            <div className={cn('relative flex-shrink-0', box)}>
                <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="32" cy="32" r={R} className="fill-none stroke-border" strokeWidth="6" />
                    <circle
                        cx="32"
                        cy="32"
                        r={R}
                        className={cn('fill-none transition-[stroke-dashoffset] duration-1000 ease-linear', STROKE[urgency.tone])}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={C}
                        strokeDashoffset={C * (1 - share)}
                    />
                </svg>
                <span className={cn('absolute inset-0 flex items-center justify-center font-bold tabular-nums', size === 'lg' ? 'text-lg' : 'text-sm', TEXT[urgency.tone])}>
                    {left > 0 ? Math.ceil(left / 60_000) : 0}
                    <span className="sr-only"> minutes</span>
                </span>
            </div>
            <div className="min-w-0">
                <p className={cn('text-sm font-semibold', TEXT[urgency.tone])}>
                    <span role="status" aria-atomic="true">{urgency.label}</span>
                </p>
                <p className="text-sm tabular-nums text-muted-foreground" aria-hidden="true">
                    {left > 0 ? `Encore ${formatCountdown(left)}` : 'Le client va être remboursé'}
                </p>
            </div>
        </div>
    );
}
