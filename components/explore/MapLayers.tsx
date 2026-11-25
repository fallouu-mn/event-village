'use client';

import React, { useId } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import type { HallLayerFilters, VenueLayerFilters } from '@/lib/lieux/carte-lieux-client';
import { HALL_ICON_SVG, RESTO_ICON_SVG } from './place-markers';

/**
 * Lot Carte B3 — couches de la carte d'Explorer : Événements, Salles, Restaurants.
 *
 *  - pastilles = boutons à bascule (aria-pressed), icône + nom + nombre dans la zone visible (« Salles · 12 ») ; une
 *    couche choisie porte la barre orange d'Explorer (même indicateur que les onglets Liste / Carte / Calendrier), qui
 *    se déploie (transform seulement, 200 ms, coupée si « réduire les animations ») ; l'état est posé tout de suite,
 *    jamais à la fin d'une animation ;
 *  - une couche dont le service est fermé (interrupteur de l'administration) n'est pas proposée ;
 *  - filtres propres à chaque couche choisie : salle (date, invités) ; restaurant (date, heure, personnes : comme la
 *    recherche des tables du lot 11b). Champs natifs (date, heure, nombre), libellés visibles.
 */

export type MapLayer = 'evenements' | 'salles' | 'restaurants';
export const MAP_LAYERS: readonly MapLayer[] = ['evenements', 'salles', 'restaurants'];

const LABELS: Record<MapLayer, string> = { evenements: 'Événements', salles: 'Salles', restaurants: 'Restaurants' };

function LayerIcon({ layer }: { layer: MapLayer }) {
    if (layer === 'evenements') return <CalendarDays size={16} aria-hidden="true" />;
    return <span aria-hidden="true" className="inline-flex" dangerouslySetInnerHTML={{ __html: layer === 'salles' ? HALL_ICON_SVG : RESTO_ICON_SVG }} />;
}

export function LayerPills({ available, active, counts, onToggle }: {
    available: readonly MapLayer[];
    active: ReadonlySet<MapLayer>;
    /** Nombre dans la zone visible, ou null pendant la lecture. */
    counts: Partial<Record<MapLayer, number | null>>;
    onToggle: (layer: MapLayer) => void;
}) {
    return (
        <div role="group" aria-label="Afficher sur la carte" className="flex flex-wrap gap-2">
            {available.map((layer) => {
                const on = active.has(layer);
                const n = counts[layer];
                return (
                    <button
                        key={layer}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onToggle(layer)}
                        className={cn(
                            'relative inline-flex min-h-11 items-center gap-1.5 overflow-hidden rounded-full border px-4 text-sm font-semibold transition-colors duration-fast',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                            on ? 'border-foreground-strong bg-card text-foreground-strong' : 'border-border bg-muted text-muted-foreground hover:text-foreground-strong',
                        )}
                    >
                        <LayerIcon layer={layer} />
                        <span>{LABELS[layer]}</span>
                        {on && typeof n === 'number' && <span className="tabular-nums" aria-label={`, ${n} dans la zone`}>{`· ${n}`}</span>}
                        {/* Barre orange d'Explorer, déployée quand la couche est choisie */}
                        <span
                            aria-hidden="true"
                            className={cn(
                                'pointer-events-none absolute inset-x-3 bottom-0 h-[3px] origin-center rounded-full bg-brand-vif',
                                'motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out',
                                on ? 'scale-x-100' : 'scale-x-0',
                            )}
                        />
                    </button>
                );
            })}
        </div>
    );
}

const fieldClass = 'min-h-11 w-full rounded-xl border border-input bg-card px-3 text-base text-foreground-strong focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40';

function Field({ label, children, id }: { label: string; id: string; children: React.ReactNode }) {
    return (
        <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1 sm:max-w-[11rem]">
            <label htmlFor={id} className="text-sm font-semibold text-foreground-strong">{label}</label>
            {children}
        </div>
    );
}

/** Jour de Dakar (UTC) : premier jour qu'on peut choisir. */
function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function HallFilters({ value, onChange }: { value: HallLayerFilters; onChange: (v: HallLayerFilters) => void }) {
    const id = useId();
    return (
        <fieldset className="flex flex-wrap items-end gap-2">
            <legend className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <LayerIcon layer="salles" /> Salles
            </legend>
            <Field label="Date" id={`${id}-date`}>
                <input id={`${id}-date`} type="date" min={today()} value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} className={fieldClass} />
            </Field>
            <Field label="Invités" id={`${id}-invites`}>
                <input id={`${id}-invites`} type="number" inputMode="numeric" min={1} max={100000} placeholder="Nombre" value={value.guests}
                    onChange={(e) => onChange({ ...value, guests: e.target.value.replace(/\D/g, '').slice(0, 6) })} className={fieldClass} />
            </Field>
        </fieldset>
    );
}

export function VenueFilters({ value, onChange }: { value: VenueLayerFilters; onChange: (v: VenueLayerFilters) => void }) {
    const id = useId();
    return (
        <fieldset className="flex flex-wrap items-end gap-2">
            <legend className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                <LayerIcon layer="restaurants" /> Restaurants
            </legend>
            <Field label="Date" id={`${id}-date`}>
                <input id={`${id}-date`} type="date" min={today()} value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} className={fieldClass} />
            </Field>
            <Field label="Heure" id={`${id}-heure`}>
                <input id={`${id}-heure`} type="time" step={900} value={value.time} onChange={(e) => onChange({ ...value, time: e.target.value })} className={fieldClass} />
            </Field>
            <Field label="Personnes" id={`${id}-personnes`}>
                <input id={`${id}-personnes`} type="number" inputMode="numeric" min={1} max={50} placeholder="Nombre" value={value.guests}
                    onChange={(e) => onChange({ ...value, guests: e.target.value.replace(/\D/g, '').slice(0, 2) })} className={fieldClass} />
            </Field>
        </fieldset>
    );
}

/** Couches gardées dans l'adresse : `couches=evenements,salles` ; absent = toutes les couches proposées. */
export const LAYERS_PARAM = 'couches';

export function readLayersParam(available: readonly MapLayer[]): Set<MapLayer> {
    if (typeof window === 'undefined') return new Set(available);
    const raw = new URLSearchParams(window.location.search).get(LAYERS_PARAM);
    if (raw === null) return new Set(available);
    const asked = raw.split(',').filter((x): x is MapLayer => (MAP_LAYERS as readonly string[]).includes(x));
    return new Set(asked.filter((l) => available.includes(l)));
}

/** Écrit les couches dans l'adresse (sans recharger ni ajouter d'entrée à l'historique). */
export function writeLayersParam(active: ReadonlySet<MapLayer>): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set(LAYERS_PARAM, MAP_LAYERS.filter((l) => active.has(l)).join(','));
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}
