import { z } from 'zod';
import { getServiceRoleClient } from '../supabase/server';
import { PublicError } from '@/lib/api/public-error';
import { assertNoPosterFolder } from '@/lib/images/image-address';
import { STORED_IMAGE_NAME_RE } from '@/lib/images/stored-name';
import { tableStateLabel } from './booking';
import { okOrRefuse } from './queries';

/**
 * Lot 11a — service des tables côté partenaire : établissements (restaurant, bar, espace), horaires, zones et tables.
 * Écritures avec le rôle de service, toujours limitées à la partenaire de la session ; la base revérifie tout
 * (déclencheurs trg_venues_validation_guard et trg_restaurant_*_venue_guard : établissement de la même partenaire,
 * zone du même établissement, statut de validation jamais écrit ici). Une réservation n'est jamais écrite ici : elle
 * ne change que par les fonctions en base (table_reserve, table_reservation_cancel, table_reservation_respond,
 * table_reservation_presence, table_onsite_payment_record), sous verrou et avec journal.
 * Lot 11b : création en une transaction (venue_create : fiche, photos, horaires, zones, tables), photos réencodées
 * vérifiées (dossier venues/<partenaire>/ de la route de dépôt), renvoi en validation, plan de salle, fermetures
 * exceptionnelles : fonctions en base (propriétaire, compte ACTIF, fiche VALIDE revérifiés).
 */

/** Préfixe des photos des établissements de la partenaire : `${SUPABASE_URL}/storage/v1/object/public/public-images/venues/<partner_id>/`. */
export function venuePhotoPrefix(partnerId: string): string | null {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    if (!base) return null;
    return `${base}/storage/v1/object/public/public-images/venues/${partnerId}/`;
}

export const VENUE_PHOTOS_MAX = 12;

/**
 * Photos d'un établissement : chacune vient de la route de dépôt (POST /api/partner/upload, dossier venues/<partenaire>/,
 * fichier réencodé « horodatage_8 caractères.webp », métadonnées retirées) ; une photo déjà enregistrée sur
 * l'établissement et renvoyée telle quelle reste acceptée. 12 au plus, sans doublon (comme les salles, lot 10b).
 */
export function venuePhotos(images: unknown, partnerId: string, previous: readonly string[] = []): string[] {
    assertNoPosterFolder(images);
    if (!Array.isArray(images)) throw new PublicError('Liste de photos illisible.', 'INVALID_FIELD', 400);
    if (images.length > VENUE_PHOTOS_MAX) throw new PublicError(`${VENUE_PHOTOS_MAX} photos au plus par établissement.`, 'INVALID_FIELD', 400);
    const prefix = venuePhotoPrefix(partnerId);
    const out: string[] = [];
    for (const url of images) {
        const fromUpload = typeof url === 'string' && prefix !== null && url.startsWith(prefix) && STORED_IMAGE_NAME_RE.test(url.slice(prefix.length));
        if (typeof url !== 'string' || !(previous.includes(url) || fromUpload)) {
            throw new PublicError('Une photo ne vient pas de cette page : déposez-la depuis le formulaire de l’établissement.', 'IMAGE_ORIGIN_INVALID', 400);
        }
        if (!out.includes(url)) out.push(url);
    }
    return out;
}

/** Refus d'une fonction de la base levé en P0001 (venue_create) : message en français simple, code dans HINT. */
function rpcRaise(error: { code?: string; message?: string; hint?: string | null }): Error {
    if (error.code === 'P0001' && error.message) {
        const code = error.hint ?? 'REFUSED';
        const status = code === 'FORBIDDEN' || code === 'ACCOUNT_NOT_ACTIVE' || code === 'PARTNER_NOT_VALIDATED' ? 403 : 400;
        return new PublicError(error.message, code, status);
    }
    return new Error(`venue_create : ${error.message ?? 'réponse vide'}`);
}

const time = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/, 'Heure au format HH:MM.');

