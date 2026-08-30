'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Compass,
  Building2,
  Utensils,
  ArrowRight,
  Music,
  Flame,
  Calendar,
  Search,
} from 'lucide-react';
import { EventCard } from '@/components/events/EventCard';
import { Button } from '@/components/ui/Button';

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'ALL', label: 'Tous', icon: Sparkles },
    { id: 'CONCERT', label: 'Concerts & Live', icon: Music },
    { id: 'FESTIVAL', label: 'Festivals', icon: Flame },
    { id: 'FOOD', label: 'Gastronomie & Tables', icon: Utensils },
    { id: 'SALLE', label: 'Salles & Réceptions', icon: Building2 },
  ];

  const featuredEvents = [
    {
      id: 'evt-justice-tour',
      title: 'Justice Tour — Live from Paris',
      subtitle: 'Justin Bieber',
      imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
      dateFormatted: '15 Sep 2026',
      dayNumber: '15',
      monthShort: 'SEP',
      timeFormatted: '22:00',
      venue: 'Dakar Arena, Diamniadio',
      category: 'CONCERT',
      priceFormatted: '15 000 FCFA',
    },
    {
      id: 'evt-post-malone',
      title: 'Twelve Carat Tour Live',
      subtitle: 'Post Malone',
      imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&auto=format&fit=crop&q=80',
      dateFormatted: '19 Déc 2026',
      dayNumber: '19',
      monthShort: 'DÉC',
      timeFormatted: '21:00',
      venue: 'Monument de la Renaissance',
      category: 'CONCERT',
      priceFormatted: '25 000 FCFA',
    },
    {
      id: 'evt-dakar-food-fest',
      title: 'Grand Festival Culinaire & Saveurs Teranga',
      subtitle: 'Dakar Food Festival',
      imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      dateFormatted: '02 Oct 2026',
      dayNumber: '02',
      monthShort: 'OCT',
      timeFormatted: '12:00',
      venue: 'Esplanade Terrou-Bi, Dakar',
      category: 'FOOD',
      priceFormatted: '5 000 FCFA',
    },
    {
      id: 'evt-soiree-gala-prestige',
      title: 'Nuit de l’Excellence & Gala Annuel',
      subtitle: 'Club VIP Dakar',
      imageUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&auto=format&fit=crop&q=80',
      dateFormatted: '10 Nov 2026',
      dayNumber: '10',
      monthShort: 'NOV',
      timeFormatted: '20:00',
      venue: 'Palais des Congrès, King Fahd',
      category: 'SALLE',
      priceFormatted: '50 000 FCFA',
    },
  ];

  const filteredEvents = featuredEvents.filter((evt) => {
    const matchCategory = selectedCategory === 'ALL' || evt.category === selectedCategory;
    const matchSearch =
      searchQuery === '' ||
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.venue.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="space-y-10 pb-12">
      {/* ====================================================================
          1. HERO SECTION PREMIUM (Fluidité desktop & mobile)
          ==================================================================== */}
      <section className="relative rounded-3xl overflow-hidden bg-zinc-900 text-white min-h-[360px] sm:min-h-[420px] flex items-center p-6 sm:p-10 lg:p-14 shadow-2xl border border-zinc-800">
        {/* Background Image avec gradient overlay */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&auto=format&fit=crop&q=80')" }}>
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/30" />
        </div>

        {/* Contenu Hero */}
        <div className="relative z-10 max-w-2xl space-y-4 sm:space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF5722]/20 border border-[#FF5722]/40 text-[#FF5722] text-xs font-bold backdrop-blur-md">
            <Sparkles size={14} />
            <span>La Référence Événementielle au Sénégal</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            Découvrez, réservez et vivez des{' '}
            <span className="text-[#FF5722]">expériences uniques</span>.
          </h1>

          <p className="text-sm sm:text-base text-zinc-300 font-medium leading-relaxed">
            Billetterie officielle de concerts, réservation de tables de prestige, location de salles et commandes traiteur.
          </p>

          {/* Formulaire de Recherche Intégré */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher par artiste, ville, salle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/10 dark:bg-black/40 border border-white/20 text-white placeholder-zinc-400 text-sm focus:outline-none focus:border-[#FF5722] backdrop-blur-md transition-all"
              />
            </div>
            <Link href="/explore">
              <Button variant="primary" size="md" className="h-12 w-full sm:w-auto px-6 font-black" leftIcon={<Compass size={18} />}>
                Explorer
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. SÉLECTEUR DE CATÉGORIES
          ==================================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Catégories d’activités
          </h2>
          <Link href="/explore" className="text-xs font-bold text-[#FF5722] hover:opacity-85 flex items-center gap-1 transition-opacity">
            <span>Tout voir</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pb-2">
          {categories.map((cat) => {
            const active = selectedCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 shadow-xs active:scale-95 ${
                  active
                    ? 'bg-[#FF5722] text-white shadow-md shadow-[#FF5722]/20 font-black'
                    : 'bg-white dark:bg-[#1E1E1E] text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-800 hover:border-[#FF5722]/40 hover:bg-slate-50 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon size={16} className={active ? 'text-white' : 'text-[#FF5722]'} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ====================================================================
          3. GRILLE DES ÉVÉNEMENTS VEDETTES
          ==================================================================== */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Événements à l’affiche
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {filteredEvents.length} événement(s) disponible(s)
            </p>
          </div>
          <Link href="/explore" className="text-xs font-bold text-[#FF5722] hover:underline">
            Voir calendrier
          </Link>
        </div>

        {filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredEvents.map((evt) => (
              <EventCard key={evt.id} {...evt} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-[#1E1E1E] rounded-3xl border border-slate-200 dark:border-zinc-800 p-8">
            <Calendar size={36} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">Aucun événement dans cette catégorie</p>
            <p className="text-xs text-slate-500 mt-1">Essayez de modifier votre recherche ou sélectionnez une autre catégorie.</p>
          </div>
        )}
      </section>

      {/* ====================================================================
          4. BANNIÈRES SERVICES COMPLÉMENTAIRES (SALLES & RESTAURATION)
          ==================================================================== */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Carte Salles */}
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white p-6 sm:p-8 flex flex-col justify-between min-h-[220px] shadow-lg group">
          <div
            className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&auto=format&fit=crop&q=80')" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/30" />
          </div>
          <div className="relative z-10">
            <span className="px-2.5 py-1 rounded-lg bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white">
              Espaces & Réceptions
            </span>
            <h3 className="text-xl font-black mt-2">Location de Salles de Fête</h3>
            <p className="text-xs text-zinc-300 mt-1 max-w-sm">
              Réservez votre salle avec acompte de 30% et moratoire de 48h selon le CDC.
            </p>
          </div>
          <div className="relative z-10 pt-4">
            <Link href="/halls">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                Voir le catalogue des salles
              </Button>
            </Link>
          </div>
        </div>

        {/* Carte Restaurants & Tables */}
        <div className="relative rounded-3xl overflow-hidden bg-slate-900 text-white p-6 sm:p-8 flex flex-col justify-between min-h-[220px] shadow-lg group">
          <div
            className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80')" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/30" />
          </div>
          <div className="relative z-10">
            <span className="px-2.5 py-1 rounded-lg bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-white">
              Gastronomie & Tables
            </span>
            <h3 className="text-xl font-black mt-2">Réservation de Tables & Menus</h3>
            <p className="text-xs text-zinc-300 mt-1 max-w-sm">
              Choisissez votre zone (Terrasse, VIP, Salle) et commandez vos repas en direct.
            </p>
          </div>
          <div className="relative z-10 pt-4 flex gap-2">
            <Link href="/restaurants/rest-terrou-bi/tables">
              <Button variant="primary" size="sm">
                Réserver une table
              </Button>
            </Link>
            <Link href="/restaurants/rest-dakar-grill/menu">
              <Button variant="glass" size="sm">
                Menu en ligne
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
