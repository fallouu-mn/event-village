import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/users
 * Récupère la liste réelle des utilisateurs avec recherche, filtres et métriques de parrainage
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.read' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const { searchParams } = new URL(req.url);
        const roleFilter = searchParams.get('role');
        const referralFilter = searchParams.get('referralStatus');
        const search = searchParams.get('search')?.trim();

        const supabase = getServiceRoleClient();

        let query = supabase
            .from('users')
            .select(`
                id,
                first_name,
                last_name,
                email,
                phone,
                role,
                status,
                referral_status,
                created_at,
                updated_at
            `)
            .order('created_at', { ascending: false });

        if (roleFilter && roleFilter !== 'ALL') {
            query = query.eq('role', roleFilter as any);
        }

        if (referralFilter && referralFilter !== 'ALL') {
            query = query.eq('referral_status', referralFilter as any);
        }

        if (search) {
            query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
        }

        const { data: users, error } = await query;

        if (error) {
            console.error('[API /api/admin/users] Erreur:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            users: users || [],
            total: users?.length || 0,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/admin/users] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

/**
 * POST /api/admin/users
 * Création directe et atomique d'un utilisateur métier (Contrôleur, Admin, Client, Superadmin)
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.write' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        let body: any;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const { firstName, lastName, phone, email, password, role } = body;

        if (!firstName || !lastName || !phone || !password) {
            return NextResponse.json({ error: 'Nom, prénom, téléphone et mot de passe requis.' }, { status: 400 });
        }

        const targetRole = role || 'CLIENT';

        // Protection contre l'élévation de privilèges
        if (targetRole === 'SUPERADMIN' && auth.user!.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Seul un Superadmin peut créer un compte SUPERADMIN.' },
                { status: 403 }
            );
        }

        const normalizedPhone = phone.trim().startsWith('+') ? phone.trim() : `+221${phone.trim().replace(/^0+/, '').replace(/\s+/g, '')}`;
        const effectiveEmail = email?.trim() 
            ? email.trim().toLowerCase() 
            : `${normalizedPhone.replace('+', '')}@eventvillage.internal`;
        const supabase = getServiceRoleClient();

        // 1. Création dans Supabase Auth
        //    phone au niveau racine → auth.users.phone renseigné pour récupération SMS
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email: effectiveEmail,
            phone: normalizedPhone,
            password: password,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                role: targetRole,
            },
        });

        if (authErr) {
            console.error('[API /api/admin/users POST] Erreur auth admin:', authErr);
            return NextResponse.json({ error: authErr.message }, { status: 400 });
        }

        const userId = authData.user.id;

        // 2. Synchronisation dans public.users
        const { error: upsertErr } = await supabase.from('users').upsert({
            id: userId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: normalizedPhone,
            email: effectiveEmail,
            role: targetRole,
            status: 'ACTIF',
            referral_status: 'STANDARD',
            updated_at: new Date().toISOString(),
        });

        if (upsertErr) {
            console.error('[API /api/admin/users POST] Erreur upsert public.users:', upsertErr);
            return NextResponse.json({ error: upsertErr.message }, { status: 500 });
        }

        // 3. Journal d'audit inaltérable
        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: auth.user!.role,
            action: 'CREATE_USER',
            objectType: 'users',
            objectId: userId,
            newValue: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone: normalizedPhone,
                role: targetRole,
            },
            metadata: { created_by: auth.user!.role },
        });

        return NextResponse.json({
            success: true,
            userId,
            message: `Utilisateur avec le rôle ${targetRole} créé avec succès.`,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/users
 * Mise à jour du rôle ou du statut Ambassadeur d'un utilisateur
 */
export async function PATCH(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.write' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        let body: { userId?: string; role?: string; referralStatus?: 'STANDARD' | 'AMBASSADEUR'; status?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const { userId, role, referralStatus, status } = body;
        if (!userId) {
            return NextResponse.json({ error: 'userId requis.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // 1. Récupération du profil cible
        const { data: targetUser, error: targetErr } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (targetErr || !targetUser) {
            return NextResponse.json({ error: 'Utilisateur cible introuvable.' }, { status: 404 });
        }

        // 2. Protection contre l'élévation de privilèges Superadmin
        if (role === 'SUPERADMIN' && auth.user!.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Seul un Superadmin peut élever un utilisateur au rang de SUPERADMIN.' },
                { status: 403 }
            );
        }

        // 3. Protection contre la modification d'un Superadmin par un Admin ordinaire
        if (targetUser.role === 'SUPERADMIN' && auth.user!.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Impossible de modifier un compte SUPERADMIN sans être soi-même SUPERADMIN.' },
                { status: 403 }
            );
        }

        const updatePayload: any = { updated_at: new Date().toISOString() };
        if (role) updatePayload.role = role;
        if (referralStatus) updatePayload.referral_status = referralStatus;
        if (status) updatePayload.status = status;

        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('[API /api/admin/users PATCH] Erreur:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // 4. Journal d'audit inaltérable
        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: auth.user!.role,
            action: 'UPDATE_USER',
            objectType: 'users',
            objectId: userId,
            oldValue: { role: targetUser.role, referral_status: targetUser.referral_status, status: targetUser.status },
            newValue: updatePayload,
            metadata: { target_email: targetUser.email },
        });

        return NextResponse.json({
            success: true,
            user: updatedUser,
            message: 'Utilisateur mis à jour avec succès.',
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/users
 * Suppression définitive d'un compte utilisateur (Auth + Base de données)
 */
export async function DELETE(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.write' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const url = new URL(req.url);
        let userId = url.searchParams.get('userId');

        if (!userId) {
            try {
                const body = await req.json();
                userId = body.userId;
            } catch {
                // Ignore
            }
        }

        if (!userId) {
            return NextResponse.json({ error: 'userId requis.' }, { status: 400 });
        }

        // Protection : interdiction de supprimer son propre compte
        if (userId === auth.user!.id) {
            return NextResponse.json(
                { error: 'Impossible de supprimer votre propre compte administrateur.' },
                { status: 400 }
            );
        }

        const supabase = getServiceRoleClient();

        // 1. Récupération des infos utilisateur
        const { data: targetUser } = await supabase
            .from('users')
            .select('id, phone, email, role')
            .eq('id', userId)
            .maybeSingle();

        if (targetUser?.role === 'SUPERADMIN' && auth.user!.role !== 'SUPERADMIN') {
            return NextResponse.json(
                { error: 'Seul un Superadmin peut supprimer un compte SUPERADMIN.' },
                { status: 403 }
            );
        }

        // 2. Nettoyage en cascade des tables liées
        await supabase.from('partners').delete().eq('user_id', userId);
        await supabase.from('tickets').delete().eq('user_id', userId);
        await supabase.from('orders').delete().eq('user_id', userId);
        await supabase.from('referral_relationships').delete().or(`referrer_id.eq.${userId},referred_id.eq.${userId}`);
        await supabase.from('referral_commissions').delete().eq('referrer_id', userId);
        await supabase.from('users').delete().eq('id', userId);

        // 3. Suppression dans Supabase Auth
        await supabase.auth.admin.deleteUser(userId);

        // 4. Journal d'audit inaltérable
        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: auth.user!.role,
            action: 'DELETE_USER',
            objectType: 'users',
            objectId: userId,
            oldValue: targetUser,
            metadata: { deleted_by: auth.user!.role },
        });

        return NextResponse.json({
            success: true,
            message: 'Compte utilisateur définitivement supprimé.',
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
