import { getServiceRoleClient } from '../supabase/server';

export interface CreateZoneInput {
    name: string;
    description?: string;
}

export interface UpdateZoneInput {
    name?: string;
    description?: string;
    is_active?: boolean;
}

export interface Zone {
    id: string;
    partner_id: string;
    name: string;
    description?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateTableInput {
    zone_id: string;
    table_number: string;
    capacity: number;
    min_capacity?: number;
}

export interface UpdateTableInput {
    zone_id?: string;
    table_number?: string;
    capacity?: number;
    min_capacity?: number;
    is_active?: boolean;
}

export interface Table {
    id: string;
    partner_id: string;
    zone_id: string;
    table_number: string;
    capacity: number;
    min_capacity: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateTableReservationInput {
    tableId: string;
    clientId: string;
    reservationDate: string; // YYYY-MM-DD
    reservationTime: string; // HH:mm:ss
    guestCount: number;
    notes?: string;
}

export interface TableReservation {
    id: string;
    partner_id: string;
    table_id: string;
    zone_id: string;
    client_id: string;
    reservation_date: string;
    reservation_time: string;
    guest_count: number;
    deposit_amount: number;
    is_platform_payment: boolean;
    payment_status: string;
    status: string;
    special_requests?: string;
    created_at: string;
    updated_at: string;
}

export interface ReservationFilters {
    status?: string;
    date?: string;
}

export class TableService {
    /**
     * Résout l'ID partenaire à partir de l'ID utilisateur authentifié
     */
    public static async resolvePartnerId(userId: string): Promise<string> {
        const supabase = getServiceRoleClient();
        const { data: partner, error } = await supabase
            .from('partners')
            .select('id, status')
            .eq('user_id', userId)
            .single();

        if (error || !partner) {
            throw new Error('Profil partenaire introuvable.');
        }

        return partner.id;
    }

    // CRUD Zones
    public static async createZone(partnerUserId: string, input: CreateZoneInput): Promise<Zone> {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { data, error } = await supabase
            .from('restaurant_zones')
            .insert({
                partner_id: partnerId,
                name: input.name,
                description: input.description,
                is_active: true
            })
            .select('*')
            .single();

        if (error || !data) throw new Error(`Échec création zone: ${error?.message}`);
        return data as Zone;
    }

    public static async getPartnerZones(partnerUserId: string): Promise<Zone[]> {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { data, error } = await supabase
            .from('restaurant_zones')
            .select('*')
            .eq('partner_id', partnerId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Erreur récupération zones: ${error.message}`);
        return (data || []) as Zone[];
    }

    public static async updateZone(zoneId: string, partnerUserId: string, input: UpdateZoneInput): Promise<Zone> {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const updateData: any = { updated_at: new Date().toISOString() };
        if (input.name !== undefined) updateData.name = input.name;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.is_active !== undefined) updateData.is_active = input.is_active;

        const { data, error } = await supabase
            .from('restaurant_zones')
            .update(updateData)
            .eq('id', zoneId)
            .eq('partner_id', partnerId)
            .select('*')
            .single();

        if (error || !data) throw new Error(`Échec modification zone: ${error?.message}`);
        return data as Zone;
    }

    public static async deleteZone(zoneId: string, partnerUserId: string): Promise<{success: boolean}> {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { error } = await supabase
            .from('restaurant_zones')
            .delete()
            .eq('id', zoneId)
            .eq('partner_id', partnerId);

        if (error) throw new Error(`Échec suppression zone: ${error.message}`);
        return { success: true };
    }

    // CRUD Tables
    public static async createTable(partnerUserId: string, input: CreateTableInput): Promise<Table> {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { data, error } = await supabase
            .from('restaurant_tables')
            .insert({
                partner_id: partnerId,
                zone_id: input.zone_id,
                table_number: input.table_number,
                capacity: input.capacity,
                min_capacity: input.min_capacity || 1,
                is_active: true
            })
            .select('*')
            .single();

        if (error || !data) throw new Error(`Échec création table: ${error?.message}`);
        return data as Table;
    }

    public static async getPartnerTables(partnerUserId: string): Promise<Table[]> {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { data, error } = await supabase
            .from('restaurant_tables')
            .select('*')
            .eq('partner_id', partnerId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Erreur récupération tables: ${error.message}`);
        return (data || []) as Table[];
    }

