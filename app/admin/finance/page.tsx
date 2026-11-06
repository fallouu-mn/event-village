'use client';

/**
 * Rapprochement financier (CDC §84), lot 3 : montants persistés renvoyés par
 * GET /api/admin/finance/reconciliation (paiements plateforme encaissés). Frais de service perçus,
 * frais agrégateur, revenu net Event Village (remboursements déduits), reversements partenaires et
 * commissions sont affichés tels que calculés par le serveur ; aucun taux n'est codé ni appliqué ici.
 * Lot 8 (A3, contrat 3.10) : remboursements à reprendre (RefundsToRetry). L'écran passe sur les jetons du système de
 * design : capturé pour la première fois, il n'avait jamais tenu les contrôles bloquants à 390 px (« § », contrastes,
 * textes sous 14 px, cibles sous 44 px). Il reste hors de la liste des fichiers migrés (A22).
 */

import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  DollarSign,
  RefreshCw,
  Undo2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select } from '@/components/ui/Field';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { RefundsToRetry } from '@/components/admin/RefundsToRetry';
import { StatusBadge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { readJsonBody, serverErrorMessage } from '@/components/payment/PaymentModal';
import type { FinancialReconciliationItem, FinancialReconciliationSummary } from '@/lib/admin/admin.service';

type PeriodPreset = 'ALL' | '30D' | '7D';

const PERIODS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'ALL', label: 'Tout' },
  { value: '30D', label: '30 jours' },
  { value: '7D', label: '7 jours' },
];

const STATUSES: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Tous les paiements encaissés' },
  { value: 'SUCCESS', label: 'Confirmés' },
  { value: 'PARTIAL', label: 'Partiellement remboursés' },
  { value: 'REFUND_PENDING', label: 'Remboursement en cours' },
  { value: 'REFUNDED', label: 'Remboursés' },
];

const TARGET_LABELS: Record<string, string> = {
  TICKET: 'Billetterie',
  ORDER: 'Commande',
  HALL_RESERVATION: 'Salle',
  TABLE_RESERVATION: 'Table',
  SUBSCRIPTION: 'Abonnement',
};

