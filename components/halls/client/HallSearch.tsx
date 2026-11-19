'use client';

/**
 * Lot 10b (point 2) : formulaire de recherche des salles. Les filtres vivent dans l'adresse (/halls?city=…&date=…) :
 * lien partageable, retour arrière qui rend la recherche précédente. La recherche elle-même est faite par le serveur
 * (page /halls) ; ce formulaire ne fait que changer l'adresse. Pendant le chargement, les résultats restent visibles,
 * atténués et annoncés occupés. Sur téléphone, les filtres secondaires sont repliés derrière « Plus de filtres ».
 */
import React, { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Field';
import { cn } from '@/components/ui/cn';

export interface HallFilters {
    q: string;
    city: string;
    date: string;
    days: string;
    capacity: string;
    priceMax: string;
    sort: 'recent' | 'price';
}

export const EMPTY_FILTERS: HallFilters = { q: '', city: '', date: '', days: '', capacity: '', priceMax: '', sort: 'recent' };

/** Adresse de recherche (paramètres vides retirés ; la durée n'a de sens qu'avec une date). */
export function filtersQuery(f: HallFilters): string {
    const p = new URLSearchParams();
    if (f.q.trim()) p.set('q', f.q.trim());
    if (f.city) p.set('city', f.city);
    if (f.date) {
        p.set('date', f.date);
        if (f.days && f.days !== '1') p.set('days', f.days);
    }
    if (f.capacity.trim()) p.set('capacity', f.capacity.trim());
    if (f.priceMax.trim()) p.set('price_max', f.priceMax.trim());
    if (f.sort === 'price') p.set('sort', 'price');
    return p.toString();
}

const DAY_OPTIONS = Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: i === 0 ? '1 jour' : `${i + 1} jours` }));
const SORT_OPTIONS = [
    { value: 'recent', label: 'Les plus récentes' },
    { value: 'price', label: 'Prix par jour, du moins cher au plus cher' },
];

export function HallSearch({ cities, initial, today, children }: { cities: string[]; initial: HallFilters; today: string; children: React.ReactNode }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [f, setF] = useState<HallFilters>(initial);
    const hasSecondary = Boolean(initial.capacity || initial.priceMax || initial.sort === 'price' || initial.q);
    const [more, setMore] = useState(hasSecondary);
    const moreId = useId();
    const active = filtersQuery(initial) !== '';

    const go = (next: HallFilters) => {
        const query = filtersQuery(next);
        startTransition(() => router.push(query ? `/halls?${query}` : '/halls', { scroll: false }));
    };

    const set = <K extends keyof HallFilters>(key: K, value: HallFilters[K]) => setF((prev) => ({ ...prev, [key]: value }));

    const cityOptions = [{ value: '', label: 'Toutes les villes' }, ...cities.map((c) => ({ value: c, label: c }))];
    if (f.city && !cities.includes(f.city)) cityOptions.push({ value: f.city, label: f.city });

    return (
        <div className="space-y-6">
            <form
                role="search"
                aria-label="Rechercher une salle"
                className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
                onSubmit={(e) => {
                    e.preventDefault();
                    go(f);
                }}
            >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Select label="Ville" value={f.city} onChange={(e) => set('city', e.target.value)} options={cityOptions} />
                    <TextInput
                        label="Date de la fête"
                        type="date"
                        min={today}
                        value={f.date}
                        onChange={(e) => set('date', e.target.value)}
                        hint="Seules les salles libres s’affichent."
                    />
                    <Select
                        label="Nombre de jours"
                        value={f.days || '1'}
                        onChange={(e) => set('days', e.target.value)}
                        options={DAY_OPTIONS}
                        disabled={!f.date}
                        hint={f.date ? undefined : 'Choisissez d’abord une date.'}
                    />
                    <TextInput
                        label="Nombre d’invités"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={f.capacity}
                        onChange={(e) => set('capacity', e.target.value)}
                        placeholder="Par exemple 200"
                    />
                    <div id={moreId} className={cn(more ? 'contents' : 'hidden sm:contents')}>
                        <TextInput
                            label="Nom de la salle ou quartier"
                            type="search"
                            value={f.q}
                            maxLength={80}
                            onChange={(e) => set('q', e.target.value)}
                            placeholder="Par exemple Almadies"
                        />
                        <TextInput
                            label="Prix maximum par jour (F CFA)"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1000}
                            value={f.priceMax}
                            onChange={(e) => set('priceMax', e.target.value)}
                        />
                        <Select
                            label="Trier par"
                            value={f.sort}
                            onChange={(e) => {
                                const next = { ...f, sort: e.target.value === 'price' ? 'price' as const : 'recent' as const };
                                setF(next);
                                go(next);
                            }}
                            options={SORT_OPTIONS}
                        />
                    </div>
                    <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-1">
                        <Button type="submit" variant="primary" isLoading={pending} leftIcon={<Search size={18} />} className="flex-1">
                            Rechercher
                        </Button>
                        {active && (
                            <Button
                                type="button"
                                variant="ghost"
                                leftIcon={<X size={18} />}
                                onClick={() => {
                                    setF(EMPTY_FILTERS);
                                    go(EMPTY_FILTERS);
                                }}
                            >
                                Effacer
                            </Button>
                        )}
                    </div>
                </div>
                <div className="mt-3 sm:hidden">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-expanded={more}
                        aria-controls={moreId}
                        leftIcon={<SlidersHorizontal size={16} />}
                        onClick={() => setMore((v) => !v)}
                        className="-ml-2"
                    >
                        {more ? 'Moins de filtres' : 'Plus de filtres'}
                    </Button>
                </div>
            </form>

            <div aria-busy={pending} className={cn('transition-opacity duration-base ease-standard', pending && 'opacity-60')}>
                <p className="sr-only" role="status">{pending ? 'Recherche en cours…' : ''}</p>
                {children}
            </div>
        </div>
    );
}
