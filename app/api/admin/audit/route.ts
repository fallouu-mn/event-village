import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const AUDIT_FALLBACK = { message: 'Journal d’audit momentanément indisponible.', code: 'AUDIT_UNAVAILABLE' };

type AuditRow = Record<string, unknown> & { actor: { first_name: string | null; last_name: string | null; role: string | null } | null };

/**
 * GET /api/admin/audit
 * Consultation et exploration du journal d'audit inaltérable (§134, §156)
 */
export async function GET(req: NextRequest) {
    // Lot 9 (A24) : réservé au SUPERADMIN, comme la RLS (audit_logs_superadmin_read).
    const auth = await verifyAdminAuth(req, { requireSuperadmin: true });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');
        const objectType = searchParams.get('objectType');
        const userRole = searchParams.get('userRole');
        // Lot 9 (A25) : 100 au plus ; valeur illisible, nulle ou négative : 50.
        const n = Number.parseInt(searchParams.get('limit') ?? '', 10);
        const limit = Number.isFinite(n) && n >= 1 ? Math.min(n, 100) : 50;

        const supabase = getServiceRoleClient();

        let query = supabase
            .from('audit_logs')
            .select('*, actor:users(first_name,last_name,role)')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (action && action !== 'ALL') {
            query = query.eq('action', action);
        }

        if (objectType && objectType !== 'ALL') {
            query = query.eq('object_type', objectType);
        }

        if (userRole && userRole !== 'ALL') {
            query = query.eq('user_role', userRole);
        }

        const { data: logs, error } = await query;

        if (error) return apiFailure('GET /api/admin/audit', error, AUDIT_FALLBACK);

        // Lot 9 (A38) : nom et rôle courant de l'auteur, aplatis ; la jointure brute ne sort pas.
        const rows = (logs ?? []) as unknown as AuditRow[];
        const flattened = rows.map(({ actor, ...log }) => ({
            ...log,
            actor_name: [actor?.first_name, actor?.last_name].filter(Boolean).join(' ').trim() || null,
            actor_role: actor?.role ?? null,
        }));

        return NextResponse.json({
            success: true,
            logs: flattened,
            total: flattened.length,
        });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/audit', err, AUDIT_FALLBACK);
    }
}
