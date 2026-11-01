/**
 * Incidents techniques du scan (lot 5, contrat C8) : table scan_incidents, à part de ticket_scans
 * (scanneur, événement, type, horodatage), lisible par le partenaire propriétaire et les admins.
 *
 *  - Écrits par le serveur (source SERVER) pour les refus 429 et les erreurs 5xx de /api/controller/scan :
 *    au mieux, sans changer la réponse au scanneur ; un échec d'écriture est journalisé et la réponse
 *    porte incident_logged: false. Volume borné par scanneur (SCAN_INCIDENT_LOG_PER_SCANNER_MIN).
 *  - Déclarés par l'appareil (source DEVICE) pour les coupures réseau et les délais dépassés :
 *    POST /api/controller/scan/incidents, ignorés si le scanneur n'est pas autorisé sur l'événement.
 * Toute l'écriture passe par la RPC scan_incident_log (service_role), qui vérifie le droit du scanneur.
 */
import { getServerEnv } from '@/lib/env';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { reserveQuota } from '@/lib/security/quota';

export type ServerIncidentKind = 'RATE_LIMITED' | 'SERVER_ERROR' | 'GUARD_UNAVAILABLE';
export type DeviceIncidentKind = 'NETWORK' | 'TIMEOUT';
export const DEVICE_INCIDENT_KINDS: readonly DeviceIncidentKind[] = ['NETWORK', 'TIMEOUT'];
export const MAX_INCIDENTS_PER_REPORT = 20;

type LogReply = { ok?: boolean; code?: string; logged?: number; ignored?: boolean };

async function callLog(p: Record<string, unknown>): Promise<LogReply> {
    const { data, error } = await rpcWithRetry<LogReply>('scan_incident_log', { p });
    if (error) throw new Error(`scan_incident_log : ${error.code ?? ''} ${error.message}`);
    if (!data) throw new Error('scan_incident_log : réponse vide');
    return data;
}

/**
 * Compte un incident né dans la route de scan. Renvoie true s'il est écrit. N'interrompt jamais la
 * réponse au scanneur : un refus de quota ou une panne est journalisé et donne false.
 */
export async function logServerScanIncident(scannerId: string, eventId: string | null, kind: ServerIncidentKind): Promise<boolean> {
    try {
        const quota = await reserveQuota(
            [{ scope: 'scan_incident_log', bucket: scannerId, windowSecs: 60, max: getServerEnv().SCAN_INCIDENT_LOG_PER_SCANNER_MIN }],
            'incident de scan');
        if (!quota.allowed) {
            console.warn(`[scan-incidents] incident ${kind} du scanneur ${scannerId} non écrit (${quota.reason === 'EXCEEDED' ? 'volume par minute atteint' : 'garde indisponible'}).`);
            return false;
        }
        const reply = await callLog({ scanner_id: scannerId, event_id: eventId, source: 'SERVER', incidents: [{ kind }] });
        if (reply.ok !== true) {
            console.error(`[scan-incidents] incident ${kind} du scanneur ${scannerId} refusé : ${JSON.stringify(reply)}`);
            return false;
        }
        return Number(reply.logged ?? 0) > 0;
    } catch (err) {
        console.error(`[scan-incidents] incident ${kind} du scanneur ${scannerId} non écrit :`, err instanceof Error ? err.message : String(err));
        return false;
    }
}

/** Incidents déclarés par l'appareil ; `ignored` si le scanneur n'est pas autorisé sur l'événement. */
export async function logDeviceScanIncidents(
    scannerId: string,
    eventId: string,
    incidents: Array<{ kind: DeviceIncidentKind; at?: string | null }>,
): Promise<{ logged: number; ignored: boolean }> {
    const reply = await callLog({
        scanner_id: scannerId,
        event_id: eventId,
        source: 'DEVICE',
        incidents: incidents.map((i) => ({ kind: i.kind, at: i.at ?? null })),
    });
    if (reply.ok !== true) throw new Error(`scan_incident_log : refus inattendu ${JSON.stringify(reply)}`);
    return { logged: Number(reply.logged ?? 0), ignored: reply.ignored === true };
}
