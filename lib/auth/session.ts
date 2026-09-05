import { NextRequest } from 'next/server';
import { getServiceRoleClient, getAuthenticatedUser } from '../supabase/server';

export interface ServerUser {
    id: string;
    email?: string;
    phone?: string;
    role: string;
    status: string;
    firstName?: string;
    lastName?: string;
}

/**
 * Extrait et valide l'utilisateur authentifié depuis une requête Next.js
 */
export async function getServerSessionUser(req: NextRequest): Promise<ServerUser | null> {
    try {
        const authUser = await getAuthenticatedUser(req);
        if (!authUser) return null;

        const supabase = getServiceRoleClient();

        const { data: profile, error: profErr } = await supabase
            .from('users')
            .select('id, email, phone, role, status, first_name, last_name')
            .eq('id', authUser.id)
            .single();

        if (profErr || !profile) {
            return null;
        }

        return {
            id: profile.id,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            status: profile.status,
            firstName: profile.first_name,
            lastName: profile.last_name,
        };
    } catch (err) {
        console.error('[getServerSessionUser] Erreur session:', err);
        return null;
    }
}
