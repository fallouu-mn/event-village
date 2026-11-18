import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminReorderFeatured } from '@/lib/events/featured.server';
import { featuredFailure, guardFeatured, NO_STORE, readBody, UUID_RE } from '../_shared';

export const dynamic = 'force-dynamic';

const OrderSchema = z.object({
    ids: z.array(z.string().regex(UUID_RE, 'Ordre illisible.')).min(1, 'Ordre illisible.').max(20, 'Ordre illisible.'),
    reason: z.string().max(2000, 'Le motif est limité à 500 caractères.').optional(),
}).strict();

/**
 * POST /api/admin/a-la-une/ordre — nouvel ordre de la une : `{ ids: [identifiants des placements, dans l'ordre], reason? }`.
 * La liste doit être exactement celle des placements actifs (sinon 409 ORDER_STALE : rechargez). Mot de passe et code
 * administrateur exigés ; journal HOME_FEATURED_REORDERED (ordre avant et après).
 */
export async function POST(req: NextRequest) {
    const guard = await guardFeatured(req, { write: true });
    if (!guard.ok) return guard.response;
    try {
        const body = await readBody(req, OrderSchema);
        const done = await adminReorderFeatured(guard.identity!, body.ids, body.reason?.trim() || undefined);
        return NextResponse.json({ ok: true, changed: done.changed, order: done.order }, { headers: NO_STORE });
    } catch (err) {
        return featuredFailure('POST /api/admin/a-la-une/ordre', err, { message: 'L’ordre n’a pas pu être enregistré. Réessayez dans un instant.', code: 'FEATURED_ORDER_FAILED' });
    }
}
