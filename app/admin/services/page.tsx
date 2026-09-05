'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Calendar,
  Building2,
  Utensils,
  ShoppingBag,
  Ticket,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Eye,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface RejectModalState {
  open: boolean;
  table: 'events' | 'halls' | 'products';
  id: string;
  title: string;
  targetStatus: string;
}

export default function AdminServicesManagementPage() {
  const toast = useToast();
  const [currentTab, setCurrentTab] = useState<'events' | 'halls' | 'tables' | 'products' | 'orders'>('events');
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState<RejectModalState>({ open: false, table: 'events', id: '', title: '', targetStatus: 'BROUILLON' });
  const [rejectReason, setRejectReason] = useState('');

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/services?type=${currentTab}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data[currentTab] || []);
      }
    } catch (err) {
      console.error('[AdminServices] Erreur chargement:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentTab]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleUpdateStatus = async (table: 'events' | 'halls' | 'products', id: string, newStatus: string, reason?: string) => {
    try {
      const res = await fetch('/api/admin/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id, status: newStatus, reason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour.');

      toast.success('Le statut du service a été mis à jour avec succès.');
      await fetchServices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la mise à jour.';
      toast.error(msg);
    }
  };

  const openRejectModal = (table: 'events' | 'halls' | 'products', id: string, title: string, targetStatus = 'BROUILLON') => {
    setRejectReason('');
    setRejectModal({ open: true, table, id, title, targetStatus });
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Le motif est obligatoire.');
      return;
    }
    setRejectModal(m => ({ ...m, open: false }));
    await handleUpdateStatus(rejectModal.table, rejectModal.id, rejectModal.targetStatus, rejectReason.trim());
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
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
              Supervision des Catalogues & Services (§130)
            </h1>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => fetchServices()}
          disabled={isLoading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>Actualiser</span>
        </Button>
      </div>

      {/* Onglets de Services */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-4 overflow-x-auto">
          {[
            { key: 'events', label: 'Événements & Billets', icon: Calendar },
            { key: 'halls', label: 'Salles de Fête', icon: Building2 },
            { key: 'tables', label: 'Restaurants & Tables', icon: Utensils },
            { key: 'products', label: 'Produits & Traiteurs', icon: ShoppingBag },
            { key: 'orders', label: 'Commandes B2C', icon: Ticket },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setCurrentTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-[#FF5722] text-white shadow-xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Contenu Réel */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <RefreshCw size={24} className="animate-spin mx-auto text-[#FF5722] mb-2" />
            <p className="text-xs">Chargement des données réelles...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
            <p className="text-xs font-bold">Aucun élément enregistré dans cette catégorie.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const partnerName = item.partners?.company_name || 'Partenaire direct';

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-black text-slate-900 dark:text-white">
                        {item.title || item.name || item.company_name || `Commande #${item.id.slice(0, 8)}`}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                        {item.status || (item.is_active ? 'ACTIF' : 'INACTIF')}
                      </span>
                    </div>

                    <div className="text-slate-500 dark:text-zinc-400 flex flex-wrap gap-x-4">
                      <span>Fournisseur: {partnerName}</span>
                      {item.location && <span>Lieu: {item.location}</span>}
                      {item.price !== undefined && <span>Prix: {item.price} FCFA</span>}
                      {item.total_amount !== undefined && <span>Total: {item.total_amount} FCFA</span>}
                      <span>Enregistré le {formatDate(item.created_at)}</span>
                    </div>
                  </div>

                  {/* Actions de Modération — Règles strictes par statut */}
                  {currentTab === 'events' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.status === 'EN_ATTENTE' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpdateStatus('events', item.id, 'VALIDE')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          >
                            <CheckCircle size={13} className="mr-1" />
                            Valider
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openRejectModal('events', item.id, item.title)}
                            className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs"
                          >
                            <XCircle size={13} className="mr-1" />
                            Rejeter
                          </Button>
                        </>
                      )}
                      {(item.status === 'VALIDE' || item.status === 'PUBLIE') && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openRejectModal('events', item.id, item.title, 'SUSPENDU')}
                          className="text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-xs"
                        >
                          Suspendre
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Rejet */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-[#1E1E1E] rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
                <XCircle size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-sm">
                  {rejectModal.targetStatus === 'SUSPENDU' ? 'Suspendre l’événement' : 'Rejeter l’événement'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate max-w-xs">{rejectModal.title}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                {rejectModal.targetStatus === 'SUSPENDU' ? 'Motif de suspension' : 'Motif du rejet'} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder={rejectModal.targetStatus === 'SUSPENDU'
                  ? 'Ex: Contenu non conforme, vérification requise, signalement...'
                  : 'Ex: Images manquantes, informations incomplètes, date incorrecte...'}
                rows={3}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              />
              <p className="mt-1 text-[10px] text-slate-400 dark:text-zinc-500">
                Ce motif sera envoyé au partenaire par In-App, SMS et Email.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRejectModal(m => ({ ...m, open: false }))}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={confirmReject}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Confirmer le rejet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
