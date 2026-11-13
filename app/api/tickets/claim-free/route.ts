import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, requireVerifiedPhone } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { reserveQuota } from '@/lib/security/quota';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ClaimFreeSchema = z.object({
    categoryId: z.string().uuid(),
    quantity: z.number().int().min(1).max(50),
});

/**
 * POST /api/tickets/claim-free — billets gratuits (lot 2.6) : contrôles partagés et limite par
 * compte et par catégorie (max_per_order, billets déjà détenus compris) appliqués dans une seule
 * transaction (free_tickets_claim) ; demandes limitées par compte (quota en base). Lot 6 : la
 * confirmation part par la boîte d'envoi (même transaction que l'émission).
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    // Lot 9 quater (A2 : AUD-03, G-36) : numéro prouvé par un code SMS exigé avant toute action qui donne quelque chose
    const unverified = requireVerifiedPhone(session.user);
    if (unverified) return unverified;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
    }
    const parsed = ClaimFreeSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { categoryId, quantity } = parsed.data;
    const userId = session.user.id;
    try {
        const quota = await reserveQuota([{ scope: 'claim_free_user', bucket: userId, windowSecs: 3600, max: getServerEnv().CLAIM_FREE_PER_USER_HOUR }], 'billets gratuits');
        if (!quota.allowed) {
            return quota.reason === 'EXCEEDED'
                ? NextResponse.json({ error: 'Trop de demandes : réessayez plus tard.', code: 'CLAIM_RATE_LIMITED', retryAfterSeconds: quota.retryAfterSeconds }, { status: 429 })
                : NextResponse.json({ error: 'Service momentanément indisponible.' }, { status: 503 });
        }
        const { data: cat, error: catErr } = await getServiceRoleClient().from('ticket_categories').select('id, event_id').eq('id', categoryId).maybeSingle();
        if (catErr) throw new Error(`lecture de la catégorie : ${catErr.message}`);
        if (!cat) return NextResponse.json({ error: 'Catégorie introuvable.' }, { status: 404 });

        const { data, error } = await rpcWithRetry<{ ok: boolean; code?: string; message?: string; problems?: Array<{ code: string; message: string }>; ticket_ids?: string[] }>('free_tickets_claim', {
            p_user_id: userId, p_event_id: cat.event_id, p_items: [{ category_id: categoryId, quantity }],
        });
        if (error || !data) throw new Error(`émission des billets gratuits : ${error?.message}`);
        if (!data.ok) {
            if (data.code === 'NOT_FREE') return NextResponse.json({ error: data.message, code: data.code }, { status: 400 });
            if (data.code === 'FREE_LIMIT_REACHED') return NextResponse.json({ error: data.message, code: data.code }, { status: 409 });
            const onlyStock = (data.problems ?? []).every((p) => p.code === 'INSUFFICIENT_STOCK');
            return NextResponse.json({ error: (data.problems ?? []).map((p) => p.message).join(' '), code: onlyStock ? 'INSUFFICIENT_STOCK' : 'SALE_CHECK_FAILED', problems: data.problems }, { status: onlyStock ? 409 : 400 });
        }
        const ticketIds = data.ticket_ids ?? [];
        const { data: tickets, error: tErr } = await getServiceRoleClient().from('tickets').select('id, ticket_number').in('id', ticketIds);
        if (tErr) console.error('[claim-free] lecture des billets émis impossible :', tErr.message);
        // Lot 6 (J1.2, J1.5) : confirmation (SMS compté sur le compte qui réclame) et épuisement de la
        // catégorie mis en file dans la transaction de free_tickets_claim ; aucun envoi depuis la route.
        return NextResponse.json({ success: true, ticket_ids: ticketIds, tickets: tickets ?? [] });
    } catch (err) {
        console.error('[API /api/tickets/claim-free] erreur interne :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}
