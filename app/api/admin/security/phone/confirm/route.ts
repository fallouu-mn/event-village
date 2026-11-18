import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { confirmPhoneChange } from '@/lib/admin/phone-change';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/security/phone/confirm — finition 3d (point 2c) : `{ request_id, code }`, le code reçu au nouveau numéro
 * du SUPERADMIN. Ensuite : ses autres sessions et appareils révoqués (la session en cours reste), SMS à l'ancien et au
 * nouveau numéro, journal. Voir lib/admin/phone-change.ts. 200 { ok, sessions_revoked }.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    if (!auth.user!.roles.includes('SUPERADMIN')) {
        return NextResponse.json({ error: 'Votre numéro se change par le Superadmin : demandez-le-lui.', code: 'SUPERADMIN_ONLY' }, { status: 403 });
    }
    return confirmPhoneChange(req, { actorId: auth.user!.id, targetId: auth.user!.id, kind: 'SELF', context: 'POST /api/admin/security/phone/confirm' });
}
