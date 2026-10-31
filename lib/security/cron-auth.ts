/**
 * Lot 2 — authentification des routes cron : en-tête « Authorization: Bearer <CRON_SECRET> »
 * (format envoyé par Vercel Cron). CRON_SECRET obligatoire, sans repli ; comparaison à temps
 * constant. Les routes /api/cron sont publiques au middleware et se protègent ici.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';

const digest = (v: string) => createHash('sha256').update(v).digest();

/** null si l'appel est autorisé, sinon la réponse de refus (401, ou 503 si le secret manque). */
export function refuseUnlessCron(req: NextRequest): NextResponse | null {
    const secret = getServerEnv().CRON_SECRET;
    if (!secret) {
        console.error('[cron] CRON_SECRET absent : appel refusé.');
        return NextResponse.json({ error: 'Tâche planifiée non configurée.' }, { status: 503 });
    }
    const presented = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!presented || !timingSafeEqual(digest(presented), digest(secret))) {
        return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }
    return null;
}
