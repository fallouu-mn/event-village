import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/admin/events/[id]/cash-refunds/[paymentId]';
const FALLBACK = { message: 'Le marquage est momentanément impossible. Réessayez dans un instant.', code: 'CASH_REFUND_MARK_FAILED' };
const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
    reason: z.string().trim().min(3, 'Indiquez le motif (3 caractères au moins).').max(500, 'Le motif est limité à 500 caractères.'),
}).strict();

/** Refus de event_cash_refund_mark_admin : texte français écrit par la base, statut HTTP. */
const REFUSALS: Record<string, number> = {
    FORBIDDEN: 403,
    REASON_REQUIRED: 400,
    INVALID_INPUT: 400,
    EVENT_NOT_FOUND: 404,
    PAYMENT_NOT_FOUND: 404,
    EVENT_NOT_CANCELLED: 409,
};

type Reply = { ok?: boolean; code?: string; message?: string; mark?: unknown } | null;

/**
 * POST /api/admin/events/[id]/cash-refunds/[paymentId] — finition 3d (point 4a). Un admin muni de refunds.manage marque
 * rendues les espèces d'une vente au guichet d'un événement annulé, à la place de l'organisatrice, à tout moment (fiche
 * suspendue comprise), avec un motif obligatoire `{ reason }` (3 à 500 caractères). La base revérifie le droit, pose la
 * marque, journalise (CASH_REFUND_MARKED, rôle de l'admin, motif) et prévient l'organisatrice (cloche, push, email), dans
 * une transaction (event_cash_refund_mark_admin). Le client ne reçoit rien de plus que si l'organisatrice avait marqué.
 * 200 { ok, mark } ; 200 { ok, code: ALREADY_MARKED, mark } ; 400 ; 403 ; 404 ; 409 EVENT_NOT_CANCELLED.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string; paymentId: string }> }) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'refunds.manage' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id, paymentId } = await context.params;
        if (typeof id !== 'string' || !UUID_RE.test(id)) throw new PublicError('Événement introuvable.', 'EVENT_NOT_FOUND', 404);
        if (typeof paymentId !== 'string' || !UUID_RE.test(paymentId)) {
            throw new PublicError('Vente introuvable dans la liste des espèces à rembourser.', 'PAYMENT_NOT_FOUND', 404);
        }
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw new PublicError('Demande illisible : corps JSON attendu.', 'INVALID_BODY', 400);
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            const code = issue?.path[0] === 'reason' ? 'REASON_REQUIRED' : 'INVALID_INPUT';
            throw new PublicError(issue?.message ?? 'Motif invalide.', code, 400);
        }

        const { data, error } = await getServiceRoleClient().rpc('event_cash_refund_mark_admin', {
            p: { event_id: id, payment_id: paymentId, actor_id: auth.user!.id, reason: parsed.data.reason },
        });
        if (error) throw new Error(`event_cash_refund_mark_admin : ${error.code ?? ''} ${error.message}`);
        const reply = data as Reply;
        if (!reply) throw new Error('event_cash_refund_mark_admin : réponse vide');
        if (reply.ok !== true) {
            const status = REFUSALS[String(reply.code)];
            if (!status) throw new Error(`event_cash_refund_mark_admin : refus inattendu ${JSON.stringify(reply)}`);
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