    public static async updateTable(tableId: string, partnerUserId: string, input: UpdateTableInput): Promise<Table> {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const updateData: any = { updated_at: new Date().toISOString() };
        if (input.zone_id !== undefined) updateData.zone_id = input.zone_id;
        if (input.table_number !== undefined) updateData.table_number = input.table_number;
        if (input.capacity !== undefined) updateData.capacity = input.capacity;
        if (input.min_capacity !== undefined) updateData.min_capacity = input.min_capacity;
        if (input.is_active !== undefined) updateData.is_active = input.is_active;

        const { data, error } = await supabase
            .from('restaurant_tables')
            .update(updateData)
            .eq('id', tableId)
            .eq('partner_id', partnerId)
            .select('*')
            .single();

        if (error || !data) throw new Error(`Échec modification table: ${error?.message}`);
        return data as Table;
    }

    public static async deleteTable(tableId: string, partnerUserId: string): Promise<{success: boolean}> {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { error } = await supabase
            .from('restaurant_tables')
            .delete()
            .eq('id', tableId)
            .eq('partner_id', partnerId);

        if (error) throw new Error(`Échec suppression table: ${error.message}`);
        return { success: true };
    }

    // Réservations
    public static async createReservation(input: CreateTableReservationInput): Promise<TableReservation> {
        const supabase = getServiceRoleClient();

        // RPC call for atomic creation
        const { data, error } = await supabase.rpc('create_table_reservation_atomic', {
            p_table_id: input.tableId,
            p_client_id: input.clientId,
            p_reservation_date: input.reservationDate,
            p_reservation_time: input.reservationTime,
            p_guest_count: input.guestCount,
            p_notes: input.notes || null
        });

        if (error) {
            throw new Error(`Échec création réservation: ${error.message}`);
        }

        if (!data || !data.success) {
            throw new Error(`Échec réservation: ${data?.error || 'Erreur inconnue'}`);
        }

        return data.reservation as TableReservation;
    }

    public static async getPartnerReservations(partnerUserId: string, filters?: ReservationFilters): Promise<TableReservation[]> {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        let query = supabase
            .from('table_reservations')
            .select('*')
            .eq('partner_id', partnerId)
            .order('reservation_date', { ascending: true })
            .order('reservation_time', { ascending: true });

        if (filters?.status) {
            query = query.eq('status', filters.status);
        }
        if (filters?.date) {
            query = query.eq('reservation_date', filters.date);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Erreur récupération réservations: ${error.message}`);
        return (data || []) as TableReservation[];
    }

    public static async updateReservationStatus(reservationId: string, partnerUserId: string, status: string): Promise<TableReservation> {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { data, error } = await supabase
            .from('table_reservations')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', reservationId)
            .eq('partner_id', partnerId)
            .select('*')
            .single();

        if (error || !data) throw new Error(`Échec modification réservation: ${error?.message}`);
        return data as TableReservation;
    }

    public static async cancelReservation(reservationId: string, actorId: string, reason: string): Promise<{success: boolean}> {
        const supabase = getServiceRoleClient();

        const { data: existing, error: findErr } = await supabase
            .from('table_reservations')
            .select('*, partners(user_id)')
            .eq('id', reservationId)
            .single();

        if (findErr || !existing) throw new Error('Réservation introuvable.');

        const isOwner = existing.partners?.user_id === actorId;
        const isClient = existing.client_id === actorId;

        if (!isOwner && !isClient) throw new Error('Action non autorisée.');

        const { error } = await supabase
            .from('table_reservations')
            .update({
                status: 'ANNULEE',
                payment_status: 'CANCELLED',
                updated_at: new Date().toISOString()
            })
            .eq('id', reservationId);

        if (error) throw new Error(`Échec annulation: ${error.message}`);

        return { success: true };
    }
}
