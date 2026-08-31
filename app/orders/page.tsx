'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Ticket,
  Utensils,
  Building2,
  Calendar,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/providers/AuthProvider';

export default function OrdersPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const res = await fetch(`/api/orders?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } catch (err) {
        console.error('[OrdersPage] Erreur chargement commandes:', err);
      } finally {
        setIsLoading(false);
      }
    }
    if (!isAuthLoading) {
      loadOrders();
    }
  }, [user?.id, isAuthLoading]);

  const filteredOrders = orders.filter((o) => {
    if (activeCategory === 'ALL') return true;
    return o.type === activeCategory;
  });

  const getCategoryIcon = (type: string) => {
    switch (type) {
      case 'TICKET':
        return <Ticket size={18} className="text-[#FF5722]" />;
      case 'HALL_RESERVATION':
        return <Building2 size={18} className="text-blue-500" />;
      case 'TABLE_RESERVATION':
      case 'FOOD_ORDER':
        return <Utensils size={18} className="text-emerald-500" />;
      default:
        return <ShoppingBag size={18} className="text-slate-500" />;
    }
  };

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="max-w-md mx-auto min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center">
          <ShoppingBag size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Connexion requise</h2>
        <p className="text-xs text-slate-500">Connectez-vous pour suivre vos commandes et réservations.</p>
        <Link href="/login">
          <Button variant="primary" size="md">Se connecter</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="text-[#FF5722]" size={28} />
            <span>Mes Commandes & Réservations</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Suivez en direct vos achats de billets, réservations de salles et de tables.
          </p>
        </div>

        <Link href="/explore">
          <Button variant="primary" size="sm">
            Nouvelle réservation
          </Button>
        </Link>
      </div>

      {/* 2. Onglets de Catégories */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-zinc-800 pb-3">
        {[
          { id: 'ALL', label: 'Toutes les commandes' },
          { id: 'TABLE_RESERVATION', label: 'Tables Restaurants' },
          { id: 'HALL_RESERVATION', label: 'Salles & Espaces' },
          { id: 'FOOD_ORDER', label: 'Repas & Menus' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
              activeCategory === tab.id
                ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white border-transparent shadow-md shadow-[#FF5722]/30 font-bold'
                : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Liste des Commandes */}
      {isLoading || isAuthLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs hover:border-[#FF5722]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getCategoryIcon(order.type)}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-zinc-500">
                      {order.orderNumber}
                    </span>
                    <StatusBadge status={order.status} />
                  </div>

                  <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {order.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <Calendar size={13} />
                      <span>{order.dateFormatted}</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <CreditCard size={13} />
                      <span>{order.paymentMethod}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800">
                <span className="text-base sm:text-lg font-black text-[#FF5722]">
                  {order.totalAmountFormatted}
                </span>

                <Link
                  href={order.detailsUrl}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-[#FF5722] hover:text-white text-xs font-bold text-slate-700 dark:text-zinc-300 transition-colors"
                >
                  <span>Consulter</span>
                  <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Aucune commande trouvée"
          description="Vous n’avez aucune commande dans cette catégorie pour le moment."
          actionLabel="Découvrir les offres"
          actionHref="/explore"
        />
      )}
    </div>
  );
}
