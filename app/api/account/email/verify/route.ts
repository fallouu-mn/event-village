import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import {
    authUpdateRefusedAsTaken,
    compensateAuthIdentity,
    identityTaken,
    noStore,
} from '@/lib/auth/account-sync';
import { hashVerificationToken, isVerificationToken } from '@/lib/email/verification';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { EmailService } from '@/lib/email/email.service';
import { renderEmailChangedOld } from '@/lib/notifications/catalog';
import { isDeliverableEmail } from '@/lib/notifications/channels';
import { getServerEnv } from '@/lib/env';
import { contactSupport } from '@/lib/support-contact';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/account/email/verify';
const FALLBACK = { message: 'La vérification n’a pas pu aboutir. Réessayez dans un instant.', code: 'EMAIL_VERIFY_FAILED' };

const REFUSALS: Readonly<Record<string, PublicError>> = {
    EMAIL_LINK_INVALID: new PublicError('Ce lien n’est pas valable. Demandez un nouveau lien depuis votre profil.', 'EMAIL_LINK_INVALID', 400),
    EMAIL_LINK_EXPIRED: new PublicError('Ce lien a expiré (24 heures). Demandez un nouveau lien depuis votre profil.', 'EMAIL_LINK_EXPIRED', 410),
    EMAIL_LINK_USED: new PublicError('Ce lien a déjà servi.', 'EMAIL_LINK_USED', 409),
    EMAIL_TAKEN: new PublicError('Cette adresse est déjà vérifiée sur un autre compte Event Village.', 'EMAIL_TAKEN', 409),
    EMAIL_CONFLICT: new PublicError('Votre profil a été modifié entre-temps. Demandez un nouveau lien depuis votre profil.', 'EMAIL_CONFLICT', 409),
};
// Lot 9 quinquies (B1 : AUTH-06) : « contactez le support » donne le lien de la page d'aide (calculé à la requête)
const SYNC_FAILED = (): PublicError => new PublicError(
    `La vérification n’a pas pu aboutir. Réessayez avec le même lien ; si le problème persiste, ${contactSupport(false)}`,
    'ACCOUNT_SYNC_FAILED',
    500,
);

interface CheckReply { ok?: boolean; code?: string; user_id?: string; email?: string; current_email?: string | null; auth_update?: boolean }
interface FinalizeReply { ok?: boolean; code?: string }

const refuse = (err: unknown): NextResponse => apiFailure(CONTEXT, err, FALLBACK);

/**
 * Lot 9 quinquies (C2 : AUTH-09) : l'ancienne adresse vérifiée reçoit un avis quand une autre la remplace. Envoi au mieux,
 * après la validation : un échec est journalisé (jamais avalé en silence) et ne change pas la réponse.
 */
async function warnOldAddress(userId: string, oldAddress: string, tokenHash: string): Promise<void> {
    try {
        const mail = renderEmailChangedOld({ appUrl: getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '') });
        const sent = await EmailService.send({
            to: oldAddress, subject: mail.subject, html: mail.html, text: mail.text,
            idempotencyKey: `EMAIL_CHANGED_OLD:${userId}:${tokenHash.slice(0, 16)}`,
        });
        if (!sent.sent) console.error(`[${CONTEXT}] avis à l’ancienne adresse du compte ${userId} non envoyé : ${sent.error ?? 'refus'}`);
    } catch (err) {
        console.error(`[${CONTEXT}] avis à l’ancienne adresse du compte ${userId} :`, err instanceof Error ? err.message : String(err));
    }
}

