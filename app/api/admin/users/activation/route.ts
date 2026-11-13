import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { AdminService } from '@/lib/admin/admin.service';
import { apiFailure } from '@/lib/api/public-error';
import { issueAndSendActivation, isAccountActivationPending } from '@/lib/auth/account-activation';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({ userId: z.string().uuid('Compte inconnu.') }).strict();

/**
 * POST /api/admin/users/activation — lot 9 quinquies (A2 : AUTH-02). `{ userId }` : renvoie le lien d'activation (24 h)
 * d'un compte créé par un admin et pas encore activé ; le lien précédent n'est plus valable. Permission users.write ; le
 * lien d'un compte ADMIN ou SUPERADMIN n'est renvoyé que par un SUPERADMIN (même règle que la création).
 * 200 { activation: SENT | NOT_SENT } ; 400 ; 403 ; 404 ; 409 ACCOUNT_ALREADY_ACTIVATED ; 500.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.write' });
    if (!auth.authorized) return auth.errorResponse!;
    let raw: unknown;
    try {
        raw = await req.json();
    } catch {
        return NextResponse.json({ error: 'Demande illisible : corps JSON attendu.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_FIELD' }, { status: 400 });
    const { userId } = parsed.data;
    try {
        const supabase = getServiceRoleClient();
        const [{ data: profile, error: profileErr }, { data: roles, error: rolesErr }] = await Promise.all([
            supabase.from('users').select('id, phone, status').eq('id', userId).maybeSingle(),
            supabase.from('user_roles').select('role').eq('user_id', userId),
        ]);
        if (profileErr || rolesErr) throw new Error(profileErr?.message ?? rolesErr?.message);
        if (!profile) return NextResponse.json({ error: 'Compte introuvable.', code: 'USER_NOT_FOUND' }, { status: 404 });
        const targetRoles = (roles ?? []).map((r) => String(r.role));
        if ((targetRoles.includes('ADMIN') || targetRoles.includes('SUPERADMIN')) && !auth.user!.roles.includes('SUPERADMIN')) {
            return NextResponse.json({ error: 'Seul un superadmin peut créer un administrateur ou changer ce rôle.', code: 'ADMIN_ROLE_SUPERADMIN_ONLY' }, { status: 403 });
        }
        const { data: authRow, error: authErr } = await supabase.auth.admin.getUserById(userId);
        if (authErr || !authRow?.user) throw new Error(`compte d’authentification illisible : ${authErr?.message ?? 'absent'}`);
        if (!isAccountActivationPending(authRow.user)) {
            return NextResponse.json({ error: 'Ce compte est déjà activé : aucun lien à renvoyer.', code: 'ACCOUNT_ALREADY_ACTIVATED' }, { status: 409 });
        }
        if (!profile.phone) return NextResponse.json({ error: 'Ce compte n’a pas de numéro : le lien ne peut pas partir.', code: 'NO_PHONE' }, { status: 409 });
        const activation = await issueAndSendActivation(userId, String(profile.phone), auth.user!.id);
        await AdminService.logAudit({
            userId: auth.user!.id, userRole: auth.user!.role, action: 'ACCOUNT_ACTIVATION_RESENT', objectType: 'users', objectId: userId,
            metadata: { sms: activation },
        });
        return NextResponse.json({
            success: true,
            activation,
            message: activation === 'SENT' ? 'Nouveau lien envoyé par SMS (valable 24 heures).' : 'Le SMS n’est pas parti. Réessayez dans un instant.',
        });
    } catch (err) {
        return apiFailure('POST /api/admin/users/activation', err, { message: 'Lien non renvoyé. Réessayez.', code: 'ACTIVATION_RESEND_FAILED' });
    }
}
