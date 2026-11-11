import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EVENTS = 50;
const NO_STORE = { 'Cache-Control': 'no-store' };

interface ScanStateItem {
    event_id: string;
    open: boolean;
    problem: string | null;
    opens_at: string | null;
    closes_at: string | null;
}

type ScanStatesReply = { ok: true; items: ScanStateItem[] } | { ok: false; code?: string };

function parseEventIds(raw: string | null): string[] {
    const ids = Array.from(new Set((raw ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '')));
    if (ids.length === 0 || ids.length > MAX_EVENTS || !ids.every((id) => UUID_RE.test(id))) {
        throw new PublicError(`Indiquez de 1 à ${MAX_EVENTS} événements.`, 'INVALID_FIELD', 400);
    }
    return ids;
}

/**
 * GET /api/controller/scan/state?event_ids=<id>,<id> — lot 9 bis (R16, B48, contrat 4.3) : le contrôle est-il
 * ouvert, et de quand à quand, pour chaque événement demandé. Même règle que ticket_scan (RPC scan_states :
 * scan_event_problem et scan_window) : l'écran décide par `open` et affiche l'heure d'ouverture ou de fermeture.
 * Droit par scan_scanner_authorized (contrôleur affecté, partenaire propriétaire, admin) ; un seul événement non
 * permis refuse toute la demande (403), sans aucune donnée.
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;

    try {
        const eventIds = parseEventIds(new URL(req.url).searchParams.get('event_ids'));
        const { data, error } = await getServiceRoleClient().rpc('scan_states', {
            p: { event_ids: eventIds, actor_id: session.user.id },
        });
        if (error) throw error;
        const reply = data as ScanStatesReply | null;
        if (!reply) throw new Error('scan_states : réponse vide');
        if (reply.ok !== true) {
            if (reply.code === 'SCAN_FORBIDDEN') {
                throw new PublicError('Vous n’êtes pas autorisé à contrôler ces événements.', 'SCAN_FORBIDDEN', 403);
            }
            throw new Error(`scan_states : refus inattendu ${JSON.stringify(reply)}`);
        }
        return NextResponse.json({ items: reply.items }, { headers: NO_STORE });
    } catch (err: unknown) {
        return apiFailure('GET /api/controller/scan/state', err, {
            message: 'État du contrôle momentanément indisponible.',
            code: 'SCAN_STATE_UNAVAILABLE',
        });
    }
}
