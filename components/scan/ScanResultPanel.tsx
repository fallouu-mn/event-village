'use client';

/**
 * Lot 4.9 — carte de résultat d'un scan, partagée par le scanner contrôleur et le scan partenaire.
 * Chaque résultat combine une icône, un titre et un texte (jamais la couleur seule). Annoncée aux
 * lecteurs d'écran (role alert pour un refus ou un incident, status pour une entrée validée). Un
 * incident technique est signalé comme tel : le billet n'est pas en cause.
 * Lot 7 (D52) : aucun son, plus de bouton « Répéter en wolof ».
 * Amendement A10 : un scan renvoyé au retour dans l'application (même clé, verdict d'origine) porte `recoveredAt`
 * (ligne « Résultat retrouvé » avec l'heure de la lecture, attribut data-scan-recovered). Lot 8 (8.2 e) : jamais pour
 * `not_processed`, rien n'a été retrouvé.
 */
import {
    AlertTriangle, Banknote, CheckCircle2, Clock, Keyboard, ScanLine, ServerCrash, ShieldAlert, WifiOff, XCircle,
    type LucideIcon,
} from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { formatTime } from '@/lib/format';
import { NOT_PROCESSED_DETAIL } from '@/lib/scan/scan-result';
import { isTechnicalOutcome, titleFor, toneFor, type ScanOutcome, type ScanTone } from './scan-client';

/** Tons du résultat sur les tokens sémantiques (contrat Q) : fond doux, bordure et titre du ton, texte courant. */
const TONE_CLASSES: Record<ScanTone, { box: string; title: string; body: string; icon: string }> = {
    success: { box: 'bg-success-bg border-success-border', title: 'text-success-fg', body: 'text-fg', icon: 'text-success-fg' },
    danger: { box: 'bg-danger-bg border-danger-border', title: 'text-danger-fg', body: 'text-fg', icon: 'text-danger-fg' },
    warning: { box: 'bg-warning-bg border-warning-border', title: 'text-warning-fg', body: 'text-fg', icon: 'text-warning-fg' },
    neutral: { box: 'bg-surface-sunken border-border-strong', title: 'text-fg', body: 'text-fg', icon: 'text-fg-muted' },
};

function iconFor(outcome: ScanOutcome): LucideIcon {
    if (outcome.failure === 'network' || outcome.failure === 'timeout' || outcome.failure === 'offline') return WifiOff;
    if (outcome.failure === 'auth' || outcome.failure === 'forbidden') return ShieldAlert;
    if (outcome.result === 'not_processed') return ScanLine; // le serveur a répondu : rien de cassé, le billet est à rescanner
    if (isTechnicalOutcome(outcome)) return ServerCrash;
    switch (outcome.result) {
        case 'valid':
            return CheckCircle2;
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
    /** Titre imposé, sinon le libellé du résultat. */
    title?: string;
    /** Heure de la lecture d'origine d'un scan renvoyé au retour dans l'application (A10). */
    recoveredAt?: number | null;
}

export function ScanResultPanel({ outcome, title, recoveredAt }: ScanResultPanelProps) {
    const tone = toneFor(outcome);
    const classes = TONE_CLASSES[tone];
    const Icon = iconFor(outcome);
    const technical = isTechnicalOutcome(outcome);
    const heading = title ?? titleFor(outcome);
    const ticket = outcome.ticket;
    const detail = outcome.result === 'not_processed' ? NOT_PROCESSED_DETAIL : outcome.message;
    const showMessage = detail && detail !== heading;

    return (
        <div
            role={tone === 'success' ? 'status' : 'alert'}
            aria-atomic="true"
            data-scan-result={outcome.result}
            data-scan-recovered={recoveredAt ? 'true' : undefined}
            className={cn('flex flex-col gap-3 rounded-2xl border-2 p-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200', classes.box)}
        >
            <div className="flex items-start gap-3">
                <Icon size={28} aria-hidden="true" className={cn('mt-0.5 flex-shrink-0', classes.icon)} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className={cn('text-base font-bold leading-snug', classes.title)}>{heading}</p>
                    {recoveredAt ? (
                        <p className={cn('text-sm font-semibold tabular-nums', classes.body)}>
                            Résultat retrouvé : billet lu à {formatTime(recoveredAt)}.
                        </p>
                    ) : null}
                    {showMessage && <p className={cn('text-sm font-medium', classes.body)}>{detail}</p>}
                    {technical && (
                        <p className={cn('text-sm', classes.body)}>
                            Incident technique : le billet n’est pas en cause. Ne refusez pas le spectateur pour ce motif, réessayez.
                        </p>
                    )}
                    {ticket && (ticket.ticket_number || ticket.holder || ticket.category) && (
                        <dl className={cn('grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 pt-1 text-sm', classes.body)}>
                            {ticket.holder && (<><dt className="font-semibold">Titulaire</dt><dd className="truncate">{ticket.holder}</dd></>)}
                            {ticket.category && (<><dt className="font-semibold">Catégorie</dt><dd className="truncate">{ticket.category}</dd></>)}
                            {ticket.ticket_number && (<><dt className="font-semibold">Billet</dt><dd className="truncate tabular-nums">{ticket.ticket_number}</dd></>)}
                        </dl>
                    )}
                    {ticket?.is_manual_entry && (
                        <p className={cn('inline-flex items-center gap-1.5 text-sm font-semibold', classes.body)}>
                            <Keyboard size={14} aria-hidden="true" /> Saisie manuelle, pièce d’identité vérifiée
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
