/**
 * Lot 11c-c — tables d'un événement : lecture des écrans (éditeur, pilotage, administration), aperçu du prix par personne
 * et copie des tables d'un événement précédent.
 *
 * Tout nombre de places, tout montant et toute règle viennent de la base (event_table_report, migration
 * 20261215000001) : la route ne fait que relayer la réponse. Seul l'aperçu du prix par personne, pendant la saisie d'un
 * prix pas encore enregistré, est calculé ici, côté serveur, avec la règle de la base (private.event_table_prices :
 * round(prix / places), exact si la division tombe juste).
 */
import { callLot5Rpc, type RpcBody } from '@/lib/events/pilotage.service';
import { callTables, isUuid, type DbReply } from '@/lib/event-tables/event-tables.server';

/** Lecture des tables d'un événement (pilotage_access : propriétaire, ou administration avec events.read). */
export async function readTablesReport(eventId: string, actorId: string): Promise<RpcBody> {
    return callLot5Rpc('event_table_report', { event_id: eventId, actor_id: actorId }, 'Lecture des tables impossible pour le moment.');
}

/** Bornes de l'aperçu : celles de la base (places 2 à 20) ; prix entier positif raisonnable. */
const PRICE_MAX = 100_000_000;

export interface PricePreview { price: number; seats: number; price_per_person: number; price_per_person_exact: boolean }

/**
 * Prix par personne d'une table, pour l'aperçu de la saisie : même règle que private.event_table_prices
 * (round(price / seats) de PostgreSQL, arrondi au plus proche, moitié vers le haut pour un nombre positif).
 * null si la saisie n'est pas un prix ou un nombre de places que la base accepterait.
 */
export function pricePerPerson(priceRaw: unknown, seatsRaw: unknown): PricePreview | null {
    const price = typeof priceRaw === 'string' && /^\d{1,9}$/.test(priceRaw.trim()) ? Number(priceRaw.trim()) : NaN;
    const seats = typeof seatsRaw === 'string' && /^\d{1,2}$/.test(seatsRaw.trim()) ? Number(seatsRaw.trim()) : NaN;
    if (!Number.isInteger(price) || price < 1 || price > PRICE_MAX) return null;
    if (!Number.isInteger(seats) || seats < 2 || seats > 20) return null;
    return { price, seats, price_per_person: Math.round(price / seats), price_per_person_exact: price % seats === 0 };
}

type Row = Record<string, unknown>;

export interface CopyOutcome { status: number; body: Row }

const asRows = (v: unknown): Row[] => (Array.isArray(v) ? v.filter((x): x is Row => !!x && typeof x === 'object') : []);

/**
 * Copie des types et des tables (positions comprises) d'un événement précédent de la MÊME organisatrice vers un événement
 * qui n'a encore aucun type de table. Propriété des deux événements vérifiée en base (event_table_report : viewer OWNER) ;
 * chaque écriture passe ensuite par les fonctions habituelles (event_table_type_save, event_tables_save), qui revérifient
 * propriété, garde de la billetterie, jauge en places et interrupteur. Les zones d'accès ne sont pas copiées (elles sont
 * propres à chaque événement). Au moindre refus, les types déjà créés par cette copie sont retirés
 * (event_table_type_delete : aucun n'a pu être vendu entre-temps, ils ne sont pas encore en vente) et le refus est rendu tel quel.
 */
