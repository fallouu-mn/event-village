import { NextRequest, NextResponse } from 'next/server';
import { loadAdminPermissions } from '@/lib/admin/admin-auth';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me
 * Renvoie le profil complet, les rôles actifs et le profil partenaire éventuel
 * de l'utilisateur connecté en passant par le client Service Role (sans erreur RLS 500).
 * Lot 9 bis (R51, B34) : `admin_permissions` (ADMIN : ses lignes ; SUPERADMIN : toutes ; autre compte : aucune), lu
 * par l'écran pour masquer les boutons sans permission (hasPermission).
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ authenticated: false, profile: null, roles: [] }, { status: 401 });
        }

        const supabase = getServiceRoleClient();

        // Profil complet de l'utilisateur
        const { data: userData, error: userErr } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
        if (userErr) throw new Error(`lecture du profil : ${userErr.message}`);
        if (!userData) {
            return NextResponse.json({ authenticated: true, error: 'Profil introuvable.', profile: null, roles: [] }, { status: 404 });
        }

        // Lot 1B.1 : rôles depuis user_roles uniquement (source de la RLS), sans repli.
        const { data: userRolesData, error: rolesErr } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);
        if (rolesErr) throw new Error(`lecture des rôles : ${rolesErr.message}`);
        const roles: string[] = (userRolesData || []).map((r: { role: string }) => r.role);

        let partnerData = null;
        if (roles.includes('PARTENAIRE')) {
            const { data: partnerRec, error: partnerErr } = await supabase
                .from('partners')
                .select('id, company_name, commercial_name, status, is_verified, trial_started_at, trial_ends_at, is_founder')
                .eq('user_id', user.id)
                .maybeSingle();
            if (partnerErr) throw new Error(`lecture de la fiche partenaire : ${partnerErr.message}`);
            partnerData = partnerRec || null;
        }

        const profile = { ...userData, roles };
        const adminPermissions = await loadAdminPermissions(user.id, roles);

        return NextResponse.json({
            authenticated: true,
            user: { id: user.id, email: user.email },
            profile,
            roles,
            partner: partnerData,
            admin_permissions: adminPermissions,
        });
    } catch (err: unknown) {
        console.error('[API /api/auth/me]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}
