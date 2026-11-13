/**
 * Sessions de caisse (Z de caisse) et PIN régisseur — lot 4 (4.5 à 4.7).
 *
 *  - La base est la seule source de vérité : aucun registre en mémoire, toute erreur de lecture ou
 *    d'écriture remonte (exception), aucune erreur avalée.
 *  - Ouverture par la RPC shift_open (contrôleur affecté avec la permission espèces, partenaire
 *    propriétaire ou admin ; une seule caisse OUVERT par scanneur et événement). Lot 9 bis (R42, B51) : le
 *    PIN régisseur est obligatoire (400 PIN_REQUIRED sans PIN, 409 PIN_NOT_SET s'il n'a jamais été généré).
 *  - Clôture : contrôleur de la caisse, partenaire propriétaire, ou admin muni de events.write (lot 9 bis,
 *    R17 ; sans la permission, 403 PERMISSION_MISSING).
 *  - Vente au guichet : RPC counter_sale (route dédiée).
 *  - PIN : HMAC-SHA256(REGISSEUR_PIN_KEY, `regisseur-pin:v2:<eventId>:<sel>:<pin>`), sel aléatoire par
 *    événement ; régénération confirmée, refusée (409 OPEN_SHIFTS) tant qu'une caisse est ouverte sauf
 *    confirmation explicite, journalisée ; vérifications limitées par reserveQuota
 *    (REGISSEUR_PIN_PER_SHIFT_15MIN) ; le haché n'est jamais renvoyé ni recopié dans controller_shifts.
 *  - Retrait d'un contrôleur qui a une caisse ouverte : refusé en base (trigger, CONTROLLER_HAS_OPEN_SHIFT,
 *    SQLSTATE EV409) ; les routes traduisent l'erreur en 409 avec isControllerRemovalBlocked.
 */
import crypto from 'crypto';
import { permissionMissingMessage } from '@/lib/admin/permission-labels';
import { getServerEnv, type ServerEnv } from '@/lib/env';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { reserveQuota } from '@/lib/security/quota';
import { getServiceRoleClient } from '@/lib/supabase/server';

export type ShiftStatus = 'OUVERT' | 'CLOTURE' | 'LITIGE';

export interface Shift {
    id: string;
    controller_id: string;
    event_id: string;
    partner_id: string;
    opening_float_amount: number;
    opened_at: string;
    opening_confirmed_by_pin: boolean;
    status: ShiftStatus;
    expected_cash_total: number;
    declared_cash_total: number | null;
    discrepancy_amount: number | null;
    discrepancy_justification: string | null;
    closed_at: string | null;
    closing_confirmed_by_pin: boolean;
    /** Lot 9 quater (C7) : validation de l'écart par l'organisatrice. */
    discrepancy_validated_at?: string | null;
    closed_by?: string | null;
    created_at: string;
    updated_at: string;
    events?: { id: string; title: string; partner_id?: string; date?: string; start_date?: string };
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
    status: ShiftStatus;
    closing_confirmed_by_pin: boolean;
    /** Lot 9 quater (C7) : validation de l'écart par l'organisatrice ; null et écart non nul = en attente. */
    discrepancy_validated_at: string | null;
}

export interface ShiftViewer {
    id: string;
    isAdmin: boolean;
}

/** Refus métier (statut HTTP et code stables) ; toute autre exception est une erreur technique. */
export class ShiftError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly details: Record<string, unknown> = {},
    ) {
        super(message);
        this.name = 'ShiftError';
    }
}

/** Refus métier → { status, body } pour une route ; null pour une erreur technique (à journaliser, 500). */
export function asShiftRefusal(err: unknown): { status: number; body: Record<string, unknown> } | null {
    if (!(err instanceof ShiftError)) return null;
    return { status: err.status, body: { error: err.message, code: err.code, ...err.details } };
}

export interface PinCheck {
    valid: boolean;
    status?: number;
    code?: string;
    message?: string;
}

