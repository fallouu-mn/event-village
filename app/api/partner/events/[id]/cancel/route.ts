import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { EventCancellationService } from '@/lib/events/event-cancellation.service';
import { getServerSessionUser, serverHasRole } from '@/lib/auth/session';

const cancelEventSchema = z.object({
    internalReason: z.string().min(3, 'Le motif de l\'annulation doit comporter au moins 3 caractères.'),
    publicNotice: z.string().optional().default(''),
});

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await getServerSessionUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        if (!serverHasRole(user, 'PARTENAIRE') && !serverHasRole(user, 'ADMIN') && !serverHasRole(user, 'SUPERADMIN')) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const body = await request.json();
        const parseResult = cancelEventSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json({ error: 'Données invalides', details: parseResult.error.flatten() }, { status: 400 });
        }

        const { internalReason, publicNotice } = parseResult.data;

        const result = await EventCancellationService.cancelEvent(
            params.id,
            user.id,
            user.role || 'PARTENAIRE',
            internalReason,
            publicNotice
        );

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[Partner Event Cancellation] Error:', error);
        if (error.message?.includes('Non autorisé')) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        if (error.message?.includes('déjà été annulé')) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        if (error.message?.includes('Impossible d\'annuler') || error.message?.includes('introuvable')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: error.message || 'Erreur interne du serveur' }, { status: 500 });
    }
}
