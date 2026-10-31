/**
 * Lot 3.6 — retraits organisateur et parrainage.
 *
 * Tout est décidé en base par withdrawal_request (migration 20261101000007), sous verrou du compte :
 * montant entier, seuil et frais lus dans les réglages (frais au FCFA supérieur), solde disponible du
 * grand livre, débit immédiat (solde réservé), cashout WITHDRAWAL-<id> au montant net. Ce service
 * ne calcule rien : il appelle la RPC puis confie l'envoi au module commun de cashout, qui gère
 * la machine à états (un envoi INCERTAIN n'est jamais relancé et le solde reste réservé ; un envoi
 * refusé rend le solde).
 */
import { CashoutService, type SendOutcome } from './cashout.service';
import { rpcWithRetry } from './rpc';
import type { AccountKind } from '@/lib/finance/ledger';
import { getServiceRoleClient } from '@/lib/supabase/server';

export interface WithdrawalRequestInput {
    userId: string;
    account: AccountKind;
    amount: number;
    method: 'MOBILE_MONEY' | 'BANK';
    operator?: 'WAVE' | 'ORANGE_MONEY' | null;
    phoneNumber?: string | null;
    clientKey: string;
    otpVerifiedAt: string;
}

export type WithdrawalOutcome =
    | { ok: true; duplicate: boolean; withdrawalId: string; status: string; grossAmount: number; feeAmount: number; netAmount: number; cashoutStatus: string | null; send?: SendOutcome }
    | { ok: false; code: string; message: string; details?: Record<string, unknown> };

async function withdrawalStatus(id: string): Promise<string> {
    const { data, error } = await getServiceRoleClient().from('withdrawals').select('status').eq('id', id).single();
    if (error || !data) throw new Error(`Lecture du retrait ${id} impossible : ${error?.message}`);
    return String(data.status);
}

async function cashoutStatus(id: string | null): Promise<string | null> {
    if (!id) return null;
    const { data, error } = await getServiceRoleClient().from('cashouts').select('status').eq('id', id).single();
    if (error || !data) throw new Error(`Lecture de l'envoi ${id} impossible : ${error?.message}`);
    return String(data.status);
}

export class WithdrawalService {
    static async request(input: WithdrawalRequestInput): Promise<WithdrawalOutcome> {
        const { data, error } = await rpcWithRetry<Record<string, unknown>>('withdrawal_request', {
            p: {
                user_id: input.userId,
                account_kind: input.account,
                gross_amount: input.amount,
                method: input.method,
                operator: input.operator ?? null,
                phone_number: input.phoneNumber ?? null,
                client_key: input.clientKey,
                otp_verified_at: input.otpVerifiedAt,
            },
        });
        if (error || !data) throw new Error(`Demande de retrait impossible : ${error?.message ?? 'réponse vide'}`);

        const duplicate = data.ok !== true && data.code === 'DUPLICATE';
        if (data.ok !== true && !duplicate) {
            const { ok: _ok, code, message, ...details } = data;
            void _ok;
            return { ok: false, code: String(code), message: String(message ?? 'Retrait refusé.'), details };
        }
        const withdrawalId = String(data.withdrawal_id);
        const cashoutId = (data.cashout_id as string | null) ?? null;
        let send: SendOutcome | undefined;
        if (cashoutId && !duplicate) send = await CashoutService.send(cashoutId);
        return {
            ok: true,
            duplicate,
            withdrawalId,
            status: await withdrawalStatus(withdrawalId),
            grossAmount: Number(data.gross_amount),
            feeAmount: Number(data.fee_amount),
            netAmount: Number(data.net_amount),
            cashoutStatus: await cashoutStatus(cashoutId),
            send,
        };
    }
}