// Colonnes exposées : jamais regisseur_pin_used (ancienne copie du haché, vidée par la migration du lot 4)
const SHIFT_COLUMNS = 'id, controller_id, event_id, partner_id, opening_float_amount, opened_at, opening_confirmed_by_pin, status, '
    + 'expected_cash_total, declared_cash_total, discrepancy_amount, discrepancy_justification, closed_at, closed_by, closing_confirmed_by_pin, '
    + 'discrepancy_validated_at, created_at, updated_at';
const SHIFT_WITH_PEOPLE = `${SHIFT_COLUMNS}, events(id, title, partner_id), users:controller_id(id, first_name, last_name, phone)`;

const PIN_WINDOW_SECONDS = 15 * 60;
const PIN_FORMAT = /^\d{4,8}$/;

// ── Retrait d'un contrôleur (trigger controller_removal_guard) ─────────────

export const CONTROLLER_HAS_OPEN_SHIFT = 'CONTROLLER_HAS_OPEN_SHIFT';

/** Vrai si l'erreur (PostgREST ou Error) est le refus du trigger : caisse ouverte. */
export function isControllerRemovalBlocked(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { code?: unknown; message?: unknown };
    return e.code === 'EV409' || (typeof e.message === 'string' && e.message.includes(CONTROLLER_HAS_OPEN_SHIFT));
}

/** Corps de la réponse 409 commune à toutes les routes de retrait. */
export function controllerRemovalConflict(): { error: string; code: string } {
    return {
        error: 'Ce contrôleur a une caisse ouverte : clôturez-la avant de le retirer.',
        code: CONTROLLER_HAS_OPEN_SHIFT,
    };
}

// ── PIN régisseur ──────────────────────────────────────────────────────────

type PinEnv = ServerEnv & { REGISSEUR_PIN_KEY?: string; REGISSEUR_PIN_PER_SHIFT_15MIN?: number };

function pinKey(): string {
    const key = (getServerEnv() as PinEnv).REGISSEUR_PIN_KEY;
    if (!key || key.length < 32) {
        throw new Error('REGISSEUR_PIN_KEY absente ou trop courte (32 caractères au moins) : PIN régisseur indisponible.');
    }
    return key;
}

function pinMaxAttempts(): number {
    const max = Number((getServerEnv() as PinEnv).REGISSEUR_PIN_PER_SHIFT_15MIN);
    if (!Number.isInteger(max) || max <= 0) {
        throw new Error('REGISSEUR_PIN_PER_SHIFT_15MIN absente ou invalide : vérification du PIN régisseur refusée.');
    }
    return max;
}

export function hashRegisseurPin(eventId: string, salt: string, pin: string): string {
    return crypto.createHmac('sha256', pinKey()).update(`regisseur-pin:v2:${eventId}:${salt}:${pin.trim()}`).digest('hex');
}

function ctrlName(users: Shift['users'] | null | undefined): string {
    const name = users ? `${users.first_name ?? ''} ${users.last_name ?? ''}`.trim() : '';
    return name || 'Contrôleur';
}

async function isPartnerOwner(userId: string, partnerId: string): Promise<boolean> {
    const { data, error } = await getServiceRoleClient().from('partners').select('id').eq('id', partnerId).eq('user_id', userId).maybeSingle();
    if (error) throw new Error(`Vérification du partenaire propriétaire impossible : ${error.message}`);
    return !!data;
}

async function readShift(shiftId: string): Promise<Shift | null> {
    const { data, error } = await getServiceRoleClient().from('controller_shifts').select(SHIFT_WITH_PEOPLE).eq('id', shiftId).maybeSingle();
    if (error) throw new Error(`Lecture de la session de caisse impossible : ${error.message}`);
    return (data ?? null) as unknown as Shift | null;
}

async function writeAudit(row: { userId: string; userRole?: string | null; action: string; objectType: string; objectId: string; metadata: Record<string, unknown> }): Promise<void> {
    const { error } = await getServiceRoleClient().from('audit_logs').insert({
        user_id: row.userId,
        user_role: row.userRole ?? null,
        action: row.action,
        object_type: row.objectType,
        object_id: row.objectId,
        metadata: row.metadata,
    });
    if (error) throw new Error(`Journalisation (${row.action}) impossible : ${error.message}`);
}

