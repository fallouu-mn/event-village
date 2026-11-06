import { getServiceRoleClient } from '@/lib/supabase/server';
import { PublicError } from '@/lib/api/public-error';
import { revokeUserSessions } from '@/lib/auth/sessions';

export interface FinancialReconciliationItem {
    paymentId: string;
    transactionReference: string;
    targetType: string;
    targetId: string;
    /** Total débité au client (prix facial + frais de service). */
    grossAmount: number;
    /** Prix facial (null pour un paiement antérieur au lot 3). */
    facialAmount: number | null;
    serviceFee: number;
    paymentMethod: string;
    aggregatorFee: number;
    /** Taux de frais de service recopié sur le paiement à sa création (null avant le lot 3). */
    platformFeeRate: number | null;
    platformGrossRevenue: number;
    /** Revenu net EV effectif : net − part annulée par les remboursements. */
    platformNetRevenue: number;
    refundedAmount: number;
    partnerPayout: number;
    referralCommissionN1: number;
    referralCommissionN2: number;
    totalReferralCommissions: number;
    discrepancy: number; // 0 if balanced
    status: string;
    createdAt: string;
}

export interface FinancialReconciliationSummary {
    period: string;
    totalTransactionsCount: number;
    totalGrossVolume: number;
    totalServiceFees: number;
    totalAggregatorFees: number;
    totalPlatformNetRevenue: number;
    totalPartnerPayouts: number;
    totalReferralCommissions: number;
    totalWithdrawalsPaid: number;
    totalRefunds: number;
    platformNetBalance: number;
    discrepanciesCount: number;
}

interface ReconciliationPaymentRow {
    id: string;
    transaction_id: string;
    external_transaction_id: string | null;
    payment_target: string;
    operator: string | null;
    status: string;
    amount: number;
    facial_amount: number | null;
    service_fee: number;
    service_fee_rate: number | null;
    aggregator_fee: number;
    gross_event_village_revenue: number;
    net_event_village_revenue: number;
    refunded_net_revenue: number | null;
    refunded_amount: number | null;
    partner_payout_amount: number;
    order_id: string | null;
    hall_reservation_id: string | null;
    table_reservation_id: string | null;
    subscription_plan_id: string | null;
    event_id: string | null;
    created_at: string;
}

/** Statuts d'un paiement dont l'argent a été encaissé (avant ou après remboursement). */
const ENCASHED_STATUSES = ['SUCCESS', 'PARTIAL', 'REFUNDED', 'REFUND_PENDING'];
const PAGE_SIZE = 1000;
const ID_CHUNK = 200;

/**
 * Lit toutes les lignes d'une requête paginée (plafond max_rows de PostgREST) ; toute erreur de
 * lecture est remontée, jamais ignorée.
 */
async function fetchAllRows<T>(
    label: string,
    page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await page(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`Lecture impossible (${label}) : ${error.message}`);
        rows.push(...((data ?? []) as T[]));
        if (!data || data.length < PAGE_SIZE) return rows;
    }
}

export const BLACKLISTED_WORDS = [
    'arnaque',
    'escroc',
    'connard',
    'salope',
    'encule',
    'terroriste',
    'hack',
    'piratage',
    'fake',
    'voler',
    'putain',
    'merde',
];

