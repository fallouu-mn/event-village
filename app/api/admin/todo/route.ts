import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { isSimulationRun } from '@/lib/integrations/simulation';
import { UNCONFIRMED_PAYMENT_WINDOW_HOURS } from '@/lib/finance/admin-summary';
import { TODO_LINES, todoLinesFor, type TodoLine, type TodoLineKey, type TodoReply } from '@/lib/admin/todo';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * GET /api/admin/todo — finition 3b (E-29) : « À faire aujourd'hui », en tête de l'accueil de l'administration.
 *
 * Ouverte à tout administrateur ; chaque ligne n'est lue que si l'administrateur a le droit d'agir dessus
 * (lib/admin/todo.ts). Une seule lecture en base (admin_todo) pour toutes les lignes ouvertes. Une ligne illisible est
 * rendue « indisponible », jamais 0 ; une base injoignable rend toutes les lignes ouvertes indisponibles (200), pour que
 * l'écran le dise ligne par ligne.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;

    const allowed = todoLinesFor(auth.permissions ?? []);
    const partial = allowed.length < TODO_LINES.length;
    if (allowed.length === 0) {
        const empty: TodoReply = { lines: [], upToDate: [], allowed: [], partial, computedAt: null };
        return NextResponse.json(empty, { headers: NO_STORE });
    }

    const { data, error } = await getServiceRoleClient().rpc('admin_todo', {
        p: { lines: allowed, simulated: isSimulationRun(), unconfirmed_hours: UNCONFIRMED_PAYMENT_WINDOW_HOURS },
    });
    if (error) console.error('[GET /api/admin/todo] lecture impossible :', error.message);
    const reply = (error ? null : data) as { ok?: boolean; computed_at?: string; lines?: Record<string, Record<string, unknown>> } | null;
    for (const [key, raw] of Object.entries(reply?.lines ?? {})) {
        if (raw?.unavailable === true) console.error(`[GET /api/admin/todo] ligne ${key} illisible : ${String(raw.error ?? '?')}`);
    }

    const lines: TodoLine[] = [];
    const upToDate: TodoLineKey[] = [];
    for (const key of allowed) {
        const raw = reply?.lines?.[key];
        const count = Number(raw?.count);
        if (!raw || raw.unavailable === true || !Number.isInteger(count)) {
            lines.push({ key, unavailable: true });
            continue;
        }
        const line = { ...(raw as Omit<TodoLine, 'key'>), key, count } as TodoLine;
        const due = key === 'sms_cap' ? raw.alert === true : count > 0;
        if (due) lines.push(line);
        else upToDate.push(key);
    }
    const body: TodoReply = { lines, upToDate, allowed, partial, computedAt: reply?.computed_at ?? null };
    return NextResponse.json(body, { headers: NO_STORE });
}
