import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users/[id]/anonymize
 * DELETE /api/admin/users/[id]/anonymize
 * Anonymisation sécurisée RGPD & Soft Delete Superadmin
 */
async function handleAnonymize(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'users.write' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const params = await context.params;
        const userId = params?.id;

        if (!userId) {
            return NextResponse.json({ error: 'ID utilisateur requis.' }, { status: 400 });
        }

        const result = await AdminService.anonymizeUser(userId, {
            id: auth.user!.id,
            role: auth.user!.role,
        });

        return NextResponse.json({
            success: true,
            message: result.message,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne lors de l\'anonymisation.';
        console.error('[API /api/admin/users/[id]/anonymize] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 400 });
    }
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    return handleAnonymize(req, context);
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    return handleAnonymize(req, context);
}