'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, MapPin, Users, Building2, Check, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

export interface HallItem {
  id: string;
  name: string;
  partnerName: string;
  location: string;
  capacityMin: number;
  capacityMax: number;
  areaSqm: number;
  pricePerDay: number;
  priceFormatted: string;
  imageUrl: string;
  amenities: string[];
  isAvailable: boolean;
}

const SAMPLE_HALLS: HallItem[] = [
  {
    id: 'hall-dakar-arena-vip',
    name: 'Grand Salon Prestige Dakar Arena',
    partnerName: 'Dakar Arena Diamniadio',
    location: 'Diamniadio, Dakar',
    capacityMin: 200,
    capacityMax: 800,
    areaSqm: 1200,
    pricePerDay: 750000,
    priceFormatted: '750 000 FCFA / jour',
    imageUrl: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&auto=format&fit=crop&q=80',
    amenities: ['Climatisation', 'Vidéoprojecteur 4K', 'Sonorisation Pro', 'Parking 200 places', 'Loge VIP'],
    isAvailable: true,
  },
  {
    id: 'hall-terrou-bi-ocean',
    name: 'Salle Océane Terrou-Bi',
    partnerName: 'Hôtel Terrou-Bi Dakar',
    location: 'Boulevard Martin Luther King, Dakar',
    capacityMin: 80,
    capacityMax: 350,
    areaSqm: 500,
    pricePerDay: 500000,
    priceFormatted: '500 000 FCFA / jour',
    imageUrl: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&auto=format&fit=crop&q=80',
    amenities: ['Vue Mer Panoramique', 'Traiteur Intégré', 'Terrasse Privée', 'Climatisation'],
    isAvailable: true,
  },
  {
    id: 'hall-radisson-almadies',
    name: 'Espace Événementiel Les Almadies',
    partnerName: 'Radisson Blu Resort',
    location: 'Les Almadies, Dakar',
    capacityMin: 50,
    capacityMax: 200,
    areaSqm: 320,
    pricePerDay: 350000,
    priceFormatted: '350 000 FCFA / jour',
    imageUrl: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&auto=format&fit=crop&q=80',
    amenities: ['Éclairage Scénique', 'Wifi Haut Débit', 'Service Voiturier'],
    isAvailable: true,
  },
  {
    id: 'hall-saly-palm-beach',
    name: 'Palais des Congrès Saly',
    partnerName: 'Palm Beach Resort',
    location: 'Saly Portudal, Mbour',
    capacityMin: 150,
    capacityMax: 600,
    areaSqm: 850,
    pricePerDay: 600000,
    priceFormatted: '600 000 FCFA / jour',
    imageUrl: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&auto=format&fit=crop&q=80',
    amenities: ['Plage Privée', 'Sonorisation', 'Piscine Extérieure', 'Hébergement Partenaire'],
    isAvailable: true,
  },
];

export default function HallsCataloguePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('Toutes');
  const [selectedCapacity, setSelectedCapacity] = useState('Toutes');

  const locations = ['Toutes', 'Diamniadio', 'Dakar Centre', 'Les Almadies', 'Saly'];
  const capacityFilters = ['Toutes', '< 200 pers', '200 - 500 pers', '500+ pers'];

  const filteredHalls = SAMPLE_HALLS.filter((hall) => {
    const matchesSearch =
      hall.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hall.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hall.partnerName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLocation =
      selectedLocation === 'Toutes' || hall.location.toLowerCase().includes(selectedLocation.toLowerCase());

    let matchesCapacity = true;
    if (selectedCapacity === '< 200 pers') {
      matchesCapacity = hall.capacityMax <= 250;
    } else if (selectedCapacity === '200 - 500 pers') {
      matchesCapacity = hall.capacityMax > 200 && hall.capacityMax <= 500;
    } else if (selectedCapacity === '500+ pers') {
      matchesCapacity = hall.capacityMax > 500;
    }

    return matchesSearch && matchesLocation && matchesCapacity;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Building2 className="text-[#FF5722]" size={28} />
            <span>Catalogue de Salles & Réceptions</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Réservez les plus beaux espaces pour vos mariages, conférences, séminaires et galas.
          </p>
        </div>
      </div>

      {/* 2. Filtres & Recherche */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 space-y-4 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher une salle par nom, hôtel, quartier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-9 pr-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs sm:text-sm focus:outline-none focus:border-[#FF5722]"
          />
        </div>

        {/* Boutons Filtres */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 mr-1">Lieu :</span>
            {locations.map((loc) => (
              <button
                key={loc}
                onClick={() => setSelectedLocation(loc)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedLocation === loc
                    ? 'bg-[#FF5722] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 mr-1">Capacité :</span>
            {capacityFilters.map((cap) => (
              <button
                key={cap}
                onClick={() => setSelectedCapacity(cap)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedCapacity === cap
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200'
                }`}
              >
                {cap}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Grille des Salles */}
      {filteredHalls.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredHalls.map((hall) => (
            <div
              key={hall.id}
              className="group rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 overflow-hidden shadow-xs hover:shadow-xl hover:border-[#FF5722]/40 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Hero Image */}
                <div className="relative w-full aspect-[16/9] overflow-hidden bg-slate-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={hall.imageUrl}
                    alt={hall.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                  <div className="absolute top-3 right-3">
                    <Badge variant="success" size="sm">Disponible</Badge>
                  </div>

                  <div className="absolute bottom-3 left-4 right-4 text-white">
                    <span className="text-[10px] uppercase font-bold text-[#FF5722] tracking-wider block">
                      {hall.partnerName}
                    </span>
                    <h3 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                      {hall.name}
                    </h3>
                  </div>
                </div>

                {/* Détails */}
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={14} className="text-[#FF5722]" />
                      <span>{hall.location}</span>
                    </span>
                    <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-zinc-300">
                      <Users size={14} className="text-slate-400" />
                      <span>{hall.capacityMin} à {hall.capacityMax} pers. ({hall.areaSqm} m²)</span>
                    </span>
                  </div>

                  {/* Équipements */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {hall.amenities.map((amenity, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-medium flex items-center gap-1"
                      >
                        <Check size={11} className="text-emerald-500" />
                        <span>{amenity}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pied de Carte */}
              <div className="p-5 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
                    Tarif journalier
                  </span>
                  <span className="text-base sm:text-lg font-black text-[#FF5722]">
                    {hall.priceFormatted}
                  </span>
                </div>

                <Link href={`/halls/${hall.id}`}>
                  <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                    Réserver
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Aucune salle trouvée"
          description="Essayez de modifier votre recherche ou vos critères de capacité."
          actionLabel="Réinitialiser"
          onAction={() => {
            setSearchQuery('');
            setSelectedLocation('Toutes');
            setSelectedCapacity('Toutes');
          }}
        />
      )}
    </div>
  );
}
