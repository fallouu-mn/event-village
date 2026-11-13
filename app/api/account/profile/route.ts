import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import {
    authUpdateRefusedAsTaken,
    compensateAuthIdentity,
    identityTaken,
    noStore,
} from '@/lib/auth/account-sync';
import { technicalEmailFor } from '@/lib/auth/technical-email';
import { requireRecentPassword } from '@/lib/auth/password-confirm';
import { requireActiveSession } from '@/lib/auth/session';
import { emailVerificationState, sendEmailVerification, type EmailVerificationState } from '@/lib/email/verification';
import { isTechnicalAddress } from '@/lib/notifications/channels';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AccountProfileSchema } from '@/lib/validations/account';
import { RESERVED_EMAIL_MESSAGE } from '@/lib/validations/auth';
import { contactSupport } from '@/lib/support-contact';

export const dynamic = 'force-dynamic';

const CONTEXT = 'PATCH /api/account/profile';
const FALLBACK = { message: 'Votre profil n’a pas pu être enregistré. Réessayez dans un instant.', code: 'PROFILE_SAVE_FAILED' };
const EMAIL_TAKEN = new PublicError('Cette adresse email est déjà associée à un compte.', 'EMAIL_TAKEN', 409);
const EMAIL_CONFLICT = new PublicError('Votre profil a été modifié entre-temps. Rechargez la page et recommencez.', 'EMAIL_CONFLICT', 409);
// Lot 9 quinquies (B1 : AUTH-06) : « contactez le support » donne le lien de la page d'aide (calculé à la requête)
const SYNC_FAILED = (): PublicError => new PublicError(`L’enregistrement n’a pas pu aboutir. Réessayez avec la même adresse ; si le problème persiste, ${contactSupport(false)}`, 'ACCOUNT_SYNC_FAILED', 500);

const refuse = (err: unknown): NextResponse => apiFailure(CONTEXT, err, FALLBACK);

interface FinalizeReply { ok?: boolean; code?: string; email_state?: string; email_pending?: string | null }

