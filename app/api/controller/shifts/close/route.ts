import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminPermission } from '@/lib/auth/event-access';
import { requireActiveSession, serverIsAdmin } from '@/lib/auth/session';
import { asShiftRefusal, ShiftService, DISCREPANCY_PENDING_MESSAGE } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

// Contrat C2 du lot 5 : { shiftId, declaredCashTotal, justification?, regisseurPin? }. Les anciens noms
// (snake_case de l'écran historique, discrepancyJustification) restent acceptés.
const CloseShiftSchema = z.object({
    shiftId: z.string().uuid('Identifiant de caisse invalide.').optional(),
    shift_id: z.string().uuid('Identifiant de caisse invalide.').optional(),
    declaredCashTotal: z.coerce.number({ invalid_type_error: 'Montant déclaré invalide.' }).optional(),
    declared_cash_total: z.coerce.number({ invalid_type_error: 'Montant déclaré invalide.' }).optional(),
    justification: z.string().max(1000, 'La justification est limitée à 1 000 caractères.').optional().nullable(),
    discrepancyJustification: z.string().max(1000, 'La justification est limitée à 1 000 caractères.').optional().nullable(),
    discrepancy_justification: z.string().max(1000, 'La justification est limitée à 1 000 caractères.').optional().nullable(),
    regisseurPin: z.string().trim().max(8, 'Code PIN régisseur invalide.').optional().nullable(),
    regisseur_pin: z.string().trim().max(8, 'Code PIN régisseur invalide.').optional().nullable(),
}).transform((d) => ({
    shiftId: d.shiftId ?? d.shift_id ?? '',
    declared: d.declaredCashTotal ?? d.declared_cash_total,
    justification: d.justification ?? d.discrepancyJustification ?? d.discrepancy_justification ?? null,
    regisseurPin: d.regisseurPin ?? d.regisseur_pin ?? null,
})).refine((d) => !!d.shiftId, { message: 'Identifiant de caisse requis.' })
    .refine((d) => d.declared !== undefined && Number.isFinite(d.declared), { message: 'Montant déclaré requis.' });

/**
 * POST /api/controller/shifts/close — clôture d'une caisse (Z de caisse), lot 5 (C2) : par le
 * contrôleur de la caisse, le partenaire propriétaire ou un admin (lot 9 bis : muni de events.write) ; montant entier ≥ 0 ; en cas
 * d'écart, justification (10 caractères au moins) et co-signature par le PIN régisseur (quota par
 * caisse) ; une seule clôture (verrou de la caisse, la seconde reçoit 409 SHIFT_NOT_OPEN) ; alerte
 * d'écart au partenaire mise en file dans la même transaction (lot 6 : `alert_queued`, aucun SMS
 * envoyé par la route).
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;

    const body = await req.json().catch(() => null);
    const parsed = CloseShiftSchema.safeParse(body ?? {});
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Données invalides.', code: 'INVALID_BODY' }, { status: 400 });
    }

    // Lot 9 bis (R17, B49) : un admin ferme la caisse d'un autre avec events.write seulement (SUPERADMIN toujours) ;
    // sans elle, il n'est traité que comme contrôleur de sa propre caisse, et sinon reçoit 403 PERMISSION_MISSING.
    let isAdmin = false;
    let adminRefusal: NextResponse | null = null;
    if (serverIsAdmin(session.user)) {
        adminRefusal = await requireAdminPermission(session.user, 'events.write');
        if (adminRefusal && adminRefusal.status !== 403) return adminRefusal;
        isAdmin = adminRefusal === null;
    }
    try {
        const result = await ShiftService.closeShift(session.user.id, {
            shiftId: parsed.data.shiftId,
            declaredCashTotal: Number(parsed.data.declared),
            justification: parsed.data.justification,
            regisseurPin: parsed.data.regisseurPin,
        }, { isAdmin });
        const summary = await ShiftService.getShiftSummary(result.shift.id, { id: session.user.id, isAdmin });
        return NextResponse.json({
            success: true,
            shift: result.shift,
            summary,
            expected: result.expected,
            declared: result.declared,
            discrepancy: result.discrepancy,
            pin_cosigned: result.pinCosigned,
            alert_queued: result.alertQueued,
            // Lot 9 quater (C7 : AUD-16) : l'écart attend la validation de l'organisatrice depuis sa session
            discrepancy_pending: result.discrepancyPending,
            message: result.discrepancy === 0
                ? 'Session de caisse clôturée sans écart.'
                : `Session de caisse clôturée avec un écart. ${DISCREPANCY_PENDING_MESSAGE}.`,
        });
    } catch (err: unknown) {
        const refusal = asShiftRefusal(err);
        if (refusal && adminRefusal && refusal.body.code === 'SHIFT_NOT_FOUND') return adminRefusal;
        if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
        console.error('[API controller/shifts/close POST]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Clôture de caisse momentanément impossible.', code: 'SHIFT_CLOSE_FAILED' }, { status: 500 });
    }
}
