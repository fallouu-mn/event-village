import React from 'react';
import { Armchair, Banknote, DoorOpen, Gift, Landmark, PauseCircle, Percent, RotateCcw, Smartphone, Tags, Ticket } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatFcfa, formatInteger, formatPercent, formatDateTime } from '@/lib/format';
import { KpiAmount, PilotageSection } from './PilotageBlocks';
import type { PilotageOverview } from './types';

/** État de la vente pour l'onglet Aperçu : en cours, suspendue avec l'événement, arrêtée par l'annulation. */
export type SaleState = 'OPEN' | 'SUSPENDED' | 'CANCELLED';

/** État de la vente déduit du statut servi par pilotage_overview, sauf indication explicite de l'appelant. */
function saleStateOf(data: PilotageOverview, saleStopped: boolean, saleState?: SaleState): SaleState {
    if (saleState) return saleState;
    if (saleStopped || data.status === 'ANNULE') return 'CANCELLED';
    if (data.status === 'SUSPENDU') return 'SUSPENDED';
    return 'OPEN';
}

/**
 * Onglet Aperçu (contrat I) : billets vendus / capacité, recettes (brut, remboursements, recettes nettes, espèces), entrées
 * et taux de présence, tels que calculés par pilotage_overview. Vente arrêtée (événement annulé) : les places
 * « en vente » et « restantes » n'ont plus de sens, une carte le dit à leur place (relecture du run 98).
 * Lot 9 bis (R105 ; contrat 5.41, D-txt E.41) : pendant une suspension, aucune place n'est proposée non plus ;
 * la carte « Vente » dit « Suspendue » au lieu de « Places en vente » et « Places restantes ».
 */
