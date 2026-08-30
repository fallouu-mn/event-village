import { NextRequest, NextResponse } from 'next/server';
import { RequestWithdrawalSchema } from '@/lib/validations/payment';
import { withdrawalService } from '@/lib/payments/withdrawal.service';
import { getServerSessionUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Authentification requise.' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const parseResult = RequestWithdrawalSchema.safeParse(body);
        if (!parseResult.success) {
            const firstError = parseResult.error.errors[0]?.message || 'Données de formulaire invalides.';
            return NextResponse.json(
                { success: false, error: firstError, details: parseResult.error.format() },
                { status: 400 }
            );
        }

        const result = await withdrawalService.processWithdrawal(user.id, parseResult.data);

        return NextResponse.json({
            success: true,
            message: result.message,
            withdrawal: result,
        }, { status: 200 });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur interne lors du traitement du retrait.';
        return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    }
}
