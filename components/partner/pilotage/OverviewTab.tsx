import React from 'react';
import { Armchair, Banknote, DoorOpen, Gift, Percent, RotateCcw, Smartphone, Tags, Ticket } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { KpiCard } from '@/components/ui/KpiCard';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { formatFcfa, formatInteger, formatPercent, formatDateTime } from '@/lib/format';
import { KpiAmount, PilotageSection } from './PilotageBlocks';
import type { PilotageOverview } from './types';

/**
 * Onglet Aperçu (contrat I) : billets vendus / capacité, recettes (en ligne, espèces, remboursé), entrées
 * et taux de présence, tels que calculés par pilotage_overview. `saleStopped` (événement annulé) : les places
 * « en vente » et « restantes » n'ont plus de sens, une carte le dit à leur place (relecture du run 98).
 */
export function OverviewTab({ data, saleStopped = false }: { data: PilotageOverview; saleStopped?: boolean }) {
    const { tickets, entries, revenue } = data;
    const refundedCash = revenue.refunded_cash_organizer ?? 0;
    return (
        <div className="flex flex-col gap-6">
            {tickets.capacity_exceeded && (
                <StatusBanner tone="warning" title="Les quotas dépassent la jauge déclarée" className="tabular-nums">
                    La somme des quotas des catégories actives ({formatInteger(tickets.capacity)} places) dépasse la jauge
                    déclarée de l’événement ({formatInteger(tickets.declared_capacity)} places). Vérifiez vos catégories.
                </StatusBanner>
            )}

            <PilotageSection title="Billetterie" description="Billets valides et utilisés, hors invitations.">
                <div className={cn('grid grid-cols-2 gap-3', saleStopped ? 'xl:grid-cols-3' : 'xl:grid-cols-4')}>
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
                    {saleStopped ? (
                        <KpiCard label="Vente" value="Arrêtée" hint="Événement annulé : aucune place n’est plus proposée" tone="danger" icon={<Tags size={18} />} />
                    ) : (
                        <>
                            <KpiCard
                                label="Places en vente"
                                value={formatInteger(tickets.capacity)}
                                hint="Quotas des catégories actives"
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
                <div className="grid grid-cols-2 gap-3">
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

            <PilotageSection title="Recettes" description="Montants des billets, remboursements déduits pour les ventes en ligne.">
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
                    <KpiCard label="En ligne" value={<KpiAmount value={formatFcfa(revenue.online)} />} hint="Paiements mobiles confirmés" tone="success" icon={<Smartphone size={18} />} />
                    <KpiCard label="En espèces" value={<KpiAmount value={formatFcfa(revenue.cash)} />} hint="Encaissées par vos contrôleurs" tone="warning" icon={<Banknote size={18} />} />
                    <KpiCard
                        label="Remboursé"
                        value={<KpiAmount value={formatFcfa(revenue.refunded)} />}
                        hint={refundedCash > 0 ? `dont ${formatFcfa(refundedCash)} en espèces à rembourser par vous` : 'Remboursements en ligne'}
                        tone="danger"
                        icon={<RotateCcw size={18} />}
                    />
                </div>
            </PilotageSection>

            <p className="text-sm text-fg-muted">
                Chiffres calculés le <time dateTime={data.computed_at}>{formatDateTime(data.computed_at)}</time>.
            </p>
        </div>
    );
}
