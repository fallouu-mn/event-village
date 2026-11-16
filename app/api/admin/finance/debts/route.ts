import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { debtLine, PAGE_SIZE, parsePage } from '@/lib/finance/admin-lists';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/debts?page=N — finition 3a (E-38) : créances ouvertes (ce que des partenaires ou des parrains
 * doivent encore à Event Village), de la plus ancienne à la plus récente, 20 par page, permission payments.read.
 * Qui, pourquoi et l'événement en mots (lib/finance/admin-lists.ts) ; jamais de code technique.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'payments.read' });
    if (!auth.authorized) return auth.errorResponse!;

    const page = parsePage(req.nextUrl.searchParams.get('page'));
    if (page === null) return NextResponse.json({ error: 'Numéro de page invalide.', code: 'INVALID_PAGE' }, { status: 400 });

    try {
        const { data, error } = await getServiceRoleClient().rpc('finance_admin_debts', { p: { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } });
        if (error) throw new Error(`finance_admin_debts : ${error.code ?? ''} ${error.message}`);
        const r = (data ?? {}) as { total?: unknown; amount?: unknown; items?: unknown };
        const total = Number(r.total);
        if (!Number.isInteger(total) || !Array.isArray(r.items)) throw new Error(`finance_admin_debts : réponse inattendue ${JSON.stringify(data).slice(0, 200)}`);
        return NextResponse.json({
            page, pageSize: PAGE_SIZE, total, amount: Number(r.amount), pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
            items: (r.items as Array<Record<string, unknown>>).map(debtLine),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return apiFailure('GET /api/admin/finance/debts', err, { message: 'Liste des créances momentanément indisponible.', code: 'FINANCE_DEBTS_UNAVAILABLE' });
    }
}
