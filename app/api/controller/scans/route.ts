import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveSession } from '@/lib/auth/session';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { scanReasonLabel } from '@/lib/scan/scan-result';

export const dynamic = 'force-dynamic';

const EventId = z.string().uuid();

type StatsReply = {
    ok?: boolean;
    http?: number;
    entry_point?: string | null;
    gate?: { id?: unknown; name?: unknown } | null;
    gate_kind?: unknown;
    door_checks?: unknown;
    door_entries?: unknown;
    my_entries?: unknown;
    my_refusals?: unknown;
    refusals_by_result?: Array<{ result?: unknown; count?: unknown }>;
    recent?: Array<{ scan_id?: unknown; at?: unknown; result?: unknown; method?: unknown; ticket_number?: unknown; category?: unknown }>;
};

const NOT_FOUND = { error: 'Événement introuvable ou non affecté.', code: 'NOT_FOUND' };

/** Lot 9 bis (R100) : « Porte » ajouté seulement si le point d'entrée ne se nomme pas déjà (Porte, Entrée, Accès…). */
const NAMED_ENTRY = /^(porte|portail|entr[ée]e|acc[èe]s|guichet)\b/i;

function doorLabel(entryPoint: string | null): string {
    if (!entryPoint) return 'Vos entrées';
    const value = entryPoint.trim();
    return NAMED_ENTRY.test(value) ? value : `Porte ${value}`;
}

/** Lot 9 ter (9t.15) : porte de l'affectation, lue dans la réponse de controller_scan_stats ; illisible : erreur. */
function gateOf(data: StatsReply): { id: string; name: string } | null {
    if (data.gate === null || data.gate === undefined) return null;
    if (typeof data.gate.id !== 'string' || typeof data.gate.name !== 'string') {
        throw new Error(`controller_scan_stats : porte illisible ${JSON.stringify(data.gate)}`);
    }
    return { id: data.gate.id, name: data.gate.name };
}

/**
 * GET /api/controller/scans?event_id=… — chiffres et historique du contrôleur pour un événement (lot 7,
 * D42, contrat 3.3 ; règle du lot 5 « le serveur est la seule source des chiffres ») : point d'entrée de
 * l'affectation et compteur de la porte (« Porte <x> » : entrées acceptées de l'événement à cette porte ;
 * sans porte : « Vos entrées »), entrées et refus du contrôleur ventilés par motif (libellés français),
 * 20 derniers scans du contrôleur (sans nom de porteur), heure du serveur. Non autorisé sur l'événement :
 * 404 sans aucune donnée. Lot 9 ter (9t.15, contrat 4.3) : `gate` (porte de l'affectation, ou null), `gate_kind`
 * (ENTREE, CONTROLE ou null) et `door_checks` (billets contrôlés à une porte de contrôle) ; `door_label` = nom de la
 * porte quand elle est posée (même règle « Porte » que le point d'entrée).
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;

    const params = new URL(req.url).searchParams;
    const parsed = EventId.safeParse(params.get('event_id') ?? params.get('eventId'));
    if (!parsed.success) return NextResponse.json(NOT_FOUND, { status: 404 });

    try {
        const { data, error } = await rpcWithRetry<StatsReply>('controller_scan_stats', {
            p: { scanner_id: session.user.id, event_id: parsed.data, limit: 20 },
        });
        if (error || !data) throw new Error(`controller_scan_stats : ${error?.message ?? 'réponse vide'}`);
        if (data.ok !== true) return NextResponse.json(NOT_FOUND, { status: 404 });
        const entryPoint = typeof data.entry_point === 'string' && data.entry_point.trim() !== '' ? data.entry_point : null;
        const gate = gateOf(data);
        return NextResponse.json({
            entry_point: entryPoint,
            door_label: doorLabel(gate ? gate.name : entryPoint),
            gate,
            gate_kind: data.gate_kind === 'ENTREE' || data.gate_kind === 'CONTROLE' ? data.gate_kind : null,
            door_checks: Number(data.door_checks ?? 0),
            door_entries: Number(data.door_entries ?? 0),
            my_entries: Number(data.my_entries ?? 0),
            my_refusals: Number(data.my_refusals ?? 0),
            refusals_by_result: (data.refusals_by_result ?? []).map((r) => ({
                result: String(r.result),
                label: scanReasonLabel(r.result),
                count: Number(r.count ?? 0),
            })),
            recent: (data.recent ?? []).map((r) => ({
                scan_id: String(r.scan_id),
                at: new Date(String(r.at)).toISOString(),
                result: String(r.result),
                label: scanReasonLabel(r.result),
                method: String(r.method),
                ticket_number: typeof r.ticket_number === 'string' ? r.ticket_number : null,
                category: typeof r.category === 'string' ? r.category : null,
            })),
            server_time: new Date().toISOString(),
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.error('[API /api/controller/scans] erreur :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Lecture des scans momentanément impossible.', code: 'SCANS_READ_FAILED' }, { status: 500 });
    }
}
