import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { DEVICE_INCIDENT_KINDS, logDeviceScanIncidents, MAX_INCIDENTS_PER_REPORT } from '@/lib/scan/scan-incidents';
import { reserveQuota } from '@/lib/security/quota';

export const dynamic = 'force-dynamic';

const ReportSchema = z.object({
    eventId: z.string().uuid('Événement invalide.'),
    incidents: z.array(z.object({
        kind: z.enum(DEVICE_INCIDENT_KINDS as unknown as [string, ...string[]]),
        at: z.string().datetime({ offset: true }).optional().nullable(),
    })).min(1, 'Aucun incident à déclarer.').max(MAX_INCIDENTS_PER_REPORT, `${MAX_INCIDENTS_PER_REPORT} incidents au plus par envoi.`),
});

/**
 * POST /api/controller/scan/incidents — incidents techniques constatés par l'appareil de scan
 * (coupure réseau, délai dépassé), lot 5 (C8) : `{ eventId, incidents: [{ kind, at }] }`, 20 au plus par
 * envoi, quota par scanneur (SCAN_INCIDENT_REPORT_PER_SCANNER_MIN par minute). Contrôleur affecté,
 * partenaire propriétaire ou admin de l'événement ; un scanneur non autorisé est ignoré. Réponse 204
 * dans les deux cas (aucune information sur les droits d'autrui). ticket_scans n'est pas touché.
 */
export async function POST(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    const user = session.user;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corps JSON invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }
    const parsed = ReportSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Déclaration d’incidents invalide.', code: 'INVALID_BODY' }, { status: 400 });
    }

    const quota = await reserveQuota(
        [{ scope: 'scan_incident_report', bucket: user.id, windowSecs: 60, max: getServerEnv().SCAN_INCIDENT_REPORT_PER_SCANNER_MIN }],
        'déclaration d’incidents de scan');
    if (!quota.allowed) {
        return quota.reason === 'EXCEEDED'
            ? NextResponse.json({ error: 'Trop de déclarations d’incidents. Réessayez dans une minute.', code: 'RATE_LIMITED' },
                { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } })
            : NextResponse.json({ error: 'Déclaration momentanément indisponible.', code: 'GUARD_UNAVAILABLE' }, { status: 503 });
    }

    try {
        const result = await logDeviceScanIncidents(user.id, parsed.data.eventId,
            parsed.data.incidents.map((i) => ({ kind: i.kind as (typeof DEVICE_INCIDENT_KINDS)[number], at: i.at ?? null })));
        if (result.ignored) console.warn(`[API controller/scan/incidents] ${user.id} non autorisé sur ${parsed.data.eventId} : incidents ignorés.`);
        return new NextResponse(null, { status: 204 });
    } catch (err) {
        console.error('[API controller/scan/incidents] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Déclaration momentanément impossible.', code: 'INCIDENT_REPORT_FAILED' }, { status: 500 });
    }
}
