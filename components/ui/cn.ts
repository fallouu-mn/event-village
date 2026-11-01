import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Fusion de classes Tailwind (clsx puis tailwind-merge) qui connaît les utilitaires du système de design :
 * `text-caption` est une taille de texte (et non une couleur), pour qu'elle ne remplace pas `text-fg`.
 */
const merge = extendTailwindMerge({
    extend: {
        classGroups: {
            'font-size': [{ text: ['caption'] }],
        },
    },
});

export function cn(...inputs: ClassValue[]): string {
    return merge(clsx(inputs));
}
