import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { UNCONFIRMED_PAYMENT_WINDOW_HOURS } from '@/lib/finance/admin-summary';
import { isSimulationRun } from '@/lib/integrations/simulation';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Line = { visible: false } | { visible: true; unavailable: true } | { visible: true; unavailable: false; count: number; amount: number };

/**
 * GET /api/admin/finance/waiting — finition 3a (E-07) : bloc « Argent qui attend » de l'accueil de l'administration.
 * Trois lignes, chacune montrée seulement avec sa permission :
 *  - versements à reprendre (refunds.manage) : même liste que « Versements à reprendre » de la page Finance ;
 *  - remboursements à verser (refunds.manage ou payments.read) ;
 *  - créances (payments.read).
 * Une lecture en échec rend « unavailable » sur chaque ligne visible (l'écran dit « Compteur indisponible »), jamais 0.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    const perms = auth.permissions ?? [];
    const show = {
        toResume: perms.includes('refunds.manage'),
        refundsToPay: perms.includes('refunds.manage') || perms.includes('payments.read'),
        debts: perms.includes('payments.read'),
    };
    const hidden: Line = { visible: false };
    if (!show.toResume && !show.refundsToPay && !show.debts) {
        return NextResponse.json({ lines: { toResume: hidden, refundsToPay: hidden, debts: hidden } }, { headers: { 'Cache-Control': 'no-store' } });
    }

    let data: Record<string, Record<string, unknown>> | null = null;
    const { data: raw, error } = await getServiceRoleClient().rpc('finance_admin_waiting', {
        p_simulated: isSimulationRun(),
        p_unconfirmed_hours: UNCONFIRMED_PAYMENT_WINDOW_HOURS,
    });
    if (error) console.error('[GET /api/admin/finance/waiting] lecture impossible :', error.message);
    else data = raw as Record<string, Record<string, unknown>> | null;

    const line = (visible: boolean, key: string): Line => {
        if (!visible) return hidden;
        const b = data?.[key];
        const count = Number(b?.count);
        const amount = Number(b?.amount);
        if (!b || !Number.isInteger(count) || !Number.isFinite(amount)) return { visible: true, unavailable: true };
        return { visible: true, unavailable: false, count, amount };
    };
    return NextResponse.json({
        lines: {
            toResume: line(show.toResume, 'to_resume'),
            refundsToPay: line(show.refundsToPay, 'refunds_to_pay'),
            debts: line(show.debts, 'debts'),
        },
    }, { headers: { 'Cache-Control': 'no-store' } });
}
