import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { PartnerDashboardService } from '@/lib/partner/partner-dashboard.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/reports/closing?eventId= — rapport de clôture de la propriétaire (session ACTIF, PARTENAIRE).
 * Lot 9 ter (R106 b, B-D22) : un seul rapport. 200 `{ success, report }` : `report.closing` = corps de pilotage_closing
 * tel quel (source de l'onglet Clôture, de la fenêtre et du PDF), `salesByCategory` lu dans pilotage_sales,
 * `ticketsSummary` et `financialSummary` lus dans `closing` (PartnerDashboardService.getClosingReportData). Refus de
 * pilotage_closing ou de pilotage_sales : 404 « Événement introuvable. » ; événement d'une autre partenaire : 403.
 */
export async function GET(req: NextRequest) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;
        const user = activeSession.user;
        if (!user) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }
        if (!serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé. Rôle Partenaire requis.' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get('eventId');
        if (!eventId) {
            return NextResponse.json({ error: 'Paramètre eventId obligatoire.' }, { status: 400 });
        }

        const report = await PartnerDashboardService.getClosingReportData(user.id, eventId);
        return NextResponse.json({ success: true, report });
    } catch (err: any) {
        if (err.message === 'PROFIL_PARTENAIRE_INTROUVABLE') {
            return NextResponse.json({ error: 'Profil partenaire introuvable.' }, { status: 404 });
        }
        if (err.message === 'EVENEMENT_INTROUVABLE') {
            return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
        }
        if (err.message === 'ACCES_REFUSE_AUTRE_TENANT') {
            return NextResponse.json({ error: 'Accès refusé. Cet événement appartient à un autre partenaire.' }, { status: 403 });
        }
        return apiFailure('GET /api/partner/reports/closing', err, { message: 'Rapport de clôture momentanément indisponible.', code: 'CLOSING_REPORT_UNAVAILABLE', status: 500 });
    }
}
