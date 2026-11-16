import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { permissionMissingResponse, verifyAdminAuth } from '@/lib/admin/admin-auth';
import { PAGE_SIZE, parsePage, refundToPayLine } from '@/lib/finance/admin-lists';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/refunds-to-pay?page=N — finition 3a (E-07) : remboursements demandés et pas encore versés
 * (en attente d'envoi, envoyés non confirmés, incertains, refusés), du plus ancien au plus récent, 20 par page.
 * Permission refunds.manage ou payments.read. Numéro masqué, état en mots ; les décisions (renvoyer, marquer versé)
 * restent dans « Versements à reprendre » (GET /api/admin/refunds?state=to_retry).
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    const perms = auth.permissions ?? [];
    if (!perms.includes('refunds.manage') && !perms.includes('payments.read')) return permissionMissingResponse('payments.read');

    const page = parsePage(req.nextUrl.searchParams.get('page'));
    if (page === null) return NextResponse.json({ error: 'Numéro de page invalide.', code: 'INVALID_PAGE' }, { status: 400 });

    try {
        const { data, error } = await getServiceRoleClient().rpc('finance_admin_refunds_to_pay', { p: { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } });
        if (error) throw new Error(`finance_admin_refunds_to_pay : ${error.code ?? ''} ${error.message}`);
        const r = (data ?? {}) as { total?: unknown; amount?: unknown; items?: unknown };
        const total = Number(r.total);
        if (!Number.isInteger(total) || !Array.isArray(r.items)) throw new Error(`finance_admin_refunds_to_pay : réponse inattendue ${JSON.stringify(data).slice(0, 200)}`);
        return NextResponse.json({
            page, pageSize: PAGE_SIZE, total, amount: Number(r.amount), pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
            items: (r.items as Array<Record<string, unknown>>).map(refundToPayLine),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return apiFailure('GET /api/admin/finance/refunds-to-pay', err, { message: 'Liste des remboursements à verser momentanément indisponible.', code: 'FINANCE_REFUNDS_UNAVAILABLE' });
    }
}
