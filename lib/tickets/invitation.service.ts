/**
 * Lot 9, tâche 9.0 (contrat 4.1, 5.1) — invitations d'un événement, côté serveur : une fonction par RPC de la migration
 * 20261108000002_lot9_invitations.sql. Droits, stock et quotas sont décidés dans la RPC ; ce module traduit son refus
 * par une liste blanche code → statut. Un code inconnu ou une panne part au journal et donne 500 : jamais de texte
 * Postgres à l'écran.
 *
 * Chaque RPC est appelée une seule fois, sans rpcWithRetry : une relance après un commit doublerait billets et SMS (L12).
 */
import { NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { getServerEnv } from '@/lib/env';
import { getServiceRoleClient } from '@/lib/supabase/server';
import type { CreateInvitationsInput } from '@/lib/validations/invitation';

/** Refus public accompagné de champs de réponse (field, problems, retry_after_seconds) et d'en-têtes. */
export class InvitationRefusal extends PublicError {
    constructor(
        message: string,
        code: string,
        status: number,
        readonly extra: Readonly<Record<string, unknown>> = {},
        readonly headers: Readonly<Record<string, string>> = {},
    ) {
        super(message, code, status);
        this.name = 'InvitationRefusal';
    }
}

const REFUSAL_STATUS: Readonly<Record<string, number>> = {
    INVALID_INPUT: 400,
    EVENT_NOT_FOUND: 404,
    TICKET_NOT_FOUND: 404,
    FORBIDDEN: 403,
    ACCOUNT_NOT_ACTIVE: 403,
    EVENT_NOT_ACTIVE: 409,
    SALE_CHECK_FAILED: 409,
    TICKET_ALREADY_USED: 409,
    TICKET_NOT_CANCELLABLE: 409,
    QUOTA_EXCEEDED: 429,
};

const QUOTA_MESSAGES: Readonly<Record<string, string>> = {
    invitation_event: 'Limite d\'invitations atteinte pour cet événement. Réessayez plus tard.',
    invitation_phone: 'Ce numéro a déjà reçu le maximum d\'invitations aujourd\'hui.',
};

type RpcBody = Record<string, unknown>;

interface SaleProblem { code: string; message: string }

function saleProblems(raw: unknown): SaleProblem[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((p) => {
        const item = (p ?? {}) as RpcBody;
        return { code: String(item.code), message: String(item.message) };
    });
}

function refusalOf(body: RpcBody, rpc: string): Error {
    const code = typeof body.code === 'string' ? body.code : '';
    const status = REFUSAL_STATUS[code];
    if (status === undefined || typeof body.message !== 'string') {
        return new Error(`${rpc} : refus non répertorié (${code || 'sans code'})`);
    }
    if (code === 'QUOTA_EXCEEDED') {
        const retryAfter = Number(body.retry_after_seconds);
        const scope = typeof body.scope === 'string' ? body.scope : '';
        return new InvitationRefusal(QUOTA_MESSAGES[scope] ?? body.message, code, status,
            { retry_after_seconds: retryAfter }, { 'Retry-After': String(retryAfter) });
    }
    if (code === 'SALE_CHECK_FAILED') {
        const problems = saleProblems(body.problems);
        return new InvitationRefusal(problems.map((p) => p.message).join(' ') || body.message, code, status, { problems });
    }
    return new PublicError(body.message, code, status);
}

async function callRpc(rpc: string, p: Record<string, unknown>): Promise<RpcBody> {
    const { data, error } = await getServiceRoleClient().rpc(rpc, { p });
    if (error) throw new Error(`${rpc} : ${error.code} ${error.message}`);
    const body = (data ?? null) as RpcBody | null;
    if (!body || typeof body !== 'object') throw new Error(`${rpc} : réponse vide`);
    if (body.ok !== true) throw refusalOf(body, rpc);
    return body;
}

export interface InvitationsSent {
    ticket_count: number;
    phone_count: number;
}

export async function createInvitations(actorId: string, eventId: string, input: CreateInvitationsInput): Promise<InvitationsSent> {
    const env = getServerEnv();
    const body = await callRpc('ticket_invitation_create', {
        actor_id: actorId,
        event_id: eventId,
        category_id: input.category_id,
        phones: input.phones,
        quantity: input.quantity,
        limits: { per_event_hour: env.INVITATION_PER_EVENT_HOUR, per_phone_day: env.INVITATION_PER_PHONE_DAY },
    });
    return { ticket_count: Number(body.ticket_count), phone_count: Number(body.phone_count) };
}

export async function cancelInvitation(actorId: string, eventId: string, ticketId: string): Promise<void> {
    await callRpc('ticket_invitation_cancel', { actor_id: actorId, event_id: eventId, ticket_id: ticketId });
}

export interface InvitationsPage {
    items: unknown[];
    page: number;
    page_size: number;
    total_count: number;
}

export async function listInvitations(actorId: string, eventId: string, page: number): Promise<InvitationsPage> {
    const body = await callRpc('ticket_invitations_list', { actor_id: actorId, event_id: eventId, page });
    if (!Array.isArray(body.items)) throw new Error('ticket_invitations_list : lignes absentes de la réponse');
    return { items: body.items, page: Number(body.page), page_size: Number(body.page_size), total_count: Number(body.total_count) };
}

/**
 * Réponse d'échec des routes d'invitation : `apiFailure` décide du texte, du code et du statut (liste blanche
 * PublicError, journal et 500 pour le reste) ; les champs complémentaires d'un refus sont ajoutés ensuite.
 */
export async function invitationFailure(context: string, err: unknown): Promise<NextResponse> {
    const base = apiFailure(context, err, { message: 'Les invitations sont momentanément indisponibles.', code: 'INVITATIONS_UNAVAILABLE', status: 500 });
    const res = err instanceof InvitationRefusal
        ? NextResponse.json({ ...(await base.json()), ...err.extra }, { status: base.status, headers: err.headers })
        : base;
    res.headers.set('Cache-Control', 'no-store');
    return res;
}
