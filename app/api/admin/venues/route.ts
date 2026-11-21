import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { adminVenues } from '@/lib/tables/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/venues?status=EN_ATTENTE_VALIDATION|VALIDEE|REFUSEE|SUSPENDUE&q=&page= — file de validation des
 * établissements (restaurants, bars, espaces). Lot 11b (point 3) : droit halls.validate (« Valider les salles et les
 * établissements ») ou Superadmin, code administrateur ; sans interrupteur (l'administration prépare les établissements
 * avant l'ouverture du service). En attente : les plus anciens envois d'abord. Sans les contacts de la partenaire.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'halls.validate' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const sp = req.nextUrl.searchParams;
        const page = Number(sp.get('page') ?? '1');
        const result = await adminVenues({
            status: sp.get('status') ?? 'EN_ATTENTE_VALIDATION',
            q: sp.get('q'),
            page: Number.isInteger(page) && page > 0 ? page : 1,
        });
        return NextResponse.json({ success: true, ...result });
    } catch (err: unknown) {
        if (err instanceof PublicError) return NextResponse.json({ success: false, error: err.message, code: err.code }, { status: 400 });
        return apiFailure('GET /api/admin/venues', err, { message: 'Établissements momentanément indisponibles.', code: 'VENUES_UNAVAILABLE', status: 500 });
    }
}
