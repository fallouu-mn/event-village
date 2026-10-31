'use client';

/**
 * Rapprochement financier (CDC §84), lot 3 : montants persistés renvoyés par
 * GET /api/admin/finance/reconciliation (paiements plateforme encaissés). Frais de service perçus,
 * frais agrégateur, revenu net Event Village (remboursements déduits), reversements partenaires et
 * commissions sont affichés tels que calculés par le serveur ; aucun taux n'est codé ni appliqué ici.
 */

import React, { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  DollarSign,
  RefreshCw,
  Undo2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
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
        { label: 'Volume encaissé', value: summary.totalGrossVolume, tone: 'text-slate-900 dark:text-white', help: `${summary.totalTransactionsCount} paiement(s), frais de service compris` },
        { label: 'Frais de service perçus', value: summary.totalServiceFees, tone: 'text-slate-900 dark:text-white', help: 'Payés par les acheteurs, montants enregistrés sur chaque paiement' },
        { label: 'Frais agrégateur (SamirPay)', value: summary.totalAggregatorFees, tone: 'text-amber-600 dark:text-amber-400', help: 'Prélevés sur les frais de service' },
        { label: 'Revenu net Event Village', value: summary.totalPlatformNetRevenue, tone: 'text-[#FF5722]', help: 'Frais de service moins frais agrégateur, remboursements déduits' },
        { label: 'Reversements partenaires', value: summary.totalPartnerPayouts, tone: 'text-emerald-600 dark:text-emerald-400', help: 'Prix des billets et prestations dus aux partenaires' },
        { label: 'Remboursements versés', value: summary.totalRefunds, tone: 'text-slate-900 dark:text-white', help: 'Cashouts de remboursement confirmés sur la période' },
      ]
    : [];

  return (
    <div className="space-y-8 pb-16">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            aria-label="Retour au tableau de bord"
            className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF5722]">Console Superadmin</span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Rapprochement financier (§84)</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/finance-settings"
            className="inline-flex items-center min-h-[44px] px-3 rounded-xl text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-[#FF5722] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722]"
          >
            Réglages financiers
          </Link>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void fetchReconciliation()}
            disabled={isLoading}
            leftIcon={<RefreshCw size={14} className={isLoading ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />}
          >
            Actualiser
          </Button>
        </div>
      </div>

      {loadError && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {loadError}
        </div>
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
              <div key={k.label} className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-1">
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">{k.label}</span>
                <p className={`text-xl sm:text-2xl font-black tabular-nums ${k.tone}`}>{formatPrice(k.value)}</p>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 block leading-relaxed">{k.help}</span>
              </div>
            ))}
          </section>

          <section aria-label="Parrainage, retraits et écarts" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">Commissions parrainage (N1 + N2)</span>
                <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">{formatPrice(summary.totalReferralCommissions)}</p>
              </div>
              <Users size={22} className="text-[#FF5722] shrink-0" aria-hidden="true" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">Revenu net après parrainage</span>
                <p className="text-base font-black text-[#FF5722] tabular-nums">{formatPrice(summary.platformNetBalance)}</p>
              </div>
              <DollarSign size={22} className="text-[#FF5722] shrink-0" aria-hidden="true" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">Retraits versés</span>
                <p className="text-base font-black text-slate-900 dark:text-white tabular-nums">{formatPrice(summary.totalWithdrawalsPaid)}</p>
              </div>
              <CreditCard size={22} className="text-emerald-500 shrink-0" aria-hidden="true" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">Écarts de rapprochement</span>
                <p className={`text-base font-black ${summary.discrepanciesCount ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {summary.discrepanciesCount} anomalie(s)
                </p>
              </div>
              {summary.discrepanciesCount ? (
                <AlertTriangle size={22} className="text-red-500 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={22} className="text-emerald-500 shrink-0" aria-hidden="true" />
              )}
            </div>
          </section>
        </>
      )}

      {/* Lignes */}
      <section aria-labelledby={`${fieldId}-lignes`} className="p-4 sm:p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
          <div>
            <h2 id={`${fieldId}-lignes`} className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">Paiements rapprochés</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
              Contrôle du serveur, paiement par paiement : total débité = reversement partenaire + frais de service ; frais de service = frais agrégateur + revenu net Event Village.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div>
              <label htmlFor={`${fieldId}-statut`} className="block text-[11px] font-bold text-slate-600 dark:text-zinc-300 mb-1">Statut</label>
              <select
                id={`${fieldId}-statut`}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF5722]/30 focus:border-[#FF5722]"
              >
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div role="group" aria-label="Période" className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={periodPreset === p.value}
                  onClick={() => setPeriodPreset(p.value)}
                  className={`min-h-[40px] px-3 rounded-lg text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] ${
                    periodPreset === p.value
                      ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30'
                      : 'text-slate-600 dark:text-zinc-300'
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
          <div className="py-12 text-center text-slate-500 dark:text-zinc-400">
            <DollarSign size={32} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" aria-hidden="true" />
            <p className="text-xs font-bold">Aucun paiement encaissé pour cette période.</p>
          </div>
        ) : (
          <>
            {/* Mobile : cartes */}
            <ul className="md:hidden space-y-3">
              {items.map((item) => (
                <li key={item.paymentId} className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-slate-900 dark:text-white break-all">{item.transactionReference}</p>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {TARGET_LABELS[item.targetType] ?? item.targetType} · {OPERATOR_NAMES[item.paymentMethod] ?? item.paymentMethod} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums">
                    <dt className="text-slate-500 dark:text-zinc-400">Total débité</dt>
                    <dd className="text-right font-black text-slate-900 dark:text-white">{formatPrice(item.grossAmount)}</dd>
                    <dt className="text-slate-500 dark:text-zinc-400">Prix</dt>
                    <dd className="text-right font-bold text-slate-900 dark:text-white">{item.facialAmount !== null ? formatPrice(item.facialAmount) : '—'}</dd>
                    <dt className="text-slate-500 dark:text-zinc-400">Frais de service</dt>
                    <dd className="text-right font-bold text-slate-900 dark:text-white">{serviceFeeLabel(item)}</dd>
                    <dt className="text-slate-500 dark:text-zinc-400">Frais agrégateur</dt>
                    <dd className="text-right text-amber-600 dark:text-amber-400">{formatPrice(item.aggregatorFee)}</dd>
                    <dt className="text-slate-500 dark:text-zinc-400">Net Event Village</dt>
                    <dd className="text-right font-bold text-[#FF5722]">{formatPrice(item.platformNetRevenue)}</dd>
                    <dt className="text-slate-500 dark:text-zinc-400">Partenaire</dt>
                    <dd className="text-right font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(item.partnerPayout)}</dd>
                    {item.refundedAmount > 0 && (
                      <>
                        <dt className="text-slate-500 dark:text-zinc-400">Remboursé</dt>
                        <dd className="text-right font-bold text-slate-900 dark:text-white">{formatPrice(item.refundedAmount)}</dd>
                      </>
                    )}
                    <dt className="text-slate-500 dark:text-zinc-400">Parrainage</dt>
                    <dd className="text-right text-slate-600 dark:text-zinc-300">{formatPrice(item.totalReferralCommissions)}</dd>
                  </dl>
                  {item.discrepancy !== 0 && (
                    <p className="flex items-center gap-1.5 font-bold text-red-600 dark:text-red-400">
                      <AlertTriangle size={13} aria-hidden="true" /> Écart : {formatPrice(item.discrepancy)}
                    </p>
                  )}
                </li>
              ))}
            </ul>

            {/* Écran large : tableau */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[960px] text-xs text-left">
                <caption className="sr-only">Paiements encaissés et leur répartition</caption>
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 font-bold uppercase text-[10px]">
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
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 tabular-nums">
                  {items.map((item) => (
                    <tr key={item.paymentId} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/40">
                      <td className="py-3 pr-3 font-mono font-bold text-slate-900 dark:text-white">{item.transactionReference}</td>
                      <td className="py-3 pr-3 text-slate-600 dark:text-zinc-400">
                        {TARGET_LABELS[item.targetType] ?? item.targetType} · {OPERATOR_NAMES[item.paymentMethod] ?? item.paymentMethod}
                      </td>
                      <td className="py-3 pr-3"><StatusBadge status={item.status} /></td>
                      <td className="py-3 pr-3 text-right font-black text-slate-900 dark:text-white">{formatPrice(item.grossAmount)}</td>
                      <td className="py-3 pr-3 text-right text-slate-700 dark:text-zinc-300">{item.facialAmount !== null ? formatPrice(item.facialAmount) : '—'}</td>
                      <td className="py-3 pr-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">{serviceFeeLabel(item)}</td>
                      <td className="py-3 pr-3 text-right text-amber-600 dark:text-amber-400">{formatPrice(item.aggregatorFee)}</td>
                      <td className="py-3 pr-3 text-right font-bold text-[#FF5722]">{formatPrice(item.platformNetRevenue)}</td>
                      <td className="py-3 pr-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(item.partnerPayout)}</td>
                      <td className="py-3 pr-3 text-right text-slate-700 dark:text-zinc-300">
                        {item.refundedAmount > 0 ? (
                          <span className="inline-flex items-center gap-1"><Undo2 size={12} aria-hidden="true" />{formatPrice(item.refundedAmount)}</span>
                        ) : '—'}
                      </td>
                      <td className="py-3 pr-3 text-right text-slate-600 dark:text-zinc-300">{formatPrice(item.totalReferralCommissions)}</td>
                      <td className="py-3 pr-3 text-center font-bold">
                        {item.discrepancy === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-[11px]">Aucun</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-[11px]">
                            <AlertTriangle size={12} aria-hidden="true" /> {formatPrice(item.discrepancy)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right text-slate-500 dark:text-zinc-400 text-[11px] whitespace-nowrap">{formatDate(item.createdAt)}</td>
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
