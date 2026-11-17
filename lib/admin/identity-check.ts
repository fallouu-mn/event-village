/**
 * Finition 3d — « mot de passe et code administrateur » d'une action sensible (changer un rôle, changer le numéro d'un
 * admin, créer des codes de secours).
 *
 * Le compte doit avoir, dans CETTE session, saisi son mot de passe depuis moins de 10 minutes (POST /api/admin/step-up), et,
 * sur CET appareil, le code administrateur reçu par SMS (POST /api/admin/step-up/sms) ou un code de secours depuis moins de
 * 10 minutes. La base décide (admin_identity_check, migration 20261120000003) ; chaque fonction sensible le revérifie avec
 * la session et l'appareil rendus ici. Refus : 403 `{ code: PASSWORD_CONFIRMATION_REQUIRED | ADMIN_CODE_CONFIRMATION_REQUIRED }`,
 * que la fenêtre de confirmation (components/admin/IdentityConfirm.tsx) lit pour demander ce qui manque, puis relancer.
 * Lecture en échec : 503, jamais un passage.
 */
import { NextRequest, NextResponse } from 'next/server';
import { deviceKey } from '@/lib/admin/step-up';
import { PASSWORD_CONFIRMATION_REQUIRED_TEXT } from '@/lib/auth/password-confirm';
import { getAuthenticatedSession, getServiceRoleClient } from '@/lib/supabase/server';

export const IDENTITY_TEXTS = {
    PASSWORD_CONFIRMATION_REQUIRED: PASSWORD_CONFIRMATION_REQUIRED_TEXT,
    ADMIN_CODE_CONFIRMATION_REQUIRED: 'Par sécurité, saisissez le code administrateur reçu par SMS pour continuer.',
} as const;

export type IdentityRefusal = keyof typeof IDENTITY_TEXTS;

export type AdminIdentity =
    | { ok: true; sessionId: string; deviceKey: string }
    | { ok: false; response: NextResponse };

export async function requireAdminIdentity(req: NextRequest, userId: string): Promise<AdminIdentity> {
    const current = await getAuthenticatedSession(req);
    if (!current || current.userId !== userId) {
        return { ok: false, response: NextResponse.json({ error: IDENTITY_TEXTS.PASSWORD_CONFIRMATION_REQUIRED, code: 'PASSWORD_CONFIRMATION_REQUIRED' }, { status: 403 }) };
    }
    const key = deviceKey(req, current.sessionId);
    const { data, error } = await getServiceRoleClient().rpc('admin_identity_check', {
        p: { user_id: userId, session_id: current.sessionId, device_key: key },
    });
    if (error) {
        console.error(`[requireAdminIdentity] contrôle de ${userId} impossible :`, error.message);
        return { ok: false, response: NextResponse.json({ error: 'Vérification du compte momentanément impossible.', code: 'ADMIN_AUTH_UNAVAILABLE' }, { status: 503 }) };
    }
    if (data === null || data === undefined) return { ok: true, sessionId: current.sessionId, deviceKey: key };
    const code = String(data) as IdentityRefusal;
    if (code in IDENTITY_TEXTS) {
        return { ok: false, response: NextResponse.json({ error: IDENTITY_TEXTS[code], code }, { status: 403 }) };
    }
    console.error(`[requireAdminIdentity] réponse inattendue pour ${userId} :`, JSON.stringify(data));
    return { ok: false, response: NextResponse.json({ error: 'Vérification du compte momentanément impossible.', code: 'ADMIN_AUTH_UNAVAILABLE' }, { status: 503 }) };
}
