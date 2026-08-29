'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Ticket, Sparkles, Filter } from 'lucide-react';
import { TicketCard } from '@/components/tickets/TicketCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function TicketsPage() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'PAST'>('UPCOMING');

  const myTickets = [
    {
      id: 'tkt-justice-001',
      ticketNumber: 'EV-8849-2026-XOF',
      eventTitle: 'Justice Tour — Live from Paris',
      eventSubtitle: 'Justin Bieber',
      eventImageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
      dateFormatted: '15 Sep 2026',
      timeFormatted: '22:00',
      venue: 'Dakar Arena, Diamniadio',
      seat: 'Pass VIP — Accès Carré Or',
      qrCodeValue: 'EV-TICKET-VAL-99283749281-CONFIRMED',
      status: 'VALIDE' as const,
      isUpcoming: true,
    },
    {
      id: 'tkt-dakar-food-002',
      ticketNumber: 'EV-3312-2026-XOF',
      eventTitle: 'Grand Festival Culinaire & Saveurs Teranga',
      eventSubtitle: 'Dakar Food Festival',
      eventImageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      dateFormatted: '02 Oct 2026',
      timeFormatted: '12:00',
      venue: 'Esplanade Terrou-Bi, Dakar',
      seat: 'Entrée Générale + Dégustation',
      qrCodeValue: 'EV-TICKET-VAL-11928374829-CONFIRMED',
      status: 'VALIDE' as const,
      isUpcoming: true,
    },
  ];

  const filteredTickets = myTickets.filter((t) => {
    if (activeTab === 'UPCOMING') return t.isUpcoming;
    if (activeTab === 'PAST') return !t.isUpcoming;
    return true;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header de la Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Ticket className="text-[#FF6B35]" size={28} />
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
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-[#FF6B35] text-white shadow-sm'
                : 'bg-white dark:bg-[#1E1E1E] text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Grille des Billets */}
      {filteredTickets.length > 0 ? (
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
