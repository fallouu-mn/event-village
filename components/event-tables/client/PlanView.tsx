'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import dynamic from 'next/dynamic';
import { Minus, Plus, Scan } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { formatFcfa } from '@/lib/format';
import type { FloorPlanTable, FloorPlanZone } from '@/components/tables/plan/FloorPlan';
import { loadFloorPlan } from '@/components/tables/plan/load';
import { perPersonText, type OfferTable, type OfferType, type OfferZone } from './offer-api';

/**
 * Lot 11c-b — plan de salle en mode choix, pour une table d'un événement.
 *
 *  - Plan partagé (FloorPlan, mode `select`) chargé par son chargeur unique : libre = contour plein, prise = hachurée avec
 *    le mot « Prise », la mienne = coche ; la couleur n'est jamais seule.
 *  - Zoom : pincement à deux doigts (le défilement à un doigt reste celui du navigateur), boutons « Agrandir » / « Réduire »
 *    / « Plan entier » (WCAG 2.5.7 : aucun geste exigé) et touches + et − ; plan agrandi = plan plus large dans une zone qui
 *    défile (rien n'est recalculé, les positions restent en % du plan).
 *  - Survol à la souris ou focus au clavier : petite carte « Table 7 · Carré VIP, 6 places, 25 000 F par personne ».
 *  - Table prise pendant qu'on regarde : courte animation (échelle et opacité, 240 ms, coupée si « réduire les
 *    animations »), le message est dit par l'écran parent.
 */

const FloorPlan = dynamic(() => loadFloorPlan().then((m) => ({ default: m.FloorPlan })), {
    ssr: false,
    loading: () => <div className="aspect-[4/3] w-full rounded-2xl bg-muted" aria-hidden="true" />,
});

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.5;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100));

const LABELS = {
    PRISE: { legend: 'Prise', spoken: 'prise' },
    CHOISIE: { legend: 'Votre table', spoken: 'votre table' },
    HORS_CAPACITE: { legend: 'Pas encore en vente', spoken: 'pas en vente pour le moment' },
} as const;

export interface PlanViewProps {
    tables: OfferTable[];
    zones: OfferZone[];
    types: OfferType[];
    selectedId: string | null;
    onSelect: (tableId: string) => void;
    /** Tables qui viennent d'être prises (animation une fois). */
    justTaken: string[];
    /** Le plan remplit la hauteur disponible (feuille plein écran). */
    fill?: boolean;
}

interface Hover { id: string; left: number; top: number }

