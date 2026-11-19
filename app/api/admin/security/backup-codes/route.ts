import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { requireAdminIdentity } from '@/lib/admin/identity-check';
import { backupCodeHash, newBackupCodes } from '@/lib/admin/backup-codes';
import { noStore } from '@/lib/auth/account-sync';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function superadminOnly(): NextResponse {
    return NextResponse.json({ error: 'Les codes de secours sont réservés aux super-administrateurs.', code: 'SUPERADMIN_ONLY' }, { status: 403, headers: NO_STORE });
}

const REFUSALS: Readonly<Record<string, number>> = {
    SUPERADMIN_ONLY: 403,
    PASSWORD_CONFIRMATION_REQUIRED: 403,
    ADMIN_CODE_CONFIRMATION_REQUIRED: 403,
    INVALID_INPUT: 400,
};

/**
 * GET /api/admin/security/backup-codes — finition 3d (point 2b) : nombre de codes de secours restants du SUPERADMIN connecté
 * et date de création. Jamais les codes : ils ne se relisent pas.
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    if (!auth.user!.roles.includes('SUPERADMIN')) return superadminOnly();
    const { data, error } = await getServiceRoleClient().rpc('admin_backup_codes_status', { p: { user_id: auth.user!.id } });
    if (error) {
        console.error('[GET /api/admin/security/backup-codes]', error.message);
        return NextResponse.json({ error: 'Codes de secours momentanément illisibles. Réessayez.', code: 'BACKUP_CODES_UNAVAILABLE' }, { status: 503, headers: NO_STORE });
    }
    const reply = data as { remaining?: number; generated_at?: string | null } | null;
    return NextResponse.json({ remaining: Number(reply?.remaining ?? 0), generated_at: reply?.generated_at ?? null }, { headers: NO_STORE });
}

/**
 * POST /api/admin/security/backup-codes — finition 3d (point 2b) : crée 10 codes de secours (les anciens sont annulés).
 * Mot de passe et code administrateur saisis depuis moins de 10 minutes (requireAdminIdentity, revérifiés en base). Les
 * codes sont rendus ici une seule fois, en clair ; la base n'en garde que l'empreinte. 200 { codes, remaining, generated_at }.
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;
    if (!auth.user!.roles.includes('SUPERADMIN')) return superadminOnly();
    const identity = await requireAdminIdentity(req, auth.user!.id);
    if (!identity.ok) return noStore(identity.response);
    const codes = newBackupCodes();
    const { data, error } = await getServiceRoleClient().rpc('admin_backup_codes_generate', {
        p: { user_id: auth.user!.id, session_id: identity.sessionId, device_key: identity.deviceKey, hashes: codes.map((c) => backupCodeHash(auth.user!.id, c)) },
    });
    if (error) {
        console.error('[POST /api/admin/security/backup-codes]', error.message);
        return NextResponse.json({ error: 'Les codes de secours n’ont pas pu être créés. Réessayez.', code: 'BACKUP_CODES_FAILED' }, { status: 500, headers: NO_STORE });
    }
    const reply = data as { ok?: boolean; code?: string; message?: string; remaining?: number; generated_at?: string } | null;
    if (reply?.ok !== true) {
        const status = REFUSALS[String(reply?.code)];
        if (!status) {
            console.error('[POST /api/admin/security/backup-codes] refus inattendu :', JSON.stringify(reply));
            return NextResponse.json({ error: 'Les codes de secours n’ont pas pu être créés. Réessayez.', code: 'BACKUP_CODES_FAILED' }, { status: 500, headers: NO_STORE });
        }
        return NextResponse.json({ error: reply?.message ?? 'Refusé.', code: reply?.code }, { status, headers: NO_STORE });
    }
    return NextResponse.json({ codes, remaining: reply.remaining ?? codes.length, generated_at: reply.generated_at ?? null }, { headers: NO_STORE });
}
