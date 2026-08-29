import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

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

        const supabase = getServiceRoleClient();

        // 1. Authentification
        const authHeader = req.headers.get('authorization');
        let token: string | undefined;

        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else {
            token = req.cookies.get('sb-access-token')?.value || req.cookies.get('sb-auth-token')?.value;
        }

        if (!token) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: 'Session invalide.' }, { status: 401 });
        }

        // 2. Mise à jour de la notification
        const now = new Date().toISOString();
        const { data: updated, error: updateError } = await supabase
            .from('notifications')
            .update({
                status: 'READ',
                read_at: now,
            })
            .match({ id: notifId, user_id: user.id })
            .select()
            .single();

        if (updateError) {
            console.error('[API /api/notifications/[id]/read] Erreur:', updateError);
            return NextResponse.json({ error: 'Impossible de marquer cette notification comme lue.' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            id: notifId,
            status: 'READ',
            readAt: now,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
