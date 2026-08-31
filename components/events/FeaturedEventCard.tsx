'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export interface FeaturedEventCardProps {
  id: string;
  title: string;
  artistName: string;
  artistAvatarUrl?: string;
  location: string;
  dateDay: string; // e.g. "19"
  dateMonth: string; // e.g. "Dec"
  priceFormatted: string; // e.g. "$45.90" ou "25 000 FCFA"
  imageUrl: string;
}

export const FeaturedEventCard: React.FC<FeaturedEventCardProps> = ({
  id,
  title,
  artistName,
  artistAvatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  location,
  dateDay,
  dateMonth,
  priceFormatted,
  imageUrl,
}) => {
  return (
    <Link
      href={`/events/${id}`}
      className="group block relative w-full rounded-3xl overflow-hidden glass-card p-2.5 transition-all duration-300 active:scale-[0.99]"
    >
      {/* Container Image */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-slate-950">
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, 50vw"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/20" />

        {/* Floating Circular Date Badge (Top Right) */}
        <div className="absolute top-3 right-3 w-12 h-12 rounded-full bg-white text-slate-900 flex flex-col items-center justify-center font-bold shadow-xl backdrop-blur-md">
          <span className="text-sm font-black leading-none">{dateDay}</span>
          <span className="text-[10px] text-slate-600 font-bold uppercase leading-tight">{dateMonth}</span>
        </div>

        {/* Floating Capsule Info Bar (Bottom inside image as in reference mockup) */}
        <div className="absolute bottom-3 inset-x-3 p-2 px-3 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 flex items-center justify-between shadow-2xl">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-white/50 flex-shrink-0 relative">
              <Image
                src={artistAvatarUrl}
                alt={artistName}
                fill
                className="object-cover"
                sizes="32px"
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-white leading-tight truncate">{title}</h3>
              <p className="text-[10px] text-white/70 leading-tight truncate">{location}</p>
            </div>
          </div>

          {/* Price Pill Capsule */}
          <div className="px-3.5 py-1.5 rounded-full bg-white text-slate-950 font-black text-xs shadow-lg flex-shrink-0">
            {priceFormatted}
          </div>
        </div>
      </div>
    </Link>
  );
};
