/**
 * Transferts de billets entre particuliers (lot 4.1, dette reprise au lot 5, contrat C1).
 *
 *  - La base est la seule source de vérité : aucun état en mémoire de processus. Initiation,
 *    annulation et expiration passent par les RPC ticket_transfer_initiate, ticket_transfer_cancel et
 *    ticket_transfers_expire, qui posent le transfert ET tickets.transfer_locked dans la même
 *    transaction ; la réclamation par ticket_transfer_claim (lot 4).
 *  - Toute erreur de lecture ou d'écriture remonte (exception) : la route répond 500 avec un message
 *    générique, le détail est journalisé. Un refus métier porte un statut HTTP et un message français.
 *  - Un échec de l'envoi au destinataire (SMS ou email) ne casse pas le transfert : il est journalisé
 *    et la réponse porte recipient_notified: false.
 */
import crypto from 'crypto';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { normalizeRecipient } from '@/lib/validations/transfer';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { NotificationService } from '@/lib/notifications/notification.service';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { EmailService } from '@/lib/email/email.service';

export interface InitiateTransferResult {
    success: boolean;
    transfer_id: string;
    ticket_id: string;
    ticket_number: string;
    recipient: string;
    recipient_type: 'PHONE' | 'EMAIL';
    expires_at: string;
    claim_token: string;
    claim_url: string;
    event_title?: string;
    /** Le destinataire a reçu le SMS ou l'email avec le lien de réclamation. */
    recipient_notified: boolean;
}

export interface ClaimInfoResult {
    success: boolean;
    transfer_id: string;
    ticket_id: string;
    expires_at: string;
    status: string;
    sender_name_masked: string;
    recipient_target_masked: string;
    ticket: {
        ticket_number_masked: string;
        category_name: string;
        price: number;
    };
    event: {
        id: string;
        title: string;
        start_date: string;
        start_time: string;
        location: string;
        city: string;
        image_url?: string | null;
    };
}

export interface ClaimTransferResult {
    success: boolean;
    message: string;
    transfer_id: string;
    ticket_id: string;
    ticket_number: string;
    event_title?: string;
    new_user_id: string;
    claimed_at: string;
}

export interface CancelTransferResult {
    success: boolean;
    message: string;
    transfer_id: string;
    ticket_id: string;
    /** Le destinataire a été prévenu de l'annulation. */
    recipient_notified: boolean;
}

export interface ExpireTransfersResult {
    expiredCount: number;
    transferIds: string[];
}

/** Ligne de public.ticket_transfers. */
export interface TicketTransferRecord {
    id: string;
    ticket_id: string;
    from_user_id: string;
    to_user_id: string | null;
    to_phone_or_email: string;
    status: 'PENDING' | 'CLAIMED' | 'CANCELLED' | 'EXPIRED';
    claim_token_hash: string;
    created_at: string;
    expires_at: string;
    claimed_at: string | null;
    cancelled_at: string | null;
    expired_at: string | null;
}

/** Refus métier : statut HTTP et message destinés à l'utilisateur. */
export type TransferRefusal = Error & {
    statusCode: number;
    code?: string;
    expired?: boolean;
    already_claimed?: boolean;
    cancelled?: boolean;
};

function refuse(message: string, statusCode: number, extra: Partial<TransferRefusal> = {}): never {
    const err = new Error(message) as TransferRefusal;
    err.statusCode = statusCode;
    Object.assign(err, extra);
    throw err;
}

type RpcReply = Record<string, unknown> & { ok?: boolean; code?: string; message?: string };

function maskName(firstName?: string, lastName?: string): string {
    const fn = (firstName || '').trim();
    const ln = (lastName || '').trim();
    if (!fn && !ln) return 'Un utilisateur Event Village';
    if (fn && ln) return `${fn} ${ln.charAt(0).toUpperCase()}.`;
    if (fn) return `${fn.charAt(0).toUpperCase()}***`;
    return `${ln.charAt(0).toUpperCase()}***`;
}

