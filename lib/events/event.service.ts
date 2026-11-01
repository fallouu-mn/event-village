import { getServiceRoleClient } from '../supabase/server';
import { FinancialCalculatorService } from '../payments/financial-calculator.service';
import { NotificationService } from '../notifications/notification.service';
import { mTargetService } from '../sms/mtarget.service';
import { EmailService } from '../email/email.service';
import { EventLifecycleService } from './event-lifecycle.service';
import { randomUUID } from 'crypto';
import { pgEscapeLike } from '@/lib/security/postgrest-filter';

export type EventStatus = 'BROUILLON' | 'EN_ATTENTE' | 'VALIDE' | 'PUBLIE' | 'SUSPENDU' | 'TERMINE' | 'ANNULE';

export interface ProgramItem {
    id: string;
    time: string;
    title: string;
    artistOrSpeaker?: string;
    description?: string;
}

export interface PracticalInfo {
    address?: string;
    accessNotes?: string;
    parking?: string;
    contactPhone?: string;
    rules?: string;
}

export interface EventServicesConfig {
    ticketing: boolean;
    tableBooking: boolean;
    communication: boolean;
    promotion?: boolean;
}

export interface TicketCategoryInput {
    name: string;
    description?: string;
    price: number;
    total_quantity: number;
    sale_start?: string | null;
    sale_end?: string | null;
    max_per_order?: number;
    is_visible?: boolean;
}

export interface CreateEventInput {
    title: string;
    category?: string | null;
    description?: string;
    start_date: string;
    start_time: string;
    end_date?: string | null;
    end_time?: string | null;
    location: string;
    city?: string;
    latitude?: number | null;
    longitude?: number | null;
    image_url?: string;
    gallery_urls?: string[];
    capacity?: number | null;
    program?: ProgramItem[];
    practical_info?: PracticalInfo;
    services?: EventServicesConfig;
    ticket_categories?: TicketCategoryInput[];
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
    status?: EventStatus;
}