/** Lot 9 bis (R42, contrat 4.3) : PIN régisseur jamais généré pour l'événement. */
const PIN_NOT_SET_MESSAGE = 'Aucun code PIN régisseur pour cet événement : l’organisateur le génère dans l’onglet Caisse du pilotage.';

const SHIFT_OPEN_REFUSALS: Record<string, [number, string]> = {
    EVENT_NOT_FOUND: [404, 'Événement introuvable.'],
    EVENT_NOT_OPEN: [409, 'Cet événement n’est pas ouvert : aucune caisse ne peut être ouverte.'],
    CASH_FORBIDDEN: [403, 'Ouverture de caisse réservée au contrôleur affecté avec la permission espèces, au partenaire propriétaire ou à un admin.'],
    INVALID_FLOAT: [400, 'Le fond de caisse doit être positif ou nul.'],
    SHIFT_ALREADY_OPEN: [409, 'Une session de caisse est déjà ouverte pour cet événement. Clôturez-la avant d’en ouvrir une nouvelle.'],
    // Lot 9 bis (R42, B51) : PIN régisseur obligatoire à toute ouverture de caisse.
    PIN_REQUIRED: [400, 'Saisissez le code PIN du régisseur.'],
};

const SHIFT_CLOSE_REFUSALS: Record<string, [number, string]> = {
    INVALID_INPUT: [400, 'Demande de clôture incomplète.'],
    SHIFT_NOT_FOUND: [404, 'Session de caisse introuvable.'],
    SHIFT_NOT_OPEN: [409, 'Cette session de caisse est déjà clôturée.'],
    INVALID_DECLARED: [400, 'Le montant déclaré doit être un nombre entier de francs, positif ou nul.'],
    JUSTIFICATION_REQUIRED: [400, 'Un écart de caisse doit être justifié (10 caractères au moins).'],
    INVALID_JUSTIFICATION: [400, 'La justification est limitée à 1 000 caractères.'],
    PIN_REQUIRED: [400, 'Le code PIN régisseur est obligatoire pour co-signer une clôture avec écart.'],
    PIN_NOT_SET: [409, PIN_NOT_SET_MESSAGE],
    PIN_INVALID: [401, 'Code PIN régisseur incorrect.'],
    // Lot 9 bis (R17, B49) : un admin ferme une caisse avec la permission events.write seulement.
    PERMISSION_MISSING: [403, permissionMissingMessage('events.write')],
};

/**
 * Résultat d'une clôture de caisse : caisse relue, chiffres de la RPC. Lot 6 (J2.1) : `alertQueued`
 * dit si l'alerte d'écart (SHIFT_DISCREPANCY : in-app, SMS, push au partenaire) a été mise en file dans
 * la transaction de la clôture ; plus aucun SMS synchrone.
 */
export interface ShiftCloseResult {
    shift: Shift;
    expected: number;
    declared: number;
    discrepancy: number;
    pinCosigned: boolean;
    alertQueued: boolean;
    /** Lot 9 quater (C7 : AUD-16) : écart non nul en attente de la validation de l'organisatrice. */
    discrepancyPending: boolean;
}

/** Lot 9 quater (C7) : texte montré au contrôleur après une clôture avec écart. */
export const DISCREPANCY_PENDING_MESSAGE = 'Écart en attente de validation par l’organisateur';

const EVENT_PROBLEM_MESSAGES: Record<string, string> = {
    event_cancelled: 'Cet événement est annulé.',
    event_ended: 'Cet événement est terminé.',
    event_suspended: 'Cet événement est suspendu.',
    event_not_open: 'Cet événement n’est pas encore ouvert au contrôle.',
};

export class ShiftService {

    // ── 1. PIN régisseur ───────────────────────────────────────────────────

