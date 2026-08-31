'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, Heart, ArrowRight } from 'lucide-react';
import { StatusBadge } from '@/components/ui/Badge';

export interface EventCardProps {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  dateFormatted: string;
  dayNumber?: string;
  monthShort?: string;
  timeFormatted: string;
  venue: string;
  category: string;
  priceFormatted: string;
  status?: string;
  attendeesCount?: number;
}

export const EventCard: React.FC<EventCardProps> = ({
  id,
  title,
  subtitle,
  imageUrl,
  dateFormatted,
  dayNumber = '19',
  monthShort = 'DÉC',
  timeFormatted,
  venue,
  category,
  priceFormatted,
  status = 'PUBLIE',
}) => {
  const [isLiked, setIsLiked] = useState(false);

  return (
    <div className="group relative bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800/80 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:border-[#FF5722]/40 transition-all duration-300 flex flex-col">
      {/* 1. Zone Image Hero */}
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-slate-950">
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

        {/* Badge Catégorie Haut Gauche */}
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/90 dark:bg-zinc-900/90 text-slate-900 dark:text-white backdrop-blur-md shadow-sm">
            {category}
          </span>
        </div>

        {/* Bouton Favori Haut Droite */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsLiked(!isLiked);
          }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/60 transition-all active:scale-90"
          aria-label="Ajouter aux favoris"
        >
          <Heart
            size={16}
            className={isLiked ? 'fill-red-500 text-red-500' : 'text-white'}
          />
        </button>

        {/* Badge Date Circulaire Incrusté Bas Gauche */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/50 backdrop-blur-md text-white border border-white/20">
          <span className="text-sm font-black text-[#FF5722] leading-none">{dayNumber}</span>
          <span className="text-[10px] font-bold tracking-wider uppercase leading-none">{monthShort}</span>
        </div>
      </div>

      {/* 2. Corps de la Carte */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[11px] font-bold text-[#FF5722] uppercase tracking-wider">
              {subtitle || category}
            </span>
            {status !== 'PUBLIE' && <StatusBadge status={status} />}
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-snug line-clamp-1 group-hover:text-[#FF5722] transition-colors">
            {title}
          </h3>

          <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-zinc-400">
            <div className="flex items-center gap-1.5 truncate">
              <MapPin size={13} className="text-[#FF5722] flex-shrink-0" />
              <span className="truncate">{venue}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={13} className="text-slate-400 dark:text-zinc-500 flex-shrink-0" />
              <span>{dateFormatted} à {timeFormatted}</span>
            </div>
          </div>
        </div>

        {/* 3. Pied de Carte : Prix & Bouton Réserver */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block">
              À partir de
            </span>
            <span className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
              {priceFormatted}
            </span>
          </div>

          <Link
            href={`/events/${id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] hover:from-[#FF5722] hover:to-[#F02D58] text-white text-xs font-bold shadow-sm shadow-[#FF5722]/30 active:scale-95 transition-all"
          >
            <span>Réserver</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
};
