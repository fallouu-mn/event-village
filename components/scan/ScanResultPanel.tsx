'use client';

/**
 * Lot 4.9 — carte de résultat d'un scan, partagée par le scanner contrôleur et le scan partenaire.
 * Chaque résultat combine une icône, un titre et un texte (jamais la couleur seule). Annoncée aux
 * lecteurs d'écran (role alert pour un refus ou un incident, status pour une entrée validée). Un
 * incident technique est signalé comme tel : le billet n'est pas en cause.
 */
import React from 'react';
import {
    AlertTriangle, Banknote, CheckCircle2, Clock, Keyboard, ServerCrash, ShieldAlert, Volume2, WifiOff, XCircle,
    type LucideIcon,
} from 'lucide-react';
import { formatFcfa, isTechnicalOutcome, titleFor, toneFor, wolofTypeFor, type ScanOutcome, type ScanTone } from './scan-client';

const TONE_CLASSES: Record<ScanTone, { box: string; title: string; body: string; icon: string }> = {
    success: {
        box: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 dark:border-emerald-600',
        title: 'text-emerald-900 dark:text-emerald-100',
        body: 'text-emerald-800 dark:text-emerald-200',
        icon: 'text-emerald-600 dark:text-emerald-400',
    },
    danger: {
        box: 'bg-red-50 dark:bg-red-950/40 border-red-500 dark:border-red-600',
        title: 'text-red-900 dark:text-red-100',
        body: 'text-red-800 dark:text-red-200',
        icon: 'text-red-600 dark:text-red-400',
    },
    warning: {
        box: 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 dark:border-amber-600',
        title: 'text-amber-900 dark:text-amber-100',
        body: 'text-amber-800 dark:text-amber-200',
        icon: 'text-amber-600 dark:text-amber-400',
    },
    info: {
        box: 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 dark:border-blue-600',
        title: 'text-blue-900 dark:text-blue-100',
        body: 'text-blue-800 dark:text-blue-200',
        icon: 'text-blue-600 dark:text-blue-400',
    },
    neutral: {
        box: 'bg-slate-100 dark:bg-zinc-800/80 border-slate-400 dark:border-zinc-500',
        title: 'text-slate-900 dark:text-zinc-50',
        body: 'text-slate-700 dark:text-zinc-200',
        icon: 'text-slate-600 dark:text-zinc-300',
    },
};

function iconFor(outcome: ScanOutcome): LucideIcon {
    if (outcome.failure === 'network') return WifiOff;
    if (outcome.failure === 'auth' || outcome.failure === 'forbidden') return ShieldAlert;
    if (isTechnicalOutcome(outcome)) return ServerCrash;
    switch (outcome.result) {
        case 'valid':
            return CheckCircle2;
        case 'cash_required':
        case 'payment_required':
            return Banknote;
        case 'qr_expired':
        case 'event_not_open':
            return Clock;
        case 'already_used':
        case 'invalid':
        case 'cancelled':
        case 'refunded':
            return XCircle;
        default:
            return AlertTriangle;
    }
}

export interface ScanResultPanelProps {
    outcome: ScanOutcome;
    /** Titre imposé (ex. « Encaissement non enregistré »), sinon le libellé du résultat. */
    title?: string;
    /** Bouton « Répéter en wolof » (refus du billet uniquement). */
    onRepeatWolof?: () => void;
    /** Actions explicites sous le résultat (encaissement, réessai, abandon). */
    children?: React.ReactNode;
}

export function ScanResultPanel({ outcome, title, onRepeatWolof, children }: ScanResultPanelProps) {
    const tone = toneFor(outcome);
    const classes = TONE_CLASSES[tone];
    const Icon = iconFor(outcome);
    const technical = isTechnicalOutcome(outcome);
    const heading = title ?? titleFor(outcome);
    const ticket = outcome.ticket;
    const showMessage = outcome.message && outcome.message !== heading;
    const canRepeatWolof = Boolean(onRepeatWolof && wolofTypeFor(outcome));

    return (
        <div
            role={tone === 'success' ? 'status' : 'alert'}
            aria-atomic="true"
            data-scan-result={outcome.result}
            className={`p-4 rounded-2xl border-2 ${classes.box} space-y-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200`}
        >
            <div className="flex items-start gap-3">
                <Icon size={28} aria-hidden="true" className={`shrink-0 mt-0.5 ${classes.icon}`} />
                <div className="flex-1 min-w-0 space-y-1">
                    <p className={`text-base font-black leading-snug ${classes.title}`}>{heading}</p>
                    {showMessage && <p className={`text-sm font-medium ${classes.body}`}>{outcome.message}</p>}
                    {technical && (
                        <p className={`text-sm ${classes.body}`}>
                            Incident technique : le billet n’est pas en cause. Ne refusez pas le spectateur pour ce motif, réessayez.
                        </p>
                    )}
                    {outcome.result === 'cash_required' && outcome.amountDue !== undefined && (
                        <p className={`text-lg font-black ${classes.title}`}>À encaisser : {formatFcfa(outcome.amountDue)}</p>
                    )}
                    {ticket && (ticket.ticket_number || ticket.holder || ticket.category) && (
                        <dl className={`grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-sm ${classes.body} pt-1`}>
                            {ticket.holder && (<><dt className="font-semibold">Titulaire</dt><dd className="truncate">{ticket.holder}</dd></>)}
                            {ticket.category && (<><dt className="font-semibold">Catégorie</dt><dd className="truncate">{ticket.category}</dd></>)}
                            {ticket.ticket_number && (<><dt className="font-semibold">Billet</dt><dd className="font-mono truncate">{ticket.ticket_number}</dd></>)}
                        </dl>
                    )}
                    {ticket?.is_manual_entry && (
                        <p className={`inline-flex items-center gap-1.5 text-xs font-bold ${classes.body}`}>
                            <Keyboard size={14} aria-hidden="true" /> Saisie manuelle, pièce d’identité vérifiée
                        </p>
                    )}
                </div>
            </div>

            {canRepeatWolof && (
                <button
                    type="button"
                    onClick={onRepeatWolof}
                    className="w-full min-h-[44px] px-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-600 text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]"
                >
                    <Volume2 size={18} aria-hidden="true" className="text-[#FF5722]" />
                    Répéter en wolof pour le spectateur
                </button>
            )}

            {children}
        </div>
    );
}
