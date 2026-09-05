import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient, getAuthenticatedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/notifications/[id]/read
 * Marque une notification spécifique comme lue
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const notifId = params.id;
        if (!notifId) {
            return NextResponse.json({ error: 'ID de notification requis.' }, { status: 400 });
        }

        const authUser = await getAuthenticatedUser(req);
        if (!authUser) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const supabase = getServiceRoleClient();
        const now = new Date().toISOString();

        const { data: updated, error: updateError } = await supabase
            .from('notifications')
            .update({ status: 'READ', read_at: now })
            .match({ id: notifId, user_id: authUser.id })
            .select()
            .single();

        if (updateError) {
            console.error('[API /api/notifications/[id]/read] Erreur:', updateError);
            return NextResponse.json({ error: 'Impossible de marquer cette notification comme lue.' }, { status: 500 });
        }

        return NextResponse.json({ success: true, id: notifId, status: 'READ', readAt: now });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
