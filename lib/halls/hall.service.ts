import { getServiceRoleClient } from '../supabase/server';
import { NotificationService } from '../notifications/notification.service';
import { FinancialCalculatorService } from '../payments/financial-calculator.service';

export interface CreateHallInput {
    name: string;
    description?: string;
    capacity: number;
    price_per_day?: number | null;
    price_per_hour?: number | null;
    deposit_percentage?: number; // Configurable par le Partenaire (§45)
    address?: string;
    city?: string;
    amenities?: string[];
    images?: string[];
}

export interface UpdateHallInput extends Partial<CreateHallInput> {
    is_active?: boolean;
}

export interface CreateHallReservationInput {
    hallId: string;
    clientId: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    startTime?: string;
    endTime?: string;
    notes?: string;
    moratoriumDate?: string;
}

export class HallService {
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

    /**
     * Création d'une salle par le Partenaire (§42 CDC V3.0)
     */
    public static async createHall(partnerUserId: string, input: CreateHallInput) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        if (!input.name || !input.name.trim()) {
            throw new Error('Le nom de la salle est obligatoire.');
        }
        if (!input.capacity || input.capacity <= 0) {
            throw new Error('La capacité de la salle doit être supérieure à 0.');
        }
        if ((!input.price_per_day || input.price_per_day < 0) && (!input.price_per_hour || input.price_per_hour < 0)) {
            throw new Error('Vous devez renseigner au moins un tarif valide (par jour ou par heure).');
        }

        // Taux d'acompte configurable (par défaut 30%, modifiable par le partenaire)
        const depositRate = input.deposit_percentage !== undefined ? Number(input.deposit_percentage) : 30.0;
        if (depositRate < 0 || depositRate > 100) {
            throw new Error('Le taux d\'acompte doit être compris entre 0% et 100%.');
        }

        const { data: hall, error } = await supabase
            .from('halls')
            .insert({
                partner_id: partnerId,
                name: input.name.trim(),
                description: input.description || null,
                capacity: Number(input.capacity),
                price_per_day: input.price_per_day ? Number(input.price_per_day) : null,
                price_per_hour: input.price_per_hour ? Number(input.price_per_hour) : null,
                deposit_percentage: depositRate,
                address: input.address || null,
                city: input.city || 'Dakar',
                amenities: input.amenities || [],
                images: input.images || [],
                is_active: true,
            })
            .select('*')
            .single();

        if (error || !hall) {
            throw new Error(`Échec création de salle: ${error?.message}`);
        }

