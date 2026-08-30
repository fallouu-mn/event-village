'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Calendar, Plus, RefreshCw } from 'lucide-react';
import { EventCalendar, type CalendarEvent } from '@/components/events/EventCalendar';
import { Button } from '@/components/ui/Button';

export default function PartnerCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/partner/events')
      .then((res) => res.json())
      .then((data) => {
        if (data.events) {
          setEvents(
            data.events.map((e: any) => ({
              id: e.id,
              title: e.title,
              start_date: e.start_date,
              image_url: e.image_url,
              location: e.location,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Calendar className="text-[#FF5722]" size={28} />
            <span>Calendrier Événementiel</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Visualisez le planning de vos événements et réservations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/partner/events/new">
            <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
              Nouvel événement
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-[#FF5722]" />
        </div>
      ) : (
        <EventCalendar events={events} />
      )}
    </div>
  );
}