function maskRecipient(target: string): string {
    if (target.includes('@')) {
        const [local, domain] = target.split('@');
        const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : `${local.charAt(0)}***`;
        return `${maskedLocal}@${domain || '***'}`;
    }
    if (target.length >= 8) {
        return `${target.slice(0, 4)}***${target.slice(-2)}`;
    }
    return '***';
}

function errText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

const INITIATE_REFUSALS: Record<string, number> = {
    INVALID_INPUT: 400,
    TICKET_NOT_FOUND: 404,
    NOT_OWNER: 403,
    TICKET_NOT_TRANSFERABLE: 400,
    TICKET_USED: 400,
    EVENT_NOT_ACTIVE: 400,
    TRANSFER_PENDING: 409,
};

const CANCEL_REFUSALS: Record<string, number> = {
    INVALID_INPUT: 400,
    TRANSFER_NOT_FOUND: 404,
    NOT_SENDER: 403,
    TRANSFER_NOT_PENDING: 409,
};

const TRANSFER_STATUS_MESSAGES: Record<string, string> = {
    CLAIMED: 'Ce transfert a déjà été réclamé : il ne peut plus être annulé.',
    CANCELLED: 'Ce transfert est déjà annulé.',
    EXPIRED: 'Ce transfert a déjà expiré.',
};

/**
 * Envoie un message au destinataire désigné (SMS ou email). Renvoie true si l'envoi est accepté ;
 * un refus ou une panne est journalisé et donne false (le transfert reste valable).
 */
async function notifyRecipient(target: string, sms: string, email: { subject: string; html: string }, actorId: string, context: string): Promise<boolean> {
    try {
        if (target.includes('@')) {
            const res = await EmailService.send({ to: target, subject: email.subject, html: email.html });
            if (!res.sent) console.warn(`[TicketTransferService] ${context} : email au destinataire non envoyé (${res.error ?? 'raison inconnue'}).`);
            return res.sent === true;
        }
        // Lot 4.8 : SMS vers un numéro choisi par l'expéditeur, compté sur son compte (SMS_PER_ACCOUNT_DAY)
        const res = await mTargetService.sendSms(target, sms, { actorId });
        if (!res.success) console.warn(`[TicketTransferService] ${context} : SMS au destinataire non envoyé (${res.code ?? res.error ?? 'raison inconnue'}).`);
        return res.success === true;
    } catch (err) {
        console.error(`[TicketTransferService] ${context} : envoi au destinataire en échec :`, errText(err));
        return false;
    }
}

function appUrl(): string {
    return (process.env.NEXT_PUBLIC_APP_URL || 'https://eventvillage.sn').replace(/\/+$/, '');
}

