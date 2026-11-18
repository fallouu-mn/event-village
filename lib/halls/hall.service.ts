import { getServiceRoleClient } from '../supabase/server';
import { PublicError } from '@/lib/api/public-error';
import { assertNoPosterFolder } from '@/lib/images/image-address';
import { sendHallRefunds } from './refunds';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DepositMode = 'POURCENTAGE' | 'MONTANT_FIXE';
export type CancellationPolicy = 'SOUPLE' | 'MODEREE' | 'STRICTE';

export interface CreateHallInput {
    name: string;
    description?: string;
    capacity: number;
    /** Lot 10a : prix par jour obligatoire, en F CFA entiers. */
    price_per_day: number;
    /** Lot 10a : prix par heure facultatif, en F CFA entiers. */
    price_per_hour?: number | null;
    /** Lot 10a : acompte en pourcentage du prix (1 à 100 ; vide = réglage) ou montant fixe (F CFA). */
    deposit_mode?: DepositMode;
    deposit_value?: number | null;
    /** Ancien nom de l'acompte en pourcentage (lot 0) : repris comme deposit_value si celui-ci est absent. */
    deposit_percentage?: number;
    /** Lot 10a : règle d'annulation choisie parmi les trois d'Event Village. */
    cancellation_policy?: CancellationPolicy;
    /** Lot 10a : position (bornes du Sénégal, comme les événements). */
    latitude?: number | null;
    longitude?: number | null;
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
    startDate: string; // AAAA-MM-JJ
    endDate: string;   // AAAA-MM-JJ
    startTime?: string;
    endTime?: string;
    notes?: string;
    /** Ancien champ (lot 0), ignoré : l'échéance du solde est calculée en base (halls.balance_due_days). */
    moratoriumDate?: string;
}

const POLICIES: readonly CancellationPolicy[] = ['SOUPLE', 'MODEREE', 'STRICTE'];

/** Montant en F CFA entier d'au moins 1, ou une erreur lisible. */
function wholeFcfa(value: unknown, what: string): number {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) throw new PublicError(`${what} doit être un nombre entier de francs CFA, au moins 1.`);
    return n;
}

/**
 * Lot 10a — champs d'argent, d'annulation et de position d'une salle, contrôlés avant l'écriture (la base garde les
 * mêmes règles : halls_price_day_required_chk, halls_deposit_chk, halls_cancellation_policy_chk, halls_position_chk).
 */
function hallRules(input: Partial<CreateHallInput>, creating: boolean): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (creating || input.price_per_day !== undefined) out.price_per_day = wholeFcfa(input.price_per_day, 'Le prix par jour');
    if (input.price_per_hour !== undefined) {
        out.price_per_hour = input.price_per_hour === null || input.price_per_hour === 0 ? null : wholeFcfa(input.price_per_hour, 'Le prix par heure');
    }
    if (creating || input.deposit_mode !== undefined || input.deposit_value !== undefined || input.deposit_percentage !== undefined) {
        const mode = input.deposit_mode ?? 'POURCENTAGE';
        if (mode !== 'POURCENTAGE' && mode !== 'MONTANT_FIXE') throw new PublicError('Choisissez un acompte en pourcentage ou en montant fixe.');
        const raw = input.deposit_value ?? (mode === 'POURCENTAGE' ? input.deposit_percentage : undefined);
        if (mode === 'POURCENTAGE') {
            if (raw === undefined || raw === null) {
                out.deposit_value = null;
            } else {
                const pct = Number(raw);
                if (!Number.isFinite(pct) || pct < 1 || pct > 100) throw new PublicError('L’acompte en pourcentage va de 1 à 100 %.');
                out.deposit_value = pct;
                // Ancienne colonne gardée en cohérence (lectures du lot 0)
                out.deposit_percentage = pct;
            }
        } else {
            out.deposit_value = wholeFcfa(raw, 'L’acompte fixe');
        }
        out.deposit_mode = mode;
    }
    if (creating || input.cancellation_policy !== undefined) {
        const policy = input.cancellation_policy ?? 'MODEREE';
        if (!POLICIES.includes(policy)) throw new PublicError('Choisissez une règle d’annulation : souple, modérée ou stricte.');
        out.cancellation_policy = policy;
    }
    if (input.latitude !== undefined || input.longitude !== undefined) {
        const lat = input.latitude ?? null;
        const lng = input.longitude ?? null;
        if ((lat === null) !== (lng === null)) throw new PublicError('La position du lieu est incomplète : touchez la carte pour placer le repère.');
        if (lat !== null && lng !== null) {
            if (!(Number(lat) >= 12.2 && Number(lat) <= 16.8 && Number(lng) >= -17.6 && Number(lng) <= -11.3)) {
                throw new PublicError('Le repère doit être placé au Sénégal : touchez la carte à l’emplacement de la salle.');
            }
        }
        out.latitude = lat === null ? null : Number(lat);
        out.longitude = lng === null ? null : Number(lng);
    }
    return out;
}