    /** Nombre de caisses OUVERT de l'événement. */
    static async countOpenShifts(eventId: string): Promise<number> {
        const { count, error } = await getServiceRoleClient()
            .from('controller_shifts').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('status', 'OUVERT');
        if (error) throw new Error(`Lecture des caisses ouvertes impossible : ${error.message}`);
        return count ?? 0;
    }

    /**
     * Génère (ou régénère) le PIN régisseur de l'événement et le renvoie UNE fois en clair.
     * Ordre : propriété (sauf admin), confirmation, caisses ouvertes, écriture, journal.
     */
    static async generateRegisseurPin(
        eventId: string,
        actorUserId: string,
        options: { confirm?: boolean; confirmOpenShifts?: boolean; actorIsAdmin?: boolean; actorRole?: string } = {},
    ): Promise<{ pin: string; eventId: string; openShifts: number; regenerated: boolean }> {
        const supabase = getServiceRoleClient();
        const { data: ev, error: evErr } = await supabase.from('events').select('id, partner_id').eq('id', eventId).maybeSingle();
        if (evErr) throw new Error(`Lecture de l'événement impossible : ${evErr.message}`);
        if (!ev) throw new ShiftError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
        if (!options.actorIsAdmin && !(await isPartnerOwner(actorUserId, ev.partner_id as string))) {
            throw new ShiftError(403, 'PIN_FORBIDDEN', 'Non autorisé à générer le code PIN pour cet événement.');
        }
        if (options.confirm !== true) {
            throw new ShiftError(400, 'CONFIRMATION_REQUIRED', 'Confirmez la génération du code PIN : l’ancien code ne sera plus valable.');
        }
        const openShifts = await this.countOpenShifts(eventId);
        if (openShifts > 0 && options.confirmOpenShifts !== true) {
            throw new ShiftError(409, 'OPEN_SHIFTS',
                `${openShifts} caisse(s) ouverte(s) : leur clôture exigera le nouveau code PIN. Confirmez explicitement la régénération.`,
                { open_shifts: openShifts });
        }

        const { data: previous, error: prevErr } = await supabase.from('event_regisseur_pins').select('event_id').eq('event_id', eventId).maybeSingle();
        if (prevErr) throw new Error(`Lecture du PIN régisseur impossible : ${prevErr.message}`);

        const pin = crypto.randomInt(100000, 1000000).toString();
        const salt = crypto.randomBytes(16).toString('hex');
        const { error: pinErr } = await supabase.from('event_regisseur_pins').upsert(
            { event_id: eventId, pin_hash: hashRegisseurPin(eventId, salt, pin), pin_salt: salt, updated_at: new Date().toISOString() },
            { onConflict: 'event_id' });
        if (pinErr) throw new Error(`Enregistrement du code PIN régisseur impossible : ${pinErr.message}`);

        await writeAudit({
            userId: actorUserId,
            userRole: options.actorRole,
            action: previous ? 'REGISSEUR_PIN_REGENERATED' : 'REGISSEUR_PIN_GENERATED',
            objectType: 'events',
            objectId: eventId,
            metadata: { event_id: eventId, open_shifts: openShifts, confirm_open_shifts: options.confirmOpenShifts === true },
        });
        return { pin, eventId, openShifts, regenerated: !!previous };
    }

