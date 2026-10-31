import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { asShiftRefusal, ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

// Deux nommages acceptés : contrat du lot 4 (eventId, openingFloat, regisseurPin) et écran historique
// (event_id, opening_float_amount, regisseur_pin).
const OpenShiftSchema = z.object({
    eventId: z.string().uuid('ID événement invalide.').optional(),
    event_id: z.string().uuid('ID événement invalide.').optional(),
    openingFloat: z.coerce.number().min(0, 'Le fond de caisse doit être positif ou nul.').optional(),
    opening_float_amount: z.coerce.number().min(0, 'Le fond de caisse doit être positif ou nul.').optional(),
    regisseurPin: z.string().trim().max(8, 'Code PIN régisseur invalide.').optional().nullable(),
    regisseur_pin: z.string().trim().max(8, 'Code PIN régisseur invalide.').optional().nullable(),
}).transform((d) => ({
    eventId: d.eventId ?? d.event_id ?? '',
    openingFloat: d.openingFloat ?? d.opening_float_amount ?? 0,
    regisseurPin: (d.regisseurPin ?? d.regisseur_pin ?? '') || null,
})).refine((d) => !!d.eventId, { message: 'ID événement requis.' });

/**
 * POST /api/controller/shifts/open — ouverture d'une session de caisse (lot 4.5), par la RPC shift_open :
 * contrôleur affecté avec la permission espèces, partenaire propriétaire ou admin ; événement ouvert au
 * contrôle ; une seule caisse ouverte par compte et par événement. PIN régisseur facultatif : fourni, il
 * est vérifié (quota par compte et événement) et la caisse est marquée ouverte sous PIN.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;

    const body = await req.json().catch(() => null);
    const parsed = OpenShiftSchema.safeParse(body ?? {});
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Données invalides.', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const shift = await ShiftService.openShift(session.user.id, {
            eventId: parsed.data.eventId,
            openingFloatAmount: parsed.data.openingFloat,
            regisseurPin: parsed.data.regisseurPin,
        });
        return NextResponse.json({
            success: true,
            shift,
            message: 'Session de caisse ouverte. Vous pouvez encaisser des espèces pour cet événement.',
        });
    } catch (err: unknown) {
        const refusal = asShiftRefusal(err);
        if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
        console.error('[API controller/shifts/open POST]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Ouverture de caisse momentanément impossible.', code: 'SHIFT_OPEN_FAILED' }, { status: 500 });
    }
}
