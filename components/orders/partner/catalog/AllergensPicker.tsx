'use client';

/**
 * Lot 12d (point 7) — allergènes (14 allergènes courants, cases à cocher en puces) et niveau de piment (0 à 3, ou « Non
 * renseigné ») d'un produit, dans le formulaire de la partenaire. Enregistrés juste après le produit par
 * PUT /api/partner/products/[id]/details ; affichés sur la fiche du plat côté client.
 */
import { Check } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { ALLERGENS, SPICE_LEVELS } from '../../order-extras';

const CHIP = cn(
    'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-fast',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
    'disabled:cursor-not-allowed disabled:opacity-60',
);
const ON = 'border-primary-text bg-primary-soft text-primary-text';
const OFF = 'border-border bg-card text-foreground-strong hover:bg-muted';

export function AllergensPicker({ allergens, spiceLevel, onChange, disabled = false }: {
    allergens: string[];
    spiceLevel: number | null;
    onChange: (next: { allergens: string[]; spiceLevel: number | null }) => void;
    disabled?: boolean;
}) {
    const toggle = (code: string) => {
        const next = allergens.includes(code) ? allergens.filter((a) => a !== code) : [...allergens, code];
        onChange({ allergens: next, spiceLevel });
    };
    return (
        <div className="space-y-5">
            <fieldset className="min-w-0">
                <legend className="mb-1 text-sm font-semibold text-foreground-strong">Allergènes</legend>
                <p className="mb-3 text-sm text-muted-foreground">Cochez ce que contient le plat : vos clients le voient sur sa fiche avant de commander.</p>
                <div className="flex flex-wrap gap-2">
                    {ALLERGENS.map((a) => {
                        const on = allergens.includes(a.value);
                        return (
                            <button key={a.value} type="button" aria-pressed={on} disabled={disabled} onClick={() => toggle(a.value)} className={cn(CHIP, on ? ON : OFF)}>
                                {on && <Check size={14} strokeWidth={3} aria-hidden="true" />}
                                {a.label}
                            </button>
                        );
                    })}
                </div>
                <p className="mt-2 text-sm text-muted-foreground" role="status">
                    {allergens.length === 0 ? 'Aucun allergène coché.' : `${allergens.length} allergène${allergens.length > 1 ? 's' : ''} coché${allergens.length > 1 ? 's' : ''}.`}
                </p>
            </fieldset>
            <fieldset className="min-w-0">
                <legend className="mb-1 text-sm font-semibold text-foreground-strong">Piment</legend>
                <p className="mb-3 text-sm text-muted-foreground">« Pas pimenté » fait apparaître le plat avec le filtre « Sans piment » de votre carte.</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Niveau de piment">
                    {[{ value: null as number | null, label: 'Non renseigné' }, ...SPICE_LEVELS.map((s) => ({ value: s.value as number | null, label: s.label }))].map((s) => {
                        const on = spiceLevel === s.value;
                        return (
                            <button key={s.label} type="button" role="radio" aria-checked={on} disabled={disabled}
                                onClick={() => onChange({ allergens, spiceLevel: s.value })}
                                className={cn(CHIP, 'justify-center rounded-xl px-2 text-center', on ? ON : OFF)}>
                                {s.label}
                            </button>
                        );
                    })}
                </div>
            </fieldset>
        </div>
    );
}
