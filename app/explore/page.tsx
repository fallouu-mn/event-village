'use client';

import React, { useState } from 'react';
import { Search, Filter, SlidersHorizontal, Calendar, MapPin, X, Sparkles } from 'lucide-react';
import { EventCard } from '@/components/events/EventCard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedCity, setSelectedCity] = useState<string>('ALL');
  const [priceMax, setPriceMax] = useState<number>(50000);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'RECENT' | 'PRICE_ASC' | 'PRICE_DESC'>('RECENT');

  const allEvents = [
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
      city: 'DAKAR',
      price: 15000,
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
      city: 'DAKAR',
      price: 25000,
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
      city: 'DAKAR',
      price: 5000,
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
      city: 'DAKAR',
      price: 50000,
      priceFormatted: '50 000 FCFA',
    },
    {
      id: 'evt-saint-louis-jazz',
      title: 'Festival International de Jazz de Saint-Louis',
      subtitle: 'Édition 2026',
      imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&auto=format&fit=crop&q=80',
      dateFormatted: '25 Déc 2026',
      dayNumber: '25',
      monthShort: 'DÉC',
      timeFormatted: '19:30',
      venue: 'Place Faidherbe, Saint-Louis',
      category: 'FESTIVAL',
      city: 'SAINT_LOUIS',
      price: 20000,
      priceFormatted: '20 000 FCFA',
    },
  ];

  // Filtrage
  let filtered = allEvents.filter((evt) => {
    const matchCategory = selectedCategory === 'ALL' || evt.category === selectedCategory;
    const matchCity = selectedCity === 'ALL' || evt.city === selectedCity;
    const matchPrice = evt.price <= priceMax;
    const matchSearch =
      searchQuery === '' ||
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.venue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.subtitle && evt.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchCategory && matchCity && matchPrice && matchSearch;
  });

  // Tri
  if (sortBy === 'PRICE_ASC') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'PRICE_DESC') {
    filtered.sort((a, b) => b.price - a.price);
  }

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('ALL');
    setSelectedCity('ALL');
    setPriceMax(50000);
    setSortBy('RECENT');
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header de la Page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Explorer les Événements & Lieux
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Trouvez les meilleures activités, concerts, festivals, restaurants et salles.
          </p>
        </div>

        {/* Barre de Recherche Rapide */}
        <div className="flex items-center gap-2 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher par titre, artiste, lieu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-9 pr-4 rounded-xl bg-white dark:bg-[#1E1E1E] border border-slate-200 dark:border-zinc-800 text-xs sm:text-sm focus:outline-none focus:border-[#FF5722] transition-colors"
            />
          </div>

          <Button
            variant="secondary"
            size="md"
            className="lg:hidden"
            onClick={() => setIsMobileFilterOpen(true)}
            leftIcon={<SlidersHorizontal size={16} />}
          >
            Filtres
          </Button>
        </div>
      </div>

      {/* 2. Layout Desktop avec Sidebar Filtres + Grille */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Sidebar Filtres Desktop */}
        <aside className="hidden lg:block bg-white dark:bg-[#1E1E1E] p-5 rounded-3xl border border-slate-200/80 dark:border-zinc-800 space-y-6 sticky top-20 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Filter size={16} className="text-[#FF5722]" />
              <span>Filtres</span>
            </h2>
            <button
              onClick={resetFilters}
              className="text-[11px] font-bold text-[#FF5722] hover:underline"
            >
              Réinitialiser
            </button>
          </div>

          {/* Catégories */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">
              Catégorie
            </label>
            <div className="space-y-1">
              {[
                { id: 'ALL', label: 'Toutes les catégories' },
                { id: 'CONCERT', label: 'Concerts & Musique' },
                { id: 'FESTIVAL', label: 'Festivals' },
                { id: 'FOOD', label: 'Gastronomie & Tables' },
                { id: 'SALLE', label: 'Salles & Réceptions' },
              ].map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    selectedCategory === c.id
                      ? 'bg-[#FF5722]/15 text-[#FF5722] font-black'
                      : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ville / Région */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">
              Lieu / Ville
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium focus:outline-none focus:border-[#FF5722]"
            >
              <option value="ALL">Tout le Sénégal</option>
              <option value="DAKAR">Dakar & Diamniadio</option>
              <option value="SAINT_LOUIS">Saint-Louis</option>
              <option value="SALY">Saly / Mbour</option>
            </select>
          </div>

          {/* Prix Maximum */}
          <div>
            <div className="flex justify-between items-center text-xs font-bold mb-2">
              <span className="text-slate-700 dark:text-zinc-300">Prix maximum</span>
              <span className="text-[#FF5722]">{priceMax.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <input
              type="range"
              min={5000}
              max={100000}
              step={5000}
              value={priceMax}
              onChange={(e) => setPriceMax(Number(e.target.value))}
              className="w-full accent-[#FF5722]"
            />
          </div>

          {/* Tri */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">
              Trier par
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs font-medium focus:outline-none focus:border-[#FF5722]"
            >
              <option value="RECENT">Plus récents</option>
              <option value="PRICE_ASC">Prix croissant</option>
              <option value="PRICE_DESC">Prix décroissant</option>
            </select>
          </div>
        </aside>

        {/* Grille Principale des Résultats */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <span>
              Affichage de <strong className="text-slate-900 dark:text-white">{filtered.length}</strong> résultat(s)
            </span>
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((evt) => (
                <EventCard key={evt.id} {...evt} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Aucun événement correspondant"
              description="Aucun événement ne correspond à vos critères de recherche actuels."
              actionLabel="Réinitialiser les filtres"
              onAction={resetFilters}
            />
          )}
        </div>
      </div>

      {/* 3. Modal / Drawer Filtres Mobile */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end justify-center lg:hidden">
          <div className="bg-white dark:bg-[#1E1E1E] w-full max-h-[85vh] rounded-t-3xl p-6 overflow-y-auto space-y-5 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Filtres de recherche</h3>
              <button
                onClick={() => setIsMobileFilterOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500"
              >
                <X size={18} />
              </button>
            </div>

            {/* Catégories Mobile */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">Catégorie</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'ALL', label: 'Toutes' },
                  { id: 'CONCERT', label: 'Concerts' },
                  { id: 'FESTIVAL', label: 'Festivals' },
                  { id: 'FOOD', label: 'Gastronomie' },
                  { id: 'SALLE', label: 'Salles' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedCategory === c.id
                        ? 'bg-[#FF5722] text-white border-[#FF5722]'
                        : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prix Max */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold mb-2">
                <span className="text-slate-700 dark:text-zinc-300">Prix maximum</span>
                <span className="text-[#FF5722]">{priceMax.toLocaleString('fr-FR')} FCFA</span>
              </div>
              <input
                type="range"
                min={5000}
                max={100000}
                step={5000}
                value={priceMax}
                onChange={(e) => setPriceMax(Number(e.target.value))}
                className="w-full accent-[#FF5722]"
              />
            </div>

            <div className="flex gap-3 pt-3">
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  resetFilters();
                  setIsMobileFilterOpen(false);
                }}
              >
                Effacer
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={() => setIsMobileFilterOpen(false)}
              >
                Appliquer ({filtered.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
