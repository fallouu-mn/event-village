import { z } from 'zod';
import { getServiceRoleClient } from '../supabase/server';
import { EventLifecycleService } from './event-lifecycle.service';
import { eventEndAt } from './event-end';
import { pgEscapeLike } from '@/lib/security/postgrest-filter';
import { rpcWithRetry } from '@/lib/payments/rpc';
import {
    NON_EDITABLE_EVENT_FIELDS,
    createEventSchema,
    createTicketCategorySchema,
    parseWithFrenchErrors,
    updateEventSchema,
    updateTicketCategorySchema,
    validationFailure,
    type ProgramLine,
} from '@/lib/validations/event';

export type EventStatus = 'BROUILLON' | 'EN_ATTENTE' | 'VALIDE' | 'PUBLIE' | 'SUSPENDU' | 'TERMINE' | 'ANNULE';

/** Ligne de programme typée (contrat F1). */
export type ProgramItem = ProgramLine;

export interface PracticalInfo {
    address?: string;
    accessNotes?: string;
    parking?: string;
    contactPhone?: string;
    rules?: string;
}

/** Ligne `events` ou `ticket_categories` relue en base (colonnes Postgres, forme libre, comme les lectures supabase-js). */
export type DbRecord = Record<string, any>;

export interface EventUpdateResult {
    event: DbRecord;
    notified_holders: number;
    sms_queued: number;
}

/**
 * Refus d'une opération d'édition : statut HTTP, code stable, message français ; `details` est recopié dans
 * le corps de la réponse (field, fields, categories…).
 */
export class EventServiceError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
        readonly details: Record<string, unknown> = {},
    ) {
        super(message);
        this.name = 'EventServiceError';
    }

    toBody(): Record<string, unknown> {
        return { error: this.message, code: this.code, ...this.details };
    }
}

