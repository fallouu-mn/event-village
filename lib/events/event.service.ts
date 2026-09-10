import { getServiceRoleClient } from '../supabase/server';
import { FinancialCalculatorService } from '../payments/financial-calculator.service';
import { NotificationService } from '../notifications/notification.service';
import { mTargetService } from '../sms/mtarget.service';
import { EmailService, EmailTemplates } from '../email/email.service';
import { randomUUID } from 'crypto';

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
            query = query.ilike('title', `%${options.search.trim()}%`);
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
     * Machine à états finis du Cycle de Publication (§31 CDC V3.0)
     * BROUILLON → EN_ATTENTE → VALIDÉ → PUBLIÉ → SUSPENDU → TERMINÉ
     *
     * Règles de transition strictes :
     * - PARTENAIRE : peut faire BROUILLON → EN_ATTENTE, et PUBLIE → TERMINE.
     * - ADMIN / SUPERADMIN : peut faire EN_ATTENTE → VALIDE, VALIDE → PUBLIE, PUBLIE → SUSPENDU, SUSPENDU → PUBLIE, * → TERMINE.
     * - Auto-approbation PARTENAIRE (EN_ATTENTE → VALIDE) : STRICTEMENT INTERDITE.
     */
    public static async changeEventStatus(
        eventId: string,
        userId: string,
        newStatus: EventStatus,
        userRole: string = 'PARTENAIRE',
        rejectionReason?: string
    ) {
        const supabase = getServiceRoleClient();

        const { data: event, error: findErr } = await supabase
            .from('events')
            .select('*, partners(user_id, company_name)')
            .eq('id', eventId)
            .single();

        if (findErr || !event) {
            throw new Error('Événement introuvable.');
        }

        const currentStatus: EventStatus = event.status;
        const isAdmin = userRole === 'SUPERADMIN' || userRole === 'ADMIN';
        const isOwner = event.partners?.user_id === userId;

        if (!isAdmin && !isOwner) {
            throw new Error('Accès non autorisé : Vous n\'êtes pas propriétaire de cet événement.');
        }

        // Matrice de transition d'état conformément au CDC V3.0 §31
        if (newStatus === currentStatus) {
            return event;
        }

        if (currentStatus === 'BROUILLON') {
            // PARTENAIRE : BROUILLON → EN_ATTENTE
            // ADMIN/SUPERADMIN : BROUILLON → EN_ATTENTE (seul chemin autorisé depuis BROUILLON, sauf TERMINE via * → TERMINE)
            if (newStatus === 'EN_ATTENTE') {
                // Autorisé pour partenaire et admin
            } else if (newStatus === 'TERMINE' && isAdmin) {
                // Autorisé uniquement pour admin (* → TERMINE)
            } else {
                throw new Error('Un événement en BROUILLON ne peut être soumis qu\'à validation (EN_ATTENTE) ou terminé par un administrateur.');
            }
        } else if (currentStatus === 'EN_ATTENTE') {
            // ADMIN/SUPERADMIN : EN_ATTENTE → VALIDE
            // PARTENAIRE : EN_ATTENTE → BROUILLON (retrait)
            if (newStatus === 'VALIDE' && isAdmin) {
                // Autorisé uniquement pour admin
            } else if (newStatus === 'BROUILLON') {
                // Rejet par l'admin ou retrait par le partenaire
            } else if (newStatus === 'TERMINE' && isAdmin) {
                // Autorisé uniquement pour admin (* → TERMINE)
            } else {
                throw new Error('Seul un administrateur peut valider un événement en attente ou le terminer.');
            }
        } else if (currentStatus === 'VALIDE') {
            // ADMIN/SUPERADMIN : VALIDE → PUBLIE, VALIDE → SUSPENDU
            // PARTENAIRE : VALIDE → PUBLIE
            if (newStatus === 'PUBLIE') {
                // Autorisé pour partenaire et admin
            } else if (newStatus === 'SUSPENDU' && isAdmin) {
                // Autorisé uniquement pour admin
            } else if (newStatus === 'TERMINE' && isAdmin) {
                // Autorisé uniquement pour admin (* → TERMINE)
            } else {
                throw new Error(`Transition invalide de ${currentStatus} vers ${newStatus}.`);
            }
        } else if (currentStatus === 'PUBLIE') {
            // ADMIN/SUPERADMIN : PUBLIE → SUSPENDU, PUBLIE → TERMINE
            // PARTENAIRE : PUBLIE → TERMINE
            if (newStatus === 'SUSPENDU' && isAdmin) {
                // Autorisé uniquement pour admin
            } else if (newStatus === 'TERMINE') {
                // Autorisé pour partenaire et admin
            } else {
                throw new Error(`Transition invalide de ${currentStatus} vers ${newStatus}.`);
            }
        } else if (currentStatus === 'SUSPENDU') {
            // ADMIN/SUPERADMIN : SUSPENDU → PUBLIE, SUSPENDU → TERMINE
            if (newStatus === 'PUBLIE' && isAdmin) {
                // Autorisé uniquement pour admin
            } else if (newStatus === 'TERMINE') {
                // Autorisé pour partenaire et admin
            } else {
                throw new Error(`Transition invalide de ${currentStatus} vers ${newStatus}.`);
            }
        } else if (currentStatus === 'TERMINE') {
            throw new Error('Un événement terminé ne peut plus changer de statut.');
        }

        // Mise à jour en base
        const { data: updatedEvent, error: updateErr } = await supabase
            .from('events')
            .update({
                status: newStatus,
                updated_at: new Date().toISOString(),
            })
            .eq('id', eventId)
            .select('*')
            .single();

        if (updateErr || !updatedEvent) {
            throw new Error(`Échec du changement de statut: ${updateErr?.message}`);
        }

        // ── Triple Notification Partenaire (In-App + SMS + Email) ──────────
        if (event.partners?.user_id) {
            const { data: partnerUser } = await supabase
                .from('users')
                .select('id, email, phone, first_name, last_name')
                .eq('id', event.partners.user_id)
                .single();

            const partnerName = partnerUser
                ? `${partnerUser.first_name || ''} ${partnerUser.last_name || ''}`.trim() || 'Partenaire'
                : 'Partenaire';

            if (newStatus === 'VALIDE') {
                await NotificationService.createNotification({
                    userId: event.partners.user_id,
                    title: 'Événement validé !',
                    message: `Votre événement "${event.title}" a été validé. Vous pouvez le publier.`,
                    type: 'SYSTEM',
                    data: { eventId, status: newStatus, actionUrl: '/partner/events' },
                });
                if (partnerUser?.phone) {
                    mTargetService.sendSms(
                        partnerUser.phone,
                        `Event Village : Votre événement "${event.title}" est validé ! Connectez-vous pour ouvrir la billetterie.`
                    ).catch(err => console.error('[EventService] SMS partenaire (VALIDE) échoué:', err instanceof Error ? err.message : err));
                }
                if (partnerUser?.email) {
                    EmailService.send({
                        to: partnerUser.email,
                        ...EmailTemplates.eventValidated({ partnerName, eventTitle: event.title }),
                    }).catch(err => console.error('[EventService] Email partenaire (VALIDE) échoué:', err instanceof Error ? err.message : err));
                }
            } else if (newStatus === 'BROUILLON' && currentStatus === 'EN_ATTENTE' && isAdmin) {
                const reasonText = rejectionReason || 'Non spécifié';
                await NotificationService.createNotification({
                    userId: event.partners.user_id,
                    title: 'Événement non validé',
                    message: `Votre événement "${event.title}" n'a pas été validé. Motif : ${reasonText}`,
                    type: 'SYSTEM',
                    data: { eventId, status: newStatus, reason: reasonText, actionUrl: '/partner/events' },
                });
                if (partnerUser?.phone) {
                    mTargetService.sendSms(
                        partnerUser.phone,
                        `Event Village : Votre événement "${event.title}" n'a pas été validé. Motif : ${reasonText}. Modifiez-le et resoumettez.`
                    ).catch(err => console.error('[EventService] SMS partenaire (REJET) échoué:', err instanceof Error ? err.message : err));
                }
                if (partnerUser?.email) {
                    EmailService.send({
                        to: partnerUser.email,
                        ...EmailTemplates.eventRejected({ partnerName, eventTitle: event.title, reason: reasonText }),
                    }).catch(err => console.error('[EventService] Email partenaire (REJET) échoué:', err instanceof Error ? err.message : err));
                }
            } else if (newStatus === 'SUSPENDU') {
                const reasonText = rejectionReason || 'Vérification requise';
                await NotificationService.createNotification({
                    userId: event.partners.user_id,
                    title: 'Événement suspendu',
                    message: `Votre événement "${event.title}" a été suspendu. Motif : ${reasonText}.`,
                    type: 'SYSTEM',
                    data: { eventId, status: newStatus, reason: reasonText },
                });
                if (partnerUser?.phone) {
                    mTargetService.sendSms(
                        partnerUser.phone,
                        `Event Village : Votre événement "${event.title}" a été suspendu. Motif : ${reasonText}. Contactez le support.`
                    ).catch(err => console.error('[EventService] SMS partenaire (SUSPENDU) échoué:', err instanceof Error ? err.message : err));
                }
                if (partnerUser?.email) {
                    EmailService.send({
                        to: partnerUser.email,
                        ...EmailTemplates.eventSuspended({ partnerName, eventTitle: event.title, reason: reasonText }),
                    }).catch(err => console.error('[EventService] Email partenaire (SUSPENDU) échoué:', err instanceof Error ? err.message : err));
                }
            } else if (newStatus === 'PUBLIE') {
                await NotificationService.createNotification({
                    userId: event.partners.user_id,
                    title: 'Événement en ligne !',
                    message: `Votre événement "${event.title}" est désormais visible sur la billetterie publique Event Village.`,
                    type: 'SYSTEM',
                    data: { eventId, status: newStatus },
                });
            }
        }

        // ── Notification SuperAdmins lors de la soumission (BROUILLON → EN_ATTENTE)
        if (newStatus === 'EN_ATTENTE' && currentStatus === 'BROUILLON') {
            const companyName = event.partners?.company_name || 'Partenaire';
            try {
                const notifResult = await NotificationService.notifySuperadmins({
                    title: 'Nouvel Événement Soumis',
                    content: `Le partenaire "${companyName}" a soumis l'événement "${event.title}" pour validation.`,
                    type: 'SYSTEM',
                    metadata: { eventId, eventTitle: event.title, actionUrl: '/admin/services' },
                    smsMessage: `EV ADMIN: Nouvel événement "${event.title}" de "${companyName}" en attente de validation.`,
                    emailTemplate: EmailTemplates.superadminEventSubmitted({
                        partnerName: companyName,
                        companyName,
                        eventTitle: event.title,
                    }),
                });
                console.log('[EventService.changeEventStatus] Notification SuperAdmins résultat:', JSON.stringify(notifResult));
            } catch (notifErr) {
                console.error('[EventService.changeEventStatus] ERREUR notification SuperAdmins (status update OK, notification KO):', notifErr instanceof Error ? notifErr.message : notifErr);
            }
        }

        return updatedEvent;
    }

    /**
     * Achat Atomique de Billet avec Protection Anti-Survente (§35 CDC V3.0)
     *
     * Mécanisme :
     * Utilise un UPDATE conditionnel atomique au niveau PostgreSQL :
     * UPDATE ticket_categories
     * SET sold_quantity = sold_quantity + 1
     * WHERE id = categoryId AND is_active = TRUE AND sold_quantity < total_quantity
     * RETURNING *
     *
     * Si 2 requêtes concurrentes s'exécutent simultanément sur 1 billet restant :
     * - PostgreSQL verrouille la ligne sur le premier UPDATE.
     * - Le premier UPDATE réussit (sold_quantity 0 -> 1) et renvoie la ligne.
     * - Le second UPDATE attend le verrou, puis réévalue la condition 'sold_quantity < total_quantity' (1 < 1 = FALSE).
     * - Le second UPDATE retourne 0 ligne affectée et rejette immédiatement avec l'erreur "Épuisé".
     * - La contrainte CHECK (sold_quantity <= total_quantity) en base garantit l'impossibilité de dépasser le quota.
     */
    /**
     * Réservation & Achat Atomique de Billets avec Protection Anti-Survente (§35 CDC V3.0)
     * Supporte 1 ou plusieurs billets (N >= 1) en UNE SEULE TRANSACTION ATOMIQUE.
     *
     * Mécanisme :
     * UPDATE ticket_categories
     * SET sold_quantity = sold_quantity + quantity
     * WHERE id = categoryId AND is_active = TRUE AND sold_quantity + quantity <= total_quantity
     * RETURNING *
     *
     * En cas de forte concurrence (ex: stock restant = 3, Client A demande 2, Client B demande 2) :
     * - PostgreSQL garantit l'atomicité sur le bloc de N billets.
     * - Une seule transaction réussit à réserver ses 2 billets.
     * - L'autre transaction est rejetée immédiatement avec 0 billet partiel créé.
     * - Si le stock restant atteint exactement 0 (sold_quantity === total_quantity),
     *   déclenche automatiquement la notification d'épuisement (SOLD_OUT) à l'organisateur.
     */
    public static async reserveTicketsAtomic(params: {
        eventId: string;
        categoryId: string;
        quantity?: number;
        userId: string;
        orderId?: string;
        aggregatorFeeRate?: number;
        serviceFeeRate?: number;
        paymentConfirmed?: boolean;
        callerRole?: string;
        callerUserId?: string;
    }) {
        const supabase = getServiceRoleClient();
        let requestedQty = 1;
        if (params.quantity !== undefined) {
            const parsed = Number(params.quantity);
            if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 50) {
                throw new Error(`Quantité invalide (${params.quantity}). Vous pouvez réserver entre 1 et 50 billets.`);
            }
            requestedQty = parsed;
        }
        const nowIso = new Date().toISOString();

        // 1. Récupération et vérification de la catégorie et de l'événement
        const { data: category, error: catFetchErr } = await supabase
            .from('ticket_categories')
            .select('*, events(id, title, status, partner_id)')
            .eq('id', params.categoryId)
            .eq('event_id', params.eventId)
            .single();

        if (catFetchErr || !category) {
            throw new Error('Catégorie de billet introuvable pour cet événement.');
        }

        if (!category.is_active) {
            throw new Error('Cette catégorie de billet n\'est plus disponible à la vente (fermée par l\'organisateur).');
        }

        if (category.events?.status !== 'PUBLIE') {
            throw new Error('La billetterie n\'est ouverte que pour les événements au statut PUBLIE.');
        }

        if (category.sale_start && new Date(category.sale_start) > new Date()) {
            throw new Error('La vente pour cette catégorie de billet n\'a pas encore débuté.');
        }

        if (category.sale_end && new Date(category.sale_end) < new Date()) {
            throw new Error('La vente pour cette catégorie de billet est clôturée.');
        }

        const price = Number(category.price);
        const isFree = price === 0;
        const maxPerOrder = Number(category.max_per_order ?? 10);
        const effectiveCallerId = params.callerUserId || params.userId;
        let role = params.callerRole;
        let isPartnerOwner = false;
        let isAuthorizedStaff = false;

        // Validate quantity against max_per_order (anti-fraude)
        if (requestedQty <= 0) {
            throw new Error(`Quantité invalide (${requestedQty}). La quantité doit être supérieure à zéro.`);
        }
        if (requestedQty > maxPerOrder) {
            throw new Error(`Quantité dépassant la limite autorisée par commande (${maxPerOrder} billets maximum pour la catégorie "${category.name}").`);
        }

        if (!isFree && !params.paymentConfirmed) {
            if (!role) {
                const { data: userRecord } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', effectiveCallerId)
                    .single();
                role = userRecord?.role || 'CLIENT';
            }

            if (category.events?.partner_id) {
                const { data: partnerRecord } = await supabase
                    .from('partners')
                    .select('user_id')
                    .eq('id', category.events.partner_id)
                    .single();
                isPartnerOwner = partnerRecord?.user_id === effectiveCallerId || (role === 'PARTENAIRE' && partnerRecord?.user_id === effectiveCallerId);
            }

            isAuthorizedStaff =
                role === 'SUPERADMIN' ||
                role === 'ADMIN' ||
                role === 'CONTROLEUR';

            const isAuthorizedStaffOrOwner = isAuthorizedStaff || isPartnerOwner;

            if (!isAuthorizedStaffOrOwner) {
                throw new Error('Paiement requis : Les billets payants doivent obligatoirement être achetés via le parcours de paiement sécurisé (/api/payments/create).');
            }
        }

        // 2. UPDATE atomique conditionnel du bloc entier (Compare-and-Swap strict avec retry loop sous forte concurrence)
        let lockedCategory: any = null;
        let attempts = 0;
        const maxAttempts = 10;
        let currentSold = Number(category.sold_quantity || 0);
        let totalQty = Number(category.total_quantity || 0);
        
        let hasHeldCol = false;
        let currentHeld = 0;
        try {
            const { data: checkHeld, error: heldErr } = await supabase
                .from('ticket_categories')
                .select('held_quantity')
                .eq('id', params.categoryId)
                .maybeSingle();
            if (!heldErr && checkHeld && typeof (checkHeld as any).held_quantity === 'number') {
                hasHeldCol = true;
                currentHeld = Number((checkHeld as any).held_quantity);
            }
        } catch {
            hasHeldCol = false;
        }

        while (attempts < maxAttempts) {
            attempts++;
            const availableQty = Math.max(0, totalQty - currentSold);
            if (availableQty <= 0) {
                throw new Error(`Épuisé : Aucun billet restant disponible pour la catégorie "${category.name}".`);
            }
            if (requestedQty > availableQty) {
                throw new Error(`Stock insuffisant : Il ne reste que ${availableQty} place(s) disponible(s) pour la catégorie "${category.name}".`);
            }

            const nextSold = currentSold + requestedQty;
            const nextHeld = params.paymentConfirmed ? Math.max(0, currentHeld - requestedQty) : currentHeld;

            const updatePayload: any = {
                sold_quantity: nextSold,
                updated_at: nowIso,
            };
            if (hasHeldCol) {
                updatePayload.held_quantity = nextHeld;
            }

            let casQuery = supabase
                .from('ticket_categories')
                .update(updatePayload)
                .eq('id', params.categoryId)
                .eq('sold_quantity', currentSold) // Compare-and-swap
                .eq('is_active', true);

            if (hasHeldCol) {
                casQuery = casQuery.eq('held_quantity', currentHeld);
            }

            const { data: updatedCat, error: lockErr } = await casQuery
                .select('*')
                .maybeSingle();

            if (!lockErr && updatedCat) {
                lockedCategory = updatedCat;
                break;
            }

            // Conflit CAS concurrent : délai exponentiel/aléatoire puis relecture pour ré-essayer
            await new Promise(r => setTimeout(r, 15 + Math.random() * 25));
            const { data: refreshedCat } = await supabase
                .from('ticket_categories')
                .select('sold_quantity, total_quantity, is_active')
                .eq('id', params.categoryId)
                .single();

            if (!refreshedCat || !refreshedCat.is_active) {
                throw new Error(`Les ventes pour cette catégorie de billet sont clôturées.`);
            }

            currentSold = Number(refreshedCat.sold_quantity || 0);
            totalQty = Number(refreshedCat.total_quantity || 0);

            if (hasHeldCol) {
                const { data: refHeld } = await supabase
                    .from('ticket_categories')
                    .select('held_quantity')
                    .eq('id', params.categoryId)
                    .maybeSingle();
                if (refHeld) currentHeld = Number((refHeld as any).held_quantity || 0);
            }
        }

        if (!lockedCategory) {
            throw new Error(`Stock insuffisant : Conflit de réservation concurrente sur "${category.name}".`);
        }

        // 4. Calcul financier conforme Annexe C (§37 CDC V3.0)
        const ticketPrice = Number(lockedCategory.price);
        const financials = FinancialCalculatorService.calculateTicketingFinancials({
            ticketFacialPrice: ticketPrice * requestedQty,
            serviceFeeRatePercent: params.serviceFeeRate ?? 5.0,
            aggregatorFeeRatePercent: params.aggregatorFeeRate ?? 1.5,
        });

        // 5. Génération atomique des N tickets uniques
        const ticketsToInsert = [];
        for (let i = 0; i < requestedQty; i++) {
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const randomHex = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
            const ticketNumber = `TCK-${dateStr}-${randomHex}`;
            const qrCode = `EV-QR-${randomUUID().replace(/-/g, '')}`;

            ticketsToInsert.push({
                event_id: params.eventId,
                category_id: params.categoryId,
                user_id: params.userId,
                order_id: params.orderId || null,
                ticket_number: ticketNumber,
                price: ticketPrice,
                qr_code: qrCode,
                status: 'VALIDE',
            });
        }

        const { data: createdTickets, error: ticketErr } = await supabase
            .from('tickets')
            .insert(ticketsToInsert)
            .select('*');

        if (ticketErr || !createdTickets || createdTickets.length !== requestedQty) {
            // Rollback relatif sécurisé : décrémenter strictement la quantité demandée sans écraser les réservations concurrentes
            const { data: catForRollback } = await supabase
                .from('ticket_categories')
                .select('sold_quantity')
                .eq('id', params.categoryId)
                .single();

            if (catForRollback) {
                const latestSold = Number(catForRollback.sold_quantity);
                const rolledBackSold = Math.max(0, latestSold - requestedQty);
                const rollbackPayload: any = {
                    sold_quantity: rolledBackSold,
                    updated_at: new Date().toISOString(),
                };
                if (params.paymentConfirmed && hasHeldCol) {
                    const { data: curHeldDb } = await supabase.from('ticket_categories').select('held_quantity').eq('id', params.categoryId).maybeSingle();
                    if (curHeldDb) {
                        rollbackPayload.held_quantity = Number((curHeldDb as any).held_quantity || 0) + requestedQty;
                    }
                }
                await supabase
                    .from('ticket_categories')
                    .update(rollbackPayload)
                    .eq('id', params.categoryId)
                    .eq('sold_quantity', latestSold); // CAS guard
            }

            throw new Error(`Échec de la génération des billets: ${ticketErr?.message}`);
        }

        // 6. Traçabilité financière hors webhook (guichet / invitation)
        if (!params.paymentConfirmed && ticketPrice > 0) {
            for (const createdTicket of createdTickets) {
                if (isAuthorizedStaff) {
                    const cashTxId = `TX-CASH-${Date.now()}-${randomUUID().substring(0, 8)}`;
                    await supabase.from('payments').insert({
                        transaction_id: cashTxId,
                        client_id: params.userId,
                        partner_id: category.events?.partner_id || null,
                        ticket_id: createdTicket.id,
                        payment_target: 'TICKET',
                        amount: ticketPrice,
                        currency: 'XOF',
                        payment_method: 'CASH',
                        is_platform_payment: false,
                        offline_payment_method: 'ESPECES',
                        aggregator: 'GUICHET_PHYSIQUE',
                        aggregator_fee: 0,
                        service_fee: financials.serviceFeeAmount / requestedQty,
                        gross_event_village_revenue: financials.serviceFeeAmount / requestedQty,
                        net_event_village_revenue: financials.serviceFeeAmount / requestedQty,
                        partner_payout_amount: ticketPrice,
                        status: 'SUCCESS',
                        provider_status: 'GUICHET_CASH',
                        idempotency_key: `IDEMP-CASH-${createdTicket.id}`,
                        metadata: {
                            issued_by_role: role,
                            issued_by_user_id: params.userId,
                            channel: 'GUICHET',
                            event_id: params.eventId,
                            category_id: params.categoryId,
                        },
                        paid_at: nowIso,
                    });
                } else if (isPartnerOwner) {
                    const invTxId = `TX-INV-${Date.now()}-${randomUUID().substring(0, 8)}`;
                    await supabase.from('payments').insert({
                        transaction_id: invTxId,
                        client_id: params.userId,
                        partner_id: category.events?.partner_id || null,
                        ticket_id: createdTicket.id,
                        payment_target: 'TICKET',
                        amount: 0,
                        currency: 'XOF',
                        payment_method: 'INVITATION',
                        is_platform_payment: false,
                        aggregator: 'ORGANISATEUR_INVITATION',
                        aggregator_fee: 0,
                        service_fee: 0,
                        gross_event_village_revenue: 0,
                        net_event_village_revenue: 0,
                        partner_payout_amount: 0,
                        status: 'SUCCESS',
                        provider_status: 'INVITATION_ORGANISATEUR',
                        idempotency_key: `IDEMP-INV-${createdTicket.id}`,
                        metadata: {
                            issued_by_role: 'PARTENAIRE_ORGANISATEUR',
                            is_complimentary: true,
                            event_id: params.eventId,
                            category_id: params.categoryId,
                        },
                        paid_at: nowIso,
                    });
                }
            }
        }

        // 7. Notification SOLD_OUT post-commit sécurisée (strictement après création confirmée des billets en base)
        const finalSold = Number(lockedCategory.sold_quantity);
        const finalTotal = Number(lockedCategory.total_quantity);
        if (finalSold >= finalTotal) {
            try {
                await NotificationService.sendTicketCategorySoldOutNotification({
                    eventId: params.eventId,
                    categoryId: params.categoryId,
                    categoryName: lockedCategory.name,
                    totalQuantity: finalTotal,
                });
            } catch (err) {
                console.error('[EventService.reserveTicketsAtomic] Notification SOLD_OUT post-commit échouée:', err);
            }

            // Vérifier si toutes les catégories de l'événement sont désormais complètes / fermées
            try {
                const { data: allCategories } = await supabase
                    .from('ticket_categories')
                    .select('id, total_quantity, sold_quantity, is_active')
                    .eq('event_id', params.eventId);

                if (allCategories && allCategories.length > 0) {
                    const isFullySoldOut = allCategories.every(
                        (cat: any) => Number(cat.sold_quantity || 0) >= Number(cat.total_quantity || 0) || cat.is_active === false
                    );
                    if (isFullySoldOut) {
                        const totalSoldSum = allCategories.reduce((sum: number, c: any) => sum + Number(c.sold_quantity || 0), 0);
                        await NotificationService.sendEventFullySoldOutNotification({
                            eventId: params.eventId,
                            eventTitle: category.events?.title || lockedCategory.name || 'Événement',
                            totalTicketsSold: totalSoldSum,
                        });
                    }
                }
            } catch (err) {
                console.error('[EventService.reserveTicketsAtomic] Erreur vérification event fully sold out:', err);
            }
        }

        return {
            tickets: createdTickets,
            ticket: createdTickets[0],
            count: createdTickets.length,
            category: lockedCategory,
            financials,
        };
    }

    /**
     * Achat Atomique d'un seul Billet (wrapper 100% rétrocompatible vers reserveTicketsAtomic)
     */
    public static async purchaseTicketAtomic(params: {
        eventId: string;
        categoryId: string;
        userId: string;
        orderId?: string;
        aggregatorFeeRate?: number;
        serviceFeeRate?: number;
        paymentConfirmed?: boolean;
        callerRole?: string;
        callerUserId?: string;
    }) {
        const result = await this.reserveTicketsAtomic({
            ...params,
            quantity: 1,
        });

        return {
            ticket: result.ticket,
            category: result.category,
            financials: result.financials,
        };
    }

    /**
     * Calcule la quantité de billets actuellement réservée temporairement (Hold Cart)
     * Lit à la fois la colonne physique held_quantity et filtre en SQL par metadata->>event_id
     */
    public static async getActiveHeldQuantity(categoryId: string): Promise<number> {
        const supabase = getServiceRoleClient();
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

        // 1. Lire depuis ticket_categories la colonne physique held_quantity et l'event_id
        let dbHeld = 0;
        let eventId: string | null = null;
        try {
            const { data: cat } = await supabase
                .from('ticket_categories')
                .select('event_id')
                .eq('id', categoryId)
                .maybeSingle();
            if (cat) {
                eventId = cat.event_id || null;
            }

            const { data: heldData, error: heldErr } = await supabase
                .from('ticket_categories')
                .select('held_quantity')
                .eq('id', categoryId)
                .maybeSingle();
            if (!heldErr && heldData && typeof (heldData as any).held_quantity === 'number') {
                dbHeld = Number((heldData as any).held_quantity);
            }
        } catch {
            // colonne non présente
        }

        // 2. Calculer le total des holds actifs depuis la table payments filtrée par event_id
        let query = supabase
            .from('payments')
            .select('amount, metadata, created_at')
            .eq('payment_target', 'TICKET')
            .eq('status', 'PENDING');

        if (eventId) {
            query = query.filter('metadata->>event_id', 'eq', eventId);
        }

        const { data: pendingPayments } = await query;

        let pendingHeld = 0;
        for (const p of pendingPayments || []) {
            const expiresAt = p.metadata?.held_expires_at;
            const isStillActive = expiresAt
                ? new Date(expiresAt).getTime() > now.getTime()
                : new Date(p.created_at).getTime() > new Date(tenMinutesAgo).getTime();

            if (isStillActive) {
                if (p.metadata?.checkout_items && Array.isArray(p.metadata.checkout_items)) {
                    for (const item of p.metadata.checkout_items) {
                        if (item.categoryId === categoryId) {
                            pendingHeld += Number(item.quantity || 1);
                        }
                    }
                } else if (p.metadata?.category_id === categoryId) {
                    pendingHeld += Number(p.metadata.quantity || 1);
                }
            }
        }

        return Math.max(dbHeld, pendingHeld);
    }

    /**
     * Vérifie et applique l'ordonnancement strict de réservation temporaire (Hold Queue Serializer)
     * Garantit qu'en cas de forte concurrence (ex: 5 requêtes sur 1 place restante), seule la première est validée
     * et toutes les suivantes sont immédiatement rejetées et nettoyées AVANT tout débit ou appel externe.
     * Effectue une incrémentation atomique CAS sur la colonne physique held_quantity si disponible.
     */
    public static async verifyAndEnforceHoldAtomic(params: {
        paymentId: string;
        categoryId: string;
        quantity: number;
        eventId: string;
    }): Promise<boolean> {
        const supabase = getServiceRoleClient();
        const now = new Date();
        const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

        // 1. Lire la catégorie
        const { data: category } = await supabase
            .from('ticket_categories')
            .select('total_quantity, sold_quantity, name, is_active')
            .eq('id', params.categoryId)
            .single();

        if (!category) {
            await supabase.from('payments').delete().eq('id', params.paymentId);
            throw new Error('Catégorie de billet introuvable.');
        }

        if (!category.is_active) {
            await supabase.from('payments').delete().eq('id', params.paymentId);
            throw new Error(`Cette catégorie de billet n'est plus disponible à la vente (fermée par l'organisateur).`);
        }

        const totalQty = Number(category.total_quantity || 0);
        const soldQty = Number(category.sold_quantity || 0);
        const remainingCapacity = Math.max(0, totalQty - soldQty);

        if (remainingCapacity <= 0) {
            await supabase.from('payments').delete().eq('id', params.paymentId);
            throw new Error(`Épuisé : Aucun billet restant disponible pour la catégorie "${category.name}".`);
        }

        // 2. Lire les intentions PENDING ordonnées chronologiquement avec filtre SQL par eventId
        const { data: pendingPayments } = await supabase
            .from('payments')
            .select('id, amount, metadata, created_at')
            .eq('payment_target', 'TICKET')
            .eq('status', 'PENDING')
            .filter('metadata->>event_id', 'eq', params.eventId)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true });

        let cumulativeHeld = 0;
        let isWithinCapacity = false;

        for (const p of pendingPayments || []) {
            const expiresAt = p.metadata?.held_expires_at;
            const isStillActive = expiresAt
                ? new Date(expiresAt).getTime() > now.getTime()
                : new Date(p.created_at).getTime() > new Date(tenMinutesAgo).getTime();

            if (!isStillActive) continue;

            let qty = 0;
            if (p.metadata?.checkout_items && Array.isArray(p.metadata.checkout_items)) {
                const item = p.metadata.checkout_items.find((i: any) => i.categoryId === params.categoryId);
                if (item) qty = Number(item.quantity || 1);
            } else if (p.metadata?.category_id === params.categoryId) {
                qty = Number(p.metadata.quantity || 1);
            }

            if (qty > 0) {
                cumulativeHeld += qty;
                if (p.id === params.paymentId) {
                    if (cumulativeHeld <= remainingCapacity) {
                        isWithinCapacity = true;
                    }
                    break;
                }
            }
        }

        if (!isWithinCapacity) {
            // Rejet immédiat : supprimer la transaction PENDING perdante pour ne pas bloquer les autres
            await supabase.from('payments').delete().eq('id', params.paymentId);
            throw new Error(`Stock insuffisant : Cette catégorie est actuellement en cours de réservation par d'autres acheteurs. Veuillez réessayer dans quelques minutes.`);
        }

        // 3. Incrémentation atomique CAS de la colonne physique ticket_categories.held_quantity si disponible
        try {
            const { data: checkHeld, error: heldErr } = await supabase
                .from('ticket_categories')
                .select('held_quantity')
                .eq('id', params.categoryId)
                .maybeSingle();

            if (!heldErr && checkHeld && typeof (checkHeld as any).held_quantity === 'number') {
                const maxCasRetries = 10;
                let holdLocked = false;
                let currentHeld = Number((checkHeld as any).held_quantity || 0);
                let currentSold = soldQty;
                let currentTotal = totalQty;

                for (let attempt = 0; attempt < maxCasRetries; attempt++) {
                    if (currentSold + currentHeld + params.quantity > currentTotal) {
                        await supabase.from('payments').delete().eq('id', params.paymentId);
                        throw new Error(`Stock insuffisant : Cette catégorie est actuellement en cours de réservation par d'autres acheteurs. Veuillez réessayer dans quelques minutes.`);
                    }

                    const nextHeld = currentHeld + params.quantity;
                    const { data: updatedCat, error: lockErr } = await supabase
                        .from('ticket_categories')
                        .update({
                            held_quantity: nextHeld,
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', params.categoryId)
                        .eq('held_quantity', currentHeld)
                        .eq('sold_quantity', currentSold)
                        .select('held_quantity, sold_quantity, total_quantity')
                        .maybeSingle();

                    if (!lockErr && updatedCat) {
                        holdLocked = true;
                        break;
                    }

                    await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
                    const { data: refreshedCat } = await supabase
                        .from('ticket_categories')
                        .select('held_quantity, sold_quantity, total_quantity, is_active')
                        .eq('id', params.categoryId)
                        .single();

                    if (!refreshedCat || !refreshedCat.is_active) {
                        await supabase.from('payments').delete().eq('id', params.paymentId);
                        throw new Error(`Cette catégorie de billet n'est plus disponible à la vente.`);
                    }

                    currentHeld = Number((refreshedCat as any).held_quantity || 0);
                    currentSold = Number(refreshedCat.sold_quantity || 0);
                    currentTotal = Number(refreshedCat.total_quantity || 0);
                }

                if (!holdLocked) {
                    await supabase.from('payments').delete().eq('id', params.paymentId);
                    throw new Error(`Stock insuffisant : Conflit de réservation concurrente. Veuillez réessayer.`);
                }
            }
        } catch {
            // colonne held_quantity non configurée en base
        }

        return true;
    }

    /**
     * Libère une réservation temporaire de stock (Hold Cart)
     * Décrémente held_quantity sans toucher sold_quantity via Compare-And-Swap.
     */
    public static async releaseHoldTicketsAtomic(params: {
        categoryId: string;
        quantity: number;
    }): Promise<{ success: boolean; released: number }> {
        const supabase = getServiceRoleClient();
        const qtyToRelease = Math.max(0, Number(params.quantity || 1));

        const maxRetries = 10;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const { data: cat, error: catErr } = await supabase
                    .from('ticket_categories')
                    .select('held_quantity, sold_quantity')
                    .eq('id', params.categoryId)
                    .maybeSingle();

                if (catErr || !cat || typeof (cat as any).held_quantity !== 'number') break;

                const currentHeld = Number((cat as any).held_quantity || 0);
                if (currentHeld <= 0) break; // Déjà à 0

                const nextHeld = Math.max(0, currentHeld - qtyToRelease);
                const { data: updated, error } = await supabase
                    .from('ticket_categories')
                    .update({
                        held_quantity: nextHeld,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', params.categoryId)
                    .eq('held_quantity', currentHeld)
                    .select('held_quantity')
                    .maybeSingle();

                if (!error && updated) break;
                await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
            } catch {
                break;
            }
        }

        return { success: true, released: qtyToRelease };
    }

    /**
     * Remboursement d'un billet (§76 CDC V3.0)
     * Annule le ticket, régularise sold_quantity, crée une ligne refunds,
     * et notifie le client + le partenaire organisateur.
     */
    public static async refundTicket(params: {
        ticketId: string;
        operatorId: string; // User ID de la personne qui effectue le remboursement (PARTENAIRE, ADMIN, CONTROLEUR)
        operatorRole: string;
        reason: string;
    }) {
        const supabase = getServiceRoleClient();


        // 1. Récupération du ticket avec toutes les jointures nécessaires
        const { data: ticket, error: ticketErr } = await supabase
            .from('tickets')
            .select('*, ticket_categories(*, events(id, title, partner_id, partners(user_id, phone))), payments(*)')
            .eq('id', params.ticketId)
            .single();

        if (ticketErr || !ticket) {
            throw new Error('Ticket introuvable.');
        }

        if (ticket.status === 'REMBOURSE') {
            throw new Error('Ce billet a déjà été remboursé.');
        }

        if (ticket.status === 'ANNULE') {
            throw new Error('Ce billet est annulé — il ne peut pas être remboursé.');
        }

        // 2. Vérification de l'autorisation : seul le partenaire propriétaire ou le staff peut rembourser
        const category = ticket.ticket_categories;
        if (!category) {
            throw new Error('Catégorie de billet introuvable.');
        }
        const event = category.events;
        const partnerUserId = event?.partners?.user_id;

        const isStaff = ['ADMIN', 'SUPERADMIN', 'CONTROLEUR'].includes(params.operatorRole);
        const isOwner = partnerUserId === params.operatorId;

        if (!isStaff && !isOwner) {
            throw new Error('Accès non autorisé : seul le partenaire organisateur ou le staff peut rembourser un billet.');
        }

        // 3. Mise à jour atomique du ticket → REMBOURSE
        const { error: updateTicketErr } = await supabase
            .from('tickets')
            .update({
                status: 'REMBOURSE',
                updated_at: new Date().toISOString(),
            })
            .eq('id', params.ticketId)
            .eq('status', ticket.status); // Guard contre une race condition

        if (updateTicketErr) {
            throw new Error(`Échec de la mise à jour du statut du billet: ${updateTicketErr.message}`);
        }

        // 4. Régularisation atomique du sold_quantity (décrémentation)
        const currentSold = Number(category.sold_quantity);
        if (currentSold > 0) {
            await supabase
                .from('ticket_categories')
                .update({
                    sold_quantity: currentSold - 1,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', category.id)
                .eq('sold_quantity', currentSold); // Compare-and-swap
        }

        // 5. Recherche du paiement original associé
        const originalPayment = Array.isArray(ticket.payments)
            ? ticket.payments.find((p: any) => p.status === 'SUCCESS' && p.ticket_id === ticket.id)
            : null;

        // 6. Création d'une ligne refunds (traçabilité financière §76)
        const refundTxId = `REFUND-${Date.now()}-${randomUUID().substring(0, 8)}`;
        const refundAmount = Number(ticket.price) || 0;

        if (originalPayment) {
            const { error: refundErr } = await supabase
                .from('refunds')
                .insert({
                    payment_id: originalPayment.id,
                    refund_transaction_id: refundTxId,
                    amount: refundAmount,
                    reason: params.reason,
                    status: 'PROCESSED',
                    processed_by: params.operatorId,
                });

            if (refundErr) {
                console.error('[EventService.refundTicket] Erreur création refund:', refundErr);
            }
        }

        // 7. Notifications : client + partenaire
        // Notification au client
        await NotificationService.createNotification({
            userId: ticket.user_id,
            title: 'Billet Remboursé',
            message: `Votre billet n°${ticket.ticket_number} a été remboursé${refundAmount > 0 ? ` (${refundAmount.toLocaleString('fr-FR')} FCFA)` : ''}. Motif : ${params.reason}`,
            type: 'PAYMENT',
            data: {
                ticketId: ticket.id,
                ticketNumber: ticket.ticket_number,
                refundAmount,
                reason: params.reason,
            },
        });

        // Notification au partenaire
        if (partnerUserId) {
            await NotificationService.createNotification({
                userId: partnerUserId,
                title: 'Remboursement Billet Traité',
                message: `Le billet n°${ticket.ticket_number} (${refundAmount.toLocaleString('fr-FR')} FCFA) a été remboursé. Motif : ${params.reason}`,
                type: 'PAYMENT',
                data: {
                    ticketId: ticket.id,
                    eventId: event?.id,
                    refundAmount,
                    processedBy: params.operatorId,
                },
            });
        }

        return {
            success: true,
            ticketId: params.ticketId,
            refundTransactionId: refundTxId,
            refundAmount,
            newSoldQuantity: Math.max(0, currentSold - 1),
        };
    }
}

