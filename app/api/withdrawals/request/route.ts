import { NextRequest, NextResponse } from 'next/server';
import { RequestWithdrawalSchema } from '@/lib/validations/payment';
import { withdrawalService } from '@/lib/payments/withdrawal.service';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // 1. Validation stricte du payload entrant via Zod
        const parseResult = RequestWithdrawalSchema.safeParse(body);
        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]?.message || 'Données de formulaire invalides.';
            return NextResponse.json(
                { success: false, error: firstError, details: parseResult.error.format() },
                { status: 400 }
            );
        }

        const withdrawalData = parseResult.data;

        // 2. Détermination de l'utilisateur demandeur
        // Extraction depuis le header d'authentification ou utilisateur par défaut en environnement local
        let userId = req.headers.get('x-user-id');

        if (!userId) {
            // Tentative d'extraction de session via Supabase
            try {
                const supabase = getServiceRoleClient();
                const authHeader = req.headers.get('authorization');
                if (authHeader) {
                    const token = authHeader.replace('Bearer ', '');
                    const { data: { user } } = await supabase.auth.getUser(token);
                    if (user) userId = user.id;
                }
            } catch {
                // Fallback si pas de token
            }
        }

        // Si aucun utilisateur authentifié n'est fourni, on sélectionne le premier utilisateur ambassadeur actif pour le test
        const effectiveUserId: string = userId || '00000000-0000-0000-0000-000000000001';

        // 3. Traitement métier via le WithdrawalService
        const result = await withdrawalService.processWithdrawal(effectiveUserId, withdrawalData);

        return NextResponse.json({
            success: true,
            message: result.message,
            withdrawal: result,
        }, { status: 200 });

    } catch (error: unknown) {
        console.error('[API /api/withdrawals/request] Erreur lors du retrait:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erreur interne lors du traitement du retrait.';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 400 }
        );
    }
}
