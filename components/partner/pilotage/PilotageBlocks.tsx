import React from 'react';
import { cn } from '@/components/ui/cn';
import { formatInteger } from '@/lib/format';

/** Bloc titré d'un onglet du pilotage (titre h2, description, action à droite). */
export function PilotageSection({
    title,
    description,
    action,
    children,
    className,
}: {
    title: string;
    description?: React.ReactNode;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    const id = `section-${title.normalize('NFD').replace(/[^\w]+/g, '-').toLowerCase()}`;
    return (
        <section aria-labelledby={id} className={cn('flex flex-col gap-3', className)}>
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="min-w-0">
                    <h2 id={id} className="text-lg font-bold text-fg">{title}</h2>
                    {description && <p className="text-sm leading-relaxed text-fg-muted">{description}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

export interface BarItem {
    key: string;
    label: React.ReactNode;
    value: number;
    /** Valeur secondaire affichée à droite (« 3 refus »). */
    detail?: React.ReactNode;
}

/**
 * Barres horizontales accessibles : chaque ligne porte son libellé et sa valeur en texte (la barre ne fait
 * que la doubler). L'échelle (`max`) sert au dessin seulement ; aucun total n'est calculé ici.
 */
export function BarList({ items, max, unit, emptyLabel, ariaLabel }: {
    items: BarItem[];
    max: number;
    /** Unité, ou [singulier, pluriel] pour accorder à la valeur (« 1 billet », « 2 billets », jamais « billet(s) »). */
    unit: string | readonly [string, string];
    emptyLabel: string;
    ariaLabel: string;
}) {
    if (items.length === 0) {
        return <p className="rounded-2xl border border-dashed border-border bg-surface p-4 text-sm text-fg-muted">{emptyLabel}</p>;
    }
    const scale = max > 0 ? max : 1;
    return (
        <ul aria-label={ariaLabel} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4">
            {items.map((item) => (
                <li key={item.key} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="min-w-0 break-words text-fg">{item.label}</span>
                        <span className="flex-shrink-0 font-semibold text-fg tabular-nums">
                            {formatInteger(item.value)} {typeof unit === 'string' ? unit : unit[item.value > 1 ? 1 : 0]}
                            {item.detail && <span className="ml-2 font-normal text-fg-muted">{item.detail}</span>}
                        </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${Math.min(100, (item.value / scale) * 100)}%` }} />
                    </div>
                </li>
            ))}
        </ul>
    );
}

/** Ligne « libellé : valeur » d'une liste de définitions. */
export function DefinitionRow({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
    return (
        <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-b-0">
            <dt className="text-sm text-fg-muted">{label}</dt>
            <dd className="text-right text-sm font-semibold text-fg tabular-nums">{value}</dd>
        </div>
    );
}

/**
 * Valeur d'un KpiCard dans une grille de deux colonnes sur mobile (390 px) : un cran plus petite sous `sm`
 * pour tenir dans la demi-largeur de la carte, sans défilement horizontal.
 */
export function KpiValue({ children }: { children: React.ReactNode }) {
    return <span className="text-xl sm:text-2xl">{children}</span>;
}

/** Nombre puis unité d'un montant formaté par formatFcfa (« 351 000 F CFA » → « 351 000 », « F CFA »). */
const AMOUNT_PARTS_RE = /^(.*\d)\s+(\D+)$/;

/**
 * Montant d'un KpiCard, tel que formaté par formatFcfa : le nombre et l'unité restent chacun insécables,
 * et l'unité passe sous le nombre quand la carte est étroite (jamais de coupure au milieu du nombre).
 */
export function KpiAmount({ value }: { value: string }) {
    const parts = AMOUNT_PARTS_RE.exec(value);
    if (!parts) return <KpiValue>{value}</KpiValue>;
    return (
        <KpiValue>
            <span className="whitespace-nowrap">{parts[1]}</span> <span className="whitespace-nowrap">{parts[2]}</span>
        </KpiValue>
    );
}
