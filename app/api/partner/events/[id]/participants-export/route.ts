import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import {
    errorResponse, exportFileName, exportParticipants, participantsCsv, routeParam, UUID_RE, type RouteParams,
} from '@/lib/events/pilotage.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    includeContacts: z.boolean(),
    purpose: z.string().max(60).optional().nullable(),
}).strict();

/**
 * POST /api/partner/events/[id]/participants-export — lot 5 (contrat I, décision du 31/10 : liste fermée).
 * Corps `{ includeContacts, purpose? }`. Partenaire propriétaire (compte ACTIF) ou admin, sinon 404.
 * Fichier CSV UTF-8 avec BOM : nom, catégorie, origine, statut du billet, heure d'entrée (Dakar), zone et porte
 * (lot 9 ter, 9t.18) ; téléphone et
 * email seulement avec `includeContacts` et une finalité URGENT_EVENT_INFO ou SAFETY_AND_RECEPTION, sinon
 * 400 PURPOSE_REQUIRED. Aucune donnée de paiement, aucun numéro de billet. Chaque export est journalisé
 * (participant_exports) par la RPC, dans la même transaction que la lecture : sans journal, pas de fichier.
 */
export async function POST(request: NextRequest, ctx: RouteParams<{ id: string }>) {
    const session = await requireActiveSession(request);
    if (session.response) return session.response;
    const eventId = await routeParam(ctx, 'id');
    if (!UUID_RE.test(eventId)) {
        return NextResponse.json({ error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' }, { status: 404 });
    }

    let raw: unknown;
    try {
        raw = await request.json();
    } catch {
        return NextResponse.json({ error: 'Corps de requête illisible (JSON attendu).', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json({
            error: 'Données invalides : indiquez si les contacts sont inclus (includeContacts) et, dans ce cas, la finalité.',
            code: 'INVALID_BODY',
        }, { status: 400 });
    }

    try {
        const purpose = parsed.data.purpose ? parsed.data.purpose.trim() : null;
        const exp = await exportParticipants(eventId, session.user.id, parsed.data.includeContacts, purpose || null);
        return new NextResponse(participantsCsv(exp), {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${exportFileName(exp.title)}"`,
                'Cache-Control': 'no-store',
                'X-Export-Id': exp.exportId,
            },
        });
    } catch (err) {
        return errorResponse(err, 'POST /api/partner/events/[id]/participants-export',
            'Export des participants impossible pour le moment.', 'EXPORT_FAILED');
    }
}
