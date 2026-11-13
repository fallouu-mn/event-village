import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

const PRICING_SAVE_FALLBACK = { message: 'Réglage non enregistré. Réessayez.', code: 'PRICING_SAVE_FAILED' };

/**
 * Lot 9 quater (B1 : AUD-22, G-01) : seules les clés tarifaires de cette route sont écrites (liste blanche). Toute autre
 * clé de platform_settings, dont les interrupteurs features.* (salles, tables, commandes), passe par
 * /api/admin/finance-settings (SUPERADMIN, valeur validée, motif et historique).
 */
const PRICING_KEYS: readonly string[] = ['subscription_packs', 'aggregator_fees', 'communication_tariffs'];

/**
 * GET /api/admin/pricing
 * Récupère l'ensemble des grilles tarifaires et paramètres de la plateforme (§117, §118, §119, §126)
 */
export async function GET(req: NextRequest) {
    // Lot 9 quater (B5 : AUD-37) : lecture des réglages avec la permission « Lire les réglages »
    const auth = await verifyAdminAuth(req, { requiredPermission: 'settings.read' });
    if (!auth.authorized) return auth.errorResponse!;

    const supabase = getServiceRoleClient();
    const { data: settings, error } = await supabase.from('platform_settings').select('*');

    if (error) {
        return apiFailure('GET /api/admin/pricing', error, { message: 'Tarifs momentanément indisponibles.', code: 'PRICING_UNAVAILABLE' });
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
        // Lot 3, lot 4 et lot 6 : les réglages financiers (finance.*), du contrôle d'accès (access.*) et des
        // notifications (notif.*) ne passent que par /api/admin/finance-settings (SUPERADMIN, valeur validée
        // et historisée en base) ; cette route écrit avec le service_role.
        if (String(key).startsWith('finance.')) {
            return NextResponse.json({ error: 'Réglage financier : utilisez /api/admin/finance-settings (SUPERADMIN).', code: 'FINANCE_SETTING' }, { status: 403 });
        }
        if (String(key).startsWith('access.')) {
            return NextResponse.json({ error: 'Réglage du contrôle d’accès : utilisez /api/admin/finance-settings (SUPERADMIN).', code: 'ACCESS_SETTING' }, { status: 403 });
        }
        if (String(key).startsWith('notif.')) {
            return NextResponse.json({ error: 'Réglage des notifications : utilisez /api/admin/finance-settings (SUPERADMIN).', code: 'NOTIF_SETTING' }, { status: 403 });
        }
        if (!PRICING_KEYS.includes(String(key))) {
            return NextResponse.json({
                error: 'Ce réglage ne se change pas ici : utilisez les Réglages de la plateforme (SUPERADMIN).',
                code: 'PRICING_KEY_NOT_ALLOWED',
            }, { status: 403 });
        }

        const supabase = getServiceRoleClient();

        // Récupérer l'ancienne valeur pour l'audit log
        const { data: current, error: currentErr } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', key)
            .maybeSingle();

        // Lot 9 (A34) : sans l'ancienne valeur, l'audit serait faux ; rien n'est écrit.
        if (currentErr) return apiFailure('POST /api/admin/pricing, ancienne valeur', currentErr, PRICING_SAVE_FALLBACK);

        const { error: upsertErr } = await supabase.from('platform_settings').upsert({
            key,
            value,
            description: description || undefined,
            updated_by: auth.user!.id,
            updated_at: new Date().toISOString(),
        });

        if (upsertErr) return apiFailure('POST /api/admin/pricing', upsertErr, PRICING_SAVE_FALLBACK);

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
        return apiFailure('POST /api/admin/pricing', err, PRICING_SAVE_FALLBACK);
    }
}
