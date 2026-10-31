import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/shifts/audit — vue consolidée (admin) des écarts de caisse constatés, tous partenaires
 * confondus, pour repérer les écarts récurrents d'un contrôleur.
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    if (!serverIsAdmin(session.user)) {
        return NextResponse.json({ error: 'Accès réservé aux administrateurs.', code: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    try {
        const discrepancies = await ShiftService.getConsolidatedDiscrepancies();
        return NextResponse.json({ success: true, total_discrepancies: discrepancies.length, discrepancies });
    } catch (err: unknown) {
        console.error('[API admin/shifts/audit GET]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Lecture des écarts de caisse momentanément impossible.', code: 'SHIFT_READ_FAILED' }, { status: 500 });
    }
}