export class AdminService {
    /**
     * Rapprochement financier global (CDC §84, lot 3 contrat G).
     * Paiements plateforme uniquement (is_platform_payment = true) : les espèces et autres paiements
     * hors plateforme ne sont ni un encaissement ni un revenu Event Village (§76). Montants lus tels
     * qu'ils ont été persistés par le moteur financier unique à la création du paiement (jamais
     * recalculés avec des taux courants) ; revenu EV = net − part annulée par les remboursements.
     * Statut « ALL » : paiements encaissés (SUCCESS, PARTIAL, REFUNDED, REFUND_PENDING).
     * Contrôle d'écart par paiement : total = reversement partenaire + revenu brut EV, et
     * revenu brut EV = revenu net EV + frais d'agrégateur.
     */
    static async getFinancialReconciliation(options?: {
        startDate?: string;
        endDate?: string;
        status?: string;
    }): Promise<{
        summary: FinancialReconciliationSummary;
        items: FinancialReconciliationItem[];
    }> {
        const supabase = getServiceRoleClient();
        const status = options?.status && options.status !== 'ALL' ? options.status : null;

        const payments = await fetchAllRows<ReconciliationPaymentRow>('rapprochement : paiements', (from, to) => {
            let q = supabase
                .from('payments')
                .select('id, transaction_id, external_transaction_id, payment_target, operator, status, amount, facial_amount, service_fee, service_fee_rate, aggregator_fee, gross_event_village_revenue, net_event_village_revenue, refunded_net_revenue, refunded_amount, partner_payout_amount, order_id, hall_reservation_id, table_reservation_id, subscription_plan_id, event_id, created_at')
                .eq('is_platform_payment', true);
            q = status ? q.eq('status', status) : q.in('status', ENCASHED_STATUSES);
            if (options?.startDate) q = q.gte('created_at', options.startDate);
            if (options?.endDate) q = q.lte('created_at', options.endDate);
            return q.order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to);
        });

        // Commissions de parrainage des paiements retenus (annulées exclues, régularisations négatives incluses)
        const commMap: Record<string, { n1: number; n2: number }> = {};
        const ids = payments.map((p) => p.id);
        for (let i = 0; i < ids.length; i += ID_CHUNK) {
            const chunk = ids.slice(i, i + ID_CHUNK);
            const rows = await fetchAllRows<{ payment_id: string; amount: number; generation: string }>('rapprochement : commissions', (from, to) => supabase
                .from('referral_commissions')
                .select('id, payment_id, amount, generation')
                .in('payment_id', chunk)
                .neq('status', 'CANCELLED')
                .order('id', { ascending: true })
                .range(from, to));
            for (const c of rows) {
                if (!commMap[c.payment_id]) commMap[c.payment_id] = { n1: 0, n2: 0 };
                if (c.generation === 'N1') commMap[c.payment_id].n1 += Number(c.amount);
                if (c.generation === 'N2') commMap[c.payment_id].n2 += Number(c.amount);
            }
        }

        // Retraits versés et remboursements versés par la plateforme, sur la même période
        const withdrawals = await fetchAllRows<{ net_amount: number }>('rapprochement : retraits', (from, to) => {
            let q = supabase.from('withdrawals').select('id, net_amount').eq('status', 'PAID');
            if (options?.startDate) q = q.gte('created_at', options.startDate);
            if (options?.endDate) q = q.lte('created_at', options.endDate);
            return q.order('id', { ascending: true }).range(from, to);
        });
        const refunds = await fetchAllRows<{ amount: number }>('rapprochement : remboursements', (from, to) => {
            let q = supabase.from('refunds').select('id, amount').eq('status', 'PROCESSED').eq('settlement', 'PLATEFORME');
            if (options?.startDate) q = q.gte('created_at', options.startDate);
            if (options?.endDate) q = q.lte('created_at', options.endDate);
            return q.order('id', { ascending: true }).range(from, to);
        });

        const cents = (n: number) => Math.round(n * 100);
        let totalGrossVolume = 0;
        let totalServiceFees = 0;
        let totalAggregatorFees = 0;
        let totalPlatformNetRevenue = 0;
        let totalPartnerPayouts = 0;
        let totalReferralCommissions = 0;
        let discrepanciesCount = 0;

