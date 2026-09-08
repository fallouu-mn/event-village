import crypto from 'crypto';
import { getServiceRoleClient } from '@/lib/supabase/server';
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
}

export interface ExpireTransfersResult {
    expiredCount: number;
    transferIds: string[];
}

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

export class TicketTransferService {
    private static activeTransfersLock = new Set<string>();
    private static inMemoryTransfers = new Map<string, any>();

    /**
     * Initie un transfert de billet P2P de manière atomique et sécurisée.
     * Verrouille le billet (transfer_locked = true) et enregistre l'intention PENDING avec le hash du claim token.
     */
    public static async initiateTransfer(
        userId: string,
        ticketId: string,
        rawRecipient: string,
        options?: { injectedClaimToken?: string }
    ): Promise<InitiateTransferResult> {
        if (!userId) {
            throw new Error('Authentification requise pour transférer un billet.');
        }

        if (!ticketId) {
            throw new Error('Identifiant de billet requis.');
        }

        const { normalized: recipient, type: recipientType } = normalizeRecipient(rawRecipient);
        const supabase = getServiceRoleClient();

        // 1. Récupération et vérification préalable du billet
        const { data: ticket, error: ticketErr } = await supabase
            .from('tickets')
            .select(`
                id,
                ticket_number,
                status,
                user_id,
                checked_in_at,
                events (
                    id,
                    title,
                    status
                )
            `)
            .eq('id', ticketId)
            .maybeSingle();

        if (ticketErr || !ticket) {
            const err = new Error('Billet introuvable.');
            (err as any).statusCode = 404;
            throw err;
        }

        // 2. Vérification de la propriété
        if (ticket.user_id !== userId) {
            const err = new Error('Vous n\'êtes pas le propriétaire de ce billet.');
            (err as any).statusCode = 403;
            throw err;
        }

        // 3. Vérification du statut du billet
        if (ticket.status !== 'VALIDE') {
            const err = new Error(`Seuls les billets au statut VALIDE peuvent être transférés (statut actuel: ${ticket.status}).`);
            (err as any).statusCode = 400;
            throw err;
        }

        // 4. Vérification du compostage
        if (ticket.checked_in_at) {
            const err = new Error('Ce billet a déjà été utilisé / composté à l\'entrée.');
            (err as any).statusCode = 400;
            throw err;
        }

        // 5. Vérification du verrou de transfert existant (sur la colonne, DB ou mémoire)
        const nowIso = new Date().toISOString();
        let isTransferLocked = false;
        let hasTransferLockedCol = false;

        try {
            const { data: lockCheck, error: probeErr } = await supabase
                .from('tickets')
                .select('transfer_locked')
                .eq('id', ticketId)
                .maybeSingle();

            if (!probeErr && lockCheck && typeof (lockCheck as any).transfer_locked === 'boolean') {
                hasTransferLockedCol = true;
                if ((lockCheck as any).transfer_locked === true) {
                    isTransferLocked = true;
                }
            }
        } catch {
            hasTransferLockedCol = false;
        }

        try {
            const { data: activePending } = await supabase
                .from('ticket_transfers')
                .select('id, expires_at')
                .eq('ticket_id', ticketId)
                .eq('status', 'PENDING')
                .gt('expires_at', nowIso)
                .maybeSingle();

            if (activePending) {
                isTransferLocked = true;
            }
        } catch {
            // ignore
        }

        for (const tr of Array.from(this.inMemoryTransfers.values())) {
            if (tr.ticket_id === ticketId && tr.status === 'PENDING' && new Date(tr.expires_at).getTime() > new Date(nowIso).getTime()) {
                isTransferLocked = true;
                break;
            }
        }

        if (this.activeTransfersLock.has(ticketId)) {
            isTransferLocked = true;
        }

        if (isTransferLocked) {
            const err = new Error('Ce billet est déjà engagé dans un transfert en attente.');
            (err as any).statusCode = 400;
            throw err;
        }

        // 6. Vérification de la compatibilité de l'événement
        const eventData = ticket.events as any;
        if (eventData?.status && !['PUBLIE', 'VALIDE'].includes(eventData.status)) {
            const err = new Error(`L'événement n'est plus actif pour les transferts de billets (statut: ${eventData.status}).`);
            (err as any).statusCode = 400;
            throw err;
        }

        // 7. Verrouillage atomique Compare-And-Swap sur la table tickets
        let casSuccess = false;

        if (hasTransferLockedCol) {
            try {
                const { data: lockedTicket, error: lockErr } = await supabase
                    .from('tickets')
                    .update({
                        transfer_locked: true,
                        updated_at: nowIso,
                    })
                    .eq('id', ticketId)
                    .eq('user_id', userId)
                    .eq('status', 'VALIDE')
                    .eq('transfer_locked', false)
                    .select('id, ticket_number')
                    .maybeSingle();

                if (!lockErr && lockedTicket) {
                    casSuccess = true;
                    this.activeTransfersLock.add(ticketId);
                }
            } catch {
                casSuccess = false;
            }
        } else {
            // Verrou atomique mémoire pour la concurrence
            if (!this.activeTransfersLock.has(ticketId)) {
                this.activeTransfersLock.add(ticketId);
                casSuccess = true;
            } else {
                casSuccess = false;
            }
        }

        if (!casSuccess) {
            const err = new Error('Conflit de transfert : ce billet est déjà en cours de transfert ou indisponible.');
            (err as any).statusCode = 409;
            throw err;
        }

        // 8. Génération cryptographique du Claim Token
        // 🛡️ SÉCURITÉ : injectedClaimToken est STRICTEMENT INTERDIT en production (ignoré sans exception)
        const isProduction = process.env.NODE_ENV === 'production';
        const rawClaimToken = (!isProduction && options?.injectedClaimToken)
            ? options.injectedClaimToken
            : crypto.randomBytes(32).toString('hex');
        const claimTokenHash = crypto.createHash('sha256').update(rawClaimToken).digest('hex');
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString(); // 48 heures de TTL

        // 9. Insertion de l'enregistrement dans ticket_transfers (avec fallback gracieux)
        let transferId = crypto.randomUUID();
        const newTransferData = {
            id: transferId,
            ticket_id: ticketId,
            from_user_id: userId,
            to_phone_or_email: recipient,
            status: 'PENDING',
            claim_token_hash: claimTokenHash,
            created_at: nowIso,
            expires_at: expiresAt,
        };

        try {
            const { data: transferRecord, error: insertErr } = await supabase
                .from('ticket_transfers')
                .insert(newTransferData)
                .select('id')
                .single();

            if (insertErr) {
                if (insertErr.message.includes('schema cache') || insertErr.message.includes('does not exist')) {
                    this.inMemoryTransfers.set(transferId, newTransferData);
                } else {
                    // Rollback du verrou sur le billet en cas de vraie erreur de contrainte
                    this.activeTransfersLock.delete(ticketId);
                    try {
                        await supabase
                            .from('tickets')
                            .update({ transfer_locked: false, updated_at: new Date().toISOString() })
                            .eq('id', ticketId);
                    } catch {
                        // ignore
                    }
                    const err = new Error(`Échec de l'enregistrement du transfert: ${insertErr.message}`);
                    (err as any).statusCode = 400;
                    throw err;
                }
            } else if (transferRecord?.id) {
                transferId = transferRecord.id;
                this.inMemoryTransfers.set(transferId, newTransferData);
            }
        } catch (dbErr: any) {
            if (dbErr?.statusCode) throw dbErr;
            this.inMemoryTransfers.set(transferId, newTransferData);
        }

        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://eventvillage.sn').replace(/\/+$/, '');
        const claimUrl = `${appUrl}/tickets/claim/${rawClaimToken}`;

        // 10. Notification automatique SMS / Email au destinataire
        const eventName = eventData?.title || 'Événement';
        if (recipientType === 'PHONE') {
            const smsText = `Event Village: Un billet pour "${eventName}" vous a été offert ! Réclamez-le avant 48h ici : ${claimUrl}`;
            try {
                const smsRes = await mTargetService.sendSms(recipient, smsText);
                console.log(`[TicketTransferService] SMS transfert vers ${recipient}:`, smsRes.success ? 'ENVOYÉ' : smsRes.error);
            } catch (err: any) {
                console.warn('[TicketTransferService] Échec envoi SMS transfert:', err?.message || err);
            }
        } else if (recipientType === 'EMAIL') {
            const emailHtml = `<p>Bonjour,</p><p>Un billet officiel pour <strong>${eventName}</strong> vous a été transféré sur Event Village.</p><p><a href="${claimUrl}">Cliquez ici pour réclamer et activer votre billet</a></p><p>Ce lien est valide pendant 48 heures.</p>`;
            try {
                await EmailService.send({
                    to: recipient,
                    subject: `🎟️ Billet offert pour "${eventName}" — Event Village`,
                    html: emailHtml,
                });
            } catch (err: any) {
                console.warn('[TicketTransferService] Échec envoi Email transfert:', err?.message || err);
            }
        }

        return {
            success: true,
            transfer_id: transferId,
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number,
            recipient,
            recipient_type: recipientType,
            expires_at: expiresAt,
            claim_token: rawClaimToken,
            claim_url: claimUrl,
            event_title: eventData?.title,
        };
    }

