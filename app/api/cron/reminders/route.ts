import { NextRequest, NextResponse } from 'next/server';
import { scheduleReminders } from '@/lib/notifications/reminders';
import { refuseUnlessCron } from '@/lib/security/cron-auth';

export const dynamic = 'force-dynamic';

/**
 * Lot 6.5 (contrat I3) — planification des rappels J-1, H-3 et du rappel du contrôleur : crée dans la boîte
 * d'envoi les rappels dont l'échéance vient de passer (fenêtre de 15 min, sans rattrapage, idempotent).
 * L'envoi revient à /api/cron/notifications-dispatch. Planification : toutes les 5 minutes
 * (supabase/ops/schedule-crons.sql). Protégée par CRON_SECRET (Authorization: Bearer), sans repli.
 * Aucune heure ni aucun filtre ne vient de la requête.
 */
async function run(req: NextRequest) {
    const refused = refuseUnlessCron(req);
    if (refused) return refused;
    try {
        const report = await scheduleReminders();
        return NextResponse.json({ ok: true, created: report.created, events: report.events });
    } catch (err) {
        console.error('[cron reminders] planification des rappels impossible :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Planification des rappels momentanément impossible.', code: 'REMINDERS_FAILED' }, { status: 500 });
    }
}

export const GET = run;
export const POST = run;
