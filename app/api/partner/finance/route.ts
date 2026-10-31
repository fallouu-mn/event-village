import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { accountBalance } from '@/lib/finance/ledger';
import {
    EMPTY_BUCKET, LEDGER_SALES_COLUMNS, LEDGER_SALES_TYPES, fetchAllRows, organizerWithdrawals, splitLedgerRows, toPartnerSummary,
    type LedgerSalesRow,
} from '@/lib/partner/partner-dashboard.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/finance — finance du compte organisateur (lot 3, contrat G).
 * Montants lus dans le grand livre (finance_ledger, via finance_partner_summary) : ventes en ligne
 * (prix faciaux), remboursements, net organisateur, disponible / en attente, solde retirable.
 * Aucun taux appliqué ici : Event Village ne prélève rien sur l'organisateur (frais de service payés
 * par l'acheteur, ligne informative) ; les ventes espèces (is_platform_payment = false) sont
 * affichées à part et n'entrent ni dans le net ni dans le solde.
 */
export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (!serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const supabase = getServiceRoleClient();

        const { data: partner, error: pErr } = await supabase
            .from('partners')
            .select('id, company_name, commercial_name')
            .eq('user_id', user.id)
            .maybeSingle();
        if (pErr) throw new Error(`Lecture impossible (profil partenaire) : ${pErr.message}`);
        if (!partner) {
            return NextResponse.json({ error: 'Profil partenaire introuvable.' }, { status: 404 });
        }

        const [summaryRes, ledgerRows, balance, withdrawals] = await Promise.all([
            supabase.rpc('finance_partner_summary', { p_partner_id: partner.id, p_event_id: null }),
            fetchAllRows<LedgerSalesRow>('grand livre', (from, to) => supabase
                .from('finance_ledger')
                .select(LEDGER_SALES_COLUMNS)
                .eq('partner_id', partner.id)
                .eq('account_kind', 'ORGANISATEUR')
                .in('entry_type', LEDGER_SALES_TYPES)
                .order('id', { ascending: true })
                .range(from, to)),
            accountBalance(user.id, 'ORGANISATEUR'),
            organizerWithdrawals(user.id),
        ]);
        const summary = toPartnerSummary(summaryRes);
        const split = splitLedgerRows(ledgerRows);
        const target = (key: string) => {
            const bucket = split.byTarget[key] ?? EMPTY_BUCKET;
            return {
                grossRevenue: bucket.sales,
                refunded: bucket.refunded,
                netRevenue: summary.byTarget[key] ?? 0,
                commissionRate: 0,
            };
        };

        return NextResponse.json({
            success: true,
            finance: {
                grossRevenue: summary.onlineSales,
                evCommission: 0,
                netRevenue: summary.organizerNet,
                refunded: summary.refunded,
                availableRevenue: summary.available,
                pendingRevenue: summary.pending,
                nextAvailableAt: balance.next_available_at,
                debt: balance.debt,
                soldeDisponible: balance.withdrawable,
                totalWithdrawn: withdrawals.totalWithdrawn,
                pendingAmount: withdrawals.pending,
                buyerServiceFees: summary.buyerServiceFees,
                cashSales: summary.cashSales,
                cashTickets: summary.cashTickets,
                breakdown: {
                    tickets: {
                        ...target('TICKET'),
                        buyerServiceFees: summary.buyerServiceFees,
                        cashSales: summary.cashSales,
                        cashTickets: summary.cashTickets,
                    },
                    orders: target('ORDER'),
                    halls: target('HALL_RESERVATION'),
                    tables: target('TABLE_RESERVATION'),
                },
            },
            withdrawals: withdrawals.rows,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erreur interne.';
        console.error('[API /api/partner/finance] Erreur:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
