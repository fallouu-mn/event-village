import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

const EventId = z.string().uuid();

/**
 * GET /api/controller/shifts/active?event_id=… (ou eventId=…) — session de caisse OUVERT du compte
 * appelant pour l'événement, ou null. Ne renvoie jamais la caisse d'un autre compte.
 * Lot 7 (D46, contrat 3.3) : `expected_cash_in_drawer` = fonds de caisse + espèces encaissées, calculé ici
 * (le navigateur n'additionne plus rien), à la racine de la réponse et dans `shift` ; null sans caisse.
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;

    const params = new URL(req.url).searchParams;
    const parsed = EventId.safeParse(params.get('event_id') ?? params.get('eventId'));
    if (!parsed.success) {
        return NextResponse.json({ error: 'event_id requis (identifiant d’événement).', code: 'INVALID_EVENT' }, { status: 400 });
    }

    try {
        const shift = await ShiftService.getActiveShift(session.user.id, parsed.data);
        if (!shift) return NextResponse.json({ success: true, shift: null, expected_cash_in_drawer: null });
        const opening = Number(shift.opening_float_amount);
        const collected = Number(shift.expected_cash_total);
        if (!Number.isFinite(opening) || !Number.isFinite(collected)) {
            throw new Error(`montants illisibles pour la caisse ${shift.id} : fonds ${JSON.stringify(shift.opening_float_amount)}, encaissé ${JSON.stringify(shift.expected_cash_total)}`);
        }
        const expectedCashInDrawer = opening + collected;
        return NextResponse.json({
            success: true,
            shift: { ...shift, expected_cash_in_drawer: expectedCashInDrawer },
            expected_cash_in_drawer: expectedCashInDrawer,
        });
    } catch (err: unknown) {
        console.error('[API controller/shifts/active GET]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Lecture de la caisse momentanément impossible.', code: 'SHIFT_READ_FAILED' }, { status: 500 });
    }
}
