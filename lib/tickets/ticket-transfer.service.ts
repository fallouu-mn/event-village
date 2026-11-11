/**
 * Transferts de billets entre particuliers (lot 4.1, dette reprise au lot 5, transfert sans jeton au lot 6).
 *
 *  - La base est la seule source de vérité : aucun état en mémoire de processus. Initiation,
 *    annulation et expiration passent par les RPC ticket_transfer_initiate, ticket_transfer_cancel et
 *    ticket_transfers_expire, qui posent le transfert ET tickets.transfer_locked dans la même
 *    transaction ; la réclamation par ticket_transfer_accept (identité du compte vérifiée en base, puis
 *    ticket_transfer_claim du lot 4).
 *  - Lot 6 (contrat B, amendement 2) : le transfert vise un numéro de téléphone seulement, sans lien ni
 *    jeton. Les avis (offre, annulation, expiration, acceptation) sont mis en file par les RPC dans la
 *    boîte d'envoi : aucun envoi depuis ce module.
 *  - Toute erreur de lecture ou d'écriture remonte (exception) : la route répond 500 avec un message
 *    générique, le détail est journalisé. Un refus métier porte un statut HTTP, un code et un message
 *    français.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { rpcWithRetry } from '@/lib/payments/rpc';

export interface InitiateTransferResult {
    success: boolean;
    transfer_id: string;
    ticket_id: string;
    ticket_number: string;
    recipient: string;
    recipient_type: 'PHONE';
    expires_at: string;
    event_title?: string;
    /** L'offre au destinataire est dans la boîte d'envoi (même transaction que le transfert). */
    recipient_notification: 'QUEUED';
}

export interface IncomingTransfer {
    transfer_id: string;
    expires_at: string;
    sender_display: string;
    ticket: { category_name: string | null; price: number };
    event: {
        id: string;
        title: string;
        start_date: string;
        start_time: string;
        location: string;
        city: string | null;
        image_url: string | null;
    };
}

export interface IncomingTransfersResult {
    items: IncomingTransfer[];
    /** Un transfert attend un numéro non encore vérifié par code : aucun détail n'en est donné. */
    phoneVerificationRequired: boolean;
}

export interface AcceptTransferResult {
    transfer_id: string;
    ticket_id: string;
    ticket_number: string;
    event_title: string;
    claimed_at: string;
}

export interface CancelTransferResult {
    success: boolean;
    message: string;
    transfer_id: string;
    ticket_id: string;
    /** QUEUED : avis au destinataire mis en file ; NONE : ancien transfert vers un email, aucun canal. */
    recipient_notification: 'QUEUED' | 'NONE';
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
    /** Lot 9 bis (R46, B55) : DECLINED, refusé par son destinataire. */
    status: 'PENDING' | 'CLAIMED' | 'CANCELLED' | 'EXPIRED' | 'DECLINED';
    claim_token_hash: string | null;
    created_at: string;
    expires_at: string;
    claimed_at: string | null;
    cancelled_at: string | null;
    expired_at: string | null;
    declined_at: string | null;
}

export interface DeclineTransferResult {
    transfer_id: string;
    ticket_id: string;
    /** TRANSFER : le billet reste à l'expéditeur ; INVITATION : l'invitation est annulée, la place rendue. */
    kind: 'TRANSFER' | 'INVITATION';
}

/** Refus métier : statut HTTP, code stable et message destinés à l'utilisateur. */
export type TransferRefusal = Error & {
    statusCode: number;
    code?: string;
};

function refuse(message: string, statusCode: number, code?: string): never {
    const err = new Error(message) as TransferRefusal;
    err.statusCode = statusCode;
    if (code) err.code = code;
    throw err;
}

type RpcReply = Record<string, unknown> & { ok?: boolean; code?: string; message?: string };

/** Numéro du destinataire au format normalisé de normalizeRecipient (E.164 sénégalais). */
export const TRANSFER_PHONE = /^\+221[0-9]{9}$/;