        const items: FinancialReconciliationItem[] = payments.map((p) => {
            const grossAmount = Number(p.amount);
            const serviceFee = Number(p.service_fee);
            const aggregatorFee = Number(p.aggregator_fee);
            const evGross = Number(p.gross_event_village_revenue);
            const evNet = Number(p.net_event_village_revenue);
            const platformNetRevenue = evNet - Number(p.refunded_net_revenue ?? 0);
            const partnerPayout = Number(p.partner_payout_amount);
            const n1 = commMap[p.id]?.n1 ?? 0;
            const n2 = commMap[p.id]?.n2 ?? 0;

            const gapCents = Math.abs(cents(grossAmount) - cents(partnerPayout + evGross)) + Math.abs(cents(evGross) - cents(evNet + aggregatorFee));
            if (gapCents > 0) discrepanciesCount += 1;

            totalGrossVolume += grossAmount;
            totalServiceFees += serviceFee;
            totalAggregatorFees += aggregatorFee;
            totalPlatformNetRevenue += platformNetRevenue;
            totalPartnerPayouts += partnerPayout;
            totalReferralCommissions += n1 + n2;

            return {
                paymentId: p.id,
                transactionReference: p.external_transaction_id || p.transaction_id,
                targetType: p.payment_target,
                targetId: p.order_id || p.hall_reservation_id || p.table_reservation_id || p.subscription_plan_id || p.event_id || '',
                grossAmount,
                facialAmount: p.facial_amount === null ? null : Number(p.facial_amount),
                serviceFee,
                paymentMethod: p.operator || 'SAMIRPAY',
                aggregatorFee,
                platformFeeRate: p.service_fee_rate === null ? null : Number(p.service_fee_rate),
                platformGrossRevenue: evGross,
                platformNetRevenue,
                refundedAmount: Number(p.refunded_amount ?? 0),
                partnerPayout,
                referralCommissionN1: n1,
                referralCommissionN2: n2,
                totalReferralCommissions: n1 + n2,
                discrepancy: gapCents / 100,
                status: p.status,
                createdAt: p.created_at,
            };
        });

        const totalWithdrawalsPaid = withdrawals.reduce((acc, w) => acc + Number(w.net_amount), 0);
        const totalRefunds = refunds.reduce((acc, r) => acc + Number(r.amount), 0);

