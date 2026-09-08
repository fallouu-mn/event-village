import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser, serverIsPartner } from '@/lib/auth/session';
import { PartnerDashboardService } from '@/lib/partner/partner-dashboard.service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
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
        const pdfBuffer = await PartnerDashboardService.generateClosingReportPdf(report);

        const filename = `Rapport-Cloture-${report.event.title.replace(/[^a-zA-Z0-9]/g, '_')}-${report.reportId}.pdf`;

        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.byteLength.toString(),
                'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
        });
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
        console.error('[GET /api/partner/reports/closing/pdf] Erreur:', err);
        return NextResponse.json({ error: err.message || 'Erreur serveur.' }, { status: 500 });
    }
}
