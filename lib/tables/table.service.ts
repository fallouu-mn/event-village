import { z } from 'zod';
import { getServiceRoleClient } from '../supabase/server';
import { PublicError } from '@/lib/api/public-error';
import { tableStateLabel } from './booking';

/**
 * Lot 11a — service des tables côté partenaire : établissements (restaurant, bar, espace), horaires, zones et tables.
 * Écritures avec le rôle de service, toujours limitées à la partenaire de la session ; la base revérifie tout
 * (déclencheurs trg_venues_validation_guard et trg_restaurant_*_venue_guard : établissement de la même partenaire,
 * zone du même établissement, statut de validation jamais écrit ici). Une réservation n'est jamais écrite ici : elle
 * ne change que par les fonctions en base (table_reserve, table_reservation_cancel, table_reservation_respond,
 * table_reservation_presence, table_onsite_payment_record), sous verrou et avec journal.
 */

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

    public static async createVenue(partnerUserId: string, raw: unknown) {
        const parsed = VenueInputSchema.safeParse(raw);
        if (!parsed.success) throw new PublicError(firstIssue(parsed.error));
        const { hours, ...fields } = parsed.data;
        const partnerId = await this.resolvePartnerId(partnerUserId);
        // Comme une salle (lot 10a) : seule une fiche partenaire VALIDE crée un établissement
        const { data: fiche } = await getServiceRoleClient().from('partners').select('status').eq('id', partnerId).maybeSingle();
        if (fiche?.status !== 'VALIDE') throw new PublicError('Votre compte partenaire doit être validé avant de créer un établissement.');
        const { data, error } = await getServiceRoleClient().from('venues').insert({ ...fields, partner_id: partnerId }).select('*').single();
        if (error || !data) throw dbRefusal(error, 'création de l’établissement');
        if (hours) await this.setHours(partnerUserId, data.id, hours);
        return data;
    }

    public static async updateVenue(partnerUserId: string, venueId: string, raw: unknown) {
        const parsed = VenueInputSchema.partial().safeParse(raw);
        if (!parsed.success) throw new PublicError(firstIssue(parsed.error));
        const { hours, ...fields } = parsed.data;
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data, error } = await getServiceRoleClient().from('venues')
            .update({ ...fields, updated_at: new Date().toISOString() }).eq('id', venueId).eq('partner_id', partnerId).select('*').maybeSingle();
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
        const { error } = await getServiceRoleClient().from('restaurant_zones').delete().eq('id', zoneId).eq('partner_id', partnerId);
        if (error) throw dbRefusal(error, 'suppression de la zone');
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
        const { error } = await getServiceRoleClient().from('restaurant_tables').delete().eq('id', tableId).eq('partner_id', partnerId);
        if (error) throw dbRefusal(error, 'suppression de la table');
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
