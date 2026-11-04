/**
 * Lot 3 — lecture des comptes du grand livre (finance_ledger) : solde disponible, en attente,
 * retraits en cours, créance, historique. Les écritures ne sont faites que par les RPC SQL.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { rpcWithRetry } from '@/lib/payments/rpc';

export type AccountKind = 'ORGANISATEUR' | 'PARRAINAGE';
export const ACCOUNT_KINDS: readonly AccountKind[] = ['ORGANISATEUR', 'PARRAINAGE'];

export interface AccountBalance {
    account_kind: AccountKind;
    available: number;
    pending: number;
    next_available_at: string | null;
    in_progress: number;
    debt: number;
    withdrawable: number;
}

export interface LedgerEntry {
    id: string;
    entry_type: string;
    amount: number;
    available_at: string;
    created_at: string;
    description: string | null;
    payment_id: string | null;
    ticket_id: string | null;
    withdrawal_id: string | null;
    event_id: string | null;
    /** Lot 7 (7.4) : écriture pas encore disponible (available_at après l'heure du serveur à la lecture). */
    is_pending: boolean;
}

/**
 * Statut d'un retrait tel qu'il doit s'afficher (lot 7, 7.4) : un retrait encore PROCESSING dont l'envoi
 * (cashout) est déjà CONFIRME est versé (PAID) ; dont l'envoi a ÉCHOUÉ est refusé, montant rendu (REJECTED) ;
 * sinon son statut enregistré. Une issue incertaine reste PROCESSING (jamais PAID ni REJECTED).
 */
export function effectiveWithdrawalStatus(status: string, cashoutStatus: string | null): string {
    if (status === 'PROCESSING' && cashoutStatus === 'CONFIRME') return 'PAID';
    if (status === 'PROCESSING' && cashoutStatus === 'ECHOUE') return 'REJECTED';
    return status;
}

export async function accountBalance(ownerId: string, kind: AccountKind): Promise<AccountBalance> {
    const { data, error } = await rpcWithRetry<Record<string, unknown>>('finance_account_balance', { p_owner: ownerId, p_kind: kind });
    if (error || !data) throw new Error(`Solde ${kind} indisponible : ${error?.message ?? 'réponse vide'}`);
    return {
        account_kind: kind,
        available: Number(data.available),
        pending: Number(data.pending),
        next_available_at: (data.next_available_at as string | null) ?? null,
        in_progress: Number(data.in_progress),
        debt: Number(data.debt),
        withdrawable: Number(data.withdrawable),
    };
}

export async function accountHistory(ownerId: string, kind: AccountKind, limit = 50): Promise<LedgerEntry[]> {
    const { data, error } = await getServiceRoleClient()
        .from('finance_ledger')
        .select('id, entry_type, amount, available_at, created_at, description, payment_id, ticket_id, withdrawal_id, event_id')
        .eq('owner_id', ownerId)
        .eq('account_kind', kind)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`Historique ${kind} indisponible : ${error.message}`);
    const now = Date.now();
    return (data ?? []).map((e) => {
        const at = Date.parse(String(e.available_at));
        return { ...e, amount: Number(e.amount), is_pending: !Number.isNaN(at) && at > now };
    }) as LedgerEntry[];
}

export async function withdrawalsOf(ownerId: string, kind: AccountKind, limit = 20): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await getServiceRoleClient()
        .from('withdrawals')
        .select('id, gross_amount, fee_amount, net_amount, status, operator, phone_number, withdrawal_method, created_at, processed_at, rejection_reason, cashout_id')
        .eq('user_id', ownerId)
        .eq('account_kind', kind)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`Retraits ${kind} indisponibles : ${error.message}`);
    const rows = data ?? [];
    // Issue de l'envoi de chaque retrait (lecture séparée : withdrawals et cashouts se référencent l'un l'autre,
    // l'embarquement PostgREST serait ambigu).
    const cashoutIds = Array.from(new Set(rows.map((w) => w.cashout_id).filter((id): id is string => typeof id === 'string')));
    const cashoutStatus = new Map<string, string>();
    if (cashoutIds.length > 0) {
        const { data: cashouts, error: cErr } = await getServiceRoleClient().from('cashouts').select('id, status').in('id', cashoutIds);
        if (cErr) throw new Error(`Envois des retraits ${kind} indisponibles : ${cErr.message}`);
        for (const c of cashouts ?? []) cashoutStatus.set(String(c.id), String(c.status));
    }
    return rows.map(({ cashout_id, ...w }) => ({
        ...w,
        effective_status: effectiveWithdrawalStatus(String(w.status), cashout_id ? cashoutStatus.get(String(cashout_id)) ?? null : null),
    }));
}
