'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Ticket,
  Utensils,
  Building2,
  Calendar,
  CreditCard,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function OrdersPage() {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const myOrders = [
    {
      id: 'ord-001',
      orderNumber: 'CMD-2026-8891',
      type: 'TICKET',
      title: 'Justice Tour — Pass VIP Prestige',
      itemCount: 1,
      totalAmountFormatted: '35 000 FCFA',
      status: 'CONFIRMEE',
      paymentMethod: 'WAVE (SamirPay)',
      dateFormatted: '22 Août 2026',
      detailsUrl: '/tickets',
    },
    {
      id: 'ord-002',
      orderNumber: 'CMD-2026-7734',
      type: 'HALL_RESERVATION',
      title: 'Location Salle Palais des Congrès (Acompte 30%)',
      itemCount: 1,
      totalAmountFormatted: '150 000 FCFA',
      status: 'CONFIRMEE',
      paymentMethod: 'ORANGE_MONEY (SamirPay)',
      dateFormatted: '19 Août 2026',
      detailsUrl: '/halls/hall-palais-congres',
    },
    {
      id: 'ord-003',
      orderNumber: 'CMD-2026-5512',
      type: 'TABLE_RESERVATION',
      title: 'Réservation Table VIP — Terrou-Bi (4 personnes)',
      itemCount: 1,
      totalAmountFormatted: '20 000 FCFA',
      status: 'CONFIRMEE',
      paymentMethod: 'WAVE (SamirPay)',
      dateFormatted: '15 Août 2026',
      detailsUrl: '/restaurants/rest-terrou-bi/tables',
    },
    {
      id: 'ord-004',
      orderNumber: 'CMD-2026-4401',
      type: 'FOOD_ORDER',
      title: 'Commande Traiteur — 2x Thiéboudienne Royale & Boissons',
      itemCount: 3,
      totalAmountFormatted: '14 000 FCFA',
      status: 'LIVREE',
      paymentMethod: 'WAVE (SamirPay)',
      dateFormatted: '12 Août 2026',
      detailsUrl: '/restaurants/rest-dakar-grill/menu',
    },
  ];

  const filteredOrders = myOrders.filter((o) => {
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
          { id: 'TICKET', label: 'Billetterie' },
          { id: 'TABLE_RESERVATION', label: 'Tables Restaurants' },
          { id: 'HALL_RESERVATION', label: 'Salles & Espaces' },
          { id: 'FOOD_ORDER', label: 'Repas & Menus' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeCategory === tab.id
                ? 'bg-[#FF5722] text-white shadow-xs'
                : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Liste des Commandes */}
      {filteredOrders.length > 0 ? (
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
                  <span>Détails</span>
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
