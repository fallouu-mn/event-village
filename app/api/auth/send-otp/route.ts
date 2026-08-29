import { NextRequest, NextResponse } from 'next/server';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { normalizePhoneNumber } from '@/lib/validations/auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { otpMemoryCache } from '@/lib/sms/otp-cache';

export const dynamic = 'force-dynamic';

function generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * POST /api/auth/send-otp
 * Génère un code OTP sécurisé et l'envoie par SMS via MTarget
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
        if (!/^\+221[7][05678]\d{7}$/.test(normalizedPhone)) {
            return NextResponse.json(
                { error: 'Numéro de téléphone sénégalais invalide (ex: 77 123 45 67).' },
                { status: 400 }
            );
        }

        // 1. Génération du code OTP à 6 chiffres
        const otpCode = generateOtpCode();
        const expiresAt = Date.now() + 10 * 60 * 1000; // Valide 10 minutes

        // 2. Sauvegarde en mémoire cache
        otpMemoryCache.set(normalizedPhone, { code: otpCode, expiresAt, attempts: 0 });

        // 3. Sauvegarde en base de données Supabase (si table otp_codes existante)
        try {
            const supabase = getServiceRoleClient();
            await (supabase.from('otp_codes') as any).insert({
                phone: normalizedPhone,
                code: otpCode,
                expires_at: new Date(expiresAt).toISOString(),
                verified: false,
            });
        } catch (dbErr) {
            // Fallback silencieux
        }

        // 4. Envoi effectif du SMS par MTarget
        const sendResult = await mTargetService.sendOtp(normalizedPhone, otpCode);
        console.log(`[API /api/auth/send-otp] MTarget Result pour ${normalizedPhone}:`, sendResult);

        if (!sendResult.success) {
            console.error('[API send-otp] Échec MTarget:', sendResult.error);
            return NextResponse.json(
                {
                    error: sendResult.error || 'Impossible d\'envoyer le SMS.',
                    recipient: sendResult.recipient,
                },
                { status: 502 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Code de confirmation envoyé par SMS au ${normalizedPhone}.`,
            recipient: sendResult.recipient,
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur interne du serveur';
        console.error('[API send-otp] Exception:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
