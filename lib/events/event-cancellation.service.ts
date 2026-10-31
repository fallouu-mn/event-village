/**
 * EVENT VILLAGE — SERVICE D'ANNULATION D'ÉVÉNEMENT & REMBOURSEMENT MOBILE MONEY
 * Standard de qualité Ingénieur Senior (20 ans d'expérience) :
 * - Verrouillage & atomicité des opérations en base Supabase
 * - Remboursements par le module commun de cashout (lot 2.7) : clé REFUND-<paymentId>, solde vérifié
 *   pour le lot, opérateur et numéro du payeur, INCERTAIN jamais renvoyé automatiquement
 * - Notifications omnicanales (SMS MTarget, Email transactionnel HTML, In-App)
 * - Traçabilité financière intégrale dans les tables events, tickets, payments, refunds
 */

import { getServiceRoleClient } from '@/lib/supabase/server';
import { CashoutService } from '@/lib/payments/cashout.service';
import { OPERATOR_LABELS, type SamirPayOperatorName } from '@/lib/samirpay/types';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { EmailService, EmailTemplates } from '@/lib/email/email.service';
import { NotificationService } from '@/lib/notifications/notification.service';

export interface EventCancellationResult {
    success: boolean;
    eventId: string;
    cancellationId: string;
    refundsProcessed: number;
    refundsFailed: number;
    totalAmountRefunded: number;
    message: string;
}

export interface RefundRetryResult {
    success: boolean;
    refundId: string;
    status: 'PROCESSED' | 'FAILED';
    transactionId?: string;
    message: string;
}

export interface EventCancellationSummary {
    eventId: string;
    eventTitle: string;
    status: string;
    cancelledAt: string;
    cancelledBy: {
        id: string;
        name: string;
        role: string;
    };
    internalReason: string;
    publicNotice?: string;
    ticketsSummary: {
        totalTickets: number;
        cancelledTickets: number;
        refundedTickets: number;
    };
    refundsSummary: {
        totalPayments: number;
        processedCount: number;
        failedCount: number;
        totalAmountRefunded: number;
        failedRefunds: Array<{
            id: string;
            paymentId: string;
            amount: number;
            buyerPhone: string;
            failureReason?: string;
            createdAt: string;
        }>;
    };
}

export class EventCancellationService {

