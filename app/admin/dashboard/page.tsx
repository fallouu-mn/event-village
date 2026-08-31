'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Users,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { toastMessages } from '@/lib/messages/toast-messages';

interface PartnerActivity {
  activity_type: string;
  is_active: boolean;
}

interface PartnerUser {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  role: string;
  status: string;
}

interface PartnerItem {
  id: string;
  user_id: string;
  company_name: string;
  commercial_name?: string;
  description?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  id_card_url?: string;
  business_doc_url?: string;
  is_verified: boolean;
  status: 'EN_ATTENTE' | 'VALIDE' | 'REJETE' | 'SUSPENDU';
  created_at: string;
  updated_at: string;
  users?: PartnerUser;
  partner_activities?: PartnerActivity[];
}

interface AdminKPIs {
  totalVolume: number;
  netRevenue: number;
  validatedPartners: number;
  pendingPartners: number;
  rejectedPartners: number;
  totalPartners: number;
  totalUsers: number;
  clientsCount: number;
  controllersCount: number;
  adminsCount: number;
  activeAmbassadors: number;
  totalTickets: number;
}

interface AuditLogItem {
  id: string;
  user_id: string | null;
  user_role: string | null;
  action: string;
  object_type: string;
  object_id: string | null;
  old_value: any;
  new_value: any;
  metadata: any;
  created_at: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  RESTAURANT: 'Restaurant',
  TRAITEUR: 'Traiteur',
  SALLE: 'Salle de Fête',
  ORGANISATEUR: 'Organisateur',
  PRESTATAIRE: 'Prestataire',
  PATISSERIE: 'Pâtisserie',
  ETABLISSEMENT_ALIMENTAIRE: 'Alimentaire',
  AUTRE: 'Autre',
};

