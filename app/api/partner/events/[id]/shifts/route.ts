import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsAdmin, serverIsPartner } from '@/lib/auth/session';
import { asShiftRefusal, ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/events/[id]/shifts — sessions de caisse d'un événement, pour son partenaire
 * propriétaire ou un admin (404 sinon). Le haché du PIN régisseur n'est jamais renvoyé.
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès non autorisé.', code: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const { id: eventId } = await Promise.resolve(context.params);
    if (!eventId) {
        return NextResponse.json({ error: 'ID événement manquant.' }, { status: 400 });
    }

    try {
        const shifts = await ShiftService.getEventShifts(eventId, { id: user.id, isAdmin: serverIsAdmin(user) });
        return NextResponse.json({ success: true, shifts });
    } catch (err: unknown) {
        const refusal = asShiftRefusal(err);
        if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
        console.error('[API partner/events/[id]/shifts GET]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Lecture des caisses momentanément impossible.', code: 'SHIFT_READ_FAILED' }, { status: 500 });
    }
}
