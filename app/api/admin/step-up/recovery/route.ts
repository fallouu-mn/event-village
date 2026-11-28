import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { deviceKey, deviceKeyOfValue, newDeviceCookieValue, setDeviceCookie } from '@/lib/admin/step-up';
import { backupCodeHash, normalizeBackupCode } from '@/lib/admin/backup-codes';
import { noStore } from '@/lib/auth/account-sync';
import { beginLoginAttempt, endLoginAttempt, LoginGuardUnavailable, type AttemptLimits } from '@/lib/auth/login-guard';
import { PasswordCheckUnavailable, recordPasswordConfirmation, verifyAccountPassword } from '@/lib/auth/password-confirm';
import { formatRetryDelay } from '@/lib/format-delay';
import { getAuthenticatedSession, getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    password: z.string().min(1, 'Saisissez votre mot de passe.').max(200, 'Mot de passe trop long.'),
    code: z.string().min(1, 'Saisissez un code de secours.').max(40, 'Code de secours illisible.'),
}).strict();

/** 5 ÉCHECS par 15 minutes et par compte (mot de passe ou code faux) : deviner un code de 50 bits est hors de portée. */
const RECOVERY_LIMITS: AttemptLimits = { max: 5, windowSecs: 15 * 60 };
const INVALID = 'Mot de passe ou code de secours incorrect.';

function bucket(userId: string): string {
    return `id:${createHash('sha256').update(`admin-recovery:${userId.toLowerCase()}`, 'utf8').digest('hex')}`;
}

function unavailable(): NextResponse {
    return noStore(NextResponse.json({ error: 'Vérification momentanément impossible. Réessayez dans un instant.', code: 'RECOVERY_UNAVAILABLE' }, { status: 503 }));
}

/**
 * POST /api/admin/step-up/recovery — finition 3d (point 2c), « J'ai perdu mon téléphone » dans la fenêtre du code
 * administrateur : `{ password, code }` (un code de secours) remplacent le code reçu par SMS. SUPERADMIN seulement (un ADMIN
 * n'a pas de codes de secours : le super-administrateur change son numéro). 5 échecs par 15 minutes (puis 429, même avec le bon code) ;
 * un seul message pour un mot de passe ou un code faux. En cas de succès, dans la base (admin_backup_code_use) : code
 * consommé, appareil reconnu, SMS d'alerte à l'ancien numéro, email, journal ; ici : mot de passe enregistré pour la
 * session, cookie d'appareil posé s'il manque. L'écran mène ensuite au changement de son propre numéro.
 * 200 { ok, remaining } ; 400 ; 403 BACKUP_CODE_INVALID | NO_BACKUP_CODES ; 429 ; 503.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { skipStepUp: true });
    if (!auth.authorized) return noStore(auth.errorResponse!);
    const userId = auth.user!.id;
    if (!auth.user!.roles.includes('SUPERADMIN')) {
        return noStore(NextResponse.json({
            error: 'Seul un super-administrateur a des codes de secours. Demandez au super-administrateur de changer votre numéro de téléphone.',
            code: 'NO_BACKUP_CODES',
        }, { status: 403 }));
    }
    const current = await getAuthenticatedSession(req);
    if (!current || current.userId !== userId) {
        return noStore(NextResponse.json({ error: 'Session expirée. Reconnectez-vous.', code: 'SESSION_REQUIRED' }, { status: 401 }));
    }
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return noStore(NextResponse.json({ error: 'Demande illisible. Rechargez la page, puis réessayez.', code: 'INVALID_BODY' }, { status: 400 }));
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
        return noStore(NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_FIELD' }, { status: 400 }));
    }

    let attemptId: string;
    try {
        const attempt = await beginLoginAttempt(bucket(userId), RECOVERY_LIMITS);
        if (!attempt.allowed) {
            const res = NextResponse.json({
                error: `Trop d’essais. ${formatRetryDelay(attempt.retryAfterSeconds)}`, code: 'RECOVERY_RATE_LIMITED', retryAfterSeconds: attempt.retryAfterSeconds,
            }, { status: 429 });
            res.headers.set('Retry-After', String(attempt.retryAfterSeconds));
            return noStore(res);
        }
        attemptId = attempt.attemptId;
    } catch (err) {
        if (err instanceof LoginGuardUnavailable) return unavailable();
        throw err;
    }

    const fail = async (): Promise<NextResponse> => {
        await endLoginAttempt(attemptId, 'FAILURE', null, RECOVERY_LIMITS);
        return noStore(NextResponse.json({ error: INVALID, code: 'BACKUP_CODE_INVALID' }, { status: 403 }));
    };

    try {
        const normalized = normalizeBackupCode(parsed.data.code);
        if (!(await verifyAccountPassword(userId, parsed.data.password)) || !normalized) return await fail();
        // Navigateur : cookie d'appareil posé s'il manque ; client par jeton : l'appareil est sa session
        const bearerClient = (req.headers.get('authorization') ?? '').startsWith('Bearer ');
        const fresh = bearerClient ? null : newDeviceCookieValue(req);
        const key = fresh ? deviceKeyOfValue(fresh) : deviceKey(req, current.sessionId);
        const { data, error } = await getServiceRoleClient().rpc('admin_backup_code_use', {
            p: { user_id: userId, code_hash: backupCodeHash(userId, normalized), session_id: current.sessionId, device_key: key },
        });
        if (error) {
            console.error('[POST /api/admin/step-up/recovery]', error.message);
            await endLoginAttempt(attemptId, 'ABORTED', null, RECOVERY_LIMITS);
            return unavailable();
        }
        const reply = data as { ok?: boolean; code?: string; remaining?: number } | null;
        if (reply?.ok !== true) {
            if (reply?.code === 'INVALID_CODE') return await fail();
            console.error('[POST /api/admin/step-up/recovery] refus inattendu :', JSON.stringify(reply));
            await endLoginAttempt(attemptId, 'ABORTED', null, RECOVERY_LIMITS);
            return unavailable();
        }
        await endLoginAttempt(attemptId, 'SUCCESS', null, RECOVERY_LIMITS);
        await recordPasswordConfirmation(current.sessionId, userId);
        const res = NextResponse.json({ ok: true, remaining: Number(reply.remaining ?? 0) });
        if (fresh) setDeviceCookie(res, fresh);
        return noStore(res);
    } catch (err) {
        if (err instanceof LoginGuardUnavailable) return unavailable();
        if (err instanceof PasswordCheckUnavailable) {
            console.error('[POST /api/admin/step-up/recovery]', err.message);
            await endLoginAttempt(attemptId, 'ABORTED', null, RECOVERY_LIMITS).catch(() => undefined);
            return unavailable();
        }
        throw err;
    }
}
