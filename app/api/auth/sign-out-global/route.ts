import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { revokeUserSessions } from '@/lib/auth/sessions';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace('Bearer ', '');
        if (!token) {
            return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
        }

        const supabase = getServiceRoleClient();
        const { data: { user }, error: userErr } = await supabase.auth.getUser(token);

        if (userErr || !user) {
            return NextResponse.json({ error: 'Session invalide' }, { status: 401 });
        }

        // Lot 1C.3 : auth.admin.signOut attend un JWT ; l'appel avec user.id était sans effet.
        if (!(await revokeUserSessions(user.id, { reason: 'USER_SIGN_OUT_GLOBAL', actorId: user.id }))) {
            return NextResponse.json({ error: 'Déconnexion de tous les appareils impossible. Réessayez.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
