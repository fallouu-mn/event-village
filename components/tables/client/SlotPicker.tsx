'use client';

/**
 * Lot 11b (écrans du client) : créneaux d'un jour en pastilles, rangés par moment (midi, après-midi, soir…). Retour
 * immédiat au toucher : la pastille choisie s'allume (fond plein et coche, aria-pressed) ; un créneau complet est grisé,
 * barré et dit « complet » ; un créneau passé ou trop lointain n'est pas montré ; « Dernière table » quand il n'en reste
 * qu'une. Jour fermé, fermeture exceptionnelle, jour complet ou aucune table assez grande : message clair et « Jour
 * suivant ». Les créneaux sont calculés par la base (GET /api/tables/[id]/slots), jamais ici.
 */
import React from 'react';
import { CalendarX, Check, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/components/ui/cn';
import { hmText } from '@/lib/tables/views';
import type { SlotView } from '@/lib/tables/queries';

export interface SlotsResult {
    day: string;
    message: string | null;
    partlyClosed: boolean;
    slots: SlotView[];
}

const PERIODS: ReadonlyArray<{ label: string; from: string; to: string }> = [
    { label: 'Matin', from: '06:00', to: '10:59' },
    { label: 'Midi', from: '11:00', to: '14:59' },
    { label: 'Après-midi', from: '15:00', to: '17:59' },
    { label: 'Soir', from: '18:00', to: '23:59' },
    { label: 'Nuit', from: '00:00', to: '05:59' },
];

function dayMessage(r: SlotsResult, guests: number, isToday: boolean): string | null {
    switch (r.day) {
        case 'FERME':
            return 'L’établissement est fermé ce jour-là.';
        case 'FERMETURE_EXCEPTIONNELLE':
            return 'Fermeture exceptionnelle ce jour-là.';
        case 'PASSE':
            return 'Ce jour est passé.';
        case 'COMPLET':
            return `Complet ce jour-là pour ${guests > 1 ? `${guests} personnes` : '1 personne'}. Essayez un autre jour ou une autre zone.`;
        case 'NO_TABLE_FITS':
            return r.message ?? `Aucune table ne peut accueillir ${guests} personnes ici.`;
        default:
            break;
    }
    const shown = r.slots.filter((s) => s.state === 'LIBRE' || s.state === 'COMPLET');
    if (shown.length === 0) return isToday ? 'Plus de créneau aujourd’hui.' : 'Aucun créneau proposé ce jour-là.';
    return null;
}

export function SlotPicker({ result, loading, failed, onRetry, selected, onSelect, guests, isToday, onNextDay }: {
    result: SlotsResult | null;
    loading: boolean;
    failed: string | null;
    onRetry: () => void;
    selected: string;
    onSelect: (time: string) => void;
    guests: number;
    isToday: boolean;
    onNextDay: () => void;
}) {
    if (failed) {
        return (
            <div role="alert" className="space-y-3 rounded-xl border border-danger-border bg-danger-soft p-4">
                <p className="text-sm font-semibold text-danger-text">{failed}</p>
                <Button variant="secondary" size="sm" onClick={onRetry} isLoading={loading}>Réessayer</Button>
            </div>
        );
    }
    if (!result) {
        return (
            <div className="flex flex-wrap gap-2" aria-hidden="true">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-[4.5rem] rounded-xl" />
                ))}
            </div>
        );
    }
    const message = dayMessage(result, guests, isToday);
    if (message) {
        return (
            <div className={cn('flex flex-col gap-3 rounded-xl border border-border bg-muted p-4 sm:flex-row sm:items-center sm:justify-between', loading && 'opacity-60')}>
                <p className="flex items-start gap-2 text-sm font-semibold text-foreground-strong">
                    <CalendarX size={18} className="mt-0.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{message}</span>
                </p>
                {result.day !== 'NO_TABLE_FITS' && (
                    <Button variant="secondary" size="sm" rightIcon={<ChevronRight size={16} aria-hidden="true" />} onClick={onNextDay} className="self-start sm:self-auto">
                        Jour suivant
                    </Button>
                )}
            </div>
        );
    }

    const visible = result.slots.filter((s) => s.state === 'LIBRE' || s.state === 'COMPLET');
    const groups = PERIODS.map((p) => ({ ...p, slots: visible.filter((s) => s.time >= p.from && s.time <= p.to) })).filter((g) => g.slots.length > 0);

    return (
        <div className={cn('space-y-4 transition-opacity duration-fast ease-standard', loading && 'opacity-60')}>
            {result.partlyClosed && (
                <p className="rounded-xl border border-info-border bg-info-soft px-3 py-2 text-sm text-info-text">
                    Fermeture exceptionnelle sur une partie de la journée : certains créneaux ne sont pas proposés.
                </p>
            )}
            {groups.map((g) => (
                <div key={g.label} className="space-y-2">
                    <h4 className="text-sm font-semibold text-muted-foreground">{g.label}</h4>
                    <ul className="flex flex-wrap gap-2">
                        {g.slots.map((s) => {
                            const pressed = s.time === selected;
                            if (s.state !== 'LIBRE') {
                                return (
                                    <li key={s.time}>
                                        <span className="inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-xl border border-border bg-muted px-3 text-sm font-semibold tabular-nums text-muted-foreground line-through decoration-2">
                                            <span aria-hidden="true">{hmText(s.time)}</span>
                                            <span className="sr-only">{`${hmText(s.time)}, complet`}</span>
                                        </span>
                                    </li>
                                );
                            }
                            const last = s.freeTables === 1;
                            return (
                                <li key={s.time}>
                                    <button
                                        type="button"
                                        aria-pressed={pressed}
                                        aria-label={`${hmText(s.time)}${last ? ', dernière table' : ''}`}
                                        onClick={() => onSelect(pressed ? '' : s.time)}
                                        className={cn(
                                            'inline-flex min-h-11 min-w-[4.5rem] flex-col items-center justify-center rounded-xl border px-3 py-1 text-sm font-bold tabular-nums transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-safe:active:scale-[0.97]',
                                            pressed
                                                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                                : 'border-primary-text bg-primary-soft text-primary-text hover:bg-primary hover:text-primary-foreground',
                                        )}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            {pressed && <Check size={16} strokeWidth={3} aria-hidden="true" />}
                                            {hmText(s.time)}
                                        </span>
                                        {last && <small className="text-caption font-semibold" aria-hidden="true">Dernière table</small>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}