export class TicketTransferService {
    /**
     * Initie un transfert : RPC ticket_transfer_initiate (porteur, billet VALIDE non composté,
     * événement PUBLIE ou VALIDE, aucun transfert en attente ; transfert PENDING et verrou du billet
     * posés ensemble), puis envoi du lien de réclamation au destinataire.
     */
    public static async initiateTransfer(
        userId: string,
        ticketId: string,
        rawRecipient: string,
        options?: { injectedClaimToken?: string }
    ): Promise<InitiateTransferResult> {
        if (!userId) refuse('Authentification requise pour transférer un billet.', 401);
        if (!ticketId) refuse('Identifiant de billet requis.', 400);

        const { normalized: recipient, type: recipientType } = normalizeRecipient(rawRecipient);

        // Jeton de réclamation : seul son haché est stocké. Un jeton imposé n'est jamais accepté en production.
        const isProduction = process.env.NODE_ENV === 'production';
        const rawClaimToken = (!isProduction && options?.injectedClaimToken)
            ? options.injectedClaimToken
            : crypto.randomBytes(32).toString('hex');
        const claimTokenHash = crypto.createHash('sha256').update(rawClaimToken).digest('hex');
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString(); // 48 heures

        const { data, error } = await rpcWithRetry<RpcReply>('ticket_transfer_initiate', {
            p: {
                ticket_id: ticketId,
                actor_id: userId,
                recipient,
                claim_token_hash: claimTokenHash,
                expires_at: expiresAt,
            },
        });
        if (error) throw new Error(`ticket_transfer_initiate : ${error.code ?? ''} ${error.message}`);
        if (!data) throw new Error('ticket_transfer_initiate : réponse vide');
        if (data.ok !== true) {
            const code = String(data.code ?? '');
            const status = INITIATE_REFUSALS[code];
            if (!status) throw new Error(`ticket_transfer_initiate : refus inattendu ${JSON.stringify(data)}`);
            refuse(String(data.message ?? 'Transfert refusé.'), status, { code });
        }
        const transferId = String(data.transfer_id ?? '');
        const ticketNumber = String(data.ticket_number ?? '');
        if (!transferId || !ticketNumber) throw new Error(`ticket_transfer_initiate : réponse incomplète ${JSON.stringify(data)}`);
        const eventTitle = typeof data.event_title === 'string' && data.event_title ? data.event_title : 'votre événement';

        const claimUrl = `${appUrl()}/tickets/claim/${rawClaimToken}`;
        const recipientNotified = await notifyRecipient(
            recipient,
            `Event Village : un billet pour "${eventTitle}" vous a ete offert. Reclamez-le avant 48 h : ${claimUrl}`,
            {
                subject: `Billet offert pour « ${eventTitle} » — Event Village`,
                html: `<p>Bonjour,</p><p>Un billet pour <strong>${eventTitle}</strong> vous a été transféré sur Event Village.</p><p><a href="${claimUrl}">Réclamer et activer votre billet</a></p><p>Ce lien est valable 48 heures.</p>`,
            },
            userId,
            `transfert ${transferId}`,
        );

        return {
            success: true,
            transfer_id: transferId,
            ticket_id: String(data.ticket_id ?? ticketId),
            ticket_number: ticketNumber,
            recipient,
            recipient_type: recipientType,
            expires_at: String(data.expires_at ?? expiresAt),
            claim_token: rawClaimToken,
            claim_url: claimUrl,
            event_title: typeof data.event_title === 'string' ? data.event_title : undefined,
            recipient_notified: recipientNotified,
        };
    }

    /**
     * Détails publics d'un transfert à réclamer (aucun secret). Lectures strictes : une panne remonte,
     * un billet ou un événement manquant pour un transfert existant est une incohérence (exception).
     */
    public static async getClaimTransferInfo(rawToken: string): Promise<ClaimInfoResult> {
        if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
            refuse('Jeton de réclamation invalide.', 400);
        }
        const claimTokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
        const supabase = getServiceRoleClient();

        const { data: transfer, error: transferErr } = await supabase
            .from('ticket_transfers')
            .select('id, ticket_id, from_user_id, to_phone_or_email, status, expires_at')
            .eq('claim_token_hash', claimTokenHash)
            .maybeSingle();
        if (transferErr) throw new Error(`lecture du transfert : ${transferErr.message}`);
        if (!transfer) refuse('Lien de réclamation introuvable ou invalide.', 404);

        if (transfer.status === 'CLAIMED') refuse('Ce billet a déjà été réclamé.', 410, { already_claimed: true });
        if (transfer.status === 'CANCELLED') refuse('Ce transfert a été annulé par son propriétaire.', 410, { cancelled: true });
        if (transfer.status === 'EXPIRED' || new Date(String(transfer.expires_at)).getTime() <= Date.now()) {
            refuse('Ce lien de transfert a expiré (délai de 48 h dépassé).', 410, { expired: true });
        }

        const { data: ticket, error: ticketErr } = await supabase
            .from('tickets')
            .select('id, ticket_number, price, ticket_categories(name), events(id, title, start_date, start_time, location, city, image_url)')
            .eq('id', transfer.ticket_id)
            .maybeSingle();
        if (ticketErr) throw new Error(`lecture du billet ${transfer.ticket_id} : ${ticketErr.message}`);
        if (!ticket) throw new Error(`incohérence : billet ${transfer.ticket_id} du transfert ${transfer.id} introuvable`);
        const ev = ticket.events as unknown as { id: string; title: string; start_date: string; start_time: string; location: string; city: string | null; image_url: string | null } | null;
        const cat = ticket.ticket_categories as unknown as { name: string } | null;
        if (!ev) throw new Error(`incohérence : événement du billet ${ticket.id} introuvable`);
        if (!cat) throw new Error(`incohérence : catégorie du billet ${ticket.id} introuvable`);