export function PlanView({ tables, zones, types, selectedId, onSelect, justTaken, fill = false }: PlanViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const anchorRef = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null);
    const zoomRef = useRef(1);
    useEffect(() => { zoomRef.current = zoom; }, [zoom]);
    const [hover, setHover] = useState<Hover | null>(null);

    const typeOf = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);

    const planTables: FloorPlanTable[] = useMemo(() => tables.map((t) => {
        const type = typeOf.get(t.typeId);
        const onSale = Boolean(type) && !type?.refusal;
        return {
            id: t.id, number: String(t.number), capacity: type?.seats ?? 2, x: t.x, y: t.y, shape: t.shape, rotation: t.rotation,
            state: !onSale ? 'HORS_CAPACITE' : t.state === 'LIBRE' ? 'LIBRE' : 'PRISE',
        };
    }), [tables, typeOf]);
    const planZones: FloorPlanZone[] = useMemo(() => zones.map((z) => ({ ...z })), [zones]);

    /** Zoom autour d'un point de la zone visible (fx, fy en fraction de la zone), qui reste sous le doigt ou au centre. */
    const zoomTo = useCallback((next: number, fx = 0.5, fy = 0.5) => {
        const box = scrollRef.current;
        setZoom((prev) => {
            const z = clampZoom(next);
            if (box && z !== prev) {
                const cx = (box.scrollLeft + fx * box.clientWidth) / box.scrollWidth;
                const cy = (box.scrollTop + fy * box.clientHeight) / box.scrollHeight;
                anchorRef.current = { fx, fy, cx, cy };
            }
            return z;
        });
    }, []);

    useLayoutEffect(() => {
        const box = scrollRef.current;
        const a = anchorRef.current;
        if (!box || !a) return;
        anchorRef.current = null;
        box.scrollLeft = a.cx * box.scrollWidth - a.fx * box.clientWidth;
        box.scrollTop = a.cy * box.scrollHeight - a.fy * box.clientHeight;
    }, [zoom]);

    // Pincement à deux doigts : écouteurs non passifs (le navigateur ne zoome pas la page, il défile toujours à un doigt)
    useEffect(() => {
        const box = scrollRef.current;
        if (!box) return undefined;
        let start: { dist: number; zoom: number } | null = null;
        const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
        const mid = (t: TouchList) => {
            const r = box.getBoundingClientRect();
            return { fx: ((t[0].clientX + t[1].clientX) / 2 - r.left) / r.width, fy: ((t[0].clientY + t[1].clientY) / 2 - r.top) / r.height };
        };
        const onStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                start = { dist: dist(e.touches), zoom: zoomRef.current };
                setHover(null);
            }
        };
        const onMove = (e: TouchEvent) => {
            if (!start || e.touches.length !== 2) return;
            e.preventDefault();
            const m = mid(e.touches);
            zoomTo(start.zoom * (dist(e.touches) / Math.max(1, start.dist)), m.fx, m.fy);
        };
        const onEnd = (e: TouchEvent) => { if (e.touches.length < 2) start = null; };
        box.addEventListener('touchstart', onStart, { passive: true });
        box.addEventListener('touchmove', onMove, { passive: false });
        box.addEventListener('touchend', onEnd, { passive: true });
        box.addEventListener('touchcancel', onEnd, { passive: true });
        return () => {
            box.removeEventListener('touchstart', onStart);
            box.removeEventListener('touchmove', onMove);
            box.removeEventListener('touchend', onEnd);
            box.removeEventListener('touchcancel', onEnd);
        };
    }, [zoomTo]);

    // Table qui vient d'être prise : échelle et opacité seulement (Web Animations), coupée si « réduire les animations »
    useEffect(() => {
        if (justTaken.length === 0 || !frameRef.current) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        for (const id of justTaken) {
            const el = frameRef.current.querySelector<HTMLElement>(`[data-table-id="${CSS.escape(id)}"]`);
            el?.animate(
                [{ scale: '1', opacity: 1 }, { scale: '0.86', opacity: 0.55 }, { scale: '1', opacity: 1 }],
                { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
            );
        }
    }, [justTaken]);

    const showHover = (target: EventTarget | null) => {
        const el = target instanceof Element ? target.closest<HTMLElement>('[data-table-id]') : null;
        const frame = frameRef.current;
        if (!el || !frame) { setHover(null); return; }
        const r = el.getBoundingClientRect();
        const f = frame.getBoundingClientRect();
        setHover({ id: el.dataset.tableId ?? '', left: r.left - f.left + r.width / 2, top: r.top - f.top });
    };

    const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomTo(zoom + ZOOM_STEP); }
        if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomTo(zoom - ZOOM_STEP); }
    };

    const hovered = hover ? tables.find((t) => t.id === hover.id) ?? null : null;
    const hoveredType = hovered ? typeOf.get(hovered.typeId) ?? null : null;

    return (
        <div className={fill ? 'flex h-full min-h-0 flex-col gap-2' : 'space-y-2'}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Touchez une table libre. Pincez ou utilisez les boutons pour zoomer.</p>
                <div className="flex flex-shrink-0 items-center gap-1" role="group" aria-label="Zoom du plan">
                    <IconButton aria-label="Réduire le plan" variant="secondary" onClick={() => zoomTo(zoom - ZOOM_STEP)} disabled={zoom <= ZOOM_MIN}>
                        <Minus size={18} />
                    </IconButton>
                    <IconButton aria-label="Plan entier" variant="secondary" onClick={() => zoomTo(1)} disabled={zoom === 1}>
                        <Scan size={18} />
                    </IconButton>
                    <IconButton aria-label="Agrandir le plan" variant="secondary" onClick={() => zoomTo(zoom + ZOOM_STEP)} disabled={zoom >= ZOOM_MAX}>
                        <Plus size={18} />
                    </IconButton>
                </div>
            </div>
            <div ref={frameRef} className={fill ? 'relative min-h-0 flex-1' : 'relative'}>
                <div
                    ref={scrollRef}
                    data-zoom={zoom}
                    onKeyDown={onKey}
                    onPointerOver={(e) => { if (e.pointerType === 'mouse') showHover(e.target); }}
                    onPointerLeave={() => setHover(null)}
                    onFocus={(e) => showHover(e.target)}
                    onBlur={() => setHover(null)}
                    onScroll={() => setHover(null)}
                    className={fill ? 'h-full overflow-auto overscroll-contain rounded-2xl [touch-action:pan-x_pan-y]' : 'max-h-[70vh] overflow-auto overscroll-contain rounded-2xl [touch-action:pan-x_pan-y]'}
                >
                    <div style={{ width: `${zoom * 100}%` }}>
                        <FloorPlan
                            tables={planTables}
                            zones={planZones}
                            mode="select"
                            selectedId={selectedId}
                            onSelect={onSelect}
                            ariaLabel="Plan de la salle : choisissez votre table"
                            labels={LABELS}
                        />
                    </div>
                </div>
                {hovered && hoveredType && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute z-30 w-max max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-popover px-3 py-2 text-sm text-foreground shadow-popover"
                        style={{ left: hover!.left, top: hover!.top - 8 }}
                    >
                        <p className="font-semibold text-foreground-strong">Table {hovered.number} · {hoveredType.name}</p>
                        <p className="tabular-nums">{hoveredType.seats} places · {perPersonText(formatFcfa(hoveredType.pricePerPerson), hoveredType.pricePerPersonExact)}</p>
                        <p className="text-muted-foreground">{hoveredType.refusal ? 'Pas encore en vente' : hovered.state === 'LIBRE' ? 'Libre' : 'Prise'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
