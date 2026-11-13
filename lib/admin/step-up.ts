/**
 * Lot 9 quinquies (A3 : AUTH-05 ; A4 : AUTH-04) — second facteur et sessions de l'administration.
 *
 * Pour un compte ADMIN ou SUPERADMIN (le premier SUPERADMIN compris) :
 *  - code SMS administrateur exigé sur un nouvel appareil et après 12 heures (admin_devices) ;
 *  - mot de passe saisi pour la session depuis moins de 12 heures (password_confirmations) ;
 *  - dans l'administration (/api/admin/*, verifyAdminAuth) : mot de passe redemandé après ADMIN_IDLE_TIMEOUT_MINUTES
 *    (30 par défaut) sans activité ; chaque appel accepté compte comme activité.
 * Ailleurs (routes d'un compte admin qui passent par requireActiveSession : actions d'un admin sur un événement, scan…),
 * les deux premières règles seulement. Les sessions des clients ne changent pas.
 *
 * Appareil : cookie httpOnly `ev_admin_device` (aléatoire, posé à la vérification du code, Secure en production), rangé en
 * empreinte SHA-256 ; un client sans ce cookie (appel par jeton) est son propre appareil : sa session.
 * Refus : 403 `{ code: ADMIN_PASSWORD_REQUIRED | ADMIN_SMS_REQUIRED, reason }`, que la fenêtre de l'administration
 * (components/admin/AdminStepUpGate.tsx) lit pour redemander le mot de passe ou le code sans quitter la page.
 * Lecture en échec : 503, jamais un passage.
 */
import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedSession, getServiceRoleClient } from '@/lib/supabase/server';
import { secureCookies } from '@/lib/supabase/cookie-options';

export const ADMIN_DEVICE_COOKIE = 'ev_admin_device';
const DEVICE_COOKIE_MAX_AGE = 365 * 24 * 3600;
const DEFAULT_IDLE_MINUTES = 30;

export const STEP_UP_TEXTS = {
    ADMIN_PASSWORD_REQUIRED: 'Par sécurité, saisissez de nouveau votre mot de passe pour continuer dans l’administration.',
    ADMIN_SMS_REQUIRED: 'Par sécurité, saisissez le code administrateur reçu par SMS pour ouvrir l’administration sur cet appareil.',
} as const;

/** Délai d'inactivité de l'administration, en minutes : ADMIN_IDLE_TIMEOUT_MINUTES (5 à 240), sinon 30. */
export function adminIdleMinutes(): number {
    const raw = process.env.ADMIN_IDLE_TIMEOUT_MINUTES?.trim();
    if (!raw) return DEFAULT_IDLE_MINUTES;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 5 && n <= 240 ? n : DEFAULT_IDLE_MINUTES;
}

export function isAdminAccount(roles: readonly string[]): boolean {
    return roles.includes('ADMIN') || roles.includes('SUPERADMIN');
}

/** Clé de l'appareil : empreinte du cookie d'appareil, sinon la session (client sans cookie). */
export function deviceKey(req: NextRequest, sessionId: string): string {
    const cookie = req.cookies.get(ADMIN_DEVICE_COOKIE)?.value ?? '';
    if (/^[A-Za-z0-9_-]{32,128}$/.test(cookie)) return `dev:${createHash('sha256').update(cookie, 'utf8').digest('hex')}`;
    return `ses:${sessionId.toLowerCase()}`;
}

/** Cookie d'appareil à poser s'il manque (valeur neuve) ; null s'il est déjà là. */
export function newDeviceCookieValue(req: NextRequest): string | null {
    const cookie = req.cookies.get(ADMIN_DEVICE_COOKIE)?.value ?? '';
    return /^[A-Za-z0-9_-]{32,128}$/.test(cookie) ? null : randomBytes(32).toString('base64url');
}

export function deviceKeyOfValue(value: string): string {
    return `dev:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function setDeviceCookie(res: NextResponse, value: string): void {
    res.cookies.set(ADMIN_DEVICE_COOKIE, value, {
        httpOnly: true,
        sameSite: 'strict',
        secure: secureCookies(),
        path: '/',
        maxAge: DEVICE_COOKIE_MAX_AGE,
    });
}

function unavailable(): NextResponse {
    return NextResponse.json({ error: 'Vérification du compte momentanément impossible.', code: 'ADMIN_AUTH_UNAVAILABLE' }, { status: 503 });
}

/**
 * Contrôle du second facteur et de la session d'un compte admin. `mode` : ADMIN (administration : inactivité contrôlée,
 * activité mise à jour) ou ACCOUNT (autres routes : code SMS et mot de passe de moins de 12 h seulement).
 * Rend la réponse de refus, ou null si l'accès est permis.
 */
export async function adminStepUpRefusal(
    req: NextRequest,
    userId: string,
    mode: 'ADMIN' | 'ACCOUNT',
    opts: { touch?: boolean } = {},
): Promise<NextResponse | null> {
    const current = await getAuthenticatedSession(req);
    if (!current || current.userId !== userId) {
        return NextResponse.json({ error: STEP_UP_TEXTS.ADMIN_PASSWORD_REQUIRED, code: 'ADMIN_PASSWORD_REQUIRED', reason: 'NO_SESSION' }, { status: 403 });
    }
    const { data, error } = await getServiceRoleClient().rpc('admin_step_up_check', {
        p: {
            user_id: userId,
            session_id: current.sessionId,
            device_key: deviceKey(req, current.sessionId),
            idle_secs: mode === 'ADMIN' ? adminIdleMinutes() * 60 : null,
            touch: opts.touch ?? mode === 'ADMIN',
        },
    });
    if (error) {
        console.error(`[adminStepUpRefusal] contrôle de ${userId} impossible :`, error.message);
        return unavailable();
    }
    const reply = data as { ok?: boolean; code?: string; reason?: string } | null;
    if (reply?.ok === true) return null;
    if (reply?.code === 'ADMIN_PASSWORD_REQUIRED' || reply?.code === 'ADMIN_SMS_REQUIRED') {
        return NextResponse.json({ error: STEP_UP_TEXTS[reply.code], code: reply.code, reason: reply.reason ?? null }, { status: 403 });
    }
    console.error(`[adminStepUpRefusal] réponse inattendue pour ${userId} :`, JSON.stringify(data));
    return unavailable();
}