export class HallService {
    /**
     * Résout l'ID partenaire à partir de l'ID utilisateur authentifié
     */
    public static async resolvePartnerId(userId: string, opts: { requireValidated?: boolean } = {}): Promise<string> {
        const supabase = getServiceRoleClient();
        const { data: partner, error } = await supabase
            .from('partners')
            .select('id, status')
            .eq('user_id', userId)
            .single();

        if (error || !partner) {
            throw new PublicError('Profil partenaire introuvable.');
        }
        // Lot 10a : une fiche non validée ou suspendue ne crée rien de nouveau
        if (opts.requireValidated && partner.status !== 'VALIDE') {
            throw new PublicError('Votre compte partenaire doit être validé pour ajouter une salle.', 'PARTNER_NOT_VALIDATED', 403);
        }

        return partner.id;
    }

    /**
     * Création d'une salle par le Partenaire (§42 CDC V3.0)
     */
    public static async createHall(partnerUserId: string, input: CreateHallInput) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId, { requireValidated: true });

        if (!input.name || !input.name.trim()) {
            throw new PublicError('Le nom de la salle est obligatoire.');
        }
        if (!input.capacity || input.capacity <= 0) {
            throw new PublicError('La capacité de la salle doit être supérieure à 0.');
        }
        const rules = hallRules(input, true);
        // Correctifs de la contre-vérification de la finition 2a (T6) : jamais une image du dossier des affiches (events/)
        assertNoPosterFolder(input.images);

        // Lot 10a : statut de validation posé par la base (trg_halls_validation_guard, réglage halls.validation_required)
        const { data: hall, error } = await supabase
            .from('halls')
            .insert({
                partner_id: partnerId,
                name: input.name.trim(),
                description: input.description || null,
                capacity: Number(input.capacity),
                ...rules,
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
        // Lot 9 (A32) : absence ou uuid invalide : 404 ; panne : erreur, journal et 500.
        const notFound = () => new PublicError('Salle introuvable.', 'HALL_NOT_FOUND', 404);
        if (!UUID_RE.test(hallId)) throw notFound();

        const supabase = getServiceRoleClient();
        const { data: hall, error } = await supabase
            .from('halls')
            .select('*, partners(company_name, phone, user_id), hall_reservations(*)')
            .eq('id', hallId)
            .maybeSingle();

        if (error) throw new Error(`salle ${hallId} illisible : ${error.message}`);
        if (!hall) throw notFound();

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
        // Lot 10a : prix, acompte, règle d'annulation et position contrôlés ; une réservation déjà faite garde ses
        // montants et sa règle (figés à sa création)
        Object.assign(updateData, hallRules(input, false));
        if (input.address !== undefined) updateData.address = input.address;
        if (input.city !== undefined) updateData.city = input.city;
        if (input.amenities !== undefined) updateData.amenities = input.amenities;
        if (input.images !== undefined) {
            // Correctifs de la contre-vérification de la finition 2a (T6) : jamais une image du dossier des affiches
            assertNoPosterFolder(input.images);
            updateData.images = input.images;
        }
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
            throw new PublicError('Impossible de supprimer une salle ayant des réservations actives. Veuillez la désactiver.');
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
     * Lot 10a : réservation par la seule fonction en base (hall_reserve) ; aucun montant calculé ici. Gardé pour les
     * appels serveur et les tests : à la journée (dates de début et de fin) ou à l'heure (même date, heures pleines).
     */
    public static async createReservation(input: CreateHallReservationInput) {
        const supabase = getServiceRoleClient();
        const hourly = Boolean(input.startTime && input.endTime && input.startDate === input.endDate);
        const units = hourly
            ? Math.round((Date.parse(`1970-01-01T${input.endTime}:00Z`) - Date.parse(`1970-01-01T${input.startTime}:00Z`)) / 3_600_000)
            : Math.round((Date.parse(`${input.endDate}T00:00:00Z`) - Date.parse(`${input.startDate}T00:00:00Z`)) / 86_400_000) + 1;
        const { data, error } = await supabase.rpc('hall_reserve', {
            p: {
                client_id: input.clientId,
                hall_id: input.hallId,
                mode: hourly ? 'HEURE' : 'JOUR',
                start_date: input.startDate,
                units,
                start_time: hourly ? input.startTime : null,
                notes: input.notes ?? null,
            },
        });
        if (error) throw new Error(`hall_reserve : ${error.message}`);
        const r = data as { ok?: boolean; code?: string; message?: string; reservation_id?: string };
        if (r?.ok !== true) throw new PublicError(r?.message ?? 'Réservation impossible.', r?.code, 409);
        const { data: reservation, error: readErr } = await supabase.from('hall_reservations').select('*').eq('id', r.reservation_id).single();
        if (readErr || !reservation) throw new Error(`Lecture de la réservation ${r.reservation_id} impossible : ${readErr?.message}`);
        return reservation;
    }

    /**
     * Lot 10a (C1) : une réservation est confirmée par son paiement, jamais par la salle. Rend la réservation si elle
     * est payée (acompte ou totalité) ; sinon refus.
     */
    public static async confirmReservation(reservationId: string, partnerUserId: string) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);
        const { data: reservation, error } = await supabase
            .from('hall_reservations').select('*').eq('id', reservationId).eq('partner_id', partnerId).maybeSingle();
        if (error) throw new Error(`Lecture de la réservation ${reservationId} impossible : ${error.message}`);
        if (!reservation) throw new PublicError('Réservation introuvable.', 'RESERVATION_NOT_FOUND', 404);
        if (reservation.booking_state !== 'ACOMPTE_PAYE' && reservation.booking_state !== 'PAYEE') {
            throw new PublicError('Cette réservation n’est pas payée : elle sera confirmée automatiquement dès que le client aura payé l’acompte.', 'NOT_PAID', 409);
        }
        return reservation;
    }

    /**
     * Lot 10a : annulation par la fonction en base (hall_reservation_cancel) : par la salle (remboursement total, motif
     * obligatoire) ou par le client (règle d'annulation figée sur la réservation). Les remboursements sont envoyés.
     */
    public static async cancelReservation(reservationId: string, userId: string, reason?: string) {
        const supabase = getServiceRoleClient();
        const { data: current, error: readErr } = await supabase
            .from('hall_reservations').select('client_id').eq('id', reservationId).maybeSingle();
        if (readErr) throw new Error(`Lecture de la réservation ${reservationId} impossible : ${readErr.message}`);
        if (!current) throw new PublicError('Réservation introuvable.', 'RESERVATION_NOT_FOUND', 404);
        const origin = current.client_id === userId ? 'CLIENT' : 'SALLE';
        const { data, error } = await supabase.rpc('hall_reservation_cancel', {
            p: { reservation_id: reservationId, actor_id: userId, origin, reason: reason ?? '' },
        });
        if (error) throw new Error(`hall_reservation_cancel : ${error.message}`);
        const r = data as { ok?: boolean; code?: string; message?: string; cashout_ids?: unknown };
        if (r?.ok !== true) throw new PublicError(r?.message ?? 'Annulation impossible.', r?.code, 409);
        await sendHallRefunds(r.cashout_ids);
        const { data: reservation, error: afterErr } = await supabase.from('hall_reservations').select('*').eq('id', reservationId).single();
        if (afterErr || !reservation) throw new Error(`Lecture de la réservation ${reservationId} impossible : ${afterErr?.message}`);
        return reservation;
    }
}
