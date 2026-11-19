/**
 * Lot 10b — salles : réponses communes des routes (refus de la base en français simple, statut HTTP, paramètres).
 */
import { NextResponse } from 'next/server';
import { refusalStatus } from './booking';
import { HallRefusal } from './queries';

/** Refus lisible d'une fonction de la base → réponse JSON (message déjà en français simple). */
export function refusalResponse(err: HallRefusal): NextResponse {
    const status = err.code === 'INVALID_FILTER' || err.code === 'HALL_INCOMPLETE' ? 400 : refusalStatus(err.code);
    return NextResponse.json({ success: false, error: err.message, code: err.code }, { status });
}

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;

/** Entier positif lu dans la requête, ou null s'il est absent ; NaN s'il est illisible. */
export function intParam(v: string | null): number | null {
    if (v === null || v.trim() === '') return null;
    return /^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : Number.NaN;
}

export function badRequest(message: string, code = 'INVALID_FILTER'): NextResponse {
    return NextResponse.json({ success: false, error: message, code }, { status: 400 });
}

export function notFound(message: string, code: string): NextResponse {
    return NextResponse.json({ success: false, error: message, code }, { status: 404 });
}