async function handle(req: NextRequest): Promise<NextResponse> {
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const token = (body as { token?: unknown } | null)?.token;
    if (!isVerificationToken(token)) return refuse(REFUSALS.EMAIL_LINK_INVALID);
    const tokenHash = hashVerificationToken(token);

    try {
        const supabase = getServiceRoleClient();

        // 1. Contrôle du lien, sans écriture.
        const { data: checkData, error: checkErr } = await supabase.rpc('email_verification_check', { p: { token_hash: tokenHash } });
        if (checkErr) return refuse(checkErr);
        const check = checkData as CheckReply | null;
        if (check?.ok !== true) {
            const refusal = check?.code ? REFUSALS[check.code] : undefined;
            return refuse(refusal ?? new Error(`email_verification_check : ${check?.code ?? 'réponse vide'}`));
        }
        const userId = String(check.user_id ?? '');
        const email = String(check.email ?? '');
        if (!userId || !email) return refuse(new Error('email_verification_check : réponse incomplète'));
        const authUpdate = check.auth_update === true;

        // Lot 9 quater (A9 : AUD-34) : l'adresse a été validée entre-temps par un autre profil. L'attente de ce compte
        // n'est plus retirée par l'autre validation ; son titulaire la retire en cliquant son lien : la RPC de validation,
        // qui voit l'adresse prise dans public.users, refuse EMAIL_TAKEN, vide l'attente et use le lien. Adresse prise
        // dans auth.users seulement : la RPC ne la verrait pas (elle validerait), refus simple sans RPC (AM1).
        const takenByProfile = async (): Promise<boolean> => {
            const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
            const { data: rows, error: readErr } = await supabase.from('users').select('id').neq('id', userId).ilike('email', pattern).limit(1);
            if (readErr) {
                console.error(`[${CONTEXT}] relecture des profils impossible pour le compte ${userId} :`, readErr.message);
                return false;
            }
            return (rows ?? []).length > 0;
        };
        const takenElsewhere = async (): Promise<NextResponse> => {
            if (!(await takenByProfile())) return refuse(REFUSALS.EMAIL_TAKEN);
            const { data: released, error: releaseErr } = await supabase.rpc('email_verification_finalize', {
                p: { token_hash: tokenHash, expected_email: check.current_email ?? null },
            });
            const code = (released as FinalizeReply | null)?.code;
            if (releaseErr || code !== 'EMAIL_TAKEN') {
                console.error(`[${CONTEXT}] attente non retirée pour le compte ${userId} :`, releaseErr ? releaseErr.message : (code ?? 'réponse vide'));
                // Profil libéré entre la relecture et la RPC : public.users a pu recevoir l'adresse, auth.users est
                // ramené sur public.users (même compensation que l'échec de la RPC).
                if ((released as FinalizeReply | null)?.ok === true) {
                    return (await compensateAuthIdentity(userId, 'email-verify', 'email')) ? NextResponse.json({ ok: true }) : refuse(SYNC_FAILED());
                }
            }
            return refuse(REFUSALS.EMAIL_TAKEN);
        };

        // Lot 9 quinquies (C2) : ancienne adresse vérifiée, lue avant la validation (avis si elle est remplacée)
        const { data: before, error: beforeErr } = await supabase.from('users').select('email, email_verified_at').eq('id', userId).maybeSingle();
        if (beforeErr) return refuse(beforeErr);
        const oldAddress = before?.email_verified_at && isDeliverableEmail(before.email) && String(before.email).toLowerCase() !== email.toLowerCase()
            ? String(before.email) : null;

        // 2. Ordre AR2 : identité libre (AM1), puis auth.users, puis la RPC de validation, compensation en cas d'échec.
        if (authUpdate) {
            if ((await identityTaken(userId, email, null)).emailTaken) return takenElsewhere();
            const { error } = await supabase.auth.admin.updateUserById(userId, { email, email_confirm: true });
            if (error) {
                if (await authUpdateRefusedAsTaken(error, userId, email, null)) return refuse(REFUSALS.EMAIL_TAKEN);
                return refuse(error);
            }
        }

        const { data, error } = await supabase.rpc('email_verification_finalize', {
            p: { token_hash: tokenHash, expected_email: check.current_email ?? null },
        });
        const reply = data as FinalizeReply | null;
        if (error || reply?.ok !== true) {
            console.error(`[${CONTEXT}] validation refusée pour le compte ${userId} :`, error ? error.message : (reply?.code ?? 'réponse vide'));
            if (authUpdate && !(await compensateAuthIdentity(userId, 'email-verify', 'email'))) return refuse(SYNC_FAILED());
            const refusal = reply?.code ? REFUSALS[reply.code] : undefined;
            if (refusal) return refuse(refusal);
            return NextResponse.json({ error: FALLBACK.message, code: FALLBACK.code }, { status: 500 });
        }
        if (oldAddress) await warnOldAddress(userId, oldAddress, tokenHash);
        return NextResponse.json({ ok: true });
    } catch (err) {
        return refuse(err);
    }
}

/**
 * POST /api/account/email/verify — lot 9 bis, tâche 48 (R87, G53-1 à G53-4 ; contrat 4.6) : validation d'un lien de
 * vérification d'adresse. Publique (le lien arrive par email), { token } ; n'ouvre AUCUNE session. Ordre :
 * email_verification_check → identité libre → auth.admin.updateUserById({ email, email_confirm }) →
 * email_verification_finalize → en cas d'échec, compensation de auth.users vers la valeur relue de public.users.
 * 200 { ok } ; 400 EMAIL_LINK_INVALID ; 410 EMAIL_LINK_EXPIRED ; 409 EMAIL_LINK_USED, EMAIL_TAKEN, EMAIL_CONFLICT ;
 * 500 ACCOUNT_SYNC_FAILED. Le jeton n'est ni journalisé ni renvoyé : seul son SHA-256 part en base.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
