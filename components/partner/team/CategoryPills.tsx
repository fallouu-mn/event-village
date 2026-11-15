'use client';

/**
 * Finition 1, complément 9 — ce qu'une porte laisse entrer : une pastille de la couleur de chaque catégorie au contrôle
 * (jetons --scan-cat-<clé>, palette fermée du scanner) suivie du nom ; la couleur est aussi écrite pour les lecteurs
 * d'écran (« VIP, pastille or »). Sans zone sur l'événement : « Toutes les catégories ».
 */
import React from 'react';
import { isScanCategoryColor, SCAN_CATEGORY_COLOR_LABELS, type ScanCategoryColor } from '@/lib/scan/scan-result';
import type { TeamCategory } from './team-types';

const DOT: Record<ScanCategoryColor, string> = {
    BLANC: 'bg-scan-cat-blanc-bg',
    OR: 'bg-scan-cat-or-bg',
    ARGENT: 'bg-scan-cat-argent-bg',
    ROSE: 'bg-scan-cat-rose-bg',
    TURQUOISE: 'bg-scan-cat-turquoise-bg',
    BLEU: 'bg-scan-cat-bleu-bg',
    VIOLET: 'bg-scan-cat-violet-bg',
    NOIR: 'bg-scan-cat-noir-bg',
};

export function CategoryPill({ category }: { category: TeamCategory }) {
    const color = isScanCategoryColor(category.scan_color) ? category.scan_color : null;
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-sm text-fg">
            {color && <span aria-hidden="true" className={`h-3 w-3 flex-shrink-0 rounded-full border border-border-strong ${DOT[color]}`} />}
            <span>{category.name}</span>
            {color && <span className="sr-only">{`, pastille ${SCAN_CATEGORY_COLOR_LABELS[color].toLowerCase()}`}</span>}
        </span>
    );
}

/** « Laisse entrer : … » d'une porte, ou « Toutes les catégories » sans zone. */
export function GateAdmits({ categories, hasZones }: { categories: TeamCategory[] | null; hasZones: boolean }) {
    if (!hasZones) return <p className="text-sm text-fg-muted">Laisse entrer : toutes les catégories</p>;
    if (!categories) return null;
    if (categories.length === 0) return <p className="text-sm font-semibold text-warning-fg">Cette porte ne laisse entrer aucune catégorie.</p>;
    return (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-fg-muted">Laisse entrer :</span>
            {categories.map((c) => <CategoryPill key={c.name} category={c} />)}
        </div>
    );
}
