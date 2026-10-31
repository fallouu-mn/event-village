import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { asShiftRefusal, ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

const ShiftId = z.string().uuid();

/**
 * GET /api/controller/shifts/[id]/summary — ticket Z d'une session de caisse (lot 4.7).
 * Lisible par son contrôleur, le partenaire propriétaire de l'événement ou un admin ; 404 pour tout
 * autre compte (aucune donnée de caisse, existence non révélée).
 */
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;

    const { id } = await Promise.resolve(context.params);
    if (!ShiftId.safeParse(id).success) {
        return NextResponse.json({ error: 'Session de caisse introuvable.', code: 'SHIFT_NOT_FOUND' }, { status: 404 });
    }

    try {
        const summary = await ShiftService.getShiftSummary(id, { id: session.user.id, isAdmin: serverIsAdmin(session.user) });
        return NextResponse.json({ success: true, summary });
    } catch (err: unknown) {
        const refusal = asShiftRefusal(err);
        if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
        console.error('[API controller/shifts/[id]/summary GET]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Lecture du ticket Z momentanément impossible.', code: 'SHIFT_READ_FAILED' }, { status: 500 });
    }
}
