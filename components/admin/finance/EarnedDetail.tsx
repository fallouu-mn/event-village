'use client';

import React, { useId } from 'react';
import { formatFcfaPrecise, formatInteger } from '@/lib/format';
import type { EarnedBlock } from '@/lib/finance/admin-summary';
import { MoneyLines, type MoneyLine } from './MoneyFigure';

/** Montant précédé de son effet sur le total : « + 685,00 F CFA », « − 342,50 F CFA ». */
export function signed(amount: number, sign: '+' | '−'): string {
    return `${sign} ${formatFcfaPrecise(Math.abs(amount))}`;
}

function plural(n: number, one: string, many: string): string {
    return `${formatInteger(n)} ${n > 1 ? many : one}`;
}

/**
 * Finition 3a (E-06, E-30) — détail de « Gagné par Event Village » (#detail-gagne) : chaque composante avec la date
 * qu'elle utilise ; les lignes s'additionnent exactement au total (calculé par le serveur, aucun calcul ici).
 */
export function EarnedDetail({ earned, range }: { earned: EarnedBlock; range: string }) {
    const id = useId();
    const lines: MoneyLine[] = [
        {
            // Correctifs de la contre-vérification du lot 10a (T6) : la commission sur les salles est comprise dans ce montant
            label: 'Frais de service, moins les frais d’encaissement SamirPay',
            value: signed(earned.net_revenue, earned.net_revenue < 0 ? '−' : '+'),
            hint: <>{plural(earned.payments, 'paiement encaissé', 'paiements encaissés')} {range} : <span className="tabular-nums">{formatFcfaPrecise(earned.service_fees)}</span> de frais de service, {Number(earned.hall_commissions) > 0 ? <><span className="tabular-nums">{formatFcfaPrecise(earned.hall_commissions)}</span> de commission sur les salles, </> : null}<span className="tabular-nums">{formatFcfaPrecise(earned.aggregator_fees)}</span> de frais d’encaissement estimés au taux des réglages (SamirPay ne les communique pas).</>,
        },
        {
            label: 'Part rendue avec les remboursements',
            value: signed(earned.refunded_net, '−'),
            hint: 'Frais de service des billets et paiements remboursés, demandés sur ces mêmes paiements.',
        },
    ];
    if (earned.duplicate_withheld !== 0) {
        lines.push({ label: 'Frais gardés sur des paiements en double', value: signed(earned.duplicate_withheld, '+'), hint: 'À partir du troisième paiement en double d’un même compte en 30 jours.' });
    }
    lines.push(
        { label: 'Frais de retrait', value: signed(earned.withdrawal_fees, '+'), hint: `${plural(earned.withdrawals_paid, 'retrait versé', 'retraits versés')} ${range}.` },
        { label: 'Frais SamirPay des versements', value: signed(earned.samirpay_fees, '−'), hint: `Frais réels de ${plural(earned.cashouts_with_fees, 'versement confirmé', 'versements confirmés')} ${range} (remboursements et retraits).` },
    );
    if (earned.rebilled !== 0) {
        lines.push({ label: 'Frais repris aux partenaires', value: signed(earned.rebilled, '+'), hint: 'Frais SamirPay d’un remboursement après une annulation décidée par la partenaire, repris sur son solde.' });
    }
    lines.push({ label: 'Commissions de parrainage', value: signed(earned.commissions, earned.commissions < 0 ? '+' : '−'), hint: 'Sur les paiements encaissés de la période, annulations et reprises déduites.' });
    if (earned.commissions_unrecovered !== 0) {
        lines.push({ label: 'Commissions reprises, pas encore récupérées', value: signed(earned.commissions_unrecovered, '−'), hint: 'Déjà versées puis reprises après un remboursement : le parrain les doit encore (voir Créances).' });
    }
    lines.push({ label: 'Gagné par Event Village', value: formatFcfaPrecise(earned.total), total: true });

    return (
        <section id="detail-gagne" aria-labelledby={`${id}-titre`} className="flex scroll-mt-20 flex-col gap-4 rounded-3xl border border-border bg-card p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h2 id={`${id}-titre`} className="text-lg font-semibold text-foreground-strong">Détail de ce qui a été gagné</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                    Chaque ligne dit la date qu’elle utilise : paiements encaissés, retraits versés ou versements confirmés {range}.
                </p>
            </div>
            <MoneyLines lines={lines} />
        </section>
    );
}
