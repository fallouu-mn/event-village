import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PublicError } from '@/lib/api/public-error';
import { adminRemoveFeatured, adminSetFeaturedWindow } from '@/lib/events/featured.server';
import { featuredFailure, guardFeatured, NO_STORE, optionalDate, readBody, reasonField, UUID_RE } from '../_shared';

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

const WindowSchema = z.object({
    starts_at: optionalDate,
    ends_at: optionalDate,
    reason: reasonField,
}).strict();

const RemoveSchema = z.object({ reason: reasonField }).strict();

async function placementId(context: Context): Promise<string> {
    const { id } = await context.params;
    if (typeof id !== 'string' || !UUID_RE.test(id)) throw new PublicError('Cet événement n’est plus à la une.', 'NOT_FOUND', 404);
    return id;
}

/**
 * PATCH /api/admin/a-la-une/[id] — dates d'affichage d'un placement : `{ starts_at?, ends_at?, reason }` (null ou absent :
 * dès maintenant / jusqu'à la fin de l'événement). Mot de passe et code administrateur exigés ; journal
 * HOME_FEATURED_WINDOW_SET (dates avant et après, motif).
 */
export async function PATCH(req: NextRequest, context: Context) {
    const guard = await guardFeatured(req, { write: true });
    if (!guard.ok) return guard.response;
    try {
        const id = await placementId(context);
        const body = await readBody(req, WindowSchema);
        const done = await adminSetFeaturedWindow(guard.identity!, id, {
            startsAt: body.starts_at ?? null, endsAt: body.ends_at ?? null, reason: body.reason,
        });
        return NextResponse.json({ ok: true, ...done }, { headers: NO_STORE });
    } catch (err) {
        return featuredFailure('PATCH /api/admin/a-la-une/[id]', err, { message: 'Les dates n’ont pas pu être enregistrées. Réessayez dans un instant.', code: 'FEATURED_WINDOW_FAILED' });
    }
}

/**
 * DELETE /api/admin/a-la-une/[id] — retire un événement de la une : `{ reason }`. Mot de passe et code administrateur
 * exigés ; le placement reste dans l'historique ; journal HOME_FEATURED_REMOVED (motif).
 */
export async function DELETE(req: NextRequest, context: Context) {
    const guard = await guardFeatured(req, { write: true });
    if (!guard.ok) return guard.response;
    try {
        const id = await placementId(context);
        const body = await readBody(req, RemoveSchema);
        const done = await adminRemoveFeatured(guard.identity!, id, body.reason);
        return NextResponse.json({ ok: true, id: done.id }, { headers: NO_STORE });
    } catch (err) {
        return featuredFailure('DELETE /api/admin/a-la-une/[id]', err, { message: 'L’événement n’a pas pu être retiré. Réessayez dans un instant.', code: 'FEATURED_REMOVE_FAILED' });
    }
}
