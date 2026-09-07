import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/events/[id]/shifts
 * Liste les sessions de caisse (shifts) associées à un événement pour le partenaire.
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (!serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const resolvedParams = await Promise.resolve(context?.params);
        const eventId = resolvedParams?.id;
        if (!eventId) {
            return NextResponse.json({ error: 'ID événement manquant.' }, { status: 400 });
        }

        const shifts = await ShiftService.getEventShifts(
            eventId,
            serverHasRole(user, 'PARTENAIRE') ? user.id : undefined
        );

        return NextResponse.json({
            success: true,
            shifts,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne.';
        console.error('[API partner shifts GET]', msg);
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
