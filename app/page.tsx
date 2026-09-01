'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles, Compass, Building2, Utensils, ArrowRight,
  Music, Flame, Calendar, Search, Ticket, Users,
  MapPin, ChevronRight, Phone, Mail, Heart,
  Handshake, TrendingUp, CheckCircle2,
  HelpCircle, X,
} from 'lucide-react';
import { EventCard } from '@/components/events/EventCard';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

const CATEGORIES = [
  { id: 'ALL',     label: 'Tous',              icon: Sparkles,  color: 'from-[#FF6A3D] to-[#FF3D68]' },
  { id: 'CONCERT', label: 'Concerts & Live',   icon: Music,     color: 'from-violet-500 to-purple-700' },
  { id: 'FESTIVAL',label: 'Festivals',          icon: Flame,     color: 'from-amber-500 to-orange-600' },
  { id: 'FOOD',    label: 'Gastronomie',        icon: Utensils,  color: 'from-emerald-500 to-teal-600' },
  { id: 'SALLE',   label: 'Salles & Fêtes',    icon: Building2, color: 'from-sky-500 to-blue-600' },
];

const STEPS = [
  { num: 1, title: 'Choisis ton événement',      desc: 'Parcours les soirées, concerts et festivals et ouvre celui qui te plaît.' },
  { num: 2, title: 'Clique sur « Acheter »',     desc: 'Sélectionne ton billet et la quantité. Pas besoin de compte.' },
  { num: 3, title: 'Ton email puis le paiement', desc: 'Wave ou Orange Money. Garde ton email : c\'est ta clé.' },
  { num: 4, title: 'Reçois ton billet (QR)',      desc: 'Il s\'affiche après le paiement et arrive par email en PDF.' },
  { num: 5, title: 'Retrouve-le le Jour J',       desc: 'Dans ton email, ou sur « Mes billets » si tu crées un compte.' },
];

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery]           = useState('');
  const [events, setEvents]                     = useState<any[]>([]);
  const [isLoading, setIsLoading]               = useState(true);
  const [showHowTo, setShowHowTo]               = useState(false);

  useEffect(() => {
    async function loadEvents() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/events');
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (err) {
        console.error('[HomePage]', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadEvents();
  }, []);

  useEffect(() => {
    if (showHowTo) {
      const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowHowTo(false); };
      document.addEventListener('keydown', onEsc);
      return () => document.removeEventListener('keydown', onEsc);
    }
  }, [showHowTo]);

  const filteredEvents = events.filter((evt) => {
    const matchCategory = selectedCategory === 'ALL' || evt.category === selectedCategory;
    const matchSearch   =
      searchQuery === '' ||
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.subtitle && evt.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  return (
    <>
    <div className="space-y-16 sm:space-y-20 pb-24">

      {/* ================================================================
          1. HERO CINÉMATIQUE
          ================================================================ */}
      <section className="relative rounded-3xl overflow-hidden text-white" style={{ minHeight: 480 }}>

        <div
          className="absolute inset-0 bg-cover bg-center ev-hero-zoom"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1600&auto=format&fit=crop&q=80')" }}
        />

        <div className="absolute inset-0 bg-gradient-to-br from-black/95 via-black/70 to-[#FF5722]/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        <div className="absolute top-1/4 right-[15%] w-80 h-80 rounded-full bg-[#FF5722]/10 blur-3xl ev-float pointer-events-none" />
        <div className="absolute bottom-1/4 right-[35%] w-52 h-52 rounded-full bg-[#FF3D68]/08 blur-2xl ev-float-alt pointer-events-none" />

        <div
          className="relative z-10 flex flex-col justify-between p-5 sm:p-10 lg:p-14"
          style={{ minHeight: 480 }}
        >
          <div className="max-w-2xl space-y-5">

            <div
              className="ev-fade-up inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#FF5722]/40 bg-[#FF5722]/12 text-[#FF8A65] text-xs font-bold backdrop-blur-sm"
              style={{ animationDelay: '0ms' }}
            >
              <span className="ev-pulse-dot w-2 h-2 rounded-full bg-[#FF5722] inline-block" />
              La Référence Événementielle au Sénégal
            </div>

            <div>
              <h1
                className="ev-fade-up text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08]"
                style={{ animationDelay: '100ms' }}
              >
                Découvrez, réservez
              </h1>
              <h1
                className="ev-fade-up text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] mt-1"
                style={{ animationDelay: '200ms' }}
              >
                et vivez des{' '}
                <span className="ev-gradient-text">expériences uniques</span>.
              </h1>
            </div>

            <p
              className="ev-fade-up text-sm sm:text-base text-zinc-300 max-w-lg leading-relaxed"
              style={{ animationDelay: '300ms' }}
            >
              Billetterie officielle de concerts, réservation de tables de prestige,
              location de salles et commandes traiteur.
            </p>

            <div
              className="ev-fade-up flex flex-col sm:flex-row gap-3"
              style={{ animationDelay: '420ms' }}
            >
              <div className="relative flex-1 group">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#FF5722] transition-colors duration-200"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Artiste, salle, quartier..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-[52px] pl-11 pr-4 rounded-2xl bg-white/8 border border-white/12 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-[#FF5722]/60 focus:bg-white/12 backdrop-blur-md transition-all duration-300"
                />
              </div>
              <Link href="/explore">
                <Button
                  variant="primary"
                  size="md"
                  className="h-[52px] w-full sm:w-auto px-8 font-black rounded-2xl shadow-xl shadow-[#FF5722]/40 hover:shadow-[#FF5722]/60 transition-shadow"
                  leftIcon={<Compass size={18} />}
                >
                  Explorer
                </Button>
              </Link>
            </div>
          </div>

          <div
            className="ev-fade-up flex flex-wrap items-center gap-4 sm:gap-10 pt-8 mt-auto"
            style={{ animationDelay: '580ms' }}
          >
            {[
              { icon: Ticket,     label: 'Billetterie',     sub: '100% sécurisée',    color: 'text-[#FF8A65]' },
              { icon: MapPin,     label: 'Dakar & Régions', sub: 'Présence nationale', color: 'text-[#FF8A65]' },
              { icon: Users,      label: 'Wave & Orange',   sub: 'Paiement mobile',   color: 'text-[#FF8A65]' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                {i > 0 && <div className="hidden sm:block h-8 w-px bg-white/10 -ml-3 mr-3" />}
                <div className="w-8 h-8 rounded-xl bg-white/8 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <item.icon size={15} className={item.color} />
                </div>
                <div>
                  <p className="text-sm font-black text-white leading-none">{item.label}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          2. CATÉGORIES
          ================================================================ */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Catégories
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">
              Filtrez par type d&apos;expérience
            </p>
          </div>
          <Link
            href="/explore"
            className="flex items-center gap-1 text-xs font-bold text-[#FF5722] hover:opacity-75 transition-opacity"
          >
            Tout voir <ArrowRight size={13} />
          </Link>
        </div>

        <div className="relative">
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {CATEGORIES.map((cat, i) => {
              const active = selectedCategory === cat.id;
              const Icon   = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{ animationDelay: `${i * 55}ms` }}
                  className={`ev-fade-up flex-shrink-0 flex flex-col items-center gap-2.5 p-4 rounded-3xl border transition-all duration-300 w-[104px] sm:w-[116px] ${
                    active
                      ? 'bg-gradient-to-br from-[#FF6A3D] to-[#FF3D68] border-transparent text-white shadow-xl shadow-[#FF5722]/35 scale-[1.04]'
                      : 'bg-white dark:bg-[#1E1E1E] border-slate-200/80 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-[#FF5722]/30 hover:shadow-md hover:-translate-y-1'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    active
                      ? 'bg-white/20'
                      : `bg-gradient-to-br ${cat.color}`
                  }`}>
                    <Icon size={19} className="text-white" />
                  </div>
                  <span className="text-[11px] font-bold text-center leading-tight">
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-[#F8F9FA] dark:from-[#0F0F11] to-transparent pointer-events-none sm:hidden" />
        </div>
      </section>

      {/* ================================================================
          3. ÉVÉNEMENTS À L'AFFICHE
          ================================================================ */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              À l&apos;affiche
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">
              {filteredEvents.length} événement{filteredEvents.length !== 1 ? 's' : ''} disponible{filteredEvents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link href="/explore" className="flex items-center gap-1 text-xs font-bold text-[#FF5722] hover:opacity-75 transition-opacity">
            Calendrier <ChevronRight size={13} />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-3 p-4 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800">
                <Skeleton className="w-full aspect-[16/10] rounded-2xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredEvents.map((evt, i) => (
              <div
                key={evt.id}
                className="ev-fade-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <EventCard {...evt} />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 bg-white dark:bg-[#1A1A1A] rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800 flex flex-col items-center justify-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FF6A3D]/10 to-[#FF3D68]/10 flex items-center justify-center">
              <Calendar size={28} className="text-[#FF5722]" />
            </div>
            <div className="text-center px-6">
              <p className="text-base font-black text-slate-900 dark:text-white">
                Bientôt disponible
              </p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed max-w-sm">
                De nouveaux événements arrivent très prochainement. Explorez nos salles et restaurants en attendant.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/explore">
                <Button variant="primary" size="sm" leftIcon={<Compass size={14} />}>
                  Explorer
                </Button>
              </Link>
              <Link href="/halls">
                <Button variant="outline" size="sm" leftIcon={<Building2 size={14} />}>
                  Voir les salles
                </Button>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ================================================================
          4. ESPACES : SALLES & GASTRONOMIE
          ================================================================ */}
      <section className="space-y-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Nos Espaces
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">
            Salles de fête, restaurants & gastronomie
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          <Link href="/halls" className="group block">
            <div
              className="relative rounded-3xl overflow-hidden text-white shadow-2xl"
              style={{ minHeight: 280 }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=900&auto=format&fit=crop&q=80')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/96 via-black/50 to-black/10" />

              <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
                <span className="inline-flex items-center self-start px-2.5 py-1 rounded-lg bg-white/12 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider">
                  <Building2 size={10} className="mr-1.5 text-[#FF8A65]" />
                  Espaces & Réceptions
                </span>

                <div className="space-y-3">
                  <h3 className="text-2xl sm:text-3xl font-black leading-tight">
                    Location de Salles<br />de Fête
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                    Mariages, séminaires, galas — réservez avec acompte de 30% et moratoire de 48h.
                  </p>
                  <div className="ev-service-card-cta inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF5722] text-white text-xs font-bold group-hover:bg-[#FF6A3D] transition-colors">
                    Voir le catalogue des salles
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/explore" className="group block">
            <div
              className="relative rounded-3xl overflow-hidden text-white shadow-2xl"
              style={{ minHeight: 280 }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out group-hover:scale-105"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&auto=format&fit=crop&q=80')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/96 via-black/50 to-black/10" />

              <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
                <span className="inline-flex items-center self-start px-2.5 py-1 rounded-lg bg-white/12 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider">
                  <Utensils size={10} className="mr-1.5 text-emerald-400" />
                  Gastronomie & Tables
                </span>

                <div className="space-y-3">
                  <h3 className="text-2xl sm:text-3xl font-black leading-tight">
                    Réservation de<br />Tables & Menus
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                    Terrasse, VIP, Salle — choisissez votre zone et commandez en direct.
                  </p>
                  <div className="ev-service-card-cta inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold group-hover:bg-emerald-500 transition-colors">
                    Découvrir les offres
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            </div>
          </Link>

        </div>
      </section>

      {/* ================================================================
          5. CTA PARTENAIRE
          ================================================================ */}
      <section className="relative rounded-3xl overflow-hidden bg-white dark:bg-[#1A1A1A] border border-slate-200/80 dark:border-zinc-800">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#FF5722]/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full bg-[#FF3D68]/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8 p-6 sm:p-10 lg:p-12">
          <div className="flex-1 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF5722]/10 text-[#FF5722] text-xs font-bold">
              <Handshake size={14} />
              Espace Partenaire
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              Vous organisez des événements ?<br />
              <span className="ev-gradient-text">Rejoignez Event Village.</span>
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed max-w-lg">
              Vendez vos billets, gérez vos réservations de tables et louez vos salles
              depuis un tableau de bord professionnel. Commission transparente, paiements
              Wave & Orange Money, analytics en temps réel.
            </p>
            <ul className="space-y-2.5 pt-2">
              {[
                'Tableau de bord complet avec statistiques',
                'Billetterie avec QR code intégré',
                'Gestion des réservations de tables',
                'Paiements sécurisés Wave & Orange Money',
              ].map((feature, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-zinc-300">
                  <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 w-full lg:w-auto">
            <Link href="/register?role=partner">
              <Button
                variant="primary"
                size="md"
                className="w-full lg:w-auto h-[52px] px-10 font-black rounded-2xl shadow-xl shadow-[#FF5722]/30"
                leftIcon={<TrendingUp size={18} />}
              >
                Devenir Partenaire
              </Button>
            </Link>
            <p className="text-[10px] text-slate-400 dark:text-zinc-600 text-center lg:text-left">
              Inscription gratuite — aucun frais fixe
            </p>
          </div>
        </div>
      </section>

      {/* ================================================================
          7. FOOTER
          ================================================================ */}
      <footer className="border-t border-slate-200 dark:border-zinc-800 pt-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-6">

          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF6A3D] to-[#FF3D68] flex items-center justify-center">
                <Heart size={14} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white leading-none">EVENT VILLAGE</p>
                <p className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 tracking-wider uppercase mt-0.5">Plateforme Événementielle</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">
              La référence événementielle au Sénégal. Billetterie, salles, restaurants.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Plateforme
            </h4>
            <ul className="space-y-2">
              {[
                { label: 'Explorer', href: '/explore' },
                { label: 'Salles de fête', href: '/halls' },
                { label: 'Restaurants', href: '/restaurants' },
                { label: 'Mes billets', href: '/tickets' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-xs text-slate-500 dark:text-zinc-500 hover:text-[#FF5722] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Partenaires
            </h4>
            <ul className="space-y-2">
              {[
                { label: 'Devenir partenaire', href: '/register?role=partner' },
                { label: 'Espace partenaire', href: '/partner/dashboard' },
                { label: 'Tarifs & commission', href: '/partner/dashboard' },
              ].map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-xs text-slate-500 dark:text-zinc-500 hover:text-[#FF5722] transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              Contact
            </h4>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                <Phone size={12} className="text-[#FF5722] flex-shrink-0" />
                +221 78 XXX XX XX
              </li>
              <li className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                <Mail size={12} className="text-[#FF5722] flex-shrink-0" />
                contact@eventvillage.sn
              </li>
              <li className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                <MapPin size={12} className="text-[#FF5722] flex-shrink-0" />
                Dakar, Sénégal
              </li>
            </ul>
          </div>

        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-10 pt-6 border-t border-slate-200/60 dark:border-zinc-800/60 pb-20 sm:pb-4">
          <p className="text-[11px] text-slate-400 dark:text-zinc-600">
            &copy; {new Date().getFullYear()} Event Village. Tous droits réservés.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/legal" className="text-[11px] text-slate-400 dark:text-zinc-600 hover:text-[#FF5722] transition-colors">
              Mentions légales
            </Link>
            <Link href="/privacy" className="text-[11px] text-slate-400 dark:text-zinc-600 hover:text-[#FF5722] transition-colors">
              Confidentialité
            </Link>
            <Link href="/cgv" className="text-[11px] text-slate-400 dark:text-zinc-600 hover:text-[#FF5722] transition-colors">
              CGV
            </Link>
          </div>
        </div>
      </footer>

    </div>

    {/* ==================================================================
        FLOATING — Bouton + Popover "Comment ça marche ?" (style paskclab)
        ================================================================== */}
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-40 flex flex-col items-end gap-3">

      {showHowTo && (
        <div className="w-[340px] sm:w-[380px] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl shadow-black/20 border border-slate-200/80 dark:border-zinc-700/60 overflow-hidden animate-[slideUp_0.25s_ease-out]">

          <div className="flex items-start justify-between px-5 pt-5 pb-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">En 5 étapes</p>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">Obtenir ton billet</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowHowTo(false)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors mt-1"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-5 pb-3 space-y-4">
            {STEPS.map((step) => (
              <div key={step.num} className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-black text-white">{step.num}</span>
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-[13px] font-extrabold text-slate-900 dark:text-white leading-snug">{step.title}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 pb-5 pt-2">
            <Link href="/explore" onClick={() => setShowHowTo(false)}>
              <button
                type="button"
                className="w-full h-[46px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold hover:bg-slate-800 dark:hover:bg-zinc-100 transition-colors"
              >
                Voir les événements &rarr;
              </button>
            </Link>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowHowTo(!showHowTo)}
        className="flex items-center gap-2 pl-2.5 pr-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-700/60 shadow-lg shadow-black/10 text-[13px] font-semibold text-slate-700 dark:text-zinc-200 hover:shadow-xl active:scale-95 transition-all duration-200"
      >
        <span className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center flex-shrink-0">
          <HelpCircle size={15} className="text-white" />
        </span>
        {showHowTo ? 'Fermer' : 'Comment ça marche ?'}
      </button>
    </div>
    </>
  );
}
