'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  QrCode,
  DollarSign,
  Users,
  TrendingUp,
  ShoppingBag,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { usePartnerOrders } from '@/hooks/usePartnerOrders';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';

export default function PartnerDashboardPage() {
  const { profile, partner, user, isLoading: isAuthLoading } = useAuth();
  const { orders: liveOrders, connected } = usePartnerOrders(partner?.id ?? '');

  const [partnerMetrics, setPartnerMetrics] = React.useState<{
    grossRevenue: number;
    netRevenue: number;
    ticketsSold: number;
    ordersCount: number;
    activeEvents: number;
  }>({
    grossRevenue: 0,
    netRevenue: 0,
    ticketsSold: 0,
    ordersCount: 0,
    activeEvents: 0,
  });
  const [isLoadingMetrics, setIsLoadingMetrics] = React.useState(true);

  const [trialInfo, setTrialInfo] = React.useState<{
    trialDays?: number;
    trialEndsAt?: string;
    status?: string;
  } | null>(null);
  const activationCalledRef = React.useRef(false);

  // Load metrics whenever the user is identified
  React.useEffect(() => {
    if (!user?.id) return;
    fetch('/api/partner/metrics')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.metrics) setPartnerMetrics(data.metrics);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMetrics(false));
  }, [user?.id]);

  // Handle trial activation only once AuthProvider has finished loading.
  // Without the isAuthLoading guard, `partner` can be null during the async
  // hydration window, causing the activation endpoint (and its SMS) to fire
  // on every component mount even when the trial is already active in the DB.
  React.useEffect(() => {
    if (isAuthLoading || !user?.id) return;

    if (partner?.trial_started_at) {
      setTrialInfo({
        trialDays: partner.is_founder ? 90 : 60,
        trialEndsAt: partner.trial_ends_at ?? undefined,
        status: partner.status,
      });
    } else if (!activationCalledRef.current) {
      activationCalledRef.current = true;
      fetch('/api/partner/activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setTrialInfo({
              trialDays: data.trial_days || 60,
              trialEndsAt: data.trial_ends_at,
              status: data.status,
            });
          }
        })
        .catch(() => {});
    }
  }, [user?.id, isAuthLoading, partner?.trial_started_at, partner?.trial_ends_at, partner?.is_founder, partner?.status]);

  const isPending = partner?.status === 'EN_ATTENTE';
  const isSuspended = partner?.status === 'SUSPENDU';

  const stats = [
    {
      label: 'Revenus Nets Partenaire',
      value: `${partnerMetrics.netRevenue.toLocaleString('fr-FR')} FCFA`,
      icon: DollarSign,
      change: 'Net à reverser (93.5%)',
      isPositive: true,
    },
    {
      label: 'Billets vendus',
      value: partnerMetrics.ticketsSold.toString(),
      icon: Users,
      change: `${partnerMetrics.activeEvents} événement(s) en ligne`,
      isPositive: true,
    },
    {
      label: 'Commandes traitées',
      value: partnerMetrics.ordersCount.toString(),
      icon: ShoppingBag,
      change: 'Restauration & Services',
      isPositive: true,
    },
    {
      label: 'Chiffre d’affaires brut',
      value: `${partnerMetrics.grossRevenue.toLocaleString('fr-FR')} FCFA`,
      icon: TrendingUp,
      change: 'Volume total généré',
      isPositive: true,
    },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header B2B */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
              Portail Partenaire & Organisateur
            </span>
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>{connected ? 'Realtime Actif' : 'Connexion...'}</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {partner?.company_name || 'Dakar Event Production'}
          </h1>
        </div>

        {/* Actions Rapides */}
        <div className="flex items-center gap-2">
          <Link href="/partner/scan">
            <Button variant="primary" size="sm" leftIcon={<QrCode size={16} />}>
              Scanner les billets
            </Button>
          </Link>
          <Link href="/partner/calendar">
            <Button variant="secondary" size="sm" leftIcon={<Calendar size={16} />}>
              Planning
            </Button>
          </Link>
        </div>
      </div>

      {/* Bannière Période d'Essai Active */}
      {trialInfo?.trialEndsAt && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
            <ShieldCheck size={18} className="text-emerald-600" />
            <span>
              Période d&apos;essai gratuite active ({trialInfo.trialDays} jours) jusqu&apos;au{' '}
              {new Date(trialInfo.trialEndsAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
            Offre Fondateur / Lancement
          </span>
        </div>
      )}

      {/* Alerte si le statut partenaire est EN_ATTENTE */}
      {isPending && (
        <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-4">
          <Clock className="text-amber-600 flex-shrink-0 mt-0.5" size={24} />
          <div className="space-y-1">
            <h3 className="text-sm font-black text-amber-900 dark:text-amber-200">
              Compte Partenaire en attente d&apos;approbation administrative
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Vos documents professionnels sont en cours de vérification par l&apos;équipe de conformité Event Village. Vous recevrez une notification par SMS dès l&apos;activation définitive de votre compte pour publier vos événements et offres.
            </p>
          </div>
        </div>
      )}

      {/* Alerte si le statut partenaire est SUSPENDU */}
      {isSuspended && (
        <div className="p-5 rounded-3xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-start gap-4">
          <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={24} />
          <div className="space-y-1">
            <h3 className="text-sm font-black text-red-900 dark:text-red-200">
              Compte Partenaire temporairement suspendu
            </h3>
            <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
              Votre compte professionnel a été suspendu par l&apos;administration Event Village. Veuillez contacter le support officiel pour régulariser votre dossier.
            </p>
          </div>
        </div>
      )}

      {/* 2. Cartes KPIs / Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:border-[#FF6B35]/40 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  {stat.label}
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF6B35] flex items-center justify-center">
                  <Icon size={16} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {stat.value}
                </div>
                <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span>{stat.change}</span>
                  <span className="text-slate-400 dark:text-zinc-500 font-normal">vs mois précédent</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Commandes & Transactions en Direct (Supabase Realtime) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Flux des Commandes & Billetterie en Direct
            </h2>
            <Badge variant="brand" size="sm">
              Live Realtime
            </Badge>
          </div>
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            {liveOrders.length} opération(s) enregistrée(s)
          </span>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl border border-slate-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
            {liveOrders.map((order) => (
              <div
                key={order.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-black text-xs flex items-center justify-center flex-shrink-0">
                    <ShoppingBag size={18} />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {order.order_number}
                      </span>
                      <StatusBadge status={order.order_status} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                      Commande : <strong className="text-slate-700 dark:text-zinc-300">{order.delivery_mode}</strong> • {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900 dark:text-white block">
                      {order.total_amount.toLocaleString('fr-FR')} FCFA
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 justify-end">
                      <ShieldCheck size={10} /> SamirPay Wave/OM
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
