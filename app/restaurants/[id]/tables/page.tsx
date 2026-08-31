'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Utensils,
  Calendar,
  Building,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { PaymentModal } from '@/components/payment/PaymentModal';
import { useAuth } from '@/components/providers/AuthProvider';

export default function TableReservationPage({ params }: { params: { id: string } }) {
  const restaurantId = params.id;
  const { user } = useAuth();

  const [partnerId, setPartnerId] = useState<string>(restaurantId);
  const [partnerName, setPartnerName] = useState('Restaurant & Lounge');
  const [zones, setZones] = useState<any[]>([]);
  const [rawTables, setRawTables] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedZone, setSelectedZone] = useState('TERRASSE');
  const [guestCount, setGuestCount] = useState(4);
  const [reservationDate, setReservationDate] = useState('2026-09-20');
  const [mealSlot, setMealSlot] = useState<'MIDI' | 'SOIR'>('SOIR');
  const [reservationTime, setReservationTime] = useState('20:30');
  const [isPlatformPayment, setIsPlatformPayment] = useState(true);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeReservationId, setActiveReservationId] = useState<string | null>(null);

  useEffect(() => {
    async function loadTables() {
      if (!restaurantId) return;
      try {
        setIsLoading(true);
        const res = await fetch(`/api/restaurants/${restaurantId}/tables`);
        if (res.ok) {
          const data = await res.json();
          setZones(data.zones || []);
          setRawTables(data.rawTables || []);
          if (data.partnerId) setPartnerId(data.partnerId);
          if (data.partnerName) setPartnerName(data.partnerName);
          if (data.zones && data.zones.length > 0) {
            setSelectedZone(data.zones[0].id);
          }
        }
      } catch (err) {
        console.error('[TableReservationPage] Erreur:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadTables();
  }, [restaurantId]);

  const depositPerPerson = 5000;
  const totalDeposit = isPlatformPayment ? depositPerPerson * guestCount : 0;
  const depositFormatted = `${totalDeposit.toLocaleString('fr-FR')} FCFA`;

  const handleStartBooking = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/restaurants/reserve-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId,
          reservationDate,
          reservationTime,
          guestCount,
          isPlatformPayment,
          clientId: user?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Impossible d\'enregistrer la réservation.');
      }

      setActiveReservationId(data.reservation.id);

      if (isPlatformPayment) {
        setIsPaymentOpen(true);
      } else {
        alert('Votre réservation sur place a été enregistrée avec succès !');
        window.location.href = '/orders';
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la réservation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] transition-all shadow-xs"
        >
          <ChevronLeft size={16} />
          <span>Retour à l’accueil</span>
        </Link>

        <Link
          href={`/restaurants/${partnerId}/menu`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:text-[#FF5722]"
        >
          <Utensils size={14} />
          <span>Consulter le menu</span>
        </Link>
      </div>

      {/* 2. Layout 2 Colonnes Desktop / 1 Colonne Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Colonne Gauche : Hero Restaurant & Choix des Zones */}
        <div className="lg:col-span-2 space-y-6">
          {/* Hero */}
          <div className="relative w-full aspect-[16/9] rounded-3xl overflow-hidden shadow-xl border border-slate-200 dark:border-zinc-800 bg-slate-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80"
              alt={partnerName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            <div className="absolute top-4 right-4">
              <Badge variant="success" size="md">Réservation Ouverte</Badge>
            </div>

            <div className="absolute bottom-4 left-4 right-4 text-white space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF5722]">
                Restaurant & Gastronomie
              </span>
              <h1 className="text-xl sm:text-2xl font-black">{partnerName}</h1>
              <p className="text-xs text-zinc-300">
                Cadre prestigieux et tables raffinées pour déjeuners et dîners.
              </p>
            </div>
          </div>

          {/* Choix des Zones */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Building size={16} className="text-[#FF5722]" />
              <span>1. Choisissez votre zone de table</span>
            </h2>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
                <Skeleton className="h-28 rounded-2xl" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {zones.map((zone) => {
                  const active = selectedZone === zone.id;
                  return (
                    <div
                      key={zone.id}
                      onClick={() => setSelectedZone(zone.id)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        active
                          ? 'border-[#FF5722] bg-[#FF5722]/5 shadow-xs'
                          : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-xs font-black text-slate-900 dark:text-white">{zone.name}</h3>
                          {active && <div className="w-2.5 h-2.5 rounded-full bg-[#FF5722]" />}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-snug">{zone.description}</p>
                      </div>
                      <span className="text-[10px] font-bold text-[#FF5722] mt-3 block">
                        Max {zone.capacityMax} convives
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Colonne Droite : Paramètres de réservation & Acompte Sticky */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-5 sticky top-20 shadow-md">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Calendar size={18} className="text-[#FF5722]" />
              <span>Détails de la réservation</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Confirmation instantanée avec notification au restaurant.
            </p>
          </div>

          <div className="space-y-3">
            {/* Date */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Date de venue
              </label>
              <input
                type="date"
                value={reservationDate}
                onChange={(e) => setReservationDate(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-bold focus:outline-none focus:border-[#FF5722]"
              />
            </div>

            {/* Service & Heure */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Service (Midi ou Soir)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMealSlot('MIDI');
                    setReservationTime('13:00');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    mealSlot === 'MIDI'
                      ? 'bg-[#FF5722] text-white border-[#FF5722]'
                      : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  ☀️ Déjeuner (Midi)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMealSlot('SOIR');
                    setReservationTime('20:30');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                    mealSlot === 'SOIR'
                      ? 'bg-[#FF5722] text-white border-[#FF5722]'
                      : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                  }`}
                >
                  🌙 Dîner (Soir)
                </button>
              </div>
            </div>

            {/* Nombre de Personnes */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1">
                Nombre de personnes ({guestCount} convives)
              </label>
              <div className="flex items-center gap-2">
                {[2, 4, 6, 8, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setGuestCount(n)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      guestCount === n
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mode de Règlement */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 space-y-2">
            <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
              Modalité de réservation
            </span>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  checked={isPlatformPayment}
                  onChange={() => setIsPlatformPayment(true)}
                  className="accent-[#FF5722]"
                />
                <span>Acompte garanti en ligne ({depositFormatted})</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  checked={!isPlatformPayment}
                  onChange={() => setIsPlatformPayment(false)}
                  className="accent-[#FF5722]"
                />
                <span>Paiement direct sur place (Espèces / Wave direct)</span>
              </label>
            </div>
          </div>

          {/* CTA Réservation */}
          <Button
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            onClick={handleStartBooking}
            leftIcon={<Utensils size={18} />}
          >
            {isPlatformPayment ? `Confirmer l’acompte (${depositFormatted})` : 'Confirmer la table (Sur place)'}
          </Button>
        </div>
      </div>

      {/* Modale de Paiement SamirPay avec VRAI targetId de réservation */}
      {activeReservationId && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          targetType="TABLE_RESERVATION"
          targetId={activeReservationId}
          amountFormatted={depositFormatted}
          title={`Table ${partnerName} (${guestCount} pers.)`}
          onPaymentSuccess={() => {
            setIsPaymentOpen(false);
            window.location.href = '/orders';
          }}
        />
      )}
    </div>
  );
}
