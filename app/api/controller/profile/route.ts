import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { z } from 'zod';
import { getServerSessionUser, requireActiveSession, serverHasAnyRole } from '@/lib/auth/session';
import { grantAuthWritePermit } from '@/lib/auth/auth-permits';
import { PasswordCheckUnavailable, verifyAccountPassword } from '@/lib/auth/password-confirm';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import { StrongPasswordSchema } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CONTROLEUR', 'ADMIN', 'SUPERADMIN'] as const;

const PROFILE_FALLBACK = { message: 'Votre profil est momentanément indisponible. Réessayez.', code: 'PROFILE_UNAVAILABLE' };

// GET /api/controller/profile
// Retourne le profil du contrôleur connecté avec ses assignations
export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        if (!serverHasAnyRole(user, [...ALLOWED_ROLES])) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const supabase = getServiceRoleClient();

        const { data: profile, error: profileErr } = await supabase
            .from('users')
            .select('id, first_name, last_name, phone, role, status, created_at')
            .eq('id', user.id)
            .maybeSingle();

        // Lot 8 (8.2 k, contrat 3.9) : une panne de lecture n'est ni un profil absent ni une liste vide.
        if (profileErr) return apiFailure('GET /api/controller/profile, profil', profileErr, PROFILE_FALLBACK);
        if (!profile) {
            return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 });
        }

        const { data: assignments, error: assignmentsErr } = await supabase
            .from('event_controllers')
            .select(`
                id,
                can_accept_cash,
                created_at,
                events (id, title, start_date, start_time, location, status)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (assignmentsErr) {
            return apiFailure('GET /api/controller/profile, affectations', assignmentsErr, {
                message: 'Vos affectations sont momentanément indisponibles. Réessayez.',
                code: 'ASSIGNMENTS_UNAVAILABLE',
            });
        }

        const formattedAssignments = (assignments ?? []).map((a: any) => ({
            ...a,
            events: a.events ? {
                ...a.events,
                date: a.events.start_date,
            } : null,
        }));

        return NextResponse.json({
            success: true,
            profile,
            assignments: formattedAssignments,
        });
    } catch (err: unknown) {
        console.error('[GET /api/controller/profile]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}

// Lot 9 quater (A7 : AUD-12) : même règle que « Changer mon mot de passe » (règle commune, 200 caractères au plus)
const ChangePasswordSchema = z.object({
    current_password: z.string().min(1, 'Mot de passe actuel requis.').max(200, 'Mot de passe trop long.'),
    new_password: z.string().max(200, 'Mot de passe trop long.').pipe(StrongPasswordSchema),
});

// PATCH /api/controller/profile
// Changement de mot de passe — valide l'ancien avant de mettre à jour.
// Lot 9 quater (A7 : AUD-12) : compte ACTIF exigé (requireActiveSession), même quota par compte que
// /api/account/password (password_confirm_account, PASSWORD_CONFIRM_PER_ACCOUNT_15MIN, chaque essai compte), ancien mot
// de passe vérifié sans session laissée (verifyAccountPassword), permis PASSWORD avant la mise à jour.
export async function PATCH(req: NextRequest) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        const { user } = session;
        if (!serverHasAnyRole(user, [...ALLOWED_ROLES])) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        let body: unknown;
        try { body = await req.json(); }
        catch { return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 }); }

        const parse = ChangePasswordSchema.safeParse(body);
        if (!parse.success) {
            return NextResponse.json({ error: parse.error.errors[0]?.message || 'Données invalides.' }, { status: 400 });
        }

        const { current_password, new_password } = parse.data;
        const supabase = getServiceRoleClient();

        const quota = await reserveQuota(
            [{ scope: 'password_confirm_account', bucket: user.id, windowSecs: 900, max: getServerEnv().PASSWORD_CONFIRM_PER_ACCOUNT_15MIN }],
            'changement du mot de passe (contrôleur)',
        );
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, {
                error: 'Trop de tentatives. Réessayez dans quelques minutes.',
                code: 'PASSWORD_CONFIRM_RATE_LIMITED',
            });
        }

        let ok: boolean;
        try {
            ok = await verifyAccountPassword(user.id, current_password);
        } catch (err) {
            if (err instanceof PasswordCheckUnavailable) {
                console.error('[PATCH /api/controller/profile]', err.message);
                return NextResponse.json({ error: 'Impossible de vérifier l’identité.', code: 'IDENTITY_UNAVAILABLE' }, { status: 503 });
            }
            throw err;
        }
        if (!ok) {
            return NextResponse.json({ error: 'Mot de passe actuel incorrect.' }, { status: 400 });
        }

        // Mise à jour avec le nouveau mot de passe (permis exigé par la base, lot 9 quater A3)
        await grantAuthWritePermit(user.id, 'PASSWORD');
        const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
            password: new_password,
        });

        if (updateErr) {
            console.error('[PATCH /api/controller/profile] updateUserById:', updateErr.message);
            return NextResponse.json({ error: 'Impossible de mettre à jour le mot de passe.' }, { status: 500 });
        }

        // 5. Audit
        await AdminService.logAudit({
            userId: user.id,
            userRole: user.role as any,
            action: 'PASSWORD_CHANGED',
            objectType: 'users',
            objectId: user.id,
            metadata: { source: 'controller-profile' },
        });

        return NextResponse.json({
            success: true,
            message: 'Mot de passe mis à jour avec succès.',
        });
    } catch (err: unknown) {
        console.error('[PATCH /api/controller/profile]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}
