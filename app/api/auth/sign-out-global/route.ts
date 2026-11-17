import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { revokeUserSessions } from '@/lib/auth/sessions';

export const dynamic = 'force-dynamic';

const FAILED = 'Déconnexion de tous les appareils impossible. Réessayez.';

/**
 * Cvf2b 6.8 — abonnements push du compte supprimés : les appareils déconnectés ne reçoivent plus les notifications du
 * compte (billets, changements d'événement). Toutes les lignes du compte, celle de l'appareil qui le demande comprise :
 * il est déconnecté lui aussi (signOut('partout') ferme d'abord sa propre session) et retire son abonnement du navigateur
 * (unsubscribePush, AuthProvider) ; sa ligne serveur, gardée, attendrait le premier envoi refusé, et ferait encore arriver
 * les notifications si le retrait du navigateur avait échoué.
 */
async function dropPushSubscriptions(supabase: ReturnType<typeof getServiceRoleClient>, userId: string): Promise<boolean> {
    const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', userId);
    if (error) console.error(`[sign-out-global] abonnements push non supprimés pour ${userId} :`, error.code, error.message);
    return !error;
}

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

        // Cvf2b 6.8 : avant la révocation, tant que le jeton est accepté (échec : 500, l'appareil réessaie avec le même
        // jeton, lib/auth/sign-out-here.ts) ; puis de nouveau après, pour un abonnement posé entre les deux.
        if (!(await dropPushSubscriptions(supabase, user.id))) {
            return NextResponse.json({ error: FAILED }, { status: 500 });
        }

        // Lot 1C.3 : auth.admin.signOut attend un JWT ; l'appel avec user.id était sans effet.
        if (!(await revokeUserSessions(user.id, { reason: 'USER_SIGN_OUT_GLOBAL', actorId: user.id }))) {
            return NextResponse.json({ error: FAILED }, { status: 500 });
        }
        await dropPushSubscriptions(supabase, user.id);

        return NextResponse.json({ success: true });
    } catch (err: unknown) {
        return apiFailure('POST /api/auth/sign-out-global', err, { message: FAILED, code: 'SIGN_OUT_FAILED' });
    }
}
