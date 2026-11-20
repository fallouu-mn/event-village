'use client';

/**
 * Lot 10b (point 2, correctifs) : glisser au doigt d'une photo à l'autre, sans bibliothèque (événements pointer).
 *  - Le geste ne démarre qu'après 8 px de mouvement, et seulement s'il est plus horizontal que vertical : le défilement
 *    vertical de la page reste au navigateur (à poser avec `touch-pan-y` sur la zone).
 *  - Photo suivante ou précédente au lâcher au-delà du seuil (le cinquième de la largeur, 80 px au plus) ou sur un geste
 *    vif (plus de 30 px en moins de 250 ms) ; en deçà, la photo revient à sa place.
 *  - `offset` suit le doigt pendant le geste (translation seulement) ; `dragging` coupe la transition pendant le geste.
 *  - `consumeSwipe()` dit si le dernier toucher était un glisser, pour ne pas le prendre aussi pour un appui.
 *  - Les boutons et les flèches du clavier restent l'autre moyen (le glisser n'est jamais le seul).
 */
import { useCallback, useRef, useState } from 'react';
import type React from 'react';

const START_PX = 8;
const MAX_THRESHOLD_PX = 80;
const FLICK_PX = 30;
const FLICK_MS = 250;

interface Options {
    onPrev: () => void;
    onNext: () => void;
    enabled: boolean;
    /** Freinage au-delà de la première ou de la dernière photo (pas de photo de ce côté). */
    atStart?: boolean;
    atEnd?: boolean;
}

interface Gesture {
    id: number;
    x: number;
    y: number;
    t: number;
    active: boolean;
}

export function useSwipe({ onPrev, onNext, enabled, atStart = false, atEnd = false }: Options) {
    const gesture = useRef<Gesture | null>(null);
    const swiped = useRef(false);
    const [offset, setOffset] = useState(0);
    const [dragging, setDragging] = useState(false);

    const reset = useCallback(() => {
        gesture.current = null;
        setDragging(false);
        setOffset(0);
    }, []);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
        if (!enabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, active: false };
        swiped.current = false;
    }, [enabled]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
        const g = gesture.current;
        if (!g || g.id !== e.pointerId) return;
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        if (!g.active) {
            if (Math.abs(dx) < START_PX && Math.abs(dy) < START_PX) return;
            if (Math.abs(dy) >= Math.abs(dx)) {
                gesture.current = null;
                return;
            }
            g.active = true;
            setDragging(true);
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
                // Capture refusée (pointeur déjà relâché) : le geste continue sans elle.
            }
        }
        const blocked = (dx > 0 && atStart) || (dx < 0 && atEnd);
        setOffset(blocked ? dx / 3 : dx);
    }, [atStart, atEnd]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
        const g = gesture.current;
        if (!g || g.id !== e.pointerId) return;
        if (g.active) {
            const dx = e.clientX - g.x;
            const width = e.currentTarget.clientWidth || 320;
            const threshold = Math.min(MAX_THRESHOLD_PX, width / 5);
            const flick = Math.abs(dx) > FLICK_PX && e.timeStamp - g.t < FLICK_MS;
            swiped.current = true;
            if ((dx <= -threshold || (flick && dx < 0)) && !atEnd) onNext();
            else if ((dx >= threshold || (flick && dx > 0)) && !atStart) onPrev();
        }
        reset();
    }, [atStart, atEnd, onNext, onPrev, reset]);

    const consumeSwipe = useCallback(() => {
        const was = swiped.current;
        swiped.current = false;
        return was;
    }, []);

    return {
        offset,
        dragging,
        consumeSwipe,
        handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset },
    };
}
