import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { VENUE_VALIDATION_LABELS, refusalStatus } from '@/lib/tables/booking';
import { invalidatePublicPlaces } from '@/lib/lieux/cache-lieux.server';

export const dynamic = 'force-dynamic';

const DECISIONS = new Set(['VALIDER', 'REFUSER', 'SUSPENDRE', 'REACTIVER']);
const ASK = 'Choisissez de valider, refuser, suspendre ou réactiver l’établissement.';

/**
 * POST /api/admin/venues/[id]/validation { decision: VALIDER | REFUSER | SUSPENDRE | REACTIVER, reason? }
 * Lot 11a (décision du client) : un établissement (restaurant, bar, espace) n'est visible qu'après validation par
 * l'administration (réglage tables.validation_required, activé). Lot 10b : droit halls.validate (ou Superadmin), vérifié par
 * la route puis en base par venue_validation_decide (verrou, journal, avis à la partenaire) ; motif obligatoire pour
 * refuser ou suspendre. Sans interrupteur : l'administration prépare les établissements avant l'ouverture du service.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'halls.validate' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id } = await params;
        let body: { decision?: unknown; reason?: unknown } = {};
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: ASK }, { status: 400 });
        }
        if (typeof body?.decision !== 'string' || !DECISIONS.has(body.decision)) {
            return NextResponse.json({ error: ASK }, { status: 400 });
        }
        const { data, error } = await getServiceRoleClient().rpc('venue_validation_decide', {
            p: { actor_id: auth.user!.id, venue_id: id, decision: body.decision, reason: typeof body.reason === 'string' ? body.reason : null },
        });
        if (error) throw new Error(`venue_validation_decide : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) {
            return NextResponse.json({ error: r?.message ?? 'Décision impossible.', code: r?.code }, { status: refusalStatus(r?.code) });
        }
        // Lot Carte B3 : validé, refusé, suspendu ou réactivé : la carte le montre (ou le retire) dès la lecture suivante
        invalidatePublicPlaces(`établissement : décision ${body.decision}`);
        return NextResponse.json({ success: true, venue: { id, status: VENUE_VALIDATION_LABELS[String(r.validation_status)] ?? 'Mis à jour' } });
    } catch (err: unknown) {
        return apiFailure('POST /api/admin/venues/[id]/validation', err, { message: 'Décision non enregistrée. Réessayez.', code: 'VENUE_VALIDATION_FAILED' });
    }
}
