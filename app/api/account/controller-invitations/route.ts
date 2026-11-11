import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface InvitationItem {
    id: string;
    company: string;
    events: Array<{ id: string; title: string; start_at: string | null }>;
    expires_at: string;
}

/**
 * GET /api/account/controller-invitations — lot 9 bis (R37, B62, contrat 4.3) : invitations en attente du compte
 * connecté à contrôler les événements d'une partenaire (RPC controller_invitations_mine) ; une invitation échue
 * n'est plus servie. Le titulaire y répond par POST /api/account/controller-invitations/[id].
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    try {
        const { data, error } = await getServiceRoleClient().rpc('controller_invitations_mine', { p: { actor_id: session.user.id } });
        if (error) throw error;
        const reply = data as { ok?: boolean; items?: InvitationItem[] } | null;
        if (!reply || reply.ok !== true || !Array.isArray(reply.items)) throw new Error(`controller_invitations_mine : réponse inattendue ${JSON.stringify(data)}`);
        return NextResponse.json({ items: reply.items }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return apiFailure('GET /api/account/controller-invitations', err, {
            message: 'Invitations momentanément indisponibles.',
            code: 'CONTROLLER_INVITATIONS_UNAVAILABLE',
        });
    }
}
