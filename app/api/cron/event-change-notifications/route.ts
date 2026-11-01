import { NextRequest, NextResponse } from 'next/server';
import { refuseUnlessCron } from '@/lib/security/cron-auth';
import { processEventChangeNotifications } from '@/lib/events/event-change-notifications';

export const dynamic = 'force-dynamic';

/**
 * Lot 5 (contrat F3) — envoi des SMS de changement d'un événement (dates, heures, lieu) mis en file par
 * event_update : un SMS par porteur et par file, jamais en double (lignes prises en SENDING, puis SENT).
 * Les refus de la garde SMS (plafond non OTP du jour, limite par numéro) sont rejoués plus tard, 5 essais au plus.
 * Planification : toutes les 5 minutes (docs/deploiement-projet-neuf.md). Protégée par CRON_SECRET, sans repli.
 */
async function run(req: NextRequest) {
    const refused = refuseUnlessCron(req);
    if (refused) return refused;
    try {
        const report = await processEventChangeNotifications();
        return NextResponse.json({ ok: true, ...report });
    } catch (err) {
        console.error('[cron event-change-notifications]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Envoi des notifications de changement impossible.' }, { status: 500 });
    }
}

export const GET = run;
export const POST = run;