        const { data: sender, error: senderErr } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', transfer.from_user_id)
            .maybeSingle();
        if (senderErr) throw new Error(`lecture de l'expéditeur ${transfer.from_user_id} : ${senderErr.message}`);

        const ticketNumber = String(ticket.ticket_number);
        return {
            success: true,
            transfer_id: String(transfer.id),
            ticket_id: String(transfer.ticket_id),
            expires_at: String(transfer.expires_at),
            status: String(transfer.status),
            sender_name_masked: maskName(sender?.first_name ?? undefined, sender?.last_name ?? undefined),
            recipient_target_masked: maskRecipient(String(transfer.to_phone_or_email)),
            ticket: {
                ticket_number_masked: ticketNumber.length > 8 ? `TCK-***-${ticketNumber.slice(-4)}` : ticketNumber,
                category_name: cat.name,
                price: Number(ticket.price),
            },
            event: {
                id: ev.id,
                title: ev.title,
                start_date: ev.start_date,
                start_time: ev.start_time,
                location: ev.location,
                city: ev.city ?? '',
                image_url: ev.image_url ?? null,
            },
        };
    }

    /**
     * Réclame un billet transféré (lot 4.1) : identité du compte connecté vérifiée contre le
     * destinataire désigné, puis la RPC ticket_transfer_claim fait tout ou rien, sous verrou :
     * transfert PENDING → CLAIMED, nouveau propriétaire, ticket_number, qr_code et totp_secret
     * régénérés, transfer_locked levé, security_version + 1. L'ancien numéro et l'ancien code
     * dynamique ne valent plus rien. Aucune erreur n'est ignorée.
     */
    public static async claimTransfer(
        recipientUserId: string,
        rawToken: string
    ): Promise<ClaimTransferResult> {
        if (!recipientUserId) refuse('Authentification requise pour réclamer un billet.', 401);
        if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) refuse('Jeton de réclamation requis.', 400);

        const claimTokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
        const supabase = getServiceRoleClient();

        // 1. Transfert désigné par le jeton (base uniquement)
        const { data: transfer, error: transferErr } = await supabase
            .from('ticket_transfers')
            .select('id, ticket_id, from_user_id, to_phone_or_email, status, expires_at')
            .eq('claim_token_hash', claimTokenHash)
            .maybeSingle();
        if (transferErr) throw new Error(`lecture du transfert : ${transferErr.message}`);
        if (!transfer) return refuse('Lien de réclamation introuvable ou invalide.', 404);

        if (transfer.status !== 'PENDING') refuse('Ce transfert n’est plus en attente.', 400);
        if (new Date(transfer.expires_at).getTime() <= Date.now()) refuse('Ce lien de transfert a expiré (délai de 48 h dépassé).', 410);

        // 2. Identité du compte connecté contre le destinataire désigné
        const { data: recipientUser, error: userErr } = await supabase
            .from('users')
            .select('id, phone, email, first_name, last_name')
            .eq('id', recipientUserId)
            .maybeSingle();
        if (userErr) throw new Error(`lecture du compte destinataire : ${userErr.message}`);
        if (!recipientUser) return refuse('Compte utilisateur destinataire introuvable.', 401);

        const normalizedTarget = normalizeRecipient(transfer.to_phone_or_email);
        const userPhoneNorm = recipientUser.phone ? normalizePhoneNumber(recipientUser.phone) : null;
        const userEmailNorm = recipientUser.email ? recipientUser.email.toLowerCase().trim() : null;
        const identityMatches =
            (normalizedTarget.type === 'PHONE' && userPhoneNorm !== null && userPhoneNorm === normalizedTarget.normalized)
            || (normalizedTarget.type === 'EMAIL' && userEmailNorm !== null && userEmailNorm === normalizedTarget.normalized);
        if (!identityMatches) {
            refuse(`Ce billet est réservé pour ${normalizedTarget.normalized}. Votre compte actuel (${userPhoneNorm || userEmailNorm || 'inconnu'}) ne correspond pas au destinataire désigné.`, 403);
        }
        if (transfer.from_user_id === recipientUserId) refuse('Vous êtes déjà le propriétaire initial de ce billet.', 400);

        // 3. Réclamation atomique (verrous du transfert et du billet, identité du billet régénérée)
        const { data: claim, error: claimErr } = await rpcWithRetry<{
            ok: boolean; code?: string; status?: string; ticket_id?: string; ticket_number?: string; previous_owner?: string;
        }>('ticket_transfer_claim', { p_transfer_id: transfer.id, p_recipient: recipientUserId });
        if (claimErr) throw new Error(`ticket_transfer_claim : ${claimErr.message}`);
        if (!claim) throw new Error('ticket_transfer_claim : réponse vide');
        if (!claim.ok) {
            switch (claim.code) {
                case 'TRANSFER_NOT_FOUND':
                    return refuse('Lien de réclamation introuvable ou invalide.', 404);
                case 'TRANSFER_NOT_PENDING':
                    return refuse('Conflit de réclamation : ce billet a déjà été réclamé ou annulé.', 409);
                case 'TRANSFER_EXPIRED':
                    return refuse('Ce lien de transfert a expiré (délai de 48 h dépassé).', 410);
                case 'SELF_TRANSFER':
                    return refuse('Vous êtes déjà le propriétaire initial de ce billet.', 400);
                case 'OWNER_CHANGED':
                    return refuse('L’expéditeur n’est plus le propriétaire de ce billet.', 400);
                case 'TICKET_NOT_TRANSFERABLE':
                    return refuse('Ce billet n’est plus transférable.', 400);
                default:
                    throw new Error(`ticket_transfer_claim : refus inattendu ${JSON.stringify(claim)}`);
            }
        }
        if (!claim.ticket_id || !claim.ticket_number) throw new Error(`ticket_transfer_claim : réponse incomplète ${JSON.stringify(claim)}`);

        // 4. Notifications (non bloquantes, échec journalisé)
        const { data: ticket, error: ticketErr } = await supabase
            .from('tickets')
            .select('id, events(title)')
            .eq('id', claim.ticket_id)
            .maybeSingle();
        if (ticketErr) console.warn('[ClaimTransfer] lecture de l’événement du billet pour la notification :', ticketErr.message);
        const eventTitle = (ticket?.events as { title?: string } | null | undefined)?.title || 'Événement Event Village';
        const recipientName = [recipientUser.first_name, recipientUser.last_name].filter(Boolean).join(' ') || recipientUser.phone || 'Nouveau Propriétaire';

        NotificationService.sendTicketTransferClaimedNotifications({
            senderUserId: transfer.from_user_id,
            recipientUserId,
            ticketId: claim.ticket_id,
            ticketNumber: claim.ticket_number,
            eventTitle,
            recipientName,
        }).catch((err: unknown) => console.warn('[ClaimTransfer Notification]:', errText(err)));

        return {
            success: true,
            message: 'Billet réclamé avec succès et ajouté à votre portefeuille.',
            transfer_id: transfer.id,
            ticket_id: claim.ticket_id,
            ticket_number: claim.ticket_number,
            event_title: eventTitle,
            new_user_id: recipientUserId,
            claimed_at: new Date().toISOString(),
        };
    }

    /**
     * Annule un transfert PENDING par son émetteur : RPC ticket_transfer_cancel (CANCELLED et billet
     * déverrouillé dans la même transaction, secrets du billet inchangés), puis avis au destinataire.
     */
    public static async cancelTransfer(
        senderUserId: string,
        transferId: string
    ): Promise<CancelTransferResult> {
        if (!senderUserId) refuse('Authentification requise pour annuler un transfert.', 401);
        if (!transferId) refuse('Identifiant de transfert requis.', 400);

        const { data, error } = await rpcWithRetry<RpcReply>('ticket_transfer_cancel', {
            p: { transfer_id: transferId, actor_id: senderUserId },
        });
        if (error) throw new Error(`ticket_transfer_cancel : ${error.code ?? ''} ${error.message}`);
        if (!data) throw new Error('ticket_transfer_cancel : réponse vide');
        if (data.ok !== true) {
            const code = String(data.code ?? '');
            const status = CANCEL_REFUSALS[code];
            if (!status) throw new Error(`ticket_transfer_cancel : refus inattendu ${JSON.stringify(data)}`);
            const message = code === 'TRANSFER_NOT_PENDING'
                ? TRANSFER_STATUS_MESSAGES[String(data.status)] ?? String(data.message ?? 'Ce transfert n’est plus en attente.')
                : String(data.message ?? 'Annulation refusée.');
            refuse(message, status, { code });
        }
        const ticketId = String(data.ticket_id ?? '');
        const target = String(data.to_phone_or_email ?? '');
        if (!ticketId || !target) throw new Error(`ticket_transfer_cancel : réponse incomplète ${JSON.stringify(data)}`);

        // Avis au destinataire : l'annulation est acquise, un échec est journalisé et signalé dans la réponse
        let recipientNotified = false;
        const { data: ticket, error: ticketErr } = await getServiceRoleClient()
            .from('tickets')
            .select('ticket_number, events(title)')
            .eq('id', ticketId)
            .maybeSingle();
        if (ticketErr || !ticket) {
            console.error(`[TicketTransferService] annulation ${transferId} : lecture du billet pour l’avis au destinataire impossible :`, ticketErr?.message ?? 'billet introuvable');
        } else {
            const eventTitle = (ticket.events as { title?: string } | null)?.title || 'votre événement';
            const msg = `Event Village : le transfert du billet ${ticket.ticket_number} pour "${eventTitle}" a ete annule par son proprietaire.`;
            recipientNotified = await notifyRecipient(target, msg, {
                subject: 'Transfert de billet annulé — Event Village',
                html: `<p>Le transfert du billet ${ticket.ticket_number} pour <strong>${eventTitle}</strong> a été annulé par son propriétaire.</p>`,
            }, senderUserId, `annulation ${transferId}`);
        }

        return {
            success: true,
            message: 'Transfert annulé avec succès.',
            transfer_id: transferId,
            ticket_id: ticketId,
            recipient_notified: recipientNotified,
        };
    }

    /** Expiration des transferts PENDING échus (cron) : RPC ticket_transfers_expire, billets déverrouillés. */
    public static async expireOverdueTransfers(): Promise<ExpireTransfersResult> {
        const { data, error } = await rpcWithRetry<RpcReply & { expired?: Array<{ id: string }> }>('ticket_transfers_expire', { p: {} });
        if (error) throw new Error(`ticket_transfers_expire : ${error.code ?? ''} ${error.message}`);
        if (!data || data.ok !== true || !Array.isArray(data.expired)) {
            throw new Error(`ticket_transfers_expire : réponse inattendue ${JSON.stringify(data)}`);
        }
        const transferIds = data.expired.map((t) => String(t.id));
        return { expiredCount: transferIds.length, transferIds };
    }

    /** Transfert par identifiant (base), null s'il n'existe pas ; une erreur de lecture lève. */
    public static async getTransferRecord(transferId: string): Promise<TicketTransferRecord | null> {
        const { data, error } = await getServiceRoleClient().from('ticket_transfers').select('*').eq('id', transferId).maybeSingle();
        if (error) throw new Error(`lecture du transfert ${transferId} : ${error.message}`);
        return (data ?? null) as TicketTransferRecord | null;
    }

    /** Dernier transfert d'un billet (base), null s'il n'y en a aucun ; une erreur de lecture lève. */
    public static async getTransferByTicketId(ticketId: string): Promise<TicketTransferRecord | null> {
        const { data, error } = await getServiceRoleClient()
            .from('ticket_transfers')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw new Error(`lecture des transferts du billet ${ticketId} : ${error.message}`);
        return (data ?? null) as TicketTransferRecord | null;
    }

    /** Verrou de transfert du billet (tickets.transfer_locked) ; une erreur de lecture lève. */
    public static async isTicketLocked(ticketId: string): Promise<boolean> {
        const { data, error } = await getServiceRoleClient().from('tickets').select('transfer_locked').eq('id', ticketId).maybeSingle();
        if (error) throw new Error(`lecture du verrou du billet ${ticketId} : ${error.message}`);
        return data?.transfer_locked === true;
    }
}