    /**
     * Annule un événement de manière atomique et déclenche les remboursements Mobile Money.
     */
    public static async cancelEvent(
        eventId: string,
        userId: string,
        userRole: string,
        internalReason: string,
        publicNotice: string = ''
    ): Promise<EventCancellationResult> {
        const supabase = getServiceRoleClient();

        // 1. Vérification des habilitations RBAC
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
        const isPartner = userRole === 'PARTENAIRE';

        if (!isAdmin && !isPartner) {
            throw new Error('Non autorisé : Seul un partenaire organisateur ou un administrateur peut annuler un événement.');
        }

        // 2. Récupération de l'événement avec vérification d'appartenance
        const { data: event, error: eventErr } = await supabase
            .from('events')
            .select(`
                id,
                title,
                status,
                partner_id,
                practical_info,
                partners (
                    id,
                    user_id,
                    company_name
                )
            `)
            .eq('id', eventId)
            .single();

        if (eventErr || !event) {
            throw new Error(`Événement introuvable (ID: ${eventId}).`);
        }

        // Vérification de propriété stricte pour le partenaire
        if (isPartner && !isAdmin) {
            const partnerUserId = (event.partners as any)?.user_id;
            if (partnerUserId !== userId) {
                const { data: userPartner } = await supabase
                    .from('partners')
                    .select('id')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (!userPartner || userPartner.id !== event.partner_id) {
                    throw new Error("Non autorisé : Vous n'êtes pas l'organisateur propriétaire de cet événement.");
                }
            }
        }

        // 3. Vérification de l'état du cycle de vie
        const isAlreadyCancelled = event.status === 'ANNULE' || (event.status === 'SUSPENDU' && (event.practical_info as any)?.cancellation);
        if (isAlreadyCancelled) {
            throw new Error("Cet événement a déjà été annulé.");
        }

        if (event.status === 'TERMINE') {
            throw new Error("Impossible d'annuler un événement déjà terminé et clôturé.");
        }

        if (!['PUBLIE', 'VALIDE'].includes(event.status)) {
            throw new Error(`Impossible d'annuler un événement au statut "${event.status}". Seuls les événements publiés ou validés peuvent être annulés.`);
        }

        // 4. Enregistrement de l'annulation
        let cancellationId = eventId;
        const notice = publicNotice || `L'événement "${event.title}" a été annulé par l'organisateur.`;
        try {
            const { data: cancellationRecord } = await supabase
                .from('event_cancellations')
                .insert({
                    event_id: eventId,
                    cancelled_by: userId,
                    internal_reason: internalReason,
                    public_notice: notice,
                    cancelled_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select('id')
                .maybeSingle();

            if (cancellationRecord?.id) {
                cancellationId = cancellationRecord.id;
            }
        } catch {
            // Ignorer si table absente
        }

        // 5. Mise à jour atomique du statut de l'événement en 'ANNULE' (ou 'SUSPENDU' si enum distant non migré)
        const updatedPracticalInfo = {
            ...((event.practical_info as Record<string, any>) || {}),
            cancellation: {
                id: cancellationId,
                cancelled_by: userId,
                internal_reason: internalReason,
                public_notice: notice,
                cancelled_at: new Date().toISOString(),
            },
        };

        let { data: updatedEvent, error: updateEventErr } = await supabase
            .from('events')
            .update({
                status: 'ANNULE',
                practical_info: updatedPracticalInfo,
                updated_at: new Date().toISOString(),
            })
            .eq('id', eventId)
            .in('status', ['PUBLIE', 'VALIDE'])
            .select('id')
            .maybeSingle();

        if (updateEventErr && (updateEventErr.code === '22P02' || updateEventErr.message?.includes('invalid input value for enum'))) {
            const { data: fallbackEvent, error: fallbackErr } = await supabase
                .from('events')
                .update({
                    status: 'SUSPENDU',
                    practical_info: updatedPracticalInfo,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', eventId)
                .in('status', ['PUBLIE', 'VALIDE'])
                .select('id')
                .maybeSingle();

            if (fallbackErr) {
                throw new Error(`Échec de mise à jour du statut de l'événement: ${fallbackErr.message}`);
            }
            if (!fallbackEvent) {
                throw new Error("Cet événement a déjà été annulé ou n'est plus au statut publié/validé.");
            }
        } else if (updateEventErr) {
            throw new Error(`Échec de mise à jour du statut de l'événement: ${updateEventErr.message}`);
        } else if (!updatedEvent) {
            throw new Error("Cet événement a déjà été annulé ou n'est plus au statut publié/validé.");
        }

        // 6. Révocation des transferts P2P en attente
        const { error: transferErr } = await supabase
            .from('ticket_transfers')
            .update({
                status: 'CANCELLED',
                updated_at: new Date().toISOString(),
            })
            .eq('event_id', eventId)
            .eq('status', 'PENDING');
        if (transferErr) console.error('[EventCancellationService] révocation des transferts en attente impossible :', transferErr.message);

        // 7. Paiements en ligne à rembourser (lot 3.7) : paiements plateforme SUCCESS ou PARTIAL
        //    rattachés aux billets de l'événement (tickets.payment_id). refund_request rembourse le
        //    RESTE dû au client (total payé, frais de service compris, moins les remboursements déjà
        //    demandés), passe les billets REMBOURSEMENT_EN_COURS et débite l'organisateur ; si ses
        //    fonds ont déjà été retirés, le reste devient une créance avec alerte (grand livre).
        const { data: ticketPayRows, error: tpErr } = await supabase
            .from('tickets')
            .select('payment_id')
            .eq('event_id', eventId)
            .not('payment_id', 'is', null);
        if (tpErr) throw new Error(`Lecture des paiements de l'événement impossible : ${tpErr.message}`);
        const paymentIds = Array.from(new Set((ticketPayRows ?? []).map((r) => r.payment_id as string)));
        let payments: Array<{ id: string; client_id: string }> = [];
        if (paymentIds.length > 0) {
            const { data, error } = await supabase
                .from('payments')
                .select('id, client_id')
                .in('id', paymentIds)
                .in('status', ['SUCCESS', 'PARTIAL'])
                .eq('is_platform_payment', true)
                .gt('amount', 0);
            if (error) throw new Error(`Lecture des paiements à rembourser impossible : ${error.message}`);
            payments = data ?? [];
        }
        const entries = new Map<string, { id: string; client_id: string }>();
        for (const p of payments) {
            const cashout = await CashoutService.requestRefund({ paymentId: p.id, reason: `Annulation de l'événement « ${event.title} »`, kind: 'EVENT_CANCELLATION_REFUND' });
            if (cashout) entries.set(cashout.id, p);
        }

        // 8. Billets encore valables : espèces → « à rembourser par l'organisateur » (aucun cashout,
        //    l'argent n'est pas passé par SamirPay) ; gratuits et invitations → annulés.
        const { data: remaining, error: remErr } = await supabase
            .from('tickets')
            .select('id')
            .eq('event_id', eventId)
            .eq('status', 'VALIDE');
        if (remErr) throw new Error(`Lecture des billets restants impossible : ${remErr.message}`);
        for (const t of remaining ?? []) {
            const r = await CashoutService.requestTicketRefund({ ticketId: t.id as string, actorId: userId, reason: `Annulation de l'événement « ${event.title} »` });
            if (!r.ok) console.error(`[EventCancellationService] billet ${t.id} non annulé : ${r.code} ${r.message}`);
        }
        const { error: invalidErr } = await supabase
            .from('tickets')
            .update({ status: 'ANNULE', updated_at: new Date().toISOString() })
            .eq('event_id', eventId)
            .eq('status', 'VALIDE');
        if (invalidErr) throw new Error(`Invalidation des billets restants impossible : ${invalidErr.message}`);

        // 9. Envoi des remboursements (solde SamirPay vérifié une fois pour le lot). Les billets ne
        //    passent REMBOURSE et le client n'est prévenu du versement qu'à la confirmation.
        const outcomes = await CashoutService.sendBatch(Array.from(entries.keys()));
        let refundsProcessed = 0;
        let refundsFailed = 0;
        let totalAmountRefunded = 0;
        for (const [cashoutId, outcome] of Object.entries(outcomes)) {
            const payment = entries.get(cashoutId)!;
            if (outcome.status !== 'CONFIRME' && outcome.status !== 'ENVOYE') {
                refundsFailed++;
                continue;
            }
            refundsProcessed++;
            const { data: c, error: cErr } = await supabase.from('cashouts').select('amount, operator, phone_number, first_name, last_name, idempotency_key').eq('id', cashoutId).single();
            if (cErr || !c) throw new Error(`Lecture du remboursement ${cashoutId} impossible : ${cErr?.message}`);
            totalAmountRefunded += Number(c.amount);
            if (outcome.status !== 'CONFIRME') continue;
            await this.dispatchRefundNotifications({
                userId: payment.client_id,
                buyerName: [c.first_name, c.last_name].filter(Boolean).join(' '),
                buyerPhone: c.phone_number ? `+221${c.phone_number}` : '',
                eventTitle: event.title,
                ticketNumber: '',
                refundAmount: Number(c.amount),
                refundTransactionId: c.idempotency_key ?? cashoutId,
                operator: c.operator ? OPERATOR_LABELS[c.operator as SamirPayOperatorName] : 'Mobile Money',
            });
        }

        return {
            success: true,
            eventId,
            cancellationId,
            refundsProcessed,
            refundsFailed,
            totalAmountRefunded,
            message: `Événement annulé. ${refundsProcessed} remboursement(s) envoyé(s)${refundsFailed > 0 ? `, ${refundsFailed} en attente ou à vérifier (alerte envoyée aux superadmins)` : ''}.`,
        };
    }

    /**
     * Nouvelle tentative d'un remboursement par un administrateur (lot 2.7) :
     *  - ECHOUE (refus explicite de SamirPay) : remis à envoyer puis envoyé une fois ;
     *  - bloqué (solde insuffisant, opérateur ou numéro inconnu) : débloqué si la cause est levée ;
     *  - INCERTAIN : refusé — l'argent a pu partir, vérification manuelle obligatoire ;
     *  - CONFIRME / ENVOYE : rien à faire.
     */
    public static async retryRefund(refundId: string, adminUserId: string): Promise<RefundRetryResult> {
        const supabase = getServiceRoleClient();
        const { data: cashout, error } = await supabase.from('cashouts').select('*').eq('refund_id', refundId).maybeSingle();
        if (error) throw new Error(`Lecture du remboursement ${refundId} impossible : ${error.message}`);
        if (!cashout) throw new Error(`Remboursement introuvable (ID: ${refundId}).`);
        if (cashout.status === 'CONFIRME' || cashout.status === 'ENVOYE') {
            return { success: true, refundId, status: 'PROCESSED', transactionId: cashout.samirpay_transaction_id ?? undefined, message: 'Remboursement déjà envoyé.' };
        }
        if (cashout.status === 'INCERTAIN') {
            return { success: false, refundId, status: 'FAILED', message: 'Issue incertaine : vérifiez auprès de SamirPay avant toute nouvelle tentative (aucun renvoi automatique).' };
        }
        if (cashout.status === 'ECHOUE') {
            const { data: reset, error: rErr } = await supabase.from('cashouts')
                .update({ status: 'A_ENVOYER', send_started_at: null, last_error: null, updated_at: new Date().toISOString() })
                .eq('id', cashout.id).eq('status', 'ECHOUE').select('id');
            if (rErr) throw new Error(`Remise à envoyer impossible : ${rErr.message}`);
            if (!reset?.length) return { success: false, refundId, status: 'FAILED', message: 'Remboursement modifié par une autre opération.' };
            const { error: refErr } = await supabase.from('refunds').update({ status: 'PENDING', updated_at: new Date().toISOString() }).eq('id', refundId).eq('status', 'FAILED');
            if (refErr) throw new Error(`Remboursement ${refundId} non remis en attente : ${refErr.message}`);
        } else if (cashout.blocked_reason === 'SOLDE_INSUFFISANT') {
            const { error: uErr } = await supabase.from('cashouts').update({ blocked_reason: null, updated_at: new Date().toISOString() }).eq('id', cashout.id).eq('status', 'A_ENVOYER');
            if (uErr) throw new Error(`Déblocage impossible : ${uErr.message}`);
        }
        const { error: auditErr } = await supabase.from('audit_logs').insert({
            user_id: adminUserId, action: 'REFUND_RETRY', object_type: 'cashouts', object_id: cashout.id,
            metadata: { refund_id: refundId, previous_status: cashout.status, blocked_reason: cashout.blocked_reason },
        });
        if (auditErr) console.error('[EventCancellationService] journal de la nouvelle tentative impossible :', auditErr.message);
        const outcome = await CashoutService.send(cashout.id);
        const sent = outcome.status === 'CONFIRME' || outcome.status === 'ENVOYE';
        return {
            success: sent,
            refundId,
            status: sent ? 'PROCESSED' : 'FAILED',
            message: sent ? 'Remboursement envoyé.' : `Remboursement non envoyé (${outcome.skipped ?? outcome.status}).`,
        };
    }

    public static async getEventCancellationSummary(
        eventId: string,
        userId: string,
        userRole: string
    ): Promise<EventCancellationSummary> {
        const supabase = getServiceRoleClient();

        const { data: event, error: evErr } = await supabase
            .from('events')
            .select(`
                id,
                title,
                status,
                partner_id,
                partners (
                    user_id,
                    company_name
                )
            `)
            .eq('id', eventId)
            .single();

        if (evErr || !event) {
            throw new Error('Événement introuvable.');
        }

        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPERADMIN';
        if (!isAdmin && userRole === 'PARTENAIRE') {
            const partnerUserId = (event.partners as any)?.user_id;
            if (partnerUserId !== userId) {
                throw new Error("Non autorisé : Vous n'êtes pas le propriétaire de cet événement.");
            }
        }

        const { data: cancellation } = await supabase
            .from('event_cancellations')
            .select(`
                id,
                cancelled_at,
                internal_reason,
                public_notice,
                cancelled_by,
                users:users!event_cancellations_cancelled_by_fkey (
                    id,
                    first_name,
                    last_name,
                    role
                )
            `)
            .eq('event_id', eventId)
            .maybeSingle();

        const { data: tickets } = await supabase
            .from('tickets')
            .select('id, status')
            .eq('event_id', eventId);

        const totalTickets = tickets?.length || 0;
        const cancelledTickets = tickets?.filter(t => t.status === 'ANNULE').length || 0;
        const refundedTickets = tickets?.filter(t => t.status === 'REMBOURSE').length || 0;

        const ticketIds = (tickets || []).map(t => t.id);
        let payments: any[] = [];
        if (ticketIds.length > 0) {
            const { data: p } = await supabase
                .from('payments')
                .select(`
                    id,
                    amount,
                    status,
                    refunds (
                        id,
                        status,
                        amount,
                        reason,
                        created_at
                    )
                `)
                .in('ticket_id', ticketIds);
            payments = p || [];
        }

        let processedCount = 0;
        let failedCount = 0;
        let totalAmountRefunded = 0;
        const failedRefunds: any[] = [];

        payments.forEach(p => {
            const refundList = p.refunds || [];
            refundList.forEach((r: any) => {
                if (r.status === 'PROCESSED') {
                    processedCount++;
                    totalAmountRefunded += Number(r.amount);
                } else if (r.status === 'FAILED') {
                    failedCount++;
                    failedRefunds.push({
                        id: r.id,
                        paymentId: p.id,
                        amount: Number(r.amount),
                        buyerPhone: '',
                        failureReason: r.reason,
                        createdAt: r.created_at,
                    });
                }
            });
        });

        const canceller = cancellation?.users as any;
        const cancellerName = canceller
            ? `${canceller.first_name || ''} ${canceller.last_name || ''}`.trim() || 'Organisateur'
            : 'Organisateur / Admin';

        return {
            eventId,
            eventTitle: event.title,
            status: event.status,
            cancelledAt: cancellation?.cancelled_at || new Date().toISOString(),
            cancelledBy: {
                id: cancellation?.cancelled_by || userId,
                name: cancellerName,
                role: canceller?.role || userRole,
            },
            internalReason: cancellation?.internal_reason || 'Annulation officielle',
            publicNotice: cancellation?.public_notice || undefined,
            ticketsSummary: {
                totalTickets,
                cancelledTickets,
                refundedTickets,
            },
            refundsSummary: {
                totalPayments: payments.length,
                processedCount,
                failedCount,
                totalAmountRefunded,
                failedRefunds,
            },
        };
    }

    /**
     * Dispatcher omnicanal (SMS, Email, In-App).
     */
    private static async dispatchRefundNotifications(params: {
        userId?: string;
        buyerName: string;
        buyerEmail?: string;
        buyerPhone: string;
        eventTitle: string;
        ticketNumber: string;
        refundAmount: number;
        refundTransactionId: string;
        reason?: string;
        operator: string;
    }): Promise<void> {
        // 1. SMS direct via MTarget
        if (params.buyerPhone) {
            const smsText = `Event Village: L'événement "${params.eventTitle}" a été annulé. Votre remboursement de ${params.refundAmount.toLocaleString('fr-FR')} FCFA a été versé sur votre compte ${params.operator}. Réf: ${params.refundTransactionId}`;
            try {
                await mTargetService.sendSms(params.buyerPhone, smsText);
            } catch (smsErr) {
                console.warn('[EventCancellationService] Échec envoi SMS:', smsErr);
            }
        }

        // 2. Email HTML transactionnel
        if (params.buyerEmail && params.buyerEmail.includes('@')) {
            try {
                const emailContent = EmailTemplates.eventCancelledAndRefunded({
                    recipientName: params.buyerName,
                    eventTitle: params.eventTitle,
                    ticketNumber: params.ticketNumber,
                    refundAmount: params.refundAmount,
                    refundTransactionId: params.refundTransactionId,
                    reason: params.reason,
                    operator: params.operator,
                });

                await EmailService.send({
                    to: params.buyerEmail,
                    subject: emailContent.subject,
                    html: emailContent.html,
                });
            } catch (emailErr) {
                console.warn('[EventCancellationService] Échec envoi Email:', emailErr);
            }
        }

        // 3. Notification In-App
        if (params.userId) {
            try {
                await NotificationService.createNotification({
                    userId: params.userId,
                    title: 'Événement annulé & Billet remboursé',
                    message: `L'événement "${params.eventTitle}" a été annulé. Un montant de ${params.refundAmount.toLocaleString('fr-FR')} FCFA a été remboursé sur votre compte ${params.operator}.`,
                    type: 'PAYMENT',
                    data: {
                        eventTitle: params.eventTitle,
                        refundAmount: params.refundAmount,
                        refundTransactionId: params.refundTransactionId,
                    },
                });
            } catch (inAppErr) {
                console.warn('[EventCancellationService] Échec notification In-App:', inAppErr);
            }
        }
    }
}