const INITIATE_REFUSALS: Record<string, number> = {
    INVALID_INPUT: 400,
    RECIPIENT_PHONE_REQUIRED: 400,
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

/** Lot 9 bis (ex-10.0 d, B84, contrat 4.3) : transfert ou invitation échu, sans durée inventée. */
const TRANSFER_EXPIRED_MESSAGE = 'Ce billet ne peut plus être accepté : le délai est dépassé.';

/** Refus de ticket_transfer_accept (contrat B3) : statut HTTP et message exacts. */
const ACCEPT_REFUSALS: Record<string, { status: number; message: string }> = {
    INVALID_INPUT: { status: 400, message: 'Demande incomplète.' },
    TRANSFER_NOT_FOUND: { status: 404, message: 'Ce transfert est introuvable.' },
    PHONE_NOT_VERIFIED: { status: 403, message: "Confirmez d'abord votre numéro par un code SMS." },
    TRANSFER_NOT_PENDING: { status: 409, message: "Ce transfert n'est plus en attente." },
    // Lot 9 bis (ex-10.0 d, B84) : une invitation n'expire pas en 48 h (échéance à la fin de l'événement)
    TRANSFER_EXPIRED: { status: 410, message: TRANSFER_EXPIRED_MESSAGE },
    SELF_TRANSFER: { status: 400, message: 'Vous êtes déjà le propriétaire de ce billet.' },
    OWNER_CHANGED: { status: 409, message: 'L’expéditeur n’est plus le propriétaire de ce billet.' },
    TICKET_NOT_TRANSFERABLE: { status: 409, message: 'Ce billet n’est plus transférable.' },
    // Lot 7 (D20) : événement ni PUBLIE ni VALIDE (suspendu, annulé, terminé) au moment de l'acceptation
    EVENT_NOT_ACTIVE: { status: 409, message: 'Cet événement n’accepte plus de transfert.' },
};

/**
 * Refus de ticket_transfer_decline (lot 9 bis, R46, contrat 4.3) : mêmes codes, mêmes statuts et mêmes textes que
 * l'acceptation (un tiers et l'expéditeur reçoivent la même réponse, aucune fuite).
 */
const DECLINE_REFUSALS: Record<string, { status: number; message: string }> = ACCEPT_REFUSALS;

export class TicketTransferService {
    /**
     * Initie un transfert vers un numéro : RPC ticket_transfer_initiate (porteur, billet VALIDE non
     * composté, événement PUBLIE ou VALIDE, aucun transfert en attente ; transfert PENDING, verrou du
     * billet et offre au destinataire posés ensemble). Aucun jeton, aucun lien.
     */
    public static async initiateTransfer(userId: string, ticketId: string, recipientPhone: string): Promise<InitiateTransferResult> {
        if (!userId) refuse('Authentification requise pour transférer un billet.', 401, 'UNAUTHENTICATED');
        if (!ticketId) refuse('Identifiant de billet requis.', 400, 'TICKET_ID_REQUIRED');
        if (recipientPhone.includes('@')) refuse('Le billet se transfère vers un numéro de téléphone.', 400, 'RECIPIENT_PHONE_REQUIRED');
        if (!TRANSFER_PHONE.test(recipientPhone)) refuse('Numéro de téléphone du destinataire invalide.', 400, 'INVALID_BODY');

        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString(); // 48 heures
        const { data, error } = await rpcWithRetry<RpcReply>('ticket_transfer_initiate', {
            p: { ticket_id: ticketId, actor_id: userId, recipient: recipientPhone, expires_at: expiresAt },
        });
        if (error) throw new Error(`ticket_transfer_initiate : ${error.code ?? ''} ${error.message}`);
        if (!data) throw new Error('ticket_transfer_initiate : réponse vide');
        if (data.ok !== true) {
            const code = String(data.code ?? '');
            const status = INITIATE_REFUSALS[code];
            if (!status) throw new Error(`ticket_transfer_initiate : refus inattendu ${JSON.stringify(data)}`);
            refuse(String(data.message ?? 'Transfert refusé.'), status, code);
        }
        const transferId = String(data.transfer_id ?? '');
        const ticketNumber = String(data.ticket_number ?? '');
        if (!transferId || !ticketNumber || data.recipient_notification !== 'QUEUED') {
            throw new Error(`ticket_transfer_initiate : réponse incomplète ${JSON.stringify(data)}`);
        }

        return {
            success: true,
            transfer_id: transferId,
            ticket_id: String(data.ticket_id ?? ticketId),
            ticket_number: ticketNumber,
            recipient: recipientPhone,
            recipient_type: 'PHONE',
            expires_at: String(data.expires_at ?? expiresAt),
            event_title: typeof data.event_title === 'string' ? data.event_title : undefined,
            recipient_notification: 'QUEUED',
        };
    }

    /**
     * Transferts entrants du compte (RPC ticket_transfers_incoming) : ceux dont la cible est le numéro du
     * compte vérifié par code ; un numéro non vérifié ne donne que phoneVerificationRequired.
     */
    public static async listIncoming(userId: string): Promise<IncomingTransfersResult> {
        if (!userId) refuse('Authentification requise.', 401, 'UNAUTHENTICATED');
        const { data, error } = await rpcWithRetry<RpcReply & { items?: IncomingTransfer[]; phone_verification_required?: boolean }>(
            'ticket_transfers_incoming', { p: { actor_id: userId } });
        if (error) throw new Error(`ticket_transfers_incoming : ${error.code ?? ''} ${error.message}`);
        if (!data || data.ok !== true || !Array.isArray(data.items) || typeof data.phone_verification_required !== 'boolean') {
            throw new Error(`ticket_transfers_incoming : réponse inattendue ${JSON.stringify(data)}`);
        }
        return { items: data.items, phoneVerificationRequired: data.phone_verification_required };
    }

    /**
     * Accepte un transfert par son identifiant (RPC ticket_transfer_accept, tout ou rien) : identité du
     * compte connecté contre la cible (numéro vérifié), transfert PENDING non échu, puis identité du billet
     * régénérée (numéro, QR, secret dynamique, security_version + 1). Un transfert absent ou adressé à un
     * autre compte donne la même réponse 404.
     */
    public static async acceptTransfer(userId: string, transferId: string): Promise<AcceptTransferResult> {
        if (!userId) refuse('Authentification requise pour accepter un billet.', 401, 'UNAUTHENTICATED');
        // Appel unique : un second essai après un commit serait refusé à tort (TRANSFER_NOT_PENDING).
        const { data, error } = await getServiceRoleClient().rpc('ticket_transfer_accept', {
            p: { transfer_id: transferId, actor_id: userId },
        });
        if (error) throw new Error(`ticket_transfer_accept : ${error.code ?? ''} ${error.message}`);
        const body = (data ?? null) as RpcReply | null;
        if (!body) throw new Error('ticket_transfer_accept : réponse vide');
        if (body.ok !== true) {
            const code = String(body.code ?? '');
            const refusal = ACCEPT_REFUSALS[code];
            if (!refusal) throw new Error(`ticket_transfer_accept : refus inattendu ${JSON.stringify(body)}`);
            refuse(refusal.message, refusal.status, code);
        }
        const ticketId = String(body.ticket_id ?? '');
        const ticketNumber = String(body.ticket_number ?? '');
        if (!ticketId || !ticketNumber || !body.claimed_at) throw new Error(`ticket_transfer_accept : réponse incomplète ${JSON.stringify(body)}`);
        return {
            transfer_id: String(body.transfer_id ?? transferId),
            ticket_id: ticketId,
            ticket_number: ticketNumber,
            event_title: String(body.event_title ?? ''),
            claimed_at: String(body.claimed_at),
        };
    }

    /**
     * Refus d'un transfert par son destinataire (lot 9 bis, R46) : RPC ticket_transfer_decline, appel unique (un
     * second essai après un commit serait refusé à tort). Transfert d'un particulier : DECLINED, billet rendu libre à
     * l'expéditeur, prévenu ; invitation : billet annulé, place rendue. Refus identiques à ceux de l'acceptation.
     */
    public static async declineTransfer(userId: string, transferId: string): Promise<DeclineTransferResult> {
        if (!userId) refuse('Authentification requise pour refuser un billet.', 401, 'UNAUTHENTICATED');
        const { data, error } = await getServiceRoleClient().rpc('ticket_transfer_decline', {
            p: { transfer_id: transferId, actor_id: userId },
        });
        if (error) throw new Error(`ticket_transfer_decline : ${error.code ?? ''} ${error.message}`);
        const body = (data ?? null) as RpcReply | null;
        if (!body) throw new Error('ticket_transfer_decline : réponse vide');
        if (body.ok !== true) {
            const code = String(body.code ?? '');
            const refusal = DECLINE_REFUSALS[code];
            if (!refusal) throw new Error(`ticket_transfer_decline : refus inattendu ${JSON.stringify(body)}`);
            refuse(refusal.message, refusal.status, code);
        }
        const kind = body.kind;
        if (kind !== 'TRANSFER' && kind !== 'INVITATION') throw new Error(`ticket_transfer_decline : réponse incomplète ${JSON.stringify(body)}`);
        return { transfer_id: String(body.transfer_id ?? transferId), ticket_id: String(body.ticket_id ?? ''), kind };
    }

    /**
     * Annule un transfert PENDING par son émetteur : RPC ticket_transfer_cancel (CANCELLED, billet
     * déverrouillé et avis au destinataire mis en file dans la même transaction, secrets inchangés).
     */
    public static async cancelTransfer(senderUserId: string, transferId: string): Promise<CancelTransferResult> {
        if (!senderUserId) refuse('Authentification requise pour annuler un transfert.', 401, 'UNAUTHENTICATED');
        if (!transferId) refuse('Identifiant de transfert requis.', 400, 'TRANSFER_ID_REQUIRED');

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
            refuse(message, status, code);
        }
        const ticketId = String(data.ticket_id ?? '');
        const notification = data.recipient_notification;
        if (!ticketId || (notification !== 'QUEUED' && notification !== 'NONE')) {
            throw new Error(`ticket_transfer_cancel : réponse incomplète ${JSON.stringify(data)}`);
        }

        return {
            success: true,
            message: 'Transfert annulé avec succès.',
            transfer_id: transferId,
            ticket_id: ticketId,
            recipient_notification: notification,
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
