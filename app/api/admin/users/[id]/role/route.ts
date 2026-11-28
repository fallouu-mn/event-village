import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { requireAdminIdentity } from '@/lib/admin/identity-check';
import { staffPromotionConfirmText } from '@/lib/auth/staff-account';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/admin/users/[id]/role';
const FALLBACK = { message: 'Le rôle n’a pas pu être changé. Réessayez dans un instant.', code: 'ROLE_CHANGE_FAILED' };
const NO_STORE = { 'Cache-Control': 'no-store' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BodySchema = z.object({
    role: z.enum(['CLIENT', 'ADMIN', 'SUPERADMIN'], { message: 'Rôle inconnu : client, administrateur ou super-administrateur.' }),
    reason: z.string().trim().min(3, 'Indiquez le motif (3 caractères au moins).').max(500, 'Le motif est limité à 500 caractères.'),
    confirm_staff_promotion: z.boolean().optional(),
}).strict();

/** Refus de admin_role_change : statut HTTP ; le texte vient de la base. */
const REFUSALS: Readonly<Record<string, number>> = {
    INVALID_INPUT: 400,
    INVALID_ROLE: 400,
    REASON_REQUIRED: 400,
    SUPERADMIN_ONLY: 403,
    FORBIDDEN: 403,
    PASSWORD_CONFIRMATION_REQUIRED: 403,
    ADMIN_CODE_CONFIRMATION_REQUIRED: 403,
    USER_NOT_FOUND: 404,
    SELF_ROLE_CHANGE: 409,
    NO_CHANGE: 409,
    TRANSITION_NOT_ALLOWED: 409,
    PARTNER_ACCOUNT: 409,
    ACCOUNT_NOT_ACTIVE: 409,
    LAST_SUPERADMIN: 409,
    CONTROLLER_HAS_OPEN_SHIFT: 409,
    ROLE_SCREEN_REQUIRED: 409,
};

type Reply = { ok?: boolean; code?: string; message?: string; organizers?: number; role_before?: string; role_after?: string; before?: string[]; after?: string[]; sessions_revoked?: number } | null;

/**
 * POST /api/admin/users/[id]/role — finition 3d (point 3) : changer le rôle d'un compte, SUPERADMIN seulement.
 * Corps `{ role: CLIENT | ADMIN | SUPERADMIN, reason, confirm_staff_promotion? }`. Permis : client → ADMIN, ADMIN → client,
 * ADMIN → SUPERADMIN, SUPERADMIN → ADMIN. Mot de passe et code administrateur saisis depuis moins de 10 minutes
 * (requireAdminIdentity, revérifiés en base) ; motif obligatoire ; tout le reste en base, dans une transaction
 * (admin_role_change : dernier SUPERADMIN, retrait des équipes de contrôle, droits et sessions retirés, alerte aux
 * SUPERADMIN, journal ADMIN_ROLE_CHANGED).
 *  - 200 `{ requires_confirmation, code: STAFF_PROMOTION_CONFIRMATION, message, organizers }` : contrôleur promu, rien n'a
 *    changé ; l'écran montre la confirmation de la finition 1 puis renvoie avec `confirm_staff_promotion: true`.
 *  - 200 `{ ok, role_before, role_after, roles, sessions_revoked }` : fait (l'écran ne dit « fait » que sur cette réponse).
 *  - 400, 403, 404, 409 : refus en français ; 503 : vérification impossible.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    if (!auth.user!.roles.includes('SUPERADMIN')) {
        return NextResponse.json({ error: 'Seul un super-administrateur change le rôle d’un compte.', code: 'SUPERADMIN_ONLY' }, { status: 403, headers: NO_STORE });
    }
    const identity = await requireAdminIdentity(req, auth.user!.id);
    if (!identity.ok) return identity.response;
    try {
        const { id } = await context.params;
        if (typeof id !== 'string' || !UUID_RE.test(id)) throw new PublicError('Compte introuvable.', 'USER_NOT_FOUND', 404);
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw new PublicError('Demande illisible. Rechargez la page, puis réessayez.', 'INVALID_BODY', 400);
        }
        const parsed = BodySchema.safeParse(body);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            const code = issue?.path[0] === 'reason' ? 'REASON_REQUIRED' : 'INVALID_INPUT';
            throw new PublicError(issue?.message ?? 'Demande invalide.', code, 400);
        }
        const { data, error } = await getServiceRoleClient().rpc('admin_role_change', {
            p: {
                actor_id: auth.user!.id, user_id: id, role: parsed.data.role, reason: parsed.data.reason,
                confirm_staff_promotion: parsed.data.confirm_staff_promotion === true,
                session_id: identity.sessionId, device_key: identity.deviceKey,
            },
        });
        if (error) throw new Error(`admin_role_change : ${error.code ?? ''} ${error.message}`);
        const reply = data as Reply;
        if (!reply) throw new Error('admin_role_change : réponse vide');
        if (reply.code === 'STAFF_PROMOTION_CONFIRMATION') {
            const organizers = Number(reply.organizers ?? 0);
            return NextResponse.json({
                requires_confirmation: true, code: 'STAFF_PROMOTION_CONFIRMATION', message: staffPromotionConfirmText(organizers), organizers,
            }, { headers: NO_STORE });
        }
        if (reply.ok !== true) {
            const status = REFUSALS[String(reply.code)];
            if (!status || typeof reply.message !== 'string') throw new Error(`admin_role_change : refus inattendu ${JSON.stringify(reply)}`);
            throw new PublicError(reply.message, String(reply.code), status);
        }
        return NextResponse.json({
            ok: true, role_before: reply.role_before, role_after: reply.role_after, roles: reply.after ?? [], sessions_revoked: reply.sessions_revoked ?? 0,
        }, { headers: NO_STORE });
    } catch (err) {
        return apiFailure(CONTEXT, err, FALLBACK);
    }
}
