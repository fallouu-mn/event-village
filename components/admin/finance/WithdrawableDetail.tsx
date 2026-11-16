'use client';

import React, { useId } from 'react';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { LinkButton } from '@/components/ui/LinkButton';
import { formatFcfaPrecise, formatTime } from '@/lib/format';
import type { FinanceSummary } from '@/lib/finance/admin-summary';
import { MoneyLines } from './MoneyFigure';
import { signed } from './EarnedDetail';

export interface WithdrawableView {
    visible: true;
    balance: { solde: number; readAt: string; cached: boolean } | null;
    amount: number | null;
    shortfall: number | null;
    simulated: boolean;
}

/** Textes exacts (consigne de la finition 3a), partagés par la carte et le calcul. */
export const NOTHING_WITHDRAWABLE = 'Rien n’est retirable pour le moment : l’argent du compte est dû aux partenaires et aux clients.';
export const BALANCE_UNREADABLE = 'Solde SamirPay illisible pour le moment';
export const RESERVE_EXPLAINED = 'En attendant la confirmation du délai de SamirPay, une réserve est gardée sur le compte.';

/** Phrase de la réserve de prudence selon son réglage. */
export function reserveText(reserve: FinanceSummary['reserve']): React.ReactNode {
    return reserve.mode === 'FIXED'
        ? <>Montant fixe choisi par le Superadmin : <span className="font-semibold tabular-nums">{formatFcfaPrecise(reserve.fixed_amount)}</span>.</>
        : <>Automatique : les encaissements des 3 derniers jours, soit <span className="font-semibold tabular-nums">{formatFcfaPrecise(reserve.auto_amount)}</span> aujourd’hui.</>;
}

/**
 * Finition 3a (E-06) — calcul de « Retirable par Event Village » (#calcul-retirable), SUPERADMIN seulement : solde
 * SamirPay lu par le serveur (heure de lecture), moins tout ce qui est dû et la réserve de prudence. Solde illisible :
 * aucun chiffre ; résultat jamais négatif, le manque est dit à part.
 */
export function WithdrawableDetail({ view, summary }: { view: WithdrawableView; summary: FinanceSummary }) {
    const id = useId();
    const { balance, amount, shortfall } = view;
    return (
        <section id="calcul-retirable" aria-labelledby={`${id}-titre`} className="flex scroll-mt-20 flex-col gap-4 rounded-3xl border border-border bg-surface p-4 sm:p-6">
            <div className="flex flex-col gap-1">
                <h2 id={`${id}-titre`} className="text-lg font-semibold text-fg">Calcul de ce qui est retirable</h2>
                <p className="text-sm leading-relaxed text-fg-muted">
                    Ce que vous pouvez sortir du compte SamirPay sans empêcher un partenaire, un parrain ou un client d’être payé.
                    Si ce chiffre est à 0, ne retirez rien.
                </p>
            </div>
            {view.simulated && (
                <StatusBanner tone="info" title="Mode d’essai">Chiffres sans valeur réelle : le solde vient du faux service de paiement.</StatusBanner>
            )}
            {balance === null ? (
                <StatusBanner tone="warning" title={BALANCE_UNREADABLE}>Ne retirez rien avant qu’il s’affiche. Rechargez la page dans quelques minutes.</StatusBanner>
            ) : (
                <MoneyLines
                    lines={[
                        { label: 'Solde du compte SamirPay', value: formatFcfaPrecise(balance.solde), hint: <>Lu à <time dateTime={balance.readAt} className="tabular-nums">{formatTime(balance.readAt)}</time> (heure de Dakar), relu au plus toutes les 5 minutes.</> },
                        { label: 'Dû aux partenaires', value: signed(summary.owed_partners.total, '−') },
                        { label: 'Dû aux parrains', value: signed(summary.owed_referrers.total, '−') },
                        { label: 'Remboursements à verser', value: signed(summary.refunds_to_pay.total, '−') },
                        { label: 'Réserve de prudence', value: signed(summary.reserve.amount, '−'), hint: <>{RESERVE_EXPLAINED} {reserveText(summary.reserve)}</> },
                        { label: 'Retirable par Event Village', value: formatFcfaPrecise(amount ?? 0), total: true },
                    ]}
                />
            )}
            {balance !== null && amount === 0 && (
                <StatusBanner tone={shortfall && shortfall > 0 ? 'danger' : 'warning'} title={NOTHING_WITHDRAWABLE}>
                    {shortfall && shortfall > 0
                        ? <>Le compte SamirPay ne couvre pas tout ce qui est dû : il manque <span className="font-semibold tabular-nums">{formatFcfaPrecise(shortfall)}</span>. Ne retirez rien : des versements risquent de se bloquer.</>
                        : 'Ne retirez rien pour le moment.'}
                </StatusBanner>
            )}
            <div>
                <LinkButton href="/admin/finance-settings" variant="secondary">Changer la réserve de prudence</LinkButton>
            </div>
        </section>
    );
}
