import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { getPushConfig } from '@/lib/push/config';

export const dynamic = 'force-dynamic';

/**
 * GET /api/push/config — lot 6 (contrat F4) : configuration PUBLIQUE du push web.
 * `{ enabled: true, publicKey }` quand les trois variables VAPID sont valides ; sinon
 * `{ enabled: false, publicKey: null }` (canal désactivé, rien d'autre ne change). Jamais la clé privée.
 * Session exigée (compte actif ou en attente de validation : page des préférences).
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
    if (session.response) return session.response;
    const config = getPushConfig();
    return NextResponse.json(config.enabled ? { enabled: true, publicKey: config.publicKey } : { enabled: false, publicKey: null });
}