export default function AdminDashboardPage() {
  const [kpis, setKpis] = useState<AdminKPIs | null>(null);
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const toast = useToast();
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [activeTab, setActiveTab] = useState<'EN_ATTENTE' | 'VALIDE' | 'REJETE' | 'ALL'>('EN_ATTENTE');
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

  // Modal Détails Partenaire
  const [selectedPartner, setSelectedPartner] = useState<PartnerItem | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);

  // Modal Rejet Partenaire
  const [partnerToReject, setPartnerToReject] = useState<PartnerItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Visionneuse sécurisée de documents KYC
  const handleViewDocument = async (filePath: string | undefined, docName: string) => {
    if (!filePath) return;
    setDocError(null);
    setLoadingDoc(filePath);
    try {
      const res = await fetch(`/api/partner/documents/signed-url?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (!res.ok || !data.signedUrl) {
        throw new Error(data.error || `Impossible de générer le lien de consultation (${docName}).`);
      }
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(toastMessages.admin.docLoadError);
    } finally {
      setLoadingDoc(null);
    }
  };

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const timestamp = Date.now();
      // 1. Récupération des KPIs et des logs d'audit réels avec cache: 'no-store'
      const metricsRes = await fetch(`/api/admin/metrics?_t=${timestamp}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const metricsData = await metricsRes.json();
      if (metricsRes.ok && metricsData.kpis) {
        setKpis(metricsData.kpis);
        setAuditLogs(metricsData.recentAuditLogs || []);
      }

      // 2. Récupération des partenaires réels selon l'onglet
      const partnersRes = await fetch(`/api/admin/partners?status=${activeTab}&_t=${timestamp}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const partnersData = await partnersRes.json();
      if (partnersRes.ok && partnersData.partners) {
        setPartners(partnersData.partners);
      }
    } catch (err) {
      console.error('[AdminDashboard] Erreur chargement données:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Validation d'un partenaire avec mise à jour optimiste instantanée
  const handleValidatePartner = async (partner: PartnerItem) => {
    setIsActionLoading(partner.id);

    // Mise à jour optimiste de l'UI
    setPartners((prev) => {
      if (activeTab === 'EN_ATTENTE') {
        return prev.filter((p) => p.id !== partner.id);
      }
      return prev.map((p) => (p.id === partner.id ? { ...p, status: 'VALIDE', is_verified: true } : p));
    });
    setKpis((prev) =>
      prev
        ? {
            ...prev,
            pendingPartners: Math.max(0, prev.pendingPartners - 1),
            validatedPartners: prev.validatedPartners + 1,
          }
        : null
    );

    try {
      const res = await fetch(`/api/admin/partners/${partner.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'VALIDE' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la validation.');

      toast.success(toastMessages.admin.partnerValidated(partner.company_name));
      if (selectedPartner?.id === partner.id) {
        setIsDetailsModalOpen(false);
      }
      await fetchDashboardData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la validation.';
      toast.error(msg);
      await fetchDashboardData();
    } finally {
      setIsActionLoading(null);
    }
  };

  // Ouverture de la modal de rejet
  const handleOpenRejectModal = (partner: PartnerItem) => {
    setPartnerToReject(partner);
    setRejectionReason('');
    setIsRejectModalOpen(true);
  };

  // Confirmation du rejet avec mise à jour optimiste
  const handleConfirmReject = async () => {
    if (!partnerToReject) return;
    const targetPartner = partnerToReject;
    setIsActionLoading(targetPartner.id);

    // Mise à jour optimiste
    setPartners((prev) => {
      if (activeTab === 'EN_ATTENTE') {
        return prev.filter((p) => p.id !== targetPartner.id);
      }
      return prev.map((p) =>
        p.id === targetPartner.id ? { ...p, status: 'REJETE', rejection_reason: rejectionReason } : p
      );
    });
    setKpis((prev) =>
      prev
        ? {
            ...prev,
            pendingPartners: Math.max(0, prev.pendingPartners - 1),
            rejectedPartners: prev.rejectedPartners + 1,
          }
        : null
    );

    try {
      const res = await fetch(`/api/admin/partners/${targetPartner.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'REJETE',
          rejectionReason: rejectionReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors du rejet.');

      toast.success(toastMessages.admin.partnerRejected(targetPartner.company_name));
      setIsRejectModalOpen(false);
      setPartnerToReject(null);
      await fetchDashboardData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec du rejet.';
      toast.error(msg);
      await fetchDashboardData();
    } finally {
      setIsActionLoading(null);
    }
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header avec indicateur réel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF5722]">
            Console Superadmin HQ
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Supervision & Validation Partenaires B2B
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchDashboardData()}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Actualiser</span>
          </Button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connecté à Supabase</span>
          </span>
        </div>
      </div>

      {/* KPIs Financiers & Opérationnels Réels (CDC V3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Volume Global Transactions</span>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            {kpis ? formatPrice(kpis.totalVolume) : '0 FCFA'}
          </h3>
          <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 mt-2 block">
            Paiements réels SamirPay
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Revenu Net Plateforme</span>
          <h3 className="text-xl sm:text-2xl font-black text-[#FF5722] tracking-tight mt-1">
            {kpis ? formatPrice(kpis.netRevenue) : '0 FCFA'}
          </h3>
          <span className="text-xs text-slate-400 dark:text-zinc-500 mt-2 block">Commissions Event Village</span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Partenaires Validés</span>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            {kpis ? kpis.validatedPartners : 0}
          </h3>
          <span className="text-xs text-amber-600 dark:text-amber-400 font-bold mt-2 block">
            {kpis?.pendingPartners || 0} en attente d’audit
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs">
          <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Utilisateurs Inscrits</span>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
            {kpis ? kpis.totalUsers : 0}
          </h3>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-2 block">
            {kpis?.activeAmbassadors || 0} ambassadeur(s) actif(s)
          </span>
        </div>
      </div>

      {/* Raccourci vers la Gestion des Ambassadeurs CDC V3 */}
      <Link
        href="/admin/referral"
        className="block p-6 rounded-3xl bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent border-2 border-[#FF5722]/40 hover:border-[#FF5722] transition-all shadow-xs group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FF5722] text-white flex items-center justify-center font-bold shadow-md shadow-[#FF5722]/25">
              <Users size={24} />
            </div>
            <div>
              <span className="text-[11px] uppercase font-bold text-[#FF5722] tracking-wider">
                Module Parrainage & Commissions CDC V3
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white group-hover:text-[#FF5722] transition-colors">
                Gestion des Ambassadeurs & Taux de Commission N1/N2
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Attribuer le statut Ambassadeur aux clients réels ({kpis?.clientsCount || 0} clients enregistrés) et configurer les paliers.
              </p>
            </div>
          </div>
          <span className="text-[#FF5722] font-black text-sm group-hover:translate-x-1 transition-transform flex items-center gap-1">
            <span>Gérer les Ambassadeurs</span>
            <ArrowRight size={16} />
          </span>
        </div>
      </Link>

      {/* ====================================================================
          SECTION PRINCIPALE : GESTION DES PARTENAIRES (CRUD B2B RÉEL)
          ==================================================================== */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Demandes Partenaires & Audit B2B
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Validez ou rejetez les candidatures des organisateurs, restaurants et gestionnaires de salles.
            </p>
          </div>

          {/* Onglets de Filtrage par Statut */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-zinc-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('EN_ATTENTE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'EN_ATTENTE'
                  ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white shadow-md shadow-[#FF5722]/30 font-bold'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              En Attente {kpis?.pendingPartners ? `(${kpis.pendingPartners})` : '(0)'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('VALIDE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'VALIDE'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Validés {kpis?.validatedPartners ? `(${kpis.validatedPartners})` : '(0)'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('REJETE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'REJETE'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Rejetés {kpis?.rejectedPartners ? `(${kpis.rejectedPartners})` : '(0)'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'ALL'
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tous {kpis?.totalPartners ? `(${kpis.totalPartners})` : '(0)'}
            </button>
            <button
              type="button"
              onClick={() => fetchDashboardData()}
              title="Actualiser les données"
              className="p-1.5 rounded-xl text-slate-400 hover:text-[#FF5722] hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin text-[#FF5722]' : ''} />
            </button>
          </div>
        </div>

        {/* Liste des Partenaires */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500 space-y-2">
            <RefreshCw size={24} className="animate-spin mx-auto text-[#FF5722]" />
            <p className="text-xs">Chargement des données partenaires réelles...</p>
          </div>
        ) : partners.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-zinc-500 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl p-8 space-y-3">
            <Building2 size={36} className="mx-auto text-slate-300 dark:text-zinc-700" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-zinc-300">
              Aucune candidature partenaire {activeTab === 'EN_ATTENTE' ? 'en attente' : 'trouvée'}
            </h4>
            <p className="text-xs max-w-md mx-auto">
              {activeTab === 'EN_ATTENTE'
                ? 'Les nouvelles inscriptions via le formulaire "Devenir Partenaire" apparaîtront automatiquement ici avec leurs documents légaux.'
                : 'Aucun enregistrement ne correspond aux critères de filtre sélectionnés.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {partners.map((partner) => {
              const managerName = partner.users
                ? `${partner.users.first_name || ''} ${partner.users.last_name || ''}`.trim()
                : 'Non renseigné';

              const activities = partner.partner_activities?.map((a) => ACTIVITY_LABELS[a.activity_type] || a.activity_type) || [];

              return (
                <div
                  key={partner.id}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[#FF5722]/40"
                >
                  {/* Informations Partenaire */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {partner.company_name}
                      </h4>
                      {partner.commercial_name && partner.commercial_name !== partner.company_name && (
                        <span className="text-xs text-slate-400 dark:text-zinc-500 font-medium">
                          ({partner.commercial_name})
                        </span>
                      )}

                      {/* Statut Badge */}
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                          partner.status === 'VALIDE'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : partner.status === 'REJETE'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                        }`}
                      >
                        {partner.status === 'EN_ATTENTE' ? '⏳ En Attente' : partner.status}
                      </span>
                    </div>

                    {/* Activités */}
                    {activities.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {activities.map((act, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-100 dark:bg-orange-950/30 text-[#FF5722]"
                          >
                            {act}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Coordonnées & Gérant */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Users size={12} className="text-[#FF5722]" />
                        <span>Gérant: {managerName}</span>
                      </span>

                      {(partner.phone || partner.users?.phone) && (
                        <span className="flex items-center gap-1">
                          <Phone size={12} />
                          <span>{partner.phone || partner.users?.phone}</span>
                        </span>
                      )}

                      {(partner.email || partner.users?.email) && (
                        <span className="flex items-center gap-1">
                          <Mail size={12} />
                          <span>{partner.email || partner.users?.email}</span>
                        </span>
                      )}

                      {partner.city && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} />
                          <span>{partner.city}</span>
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                        Inscrit le {formatDate(partner.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Actions Rapides */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedPartner(partner);
                        setIsDetailsModalOpen(true);
                      }}
                      className="text-xs"
                    >
                      <Eye size={14} className="mr-1" />
                      Détails
                    </Button>

                    {partner.status !== 'VALIDE' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleValidatePartner(partner)}
                        disabled={isActionLoading === partner.id}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      >
                        <CheckCircle size={14} className="mr-1" />
                        Valider
                      </Button>
                    )}

                    {partner.status !== 'REJETE' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenRejectModal(partner)}
                        disabled={isActionLoading === partner.id}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs"
                      >
                        <XCircle size={14} className="mr-1" />
                        Rejeter
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ====================================================================
          SECTION JOURNAL D'AUDIT INALTÉRABLE (CDC V3)
          ==================================================================== */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <Activity size={16} className="text-[#FF5722]" />
            <span>Journal d’Audit & Traçabilité Supabase</span>
          </h2>
          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
            {auditLogs.length} entrée(s) récente(s)
          </span>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-zinc-500 py-6 text-center">
            Aucun log d&apos;audit enregistré pour le moment.
          </p>
        ) : (
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-200">
                    {log.action}
                  </span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 truncate">
                    {log.object_type}
                  </span>
                  {log.metadata?.company_name && (
                    <span className="text-slate-500 dark:text-zinc-400 truncate">
                      • {log.metadata.company_name}
                    </span>
                  )}
                  {log.metadata?.updated_by && (
                    <span className="text-[10px] text-[#FF5722] font-bold">
                      [{log.metadata.updated_by}]
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 dark:text-zinc-500 flex-shrink-0 font-mono">
                  {formatDate(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ====================================================================
          MODAL DÉTAILS PARTENAIRE
          ==================================================================== */}
      {selectedPartner && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`Dossier Partenaire : ${selectedPartner.company_name}`}
        >
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div>
                <span className="text-slate-400 block font-medium">Nom de l&apos;entreprise</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedPartner.company_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Nom commercial</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedPartner.commercial_name || 'Identique'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Gérant / Contact</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedPartner.users?.first_name} {selectedPartner.users?.last_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Téléphone</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedPartner.phone || selectedPartner.users?.phone || 'Non renseigné'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Email</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedPartner.email || selectedPartner.users?.email || 'Non renseigné'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Ville & Adresse</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedPartner.city} • {selectedPartner.address || 'Non renseignée'}
                </span>
              </div>
            </div>

            {/* Description */}
            {selectedPartner.description && (
              <div>
                <span className="text-slate-400 block font-medium mb-1">Présentation de l&apos;activité</span>
                <p className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300">
                  {selectedPartner.description}
                </p>
              </div>
            )}

            {/* Documents Légaux (Visionneuse Sécurisée Supabase) */}
            <div>
              <span className="text-slate-400 block font-medium mb-2">Documents & Justificatifs Légaux</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Pièce d'Identité */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0">
                      <FileText size={15} />
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                        Pièce d&apos;Identité
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {selectedPartner.id_card_url ? 'Document téléversé' : 'Non fourni'}
                      </span>
                    </div>
                  </div>

                  {selectedPartner.id_card_url ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleViewDocument(selectedPartner.id_card_url, 'Pièce d\'identité')}
                      disabled={loadingDoc === selectedPartner.id_card_url}
                      className="text-xs font-bold text-[#FF5722] hover:bg-orange-50 dark:hover:bg-orange-950/30 flex-shrink-0"
                    >
                      {loadingDoc === selectedPartner.id_card_url ? (
                        <RefreshCw size={13} className="animate-spin mr-1" />
                      ) : (
                        <ExternalLink size={13} className="mr-1" />
                      )}
                      <span>Voir</span>
                    </Button>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                      Absent
                    </span>
                  )}
                </div>

                {/* NINEA / RCCM */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center flex-shrink-0">
                      <FileText size={15} />
                    </div>
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                        NINEA / RCCM
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {selectedPartner.business_doc_url ? 'Document téléversé' : 'Non fourni'}
                      </span>
                    </div>
                  </div>

                  {selectedPartner.business_doc_url ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleViewDocument(selectedPartner.business_doc_url, 'NINEA/RCCM')}
                      disabled={loadingDoc === selectedPartner.business_doc_url}
                      className="text-xs font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 flex-shrink-0"
                    >
                      {loadingDoc === selectedPartner.business_doc_url ? (
                        <RefreshCw size={13} className="animate-spin mr-1" />
                      ) : (
                        <ExternalLink size={13} className="mr-1" />
                      )}
                      <span>Voir</span>
                    </Button>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                      Absent
                    </span>
                  )}
                </div>
              </div>

              {/* Alerte si erreur document */}
              {docError && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle size={14} className="flex-shrink-0" />
                  <span>{docError}</span>
                </div>
              )}
            </div>

            {/* Boutons d'action dans la modal */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
              <Button variant="secondary" onClick={() => setIsDetailsModalOpen(false)}>
                Fermer
              </Button>
              {selectedPartner.status !== 'REJETE' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    handleOpenRejectModal(selectedPartner);
                  }}
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Rejeter
                </Button>
              )}
              {selectedPartner.status !== 'VALIDE' && (
                <Button
                  variant="primary"
                  onClick={() => handleValidatePartner(selectedPartner)}
                  disabled={isActionLoading === selectedPartner.id}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Valider la Candidature
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ====================================================================
          MODAL REJET PARTENAIRE (AVEC MOTIF)
          ==================================================================== */}
      {partnerToReject && (
        <Modal
          isOpen={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          title={`Rejeter la candidature : ${partnerToReject.company_name}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-zinc-400">
              Êtes-vous sûr de vouloir rejeter cette candidature partenaire ? Un SMS de notification sera envoyé au contact avec le motif renseigné.
            </p>

            <div>
              <label className="block text-slate-700 dark:text-zinc-300 font-bold mb-1">
                Motif du rejet (optionnel mais recommandé)
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Document NINEA manquant ou illisible, secteur non éligible..."
                rows={3}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#FF5722] outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setIsRejectModalOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmReject}
                disabled={isActionLoading === partnerToReject.id}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirmer le Rejet
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
