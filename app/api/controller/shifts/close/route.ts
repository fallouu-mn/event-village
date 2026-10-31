import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { asShiftRefusal, ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

// Deux nommages acceptés : contrat du lot 4 (shiftId, declaredCashTotal, …) et écran historique.
const CloseShiftSchema = z.object({
    shiftId: z.string().uuid('ID de session invalide.').optional(),
    shift_id: z.string().uuid('ID de session invalide.').optional(),
    declaredCashTotal: z.coerce.number().min(0, 'Le montant déclaré doit être supérieur ou égal à 0.').optional(),
    declared_cash_total: z.coerce.number().min(0, 'Le montant déclaré doit être supérieur ou égal à 0.').optional(),
    discrepancyJustification: z.string().max(1000).optional().nullable(),
    discrepancy_justification: z.string().max(1000).optional().nullable(),
    regisseurPin: z.string().trim().max(8, 'Code PIN régisseur invalide.').optional().nullable(),
    regisseur_pin: z.string().trim().max(8, 'Code PIN régisseur invalide.').optional().nullable(),
}).transform((d) => ({
    shiftId: d.shiftId ?? d.shift_id ?? '',
    declared: d.declaredCashTotal ?? d.declared_cash_total,
    justification: d.discrepancyJustification ?? d.discrepancy_justification ?? undefined,
    regisseurPin: d.regisseurPin ?? d.regisseur_pin ?? '',
})).refine((d) => !!d.shiftId, { message: 'ID de session requis.' })
    .refine((d) => d.declared !== undefined, { message: 'Montant déclaré requis.' });

/**
 * POST /api/controller/shifts/close — clôture d'une session de caisse avec Z de caisse (lot 4) :
 * caisse du compte appelant et encore ouverte, PIN régisseur co-signataire (quota par caisse),
 * justification obligatoire en cas d'écart, clôture conditionnelle (une seule fois), journal,
 * alerte au partenaire si écart.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;

    const body = await req.json().catch(() => null);
    const parsed = CloseShiftSchema.safeParse(body ?? {});
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Données invalides.', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const closed = await ShiftService.closeShift(session.user.id, {
            shiftId: parsed.data.shiftId,
            declaredCashTotal: Number(parsed.data.declared),
            discrepancyJustification: parsed.data.justification ?? undefined,
            regisseurPin: parsed.data.regisseurPin,
        });
        const summary = await ShiftService.getShiftSummary(closed.id, { id: session.user.id, isAdmin: serverIsAdmin(session.user) });
        const discrepancy = Number(closed.discrepancy_amount ?? 0);
        return NextResponse.json({
            success: true,
            shift: closed,
            summary,
            message: discrepancy === 0
                ? 'Session de caisse clôturée sans écart.'
                : `Session de caisse clôturée avec un écart de ${discrepancy} FCFA. L'organisateur a été alerté.`,
        });
    } catch (err: unknown) {
        const refusal = asShiftRefusal(err);
        if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
        console.error('[API controller/shifts/close POST]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Clôture de caisse momentanément impossible.', code: 'SHIFT_CLOSE_FAILED' }, { status: 500 });
    }
}
