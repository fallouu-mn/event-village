import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/reconciliation
 * Console de Rapprochement Financier Global (§84 du CDC V3.0)
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'payments.read' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get('startDate') || undefined;
        const endDate = searchParams.get('endDate') || undefined;
        const status = searchParams.get('status') || 'ALL';

        const result = await AdminService.getFinancialReconciliation({
            startDate,
            endDate,
            status,
        });

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/finance/reconciliation', err, { message: 'Rapprochement financier momentanément indisponible.', code: 'RECONCILIATION_UNAVAILABLE' });
    }
}
