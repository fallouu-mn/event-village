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
 * Finition 1 (complément 11) : pour un compte CONTROLEUR sans rôle partenaire ni admin, `profile.scanner_open` dit si
 * le menu « Scanner » s'affiche (contrôle ouvert ou ouvrant dans les 24 h : RPC controller_scanner_status, même règle
 * que GET /api/controller/status). État illisible : null (le menu reste affiché, le scanner refuse lui-même hors de la
 * plage du contrôle). Champ absent pour tout autre compte. Le rôle n'est jamais retiré.
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

        let scannerOpen: boolean | null | undefined;
        if (roles.includes('CONTROLEUR') && !roles.some((r) => ['PARTENAIRE', 'ADMIN', 'SUPERADMIN'].includes(r))) {
            const { data: st, error: stErr } = await supabase.rpc('controller_scanner_status', { p: { user_id: user.id } });
            const reply = st as { ok?: boolean; scanner?: boolean } | null;
            if (stErr || reply?.ok !== true) {
                console.error('[API /api/auth/me] controller_scanner_status :', stErr?.message ?? JSON.stringify(st));
                scannerOpen = null;
            } else {
                scannerOpen = reply.scanner === true;
            }
        }

        const profile = { ...userData, roles, ...(scannerOpen === undefined ? {} : { scanner_open: scannerOpen }) };
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
