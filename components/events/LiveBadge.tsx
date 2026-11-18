'use client';

import { cn } from '@/components/ui/cn';
import type { LiveWindow } from '@/lib/events/live-status';
import { useLiveNow } from './useLiveNow';

/**
 * Design 1b (point 11) — badge flottant « En cours » avec un point qui pulse (fixe si « réduire les animations »), posé
 * sur l'affiche d'une carte. N'apparaît qu'entre le début et la fin retenue, calculé sur le téléphone (useLiveNow).
 * Couleurs : fond sombre opaque et texte blanc, lisibles sur n'importe quelle affiche ; point au vert du résultat « entrée validée » (jeton scan-accept-bg).
 */
export function LiveBadge({ window, className }: { window: LiveWindow | null; className?: string }) {
    const live = useLiveNow(window);
    if (!live) return null;
    return (
        <span
            className={cn(
                'pointer-events-none inline-flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1 text-xs font-bold text-white shadow-sm',
                className,
            )}
        >
            <span aria-hidden="true" className="ev-live-dot relative inline-flex h-2 w-2 rounded-full bg-scan-accept-bg" />
            En cours
        </span>
    );
}