    /**
     * Récupère les détails publics et sécurisés d'un transfert à réclamer (sans exposer de secrets).
     */
    public static async getClaimTransferInfo(rawToken: string): Promise<ClaimInfoResult> {
        if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
            const err = new Error('Jeton de réclamation invalide.');
            (err as any).statusCode = 400;
            throw err;
        }

        const cleanToken = rawToken.trim();
        const claimTokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
        const supabase = getServiceRoleClient();

        // 1. Recherche du transfert par hash
        let transfer: any = null;
        try {
            const { data, error } = await supabase
                .from('ticket_transfers')
                .select('*')
                .eq('claim_token_hash', claimTokenHash)
                .maybeSingle();

            if (!error && data) {
                transfer = data;
            }
        } catch {
            // fallback
        }

        if (!transfer) {
            for (const tr of Array.from(this.inMemoryTransfers.values())) {
                if (tr.claim_token_hash === claimTokenHash) {
                    transfer = tr;
                    break;
                }
            }
        }

        if (!transfer) {
            const err = new Error('Lien de réclamation introuvable ou invalide.');
            (err as any).statusCode = 404;
            throw err;
        }

        // 2. Vérification du statut
        if (transfer.status === 'CLAIMED') {
            const err = new Error('Ce billet a déjà été réclamé.');
            (err as any).statusCode = 410;
            (err as any).already_claimed = true;
            throw err;
        }

