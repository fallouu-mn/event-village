'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  DollarSign,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Filter,
  Download,
  CreditCard,
  Building2,
  Users,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { FinancialReconciliationSummary, FinancialReconciliationItem } from '@/lib/admin/admin.service';

export default function AdminFinanceReconciliationPage() {
  const [summary, setSummary] = useState<FinancialReconciliationSummary | null>(null);
  const [items, setItems] = useState<FinancialReconciliationItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [periodPreset, setPeriodPreset] = useState<'ALL' | '7D' | '30D'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  const fetchReconciliation = useCallback(async () => {
    setIsLoading(true);
    try {
      let startDate: string | undefined;
      const now = new Date();

      if (periodPreset === '7D') {
        const d = new Date();
        d.setDate(now.getDate() - 7);
        startDate = d.toISOString();
      } else if (periodPreset === '30D') {
        const d = new Date();
        d.setDate(now.getDate() - 30);
        startDate = d.toISOString();
      }

      let url = `/api/admin/finance/reconciliation?status=${statusFilter}`;
      if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummary(data.summary);
        setItems(data.items || []);
      }
    } catch (err) {
      console.error('[AdminFinance] Erreur chargement:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, periodPreset]);

  useEffect(() => {
    fetchReconciliation();
  }, [fetchReconciliation]);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="w-10 h-10 rounded-2xl flex items-center justify-center border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </Link>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF5722]">
              Console Superadmin HQ
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Rapprochement Financier & Audit SamirPay (§84)
            </h1>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchReconciliation()}
          disabled={isLoading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </Button>
      </div>

      {/* Matrice de Synthèse Financière Globale */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Volume Brut Encaissé</span>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {summary ? formatPrice(summary.totalGrossVolume) : '0 FCFA'}
          </h3>
          <span className="text-xs text-slate-400 block">{summary?.totalTransactionsCount || 0} transaction(s)</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Frais Agrégateur (SamirPay)</span>
          <h3 className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
            {summary ? formatPrice(summary.totalAggregatorFees) : '0 FCFA'}
          </h3>
          <span className="text-xs text-slate-400 block">Frais déduits à la source</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Revenu Net Event Village</span>
          <h3 className="text-xl sm:text-2xl font-black text-[#FF5722]">
            {summary ? formatPrice(summary.totalPlatformNetRevenue) : '0 FCFA'}
          </h3>
          <span className="text-xs text-slate-400 block">Commissions de service 6.5%</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-1">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Reversements Partenaires</span>
          <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {summary ? formatPrice(summary.totalPartnerPayouts) : '0 FCFA'}
          </h3>
          <span className="text-xs text-slate-400 block">Part nette due aux prestataires</span>
        </div>
      </div>

      {/* Détail Rapprochement Secondaire */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">Commissions Parrainage (N1 + N2)</span>
            <h4 className="text-base font-black text-slate-900 dark:text-white">
              {summary ? formatPrice(summary.totalReferralCommissions) : '0 FCFA'}
            </h4>
          </div>
          <Users size={24} className="text-[#FF5722]" />
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">Retraits Validés & Payés</span>
            <h4 className="text-base font-black text-slate-900 dark:text-white">
              {summary ? formatPrice(summary.totalWithdrawalsPaid) : '0 FCFA'}
            </h4>
          </div>
          <CreditCard size={24} className="text-emerald-500" />
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">Écarts de Rapprochement</span>
            <h4 className={`text-base font-black ${summary?.discrepanciesCount ? 'text-red-500' : 'text-emerald-500'}`}>
              {summary?.discrepanciesCount || 0} anomalie(s)
            </h4>
          </div>
          <CheckCircle2 size={24} className="text-emerald-500" />
        </div>
      </div>

      {/* Tableau Détaillé des Lignes de Rapprochement */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Lignes de Transactions Rapprochées
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Traçabilité unitaire : Brut = Frais Agrégateur + Net Plateforme + Reversement Partenaire.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800">
              <button
                type="button"
                onClick={() => setPeriodPreset('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  periodPreset === 'ALL' ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold' : 'text-slate-500'
                }`}
              >
                Tout
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('30D')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  periodPreset === '30D' ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold' : 'text-slate-500'
                }`}
              >
                30 Jours
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('7D')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  periodPreset === '7D' ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold' : 'text-slate-500'
                }`}
              >
                7 Jours
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <RefreshCw size={24} className="animate-spin mx-auto text-[#FF5722] mb-2" />
            <p className="text-xs">Chargement du rapprochement financier...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <DollarSign size={32} className="mx-auto text-slate-300 dark:text-zinc-700 mb-2" />
            <p className="text-xs font-bold">Aucune transaction enregistrée pour cette période.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="pb-3">Référence TX</th>
                  <th className="pb-3">Moyen</th>
                  <th className="pb-3 text-right">Montant Brut</th>
                  <th className="pb-3 text-right">Frais SamirPay</th>
                  <th className="pb-3 text-right">Net Event Village</th>
                  <th className="pb-3 text-right">Partenaire</th>
                  <th className="pb-3 text-right">Parrainage</th>
                  <th className="pb-3 text-center">Écart</th>
                  <th className="pb-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                {items.map((item) => (
                  <tr key={item.paymentId} className="hover:bg-slate-50/60 dark:hover:bg-zinc-900/40">
                    <td className="py-3 font-mono font-bold text-slate-900 dark:text-white">
                      {item.transactionReference}
                    </td>
                    <td className="py-3 font-bold text-slate-600 dark:text-zinc-400">
                      {item.paymentMethod}
                    </td>
                    <td className="py-3 text-right font-black text-slate-900 dark:text-white">
                      {formatPrice(item.grossAmount)}
                    </td>
                    <td className="py-3 text-right text-amber-600 dark:text-amber-400 font-mono">
                      -{formatPrice(item.aggregatorFee)}
                    </td>
                    <td className="py-3 text-right text-[#FF5722] font-mono font-bold">
                      +{formatPrice(item.platformNetRevenue)}
                    </td>
                    <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      {formatPrice(item.partnerPayout)}
                    </td>
                    <td className="py-3 text-right text-slate-500 font-mono">
                      {item.totalReferralCommissions > 0 ? `-${formatPrice(item.totalReferralCommissions)}` : '0 FCFA'}
                    </td>
                    <td className="py-3 text-center font-bold">
                      {item.discrepancy === 0 ? (
                        <span className="text-emerald-500 text-[11px]">0 (OK)</span>
                      ) : (
                        <span className="text-red-500 text-[11px]">⚠️ {item.discrepancy}</span>
                      )}
                    </td>
                    <td className="py-3 text-right text-slate-400 text-[11px]">
                      {formatDate(item.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
