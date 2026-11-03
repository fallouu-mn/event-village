/**
 * Lot 5 (5.2, 5.4) — cycle de vie d'un événement côté serveur.
 *
 * Le statut ne change que par les RPC de la migration 20261102000003_lot5_cycle.sql :
 *  - event_transition (D4) : table event_status_transitions, motifs, complétude, dates, historique et
 *    notifications dans l'application, dans une seule transaction ;
 *  - event_cancel (D6) : voir lib/events/event-cancellation.service.ts ;
 *  - events_finish_overdue (D7) : cron /api/cron/events-finish.
 * Une écriture directe de events.status est refusée par la base (garde EV422), service_role compris.
 * Lot 6 (J1.7) : les avis (partenaire, porteurs, administrateurs) sont mis en file par le trigger
 * trg_event_status_notify sur la ligne d'historique, dans la transaction de la transition ; ce module
 * n'envoie plus rien.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

export const EVENT_STATUS_VALUES = ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU', 'TERMINE', 'ANNULE'] as const;
export type LifecycleEventStatus = (typeof EVENT_STATUS_VALUES)[number];

export function isEventStatus(value: unknown): value is LifecycleEventStatus {
    return typeof value === 'string' && (EVENT_STATUS_VALUES as readonly string[]).includes(value);
}

/** Refus métier d'une opération du cycle de vie : statut HTTP, code stable, message en français. */
export class EventLifecycleError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details: Record<string, unknown> = {},
    ) {
        super(message);
        this.name = 'EventLifecycleError';
    }

    toBody(): Record<string, unknown> {
        return { error: this.message, code: this.code, ...this.details };
    }
}

/** Corps `{ ok:false, code, message, … }` renvoyé par une RPC du cycle de vie. */
export interface LifecycleRefusal {
    ok: false;
    code?: string;
    message?: string;
    role_missing?: boolean;
    missing?: unknown;
}

const REFUSAL_HTTP: Record<string, number> = {
    UNKNOWN_STATUS: 400,
    EVENT_NOT_FOUND: 404,
    TRANSITION_NOT_ALLOWED: 409,
    REASON_REQUIRED: 400,
    CANCELLATION_REQUIRED: 409,
    SUBMIT_INCOMPLETE: 422,
    EVENT_NOT_STARTED: 409,
    EVENT_ENDED: 409,
    ACCOUNT_NOT_ACTIVE: 403,
    TITLE_MISMATCH: 400,
    PUBLIC_NOTICE_REQUIRED: 400,
    INTERNAL_REASON_REQUIRED: 400,
};

const DEFAULT_MESSAGES: Record<string, string> = {
    EVENT_NOT_FOUND: 'Événement introuvable.',
    TRANSITION_NOT_ALLOWED: 'Ce changement de statut n’est pas permis.',
};

/** Convertit un refus de RPC en erreur HTTP (403 si c'est le rôle qui manque, contrat D4). */
export function refusalToError(body: LifecycleRefusal): EventLifecycleError {
    const code = body.code ?? 'TRANSITION_NOT_ALLOWED';
    let status = REFUSAL_HTTP[code] ?? 409;
    if (code === 'TRANSITION_NOT_ALLOWED' && body.role_missing === true) status = 403;
    const details: Record<string, unknown> = {};
    if (body.missing !== undefined) details.missing = body.missing;
    return new EventLifecycleError(status, code, body.message || DEFAULT_MESSAGES[code] || 'Opération refusée.', details);
}

export interface TransitionInput {
    eventId: string;
    actorId: string;
    to: string;
    reason?: string | null;
}

export interface TransitionResult {
    ok: true;
    event_id: string;
    from: LifecycleEventStatus;
    to: LifecycleEventStatus;
    actor_role: 'PARTENAIRE' | 'ADMIN';
    reason: string | null;
    history_id: string;
    title: string;
    partner_user_id: string | null;
}

export class EventLifecycleService {
    /**
     * Transition de statut par event_transition. Lève EventLifecycleError pour un refus métier, Error
     * pour une panne (500, jamais d'erreur Postgres brute dans la réponse).
     */
    static async transition(input: TransitionInput): Promise<TransitionResult> {
        if (!isEventStatus(input.to)) {
            throw new EventLifecycleError(400, 'UNKNOWN_STATUS', 'Statut demandé inconnu.');
        }
        const p: Record<string, unknown> = { event_id: input.eventId, actor_id: input.actorId, to_status: input.to };
        if (input.reason !== undefined && input.reason !== null) p.reason = input.reason;
        // Appel unique (pas de nouvel essai) : un second appel après un commit serait refusé à tort.
        const { data, error } = await getServiceRoleClient().rpc('event_transition', { p });
        if (error) {
            console.error(`[EventLifecycleService] event_transition ${input.eventId} → ${input.to} : ${error.code} ${error.message}`);
            throw new Error('Changement de statut impossible pour le moment.');
        }
        const body = (data ?? null) as (TransitionResult | LifecycleRefusal | null);
        if (!body || typeof body !== 'object') {
            console.error(`[EventLifecycleService] event_transition ${input.eventId} : réponse vide`);
            throw new Error('Changement de statut impossible pour le moment.');
        }
        if (body.ok !== true) throw refusalToError(body as LifecycleRefusal);
        return body;
    }
}
