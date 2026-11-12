import React from 'react';
import { CalendarClock, Landmark, UserX } from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { formatDateTime, formatFcfa, formatInteger } from '@/lib/format';
import { EntriesBreakdown } from './EntriesBreakdown';
import { DefinitionRow, KpiAmount, KpiValue, PilotageSection } from './PilotageBlocks';
import type { PilotageClosing } from './types';

/**
 * Rapport de clôture unique (lot 9 ter, R106 b) : rendu tel quel du corps de pilotage_closing, par l'onglet Clôture du
 * pilotage et par la fenêtre « Rapport de clôture » du tableau de bord. Aucun chiffre n'est calculé ici ; la section
 * « Entrées » reprend les vues figées servies par la base (sans nom d'invité ni donnée en direct).
 */
export function ClosingReportSummary({ closing }: { closing: PilotageClosing }) {
    const { finance, report, absents, entries } = closing;
    const fundsFrom = finance.funds_available_from;
    const fundsTo = finance.funds_available_to;

    return (
        <div className="flex flex-col gap-6">
            {/* Une colonne sous sm : à deux colonnes, libellés coupés sur 4 lignes, montant et date sur 2 (run 98) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <KpiCard label="Montant net organisateur" value={<KpiAmount value={formatFcfa(finance.organizer_net)} />} hint="Ventes en ligne, remboursements déduits" tone="success" icon={<Landmark size={18} />} />
                <KpiCard
                    label="Disponibilité des fonds"
                    value={<KpiValue>{fundsFrom ? formatDateTime(fundsFrom) : 'Aucune vente en ligne'}</KpiValue>}
                    hint={fundsFrom && fundsTo && fundsTo !== fundsFrom ? `jusqu’au ${formatDateTime(fundsTo)} pour les dernières ventes` : 'Selon le délai de versement de la plateforme'}
                    tone="info"
                    icon={<CalendarClock size={18} />}
                />
                <KpiCard label="Absents" value={formatInteger(absents.count)} hint="Billets valides jamais scannés à l’entrée" tone="neutral" icon={<UserX size={18} />} />
            </div>

            <PilotageSection title="Rapport de clôture" description="Bilan complet de l’événement.">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <dl className="rounded-2xl border border-border bg-surface px-4 py-1">
                        <DefinitionRow label="Billets vendus (hors invitations)" value={formatInteger(report.tickets.sold)} />
                        <DefinitionRow label="Invitations" value={formatInteger(report.tickets.invitations)} />
                        <DefinitionRow label="Capacité mise en vente" value={formatInteger(report.tickets.capacity)} />
                        <DefinitionRow label="Entrées (dont guichet)" value={`${formatInteger(report.entries.total)} (${formatInteger(report.entries.counter)})`} />
                        <DefinitionRow label="Refus au contrôle" value={formatInteger(report.entries.refused)} />
                    </dl>
                    <dl className="rounded-2xl border border-border bg-surface px-4 py-1">
                        <DefinitionRow label="Recettes en ligne" value={formatFcfa(report.revenue.online)} />
                        <DefinitionRow label="Recettes en espèces" value={formatFcfa(report.revenue.cash)} />
                        <DefinitionRow label="Remboursé" value={formatFcfa(report.revenue.refunded)} />
                        <DefinitionRow label="Frais de service payés par les acheteurs" value={formatFcfa(finance.buyer_service_fees)} />
                        <DefinitionRow label="Déjà disponible / en attente" value={`${formatFcfa(finance.available)} / ${formatFcfa(finance.pending)}`} />
                    </dl>
                </div>
            </PilotageSection>

            {entries && (
                <PilotageSection title="Entrées">
                    <EntriesBreakdown views={entries} ownerView={false} />
                </PilotageSection>
            )}
        </div>
    );
}
