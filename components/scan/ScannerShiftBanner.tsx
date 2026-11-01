'use client';

/**
 * Lot 5 (contrat Q) — état de la caisse du contrôleur sur l'écran de scan, sur les tokens du système de
 * design. Reprend le comportement du bandeau du lot 4 (components/shifts/ShiftModals, ShiftStatusBanner) :
 *  - caisse ouverte : heure d'ouverture, fonds de caisse, espèces encaissées, total attendu en main,
 *    bouton de clôture (Z de caisse) ;
 *  - caisse fermée : encaissement espèces bloqué, bouton « Ouvrir ma caisse ».
 * Les montants viennent de la session de caisse renvoyée par le serveur ; formats de lib/format.
 */
import React from 'react';
import { Banknote, Coins, Lock, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatFcfa, formatTime, toDakarDateTimeLocal } from '@/lib/format';
import type { Shift } from '@/lib/shifts/shift.service';

export interface ScannerShiftBannerProps {
    canAcceptCash: boolean;
    activeShift: Shift | null;
    onOpenShiftClick: () => void;
    onCloseShiftClick: () => void;
}

export function ScannerShiftBanner({ canAcceptCash, activeShift, onOpenShiftClick, onCloseShiftClick }: ScannerShiftBannerProps) {
    if (!canAcceptCash) return null;

    if (activeShift) {
        const openingFloat = Number(activeShift.opening_float_amount) || 0;
        const collected = Number(activeShift.expected_cash_total) || 0;
        return (
            <section
                aria-labelledby="scanner-caisse-titre"
                className="flex flex-col gap-3 rounded-2xl border border-success-border bg-success-bg p-4 sm:flex-row sm:items-center sm:justify-between"
            >
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface text-success-fg" aria-hidden="true">
                        <Banknote size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2">
                            <span id="scanner-caisse-titre" className="text-base font-semibold text-success-fg">Caisse ouverte</span>
                            <span className="text-sm text-fg-muted">
                                depuis <time dateTime={toDakarDateTimeLocal(activeShift.opened_at)} className="tabular-nums">{formatTime(activeShift.opened_at)}</time>
                            </span>
                        </p>
                        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm min-[420px]:grid-cols-2">
                            <div className="flex items-baseline justify-between gap-3 min-[420px]:justify-start">
                                <dt className="text-fg-muted">Fonds de caisse</dt>
                                <dd className="font-semibold text-fg tabular-nums">{formatFcfa(openingFloat)}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3 min-[420px]:justify-start">
                                <dt className="text-fg-muted">Encaissé</dt>
                                <dd className="font-semibold text-success-fg tabular-nums">{collected > 0 ? `+${formatFcfa(collected)}` : formatFcfa(collected)}</dd>
                            </div>
                            <div className="flex items-baseline justify-between gap-3 min-[420px]:col-span-2 min-[420px]:justify-start">
                                <dt className="font-semibold text-fg">Total attendu en caisse</dt>
                                <dd className="font-bold text-fg tabular-nums">{formatFcfa(openingFloat + collected)}</dd>
                            </div>
                        </dl>
                    </div>
                </div>
                <Button variant="secondary" onClick={onCloseShiftClick} leftIcon={<Receipt size={18} />} className="w-full flex-shrink-0 sm:w-auto">
                    Clôturer ma caisse
                </Button>
            </section>
        );
    }

    return (
        <section
            aria-labelledby="scanner-caisse-titre"
            className="flex flex-col gap-3 rounded-2xl border border-warning-border bg-warning-bg p-4 sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface text-warning-fg" aria-hidden="true">
                    <Coins size={20} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                        <span id="scanner-caisse-titre" className="text-base font-semibold text-warning-fg">Caisse fermée</span>
                        <span className="text-sm font-medium text-warning-fg">Encaissement en espèces bloqué</span>
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-fg">
                        Ouvrez votre caisse avec le régisseur avant d’encaisser des billets réglés sur place.
                    </p>
                </div>
            </div>
            <Button variant="primary" onClick={onOpenShiftClick} leftIcon={<Lock size={18} />} className="w-full flex-shrink-0 sm:w-auto">
                Ouvrir ma caisse
            </Button>
        </section>
    );
}
