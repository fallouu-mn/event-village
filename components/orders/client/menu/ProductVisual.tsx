import React, { createContext, useContext } from 'react';
import Image from 'next/image';
import { cn } from '@/components/ui/cn';
import { isProjectStorageImage } from '@/lib/events/event-image';
import { dishVisualSrc, type DishVisual } from '@/lib/orders/dish-visual';

/**
 * Lot 12b — photo d'un plat : seulement une photo du stockage du projet (next/image) ; sinon un visuel dessiné par
 * catégorie (fichier local public/images/plats/, choisi par le serveur : correctifs après contre-vérification, idée 13),
 * sur un fond des jetons (jamais une image venue d'un site extérieur). La place est réservée par le parent (aucun saut).
 */
/** Visuels des plats de la carte (menu.visuals), posés par MenuView. */
export const DishVisualsContext = createContext<Record<string, DishVisual>>({});

export function ProductVisual({ image, name, productId, sizes, priority = false, className }: {
    image: string | null;
    name: string;
    productId: string;
    sizes: string;
    priority?: boolean;
    className?: string;
}) {
    const visual = useContext(DishVisualsContext)[productId] ?? 'plat';
    if (isProjectStorageImage(image)) {
        return (
            <span className={cn('relative block overflow-hidden bg-muted', className)}>
                <Image src={image} alt={name} fill sizes={sizes} priority={priority} loading={priority ? undefined : 'lazy'} className="object-cover" />
            </span>
        );
    }
    return (
        <span
            className={cn('relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-soft to-muted text-primary-text', className)}
            role="img"
            aria-label={`${name} (sans photo)`}
        >
            <span aria-hidden="true" className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-card opacity-40" />
            <span aria-hidden="true" className="absolute -bottom-8 -left-4 h-20 w-20 rounded-full bg-card opacity-30" />
            {/* eslint-disable-next-line @next/next/no-img-element -- dessin local (SVG), aucune optimisation utile */}
            <img src={dishVisualSrc(visual)} alt="" aria-hidden="true" loading={priority ? 'eager' : 'lazy'} decoding="async" className="relative h-full max-h-40 w-full object-contain p-2" />
        </span>
    );
}
