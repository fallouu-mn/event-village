import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { AdminPermissionsUnavailable, adminAuthUnavailableResponse, loadAdminPermissions, permissionMissingResponse } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const CONTEXT = 'GET /api/partner/team/organizers';
const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_RESULTS = 20;

interface Organizer { partner_id: string; name: string; city: string | null; status: string }

/**
 * GET /api/partner/team/organizers?q= — finition 3d (point 4b) : liste des organisatrices de la page Équipe d'un admin
 * (choix dans une liste avec recherche ; fini « ?partnerId= » tapé à la main).
 *  - Admin muni de events.read (le droit qui ouvre la lecture de l'équipe, GET /api/partner/team) ; une organisatrice ou
 *    un contrôleur : 403 ; sans session : 401.
 *  - Organisatrices validées ou suspendues (l'admin peut agir à la place d'une organisatrice suspendue).
 *  - Recherche en base (admin_organizers_search, migration 20261120000001) sans accents ni majuscules : nom commercial,
 *    raison sociale, ville, prénom et nom de la titulaire ; chaque mot doit se trouver quelque part. Le texte cherché est
 *    un paramètre de la fonction, jamais collé dans une requête.
 *  - 20 au plus, triées par nom ; `truncated` dit s'il y en a d'autres.
 * Réponse : { organizers: [{ partner_id, name, city, status }], truncated }.
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const { user } = session;
    if (!serverIsAdmin(user)) {
        return NextResponse.json({ error: 'Liste réservée à l’administration.', code: 'ADMIN_ONLY' }, { status: 403, headers: NO_STORE });
    }
    try {
        let permissions: string[];
        try {
            permissions = await loadAdminPermissions(user.id, user.roles);
        } catch (err) {
            if (err instanceof AdminPermissionsUnavailable) {
                console.error(`[${CONTEXT}]`, err.message);
                return adminAuthUnavailableResponse();
            }
            throw err;
        }
        if (!permissions.includes('events.read')) return permissionMissingResponse('events.read');

        const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 80);
        const { data, error } = await getServiceRoleClient().rpc('admin_organizers_search', { p: { q } });
        if (error) throw new Error(`admin_organizers_search : ${error.message}`);
        const reply = data as { ok?: boolean; items?: Organizer[] } | null;
        if (reply?.ok !== true || !Array.isArray(reply.items)) throw new Error(`admin_organizers_search : réponse inattendue ${JSON.stringify(reply)}`);

        const sorted = [...reply.items].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }) || a.partner_id.localeCompare(b.partner_id));
        return NextResponse.json({
            organizers: sorted.slice(0, MAX_RESULTS).map(({ partner_id, name, city, status }) => ({ partner_id, name, city: city ?? null, status })),
            truncated: sorted.length > MAX_RESULTS,
        }, { headers: NO_STORE });
    } catch (err) {
        return apiFailure(CONTEXT, err, { message: 'Liste des organisatrices momentanément indisponible. Réessayez.', code: 'ORGANIZERS_READ_FAILED' });
    }
}
