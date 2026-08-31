import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/payments/payment.service';
import { getServerClient } from '@/lib/supabase/server';
import { CreatePaymentSchema } from '@/lib/validations/payment';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // 1. Récupération du header d'autorisation
        const authHeader = req.headers.get('Authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

        if (!token) {
            return NextResponse.json(
                { success: false, error: 'Authentification requise pour initier un paiement.' },
                { status: 401 }
            );
        }

        // 2. Vérification de la session utilisateur auprès de Supabase
        const supabase = getServerClient(token);
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: 'Session utilisateur invalide ou expirée.' },
                { status: 401 }
            );
        }

        // 3. Validation du corps de la requête avec Zod
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                { success: false, error: 'Corps de requête JSON invalide.' },
                { status: 400 }
            );
        }

        const parseResult = CreatePaymentSchema.safeParse(body);
        if (!parseResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Données de paiement invalides.',
                    details: parseResult.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        // 4. Exécution du service de paiement
        const result = await paymentService.createPayment(user.id, parseResult.data, token);

        return NextResponse.json(result, { status: 201 });
    } catch (error: unknown) {
        console.error('[API /api/payments/create] Erreur:', error instanceof Error ? error.message : 'unknown');

        const errorMessage = error instanceof Error ? error.message : 'Erreur interne du serveur lors de la création du paiement.';

        return NextResponse.json(
            {
                success: false,
                error: errorMessage,
            },
            { status: 400 }
        );
    }
}
