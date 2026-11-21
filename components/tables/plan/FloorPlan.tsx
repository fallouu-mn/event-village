'use client';

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Clock, Lock, MapPin, Minus, Plus, RotateCw, Undo2, UserCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import {
    SHAPES,
    SHAPE_LABEL,
    ZONE_DEFAULT_H,
    ZONE_DEFAULT_W,
    ZONE_MIN,
    clamp,
    clampZone,
    freeSpot,
    freeZoneSpot,
    nextRotation,
    round1,
    tableAspect,
    tableMinPx,
    tableWidthPct,
} from './floor-geometry';

/**
 * Lot 11b — plan de salle partagé (interface figée par le cahier des écrans : mêmes types et mêmes props pour les
 * écrans du client, du planning et de l'édition).
 *  - Positions en % du plan (0 à 100), plan au format 4:3 qui suit la largeur. Tables : (x, y) = centre ; zones :
 *    (x, y) = coin haut gauche, (w, h) = taille (contraintes de la base : 5 à 100, dans le cadre).
 *  - `view` : lecture (planning : chaque table ouvre sa réservation si `onSelect`).
 *  - `select` : seules les tables libres se choisissent (bouton, aria-pressed) ; prises et hors capacité grisées,
 *    raison dans le nom accessible.
 *  - `edit` : déplacer tables et zones au doigt et à la souris (Pointer Events, capture du pointeur ; `touch-action:
 *    none` posé sur chaque élément déplaçable pour que le reste du plan laisse défiler la page au doigt), au clavier
 *    (flèches 1 %, Maj + flèches 5 %, R pour tourner), et sans glisser (WCAG 2.5.7 : flèches du panneau de réglage) ;
 *    rotation par 15°, forme, poignée de taille des zones ; tables et zones sans position listées « À placer ».
 *  Couleurs : jetons du système de design seulement (libre = success, prise = muted, choisie = primary, hors capacité =
 *  muted barré, arrivée = info, attendue = warning) ; la couleur n'est jamais seule (icône, trait, libellé).
 */

export type FloorTableState = 'LIBRE' | 'PRISE' | 'HORS_CAPACITE' | 'CHOISIE' | 'ARRIVEE' | 'ATTENDUE' | null;
export interface FloorPlanTable { id: string; number: string; capacity: number; minCapacity?: number; x: number | null; y: number | null; shape: 'RONDE' | 'CARREE' | 'RECTANGLE'; rotation: number; state?: FloorTableState; hint?: string }
export interface FloorPlanZone { id: string; name: string; x: number | null; y: number | null; w: number | null; h: number | null }
export interface FloorPlanProps {
    tables: FloorPlanTable[];
    zones: FloorPlanZone[];
    mode: 'view' | 'select' | 'edit';
    selectedId?: string | null;
    onSelect?: (tableId: string) => void;
    onChange?: (tables: FloorPlanTable[], zones: FloorPlanZone[]) => void;
    ariaLabel: string;
}

type StateKey = Exclude<FloorTableState, null>;

const STATE_VIEW: Readonly<Record<StateKey, { legend: string; spoken: string; cls: string; shapeCls: string }>> = {
    LIBRE: { legend: 'Libre', spoken: 'libre', cls: 'text-success-text', shapeCls: 'bg-success-soft border-success-border' },
    CHOISIE: { legend: 'Votre choix', spoken: 'choisie', cls: 'text-primary-foreground', shapeCls: 'bg-primary border-primary shadow-md' },
    PRISE: { legend: 'Déjà prise', spoken: 'déjà prise à cette heure', cls: 'text-muted-foreground', shapeCls: 'bg-muted border-border' },
    HORS_CAPACITE: { legend: 'Ne convient pas au groupe', spoken: 'ne convient pas au nombre de personnes', cls: 'text-muted-foreground', shapeCls: 'bg-muted border-dashed border-input' },
    ATTENDUE: { legend: 'Client attendu', spoken: 'client attendu', cls: 'text-warning-text', shapeCls: 'bg-warning-soft border-warning-border' },
    ARRIVEE: { legend: 'Client arrivé', spoken: 'client arrivé', cls: 'text-info-text', shapeCls: 'bg-info-soft border-info-border' },
};

const NEUTRAL = { cls: 'text-foreground-strong', shapeCls: 'bg-card border-input' };

