import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PublicError } from '@/lib/api/public-error';
import { adminAddFeatured, adminListFeatured } from '@/lib/events/featured.server';
import { featuredFailure, guardFeatured, NO_STORE, optionalDate, readBody, reasonField, UUID_RE } from './_shared';

export const dynamic = 'force-dynamic';

const AddSchema = z.object({
    event_id: z.string().regex(UUID_RE, 'Choisissez un événement dans la liste.'),
    starts_at: optionalDate,
    ends_at: optionalDate,
    reason: reasonField,
    label: z.enum(['A_LA_UNE', 'SPONSORISE'], { message: 'Étiquette inconnue.' }).optional(),
}).strict();

/**
 * GET /api/admin/a-la-une — design 1b : la une de l'accueil pour le super-administrateur : placements actifs dans l'ordre (avec
 * l'état d'affichage), historique des retraits, journal des actions (qui, quand, quoi, motif).
 */
export async function GET(req: NextRequest) {
    const guard = await guardFeatured(req, { write: false });
    if (!guard.ok) return guard.response;
    try {
        const list = await adminListFeatured(guard.actorId);
        return NextResponse.json(list, { headers: NO_STORE });
    } catch (err) {
        return featuredFailure('GET /api/admin/a-la-une', err, { message: 'La une n’a pas pu être chargée. Réessayez dans un instant.', code: 'FEATURED_UNAVAILABLE' });
    }
}

/**
 * POST /api/admin/a-la-une — ajoute un événement publié non terminé à la fin de la une.
 * Corps `{ event_id, starts_at?, ends_at?, reason, label? }` ; dates ISO avec fuseau, facultatives, bornées par la fin de
 * l'événement ; motif obligatoire ; étiquette « Sponsorisé » refusée tant qu'elle n'est pas ouverte. Mot de passe et code
 * administrateur exigés (fenêtre de confirmation de l'écran), tout est revérifié et journalisé en base.
 */
export async function POST(req: NextRequest) {
    const guard = await guardFeatured(req, { write: true });
    if (!guard.ok) return guard.response;
    try {
        const body = await readBody(req, AddSchema);
        const done = await adminAddFeatured(guard.identity!, {
            eventId: body.event_id, startsAt: body.starts_at ?? null, endsAt: body.ends_at ?? null, reason: body.reason, label: body.label,
        });
        if (!done.id) throw new PublicError('L’événement n’a pas pu être ajouté. Réessayez.', 'FEATURED_ADD_FAILED', 500);
        return NextResponse.json({ ok: true, id: done.id, sort_order: done.sort_order }, { status: 201, headers: NO_STORE });
    } catch (err) {
        return featuredFailure('POST /api/admin/a-la-une', err, { message: 'L’événement n’a pas pu être ajouté. Réessayez dans un instant.', code: 'FEATURED_ADD_FAILED' });
    }
}
