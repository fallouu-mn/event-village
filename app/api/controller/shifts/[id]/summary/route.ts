import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/controller/shifts/[id]/summary
 * Récupère les données consolidées du ticket Z de caisse.
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

        const resolvedParams = await Promise.resolve(context?.params);
        const shiftId = resolvedParams?.id;
        if (!shiftId) {
            return NextResponse.json({ error: 'ID de session manquant.' }, { status: 400 });
        }

        const summary = await ShiftService.getShiftSummary(shiftId);

        return NextResponse.json({
            success: true,
            summary,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne.';
        console.error('[API controller/shifts/[id]/summary GET]', msg);
        return NextResponse.json({ error: msg }, { status: 404 });
    }
}
