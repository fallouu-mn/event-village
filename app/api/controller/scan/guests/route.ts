import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/controller/scan/guests';
const NO_STORE = 'no-store';
const INVALID_QUERY = 'Saisissez les 4 derniers chiffres ou le numéro complet de l’invité.';

const BodySchema = z.object({
    eventId: z.string().uuid(),
    query: z.string().min(1).max(30),
});

/** Refus public accompagné de champs de réponse et d'en-têtes (quota : retry_after_seconds, Retry-After). */
class GuestListRefusal extends PublicError {
    constructor(message: string, code: string, status: number,
        readonly extra: Readonly<Record<string, unknown>>, readonly headers: Readonly<Record<string, string>>) {
        super(message, code, status);
        this.name = 'GuestListRefusal';
    }
}

interface GuestGroup {
    guest_name: string | null;
    category: string;
    ticket_count: number;
    ticket_ids: string[];
}

type SearchReply = {
    ok?: boolean;
    http?: number;
    code?: string;
    retry_after_seconds?: unknown;
    items?: unknown;
    truncated?: unknown;
};

function isGroup(raw: unknown): raw is GuestGroup {
    const g = (raw ?? {}) as Record<string, unknown>;
    return (g.guest_name === null || typeof g.guest_name === 'string')
        && typeof g.category === 'string'
        && Number.isInteger(g.ticket_count)
        && Array.isArray(g.ticket_ids) && g.ticket_ids.every((id) => typeof id === 'string');
}

/** Réponse d'échec : apiFailure (liste blanche PublicError, journal et 503 pour une panne), puis champs et en-têtes. */
async function failure(err: unknown): Promise<NextResponse> {
    const base = apiFailure(CONTEXT, err, { message: 'Liste des invités momentanément indisponible. Réessayez.', code: 'GUEST_LIST_UNAVAILABLE', status: 503 });
    const res = err instanceof GuestListRefusal
        ? NextResponse.json({ ...(await base.json()), ...err.extra }, { status: base.status, headers: err.headers })
        : base;
    res.headers.set('Cache-Control', NO_STORE);
    return res;
}

/**
 * POST /api/controller/scan/guests — lot 9 ter (9t.17, contrat C.3.4) : `{ eventId, query }`, recherche du contrôleur
 * dans la liste des invités (invitations pas encore acceptées dans l'application) par les 4 derniers chiffres ou le
 * numéro complet. RPC ticket_guest_list_search appelée UNE fois, sans relance (le quota guest_list_search,
 * GUEST_LIST_SEARCH_PER_SCANNER_HOUR par contrôleur et par heure, est consommé dans la RPC). Droit sur l'événement et
 * périmètre access.manual_entry_scope comme la saisie manuelle (403 SCAN_FORBIDDEN, rien révélé). Réponse
 * `{ items: [{ guest_name, category, ticket_count, ticket_ids }], truncated }`, jamais de numéro ; chaque recherche est
 * journalisée (GUEST_LIST_SEARCH, sans chiffre ni nom).
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        let raw: unknown;
        try {
            raw = await req.json();
        } catch (parseErr) {
            console.warn(`[${CONTEXT}] corps illisible :`, parseErr instanceof Error ? parseErr.message : String(parseErr));
            throw new PublicError(INVALID_QUERY, 'INVALID_BODY', 400);
        }
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) throw new PublicError(INVALID_QUERY, 'INVALID_BODY', 400);

        const { data, error } = await getServiceRoleClient().rpc('ticket_guest_list_search', {
            p: {
                scanner_id: session.user.id,
                event_id: parsed.data.eventId,
                query: parsed.data.query,
                limits: { per_scanner_hour: getServerEnv().GUEST_LIST_SEARCH_PER_SCANNER_HOUR },
            },
        });
        if (error) throw new Error(`ticket_guest_list_search : ${error.code ?? ''} ${error.message}`);
        const reply = (data ?? null) as SearchReply | null;
        if (!reply || typeof reply !== 'object') throw new Error('ticket_guest_list_search : réponse vide');

        if (reply.ok === true) {
            if (!Array.isArray(reply.items) || !reply.items.every(isGroup) || typeof reply.truncated !== 'boolean') {
                throw new Error(`ticket_guest_list_search : réponse inattendue ${JSON.stringify(reply).slice(0, 300)}`);
            }
            return NextResponse.json({ items: reply.items, truncated: reply.truncated }, { headers: { 'Cache-Control': NO_STORE } });
        }
        if (reply.http === 400 && reply.code === 'INVALID_INPUT') throw new PublicError(INVALID_QUERY, 'INVALID_INPUT', 400);
        if (reply.http === 403 && reply.code === 'SCAN_FORBIDDEN') {
            throw new PublicError('Vous n’êtes pas autorisé à consulter la liste des invités de cet événement.', 'SCAN_FORBIDDEN', 403);
        }
        if (reply.http === 429 && reply.code === 'GUEST_LIST_RATE_LIMITED') {
            const seconds = Number(reply.retry_after_seconds);
            if (!Number.isInteger(seconds) || seconds <= 0) throw new Error(`ticket_guest_list_search : délai de quota illisible ${JSON.stringify(reply)}`);
            throw new GuestListRefusal(`Trop de recherches dans l’heure : réessayez dans ${Math.ceil(seconds / 60)} min.`, 'GUEST_LIST_RATE_LIMITED', 429,
                { retry_after_seconds: seconds }, { 'Retry-After': String(seconds) });
        }
        throw new Error(`ticket_guest_list_search : refus non répertorié ${JSON.stringify(reply)}`);
    } catch (err) {
        return failure(err);
    }
}
