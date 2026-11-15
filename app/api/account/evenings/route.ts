import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { noStore } from '@/lib/auth/account-sync';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/account/evenings — finition 1 (complément 13) : « Mes soirées » du compte connecté, en lecture seule.
 * Événements passés où il a contrôlé (affecté, a scanné ou a tenu une caisse) : date, événement, organisatrice, sa
 * porte, entrées qu'IL a validées, et s'il a tenu la caisse le total encaissé et l'état de la clôture
 * (RPC controller_evenings, chiffres de controller_evening_figures, les mêmes que l'organisatrice lit dans son équipe).
 * Toujours le compte de la session : aucun paramètre ne désigne un autre compte. Aucun nom, numéro ni billet de client,
 * rien des autres contrôleurs. Ouverte à toute session active, contrôle ouvert ou non.
 */

interface Evening {
    event_id: string;
    title: string;
    status: string;
    start_at: string | null;
    organizer: string | null;
    gate: string | null;
    zone: string | null;
    entry_point: string | null;
    entries: number;
    cash: { collected: number; gap: number; state: string } | null;
}

export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        const { data, error } = await getServiceRoleClient().rpc('controller_evenings', { p: { user_id: session.user.id } });
        if (error) throw new Error(`controller_evenings : ${error.code ?? ''} ${error.message}`);
        const reply = data as { ok?: boolean; items?: Evening[] } | null;
        if (!reply || reply.ok !== true || !Array.isArray(reply.items)) {
            throw new Error(`controller_evenings : réponse inattendue ${JSON.stringify(data)}`);
        }
        const items = reply.items.map((i) => ({
            event_id: i.event_id,
            title: i.title,
            status: i.status,
            start_at: i.start_at,
            organizer: i.organizer,
            gate: i.gate,
            zone: i.zone,
            entry_point: i.entry_point,
            entries: Number(i.entries ?? 0),
            cash: i.cash ? { collected: Number(i.cash.collected ?? 0), gap: Number(i.cash.gap ?? 0), state: String(i.cash.state) } : null,
        }));
        return noStore(NextResponse.json({ items }));
    } catch (err) {
        return apiFailure('GET /api/account/evenings', err, { message: 'Vos soirées sont momentanément indisponibles. Réessayez.', code: 'EVENINGS_UNAVAILABLE' });
    }
}
