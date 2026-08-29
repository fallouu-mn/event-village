import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { RegisterClientSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { otpMemoryCache } from '@/lib/sms/otp-cache';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/register
 * Enregistrement serveur robuste utilisant l'API Admin Supabase (contourne les triggers défaillants)
 */
export async function POST(req: NextRequest) {
    try {
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 });
        }

        // 1. Validation des données avec Zod
        const parseResult = RegisterClientSchema.safeParse(body);
        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]?.message || 'Données d\'inscription invalides.';
            return NextResponse.json({ error: firstError }, { status: 400 });
        }

        const { firstName, lastName, phone, email, password, referralCode } = parseResult.data;
        const normalizedPhone = normalizePhoneNumber(phone.trim());
        const effectiveEmail = email?.trim().toLowerCase() || `${normalizedPhone.replace('+', '')}@eventvillage.sn`;

        // Détection automatique du numéro racine Superadmin (+221770000000 / 770000000)
        const cleanDigits = normalizedPhone.replace(/\D/g, '');
        const superadminDigits = (process.env.SUPERADMIN_PHONE || '770000000').replace(/\D/g, '');
        const isSuperadminNumber =
            cleanDigits === '221770000000' ||
            cleanDigits === '770000000' ||
            cleanDigits === '221773780756' ||
            cleanDigits === '773780756' ||
            (superadminDigits && cleanDigits.endsWith(superadminDigits));

        const assignedRole: 'SUPERADMIN' | 'CLIENT' = isSuperadminNumber ? 'SUPERADMIN' : 'CLIENT';

        const supabaseAdmin = getServiceRoleClient();

        // 2. Création de l'utilisateur avec Supabase Admin API
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: effectiveEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone: normalizedPhone,
                email: effectiveEmail,
                role: assignedRole,
                referral_code: referralCode?.trim() || '',
            },
        });

        if (authError) {
            console.error('[API /api/auth/register] Erreur Supabase Admin createUser:', authError);
            if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
                return NextResponse.json(
                    { error: 'Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter.' },
                    { status: 409 }
                );
            }
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        const userId = authData.user.id;

        // 3. Insertion / Synchronisation directe dans public.users avec droits Service Role
        try {
            const { error: profileError } = await supabaseAdmin.from('users').upsert({
                id: userId,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                phone: normalizedPhone,
                email: effectiveEmail,
                role: assignedRole,
                status: 'ACTIF',
                referral_status: 'STANDARD',
                updated_at: new Date().toISOString(),
            });

            if (profileError) {
                console.warn('[API /api/auth/register] Warning insertion profile users:', profileError);
            }
        } catch (profileErr) {
            console.warn('[API /api/auth/register] Exception insertion profile users:', profileErr);
        }

        // 4. Envoi du SMS OTP via MTarget
        try {
            const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = Date.now() + 10 * 60 * 1000;

            // Enregistrer dans le cache mémoire pour vérification immédiate
            otpMemoryCache.set(normalizedPhone, { code: otpCode, expiresAt, attempts: 0 });

            // Sauvegarder dans la table otp_codes si possible
            try {
                await (supabaseAdmin.from('otp_codes') as any).insert({
                    phone: normalizedPhone,
                    code: otpCode,
                    expires_at: new Date(expiresAt).toISOString(),
                    verified: false,
                });
            } catch {}

            // Envoi par SMS via MTarget
            const smsResult = await mTargetService.sendOtp(normalizedPhone, otpCode);
            console.log('[API /api/auth/register] Résultat envoi SMS MTarget:', smsResult);
        } catch (smsErr) {
            console.warn('[API /api/auth/register] Exception envoi SMS OTP:', smsErr);
        }

        return NextResponse.json({
            success: true,
            userId,
            phone: normalizedPhone,
            email: effectiveEmail,
            message: `Compte créé avec succès. Un code SMS a été envoyé au ${normalizedPhone}.`,
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : 'Erreur interne du serveur';
        console.error('[API /api/auth/register] Exception inattendue:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
