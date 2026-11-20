import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { confirmPhoneChange } from '@/lib/admin/phone-change';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/users/[id]/phone/confirm — finition 3d (point 2a) : `{ request_id, code }`, le code reçu au nouveau
 * numéro. Seul le SUPERADMIN qui a commencé, dans la même session, termine ; le numéro n'est changé qu'avec la preuve.
 * Ensuite : toutes les sessions et tous les appareils de l'ADMIN révoqués, SMS à l'ancien et au nouveau numéro, journal.
 * Voir lib/admin/phone-change.ts. 200 { ok, sessions_revoked }.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    if (!auth.user!.roles.includes('SUPERADMIN')) {
        return NextResponse.json({ error: 'Seul un super-administrateur change le numéro d’un administrateur.', code: 'SUPERADMIN_ONLY' }, { status: 403 });
    }
    const { id } = await context.params;
    if (typeof id !== 'string' || !UUID_RE.test(id)) return NextResponse.json({ error: 'Compte introuvable.', code: 'USER_NOT_FOUND' }, { status: 404 });
    return confirmPhoneChange(req, { actorId: auth.user!.id, targetId: id, kind: 'BY_SUPERADMIN', context: 'POST /api/admin/users/[id]/phone/confirm' });
}
