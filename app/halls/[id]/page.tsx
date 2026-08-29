'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Share2,
  Heart,
  MapPin,
  Users,
  Maximize,
  CheckCircle2,
  Calendar as CalendarIcon,
  ShieldCheck,
  Clock,
  CreditCard,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PaymentModal } from '@/components/payment/PaymentModal';

export default function HallDetailPage({ params }: { params: { id: string } }) {
  const hallId = params.id || 'hall-terrou-bi-ocean';

  const [startDate, setStartDate] = useState('2026-10-15');
  const [durationDays, setDurationDays] = useState(1);
  const [isLiked, setIsLiked] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const hall = {
    id: hallId,
    name: 'Salle Océane Terrou-Bi',
    partnerName: 'Hôtel Terrou-Bi Dakar',
    location: 'Boulevard Martin Luther King, Dakar',
    areaSqm: 500,
    capacitySeated: 250,
    capacityCocktail: 350,
    pricePerDay: 500000,
    priceFormatted: '500 000 FCFA',
    depositRate: 0.30, // 30% d'acompte
    depositAmount: 150000,
    imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&auto=format&fit=crop&q=80',
    description:
      'Située en bordure de mer, la Salle Océane offre un cadre prestigieux pour vos conférences, galas de fin d’année, réceptions de mariage et séminaires d’entreprise. Équipée d’une régie son & lumière de pointe et d’un accès direct à une terrasse panoramique.',
    amenities: [
      'Climatisation centrale',
      'Vidéoprojecteur laser 4K & Écran géant',
      'Régie sonorisation et micros HF',
      'Wifi fibre très haut débit',
      'Terrasse extérieure privative vue sur mer',
      'Espace traiteur et cuisine de préparation',
      'Service de sécurité & Agent d’accueil',
      'Parking surveillé 150 places',
    ],
  };

  // Calculs dynamiques
  const totalAmount = hall.pricePerDay * durationDays;
  const depositAmount = Math.round(totalAmount * hall.depositRate);
  const balanceAmount = totalAmount - depositAmount;

  const totalFormatted = `${totalAmount.toLocaleString('fr-FR')} FCFA`;
  const depositFormatted = `${depositAmount.toLocaleString('fr-FR')} FCFA`;
  const balanceFormatted = `${balanceAmount.toLocaleString('fr-FR')} FCFA`;

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/halls"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-[#FF6B35] transition-all shadow-xs"
        >
          <ChevronLeft size={16} />
          <span>Retour au catalogue</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLiked(!isLiked)}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:text-red-500 transition-all shadow-xs"
            aria-label="Favoris"
          >
            <Heart size={18} className={isLiked ? 'fill-red-500 text-red-500' : ''} />
          </button>
          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({ title: hall.name, url: window.location.href });
              } else {
                navigator.clipboard.writeText(window.location.href);
                alert('Lien copié !');
              }
            }}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:text-[#FF6B35] transition-all shadow-xs"
            aria-label="Partager"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* 2. Layout 2 Colonnes sur Desktop / 1 Colonne sur Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Colonne Gauche : Hero, Description, Équipements */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero Image */}
          <div className="relative w-full aspect-[16/9] rounded-3xl overflow-hidden shadow-xl border border-slate-200 dark:border-zinc-800 bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hall.imageUrl} alt={hall.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

            <div className="absolute top-4 right-4">
              <Badge variant="success" size="md">Disponible</Badge>
            </div>

            <div className="absolute bottom-4 left-4 right-4 text-white space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF6B35]">
                {hall.partnerName}
              </span>
              <h1 className="text-xl sm:text-2xl font-black">{hall.name}</h1>
              <p className="text-xs text-zinc-300 flex items-center gap-1.5">
                <MapPin size={13} className="text-[#FF6B35]" />
                <span>{hall.location}</span>
              </p>
            </div>
          </div>

          {/* Métriques clés */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 text-center">
              <Users size={20} className="mx-auto text-[#FF6B35] mb-1" />
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">Capacité</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {hall.capacitySeated} à {hall.capacityCocktail} pers.
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 text-center">
              <Maximize size={20} className="mx-auto text-[#FF6B35] mb-1" />
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">Surface</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                {hall.areaSqm} m²
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 text-center">
              <ShieldCheck size={20} className="mx-auto text-emerald-500 mb-1" />
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">Acompte</span>
              <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                30% requis
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Description de l’espace
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
              {hall.description}
            </p>
          </div>

          {/* Équipements */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Équipements & Prestations incluses
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {hall.amenities.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300">
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Colonne Droite : Formulaire de Devis & Réservation Sticky */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-5 sticky top-20 shadow-md">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <CalendarIcon size={18} className="text-[#FF6B35]" />
              <span>Réserver cette salle</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Sélectionnez vos dates pour calculer l’acompte et le moratoire.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Date de début de l’événement
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold focus:outline-none focus:border-[#FF6B35]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Durée (en journées)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 5].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDurationDays(d)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      durationDays === d
                        ? 'bg-[#FF6B35] text-white border-[#FF6B35] shadow-xs'
                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                    }`}
                  >
                    {d}j
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Récapitulatif Financier (CDC V3 Acompte 30% & Solde) */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-zinc-400">
              <span>Montant total ({durationDays} jour{durationDays > 1 ? 's' : ''})</span>
              <span className="font-bold text-slate-900 dark:text-white">{totalFormatted}</span>
            </div>
            <div className="flex justify-between text-[#FF6B35] font-black text-sm border-t border-slate-200 dark:border-zinc-800 pt-2">
              <span>Acompte requis (30%)</span>
              <span>{depositFormatted}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 dark:text-zinc-500">
              <span>Solde restant avant remise des clés</span>
              <span>{balanceFormatted}</span>
            </div>
          </div>

          {/* Notice Moratoire */}
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 text-[11px] font-medium flex items-start gap-2">
            <Clock size={15} className="flex-shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Moratoire 48h (CDC V3) :</strong> Dès versement de l&apos;acompte, la salle vous est réservée pendant 48h.
            </span>
          </div>

          {/* Bouton de Règlement de l'Acompte */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => setIsPaymentOpen(true)}
            leftIcon={<CreditCard size={18} />}
          >
            Verser l’acompte ({depositFormatted})
          </Button>
        </div>
      </div>

      {/* Modale de Paiement SamirPay */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        targetType="HALL_RESERVATION"
        targetId="c9b74052-b883-4ee9-b1d5-d860d5bdf1e8"
        amountFormatted={depositFormatted}
        title={`${hall.name} (Acompte 30%)`}
        onPaymentSuccess={() => {
          setIsPaymentOpen(false);
          window.location.href = '/orders';
        }}
      />
    </div>
  );
}
