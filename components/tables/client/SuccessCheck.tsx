'use client';

/**
 * Lot 11b (écrans du client) : coche de confirmation qui se dessine (cercle puis trait), 600 ms, une seule fois.
 * Transition du tracé (stroke-dashoffset) seulement si l'utilisateur accepte les animations (motion-safe) ; sinon la
 * coche est là tout de suite (et le bloc « mouvement réduit » d'app/globals.css coupe toute durée). Décorative : le
 * texte qui l'accompagne dit ce qui s'est passé.
 */
import React, { useEffect, useState } from 'react';
import { cn } from '@/components/ui/cn';

export function SuccessCheck({ tone = 'success', className }: { tone?: 'success' | 'warning' | 'info'; className?: string }) {
    const [drawn, setDrawn] = useState(false);
    useEffect(() => {
        const frame = requestAnimationFrame(() => setDrawn(true));
        return () => cancelAnimationFrame(frame);
    }, []);
    const color = tone === 'success' ? 'text-success-text' : tone === 'warning' ? 'text-warning-text' : 'text-info-text';
    const soft = tone === 'success' ? 'bg-success-soft' : tone === 'warning' ? 'bg-warning-soft' : 'bg-info-soft';
    return (
        <span className={cn('inline-flex h-20 w-20 items-center justify-center rounded-full', soft, color, className)} aria-hidden="true">
            <svg viewBox="0 0 52 52" className="h-14 w-14" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                <circle
                    cx="26"
                    cy="26"
                    r="23"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={drawn ? 0 : 1}
                    className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500 motion-safe:ease-out"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
                <path
                    d="M15 27 l7.5 7.5 L37.5 19"
                    pathLength={1}
                    strokeDasharray={1}
                    strokeDashoffset={drawn ? 0 : 1}
                    className="motion-safe:transition-[stroke-dashoffset] motion-safe:delay-300 motion-safe:duration-300 motion-safe:ease-out"
                />
            </svg>
        </span>
    );
}
