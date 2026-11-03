import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { RegisterClientSchema, normalizePhoneNumber } from '@/lib/validations/auth';
import { mTargetService } from '@/lib/sms/mtarget.service';
import { storeOtp } from '@/lib/auth/otp-store';
import { reserveSms } from '@/lib/sms/sms-guard';
import { smsRefusalResponse } from '@/lib/sms/sms-http';
import { getClientIp } from '@/lib/security/client-ip';
import { findExistingAccount } from '@/lib/auth/existing-account';

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

        const assignedRole = 'CLIENT' as const;

        // 1 bis. Lot 1C.9 : un numéro ou un email déjà inscrit ne déclenche aucun SMS (facturé).
        const existing = await findExistingAccount(normalizedPhone, effectiveEmail);
        if (existing) {
            return NextResponse.json(
                { error: 'Ce numéro de téléphone ou cet email est déjà associé à un compte. Veuillez vous connecter.' },
                { status: 409 }
            );
        }

        // 1 ter. Réservation anti-abus (numéro, IP, plafond global) avant d'enregistrer le code.
        const reserved = await reserveSms(normalizedPhone, { category: 'OTP', ip: getClientIp(req) });
        if (!reserved.ok) return smsRefusalResponse(reserved.refusal);

        // 2. Générer et envoyer le SMS OTP EN PREMIER — aucun compte ne sera créé si la livraison échoue
        const otpCode = randomInt(100000, 1000000).toString();
        const otpExpiresAt = Date.now() + 10 * 60 * 1000;

        // Lot 1B.7 : le code est enregistré en base AVANT l'envoi (vérifiable depuis toute instance).
        let otpId: string;
        try {
            otpId = await storeOtp(normalizedPhone, otpCode, new Date(otpExpiresAt), 'REGISTER');
        } catch (storeErr) {
            console.error('[API /api/auth/register]', storeErr instanceof Error ? storeErr.message : storeErr);
            return NextResponse.json({ error: 'Impossible de préparer le code de vérification. Réessayez.' }, { status: 500 });
        }

        // L'adaptateur renvoie success:false sans lever : le résultat est contrôlé (lot 1C.9).
        // Lot 6 (E7) : envoi synchrone journalisé dans la boîte d'envoi, sans le code.
        const smsResult = await mTargetService.sendOtp(normalizedPhone, otpCode, {
            reservation: reserved.reservation,
            purpose: 'REGISTER',
            log: { type: 'OTP_REGISTER', ref: otpId },
        });
        if (!smsResult.success) {
            console.error('[API /api/auth/register] Échec envoi SMS OTP:', smsResult.error);
            return NextResponse.json(
                { error: 'Impossible d\'envoyer le code de vérification SMS. Vérifiez votre numéro et réessayez.' },
                { status: 503 }
            );
        }

        const supabaseAdmin = getServiceRoleClient();

        // 3. Création de l'utilisateur avec Supabase Admin API
        //    phone au niveau racine → auth.users.phone renseigné pour récupération SMS
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: effectiveEmail,
            phone: normalizedPhone,
            password: password,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: {
                first_name: firstName.trim(),
                last_name: lastName.trim(),
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

        // 4. Lien de parrainage : créer referral_relationships si referralCode fourni
        if (referralCode?.trim()) {
            try {
                const code = referralCode.trim().toUpperCase();
                const { data: sponsor } = await supabaseAdmin
                    .from('users')
                    .select('id, referral_status')
                    .eq('referral_code', code)
                    .neq('id', userId)
                    .maybeSingle();

                if (sponsor) {
                    const { data: config } = await supabaseAdmin
                        .from('referral_config')
                        .select('rate_n1, rate_n2, duration_months')
                        .eq('sponsor_status', sponsor.referral_status)
                        .eq('referral_type', 'CLIENT_TO_CLIENT')
                        .eq('is_active', true)
                        .maybeSingle();

                    if (config) {
                        const expiresAt = new Date();
                        expiresAt.setMonth(expiresAt.getMonth() + (config.duration_months as number));

                        await supabaseAdmin.from('referral_relationships').insert({
                            sponsor_id: sponsor.id,
                            referred_id: userId,
                            referral_type: 'CLIENT_TO_CLIENT',
                            sponsor_status_at_creation: sponsor.referral_status,
                            rate_n1_at_creation: config.rate_n1,
                            rate_n2_at_creation: config.rate_n2,
                            duration_months: config.duration_months,
                            expires_at: expiresAt.toISOString(),
                            is_active: true,
                        });
                    }
                }
            } catch (refErr) {
                console.warn('[API /api/auth/register] Erreur création relation parrainage:', refErr);
            }
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