    /**
     * Vérifie un PIN régisseur. Chaque tentative consomme le quota `regisseur_pin` du compartiment
     * donné (une caisse, ou l'ouverture d'une caisse par un compte) : REGISSEUR_PIN_PER_SHIFT_15MIN.
     */
    static async verifyRegisseurPin(eventId: string, candidatePin: string, quotaBucket: string): Promise<PinCheck> {
        const pin = (candidatePin ?? '').trim();
        if (!PIN_FORMAT.test(pin)) {
            return { valid: false, status: 400, code: 'PIN_FORMAT', message: 'Code PIN régisseur incomplet (4 à 8 chiffres).' };
        }
        const quota = await reserveQuota(
            [{ scope: 'regisseur_pin', bucket: quotaBucket, windowSecs: PIN_WINDOW_SECONDS, max: pinMaxAttempts() }],
            'PIN régisseur');
        if (!quota.allowed) {
            return quota.reason === 'EXCEEDED'
                ? { valid: false, status: 429, code: 'PIN_RATE_LIMITED', message: `Trop de tentatives de code PIN. Réessayez dans ${quota.retryAfterSeconds} s.` }
                : { valid: false, status: 503, code: 'PIN_GUARD_UNAVAILABLE', message: 'Vérification du code PIN momentanément indisponible.' };
        }
        const { data, error } = await getServiceRoleClient().from('event_regisseur_pins').select('pin_hash, pin_salt').eq('event_id', eventId).maybeSingle();
        if (error) throw new Error(`Lecture du PIN régisseur impossible : ${error.message}`);
        if (!data) {
            return { valid: false, status: 409, code: 'PIN_NOT_SET', message: PIN_NOT_SET_MESSAGE };
        }
        const expected = Buffer.from(String(data.pin_hash), 'hex');
        const candidate = Buffer.from(hashRegisseurPin(eventId, String(data.pin_salt), pin), 'hex');
        if (expected.length !== candidate.length || !crypto.timingSafeEqual(expected, candidate)) {
            return { valid: false, status: 401, code: 'PIN_INVALID', message: 'Code PIN régisseur incorrect.' };
        }
        return { valid: true };
    }

    // ── 2. Ouverture ───────────────────────────────────────────────────────

    static async openShift(userId: string, input: { eventId: string; openingFloatAmount: number; regisseurPin?: string | null }): Promise<Shift> {
        const float = Number(input.openingFloatAmount ?? 0);
        if (!Number.isFinite(float) || float < 0) throw new ShiftError(400, 'INVALID_FLOAT', SHIFT_OPEN_REFUSALS.INVALID_FLOAT[1]);

        const { data: problem, error: probErr } = await rpcWithRetry<string | null>('scan_event_problem', { p_event: input.eventId });
        if (probErr) throw new Error(`Contrôle de l'événement impossible : ${probErr.message}`);
        if (problem === 'invalid') throw new ShiftError(404, 'EVENT_NOT_FOUND', SHIFT_OPEN_REFUSALS.EVENT_NOT_FOUND[1]);
        if (problem) throw new ShiftError(409, 'EVENT_NOT_OPEN', EVENT_PROBLEM_MESSAGES[problem] ?? SHIFT_OPEN_REFUSALS.EVENT_NOT_OPEN[1], { result: problem });

        // Droit d'encaisser vérifié avant le PIN : un compte non habilité ne consomme pas d'essai
        const { data: allowed, error: allowErr } = await rpcWithRetry<boolean>('shift_can_handle_cash', { p_user: userId, p_event: input.eventId });
        if (allowErr) throw new Error(`Contrôle du droit d'encaisser impossible : ${allowErr.message}`);
        if (allowed !== true) throw new ShiftError(403, 'CASH_FORBIDDEN', SHIFT_OPEN_REFUSALS.CASH_FORBIDDEN[1]);

        // Lot 9 bis (R42, B51) : PIN régisseur obligatoire, vérifié ici (haché hors base), redemandé par shift_open.
        const pin = (input.regisseurPin ?? '').trim();
        if (!pin) throw new ShiftError(400, 'PIN_REQUIRED', SHIFT_OPEN_REFUSALS.PIN_REQUIRED[1]);
        const check = await this.verifyRegisseurPin(input.eventId, pin, `open:${input.eventId}:${userId}`);
        if (!check.valid) throw new ShiftError(check.status ?? 401, check.code ?? 'PIN_INVALID', check.message ?? 'Code PIN régisseur incorrect.');

        const { data, error } = await rpcWithRetry<{ ok?: boolean; code?: string; shift_id?: string; message?: string }>('shift_open', {
            p: { user_id: userId, event_id: input.eventId, opening_float: float, pin_verified: true },
        });
        if (error || !data) throw new Error(`shift_open : ${error?.message ?? 'réponse vide'}`);
        if (data.ok !== true) {
            const code = String(data.code ?? 'SHIFT_OPEN_REFUSED');
            const [status, message] = SHIFT_OPEN_REFUSALS[code] ?? [400, data.message ?? 'Ouverture de caisse refusée.'];
            throw new ShiftError(status, code, message, data.shift_id ? { shift_id: data.shift_id } : {});
        }
        const shift = await readShift(String(data.shift_id));
        if (!shift) throw new Error(`Caisse ${data.shift_id} introuvable après son ouverture.`);
        return shift;
    }

