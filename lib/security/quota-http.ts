/**
 * Lot 4.8 — réponse HTTP d'une route quand un quota (lib/security/quota.ts) refuse la tentative :
 * 429 avec Retry-After (limite atteinte) ou 503 (garde indisponible : refus, jamais de passage).
 */
import { NextResponse } from 'next/server';
import type { QuotaResult } from './quota';

export type QuotaRefusal = Extract<QuotaResult, { allowed: false }>;

export function quotaRefusalResponse(refusal: QuotaRefusal, exceeded: { error: string; code: string }): NextResponse {
    if (refusal.reason === 'UNAVAILABLE') {
        return NextResponse.json(
            { error: 'Service momentanément indisponible. Réessayez dans un instant.', code: 'QUOTA_GUARD_UNAVAILABLE' },
            { status: 503 }
        );
    }
    const res = NextResponse.json({ ...exceeded, retryAfterSeconds: refusal.retryAfterSeconds }, { status: 429 });
    res.headers.set('Retry-After', String(refusal.retryAfterSeconds));
    return res;
}
