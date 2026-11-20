import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { HALL_VALIDATION_LABELS, refusalStatus } from '@/lib/halls/booking';

export const dynamic = 'force-dynamic';

const DECISIONS = new Set(['VALIDER', 'REFUSER', 'SUSPENDRE', 'REACTIVER']);

/**
 * POST /api/admin/halls/[id]/validation { decision: VALIDER | REFUSER | SUSPENDRE | REACTIVER, reason? }
 * Lot 10a (décision du client) : une salle n'est visible qu'après validation par l'administration (réglage
 * halls.validation_required). Lot 10b : droit halls.validate (ou Superadmin), vérifié par la route puis en base par
 * hall_validation_decide (verrou, journal, avis à la partenaire) ; motif obligatoire pour refuser ou suspendre.
 * Sans interrupteur : l'administration prépare les salles avant l'ouverture du service.
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
            return NextResponse.json({ error: 'Choisissez de valider, refuser, suspendre ou réactiver la salle.' }, { status: 400 });
        }
        if (typeof body?.decision !== 'string' || !DECISIONS.has(body.decision)) {
            return NextResponse.json({ error: 'Choisissez de valider, refuser, suspendre ou réactiver la salle.' }, { status: 400 });
        }
        const { data, error } = await getServiceRoleClient().rpc('hall_validation_decide', {
            p: { actor_id: auth.user!.id, hall_id: id, decision: body.decision, reason: typeof body.reason === 'string' ? body.reason : null },
        });
        if (error) throw new Error(`hall_validation_decide : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) {
            return NextResponse.json({ error: r?.message ?? 'Décision impossible.', code: r?.code }, { status: refusalStatus(r?.code) });
        }
        const status = String(r.validation_status);
        return NextResponse.json({ success: true, hall: { id, status: HALL_VALIDATION_LABELS[status] ?? status } });
    } catch (err: unknown) {
        return apiFailure('POST /api/admin/halls/[id]/validation', err, { message: 'Décision non enregistrée. Réessayez.', code: 'HALL_VALIDATION_FAILED' });
    }
}
