import React from 'react';
import { Store } from 'lucide-react';
import { FilterChip } from '@/components/ui/FilterChip';

/**
 * Lot 12c — choix de l'établissement (puces de 44 px, défilement horizontal interne sur téléphone ; l'état choisi est
 * annoncé par aria-pressed et une coche, jamais la couleur seule).
 */
export function VenuePicker({ venues, value, onChange, label = 'Établissement' }: {
    venues: ReadonlyArray<{ id: string; name: string; count?: number }>;
    value: string;
    onChange: (id: string) => void;
    label?: string;
}) {
    if (venues.length <= 1) return null;
    return (
        <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {venues.map((v) => (
                <FilterChip key={v.id} pressed={v.id === value} onClick={() => onChange(v.id)}>
                    {v.id !== value && <Store size={16} aria-hidden="true" />}
                    <span className="max-w-56 truncate">{v.name}</span>
                    {typeof v.count === 'number' && <span className="tabular-nums text-muted-foreground">{v.count}</span>}
                </FilterChip>
            ))}
        </div>
    );
}
