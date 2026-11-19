'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/components/ui/cn';
import { formatEventDateTime } from '@/lib/format';

/**
 * Calendrier de l'organisatrice (design 1c) : chaque événement à sa date de début.
 *  - Jetons de la charte seulement (aucune couleur en dur) ; clair et sombre par les jetons.
 *  - À partir de sm : grille du mois (lundi en premier), un bouton de 56 px de haut par jour, nom complet lu par les
 *    lecteurs d'écran (« jeudi 12 novembre 2026, 2 événements ») ; un jour avec événements a un bord, un fond doux ET le
 *    nombre d'événements écrit (la couleur ne porte jamais seule l'information).
 *  - Sous sm (320 à 639 px) : pas de grille (sept colonnes de 44 px ne tiennent pas à 320 px), la liste des événements
 *    du mois, jour par jour.
 *  - La liste (à côté de la grille sur ordinateur, dessous ailleurs) montre le jour choisi ou tout le mois ; chaque
 *    événement mène à son pilotage.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  /** Date de début « AAAA-MM-JJ » (heure de Dakar). */
  start_date: string;
  start_time?: string | null;
  location?: string | null;
  city?: string | null;
  status?: string | null;
}

interface EventCalendarProps {
  events: CalendarEvent[];
}

/** Jours de la semaine, lundi en premier (usage français). */
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** « AAAA-MM-JJ » lu sans fuseau (une date seule passée à new Date() serait lue en UTC). */
function dateParts(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function dayLabel(year: number, month: number, day: number): string {
  return new Date(year, month, day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function countLabel(n: number): string {
  return n === 0 ? 'aucun événement' : n === 1 ? '1 événement' : `${n} événements`;
}

export const EventCalendar: React.FC<EventCalendarProps> = ({ events }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Décalage du premier jour du mois, lundi = 0
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const title = monthLabel(year, month);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const ev of events) {
      const d = dateParts(ev.start_date);
      if (!d || d.year !== year || d.month !== month) continue;
      const list = map.get(d.day) ?? [];
      list.push(ev);
      map.set(d.day, list);
    }
    for (const list of Array.from(map.values())) list.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
    return map;
  }, [events, year, month]);

  const monthDays = Array.from(eventsByDay.keys()).sort((a, b) => a - b);
  const monthTotal = monthDays.reduce((n, d) => n + (eventsByDay.get(d)?.length ?? 0), 0);
  const listedDays = selectedDay !== null ? (eventsByDay.has(selectedDay) ? [selectedDay] : []) : monthDays;

  const moveMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedDay(null);
  };
  const goToToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDay(null);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
      <section aria-labelledby="calendrier-mois" className="rounded-2xl border border-border bg-card p-4 sm:p-6 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="calendrier-mois" className="text-xl font-bold text-foreground-strong first-letter:uppercase" aria-live="polite">{title}</h2>
            <p className="text-sm tabular-nums text-muted-foreground">{`${countLabel(monthTotal)} ce mois-ci`.replace(/^./, (c) => c.toUpperCase())}</p>
          </div>
          <div className="flex items-center gap-1">
            <IconButton aria-label="Mois précédent" variant="secondary" onClick={() => moveMonth(-1)}>
              <ChevronLeft size={20} />
            </IconButton>
            {!isCurrentMonth && (
              <Button type="button" variant="ghost" size="sm" onClick={goToToday}>Ce mois-ci</Button>
            )}
            <IconButton aria-label="Mois suivant" variant="secondary" onClick={() => moveMonth(1)}>
              <ChevronRight size={20} />
            </IconButton>
          </div>
        </div>

        {/* Grille du mois : à partir de sm (sept colonnes de 44 px ne tiennent pas à 320 px) */}
        <div className="mt-5 hidden sm:block">
          <div className="grid grid-cols-7 gap-1 pb-2 text-center" aria-hidden="true">
            {WEEKDAYS.map((d) => (
              <span key={d} className="text-sm font-semibold text-muted-foreground">{d}</span>
            ))}
          </div>
          <ul className="grid grid-cols-7 gap-1" aria-label={`Jours de ${title}`}>
            {Array.from({ length: offset }).map((_, i) => (
              <li key={`vide-${i}`} aria-hidden="true" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const count = eventsByDay.get(day)?.length ?? 0;
              const selected = selectedDay === day;
              const today = isCurrentMonth && day === now.getDate();
              return (
                <li key={day}>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(selected ? null : day)}
                    aria-pressed={selected}
                    aria-label={`${dayLabel(year, month, day)}, ${countLabel(count)}${today ? ', aujourd’hui' : ''}`}
                    className={cn(
                      'flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border text-base tabular-nums transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected
                        ? 'border-primary bg-primary font-bold text-primary-foreground'
                        : count > 0
                          ? 'border-primary-text bg-primary-soft font-bold text-primary-text hover:bg-muted'
                          : 'border-transparent text-foreground hover:bg-muted',
                      today && !selected && 'underline decoration-2 underline-offset-4',
                    )}
                  >
                    <span aria-hidden="true">{day}</span>
                    {count > 0 && (
                      <small aria-hidden="true" data-ev-caption className="text-xs font-semibold leading-none">
                        {`${count} év.`}
                      </small>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Un jour avec des événements est encadré et indique leur nombre ; choisissez-le pour n’afficher que ses événements.
          </p>
        </div>
      </section>

      <section aria-labelledby="calendrier-liste" className="rounded-2xl border border-border bg-card p-4 sm:p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="calendrier-liste" className="min-w-0 break-words text-lg font-bold text-foreground-strong first-letter:uppercase">
            {selectedDay !== null ? dayLabel(year, month, selectedDay) : `Événements de ${title}`}
          </h2>
          {selectedDay !== null && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>Tout le mois</Button>
          )}
        </div>

        {listedDays.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<CalendarDays size={28} />}
            title={selectedDay !== null ? 'Aucun événement ce jour-là' : 'Aucun événement ce mois-ci'}
            description={selectedDay !== null ? 'Choisissez un autre jour ou affichez tout le mois.' : 'Changez de mois ou créez un événement.'}
          />
        ) : (
          <ol className="mt-4 flex flex-col gap-4">
            {listedDays.map((day) => (
              <li key={day} className="flex flex-col gap-2">
                {selectedDay === null && (
                  <h3 className="text-sm font-semibold text-muted-foreground first-letter:uppercase">{dayLabel(year, month, day)}</h3>
                )}
                <ul className="flex flex-col gap-2">
                  {(eventsByDay.get(day) ?? []).map((ev) => (
                    <li key={ev.id}>
                      <Link
                        href={`/partner/events/${ev.id}`}
                        className="flex min-h-11 flex-col gap-1.5 rounded-xl border border-border bg-background p-3 transition-colors duration-150 hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex flex-wrap items-start justify-between gap-2">
                          <span className="min-w-0 break-words text-base font-semibold text-foreground-strong">{ev.title}</span>
                          {ev.status && <StatusBadge domain="event" status={ev.status} size="sm" />}
                        </span>
                        <span className="text-sm tabular-nums text-muted-foreground">{formatEventDateTime(ev.start_date, ev.start_time ?? null)}</span>
                        {(ev.location || ev.city) && (
                          <span className="flex items-start gap-1.5 text-sm text-muted-foreground">
                            <MapPin size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            <span className="min-w-0 break-words">{[ev.location, ev.city].filter(Boolean).join(', ')}</span>
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};
