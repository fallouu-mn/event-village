import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth, ADMIN_PERMISSIONS, AdminPermission } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';

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
        return apiFailure('GET /api/admin/permissions', error, { message: 'Permissions momentanément indisponibles.', code: 'PERMISSIONS_UNAVAILABLE' });
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

        const validPermissions = permissions.filter((p) =>
            (ADMIN_PERMISSIONS as readonly string[]).includes(p)
        );

        // Lot 9 (A33) : garde de la cible, remplacement et audit dans une transaction ; un échec laisse les droits intacts.
        const { data, error } = await getServiceRoleClient().rpc('admin_permissions_set', {
            p: { admin_id: adminId, permissions: validPermissions, actor_id: auth.user!.id },
        });
        if (error) {
            return apiFailure('POST /api/admin/permissions', error, { message: 'Permissions non enregistrées. Réessayez.', code: 'PERMISSIONS_SAVE_FAILED' });
        }

        const outcome = data as { ok: boolean; code?: string };
        if (!outcome.ok) {
            if (outcome.code === 'TARGET_NOT_FOUND') {
                return NextResponse.json({ error: 'Administrateur cible introuvable.', code: outcome.code }, { status: 404 });
            }
            if (outcome.code === 'TARGET_IS_SUPERADMIN') {
                return NextResponse.json({ error: 'Le Superadmin dispose de toutes les permissions par défaut.', code: outcome.code }, { status: 400 });
            }
            return apiFailure('POST /api/admin/permissions', new Error(`refus inattendu : ${outcome.code}`), { message: 'Permissions non enregistrées. Réessayez.', code: 'PERMISSIONS_SAVE_FAILED' });
        }

        return NextResponse.json({
            success: true,
            adminId,
            permissions: validPermissions,
            message: 'Permissions de l\'administrateur mises à jour avec succès.',
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/admin/permissions', err, { message: 'Permissions non enregistrées. Réessayez.', code: 'PERMISSIONS_SAVE_FAILED' });
    }
}
