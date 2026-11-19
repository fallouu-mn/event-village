import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { requireAdminIdentity } from '@/lib/admin/identity-check';
import { startPhoneChange } from '@/lib/admin/phone-change';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/security/phone/start — finition 3d (point 2c) : le SUPERADMIN change son propre numéro (après
 * « J'ai perdu mon téléphone » : le code de secours a reconnu l'appareil et enregistré le mot de passe). `{ phone }` ; mot
 * de passe et code (ou code de secours) depuis moins de 10 minutes ; un code part au NOUVEAU numéro. Voir
 * lib/admin/phone-change.ts. 200 { ok, request_id, expires_at }.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    if (!auth.user!.roles.includes('SUPERADMIN')) {
        return NextResponse.json({ error: 'Votre numéro se change par le super-administrateur : demandez-le-lui.', code: 'SUPERADMIN_ONLY' }, { status: 403 });
    }
    const identity = await requireAdminIdentity(req, auth.user!.id);
    if (!identity.ok) return identity.response;
    return startPhoneChange(req, {
        actorId: auth.user!.id, targetId: auth.user!.id, kind: 'SELF',
        sessionId: identity.sessionId, deviceKey: identity.deviceKey, context: 'POST /api/admin/security/phone/start',
    });
}
