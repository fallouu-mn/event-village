import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/payments/payment.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // 1. Extraction des données du formulaire multipart/urlencoded
        const formData = await req.formData();

        // 2. Traitement sécurisé et idempotent via le service de paiement
        const result = await paymentService.handleSamirPayWebhook(formData);

        // 3. Réponse HTTP 200 obligatoire et rapide au fournisseur
        return NextResponse.json(
            {
                received: true,
                success: result.success,
                message: result.message,
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        console.error('[API Webhook SamirPay] Erreur critique lors du traitement:', error);

        // Même en cas d'erreur de traitement interne, on retourne une réponse 200 structurée
        // pour éviter des boucles d'appels répétés du provider avant vérification des logs
        return NextResponse.json(
            {
                received: true,
                success: false,
                error: error instanceof Error ? error.message : 'Erreur de traitement webhook.',
            },
            { status: 200 }
        );
    }
}
