import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import {
    authUpdateRefusedAsTaken,
    compensateAuthIdentity,
    identityTaken,
    noStore,
} from '@/lib/auth/account-sync';
import { technicalEmailFor } from '@/lib/auth/technical-email';
import { otpFailureMessage, verifyStoredOtp } from '@/lib/auth/otp-store';
import { requireRecentPassword } from '@/lib/auth/password-confirm';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { getAuthenticatedSession, getServiceRoleClient } from '@/lib/supabase/server';
import { PhoneChangeConfirmSchema } from '@/lib/validations/account';
import { phoneStorageForms } from '@/lib/validations/auth';
import { contactSupport } from '@/lib/support-contact';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/account/phone/confirm';
const FALLBACK = { message: 'Votre numéro n’a pas pu être changé. Réessayez dans un instant.', code: 'PHONE_CHANGE_FAILED' };
const PHONE_TAKEN = new PublicError('Ce numéro est déjà associé à un compte.', 'PHONE_TAKEN', 409);
const PHONE_CONFLICT = new PublicError('Votre numéro a été modifié entre-temps. Recommencez le changement.', 'PHONE_CONFLICT', 409);
// Lot 9 quinquies (B1 : AUTH-06) : « contactez le support » donne le lien de la page d'aide (calculé à la requête)
const SYNC_FAILED = (): PublicError => new PublicError(`Le changement n’a pas pu aboutir. Réessayez avec le même numéro ; si le problème persiste, ${contactSupport(false)}`, 'ACCOUNT_SYNC_FAILED', 500);
const OTP_REFUSAL_CODE = { INVALID: 'INVALID_CODE', EXPIRED: 'CODE_EXPIRED', TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS' } as const;

const refuse = (err: unknown): NextResponse => apiFailure(CONTEXT, err, FALLBACK);

async function handle(req: NextRequest): Promise<NextResponse> {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { user } = session;

    // Avant la consommation du code : sans session_id, ni écriture ni révocation totale (AR2).
    const current = await getAuthenticatedSession(req);
    if (!current || current.userId !== user.id) {
        return refuse(new PublicError('Votre session ne permet pas ce changement. Reconnectez-vous puis recommencez.', 'SESSION_REQUIRED', 401));
    }
    // Lot 9 bis (R57, B35) : l'acte réel exige lui aussi un mot de passe saisi depuis moins de 10 minutes sur cette session.
    const recent = await requireRecentPassword(req, user.id);
    if (recent) return recent;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = PhoneChangeConfirmSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return NextResponse.json({ error: issue?.message ?? 'Données invalides.', code: 'INVALID_FIELD', field: issue?.path[0] ?? null }, { status: 400 });
    }
    const { phone, code } = parsed.data;

    try {
        const quota = await reserveQuota(
            [{ scope: 'otp_verify_phone', bucket: phone, windowSecs: 900, max: getServerEnv().VERIFY_OTP_PER_PHONE_15MIN }],
            'vérification du code de changement de numéro',
        );
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, {
                error: 'Trop de tentatives de vérification pour ce numéro. Réessayez plus tard.',
                code: 'OTP_VERIFY_RATE_LIMITED',
            });
        }

        const expectedPhone = user.phone ?? null;
        if (expectedPhone && phoneStorageForms(phone).includes(expectedPhone)) {
            return refuse(new PublicError('Ce numéro est déjà celui de votre compte.', 'PHONE_UNCHANGED', 400));
        }

        // Lu avant de consommer le code : une panne ici ne coûte aucun essai au client.
        const supabase = getServiceRoleClient();
        const { data: authData, error: authReadErr } = await supabase.auth.admin.getUserById(user.id);
        if (authReadErr || !authData?.user) return refuse(authReadErr ?? new Error('auth.admin.getUserById : aucun compte renvoyé'));

        const check = await verifyStoredOtp(phone, code, 'PHONE_CHANGE');
        if (!check.ok) {
            const { message, status } = otpFailureMessage(check.reason);
            return refuse(new PublicError(message, OTP_REFUSAL_CODE[check.reason], status));
        }

        // Lot 9 quater (A4 : AUD-19) : l'adresse technique n'est plus tirée du numéro, elle ne change donc pas avec lui.
        // Contre-vérification du lot 9 quinquies (point 2) : l'identifiant GoTrue (empreinte secrète) ne sort jamais de
        // auth.users ; un profil sans adresse reprend l'adresse technique tirée de son identifiant.
        const newEmail = user.email ? null : technicalEmailFor(user.id);

        const taken = await identityTaken(user.id, newEmail, phone);
        if (taken.phoneTaken || taken.emailTaken) return refuse(PHONE_TAKEN);

        const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
            phone,
            phone_confirm: true,
            ...(newEmail ? { email: newEmail, email_confirm: true } : {}),
        });
        if (updateErr) {
            // Rien n'a été écrit dans auth.users : aucune compensation (AM1).
            if (await authUpdateRefusedAsTaken(updateErr, user.id, newEmail, phone)) return refuse(PHONE_TAKEN);
            return refuse(updateErr);
        }

        const { data, error } = await supabase.rpc('account_phone_finalize', {
            p: { user_id: user.id, new_phone: phone, expected_phone: expectedPhone, new_email: newEmail, keep_session_id: current.sessionId },
        });
        const reply = data as { ok?: boolean; code?: string } | null;
        if (error || reply?.ok !== true) {
            console.error(`[${CONTEXT}] finalisation refusée :`, error ? error.message : (reply?.code ?? 'réponse vide'));
            if (!(await compensateAuthIdentity(user.id, 'phone_change', 'phone_email'))) return refuse(SYNC_FAILED());
            if (reply?.code === 'PHONE_TAKEN') return refuse(PHONE_TAKEN);
            if (reply?.code === 'PHONE_CONFLICT') return refuse(PHONE_CONFLICT);
            return NextResponse.json({ error: FALLBACK.message, code: FALLBACK.code }, { status: 500 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        return refuse(err);
    }
}

/**
 * POST /api/account/phone/confirm — fin du changement de numéro (lot 9, 9.2, contrat 4.3, 5.3, AR2, AM1).
 * Ordre : session et session_id, quota, code consommé, identité libre, auth.admin.updateUserById, RPC account_phone_finalize
 * (profil, autres sessions révoquées, SMS PHONE_CHANGED à l'ancien numéro, audit). RPC en échec : compensation vers la valeur relue.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
