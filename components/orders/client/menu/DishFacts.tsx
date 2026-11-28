'use client';

/**
 * Lot 12d (points 6 et 7) — carte des plats du client :
 *  - DishFacts : allergènes (libellés de la liste fermée) et niveau de piment d'un plat, sur sa fiche ;
 *  - PauseBanner : pause des commandes de l'établissement (« Ce restaurant reprend les commandes à 13 h 30 »), heure
 *    servie par la base (ordering.pausedUntil, « AAAA-MM-JJTHH:MI », heure de Dakar) ;
 *  - NoSpiceToggle : filtre « Sans piment » (niveau de piment 0, renseigné par l'établissement).
 */
import { Flame, PauseCircle } from 'lucide-react';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { allergenLabels, spiceLabel } from '../../order-extras';

/** « 2026-12-05T13:30 » → « 13 h 30 » (« 13 h » à l'heure pile). */
export function pauseHour(value: string | null | undefined): string {
    const m = /T(\d{2}):(\d{2})/.exec(value ?? '');
    if (!m) return '';
    const h = String(Number(m[1]));
    return m[2] === '00' ? `${h} h` : `${h} h ${m[2]}`;
}

export function PauseBanner({ pausedUntil }: { pausedUntil: string | null | undefined }) {
    if (!pausedUntil) return null;
    const hour = pauseHour(pausedUntil);
    return (
        <StatusBanner tone="warning" icon={<PauseCircle size={20} />} title={hour ? `Ce restaurant reprend les commandes à ${hour}` : 'Ce restaurant fait une courte pause'}>
            <p data-testid="pause-commandes">Il fait une courte pause pour servir les commandes en cours. Vous pouvez préparer votre panier : vous commanderez dès la reprise.</p>
        </StatusBanner>
    );
}

export function DishFacts({ allergens, spiceLevel }: { allergens: string[] | null | undefined; spiceLevel: number | null | undefined }) {
    const labels = allergenLabels(allergens ?? []);
    const spice = typeof spiceLevel === 'number' ? spiceLabel(spiceLevel) : null;
    if (labels.length === 0 && !spice) return null;
    return (
        <div className="space-y-3 rounded-2xl border border-border bg-muted/50 p-4">
            {spice && (
                <p className="flex flex-wrap items-center gap-2 text-base text-foreground-strong">
                    <span className="inline-flex items-center gap-0.5 text-danger-text" aria-hidden="true">
                        {spiceLevel === 0
                            ? <Flame size={18} className="text-muted-foreground opacity-50" />
                            : Array.from({ length: spiceLevel as number }, (_, i) => <Flame key={i} size={18} fill="currentColor" />)}
                    </span>
                    <span className="font-semibold">{spiceLevel === 0 ? spice : `${spice} (${spiceLevel}/3)`}</span>
                </p>
            )}
            {labels.length > 0 && (
                <div>
                    <p className="text-sm font-semibold text-foreground-strong">Allergènes</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Allergènes du plat">
                        {labels.map((l) => (
                            <li key={l} className="rounded-full border border-warning-border bg-warning-soft px-2.5 py-1 text-sm font-medium text-warning-text">{l}</li>
                        ))}
                    </ul>
                </div>
            )}
            {labels.length === 0 && spice && <p className="text-sm text-muted-foreground">Allergènes : non indiqués par l’établissement.</p>}
        </div>
    );
}

export function NoSpiceToggle({ active, onChange, count }: { active: boolean; onChange: (v: boolean) => void; count: number }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={() => onChange(!active)}
            className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                active ? 'border-primary-text bg-primary-soft text-primary-text' : 'border-border bg-card text-foreground-strong hover:bg-muted',
            )}
        >
            <Flame size={16} aria-hidden="true" className={active ? '' : 'text-muted-foreground'} />
            Sans piment
            {active && <span className="tabular-nums">{`(${count})`}</span>}
        </button>
    );
}