async function handle(req: NextRequest): Promise<NextResponse> {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { user } = session;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = AccountProfileSchema.safeParse(body);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return NextResponse.json({ error: issue?.message ?? 'Données invalides.', code: 'INVALID_FIELD', field: issue?.path[0] ?? null }, { status: 400 });
    }
    const { first_name, last_name, email: typedEmail } = parsed.data;
    // Lot 9 bis (B100) : tout le domaine technique est réservé, sous-domaines compris (deleted.eventvillage.sn).
    if (typedEmail && isTechnicalAddress(typedEmail)) {
        return NextResponse.json({ error: RESERVED_EMAIL_MESSAGE, code: 'INVALID_FIELD', field: 'email' }, { status: 400 });
    }

    // Email vidé : email technique du numéro, jamais NULL (L24). Sans numéro, il n'y en a pas.
    if (!typedEmail && !user.phone) {
        return NextResponse.json({ error: 'Saisissez une adresse email : aucun numéro n’est associé à votre compte.', code: 'INVALID_FIELD', field: 'email' }, { status: 400 });
    }
    const currentEmail = user.email ?? null;
    // Lot 9 quater (A4 : AUD-19) : adresse vidée → adresse technique actuelle du compte si elle l'est déjà, sinon
    // l'adresse technique tirée de son identifiant (jamais du numéro).
    const email = typedEmail
        || (currentEmail && isTechnicalAddress(currentEmail) ? currentEmail.toLowerCase() : technicalEmailFor(user.id));
    // Lot 9 bis (R87) : seule l'adresse vidée (technique) s'écrit tout de suite dans auth.users ; une adresse saisie
    // attend sa vérification (users.email_pending) et n'atteint auth.users qu'à la validation du lien.
    const authChange = !typedEmail && (currentEmail ?? '').toLowerCase() !== email;

    try {
        const supabase = getServiceRoleClient();
        // Lot 9 bis (R57, B35, tâche 13) : changer d'adresse (nouvelle adresse en attente, ou adresse vidée) exige un mot
        // de passe saisi depuis moins de 10 minutes sur la session, avant tout effet. Les refus de validation (400)
        // passent avant ; un enregistrement sans changement d'adresse ne demande rien.
        const { data: row, error: rowErr } = await supabase.from('users').select('email_pending').eq('id', user.id).maybeSingle();
        if (rowErr) return refuse(rowErr);
        const pending = (row?.email_pending as string | null | undefined) ?? null;
        const emailChange = typedEmail
            ? (currentEmail ?? '').toLowerCase() !== email && pending !== email
            : authChange || pending !== null;
        if (emailChange) {
            const recent = await requireRecentPassword(req, user.id);
            if (recent) return recent;
        }
        if (typedEmail && (currentEmail ?? '').toLowerCase() !== email) {
            if ((await identityTaken(user.id, email, null)).emailTaken) return refuse(EMAIL_TAKEN);
        }
        if (authChange) {
            if ((await identityTaken(user.id, email, null)).emailTaken) return refuse(EMAIL_TAKEN);
            const { error } = await supabase.auth.admin.updateUserById(user.id, { email, email_confirm: true });
            if (error) {
                if (await authUpdateRefusedAsTaken(error, user.id, email, null)) return refuse(EMAIL_TAKEN);
                return refuse(error);
            }
        }

        const { data, error } = await supabase.rpc('account_profile_finalize', {
            p: { user_id: user.id, first_name, last_name, email, expected_email: currentEmail },
        });
        const reply = data as FinalizeReply | null;
        if (error || reply?.ok !== true) {
            console.error(`[${CONTEXT}] finalisation refusée :`, error ? error.message : (reply?.code ?? 'réponse vide'));
            if (authChange && !(await compensateAuthIdentity(user.id, 'profile', 'email'))) return refuse(SYNC_FAILED());
            if (reply?.code === 'EMAIL_TAKEN') return refuse(EMAIL_TAKEN);
            if (reply?.code === 'EMAIL_CONFLICT') return refuse(EMAIL_CONFLICT);
            return NextResponse.json({ error: FALLBACK.message, code: FALLBACK.code }, { status: 500 });
        }

        // Nouvelle adresse en attente : lien de vérification, au mieux (le profil propose « Renvoyer le lien »).
        let emailVerification: EmailVerificationState | null = null;
        if (reply.email_state === 'PENDING') {
            try {
                emailVerification = emailVerificationState(await sendEmailVerification(user.id));
            } catch (mailErr) {
                console.error(`[${CONTEXT}] lien de vérification du compte ${user.id} non envoyé :`, mailErr instanceof Error ? mailErr.message : String(mailErr));
                emailVerification = 'NOT_SENT';
            }
        }

        return NextResponse.json({
            ok: true,
            email_technical: !typedEmail,
            email_pending: reply.email_pending ?? null,
            email_verification: emailVerification,
        });
    } catch (err) {
        return refuse(err);
    }
}

/**
 * PATCH /api/account/profile — prénom, nom, email du client connecté (lot 9, 9.2, contrat 4.3 et 5.3).
 * Le compte vient de la session. Lot 9 bis (R87, contrat 4.6) : une adresse saisie est mise en attente
 * (account_profile_finalize) et reçoit un lien de vérification ; auth.users n'est écrit que pour l'adresse vidée
 * (ordre AR2 : identité libre (AM1), auth.admin.updateUserById, RPC, compensation). Réponse
 * { ok, email_technical, email_pending, email_verification }. Tout changement d'adresse exige un mot de passe saisi
 * depuis moins de 10 minutes sur la session (R57 : 403 PASSWORD_CONFIRMATION_REQUIRED, requireRecentPassword).
 */
export async function PATCH(req: NextRequest) {
    return noStore(await handle(req));
}
