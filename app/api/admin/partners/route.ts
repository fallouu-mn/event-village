import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/partners
 * Récupère la liste réelle des partenaires avec leurs activités et informations utilisateur
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'partners.read' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const { searchParams } = new URL(req.url);
        const statusFilter = searchParams.get('status') || 'ALL';

        const supabase = getServiceRoleClient();

        let query = supabase
            .from('partners')
            .select(`
                id,
                user_id,
                company_name,
                commercial_name,
                description,
                address,
                city,
                phone,
                email,
                id_card_url,
                business_doc_url,
                is_verified,
                status,
                created_at,
                updated_at,
                users (
                    id,
                    first_name,
                    last_name,
                    phone,
                    email,
                    role,
                    status
                ),
                partner_activities (
                    activity_type,
                    is_active
                )
            `)
            .order('created_at', { ascending: false });

        if (statusFilter !== 'ALL') {
            query = query.eq('status', statusFilter as any);
        }

        const { data: partners, error } = await query;

        if (error) {
            console.error('[API /api/admin/partners] Erreur query:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            partners: partners || [],
            total: partners?.length || 0,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/admin/partners] Erreur:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