    // ── 3. Caisse active ───────────────────────────────────────────────────

    static async getActiveShift(userId: string, eventId: string): Promise<Shift | null> {
        const { data, error } = await getServiceRoleClient()
            .from('controller_shifts').select(SHIFT_WITH_PEOPLE)
            .eq('controller_id', userId).eq('event_id', eventId).eq('status', 'OUVERT')
            .maybeSingle();
        if (error) throw new Error(`Lecture de la caisse active impossible : ${error.message}`);
        return (data ?? null) as unknown as Shift | null;
    }

    /** Vrai si le contrôleur a une caisse OUVERT (sur les événements donnés) ; erreur → exception. */
    static async hasActiveShift(userId: string, eventIds?: string[]): Promise<boolean> {
        let query = getServiceRoleClient()
            .from('controller_shifts').select('id', { count: 'exact', head: true }).eq('controller_id', userId).eq('status', 'OUVERT');
        if (eventIds && eventIds.length > 0) query = query.in('event_id', eventIds);
        const { count, error } = await query;
        if (error) throw new Error(`Lecture des caisses ouvertes impossible : ${error.message}`);
        return (count ?? 0) > 0;
    }

    // ── 4. Clôture (Z de caisse) ───────────────────────────────────────────

    /**
     * Clôture d'une caisse (lot 5, C2) par son contrôleur, le partenaire propriétaire ou un admin.
     * Ordre : caisse et droit de l'appelant (404 sinon), statut OUVERT, montant entier ≥ 0, puis, si le
     * montant déclaré diffère du total attendu, justification (10 caractères au moins) et PIN régisseur :
     * ces pré-contrôles sur une lecture sans verrou évitent de consommer un essai de PIN pour une demande
     * incomplète. Le PIN est haché ici (clé REGISSEUR_PIN_KEY, hors base) avec le sel courant ; la RPC
     * shift_close refait tous les contrôles sous verrou de la caisse (écart relu sur le total attendu
     * final), compare le haché, clôture, journalise et met en file, dans la même transaction, l'alerte
     * d'écart au partenaire et, si la caisse est fermée par un tiers, l'avis au contrôleur (lot 6, J2.1).
     */
    static async closeShift(
        userId: string,
        input: {
            shiftId: string;
            declaredCashTotal: number;
            justification?: string | null;
            discrepancyJustification?: string | null;
            regisseurPin?: string | null;
        },
        viewer: { isAdmin?: boolean } = {},
    ): Promise<ShiftCloseResult> {
        const shift = await readShift(input.shiftId);
        const allowed = !!shift && (shift.controller_id === userId || viewer.isAdmin === true || (await isPartnerOwner(userId, shift.partner_id)));
        if (!shift || !allowed) throw new ShiftError(404, 'SHIFT_NOT_FOUND', SHIFT_CLOSE_REFUSALS.SHIFT_NOT_FOUND[1]);
        if (shift.status !== 'OUVERT') throw new ShiftError(409, 'SHIFT_NOT_OPEN', SHIFT_CLOSE_REFUSALS.SHIFT_NOT_OPEN[1]);

        const declared = Number(input.declaredCashTotal);
        if (!Number.isInteger(declared) || declared < 0) throw new ShiftError(400, 'INVALID_DECLARED', SHIFT_CLOSE_REFUSALS.INVALID_DECLARED[1]);
        const justification = (input.justification ?? input.discrepancyJustification ?? '').trim();
        const pin = (input.regisseurPin ?? '').trim();

        const expected = Number(shift.expected_cash_total);
        if (declared !== expected) {
            // Lot 8 (8.2 f, contrat 3.6) : écart rendu à l'écran avec le refus. Chiffre lu sans verrou, pour
            // l'affichage seulement : shift_close recontrôle sous verrou et rend le sien. Signe de la RPC.
            const gap = { expected, declared, discrepancy: declared - expected };
            if (justification.length < 10) throw new ShiftError(400, 'JUSTIFICATION_REQUIRED', SHIFT_CLOSE_REFUSALS.JUSTIFICATION_REQUIRED[1], gap);
            // Lot 9 quater (C7 : AUD-16) : plus de PIN régisseur saisi sur le téléphone du contrôleur pour un écart ;
            // l'écart attend la validation de l'organisatrice depuis sa session (un PIN envoyé est ignoré).
        }
        void pin;

        const { data, error } = await rpcWithRetry<Record<string, unknown> & { ok?: boolean; code?: string }>('shift_close', {
            p: {
                shift_id: shift.id,
                actor_id: userId,
                declared_cash_total: declared,
                justification: justification || null,
            },
        });
        if (error || !data) throw new Error(`shift_close : ${error?.message ?? 'réponse vide'}`);
        if (data.ok !== true) {
            const code = String(data.code ?? 'SHIFT_CLOSE_REFUSED');
            const refusal = SHIFT_CLOSE_REFUSALS[code];
            if (!refusal) throw new Error(`shift_close : refus inattendu ${JSON.stringify(data)}`);
            const details: Record<string, unknown> = {};
            for (const k of ['expected', 'declared', 'discrepancy'] as const) if (data[k] !== undefined) details[k] = Number(data[k]);
            if (code === 'PERMISSION_MISSING') details.permission = 'events.write';
            throw new ShiftError(refusal[0], code, refusal[1], details);
        }

        const discrepancy = Number(data.discrepancy ?? 0);
        const closed = await readShift(shift.id);
        if (!closed) throw new Error(`Caisse ${shift.id} introuvable après sa clôture.`);
        return {
            shift: closed,
            expected: Number(data.expected ?? 0),
            declared: Number(data.declared ?? declared),
            discrepancy,
            pinCosigned: data.pin_cosigned === true,
            alertQueued: data.alert_queued === true,
            discrepancyPending: data.discrepancy_pending === true,
        };
    }