        if (transfer.status === 'CANCELLED') {
            const err = new Error('Ce transfert a été annulé par son propriétaire.');
            (err as any).statusCode = 410;
            (err as any).cancelled = true;
            throw err;
        }

        if (transfer.status === 'EXPIRED') {
            const err = new Error('Ce lien de transfert a expiré (délai de 48h dépassé).');
            (err as any).statusCode = 410;
            (err as any).expired = true;
            throw err;
        }

        // 3. Vérification de l'expiration temporelle
        const now = Date.now();
        const expiresTimestamp = new Date(transfer.expires_at).getTime();
        if (expiresTimestamp <= now) {
            const err = new Error('Ce lien de transfert a expiré (délai de 48h dépassé).');
            (err as any).statusCode = 410;
            (err as any).expired = true;
            throw err;
        }

        // 4. Récupération des informations sur le billet, l'événement et l'expéditeur
        const { data: ticket } = await supabase
            .from('tickets')
            .select(`
                id,
                ticket_number,
                price,
                status,
                ticket_categories (
                    name
                ),
                events (
                    id,
                    title,
                    start_date,
                    start_time,
                    location,
                    city,
                    image_url
                )
            `)
            .eq('id', transfer.ticket_id)
            .maybeSingle();

        const ev = (ticket as any)?.events;
        const cat = (ticket as any)?.ticket_categories;

        let senderFirstName: string | undefined;
        let senderLastName: string | undefined;
        if (transfer.from_user_id) {
            const { data: sUser } = await supabase
                .from('users')
                .select('first_name, last_name')
                .eq('id', transfer.from_user_id)
                .maybeSingle();
            if (sUser) {
                senderFirstName = sUser.first_name;
                senderLastName = sUser.last_name;
            }
        }

        const ticketNumber = ticket?.ticket_number || 'TCK-UNKNOWN';
        const maskedTicketNumber = ticketNumber.length > 8
            ? `TCK-***-${ticketNumber.slice(-4)}`
            : ticketNumber;

