'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Share2,
  Heart,
  Ticket,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  ShieldCheck,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PaymentModal } from '@/components/payment/PaymentModal';

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const [isLiked, setIsLiked] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'standard' | 'vip'>('standard');

  const eventId = params.id || 'evt-justice-tour';

  // Formules de tickets selon CDC V3
  const ticketTiers = {
    standard: {
      id: `${eventId}-cat-std`,
      name: 'Pass Standard',
      price: 15000,
      priceFormatted: '15 000 FCFA',
      perks: ['Accès général à la fosse & gradins', 'Entrée à partir de 18h00', 'Billet électronique avec QR Code sécurisé'],
    },
    vip: {
      id: `${eventId}-cat-vip`,
      name: 'Pass VIP Prestige',
      price: 35000,
      priceFormatted: '35 000 FCFA',
      perks: [
        'Accès Carré VIP devant la scène',
        'Coupe-file & Entrée prioritaire',
        'Boisson de bienvenue & Vestiaire inclus',
        'Accès au Lounge Bar exclusif',
      ],
    },
  };

  const currentTier = ticketTiers[selectedTier];

  const event = {
    id: eventId,
    title: 'Justice Tour — Live from Paris',
    subtitle: 'Enregistrement Live & Performance Exceptionnelle',
    artist: 'Justin Bieber',
    artistAvatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
    posterUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
    dateFormatted: 'Mardi 15 Septembre 2026',
    time: '22:00 (Ouverture des portes à 18:00)',
    venue: 'Dakar Arena, Diamniadio, Sénégal',
    attendees: 4250,
    description:
      'Le Justice World Tour débarque à la Dakar Arena pour un show grandiose. Au programme : les plus grands titres mondiaux (Peaches, Ghost, Stay, Hold On), une scénographie visuelle monumentale et une acoustique de pointe. Une soirée événementielle inoubliable orchestrée par Event Village.',
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-[#FF6B35] transition-all shadow-xs"
        >
          <ChevronLeft size={16} />
          <span>Retour aux événements</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:text-red-500 transition-all shadow-xs"
            aria-label="Ajouter aux favoris"
          >
            <Heart size={18} className={isLiked ? 'fill-red-500 text-red-500' : ''} />
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: event.title, url: window.location.href });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Lien copié dans le presse-papier !');
              }
            }}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:text-[#FF6B35] transition-all shadow-xs"
            aria-label="Partager"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* 2. Layout Responsive (2 Colonnes sur Desktop / 1 Colonne sur Mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Colonne Gauche : Hero Image, Détails, Organisateur */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Poster Immersif */}
          <div className="relative w-full aspect-[16/9] sm:aspect-[16/8] rounded-3xl overflow-hidden shadow-xl border border-slate-200 dark:border-zinc-800 bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.posterUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white space-y-1">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FF6B35] text-white shadow-md inline-block">
                Concert Live
              </span>
              <h1 className="text-xl sm:text-3xl font-black tracking-tight drop-shadow-md">
                {event.title}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-300 font-medium drop-shadow">
                {event.subtitle}
              </p>
            </div>
          </div>

          {/* Cartes d'Informations Rapides */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF6B35] flex items-center justify-center flex-shrink-0">
                <Calendar size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Date</span>
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{event.dateFormatted}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF6B35] flex items-center justify-center flex-shrink-0">
                <Clock size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Heure</span>
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{event.time}</p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF6B35] flex items-center justify-center flex-shrink-0">
                <MapPin size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Lieu</span>
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{event.venue}</p>
              </div>
            </div>
          </div>

          {/* À propos de l'événement */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              À propos de l’événement
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
              {event.description}
            </p>
          </div>

          {/* Fiche Artiste / Organisateur */}
          <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-700 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.artistAvatar} alt={event.artist} className="w-full h-full object-cover" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Tête d’affiche</span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">{event.artist}</h3>
              </div>
            </div>

            <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300">
              Artiste Officiel
            </span>
          </div>
        </div>

        {/* Colonne Droite : Formules & Module d'Achat Sticky */}
        <div className="bg-white dark:bg-[#1E1E1E] p-6 rounded-3xl border border-slate-200/80 dark:border-zinc-800 space-y-6 sticky top-20 shadow-md">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
              Choisissez votre formule
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Paiement direct sécurisé via SamirPay (Wave / OM).
            </p>
          </div>

          {/* Choix Formules (Standard / VIP) */}
          <div className="space-y-3">
            {/* Standard */}
            <div
              onClick={() => setSelectedTier('standard')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedTier === 'standard'
                  ? 'border-[#FF6B35] bg-[#FF6B35]/5 shadow-xs'
                  : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white">Pass Standard</h3>
                  <span className="text-xs font-black text-[#FF6B35] mt-0.5 block">15 000 FCFA</span>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedTier === 'standard'
                      ? 'border-[#FF6B35] bg-[#FF6B35] text-white'
                      : 'border-slate-300 dark:border-zinc-700'
                  }`}
                >
                  {selectedTier === 'standard' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </div>

            {/* VIP Prestige */}
            <div
              onClick={() => setSelectedTier('vip')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedTier === 'vip'
                  ? 'border-[#FF6B35] bg-[#FF6B35]/5 shadow-xs'
                  : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-black text-slate-900 dark:text-white">Pass VIP Prestige</h3>
                    <Sparkles size={12} className="text-amber-500" />
                  </div>
                  <span className="text-xs font-black text-[#FF6B35] mt-0.5 block">35 000 FCFA</span>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedTier === 'vip'
                      ? 'border-[#FF6B35] bg-[#FF6B35] text-white'
                      : 'border-slate-300 dark:border-zinc-700'
                  }`}
                >
                  {selectedTier === 'vip' && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            </div>
          </div>

          {/* Avantages de la formule choisie */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800/80 space-y-2">
            <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
              Inclus dans {currentTier.name} :
            </span>
            <ul className="space-y-1.5">
              {currentTier.perks.map((perk, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                  <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Récapitulatif & CTA */}
          <div className="pt-2 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Total à régler</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">
                {currentTier.priceFormatted}
              </span>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => setIsPaymentOpen(true)}
              leftIcon={<Ticket size={18} />}
            >
              Acheter mon billet ({currentTier.priceFormatted})
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>Garantie officielle Event Village • Émission QR immédiate</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modale de Paiement SamirPay */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        targetType="TICKET"
        targetId={currentTier.id}
        amountFormatted={currentTier.priceFormatted}
        title={`${event.title} (${currentTier.name})`}
        onPaymentSuccess={() => {
          setIsPaymentOpen(false);
          window.location.href = '/tickets';
        }}
      />
    </div>
  );
}
