import { getServiceRoleClient } from '../supabase/server';
import { PublicError } from '@/lib/api/public-error';
import { assertNoPosterFolder } from '@/lib/images/image-address';
import { STORED_IMAGE_NAME_RE } from '@/lib/images/stored-name';
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

/**
 * Correctifs de la contre-vérification du lot 10a (T1) : colonnes de la fiche d'une salle lues par sa propriétaire
 * (écran de modification). Jamais les réservations, ni le téléphone ou le compte de la partenaire.
 */
const OWN_HALL_COLUMNS = 'id, name, description, capacity, price_per_day, price_per_hour, deposit_mode, deposit_value, deposit_percentage, '
    + 'cancellation_policy, latitude, longitude, address, city, amenities, images, is_active, validation_status, validation_reason, created_at, updated_at';

/** Préfixe des photos des salles de la partenaire : `${SUPABASE_URL}/storage/v1/object/public/public-images/halls/<partner_id>/`. */
export function hallPhotoPrefix(partnerId: string): string | null {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    if (!base) return null;
    return `${base}/storage/v1/object/public/public-images/halls/${partnerId}/`;
}

/** Vrai si l'adresse désigne une photo déposée par la route de dépôt (réencodée) dans le dossier des salles de la partenaire. */
export function isPartnerHallPhotoUrl(url: unknown, partnerId: string): boolean {
    if (typeof url !== 'string') return false;
    const prefix = hallPhotoPrefix(partnerId);
    if (!prefix || !url.startsWith(prefix)) return false;
    return STORED_IMAGE_NAME_RE.test(url.slice(prefix.length));
}

export const HALL_PHOTOS_MAX = 12;

/**
 * Lot 10b (point 3) : photos d'une salle réencodées comme les affiches. Chaque photo doit venir de la route de dépôt
 * (POST /api/partner/upload, dossier halls/<partenaire>/, fichier réencodé « horodatage_8 caractères.webp ») ; une photo
 * déjà enregistrée sur la salle et renvoyée telle quelle reste acceptée. 12 photos au plus, sans doublon.
 */
export function hallPhotos(images: unknown, partnerId: string, previous: readonly string[] = []): string[] {
    assertNoPosterFolder(images);
    if (!Array.isArray(images)) throw new PublicError('Liste de photos illisible.', 'INVALID_FIELD', 400);
    if (images.length > HALL_PHOTOS_MAX) throw new PublicError(`${HALL_PHOTOS_MAX} photos au plus par salle.`, 'INVALID_FIELD', 400);
    const out: string[] = [];
    for (const url of images) {
        if (typeof url !== 'string' || !(previous.includes(url) || isPartnerHallPhotoUrl(url, partnerId))) {
            throw new PublicError('Une photo ne vient pas de cette page : déposez-la depuis le formulaire de la salle.', 'IMAGE_ORIGIN_INVALID', 400);
        }
        if (!out.includes(url)) out.push(url);
    }
    return out;
}

/** Texte saisi : rogné, sans caractère de contrôle, longueur bornée ; vide = null. */
function cleanText(value: unknown, max: number, what: string): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') throw new PublicError(`${what} : texte attendu.`, 'INVALID_FIELD', 400);
    const s = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim();
    if (s.length > max) throw new PublicError(`${what} : ${max} caractères au plus.`, 'INVALID_FIELD', 400);
    return s.length > 0 ? s : null;
}

/** Équipements : 30 au plus, 40 caractères chacun, sans doublon. */
function cleanAmenities(value: unknown): string[] {
    if (!Array.isArray(value)) throw new PublicError('Liste des équipements illisible.', 'INVALID_FIELD', 400);
    const out: string[] = [];
    for (const a of value) {
        const s = cleanText(a, 40, 'Un équipement');
        if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
    }
    if (out.length > 30) throw new PublicError('30 équipements au plus.', 'INVALID_FIELD', 400);
    return out;
}

/** Capacité : nombre entier de personnes, de 1 à 100 000. */
function cleanCapacity(value: unknown): number {
    const n = Number(value);
    if (value === undefined || value === null || value === '' || !(n > 0)) throw new PublicError('La capacité de la salle doit être supérieure à 0.');
    if (!Number.isInteger(n) || n < 1 || n > 100_000) throw new PublicError('La capacité est un nombre entier de personnes, de 1 à 100 000.', 'INVALID_FIELD', 400);
    return n;
}

/** Montant en F CFA entier d'au moins 1, ou une erreur lisible. */
function wholeFcfa(value: unknown, what: string): number {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) throw new PublicError(`${what} doit être un nombre entier de francs CFA, au moins 1.`);
    return n;
}

