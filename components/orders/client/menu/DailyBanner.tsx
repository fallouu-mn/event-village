import React from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { formatFcfa } from '@/lib/format';
import type { MenuProduct } from '@/lib/orders/menu-types';
import { ProductVisual } from './ProductVisual';

/** « Plus que 12 portions aujourd'hui », « Dernière portion aujourd'hui », « Plus de portions aujourd'hui ». */
export function portionsText(p: MenuProduct): string {
    const left = p.portionsLeft ?? 0;
    if (left <= 0) return 'Plus de portions aujourd’hui';
    if (left === 1) return 'Dernière portion aujourd’hui';
    return `Plus que ${left} portions aujourd’hui`;
}

/**
 * Lot 12b — plat(s) du jour en bandeau : photo, prix, jauge des portions restantes (portions servies par la base ;
 * la jauge n'est qu'un rapport de deux nombres servis, aucun montant).
 */
export function DailyBanner({ products, onOpen }: { products: MenuProduct[]; onOpen: (p: MenuProduct) => void }) {
    if (products.length === 0) return null;
    return (
        <section aria-labelledby="plat-du-jour" className="space-y-3">
            <h2 id="plat-du-jour" className="flex items-center gap-2 text-xl font-bold text-foreground-strong">
                <Flame size={20} aria-hidden="true" className="text-brand-vif" />
                {products.length > 1 ? 'Plats du jour' : 'Plat du jour'}
            </h2>
            <div className={cn('grid gap-3', products.length > 1 && 'md:grid-cols-2')}>
                {products.map((p) => {
                    const total = Math.max(p.portionsTotal ?? 0, 1);
                    const left = Math.max(p.portionsLeft ?? 0, 0);
                    const ratio = Math.min(left / total, 1);
                    const low = left > 0 && ratio <= 0.25;
                    return (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => onOpen(p)}
                            className="ev-press group flex w-full items-stretch overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-primary-soft to-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={`Plat du jour : ${p.name}, ${portionsText(p)}`}
                        >
                            <ProductVisual image={p.image} name={p.name} visual={p.visual} sizes="(min-width: 768px) 200px, 40vw" priority className="w-2/5 min-h-36 flex-shrink-0 sm:w-48" />
                            <span className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                                <span className="text-sm font-semibold text-primary-text">Aujourd’hui seulement</span>
                                <span className="text-xl font-extrabold leading-snug text-foreground-strong">{p.name}</span>
                                <span className="text-lg font-bold tabular-nums text-foreground-strong">{formatFcfa(p.price)}</span>
                                <span className="mt-auto space-y-1.5">
                                    <span className={cn('block text-sm font-semibold tabular-nums', left <= 0 ? 'text-muted-foreground' : low ? 'text-warning-text' : 'text-foreground')}>
                                        {portionsText(p)}
                                    </span>
                                    <span className="block h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                                        <span
                                            className={cn('block h-full origin-left rounded-full transition-transform duration-slow ease-out', low ? 'bg-warning' : 'bg-brand-vif')}
                                            style={{ transform: `scaleX(${ratio})` }}
                                        />
                                    </span>
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
