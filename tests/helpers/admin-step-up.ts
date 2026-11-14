/**
 * Lot 9 quinquies (A3 : AUTH-05 ; A4 : AUTH-04) — aide de test : une session de test vaut une session dont le titulaire
 * vient de saisir son mot de passe et le code administrateur sur son appareil (la session elle-même : client par jeton).
 *
 * Les aides newBuyer (tests/parcours/paiement-helpers.ts) et signInAs (tests/helpers/fixtures.ts) ouvrent leurs sessions
 * directement auprès de GoTrue (signInWithPassword), sans passer par POST /api/auth/login ni par la fenêtre de
 * l'administration. Sans cette écriture, chaque appel d'un compte ADMIN ou SUPERADMIN serait refusé
 * (ADMIN_PASSWORD_REQUIRED, puis ADMIN_SMS_REQUIRED). Écriture directe en base LOCALE (admin_devices « ses:<session> »,
 * admin_session_activity avec password_at), sans effet pour un compte qui n'est pas admin. password_confirmations n'est
 * PAS écrite : le « mot de passe récent » des actions sensibles (10 min) reste à prouver par chaque suite. Les suites du
 * lot 9 quinquies qui prouvent le second facteur ouvrent leurs sessions sans cette aide (tests/parcours/lot9quinquies-admin.test.ts).
 * Modification d'aides signalée au rapport du lot.
 */
import { writeLocal } from './db';

function claimsOf(accessToken: string): { sessionId: string; userId: string } {
    const claims = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: string; sub?: string };
    if (!claims.session_id || !claims.sub) throw new Error('stepUpTestSession : jeton sans session_id ni sub');
    return { sessionId: claims.session_id, userId: claims.sub };
}

export async function stepUpTestSession(accessToken: string): Promise<void> {
    const { sessionId, userId } = claimsOf(accessToken);
    await writeLocal(async (c) => {
        // Avant la migration du lot (preuve des rouges), rien à écrire.
        const present = await c.query(`SELECT to_regclass('public.admin_devices') IS NOT NULL AS ok`);
        if (!present.rows[0].ok) return;
        await c.query(`INSERT INTO public.admin_devices (user_id, device_key, sms_verified_at) VALUES ($1, $2, now())
                       ON CONFLICT (user_id, device_key) DO UPDATE SET sms_verified_at = EXCLUDED.sms_verified_at`, [userId, `ses:${sessionId}`]);
        await c.query(`INSERT INTO public.admin_session_activity (session_id, user_id, last_activity_at, password_at) VALUES ($1, $2, now(), now())
                       ON CONFLICT (session_id) DO UPDATE SET last_activity_at = EXCLUDED.last_activity_at, password_at = EXCLUDED.password_at`, [sessionId, userId]);
    });
}
