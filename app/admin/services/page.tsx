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

export default function AdminServicesManagementPage() {
  const [currentTab, setCurrentTab] = useState<'events' | 'halls' | 'tables' | 'products' | 'orders'>('events');
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const handleUpdateStatus = async (table: 'events' | 'halls' | 'products', id: string, newStatus: string) => {
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/services', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, id, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour.');

      setFeedback({ type: 'success', text: 'Statut du service mis à jour avec succès.' });
      await fetchServices();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Échec de la mise à jour.';
      setFeedback({ type: 'error', text: msg });
    }
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

                  {/* Actions de Modération */}
                  {currentTab === 'events' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.status !== 'PUBLIE' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleUpdateStatus('events', item.id, 'PUBLIE')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        >
                          Publier
                        </Button>
                      )}
                      {item.status !== 'SUSPENDU' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUpdateStatus('events', item.id, 'SUSPENDU')}
                          className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs"
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
    </div>
  );
}
