'use client';

import React, { useState, useEffect } from 'react';
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
  FileText,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  MapPin,
  ArrowUpRight,
  RefreshCw,
  Wallet,
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';
import { usePartnerOrders } from '@/hooks/usePartnerOrders';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { ClosingReportModal } from '@/components/partner/ClosingReportModal';
import type { PartnerDashboardData, PartnerEventBreakdown } from '@/lib/partner/partner-dashboard.service';

export default function PartnerDashboardPage() {
  const { profile, partner, user, session, isLoading: isAuthLoading } = useAuth();
  const { orders: liveOrders, connected } = usePartnerOrders(partner?.id ?? '');
  const toast = useToast();

  const [dashboardData, setDashboardData] = useState<PartnerDashboardData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selected event for Closing Report Modal
  const [selectedClosingEventId, setSelectedClosingEventId] = useState<string | null>(null);
  const [selectedClosingEventTitle, setSelectedClosingEventTitle] = useState<string | undefined>(undefined);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);

  // Global CSV export state
  const [isExportingGlobalCsv, setIsExportingGlobalCsv] = useState(false);

  const [trialInfo, setTrialInfo] = useState<{
    trialDays?: number;
    trialEndsAt?: string;
    status?: string;
  } | null>(null);
  const activationCalledRef = React.useRef(false);

  const loadDashboard = async (showToast = false) => {
    try {
      if (showToast) setIsRefreshing(true);
      const res = await fetch('/api/partner/dashboard', {
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      });
      const json = await res.json();
      const payload = json.dashboard || json.data;
      if (json.success && payload) {
        setDashboardData(payload);
        if (showToast) toast.success('Données actualisées en temps réel.');
      } else {
        throw new Error(json.error || 'Erreur de chargement');
      }
    } catch (err: any) {
      console.error('[loadDashboard] Erreur:', err);
      toast.error(err.message || 'Impossible de charger les données du dashboard.');
    } finally {
      setIsLoadingData(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    loadDashboard();
  }, [user?.id, session?.access_token]);

  // Handle trial activation
  useEffect(() => {
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
        .catch(() => {
          toast.error("Activation de la période d'essai échouée.");
        });
    }
  }, [user?.id, isAuthLoading, partner?.trial_started_at, partner?.trial_ends_at, partner?.is_founder, partner?.status]);

  const isPending = partner?.status === 'EN_ATTENTE';
  const isSuspended = partner?.status === 'SUSPENDU';

  const kpis = dashboardData?.kpis;

  const handleOpenClosingReport = (eventId: string, title: string) => {
    setSelectedClosingEventId(eventId);
    setSelectedClosingEventTitle(title);
    setIsClosingModalOpen(true);
  };

  const handleGlobalCsvExport = () => {
    try {
      setIsExportingGlobalCsv(true);
      const url = '/api/partner/reports/accounting?format=csv';
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.download = `EventVillage-Comptabilite-Globale-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Export comptable global en cours de téléchargement...');
    } catch {
      toast.error("Échec de l'export comptable.");
    } finally {
      setIsExportingGlobalCsv(false);
    }
  };

  const statCards = [
    {
      label: 'Chiffre d’affaires Brut',
      value: kpis ? `${kpis.grossRevenue.toLocaleString('fr-FR')} FCFA` : '0 FCFA',
      sublabel: 'Volume total généré',
      icon: TrendingUp,
      accent: 'text-slate-900 dark:text-white',
      bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    },
    {
      label: 'Net Partenaire à Reverser',
      value: kpis ? `${kpis.netRevenue.toLocaleString('fr-FR')} FCFA` : '0 FCFA',
      sublabel: `Commissions EV : ${(kpis?.commissionAmount || 0).toLocaleString('fr-FR')} F`,
      icon: DollarSign,
      accent: 'text-[#FF5722]',
      bg: 'bg-[#FF5722]/10 text-[#FF5722]',
    },
    {
      label: 'Billets Vendus & Scans',
      value: kpis ? `${kpis.ticketsSold} vendus` : '0 vendu',
      sublabel: `${kpis?.ticketsCheckedIn || 0} entrées validées aux portes`,
      icon: Users,
      accent: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Solde Disponible Retrait',
      value: kpis ? `${kpis.soldeDisponible.toLocaleString('fr-FR')} FCFA` : '0 FCFA',
      sublabel: `Déjà retiré : ${(kpis?.totalWithdrawn || 0).toLocaleString('fr-FR')} F`,
      icon: Wallet,
      accent: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    },
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* 1. Header B2B & Actions Globales */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
              Portail Organisateur & Pilotage Financier
            </span>
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span>{connected ? 'Realtime Actif' : 'Connexion...'}</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {partner?.company_name || profile?.first_name || 'Espace Partenaire'}
          </h1>
        </div>

        {/* Actions Rapides & Exports */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboard(true)}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />}
          >
            Actualiser
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleGlobalCsvExport}
            isLoading={isExportingGlobalCsv}
            leftIcon={<FileSpreadsheet size={15} className="text-emerald-600" />}
          >
            Export Comptable Global
          </Button>

          <Link href="/partner/scan">
            <Button variant="primary" size="sm" leftIcon={<QrCode size={16} />}>
              Scanner Billets
            </Button>
          </Link>
        </div>
      </div>

      {/* Bannière Période d'Essai Active */}
      {trialInfo?.trialEndsAt && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
            <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0" />
            <span>
              Période d&apos;essai gratuite active ({trialInfo.trialDays} jours) jusqu&apos;au{' '}
              {new Date(trialInfo.trialEndsAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
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
              Vos documents professionnels sont en cours de vérification. Vous recevrez une notification par SMS dès l&apos;activation définitive.
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
              Votre compte professionnel a été suspendu par l&apos;administration Event Village. Veuillez contacter le support officiel.
            </p>
          </div>
        </div>
      )}

      {/* 2. Cartes KPIs / Statistiques Globales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingData ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-2.5 w-28 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" />
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-7 w-36 bg-slate-100 dark:bg-zinc-800 rounded-lg animate-pulse" />
                  <div className="h-2.5 w-24 bg-slate-100 dark:bg-zinc-800 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {statCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={i}
                  className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:border-[#FF5722]/40 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                      {stat.label}
                    </span>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${stat.bg}`}>
                      <Icon size={16} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className={`text-xl sm:text-2xl font-black tracking-tight ${stat.accent}`}>
                      {stat.value}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                      {stat.sublabel}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* 3. Section Mes Événements & Rapports de Clôture */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Layers size={18} className="text-[#FF5722]" />
              Mes Événements & Billetterie
            </h2>
            <Badge variant="neutral" size="sm">
              {dashboardData?.events.length || 0} événement(s)
            </Badge>
          </div>
          <span className="text-xs text-slate-400 dark:text-zinc-500">
            Suivi des ventes, taux de présence et bilans de clôture (Z)
          </span>
        </div>

        <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl border border-slate-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
          {isLoadingData ? (
            <div className="p-8 text-center text-xs text-slate-400 animate-pulse">
              Chargement des événements...
            </div>
          ) : !dashboardData?.events || dashboardData.events.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Calendar size={32} className="mx-auto text-slate-300 dark:text-zinc-600" />
              <p className="text-xs font-bold text-slate-500 dark:text-zinc-400">
                Aucun événement créé pour le moment.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 font-bold border-b border-slate-200/80 dark:border-zinc-700/80">
                    <th className="py-3 px-4">Événement</th>
                    <th className="py-3 px-4">Date & Lieu</th>
                    <th className="py-3 px-4 text-center">Vendus / Capacité</th>
                    <th className="py-3 px-4 text-center">Entrées / Scan</th>
                    <th className="py-3 px-4 text-right">CA Brut</th>
                    <th className="py-3 px-4 text-right">Net Partenaire</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                  {dashboardData.events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[220px]">{ev.title}</span>
                          <span className="text-[10px] font-normal text-slate-400">{ev.status}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-zinc-400">
                        <div className="flex flex-col">
                          <span>{new Date(ev.startDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {ev.startTime}</span>
                          <span className="text-[10px] text-slate-400">{ev.city}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {ev.ticketsSold} / {ev.capacity}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            {ev.fillRatePercent}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {ev.ticketsCheckedIn} scans
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {ev.checkInRatePercent}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white font-mono">
                        {ev.grossRevenue.toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-[#FF5722] font-mono">
                        {ev.netRevenue.toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenClosingReport(ev.id, ev.title)}
                            leftIcon={<FileText size={13} />}
                          >
                            Rapport Z
                          </Button>
                          <a
                            href={`/api/partner/reports/closing/pdf?eventId=${ev.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Télécharger PDF"
                          >
                            <Download size={13} />
                          </a>
                          <a
                            href={`/api/partner/reports/accounting?eventId=${ev.id}&format=csv`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-emerald-600 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            title="Export CSV"
                          >
                            <FileSpreadsheet size={13} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 4. Section Activité Récente & Commandes Realtime */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline d'Activité Unifiée */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Activity size={18} className="text-orange-500" />
              Journal des Opérations
            </h2>
            <span className="text-xs text-slate-400">Ventes, Scans & Retraits</span>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl border border-slate-200/80 dark:border-zinc-800 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-zinc-800/80">
            {isLoadingData ? (
              <div className="p-6 text-center text-xs text-slate-400 animate-pulse">
                Chargement de l&apos;activité...
              </div>
            ) : !dashboardData?.recentActivity || dashboardData.recentActivity.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Aucune opération récente enregistrée.
              </div>
            ) : (
              dashboardData.recentActivity.map((item) => (
                <div key={item.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                      item.type === 'SALE'
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600'
                        : item.type === 'CHECKIN'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                        : item.type === 'WITHDRAWAL'
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600'
                        : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600'
                    }`}>
                      {item.type === 'SALE' ? (
                        <DollarSign size={14} />
                      ) : item.type === 'CHECKIN' ? (
                        <QrCode size={14} />
                      ) : item.type === 'WITHDRAWAL' ? (
                        <Wallet size={14} />
                      ) : (
                        <ShoppingBag size={14} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    {item.amount !== undefined && item.amount > 0 && (
                      <span className="text-xs font-black text-slate-900 dark:text-white block font-mono">
                        {item.amount.toLocaleString('fr-FR')} F
                      </span>
                    )}
                    <span className="text-[9px] text-slate-400">
                      {new Date(item.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Commandes Directes & Services (Realtime Supabase) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <ShoppingBag size={18} className="text-emerald-500" />
              Commandes & Services Live
            </h2>
            <Badge variant="brand" size="sm">
              Realtime
            </Badge>
          </div>

          <div className="bg-white dark:bg-[#1E1E1E] rounded-3xl border border-slate-200/80 dark:border-zinc-800 overflow-hidden shadow-xs divide-y divide-slate-100 dark:divide-zinc-800/80">
            {liveOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Aucune commande en direct pour le moment.
              </div>
            ) : (
              liveOrders.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {order.order_number}
                        </span>
                        <StatusBadge status={order.order_status} />
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                        Mode : {order.delivery_mode} • {new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-black text-slate-900 dark:text-white block font-mono">
                      {order.total_amount.toLocaleString('fr-FR')} FCFA
                    </span>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5 justify-end">
                      <ShieldCheck size={10} /> SamirPay
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 5. Modale Interactive de Rapport de Clôture */}
      <ClosingReportModal
        isOpen={isClosingModalOpen}
        onClose={() => setIsClosingModalOpen(false)}
        eventId={selectedClosingEventId}
        eventTitle={selectedClosingEventTitle}
      />
    </div>
  );
}
