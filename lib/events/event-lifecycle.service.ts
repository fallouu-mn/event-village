/**
 * Lot 5 (5.2, 5.4) — cycle de vie d'un événement côté serveur.
 *
 * Le statut ne change que par les RPC de la migration 20261102000003_lot5_cycle.sql :
 *  - event_transition (D4) : table event_status_transitions, motifs, complétude, dates, historique et
 *    notifications dans l'application, dans une seule transaction ;
 *  - event_cancel (D6) : voir lib/events/event-cancellation.service.ts ;
 *  - events_finish_overdue (D7) : cron /api/cron/events-finish.
 * Une écriture directe de events.status est refusée par la base (garde EV422), service_role compris.
 * Après le commit, ce module envoie les SMS et emails au partenaire (au mieux, résultat journalisé) et
 * prévient les SUPERADMIN d'une soumission.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { EmailService, EmailTemplates } from '@/lib/email/email.service';
import { NotificationService } from '@/lib/notifications/notification.service';

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
        await this.notifyAfterTransition(body);
        return body;
    }

    /**
     * Envois hors transaction après une transition acceptée (la notification dans l'application est
     * écrite par la RPC) : SMS et email au partenaire pour une validation, un refus ou une suspension ;
     * alerte des SUPERADMIN pour une soumission. Chaque échec est journalisé, la transition reste acquise.
     */
    private static async notifyAfterTransition(t: TransitionResult): Promise<void> {
        const supabase = getServiceRoleClient();
        const isRefusal = t.from === 'EN_ATTENTE' && t.to === 'BROUILLON' && t.actor_role === 'ADMIN';
        const isSubmission = t.from === 'BROUILLON' && t.to === 'EN_ATTENTE';
        const partnerMessage = t.to === 'VALIDE' || t.to === 'SUSPENDU' || isRefusal;

        if (partnerMessage && t.partner_user_id) {
            const { data: partner, error } = await supabase
                .from('users')
                .select('email, phone, first_name, last_name')
                .eq('id', t.partner_user_id)
                .maybeSingle();
            if (error) {
                console.error(`[EventLifecycleService] coordonnées du partenaire ${t.partner_user_id} illisibles : ${error.message}`);
            } else if (partner) {
                const partnerName = `${partner.first_name ?? ''} ${partner.last_name ?? ''}`.trim() || 'Partenaire';
                const reason = t.reason ?? '';
                let sms: string;
                let email: { subject: string; html: string };
                if (t.to === 'VALIDE') {
                    sms = `Event Village : votre événement « ${t.title} » est validé. Connectez-vous pour le publier.`;
                    email = EmailTemplates.eventValidated({ partnerName, eventTitle: t.title });
                } else if (t.to === 'SUSPENDU') {
                    sms = `Event Village : votre événement « ${t.title} » est suspendu. Motif : ${reason}. Contactez le support.`;
                    email = EmailTemplates.eventSuspended({ partnerName, eventTitle: t.title, reason });
                } else {
                    sms = `Event Village : votre événement « ${t.title} » n’a pas été validé. Motif : ${reason}. Modifiez-le puis soumettez-le à nouveau.`;
                    email = EmailTemplates.eventRejected({ partnerName, eventTitle: t.title, reason });
                }
                if (partner.phone) {
                    try {
                        const sent = await mTargetService.sendSms(partner.phone, sms);
                        if (!sent.success) console.warn(`[EventLifecycleService] SMS au partenaire non envoyé (${sent.code ?? sent.error ?? 'inconnu'})`);
                    } catch (err) {
                        console.error('[EventLifecycleService] SMS au partenaire en échec :', err instanceof Error ? err.message : String(err));
                    }
                }
                if (partner.email) {
                    try {
                        const sent = await EmailService.send({ to: partner.email, ...email });
                        if (!sent.sent) console.warn(`[EventLifecycleService] email au partenaire non envoyé (${sent.error ?? 'inconnu'})`);
                    } catch (err) {
                        console.error('[EventLifecycleService] email au partenaire en échec :', err instanceof Error ? err.message : String(err));
                    }
                }
            }
        }

        if (isSubmission) {
            const { data: ev, error } = await supabase.from('events').select('partners(company_name)').eq('id', t.event_id).maybeSingle();
            if (error) console.error(`[EventLifecycleService] partenaire de l'événement ${t.event_id} illisible : ${error.message}`);
            const partnerRel = (ev as { partners?: { company_name?: string } | Array<{ company_name?: string }> } | null)?.partners;
            const companyName = (Array.isArray(partnerRel) ? partnerRel[0]?.company_name : partnerRel?.company_name) || 'Partenaire';
            try {
                await NotificationService.notifySuperadmins({
                    title: 'Nouvel événement soumis',
                    content: `Le partenaire « ${companyName} » a soumis l’événement « ${t.title} » pour validation.`,
                    type: 'SYSTEM',
                    metadata: { eventId: t.event_id, event_id: t.event_id, eventTitle: t.title, actionUrl: '/admin/events' },
                    smsMessage: `Event Village admin : nouvel événement « ${t.title} » de « ${companyName} » en attente de validation.`,
                    emailTemplate: EmailTemplates.superadminEventSubmitted({ partnerName: companyName, companyName, eventTitle: t.title }),
                });
            } catch (err) {
                console.error('[EventLifecycleService] alerte des SUPERADMIN en échec :', err instanceof Error ? err.message : String(err));
            }
        }
    }
}
