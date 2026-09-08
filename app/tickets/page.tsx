'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Ticket, Sparkles, HelpCircle, ArrowRightLeft } from 'lucide-react';
import { TicketCard } from '@/components/tickets/TicketCard';
import { TransferModal, TransferTicketData } from '@/components/tickets/TransferModal';
import { TransferExplainerModal } from '@/components/tickets/TransferExplainerModal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/providers/AuthProvider';
import { getBrowserClient } from '@/lib/supabase/client';

export default function TicketsPage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'PAST'>('UPCOMING');
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modales de transfert & d'explication
  const [transferTicket, setTransferTicket] = useState<TransferTicketData | null>(null);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);

  const loadTickets = useCallback(async (showLoadingSpinner = true) => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    try {
      if (showLoadingSpinner) {
        setIsLoading(true);
        setErrorMsg(null);
      }
      const res = await fetch(`/api/tickets?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || []);
        setErrorMsg(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.error || 'Erreur lors du chargement de vos billets.');
      }
    } catch (err) {
      console.error('[TicketsPage] Erreur chargement billets:', err);
      setErrorMsg('Connexion momentanément indisponible. Vérifiez votre réseau.');
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthLoading) {
      loadTickets(true);
    }
  }, [isAuthLoading, loadTickets]);

  // Realtime subscription sur public.tickets pour l'utilisateur connecté (sans F5)
  useEffect(() => {
    if (!user?.id) return;

    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`realtime-tickets-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            setTickets((prev) =>
              prev.map((t) => {
                if (t.id === updated.id) {
                  const isNowValid = updated.status === 'VALIDE';
                  const eventDate = t.rawStartDate ? new Date(t.rawStartDate) : null;
                  const isFuture = eventDate ? eventDate.getTime() >= Date.now() : true;
                  return {
                    ...t,
                    status: updated.status,
                    usedAt: updated.checked_in_at,
                    qrCodeValue: updated.qr_code || t.qrCodeValue,
                    isUpcoming: isNowValid && isFuture,
                    isTransferLocked: Boolean(updated.transfer_locked),
                  };
                }
                return t;
              })
            );
          } else if (payload.eventType === 'INSERT') {
            // Recharger silencieusement pour récupérer les relations complètes (events, catégories)
            loadTickets(false);
          } else if (payload.eventType === 'DELETE') {
            setTickets((prev) => prev.filter((t) => t.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, loadTickets]);

  const filteredTickets = tickets.filter((t) => {
    if (activeTab === 'UPCOMING') return t.status === 'VALIDE' && t.isUpcoming;
    if (activeTab === 'PAST') return t.status === 'UTILISE' || !t.isUpcoming;
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

        <div className="flex items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setIsExplainerOpen(true)}
            leftIcon={<HelpCircle size={14} className="text-[#FF5722]" />}
          >
            Comment marche le transfert ?
          </Button>

          <Link href="/explore">
            <Button variant="primary" size="sm" leftIcon={<Sparkles size={14} />}>
              Réserver un billet
            </Button>
          </Link>
        </div>
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
      {errorMsg ? (
        <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-center space-y-3">
          <p className="text-sm font-bold text-red-600 dark:text-red-400">{errorMsg}</p>
          <Button variant="secondary" size="sm" onClick={() => loadTickets(true)}>
            Réessayer
          </Button>
        </div>
      ) : isLoading || isAuthLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <Skeleton className="h-64 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : filteredTickets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {filteredTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              {...ticket}
              onTransferClick={() =>
                setTransferTicket({
                  id: ticket.id,
                  ticketNumber: ticket.ticketNumber,
                  eventTitle: ticket.eventTitle,
                  dateFormatted: ticket.dateFormatted,
                  timeFormatted: ticket.timeFormatted,
                  seat: ticket.seat,
                  venue: ticket.venue,
                })
              }
              onCancelTransferSuccess={() => loadTickets(false)}
              onOpenExplainer={() => setIsExplainerOpen(true)}
            />
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

      {/* Modale d'initiation de transfert */}
      <TransferModal
        isOpen={Boolean(transferTicket)}
        onClose={() => setTransferTicket(null)}
        ticket={transferTicket}
        onTransferSuccess={() => {
          loadTickets(false);
        }}
        onOpenExplainer={() => {
          setTransferTicket(null);
          setIsExplainerOpen(true);
        }}
      />

      {/* Modale d'explication pédagogique & FAQ */}
      <TransferExplainerModal
        isOpen={isExplainerOpen}
        onClose={() => setIsExplainerOpen(false)}
      />
    </div>
  );
}
