'use client';

import React, { useState } from 'react';
import { Map, Calendar as CalendarIcon, PlusSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';

export interface CalendarEventDay {
  date: number;
  month: number; // 11 for Dec, 0 for Jan
  year: number;
  eventTitle: string;
  eventThumbnail: string;
  eventId: string;
  venue: string;
}

const SAMPLE_EVENTS: CalendarEventDay[] = [
  { date: 12, month: 11, year: 2026, eventTitle: 'Concert Acoustique', eventThumbnail: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=100&auto=format&fit=crop&q=80', eventId: '1', venue: 'Dakar' },
  { date: 15, month: 11, year: 2026, eventTitle: 'Exposition Art', eventThumbnail: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=100&auto=format&fit=crop&q=80', eventId: '2', venue: 'Almadies' },
  { date: 19, month: 11, year: 2026, eventTitle: 'Post Malone Live', eventThumbnail: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=100&auto=format&fit=crop&q=80', eventId: '4', venue: 'Monument Renaissance' },
  { date: 21, month: 11, year: 2026, eventTitle: 'Festival Dakar Vibes', eventThumbnail: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&auto=format&fit=crop&q=80', eventId: '6', venue: 'Dakar Arena' },
  { date: 25, month: 11, year: 2026, eventTitle: 'Gala de Noël', eventThumbnail: 'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=100&auto=format&fit=crop&q=80', eventId: '7', venue: 'Terrou-Bi' },
  { date: 31, month: 11, year: 2026, eventTitle: 'Réveillon Nouvel An', eventThumbnail: 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=100&auto=format&fit=crop&q=80', eventId: '9', venue: 'King Fahd' },
];

export const EventCalendar: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<number>(19);
  const [activeMonthIndex, setActiveMonthIndex] = useState<number>(11); // 11 = Décembre
  const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const activeEvent = SAMPLE_EVENTS.find((e) => e.date === selectedDate && e.month === activeMonthIndex);

  const renderMonthGrid = (monthName: string, monthIndex: number, year: number, totalDays: number, startDayOffset: number) => {
    return (
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-black text-slate-900 dark:text-white">
            {monthName} {year}
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveMonthIndex(11)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                activeMonthIndex === 11
                  ? 'bg-[#FF6B35] text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
              }`}
            >
              Déc
            </button>
            <button
              onClick={() => setActiveMonthIndex(0)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                activeMonthIndex === 0
                  ? 'bg-[#FF6B35] text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'
              }`}
            >
              Jan
            </button>
          </div>
        </div>

        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 gap-1 text-center mb-3">
          {daysOfWeek.map((day) => (
            <span key={day} className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase">
              {day}
            </span>
          ))}
        </div>

        {/* Grille des dates */}
        <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center items-center">
          {Array.from({ length: startDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10 w-10 mx-auto" />
          ))}

          {Array.from({ length: totalDays }).map((_, i) => {
            const dayNum = i + 1;
            const eventOnDay = SAMPLE_EVENTS.find(
              (e) => e.date === dayNum && e.month === monthIndex
            );
            const isSelected = selectedDate === dayNum && activeMonthIndex === monthIndex;

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => {
                  setSelectedDate(dayNum);
                  setActiveMonthIndex(monthIndex);
                }}
                className="relative flex items-center justify-center h-10 w-10 mx-auto cursor-pointer select-none"
              >
                {eventOnDay ? (
                  <div className={`relative w-9 h-9 rounded-full overflow-hidden border-2 shadow-md hover:scale-110 transition-transform ${
                    isSelected ? 'border-[#FF6B35] ring-2 ring-[#FF6B35]/40' : 'border-white/60 dark:border-zinc-700'
                  }`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={eventOnDay.eventThumbnail}
                      alt={eventOnDay.eventTitle}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <span className="text-[10px] font-black text-white drop-shadow">
                        {dayNum}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span
                    className={clsx(
                      'text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center transition-all',
                      isSelected
                        ? 'bg-[#FF6B35] text-white shadow-xs'
                        : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    {dayNum}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Colonne Gauche : Calendrier du Mois */}
      <div className="lg:col-span-2 space-y-6">
        {activeMonthIndex === 11
          ? renderMonthGrid('Décembre', 11, 2026, 31, 2)
          : renderMonthGrid('Janvier', 0, 2027, 31, 5)}
      </div>

      {/* Colonne Droite : Fiche Événement sur la Date Sélectionnée */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
          Événements le {selectedDate} {activeMonthIndex === 11 ? 'Décembre 2026' : 'Janvier 2027'}
        </h3>

        {activeEvent ? (
          <div className="space-y-3">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activeEvent.eventThumbnail} alt={activeEvent.eventTitle} className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#FF6B35] uppercase tracking-wider block">Concert Live</span>
              <h4 className="text-base font-black text-slate-900 dark:text-white">{activeEvent.eventTitle}</h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{activeEvent.venue}</p>
            </div>
            <Link href="/partner/scan">
              <Button variant="primary" size="sm" fullWidth>
                Gérer les accès de la date
              </Button>
            </Link>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 dark:text-zinc-500">
            <CalendarIcon size={32} className="mx-auto opacity-50 mb-2" />
            <p className="text-xs font-bold">Aucun événement programmé</p>
            <p className="text-[11px] mt-1">Vous pouvez ajouter un événement sur cette date.</p>
          </div>
        )}
      </div>
    </div>
  );
};
