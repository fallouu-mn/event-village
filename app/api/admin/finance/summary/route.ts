import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { readFinanceSummary, readSamirPayBalance, withdrawableAmount } from '@/lib/finance/admin-summary';
import { resolvePeriod } from '@/lib/finance/period';
import { isSimulationRun } from '@/lib/integrations/simulation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/summary?period=today|7d|30d|month|prev-month|custom[&from=AAAA-MM-JJ&to=AAAA-MM-JJ]
 * Finition 3a (E-06, E-30, E-38) — les trois chiffres de la page Finance, permission payments.read :
 *  - période unique de la page, calculée par le serveur en heure de Dakar (lib/finance/period.ts) ; « Ce mois-ci » par
 *    défaut. Le filtre de statut des paiements n'existe pas ici : il ne change que la liste (GET …/finance/payments) ;
 *  - synthèse (finance_admin_summary) : gagné de la période, dû aux partenaires et aux parrains, créances,
 *    remboursements à verser, réserve de prudence ;
 *  - « Retirable par Event Village » : SUPERADMIN seulement ; solde SamirPay lu par le serveur (cache de 5 minutes,
 *    heure de lecture rendue) ; solde illisible : aucun chiffre (amount null), jamais une valeur supposée.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'payments.read' });
    if (!auth.authorized) return auth.errorResponse!;

    const sp = req.nextUrl.searchParams;
    const resolved = resolvePeriod({ period: sp.get('period'), from: sp.get('from'), to: sp.get('to') });
    if (!resolved.ok) return NextResponse.json({ error: resolved.error, code: 'INVALID_PERIOD' }, { status: 400 });

    try {
        const summary = await readFinanceSummary(resolved.period.from, resolved.period.to);
        let withdrawable: Record<string, unknown> = { visible: false };
        if (auth.user!.roles.includes('SUPERADMIN')) {
            const read = await readSamirPayBalance();
            const w = withdrawableAmount({
                balance: read.ok ? read.balance.solde : null,
                owedPartners: summary.owed_partners.total,
                owedReferrers: summary.owed_referrers.total,
                refundsToPay: summary.refunds_to_pay.total,
                reserve: summary.reserve.amount,
            });
            withdrawable = {
                visible: true,
                balance: read.ok ? { solde: read.balance.solde, readAt: read.balance.readAt, cached: read.balance.cached } : null,
                amount: w.amount,
                shortfall: w.shortfall,
                simulated: isSimulationRun(),
            };
        }
        return NextResponse.json({ period: resolved.period, summary, withdrawable }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return apiFailure('GET /api/admin/finance/summary', err, { message: 'Chiffres de la finance momentanément indisponibles.', code: 'FINANCE_SUMMARY_UNAVAILABLE' });
    }
}
