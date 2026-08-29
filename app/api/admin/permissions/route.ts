import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth, ADMIN_PERMISSIONS, AdminPermission } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/permissions?adminId=...
 * Récupère les permissions d'un Admin (ou la liste globale des permissions disponibles)
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;

    const { searchParams } = new URL(req.url);
    const targetAdminId = searchParams.get('adminId');

    const supabase = getServiceRoleClient();

    if (!targetAdminId) {
        // Renvoie toutes les permissions attribuables
        return NextResponse.json({
            availablePermissions: ADMIN_PERMISSIONS,
        });
    }

    const { data: permissions, error } = await supabase
        .from('admin_permissions')
        .select('*')
        .eq('user_id', targetAdminId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        availablePermissions: ADMIN_PERMISSIONS,
        assignedPermissions: permissions?.map((p) => p.permission) || [],
    });
}

/**
 * POST /api/admin/permissions
 * Attribue ou révoque des permissions granulaires pour un profil ADMIN (SUPERADMIN STRICT)
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requireSuperadmin: true });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        let body: { adminId: string; permissions: string[] };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const { adminId, permissions } = body;
        if (!adminId || !Array.isArray(permissions)) {
            return NextResponse.json({ error: 'adminId et tableau de permissions requis.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // 1. Vérifier que la cible est bien un ADMIN (un Superadmin a déjà tous les droits)
        const { data: targetUser } = await supabase
            .from('users')
            .select('id, role, email')
            .eq('id', adminId)
            .maybeSingle();

        if (!targetUser) {
            return NextResponse.json({ error: 'Administrateur cible introuvable.' }, { status: 404 });
        }

        if (targetUser.role === 'SUPERADMIN') {
            return NextResponse.json({ error: 'Le Superadmin dispose de toutes les permissions par défaut.' }, { status: 400 });
        }

        // 2. Suppression des anciennes permissions
        await supabase.from('admin_permissions').delete().eq('user_id', adminId);

        // 3. Insertion des nouvelles permissions valides
        const validPermissions = permissions.filter((p) =>
            (ADMIN_PERMISSIONS as readonly string[]).includes(p)
        );

        if (validPermissions.length > 0) {
            const rowsToInsert = validPermissions.map((perm) => ({
                user_id: adminId,
                permission: perm,
                granted_by: auth.user!.id,
            }));
            await supabase.from('admin_permissions').insert(rowsToInsert);
        }

        // 4. Audit Log
        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: 'SUPERADMIN',
            action: 'UPDATE_PERMISSIONS',
            objectType: 'admin_permissions',
            objectId: adminId,
            newValue: { permissions: validPermissions },
            metadata: { target_email: targetUser.email },
        });

        return NextResponse.json({
            success: true,
            adminId,
            permissions: validPermissions,
            message: 'Permissions de l\'administrateur mises à jour avec succès.',
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
