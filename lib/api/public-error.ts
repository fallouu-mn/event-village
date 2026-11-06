import { NextResponse } from 'next/server';

/**
 * Lot 8 (8.2 i, contrat 3.8, L51) : liste blanche des messages qui atteignent le navigateur.
 *
 * Une erreur n'est montrée que si elle est une `PublicError`, levée exprès avec un texte français rédigé pour
 * l'écran. Tout le reste (texte de PostgREST, de Supabase Auth, `TypeError`, oubli) part au journal et le navigateur
 * reçoit le message de repli de la route : une erreur non marquée ne fuit jamais. Serveur seulement : ce module
 * importe `next/server` et n'est pas fait pour un composant client.
 */
export class PublicError extends Error {
    constructor(message: string, readonly code?: string, readonly status?: number) {
        super(message);
        this.name = 'PublicError';
    }
}

/** Repli d'une route : texte et code stables, statut 500 par défaut pour une panne. */
export interface ApiFallback {
    message: string;
    code: string;
    status?: number;
}

/** Détail pour le journal : une erreur PostgREST est un objet simple, parfois sans `Error` derrière. */
function logDetail(err: unknown): string {
    if (err instanceof Error) {
        const code = (err as { code?: unknown }).code;
        return typeof code === 'string' ? `${code} ${err.message}` : err.message;
    }
    if (typeof err === 'object' && err !== null) {
        try {
            return JSON.stringify(err);
        } catch (jsonErr) {
            return `objet d'erreur illisible (${jsonErr instanceof Error ? jsonErr.message : String(jsonErr)})`;
        }
    }
    return String(err);
}

/**
 * Réponse d'échec d'une route.
 *  - `PublicError` : `{ error: err.message, code: err.code ?? fallback.code }`, statut
 *    `err.status ?? fallback.status ?? 400`, sans journal : c'est un refus voulu.
 *  - Le reste : `console.error` du détail, puis `{ error: fallback.message, code: fallback.code }`, statut
 *    `fallback.status ?? 500`.
 *
 * `context` nomme la route ou l'étape dans le journal, par exemple `GET /api/admin/audit`.
 */
export function apiFailure(context: string, err: unknown, fallback: ApiFallback): NextResponse {
    if (err instanceof PublicError) {
        return NextResponse.json({ error: err.message, code: err.code ?? fallback.code }, { status: err.status ?? fallback.status ?? 400 });
    }
    console.error(`[${context}]`, logDetail(err));
    return NextResponse.json({ error: fallback.message, code: fallback.code }, { status: fallback.status ?? 500 });
}
