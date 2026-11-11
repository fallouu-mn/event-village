import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/partner/events/[id]/cash-refunds/[paymentId]';
const FALLBACK = { message: 'Le marquage est momentanément impossible. Réessayez dans un instant.', code: 'CASH_REFUND_MARK_FAILED' };
const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
    note: z.string().trim().max(500, 'La note est limitée à 500 caractères.').optional().nullable(),
});

/** Refus de event_cash_refund_mark (M06) : texte français écrit par la RPC, statut HTTP du contrat 4.1. */
const REFUSALS: Record<string, number> = {
    EVENT_NOT_FOUND: 404,
    PAYMENT_NOT_FOUND: 404,
    FORBIDDEN: 403,
    ACCOUNT_NOT_ACTIVE: 403,
    EVENT_NOT_CANCELLED: 409,
    INVALID_INPUT: 400,
};

type Reply = { ok?: boolean; code?: string; message?: string; mark?: unknown } | null;

/**
 * POST /api/partner/events/[id]/cash-refunds/[paymentId] — lot 9 bis (R20, B22, contrat 4.1). La propriétaire de
 * l'événement annulé coche « Remboursé » sur une vente au guichet dont elle a rendu les espèces : marque définitive,
 * journalisée (CASH_REFUND_MARKED) dans la transaction de event_cash_refund_mark. Un second appel rend 200
 * ALREADY_MARKED et la marque existante. Un admin lit la liste sans la cocher (403) ; un tiers reçoit 404.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string; paymentId: string }> | { id: string; paymentId: string } }) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        const { id, paymentId } = await Promise.resolve(context.params);
        if (typeof id !== 'string' || !UUID_RE.test(id)) throw new PublicError('Événement introuvable.', 'EVENT_NOT_FOUND', 404);
        if (typeof paymentId !== 'string' || !UUID_RE.test(paymentId)) {
            throw new PublicError('Vente introuvable dans la liste des espèces à rembourser.', 'PAYMENT_NOT_FOUND', 404);
        }

        const raw = await req.text();
        let body: unknown = {};
        if (raw.trim() !== '') {
            try {
                body = JSON.parse(raw);
            } catch (parseErr) {
                console.error(`[${CONTEXT}] corps illisible :`, parseErr instanceof Error ? parseErr.message : String(parseErr));
                throw new PublicError('Corps JSON invalide.', 'INVALID_BODY', 400);
            }
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) throw new PublicError(parsed.error.errors[0]?.message ?? 'Note invalide.', 'INVALID_INPUT', 400);

        const { data, error } = await getServiceRoleClient().rpc('event_cash_refund_mark', {
            p: { event_id: id, payment_id: paymentId, actor_id: session.user.id, note: parsed.data.note ?? null },
        });
        if (error) throw new Error(`event_cash_refund_mark : ${error.code ?? ''} ${error.message}`);
        const reply = data as Reply;
        if (!reply) throw new Error('event_cash_refund_mark : réponse vide');
        if (reply.ok !== true) {
            const status = REFUSALS[String(reply.code)];
            if (!status) throw new Error(`event_cash_refund_mark : refus inattendu ${JSON.stringify(reply)}`);
            throw new PublicError(String(reply.message ?? 'Marquage refusé.'), String(reply.code), status);
        }
        return NextResponse.json(
            reply.code === 'ALREADY_MARKED'
                ? { ok: true, code: 'ALREADY_MARKED', message: reply.message, mark: reply.mark }
                : { ok: true, mark: reply.mark },
            { headers: NO_STORE },
        );
    } catch (err) {
        return apiFailure(CONTEXT, err, FALLBACK);
    }
}
