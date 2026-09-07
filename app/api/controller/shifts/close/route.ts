import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionUser } from '@/lib/auth/session';
import { ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

const CloseShiftSchema = z.object({
    shift_id: z.string().uuid('ID de session invalide.'),
    declared_cash_total: z.coerce.number().min(0, 'Le montant déclaré doit être supérieur ou égal à 0.'),
    discrepancy_justification: z.string().optional(),
    regisseur_pin: z.string().min(4, 'Code PIN régisseur requis.').max(6, 'Code PIN régisseur invalide.'),
});

/**
 * POST /api/controller/shifts/close
 * Clôture d'une session de caisse avec Z de caisse.
 * Vérifie :
 * - Appartenance du shift au contrôleur
 * - Code PIN régisseur co-signataire
 * - Justification textuelle obligatoire si écart != 0
 * - Calcul automatique de l'écart
 * - Notification d'alerte en temps réel (SMS + in-app) au partenaire si écart != 0
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const parse = CloseShiftSchema.safeParse(body);
        if (!parse.success) {
            return NextResponse.json({
                error: parse.error.issues[0]?.message || 'Données invalides.',
            }, { status: 400 });
        }

        const { shift_id, declared_cash_total, discrepancy_justification, regisseur_pin } = parse.data;

        const closedShift = await ShiftService.closeShift(user.id, {
            shiftId: shift_id,
            declaredCashTotal: declared_cash_total,
            discrepancyJustification: discrepancy_justification,
            regisseurPin: regisseur_pin,
        });

        const summary = await ShiftService.getShiftSummary(closedShift.id);

        return NextResponse.json({
            success: true,
            shift: closedShift,
            summary,
            message: closedShift.discrepancy_amount === 0
                ? 'Session de caisse clôturée avec succès sans aucun écart.'
                : `Session de caisse clôturée avec écart constaté de ${closedShift.discrepancy_amount} FCFA. L'organisateur a été notifié.`,
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne.';
        console.error('[API controller/shifts/close POST]', msg);
        const status = msg.includes('PIN') ? 401 : 400;
        return NextResponse.json({ error: msg }, { status });
    }
}
