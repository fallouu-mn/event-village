import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { owedLine, PAGE_SIZE, parsePage } from '@/lib/finance/admin-lists';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/owed?kind=ORGANISATEUR|PARRAINAGE&page=N — finition 3a (E-06) : détail de « Dû aux
 * partenaires » (ou aux parrains), compte par compte, du plus grand montant au plus petit, 20 par page, permission
 * payments.read : solde, dont retirable aujourd'hui, en attente de la fin des événements, gelé, retraits en cours.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'payments.read' });
    if (!auth.authorized) return auth.errorResponse!;

    const sp = req.nextUrl.searchParams;
    const kind = (sp.get('kind') ?? 'ORGANISATEUR').trim();
    if (kind !== 'ORGANISATEUR' && kind !== 'PARRAINAGE') {
        return NextResponse.json({ error: 'Type de compte inconnu.', code: 'INVALID_KIND' }, { status: 400 });
    }
    const page = parsePage(sp.get('page'));
    if (page === null) return NextResponse.json({ error: 'Numéro de page invalide.', code: 'INVALID_PAGE' }, { status: 400 });

    try {
        const { data, error } = await getServiceRoleClient().rpc('finance_admin_owed', { p: { kind, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE } });
        if (error) throw new Error(`finance_admin_owed : ${error.code ?? ''} ${error.message}`);
        const r = (data ?? {}) as { total?: unknown; items?: unknown };
        const total = Number(r.total);
        if (!Number.isInteger(total) || !Array.isArray(r.items)) throw new Error(`finance_admin_owed : réponse inattendue ${JSON.stringify(data).slice(0, 200)}`);
        return NextResponse.json({
            kind, page, pageSize: PAGE_SIZE, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
            items: (r.items as Array<Record<string, unknown>>).map((x) => owedLine(x, kind)),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return apiFailure('GET /api/admin/finance/owed', err, { message: 'Détail du montant dû momentanément indisponible.', code: 'FINANCE_OWED_UNAVAILABLE' });
    }
}
