import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/controller/shifts/active?event_id=...
 * Récupère la session de caisse active (OUVERT) du contrôleur pour un événement donné.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get('event_id');
        if (!eventId) {
            return NextResponse.json({ error: 'event_id requis.' }, { status: 400 });
        }

        const shift = await ShiftService.getActiveShift(user.id, eventId);

        return NextResponse.json({
            success: true,
            shift,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne.';
        console.error('[API controller/shifts/active GET]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
