import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { noStore } from '@/lib/auth/account-sync';
import { ACCOUNT_ACTIVATION_KEY, activationTokenHash, isAccountActivationPending } from '@/lib/auth/account-activation';
import { grantAuthWritePermit } from '@/lib/auth/auth-permits';
import { ServerPasswordSchema } from '@/lib/auth/password-policy.server';
import { getClientIp } from '@/lib/security/client-ip';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'POST /api/auth/activate';

const BodySchema = z.object({
    token: z.string({ required_error: 'Lien d’activation incomplet.' }).trim().regex(/^[A-Za-z0-9_-]{16,64}$/, 'Lien d’activation illisible.'),
    password: z.string({ required_error: 'Choisissez votre mot de passe.' }).pipe(ServerPasswordSchema),
}).strict();

const LINK_REFUSALS: Readonly<Record<string, string>> = {
    UNKNOWN: 'Ce lien d’activation n’est pas valable. Demandez un nouveau lien à l’administrateur qui a créé votre compte.',
    USED: 'Ce lien a déjà servi : votre compte est activé. Connectez-vous avec votre mot de passe.',
    EXPIRED: 'Ce lien a expiré (24 heures) ou a été remplacé par un plus récent. Demandez un nouveau lien à l’administrateur.',
};

function failure(): NextResponse {
    return NextResponse.json(
        { error: 'Activation impossible pour le moment. Demandez un nouveau lien à l’administrateur.', code: 'ACTIVATION_FAILED' },
        { status: 500 },
    );
}

async function handle(req: NextRequest): Promise<NextResponse> {
    // Anti-force brute par IP, avant toute lecture (le jeton de 128 bits ne se devine pas ; garde indisponible → 503)
    const quota = await reserveQuota(
        [{ scope: 'account_activation_ip', bucket: getClientIp(req) ?? 'unknown', windowSecs: 3600, max: 30 }],
        'activation d’un compte',
    );
    if (!quota.allowed) {
        return quotaRefusalResponse(quota, { error: 'Trop de tentatives d’activation depuis cette connexion. Réessayez plus tard.', code: 'ACTIVATION_RATE_LIMITED' });
    }
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const field = issue?.path[0] === 'password' ? 'password' : 'token';
        return NextResponse.json({ error: issue?.message ?? 'Demande invalide.', code: field === 'password' ? 'WEAK_PASSWORD' : 'INVALID_TOKEN', field }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    // Le lien est consommé (usage unique) avant la pose du mot de passe ; un échec ensuite demande un nouveau lien.
    const { data: consumed, error: consumeErr } = await supabase.rpc('account_activation_consume', {
        p: { token_hash: activationTokenHash(parsed.data.token) },
    });
    if (consumeErr) {
        console.error(`[${CONTEXT}] lien illisible :`, consumeErr.message);
        return failure();
    }
    const reply = consumed as { ok?: boolean; user_id?: string; code?: string } | null;
    if (reply?.ok !== true || !reply.user_id) {
        const code = reply?.code ?? 'UNKNOWN';
        return NextResponse.json({ error: LINK_REFUSALS[code] ?? LINK_REFUSALS.UNKNOWN, code: `ACTIVATION_${code}` }, { status: code === 'USED' ? 409 : 410 });
    }
    const userId = reply.user_id;

    const { data: authRow, error: authErr } = await supabase.auth.admin.getUserById(userId);
    if (authErr || !authRow?.user) {
        console.error(`[${CONTEXT}] compte ${userId} illisible :`, authErr?.message ?? 'absent');
        return failure();
    }
    if (!isAccountActivationPending(authRow.user)) {
        return NextResponse.json({ error: LINK_REFUSALS.USED, code: 'ACTIVATION_USED' }, { status: 409 });
    }
    const { data: profile, error: profileErr } = await supabase.from('users').select('status').eq('id', userId).maybeSingle();
    if (profileErr || !profile) {
        console.error(`[${CONTEXT}] profil ${userId} illisible :`, profileErr?.message ?? 'absent');
        return failure();
    }
    if (profile.status !== 'ACTIF') {
        return NextResponse.json({ error: 'Ce compte n’est pas actif : l’activation est impossible. Contactez le support.', code: 'ACCOUNT_NOT_ACTIVE' }, { status: 403 });
    }

    // Mot de passe d'abord, pendant que la marque est encore posée (notif_on_password_changed : aucun avis pour
    // l'activation), puis retrait de la marque ; permis PASSWORD posé juste avant (la base refuse tout autre changement).
    try {
        await grantAuthWritePermit(userId, 'PASSWORD');
    } catch (err) {
        console.error(`[${CONTEXT}]`, err instanceof Error ? err.message : String(err));
        return failure();
    }
    const { error: pwdErr } = await supabase.auth.admin.updateUserById(userId, { password: parsed.data.password });
    if (pwdErr) {
        console.error(`[${CONTEXT}] mot de passe de ${userId} :`, pwdErr.code ?? '', pwdErr.message);
        if (pwdErr.code === 'weak_password') {
            return NextResponse.json({ error: 'Ce mot de passe est trop faible. Choisissez-en un autre.', code: 'WEAK_PASSWORD', field: 'password' }, { status: 400 });
        }
        return failure();
    }
    const { error: markErr } = await supabase.auth.admin.updateUserById(userId, { app_metadata: { [ACCOUNT_ACTIVATION_KEY]: false } });
    if (markErr) {
        console.error(`[${CONTEXT}] marque d’activation de ${userId} non retirée :`, markErr.message);
        return failure();
    }
    // Le lien reçu par SMS prouve la possession du numéro (première date conservée)
    const { error: verifyErr } = await supabase.from('users').update({ phone_verified_at: new Date().toISOString() }).eq('id', userId).is('phone_verified_at', null);
    if (verifyErr) console.error(`[${CONTEXT}] phone_verified_at de ${userId} :`, verifyErr.message);
    const { error: auditErr } = await supabase.from('audit_logs').insert({
        user_id: userId, user_role: null, action: 'ACCOUNT_ACTIVATED', object_type: 'users', object_id: userId, metadata: { source: 'activation-link' },
    });
    if (auditErr) console.error(`[${CONTEXT}] journal de l’activation de ${userId} :`, auditErr.message);
    return NextResponse.json({ ok: true, message: 'Compte activé. Connectez-vous avec votre numéro et votre mot de passe.' });
}

/**
 * POST /api/auth/activate — lot 9 quinquies (A2 : AUTH-02, T2). Publique (préfixe /api/auth du middleware).
 * `{ token, password }` : jeton du lien reçu par SMS (24 h, usage unique) et mot de passe choisi selon la règle commune.
 * 200 ; 400 WEAK_PASSWORD ou INVALID_TOKEN ; 403 ACCOUNT_NOT_ACTIVE ; 409 ACTIVATION_USED ; 410 ACTIVATION_UNKNOWN ou
 * ACTIVATION_EXPIRED ; 429 ; 500.
 */
export async function POST(req: NextRequest) {
    return noStore(await handle(req));
}
