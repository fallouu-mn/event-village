'use client';

/**
 * Lot 11b (écrans du client) : bande des 14 prochains jours, glissable (défilement interne aimanté, jamais celui de la
 * page), plus un champ « Autre jour » pour aller jusqu'à 90 jours. Chaque jour est un bouton de 44 px au moins
 * (aria-pressed), nommé en entier (« samedi 5 décembre ») ; le jour choisi est mis en vue à l'ouverture.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { TextInput } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { dayText } from '@/lib/tables/views';

const STRIP_DAYS = 14;
const MAX_DAYS = 90;

function addDays(day: string, n: number): string {
    return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

const weekdayFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: 'UTC' });

export function DayStrip({ value, today, onChange }: { value: string; today: string; onChange: (day: string) => void }) {
    const days = useMemo(() => Array.from({ length: STRIP_DAYS }, (_, i) => addDays(today, i)), [today]);
    const selectedRef = useRef<HTMLButtonElement | null>(null);
    const stripRef = useRef<HTMLDivElement | null>(null);
    const inStrip = days.includes(value);

    useEffect(() => {
        const strip = stripRef.current;
        const el = selectedRef.current;
        if (!strip || !el) return;
        // Mise en vue dans la bande seulement (jamais de défilement de la page)
        strip.scrollLeft = Math.max(0, el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <fieldset className="min-w-0 space-y-2">
            <legend className="mb-2 text-sm font-semibold text-foreground-strong">Jour</legend>
            <div ref={stripRef} className="no-scrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
                {days.map((d, i) => {
                    const date = new Date(`${d}T00:00:00Z`);
                    const pressed = d === value;
                    const label = i === 0 ? 'Auj.' : i === 1 ? 'Dem.' : weekdayFmt.format(date).replace('.', '');
                    return (
                        <button
                            key={d}
                            ref={pressed ? selectedRef : undefined}
                            type="button"
                            aria-pressed={pressed}
                            aria-label={i === 0 ? `Aujourd’hui, ${dayText(d)}` : i === 1 ? `Demain, ${dayText(d)}` : dayText(d)}
                            onClick={() => onChange(d)}
                            className={cn(
                                'flex min-h-[4.5rem] w-16 flex-none snap-start flex-col items-center justify-center rounded-xl border text-center transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:active:scale-[0.97]',
                                pressed ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-card text-foreground-strong hover:bg-muted',
                            )}
                        >
                            <span className={cn('text-sm font-semibold capitalize', pressed ? 'text-primary-foreground' : 'text-muted-foreground')}>{label}</span>
                            <span className="text-xl font-bold leading-tight tabular-nums">{date.getUTCDate()}</span>
                            <span className={cn('text-sm', pressed ? 'text-primary-foreground' : 'text-muted-foreground')}>{monthFmt.format(date).replace('.', '')}</span>
                        </button>
                    );
                })}
            </div>
            <TextInput
                label="Autre jour"
                type="date"
                min={today}
                max={addDays(today, MAX_DAYS)}
                value={inStrip ? '' : value}
                onChange={(e) => {
                    if (e.target.value) onChange(e.target.value);
                }}
                hint={inStrip ? 'Jusqu’à 90 jours à l’avance.' : dayText(value)}
            />
        </fieldset>
    );
}
