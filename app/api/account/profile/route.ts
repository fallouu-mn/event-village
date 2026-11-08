import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, PublicError } from '@/lib/api/public-error';
import {
    authUpdateRefusedAsTaken,
    compensateAuthIdentity,
    identityTaken,
    noStore,
    technicalEmailOf,
} from '@/lib/auth/account-sync';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AccountProfileSchema } from '@/lib/validations/account';

export const dynamic = 'force-dynamic';

const CONTEXT = 'PATCH /api/account/profile';
const FALLBACK = { message: 'Votre profil n’a pas pu être enregistré. Réessayez dans un instant.', code: 'PROFILE_SAVE_FAILED' };
const EMAIL_TAKEN = new PublicError('Cette adresse email est déjà associée à un compte.', 'EMAIL_TAKEN', 409);
const EMAIL_CONFLICT = new PublicError('Votre profil a été modifié entre-temps. Rechargez la page et recommencez.', 'EMAIL_CONFLICT', 409);
const SYNC_FAILED = new PublicError('L’enregistrement n’a pas pu aboutir. Réessayez avec la même adresse ; si le problème persiste, contactez le support.', 'ACCOUNT_SYNC_FAILED', 500);

const refuse = (err: unknown): NextResponse => apiFailure(CONTEXT, err, FALLBACK);

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

    // Email vidé : email technique du numéro, jamais NULL (L24). Sans numéro, il n'y en a pas.
    if (!typedEmail && !user.phone) {
        return NextResponse.json({ error: 'Saisissez une adresse email : aucun numéro n’est associé à votre compte.', code: 'INVALID_FIELD', field: 'email' }, { status: 400 });
    }
    const email = typedEmail || technicalEmailOf(user.phone as string);
    const currentEmail = user.email ?? null;
    const emailChanged = (currentEmail ?? '').toLowerCase() !== email;

    try {
        const supabase = getServiceRoleClient();
        if (emailChanged) {
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
        const reply = data as { ok?: boolean; code?: string } | null;
        if (error || reply?.ok !== true) {
            console.error(`[${CONTEXT}] finalisation refusée :`, error ? error.message : (reply?.code ?? 'réponse vide'));
            if (emailChanged && !(await compensateAuthIdentity(user.id, 'profile', 'email'))) return refuse(SYNC_FAILED);
            if (reply?.code === 'EMAIL_TAKEN') return refuse(EMAIL_TAKEN);
            if (reply?.code === 'EMAIL_CONFLICT') return refuse(EMAIL_CONFLICT);
            return NextResponse.json({ error: FALLBACK.message, code: FALLBACK.code }, { status: 500 });
        }

        return NextResponse.json({ ok: true, email_technical: !typedEmail });
    } catch (err) {
        return refuse(err);
    }
}

/**
 * PATCH /api/account/profile — prénom, nom, email du client connecté (lot 9, 9.2, contrat 4.3 et 5.3).
 * Le compte vient de la session. Ordre AR2 : identité libre (AM1), auth.admin.updateUserById, RPC de finalisation.
 */
export async function PATCH(req: NextRequest) {
    return noStore(await handle(req));
}
