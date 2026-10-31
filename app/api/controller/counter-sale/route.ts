import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { normalizePhoneNumber } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    eventId: z.string().uuid(),
    items: z.array(z.object({ categoryId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(10),
    buyerPhone: z.string().trim().min(8).max(20).optional().nullable(),
});

const REFUSAL_STATUS: Record<string, number> = {
    COUNTER_SALE_DISABLED: 403,
    NOT_ASSIGNED: 403,
    NO_CASH_PERMISSION: 403,
    NO_OPEN_SHIFT: 409,
    EVENT_CLOSED: 409,
    SALE_CHECK_FAILED: 409,
    INVALID_ITEMS: 400,
};

/**
 * POST /api/controller/counter-sale — vente au guichet en espèces (lot 4.6, remplace l'ancienne route
 * /api/events/[id]/tickets/purchase). Contrôleur affecté à l'événement avec la permission espèces et
 * une caisse ouverte ; contrôles de vente (catégorie active, stock sous verrou) ; prix facial, aucun
 * frais Event Village (CDC §76) ; paiement hors plateforme rattaché à la caisse ; aucune écriture au
 * grand livre. Le billet va au compte du numéro de l'acheteur s'il existe, sinon au vendeur.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Vente invalide : événement et catégories requis.' }, { status: 400 });

    try {
        let buyerUserId: string | null = null;
        if (parsed.data.buyerPhone) {
            const phone = normalizePhoneNumber(parsed.data.buyerPhone);
            const { data: buyer, error } = await getServiceRoleClient().from('users').select('id').eq('phone', phone).maybeSingle();
            if (error) throw new Error(`recherche de l'acheteur : ${error.message}`);
            buyerUserId = (buyer?.id as string | undefined) ?? null;
        }
        const { data, error } = await rpcWithRetry<Record<string, unknown>>('counter_sale', {
            p: {
                seller_id: session.user.id,
                event_id: parsed.data.eventId,
                items: parsed.data.items.map((i) => ({ category_id: i.categoryId, quantity: i.quantity })),
                buyer_user_id: buyerUserId,
            },
        });
        if (error || !data) throw new Error(`counter_sale : ${error?.message ?? 'réponse vide'}`);
        if (data.ok !== true) {
            const code = String(data.code);
            return NextResponse.json({ error: String(data.message ?? 'Vente refusée.'), ...data }, { status: REFUSAL_STATUS[code] ?? 400 });
        }
        return NextResponse.json(data);
    } catch (err) {
        console.error('[API /api/controller/counter-sale] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Vente momentanément indisponible.' }, { status: 500 });
    }
}