const OPERATOR_NAMES: Record<string, string> = { WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', SAMIRPAY: 'SamirPay' };

function formatPrice(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(amount)} FCFA`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' });
}

/** Taux de frais de service recopié sur le paiement (information), sans aucun calcul. */
function serviceFeeLabel(item: FinancialReconciliationItem): string {
  return item.platformFeeRate !== null ? `${formatPrice(item.serviceFee)} (${item.platformFeeRate.toLocaleString('fr-FR')} %)` : formatPrice(item.serviceFee);
}

function isReconciliation(body: unknown): body is { summary: FinancialReconciliationSummary; items: FinancialReconciliationItem[] } {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.summary === 'object' && b.summary !== null && Array.isArray(b.items);
}

export default function AdminFinanceReconciliationPage() {
  const fieldId = useId();
  const [summary, setSummary] = useState<FinancialReconciliationSummary | null>(null);
  const [items, setItems] = useState<FinancialReconciliationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refundsRefresh, setRefundsRefresh] = useState(0);

  const fetchReconciliation = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (periodPreset !== 'ALL') {
        const d = new Date();
        d.setDate(d.getDate() - (periodPreset === '7D' ? 7 : 30));
        params.set('startDate', d.toISOString());
      }
      const res = await fetch(`/api/admin/finance/reconciliation?${params.toString()}`, { cache: 'no-store' });
      const body = await readJsonBody(res, 'rapprochement financier');
      if (!res.ok) {
        setLoadError(serverErrorMessage(body) ?? `Le rapprochement n’a pas pu être chargé (erreur ${res.status}).`);
        return;
      }
      if (!isReconciliation(body)) {
        console.error('[rapprochement financier] réponse inattendue :', body);
        setLoadError('Réponse inattendue du serveur.');
        return;
      }
      setSummary(body.summary);
      setItems(body.items);
      setLoadError(null);
    } catch (err) {
      console.error('[rapprochement financier] chargement impossible :', err);
      setLoadError('Connexion impossible : vérifiez votre réseau puis réessayez.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, periodPreset]);

  useEffect(() => {
    void fetchReconciliation();
  }, [fetchReconciliation]);

  const kpis = summary
    ? [
        { label: 'Volume encaissé', value: summary.totalGrossVolume, tone: 'text-fg', help: `${summary.totalTransactionsCount} paiement(s), frais de service compris` },
        { label: 'Frais de service perçus', value: summary.totalServiceFees, tone: 'text-fg', help: 'Payés par les acheteurs, montants enregistrés sur chaque paiement' },
        { label: 'Frais agrégateur (SamirPay)', value: summary.totalAggregatorFees, tone: 'text-warning-fg', help: 'Prélevés sur les frais de service' },
        { label: 'Revenu net Event Village', value: summary.totalPlatformNetRevenue, tone: 'text-brand-fg', help: 'Frais de service moins frais agrégateur, remboursements déduits' },
        { label: 'Reversements partenaires', value: summary.totalPartnerPayouts, tone: 'text-success-fg', help: 'Prix des billets et prestations dus aux partenaires' },
        { label: 'Remboursements versés', value: summary.totalRefunds, tone: 'text-fg', help: 'Remboursements confirmés sur la période' },
      ]
    : [];

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        back={{ href: '/admin/dashboard', label: 'Tableau de bord' }}
        title="Rapprochement financier"
        actions={(
          <>
            <LinkButton href="/admin/finance-settings" variant="ghost" size="sm">
              Réglages de la plateforme
            </LinkButton>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setRefundsRefresh((n) => n + 1);
                void fetchReconciliation();
              }}
              disabled={isLoading}
              leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />}
            >
              Actualiser
            </Button>
          </>
        )}
      />

      {loadError && summary && (
        <StatusBanner tone="danger" title="Rapprochement non actualisé" announce="alert">
          {loadError}
        </StatusBanner>
      )}

      {/* Synthèse */}
      {!summary ? (
        loadError ? (
          <ErrorState title="Rapprochement indisponible" description={loadError} onRetry={() => void fetchReconciliation()} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
            <span className="sr-only">Chargement du rapprochement…</span>
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28 rounded-3xl" />)}
          </div>
        )
      ) : (
        <>
          <section aria-label="Synthèse financière" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((k) => (
              <div key={k.label} className="p-5 rounded-3xl bg-surface border border-border shadow-xs space-y-1">
                <span className="text-sm text-fg-muted font-medium">{k.label}</span>
                <p className={`text-xl sm:text-2xl font-black tabular-nums ${k.tone}`}>{formatPrice(k.value)}</p>
                <span className="text-sm text-fg-muted block leading-relaxed">{k.help}</span>
              </div>
            ))}
          </section>

          <section aria-label="Parrainage, retraits et écarts" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-surface-sunken border border-border flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-sm text-fg-muted font-bold">Commissions parrainage (N1 + N2)</span>
                <p className="text-base font-black text-fg tabular-nums">{formatPrice(summary.totalReferralCommissions)}</p>
              </div>
              <Users size={22} className="text-brand-fg shrink-0" aria-hidden="true" />
            </div>
            <div className="p-4 rounded-2xl bg-surface-sunken border border-border flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-sm text-fg-muted font-bold">Revenu net après parrainage</span>
                <p className="text-base font-black text-brand-fg tabular-nums">{formatPrice(summary.platformNetBalance)}</p>
              </div>
              <DollarSign size={22} className="text-brand-fg shrink-0" aria-hidden="true" />
            </div>
            <div className="p-4 rounded-2xl bg-surface-sunken border border-border flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-sm text-fg-muted font-bold">Retraits versés</span>
                <p className="text-base font-black text-fg tabular-nums">{formatPrice(summary.totalWithdrawalsPaid)}</p>
              </div>
              <CreditCard size={22} className="text-success-fg shrink-0" aria-hidden="true" />
            </div>
            <div className="p-4 rounded-2xl bg-surface-sunken border border-border flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-sm text-fg-muted font-bold">Écarts de rapprochement</span>
                <p className={`text-base font-black tabular-nums ${summary.discrepanciesCount ? 'text-danger-fg' : 'text-success-fg'}`}>
                  {summary.discrepanciesCount} anomalie(s)
                </p>
              </div>
              {summary.discrepanciesCount ? (
                <AlertTriangle size={22} className="text-danger-fg shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={22} className="text-success-fg shrink-0" aria-hidden="true" />
              )}
            </div>
          </section>
        </>
      )}

      <RefundsToRetry refreshToken={refundsRefresh} />

      {/* Lignes */}
      <section aria-labelledby={`${fieldId}-lignes`} className="p-4 sm:p-6 rounded-3xl bg-surface border border-border shadow-xs space-y-6">
        <div className="flex flex-col gap-4 border-b border-border pb-4">
          <div>
            <h2 id={`${fieldId}-lignes`} className="text-lg font-semibold text-fg">Paiements rapprochés</h2>
            <p className="text-sm text-fg-muted mt-0.5 leading-relaxed">
              Contrôle du serveur, paiement par paiement : total débité = reversement partenaire + frais de service ; frais de service = frais agrégateur + revenu net Event Village.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <Select
              label="Statut"
              id={`${fieldId}-statut`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUSES}
              fieldClassName="sm:w-80"
            />
            <div role="group" aria-label="Période" className="flex items-center gap-1 p-1 rounded-xl bg-surface-sunken">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={periodPreset === p.value}
                  onClick={() => setPeriodPreset(p.value)}
                  className={`min-h-11 whitespace-nowrap px-3 rounded-lg text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    periodPreset === p.value ? 'bg-brand text-on-brand' : 'text-fg-muted'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading && items.length === 0 ? (
          <div className="space-y-2" aria-busy="true">
            <span className="sr-only">Chargement des paiements…</span>
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-fg-muted">
            <DollarSign size={32} className="mx-auto text-fg-muted mb-2" aria-hidden="true" />
            <p className="text-sm font-bold">Aucun paiement encaissé pour cette période.</p>
          </div>
        ) : (
          <>
            {/* Mobile : cartes */}
            <ul className="md:hidden space-y-3">
              {items.map((item) => (
                <li key={item.paymentId} className="p-4 rounded-2xl bg-surface-sunken border border-border space-y-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-fg break-all">{item.transactionReference}</p>
                      <p className="text-sm text-fg-muted">
                        {TARGET_LABELS[item.targetType] ?? 'Autre objet'} · {OPERATOR_NAMES[item.paymentMethod] ?? 'Autre moyen'} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
                    <dt className="text-fg-muted">Total débité</dt>
                    <dd className="text-right font-black text-fg">{formatPrice(item.grossAmount)}</dd>
                    <dt className="text-fg-muted">Prix</dt>
                    <dd className="text-right font-bold text-fg">{item.facialAmount !== null ? formatPrice(item.facialAmount) : '—'}</dd>
                    <dt className="text-fg-muted">Frais de service</dt>
                    <dd className="text-right font-bold text-fg">{serviceFeeLabel(item)}</dd>
                    <dt className="text-fg-muted">Frais agrégateur</dt>
                    <dd className="text-right text-warning-fg">{formatPrice(item.aggregatorFee)}</dd>
                    <dt className="text-fg-muted">Net Event Village</dt>
                    <dd className="text-right font-bold text-brand-fg">{formatPrice(item.platformNetRevenue)}</dd>
                    <dt className="text-fg-muted">Partenaire</dt>
                    <dd className="text-right font-bold text-success-fg">{formatPrice(item.partnerPayout)}</dd>
                    {item.refundedAmount > 0 && (
                      <>
                        <dt className="text-fg-muted">Remboursé</dt>
                        <dd className="text-right font-bold text-fg">{formatPrice(item.refundedAmount)}</dd>
                      </>
                    )}
                    <dt className="text-fg-muted">Parrainage</dt>
                    <dd className="text-right text-fg-muted">{formatPrice(item.totalReferralCommissions)}</dd>
                  </dl>
                  {item.discrepancy !== 0 && (
                    <p className="flex items-center gap-1.5 font-bold tabular-nums text-danger-fg">
                      <AlertTriangle size={13} aria-hidden="true" /> Écart : {formatPrice(item.discrepancy)}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {/* Écran large : tableau */}
            <div role="region" aria-label="Paiements rapprochés, tableau défilable" tabIndex={0} className="hidden md:block overflow-x-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <table className="w-full min-w-[1240px] text-sm text-left">
                <caption className="sr-only">Paiements encaissés et leur répartition</caption>
                <thead>
                  <tr className="border-b border-border text-fg-muted font-bold">
                    <th scope="col" className="pb-3 pr-3">Référence</th>
                    <th scope="col" className="pb-3 pr-3">Objet · moyen</th>
                    <th scope="col" className="pb-3 pr-3">Statut</th>
                    <th scope="col" className="pb-3 pr-3 text-right">Total débité</th>
                    <th scope="col" className="pb-3 pr-3 text-right">Prix</th>
                    <th scope="col" className="pb-3 pr-3 text-right">Frais de service</th>
                    <th scope="col" className="pb-3 pr-3 text-right">Frais agrégateur</th>
                    <th scope="col" className="pb-3 pr-3 text-right">Net Event Village</th>
                    <th scope="col" className="pb-3 pr-3 text-right">Partenaire</th>
                    <th scope="col" className="pb-3 pr-3 text-right">Remboursé</th>
                    <th scope="col" className="pb-3 pr-3 text-right">Parrainage</th>
                    <th scope="col" className="pb-3 pr-3 text-center">Écart</th>
                    <th scope="col" className="pb-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums whitespace-nowrap">
                  {items.map((item) => (
                    <tr key={item.paymentId} className="hover:bg-surface-sunken">
                      <td className="py-3 pr-3 font-mono font-bold text-fg">{item.transactionReference}</td>
                      <td className="py-3 pr-3 text-fg-muted">
                        {TARGET_LABELS[item.targetType] ?? 'Autre objet'} · {OPERATOR_NAMES[item.paymentMethod] ?? 'Autre moyen'}
                      </td>
                      <td className="py-3 pr-3"><StatusBadge status={item.status} /></td>
                      <td className="py-3 pr-3 text-right font-black text-fg">{formatPrice(item.grossAmount)}</td>
                      <td className="py-3 pr-3 text-right text-fg-muted">{item.facialAmount !== null ? formatPrice(item.facialAmount) : '—'}</td>
                      <td className="py-3 pr-3 text-right font-bold text-fg whitespace-nowrap">{serviceFeeLabel(item)}</td>
                      <td className="py-3 pr-3 text-right text-warning-fg">{formatPrice(item.aggregatorFee)}</td>
                      <td className="py-3 pr-3 text-right font-bold text-brand-fg">{formatPrice(item.platformNetRevenue)}</td>
                      <td className="py-3 pr-3 text-right font-bold text-success-fg">{formatPrice(item.partnerPayout)}</td>
                      <td className="py-3 pr-3 text-right text-fg-muted">
                        {item.refundedAmount > 0 ? (
                          <span className="inline-flex items-center gap-1"><Undo2 size={12} aria-hidden="true" />{formatPrice(item.refundedAmount)}</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 pr-3 text-right text-fg-muted">{formatPrice(item.totalReferralCommissions)}</td>
                      <td className="py-3 pr-3 text-center font-bold">
                        {item.discrepancy === 0 ? (
                          <span className="text-success-fg text-sm">Aucun</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-danger-fg text-sm">
                            <AlertTriangle size={12} aria-hidden="true" /> {formatPrice(item.discrepancy)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right text-fg-muted text-sm whitespace-nowrap">{formatDate(item.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
