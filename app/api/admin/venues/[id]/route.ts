import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { adminVenue } from '@/lib/tables/queries';
import { notFound } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/venues/[id] — fiche de décision d'un établissement (valider, refuser avec motif, suspendre, réactiver) :
 * photos, adresse et position, horaires, zones et tables, acompte, confirmation, créneau, nombre de réservations à
 * venir, historique. Lot 11b (point 3) : droit halls.validate ou Superadmin ; téléphone et email de la partenaire
 * seulement avec partners.read (comme les salles, T2 du lot 10b). Aucune réservation détaillée.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'halls.validate' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id } = await params;
        const venue = await adminVenue(id, { contacts: (auth.permissions ?? []).includes('partners.read') });
        if (!venue) return notFound('Établissement introuvable.', 'VENUE_NOT_FOUND');
        return NextResponse.json({ success: true, venue });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/venues/[id]', err, { message: 'Établissement momentanément indisponible.', code: 'VENUE_UNAVAILABLE', status: 500 });
    }
}
