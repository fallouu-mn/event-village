import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { adminHall } from '@/lib/halls/queries';
import { notFound } from '@/lib/halls/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/halls/[id] — fiche d'une salle pour la décision (valider, refuser avec motif, suspendre, réactiver).
 * Lot 10b (point 4) : droit halls.validate ou Superadmin, code administrateur ; photos, position, prix, acompte,
 * règle d'annulation, partenaire (statut et contacts), nombre de réservations à venir, historique des décisions.
 * Aucune réservation détaillée (client, note) : la décision porte sur la salle.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'halls.validate' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id } = await params;
        const hall = await adminHall(id);
        if (!hall) return notFound('Salle introuvable.', 'HALL_NOT_FOUND');
        return NextResponse.json({ success: true, hall });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/halls/[id]', err, { message: 'Salle momentanément indisponible.', code: 'HALL_UNAVAILABLE', status: 500 });
    }
}
