import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { getServerEnv } from '@/lib/env';
import { getClientIp } from '@/lib/security/client-ip';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/resolve-phone
 * Résout l'adresse email associée à un numéro de téléphone avec les privilèges Service Role (contourne le blocage RLS anonyme)
 *
 * Lot 4.8 : quota par IP en base (RESOLVE_PHONE_PER_IP_HOUR), réservé avant toute lecture du corps :
 * chaque tentative compte, numéro connu ou non, et la garde indisponible refuse (503). Sans IP
 * connue (CLIENT_IP_SOURCE=none ou en-tête absent), les appels partagent le compteur « unknown ».
 */
export async function POST(req: NextRequest) {
    try {
        const quota = await reserveQuota(
            [{ scope: 'resolve_phone_ip', bucket: getClientIp(req) ?? 'unknown', windowSecs: 3600, max: getServerEnv().RESOLVE_PHONE_PER_IP_HOUR }],
            'résolution de numéro'
        );
        if (!quota.allowed) {
            return quotaRefusalResponse(quota, {
                error: 'Trop de requêtes depuis cette connexion. Par sécurité, réessayez plus tard.',
                code: 'RESOLVE_PHONE_RATE_LIMITED',
            });
        }

        let body: { phone?: string };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        const rawPhone = body.phone?.trim();
        if (!rawPhone) {
            return NextResponse.json({ error: 'Numéro de téléphone requis.' }, { status: 400 });
        }

        const normalizedPhone = normalizePhoneNumber(rawPhone);
        const supabase = getServiceRoleClient();

        const { data: userRow, error } = await supabase
            .from('users')
            .select('id, email, phone, role, status')
            .eq('phone', normalizedPhone)
            .maybeSingle();

        if (error) {
            console.error('[API resolve-phone] Erreur query:', error);
            return NextResponse.json({ error: 'Erreur lors de la recherche du compte.' }, { status: 500 });
        }

        if (!userRow) {
            return NextResponse.json(
                { error: 'Aucun compte n\'est associé à ce numéro de téléphone. Veuillez vous inscrire.' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            email: userRow.email || `${normalizedPhone.replace('+', '')}@eventvillage.sn`,
            userId: userRow.id,
            status: userRow.status,
            role: userRow.role,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
