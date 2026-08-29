import { getServiceRoleClient } from '@/lib/supabase/server';
import { NotificationService } from '@/lib/notifications/notification.service';
import { AdminService } from '@/lib/admin/admin.service';

export class SensitiveActionService {
    /**
     * Initie une opération sensible en générant et envoyant un code OTP de sécurité
     */
    static async initiateSensitiveAction(params: {
        userId: string;
        userPhone: string;
        actionName: string;
        metadata?: any;
    }): Promise<{ success: boolean; message: string }> {
        const supabase = getServiceRoleClient();

        // Génération d'un code OTP sécurisé à 6 chiffres
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        // Insertion dans la table public.otp_codes
        await supabase.from('otp_codes').insert({
            phone: params.userPhone,
            code,
            expires_at: expiresAt,
            verified: false,
            attempts: 0,
        });

        // Envoi de la notification SMS
        await NotificationService.sendSensitiveActionOtpNotification({
            phone: params.userPhone,
            actionName: params.actionName,
            code,
            userId: params.userId,
        });

        return {
            success: true,
            message: `Un code de sécurité a été envoyé par SMS au ${params.userPhone}.`,
        };
    }

    /**
     * Valide l'OTP d'une opération sensible
     */
    static async verifySensitiveActionOtp(params: {
        userId: string;
        userPhone: string;
        code: string;
        actionName: string;
    }): Promise<{ verified: boolean; error?: string }> {
        const supabase = getServiceRoleClient();

        const { data: otpRow, error } = await supabase
            .from('otp_codes')
            .select('*')
            .eq('phone', params.userPhone)
            .eq('verified', false)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error || !otpRow) {
            return { verified: false, error: 'Aucun code de sécurité en attente ou code déjà utilisé.' };
        }

        // Vérification d'expiration
        if (new Date(otpRow.expires_at) < new Date()) {
            return { verified: false, error: 'Le code de sécurité a expiré. Veuillez en redemander un.' };
        }

        // Vérification de concordance du code
        if (otpRow.code !== params.code.trim()) {
            await supabase
                .from('otp_codes')
                .update({ attempts: (otpRow.attempts || 0) + 1 })
                .eq('id', otpRow.id);

            return { verified: false, error: 'Code de sécurité incorrect.' };
        }

        // Marquer comme vérifié
        await supabase
            .from('otp_codes')
            .update({ verified: true })
            .eq('id', otpRow.id);

        // Journaliser l'opération sensible
        await AdminService.logAudit({
            userId: params.userId,
            userRole: 'CLIENT',
            action: 'SENSITIVE_ACTION_VERIFIED',
            objectType: 'security',
            metadata: { actionName: params.actionName, phone: params.userPhone },
        });

        return { verified: true };
    }
}
