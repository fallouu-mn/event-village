'use client';

import React, { useState, useMemo } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { clsx } from 'clsx';

export interface CalendarEvent {
  id: string;
  title: string;
  start_date: string;
  image_url?: string | null;
  location?: string;
}

interface EventCalendarProps {
  events: CalendarEvent[];
}

export const EventCalendar: React.FC<EventCalendarProps> = ({ events }) => {
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const startDayOffset = new Date(currentYear, currentMonth, 1).getDay();

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.start_date);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        const day = d.getDate();
        const existing = map.get(day) || [];
        existing.push(ev);
        map.set(day, existing);
      }
    }
    return map;
  }, [events, currentYear, currentMonth]);

  const selectedEvents = selectedDate ? (eventsByDay.get(selectedDate) || []) : [];

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2">
        <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white capitalize">
              {monthName}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={goToPrevMonth}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                &larr;
              </button>
              <button
                onClick={goToNextMonth}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
              >
                &rarr;
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-3">
            {daysOfWeek.map((day) => (
              <span key={day} className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-3 gap-x-1 text-center items-center">
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="h-10 w-10 mx-auto" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const hasEvents = eventsByDay.has(dayNum);
              const isSelected = selectedDate === dayNum;

              return (
                <div
                  key={`day-${dayNum}`}
                  onClick={() => setSelectedDate(dayNum)}
                  className="relative flex items-center justify-center h-10 w-10 mx-auto cursor-pointer select-none"
                >
                  <span
                    className={clsx(
                      'text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center transition-all relative',
                      isSelected
                        ? 'bg-[#FF5722] text-white shadow-xs'
                        : hasEvents
                        ? 'bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] font-black'
                        : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    {dayNum}
                  </span>
                  {hasEvents && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FF5722]" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
          {selectedDate
            ? `${selectedDate} ${new Date(currentYear, currentMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
            : 'Sélectionnez une date'}
        </h3>

        {selectedDate && selectedEvents.length > 0 ? (
          <div className="space-y-3">
            {selectedEvents.map((ev) => (
              <div key={ev.id} className="space-y-2">
                {ev.image_url && (
                  <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-100 dark:bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">{ev.title}</h4>
                  {ev.location && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{ev.location}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 dark:text-zinc-500">
            <CalendarIcon size={32} className="mx-auto opacity-50 mb-2" />
            <p className="text-xs font-bold">
              {selectedDate ? 'Aucun événement ce jour' : 'Cliquez sur une date'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