        return hall;
    }

    /**
     * Récupère les salles du partenaire avec les réservations actives
     */
    public static async getPartnerHalls(partnerUserId: string) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { data: halls, error } = await supabase
            .from('halls')
            .select('*, hall_reservations(*)')
            .eq('partner_id', partnerId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Erreur récupération salles: ${error.message}`);
        }

        return halls || [];
    }

    /**
     * Récupère une salle par son ID
     */
    public static async getHallById(hallId: string) {
        const supabase = getServiceRoleClient();
        const { data: hall, error } = await supabase
            .from('halls')
            .select('*, partners(company_name, phone, user_id), hall_reservations(*)')
            .eq('id', hallId)
            .single();

        if (error || !hall) {
            throw new Error('Salle introuvable.');
        }

        return hall;
    }

    /**
     * Mise à jour d'une salle
     */
    public static async updateHall(hallId: string, partnerUserId: string, input: UpdateHallInput) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (input.name) updateData.name = input.name.trim();
        if (input.description !== undefined) updateData.description = input.description;
        if (input.capacity) updateData.capacity = Number(input.capacity);
        if (input.price_per_day !== undefined) updateData.price_per_day = input.price_per_day ? Number(input.price_per_day) : null;
        if (input.price_per_hour !== undefined) updateData.price_per_hour = input.price_per_hour ? Number(input.price_per_hour) : null;
        if (input.deposit_percentage !== undefined) updateData.deposit_percentage = Number(input.deposit_percentage);
        if (input.address !== undefined) updateData.address = input.address;
        if (input.city !== undefined) updateData.city = input.city;
        if (input.amenities !== undefined) updateData.amenities = input.amenities;
        if (input.images !== undefined) updateData.images = input.images;
        if (input.is_active !== undefined) updateData.is_active = input.is_active;

        const { data: updated, error } = await supabase
            .from('halls')
            .update(updateData)
            .eq('id', hallId)
            .eq('partner_id', partnerId)
            .select('*')
            .single();

        if (error || !updated) {
            throw new Error(`Échec modification salle: ${error?.message}`);
        }

        return updated;
    }

    /**
     * Suppression / Désactivation d'une salle
     */
    public static async deleteHall(hallId: string, partnerUserId: string) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        // Vérification des réservations actives
        const { data: activeRes } = await supabase
            .from('hall_reservations')
            .select('id')
            .eq('hall_id', hallId)
            .in('status', ['EN_ATTENTE', 'CONFIRMEE']);

        if (activeRes && activeRes.length > 0) {
            throw new Error('Impossible de supprimer une salle ayant des réservations actives. Veuillez la désactiver.');
        }

        const { error } = await supabase
            .from('halls')
            .delete()
            .eq('id', hallId)
            .eq('partner_id', partnerId);

        if (error) {
            throw new Error(`Échec suppression salle: ${error.message}`);
        }

        return { success: true };
    }

    /**
     * Création d'une réservation avec gestion Acompte, Solde et Moratoire (§45-§48 CDC V3.0)
     */
    public static async createReservation(input: CreateHallReservationInput) {
        const supabase = getServiceRoleClient();

        // 1. Validation de la chronologie des dates
        if (input.endDate < input.startDate) {
            throw new Error('La date de fin ne peut pas être antérieure à la date de début.');
        }

        // 2. Récupération de la salle et vérification de la disponibilité
        const { data: hall, error: hallErr } = await supabase
            .from('halls')
            .select('*, partners(user_id, company_name)')
            .eq('id', input.hallId)
            .eq('is_active', true)
            .single();

        if (hallErr || !hall) {
            throw new Error('Salle introuvable ou indisponible.');
        }

        // 3. Détection de conflit de dates (Protection anti-double réservation)
        const { data: conflicting } = await supabase
            .from('hall_reservations')
            .select('id, start_date, end_date, status')
            .eq('hall_id', input.hallId)
            .in('status', ['EN_ATTENTE', 'CONFIRMEE'])
            .lte('start_date', input.endDate)
            .gte('end_date', input.startDate);

        if (conflicting && conflicting.length > 0) {
            throw new Error('La salle est déjà réservée pour cette période (dates conflictuelles).');
        }

        // 4. Calcul de la durée en jours et du montant total
        const start = new Date(input.startDate);
        const end = new Date(input.endDate);
        const diffDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

        const dayRate = Number(hall.price_per_day || (hall.price_per_hour ? hall.price_per_hour * 8 : 100000));
        const totalAmount = dayRate * diffDays;

        // 5. Calcul précis de l'Acompte et du Solde selon le taux configurable
        const depositRate = Number(hall.deposit_percentage || 30.0);
        const depositAmount = Math.round((totalAmount * depositRate) / 100);
        const balanceAmount = totalAmount - depositAmount;

        // Invariant : total = deposit + balance
        if (depositAmount + balanceAmount !== totalAmount) {
            throw new Error('Erreur d\'équilibre financier sur le calcul du solde.');
        }

        // 6. Calcul de la date de moratoire par défaut (7 jours avant l'événement ou veille si court délai)
        let moratorium = input.moratoriumDate;
        if (!moratorium) {
            const moraDate = new Date(start);
            moraDate.setDate(moraDate.getDate() - 7);
            const today = new Date();
            if (moraDate < today) {
                moraDate.setTime(today.getTime() + 2 * 24 * 60 * 60 * 1000); // 48h
            }
            moratorium = moraDate.toISOString().split('T')[0];
        }

        // 7. Insertion de la réservation
        const { data: reservation, error: resErr } = await supabase
            .from('hall_reservations')
            .insert({
                hall_id: input.hallId,
                partner_id: hall.partner_id,
                client_id: input.clientId,
                start_date: input.startDate,
                end_date: input.endDate,
                start_time: input.startTime || null,
                end_time: input.endTime || null,
                total_amount: totalAmount,
                deposit_amount: depositAmount,
                balance_amount: balanceAmount,
                moratorium_date: moratorium,
                status: 'EN_ATTENTE',
                payment_status: 'PENDING',
                notes: input.notes || null,
            })
            .select('*')
            .single();

        if (resErr || !reservation) {
            throw new Error(`Échec création réservation: ${resErr?.message}`);
        }

        // 8. Notification au Partenaire gérant la salle
        if (hall.partners?.user_id) {
            await NotificationService.createNotification({
                userId: hall.partners.user_id,
                title: 'Nouvelle Demande de Réservation de Salle',
                message: `Une demande de réservation a été effectuée pour la salle "${hall.name}" du ${input.startDate} au ${input.endDate} (Total: ${totalAmount} FCFA, Acompte: ${depositAmount} FCFA).`,
                type: 'RESERVATION',
                data: { hallId: input.hallId, reservationId: reservation.id, totalAmount },
            });
        }

        return reservation;
    }

    /**
     * Confirmation d'une réservation par le Partenaire
     */
    public static async confirmReservation(reservationId: string, partnerUserId: string) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { data: updated, error } = await supabase
            .from('hall_reservations')
            .update({
                status: 'CONFIRMEE',
                updated_at: new Date().toISOString(),
            })
            .eq('id', reservationId)
            .eq('partner_id', partnerId)
            .select('*')
            .single();

        if (error || !updated) {
            throw new Error(`Échec confirmation réservation: ${error?.message}`);
        }

        // Notification au client
        await NotificationService.createNotification({
            userId: updated.client_id,
            title: 'Réservation de Salle Confirmée !',
            message: `Votre réservation pour la période du ${updated.start_date} au ${updated.end_date} a été confirmée par le partenaire.`,
            type: 'RESERVATION',
            data: { reservationId },
        });

        return updated;
    }

    /**
     * Annulation d'une réservation
     */
    public static async cancelReservation(reservationId: string, userId: string, reason?: string) {
        const supabase = getServiceRoleClient();

        const { data: existing, error: findErr } = await supabase
            .from('hall_reservations')
            .select('*, partners(user_id)')
            .eq('id', reservationId)
            .single();

        if (findErr || !existing) {
            throw new Error('Réservation introuvable.');
        }

        const isOwner = existing.partners?.user_id === userId;
        const isClient = existing.client_id === userId;

        if (!isOwner && !isClient) {
            throw new Error('Action non autorisée.');
        }

        const { data: updated, error } = await supabase
            .from('hall_reservations')
            .update({
                status: 'ANNULEE',
                payment_status: 'CANCELLED',
                updated_at: new Date().toISOString(),
            })
            .eq('id', reservationId)
            .select('*')
            .single();

        if (error || !updated) {
            throw new Error(`Échec annulation: ${error?.message}`);
        }

        // Notification croisée
        const targetUserId = isOwner ? existing.client_id : existing.partners?.user_id;
        if (targetUserId) {
            await NotificationService.createNotification({
                userId: targetUserId,
                title: 'Réservation de Salle Annulée',
                message: `La réservation du ${existing.start_date} au ${existing.end_date} a été annulée. Motif : ${reason || 'Non spécifié'}.`,
                type: 'RESERVATION',
                data: { reservationId },
            });
        }

        return updated;
    }
}
