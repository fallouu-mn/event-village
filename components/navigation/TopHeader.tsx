'use client';

import React from 'react';
import { MapPin, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { NotificationBell } from '@/components/notifications/NotificationBell';

export interface TopHeaderProps {
  userName?: string;
  location?: string;
  avatarUrl?: string;
  showBack?: boolean;
  title?: string;
  onMoreClick?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  userName = 'Hello Pamaddog',
  location = 'Dakar, Sénégal',
  avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  showBack = false,
  title,
  onMoreClick,
}) => {
  return (
    <header className="w-full pt-4 pb-2 px-4 flex items-center justify-between z-20">
      {showBack ? (
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white active:scale-95 transition-transform"
          >
            ‹
          </Link>
          {title && <h1 className="text-lg font-bold text-white">{title}</h1>}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-white/40 shadow-sm">
            {/* Avatar */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={userName}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">{userName}</h2>
            <div className="flex items-center gap-1 text-[11px] text-white/70">
              <MapPin size={11} className="text-[#06B6D4]" />
              <span>{location}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action pill / 3 dots button as in mockup */}
      <div className="flex items-center gap-2">
        <NotificationBell />
        <button
          onClick={onMoreClick}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white hover:bg-white/30 active:scale-95 transition-all shadow-sm"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
    </header>
  );
};
