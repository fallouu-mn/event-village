/**
 * Lot 5 — outils des suites du cycle de vie de l'événement (contrat, sections D et S) :
 *  - createDraftEvent : événement BROUILLON du partenaire et ses catégories, insérés par le
 *    service_role, avec une affiche factice sous le préfixe du contrat F1
 *    (`<SUPABASE_URL>/storage/v1/object/public/public-images/events/<partner_id>/…`) ;
 *  - advanceEventTo : avance un événement jusqu'au statut voulu par les seules RPC du contrat,
 *    event_transition (D4) et event_cancel (D6), avec les acteurs du seed (partenaire propriétaire,
 *    SUPERADMIN pour les actions d'admin) ; chaque étape exige `{ ok: true }` et vérifie le statut
 *    relu en base ;
 *  - shiftEventDates : déplace les seules colonnes de date (événement « dans le passé » : créé dans
 *    le futur, publié, puis déplacé ; la garde D3 ne porte que sur events.status) ;
 *  - eventHistory : lignes de event_status_history, dans l'ordre de l'invariant (j) ;
 *  - rpcTransition, rpcCancel : appels bruts, sans assertion, pour les tests de refus.
 * Les RPC appelées ici n'existent pas avant le correctif : les suites échouent alors sur
 * l'assertion qui les appelle, avec le message de PostgREST (fonction introuvable).
 * Fuseau : Africa/Dakar = UTC+0 toute l'année (comme tests/parcours/acces-helpers.ts).
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { PostgrestError } from '@supabase/supabase-js';
import { service, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { superadminId, type TestPartner } from './finance-helpers';

// ── Statuts ────────────────────────────────────────────────────────────────

export const EVENT_STATUSES = ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU', 'TERMINE', 'ANNULE'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Propriétaire d'un événement : un TestPartner (newPartner) ou un partenaire du seed ({ partnerId, userId }). */
export type EventOwner = Pick<TestPartner, 'partnerId' | 'userId'>;

/** Corps renvoyé par une RPC du contrat : `{ ok: true, … }` ou `{ ok: false, code, message }`. */
export interface RpcBody {
    ok?: boolean;
    code?: string;
    message?: string;
    [key: string]: unknown;
}

/** Résultat brut d'un appel de RPC (aucune assertion). */
export interface RpcCall {
    data: RpcBody | null;
    error: PostgrestError | null;
}

/** Exige une RPC acceptée (`error` nul et `ok: true`) et renvoie son corps ; sinon échoue avec le détail. */
export function assertRpcOk(call: RpcCall, what: string): RpcBody {
    assert.equal(call.error, null, `${what} : ${call.error?.message} (code ${call.error?.code})`);
    assert.ok(call.data, `${what} : réponse vide`);
    assert.equal(call.data.ok, true, `${what} refusé : ${JSON.stringify(call.data)}`);
    return call.data;
}

// ── Dates (Africa/Dakar = UTC+0) ───────────────────────────────────────────

/** Début dans `startsInHours` heures (négatif : déjà commencé) ; durée en heures, ou null pour un événement sans fin. */
export interface DateShift {
    startsInHours: number;
    /** Défaut : 4 heures. `null` : end_date et end_time vides (fin = début à 23:59 à Dakar, contrat D7). */
    durationHours?: number | null;
}

/** Colonnes de date écrites en base (Dakar) ; end_* nulles pour un événement sans fin. */
export interface DateColumns {
    start_date: string;
    start_time: string;
    end_date: string | null;
    end_time: string | null;
}

function dakarParts(d: Date): { date: string; time: string } {
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}

function dateColumns(shift: DateShift): DateColumns {
    const start = new Date(Date.now() + shift.startsInHours * 3600_000);
    const s = dakarParts(start);
    const duration = shift.durationHours === undefined ? 4 : shift.durationHours;
    if (duration === null) return { start_date: s.date, start_time: s.time, end_date: null, end_time: null };
    const e = dakarParts(new Date(start.getTime() + duration * 3600_000));
    return { start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time };
}

/**
 * Déplace les seules colonnes de date de l'événement (start_date, start_time, end_date, end_time),
 * sans toucher au statut (contrat S, dernier paragraphe). Échoue si aucune ligne n'est modifiée.
 */
