import React from 'react';
import Image from 'next/image';
import { UtensilsCrossed } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { isProjectStorageImage } from '@/lib/events/event-image';

/**
 * Lot 12b — photo d'un plat : seulement une photo du stockage du projet (next/image) ; sinon un visuel dessiné ici, sur
 * les jetons (jamais une image venue d'un site extérieur). La place est réservée par le parent (aucun saut).
 */
export function ProductVisual({ image, name, sizes, priority = false, className }: {
    image: string | null;
    name: string;
    sizes: string;
    priority?: boolean;
    className?: string;
}) {
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
            <UtensilsCrossed aria-hidden="true" size={32} strokeWidth={1.5} className="relative" />
        </span>
    );
}
