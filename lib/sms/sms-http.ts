/**
 * Lot 1C.9 — réponse HTTP d'une route quand la garde anti-abus refuse un SMS demandé par
 * l'utilisateur : 429 (limite ou plafond, avec Retry-After) ou 503 (garde indisponible).
 */
import { NextResponse } from 'next/server';
import type { SmsReserveResult } from './sms-guard';
import { smsRefusalHttp } from './sms-guard';

type Refusal = Extract<SmsReserveResult, { ok: false }>['refusal'];

export function smsRefusalResponse(refusal: Refusal): NextResponse {
    const res = NextResponse.json(
        { error: refusal.message, code: refusal.code, retryAfterSeconds: refusal.retryAfterSeconds },
        { status: smsRefusalHttp(refusal.code) }
    );
    if (refusal.retryAfterSeconds) res.headers.set('Retry-After', String(refusal.retryAfterSeconds));
    return res;
}
