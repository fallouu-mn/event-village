import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { requireAdminIdentity } from '@/lib/admin/identity-check';
import { FeaturedRefusal, type FeaturedIdentity } from '@/lib/events/featured.server';

/**
 * Design 1b (À LA UNE) — garde commune des routes /api/admin/a-la-une/** :
 *  - verifyAdminAuth : compte actif d'administration, second facteur de l'administration (code SMS sur l'appareil, mot de
 *    passe de la session, 30 minutes d'inactivité) ;
 *  - Superadmin seulement (user_roles), refus 403 SUPERADMIN_ONLY en français ;
 *  - écriture : mot de passe et code administrateur de moins de 10 minutes (requireAdminIdentity, comme les actions
 *    sensibles de la finition 3d), session et appareil transmis à la base qui les revérifie.
 * Les réponses ne sont jamais mises en cache.
 */
export const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Horodatage ISO avec fuseau (Z ou ±HH:MM) : jamais interprété selon le fuseau du serveur. */
const ISO_WITH_ZONE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export const optionalDate = z.union([
    z.string().max(40).regex(ISO_WITH_ZONE_RE, 'Date d’affichage illisible.'),
    z.null(),
]).optional();

/** Motif : la base le nettoie et le borne (3 à 500 caractères, aucun caractère de contrôle) ; ici, une borne large. */
export const reasonField = z.string({ message: 'Indiquez le motif (3 à 500 caractères).' }).max(2000, 'Le motif est limité à 500 caractères.');

export type Guard =
    | { ok: true; actorId: string; identity: FeaturedIdentity | null }
    | { ok: false; response: NextResponse };

export async function guardFeatured(req: NextRequest, opts: { write: boolean }): Promise<Guard> {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return { ok: false, response: auth.errorResponse! };
    if (!auth.user!.roles.includes('SUPERADMIN')) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'Seul un Superadmin choisit les événements à la une.', code: 'SUPERADMIN_ONLY' }, { status: 403, headers: NO_STORE }),
        };
    }
    if (!opts.write) return { ok: true, actorId: auth.user!.id, identity: null };
    const identity = await requireAdminIdentity(req, auth.user!.id);
    if (!identity.ok) return { ok: false, response: identity.response };
    return { ok: true, actorId: auth.user!.id, identity: { actorId: auth.user!.id, sessionId: identity.sessionId, deviceKey: identity.deviceKey } };
}

/** Corps JSON validé par le schéma ; refus 400 en français (le premier problème). */
export async function readBody<T>(req: NextRequest, schema: z.ZodType<T>): Promise<T> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        throw new PublicError('Demande illisible : réessayez depuis la page « À la une ».', 'INVALID_BODY', 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = String(issue?.path[0] ?? '');
        const code = field === 'reason' ? 'REASON_REQUIRED' : field === 'starts_at' || field === 'ends_at' ? 'INVALID_DATE' : 'INVALID_INPUT';
        const message = issue?.code === 'unrecognized_keys' ? 'Demande invalide : champ non accepté.' : issue?.message ?? 'Demande invalide.';
        throw new PublicError(message, code, 400);
    }
    return parsed.data;
}

/** Échec d'une route : refus de la base montré tel quel, panne journalisée avec un message de repli. */
export function featuredFailure(context: string, err: unknown, fallback: { message: string; code: string }): NextResponse {
    const res = err instanceof FeaturedRefusal
        ? apiFailure(context, new PublicError(err.message, err.code, err.status), fallback)
        : apiFailure(context, err, fallback);
    res.headers.set('Cache-Control', 'no-store');
    return res;
}
