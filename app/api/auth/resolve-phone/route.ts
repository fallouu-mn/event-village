import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { normalizePhoneNumber } from '@/lib/validations/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/resolve-phone
 * Résout l'adresse email associée à un numéro de téléphone avec les privilèges Service Role (contourne le blocage RLS anonyme)
 */
export async function POST(req: NextRequest) {
    try {
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

        // Protection Anti-Force Brute (Rate Limiting)
        const { RateLimiter } = await import('@/lib/security/rate-limiter');
        const limitCheck = await RateLimiter.isRateLimited(normalizedPhone);
        if (limitCheck.limited) {
            return NextResponse.json(
                {
                    error: `Trop de requêtes pour ce numéro. Par sécurité, veuillez patienter ${limitCheck.remainingSeconds || 60} secondes.`,
                    remainingSeconds: limitCheck.remainingSeconds || 60,
                },
                { status: 429 }
            );
        }

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
            await RateLimiter.recordFailedAttempt(normalizedPhone);
            return NextResponse.json(
                { error: 'Aucun compte n\'est associé à ce numéro de téléphone. Veuillez vous inscrire.' },
                { status: 404 }
            );
        }

        await RateLimiter.resetAttempts(normalizedPhone);
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
