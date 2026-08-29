import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pricing
 * Récupère l'ensemble des grilles tarifaires et paramètres de la plateforme (§117, §118, §119, §126)
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req);
    if (!auth.authorized) return auth.errorResponse!;

    const supabase = getServiceRoleClient();
    const { data: settings, error } = await supabase.from('platform_settings').select('*');

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const configMap: Record<string, any> = {};
    settings?.forEach((s) => {
        configMap[s.key] = s.value;
    });

    return NextResponse.json({
        success: true,
        settings: configMap,
    });
}

/**
 * POST /api/admin/pricing
 * Met à jour une grille tarifaire (Packs partenaires, Frais agrégateur, Tarifs communication, Retraits)
 */
export async function POST(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'pricing.manage' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        let body: { key: string; value: any; description?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const { key, value, description } = body;
        if (!key || !value) {
            return NextResponse.json({ error: 'Clé et valeur requises.' }, { status: 400 });
        }

        const supabase = getServiceRoleClient();

        // Récupérer l'ancienne valeur pour l'audit log
        const { data: current } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', key)
            .maybeSingle();

        const { error: upsertErr } = await supabase.from('platform_settings').upsert({
            key,
            value,
            description: description || undefined,
            updated_by: auth.user!.id,
            updated_at: new Date().toISOString(),
        });

        if (upsertErr) {
            return NextResponse.json({ error: upsertErr.message }, { status: 500 });
        }

        // Journalisation inaltérable
        await AdminService.logAudit({
            userId: auth.user!.id,
            userRole: auth.user!.role,
            action: 'UPDATE_PRICING',
            objectType: 'platform_settings',
            oldValue: current?.value || null,
            newValue: value,
            metadata: { key },
        });

        return NextResponse.json({
            success: true,
            key,
            message: `Grille tarifaire "${key}" mise à jour avec succès.`,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