export class EventService {
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
            throw new Error('Profil partenaire introuvable pour cet utilisateur.');
        }

        return partner.id;
    }

    /**
     * Création d'un événement par le partenaire (Statut initial : BROUILLON)
     * §30 CDC : partner_id est strictement dérivé de la session
     */
    public static async createEvent(partnerUserId: string, input: CreateEventInput) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        // Validation des champs obligatoires (§30)
        if (!input.title || !input.title.trim()) {
            throw new Error('Le titre de l\'événement est obligatoire.');
        }
        if (!input.start_date || !input.start_time) {
            throw new Error('La date et l\'heure de début sont obligatoires.');
        }
        if (!input.location || !input.location.trim()) {
            throw new Error('Le lieu de l\'événement est obligatoire.');
        }

        // Validation croisée jauge serveur : somme quotas <= capacité (§35)
        if (input.ticket_categories && input.ticket_categories.length > 0 && input.capacity && input.capacity > 0) {
            const totalQuota = input.ticket_categories.reduce((sum, cat) => sum + Number(cat.total_quantity), 0);
            if (totalQuota > input.capacity) {
                throw new Error(`La somme des quotas de billets (${totalQuota}) dépasse la capacité maximale (${input.capacity}).`);
            }
        }

        const slug = `${input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-6)}`;

        // 1. Insertion de l'événement
        const { data: event, error: eventErr } = await supabase
            .from('events')
            .insert({
                partner_id: partnerId,
                title: input.title.trim(),
                slug,
                category: input.category || null,
                description: input.description || null,
                start_date: input.start_date,
                start_time: input.start_time,
                end_date: input.end_date || null,
                end_time: input.end_time || null,
                location: input.location.trim(),
                city: input.city || 'Dakar',
                latitude: input.latitude ?? null,
                longitude: input.longitude ?? null,
                image_url: input.image_url || null,
                gallery_urls: input.gallery_urls || [],
                capacity: input.capacity && input.capacity > 0 ? input.capacity : null,
                program: input.program || [],
                practical_info: input.practical_info || {},
                services: input.services ? {
                    ticketing: !!input.services.ticketing,
                    tableBooking: !!input.services.tableBooking,
                    communication: !!input.services.communication,
                } : {},
                status: 'BROUILLON', // Statut initial strict (§31)
            })
            .select('*')
            .single();

        if (eventErr || !event) {
            throw new Error(`Échec création événement: ${eventErr?.message}`);
        }

        // 2. Insertion des catégories de billets si fournies (§35)
        if (input.ticket_categories && input.ticket_categories.length > 0) {
            const categoriesToInsert = input.ticket_categories.map(cat => ({
                event_id: event.id,
                name: cat.name.trim(),
                description: cat.description || null,
                price: Number(cat.price),
                total_quantity: Number(cat.total_quantity),
                sold_quantity: 0,
                sale_start: cat.sale_start || null,
                sale_end: cat.sale_end || null,
                max_per_order: cat.max_per_order ?? 10,
                is_visible: cat.is_visible !== false,
                is_active: true,
            }));

            const { error: catErr } = await supabase
                .from('ticket_categories')
                .insert(categoriesToInsert);

            if (catErr) {
                // Rollback the event creation if ticket categories fail to insert
                await supabase.from('events').delete().eq('id', event.id);
                throw new Error(`Échec création catégories billets: ${catErr?.message}`);
            }
        }

        return event;
    }

    /**
     * Récupère la liste des événements d'un partenaire avec filtres et stats
     */
    public static async getPartnerEvents(partnerUserId: string, options?: { status?: string; search?: string }) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        let query = supabase
            .from('events')
            .select('*, ticket_categories(*)')
            .eq('partner_id', partnerId)
            .order('created_at', { ascending: false });

        if (options?.status && options.status !== 'TOUS') {
            query = query.eq('status', options.status);
        }

        if (options?.search && options.search.trim()) {
            query = query.ilike('title', `%${pgEscapeLike(options.search.trim())}%`); // lot 1C.1 : jokers échappés
        }

        const { data, error } = await query;
        if (error) {
            throw new Error(`Erreur récupération événements: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Récupère un événement par son ID avec vérification des droits
     */
    public static async getEventById(eventId: string, partnerUserId?: string) {
        const supabase = getServiceRoleClient();
        let query = supabase
            .from('events')
            .select('*, ticket_categories(*), partners(company_name, phone, user_id)')
            .eq('id', eventId);

        if (partnerUserId) {
            const partnerId = await this.resolvePartnerId(partnerUserId);
            query = query.eq('partner_id', partnerId);
        }

        const { data, error } = await query.single();
        if (error || !data) {
            throw new Error('Événement introuvable ou non autorisé.');
        }

        return data;
    }

    /**
     * Mise à jour d'un événement existant
     */
    public static async updateEvent(eventId: string, partnerUserId: string, input: UpdateEventInput) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        // Vérification que l'événement appartient au partenaire
        const { data: existing, error: findErr } = await supabase
            .from('events')
            .select('*, ticket_categories(*)')
            .eq('id', eventId)
            .eq('partner_id', partnerId)
            .single();

        if (findErr || !existing) {
            throw new Error('Événement introuvable ou non autorisé pour modification.');
        }

        // On ne peut modifier les événements en BROUILLON, EN_ATTENTE, VALIDE, SUSPENDU, et PUBLIE (champs contrôlés)
        // TERMINE et ANNULE ne peuvent plus être modifiés
        if (existing.status === 'TERMINE' || existing.status === 'ANNULE') {
            throw new Error(`Un événement en statut ${existing.status} ne peut plus être modifié.`);
        }

        // Définir les champs autorisés pour les événements PUBLIE
        const allowedFieldsForPublished = new Set([
            'title', 'description', 'location', 'city', 'address', 'accessNotes', 'parking', 'contactPhone',
            'program', 'image_url', 'gallery_urls', 'start_date', 'start_time', 'end_date', 'end_time',
            'capacity', 'services', 'practical_info', 'latitude', 'longitude', 'category'
        ]);

        // Pour les événements PUBLIE, valider que seuls les champs autorisés sont modifiés
        if (existing.status === 'PUBLIE') {
            const updateKeys = Object.keys(input);
            for (const key of updateKeys) {
                if (input[key as keyof UpdateEventInput] === undefined || key === 'status') continue;
                if (!allowedFieldsForPublished.has(key)) {
                    throw new Error(`Le champ '${key}' ne peut pas être modifié pour un événement publié.`);
                }
            }
        }

        // Préparer les données de mise à jour
        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (input.title !== undefined) updateData.title = input.title?.trim() ?? null;
        if (input.description !== undefined) updateData.description = input.description;
        if (input.start_date !== undefined) updateData.start_date = input.start_date;
        if (input.start_time !== undefined) updateData.start_time = input.start_time;
        if (input.end_date !== undefined) updateData.end_date = input.end_date;
        if (input.end_time !== undefined) updateData.end_time = input.end_time;
        if (input.location !== undefined) updateData.location = input.location?.trim() ?? null;
        if (input.city !== undefined) updateData.city = input.city;
        if (input.image_url !== undefined) updateData.image_url = input.image_url;
        if (input.gallery_urls !== undefined) updateData.gallery_urls = input.gallery_urls;
        if (input.capacity !== undefined) updateData.capacity = input.capacity;
        if (input.latitude !== undefined) updateData.latitude = input.latitude;
        if (input.longitude !== undefined) updateData.longitude = input.longitude;
        if (input.category !== undefined) updateData.category = input.category;
        if (input.program !== undefined) updateData.program = input.program;
        if (input.services !== undefined) updateData.services = input.services;

        // Practical info
        if (input.practical_info !== undefined) {
            updateData.practical_info = input.practical_info;
        } else if (
            (input as any).address !== undefined ||
            (input as any).accessNotes !== undefined ||
            (input as any).parking !== undefined ||
            (input as any).contactPhone !== undefined
        ) {
            const practicalInfo = { ...(existing.practical_info || {}) };
            if ((input as any).address !== undefined) practicalInfo.address = (input as any).address;
            if ((input as any).accessNotes !== undefined) practicalInfo.accessNotes = (input as any).accessNotes;
            if ((input as any).parking !== undefined) practicalInfo.parking = (input as any).parking;
            if ((input as any).contactPhone !== undefined) practicalInfo.contactPhone = (input as any).contactPhone;
            updateData.practical_info = practicalInfo;
        }

        // Pour les événements PUBLIE, validation de la capacité
        const soldTotal = (existing.ticket_categories || []).reduce((sum: number, cat: any) => sum + (cat.sold_quantity || 0), 0);
        const sumQuotas = (existing.ticket_categories || []).reduce((sum: number, cat: any) => sum + (cat.total_quantity || 0), 0);

        if (input.capacity !== undefined && input.capacity !== null) {
            const newCapacity = Number(input.capacity);
            if (newCapacity < soldTotal) {
                throw new Error(`La nouvelle capacité (${newCapacity}) ne peut pas être inférieure au nombre de billets déjà vendus (${soldTotal}).`);
            }
            if (newCapacity < sumQuotas) {
                throw new Error(`La nouvelle capacité (${newCapacity}) ne peut pas être inférieure à la somme des quotas de billets (${sumQuotas}).`);
            }
        }

        // Détection des changements critiques (Date/Heure ou Lieu)
        const dateTimeChanged = (input.start_date !== undefined && input.start_date !== existing.start_date) ||
                                (input.start_time !== undefined && input.start_time !== existing.start_time);
        const locationChanged = (input.location !== undefined && input.location?.trim() !== existing.location) ||
                                (input.city !== undefined && input.city !== existing.city);

        // Effectuer la mise à jour
        const { data: updated, error: updateErr } = await supabase
            .from('events')
            .update(updateData)
            .eq('id', eventId)
            .select('*')
            .single();

        if (updateErr || !updated) {
            throw new Error(`Échec de la mise à jour: ${updateErr?.message}`);
        }

        // Journalisation dans audit_logs
        try {
            await supabase.from('audit_logs').insert({
                user_id: partnerUserId,
                action: existing.status === 'PUBLIE' ? 'EVENT_LIVE_UPDATED' : 'EVENT_UPDATED',
                object_type: 'EVENT',
                object_id: eventId,
                metadata: {
                    status: existing.status,
                    updates: updateData,
                    dateTimeChanged,
                    locationChanged,
                },
                created_at: new Date().toISOString(),
            });
        } catch (auditErr) {
            console.error('[EventService.updateEvent] Erreur audit_logs:', auditErr);
        }

        // Si événement PUBLIE avec des billets déjà vendus et changement critique de Date/Lieu : Notifier les acheteurs
        if (existing.status === 'PUBLIE' && soldTotal > 0 && (dateTimeChanged || locationChanged)) {
            try {
                // Récupérer les acheteurs uniques
                const { data: tickets } = await supabase
                    .from('tickets')
                    .select('user_id')
                    .eq('event_id', eventId)
                    .in('status', ['VALIDE', 'UTILISE']);

                if (tickets && tickets.length > 0) {
                    const uniqueUserIds = Array.from(new Set(tickets.map((t: any) => t.user_id).filter(Boolean)));
                    const { data: userProfiles } = await supabase
                        .from('users')
                        .select('id, email, phone, full_name')
                        .in('id', uniqueUserIds);

                    const userMap = new Map<string, any>();
                    (userProfiles || []).forEach((u: any) => userMap.set(u.id, u));

                    const changeReason = dateTimeChanged && locationChanged
                        ? 'La date, l\'heure et le lieu ont été modifiés'
                        : dateTimeChanged
                        ? 'La date ou l\'heure de l\'événement a été modifiée'
                        : 'Le lieu de l\'événement a été modifié';

                    const newInfoText = `Date: ${updated.start_date} à ${updated.start_time} | Lieu: ${updated.location} (${updated.city || 'Dakar'})`;

                    const notificationPromises: Promise<any>[] = [];
                    uniqueUserIds.forEach((userId) => {
                        const clientUser = userMap.get(userId);

                        // In-App
                        notificationPromises.push(
                            NotificationService.createNotification({
                                userId,
                                title: `Mise à jour : ${existing.title}`,
                                message: `${changeReason}. Nouvelles informations : ${newInfoText}`,
                                type: 'SYSTEM',
                                data: { eventId, action: 'event_update' },
                            }).catch((e) => {
                                console.error('[EventService.updateEvent] Erreur in-app notification:', e);
                            })
                        );

                        // SMS
                        if (clientUser?.phone) {
                            notificationPromises.push(
                                mTargetService.sendSms(
                                    clientUser.phone,
                                    `Event Village: Mise a jour importante pour "${existing.title}". ${changeReason}. ${newInfoText}`
                                ).catch(() => {})
                            );
                        }

                        // Email
                        if (clientUser?.email) {
                            notificationPromises.push(
                                EmailService.send({
                                    to: clientUser.email,
                                    subject: `Mise à jour importante : ${existing.title}`,
                                    html: `
                                        <div style="font-family:sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:8px;">
                                            <h2 style="color:#FF5722;">Mise à jour de votre événement</h2>
                                            <p>Bonjour <strong>${clientUser.full_name || 'Cher client'}</strong>,</p>
                                            <p>L'organisateur de l'événement <strong>${existing.title}</strong> a mis à jour certaines informations importantes :</p>
                                            <div style="background:#f8f9fa;padding:15px;border-radius:6px;margin:20px 0;">
                                                <p style="margin:5px 0;"><strong>Motif :</strong> ${changeReason}</p>
                                                <p style="margin:5px 0;"><strong>Nouvelle date :</strong> ${updated.start_date} à ${updated.start_time}</p>
                                                <p style="margin:5px 0;"><strong>Nouveau lieu :</strong> ${updated.location} (${updated.city || 'Dakar'})</p>
                                            </div>
                                            <p>Vos billets restent valides avec leur QR Code d'origine.</p>
                                            <p style="color:#888;font-size:12px;margin-top:30px;">Event Village — Billetterie Officielle</p>
                                        </div>
                                    `,
                                }).catch(() => {})
                            );
                        }
                    });

                    await Promise.allSettled(notificationPromises);
                }
            } catch (notifyErr) {
                console.error('[EventService.updateEvent] Erreur notification acheteurs:', notifyErr);
            }
        }

        return updated;
    }

    /**
     * Mise à jour dynamique du stock et statut d'une catégorie de billets
     * Gère les augmentations (réouverture automatique si Sold Out)
     * et les diminutions (rejet strict si total < sold_quantity)
     */
    public static async updateCategoryStockAndStatus(
        partnerUserId: string,
        eventId: string,
        categoryId: string,
        updates: {
            total_quantity?: number;
            is_active?: boolean;
            is_visible?: boolean;
            price?: number;
            description?: string;
            name?: string;
        }
    ) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        // 1. Vérifier l'événement et son propriétaire
        const { data: event, error: eventErr } = await supabase
            .from('events')
            .select('id, title, status, capacity, partner_id, ticket_categories(*)')
            .eq('id', eventId)
            .eq('partner_id', partnerId)
            .single();

        if (eventErr || !event) {
            throw new Error('Événement introuvable ou non autorisé.');
        }

        if (['ANNULE', 'TERMINE'].includes(event.status)) {
            throw new Error(`Impossible de modifier une catégorie pour un événement en statut ${event.status}.`);
        }

        const existingCategory = (event.ticket_categories || []).find((c: any) => c.id === categoryId);
        if (!existingCategory) {
            throw new Error('Catégorie de billets introuvable pour cet événement.');
        }

        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
        };

        if (updates.name !== undefined) updateData.name = updates.name.trim();
        if (updates.description !== undefined) updateData.description = updates.description;
        if (updates.price !== undefined) {
            const newPrice = Number(updates.price);
            if (newPrice < 0) throw new Error('Le prix doit être positif ou nul.');
            updateData.price = newPrice;
        }
        if (updates.is_visible !== undefined) updateData.is_visible = updates.is_visible;
        if (updates.is_active !== undefined) updateData.is_active = updates.is_active;

        // 2. Gestion du Quota (total_quantity)
        if (updates.total_quantity !== undefined) {
            const newTotal = Number(updates.total_quantity);
            const sold = Number(existingCategory.sold_quantity || 0);

            if (newTotal < 0) {
                throw new Error('Le quota de billets doit être supérieur ou égal à 0.');
            }

            // RÈGLE CRITIQUE DIMINUTION : total ne peut jamais être inférieur au nombre de billets déjà vendus
            if (newTotal < sold) {
                throw new Error(`Impossible de réduire le quota à ${newTotal} : ${sold} billets ont déjà été vendus.`);
            }

            // RÈGLE CRITIQUE CAPACITÉ GLOBALE : somme des quotas <= event.capacity
            if (event.capacity && event.capacity > 0) {
                const otherCategoriesTotal = (event.ticket_categories || [])
                    .filter((c: any) => c.id !== categoryId)
                    .reduce((sum: number, c: any) => sum + Number(c.total_quantity || 0), 0);

                const newSumQuotas = otherCategoriesTotal + newTotal;
                if (newSumQuotas > Number(event.capacity)) {
                    throw new Error(`La somme des quotas de billets (${newSumQuotas}) dépasse la capacité maximale de l'événement (${event.capacity}).`);
                }
            }

            updateData.total_quantity = newTotal;

            // RÈGLE AUGMENTATION : Si augmentation et le nouveau total > sold, réactiver automatiquement la vente
            if (newTotal > sold && updates.is_active === undefined) {
                updateData.is_active = true;
            }
        }

        // 3. Exécution de la mise à jour
        const { data: updatedCat, error: updateErr } = await supabase
            .from('ticket_categories')
            .update(updateData)
            .eq('id', categoryId)
            .eq('event_id', eventId)
            .select('*')
            .single();

        if (updateErr || !updatedCat) {
            throw new Error(`Échec de la mise à jour de la catégorie: ${updateErr?.message}`);
        }

        // 4. Audit Trail
        try {
            await supabase.from('audit_logs').insert({
                user_id: partnerUserId,
                action: 'CATEGORY_STOCK_UPDATED',
                object_type: 'TICKET_CATEGORY',
                object_id: categoryId,
                metadata: {
                    event_id: eventId,
                    old_total: existingCategory.total_quantity,
                    new_total: updateData.total_quantity ?? existingCategory.total_quantity,
                    sold_quantity: existingCategory.sold_quantity,
                    is_active: updateData.is_active ?? existingCategory.is_active,
                    price: updateData.price ?? existingCategory.price,
                },
                created_at: new Date().toISOString(),
            });
        } catch (auditErr) {
            console.error('[EventService.updateCategoryStockAndStatus] Erreur audit_logs:', auditErr);
        }

        return {
            ...updatedCat,
            available_quantity: Math.max(0, Number(updatedCat.total_quantity) - Number(updatedCat.sold_quantity || 0)),
        };
    }

    /**
     * Ajout d'une nouvelle catégorie de billets sur un événement existant
     */
    public static async addTicketCategory(
        partnerUserId: string,
        eventId: string,
        categoryInput: TicketCategoryInput
    ) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { data: event, error: eventErr } = await supabase
            .from('events')
            .select('id, status, capacity, partner_id, ticket_categories(*)')
            .eq('id', eventId)
            .eq('partner_id', partnerId)
            .single();

        if (eventErr || !event) {
            throw new Error('Événement introuvable ou non autorisé.');
        }

        if (['ANNULE', 'TERMINE'].includes(event.status)) {
            throw new Error(`Impossible d'ajouter une catégorie pour un événement en statut ${event.status}.`);
        }

        const newQuota = Number(categoryInput.total_quantity);
        if (newQuota <= 0) {
            throw new Error('Le quota de billets doit être supérieur à 0.');
        }

        if (event.capacity && event.capacity > 0) {
            const currentTotalQuotas = (event.ticket_categories || []).reduce(
                (sum: number, c: any) => sum + Number(c.total_quantity || 0),
                0
            );
            if (currentTotalQuotas + newQuota > Number(event.capacity)) {
                throw new Error(`La somme des quotas de billets (${currentTotalQuotas + newQuota}) dépasse la capacité maximale de l'événement (${event.capacity}).`);
            }
        }

        const { data: newCat, error: insertErr } = await supabase
            .from('ticket_categories')
            .insert({
                event_id: eventId,
                name: categoryInput.name.trim(),
                description: categoryInput.description || null,
                price: Number(categoryInput.price),
                total_quantity: newQuota,
                sold_quantity: 0,
                sale_start: categoryInput.sale_start || null,
                sale_end: categoryInput.sale_end || null,
                max_per_order: categoryInput.max_per_order ?? 10,
                is_visible: categoryInput.is_visible !== false,
                is_active: true,
            })
            .select('*')
            .single();

        if (insertErr || !newCat) {
            throw new Error(`Échec de la création de la catégorie: ${insertErr?.message}`);
        }

        try {
            await supabase.from('audit_logs').insert({
                user_id: partnerUserId,
                action: 'CATEGORY_CREATED',
                object_type: 'TICKET_CATEGORY',
                object_id: newCat.id,
                metadata: { event_id: eventId, name: newCat.name, total_quantity: newQuota, price: newCat.price },
                created_at: new Date().toISOString(),
            });
        } catch (err) {
            console.error('[EventService.addTicketCategory] Erreur audit_logs:', err);
        }

        return newCat;
    }

    /**
     * Suppression d'un événement (autorisé uniquement si statut BROUILLON)
     */
    public static async deleteEvent(eventId: string, partnerUserId: string) {
        const supabase = getServiceRoleClient();
        const partnerId = await this.resolvePartnerId(partnerUserId);

        const { data: existing, error: findErr } = await supabase
            .from('events')
            .select('id, status')
            .eq('id', eventId)
            .eq('partner_id', partnerId)
            .single();

        if (findErr || !existing) {
            throw new Error('Événement introuvable.');
        }

        if (existing.status !== 'BROUILLON') {
            throw new Error('Seuls les événements en statut BROUILLON peuvent être supprimés.');
        }

        const { error: catDelErr } = await supabase.from('ticket_categories').delete().eq('event_id', eventId);
        const { error: delErr } = await supabase.from('events').delete().eq('id', eventId);

        if (delErr) {
            // If event deletion fails but ticket categories deletion succeeded, we need to rollback
            // by re-creating a minimal event record to maintain referential integrity
            // Note: This is a simplified rollback - in a real system you might want to restore the full event
            if (!catDelErr) {
                console.error('[EventService.deleteEvent] Event deletion failed after ticket categories deletion. Manual cleanup may be required.');
            }
            throw new Error(`Échec de la suppression: ${delErr.message}`);
        }

        return { success: true };
    }

    /**
     * Lot 5 (5.2) : changement de statut par la RPC event_transition (table event_status_transitions en
     * base, motifs obligatoires, historique, garde du statut). Le rôle de l'acteur est dérivé en base
     * (user_roles, propriété du partenaire) : le paramètre userRole n'est plus lu. Un refus lève
     * EventLifecycleError (statut HTTP, code, message en français).
     */
    public static async changeEventStatus(
        eventId: string,
        userId: string,
        newStatus: EventStatus,
        _userRole: string = 'PARTENAIRE',
        reason?: string
    ) {
        void _userRole;
        await EventLifecycleService.transition({ eventId, actorId: userId, to: newStatus, reason: reason ?? null });
        const { data: updatedEvent, error } = await getServiceRoleClient().from('events').select('*').eq('id', eventId).single();
        if (error || !updatedEvent) {
            throw new Error(`Relecture de l'événement après le changement de statut impossible : ${error?.message ?? 'absent'}`);
        }
        return updatedEvent;
    }

}

