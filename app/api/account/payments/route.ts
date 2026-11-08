import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { noStore } from '@/lib/auth/account-sync';
import { requireActiveSession } from '@/lib/auth/session';
import { isSimulationRun } from '@/lib/integrations/simulation';
import { paymentOperatorLabel, paymentStatusLabel, paymentTargetLabel } from '@/lib/payments/payment-labels';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
const PAGE_FORMAT = /^[1-9][0-9]{0,8}$/;

interface PaymentRow {
    id: string;
    created_at: string;
    amount: number;
    refunded_amount: number;
    operator: string | null;
    is_platform_payment: boolean;
    status: string;
    target: string;
    event_title: string | null;
}

interface PaymentsReply {
    items: PaymentRow[];
    total_count: number;
    total_paid: number;
    total_refunded: number;
}

async function handle(req: NextRequest): Promise<NextResponse> {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;

    const rawPage = req.nextUrl.searchParams.get('page');
    if (rawPage !== null && !PAGE_FORMAT.test(rawPage)) {
        return NextResponse.json({ error: 'Numéro de page invalide.', code: 'INVALID_FIELD', field: 'page' }, { status: 400 });
    }
    const page = rawPage === null ? 1 : Number(rawPage);

    try {
        const { data, error } = await getServiceRoleClient().rpc('client_payments_list', {
            p: { user_id: session.user.id, page, page_size: PAGE_SIZE, include_simulated: isSimulationRun() },
        });
        if (error) throw error;
        const reply = data as PaymentsReply;
        return NextResponse.json({
            items: reply.items.map((row) => ({
                id: row.id,
                created_at: row.created_at,
                amount: row.amount,
                refunded_amount: row.refunded_amount,
                operator_label: paymentOperatorLabel(row.operator, row.is_platform_payment),
                status_label: paymentStatusLabel(row.status),
                target_label: paymentTargetLabel(row.target),
                event_title: row.event_title,
            })),
            page,
            page_size: PAGE_SIZE,
            total_count: reply.total_count,
            total_paid: reply.total_paid,
            total_refunded: reply.total_refunded,
        });
    } catch (err) {
        return apiFailure('GET /api/account/payments', err, { message: 'Vos paiements sont momentanément indisponibles. Réessayez dans un instant.', code: 'PAYMENTS_UNAVAILABLE' });
    }
}

/**
 * GET /api/account/payments?page= — Mes paiements (lot 9, 9.2, contrat 4.3, L33). 20 par page, totaux sur tout le filtre.
 * Le compte vient de la session : tout paramètre de compte est ignoré. Libellés faits ici, aucun identifiant technique rendu.
 */
export async function GET(req: NextRequest) {
    return noStore(await handle(req));
}