        return {
            summary: {
                period: options?.startDate ? `${options.startDate} au ${options.endDate || 'ce jour'}` : 'Toutes périodes',
                totalTransactionsCount: items.length,
                totalGrossVolume,
                totalServiceFees,
                totalAggregatorFees,
                totalPlatformNetRevenue,
                totalPartnerPayouts,
                totalReferralCommissions,
                totalWithdrawalsPaid,
                totalRefunds,
                platformNetBalance: totalPlatformNetRevenue - totalReferralCommissions,
                discrepanciesCount,
            },
            items,
        };
    }

    /**
     * Contrôle et modération du contenu d'une communication (§121-§126)
     */
    static moderateContent(text: string): { isClean: boolean; flaggedWords: string[] } {
        const lower = text.toLowerCase();
        const flaggedWords: string[] = [];

        for (const word of BLACKLISTED_WORDS) {
            const regex = new RegExp(`\\b${word}s?\\b`, 'i');
            if (regex.test(lower)) {
                flaggedWords.push(word);
            }
        }

        return {
            isClean: flaggedWords.length === 0,
            flaggedWords,
        };
    }

    /**
     * Journalisation inaltérable d'une action Superadmin
     */
    static async logAudit(params: {
        userId?: string;
        userRole: string;
        action: string;
        objectType: string;
        objectId?: string;
        oldValue?: any;
        newValue?: any;
        metadata?: any;
    }) {
        try {
            const supabase = getServiceRoleClient();
            await supabase.from('audit_logs').insert({
                user_id: params.userId || null,
                user_role: params.userRole,
                action: params.action,
                object_type: params.objectType,
                object_id: params.objectId || null,
                old_value: params.oldValue || null,
                new_value: params.newValue || null,
                metadata: params.metadata || {},
            });
        } catch (err) {
            console.error('[AdminService.logAudit] Erreur journalisation:', err);
        }
    }

    /**
     * Anonymisation sécurisée et Soft Delete RGPD d'un utilisateur (Superadmin HQ)
     * Conserve STRICTEMENT l'intégrité financière (orders, tickets, controller_shifts, payments)
     * Libère l'email et le téléphone côté Auth, bannit le compte et efface l'identité publique.
     */
    static async anonymizeUser(targetUserId: string, actor: { id: string; role: string }): Promise<{ success: boolean; message: string }> {
        const supabase = getServiceRoleClient();

        // 1. Protection : interdiction d'anonymiser son propre compte administrateur
        if (targetUserId === actor.id) {
            throw new PublicError('Impossible de supprimer votre propre compte administrateur.');
        }

        // 2. Récupérer les informations du compte cible
        const { data: targetUser, error: findErr } = await supabase
            .from('users')
            .select('id, phone, email, role, first_name, last_name, status')
            .eq('id', targetUserId)
            .maybeSingle();

        if (findErr) {
            throw new Error(`Erreur recherche utilisateur: ${findErr.message}`);
        }

        if (targetUser?.role === 'SUPERADMIN' && actor.role !== 'SUPERADMIN') {
            throw new PublicError('Seul un Superadmin peut supprimer un compte SUPERADMIN.');
        }

        const anonymizedEmail = `${targetUserId}@deleted.eventvillage.sn`;
        const anonymizedPhone = '000000000';
        const originalPhone = targetUser?.phone;

        // 3. AUTH SUPABASE (Libération de l'Email et du Téléphone + Ban définitif 100 ans)
        // ATTENTION : Ne JAMAIS utiliser auth.admin.deleteUser pour éviter le hard delete en cascade.
        // Lot 1B.9 : l'ancien téléphone synthétique (+000000…) était refusé par GoTrue (format E.164) ;
        // l'erreur, renvoyée et non levée, était ignorée : ni l'email, ni le téléphone, ni le
        // bannissement n'étaient appliqués et le compte restait connectable. Numéro synthétique
        // valide et unique (indicatif 999, non attribué) ; tout échec interrompt l'anonymisation.
        const authPhoneDigits = BigInt(`0x${targetUserId.replace(/-/g, '')}`).toString().slice(-12).padStart(12, '0');
        const { error: authUpdateErr } = await supabase.auth.admin.updateUserById(targetUserId, {
            email: anonymizedEmail,
            email_confirm: true,
            phone: `+999${authPhoneDigits}`,
            phone_confirm: false,
            ban_duration: '876000h', // 100 ans
            user_metadata: {
                is_anonymized: true,
                anonymized_at: new Date().toISOString(),
                first_name: 'Utilisateur',
                last_name: 'Supprimé',
            },
        });
        if (authUpdateErr) {
            throw new Error(`Anonymisation du compte de connexion impossible : ${authUpdateErr.message}`);
        }
        // Lot 1C.3 : sessions et jetons de rafraîchissement révoqués explicitement, sans dépendre du bannissement
        if (!(await revokeUserSessions(targetUserId, { reason: 'USER_ANONYMIZED', actorId: actor.id }))) {
            throw new PublicError('Révocation des sessions du compte anonymisé impossible.');
        }

        // 4. DB PUBLIQUE users (Anonymisation RGPD)
        let finalStatus = 'SUPPRIME';
        let anonymizedPhoneToUse = anonymizedPhone;
        
        let { error: updateErr } = await supabase
            .from('users')
            .update({
                first_name: 'Utilisateur',
                last_name: 'Supprimé',
                email: anonymizedEmail,
                phone: anonymizedPhoneToUse,
                status: finalStatus as any,
                referral_status: 'STANDARD',
                updated_at: new Date().toISOString(),
            })
            .eq('id', targetUserId);

        // Si échec sur phone unique (ex: déjà un '000000000' en DB), utiliser phone synthétique unique
        if (updateErr && updateErr.message.includes('users_phone_key')) {
            anonymizedPhoneToUse = `000000_${targetUserId.replace(/-/g, '').slice(0, 8)}`;
            const res = await supabase
                .from('users')
                .update({
                    first_name: 'Utilisateur',
                    last_name: 'Supprimé',
                    email: anonymizedEmail,
                    phone: anonymizedPhoneToUse,
                    status: finalStatus as any,
                    referral_status: 'STANDARD',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', targetUserId);
            updateErr = res.error;
        }

        if (updateErr) {
            console.warn('[AdminService.anonymizeUser] Erreur status SUPPRIME, repli sur SUSPENDU:', updateErr.message);
            finalStatus = 'SUSPENDU';
            await supabase
                .from('users')
                .update({
                    first_name: 'Utilisateur',
                    last_name: 'Supprimé',
                    email: anonymizedEmail,
                    phone: anonymizedPhoneToUse,
                    status: finalStatus as any,
                    referral_status: 'STANDARD',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', targetUserId);
        }

        // 5. NETTOYAGE DES AFFECTATIONS ET DES DROITS (Droit à l'oubli opérationnel)
        // Supprimer des équipes d'événements, des rôles d'administration et des permissions (sans toucher
        // aux shifts ni aux commandes). Lot 7 (D19) : admin_permissions par user_id (la colonne admin_id
        // n'existe pas : rien n'était supprimé) ; ADMIN et SUPERADMIN retirés de user_roles, sinon is_admin()
        // reste vrai côté RLS pendant la vie du jeton. Chaque retrait est une requête distincte : le refus
        // du retrait de CONTROLEUR (caisse ouverte, EV409) n'empêche pas le retrait des droits d'administration.
        const cleanups = await Promise.all([
            supabase.from('admin_permissions').delete().eq('user_id', targetUserId),
            supabase.from('user_roles').delete().eq('user_id', targetUserId).in('role', ['ADMIN', 'SUPERADMIN']),
            supabase.from('event_controllers').delete().eq('user_id', targetUserId),
            supabase.from('user_roles').delete().eq('user_id', targetUserId).eq('role', 'CONTROLEUR'),
            originalPhone
                ? supabase
                    .from('otp_codes')
                    .delete()
                    .in('phone', [originalPhone, originalPhone.replace('+', ''), anonymizedPhone]) // lot 1C.1 : plus de filtre texte
                : Promise.resolve({ error: null }),
        ]);
        const cleanupLabels = ['admin_permissions', 'user_roles ADMIN et SUPERADMIN', 'event_controllers', 'user_roles CONTROLEUR', 'otp_codes'];
        const failedCleanups: string[] = [];
        cleanups.forEach((res: { error: { message: string } | null }, i: number) => {
            if (res.error) {
                console.error(`[AdminService.anonymizeUser] nettoyage ${cleanupLabels[i]} :`, res.error.message);
                failedCleanups.push(cleanupLabels[i]);
            }
        });
        // Lot 7 (D19) : l'échec d'un retrait est remonté (plus un simple journal). Le compte est déjà
        // SUPPRIME et ses sessions révoquées ; l'anonymisation peut être relancée pour terminer le nettoyage.
        if (failedCleanups.length > 0) {
            await AdminService.logAudit({
                userId: actor.id,
                userRole: actor.role,
                action: 'ANONYMIZE_USER_CLEANUP_FAILED',
                objectType: 'users',
                objectId: targetUserId,
                metadata: { failed: failedCleanups },
            });
            throw new PublicError(`Anonymisation incomplète : retrait impossible (${failedCleanups.join(', ')}). Relancez l'anonymisation ; une caisse ouverte doit d'abord être clôturée.`);
        }

        // 6. Journalisation d'audit inaltérable
        await AdminService.logAudit({
            userId: actor.id,
            userRole: actor.role,
            action: 'ANONYMIZE_USER',
            objectType: 'users',
            objectId: targetUserId,
            oldValue: targetUser,
            newValue: {
                first_name: 'Utilisateur',
                last_name: 'Supprimé',
                email: anonymizedEmail,
                phone: anonymizedPhone,
                status: finalStatus,
            },
            metadata: {
                deleted_by: actor.role,
                anonymized_at: new Date().toISOString(),
                rgpd_compliant: true,
                orders_preserved: true,
                tickets_preserved: true,
                shifts_preserved: true,
            },
        });

        return {
            success: true,
            message: `L'utilisateur a été définitivement anonymisé (RGPD). Son email et son téléphone ont été libérés, et son historique financier est préservé.`,
        };
    }

    /**
     * Alias de suppression pour compatibilité (effectue l'anonymisation RGPD sécurisée)
     */
    static async deleteUser(targetUserId: string, actor: { id: string; role: string }): Promise<{ success: boolean; message: string }> {
        return this.anonymizeUser(targetUserId, actor);
    }
}

