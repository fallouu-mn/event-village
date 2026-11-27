'use client';

import React, { useMemo } from 'react';
import { Select } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';
import { clockLabel, dayLabel, slotLabel, type TimeChoices } from '@/lib/orders/cart-client';

export type TimeChip = 'asap' | 'noon' | 'evening' | 'other';

export function chipClass(active: boolean): string {
    return cn(
        'min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-brand-vif bg-brand-vif text-brand-vif-foreground' : 'border-border bg-card text-foreground-strong hover:bg-muted',
    );
}

/**
 * Lot 12b — choix de l'heure en puces simples : « Tout de suite » (si l'établissement est ouvert pendant toute la
 * préparation), « Midi », « Ce soir », « Autre heure » (jour puis heure au quart d'heure, 7 jours). Les heures proposées
 * viennent des fenêtres servies par la base ; la base refait tous les contrôles au devis.
 */
export function TimePicker({ choices, today, chip, value, onChange }: {
    choices: TimeChoices;
    today: string;
    chip: TimeChip | null;
    value: string | null;
    onChange: (chip: TimeChip, value: string | null) => void;
}) {
    const days = useMemo(() => [...new Set(choices.slots.map((s) => s.slice(0, 10)))], [choices.slots]);
    const day = value ? value.slice(0, 10) : days[0] ?? null;
    const daySlots = choices.slots.filter((s) => s.slice(0, 10) === day);
    const none = !choices.asap && choices.slots.length === 0;

    if (none) {
        return <p className="text-sm text-muted-foreground">Aucune heure n’est possible dans les 7 prochains jours : l’établissement est fermé.</p>;
    }
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Heure de la commande">
                {choices.asap && (
                    <button type="button" role="radio" aria-checked={chip === 'asap'} className={chipClass(chip === 'asap')} onClick={() => onChange('asap', null)}>
                        Tout de suite
                    </button>
                )}
                {choices.noon && (
                    <button type="button" role="radio" aria-checked={chip === 'noon'} className={chipClass(chip === 'noon')} onClick={() => onChange('noon', choices.noon)}>
                        <span>Midi</span> <span className="tabular-nums opacity-80">{`· ${clockLabel(choices.noon)}`}</span>
                    </button>
                )}
                {choices.evening && (
                    <button type="button" role="radio" aria-checked={chip === 'evening'} className={chipClass(chip === 'evening')} onClick={() => onChange('evening', choices.evening)}>
                        <span>Ce soir</span> <span className="tabular-nums opacity-80">{`· ${clockLabel(choices.evening)}`}</span>
                    </button>
                )}
                {choices.slots.length > 0 && (
                    <button type="button" role="radio" aria-checked={chip === 'other'} className={chipClass(chip === 'other')}
                        onClick={() => onChange('other', value ?? choices.slots[0])}>
                        Autre heure
                    </button>
                )}
            </div>
            {chip === 'other' && day && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Select
                        label="Jour"
                        value={day}
                        onChange={(e) => {
                            const first = choices.slots.find((s) => s.slice(0, 10) === e.target.value) ?? null;
                            onChange('other', first);
                        }}
                        options={days.map((d) => ({ value: d, label: dayLabel(d, today) }))}
                    />
                    <Select
                        label="Heure"
                        value={value ?? ''}
                        onChange={(e) => onChange('other', e.target.value)}
                        options={daySlots.map((s) => ({ value: s, label: clockLabel(s) }))}
                    />
                </div>
            )}
            {value && chip !== 'asap' && (
                <p className="text-sm text-muted-foreground">
                    Prévue <span className="font-semibold tabular-nums text-foreground-strong">{slotLabel(value, today).replace(/^./, (c) => c.toLowerCase())}</span>
                </p>
            )}
        </div>
    );
}
