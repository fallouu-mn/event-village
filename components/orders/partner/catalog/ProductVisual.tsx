import React from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { cn } from '@/components/ui/cn';

/**
 * Lot 12c — photo d'un produit au format des cartes (16:10), ou illustration de repli sur les jetons du thème (aucune
 * image distante inventée). `alt` vide : la carte porte déjà le nom du produit.
 */
export function ProductVisual({ src, className, size = 'card' }: { src: string | null | undefined; className?: string; size?: 'card' | 'thumb' }) {
    const thumb = size === 'thumb';
    return (
        <div className={cn('relative overflow-hidden bg-primary-soft', thumb ? 'h-16 w-16 flex-shrink-0 rounded-xl' : 'aspect-[16/10] w-full', className)}>
            {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- image publique du dossier des produits, taille inconnue
                <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-primary-text" aria-hidden="true">
                    <UtensilsCrossed size={thumb ? 24 : 40} strokeWidth={1.5} />
                </div>
            )}
        </div>
    );
}
