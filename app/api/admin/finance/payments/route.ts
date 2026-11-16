import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { PAGE_SIZE, parsePage, paymentLine } from '@/lib/finance/admin-lists';
import { ENCASHED_PAYMENT_STATUSES } from '@/lib/finance/payment-labels';
import { resolvePeriod } from '@/lib/finance/period';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/payments?period=…[&from&to]&status=ALL|SUCCESS|PARTIAL|REFUND_PENDING|REFUNDED&page=N
 * Finition 3a (E-30, E-31) — liste des paiements encaissés de la période, paginée par le serveur (20 par page, du plus
 * récent au plus ancien), permission payments.read. Le filtre de statut ne touche que cette liste. Le statut est rendu
 * en code : l'écran l'affiche par son libellé (lib/finance/payment-labels.ts). Ce qui revient à Event Village sur chaque
 * paiement est calculé ici (lib/finance/admin-lists.ts, paymentLine), jamais dans le navigateur.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'payments.read' });
    if (!auth.authorized) return auth.errorResponse!;

    const sp = req.nextUrl.searchParams;
    const resolved = resolvePeriod({ period: sp.get('period'), from: sp.get('from'), to: sp.get('to') });
    if (!resolved.ok) return NextResponse.json({ error: resolved.error, code: 'INVALID_PERIOD' }, { status: 400 });
    const status = (sp.get('status') ?? 'ALL').trim() || 'ALL';
    if (status !== 'ALL' && !(ENCASHED_PAYMENT_STATUSES as readonly string[]).includes(status)) {
        return NextResponse.json({ error: 'Statut de paiement inconnu.', code: 'INVALID_STATUS' }, { status: 400 });
    }
    const page = parsePage(sp.get('page'));
    if (page === null) return NextResponse.json({ error: 'Numéro de page invalide.', code: 'INVALID_PAGE' }, { status: 400 });

    try {
        const { data, error } = await getServiceRoleClient().rpc('finance_admin_payments', {
            p: { from: resolved.period.from, to: resolved.period.to, status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
        });
        if (error) throw new Error(`finance_admin_payments : ${error.code ?? ''} ${error.message}`);
        const r = (data ?? {}) as { total?: unknown; items?: unknown };
        const total = Number(r.total);
        if (!Number.isInteger(total) || !Array.isArray(r.items)) throw new Error(`finance_admin_payments : réponse inattendue ${JSON.stringify(data).slice(0, 200)}`);
        return NextResponse.json({
            period: resolved.period, status, page, pageSize: PAGE_SIZE, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), items: (r.items as Array<Record<string, unknown>>).map(paymentLine),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        return apiFailure('GET /api/admin/finance/payments', err, { message: 'Liste des paiements momentanément indisponible.', code: 'FINANCE_PAYMENTS_UNAVAILABLE' });
    }
}