export const VenueInputSchema = z.object({
    kind: z.enum(['RESTAURANT', 'BAR', 'ESPACE']).default('RESTAURANT'),
    name: z.string().trim().min(2, 'Nom de l’établissement trop court.').max(120),
    description: z.string().trim().max(2000).optional().nullable(),
    address: z.string().trim().max(300).optional().nullable(),
    city: z.string().trim().max(120).optional().nullable(),
    latitude: z.number().min(12.2).max(16.8).optional().nullable(),
    longitude: z.number().min(-17.6).max(-11.3).optional().nullable(),
    slot_minutes: z.number().int().min(30).max(360).refine((n) => n % 15 === 0, 'Durée au quart d’heure.').optional().nullable(),
    deposit_per_person: z.number().int().min(100).max(1_000_000).optional().nullable(),
    confirmation_mode: z.enum(['AUTO', 'MANUELLE']).default('AUTO'),
    is_active: z.boolean().optional(),
    hours: z.array(z.object({ weekday: z.number().int().min(1).max(7), opens_at: time, closes_at: time })).max(28).optional(),
});
export type VenueInput = z.infer<typeof VenueInputSchema>;

/** Lot 11b : création complète (une photo, une plage d'ouverture et une table au moins ; zones facultatives). */
export const VenueCreateSchema = VenueInputSchema.extend({
    photos: z.array(z.string()).min(1, 'Ajoutez au moins une photo de l’établissement.').max(12, '12 photos au plus.'),
    hours: z.array(z.object({ weekday: z.number().int().min(1).max(7), opens_at: time, closes_at: time })).min(1, 'Indiquez au moins une plage d’ouverture.').max(28),
    zones: z.array(z.object({ key: z.string().trim().min(1).max(40), name: z.string().trim().min(1, 'Chaque zone a un nom.').max(80) })).max(20, '20 zones au plus.').default([]),
    tables: z.array(z.object({
        number: z.string().trim().min(1, 'Chaque table a un numéro.').max(20),
        capacity: z.number().int().min(1).max(50),
        min_capacity: z.number().int().min(1).max(50).optional(),
        zone_key: z.string().trim().max(40).optional().nullable(),
    })).min(1, 'Ajoutez au moins une table.').max(200, '200 tables au plus.'),
});

/** Lot 11b : plan de salle (positions en % du plan). */
export const PlanSchema = z.object({
    enabled: z.boolean(),
    tables: z.array(z.object({
        id: z.string().uuid(),
        x: z.number().min(0).max(100).nullable(),
        y: z.number().min(0).max(100).nullable(),
        shape: z.enum(['RONDE', 'CARREE', 'RECTANGLE']).optional(),
        rotation: z.number().int().min(0).max(345).refine((n) => n % 15 === 0, 'Rotation par 15°.').optional(),
    })).max(200),
    zones: z.array(z.object({
        id: z.string().uuid(),
        x: z.number().min(0).max(100).nullable(),
        y: z.number().min(0).max(100).nullable(),
        w: z.number().min(5).max(100).nullable(),
        h: z.number().min(5).max(100).nullable(),
    })).max(20).default([]),
});

/** Lot 11b : fermeture exceptionnelle (jour entier si aucune heure). */
export const ClosureSchema = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choisissez le jour de la fermeture.'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    start_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    end_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    reason: z.string().trim().min(3, 'Indiquez le motif : il est envoyé aux clients.').max(200),
    expected_count: z.number().int().min(0).max(10_000).optional(),
    // Contre-vérification du lot 11b (T1) : empreinte de la liste vue à l'aperçu (recalculée en base sous le verrou)
    expected_hash: z.string().regex(/^[0-9a-f]{32}$/, 'Affichez de nouveau les réservations touchées, puis confirmez.').optional(),
});

export const ZoneInputSchema = z.object({
    venue_id: z.string().uuid('Choisissez l’établissement.').optional(),
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    is_active: z.boolean().optional(),
});

export const TableInputSchema = z.object({
    venue_id: z.string().uuid('Choisissez l’établissement.').optional(),
    zone_id: z.string().uuid().optional().nullable(),
    table_number: z.string().trim().min(1).max(20).optional(),
    capacity: z.number().int().min(1).max(50).optional(),
    min_capacity: z.number().int().min(1).max(50).optional(),
    is_active: z.boolean().optional(),
});

function firstIssue(error: z.ZodError): string {
    return error.issues[0]?.message ?? 'Données invalides.';
}

