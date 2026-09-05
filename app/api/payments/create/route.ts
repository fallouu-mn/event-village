import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/lib/payments/payment.service';
import { getServerSessionUser } from '@/lib/auth/session';
import { CreatePaymentSchema } from '@/lib/validations/payment';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        // 1. Authentification via session serveur (cookies SSR ou Bearer token)
        const user = await getServerSessionUser(req);

        console.log(
            '[API /api/payments/create] Requête reçue —',
            'Cookies présents:', req.cookies.getAll().length > 0 ? 'oui' : 'non',
            '— Utilisateur authentifié:', user ? 'oui' : 'non',
            user ? `— User ID: ${user.id}` : ''
        );

        if (!user) {
            console.warn('[API /api/payments/create] 401 — Aucune session trouvée (ni cookie SSR, ni Bearer token)');
            return NextResponse.json(
                { success: false, error: 'Authentification requise pour initier un paiement.' },
                { status: 401 }
            );
        }

        // 2. Validation du corps de la requête avec Zod
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
            console.error('[API /api/payments/create] Zod validation error:', JSON.stringify(parseResult.error.errors, null, 2));
            console.error('[API /api/payments/create] Body reçu:', JSON.stringify(body));
            return NextResponse.json(
                {
                    success: false,
                    error: 'Données de paiement invalides.',
                    details: parseResult.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        // 3. Exécution du service de paiement (userId vérifié côté serveur, jamais depuis le body)
        const result = await paymentService.createPayment(user.id, parseResult.data);

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
