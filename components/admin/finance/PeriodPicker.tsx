'use client';

import React, { useEffect, useId, useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Field';
import { CUSTOM_MIN_DATE, PERIOD_KEYS, PERIOD_LABELS, dakarDay, type PeriodKey } from '@/lib/finance/period';

export interface PeriodChoice {
    key: PeriodKey;
    from?: string;
    to?: string;
}

/** Ordre de la liste : du plus court au plus long, puis les dates choisies. */
const OPTIONS = PERIOD_KEYS.map((k) => ({ value: k, label: k === 'custom' ? 'Dates choisies…' : PERIOD_LABELS[k] }));

function todayIso(): string {
    const d = dakarDay(new Date());
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

/**
 * Finition 3a (E-30) — une seule période pour toute la page Finance. Le serveur calcule les bornes en heure de Dakar et
 * rend la phrase des dates (`range`), montrée sous le choix. Dates choisies : du … au …, bornes comprises, appliquées
 * par « Afficher » (le serveur refuse en français une période impossible : `error`).
 */
export function PeriodPicker({ value, range, error, disabled, onChange }: {
    value: PeriodChoice;
    range: string | null;
    error: string | null;
    disabled?: boolean;
    onChange: (next: PeriodChoice) => void;
}) {
    const id = useId();
    const [from, setFrom] = useState(value.from ?? '');
    const [to, setTo] = useState(value.to ?? '');
    const [today, setToday] = useState<string>('');

    useEffect(() => setToday(todayIso()), []);
    useEffect(() => {
        setFrom(value.from ?? '');
        setTo(value.to ?? '');
    }, [value.from, value.to]);

    return (
        <div role="group" aria-labelledby={`${id}-titre`} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2">
                <CalendarRange size={18} className="flex-shrink-0 text-primary-text" aria-hidden="true" />
                <h2 id={`${id}-titre`} className="text-base font-semibold text-foreground-strong">Période</h2>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <Select
                    label="Afficher"
                    id={`${id}-choix`}
                    value={value.key}
                    options={OPTIONS}
                    disabled={disabled}
                    fieldClassName="md:w-64"
                    onChange={(e) => {
                        const key = e.target.value as PeriodKey;
                        if (key === 'custom') onChange({ key, from: from || today, to: to || today });
                        else onChange({ key });
                    }}
                />
                {value.key === 'custom' && (
                    <form
                        className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        onSubmit={(e) => {
                            e.preventDefault();
                            onChange({ key: 'custom', from, to });
                        }}
                    >
                        <TextInput label="Du" id={`${id}-du`} type="date" value={from} min={CUSTOM_MIN_DATE} max={today || undefined} required onChange={(e) => setFrom(e.target.value)} fieldClassName="sm:w-48" />
                        <TextInput label="Au" id={`${id}-au`} type="date" value={to} min={from || CUSTOM_MIN_DATE} max={today || undefined} required onChange={(e) => setTo(e.target.value)} fieldClassName="sm:w-48" />
                        <Button type="submit" variant="secondary" disabled={disabled}>Afficher</Button>
                    </form>
                )}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground" aria-live="polite">
                {error
                    ? <span className="font-semibold text-danger-text">{error}</span>
                    : range
                        ? <>Période affichée : <span className="font-semibold text-foreground-strong">{range}</span>. Elle change « Gagné par Event Village » et la liste des paiements ; les autres chiffres sont à l’instant.</>
                        : 'Chargement de la période…'}
            </p>
        </div>
    );
}
