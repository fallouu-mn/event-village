'use client';

/**
 * Lot 11b (écrans du client) : formulaire de recherche des établissements. Les filtres vivent dans l'adresse
 * (/tables?city=…&date=…&time=…&guests=…) : lien partageable, retour arrière qui rend la recherche précédente. La
 * recherche elle-même est faite par le serveur (page /tables) ; ce formulaire ne fait que changer l'adresse.
 * L'essentiel d'abord (jour, heure, personnes, ville) ; genre, nom et « Seulement les tables libres » s'appliquent tout
 * de suite. Sur téléphone, les filtres secondaires sont repliés derrière « Plus de filtres ». Pendant le chargement,
 * les résultats restent visibles, atténués et annoncés occupés.
 */
import React, { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { Select, TextInput } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/components/ui/cn';
import { hmText } from '@/lib/tables/views';
import { DEFAULT_GUESTS, EMPTY_FILTERS, KINDS, MAX_GUESTS, QUARTER_TIMES, filtersQuery, type VenueFilters } from './search-filters';

const TIME_OPTIONS = [{ value: '', label: 'Toute la journée' }, ...QUARTER_TIMES.map((t) => ({ value: t, label: hmText(t) }))];

export function VenueSearch({ cities, initial, today, maxDate, children }: { cities: string[]; initial: VenueFilters; today: string; maxDate: string; children: React.ReactNode }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [f, setF] = useState<VenueFilters>(initial);
    const [guestsError, setGuestsError] = useState<string | null>(null);
    const hasSecondary = Boolean(initial.q || initial.kind || initial.available);
    const [more, setMore] = useState(hasSecondary);
    const moreId = useId();
    const active = filtersQuery(initial) !== '';

    const go = (next: VenueFilters) => {
        const g = next.guests.trim();
        if (g && !(/^\d{1,2}$/.test(g) && Number(g) >= 1 && Number(g) <= MAX_GUESTS)) {
            setGuestsError(`Indiquez un nombre de personnes entre 1 et ${MAX_GUESTS}.`);
            return;
        }
        setGuestsError(null);
        const query = filtersQuery(next);
        startTransition(() => router.push(query ? `/tables?${query}` : '/tables', { scroll: false }));
    };

    const set = <K extends keyof VenueFilters>(key: K, value: VenueFilters[K]) => setF((prev) => ({ ...prev, [key]: value }));
    const apply = (patch: Partial<VenueFilters>) => {
        const next = { ...f, ...patch };
        setF(next);
        go(next);
    };

    const cityOptions = [{ value: '', label: 'Toutes les villes' }, ...cities.map((c) => ({ value: c, label: c }))];
    if (f.city && !cities.includes(f.city)) cityOptions.push({ value: f.city, label: f.city });

    return (
        <div className="space-y-6">
            <form
                role="search"
                aria-label="Rechercher une table"
                className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    go(f);
                }}
            >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <TextInput
                        label="Jour"
                        type="date"
                        min={today}
                        max={maxDate}
                        value={f.date || today}
                        onChange={(e) => set('date', e.target.value === today ? '' : e.target.value)}
                    />
                    <Select label="Heure" value={f.time} onChange={(e) => set('time', e.target.value)} options={TIME_OPTIONS} />
                    <TextInput
                        label="Personnes"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_GUESTS}
                        step={1}
                        value={f.guests}
                        placeholder={String(DEFAULT_GUESTS)}
                        onChange={(e) => {
                            setGuestsError(null);
                            set('guests', e.target.value.replace(/\D/g, '').slice(0, 2));
                        }}
                        error={guestsError ?? undefined}
                    />
                    <Select label="Ville" value={f.city} onChange={(e) => set('city', e.target.value)} options={cityOptions} />
                    <div id={moreId} className={cn('space-y-4 sm:col-span-2 lg:col-span-4', more ? 'block' : 'hidden sm:block')}>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <TextInput
                                label="Nom ou quartier"
                                type="search"
                                value={f.q}
                                maxLength={80}
                                onChange={(e) => set('q', e.target.value)}
                                placeholder="Par exemple Almadies"
                            />
                            <fieldset className="min-w-0">
                                <legend className="mb-2 text-sm font-semibold text-foreground-strong">Genre</legend>
                                <div className="flex flex-wrap gap-2">
                                    <FilterChip pressed={f.kind === ''} onClick={() => apply({ kind: '' })}>Tous</FilterChip>
                                    {KINDS.map((k) => (
                                        <FilterChip key={k.value} pressed={f.kind === k.value} onClick={() => apply({ kind: f.kind === k.value ? '' : k.value })}>
                                            {k.label}
                                        </FilterChip>
                                    ))}
                                </div>
                            </fieldset>
                        </div>
                        <Switch
                            label="Seulement les tables libres"
                            description="Cache les établissements complets à ce moment-là."
                            checked={f.available}
                            onChange={(v) => apply({ available: v })}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
                        <Button type="submit" variant="primary" isLoading={pending} leftIcon={<Search size={18} aria-hidden="true" />} className="min-w-0 flex-1 sm:flex-none sm:px-8">
                            Rechercher
                        </Button>
                        {active && (
                            <Button
                                type="button"
                                variant="ghost"
                                leftIcon={<X size={18} aria-hidden="true" />}
                                onClick={() => {
                                    setF(EMPTY_FILTERS);
                                    go(EMPTY_FILTERS);
                                }}
                            >
                                Effacer
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            aria-expanded={more}
                            aria-controls={moreId}
                            leftIcon={<SlidersHorizontal size={18} aria-hidden="true" />}
                            onClick={() => setMore((v) => !v)}
                            className="sm:hidden"
                        >
                            {more ? 'Moins de filtres' : 'Plus de filtres'}
                        </Button>
                    </div>
                </div>
            </form>

            <div aria-busy={pending} className={cn('transition-opacity duration-base ease-standard', pending && 'opacity-60')}>
                <p className="sr-only" role="status">{pending ? 'Recherche en cours…' : ''}</p>
                {children}
            </div>
        </div>
    );
}
