'use client';

/**
 * Lot 11b (écrans du client) : nombre de personnes, pas à pas (− et +, 44 px) avec saisie directe au clavier numérique.
 * Bornes 1 à 50 ; la valeur annoncée change à voix haute (« 4 personnes »).
 */
import React, { useEffect, useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { MAX_GUESTS, MIN_GUESTS } from './booking-choice';

export function GuestStepper({ value, onChange, hint }: { value: number; onChange: (n: number) => void; hint?: string }) {
    const id = useId();
    const hintId = `${id}-aide`;
    const [text, setText] = useState(String(value));
    useEffect(() => setText(String(value)), [value]);

    const commit = (raw: string) => {
        const n = Number(raw);
        if (Number.isInteger(n) && n >= MIN_GUESTS && n <= MAX_GUESTS) onChange(n);
        else setText(String(value));
    };

    return (
        <div className="space-y-2">
            <label htmlFor={id} className="block text-sm font-semibold text-foreground-strong">Personnes</label>
            <div className="flex items-center gap-2 sm:gap-3">
                <IconButton aria-label="Une personne de moins" variant="secondary" disabled={value <= MIN_GUESTS} onClick={() => onChange(Math.max(MIN_GUESTS, value - 1))}>
                    <Minus size={20} aria-hidden="true" />
                </IconButton>
                <div className="flex min-w-0 items-baseline gap-2">
                    <input
                        id={id}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="off"
                        maxLength={2}
                        value={text}
                        aria-describedby={hint ? hintId : undefined}
                        onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
                            setText(raw);
                            const n = Number(raw);
                            if (raw && n >= MIN_GUESTS && n <= MAX_GUESTS) onChange(n);
                        }}
                        onBlur={(e) => commit(e.target.value)}
                        className="h-12 w-14 rounded-xl border border-input bg-background text-center text-xl font-bold tabular-nums text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <span className="text-base text-foreground" aria-hidden="true">{value > 1 ? 'personnes' : 'personne'}</span>
                </div>
                <IconButton aria-label="Une personne de plus" variant="secondary" disabled={value >= MAX_GUESTS} onClick={() => onChange(Math.min(MAX_GUESTS, value + 1))}>
                    <Plus size={20} aria-hidden="true" />
                </IconButton>
            </div>
            {hint && <p id={hintId} className="text-sm text-muted-foreground">{hint}</p>}
        </div>
    );
}
