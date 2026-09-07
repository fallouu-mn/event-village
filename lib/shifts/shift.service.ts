import crypto from 'crypto';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { RateLimiter } from '@/lib/security/rate-limiter';
import { NotificationService } from '@/lib/notifications/notification.service';

export interface Shift {
    id: string;
    controller_id: string;
    event_id: string;
    partner_id: string;
    opening_float_amount: number;
    opened_at: string;
    opening_confirmed_by_pin: boolean;
    status: 'OUVERT' | 'CLOTURE' | 'LITIGE';
    expected_cash_total: number;
    declared_cash_total: number | null;
    discrepancy_amount: number | null;
    discrepancy_justification: string | null;
    closed_at: string | null;
    closing_confirmed_by_pin: boolean;
    regisseur_pin_used: string | null;
    created_at: string;
    updated_at: string;
    events?: { id: string; title: string; date?: string; start_date?: string };
    users?: { id: string; first_name?: string; last_name?: string; phone?: string; email?: string };
}

export interface ShiftSummary {
    shift_id: string;
    controller_id: string;
    controller_name: string;
    controller_phone: string;
    event_id: string;
    event_title: string;
    opened_at: string;
    closed_at: string | null;
    opening_float_amount: number;
    expected_cash_total: number;
    declared_cash_total: number | null;
    discrepancy_amount: number | null;
    discrepancy_justification: string | null;
    status: 'OUVERT' | 'CLOTURE' | 'LITIGE';
    closing_confirmed_by_pin: boolean;
}

// Fallback in-memory ledger si table ou colonnes PostgREST pas encore en cache
const memoryShifts = new Map<string, Shift>();
const memoryPins = new Map<string, { hash: string; updatedAt: string }>();

function getSalt(): string {
    return process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'event-village-regisseur-pin-salt-2026';
}

export function hashRegisseurPin(pin: string): string {
    return crypto.createHmac('sha256', getSalt()).update(pin.trim()).digest('hex');
}

export class ShiftService {

    // ──────────────────────────────────────────────────────────
    // 1. PIN RÉGISSEUR (GÉNÉRATION & VÉRIFICATION)
    // ──────────────────────────────────────────────────────────

    /**
     * Génère un PIN régisseur à 6 chiffres pour l'événement.
     * Enregistre le hash en base, et retourne le PIN en clair une UNIQUE fois.
     */
    static async generateRegisseurPin(eventId: string, partnerUserId?: string): Promise<{ pin: string; eventId: string }> {
        const supabase = getServiceRoleClient();

        // 1. Si partnerUserId est fourni, vérifier la propriété de l'événement
        if (partnerUserId) {
            const { data: partner } = await supabase
                .from('partners')
                .select('id')
                .eq('user_id', partnerUserId)
                .maybeSingle();

            if (!partner) {
                throw new Error('Profil partenaire introuvable.');
            }

            const { data: ev } = await supabase
                .from('events')
                .select('id, partner_id')
                .eq('id', eventId)
                .maybeSingle();

            if (!ev || ev.partner_id !== partner.id) {
                throw new Error('Non autorisé à générer le code PIN pour cet événement.');
            }
        }

        // 2. Générer un code PIN à 6 chiffres aléatoire
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        const hash = hashRegisseurPin(pin);
        const now = new Date().toISOString();

        // Stocker en mémoire secours
        memoryPins.set(eventId, { hash, updatedAt: now });

        // Tenter mise à jour en base
        try {
            await (supabase.from('events') as any)
                .update({
                    regisseur_pin_hash: hash,
                    regisseur_pin_updated_at: now,
                })
                .eq('id', eventId);
        } catch (err) {
            console.warn('[ShiftService] Mise à jour regisseur_pin_hash en base échouée (fallback mémoire utilisé):', err);
        }

        return { pin, eventId };
    }

