import React from 'react';
import { cn } from '@/components/ui/cn';
import type { SamirPayOperatorName } from '@/lib/samirpay/types';

/**
 * Design 1c (point 5) — logo officiel d'un opérateur de paiement (fichiers du client, docs/design/paiement/,
 * redimensionnés et réencodés seulement par docs/design/outils/logos-paiement.mjs : jamais recadrés ni recolorés).
 *
 * Toujours posé sur une pastille blanche arrondie, en clair comme en sombre : le logo garde ses couleurs et son cadre
 * d'origine (le carré d'Orange Money a une marge blanche) et reste lisible sur tous les fonds. Image décorative
 * (alt vide) : le nom de l'opérateur est TOUJOURS écrit à côté par l'appelant.
 */
const SOURCES: Record<SamirPayOperatorName, string> = {
    WAVE: '/images/paiement/wave.webp',
    ORANGE_MONEY: '/images/paiement/om.webp',
};

const SIZES = {
    sm: { box: 'h-7 w-7 p-0.5', px: 24 },
    md: { box: 'h-10 w-10 p-1', px: 32 },
    lg: { box: 'h-12 w-12 p-1', px: 40 },
} as const;

export function OperatorLogo({ operator, size = 'md', className }: { operator: SamirPayOperatorName; size?: keyof typeof SIZES; className?: string }) {
    const s = SIZES[size];
    return (
        <span
            aria-hidden="true"
            data-operator-logo={operator}
            className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-op-logo ring-1 ring-inset ring-border', s.box, className)}
        >
            {/* eslint-disable-next-line @next/next/no-img-element -- fichier statique de 3 à 6 Ko, déjà à la bonne taille */}
            <img src={SOURCES[operator]} alt="" width={s.px} height={s.px} decoding="async" className="h-full w-full object-contain" />
        </span>
    );
}
