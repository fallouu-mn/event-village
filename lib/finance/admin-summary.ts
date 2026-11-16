/**
 * Finition 3a (E-06, E-07, E-30, E-38) — synthèse financière de l'administration, côté serveur.
 *
 *  - readFinanceSummary(from, to) : finance_admin_summary (gagné de la période, dû aux partenaires et aux parrains,
 *    créances, remboursements à verser, réserve de prudence), seule source de calcul (SQL) ;
 *  - readEarned(from, to) : bloc « Gagné par Event Village » seul (accueil de l'administration, même fonction) ;
 *  - readSamirPayBalance() : solde du compte SamirPay lu par le serveur, avec un cache de 5 minutes partagé en base
 *    (finance_balance_cached / finance_balance_record) ; une lecture en échec n'est jamais remplacée par un chiffre ;
 *  - withdrawableAmount(...) : « Retirable par Event Village » = solde − dû aux partenaires − dû aux parrains −
 *    remboursements à verser − réserve, jamais négatif (le manque est rendu à part), en centimes entiers.
 * Toute lecture en échec lève une erreur (jamais un zéro) : la route répond par apiFailure.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { samirPayClient } from '@/lib/samirpay/client';
import { isSimulationRun } from '@/lib/integrations/simulation';

/** Durée du cache du solde SamirPay, en secondes (consigne : 5 minutes). */
export const BALANCE_CACHE_SECONDS = 300;

/** Fenêtre des paiements en échec sans identifiant SamirPay montrés dans « Versements à reprendre » (heures). */
export const UNCONFIRMED_PAYMENT_WINDOW_HOURS = 48;

export interface EarnedBlock {
    from: string | null;
    to: string | null;
    total: number;
    payments: number;
    volume: number;
    service_fees: number;
    aggregator_fees: number;
    net_revenue: number;
    refunded_net: number;
    duplicate_withheld: number;
    service_net: number;
    commissions: number;
    commissions_unrecovered: number;
    withdrawal_fees: number;
    withdrawals_paid: number;
    samirpay_fees: number;
    cashouts_with_fees: number;
    rebilled: number;
}

export interface OwedBlock {
    total: number;
    ledger: number;
    available: number;
    pending: number;
    frozen: number;
    withdrawable_now: number;
    withdrawals_in_progress: number;
    withdrawals_in_progress_count: number;
    accounts: number;
}

export interface FinanceSummary {
    computed_at: string;
    earned: EarnedBlock;
    owed_partners: OwedBlock;
    owed_referrers: OwedBlock;
    debts: { total: number; count: number; partners_total: number; partners_count: number; referrers_total: number; referrers_count: number };
    refunds_to_pay: { total: number; count: number; failed: number; uncertain: number };
    reserve: { mode: 'AUTO_3_DAYS' | 'FIXED'; amount: number; auto_amount: number; fixed_amount: number; window_hours: number };
}

export interface BalanceRead {
    solde: number;
    readAt: string;
    cached: boolean;
}

/** Nombres JSON de PostgreSQL (numeric) convertis en nombres ; un champ absent lève une erreur nommée. */
function num(obj: Record<string, unknown>, key: string, where: string): number {
    const v = obj[key];
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    if (!Number.isFinite(n)) throw new Error(`${where} : champ ${key} illisible (${JSON.stringify(v)})`);
    return n;
}

function block(obj: unknown, where: string): Record<string, unknown> {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`${where} : bloc absent`);
    return obj as Record<string, unknown>;
}

const EARNED_KEYS = ['total', 'payments', 'volume', 'service_fees', 'aggregator_fees', 'net_revenue', 'refunded_net', 'duplicate_withheld',
    'service_net', 'commissions', 'commissions_unrecovered', 'withdrawal_fees', 'withdrawals_paid', 'samirpay_fees', 'cashouts_with_fees', 'rebilled'] as const;
const OWED_KEYS = ['total', 'ledger', 'available', 'pending', 'frozen', 'withdrawable_now', 'withdrawals_in_progress', 'withdrawals_in_progress_count', 'accounts'] as const;

/** Bloc « gagné » lu tel que finance_admin_earned le rend (champ absent ou illisible : erreur nommée). */
export function parseEarned(raw: unknown): EarnedBlock {
    const o = block(raw, 'gagné');
    const out: Record<string, unknown> = { from: (o.from as string | null) ?? null, to: (o.to as string | null) ?? null };
    for (const k of EARNED_KEYS) out[k] = num(o, k, 'gagné');
    return out as unknown as EarnedBlock;
}

function parseOwed(raw: unknown, where: string): OwedBlock {
    const o = block(raw, where);
    const out: Record<string, number> = {};
    for (const k of OWED_KEYS) out[k] = num(o, k, where);
    return out as unknown as OwedBlock;
}

