import { NextRequest, NextResponse } from 'next/server';
import { dispatchNotifications } from '@/lib/notifications/dispatcher';
import { refuseUnlessCron } from '@/lib/security/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * Lot 6.1 (contrat E5) — passage de l'envoyeur unique de la boîte d'envoi : réservation par lots
 * (FOR UPDATE SKIP LOCKED), envoi par canal, marquage, relances, contrôle du volume de SMS du jour.
 * Planification : chaque minute (supabase/ops/schedule-crons.sql). Protégée par CRON_SECRET
 * (Authorization: Bearer), sans repli. Aucune heure ni aucun filtre ne vient de la requête.
 */
async function run(req: NextRequest) {
    const refused = refuseUnlessCron(req);
    if (refused) return refused;
    try {
        const report = await dispatchNotifications();
        return NextResponse.json({ ok: true, ...report });
    } catch (err) {
        console.error('[cron notifications-dispatch] passage de l’envoyeur impossible :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Envoi des notifications momentanément impossible.', code: 'DISPATCH_FAILED' }, { status: 500 });
    }
}

export const GET = run;
export const POST = run;
