import { NextResponse } from 'next/server';
import { NotificationService } from '@/lib/notifications/notification.service';
import { EmailTemplates } from '@/lib/email/email.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/test-notify-superadmins
 * Route QA temporaire — déclenche la triple notification SuperAdmin et retourne le résultat détaillé.
 * À SUPPRIMER avant la mise en production.
 */
export async function GET() {
    const started = Date.now();

    try {
        const result = await NotificationService.notifySuperadmins({
            title: '[TEST QA] Notification de test',
            content: 'Ceci est un test de la triple notification SuperAdmin (In-App + SMS + Email). Si vous voyez ceci, le système fonctionne.',
            type: 'SYSTEM',
            metadata: { test: true, timestamp: new Date().toISOString() },
            smsMessage: 'EV TEST QA: Triple notification SuperAdmin — ce SMS confirme que le canal SMS fonctionne.',
            emailTemplate: EmailTemplates.superadminEventSubmitted({
                partnerName: '[TEST QA]',
                companyName: 'Test Company QA',
                eventTitle: 'Événement de Test — Triple Notification',
            }),
        });

        const elapsed = Date.now() - started;

        return NextResponse.json({
            success: true,
            elapsed_ms: elapsed,
            summary: {
                admins_found: result.adminsFound,
                in_app_inserted: result.inApp,
                sms_results: result.smsResults,
                email_result: result.emailResult,
            },
            diagnostic: {
                admins_zero: result.adminsFound === 0
                    ? 'CRITIQUE: Aucun SUPERADMIN/ADMIN trouvé en base. Vérifiez: SELECT id, email, phone, role FROM users WHERE role IN (\'SUPERADMIN\', \'ADMIN\');'
                    : null,
                in_app_failed: !result.inApp && result.adminsFound > 0
                    ? 'ERREUR: Insert notifications échoué. Vérifiez les logs serveur pour [NOTIFY SUPERADMIN ERROR].'
                    : null,
                sms_failed: result.smsResults.filter(s => !s.success).length > 0
                    ? `${result.smsResults.filter(s => !s.success).length} SMS échoué(s). Vérifiez MTARGET_USERNAME/MTARGET_PASSWORD dans .env.`
                    : null,
                email_failed: result.emailResult && result.emailResult.failed > 0
                    ? `${result.emailResult.failed} email(s) échoué(s). Vérifiez RESEND_API_KEY dans .env. En sandbox Resend, seules les adresses vérifiées reçoivent les emails.`
                    : null,
            },
        });
    } catch (err) {
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : String(err),
            hint: 'Exception non gérée. Consultez les logs serveur.',
        }, { status: 500 });
    }
}
