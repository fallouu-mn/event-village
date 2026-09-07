import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionUser } from '@/lib/auth/session';
import { ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

const OpenShiftSchema = z.object({
    event_id: z.string().uuid('ID événement invalide.'),
    opening_float_amount: z.coerce.number().min(0, 'Le fond de caisse doit être positif ou nul.'),
    regisseur_pin: z.string().min(4, 'Code PIN régisseur invalide.').max(6, 'Code PIN régisseur invalide.'),
});

/**
 * POST /api/controller/shifts/open
 * Ouverture officielle d'une session de caisse par un contrôleur.
 * Vérifie :
 * - Rôle et habilitation can_accept_cash = true
 * - Fenêtre horaire de l'événement ([-2h, +4h])
 * - Code PIN régisseur (avec protection anti-brute-force)
 * - Absence de session déjà ouverte
 */
export async function POST(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const parse = OpenShiftSchema.safeParse(body);
        if (!parse.success) {
            return NextResponse.json({
                error: parse.error.issues[0]?.message || 'Données invalides.',
            }, { status: 400 });
        }

        const { event_id, opening_float_amount, regisseur_pin } = parse.data;

        const shift = await ShiftService.openShift(user.id, {
            eventId: event_id,
            openingFloatAmount: opening_float_amount,
            regisseurPin: regisseur_pin,
        });

        return NextResponse.json({
            success: true,
            shift,
            message: 'Session de caisse ouverte avec succès. Vous êtes désormais habilité à encaisser des espèces.',
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne.';
        console.error('[API controller/shifts/open POST]', msg);
        const status = msg.includes('PIN') ? 401 : 400;
        return NextResponse.json({ error: msg }, { status });
    }
}
