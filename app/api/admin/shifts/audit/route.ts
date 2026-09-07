import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser, serverIsAdmin } from '@/lib/auth/session';
import { ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/shifts/audit
 * Vue consolidée Superadmin de tous les écarts de caisse constatés (multi-partenaires).
 * Permet de détecter les patterns de collusion ou de fraude récurrente chez un contrôleur.
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (!serverIsAdmin(user)) {
            return NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
        }

        const discrepancies = await ShiftService.getConsolidatedDiscrepancies();

        return NextResponse.json({
            success: true,
            total_discrepancies: discrepancies.length,
            discrepancies,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne.';
        console.error('[API admin/shifts/audit GET]', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
