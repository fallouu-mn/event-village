import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { routeParam, UUID_RE, type RouteParams } from '@/lib/events/pilotage.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_STORE = 'no-store';
const FALLBACK = { message: 'Zones momentanément indisponibles.', code: 'ZONES_UNAVAILABLE', status: 500 };

/**
 * Corps du PUT (contrat 4.3). Les bornes métier (20 zones, 50 portes, noms de 1 à 40 caractères, doublons, zone sans
 * porte ou sans catégorie) sont décidées par la RPC event_zones_save, avec leur code et leur texte ; Zod ne borne ici
 * que la forme et la taille du corps (un tableau de 21 zones doit rendre TOO_MANY_ZONES, pas une erreur de champ).
 */
const GateSchema = z.object({
    id: z.string().uuid().nullable().optional(),
    name: z.string().max(60),
});
const ZoneSchema = z.object({
    id: z.string().uuid().nullable().optional(),
    name: z.string().max(60),
    kind: z.enum(['ENTREE', 'CONTROLE']),
    position: z.number().int().min(0).max(99).nullable().optional(),
    category_ids: z.array(z.string().uuid()).max(200),
    gates: z.array(GateSchema).max(100),
});
const BodySchema = z.object({ zones: z.array(ZoneSchema).max(100) });

/** Statut HTTP de chaque refus de event_zones_get et event_zones_save (liste blanche, contrat 4.3). */
const REFUSAL_STATUS: Record<string, number> = {
    INVALID_INPUT: 400,
    ZONE_NAME_INVALID: 400,
    TOO_MANY_ZONES: 400,
    TOO_MANY_GATES: 400,
    ADMIN_CANNOT_EDIT: 403,
    ACCOUNT_NOT_ACTIVE: 403,
    PERMISSION_MISSING: 403,
    EVENT_NOT_FOUND: 404,
    ZONE_NAME_TAKEN: 409,
    GATE_NAME_TAKEN: 409,
    ZONE_WITHOUT_GATE: 409,
    ZONE_WITHOUT_CATEGORY: 409,
    NO_ENTRANCE_ZONE: 409,
    CATEGORY_WITHOUT_ENTRANCE: 409,
    GATE_IN_USE: 409,
    GATE_ASSIGNED: 409,
    ZONE_IN_USE: 409,
    EVENT_LOCKED: 409,
    WITHDRAW_TO_EDIT: 409,
};

/** Refus public accompagné de champs de réponse (`field`, `permission`). */
class ZonesRefusal extends PublicError {
    constructor(message: string, code: string, status: number, readonly extra: Readonly<Record<string, unknown>>) {
        super(message, code, status);
        this.name = 'ZonesRefusal';
    }
}

type Reply = Record<string, unknown> & { ok?: unknown; code?: unknown; message?: unknown; field?: unknown; permission?: unknown };

async function failure(context: string, err: unknown): Promise<NextResponse> {
    const base = apiFailure(context, err, FALLBACK);
    const res = err instanceof ZonesRefusal && Object.keys(err.extra).length > 0
        ? NextResponse.json({ ...(await base.json()), ...err.extra }, { status: base.status })
        : base;
    res.headers.set('Cache-Control', NO_STORE);
    return res;
}

/** Réponse de la RPC : configuration (sans `ok`) ou refus de la liste blanche ; toute autre forme est une panne. */
function readReply(rpc: string, data: unknown): Record<string, unknown> {
    const reply = (data ?? null) as Reply | null;
    if (!reply || typeof reply !== 'object') throw new Error(`${rpc} : réponse vide`);
    if (reply.ok === true) {
        if (!Array.isArray(reply.zones) || !Array.isArray(reply.categories) || !Array.isArray(reply.controllers)) {
            throw new Error(`${rpc} : réponse inattendue ${JSON.stringify(reply).slice(0, 300)}`);
        }
        const rest: Record<string, unknown> = { ...reply };
        delete rest.ok;
        return rest;
    }
    const code = typeof reply.code === 'string' ? reply.code : '';
    const status = REFUSAL_STATUS[code];
    if (!status || typeof reply.message !== 'string') throw new Error(`${rpc} : refus non répertorié ${JSON.stringify(reply)}`);
    const extra: Record<string, unknown> = {};
    if (typeof reply.field === 'string') extra.field = reply.field;
    if (typeof reply.permission === 'string') extra.permission = reply.permission;
    throw new ZonesRefusal(reply.message, code, status, extra);
}

async function eventIdOf(ctx: RouteParams<{ id: string }>): Promise<string> {
    const eventId = await routeParam(ctx, 'id');
    if (!UUID_RE.test(eventId)) throw new PublicError('Événement introuvable.', 'EVENT_NOT_FOUND', 404);
    return eventId;
}

/**
 * GET /api/partner/events/[id]/zones — lot 9 ter (9t.15, contrat 4.3, F30) : zones, portes, catégories (couleur et
 * consigne) et contrôleurs de l'événement. Propriétaire ou admin events.read (droit décidé par la RPC event_zones_get) ;
 * `can_edit` et `edit_block` disent si la configuration est modifiable et pourquoi. Tiers : 404.
 */
export async function GET(req: NextRequest, ctx: RouteParams<{ id: string }>) {
    const context = 'GET /api/partner/events/[id]/zones';
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        const eventId = await eventIdOf(ctx);
        const { data, error } = await getServiceRoleClient().rpc('event_zones_get', { p: { event_id: eventId, actor_id: session.user.id } });
        if (error) throw new Error(`event_zones_get : ${error.code ?? ''} ${error.message}`);
        return NextResponse.json(readReply('event_zones_get', data), { headers: { 'Cache-Control': NO_STORE } });
    } catch (err) {
        return failure(context, err);
    }
}

/**
 * PUT /api/partner/events/[id]/zones — lot 9 ter (9t.15, contrat 4.3, F31) : configuration complète des zones et des
 * portes (`zones: []` = retour à une seule entrée). RPC event_zones_save appelée une fois, sans relance : garde de la
 * billetterie (propriétaire seule, statut), validations, portes et zones déjà scannées protégées, audit. Réponse : la
 * configuration enregistrée et « Zones enregistrées. ».
 */
export async function PUT(req: NextRequest, ctx: RouteParams<{ id: string }>) {
    const context = 'PUT /api/partner/events/[id]/zones';
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        const eventId = await eventIdOf(ctx);
        let raw: unknown;
        try {
            raw = await req.json();
        } catch (parseErr) {
            console.warn(`[${context}] corps illisible :`, parseErr instanceof Error ? parseErr.message : String(parseErr));
            throw new PublicError('Corps de requête illisible.', 'INVALID_BODY', 400);
        }
        const parsed = BodySchema.safeParse(raw);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            throw new ZonesRefusal('Demande invalide.', 'INVALID_FIELD', 400, { field: issue.path.join('.') });
        }
        const { data, error } = await getServiceRoleClient().rpc('event_zones_save', {
            p: { event_id: eventId, actor_id: session.user.id, zones: parsed.data.zones },
        });
        if (error) throw new Error(`event_zones_save : ${error.code ?? ''} ${error.message}`);
        return NextResponse.json({ ...readReply('event_zones_save', data), message: 'Zones enregistrées.' },
            { headers: { 'Cache-Control': NO_STORE } });
    } catch (err) {
        return failure(context, err);
    }
}
