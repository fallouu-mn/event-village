import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/me
 * Renvoie le profil complet, les rôles actifs et le profil partenaire éventuel
 * de l'utilisateur connecté en passant par le client Service Role (sans erreur RLS 500).
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ authenticated: false, profile: null, roles: [] }, { status: 401 });
        }

        const supabase = getServiceRoleClient();

        // Récupérer le profil complet de l'utilisateur
        const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();

        // Récupérer les rôles depuis user_roles
        const { data: userRolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

        const roles: string[] = (userRolesData && userRolesData.length > 0)
            ? userRolesData.map((r: { role: string }) => r.role)
            : (userData?.role ? [userData.role] : user.roles || ['CLIENT']);

        let partnerData = null;
        if (roles.includes('PARTENAIRE')) {
            const { data: partnerRec } = await supabase
                .from('partners')
                .select('id, company_name, commercial_name, status, is_verified, trial_started_at, trial_ends_at, is_founder')
                .eq('user_id', user.id)
                .maybeSingle();
            partnerData = partnerRec || null;
        }

        const profile = userData ? {
            ...userData,
            roles,
        } : {
            id: user.id,
            email: user.email,
            phone: user.phone,
            role: user.role || 'CLIENT',
            roles,
            status: user.status || 'ACTIF',
        };

        return NextResponse.json({
            authenticated: true,
            user: { id: user.id, email: user.email },
            profile,
            roles,
            partner: partnerData,
        });
    } catch (err: unknown) {
        console.error('[API /api/auth/me]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}
