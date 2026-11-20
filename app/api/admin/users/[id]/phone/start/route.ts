import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { requireAdminIdentity } from '@/lib/admin/identity-check';
import { startPhoneChange } from '@/lib/admin/phone-change';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/users/[id]/phone/start — finition 3d (point 2a) : le SUPERADMIN change le numéro d'un ADMIN (jamais d'un
 * SUPERADMIN, jamais le sien par cet écran). `{ phone, reason }` ; mot de passe et code administrateur du SUPERADMIN
 * saisis depuis moins de 10 minutes ; un code part au NOUVEAU numéro (l'ADMIN le dicte au super-administrateur). Voir
 * lib/admin/phone-change.ts. 200 { ok, request_id, expires_at }.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    if (!auth.user!.roles.includes('SUPERADMIN')) {
        return NextResponse.json({ error: 'Seul un super-administrateur change le numéro d’un administrateur.', code: 'SUPERADMIN_ONLY' }, { status: 403 });
    }
    const identity = await requireAdminIdentity(req, auth.user!.id);
    if (!identity.ok) return identity.response;
    const { id } = await context.params;
    if (typeof id !== 'string' || !UUID_RE.test(id)) return NextResponse.json({ error: 'Compte introuvable.', code: 'USER_NOT_FOUND' }, { status: 404 });
    return startPhoneChange(req, {
        actorId: auth.user!.id, targetId: id, kind: 'BY_SUPERADMIN',
        sessionId: identity.sessionId, deviceKey: identity.deviceKey, context: 'POST /api/admin/users/[id]/phone/start',
    });
}