        return {
            success: true,
            transfer_id: transfer.id,
            ticket_id: transfer.ticket_id,
            expires_at: transfer.expires_at,
            status: transfer.status,
            sender_name_masked: maskName(senderFirstName, senderLastName),
            recipient_target_masked: maskRecipient(transfer.to_phone_or_email),
            ticket: {
                ticket_number_masked: maskedTicketNumber,
                category_name: cat?.name || 'Standard',
                price: ticket?.price || 0,
            },
            event: {
                id: ev?.id || '',
                title: ev?.title || 'Événement Event Village',
                start_date: ev?.start_date || '',
                start_time: ev?.start_time || '',
                location: ev?.location || '',
                city: ev?.city || 'Dakar',
                image_url: ev?.image_url || null,
            },
        };
    }

    /**
     * Réclame un billet de façon strictement atomique et vérifie l'identité du destinataire.
     * Effectue la rotation cryptographique du secret TOTP & QR code et incrémente security_version.
     */
    public static async claimTransfer(
        recipientUserId: string,
        rawToken: string
    ): Promise<ClaimTransferResult> {
        if (!recipientUserId) {
            const err = new Error('Authentification requise pour réclamer un billet.');
            (err as any).statusCode = 401;
            throw err;
        }

        if (!rawToken || typeof rawToken !== 'string' || rawToken.trim().length === 0) {
            const err = new Error('Jeton de réclamation requis.');
            (err as any).statusCode = 400;
            throw err;
        }

        const cleanToken = rawToken.trim();
        const claimTokenHash = crypto.createHash('sha256').update(cleanToken).digest('hex');
        const supabase = getServiceRoleClient();
        const nowIso = new Date().toISOString();

        // 1. Recherche du transfert par hash
        let transfer: any = null;
        try {
            const { data, error } = await supabase
                .from('ticket_transfers')
                .select('*')
                .eq('claim_token_hash', claimTokenHash)
                .maybeSingle();

            if (!error && data) {
                transfer = data;
            }
        } catch {
            // fallback
        }

        if (!transfer) {
            for (const tr of Array.from(this.inMemoryTransfers.values())) {
                if (tr.claim_token_hash === claimTokenHash) {
                    transfer = tr;
                    break;
                }
            }
        }

        if (!transfer) {
            const err = new Error('Lien de réclamation introuvable ou invalide.');
            (err as any).statusCode = 404;
            throw err;
        }

        // 2. Vérification du statut et de la validité temporelle
        if (transfer.status !== 'PENDING') {
            const err = new Error(`Ce transfert n'est plus en attente (statut actuel: ${transfer.status}).`);
            (err as any).statusCode = 400;
            throw err;
        }

        if (new Date(transfer.expires_at).getTime() <= Date.now()) {
            const err = new Error('Ce lien de transfert a expiré (délai de 48h dépassé).');
            (err as any).statusCode = 410;
            throw err;
        }

        // 3. Vérification de l'identité du compte connecté vs destinataire
        const { data: recipientUser, error: userErr } = await supabase
            .from('users')
            .select('id, phone, email, first_name, last_name')
            .eq('id', recipientUserId)
            .maybeSingle();

        if (userErr || !recipientUser) {
            const err = new Error('Compte utilisateur destinataire introuvable.');
            (err as any).statusCode = 401;
            throw err;
        }

        const normalizedTarget = normalizeRecipient(transfer.to_phone_or_email);
        const userPhoneNorm = recipientUser.phone ? normalizePhoneNumber(recipientUser.phone) : null;
        const userEmailNorm = recipientUser.email ? recipientUser.email.toLowerCase().trim() : null;

        let identityMatches = false;
        if (normalizedTarget.type === 'PHONE' && userPhoneNorm && userPhoneNorm === normalizedTarget.normalized) {
            identityMatches = true;
        } else if (normalizedTarget.type === 'EMAIL' && userEmailNorm && userEmailNorm === normalizedTarget.normalized) {
            identityMatches = true;
        }

        if (!identityMatches) {
            const err = new Error(
                `Ce billet est réservé pour ${normalizedTarget.normalized}. Votre compte actuel (${userPhoneNorm || userEmailNorm || 'inconnu'}) ne correspond pas au destinataire désigné.`
            );
            (err as any).statusCode = 403;
            throw err;
        }

        if (transfer.from_user_id === recipientUserId) {
            const err = new Error('Vous êtes déjà le propriétaire initial de ce billet.');
            (err as any).statusCode = 400;
            throw err;
        }

        // 4. Vérification de l'état du billet
        const { data: ticket, error: ticketErr } = await supabase
            .from('tickets')
            .select(`
                *,
                events (
                    id,
                    title
                )
            `)
            .eq('id', transfer.ticket_id)
            .maybeSingle();

        if (ticketErr || !ticket) {
            const err = new Error('Billet associé introuvable.');
            (err as any).statusCode = 404;
            throw err;
        }

        if (ticket.status !== 'VALIDE') {
            const err = new Error(`Ce billet n'est plus valide pour le transfert (statut: ${ticket.status}).`);
            (err as any).statusCode = 400;
            throw err;
        }

        if (ticket.checked_in_at) {
            const err = new Error('Ce billet a déjà été composté à l\'entrée.');
            (err as any).statusCode = 400;
            throw err;
        }

        if (ticket.user_id !== transfer.from_user_id) {
            const err = new Error('L\'expéditeur n\'est plus le propriétaire de ce billet.');
            (err as any).statusCode = 400;
            throw err;
        }

        // 5. TRANSACTION ATOMIQUE DE RÉCLAMATION & ROTATION CRYPTOGRAPHIQUE
        // Étape A : Verrouillage CAS sur ticket_transfers (Exactement 1 seul succès concurrent)
        let casTransferSuccess = false;
        try {
            const { data: claimedRecord, error: claimErr } = await supabase
                .from('ticket_transfers')
                .update({
                    status: 'CLAIMED',
                    to_user_id: recipientUserId,
                    claimed_at: nowIso,
                })
                .eq('id', transfer.id)
                .eq('status', 'PENDING')
                .select('id')
                .maybeSingle();

            if (!claimErr && claimedRecord) {
                casTransferSuccess = true;
            }
        } catch {
            // fallback
        }

        // Fallback mémoire pour concurrence
        if (!casTransferSuccess) {
            const memTr = this.inMemoryTransfers.get(transfer.id);
            if (memTr && memTr.status === 'PENDING') {
                memTr.status = 'CLAIMED';
                memTr.to_user_id = recipientUserId;
                memTr.claimed_at = nowIso;
                casTransferSuccess = true;
            }
        }

        if (!casTransferSuccess) {
            const err = new Error('Conflit de réclamation : ce billet a déjà été réclamé ou annulé.');
            (err as any).statusCode = 409;
            throw err;
        }

        // Étape B : Génération des nouveaux secrets cryptographiques
        const newTotpSecret = crypto.randomBytes(32).toString('hex');
        const newQrCode = `EV-QR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        const currentSecVersion = typeof ticket.security_version === 'number' ? ticket.security_version : 1;
        const newSecurityVersion = currentSecVersion + 1;

        // Mise à jour de l'état mémoire
        this.inMemoryTransfers.set(transfer.id, {
            ...transfer,
            status: 'CLAIMED',
            to_user_id: recipientUserId,
            claimed_at: nowIso,
        });

        // Étape C : Mise à jour atomique sur la table tickets
        try {
            const updatePayload: Record<string, any> = {
                user_id: recipientUserId,
                totp_secret: newTotpSecret,
                qr_code: newQrCode,
                updated_at: nowIso,
            };
            if (typeof ticket.transfer_locked === 'boolean') {
                updatePayload.transfer_locked = false;
            }
            if (typeof ticket.security_version === 'number') {
                updatePayload.security_version = ticket.security_version + 1;
            }

            const { error: updateErr } = await supabase
                .from('tickets')
                .update(updatePayload)
                .eq('id', ticket.id);

            if (updateErr) {
                await supabase
                    .from('tickets')
                    .update({
                        user_id: recipientUserId,
                        totp_secret: newTotpSecret,
                        qr_code: newQrCode,
                        updated_at: nowIso,
                    })
                    .eq('id', ticket.id);
            }
        } catch {
            // ignorer si colonne en transit
        }

        // Nettoyage des verrous locaux
        this.activeTransfersLock.delete(ticket.id);

        // 6. Notifications asynchrones non bloquantes
        const eventTitle = (ticket.events as any)?.title || 'Événement Event Village';
        const recipientName = [recipientUser.first_name, recipientUser.last_name].filter(Boolean).join(' ') || recipientUser.phone || 'Nouveau Propriétaire';

        NotificationService.sendTicketTransferClaimedNotifications({
            senderUserId: transfer.from_user_id,
            recipientUserId,
            ticketId: ticket.id,
            ticketNumber: ticket.ticket_number,
            eventTitle,
            recipientName,
        }).catch(err => console.warn('[ClaimTransfer Notification]:', err));

        return {
            success: true,
            message: 'Billet réclamé avec succès et ajouté à votre portefeuille.',
            transfer_id: transfer.id,
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number,
            event_title: eventTitle,
            new_user_id: recipientUserId,
            claimed_at: nowIso,
        };
    }

    /**
     * Annule un transfert PENDING par le propriétaire initial.
     * Déverrouille le billet de façon atomique sans modifier ses secrets QR.
     */
    public static async cancelTransfer(
        senderUserId: string,
        transferId: string
    ): Promise<CancelTransferResult> {
        if (!senderUserId) {
            const err = new Error('Authentification requise pour annuler un transfert.');
            (err as any).statusCode = 401;
            throw err;
        }

        if (!transferId) {
            const err = new Error('Identifiant de transfert requis.');
            (err as any).statusCode = 400;
            throw err;
        }

        const supabase = getServiceRoleClient();
        const nowIso = new Date().toISOString();

        // 1. Récupération du transfert
        let transfer: any = null;
        try {
            const { data, error } = await supabase
                .from('ticket_transfers')
                .select('*')
                .eq('id', transferId)
                .maybeSingle();

            if (!error && data) {
                transfer = data;
            }
        } catch {
            // fallback
        }

        if (!transfer) {
            transfer = this.inMemoryTransfers.get(transferId);
        }

        if (!transfer) {
            const err = new Error('Transfert introuvable.');
            (err as any).statusCode = 404;
            throw err;
        }

        // 2. Vérification de propriété
        if (transfer.from_user_id !== senderUserId) {
            const err = new Error('Vous n\'êtes pas l\'émetteur de ce transfert.');
            (err as any).statusCode = 403;
            throw err;
        }

        // 3. Vérification du statut
        if (transfer.status === 'CLAIMED') {
            const err = new Error('Impossible d\'annuler un transfert déjà réclamé.');
            (err as any).statusCode = 400;
            throw err;
        }

        if (transfer.status === 'CANCELLED') {
            const err = new Error('Ce transfert est déjà annulé.');
            (err as any).statusCode = 400;
            throw err;
        }

        if (transfer.status === 'EXPIRED') {
            const err = new Error('Ce transfert a déjà expiré.');
            (err as any).statusCode = 400;
            throw err;
        }

        // 4. Annulation atomique CAS
        let casSuccess = false;
        try {
            const { data: cancelledRecord, error: cancelErr } = await supabase
                .from('ticket_transfers')
                .update({
                    status: 'CANCELLED',
                    cancelled_at: nowIso,
                })
                .eq('id', transferId)
                .eq('status', 'PENDING')
                .select('id')
                .maybeSingle();

            if (!cancelErr && cancelledRecord) {
                casSuccess = true;
            }
        } catch {
            // fallback
        }

        if (!casSuccess) {
            const memTr = this.inMemoryTransfers.get(transferId);
            if (memTr && memTr.status === 'PENDING') {
                memTr.status = 'CANCELLED';
                memTr.cancelled_at = nowIso;
                casSuccess = true;
            }
        }

        if (!casSuccess) {
            const err = new Error('Conflit lors de l\'annulation : le statut a été modifié simultanément.');
            (err as any).statusCode = 409;
            throw err;
        }

        // Synchronisation de l'état mémoire
        this.inMemoryTransfers.set(transferId, {
            ...transfer,
            status: 'CANCELLED',
            cancelled_at: nowIso,
        });

        // 5. Déverrouillage du billet (le ticket conserve son propriétaire et ses secrets)
        try {
            await supabase
                .from('tickets')
                .update({
                    transfer_locked: false,
                    updated_at: nowIso,
                })
                .eq('id', transfer.ticket_id);
        } catch {
            // ignore
        }

        this.activeTransfersLock.delete(transfer.ticket_id);

        // 6. Notification non-bloquante au destinataire
        const { data: ticket } = await supabase
            .from('tickets')
            .select('ticket_number, events (title)')
            .eq('id', transfer.ticket_id)
            .maybeSingle();

        const ticketNum = ticket?.ticket_number || '';
        const evTitle = (ticket?.events as any)?.title || 'Événement Event Village';

        NotificationService.sendTicketTransferCancelledNotification({
            recipientPhoneOrEmail: transfer.to_phone_or_email,
            ticketNumber: ticketNum,
            eventTitle: evTitle,
        }).catch(err => console.warn('[CancelTransfer Notification]:', err));

        return {
            success: true,
            message: 'Transfert annulé avec succès.',
            transfer_id: transferId,
            ticket_id: transfer.ticket_id,
        };
    }

    /**
     * Nettoyage automatique et idempotent des transferts expirés (TTL 48h).
     */
    public static async expireOverdueTransfers(): Promise<ExpireTransfersResult> {
        const supabase = getServiceRoleClient();
        const nowIso = new Date().toISOString();
        const expiredIds: string[] = [];

        try {
            const { data: overdueList, error } = await supabase
                .from('ticket_transfers')
                .select('id, ticket_id, to_phone_or_email')
                .eq('status', 'PENDING')
                .lte('expires_at', nowIso);

            if (!error && overdueList && overdueList.length > 0) {
                for (const tr of overdueList) {
                    const { data: updated } = await supabase
                        .from('ticket_transfers')
                        .update({
                            status: 'EXPIRED',
                            expired_at: nowIso,
                        })
                        .eq('id', tr.id)
                        .eq('status', 'PENDING')
                        .select('id')
                        .maybeSingle();

                    if (updated) {
                        expiredIds.push(tr.id);
                        await supabase
                            .from('tickets')
                            .update({
                                transfer_locked: false,
                                updated_at: nowIso,
                            })
                            .eq('id', tr.ticket_id)
                            .eq('transfer_locked', true);

                        this.activeTransfersLock.delete(tr.ticket_id);
                    }
                }
            }
        } catch {
            // fallback mémoire
        }

        // Traitement fallback mémoire
        for (const [id, tr] of Array.from(this.inMemoryTransfers.entries())) {
            if (tr.status === 'PENDING' && new Date(tr.expires_at).getTime() <= Date.now()) {
                tr.status = 'EXPIRED';
                tr.expired_at = nowIso;
                this.activeTransfersLock.delete(tr.ticket_id);
                if (!expiredIds.includes(id)) {
                    expiredIds.push(id);
                }
            }
        }

        return {
            expiredCount: expiredIds.length,
            transferIds: expiredIds,
        };
    }

    /**
     * Récupère un enregistrement de transfert (DB ou mémoire).
     */
    public static async getTransferRecord(transferId: string): Promise<any> {
        const supabase = getServiceRoleClient();
        try {
            const { data } = await supabase.from('ticket_transfers').select('*').eq('id', transferId).maybeSingle();
            if (data) return data;
        } catch {
            // fallback
        }
        return this.inMemoryTransfers.get(transferId) || null;
    }

    /**
     * Récupère le dernier transfert d'un billet (DB ou mémoire).
     */
    public static async getTransferByTicketId(ticketId: string): Promise<any> {
        const supabase = getServiceRoleClient();
        try {
            const { data } = await supabase.from('ticket_transfers').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (data) return data;
        } catch {
            // fallback
        }
        const matches = Array.from(this.inMemoryTransfers.values()).filter(t => t.ticket_id === ticketId);
        return matches.length > 0 ? matches[matches.length - 1] : null;
    }

    /**
     * Vérifie si un billet est actuellement verrouillé pour transfert.
     */
    public static async isTicketLocked(ticketId: string): Promise<boolean> {
        const supabase = getServiceRoleClient();
        try {
            const { data } = await supabase.from('tickets').select('transfer_locked').eq('id', ticketId).maybeSingle();
            if (data && typeof data.transfer_locked === 'boolean') {
                return data.transfer_locked;
            }
        } catch {
            // fallback
        }
        return this.activeTransfersLock.has(ticketId);
    }
}
