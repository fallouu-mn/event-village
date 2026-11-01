import { NextRequest, NextResponse } from 'next/server';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { refuseUnlessCron } from '@/lib/security/cron-auth';

export const dynamic = 'force-dynamic';

const BATCH = 200;
const MAX_ROUNDS = 10;

/**
 * Lot 5.4 (contrat D7) — passage automatique à TERMINE des événements PUBLIE dont la fin
 * (event_end_at : fin renseignée, sinon début à 23:59 Africa/Dakar) est passée, par la transition
 * interne (acteur SYSTEM, canal CRON, journalisée). RPC events_finish_overdue en lots de 200
 * (FOR UPDATE SKIP LOCKED). Planification : toutes les 15 minutes (docs/deploiement-projet-neuf.md §7).
 * Protégée par CRON_SECRET (Authorization: Bearer), sans repli.
 */
async function run(req: NextRequest) {
    const refused = refuseUnlessCron(req);
    if (refused) return refused;
    let finished = 0;
    const ids: string[] = [];
    for (let round = 1; round <= MAX_ROUNDS; round++) {
        const { data, error } = await rpcWithRetry<{ ok?: boolean; finished?: number; ids?: string[] }>('events_finish_overdue', { p: { limit: BATCH } });
        if (error || !data || data.ok !== true) {
            console.error('[cron events-finish] passage à TERMINE impossible :', error ? `${error.code} ${error.message}` : JSON.stringify(data));
            return NextResponse.json({ error: 'Passage des événements terminés impossible.', finished, ids }, { status: 500 });
        }
        const n = Number(data.finished ?? 0);
        finished += n;
        ids.push(...(data.ids ?? []).map(String));
        if (n < BATCH) break;
    }
    return NextResponse.json({ ok: true, finished, ids });
}

export const GET = run;
export const POST = run;
