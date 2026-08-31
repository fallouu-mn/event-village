import { NextRequest } from 'next/server';
import { getServiceRoleClient } from '../supabase/server';

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
        const supabase = getServiceRoleClient();

        // 1. Extraction du token JWT — seule source d'identité autorisée (jamais x-user-id)
        const authHeader = req.headers.get('authorization');
        let token: string | undefined;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else {
            token =
                req.cookies.get('sb-access-token')?.value ||
                req.cookies.get('sb-auth-token')?.value ||
                req.cookies.get('supabase-auth-token')?.value;
        }

        if (!token) return null;

        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) return null;

        const authId = user.id;

        // 2. Récupération des données du profil public.users
        const { data: profile, error: profErr } = await supabase
            .from('users')
            .select('id, email, phone, role, status, first_name, last_name')
            .eq('id', authId)
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