function parseSummary(raw: unknown): FinanceSummary {
    const o = block(raw, 'synthèse');
    const debts = block(o.debts, 'créances');
    const refunds = block(o.refunds_to_pay, 'remboursements à verser');
    const reserve = block(o.reserve, 'réserve');
    const mode = reserve.mode === 'FIXED' ? 'FIXED' : reserve.mode === 'AUTO_3_DAYS' ? 'AUTO_3_DAYS' : null;
    if (!mode) throw new Error(`réserve : mode inconnu ${JSON.stringify(reserve.mode)}`);
    return {
        computed_at: String(o.computed_at),
        earned: parseEarned(o.earned),
        owed_partners: parseOwed(o.owed_partners, 'dû aux partenaires'),
        owed_referrers: parseOwed(o.owed_referrers, 'dû aux parrains'),
        debts: {
            total: num(debts, 'total', 'créances'), count: num(debts, 'count', 'créances'),
            partners_total: num(debts, 'partners_total', 'créances'), partners_count: num(debts, 'partners_count', 'créances'),
            referrers_total: num(debts, 'referrers_total', 'créances'), referrers_count: num(debts, 'referrers_count', 'créances'),
        },
        refunds_to_pay: {
            total: num(refunds, 'total', 'remboursements à verser'), count: num(refunds, 'count', 'remboursements à verser'),
            failed: num(refunds, 'failed', 'remboursements à verser'), uncertain: num(refunds, 'uncertain', 'remboursements à verser'),
        },
        reserve: {
            mode,
            amount: num(reserve, 'amount', 'réserve'), auto_amount: num(reserve, 'auto_amount', 'réserve'),
            fixed_amount: num(reserve, 'fixed_amount', 'réserve'), window_hours: num(reserve, 'window_hours', 'réserve'),
        },
    };
}

/** Synthèse sur [from, to[ (instants UTC ISO). */
export async function readFinanceSummary(from: string, to: string): Promise<FinanceSummary> {
    const { data, error } = await getServiceRoleClient().rpc('finance_admin_summary', { p_from: from, p_to: to });
    if (error) throw new Error(`finance_admin_summary : ${error.code ?? ''} ${error.message}`);
    return parseSummary(data);
}

/** « Gagné par Event Village » sur [from, to[ (NULL : sans borne). */
export async function readEarned(from: string | null, to: string | null): Promise<EarnedBlock> {
    const { data, error } = await getServiceRoleClient().rpc('finance_admin_earned', { p_from: from, p_to: to });
    if (error) throw new Error(`finance_admin_earned : ${error.code ?? ''} ${error.message}`);
    return parseEarned(data);
}

function parseBalance(raw: unknown): BalanceRead | null {
    if (raw === null || raw === undefined) return null;
    const o = block(raw, 'solde SamirPay');
    return { solde: num(o, 'solde', 'solde SamirPay'), readAt: String(o.read_at), cached: o.cached === true };
}

/**
 * Solde SamirPay : dernière lecture de moins de 5 minutes du mode du serveur, sinon lecture auprès de SamirPay,
 * enregistrée. Lecture impossible (SamirPay ou base) : { ok: false }, jamais un solde inventé.
 */
export async function readSamirPayBalance(): Promise<{ ok: true; balance: BalanceRead } | { ok: false }> {
    const supabase = getServiceRoleClient();
    const simulated = isSimulationRun();
    const cached = await supabase.rpc('finance_balance_cached', { p_max_age_seconds: BALANCE_CACHE_SECONDS, p_simulated: simulated });
    if (cached.error) {
        console.error('[finance] cache du solde SamirPay illisible :', cached.error.message);
        return { ok: false };
    }
    const fromCache = parseBalance(cached.data);
    if (fromCache) return { ok: true, balance: fromCache };

    let solde: number;
    try {
        solde = (await samirPayClient.getSolde()).solde;
    } catch (err) {
        console.error('[finance] solde SamirPay illisible :', err instanceof Error ? err.message : String(err));
        return { ok: false };
    }
    if (!Number.isFinite(solde)) {
        console.error('[finance] solde SamirPay illisible : valeur', solde);
        return { ok: false };
    }
    const recorded = await supabase.rpc('finance_balance_record', { p_solde: solde, p_simulated: simulated });
    if (recorded.error) {
        console.error('[finance] lecture du solde SamirPay non enregistrée :', recorded.error.message);
        return { ok: false };
    }
    const fresh = parseBalance(recorded.data);
    return fresh ? { ok: true, balance: fresh } : { ok: false };
}

const toCents = (x: number): number => Math.round(x * 100);

/**
 * « Retirable par Event Village », en F CFA, calculé en centimes entiers : max(0, solde − dû aux partenaires − dû aux
 * parrains − remboursements à verser − réserve). `shortfall` : ce qui manque au compte quand le résultat serait
 * négatif (0 sinon). Sans solde lisible : amount et shortfall valent null.
 */
export function withdrawableAmount(input: {
    balance: number | null;
    owedPartners: number;
    owedReferrers: number;
    refundsToPay: number;
    reserve: number;
}): { amount: number | null; shortfall: number | null } {
    if (input.balance === null || !Number.isFinite(input.balance)) return { amount: null, shortfall: null };
    const raw = toCents(input.balance) - toCents(input.owedPartners) - toCents(input.owedReferrers)
        - toCents(input.refundsToPay) - toCents(input.reserve);
    return { amount: Math.max(raw, 0) / 100, shortfall: Math.max(-raw, 0) / 100 };
}
