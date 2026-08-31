'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Ticket, Sparkles } from 'lucide-react';
import { TicketCard } from '@/components/tickets/TicketCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/providers/AuthProvider';

export default function TicketsPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'PAST'>('UPCOMING');
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTickets() {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const res = await fetch(`/api/tickets?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setTickets(data.tickets || []);
        }
      } catch (err) {
        console.error('[TicketsPage] Erreur chargement billets:', err);
      } finally {
        setIsLoading(false);
      }
    }
    if (!isAuthLoading) {
      loadTickets();
    }
  }, [user?.id, isAuthLoading]);

  const filteredTickets = tickets.filter((t) => {
    if (activeTab === 'UPCOMING') return t.isUpcoming;
    if (activeTab === 'PAST') return !t.isUpcoming;
    return true;
  });

  if (!isAuthLoading && !isAuthenticated) {
    return (
      <div className="max-w-md mx-auto min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center">
          <Ticket size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Connexion requise</h2>
        <p className="text-xs text-slate-500">Connectez-vous pour retrouver vos billets électroniques sécurisés.</p>
        <Link href="/login">
          <Button variant="primary" size="md">Se connecter</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header de la Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Ticket className="text-[#FF5722]" size={28} />
            <span>Mes Billets Électroniques</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Retrouvez tous vos billets avec QR codes officiels valables aux entrées.
          </p>
        </div>

        <Link href="/explore">
          <Button variant="primary" size="sm" leftIcon={<Sparkles size={14} />}>
            Réserver un billet
          </Button>
        </Link>
      </div>

      {/* 2. Onglets de Filtrage */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
        {[
          { id: 'UPCOMING', label: 'À venir' },
          { id: 'ALL', label: 'Tous mes billets' },
          { id: 'PAST', label: 'Historique / Utilisés' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 active:scale-[0.98] ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] text-white border-transparent shadow-md shadow-[#FF5722]/30 font-bold'
                : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Grille des Billets */}
      {isLoading || isAuthLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : filteredTickets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} {...ticket} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Aucun billet disponible"
          description="Vous n’avez aucun billet pour le moment dans cette catégorie."
          actionLabel="Explorer les événements"
          actionHref="/explore"
        />
      )}
    </div>
  );
}