export async function shiftEventDates(eventId: string, shift: DateShift): Promise<DateColumns> {
    const cols = dateColumns(shift);
    const { data, error } = await service.from('events').update(cols).eq('id', eventId).select('id');
    assert.equal(error, null, `déplacement des dates de l'événement ${eventId} : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `déplacement des dates : événement ${eventId} introuvable`);
    return cols;
}

// ── Création d'un brouillon ────────────────────────────────────────────────

/** URL d'affiche acceptée par le contrat F1 (préfixe du bucket public-images du projet). */
export function posterUrl(partnerId: string, fileName = `${randomUUID()}.png`): string {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    assert.ok(base, 'NEXT_PUBLIC_SUPABASE_URL absente (.env.test)');
    return `${base.replace(/\/+$/, '')}/storage/v1/object/public/public-images/events/${partnerId}/${fileName}`;
}

export interface DraftEventOptions {
    /** Début dans N heures (défaut : 1, fenêtre de scan ouverte comme createTimedEvent du lot 4). */
    startsInHours?: number;
    /** Durée en heures (défaut : 4) ; null : événement sans fin. */
    durationHours?: number | null;
    /** Titre exact (défaut : « TEST Cycle <label> <horodatage> »). */
    title?: string;
    /** Catégorie d'événement (enum event_category ; défaut : CONCERT). */
    category?: 'CONCERT' | 'FESTIVAL' | 'FOOD' | 'SALLE';
    /** Jauge déclarée (défaut : Σ quotas + 10) ; null : sans jauge. */
    capacity?: number | null;
    /** Affiche (défaut : posterUrl(partnerId)) ; null : sans affiche (soumission incomplète, SUBMIT_INCOMPLETE). */
    imageUrl?: string | null;
    location?: string;
    city?: string;
}

export interface DraftEvent extends SaleEvent {
    title: string;
    partnerId: string;
    /** Compte du partenaire propriétaire (acteur des transitions côté partenaire). */
    partnerUserId: string;
    imageUrl: string | null;
}

/**
 * Événement BROUILLON du partenaire et ses catégories, insérés par le service_role. Le résultat est
 * compatible avec les helpers des lots 2 à 4 (SaleEvent : buyConfirmed, newController…).
 */
export async function createDraftEvent(owner: EventOwner, label: string, categories: CategorySpec[], opts: DraftEventOptions = {}): Promise<DraftEvent> {
    const title = opts.title ?? `TEST Cycle ${label} ${Date.now()}`;
    const imageUrl = opts.imageUrl === undefined ? posterUrl(owner.partnerId) : opts.imageUrl;
    const dates = dateColumns({ startsInHours: opts.startsInHours ?? 1, durationHours: opts.durationHours });
    const { data: event, error } = await service.from('events').insert({
        partner_id: owner.partnerId,
        title,
        description: 'Événement dédié aux tests du cycle de vie (lot 5).',
        category: opts.category ?? 'CONCERT',
        ...dates,
        location: opts.location ?? 'Salle de test, Dakar',
        city: opts.city ?? 'Dakar',
        capacity: opts.capacity === undefined ? categories.reduce((sum, c) => sum + c.total, 0) + 10 : opts.capacity,
        image_url: imageUrl,
        status: 'BROUILLON',
    }).select('id, status').single();
    assert.equal(error, null, `brouillon ${label} : ${error?.message}`);
    assert.equal(event.status, 'BROUILLON', `brouillon ${label} : statut ${event.status} à la création`);
    const out: DraftEvent = { eventId: event.id, categories: {}, title, partnerId: owner.partnerId, partnerUserId: owner.userId, imageUrl };
    for (const c of categories) {
        const inserted: { data: { id: string } | null; error: { message: string } | null } = await service.from('ticket_categories').insert({
            event_id: event.id,
            name: c.name,
            price: c.price,
            total_quantity: c.total,
            sold_quantity: 0,
            is_active: c.isActive ?? true,
            is_visible: c.isVisible ?? true,
            max_per_order: c.maxPerOrder ?? 10,
            sale_start: c.saleStart ?? null,
            sale_end: c.saleEnd ?? null,
        }).select('id').single();
        assert.equal(inserted.error, null, `catégorie ${c.name} du brouillon ${label} : ${inserted.error?.message}`);
        out.categories[c.name] = { id: inserted.data!.id, price: c.price, total: c.total };
    }
    return out;
}

// ── Appels bruts des RPC du contrat (D4, D6) ───────────────────────────────

/** event_transition(p) : `{ event_id, actor_id, to_status, reason? }`. `to` est libre (test de UNKNOWN_STATUS). */
export async function rpcTransition(eventId: string, actorId: string, to: string, reason?: string): Promise<RpcCall> {
    const p: Record<string, unknown> = { event_id: eventId, actor_id: actorId, to_status: to };
    if (reason !== undefined) p.reason = reason;
    const { data, error } = await service.rpc('event_transition', { p });
    return { data: (data ?? null) as RpcBody | null, error };
}

export interface CancelInput {
    publicNotice: string;
    internalReason: string;
    confirmTitle: string;
}

/** event_cancel(p) : `{ event_id, actor_id, public_notice, internal_reason, confirm_title }`. */
export async function rpcCancel(eventId: string, actorId: string, input: CancelInput): Promise<RpcCall> {
    const { data, error } = await service.rpc('event_cancel', {
        p: {
            event_id: eventId,
            actor_id: actorId,
            public_notice: input.publicNotice,
            internal_reason: input.internalReason,
            confirm_title: input.confirmTitle,
        },
    });
    return { data: (data ?? null) as RpcBody | null, error };
}

// ── Lecture ────────────────────────────────────────────────────────────────

export async function eventStatus(eventId: string): Promise<EventStatus> {
    const { data, error } = await service.from('events').select('status').eq('id', eventId).single();
    assert.equal(error, null, `statut de l'événement ${eventId} : ${error?.message}`);
    return data.status as EventStatus;
}

export interface EventHistoryRow {
    id: string;
    event_id: string;
    old_status: EventStatus | null;
    new_status: EventStatus;
    actor_id: string | null;
    actor_role: 'PARTENAIRE' | 'ADMIN' | 'SYSTEM';
    reason: string | null;
    channel: 'CREATION' | 'TRANSITION' | 'CANCELLATION' | 'CRON';
    txid: number | string;
    created_at: string;
}

/** Lignes de event_status_history de l'événement, dans l'ordre de l'invariant (j) : created_at, txid, id. */
export async function eventHistory(eventId: string): Promise<EventHistoryRow[]> {
    const { data, error } = await service.from('event_status_history').select('*').eq('event_id', eventId)
        .order('created_at').order('txid').order('id');
    assert.equal(error, null, `historique des statuts de l'événement ${eventId} : ${error?.message}`);
    return (data ?? []) as EventHistoryRow[];
}

// ── Avancement par les RPC ─────────────────────────────────────────────────

type StepKind = 'SUBMIT' | 'VALIDATE' | 'PUBLISH' | 'SUSPEND' | 'REACTIVATE' | 'FINISH' | 'CANCEL';

interface PlannedStep {
    from: EventStatus;
    to: EventStatus;
    kind: StepKind;
}

export type CancellableStatus = 'VALIDE' | 'PUBLIE' | 'SUSPENDU';

export interface AdvanceOptions {
    /** Acteur partenaire (soumission, publication, annulation) : défaut, le compte du partenaire propriétaire lu en base. */
    partnerUserId?: string;
    /** Acteur admin (validation, suspension, réactivation, fin, annulation par l'admin) : défaut, le SUPERADMIN du seed. */
    adminId?: string;
    /** Auteur de la publication VALIDE → PUBLIE (défaut : PARTENAIRE). */
    publishedBy?: 'PARTENAIRE' | 'ADMIN';
    /** Motif de la suspension PUBLIE → SUSPENDU (au moins 3 caractères). */
    suspendReason?: string;
    /** Cible ANNULE : statut d'où l'on annule (défaut : le statut courant s'il est annulable, sinon PUBLIE). */
    cancelFrom?: CancellableStatus;
    /** Auteur de l'annulation (défaut : PARTENAIRE). */
    cancelledBy?: 'PARTENAIRE' | 'ADMIN';
    /** Avis public de l'annulation (au moins 10 caractères). */
    publicNotice?: string;
    /** Motif interne de l'annulation (au moins 3 caractères). */
    internalReason?: string;
    /**
     * Cible TERMINE : dates appliquées par shiftEventDates juste avant la fin manuelle par l'admin,
     * qui exige un début passé (EVENT_NOT_STARTED sinon). Sans cette option, les dates restent telles quelles.
     */
    finishShift?: DateShift;
}

export interface AdvanceStep {
    from: EventStatus;
    to: EventStatus;
    rpc: 'event_transition' | 'event_cancel';
    actorRole: 'PARTENAIRE' | 'ADMIN';
    actorId: string;
    /** Corps `{ ok: true, … }` de la RPC (event_cancel : cashout_ids…). */
    result: RpcBody;
}

export interface AdvanceResult {
    status: EventStatus;
    steps: AdvanceStep[];
}

const MAIN_LINE: readonly EventStatus[] = ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE'];
const FORWARD_KIND: Record<string, StepKind> = { BROUILLON: 'SUBMIT', EN_ATTENTE: 'VALIDATE', VALIDE: 'PUBLISH' };
const CANCELLABLE: readonly EventStatus[] = ['VALIDE', 'PUBLIE', 'SUSPENDU'];

function planPath(from: EventStatus, target: EventStatus, cancelFrom?: CancellableStatus): PlannedStep[] {
    if (from === target) return [];
    if (from === 'ANNULE' || from === 'TERMINE') {
        throw new Error(`statut ${from} terminal : aucun passage possible vers ${target}`);
    }
    if (target === 'SUSPENDU') return [...planPath(from, 'PUBLIE'), { from: 'PUBLIE', to: 'SUSPENDU', kind: 'SUSPEND' }];
    if (target === 'TERMINE') return [...planPath(from, 'PUBLIE'), { from: 'PUBLIE', to: 'TERMINE', kind: 'FINISH' }];
    if (target === 'ANNULE') {
        const start: EventStatus = cancelFrom ?? (CANCELLABLE.includes(from) ? from : 'PUBLIE');
        return [...planPath(from, start), { from: start, to: 'ANNULE', kind: 'CANCEL' }];
    }
    if (from === 'SUSPENDU') {
        if (target === 'PUBLIE') return [{ from: 'SUSPENDU', to: 'PUBLIE', kind: 'REACTIVATE' }];
        throw new Error(`aucun chemin de SUSPENDU vers ${target} par advanceEventTo : appelez rpcTransition directement`);
    }
    const i = MAIN_LINE.indexOf(from);
    const j = MAIN_LINE.indexOf(target);
    if (i < 0 || j < 0 || j < i) {
        throw new Error(`advanceEventTo ne revient pas en arrière (${from} → ${target}) : appelez rpcTransition directement`);
    }
    const steps: PlannedStep[] = [];
    for (let k = i; k < j; k++) steps.push({ from: MAIN_LINE[k], to: MAIN_LINE[k + 1], kind: FORWARD_KIND[MAIN_LINE[k]] });
    return steps;
}

async function ownerUserId(eventId: string): Promise<string> {
    const { data: ev, error } = await service.from('events').select('partner_id').eq('id', eventId).single();
    assert.equal(error, null, `partenaire de l'événement ${eventId} : ${error?.message}`);
    const { data: partner, error: pErr } = await service.from('partners').select('user_id').eq('id', ev.partner_id).single();
    assert.equal(pErr, null, `compte du partenaire ${ev.partner_id} : ${pErr?.message}`);
    return partner.user_id as string;
}

async function eventTitle(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre de l'événement ${eventId} : ${error?.message}`);
    return String(data.title);
}

/**
 * Soumission BROUILLON → EN_ATTENTE. Lot 9 bis (R94, contrat 5.25) : la soumission refuse un début passé ; un
 * brouillon « dans le passé » (événement en cours ou fini voulu par le test) est soumis avec ses dates avancées du
 * nombre de jours nécessaire (heures et durée gardées), puis ses dates demandées lui sont rendues aussitôt.
 */
async function submitWithFutureStart(eventId: string, actorId: string): Promise<RpcCall> {
    const { data, error } = await service.from('events').select('start_date, start_time, end_date, end_time').eq('id', eventId).single();
    assert.equal(error, null, `dates de l'événement ${eventId} : ${error?.message}`);
    const cols = data as DateColumns;
    const time = String(cols.start_time ?? '00:00:00');
    const startMs = Date.parse(`${cols.start_date}T${time.length === 5 ? `${time}:00` : time}Z`);
    if (!(startMs <= Date.now() + 60_000)) return rpcTransition(eventId, actorId, 'EN_ATTENTE');
    const days = Math.floor((Date.now() - startMs) / 86_400_000) + 2;
    const plus = (d: string | null): string | null => {
        if (!d) return null;
        const x = new Date(`${d}T00:00:00Z`);
        x.setUTCDate(x.getUTCDate() + days);
        return x.toISOString().slice(0, 10);
    };
    const moved = { start_date: plus(cols.start_date), end_date: plus(cols.end_date) };
    const { error: mErr } = await service.from('events').update(moved).eq('id', eventId);
    assert.equal(mErr, null, `dates avancées pour la soumission de ${eventId} : ${mErr?.message}`);
    try {
        return await rpcTransition(eventId, actorId, 'EN_ATTENTE');
    } finally {
        const { error: rErr } = await service.from('events')
            .update({ start_date: cols.start_date, end_date: cols.end_date }).eq('id', eventId);
        assert.equal(rErr, null, `dates demandées rendues à ${eventId} : ${rErr?.message}`);
    }
}

/**
 * Avance l'événement de son statut courant jusqu'à `target`, par les RPC du contrat :
 *  BROUILLON → EN_ATTENTE (partenaire), EN_ATTENTE → VALIDE (admin), VALIDE → PUBLIE (partenaire, ou admin
 *  avec publishedBy), PUBLIE → SUSPENDU (admin, motif), SUSPENDU → PUBLIE (admin, réactivation),
 *  PUBLIE → TERMINE (admin, début passé : voir finishShift), VALIDE | PUBLIE | SUSPENDU → ANNULE (event_cancel :
 *  avis public, motif interne, titre retapé lu en base).
 * Chaque étape exige `{ ok: true }` et un statut relu égal à la cible de l'étape. Aucun retour en arrière
 * (EN_ATTENTE → BROUILLON…) : les tests de refus et de retrait appellent rpcTransition directement.
 */
export async function advanceEventTo(eventId: string, target: EventStatus, opts: AdvanceOptions = {}): Promise<AdvanceResult> {
    const current = await eventStatus(eventId);
    let plan: PlannedStep[];
    try {
        plan = planPath(current, target, opts.cancelFrom);
    } catch (err) {
        throw new Error(`advanceEventTo(${eventId}, ${target}) depuis ${current} : ${(err as Error).message}`);
    }
    const steps: AdvanceStep[] = [];
    if (plan.length === 0) return { status: current, steps };

    const partnerActor = opts.partnerUserId ?? await ownerUserId(eventId);
    const adminActor = opts.adminId ?? await superadminId();

    for (const step of plan) {
        let rpc: AdvanceStep['rpc'] = 'event_transition';
        let actorRole: AdvanceStep['actorRole'];
        let call: RpcCall;
        switch (step.kind) {
            case 'SUBMIT':
                actorRole = 'PARTENAIRE';
                call = await submitWithFutureStart(eventId, partnerActor);
                break;
            case 'VALIDATE':
                actorRole = 'ADMIN';
                call = await rpcTransition(eventId, adminActor, 'VALIDE');
                break;
            case 'PUBLISH':
                actorRole = opts.publishedBy ?? 'PARTENAIRE';
                call = await rpcTransition(eventId, actorRole === 'ADMIN' ? adminActor : partnerActor, 'PUBLIE');
                break;
            case 'SUSPEND':
                actorRole = 'ADMIN';
                call = await rpcTransition(eventId, adminActor, 'SUSPENDU', opts.suspendReason ?? 'Suspension de test (lot 5)');
                break;
            case 'REACTIVATE':
                actorRole = 'ADMIN';
                call = await rpcTransition(eventId, adminActor, 'PUBLIE');
                break;
            case 'FINISH':
                actorRole = 'ADMIN';
                if (opts.finishShift) await shiftEventDates(eventId, opts.finishShift);
                call = await rpcTransition(eventId, adminActor, 'TERMINE');
                break;
            case 'CANCEL':
                rpc = 'event_cancel';
                actorRole = opts.cancelledBy ?? 'PARTENAIRE';
                call = await rpcCancel(eventId, actorRole === 'ADMIN' ? adminActor : partnerActor, {
                    publicNotice: opts.publicNotice ?? 'Événement annulé par l’organisateur : vos billets sont remboursés.',
                    internalReason: opts.internalReason ?? 'Annulation de test (lot 5)',
                    confirmTitle: await eventTitle(eventId),
                });
                break;
        }
        const actorId: string = actorRole === 'ADMIN' ? adminActor : partnerActor;
        const what: string = `advanceEventTo(${eventId}, ${target}) : étape ${step.from} → ${step.to} (${rpc}, acteur ${actorRole} ${actorId})`;
        const result: RpcBody = assertRpcOk(call, what);
        const now: EventStatus = await eventStatus(eventId);
        assert.equal(now, step.to, `${what} : RPC acceptée mais statut relu ${now}`);
        steps.push({ from: step.from, to: step.to, rpc, actorRole, actorId, result });
    }
    return { status: target, steps };
}

/** Brouillon créé puis avancé jusqu'à `target` (raccourci de createDraftEvent + advanceEventTo). */
export async function createEventInStatus(
    owner: EventOwner,
    label: string,
    categories: CategorySpec[],
    target: EventStatus,
    opts: DraftEventOptions & AdvanceOptions = {},
): Promise<DraftEvent & AdvanceResult> {
    const ev = await createDraftEvent(owner, label, categories, opts);
    const advanced = await advanceEventTo(ev.eventId, target, { partnerUserId: owner.userId, ...opts });
    return { ...ev, ...advanced };
}