    /**
     * Preuve de PIN régisseur pour shift_close : format, quota par caisse (REGISSEUR_PIN_PER_SHIFT_15MIN),
     * sel courant de l'événement, haché HMAC du candidat. La comparaison se fait en base, sous verrou.
     */
    private static async regisseurPinProof(eventId: string, candidatePin: string, quotaBucket: string): Promise<{ pin_salt: string; pin_hash: string }> {
        if (!PIN_FORMAT.test(candidatePin)) throw new ShiftError(400, 'PIN_FORMAT', 'Code PIN régisseur incomplet (4 à 8 chiffres).');
        const quota = await reserveQuota(
            [{ scope: 'regisseur_pin', bucket: quotaBucket, windowSecs: PIN_WINDOW_SECONDS, max: pinMaxAttempts() }],
            'PIN régisseur');
        if (!quota.allowed) {
            if (quota.reason === 'EXCEEDED') {
                throw new ShiftError(429, 'PIN_RATE_LIMITED', `Trop de tentatives de code PIN. Réessayez dans ${quota.retryAfterSeconds} s.`);
            }
            throw new ShiftError(503, 'PIN_GUARD_UNAVAILABLE', 'Vérification du code PIN momentanément indisponible.');
        }
        const { data, error } = await getServiceRoleClient().from('event_regisseur_pins').select('pin_salt').eq('event_id', eventId).maybeSingle();
        if (error) throw new Error(`Lecture du PIN régisseur impossible : ${error.message}`);
        if (!data) throw new ShiftError(409, 'PIN_NOT_SET', SHIFT_CLOSE_REFUSALS.PIN_NOT_SET[1]);
        const salt = String(data.pin_salt);
        return { pin_salt: salt, pin_hash: hashRegisseurPin(eventId, salt, candidatePin) };
    }

