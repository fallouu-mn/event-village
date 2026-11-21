/**
 * Lot 11b — tables : réponses communes des routes (refus de la base en français simple, statut HTTP, paramètres).
 */
import { NextResponse } from 'next/server';
import { apiFailure, type ApiFallback } from '@/lib/api/public-error';
import { refusalStatus } from './booking';
import { TableRefusal } from './queries';

/** Refus lisible d'une fonction de la base → réponse JSON (message déjà en français simple). */
export function refusalResponse(err: TableRefusal): NextResponse {
    return NextResponse.json({ success: false, error: err.publicText, code: err.code, ...err.extra }, { status: refusalStatus(err.code) });
}

/** Erreur d'une route des tables : refus de la base (TableRefusal) tel quel, sinon le repli commun (apiFailure). */
export function tableFailure(label: string, err: unknown, fallback: ApiFallback): NextResponse {
    if (err instanceof TableRefusal) return refusalResponse(err);
    return apiFailure(label, err, fallback);
}

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

/** Corps JSON d'une requête, ou null s'il est illisible (jamais d'exception). */
export async function jsonBody(req: Request): Promise<Record<string, unknown> | null> {
    const body = await req.json().catch(() => null);
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}