const LEGEND_ORDER: readonly StateKey[] = ['LIBRE', 'CHOISIE', 'ATTENDUE', 'ARRIVEE', 'PRISE', 'HORS_CAPACITE'];

function StateMark({ state }: { state: StateKey | null }) {
    const Icon = state === 'PRISE' ? Lock : state === 'CHOISIE' ? Check : state === 'ARRIVEE' ? UserCheck : state === 'ATTENDUE' ? Clock : null;
    if (!Icon) return null;
    return (
        <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-foreground-strong shadow-sm">
            <Icon size={12} strokeWidth={2.5} />
        </span>
    );
}

function capacityText(t: FloorPlanTable): string {
    const min = t.minCapacity && t.minCapacity > 1 && t.minCapacity < t.capacity ? t.minCapacity : null;
    return min ? `${min} à ${t.capacity} places` : `${t.capacity} place${t.capacity > 1 ? 's' : ''}`;
}

type Kind = 'table' | 'zone';
interface Sel { kind: Kind; id: string }
interface Live { kind: Kind; id: string; x: number; y: number; w: number; h: number }
interface Drag {
    kind: Kind | 'resize';
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    rectW: number;
    rectH: number;
    orig: { x: number; y: number; w: number; h: number };
    half: { x: number; y: number };
    moved: boolean;
}

const placed = (t: FloorPlanTable): t is FloorPlanTable & { x: number; y: number } => t.x !== null && t.y !== null && Number.isFinite(t.x) && Number.isFinite(t.y);
const zonePlaced = (z: FloorPlanZone): z is FloorPlanZone & { x: number; y: number; w: number; h: number } =>
    z.x !== null && z.y !== null && z.w !== null && z.h !== null;