    // ── 5. Résumé (ticket Z) ───────────────────────────────────────────────

    /** Lisible par son contrôleur, le partenaire propriétaire ou un admin ; sinon 404 (aucune donnée). */
    static async getShiftSummary(shiftId: string, viewer: ShiftViewer): Promise<ShiftSummary> {
        const shift = await readShift(shiftId);
        const allowed = !!shift && (viewer.isAdmin || shift.controller_id === viewer.id || (await isPartnerOwner(viewer.id, shift.partner_id)));
        if (!shift || !allowed) throw new ShiftError(404, 'SHIFT_NOT_FOUND', 'Session de caisse introuvable.');
        return {
            shift_id: shift.id,
            controller_id: shift.controller_id,
            controller_name: ctrlName(shift.users),
            controller_phone: shift.users?.phone || '',
            event_id: shift.event_id,
            event_title: shift.events?.title || 'Événement',
            opened_at: shift.opened_at,
            closed_at: shift.closed_at,
            opening_float_amount: Number(shift.opening_float_amount),
            expected_cash_total: Number(shift.expected_cash_total),
            declared_cash_total: shift.declared_cash_total !== null ? Number(shift.declared_cash_total) : null,
            discrepancy_amount: shift.discrepancy_amount !== null ? Number(shift.discrepancy_amount) : null,
            discrepancy_justification: shift.discrepancy_justification,
            status: shift.status,
            closing_confirmed_by_pin: shift.closing_confirmed_by_pin === true,
            discrepancy_validated_at: shift.discrepancy_validated_at ?? null,
        };
    }

    // ── 6. Caisses d'un événement (partenaire propriétaire ou admin) ───────

    static async getEventShifts(eventId: string, viewer: ShiftViewer): Promise<Shift[]> {
        const supabase = getServiceRoleClient();
        const { data: ev, error: evErr } = await supabase.from('events').select('id, partner_id').eq('id', eventId).maybeSingle();
        if (evErr) throw new Error(`Lecture de l'événement impossible : ${evErr.message}`);
        if (!ev || (!viewer.isAdmin && !(await isPartnerOwner(viewer.id, ev.partner_id as string)))) {
            throw new ShiftError(404, 'EVENT_NOT_FOUND', 'Événement introuvable.');
        }
        const { data, error } = await supabase.from('controller_shifts')
            .select(`${SHIFT_COLUMNS}, users:controller_id(id, first_name, last_name, phone)`)
            .eq('event_id', eventId)
            .order('created_at', { ascending: false });
        if (error) throw new Error(`Lecture des caisses de l'événement impossible : ${error.message}`);
        return (data ?? []) as unknown as Shift[];
    }

    // ── 7. Écarts consolidés (admin) ───────────────────────────────────────

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
        const { data, error } = await getServiceRoleClient().from('controller_shifts')
            .select(`${SHIFT_COLUMNS}, events(id, title), users:controller_id(id, first_name, last_name)`)
            .neq('discrepancy_amount', 0)
            .not('discrepancy_amount', 'is', null)
            .order('closed_at', { ascending: false });
        if (error) throw new Error(`Lecture des écarts de caisse impossible : ${error.message}`);
        return ((data ?? []) as unknown as Shift[]).map((d) => ({
            shift_id: d.id,
            event_id: d.event_id,
            event_title: d.events?.title,
            partner_id: d.partner_id,
            controller_id: d.controller_id,
            controller_name: ctrlName(d.users),
            expected_cash_total: Number(d.expected_cash_total),
            declared_cash_total: Number(d.declared_cash_total),
            discrepancy_amount: Number(d.discrepancy_amount),
            discrepancy_justification: d.discrepancy_justification || '',
            closed_at: d.closed_at || '',
        }));
    }
}
