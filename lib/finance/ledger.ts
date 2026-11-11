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
    /** Lot 9 bis (R4, B14) : net échu des événements SUSPENDU du compte, calculé à la lecture ; jamais retirable. */
    frozen: number;
    /** Disponible moins le gel, arrondi au FCFA inférieur. */
    withdrawable: number;
    /** Lot 9 bis (R62, B27) : réglages finance.withdrawal_min_amount et finance.withdrawal_fee_rate (en %). */
    withdrawal_min_amount: number;
    withdrawal_fee_rate: number;
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
    /**
     * Titre de l'événement de l'écriture (event_id), lu à part, ou null. L'écran l'affiche à la place de
     * `description`, libellé comptable interne qui peut contenir une référence de transaction et un code
     * technique (« Remboursement REFUND-… (EVENT_CANCELLATION_REFUND) », « Vente en ligne … (TICKET) »).
     */
    event_title: string | null;
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

interface CashoutState { status: string; blocked_reason: string | null; delay_flagged_at: string | null }

/**
 * Lot 9 bis (R1, B9) : retrait retardé, à dire « Retardé : l’équipe Event Village s’en occupe ». Retrait encore en
 * cours (statut affiché PENDING ou PROCESSING) dont l'envoi n'est pas confirmé et qui est bloqué hors simulation,
 * incertain ou signalé en retard (delay_flagged_at, posé après 30 minutes par cashouts_flag_delayed) : même règle que
 * l'avis WITHDRAWAL_DELAYED et que le remboursement retardé de /api/tickets. Décidé par le serveur, jamais par
 * l'horloge du navigateur.
 */
export function withdrawalDelayed(effectiveStatus: string, cashout: CashoutState | null): boolean {
    if (!cashout || (effectiveStatus !== 'PENDING' && effectiveStatus !== 'PROCESSING')) return false;
    if (!['A_ENVOYER', 'ENVOYE', 'INCERTAIN'].includes(cashout.status)) return false;
    return cashout.status === 'INCERTAIN' || cashout.delay_flagged_at !== null
        || (cashout.blocked_reason !== null && cashout.blocked_reason !== 'SIMULATED');
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
        frozen: Number(data.frozen),
        withdrawable: Number(data.withdrawable),
        withdrawal_min_amount: Number(data.withdrawal_min_amount),
        withdrawal_fee_rate: Number(data.withdrawal_fee_rate),
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
    const rows = data ?? [];
    // Titres des événements (lecture séparée, comme withdrawalsOf) : l'écran nomme l'événement d'une vente ou
    // d'un remboursement au lieu d'afficher le libellé comptable.
    const eventIds = Array.from(new Set(rows.map((e) => e.event_id).filter((id): id is string => typeof id === 'string')));
    const titles = new Map<string, string>();
    if (eventIds.length > 0) {
        const { data: events, error: eErr } = await getServiceRoleClient().from('events').select('id, title').in('id', eventIds);
        if (eErr) throw new Error(`Événements de l'historique ${kind} indisponibles : ${eErr.message}`);
        for (const ev of events ?? []) {
            if (typeof ev.title === 'string' && ev.title.trim() !== '') titles.set(String(ev.id), ev.title);
        }
    }
    const now = Date.now();
    return rows.map((e) => {
        const at = Date.parse(String(e.available_at));
        return {
            ...e,
            amount: Number(e.amount),
            event_title: e.event_id ? titles.get(String(e.event_id)) ?? null : null,
            is_pending: !Number.isNaN(at) && at > now,
        };
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
    const cashoutState = new Map<string, CashoutState>();
    if (cashoutIds.length > 0) {
        const { data: cashouts, error: cErr } = await getServiceRoleClient().from('cashouts')
            .select('id, status, blocked_reason, delay_flagged_at').in('id', cashoutIds);
        if (cErr) throw new Error(`Envois des retraits ${kind} indisponibles : ${cErr.message}`);
        for (const c of cashouts ?? []) {
            cashoutState.set(String(c.id), {
                status: String(c.status),
                blocked_reason: c.blocked_reason === null || c.blocked_reason === undefined ? null : String(c.blocked_reason),
                delay_flagged_at: c.delay_flagged_at === null || c.delay_flagged_at === undefined ? null : String(c.delay_flagged_at),
            });
        }
    }
    return rows.map(({ cashout_id, ...w }) => {
        const cashout = cashout_id ? cashoutState.get(String(cashout_id)) ?? null : null;
        const effective = effectiveWithdrawalStatus(String(w.status), cashout?.status ?? null);
        return { ...w, effective_status: effective, delayed: withdrawalDelayed(effective, cashout) };
    });
}