/**
 * Lot 10a — champs d'argent, d'annulation et de position d'une salle, contrôlés avant l'écriture (la base garde les
 * mêmes règles : halls_price_chk, halls_deposit_chk, halls_cancellation_policy_chk, halls_position_chk).
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

        const name = cleanText(input.name, 120, 'Le nom de la salle');
        if (!name) {
            throw new PublicError('Le nom de la salle est obligatoire.');
        }
        const capacity = cleanCapacity(input.capacity);
        const rules = hallRules(input, true);
        // Correctifs de la contre-vérification de la finition 2a (T6) : jamais une image du dossier des affiches (events/) ;
        // lot 10b : seulement des photos déposées (réencodées) dans le dossier des salles de la partenaire
        const images = hallPhotos(input.images ?? [], partnerId);

        // Lot 10a : statut de validation posé par la base (trg_halls_validation_guard, réglage halls.validation_required)
        const { data: hall, error } = await supabase
            .from('halls')
            .insert({
                partner_id: partnerId,
                name,
                description: cleanText(input.description, 4000, 'La description'),
                capacity,
                ...rules,
                address: cleanText(input.address, 200, 'L’adresse'),
                city: cleanText(input.city, 80, 'La ville') ?? 'Dakar',
                amenities: cleanAmenities(input.amenities ?? []),
                images,
                is_active: true,
            })
            .select(OWN_HALL_COLUMNS)
            .single();

        if (error || !hall) {
            throw new Error(`Échec création de salle: ${error?.message}`);
        }

        return hall as unknown as Record<string, any>;
    }

    private static async ownPartnerId(userId: string): Promise<string | null> {
        const { data, error } = await getServiceRoleClient().from('partners').select('id').eq('user_id', userId).maybeSingle();
        if (error) throw new Error(`partenaire du compte ${userId} illisible : ${error.message}`);
        return data ? String(data.id) : null;
    }

    /**
     * Correctifs de la contre-vérification du lot 10a (T1) : la salle n'existe que pour sa propriétaire. Une salle
     * d'une autre partenaire, un compte sans fiche partenaire, un identifiant invalide : même « Salle introuvable »
     * (404). Rend l'identifiant de la fiche partenaire.
     */
    private static async assertOwnHall(hallId: string, userId: string): Promise<string> {
        const notFound = () => new PublicError('Salle introuvable.', 'HALL_NOT_FOUND', 404);
        if (!UUID_RE.test(hallId)) throw notFound();
        const partnerId = await this.ownPartnerId(userId);
        if (!partnerId) throw notFound();
        const { data, error } = await getServiceRoleClient().from('halls').select('id').eq('id', hallId).eq('partner_id', partnerId).maybeSingle();
        if (error) throw new Error(`salle ${hallId} illisible : ${error.message}`);
        if (!data) throw notFound();
        return partnerId;
    }

    /**
     * Fiche d'une salle pour l'écran de modification de sa propriétaire (GET /api/partner/halls/[id]).
     * Lot 9 (A32) : absence ou uuid invalide : 404 ; panne : erreur, journal et 500.
     * Correctifs de la contre-vérification du lot 10a (T1) : seulement la partenaire propriétaire (fiche résolue depuis
     * la session ; sinon 404 sans indice) ; colonnes de la fiche seulement : ni réservations (client, note, montants),
     * ni téléphone ni compte de la partenaire. L'écran n'a besoin que de savoir s'il reste des réservations en cours.
     */
    public static async getOwnHall(hallId: string, partnerUserId: string) {
        const notFound = () => new PublicError('Salle introuvable.', 'HALL_NOT_FOUND', 404);
        if (!UUID_RE.test(hallId)) throw notFound();
        const partnerId = await this.ownPartnerId(partnerUserId);
        if (!partnerId) throw notFound();

        const supabase = getServiceRoleClient();
        const { data: hall, error } = await supabase
            .from('halls')
            .select(OWN_HALL_COLUMNS)
            .eq('id', hallId)
            .eq('partner_id', partnerId)
            .maybeSingle();

        if (error) throw new Error(`salle ${hallId} illisible : ${error.message}`);
        if (!hall) throw notFound();

        const { count, error: countErr } = await supabase
            .from('hall_reservations')
            .select('id', { count: 'exact', head: true })
            .eq('hall_id', hallId)
            .in('status', ['EN_ATTENTE', 'CONFIRMEE']);
        if (countErr) throw new Error(`réservations de la salle ${hallId} illisibles : ${countErr.message}`);

        return { ...(hall as unknown as Record<string, unknown>), has_active_reservations: (count ?? 0) > 0 };
    }

    /**
     * Mise à jour d'une salle
     */
    public static async updateHall(hallId: string, partnerUserId: string, input: UpdateHallInput) {
        const supabase = getServiceRoleClient();
        // Correctifs de la contre-vérification du lot 10a (T1) : salle d'une autre partenaire « introuvable » (404)
        const partnerId = await this.assertOwnHall(hallId, partnerUserId);

        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (input.name !== undefined) {
            const name = cleanText(input.name, 120, 'Le nom de la salle');
            if (!name) throw new PublicError('Le nom de la salle est obligatoire.');
            updateData.name = name;
        }
        if (input.description !== undefined) updateData.description = cleanText(input.description, 4000, 'La description');
        if (input.capacity !== undefined) updateData.capacity = cleanCapacity(input.capacity);
        // Lot 10a : prix, acompte, règle d'annulation et position contrôlés ; une réservation déjà faite garde ses
        // montants et sa règle (figés à sa création)
        Object.assign(updateData, hallRules(input, false));
        if (input.address !== undefined) updateData.address = cleanText(input.address, 200, 'L’adresse');
        if (input.city !== undefined) updateData.city = cleanText(input.city, 80, 'La ville');
        if (input.amenities !== undefined) updateData.amenities = cleanAmenities(input.amenities);
        if (input.images !== undefined) {
            // Correctifs de la contre-vérification de la finition 2a (T6) : jamais une image du dossier des affiches ;
            // lot 10b : photos déposées dans le dossier de la partenaire, ou déjà sur la salle
            const { data: current, error: curErr } = await supabase.from('halls').select('images').eq('id', hallId).eq('partner_id', partnerId).single();
            if (curErr) throw new Error(`photos de la salle ${hallId} illisibles : ${curErr.message}`);
            updateData.images = hallPhotos(input.images, partnerId, Array.isArray(current?.images) ? current.images as string[] : []);
        }
        if (input.is_active !== undefined) {
            if (typeof input.is_active !== 'boolean') throw new PublicError('Choisissez si la salle est proposée ou non.', 'INVALID_FIELD', 400);
            updateData.is_active = input.is_active;
        }

        const { data: updated, error } = await supabase
            .from('halls')
            .update(updateData)
            .eq('id', hallId)
            .eq('partner_id', partnerId)
            .select(OWN_HALL_COLUMNS)
            .single();

        if (error || !updated) {
            throw new Error(`Échec modification salle: ${error?.message}`);
        }

        return updated as unknown as Record<string, any>;
    }

    /**
     * Suppression / Désactivation d'une salle
     */
    public static async deleteHall(hallId: string, partnerUserId: string) {
        const supabase = getServiceRoleClient();
        // Correctifs de la contre-vérification du lot 10a (T1) : propriétaire vérifiée AVANT de lire les réservations
        // (une autre partenaire apprenait si la salle avait des réservations en cours, puis recevait « supprimée » sans
        // que rien ne le soit) ; salle d'une autre partenaire « introuvable » (404). Panne de lecture : erreur et 500.
        const partnerId = await this.assertOwnHall(hallId, partnerUserId);

        // Vérification des réservations actives
        const { data: activeRes, error: activeErr } = await supabase
            .from('hall_reservations')
            .select('id')
            .eq('hall_id', hallId)
            .in('status', ['EN_ATTENTE', 'CONFIRMEE']);
        if (activeErr) throw new Error(`réservations de la salle ${hallId} illisibles : ${activeErr.message}`);

        if (activeRes && activeRes.length > 0) {
            throw new PublicError('Cette salle a des réservations en cours : elle ne peut pas être supprimée. Retirez-la de la vente à la place.', 'HALL_HAS_RESERVATIONS', 409);
        }
        // Lot 10b : une salle déjà réservée garde son historique (paiements, remboursements) : on la retire de la vente
        const { count: pastCount, error: pastErr } = await supabase
            .from('hall_reservations')
            .select('id', { count: 'exact', head: true })
            .eq('hall_id', hallId);
        if (pastErr) throw new Error(`réservations de la salle ${hallId} illisibles : ${pastErr.message}`);
        if ((pastCount ?? 0) > 0) {
            throw new PublicError('Cette salle a déjà été réservée : elle ne peut pas être supprimée. Retirez-la de la vente à la place.', 'HALL_HAS_HISTORY', 409);
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
     * Lot 10b (point 3) : renvoi en validation d'une salle refusée par sa propriétaire (hall_submit : compte actif,
     * partenaire VALIDE, salle refusée et complète). Salle d'une autre partenaire : 404, comme la lecture.
     */
    public static async submitHall(hallId: string, partnerUserId: string): Promise<{ status: number; body: Record<string, unknown> }> {
        await this.assertOwnHall(hallId, partnerUserId);
        const { data, error } = await getServiceRoleClient().rpc('hall_submit', { p: { actor_id: partnerUserId, hall_id: hallId } });
        if (error) throw new Error(`hall_submit : ${error.message}`);
        const r = (data ?? {}) as Record<string, unknown>;
        if (r.ok !== true) {
            const code = String(r.code ?? 'REFUSED');
            const status = code === 'HALL_NOT_FOUND' ? 404 : code === 'ACCOUNT_NOT_ACTIVE' || code === 'PARTNER_NOT_VALIDATED' ? 403 : code === 'HALL_INCOMPLETE' ? 400 : 409;
            return { status, body: { success: false, error: r.message ?? 'Envoi impossible.', code } };
        }
        return { status: 200, body: { success: true, hall: { id: hallId, status: r.validation_status } } };
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