export function OverviewTab({ data, saleStopped = false, saleState }: { data: PilotageOverview; saleStopped?: boolean; saleState?: SaleState }) {
    const { tickets, entries, revenue } = data;
    const refundedCash = revenue.refunded_cash_organizer ?? 0;
    // Brut et remboursements en ligne : servis par pilotage_compute_overview (online_gross, refunded_online) ; absents
    // d'une réponse, leurs cartes ne s'affichent pas (jamais recalculés ici) et la console le signale.
    const onlineGross = typeof revenue.online_gross === 'number' ? revenue.online_gross : null;
    const refundedOnline = typeof revenue.refunded_online === 'number' ? revenue.refunded_online : null;
    if (onlineGross === null || refundedOnline === null) console.warn('[pilotage] aperçu : brut ou remboursements en ligne absents de la réponse du serveur');
    const sale = saleStateOf(data, saleStopped, saleState);
    return (
        <div className="flex flex-col gap-6">
            {tickets.capacity_exceeded && (
                <StatusBanner tone="warning" title="Les quantités mises en vente dépassent la jauge déclarée" className="tabular-nums">
                    La somme des quantités mises en vente des catégories actives ({formatInteger(tickets.capacity)} places) dépasse la jauge
                    déclarée de l’événement ({formatInteger(tickets.declared_capacity)} places). Vérifiez vos catégories.
                </StatusBanner>
            )}

            <PilotageSection title="Billetterie" description="Billets valides et utilisés, hors invitations.">
                <div className={cn('grid grid-cols-1 gap-3 min-[360px]:grid-cols-2', sale === 'OPEN' ? 'xl:grid-cols-4' : 'xl:grid-cols-3')}>
                    {/* Les ventes comptent toutes les catégories, y compris une catégorie désactivée après ses
                        ventes, alors que la capacité ne compte que les catégories actives : « 82 sur 240 places »
                        et « 178 restantes » ne tombaient pas juste (relecture du run 77). Le texte dit ce que
                        chaque chiffre compte, sans suggérer une fraction. */}
                    <KpiCard
                        label="Billets vendus"
                        value={formatInteger(tickets.sold)}
                        hint="Toutes catégories, y compris désactivées"
                        tone="brand"
                        icon={<Ticket size={18} />}
                    />
                    {sale === 'CANCELLED' ? (
                        <KpiCard label="Vente" value="Arrêtée" hint="Événement annulé : aucune place n’est plus proposée" tone="danger" icon={<Tags size={18} />} />
                    ) : sale === 'SUSPENDED' ? (
                        <KpiCard label="Vente" value="Suspendue" hint="Événement suspendu : la vente reprendra à la réactivation" tone="warning" icon={<PauseCircle size={18} />} />
                    ) : (
                        <>
                            <KpiCard
                                label="Places en vente"
                                value={formatInteger(tickets.capacity)}
                                hint="Quantités mises en vente des catégories actives"
                                tone="neutral"
                                icon={<Tags size={18} />}
                            />
                            <KpiCard
                                label="Places restantes"
                                value={formatInteger(tickets.remaining)}
                                hint={tickets.in_payment > 0
                                    ? `Dans les catégories actives, sans compter ${formatInteger(tickets.in_payment)} en cours de paiement`
                                    : 'Dans les catégories actives'}
                                tone="neutral"
                                icon={<Armchair size={18} />}
                            />
                        </>
                    )}
                    <KpiCard label="Invitations" value={formatInteger(tickets.invitations)} hint="Places offertes, comptées à part" tone="neutral" icon={<Gift size={18} />} />
                </div>
            </PilotageSection>

            <PilotageSection title="Contrôle d’accès" description="Passages validés au scan et au guichet.">
                <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                    <KpiCard
                        label="Entrées"
                        value={formatInteger(entries.total)}
                        hint={`dont ${formatInteger(entries.counter)} au guichet`}
                        tone="success"
                        icon={<DoorOpen size={18} />}
                    />
                    <KpiCard
                        label="Taux de présence"
                        value={formatPercent(entries.attendance_rate)}
                        hint="Part des participants attendus (ventes et invitations) déjà passés"
                        tone="info"
                        icon={<Percent size={18} />}
                    />
                </div>
            </PilotageSection>

            {/* Design 1c (E-64, G-26) : détail brut → remboursé → net, un seul nom pour le net (« Recettes nettes »).
                revenue.online est déjà net (Σ écritures VENTE + REMBOURSEMENT du grand livre) : rien n'est soustrait ici. */}
            <PilotageSection title="Recettes" description="Ventes en ligne, remboursements, recettes nettes ; les espèces sont comptées à part.">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {onlineGross !== null && (
                        <KpiCard label="Ventes en ligne (brut)" value={<KpiAmount value={formatFcfa(onlineGross)} />} hint="Paiements mobiles confirmés, avant remboursements" tone="info" icon={<Smartphone size={18} />} />
                    )}
                    {refundedOnline !== null && (
                        <KpiCard label="Remboursements" value={<KpiAmount value={formatFcfa(refundedOnline)} />} hint="Billets payés en ligne puis remboursés" tone="danger" icon={<RotateCcw size={18} />} />
                    )}
                    <KpiCard label="Recettes nettes" value={<KpiAmount value={formatFcfa(revenue.online)} />} hint="Ventes en ligne moins les remboursements." tone="success" icon={<Landmark size={18} />} />
                    <KpiCard
                        label="Ventes en espèces"
                        value={<KpiAmount value={formatFcfa(revenue.cash)} />}
                        hint={refundedCash > 0 ? `Encaissées par vos contrôleurs, hors solde ; dont ${formatFcfa(refundedCash)} à rembourser par vous` : 'Encaissées par vos contrôleurs, hors solde'}
                        tone="warning"
                        icon={<Banknote size={18} />}
                    />
                </div>
            </PilotageSection>

            <p className="text-sm text-muted-foreground">
                Chiffres calculés le <time dateTime={data.computed_at}>{formatDateTime(data.computed_at)}</time>.
            </p>
        </div>
    );
}