/** Statut HTTP des refus des RPC d'édition (migration 20261102000004_lot5_edition.sql). */
const REFUSAL_HTTP: Record<string, number> = {
    INVALID_INPUT: 400,
    FIELD_NOT_EDITABLE: 400,
    EXPECTED_VERSION_REQUIRED: 400,
    END_DATE_REQUIRED: 400,
    EVENT_START_PAST: 400,
    EVENT_END_BEFORE_START: 400,
    IMAGE_ORIGIN_INVALID: 400,
    SALE_DATES_INVALID: 400,
    PARTNER_NOT_FOUND: 403,
    PARTNER_NOT_VALIDATED: 403,
    ACCOUNT_NOT_ACTIVE: 403,
    ADMIN_CANNOT_EDIT: 403,
    EVENT_NOT_FOUND: 404,
    CATEGORY_NOT_FOUND: 404,
    EDIT_CONFLICT: 409,
    WITHDRAW_TO_EDIT: 409,
    EVENT_LOCKED: 409,
    LOCKED_AFTER_SALES: 409,
    CAPACITY_BELOW_QUOTAS: 409,
    SALE_END_AFTER_EVENT: 409,
    CATEGORY_NAME_TAKEN: 409,
    QUOTA_ABOVE_CAPACITY: 409,
    QUOTA_BELOW_SOLD: 409,
    QUOTA_BELOW_HELD: 409,
    PRICE_LOCKED_AFTER_SALES: 409,
    CATEGORY_HAS_SALES: 409,
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOT_FOUND_MESSAGE = 'Événement introuvable.';
const UNAVAILABLE_MESSAGE = 'Enregistrement impossible pour le moment. Réessayez dans quelques instants.';

interface RpcRefusal {
    ok: false;
    code?: string;
    message?: string;
    field?: string;
    categories?: unknown;
    suggestion?: string;
}

/** Refus d'une RPC → EventServiceError (champ en cause recopié dans field et fields). */
function refusalToError(body: RpcRefusal): EventServiceError {
    const code = body.code ?? 'INVALID_INPUT';
    const message = body.message || 'Opération refusée.';
    const details: Record<string, unknown> = {};
    if (body.field) {
        details.field = body.field;
        details.fields = [{ path: body.field, code, message }];
    }
    if (body.categories !== undefined) details.categories = body.categories;
    if (body.suggestion !== undefined) details.suggestion = body.suggestion;
    return new EventServiceError(REFUSAL_HTTP[code] ?? 409, code, message, details);
}

type RpcCall = { data: unknown; error: { code: string; message: string } | null };

/**
 * Résultat d'une RPC d'édition (appel déjà lancé par l'appelant) : `{ ok:true, … }` renvoyé, refus métier →
 * EventServiceError, panne → 500 sans détail Postgres (journalisée).
 */
async function editionResult<T extends Record<string, unknown>>(fn: string, call: Promise<RpcCall>): Promise<T> {
    const { data, error } = await call;
    if (error) {
        console.error(`[EventService] ${fn} : ${error.code} ${error.message}`);
        throw new EventServiceError(500, 'EDITION_UNAVAILABLE', UNAVAILABLE_MESSAGE);
    }
    if (!data || typeof data !== 'object') {
        console.error(`[EventService] ${fn} : réponse vide`);
        throw new EventServiceError(500, 'EDITION_UNAVAILABLE', UNAVAILABLE_MESSAGE);
    }
    if ((data as { ok?: unknown }).ok !== true) throw refusalToError(data as RpcRefusal);
    return data as T;
}

function invalid(error: z.ZodError): EventServiceError {
    const body = validationFailure(error);
    return new EventServiceError(400, body.code, body.error, { ...(body.field ? { field: body.field } : {}), fields: body.fields });
}

interface EditableEvent {
    id: string;
    partner_id: string;
    status: EventStatus;
    start_date: string;
    start_time: string;
    end_date: string | null;
    end_time: string | null;
    image_url: string | null;
}

const updateBodySchema = z.object({
    patch: z.record(z.unknown()),
    expected_updated_at: z.string().min(1),
}).strict();

export class EventService {
    /**
     * Résout l'ID partenaire à partir de l'ID utilisateur authentifié
     */
    public static async resolvePartnerId(userId: string): Promise<string> {
        const supabase = getServiceRoleClient();
        const { data: partner, error } = await supabase
            .from('partners')
            .select('id, status')
            .eq('user_id', userId)
            .single();

        if (error || !partner) {
            throw new Error('Profil partenaire introuvable pour cet utilisateur.');
        }

        return partner.id;
    }

    /** Partenaire du compte, ou null s'il n'en a pas (erreur de lecture → 500). */
    private static async partnerOf(userId: string): Promise<{ id: string } | null> {
        const { data, error } = await getServiceRoleClient().from('partners').select('id').eq('user_id', userId).maybeSingle();
        if (error) {
            console.error(`[EventService] partenaire du compte ${userId} illisible : ${error.message}`);
            throw new EventServiceError(500, 'EDITION_UNAVAILABLE', UNAVAILABLE_MESSAGE);
        }
        return data ? { id: String(data.id) } : null;
    }

    private static async isStaff(userId: string): Promise<boolean> {
        const { data, error } = await getServiceRoleClient().from('user_roles').select('role').eq('user_id', userId).in('role', ['ADMIN', 'SUPERADMIN']);
        if (error) {
            console.error(`[EventService] rôles du compte ${userId} illisibles : ${error.message}`);
            throw new EventServiceError(500, 'EDITION_UNAVAILABLE', UNAVAILABLE_MESSAGE);
        }
        return (data ?? []).length > 0;
    }

    /**
     * Événement modifiable par l'acteur (lecture préalable au schéma, la RPC refait chaque contrôle sous verrou) :
     * propriétaire seul (admin : 403 ADMIN_CANNOT_EDIT ; autre compte : 404) ; EN_ATTENTE → 409 WITHDRAW_TO_EDIT ;
     * TERMINE et ANNULE → 409 EVENT_LOCKED.
     */
    private static async loadEditableEvent(eventId: string, actorId: string, what: 'event' | 'categories'): Promise<EditableEvent> {
        if (!UUID_RE.test(eventId)) throw new EventServiceError(404, 'EVENT_NOT_FOUND', NOT_FOUND_MESSAGE);
        const { data, error } = await getServiceRoleClient()
            .from('events')
            .select('id, partner_id, status, start_date, start_time, end_date, end_time, image_url')
            .eq('id', eventId)
            .maybeSingle();
        if (error) {
            console.error(`[EventService] événement ${eventId} illisible : ${error.message}`);
            throw new EventServiceError(500, 'EDITION_UNAVAILABLE', UNAVAILABLE_MESSAGE);
        }
        if (!data) throw new EventServiceError(404, 'EVENT_NOT_FOUND', NOT_FOUND_MESSAGE);
        const event = data as EditableEvent;
        const partner = await this.partnerOf(actorId);
        if (!partner || partner.id !== event.partner_id) {
            if (await this.isStaff(actorId)) {
                throw new EventServiceError(403, 'ADMIN_CANNOT_EDIT', what === 'event'
                    ? 'Seul l’organisateur modifie son événement ; l’administration agit par les changements de statut.'
                    : 'Seul l’organisateur modifie la billetterie de son événement.');
            }
            throw new EventServiceError(404, 'EVENT_NOT_FOUND', NOT_FOUND_MESSAGE);
        }
        if (event.status === 'EN_ATTENTE') {
            throw new EventServiceError(409, 'WITHDRAW_TO_EDIT', what === 'event'
                ? 'L’événement est en cours de validation : retirez-le de la validation pour le modifier.'
                : 'L’événement est en cours de validation : retirez-le de la validation pour modifier sa billetterie.');
        }
        if (event.status === 'TERMINE' || event.status === 'ANNULE') {
            throw new EventServiceError(409, 'EVENT_LOCKED', what === 'event'
                ? 'Un événement terminé ou annulé ne peut plus être modifié.'
                : 'La billetterie d’un événement terminé ou annulé ne peut plus être modifiée.');
        }
        return event;
    }

    /**
     * Création d'un événement BROUILLON et de ses catégories (contrat F2) : corps validé par le schéma partagé
     * (400 avec la liste des champs), puis RPC event_create (une seule transaction). Le partenaire est dérivé du
     * compte ; services forcés à la seule billetterie (F5).
     */
    public static async createEvent(partnerUserId: string, input: unknown): Promise<DbRecord> {
        const partner = await this.partnerOf(partnerUserId);
        if (!partner) {
            throw new EventServiceError(403, 'PARTNER_NOT_FOUND', 'Seul un organisateur disposant d’un profil partenaire peut créer un événement.');
        }
        const parsed = parseWithFrenchErrors(createEventSchema({ partnerId: partner.id }), input);
        if (!parsed.success) throw invalid(parsed.error);
        const { ticket_categories: categories, ...event } = parsed.data;
        const result = await editionResult<{ ok: true; event: DbRecord }>('event_create', rpcWithRetry('event_create', { p: {
            actor_id: partnerUserId,
            event,
            ticket_categories: categories,
        } }));
        return result.event;
    }

    /**
     * Récupère la liste des événements d'un partenaire avec filtres et stats
     */
    public static async getPartnerEvents(partnerUserId: string, options?: { status?: string; search?: string }) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        let query = supabase
            .from('events')
            .select('*, ticket_categories(*)')
            .eq('partner_id', partnerId)
            .order('created_at', { ascending: false });

        if (options?.status && options.status !== 'TOUS') {
            query = query.eq('status', options.status);
        }

        if (options?.search && options.search.trim()) {
            query = query.ilike('title', `%${pgEscapeLike(options.search.trim())}%`); // lot 1C.1 : jokers échappés
        }

        const { data, error } = await query;
        if (error) {
            throw new Error(`Erreur récupération événements: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Récupère un événement par son ID avec vérification des droits
     */
    public static async getEventById(eventId: string, partnerUserId?: string) {
        const supabase = getServiceRoleClient();
        let query = supabase
            .from('events')
            .select('*, ticket_categories(*), partners(company_name, phone, user_id)')
            .eq('id', eventId);

        if (partnerUserId) {
            const partnerId = await this.resolvePartnerId(partnerUserId);
            query = query.eq('partner_id', partnerId);
        }

        const { data, error } = await query.single();
        if (error || !data) {
            throw new Error('Événement introuvable ou non autorisé.');
        }

        return data;
    }

    /**
     * Édition d'un événement (contrat F3) : corps `{ patch, expected_updated_at }`. Champs interdits → 400
     * FIELD_NOT_EDITABLE ; patch validé par le schéma partagé ; RPC event_update (verrou, version, règles
     * par statut, verrous après ventes, file des notifications, fonds). Les SMS partent par le cron
     * event-change-notifications.
     */
    public static async updateEvent(eventId: string, actorId: string, body: unknown): Promise<EventUpdateResult> {
        const shape = updateBodySchema.safeParse(body);
        if (!shape.success) {
            throw new EventServiceError(400, 'INVALID_BODY',
                'Corps de requête invalide : envoyez les modifications (patch) et la version lue de l’événement (expected_updated_at).');
        }
        const { patch, expected_updated_at } = shape.data;
        const event = await this.loadEditableEvent(eventId, actorId, 'event');

        const forbidden = Object.keys(patch).filter((k) => (NON_EDITABLE_EVENT_FIELDS as readonly string[]).includes(k));
        if (forbidden.length > 0) {
            const message = forbidden.includes('ticket_categories')
                ? 'Les catégories de billets se modifient une par une depuis la billetterie, pas avec l’événement.'
                : 'Ce champ ne se modifie pas depuis le formulaire de l’événement.';
            throw new EventServiceError(400, 'FIELD_NOT_EDITABLE', message, {
                field: forbidden[0],
                fields: forbidden.map((path) => ({ path, code: 'FIELD_NOT_EDITABLE', message })),
            });
        }

        const parsed = parseWithFrenchErrors(updateEventSchema({
            partnerId: event.partner_id,
            current: {
                start_date: event.start_date,
                start_time: event.start_time,
                end_date: event.end_date,
                end_time: event.end_time,
                image_url: event.image_url,
            },
        }), patch);
        if (!parsed.success) throw invalid(parsed.error);

        const result = await editionResult<{ ok: true; event: DbRecord; notified_holders: number; sms_queued: number }>('event_update', rpcWithRetry('event_update', { p: {
            event_id: eventId,
            actor_id: actorId,
            patch: parsed.data,
            expected_updated_at,
        } }));
        return { event: result.event, notified_holders: Number(result.notified_holders ?? 0), sms_queued: Number(result.sms_queued ?? 0) };
    }

    /** Ajout d'une catégorie de billets (F4) : schéma partagé, puis RPC ticket_category_create. */
    public static async createTicketCategory(actorId: string, eventId: string, input: unknown): Promise<DbRecord> {
        const event = await this.loadEditableEvent(eventId, actorId, 'categories');
        const parsed = parseWithFrenchErrors(createTicketCategorySchema({ eventEnd: eventEndAt(event) }), input);
        if (!parsed.success) throw invalid(parsed.error);
        const result = await editionResult<{ ok: true; category: DbRecord }>('ticket_category_create', rpcWithRetry('ticket_category_create', { p: {
            event_id: eventId,
            actor_id: actorId,
            category: parsed.data,
        } }));
        return result.category;
    }

    /**
     * Modification d'une catégorie (F4) : tous les champs envoyés sont appliqués ou refusés en clair (prix verrouillé
     * après ventes, quota ≥ vendus + réservés, Σ quotas ≤ jauge, nom unique, dates de vente) ; aucune réactivation implicite.
     */
    public static async updateTicketCategory(actorId: string, eventId: string, categoryId: string, input: unknown): Promise<DbRecord> {
        const event = await this.loadEditableEvent(eventId, actorId, 'categories');
        if (!UUID_RE.test(categoryId)) throw new EventServiceError(404, 'CATEGORY_NOT_FOUND', 'Catégorie de billets introuvable pour cet événement.');
        const { data: current, error } = await getServiceRoleClient()
            .from('ticket_categories')
            .select('id, sale_start, sale_end')
            .eq('id', categoryId)
            .eq('event_id', eventId)
            .maybeSingle();
        if (error) {
            console.error(`[EventService] catégorie ${categoryId} illisible : ${error.message}`);
            throw new EventServiceError(500, 'EDITION_UNAVAILABLE', UNAVAILABLE_MESSAGE);
        }
        if (!current) throw new EventServiceError(404, 'CATEGORY_NOT_FOUND', 'Catégorie de billets introuvable pour cet événement.');
        const parsed = parseWithFrenchErrors(updateTicketCategorySchema({
            eventEnd: eventEndAt(event),
            current: { sale_start: current.sale_start ?? null, sale_end: current.sale_end ?? null },
        }), input);
        if (!parsed.success) throw invalid(parsed.error);
        const result = await editionResult<{ ok: true; category: DbRecord }>('ticket_category_update', rpcWithRetry('ticket_category_update', { p: {
            event_id: eventId,
            category_id: categoryId,
            actor_id: actorId,
            patch: parsed.data,
        } }));
        return {
            ...result.category,
            available_quantity: Math.max(0, Number(result.category.total_quantity) - Number(result.category.sold_quantity ?? 0) - Number(result.category.held_quantity ?? 0)),
        };
    }

    /** Suppression d'une catégorie sans billet ni réservation (F4), sinon 409 CATEGORY_HAS_SALES (désactivation proposée). */
    public static async deleteTicketCategory(actorId: string, eventId: string, categoryId: string): Promise<{ category_id: string }> {
        await this.loadEditableEvent(eventId, actorId, 'categories');
        if (!UUID_RE.test(categoryId)) throw new EventServiceError(404, 'CATEGORY_NOT_FOUND', 'Catégorie de billets introuvable pour cet événement.');
        const result = await editionResult<{ ok: true; category_id: string }>('ticket_category_delete', rpcWithRetry('ticket_category_delete', { p: {
            event_id: eventId,
            category_id: categoryId,
            actor_id: actorId,
        } }));
        return { category_id: String(result.category_id) };
    }

    /**
     * Suppression d'un événement (autorisé uniquement si statut BROUILLON). Les catégories, l'historique et la
     * file des notifications suivent par cascade, dans la même instruction.
     */
    public static async deleteEvent(eventId: string, partnerUserId: string) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { data: existing, error: findErr } = await supabase
            .from('events')
            .select('id, status')
            .eq('id', eventId)
            .eq('partner_id', partnerId)
            .single();

        if (findErr || !existing) {
            throw new Error('Événement introuvable.');
        }

        if (existing.status !== 'BROUILLON') {
            throw new Error('Seuls les événements en statut BROUILLON peuvent être supprimés.');
        }

        const { data: deleted, error: delErr } = await supabase
            .from('events')
            .delete()
            .eq('id', eventId)
            .eq('status', 'BROUILLON')
            .select('id');

        if (delErr) {
            console.error(`[EventService.deleteEvent] suppression de ${eventId} impossible : ${delErr.code} ${delErr.message}`);
            throw new Error('Suppression de l’événement impossible pour le moment.');
        }
        if (!deleted || deleted.length === 0) {
            throw new Error('Seuls les événements en statut BROUILLON peuvent être supprimés.');
        }

        return { success: true };
    }

    /**
     * Lot 5 (5.2) : changement de statut par la RPC event_transition (table event_status_transitions en
     * base, motifs obligatoires, historique, garde du statut). Le rôle de l'acteur est dérivé en base
     * (user_roles, propriété du partenaire) : le paramètre userRole n'est plus lu. Un refus lève
     * EventLifecycleError (statut HTTP, code, message en français).
     */
    public static async changeEventStatus(
        eventId: string,
        userId: string,
        newStatus: EventStatus,
        _userRole: string = 'PARTENAIRE',
        reason?: string
    ) {
        void _userRole;
        await EventLifecycleService.transition({ eventId, actorId: userId, to: newStatus, reason: reason ?? null });
        const { data: updatedEvent, error } = await getServiceRoleClient().from('events').select('*').eq('id', eventId).single();
        if (error || !updatedEvent) {
            throw new Error(`Relecture de l'événement après le changement de statut impossible : ${error?.message ?? 'absent'}`);
        }
        return updatedEvent;
    }

}
