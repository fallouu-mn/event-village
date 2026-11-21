'use client';

/**
 * Lot 11b : choix du jour du planning. Bande glissable de la veille à J+13 (« Hier », « Aujourd'hui », « Demain », puis
 * le jour de la semaine et sa date), le jour choisi allumé (aria-pressed), et un champ date pour un autre jour. La bande
 * défile dans sa boîte, jamais la page ; le jour choisi est ramené dans la vue.
 */
import React, { useEffect, useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { shiftDay } from './venue-api';

const WEEKDAY_SHORT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
const DAY_NUM = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', timeZone: 'UTC' });
const MONTH_SHORT = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

function labelOf(day: string, today: string): { top: string; num: string; month: string } {
    const d = new Date(`${day}T00:00:00Z`);
    const top = day === today ? 'Aujourd’hui' : day === shiftDay(today, 1) ? 'Demain' : day === shiftDay(today, -1) ? 'Hier' : WEEKDAY_SHORT.format(d).replace('.', '');
    return { top: top.charAt(0).toUpperCase() + top.slice(1), num: DAY_NUM.format(d), month: MONTH_SHORT.format(d).replace('.', '') };
}

export function DayStrip({ value, today, onChange }: { value: string; today: string; onChange: (day: string) => void }) {
    const days = Array.from({ length: 15 }, (_, i) => shiftDay(today, i - 1));
    const listRef = useRef<HTMLUListElement>(null);
    const outside = !days.includes(value);

    useEffect(() => {
        const el = listRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
        el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [value]);

    return (
        // Lot 11b (contrôle responsive) : grille à une colonne bornée (minmax(0, 1fr)) : la bande des jours défile dans sa
        // largeur sans élargir la page, et « Autre jour » passe dessous (jamais à côté de jours cachés par le défilement)
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <ul
                ref={listRef}
                aria-label="Choisir le jour du planning"
                className="-mx-1 flex w-full min-w-0 snap-x gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:thin]"
            >
                {days.map((day) => {
                    const l = labelOf(day, today);
                    const on = day === value;
                    return (
                        <li key={day} className="snap-start">
                            <button
                                type="button"
                                aria-pressed={on}
                                onClick={() => onChange(day)}
                                className={cn(
                                    'flex min-h-16 min-w-[4.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-1.5 transition-colors duration-fast ease-standard',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                    on ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card text-foreground-strong hover:bg-muted',
                                )}
                            >
                                <span className={cn('whitespace-nowrap text-sm font-semibold', on ? 'text-primary-foreground' : 'text-muted-foreground')}>{l.top}</span>
                                <span className="text-lg font-bold leading-none tabular-nums">{l.num}</span>
                                <span className="sr-only">{l.month}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            <div className="flex flex-shrink-0 flex-col gap-1">
                <label htmlFor="planning-autre-jour" className="flex items-center gap-1.5 text-sm font-semibold text-foreground-strong">
                    <CalendarDays size={16} aria-hidden="true" className="text-muted-foreground" />
                    Autre jour
                </label>
                <input
                    id="planning-autre-jour"
                    type="date"
                    value={value}
                    onChange={(e) => { if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) onChange(e.target.value); }}
                    className={cn(
                        'min-h-11 w-full rounded-xl border bg-card px-3 text-base text-foreground-strong tabular-nums sm:w-44',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        outside ? 'border-primary' : 'border-input',
                    )}
                />
            </div>
        </div>
    );
}
