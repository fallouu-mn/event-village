'use client';

import React from 'react';
import Link from 'next/link';
import { Calendar, ChevronLeft, Plus } from 'lucide-react';
import { EventCalendar } from '@/components/events/EventCalendar';
import { Button } from '@/components/ui/Button';

export default function PartnerCalendarPage() {
  return (
    <div className="space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Calendar className="text-[#FF6B35]" size={28} />
            <span>Calendrier Événementiel Partenaire</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Visualisez et gérez le planning des concerts, galas et réservations de vos salles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/partner/dashboard">
            <Button variant="secondary" size="sm" leftIcon={<ChevronLeft size={16} />}>
              Dashboard
            </Button>
          </Link>
          <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
            Programmer un événement
          </Button>
        </div>
      </div>

      {/* Calendrier Complet */}
      <EventCalendar />
    </div>
  );
}
