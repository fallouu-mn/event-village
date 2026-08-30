'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Sliders,
  DollarSign,
  Package,
  CreditCard,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function AdminPricingSettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // États locaux éditables
  const [packs, setPacks] = useState<any>({
    starter: { name: 'Starter', price: 0, commission_rate: 8.0, max_events: 2 },
    business: { name: 'Business', price: 25000, commission_rate: 6.5, max_events: 10 },
    premium: { name: 'Premium', price: 75000, commission_rate: 5.0, max_events: 999 },
  });

  const [aggFees, setAggFees] = useState<any>({
    WAVE: { rate: 1.0, fixed: 0 },
    ORANGE_MONEY: { rate: 1.5, fixed: 0 },
    FREE_MONEY: { rate: 1.5, fixed: 0 },
    CARTE_BANCAIRE: { rate: 2.5, fixed: 100 },
  });

  const [commTariffs, setCommTariffs] = useState<any>({
    SMS: { cost: 8, price: 15, margin: 7 },
    WHATSAPP: { cost: 15, price: 30, margin: 15 },
    EMAIL: { cost: 1, price: 3, margin: 2 },
  });

  const [withdrawalRules, setWithdrawalRules] = useState<any>({
    min_amount: 5000,
    fee_rate: 1.0,
    auto_approval_threshold: 50000,
  });

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/pricing');
      const data = await res.json();
      if (res.ok && data.settings) {
        setSettings(data.settings);
        if (data.settings.subscription_packs) setPacks(data.settings.subscription_packs);
        if (data.settings.aggregator_fees) setAggFees(data.settings.aggregator_fees);
        if (data.settings.communication_tariffs) setCommTariffs(data.settings.communication_tariffs);
        if (data.settings.withdrawal_rules) setWithdrawalRules(data.settings.withdrawal_rules);
      }
    } catch (err) {
      console.error('[AdminPricing] Erreur chargement:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSection = async (key: string, value: any, label: string) => {
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la sauvegarde.');

      setFeedback({
        type: 'success',
        text: `Grille "${label}" mise à jour et historisée avec succès.`,
      });
      await fetchSettings();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la sauvegarde.';
      setFeedback({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
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
              Tarifs, Packs Partenaires & Monétisation (§117-§126)
            </h1>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchSettings()}
          disabled={isLoading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </Button>
      </div>

      {/* Message Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
      )}

      {/* 1. Packs Partenaires B2B (§117) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Package size={20} className="text-[#FF5722]" />
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Packs d&apos;Abonnement Partenaires (§117)
            </h2>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSaveSection('subscription_packs', packs, 'Packs Partenaires')}
            disabled={isSaving}
            className="bg-[#FF5722] text-white flex items-center gap-1.5"
          >
            <Save size={14} />
            <span>Enregistrer Packs</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.keys(packs).map((planKey) => {
            const plan = packs[planKey];
            return (
              <div
                key={planKey}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3"
              >
                <h4 className="text-sm font-black uppercase text-[#FF5722]">{plan.name}</h4>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Prix mensuel (FCFA)</label>
                    <input
                      type="number"
                      value={plan.price}
                      onChange={(e) =>
                        setPacks({
                          ...packs,
                          [planKey]: { ...plan, price: Number(e.target.value) },
                        })
                      }
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-black text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Commission billetterie (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={plan.commission_rate}
                      onChange={(e) =>
                        setPacks({
                          ...packs,
                          [planKey]: { ...plan, commission_rate: Number(e.target.value) },
                        })
                      }
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-bold mb-1">Événements simultanés max</label>
                    <input
                      type="number"
                      value={plan.max_events}
                      onChange={(e) =>
                        setPacks({
                          ...packs,
                          [planKey]: { ...plan, max_events: Number(e.target.value) },
                        })
                      }
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold text-slate-900 dark:text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Frais Agrégateur SamirPay (§118) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <CreditCard size={20} className="text-[#FF5722]" />
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Frais Agrégateur & Moyens de Paiement (§118)
            </h2>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSaveSection('aggregator_fees', aggFees, 'Frais Agrégateur')}
            disabled={isSaving}
            className="bg-[#FF5722] text-white flex items-center gap-1.5"
          >
            <Save size={14} />
            <span>Enregistrer Frais</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.keys(aggFees).map((method) => {
            const fee = aggFees[method];
            return (
              <div
                key={method}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2 text-xs"
              >
                <h4 className="font-bold text-slate-800 dark:text-zinc-200">{method}</h4>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Taux (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={fee.rate}
                    onChange={(e) =>
                      setAggFees({
                        ...aggFees,
                        [method]: { ...fee, rate: Number(e.target.value) },
                      })
                    }
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Tarifs Communication & Marges (§119, §126) */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <MessageSquare size={20} className="text-[#FF5722]" />
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Canaux de Communication & Marges (§119, §126)
            </h2>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSaveSection('communication_tariffs', commTariffs, 'Tarifs Communication')}
            disabled={isSaving}
            className="bg-[#FF5722] text-white flex items-center gap-1.5"
          >
            <Save size={14} />
            <span>Enregistrer Tarifs</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.keys(commTariffs).map((channel) => {
            const tariff = commTariffs[channel];
            return (
              <div
                key={channel}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200">{channel}</h4>
                  <span className="font-mono font-bold text-emerald-600">
                    Marge: +{tariff.price - tariff.cost} FCFA
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Coût (FCFA)</label>
                    <input
                      type="number"
                      value={tariff.cost}
                      onChange={(e) =>
                        setCommTariffs({
                          ...commTariffs,
                          [channel]: { ...tariff, cost: Number(e.target.value) },
                        })
                      }
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Prix Vente (FCFA)</label>
                    <input
                      type="number"
                      value={tariff.price}
                      onChange={(e) =>
                        setCommTariffs({
                          ...commTariffs,
                          [channel]: { ...tariff, price: Number(e.target.value) },
                        })
                      }
                      className="w-full p-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold text-[#FF5722]"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
