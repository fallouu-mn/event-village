import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { adminHalls } from '@/lib/halls/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/halls?status=EN_ATTENTE_VALIDATION|VALIDEE|REFUSEE|SUSPENDUE&q=&page= — file de validation des salles.
 * Lot 10b (point 4) : droit halls.validate (« Valider les salles et les établissements ») ou Superadmin, code
 * administrateur ; sans interrupteur (l'administration prépare les salles avant l'ouverture du service). Salles en
 * attente : les plus anciennes d'abord. Colonnes de la fiche et nom de la partenaire, sans ses contacts (détail).
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'halls.validate' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const sp = req.nextUrl.searchParams;
        const page = Number(sp.get('page') ?? '1');
        const result = await adminHalls({
            status: sp.get('status') ?? 'EN_ATTENTE_VALIDATION',
            q: sp.get('q'),
            page: Number.isInteger(page) && page > 0 ? page : 1,
        });
        return NextResponse.json({ success: true, ...result });
    } catch (err: unknown) {
        if (err instanceof PublicError) return NextResponse.json({ success: false, error: err.message, code: err.code }, { status: 400 });
        return apiFailure('GET /api/admin/halls', err, { message: 'Salles momentanément indisponibles.', code: 'HALLS_UNAVAILABLE', status: 500 });
    }
}
