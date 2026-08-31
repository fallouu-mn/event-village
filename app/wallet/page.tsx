'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import {
  ChevronLeft,
  Gift,
  Copy,
  Check,
  ArrowDownToLine,
  Users,
  Award,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/components/providers/AuthProvider';

export default function WalletPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('15000');
  const [operatorName, setOperatorName] = useState<'WAVE' | 'ORANGE_MONEY'>('WAVE');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [withdrawalMessage, setWithdrawalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [referralData, setReferralData] = useState<{
    referralCode: string;
    referralLink: string;
    isAmbassador: boolean;
    rates: { level1: number; level2: number };
    network: { level1Count: number; level2Count: number; totalReferred: number };
    finances: { availableBalance: number; totalEarned: number; totalWithdrawn: number };
    recentCommissions: Array<{
      id: string;
      amount: number;
      generation: 'N1' | 'N2';
      status: string;
      created_at: string;
    }>;
  }>({
    referralCode: '',
    referralLink: '',
    isAmbassador: false,
    rates: { level1: 0, level2: 0 },
    network: { level1Count: 0, level2Count: 0, totalReferred: 0 },
    finances: { availableBalance: 0, totalEarned: 0, totalWithdrawn: 0 },
    recentCommissions: [],
  });

  useEffect(() => {
    if (!profile?.id) return;

    fetch('/api/referrals/my-stats')
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.success) {
          setReferralData(data);
          setFirstName(profile.first_name || '');
          setLastName(profile.last_name || '');
          setPhone(profile.phone || '');
        }
      })
      .catch(() => {});
  }, [profile?.id, profile?.first_name, profile?.last_name, profile?.phone]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralData.referralLink);
    setCopied(true);
    toast.success('Lien de parrainage copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecuteWithdrawal = async () => {
    setIsSubmitting(true);
    setWithdrawalMessage(null);

    try {
      const res = await fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(withdrawAmount),
          operatorName,
          phoneNumber: phone,
          firstName,
          lastName,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setWithdrawalMessage({
          type: 'success',
          text: data.message || 'Demande de retrait validée avec succès !',
        });
        setTimeout(() => {
          setIsWithdrawModalOpen(false);
          setWithdrawalMessage(null);
        }, 2500);
      } else {
        setWithdrawalMessage({
          type: 'error',
          text: data.error || 'Échec de la demande de retrait.',
        });
      }
    } catch {
      setWithdrawalMessage({
        type: 'error',
        text: 'Erreur réseau lors de la communication avec le serveur.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canWithdraw = referralData.finances.availableBalance >= 5000;
  const grossNum = Number(withdrawAmount) || 0;
  const feeNum = Math.round(grossNum * 0.01);
  const netNum = grossNum - feeNum;

  return (
    <div className="space-y-8 pb-20">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Wallet className="text-[#FF5722]" size={28} />
            <span>Portefeuille & Commissions Parrainage</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Suivez vos gains de parrainage N1 / N2 et retirez instantanément par Wave ou Orange Money.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          leftIcon={<ArrowDownToLine size={16} />}
          onClick={() => setIsWithdrawModalOpen(true)}
          disabled={!canWithdraw}
          title={!canWithdraw ? 'Solde minimum requis : 5 000 FCFA' : undefined}
        >
          Retirer mes gains
        </Button>
      </div>

      {/* 2. Carte Solde & Taux Ambassadeur */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Grand bloc Solde */}
        <div className="md:col-span-2 p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-orange-500 via-[#FF5722] to-amber-600 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-orange-100">
                Solde Disponible pour Retrait
              </span>
              <Badge variant="default" size="sm" className="bg-white/20 text-white border-white/30 backdrop-blur-md">
                {referralData.isAmbassador ? '⭐ AMBASSADEUR V3' : '👤 CLIENT STANDARD'}
              </Badge>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              {referralData.finances.availableBalance.toLocaleString('fr-FR')} <span className="text-xl font-normal text-orange-100">FCFA</span>
            </h2>
            <p className="text-xs text-orange-100 font-medium">
              Total cumulé gagné : {referralData.finances.totalEarned.toLocaleString('fr-FR')} FCFA
            </p>
          </div>

          <div className="relative z-10 pt-6 flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsWithdrawModalOpen(true)}
              leftIcon={<ArrowDownToLine size={15} />}
              className="bg-white text-slate-900 hover:bg-orange-50"
              disabled={!canWithdraw}
            >
              Demander un virement Wave / OM
            </Button>
          </div>
        </div>

        {/* Bloc Taux N1 & N2 */}
        <div className="space-y-3">
          <div className="p-4 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
              Génération 1 (Filleuls Directs)
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-[#FF5722]">{referralData.rates.level1.toFixed(1)} %</span>
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{referralData.network.level1Count} filleul(s)</span>
            </div>
          </div>

          <div className="p-4 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
              Génération 2 (Sous-Filleuls)
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-black text-amber-500">{referralData.rates.level2.toFixed(1)} %</span>
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{referralData.network.level2Count} filleul(s)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Partage du Lien de Parrainage */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center font-bold">
            <Gift size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Votre Lien de Parrainage Officiel
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Partagez ce lien à vos proches et réseaux pour toucher des commissions automatiques sur chaque commande.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center font-mono text-xs text-slate-800 dark:text-zinc-200 select-all overflow-x-auto">
            {referralData.referralLink}
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleCopyLink}
            leftIcon={copied ? <Check size={16} /> : <Copy size={16} />}
          >
            {copied ? 'Lien copié !' : 'Copier mon lien'}
          </Button>
        </div>
      </div>

      {/* 4. Historique des Commissions Récentes */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
          Dernières commissions créditées
        </h3>

        <div className="space-y-3">
          {referralData.recentCommissions.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 text-center text-xs text-slate-400">
              Aucune commission pour le moment. Partagez votre lien de parrainage pour commencer à accumuler des gains.
            </div>
          ) : (
            referralData.recentCommissions.map((comm) => (
              <div key={comm.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${
                    comm.generation === 'N1' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  }`}>
                    {comm.generation}
                  </span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Commission Parrainage {comm.generation}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(comm.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                  + {comm.amount.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 5. Modale de Retrait SamirPay Cashout */}
      <Modal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        title="Retrait de Commissions (SamirPay Cashout)"
      >
        <div className="space-y-4">
          {withdrawalMessage && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold ${
                withdrawalMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {withdrawalMessage.text}
            </div>
          )}

          {/* Choix Opérateur */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1.5">
              Opérateur Mobile Money
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOperatorName('WAVE')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                  operatorName === 'WAVE'
                    ? 'bg-[#FF5722] text-white border-[#FF5722] shadow-xs'
                    : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                }`}
              >
                🌊 Wave Sénégal
              </button>
              <button
                type="button"
                onClick={() => setOperatorName('ORANGE_MONEY')}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                  operatorName === 'ORANGE_MONEY'
                    ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                    : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                }`}
              >
                🍊 Orange Money
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Prénom</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">Nom</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
              Numéro de téléphone
            </label>
            <input
              type="tel"
              placeholder="77 123 45 67"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
              Montant brut (Min. 5 000 FCFA)
            </label>
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-mono font-bold"
            />
          </div>

          {/* Récapitulatif Frais 1% */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Montant brut</span>
              <span className="font-bold text-slate-900 dark:text-white">{grossNum.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Frais de retrait SamirPay (1%)</span>
              <span className="font-bold text-slate-900 dark:text-white">{feeNum.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-[#FF5722] font-black border-t border-slate-200 dark:border-zinc-800 pt-1.5 text-sm">
              <span>Montant net versé</span>
              <span>{netNum.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            onClick={handleExecuteWithdrawal}
          >
            Confirmer le retrait ({netNum.toLocaleString('fr-FR')} FCFA)
          </Button>
        </div>
      </Modal>
    </div>
  );
}