export function FloorPlan({ tables, zones, mode, selectedId = null, onSelect, onChange, ariaLabel }: FloorPlanProps) {
    const uid = useId();
    const gridId = `${uid}-grille`;
    const hintId = `${uid}-aide`;
    const stageRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef(new Map<string, HTMLElement>());
    const dragRef = useRef<Drag | null>(null);
    const [live, setLiveState] = useState<Live | null>(null);
    const liveRef = useRef<Live | null>(null);
    const setLive = useCallback((v: Live | null) => { liveRef.current = v; setLiveState(v); }, []);
    const [sel, setSel] = useState<Sel | null>(selectedId ? { kind: 'table', id: selectedId } : null);
    const [announce, setAnnounce] = useState('');
    const edit = mode === 'edit';

    const placedTables = useMemo(() => tables.filter(placed), [tables]);
    const placedZones = useMemo(() => zones.filter(zonePlaced), [zones]);
    const unplacedTables = useMemo(() => tables.filter((t) => !placed(t)), [tables]);
    const unplacedZones = useMemo(() => zones.filter((z) => !zonePlaced(z)), [zones]);

    const setItemRef = useCallback((key: string) => (el: HTMLElement | null) => {
        if (el) itemRefs.current.set(key, el);
        else itemRefs.current.delete(key);
    }, []);

    /** Demi-taille d'une table en % du plan (pour la garder entière dans le cadre). */
    const halfOf = useCallback((id: string): { x: number; y: number } => {
        const el = itemRefs.current.get(`table:${id}`);
        const stage = stageRef.current;
        if (!el || !stage || stage.clientWidth === 0 || stage.clientHeight === 0) return { x: 0, y: 0 };
        return { x: Math.min(50, (el.offsetWidth / 2 / stage.clientWidth) * 100), y: Math.min(50, (el.offsetHeight / 2 / stage.clientHeight) * 100) };
    }, []);

    const emit = useCallback((nextTables: FloorPlanTable[], nextZones: FloorPlanZone[]) => {
        onChange?.(nextTables, nextZones);
    }, [onChange]);

    const tableName = useCallback((id: string) => `Table ${tables.find((t) => t.id === id)?.number ?? ''}`.trim(), [tables]);
    const zoneName = useCallback((id: string) => `Zone ${zones.find((z) => z.id === id)?.name ?? ''}`.trim(), [zones]);

    const moveTableTo = useCallback((id: string, x: number, y: number, say?: string) => {
        const h = halfOf(id);
        const nx = round1(clamp(x, h.x, 100 - h.x));
        const ny = round1(clamp(y, h.y, 100 - h.y));
        emit(tables.map((t) => (t.id === id ? { ...t, x: nx, y: ny } : t)), zones);
        if (say) setAnnounce(`${say} : ${Math.round(nx)} % depuis la gauche, ${Math.round(ny)} % depuis le haut.`);
    }, [emit, halfOf, tables, zones]);

    const setZoneBox = useCallback((id: string, box: { x: number; y: number; w: number; h: number }, say?: string) => {
        const b = clampZone(box);
        emit(tables, zones.map((z) => (z.id === id ? { ...z, ...b } : z)));
        if (say) setAnnounce(`${say} : ${Math.round(b.w)} % de large, ${Math.round(b.h)} % de haut, à ${Math.round(b.x)} % de la gauche et ${Math.round(b.y)} % du haut.`);
    }, [emit, tables, zones]);

    const nudge = useCallback((s: Sel, dx: number, dy: number) => {
        if (s.kind === 'table') {
            const t = tables.find((v) => v.id === s.id);
            if (t && placed(t)) moveTableTo(t.id, t.x + dx, t.y + dy, tableName(t.id));
        } else {
            const z = zones.find((v) => v.id === s.id);
            if (z && zonePlaced(z)) setZoneBox(z.id, { x: z.x + dx, y: z.y + dy, w: z.w, h: z.h }, zoneName(z.id));
        }
    }, [moveTableTo, setZoneBox, tableName, tables, zoneName, zones]);

    const resizeZone = useCallback((id: string, dw: number, dh: number) => {
        const z = zones.find((v) => v.id === id);
        if (!z || !zonePlaced(z)) return;
        const w = clamp(z.w + dw, ZONE_MIN, 100 - z.x);
        const h = clamp(z.h + dh, ZONE_MIN, 100 - z.y);
        setZoneBox(id, { x: z.x, y: z.y, w, h }, zoneName(id));
    }, [setZoneBox, zoneName, zones]);

    const rotateTable = useCallback((id: string) => {
        const t = tables.find((v) => v.id === id);
        if (!t) return;
        const r = nextRotation(t.rotation);
        emit(tables.map((v) => (v.id === id ? { ...v, rotation: r } : v)), zones);
        setAnnounce(`${tableName(id)} tournée à ${r} degrés.`);
    }, [emit, tableName, tables, zones]);

    const setShape = useCallback((id: string, shape: FloorPlanTable['shape']) => {
        emit(tables.map((v) => (v.id === id ? { ...v, shape } : v)), zones);
        setAnnounce(`${tableName(id)} : forme ${SHAPE_LABEL[shape]}.`);
    }, [emit, tableName, tables, zones]);

    const unplace = useCallback((s: Sel) => {
        if (s.kind === 'table') {
            emit(tables.map((v) => (v.id === s.id ? { ...v, x: null, y: null } : v)), zones);
            setAnnounce(`${tableName(s.id)} retirée du plan.`);
        } else {
            emit(tables, zones.map((v) => (v.id === s.id ? { ...v, x: null, y: null, w: null, h: null } : v)));
            setAnnounce(`${zoneName(s.id)} retirée du plan.`);
        }
        setSel(null);
    }, [emit, tableName, tables, zoneName, zones]);

    const placeTable = useCallback((id: string) => {
        const spot = freeSpot(placedTables);
        emit(tables.map((v) => (v.id === id ? { ...v, x: spot.x, y: spot.y } : v)), zones);
        setSel({ kind: 'table', id });
        onSelect?.(id);
        setAnnounce(`${tableName(id)} posée sur le plan. Déplacez-la au doigt, à la souris ou avec les flèches.`);
    }, [emit, onSelect, placedTables, tableName, tables, zones]);

    const placeAllTables = useCallback(() => {
        const taken: { x: number; y: number }[] = [...placedTables];
        const next = tables.map((v) => {
            if (placed(v)) return v;
            const spot = freeSpot(taken);
            taken.push(spot);
            return { ...v, x: spot.x, y: spot.y };
        });
        emit(next, zones);
        setAnnounce(`${unplacedTables.length} tables posées sur le plan.`);
    }, [emit, placedTables, tables, unplacedTables.length, zones]);

    const placeZone = useCallback((id: string) => {
        const spot = freeZoneSpot(placedZones);
        emit(tables, zones.map((v) => (v.id === id ? { ...v, ...clampZone({ x: spot.x, y: spot.y, w: ZONE_DEFAULT_W, h: ZONE_DEFAULT_H }) } : v)));
        setSel({ kind: 'zone', id });
        setAnnounce(`${zoneName(id)} posée sur le plan.`);
    }, [emit, placedZones, tables, zoneName, zones]);

    const choose = useCallback((s: Sel) => {
        setSel(s);
        if (s.kind === 'table') onSelect?.(s.id);
    }, [onSelect]);

    // ── Glisser (doigt, souris, stylet) ───────────────────────────────────────
    const startDrag = (e: ReactPointerEvent<HTMLElement>, kind: Kind | 'resize', id: string) => {
        if (!edit || !onChange) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        let orig = { x: 0, y: 0, w: 0, h: 0 };
        if (kind === 'table') {
            const t = tables.find((v) => v.id === id);
            if (!t || !placed(t)) return;
            orig = { x: t.x, y: t.y, w: 0, h: 0 };
        } else {
            const z = zones.find((v) => v.id === id);
            if (!z || !zonePlaced(z)) return;
            orig = { x: z.x, y: z.y, w: z.w, h: z.h };
        }
        e.stopPropagation();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
        dragRef.current = {
            kind, id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, rectW: rect.width, rectH: rect.height, orig,
            half: kind === 'table' ? halfOf(id) : { x: 0, y: 0 }, moved: false,
        };
        choose({ kind: kind === 'table' ? 'table' : 'zone', id });
    };

    const moveDrag = (e: ReactPointerEvent<HTMLElement>) => {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId || d.rectW === 0 || d.rectH === 0) return;
        const px = e.clientX - d.startX;
        const py = e.clientY - d.startY;
        if (!d.moved && Math.hypot(px, py) < 4) return;
        d.moved = true;
        const dx = (px / d.rectW) * 100;
        const dy = (py / d.rectH) * 100;
        if (d.kind === 'table') {
            setLive({ kind: 'table', id: d.id, x: clamp(d.orig.x + dx, d.half.x, 100 - d.half.x), y: clamp(d.orig.y + dy, d.half.y, 100 - d.half.y), w: 0, h: 0 });
        } else if (d.kind === 'zone') {
            const b = clampZone({ x: d.orig.x + dx, y: d.orig.y + dy, w: d.orig.w, h: d.orig.h });
            setLive({ kind: 'zone', id: d.id, ...b });
        } else {
            const w = clamp(d.orig.w + dx, ZONE_MIN, 100 - d.orig.x);
            const h = clamp(d.orig.h + dy, ZONE_MIN, 100 - d.orig.y);
            setLive({ kind: 'zone', id: d.id, x: d.orig.x, y: d.orig.y, w, h });
        }
    };

    const endDrag = (e: ReactPointerEvent<HTMLElement>, cancel = false) => {
        const d = dragRef.current;
        if (!d || d.pointerId !== e.pointerId) return;
        dragRef.current = null;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* déjà relâché */ }
        const l = liveRef.current;
        setLive(null);
        if (cancel || !d.moved || !l || l.id !== d.id) return;
        if (l.kind === 'table') {
            emit(tables.map((t) => (t.id === d.id ? { ...t, x: round1(l.x), y: round1(l.y) } : t)), zones);
            setAnnounce(`${tableName(d.id)} posée.`);
        } else {
            const b = clampZone(l);
            emit(tables, zones.map((z) => (z.id === d.id ? { ...z, ...b } : z)));
            setAnnounce(d.kind === 'resize' ? `${zoneName(d.id)} redimensionnée.` : `${zoneName(d.id)} posée.`);
        }
    };

    const dragHandlers = (kind: Kind | 'resize', id: string) => edit && onChange ? {
        onPointerDown: (e: ReactPointerEvent<HTMLElement>) => startDrag(e, kind, id),
        onPointerMove: moveDrag,
        onPointerUp: (e: ReactPointerEvent<HTMLElement>) => endDrag(e),
        onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => endDrag(e, true),
    } : {};

    // ── Clavier ──────────────────────────────────────────────────────────────
    const onItemKey = (e: KeyboardEvent<HTMLElement>, s: Sel, resize = false) => {
        if (!edit || !onChange) return;
        const step = e.shiftKey ? 5 : 1;
        const delta: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const dir = delta[e.key];
        if (dir) {
            e.preventDefault();
            setSel(s);
            if (resize) resizeZone(s.id, dir[0], dir[1]);
            else nudge(s, dir[0], dir[1]);
            return;
        }
        if ((e.key === 'r' || e.key === 'R') && s.kind === 'table' && !resize) {
            e.preventDefault();
            rotateTable(s.id);
            return;
        }
        if (e.key === 'Escape') setSel(null);
    };

    // ── Rendu ────────────────────────────────────────────────────────────────
    const selTable = sel?.kind === 'table' ? tables.find((t) => t.id === sel.id && placed(t)) ?? null : null;
    const selZone = sel?.kind === 'zone' ? zones.find((z) => z.id === sel.id && zonePlaced(z)) ?? null : null;

    const legend = useMemo(() => {
        if (edit) return [] as StateKey[];
        const present = new Set<StateKey>();
        for (const t of placedTables) {
            const s = visualState(t, mode, selectedId);
            if (s) present.add(s);
        }
        if (mode === 'select') { present.add('LIBRE'); present.add('CHOISIE'); }
        return LEGEND_ORDER.filter((k) => present.has(k));
    }, [edit, mode, placedTables, selectedId]);

    const plan = (
        <div className="min-w-0">
            <div
                role="group"
                aria-label={ariaLabel}
                aria-describedby={edit ? hintId : undefined}
                className="relative w-full overflow-hidden rounded-2xl border border-border bg-muted"
                style={{ aspectRatio: '4 / 3' }}
            >
                <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full text-border" preserveAspectRatio="none">
                    <defs>
                        <pattern id={gridId} width="24" height="24" patternUnits="userSpaceOnUse">
                            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="currentColor" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill={`url(#${gridId})`} />
                </svg>
                <div
                    ref={stageRef}
                    className="absolute"
                    style={{ inset: '4%' }}
                    onPointerDown={(e) => { if (edit && e.target === e.currentTarget) setSel(null); }}
                >
                    {placedZones.map((z) => {
                        const box = live && live.kind === 'zone' && live.id === z.id ? live : z;
                        const isSel = edit && sel?.kind === 'zone' && sel.id === z.id;
                        const dragging = live?.kind === 'zone' && live.id === z.id;
                        return (
                            <div
                                key={`zone:${z.id}`}
                                className={cn('absolute', edit ? 'z-0' : 'pointer-events-none z-0', (dragging || isSel) && 'z-[5]')}
                                style={{ left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}
                            >
                                {edit ? (
                                    <button
                                        type="button"
                                        ref={setItemRef(`zone:${z.id}`)}
                                        aria-label={`Zone ${z.name}`}
                                        aria-describedby={hintId}
                                        aria-pressed={isSel}
                                        onClick={() => choose({ kind: 'zone', id: z.id })}
                                        onKeyDown={(e) => onItemKey(e, { kind: 'zone', id: z.id })}
                                        {...dragHandlers('zone', z.id)}
                                        className={cn(
                                            'absolute inset-0 touch-none select-none rounded-xl border-2 border-dashed text-left transition-[border-color,background-color,box-shadow] duration-fast',
                                            'cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted',
                                            isSel ? 'border-primary bg-primary-soft/60' : 'border-input bg-card/50 hover:bg-card/80',
                                            dragging && 'shadow-lg',
                                        )}
                                    >
                                        {/* Lot 11b (contrôle responsive) : nom écrit seulement pour la zone choisie ; les autres sont
                                            nommées dans la liste sous le plan (un nom posé dans la zone passait sous les tables) */}
                                        {isSel && <span className="block break-words px-2 pt-1.5 text-sm font-semibold leading-tight text-primary-text">{z.name}</span>}
                                    </button>
                                ) : (
                                    <div title={z.name} className="absolute inset-0 rounded-xl border-2 border-dashed border-input bg-card/50" />
                                )}
                                {isSel && (
                                    <button
                                        type="button"
                                        aria-label={`Taille de la zone ${z.name} : flèches pour agrandir ou réduire`}
                                        onKeyDown={(e) => onItemKey(e, { kind: 'zone', id: z.id }, true)}
                                        {...dragHandlers('resize', z.id)}
                                        className="absolute -bottom-3 -right-3 z-20 flex h-11 w-11 touch-none cursor-nwse-resize items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <span aria-hidden="true" className="h-4 w-4 rounded-sm border-2 border-primary-foreground bg-primary shadow-md" />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    {placedTables.map((t) => {
                        const pos = live && live.kind === 'table' && live.id === t.id ? live : t;
                        const state = visualState(t, mode, selectedId);
                        const view = state ? STATE_VIEW[state] : NEUTRAL;
                        const isSel = edit && sel?.kind === 'table' && sel.id === t.id;
                        const dragging = live?.kind === 'table' && live.id === t.id;
                        const minPx = tableMinPx(t.shape);
                        const style = {
                            left: `${pos.x}%`,
                            top: `${pos.y}%`,
                            width: `max(${minPx}px, ${tableWidthPct(t.capacity, t.shape)}%)`,
                            aspectRatio: String(tableAspect(t.shape)),
                        };
                        const spoken = [`Table ${t.number}`, capacityText(t), state ? STATE_VIEW[state].spoken : null, edit ? `forme ${SHAPE_LABEL[t.shape]}` : null, t.hint ?? null]
                            .filter(Boolean).join(', ');
                        const radius = t.shape === 'RONDE' ? 'rounded-full' : 'rounded-lg';
                        const face = (
                            <>
                                <span
                                    aria-hidden="true"
                                    className={cn('absolute inset-0 border-2 transition-[background-color,border-color,box-shadow] duration-fast', radius, view.shapeCls, isSel && 'border-primary shadow-lg', dragging && 'shadow-lg')}
                                    style={{ transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined }}
                                />
                                <span aria-hidden="true" className="relative flex flex-col items-center gap-0.5 leading-none">
                                    <span className={cn('break-all text-sm font-bold tabular-nums', state === 'HORS_CAPACITE' && 'line-through')}>{t.number}</span>
                                    <small className="inline-flex items-center gap-0.5 text-caption tabular-nums">
                                        <Users size={11} strokeWidth={2.5} />
                                        {t.capacity}
                                    </small>
                                </span>
                                <StateMark state={state} />
                            </>
                        );
                        const base = cn(
                            'absolute z-10 flex -translate-x-1/2 -translate-y-1/2 select-none items-center justify-center',
                            radius, view.cls, dragging && 'z-30', isSel && 'z-20',
                        );
                        const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted';

                        if (edit) {
                            return (
                                <button
                                    key={`table:${t.id}`}
                                    type="button"
                                    ref={setItemRef(`table:${t.id}`)}
                                    aria-label={spoken}
                                    aria-describedby={hintId}
                                    aria-pressed={isSel}
                                    title={t.hint}
                                    onClick={() => choose({ kind: 'table', id: t.id })}
                                    onKeyDown={(e) => onItemKey(e, { kind: 'table', id: t.id })}
                                    {...dragHandlers('table', t.id)}
                                    className={cn(base, focusRing, 'touch-none cursor-grab active:cursor-grabbing', isSel && 'ring-2 ring-primary ring-offset-2 ring-offset-muted')}
                                    style={style}
                                >
                                    {face}
                                </button>
                            );
                        }
                        if (mode === 'select') {
                            const choosable = state === 'LIBRE' || state === 'CHOISIE';
                            return (
                                <button
                                    key={`table:${t.id}`}
                                    type="button"
                                    ref={setItemRef(`table:${t.id}`)}
                                    aria-label={spoken}
                                    aria-pressed={state === 'CHOISIE'}
                                    aria-disabled={!choosable || undefined}
                                    title={t.hint}
                                    onClick={() => { if (choosable) onSelect?.(t.id); }}
                                    className={cn(base, focusRing, choosable ? 'cursor-pointer transition-transform duration-fast motion-safe:active:scale-95' : 'cursor-not-allowed opacity-70')}
                                    style={style}
                                >
                                    {face}
                                </button>
                            );
                        }
                        if (onSelect) {
                            return (
                                <button
                                    key={`table:${t.id}`}
                                    type="button"
                                    ref={setItemRef(`table:${t.id}`)}
                                    aria-label={spoken}
                                    title={t.hint}
                                    onClick={() => onSelect(t.id)}
                                    className={cn(base, focusRing, 'cursor-pointer', selectedId === t.id && 'ring-2 ring-primary ring-offset-2 ring-offset-muted')}
                                    style={style}
                                >
                                    {face}
                                </button>
                            );
                        }
                        return (
                            <div key={`table:${t.id}`} ref={setItemRef(`table:${t.id}`)} role="img" aria-label={spoken} title={t.hint} className={base} style={style}>
                                {face}
                            </div>
                        );
                    })}
                </div>

                {placedTables.length === 0 && placedZones.length === 0 && (
                    <p className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center text-sm font-medium text-muted-foreground">
                        {edit ? 'Le plan est vide : posez vos tables avec « Placer sur le plan ».' : 'Aucune table n’est placée sur le plan.'}
                    </p>
                )}
            </div>

            {placedZones.length > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground-strong">Zones du plan : </span>
                    {placedZones.map((z) => z.name).join(', ')}
                </p>
            )}

            {legend.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Légende du plan">
                    {legend.map((k) => (
                        <li key={k} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <span aria-hidden="true" className={cn('h-4 w-4 flex-shrink-0 rounded border-2', STATE_VIEW[k].shapeCls)} />
                            <span className={cn(k === 'HORS_CAPACITE' && 'line-through decoration-1')}>{STATE_VIEW[k].legend}</span>
                        </li>
                    ))}
                </ul>
            )}

            <p id={hintId} className="sr-only">
                Flèches : déplacer de 1 %. Majuscule et flèches : déplacer de 5 %. Touche R : tourner la table de 15 degrés.
            </p>
            <p className="sr-only" aria-live="polite">{announce}</p>
        </div>
    );

    if (!edit) return plan;

    const moveButtons = (s: Sel, label: string) => (
        <div className="grid w-fit grid-cols-3 gap-1" role="group" aria-label={`Déplacer ${label}`}>
            <span aria-hidden="true" />
            <IconButton aria-label={`Monter ${label}`} variant="secondary" onClick={() => nudge(s, 0, -2)}><ArrowUp size={18} /></IconButton>
            <span aria-hidden="true" />
            <IconButton aria-label={`Décaler ${label} vers la gauche`} variant="secondary" onClick={() => nudge(s, -2, 0)}><ArrowLeft size={18} /></IconButton>
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center text-muted-foreground"><MapPin size={16} /></span>
            <IconButton aria-label={`Décaler ${label} vers la droite`} variant="secondary" onClick={() => nudge(s, 2, 0)}><ArrowRight size={18} /></IconButton>
            <span aria-hidden="true" />
            <IconButton aria-label={`Descendre ${label}`} variant="secondary" onClick={() => nudge(s, 0, 2)}><ArrowDown size={18} /></IconButton>
            <span aria-hidden="true" />
        </div>
    );

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            {plan}
            <div className="flex min-w-0 flex-col gap-4">
                <section aria-label="Réglages de l’élément choisi" className="rounded-2xl border border-border bg-card p-4">
                    {selTable ? (
                        <div className="flex flex-col gap-4">
                            <div>
                                <h3 className="text-base font-semibold text-foreground-strong">Table {selTable.number}</h3>
                                <p className="text-sm text-muted-foreground">{capacityText(selTable)}</p>
                            </div>
                            <div className="flex flex-wrap items-start gap-4">
                                {moveButtons({ kind: 'table', id: selTable.id }, `la table ${selTable.number}`)}
                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                    <span className="text-sm font-medium text-foreground-strong" id={`${uid}-forme`}>Forme</span>
                                    <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${uid}-forme`}>
                                        {SHAPES.map((s) => (
                                            <button
                                                key={s.value}
                                                type="button"
                                                aria-pressed={selTable.shape === s.value}
                                                onClick={() => setShape(selTable.id, s.value)}
                                                className={cn(
                                                    'min-h-11 cursor-pointer rounded-xl border px-3 text-sm font-medium transition-colors duration-fast',
                                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                                                    selTable.shape === s.value ? 'border-primary bg-primary-soft text-primary-text' : 'border-border bg-card text-foreground-strong hover:bg-muted',
                                                )}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button type="button" variant="secondary" size="sm" leftIcon={<RotateCw size={16} />} onClick={() => rotateTable(selTable.id)}>
                                    Tourner <span className="tabular-nums text-muted-foreground">({selTable.rotation}°)</span>
                                </Button>
                                <Button type="button" variant="ghost" size="sm" leftIcon={<Undo2 size={16} />} onClick={() => unplace({ kind: 'table', id: selTable.id })}>
                                    Retirer du plan
                                </Button>
                            </div>
                        </div>
                    ) : selZone ? (
                        <div className="flex flex-col gap-4">
                            <div>
                                <h3 className="text-base font-semibold text-foreground-strong">Zone {selZone.name}</h3>
                                <p className="text-sm text-muted-foreground">Faites glisser la poignée du coin pour changer sa taille.</p>
                            </div>
                            <div className="flex flex-wrap items-start gap-4">
                                {moveButtons({ kind: 'zone', id: selZone.id }, `la zone ${selZone.name}`)}
                                <div className="flex min-w-0 flex-1 flex-col gap-3">
                                    <SizeStepper
                                        label="Largeur"
                                        value={selZone.w ?? 0}
                                        onMinus={() => resizeZone(selZone.id, -5, 0)}
                                        onPlus={() => resizeZone(selZone.id, 5, 0)}
                                        name={selZone.name}
                                    />
                                    <SizeStepper
                                        label="Hauteur"
                                        value={selZone.h ?? 0}
                                        onMinus={() => resizeZone(selZone.id, 0, -5)}
                                        onPlus={() => resizeZone(selZone.id, 0, 5)}
                                        name={selZone.name}
                                    />
                                </div>
                            </div>
                            <div>
                                <Button type="button" variant="ghost" size="sm" leftIcon={<Undo2 size={16} />} onClick={() => unplace({ kind: 'zone', id: selZone.id })}>
                                    Retirer du plan
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Touchez une table ou une zone du plan pour la régler : position, forme, rotation, taille.
                        </p>
                    )}
                </section>

                {(unplacedTables.length > 0 || unplacedZones.length > 0) && (
                    <section aria-labelledby={`${uid}-aplacer`} className="rounded-2xl border border-border bg-card p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 id={`${uid}-aplacer`} className="text-base font-semibold text-foreground-strong">
                                À placer <span className="tabular-nums text-muted-foreground">({unplacedTables.length + unplacedZones.length})</span>
                            </h3>
                            {unplacedTables.length > 1 && (
                                <Button type="button" variant="ghost" size="sm" onClick={placeAllTables}>Tout placer</Button>
                            )}
                        </div>
                        <ul className="mt-3 flex flex-col divide-y divide-border">
                            {unplacedZones.map((z) => (
                                <li key={`uz:${z.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                    <span className="min-w-0 break-words text-sm font-medium text-foreground-strong">Zone {z.name}</span>
                                    <Button type="button" variant="secondary" size="sm" leftIcon={<Plus size={16} />} onClick={() => placeZone(z.id)} aria-label={`Placer la zone ${z.name} sur le plan`}>
                                        Placer sur le plan
                                    </Button>
                                </li>
                            ))}
                            {unplacedTables.map((t) => (
                                <li key={`ut:${t.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                                    <span className="min-w-0 text-sm text-foreground-strong">
                                        <span className="font-medium">Table {t.number}</span>
                                        <span className="text-muted-foreground"> · {capacityText(t)}</span>
                                    </span>
                                    <Button type="button" variant="secondary" size="sm" leftIcon={<Plus size={16} />} onClick={() => placeTable(t.id)} aria-label={`Placer la table ${t.number} sur le plan`}>
                                        Placer sur le plan
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}

function SizeStepper({ label, value, onMinus, onPlus, name }: { label: string; value: number; onMinus: () => void; onPlus: () => void; name: string }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground-strong">{label}</span>
            <div className="flex items-center gap-1">
                <IconButton aria-label={`Réduire la ${label.toLowerCase()} de la zone ${name}`} variant="secondary" onClick={onMinus} disabled={value <= ZONE_MIN}>
                    <Minus size={16} />
                </IconButton>
                <span className="w-14 text-center text-sm tabular-nums text-foreground-strong">{Math.round(value)} %</span>
                <IconButton aria-label={`Agrandir la ${label.toLowerCase()} de la zone ${name}`} variant="secondary" onClick={onPlus} disabled={value >= 100}>
                    <Plus size={16} />
                </IconButton>
            </div>
        </div>
    );
}

/** État affiché : en mode select, la table choisie (selectedId) s'allume si elle est libre. */
function visualState(t: FloorPlanTable, mode: FloorPlanProps['mode'], selectedId: string | null): StateKey | null {
    const s = t.state ?? null;
    if (mode === 'edit') return null;
    if (mode === 'select' && selectedId === t.id && (s === 'LIBRE' || s === 'CHOISIE' || s === null)) return 'CHOISIE';
    if (mode === 'select' && s === 'CHOISIE' && selectedId !== null && selectedId !== t.id) return 'LIBRE';
    return s;
}

export default FloorPlan;