export async function copyTablesFrom(params: { userId: string; eventId: string; fromEventId: unknown }): Promise<CopyOutcome> {
    const { userId, eventId } = params;
    if (!isUuid(params.fromEventId) || params.fromEventId === eventId) {
        return { status: 400, body: { success: false, error: 'Choisissez un autre de vos événements.', code: 'INVALID_INPUT' } };
    }
    const fromEventId = params.fromEventId;
    const target = await readTablesReport(eventId, userId);
    const source = await readTablesReport(fromEventId, userId);
    if (target.viewer !== 'OWNER' || source.viewer !== 'OWNER') {
        return { status: 404, body: { success: false, error: 'Événement introuvable.', code: 'EVENT_NOT_FOUND' } };
    }
    if (asRows(target.types).length > 0) {
        return { status: 409, body: { success: false, error: 'Cet événement a déjà des tables : la copie ne se fait que sur un événement sans table.', code: 'TABLES_NOT_EMPTY' } };
    }
    const refusal = target.edit_refusal as Row | null | undefined;
    if (refusal && typeof refusal === 'object') {
        return { status: 409, body: { success: false, error: String(refusal.message ?? 'Modification impossible.'), code: String(refusal.code ?? 'REFUSED') } };
    }
    const sourceTypes = asRows(source.types);
    const sourceTables = asRows(source.tables);
    if (sourceTypes.length === 0 || sourceTables.length === 0) {
        return { status: 409, body: { success: false, error: 'Cet événement n’a aucune table à copier.', code: 'NOTHING_TO_COPY' } };
    }

    const created: string[] = [];
    const typeMap = new Map<string, string>();
    const rollback = async (): Promise<void> => {
        for (const id of created.reverse()) {
            const del = await callTables('event_table_type_delete', { event_id: eventId, actor_id: userId, type_id: id });
            if (del.ok !== true) console.error(`[tables : copie] retrait du type ${id} impossible après un refus :`, JSON.stringify(del).slice(0, 300));
        }
    };
    const refused = async (reply: DbReply): Promise<CopyOutcome> => {
        await rollback();
        return { status: 409, body: { success: false, error: reply.message ?? 'Copie refusée.', code: reply.code ?? 'REFUSED' } };
    };

    for (const t of sourceTypes) {
        const count = sourceTables.filter((x) => x.type_id === t.id).length;
        if (count < 1) continue;
        const reply = await callTables('event_table_type_save', {
            event_id: eventId, actor_id: userId, count,
            type: {
                name: t.name, seats: t.seats, price: t.price, included_text: t.included_text ?? null, onsite_note: t.onsite_note ?? null,
                payment_mode: 'FULL', scan_color: t.scan_color ?? null, entry_instruction: t.entry_instruction ?? null,
            },
        });
        if (reply.ok !== true) return refused(reply);
        const newType = reply.type as Row | undefined;
        if (!newType || typeof newType.id !== 'string') {
            await rollback();
            throw new Error(`event_table_type_save : type créé sans identifiant ${JSON.stringify(reply).slice(0, 300)}`);
        }
        created.push(newType.id);
        typeMap.set(String(t.id), newType.id);
    }

    // Positions : les tables créées (numérotées sur les plus petits numéros libres) reprennent, type par type et dans
    // l'ordre des numéros, le numéro, la position, la forme et la rotation des tables de l'événement d'origine.
    const fresh = asRows((await readTablesReport(eventId, userId)).tables);
    const tables: Row[] = [];
    for (const [fromType, toType] of typeMap) {
        const from = sourceTables.filter((x) => x.type_id === fromType).sort((a, b) => Number(a.number) - Number(b.number));
        const to = fresh.filter((x) => x.type_id === toType).sort((a, b) => Number(a.number) - Number(b.number));
        to.forEach((row, i) => {
            const src = from[i];
            tables.push({
                id: row.id, type_id: toType, number: Number(src?.number ?? row.number), zone_id: null,
                x: src?.x === null || src?.x === undefined ? null : Number(src.x),
                y: src?.y === null || src?.y === undefined ? null : Number(src.y),
                shape: (src?.shape as string | undefined) ?? 'RONDE', rotation: Number(src?.rotation ?? 0),
            });
        });
    }
    const saved = await callTables('event_tables_save', { event_id: eventId, actor_id: userId, plan_enabled: false, tables, zones: [] });
    if (saved.ok !== true) return refused(saved);
    return { status: 200, body: { success: true, types: created.length, tables: tables.length } };
}