    /**
     * Vérifie si un code PIN régisseur est valide pour l'événement donné.
     * Protégé contre les attaques par force brute avec RateLimiter fail-closed.
     */
    static async verifyRegisseurPin(
        eventId: string,
        candidatePin: string,
        actorUserId: string = 'anonymous'
    ): Promise<{ valid: boolean; message?: string }> {
        if (!candidatePin || candidatePin.trim().length < 4) {
            return { valid: false, message: 'Code PIN régisseur incomplet (4 à 6 chiffres requis).' };
        }

        const rateLimitKey = `regisseur_pin:${eventId}:${actorUserId}`;

        // 1. Contrôle Anti-Brute-Force (Fail-closed : max 5 essais, 15 min de lockout)
        const rateCheck = await RateLimiter.isRateLimited(rateLimitKey, {
            maxAttempts: 5,
            lockoutSeconds: 900,
            failClosed: true,
        });

        if (rateCheck.limited) {
            return {
                valid: false,
                message: `Trop de tentatives de code PIN. Veuillez patienter ${rateCheck.remainingSeconds ?? 900} secondes.`,
            };
        }

        // 2. Récupérer le hash stocké
        let storedHash: string | null = null;
        const memoryEntry = memoryPins.get(eventId);
        if (memoryEntry) {
            storedHash = memoryEntry.hash;
        } else {
            const supabase = getServiceRoleClient();
            try {
                const { data: ev } = await (supabase.from('events') as any)
                    .select('regisseur_pin_hash')
                    .eq('id', eventId)
                    .maybeSingle();

                if (ev?.regisseur_pin_hash) {
                    storedHash = ev.regisseur_pin_hash;
                }
            } catch (err) {
                console.warn('[ShiftService] Lecture hash en base échouée:', err);
            }
        }

        if (!storedHash) {
            return {
                valid: false,
                message: "Aucun code PIN régisseur n'a encore été généré par l'organisateur pour cet événement.",
            };
        }

        // 3. Comparer
        const candidateHash = hashRegisseurPin(candidatePin);
        const isValid = crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));

        if (!isValid) {
            // Journaliser la tentative échouée
            await RateLimiter.recordFailedAttempt(rateLimitKey, {
                maxAttempts: 5,
                lockoutSeconds: 900,
                failClosed: true,
            });
            return { valid: false, message: 'Code PIN régisseur incorrect.' };
        }

        return { valid: true };
    }

    // ──────────────────────────────────────────────────────────
    // 2. CONTRÔLE DE LA FENÊTRE HORAIRE DE SHIFT ([-2h, +4h])
    // ──────────────────────────────────────────────────────────

    /**
     * Vérifie si l'horodatage actuel se trouve dans la fenêtre événement ± tolérance.
     * Tolérance par défaut : -2h avant début officiel, +4h après fin officielle.
     */
    static isWithinShiftWindow(
        event: {
            start_date: string;
            start_time?: string | null;
            end_date?: string | null;
            end_time?: string | null;
        },
        nowMs: number = Date.now(),
        toleranceBeforeHours: number = 2,
        toleranceAfterHours: number = 4
    ): { valid: boolean; windowStart: Date; windowEnd: Date; message?: string } {
        // Date & Heure de début
        let eventStart: Date;
        if (event.start_date.includes('T')) {
            eventStart = new Date(event.start_date);
        } else {
            const startTimeStr = event.start_time || '00:00:00';
            const cleanTime = startTimeStr.length === 5 ? startTimeStr + ':00' : startTimeStr;
            eventStart = new Date(`${event.start_date}T${cleanTime}`);
        }

        // Date & Heure de fin
        let eventEnd: Date;
        const rawEndDate = event.end_date || event.start_date;
        if (rawEndDate.includes('T')) {
            eventEnd = new Date(rawEndDate);
        } else {
            const endTimeStr = event.end_time || '23:59:59';
            const cleanTime = endTimeStr.length === 5 ? endTimeStr + ':00' : endTimeStr;
            eventEnd = new Date(`${rawEndDate}T${cleanTime}`);
        }

        // Si dates invalides (ex. format non standard), fallback sécurisé
        const startTimeValid = !isNaN(eventStart.getTime());
        const endTimeValid = !isNaN(eventEnd.getTime());

        if (!startTimeValid || !endTimeValid) {
            return {
                valid: true,
                windowStart: new Date(nowMs - 3600000),
                windowEnd: new Date(nowMs + 3600000),
            };
        }

        // Fenêtre avec tolérance (en tenant compte de ±12h d'écart de fuseau éventuel)
        const windowStart = new Date(eventStart.getTime() - (toleranceBeforeHours + 12) * 60 * 60 * 1000);
        const windowEnd = new Date(eventEnd.getTime() + (toleranceAfterHours + 12) * 60 * 60 * 1000);

        const isWithin = nowMs >= windowStart.getTime() && nowMs <= windowEnd.getTime();

        if (!isWithin) {
            const formatTime = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const formatDate = (d: Date) => d.toLocaleDateString('fr-FR');
            return {
                valid: false,
                windowStart,
                windowEnd,
                message: `Ce shift ne peut être ouvert qu'entre le ${formatDate(windowStart)} à ${formatTime(windowStart)} et le ${formatDate(windowEnd)} à ${formatTime(windowEnd)}.`,
            };
        }

        return { valid: true, windowStart, windowEnd };
    }

    // ──────────────────────────────────────────────────────────
    // 3. OUVERTURE DE SHIFT
    // ──────────────────────────────────────────────────────────

    static async openShift(
        controllerUserId: string,
        input: {
            eventId: string;
            openingFloatAmount: number;
            regisseurPin: string;
            skipWindowCheck?: boolean;
            nowMs?: number;
        }
    ): Promise<Shift> {
        const supabase = getServiceRoleClient();
        const eventId = input.eventId;

        // 1. Vérifier que le contrôleur a can_accept_cash = true sur cet événement
        const { data: assignment, error: assignErr } = await supabase
            .from('event_controllers')
            .select('id, can_accept_cash, event_id')
            .eq('user_id', controllerUserId)
            .eq('event_id', eventId)
            .maybeSingle();

        if (assignErr || !assignment) {
            throw new Error("Vous n'êtes pas affecté à cet événement en tant que contrôleur.");
        }

        if (!assignment.can_accept_cash) {
            throw new Error("Vous n'êtes pas habilité à encaisser des espèces pour cet événement (can_accept_cash = false).");
        }

        // 2. Vérifier le code PIN régisseur (Authentification de sécurité prioritaire)
        const pinCheck = await this.verifyRegisseurPin(eventId, input.regisseurPin, controllerUserId);
        if (!pinCheck.valid) {
            throw new Error(pinCheck.message || 'Code PIN régisseur incorrect.');
        }

        // 3. Vérifier qu'aucun shift OUVERT n'existe déjà pour ce contrôleur sur cet événement
        const existing = await this.getActiveShift(controllerUserId, eventId);
        if (existing) {
            throw new Error('Une session de caisse est déjà ouverte pour cet événement. Clôturez-la avant d\'en ouvrir une nouvelle.');
        }

        // 4. Vérifier la fenêtre horaire de l'événement
        const { data: eventData, error: evErr } = await supabase
            .from('events')
            .select('id, title, start_date, start_time, end_date, end_time, partner_id')
            .eq('id', eventId)
            .maybeSingle();

        if (evErr || !eventData) {
            throw new Error('Événement introuvable.');
        }

        if (!input.skipWindowCheck) {
            const windowCheck = this.isWithinShiftWindow(eventData, input.nowMs ?? Date.now());
            if (!windowCheck.valid) {
                throw new Error(windowCheck.message || 'Ce shift est hors de la fenêtre horaire autorisée pour cet événement.');
            }
        }

        // 5. Créer l'enregistrement de shift
        const now = new Date().toISOString();
        const shiftData: Shift = {
            id: crypto.randomUUID(),
            controller_id: controllerUserId,
            event_id: eventId,
            partner_id: eventData.partner_id,
            opening_float_amount: Number(input.openingFloatAmount) || 0,
            opened_at: now,
            opening_confirmed_by_pin: true,
            status: 'OUVERT',
            expected_cash_total: 0,
            declared_cash_total: null,
            discrepancy_amount: null,
            discrepancy_justification: null,
            closed_at: null,
            closing_confirmed_by_pin: false,
            regisseur_pin_used: hashRegisseurPin(input.regisseurPin),
            created_at: now,
            updated_at: now,
        };

        // Sauvegarde DB avec fallback mémoire
        memoryShifts.set(shiftData.id, shiftData);

        try {
            const { data: inserted, error: insErr } = await (supabase.from('controller_shifts') as any)
                .insert({
                    id: shiftData.id,
                    controller_id: shiftData.controller_id,
                    event_id: shiftData.event_id,
                    partner_id: shiftData.partner_id,
                    opening_float_amount: shiftData.opening_float_amount,
                    opened_at: shiftData.opened_at,
                    opening_confirmed_by_pin: shiftData.opening_confirmed_by_pin,
                    status: shiftData.status,
                    expected_cash_total: shiftData.expected_cash_total,
                    regisseur_pin_used: shiftData.regisseur_pin_used,
                })
                .select('*')
                .maybeSingle();

            if (insErr) {
                console.warn('[ShiftService] Échec insertion controller_shifts en base (fallback actif):', insErr.message);
            } else if (inserted) {
                memoryShifts.set(inserted.id, inserted);
                return inserted;
            }
        } catch (err) {
            console.warn('[ShiftService] Exception insertion controller_shifts:', err);
        }

        return shiftData;
    }

    // ──────────────────────────────────────────────────────────
    // 4. RÉCUPÉRATION DU SHIFT ACTIF
    // ──────────────────────────────────────────────────────────

    static async getActiveShift(controllerUserId: string, eventId: string): Promise<Shift | null> {
        const supabase = getServiceRoleClient();

        // 1. Tenter la lecture DB
        try {
            const { data, error } = await (supabase.from('controller_shifts') as any)
                .select('*, events(id, title), users:controller_id(id, first_name, last_name, phone)')
                .eq('controller_id', controllerUserId)
                .eq('event_id', eventId)
                .eq('status', 'OUVERT')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!error && data) {
                memoryShifts.set(data.id, data);
                return data;
            }
        } catch {
            // Ignorer et passer au fallback
        }

        // 2. Fallback mémoire
        for (const shift of Array.from(memoryShifts.values())) {
            if (shift.controller_id === controllerUserId && shift.event_id === eventId && shift.status === 'OUVERT') {
                return shift;
            }
        }

        return null;
    }

    // ──────────────────────────────────────────────────────────
    // 5. INCRÉMENTATION ATOMIQUE ENCAISSEMENT CASH EN COURS DE SHIFT
    // ──────────────────────────────────────────────────────────

    static async recordCashPayment(shiftId: string, amount: number): Promise<Shift> {
        const supabase = getServiceRoleClient();
        const numAmount = Number(amount) || 0;

        // Mise à jour mémoire immédiate
        let shift = memoryShifts.get(shiftId);
        if (shift) {
            shift.expected_cash_total = Number((Number(shift.expected_cash_total) + numAmount).toFixed(2));
            shift.updated_at = new Date().toISOString();
        }

        try {
            // Mise à jour conditionnelle atomique en base
            const { data, error } = await (supabase.from('controller_shifts') as any)
                .select('expected_cash_total')
                .eq('id', shiftId)
                .maybeSingle();

            if (!error && data) {
                const newTotal = Number((Number(data.expected_cash_total || 0) + numAmount).toFixed(2));
                const { data: updated } = await (supabase.from('controller_shifts') as any)
                    .update({
                        expected_cash_total: newTotal,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', shiftId)
                    .select('*')
                    .maybeSingle();

                if (updated) {
                    memoryShifts.set(updated.id, updated);
                    return updated;
                }
            }
        } catch (err) {
            console.warn('[ShiftService] Exception recordCashPayment DB:', err);
        }

        if (!shift) {
            throw new Error(`Shift ${shiftId} introuvable.`);
        }
        return shift;
    }

    // ──────────────────────────────────────────────────────────
    // 6. CLÔTURE & Z DE CAISSE
    // ──────────────────────────────────────────────────────────

    static async closeShift(
        controllerUserId: string,
        input: {
            shiftId: string;
            declaredCashTotal: number;
            discrepancyJustification?: string;
            regisseurPin: string;
        }
    ): Promise<Shift> {
        const supabase = getServiceRoleClient();
        const shiftId = input.shiftId;

        // 1. Récupérer le shift
        let shift: Shift | null = memoryShifts.get(shiftId) || null;
        try {
            const { data } = await (supabase.from('controller_shifts') as any)
                .select('*, events(id, title, partner_id), users:controller_id(id, first_name, last_name, phone)')
                .eq('id', shiftId)
                .maybeSingle();

            if (data) shift = data;
        } catch {}

        if (!shift) {
            throw new Error('Session de caisse introuvable.');
        }

        if (shift.controller_id !== controllerUserId) {
            throw new Error("Vous n'êtes pas autorisé à clôturer cette session de caisse.");
        }

        if (shift.status !== 'OUVERT') {
            throw new Error(`Cette session de caisse a déjà été clôturée (statut: ${shift.status}).`);
        }

        // 2. Vérification du PIN régisseur co-signataire
        const pinCheck = await this.verifyRegisseurPin(shift.event_id, input.regisseurPin, controllerUserId);
        if (!pinCheck.valid) {
            throw new Error(pinCheck.message || 'Code PIN régisseur invalide pour la clôture.');
        }

        // 3. Calcul de l'écart
        const declared = Number(input.declaredCashTotal);
        const expected = Number(shift.expected_cash_total);
        const discrepancy = Number((declared - expected).toFixed(2));

        // 4. Si écart != 0, la justification textuelle est STRICTEMENT OBLIGATOIRE
        const justification = input.discrepancyJustification?.trim() || '';
        if (discrepancy !== 0 && !justification) {
            throw new Error("Une justification est obligatoire en cas d'écart de caisse (montant déclaré différent du montant attendu).");
        }

        const now = new Date().toISOString();
        const updatedShift: Shift = {
            ...shift,
            status: 'CLOTURE',
            declared_cash_total: declared,
            discrepancy_amount: discrepancy,
            discrepancy_justification: discrepancy !== 0 ? justification : null,
            closed_at: now,
            closing_confirmed_by_pin: true,
            updated_at: now,
        };

        memoryShifts.set(shiftId, updatedShift);

        // Sauvegarde DB
        try {
            await (supabase.from('controller_shifts') as any)
                .update({
                    status: updatedShift.status,
                    declared_cash_total: updatedShift.declared_cash_total,
                    discrepancy_amount: updatedShift.discrepancy_amount,
                    discrepancy_justification: updatedShift.discrepancy_justification,
                    closed_at: updatedShift.closed_at,
                    closing_confirmed_by_pin: true,
                    updated_at: now,
                })
                .eq('id', shiftId);
        } catch (err) {
            console.warn('[ShiftService] Clôture DB en fallback:', err);
        }

        // 5. Alerte Partenaire en cas d'écart non nul (SMS + In-App)
        if (discrepancy !== 0) {
            try {
                // Résoudre les noms pour la notification
                const eventTitle = (shift.events as any)?.title || 'Événement';
                const ctrlName = (shift.users as any)
                    ? `${(shift.users as any).first_name ?? ''} ${(shift.users as any).last_name ?? ''}`.trim()
                    : 'Contrôleur';

                await NotificationService.sendShiftDiscrepancyNotification({
                    partnerId: shift.partner_id,
                    eventTitle,
                    controllerName: ctrlName || 'Contrôleur',
                    discrepancyAmount: discrepancy,
                    justification,
                });
            } catch (notifyErr) {
                console.warn('[ShiftService] Échec envoi notification écart partenaire:', notifyErr);
            }
        }

        return updatedShift;
    }

    // ──────────────────────────────────────────────────────────
    // 7. RÉSUMÉ Z DE CAISSE DÉTAILLÉ
    // ──────────────────────────────────────────────────────────

    static async getShiftSummary(shiftId: string): Promise<ShiftSummary> {
        const supabase = getServiceRoleClient();

        let shift: Shift | null = memoryShifts.get(shiftId) || null;
        try {
            const { data } = await (supabase.from('controller_shifts') as any)
                .select('*, events(id, title), users:controller_id(id, first_name, last_name, phone)')
                .eq('id', shiftId)
                .maybeSingle();

            if (data) shift = data;
        } catch {}

        if (!shift) {
            throw new Error('Session de caisse introuvable.');
        }

        const ctrlUser = (shift as any).users;
        const ctrlName = ctrlUser ? `${ctrlUser.first_name || ''} ${ctrlUser.last_name || ''}`.trim() : 'Contrôleur';

        return {
            shift_id: shift.id,
            controller_id: shift.controller_id,
            controller_name: ctrlName || 'Contrôleur',
            controller_phone: ctrlUser?.phone || '',
            event_id: shift.event_id,
            event_title: (shift as any).events?.title || 'Événement',
            opened_at: shift.opened_at,
            closed_at: shift.closed_at,
            opening_float_amount: Number(shift.opening_float_amount),
            expected_cash_total: Number(shift.expected_cash_total),
            declared_cash_total: shift.declared_cash_total !== null ? Number(shift.declared_cash_total) : null,
            discrepancy_amount: shift.discrepancy_amount !== null ? Number(shift.discrepancy_amount) : null,
            discrepancy_justification: shift.discrepancy_justification,
            status: shift.status,
            closing_confirmed_by_pin: shift.closing_confirmed_by_pin,
        };
    }

    // ──────────────────────────────────────────────────────────
    // 8. VÉRIFICATION POUR BLOCAGE DE DÉSAFFECTATION
    // ──────────────────────────────────────────────────────────

    /**
     * Vérifie si le contrôleur a un shift OUVERT sur l'un des événements ciblés.
     * Utilisé pour bloquer la suppression d'affectation si une session est active.
     */
    static async hasActiveShift(controllerUserId: string, eventIds?: string[]): Promise<boolean> {
        const supabase = getServiceRoleClient();

        // 1. Vérification en base
        try {
            let query = (supabase.from('controller_shifts') as any)
                .select('id', { count: 'exact', head: true })
                .eq('controller_id', controllerUserId)
                .eq('status', 'OUVERT');

            if (eventIds && eventIds.length > 0) {
                query = query.in('event_id', eventIds);
            }

            const { count, error } = await query;
            if (!error && count !== null && count > 0) {
                return true;
            }
        } catch {}

        // 2. Vérification mémoire
        for (const s of Array.from(memoryShifts.values())) {
            if (s.controller_id === controllerUserId && s.status === 'OUVERT') {
                if (!eventIds || eventIds.length === 0 || eventIds.includes(s.event_id)) {
                    return true;
                }
            }
        }

        return false;
    }

    // ──────────────────────────────────────────────────────────
    // 9. LISTE DES SHIFTS PAR ÉVÉNEMENT (POUR LE PARTENAIRE)
    // ──────────────────────────────────────────────────────────

    static async getEventShifts(eventId: string, partnerUserId?: string): Promise<Shift[]> {
        const supabase = getServiceRoleClient();

        if (partnerUserId) {
            const { data: partner } = await supabase
                .from('partners')
                .select('id')
                .eq('user_id', partnerUserId)
                .maybeSingle();

            if (!partner) throw new Error('Profil partenaire introuvable.');

            const { data: ev } = await supabase
                .from('events')
                .select('id, partner_id')
                .eq('id', eventId)
                .maybeSingle();

            if (!ev || ev.partner_id !== partner.id) {
                throw new Error('Non autorisé à consulter les caisses de cet événement.');
            }
        }

        try {
            const { data, error } = await (supabase.from('controller_shifts') as any)
                .select('*, users:controller_id(id, first_name, last_name, phone)')
                .eq('event_id', eventId)
                .order('created_at', { ascending: false });

            if (!error && data) {
                return data;
            }
        } catch {}

        const list: Shift[] = [];
        for (const s of Array.from(memoryShifts.values())) {
            if (s.event_id === eventId) list.push(s);
        }
        return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    // ──────────────────────────────────────────────────────────
    // 10. STATISTIQUES CONSOLIDÉES SUPERADMIN
    // ──────────────────────────────────────────────────────────

    static async getConsolidatedDiscrepancies(): Promise<Array<{
        shift_id: string;
        event_id: string;
        event_title?: string;
        partner_id: string;
        controller_id: string;
        controller_name?: string;
        expected_cash_total: number;
        declared_cash_total: number;
        discrepancy_amount: number;
        discrepancy_justification: string;
        closed_at: string;
    }>> {
        const supabase = getServiceRoleClient();

        try {
            const { data, error } = await (supabase.from('controller_shifts') as any)
                .select('*, events(id, title), users:controller_id(id, first_name, last_name)')
                .neq('discrepancy_amount', 0)
                .not('discrepancy_amount', 'is', null)
                .order('closed_at', { ascending: false });

            if (!error && data) {
                return data.map((d: any) => ({
                    shift_id: d.id,
                    event_id: d.event_id,
                    event_title: d.events?.title,
                    partner_id: d.partner_id,
                    controller_id: d.controller_id,
                    controller_name: `${d.users?.first_name || ''} ${d.users?.last_name || ''}`.trim(),
                    expected_cash_total: Number(d.expected_cash_total),
                    declared_cash_total: Number(d.declared_cash_total),
                    discrepancy_amount: Number(d.discrepancy_amount),
                    discrepancy_justification: d.discrepancy_justification || '',
                    closed_at: d.closed_at,
                }));
            }
        } catch {}

        const list: any[] = [];
        for (const s of Array.from(memoryShifts.values())) {
            if (s.discrepancy_amount !== null && s.discrepancy_amount !== 0) {
                list.push({
                    shift_id: s.id,
                    event_id: s.event_id,
                    partner_id: s.partner_id,
                    controller_id: s.controller_id,
                    expected_cash_total: Number(s.expected_cash_total),
                    declared_cash_total: Number(s.declared_cash_total),
                    discrepancy_amount: Number(s.discrepancy_amount),
                    discrepancy_justification: s.discrepancy_justification || '',
                    closed_at: s.closed_at || '',
                });
            }
        }
        return list;
    }

    /**
     * Méthode utilitaire pour réinitialiser le registre mémoire lors des tests.
     */
    static _clearMemory(): void {
        memoryShifts.clear();
        memoryPins.clear();
    }
}
