import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/audit
 * Consultation et exploration du journal d'audit inaltérable (§134, §156)
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');
        const objectType = searchParams.get('objectType');
        const userRole = searchParams.get('userRole');
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        const supabase = getServiceRoleClient();

        let query = supabase
            .from('audit_logs')
            .select('*')
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

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            logs: logs || [],
            total: logs?.length || 0,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
