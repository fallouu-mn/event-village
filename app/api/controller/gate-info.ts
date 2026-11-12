/**
 * Lot 9 ter (9t.15, contrat 4.3) — portes et zones d'événements, lues par le serveur pour les routes du contrôleur
 * (`GET /api/controller/assignments`, `GET /api/controller/gates`, `GET /api/controller/counter-sale`). Module serveur
 * (pas une route). Lecture service_role, deux requêtes par lot d'événements ; toute erreur de lecture est levée (jamais
 * un événement présenté sans zone par défaut d'une lecture ratée).
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import type { ZoneKind } from '@/lib/scan/scan-result';

export interface GateInfo {
    id: string;
    name: string;
    zone: { id: string; name: string; kind: ZoneKind };
}

export interface EventGates {
    /** Événements qui ont au moins une zone (sinon zone implicite « Entrée »). */
    configured: Set<string>;
    /** Portes par identifiant. */
    gates: Map<string, GateInfo & { eventId: string }>;
    /** Portes de chaque événement, triées par zone (position, nom) puis par nom de porte. */
    byEvent: Map<string, GateInfo[]>;
}

interface ZoneRow { id: string; event_id: string; name: string; kind: string; position: number }
interface GateRow { id: string; event_id: string; zone_id: string; name: string }

function byName(a: string, b: string): number {
    return a.trim().toLocaleLowerCase('fr-FR').localeCompare(b.trim().toLocaleLowerCase('fr-FR'), 'fr-FR');
}

export async function readEventGates(eventIds: string[]): Promise<EventGates> {
    const out: EventGates = { configured: new Set(), gates: new Map(), byEvent: new Map() };
    const ids = Array.from(new Set(eventIds));
    if (ids.length === 0) return out;
    const supabase = getServiceRoleClient();
    const [zones, gates] = await Promise.all([
        supabase.from('event_zones').select('id, event_id, name, kind, position').in('event_id', ids),
        supabase.from('event_gates').select('id, event_id, zone_id, name').in('event_id', ids),
    ]);
    if (zones.error) throw new Error(`zones des événements : ${zones.error.message}`);
    if (gates.error) throw new Error(`portes des événements : ${gates.error.message}`);
    const zoneById = new Map<string, ZoneRow>();
    for (const z of (zones.data ?? []) as ZoneRow[]) {
        zoneById.set(z.id, z);
        out.configured.add(z.event_id);
    }
    const sorted = ((gates.data ?? []) as GateRow[]).slice().sort((a, b) => {
        const za = zoneById.get(a.zone_id);
        const zb = zoneById.get(b.zone_id);
        return (Number(za?.position ?? 0) - Number(zb?.position ?? 0))
            || byName(za?.name ?? '', zb?.name ?? '')
            || (za?.id ?? '').localeCompare(zb?.id ?? '')
            || byName(a.name, b.name)
            || a.id.localeCompare(b.id);
    });
    for (const g of sorted) {
        const z = zoneById.get(g.zone_id);
        if (!z) throw new Error(`porte ${g.id} sans zone lisible`);
        if (z.kind !== 'ENTREE' && z.kind !== 'CONTROLE') throw new Error(`zone ${z.id} : type inconnu ${JSON.stringify(z.kind)}`);
        const info: GateInfo = { id: g.id, name: g.name, zone: { id: z.id, name: z.name, kind: z.kind } };
        out.gates.set(g.id, { ...info, eventId: g.event_id });
        const list = out.byEvent.get(g.event_id) ?? [];
        list.push(info);
        out.byEvent.set(g.event_id, list);
    }
    return out;
}

/** Porte sous la forme servie par l'API (`{ id, name, zone }`), ou null. */
export function gateOut(gates: EventGates, gateId: unknown): GateInfo | null {
    if (typeof gateId !== 'string') return null;
    const g = gates.gates.get(gateId);
    return g ? { id: g.id, name: g.name, zone: g.zone } : null;
}
