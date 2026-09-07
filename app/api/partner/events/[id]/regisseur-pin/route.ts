import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser, serverIsPartner, serverHasRole } from '@/lib/auth/session';
import { ShiftService } from '@/lib/shifts/shift.service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partner/events/[id]/regisseur-pin
 * Génération sécurisée d'un code PIN régisseur pour l'événement.
 * - Accessible uniquement au PARTENAIRE propriétaire ou ADMIN/SUPERADMIN.
 * - Le PIN est stocké haché en base.
 * - Le PIN en clair est renvoyé UNE SEULE FOIS au partenaire.
 */
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> | { id: string } }
) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (!serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const resolvedParams = await Promise.resolve(context?.params);
        const eventId = resolvedParams?.id;
        if (!eventId) {
            return NextResponse.json({ error: 'ID événement manquant.' }, { status: 400 });
        }

        const result = await ShiftService.generateRegisseurPin(
            eventId,
            serverHasRole(user, 'PARTENAIRE') ? user.id : undefined
        );

        return NextResponse.json({
            success: true,
            pin: result.pin,
            event_id: result.eventId,
            message: 'Code PIN régisseur généré avec succès. Notez-le bien : il ne sera plus affiché en clair.',
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur interne.';
        console.error('[API regisseur-pin POST]', msg);
        return NextResponse.json({ error: msg }, { status: 400 });
    }
}
