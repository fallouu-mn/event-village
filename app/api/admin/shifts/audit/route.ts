import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/shifts/audit — vue consolidée (admin) des écarts de caisse constatés, tous partenaires
 * confondus, pour repérer les écarts récurrents d'un contrôleur.
 * Lot 7 (7.0 c, contrat 3.7) : permission dédiée shifts.read (le SUPERADMIN a toutes les permissions) ;
 * compte ACTIF exigé par verifyAdminAuth (D18).
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'shifts.read' });
    if (!auth.authorized) {
        return auth.errorResponse ?? NextResponse.json({ error: 'Accès réservé aux administrateurs.' }, { status: 403 });
    }

    try {
        const discrepancies = await ShiftService.getConsolidatedDiscrepancies();
        return NextResponse.json({ success: true, total_discrepancies: discrepancies.length, discrepancies });
    } catch (err: unknown) {
        console.error('[API admin/shifts/audit GET]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Lecture des écarts de caisse momentanément impossible.', code: 'SHIFT_READ_FAILED' }, { status: 500 });
    }
}
