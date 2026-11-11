import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireEventAccess } from '@/lib/auth/event-access';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { asShiftRefusal, ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
    confirm: z.boolean().optional(),
    confirmOpenShifts: z.boolean().optional(),
});

/**
 * POST /api/partner/events/[id]/regisseur-pin — génération du code PIN régisseur (lot 4.7).
 *  - partenaire propriétaire de l'événement, ou admin muni de events.write, ou SUPERADMIN (lot 9 bis, R2) ;
 *  - { confirm: true } obligatoire (l'ancien code cesse d'être valable) ;
 *  - caisse(s) ouverte(s) : 409 OPEN_SHIFTS (avec leur nombre), sauf { confirmOpenShifts: true } ;
 *  - PIN renvoyé une seule fois en clair, jamais son haché ; génération journalisée (audit_logs).
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès non autorisé.', code: 'FORBIDDEN_ROLE' }, { status: 403 });
    }

    const { id: eventId } = await Promise.resolve(context.params);
    if (!eventId) {
        return NextResponse.json({ error: 'ID événement manquant.' }, { status: 400 });
    }
    // Lot 9 bis (R2, B31) : un admin doit avoir events.write, contrôlé avant toute lecture du corps ou écriture.
    const access = await requireEventAccess(user, eventId, 'events.write');
    if (access.kind === 'DENIED') return access.response;

    // Corps absent ou vide : aucune confirmation (refus explicite par le service)
    const text = await req.text();
    let raw: unknown = {};
    if (text.trim()) {
        try {
            raw = JSON.parse(text);
        } catch {
            return NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
        }
    }
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Corps invalide : confirm et confirmOpenShifts sont des booléens.', code: 'INVALID_BODY' }, { status: 400 });
    }

    try {
        const result = await ShiftService.generateRegisseurPin(eventId, user.id, {
            confirm: parsed.data.confirm,
            confirmOpenShifts: parsed.data.confirmOpenShifts,
            actorIsAdmin: access.kind === 'ADMIN',
            actorRole: user.role,
        });
        return NextResponse.json({
            success: true,
            pin: result.pin,
            event_id: result.eventId,
            open_shifts: result.openShifts,
            message: 'Code PIN régisseur généré. Notez-le : il ne sera plus affiché en clair.',
        });
    } catch (err: unknown) {
        const refusal = asShiftRefusal(err);
        if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
        console.error('[API regisseur-pin POST]', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Génération du code PIN momentanément impossible.', code: 'PIN_GENERATION_FAILED' }, { status: 500 });
    }
}