/** Message d'une erreur de la base, rédigé en français par les déclencheurs (raise_exception), sinon générique. */
function dbRefusal(error: { message?: string; code?: string } | null, fallback: string): Error {
    if (error?.code === 'P0001' && error.message) return new PublicError(error.message);
    if (error?.code === '23505') return new PublicError('Ce numéro de table existe déjà dans cet établissement.');
    if (error?.code === '23503') return new PublicError('Cet élément est utilisé par des réservations : désactivez-le au lieu de le supprimer.');
    if (error?.code === '23514') return new PublicError('Valeur refusée : vérifiez les champs saisis.');
    return new Error(`${fallback} : ${error?.message ?? 'réponse vide'}`);
}

export class TableService {
    /** Fiche partenaire de la session. */
    public static async resolvePartnerId(userId: string): Promise<string> {
        const { data: partner, error } = await getServiceRoleClient()
            .from('partners').select('id, status').eq('user_id', userId).maybeSingle();
        if (error || !partner) throw new PublicError('Profil partenaire introuvable.');
        return partner.id;
    }

    // ── Établissements ─────────────────────────────────────────────────────

    public static async listVenues(partnerUserId: string) {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data, error } = await getServiceRoleClient()
            .from('venues').select('*, venue_opening_hours(weekday, opens_at, closes_at)')
            .eq('partner_id', partnerId).order('created_at', { ascending: false });
        if (error) throw new Error(`établissements : ${error.message}`);
        return data ?? [];
    }

    /**
     * Lot 11b : création en une transaction par venue_create (fiche partenaire VALIDE et compte ACTIF revérifiés en base,
     * fiche, photos, horaires, zones, tables) ; tout refus annule tout, aucun avis aux administrateurs.
     */
    public static async createVenue(partnerUserId: string, raw: unknown) {
        const parsed = VenueCreateSchema.safeParse(raw);
        if (!parsed.success) throw new PublicError(firstIssue(parsed.error));
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const photos = venuePhotos(parsed.data.photos, partnerId);
        const { data, error } = await getServiceRoleClient().rpc('venue_create', { p: { ...parsed.data, photos, actor_id: partnerUserId } });
        if (error) throw rpcRaise(error);
        const r = okOrRefuse((data ?? {}) as Record<string, unknown>);
        const { data: venue, error: readErr } = await getServiceRoleClient().from('venues').select('*').eq('id', String(r.venue_id)).single();
        if (readErr || !venue) throw new Error(`établissement créé illisible : ${readErr?.message ?? 'absent'}`);
        return venue;
    }

    /** Lot 11b : renvoi en validation d'un établissement refusé (venue_submit). */
    public static async submitVenue(partnerUserId: string, venueId: string) {
        const { data, error } = await getServiceRoleClient().rpc('venue_submit', { p: { actor_id: partnerUserId, venue_id: venueId } });
        if (error) throw new Error(`venue_submit : ${error.message}`);
        return okOrRefuse((data ?? {}) as Record<string, unknown>);
    }

    /** Lot 11b : plan de salle (venue_plan_set) : positions des tables et des zones, plan montré ou non. */
    public static async setPlan(partnerUserId: string, venueId: string, raw: unknown) {
        const parsed = PlanSchema.safeParse(raw);
        if (!parsed.success) throw new PublicError(firstIssue(parsed.error));
        const { data, error } = await getServiceRoleClient().rpc('venue_plan_set', { p: { ...parsed.data, actor_id: partnerUserId, venue_id: venueId } });
        if (error) throw new Error(`venue_plan_set : ${error.message}`);
        return okOrRefuse((data ?? {}) as Record<string, unknown>);
    }

    /** Lot 11b : fermeture exceptionnelle (aperçu, puis création avec le nombre de réservations vu à l'aperçu). */
    public static async closure(partnerUserId: string, venueId: string, raw: unknown, mode: 'preview' | 'create') {
        const parsed = ClosureSchema.safeParse(raw);
        if (!parsed.success) throw new PublicError(firstIssue(parsed.error));
        const fn = mode === 'preview' ? 'venue_closure_preview' : 'venue_closure_create';
        const { data, error } = await getServiceRoleClient().rpc(fn, { p: { ...parsed.data, actor_id: partnerUserId, venue_id: venueId } });
        if (error) throw new Error(`${fn} : ${error.message}`);
        return okOrRefuse((data ?? {}) as Record<string, unknown>);
    }

    /** Lot 11b : fermeture retirée (pas encore finie). */
    public static async removeClosure(partnerUserId: string, closureId: string) {
        const { data, error } = await getServiceRoleClient().rpc('venue_closure_delete', { p: { actor_id: partnerUserId, closure_id: closureId } });
        if (error) throw new Error(`venue_closure_delete : ${error.message}`);
        return okOrRefuse((data ?? {}) as Record<string, unknown>);
    }

    public static async updateVenue(partnerUserId: string, venueId: string, raw: unknown) {
        const parsed = VenueInputSchema.partial().extend({ photos: z.array(z.string()).max(12, '12 photos au plus.').optional() }).safeParse(raw);
        if (!parsed.success) throw new PublicError(firstIssue(parsed.error));
        const { hours, photos, ...fields } = parsed.data;
        const partnerId = await this.resolvePartnerId(partnerUserId);
        // Lot 11b : photos réencodées de la route de dépôt, ou déjà sur l'établissement ; au moins une
        let checkedPhotos: string[] | undefined;
        if (photos !== undefined) {
            const { data: current, error: curErr } = await getServiceRoleClient().from('venues').select('photos').eq('id', venueId).eq('partner_id', partnerId).maybeSingle();
            if (curErr) throw new Error(`établissement : ${curErr.message}`);
            if (!current) throw new PublicError('Établissement introuvable.', 'VENUE_NOT_FOUND', 404);
            checkedPhotos = venuePhotos(photos, partnerId, Array.isArray(current.photos) ? (current.photos as string[]) : []);
            if (checkedPhotos.length === 0) throw new PublicError('Gardez au moins une photo de l’établissement.', 'INVALID_FIELD', 400);
        }
        const { data, error } = await getServiceRoleClient().from('venues')
            .update({ ...fields, ...(checkedPhotos ? { photos: checkedPhotos } : {}), updated_at: new Date().toISOString() })
            .eq('id', venueId).eq('partner_id', partnerId).select('*').maybeSingle();
        if (error) throw dbRefusal(error, 'modification de l’établissement');
        if (!data) throw new PublicError('Établissement introuvable.');
        if (hours) await this.setHours(partnerUserId, venueId, hours);
        return data;
    }

    /** Horaires par la fonction en base (partenaire propriétaire seulement, plages vérifiées, journal). */
    public static async setHours(partnerUserId: string, venueId: string, hours: VenueInput['hours']) {
        const { data, error } = await getServiceRoleClient().rpc('venue_hours_set', { p: { actor_id: partnerUserId, venue_id: venueId, hours } });
        if (error) throw new Error(`venue_hours_set : ${error.message}`);
        const r = data as { ok?: boolean; message?: string };
        if (r?.ok !== true) throw new PublicError(r?.message ?? 'Horaires refusés.');
        return r;
    }

    // ── Zones et tables ────────────────────────────────────────────────────

    public static async getPartnerZones(partnerUserId: string) {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data, error } = await getServiceRoleClient().from('restaurant_zones').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false });
        if (error) throw new Error(`zones : ${error.message}`);
        return data ?? [];
    }

    public static async createZone(partnerUserId: string, raw: unknown) {
        const parsed = ZoneInputSchema.safeParse(raw);
        if (!parsed.success) throw new PublicError(firstIssue(parsed.error));
        if (!parsed.data.venue_id || !parsed.data.name) throw new PublicError('Choisissez l’établissement et le nom de la zone.');
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data, error } = await getServiceRoleClient().from('restaurant_zones')
            .insert({ partner_id: partnerId, venue_id: parsed.data.venue_id, name: parsed.data.name, description: parsed.data.description ?? null, is_active: true })
            .select('*').single();
        if (error || !data) throw dbRefusal(error, 'création de la zone');
        return data;
    }

    public static async updateZone(zoneId: string, partnerUserId: string, raw: unknown) {
        const parsed = ZoneInputSchema.omit({ venue_id: true }).safeParse(raw);
        if (!parsed.success) throw new PublicError(firstIssue(parsed.error));
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data, error } = await getServiceRoleClient().from('restaurant_zones')
            .update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', zoneId).eq('partner_id', partnerId).select('*').maybeSingle();
        if (error) throw dbRefusal(error, 'modification de la zone');
        if (!data) throw new PublicError('Zone introuvable.');
        return data;
    }

    public static async deleteZone(zoneId: string, partnerUserId: string) {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data, error } = await getServiceRoleClient().from('restaurant_zones').delete().eq('id', zoneId).eq('partner_id', partnerId).select('id');
        if (error) throw dbRefusal(error, 'suppression de la zone');
        // Contre-vérification de la 11a (constat) : zone d'une autre partenaire ou inconnue, rien supprimé → 404, jamais un faux succès
        if (!data || data.length === 0) throw new PublicError('Zone introuvable.', 'ZONE_NOT_FOUND', 404);
        return { success: true };
    }

    public static async getPartnerTables(partnerUserId: string) {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data, error } = await getServiceRoleClient().from('restaurant_tables').select('*').eq('partner_id', partnerId).order('created_at', { ascending: false });
        if (error) throw new Error(`tables : ${error.message}`);
        return data ?? [];
    }

    public static async createTable(partnerUserId: string, raw: unknown) {
        const parsed = TableInputSchema.safeParse(raw);
        if (!parsed.success) throw new PublicError(firstIssue(parsed.error));
        const t = parsed.data;
        if (!t.venue_id || !t.table_number || !t.capacity) throw new PublicError('Choisissez l’établissement, le numéro et la capacité de la table.');
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data, error } = await getServiceRoleClient().from('restaurant_tables').insert({
            partner_id: partnerId, venue_id: t.venue_id, zone_id: t.zone_id ?? null, table_number: t.table_number,
            capacity: t.capacity, min_capacity: t.min_capacity ?? 1, is_active: true,
        }).select('*').single();
        if (error || !data) throw dbRefusal(error, 'création de la table');
        return data;
    }

    public static async updateTable(tableId: string, partnerUserId: string, raw: unknown) {
        const parsed = TableInputSchema.omit({ venue_id: true }).safeParse(raw);
        if (!parsed.success) throw new PublicError(firstIssue(parsed.error));
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data, error } = await getServiceRoleClient().from('restaurant_tables')
            .update({ ...parsed.data, updated_at: new Date().toISOString() }).eq('id', tableId).eq('partner_id', partnerId).select('*').maybeSingle();
        if (error) throw dbRefusal(error, 'modification de la table');
        if (!data) throw new PublicError('Table introuvable.');
        return data;
    }

    public static async deleteTable(tableId: string, partnerUserId: string) {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data, error } = await getServiceRoleClient().from('restaurant_tables').delete().eq('id', tableId).eq('partner_id', partnerId).select('id');
        if (error) throw dbRefusal(error, 'suppression de la table');
        // Contre-vérification de la 11a (constat) : table d'une autre partenaire ou inconnue, rien supprimé → 404, jamais un faux succès
        if (!data || data.length === 0) throw new PublicError('Table introuvable.', 'TABLE_NOT_FOUND', 404);
        return { success: true };
    }

    // ── Réservations (lecture ; les changements passent par les fonctions en base) ──

    public static async getPartnerReservations(partnerUserId: string, filters?: { date?: string; venueId?: string }) {
        const partnerId = await this.resolvePartnerId(partnerUserId);
        let query = getServiceRoleClient()
            .from('table_reservations')
            .select('id, venue_id, table_id, zone_id, reservation_date, reservation_time, slot_minutes, guest_count, booking_state, deposit_amount, service_fee_amount, total_amount, paid_amount, refunded_amount, response_due_at, special_requests, onsite_amount, offline_payment_method, created_at')
            .eq('partner_id', partnerId)
            .order('reservation_date', { ascending: true })
            .order('reservation_time', { ascending: true });
        if (filters?.date && /^\d{4}-\d{2}-\d{2}$/.test(filters.date)) query = query.eq('reservation_date', filters.date);
        if (filters?.venueId && /^[0-9a-f-]{36}$/i.test(filters.venueId)) query = query.eq('venue_id', filters.venueId);
        const { data, error } = await query;
        if (error) throw new Error(`réservations : ${error.message}`);
        return (data ?? []).map((r) => ({ ...r, state: tableStateLabel(r.booking_state) }));
    }
}
