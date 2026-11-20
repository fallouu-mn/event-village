import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { guardFeature } from '@/lib/features/flags';
import { hallQuote, HallRefusal } from '@/lib/halls/queries';
import { badRequest, DAY_RE, intParam, refusalResponse, TIME_RE } from '@/lib/halls/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/halls/[id]/quote?date=AAAA-MM-JJ&mode=JOUR|HEURE&units=N&time=HH:MM — prix, frais, total, acompte, solde,
 * échéance du solde et conditions d'annulation, AVANT de réserver.
 * Lot 10b (point 2) : calculé en base par hall_quote (même calcul que hall_reserve), rien n'est écrit ; aucun montant
 * ne vient de la requête. Interrupteur d'abord (404 si le service est fermé).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const closed = await guardFeature('halls', 'GET /api/halls/[id]/quote');
        if (closed) return closed;
        const { id } = await params;
        const sp = req.nextUrl.searchParams;
        const date = sp.get('date') ?? '';
        const mode = sp.get('mode') === 'HEURE' ? 'HEURE' : 'JOUR';
        const units = intParam(sp.get('units'));
        const time = sp.get('time');
        if (!DAY_RE.test(date) || units === null || Number.isNaN(units) || (mode === 'HEURE' && (!time || !TIME_RE.test(time)))) {
            return badRequest('Choisissez la date et la durée de la réservation.', 'INVALID_DATES');
        }
        const quote = await hallQuote({ hallId: id, mode, startDate: date, units, startTime: mode === 'HEURE' ? time : null });
        return NextResponse.json({ success: true, quote });
    } catch (err: unknown) {
        if (err instanceof HallRefusal) return refusalResponse(err);
        return apiFailure('GET /api/halls/[id]/quote', err, { message: 'Prix momentanément indisponible.', code: 'HALL_QUOTE_UNAVAILABLE', status: 500 });
    }
}
