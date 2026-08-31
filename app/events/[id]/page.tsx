'use client';

import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { PaymentModal } from '@/components/payment/PaymentModal';

export default function EventDetailPage({ params }: { params: { id: string } }) {
  const [isLiked, setIsLiked] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [event, setEvent] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventId = params.id;

  useEffect(() => {
    async function loadEvent() {
      if (!eventId) return;
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/events/${eventId}`);
        if (!res.ok) {
          throw new Error('Événement introuvable.');
        }
        const data = await res.json();
        setEvent(data.event);
        if (data.event.categories && data.event.categories.length > 0) {
          setSelectedCategoryId(data.event.categories[0].id);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur chargement événement');
      } finally {
        setIsLoading(false);
      }
    }
    loadEvent();
  }, [eventId]);

  if (isLoading) {
    return (
      <div className="space-y-6 pb-20">
        <Skeleton className="h-9 w-40 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="w-full aspect-[16/9] rounded-3xl" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
              <Skeleton className="h-20 rounded-2xl" />
            </div>
            <Skeleton className="h-40 rounded-3xl" />
          </div>
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-md mx-auto min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-950/40 text-red-500 flex items-center justify-center">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Événement introuvable</h2>
        <p className="text-xs text-slate-500">{error || 'Cet événement n’existe pas ou a été archivé.'}</p>
        <Link href="/explore">
          <Button variant="primary" size="md">Retour aux événements</Button>
        </Link>
      </div>
    );
  }

  const selectedCategory = (event.categories || []).find((c: any) => c.id === selectedCategoryId) || event.categories?.[0];

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Header Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] transition-all shadow-xs"
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
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-200 hover:text-[#FF5722] transition-all shadow-xs"
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
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FF5722] text-white shadow-md inline-block">
                {event.category || 'Événement'}
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
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0">
                <Calendar size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Date</span>
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{event.dateFormatted}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0">
                <Clock size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Heure</span>
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">{event.time}</p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3.5 rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center flex-shrink-0">
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

          {/* Fiche Organisateur */}
          {event.organizer && (
            <div className="p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-700 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={event.organizer.avatar} alt={event.organizer.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">Organisateur</span>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">{event.organizer.name}</h3>
                </div>
              </div>

              <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-xs font-bold text-slate-700 dark:text-zinc-300">
                Partenaire Certifié
              </span>
            </div>
          )}
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

          {/* Choix Formules réelles */}
          {event.categories && event.categories.length > 0 ? (
            <div className="space-y-3">
              {event.categories.map((cat: any) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <div
                    key={cat.id}
                    onClick={() => !cat.isSoldOut && setSelectedCategoryId(cat.id)}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      cat.isSoldOut
                        ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900'
                        : isSelected
                        ? 'border-[#FF5722] bg-[#FF5722]/5 shadow-xs cursor-pointer'
                        : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-xs font-black text-slate-900 dark:text-white">{cat.name}</h3>
                          {cat.name.toUpperCase().includes('VIP') && <Sparkles size={12} className="text-amber-500" />}
                        </div>
                        <span className="text-xs font-black text-[#FF5722] mt-0.5 block">{cat.priceFormatted}</span>
                        {cat.isSoldOut && (
                          <span className="text-[10px] font-bold text-red-500 block">Épuisé</span>
                        )}
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected
                            ? 'border-[#FF5722] bg-[#FF5722] text-white'
                            : 'border-slate-300 dark:border-zinc-700'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs font-medium">
              Aucune catégorie de billet configurée pour cet événement.
            </div>
          )}

          {/* Avantages de la formule choisie */}
          {selectedCategory && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800/80 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">
                Inclus dans {selectedCategory.name} :
              </span>
              <ul className="space-y-1.5">
                {selectedCategory.perks.map((perk: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                    <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Récapitulatif & CTA */}
          {selectedCategory && (
            <div className="pt-2 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">Total à régler</span>
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  {selectedCategory.priceFormatted}
                </span>
              </div>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                disabled={selectedCategory.isSoldOut}
                onClick={() => setIsPaymentOpen(true)}
                leftIcon={<Ticket size={18} />}
              >
                {selectedCategory.isSoldOut ? 'Catégorie Épuisée' : `Acheter mon billet (${selectedCategory.priceFormatted})`}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500">
                <ShieldCheck size={13} className="text-emerald-500" />
                <span>Garantie officielle Event Village • Émission QR immédiate</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modale de Paiement SamirPay avec VRAI category_id */}
      {selectedCategory && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          targetType="TICKET"
          targetId={selectedCategory.id}
          amountFormatted={selectedCategory.priceFormatted}
          title={`${event.title} (${selectedCategory.name})`}
          onPaymentSuccess={() => {
            setIsPaymentOpen(false);
            window.location.href = '/tickets';
          }}
        />
      )}
    </div>
  );
}
