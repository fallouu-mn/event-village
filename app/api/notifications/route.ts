import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient, getAuthenticatedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Récupère les notifications réelles de l'utilisateur connecté
 */
export async function GET(req: NextRequest) {
    try {
        const authUser = await getAuthenticatedUser(req);
        if (!authUser) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const supabase = getServiceRoleClient();
        const { searchParams } = new URL(req.url);
        const unreadOnly = searchParams.get('unread') === 'true';
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (unreadOnly) {
            query = query.neq('status', 'READ');
        }

        const { data: notifications, error: notifError } = await query;

        if (notifError) {
            console.error('[API /api/notifications] Erreur fetch:', notifError);
            return NextResponse.json({ error: 'Erreur lors de la récupération des notifications.' }, { status: 500 });
        }

        const { count: unreadCount } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', authUser.id)
            .neq('status', 'READ');

        return NextResponse.json({
            notifications: (notifications || []).map(n => ({
                id: n.id,
                userId: n.user_id,
                type: n.type || 'SYSTEM',
                title: n.title,
                content: n.content || n.title,
                channel: n.channel,
                status: n.status,
                isRead: n.status === 'READ',
                readAt: n.read_at,
                metadata: n.metadata || {},
                createdAt: n.created_at,
            })),
            unreadCount: unreadCount || 0,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/notifications] Exception:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

/**
 * PATCH /api/notifications
 * Marquer toutes les notifications comme lues
 */
export async function PATCH(req: NextRequest) {
    try {
        const authUser = await getAuthenticatedUser(req);
        if (!authUser) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const supabase = getServiceRoleClient();
        const now = new Date().toISOString();

        const { error: updateError } = await supabase
            .from('notifications')
            .update({ status: 'READ', read_at: now })
            .eq('user_id', authUser.id)
            .neq('status', 'READ');

        if (updateError) {
            console.error('[API /api/notifications PATCH] Erreur:', updateError);
            return NextResponse.json({ error: 'Erreur lors de la mise à jour.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Toutes les notifications ont été marquées comme lues.' });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
