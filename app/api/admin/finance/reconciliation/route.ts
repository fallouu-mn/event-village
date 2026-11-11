import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { AdminService } from '@/lib/admin/admin.service';
import { cashoutFeeReconciliation } from '@/lib/admin/finance-reconciliation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/reconciliation
 * Console de Rapprochement Financier Global (§84 du CDC V3.0)
 * Lot 9 bis (H6, B106, contrat 4.1) : + frais réels SamirPay des versements (cashoutFeesReal), frais estimés au taux
 * de retrait réglé (cashoutFeesEstimated), écart (gap) ; encaissements : cashinFeesReal null et cashinNote (le
 * Cashin Direct ne renvoie aucun frais), jamais 0. Même période que le rapprochement (created_at).
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'payments.read' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;
        const status = searchParams.get('status') || 'ALL';

        const [result, fees] = await Promise.all([
            AdminService.getFinancialReconciliation({
                startDate,
                endDate,
                status,
            }),
            cashoutFeeReconciliation({ startDate, endDate }),
        ]);

        return NextResponse.json({
            success: true,
            ...result,
            ...fees,
        });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/finance/reconciliation', err, { message: 'Rapprochement financier momentanément indisponible.', code: 'RECONCILIATION_UNAVAILABLE' });
    }
}
