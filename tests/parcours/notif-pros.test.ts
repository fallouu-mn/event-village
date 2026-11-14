/**
 * Lot 6, tâche 6.6 — notifications des partenaires (contrat G2, G3, G4, J1.4-J1.7, J2.1-J2.8 ; décisions
 * 11, 14, 17-19, 41, 44 ; S2 groupe Pros).
 *  1. Cycle de l'événement (trigger trg_event_status_notify, même transaction que event_transition) :
 *     refusé (motif), validé, publié par l'admin (et rien quand le partenaire publie lui-même), suspendu
 *     (motif) avec un avis à chaque porteur distinct, réactivé ; une ligne par canal de G2, clé
 *     `<TYPE>:<id de la ligne d'historique>`, texte SMS exact (G3), in-app au titre de G4.
 *  2. Ventes : premier billet vendu une seule fois (en ligne, au guichet ; un billet gratuit ne compte
 *     pas), une « nouvelle commande » in-app par paiement, catégorie complète (et de nouveau après une
 *     hausse du quota, clé avec le quota), événement complet, écart de caisse (alert_queued).
 *  3. Argent (trigger trg_cashouts_notify) : retrait versé, refusé, incertain ; remboursements d'une
 *     annulation terminés (une fois) et bloqués (une fois par jour).
 *  4. Compte : inscription reçue (in-app et email, aucun second SMS après l'OTP), partner_status_set
 *     (validation, refus, suspension, réactivation : statuts synchronisés, sessions révoquées, avis de
 *     suspension envoyé malgré la suspension ; refus REASON_REQUIRED, FORBIDDEN, PARTNER_NOT_FOUND,
 *     TRANSITION_NOT_ALLOWED), la route admin passe par la RPC, essai, abonnement.
 *  5. Compte suspendu : types BLOCK SKIPPED ACCOUNT_SUSPENDED dès l'insertion, types ALLOW envoyés.
 * Envois comptés par numéro neuf (repère smsMark avant le passage de l'envoyeur restreint aux lignes du
 * cas, filtre `ids`) ; les SMS optionnels (PRO_ACTIVITY) sont envoyés à midi (Dakar) le lendemain, hors
 * plage de silence (section Y).
 *
 * Rouge avant correctif : notification_outbox, notification_types et les triggers n'existent pas
 * (migrations 20261103000002, …05, …06) ; partner_status_set non plus ; les envois partent en TypeScript
 * (event-lifecycle.service.ts, notification.service.ts, routes) et l'in-app est écrit directement.
 *
 * Interprétations retenues :
 *  - montants des SMS de retrait : montant du cashout (net des frais), template_data.amount de G2 ;
 *  - nom du contrôleur de l'écart de caisse : « Prénom Nom » (comme controller_name de shift_close) ;
 *  - jours d'essai : 60 (activate_partner_trial, partenaire non fondateur) ;
 *  - dates et montants des textes attendus : fonctions de lib/notifications/sms-format.ts (formats
 *    prouvés par notif-modeles) ; titres, motifs et sociétés courts, en GSM-7, jamais tronqués ;
 *  - alert_queued est cherché à la racine de la réponse de clôture ou dans un objet imbriqué. Lot 9 bis (T25, T38) : code de retrait avec le montant (R62), réactivation avec motif (B37), TRIAL_STARTED sans SMS et avec email (R31, G.49), inscription en deux appels (R53).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { getFakes } from '../fakes';
import { signInAs } from '../helpers/fixtures';
import { randomEmail, randomSenegalPhone, registerPartnerTwoStep, STRONG_PASSWORD, uploadRegistrationDocuments } from './helpers';
import { fakePay, importModule, newBuyer, service, setFakeMode, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import {
    buyConfirmed, cashoutsByKey, createPartnerEvent, jsonRequest, newPartner, superadminId, withSettings,
    type FinanceSettingKey, type TestPartner,
} from './finance-helpers';
import { authed, newController, openShift, scan, ticketPayload, type RouteResult } from './acces-helpers';
import { advanceEventTo, createDraftEvent, eventHistory, rpcTransition, type DraftEvent, type EventStatus } from './cycle-helpers';
import {
    assertNotificationInvariants, dakarDay, dispatchAt, loadLotModule, markEmailVerified, noonDakarTomorrow, outboxRows, smsMark, smsTo,
    type OutboxChannel, type OutboxRow,
} from './notif-helpers';

after(async () => {
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
    await assertNotificationInvariants('notif-pros');
});

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const ALL4: OutboxChannel[] = ['EMAIL', 'IN_APP', 'PUSH', 'SMS'];
const JUSTIFICATION = 'Billet de 2 500 F rendu en trop, constaté au comptage.';

before(() => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch (err) {
        body = { raw: text, parseError: (err as Error).message };
    }
    return { status: res.status, body };
}

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 400)}`;
}

/** Titre court, GSM-7, jamais tronqué par smsVar (20 caractères au plus). */
function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(2).toString('hex')}`;
    assert.ok(t.length <= 20 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 20 caractères GSM-7 au plus`);
    return t;
}

interface SmsFormat {
    smsDateTime: (v: string) => string;
    smsShortDateTime: (v: string) => string;
    smsTime: (v: string) => string;
    smsAmount: (n: number) => string;
}

async function smsFormat(): Promise<SmsFormat> {
    const mod = await loadLotModule('../../lib/notifications/sms-format', 'formats SMS (contrat F2.2)');
    for (const name of ['smsDateTime', 'smsShortDateTime', 'smsTime', 'smsAmount']) {
        assert.equal(typeof mod[name], 'function', `lib/notifications/sms-format.ts : ${name} non exporté`);
    }
    return mod as unknown as SmsFormat;
}

/** Lignes d'un groupe : une par canal attendu, clé `<groupe>:<canal>`, group_key et type exacts. */
async function groupRows(type: string, group: string, channels: OutboxChannel[], recipient?: string): Promise<OutboxRow[]> {
    const rows = await outboxRows({ type, keyPrefix: `${group}:` });
    assert.deepEqual(rows.map((r) => r.channel).sort(), [...channels].sort(),
        `${group} : une ligne par canal ${channels.join(', ')} (reçu ${JSON.stringify(rows.map((r) => `${r.channel}:${r.status}:${r.reason ?? ''}`))})`);
    for (const r of rows) {
        assert.equal(r.group_key, group, `${group} : group_key`);
        assert.equal(r.idempotency_key, `${group}:${r.channel}`, `${group} : clé d'idempotence`);
        assert.equal(r.origin, 'OUTBOX', `${group} : origine OUTBOX`);
        if (recipient) assert.equal(r.recipient_user_id, recipient, `${group} ${r.channel} : destinataire`);
    }
    return rows;
}

/** Le seul groupe d'un type dont la clé commence par `prefix` (clés à txid, à date). */
async function singleGroup(type: string, prefix: string): Promise<string> {
    const rows = await outboxRows({ type, keyPrefix: prefix });
    const groups = Array.from(new Set(rows.map((r) => r.group_key)));
    assert.equal(groups.length, 1, `${type} : un seul groupe de clé ${prefix}… (trouvé ${JSON.stringify(groups)})`);
    return groups[0];
}

/** Passage de l'envoyeur restreint à ces lignes (midi à Dakar le lendemain par défaut), puis relecture. */
async function deliver(rows: OutboxRow[], now: Date = noonDakarTomorrow()): Promise<OutboxRow[]> {
    const ids = rows.map((r) => r.id);
    await dispatchAt(now, { ids });
    return outboxRows({ ids });
}

function byChannel(rows: OutboxRow[], channel: OutboxChannel): OutboxRow {
    const r = rows.find((x) => x.channel === channel);
    assert.ok(r, `ligne ${channel} absente (${JSON.stringify(rows.map((x) => x.idempotency_key))})`);
    return r;
}

/** In-app livrée : ligne SENT, notification de la cloche liée, titre exact, contenu, lien interne. */
async function assertInApp(rows: OutboxRow[], expected: { userId: string; title: string; contains: string[]; actionUrl: string }): Promise<Row> {
    const r = byChannel(rows, 'IN_APP');
    assert.equal(r.status, 'SENT', `${r.idempotency_key} : IN_APP SENT (statut ${r.status}, motif ${r.reason} ${r.reason_detail ?? ''})`);
    assert.ok(r.notification_id, `${r.idempotency_key} : notification_id posé par le marquage`);
    const { data, error } = await service.from('notifications').select('*').eq('id', r.notification_id).single();
    assert.equal(error, null, `notification ${r.notification_id} : ${error?.message}`);
    const n = data as Row;
    assert.equal(n.user_id, expected.userId, `${r.idempotency_key} : destinataire de la notification`);
    assert.equal(n.title, expected.title, `${r.idempotency_key} : titre in-app (G4)`);
    assert.equal(n.channel, 'IN_APP', `${r.idempotency_key} : canal de la notification`);
    for (const part of expected.contains) assert.ok(String(n.content).includes(part), `${r.idempotency_key} : contenu « ${n.content} » sans « ${part} »`);
    const meta = (n.metadata ?? {}) as Row;
    assert.equal(meta.actionUrl, expected.actionUrl, `${r.idempotency_key} : metadata.actionUrl`);
    assert.equal(meta.outbox_id, r.id, `${r.idempotency_key} : metadata.outbox_id`);
    return n;
}

/** SMS livré : ligne SENT avec identifiant du fournisseur, un seul SMS au numéro depuis le repère, texte exact. */
function assertSms(rows: OutboxRow[], phone: string, mark: number, text: string): void {
    const r = byChannel(rows, 'SMS');
    assert.equal(r.status, 'SENT', `${r.idempotency_key} : SMS SENT (statut ${r.status}, motif ${r.reason} ${r.reason_detail ?? ''})`);
    assert.ok(r.provider_message_id, `${r.idempotency_key} : provider_message_id`);
    assert.deepEqual(smsTo(phone, mark).map((m) => m.message), [text], `${r.idempotency_key} : un SMS au texte exact (G3) au ${phone}`);
    assert.ok(text.length <= 160, `texte de ${text.length} caractères`);
}

/** Dernière ligne d'historique de la transition `from` → `to`. */
async function historyId(eventId: string, from: EventStatus, to: EventStatus): Promise<string> {
    const rows = (await eventHistory(eventId)).filter((h) => h.old_status === from && h.new_status === to);
    assert.ok(rows.length > 0, `historique de ${eventId} : aucune transition ${from} → ${to}`);
    return rows[rows.length - 1].id;
}

async function titleOf(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre de l'événement : ${error?.message}`);
    return String(data.title);
}

async function rpc(name: string, p: Row): Promise<{ data: Row | null; error: { message: string; code?: string } | null }> {
    const { data, error } = await service.rpc(name, { p });
    return { data: (data ?? null) as Row | null, error };
}

async function rpcOk(name: string, p: Row, what: string): Promise<Row> {
    const r = await rpc(name, p);
    assert.equal(r.error, null, `${what} : ${r.error?.message} (code ${r.error?.code})`);
    assert.equal(r.data?.ok, true, `${what} refusé : ${JSON.stringify(r.data)}`);
    return r.data!;
}

/** Recherche d'une clé dans un corps JSON imbriqué. */
function findKey(body: unknown, key: string): unknown {
    if (!body || typeof body !== 'object') return undefined;
    if (key in (body as Row)) return (body as Row)[key];
    for (const v of Object.values(body as Row)) {
        const found = findKey(v, key);
        if (found !== undefined) return found;
    }
    return undefined;
}

interface ProPartner extends TestPartner { company: string }

/** Partenaire neuf à raison sociale courte, statut EN_ATTENTE (compte EN_ATTENTE) ou VALIDE (compte ACTIF). */
async function newProPartner(label: string, status: 'EN_ATTENTE' | 'VALIDE' = 'VALIDE'): Promise<ProPartner> {
    const user = await newBuyer(`pro-${label}`, { firstName: 'Moussa', lastName: 'Organisateur' });
    const { error: roleErr } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'PARTENAIRE' }], { onConflict: 'user_id,role' });
    assert.equal(roleErr, null, `rôle PARTENAIRE : ${roleErr?.message}`); await markEmailVerified(user.userId); // lot 9 bis (R87, B96) : email seulement à une adresse vérifiée
    const company = `Societe ${randomBytes(3).toString('hex')}`;
    const { data: partner, error } = await service.from('partners').insert({
        user_id: user.userId, company_name: company, commercial_name: company,
        description: 'Partenaire dédié aux tests des notifications (lot 6).', address: 'Rue de test, Dakar', city: 'Dakar',
        phone: user.phoneE164, email: user.email, is_verified: status === 'VALIDE', status,
    }).select('id').single();
    assert.equal(error, null, `partenaire ${label} : ${error?.message}`);
    const { error: actErr } = await service.from('partner_activities')
        .upsert({ partner_id: partner.id, activity_type: 'ORGANISATEUR', is_active: true }, { onConflict: 'partner_id,activity_type' });
    assert.equal(actErr, null, `activité ORGANISATEUR : ${actErr?.message}`);
    if (status === 'EN_ATTENTE') {
        const { error: stErr } = await service.from('users').update({ status: 'EN_ATTENTE' }).eq('id', user.userId);
        assert.equal(stErr, null, `compte EN_ATTENTE : ${stErr?.message}`);
    }
    return { ...user, partnerId: partner.id as string, company };
}

/** Brouillon du partenaire au titre court, avancé jusqu'à `target` par les RPC du lot 5. */
async function proEvent(owner: TestPartner, label: string, target: EventStatus, cats: CategorySpec[] = [{ name: 'Standard', price: 5_000, total: 30 }], opts: { startsInHours?: number; publishedBy?: 'PARTENAIRE' | 'ADMIN' } = {}): Promise<DraftEvent> {
    const ev = await createDraftEvent(owner, label, cats, { title: shortTitle(label), startsInHours: opts.startsInHours ?? 72 });
    if (target !== 'BROUILLON') await advanceEventTo(ev.eventId, target, { partnerUserId: owner.userId, publishedBy: opts.publishedBy });
    return ev;
}

async function userStatus(userId: string): Promise<string> {
    const { data, error } = await service.from('users').select('status').eq('id', userId).single();
    assert.equal(error, null, `statut du compte : ${error?.message}`);
    return String(data.status);
}

async function partnerRow(partnerId: string): Promise<Row> {
    const { data, error } = await service.from('partners').select('*').eq('id', partnerId).single();
    assert.equal(error, null, `partenaire : ${error?.message}`);
    return data as Row;
}

function anon() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function refreshTokenOf(email: string): Promise<string> {
    const { data, error } = await anon().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion ${email} : ${error?.message}`);
    return data.session!.refresh_token;
}

// ── 1. Cycle de l'événement ────────────────────────────────────────────────

describe('6.6 Partenaire — cycle de l’événement (trg_event_status_notify, contrat J1.7)', () => {
    test('refus par l’admin avec motif puis validation : EVENT_REJECTED et EVENT_VALIDATED, quatre canaux, SMS exacts', async () => {
        const p = await newProPartner('refus');
        const ev = await proEvent(p, 'Refus', 'EN_ATTENTE');
        const reason = 'Affiche illisible, merci de la changer';
        const admin = await superadminId();
        const rejected = await rpcTransition(ev.eventId, admin, 'BROUILLON', reason);
        assert.equal(rejected.error, null, `refus : ${rejected.error?.message}`);
        assert.equal(rejected.data?.ok, true, `refus : ${JSON.stringify(rejected.data)}`);
        const hRej = await historyId(ev.eventId, 'EN_ATTENTE', 'BROUILLON');
        const rej = await groupRows('EVENT_REJECTED', `EVENT_REJECTED:${hRej}`, ALL4, p.userId);
        for (const r of rej) {
            assert.equal(r.event_id, ev.eventId, `${r.idempotency_key} : event_id`);
            assert.equal(r.status, 'PENDING', `${r.idempotency_key} : PENDING dès la transition (${r.status} ${r.reason})`);
        }
        let mark = smsMark(p.phoneE164);
        let sent = await deliver(rej, new Date());
        assertSms(sent, p.phoneE164, mark, `Event Village : événement ${ev.title} non validé. Motif : ${reason}. ${APP_URL}/partner/events`);
        await assertInApp(sent, { userId: p.userId, title: 'Événement non validé', contains: [ev.title, reason], actionUrl: `/partner/events/${ev.eventId}` });

        await advanceEventTo(ev.eventId, 'VALIDE', { partnerUserId: p.userId });
        const hVal = await historyId(ev.eventId, 'EN_ATTENTE', 'VALIDE');
        const val = await groupRows('EVENT_VALIDATED', `EVENT_VALIDATED:${hVal}`, ALL4, p.userId);
        mark = smsMark(p.phoneE164);
        sent = await deliver(val, new Date());
        assertSms(sent, p.phoneE164, mark, `Event Village : votre événement ${ev.title} est validé. Publiez-le depuis votre espace : ${APP_URL}/partner/events`);
        await assertInApp(sent, { userId: p.userId, title: 'Événement validé', contains: [ev.title], actionUrl: `/partner/events/${ev.eventId}` });
        assert.equal((await outboxRows({ type: 'EVENT_REJECTED', eventId: ev.eventId })).length, 4, 'refus : aucune ligne de plus après la validation');
    });

    test('publication par l’admin : EVENT_PUBLISHED_BY_ADMIN (in-app et push, sans SMS) ; publication par le partenaire : rien', async () => {
        const p = await newProPartner('publie');
        const byAdmin = await proEvent(p, 'Pub admin', 'PUBLIE', undefined, { publishedBy: 'ADMIN' });
        const h = await historyId(byAdmin.eventId, 'VALIDE', 'PUBLIE');
        const rows = await groupRows('EVENT_PUBLISHED_BY_ADMIN', `EVENT_PUBLISHED_BY_ADMIN:${h}`, ['IN_APP', 'PUSH', 'EMAIL'], p.userId);
        const sent = await deliver(rows, new Date());
        await assertInApp(sent, { userId: p.userId, title: 'Événement publié', contains: [byAdmin.title], actionUrl: `/partner/events/${byAdmin.eventId}` });

        const bySelf = await proEvent(p, 'Pub soi', 'PUBLIE');
        assert.deepEqual(await outboxRows({ type: 'EVENT_PUBLISHED_BY_ADMIN', eventId: bySelf.eventId }), [], 'publication par le partenaire : aucun avis');
        const validated = await outboxRows({ type: 'EVENT_VALIDATED', eventId: bySelf.eventId });
        assert.equal(validated.length, 4, `validation de l'événement publié par le partenaire : une ligne par canal (${validated.length})`);
    });

    test('suspension avec motif et réactivation : avis au partenaire et un seul avis par porteur distinct (billets VALIDE et UTILISE)', async () => {
        const p = await newProPartner('suspension');
        // Début dans 3 h : la fenêtre de scan (access.scan_window_before_hours = 6) est ouverte, le billet
        // UTILISE l'est par un vrai scan accepté (invariant (g) du lot 4 : jamais d'UTILISE sans scan).
        const ev = await proEvent(p, 'Suspendu', 'PUBLIE', undefined, { startsInHours: 3 });
        const holder = await newBuyer('pros-porteur');
        const used = await newBuyer('pros-porteur-entre');
        const bought = await buyConfirmed(holder, ev, [['Standard', 2]]);
        assert.equal(bought.tickets.length, 2, 'deux billets au même porteur');
        const usedBuy = await buyConfirmed(used, ev, [['Standard', 1]]);
        const scanner = await newController(p, ev.eventId, { label: 'pros-scan' });
        const usedId = String(usedBuy.tickets[0].id);
        const scanned = await scan(scanner, { eventId: ev.eventId, payload: await ticketPayload(usedId) });
        assert.equal(scanned.status, 200, `scan du billet ${usedId} : HTTP ${scanned.status} ${JSON.stringify(scanned.body).slice(0, 300)}`);

        const reason = 'Salle fermée par la mairie';
        await advanceEventTo(ev.eventId, 'SUSPENDU', { partnerUserId: p.userId, suspendReason: reason });
        const hSus = await historyId(ev.eventId, 'PUBLIE', 'SUSPENDU');
        const sus = await groupRows('EVENT_SUSPENDED', `EVENT_SUSPENDED:${hSus}`, ALL4, p.userId);
        for (const who of [holder, used]) {
            await groupRows('EVENT_SUSPENDED_HOLDER', `EVENT_SUSPENDED_HOLDER:${hSus}:${who.userId}`, ['IN_APP', 'PUSH', 'EMAIL'], who.userId);
        }
        const holderRows = await outboxRows({ type: 'EVENT_SUSPENDED_HOLDER', eventId: ev.eventId });
        assert.equal(holderRows.length, 6, `deux porteurs distincts × (IN_APP, PUSH, EMAIL : G.49) : ${holderRows.length} ligne(s)`);
        let mark = smsMark(p.phoneE164);
        let sent = await deliver(sus, new Date());
        assertSms(sent, p.phoneE164, mark, `Event Village : événement ${ev.title} suspendu. Motif : ${reason}. ${APP_URL}/partner/events`);
        await assertInApp(sent, { userId: p.userId, title: 'Événement suspendu', contains: [ev.title, reason], actionUrl: `/partner/events/${ev.eventId}` });
        const hs = await deliver(holderRows);
        await assertInApp(hs.filter((r) => r.recipient_user_id === holder.userId), { userId: holder.userId, title: 'Événement suspendu', contains: [ev.title], actionUrl: `/events/${ev.eventId}` });

        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: p.userId });
        const hRea = await historyId(ev.eventId, 'SUSPENDU', 'PUBLIE');
        const rea = await groupRows('EVENT_REACTIVATED', `EVENT_REACTIVATED:${hRea}`, ALL4, p.userId);
        await groupRows('EVENT_REACTIVATED_HOLDER', `EVENT_REACTIVATED_HOLDER:${hRea}:${holder.userId}`, ['IN_APP', 'PUSH', 'EMAIL'], holder.userId);
        mark = smsMark(p.phoneE164);
        sent = await deliver(rea, new Date());
        assertSms(sent, p.phoneE164, mark, `Event Village : votre événement ${ev.title} est de nouveau en ligne. ${APP_URL}/partner/events`);
        await assertInApp(sent, { userId: p.userId, title: 'Événement réactivé', contains: [ev.title], actionUrl: `/partner/events/${ev.eventId}` });
    });
});

// ── 2. Ventes ──────────────────────────────────────────────────────────────

interface Cashier { ctrl: Buyer; shiftId: string; expected: number }

async function openCashier(partner: TestPartner, eventId: string, label: string): Promise<Cashier> {
    const ctrl = await newController(partner, eventId, { canAcceptCash: true, label });
    const res = await openShift(ctrl, eventId);
    assert.equal(res.status, 200, `ouverture de caisse (${label}) : ${show(res)}`);
    const { data, error } = await service.from('controller_shifts').select('id, expected_cash_total')
        .eq('controller_id', ctrl.userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisse ouverte : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `une caisse OUVERT pour ${label}`);
    return { ctrl, shiftId: String(data![0].id), expected: Number(data![0].expected_cash_total) };
}

describe('6.6 Partenaire — ventes (J1.4, J1.5, J1.1, J2.1)', () => {
    test('premier billet vendu en ligne : une seule fois par événement (quatre canaux), une « nouvelle commande » in-app par paiement', async () => {
        const p = await newProPartner('premier');
        const ev = await proEvent(p, 'Premier', 'PUBLIE');
        const b1 = await newBuyer('pros-prem-1');
        const b2 = await newBuyer('pros-prem-2');
        const first = await buyConfirmed(b1, ev, [['Standard', 1]]);
        assert.equal(first.tickets[0].sale_channel, 'ONLINE', 'billet vendu en ligne');
        const rows = await groupRows('FIRST_TICKET_SOLD', `FIRST_TICKET_SOLD:${ev.eventId}`, ALL4, p.userId);
        const second = await buyConfirmed(b2, ev, [['Standard', 2]]);
        assert.equal((await outboxRows({ type: 'FIRST_TICKET_SOLD', eventId: ev.eventId })).length, 4, 'deuxième vente : aucun nouveau « premier billet »');
        for (const pay of [first.payment, second.payment]) {
            await groupRows('NEW_ORDER', `NEW_ORDER:${pay.id}`, ['IN_APP'], p.userId);
        }
        const mark = smsMark(p.phoneE164);
        const sent = await deliver(rows);
        assertSms(sent, p.phoneE164, mark, `Event Village : premier billet vendu pour ${ev.title}. Suivez vos ventes : ${APP_URL}/partner/events`);
        await assertInApp(sent, { userId: p.userId, title: 'Premier billet vendu', contains: [ev.title], actionUrl: `/partner/events/${ev.eventId}?tab=ventes` });
        const orders = await deliver(await outboxRows({ type: 'NEW_ORDER', userId: p.userId }), new Date());
        await assertInApp(orders.filter((r) => r.group_key === `NEW_ORDER:${second.payment.id}`), {
            userId: p.userId, title: 'Nouvelle commande', contains: [ev.title], actionUrl: `/partner/events/${ev.eventId}?tab=ventes`,
        });
        assert.equal(smsTo(p.phoneE164, mark).length, 1, 'aucun SMS par vente (décision 11) : un seul SMS, le premier billet');
    });

    test('billets gratuits : aucun « premier billet vendu » ; la première vente en ligne ensuite le déclenche', async () => {
        const p = await newProPartner('gratuit');
        const ev = await proEvent(p, 'Gratuit', 'PUBLIE', [{ name: 'Libre', price: 0, total: 20 }, { name: 'Standard', price: 5_000, total: 20 }]);
        const guest = await newBuyer('pros-gratuit');
        const { data, error } = await service.rpc('free_tickets_claim', {
            p_user_id: guest.userId, p_event_id: ev.eventId, p_items: [{ category_id: ev.categories.Libre.id, quantity: 2 }],
        });
        assert.equal(error, null, `free_tickets_claim : ${error?.message}`);
        assert.ok(data && (data as Row).ok !== false, `billets gratuits refusés : ${JSON.stringify(data)}`);
        const { data: free, error: fErr } = await service.from('tickets').select('id, sale_channel').eq('event_id', ev.eventId).eq('user_id', guest.userId);
        assert.equal(fErr, null, `billets gratuits : ${fErr?.message}`);
        assert.equal((free ?? []).length, 2, 'deux billets gratuits émis');
        assert.ok((free ?? []).every((t) => t.sale_channel === 'FREE'), 'canal FREE');
        await groupRows('FREE_TICKETS_CONFIRMED', `FREE_TICKETS_CONFIRMED:${[...(free ?? []).map((t) => String(t.id))].sort()[0]}`, ['EMAIL', 'IN_APP', 'SMS'], guest.userId);
        assert.deepEqual(await outboxRows({ type: 'FIRST_TICKET_SOLD', eventId: ev.eventId }), [], 'un billet gratuit ne compte pas comme vendu (décision 17)');
        await buyConfirmed(await newBuyer('pros-gratuit-payant'), ev, [['Standard', 1]]);
        await groupRows('FIRST_TICKET_SOLD', `FIRST_TICKET_SOLD:${ev.eventId}`, ALL4, p.userId);
    });

    test('premier billet vendu au guichet : déclenché par counter_sale (billet COUNTER)', async () => {
        const p = await newProPartner('guichet');
        const ev = await proEvent(p, 'Guichet', 'PUBLIE', undefined, { startsInHours: 1 });
        const cashier = await openCashier(p, ev.eventId, 'pros-guichet');
        const { POST } = await importModule('../../app/api/controller/counter-sale/route');
        const res = await invoke(POST as Handler, authed('/api/controller/counter-sale', 'POST', cashier.ctrl,
            { eventId: ev.eventId, items: [{ categoryId: ev.categories.Standard.id, quantity: 1 }] }, { 'idempotency-key': randomUUID() }));
        assert.equal(res.status, 200, `vente au guichet : ${show(res)}`);
        const { data, error } = await service.from('tickets').select('sale_channel').eq('event_id', ev.eventId);
        assert.equal(error, null, `billets : ${error?.message}`);
        assert.deepEqual((data ?? []).map((t) => t.sale_channel), ['COUNTER'], 'un billet COUNTER');
        await groupRows('FIRST_TICKET_SOLD', `FIRST_TICKET_SOLD:${ev.eventId}`, ALL4, p.userId);
    });

    test('catégorie complète, de nouveau après une hausse du quota (clé avec le quota), puis événement complet', async () => {
        const p = await newProPartner('complet');
        const ev = await proEvent(p, 'Complet', 'PUBLIE', [{ name: 'Petite', price: 2_000, total: 2 }, { name: 'Unique', price: 3_000, total: 1 }]);
        await buyConfirmed(await newBuyer('pros-cplt-1'), ev, [['Petite', 2]]);
        const petite = ev.categories.Petite.id;
        const first = await groupRows('CATEGORY_SOLD_OUT', `CATEGORY_SOLD_OUT:${petite}:2`, ALL4, p.userId);
        assert.deepEqual(await outboxRows({ type: 'EVENT_SOLD_OUT', eventId: ev.eventId }), [], 'une catégorie reste en vente : événement pas encore complet');
        const mark = smsMark(p.phoneE164);
        const sent = await deliver(first);
        assertSms(sent, p.phoneE164, mark, `Event Village : la catégorie Petite de ${ev.title} est complète. ${APP_URL}/partner/events`);
        await assertInApp(sent, { userId: p.userId, title: 'Catégorie complète', contains: ['Petite', ev.title], actionUrl: `/partner/events/${ev.eventId}?tab=ventes` });

        const { error: upErr } = await service.from('ticket_categories').update({ total_quantity: 3 }).eq('id', petite);
        assert.equal(upErr, null, `hausse du quota : ${upErr?.message}`);
        assert.equal((await outboxRows({ type: 'CATEGORY_SOLD_OUT', eventId: ev.eventId })).length, 4, 'hausse du quota : aucune notification (catégorie de nouveau en vente)');
        await buyConfirmed(await newBuyer('pros-cplt-2'), ev, [['Petite', 1]]);
        await groupRows('CATEGORY_SOLD_OUT', `CATEGORY_SOLD_OUT:${petite}:3`, ALL4, p.userId);

        await buyConfirmed(await newBuyer('pros-cplt-3'), ev, [['Unique', 1]]);
        await groupRows('CATEGORY_SOLD_OUT', `CATEGORY_SOLD_OUT:${ev.categories.Unique.id}:1`, ALL4, p.userId);
        const full = await groupRows('EVENT_SOLD_OUT', `EVENT_SOLD_OUT:${ev.eventId}:4`, ALL4, p.userId);
        const mark2 = smsMark(p.phoneE164);
        const sentFull = await deliver(full);
        assertSms(sentFull, p.phoneE164, mark2, `Event Village : ${ev.title} est complet, toutes les catégories sont vendues. ${APP_URL}/partner/events`);
        await assertInApp(sentFull, { userId: p.userId, title: 'Événement complet', contains: [ev.title], actionUrl: `/partner/events/${ev.eventId}?tab=ventes` });
    });

    test('caisse clôturée avec écart : SHIFT_DISCREPANCY (in-app, SMS, push) au partenaire, alert_queued, SMS exact ; sans écart : rien', async () => {
        const p = await newProPartner('ecart');
        const ev = await proEvent(p, 'Ecart', 'PUBLIE', undefined, { startsInHours: 1 });
        const { POST: pinRoute } = await importModule('../../app/api/partner/events/[id]/regisseur-pin/route');
        const pinRes = await invoke(pinRoute as Handler, authed(`/api/partner/events/${ev.eventId}/regisseur-pin`, 'POST', p, { confirm: true }), routeCtx({ id: ev.eventId }));
        assert.equal(pinRes.status, 200, `PIN régisseur : ${show(pinRes)}`);
        const pin = String(pinRes.body.pin);
        const withGap = await openCashier(p, ev.eventId, 'pros-ecart');
        const clean = await openCashier(p, ev.eventId, 'pros-sans-ecart');
        const { POST: closeRoute } = await importModule('../../app/api/controller/shifts/close/route');
        const res = await invoke(closeRoute as Handler, authed('/api/controller/shifts/close', 'POST', withGap.ctrl,
            { shiftId: withGap.shiftId, declaredCashTotal: withGap.expected + 2_500, justification: JUSTIFICATION, regisseurPin: pin }));
        assert.equal(res.status, 200, `clôture avec écart : ${show(res)}`);
        assert.equal(findKey(res.body, 'alert_queued'), true, `réponse : alert_queued = true (J2.1) : ${show(res)}`);
        assert.equal(findKey(res.body, 'smsSent'), undefined, `réponse : plus de résultat de SMS synchrone : ${show(res)}`);
        const rows = await groupRows('SHIFT_DISCREPANCY', `SHIFT_DISCREPANCY:${withGap.shiftId}`, ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], p.userId);
        assert.equal(smsTo(p.phoneE164).length, 0, 'aucun SMS envoyé par la route (boîte d’envoi seulement)');
        const fmt = await smsFormat();
        const mark = smsMark(p.phoneE164);
        const sent = await deliver(rows, new Date());
        assertSms(sent, p.phoneE164, mark, `Event Village : caisse de Ibrahima Controleur fermée (${ev.title}) avec un écart de +${fmt.smsAmount(2_500)}. ${APP_URL}/partner/events`);
        await assertInApp(sent, { userId: p.userId, title: 'Écart de caisse', contains: ['Ibrahima Controleur', ev.title, JUSTIFICATION], actionUrl: `/partner/events/${ev.eventId}?tab=caisse` });

        const res2 = await invoke(closeRoute as Handler, authed('/api/controller/shifts/close', 'POST', clean.ctrl, { shiftId: clean.shiftId, declaredCashTotal: clean.expected }));
        assert.equal(res2.status, 200, `clôture sans écart : ${show(res2)}`);
        assert.equal(findKey(res2.body, 'alert_queued'), false, `sans écart : alert_queued = false : ${show(res2)}`);
        assert.deepEqual(await outboxRows({ type: 'SHIFT_DISCREPANCY', keyPrefix: `SHIFT_DISCREPANCY:${clean.shiftId}:` }), [], 'sans écart : aucune alerte');
    });
});

// ── 3. Argent ──────────────────────────────────────────────────────────────

const WITHDRAWAL_RULES: Partial<Record<FinanceSettingKey, unknown>> = {
    'finance.withdrawal_fee_rate': 1,
    'finance.withdrawal_min_amount': 5000,
    'finance.withdrawal_bank_enabled': false,
};

/** Partenaire neuf dont une vente en ligne (sans délai de garde) est disponible au retrait (comme finance-retraits). */
async function funded(label: string): Promise<{ partner: TestPartner; ev: SaleEvent }> {
    const partner = await newPartner(`pros-${label}`);
    const ev = await createPartnerEvent(partner.partnerId, `pros-${label}`, [{ name: 'Standard', price: 10_000, total: 20 }]);
    const buyer = await newBuyer(`pros-${label}-ach`);
    await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
    return { partner, ev };
}

function smsCodes(phone: string): string[] {
    return getFakes().sms.messagesTo(phone).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c));
}

/** Retrait par les routes (code WITHDRAWAL lu dans le faux MTarget, puis demande) ; renvoie le cashout. */
async function withdraw(partner: TestPartner, amount: number): Promise<Row> {
    const { POST: otp } = await importModule('../../app/api/withdrawals/otp/route');
    const before0 = smsCodes(partner.phoneE164).length;
    const o = await withSettings(WITHDRAWAL_RULES, () => invoke(otp as Handler, jsonRequest('/api/withdrawals/otp', 'POST', partner.accessToken, { account: 'ORGANISATEUR', amount }))); // lot 9 bis (R62, T25)
    assert.equal(o.status, 200, `code de retrait : ${show(o)}`);
    const codes = smsCodes(partner.phoneE164);
    assert.ok(codes.length > before0, 'code de retrait reçu par SMS');
    const { POST } = await importModule('../../app/api/withdrawals/request/route');
    const res = await withSettings(WITHDRAWAL_RULES, () => invoke(POST as Handler, jsonRequest('/api/withdrawals/request', 'POST', partner.accessToken,
        { account: 'ORGANISATEUR', amount, method: 'MOBILE_MONEY', operator: 'WAVE', phoneNumber: partner.phone9, otpCode: codes[codes.length - 1] },
        { 'idempotency-key': randomUUID() })));
    assert.equal(res.status, 200, `demande de retrait : ${show(res)}`);
    const { data, error } = await service.from('withdrawals').select('id').eq('user_id', partner.userId);
    assert.equal(error, null, `retraits : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'un retrait');
    const [c] = await cashoutsByKey(`WITHDRAWAL-${data![0].id}`);
    assert.ok(c, 'cashout WITHDRAWAL-<id>');
    return c;
}

async function cancelByPartner(owner: TestPartner, eventId: string): Promise<void> {
    const { POST } = await importModule('../../app/api/partner/events/[id]/cancel/route');
    const { data: ev, error } = await service.from('events').select('title').eq('id', eventId).single();
    assert.equal(error, null, `titre : ${error?.message}`);
    const res = await invoke(POST as Handler, jsonRequest(`/api/partner/events/${eventId}/cancel`, 'POST', owner.accessToken, {
        internalReason: 'Test lot 6 : annulation', publicNotice: 'Événement annulé : les acheteurs sont remboursés.', confirmTitle: String(ev.title),
    }), routeCtx({ id: eventId }));
    assert.equal(res.status, 200, `annulation : ${show(res)}`);
}

async function cancellationCashouts(paymentIds: string[]): Promise<Row[]> {
    const { data, error } = await service.from('cashouts').select('*').in('payment_id', paymentIds);
    assert.equal(error, null, `cashouts : ${error?.message}`);
    return (data ?? []) as Row[];
}

describe('6.6 Partenaire — argent (trg_cashouts_notify, contrat J2.2)', () => {
    test('retrait versé : WITHDRAWAL_PAID (quatre canaux), SMS exact au montant du cashout', async () => {
        const { partner } = await funded('retrait-verse');
        const c = await withdraw(partner, 6_000);
        assert.equal(c.status, 'CONFIRME', `cashout confirmé (${c.status})`);
        const rows = await groupRows('WITHDRAWAL_PAID', `WITHDRAWAL_PAID:${c.id}`, ALL4, partner.userId);
        const fmt = await smsFormat();
        const mark = smsMark(partner.phoneE164);
        const sent = await deliver(rows, new Date());
        assertSms(sent, partner.phoneE164, mark, `Event Village : votre retrait de ${fmt.smsAmount(Number(c.amount))} a été versé sur votre compte Wave.`);
        await assertInApp(sent, { userId: partner.userId, title: 'Retrait versé', contains: ['Wave'], actionUrl: '/partner/finance' });
    });

    test('retrait refusé par l’opérateur : WITHDRAWAL_REJECTED (quatre canaux), SMS exact', async () => {
        const { partner } = await funded('retrait-refuse');
        setFakeMode('cashoutMode', 'rejected');
        let c: Row;
        try {
            c = await withdraw(partner, 6_000);
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        assert.equal(c.status, 'ECHOUE', `cashout refusé (${c.status})`);
        const rows = await groupRows('WITHDRAWAL_REJECTED', `WITHDRAWAL_REJECTED:${c.id}`, ALL4, partner.userId);
        const fmt = await smsFormat();
        const mark = smsMark(partner.phoneE164);
        const sent = await deliver(rows, new Date());
        assertSms(sent, partner.phoneE164, mark, `Event Village : votre retrait de ${fmt.smsAmount(Number(c.amount))} a été refusé par l'opérateur. Le montant est revenu sur votre solde.`);
        await assertInApp(sent, { userId: partner.userId, title: 'Retrait refusé', contains: ['solde'], actionUrl: '/partner/finance' });
    });

    test('retrait incertain : WITHDRAWAL_UNCERTAIN (in-app, SMS, push ; clé avec le nombre d’essais), SMS exact', async () => {
        const { partner } = await funded('retrait-incertain');
        setFakeMode('cashoutMode', 'timeout-after-send');
        let c: Row;
        try {
            c = await withdraw(partner, 6_000);
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        assert.equal(c.status, 'INCERTAIN', `cashout incertain (${c.status})`);
        const rows = await groupRows('WITHDRAWAL_UNCERTAIN', `WITHDRAWAL_UNCERTAIN:${c.id}:${Number(c.attempt_count)}`, ['IN_APP', 'PUSH', 'SMS', 'EMAIL'], partner.userId);
        const fmt = await smsFormat();
        const mark = smsMark(partner.phoneE164);
        const sent = await deliver(rows, new Date());
        assertSms(sent, partner.phoneE164, mark, `Event Village : votre retrait de ${fmt.smsAmount(Number(c.amount))} est en vérification auprès de l'opérateur. Aucune action de votre part.`);
        await assertInApp(sent, { userId: partner.userId, title: 'Retrait en vérification', contains: ['vérification'], actionUrl: '/partner/finance' });
    });

    test('remboursements d’une annulation tous versés : CANCEL_REFUNDS_DONE une seule fois (in-app, email, push) ; un REFUND_PAID par cashout', async () => {
        const owner = await newPartner('pros-annul-ok');
        const ev = await createPartnerEvent(owner.partnerId, 'pros-annul-ok', [{ name: 'Standard', price: 5_000, total: 20 }]);
        const p1 = await buyConfirmed(await newBuyer('pros-annul-ok-1'), ev, [['Standard', 1]]);
        const p2 = await buyConfirmed(await newBuyer('pros-annul-ok-2'), ev, [['Standard', 2]]);
        await cancelByPartner(owner, ev.eventId);
        const cashouts = await cancellationCashouts([String(p1.payment.id), String(p2.payment.id)]);
        assert.equal(cashouts.length, 2, 'un cashout par paiement en ligne');
        assert.ok(cashouts.every((c) => c.status === 'CONFIRME'), `cashouts confirmés : ${JSON.stringify(cashouts.map((c) => c.status))}`);
        const rows = await groupRows('CANCEL_REFUNDS_DONE', `CANCEL_REFUNDS_DONE:${ev.eventId}`, ['EMAIL', 'IN_APP', 'PUSH'], owner.userId);
        for (const c of cashouts) await groupRows('REFUND_PAID', `REFUND_PAID:${c.id}`, ALL4, String(c.beneficiary_user_id));
        const sent = await deliver(rows, new Date());
        await assertInApp(sent, { userId: owner.userId, title: 'Remboursements terminés', contains: [await titleOf(ev.eventId)], actionUrl: `/partner/events/${ev.eventId}?tab=cloture` });
    });

    test('remboursements d’une annulation bloqués (solde insuffisant) : CANCEL_REFUNDS_BLOCKED une seule fois pour le jour', async () => {
        const owner = await newPartner('pros-annul-bloque');
        const ev = await createPartnerEvent(owner.partnerId, 'pros-annul-bloque', [{ name: 'Standard', price: 5_000, total: 20 }]);
        const p1 = await buyConfirmed(await newBuyer('pros-annul-bl-1'), ev, [['Standard', 1]]);
        const p2 = await buyConfirmed(await newBuyer('pros-annul-bl-2'), ev, [['Standard', 1]]);
        const balance = fakePay().balance;
        fakePay().balance = 0;
        try {
            await cancelByPartner(owner, ev.eventId);
        } finally {
            fakePay().balance = balance;
        }
        const cashouts = await cancellationCashouts([String(p1.payment.id), String(p2.payment.id)]);
        assert.equal(cashouts.length, 2, 'deux cashouts');
        assert.ok(cashouts.every((c) => c.status === 'A_ENVOYER' && c.blocked_reason), `cashouts bloqués : ${JSON.stringify(cashouts.map((c) => [c.status, c.blocked_reason]))}`);
        const day = dakarDay(0);
        const rows = await groupRows('CANCEL_REFUNDS_BLOCKED', `CANCEL_REFUNDS_BLOCKED:${ev.eventId}:${day}`, ['EMAIL', 'IN_APP', 'PUSH'], owner.userId);
        assert.equal((await outboxRows({ type: 'CANCEL_REFUNDS_BLOCKED', eventId: ev.eventId })).length, 3, 'deux cashouts bloqués le même jour : un seul avis (décision 19)');
        const sent = await deliver(rows, new Date());
        await assertInApp(sent, { userId: owner.userId, title: 'Remboursements en attente', contains: [await titleOf(ev.eventId)], actionUrl: `/partner/events/${ev.eventId}?tab=cloture` });
    });
});

// ── 4. Compte ──────────────────────────────────────────────────────────────

let ipSeq = 0;
function freshIp(): string {
    ipSeq += 1;
    return `198.18.${(process.pid % 200) + 1}.${(ipSeq % 250) + 1}`;
}

describe('6.6 Partenaire — compte (trg_partners_notify, partner_status_set, J2.5-J2.8)', () => {
    // Lot 9 quinquies (C3 ; modification signalée au rapport) : la décision 14 (pas de SMS « inscription reçue ») est remplacée
    // par le SMS d'accusé demandé par le chef de projet : PARTNER_REGISTERED_ACK a maintenant le canal SMS.
    test('inscription par la route : SMS du code, puis PARTNER_REGISTERED_ACK in-app, email et SMS d’accusé', async () => {
        const phone = randomSenegalPhone('76');
        const email = randomEmail('pros-inscription');
        const reg = await registerPartnerTwoStep({ // lot 9 bis (R53, T38) : deux appels de la même route, code lu dans le faux SMS
            companyName: 'Inscription Test SARL', description: 'Organisateur fictif créé par les tests du lot 6.', address: '12 rue des Tests',
            city: 'Dakar', activities: ['ORGANISATEUR'], firstName: 'Fatou', lastName: 'Inscrite', phone, email,
            password: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD, ...(await uploadRegistrationDocuments()),
        }, { headers: { 'x-forwarded-for': `${freshIp()}, 10.0.0.1` } });
        assert.equal(reg.first.status, 200, `appel 1 (code envoyé, rien de créé) : ${show(reg.first)}`); const res = reg.second ?? reg.first;
        assert.ok(reg.second !== null && res.status < 300, `inscription partenaire (appel 2, avec le code) : ${show(res)}`);
        assert.equal(getFakes().sms.messagesTo(phone).length, 1, 'un SMS synchrone : le code d’inscription');
        assert.match(getFakes().sms.messagesTo(phone)[0].message, /\b\d{6}\b/, 'le SMS est le code');
        const { data: user, error } = await service.from('users').select('id, status').in('phone', [phone, phone.replace(/^\+/, '')]).single(); // lot 9 bis (contrat 4.6) : users.email est technique, l'adresse saisie attend sa vérification
        assert.equal(error, null, `compte : ${error?.message}`);
        const pr = await service.from('partners').select('id').eq('user_id', user.id).single();
        assert.equal(pr.error, null, `partenaire : ${pr.error?.message}`);
        const rows = await groupRows('PARTNER_REGISTERED_ACK', `PARTNER_REGISTERED_ACK:${pr.data!.id}`, ['EMAIL', 'IN_APP', 'SMS'], String(user.id));
        assert.ok(rows.every((r) => (r.channel === 'EMAIL' ? r.status === 'SKIPPED' && r.reason === 'NO_REAL_EMAIL' : r.status === 'PENDING')), `compte EN_ATTENTE : avis non bloqué ; EMAIL SKIPPED NO_REAL_EMAIL, adresse technique (contrat 4.6, B100) (${JSON.stringify(rows.map((r) => [r.channel, r.status, r.reason]))})`);
        const outboxSms = [...await outboxRows({ userId: String(user.id), channel: 'SMS' }), ...await outboxRows({ phone, channel: 'SMS' })]
            .filter((r) => r.origin === 'OUTBOX');
        assert.deepEqual(Array.from(new Set(outboxSms.map((r) => r.idempotency_key))), [`PARTNER_REGISTERED_ACK:${pr.data!.id}:SMS`], 'une seule ligne SMS : l’accusé (C3)');
        const sent = await deliver(rows, new Date());
        await assertInApp(sent, { userId: String(user.id), title: 'Inscription reçue', contains: ['Inscription Test SARL'], actionUrl: '/partner/dashboard' });
        const messages = getFakes().sms.messagesTo(phone).map((m) => m.message);
        assert.equal(messages.length, 2, `après le passage de l’envoyeur : le code, puis l’accusé (${JSON.stringify(messages)})`);
        assert.equal(messages[1], 'Event Village : votre demande de compte partenaire Inscription Test SARL est enregistrée. Réponse sous 48 h.', 'texte de l’accusé (C3)');
    });

    test('partner_status_set : validation d’un partenaire EN_ATTENTE → VALIDE, compte ACTIF, PARTNER_VALIDATED (in-app, SMS, email), SMS exact', async () => {
        const p = await newProPartner('valide', 'EN_ATTENTE');
        const out = await rpcOk('partner_status_set', { partner_id: p.partnerId, actor_id: await superadminId(), status: 'VALIDE' }, 'validation');
        assert.ok(out, 'réponse');
        assert.equal((await partnerRow(p.partnerId)).status, 'VALIDE', 'partners.status');
        assert.equal(await userStatus(p.userId), 'ACTIF', 'users.status synchronisé');
        const group = await singleGroup('PARTNER_VALIDATED', `PARTNER_VALIDATED:${p.partnerId}:tx`);
        const rows = await groupRows('PARTNER_VALIDATED', group, ['EMAIL', 'IN_APP', 'SMS'], p.userId);
        const mark = smsMark(p.phoneE164);
        const sent = await deliver(rows, new Date());
        assertSms(sent, p.phoneE164, mark, `Event Village : votre compte partenaire ${p.company} est validé. Connectez-vous : ${APP_URL}/login`);
        await assertInApp(sent, { userId: p.userId, title: 'Compte partenaire validé', contains: [], actionUrl: '/partner/dashboard' });
    });

    test('partner_status_set : refus avec motif → REJETE, motif enregistré, PARTNER_REJECTED, SMS exact ; motif trop court → REASON_REQUIRED', async () => {
        const p = await newProPartner('rejete', 'EN_ATTENTE');
        const admin = await superadminId();
        const short = await rpc('partner_status_set', { partner_id: p.partnerId, actor_id: admin, status: 'REJETE', reason: 'no' });
        assert.equal(short.error, null, `refus sans motif : ${short.error?.message}`);
        assert.equal(short.data?.ok, false, `motif de 2 caractères accepté : ${JSON.stringify(short.data)}`);
        assert.equal(short.data?.code, 'REASON_REQUIRED', `code : ${JSON.stringify(short.data)}`);
        assert.equal((await partnerRow(p.partnerId)).status, 'EN_ATTENTE', 'refus refusé : statut inchangé');
        const reason = 'Pièce d’identité illisible';
        await rpcOk('partner_status_set', { partner_id: p.partnerId, actor_id: admin, status: 'REJETE', reason }, 'refus');
        const row = await partnerRow(p.partnerId);
        assert.equal(row.status, 'REJETE', 'partners.status');
        assert.equal(row.rejection_reason, reason, 'rejection_reason');
        const group = await singleGroup('PARTNER_REJECTED', `PARTNER_REJECTED:${p.partnerId}:tx`);
        const rows = await groupRows('PARTNER_REJECTED', group, ['EMAIL', 'IN_APP', 'SMS'], p.userId);
        const mark = smsMark(p.phoneE164);
        const sent = await deliver(rows, new Date());
        assertSms(sent, p.phoneE164, mark, `Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : Pièce d'identité illisible.`);
        await assertInApp(sent, { userId: p.userId, title: 'Demande refusée', contains: [reason], actionUrl: '/partner/dashboard' });
    });

    test('partner_status_set : suspension (motif) → partenaire et compte SUSPENDU, sessions révoquées, avis envoyé malgré la suspension (ALLOW) ; réactivation → VALIDE, ACTIF, PARTNER_REACTIVATED', async () => {
        const p = await newProPartner('suspendu');
        const refresh = await refreshTokenOf(p.email);
        const admin = await superadminId();
        const reason = 'Plaintes répétées de clients';
        await rpcOk('partner_status_set', { partner_id: p.partnerId, actor_id: admin, status: 'SUSPENDU', reason }, 'suspension');
        const row = await partnerRow(p.partnerId);
        assert.equal(row.status, 'SUSPENDU', 'partners.status');
        assert.equal(row.suspended_reason, reason, 'suspended_reason');
        assert.equal(await userStatus(p.userId), 'SUSPENDU', 'users.status synchronisé dans la même transaction');
        const { data: s, error: sErr } = await anon().auth.refreshSession({ refresh_token: refresh });
        assert.ok(sErr || !s.session, 'jeton de rafraîchissement révoqué par la suspension (revoke_user_sessions)');
        const group = await singleGroup('PARTNER_SUSPENDED', `PARTNER_SUSPENDED:${p.partnerId}:tx`);
        const rows = await groupRows('PARTNER_SUSPENDED', group, ['EMAIL', 'IN_APP', 'SMS'], p.userId);
        assert.ok(rows.every((r) => r.status === 'PENDING'), `avis de suspension non bloqué (politique ALLOW, décision 41) : ${JSON.stringify(rows.map((r) => [r.channel, r.status, r.reason]))}`);
        let mark = smsMark(p.phoneE164);
        let sent = await deliver(rows, new Date());
        // Lot 9 quinquies (B1 : AUTH-06, modification signalée) : lien de la page d'aide
        assertSms(sent, p.phoneE164, mark, `Event Village : votre compte partenaire est suspendu. Motif : ${reason}. Aide : ${APP_URL}/aide`);
        await assertInApp(sent, { userId: p.userId, title: 'Compte suspendu', contains: [reason], actionUrl: '/partner/dashboard' });

        await rpcOk('partner_status_set', { partner_id: p.partnerId, actor_id: admin, status: 'VALIDE', reason: 'Plaintes traitées, compte rétabli' }, 'réactivation'); // lot 9 bis (B37, T25)
        assert.equal((await partnerRow(p.partnerId)).status, 'VALIDE', 'partners.status réactivé');
        assert.equal(await userStatus(p.userId), 'ACTIF', 'users.status réactivé');
        const rgroup = await singleGroup('PARTNER_REACTIVATED', `PARTNER_REACTIVATED:${p.partnerId}:tx`);
        const rrows = await groupRows('PARTNER_REACTIVATED', rgroup, ['EMAIL', 'IN_APP', 'SMS'], p.userId);
        mark = smsMark(p.phoneE164);
        sent = await deliver(rrows, new Date());
        assertSms(sent, p.phoneE164, mark, `Event Village : votre compte partenaire est réactivé. Connectez-vous : ${APP_URL}/login`);
        await assertInApp(sent, { userId: p.userId, title: 'Compte réactivé', contains: [], actionUrl: '/partner/dashboard' });
        assert.deepEqual(await outboxRows({ type: 'PARTNER_VALIDATED', keyPrefix: `PARTNER_VALIDATED:${p.partnerId}:` }), [], 'réactivation : PARTNER_REACTIVATED, pas PARTNER_VALIDATED');
    });

    test('partner_status_set : refus FORBIDDEN (acteur non admin), PARTNER_NOT_FOUND, TRANSITION_NOT_ALLOWED (statut inchangé), sans aucune ligne', async () => {
        const p = await newProPartner('refus-rpc');
        const client = await newBuyer('pros-pas-admin');
        const forbidden = await rpc('partner_status_set', { partner_id: p.partnerId, actor_id: client.userId, status: 'SUSPENDU', reason: 'Tentative non autorisée' });
        assert.equal(forbidden.error, null, `acteur non admin : ${forbidden.error?.message}`);
        assert.equal(forbidden.data?.code, 'FORBIDDEN', `acteur non admin : ${JSON.stringify(forbidden.data)}`);
        const missing = await rpc('partner_status_set', { partner_id: randomUUID(), actor_id: await superadminId(), status: 'VALIDE' });
        assert.equal(missing.data?.code, 'PARTNER_NOT_FOUND', `partenaire inconnu : ${JSON.stringify(missing.data)} ${missing.error?.message ?? ''}`);
        const same = await rpc('partner_status_set', { partner_id: p.partnerId, actor_id: await superadminId(), status: 'VALIDE' });
        assert.equal(same.data?.code, 'TRANSITION_NOT_ALLOWED', `statut inchangé : ${JSON.stringify(same.data)} ${same.error?.message ?? ''}`);
        assert.equal((await partnerRow(p.partnerId)).status, 'VALIDE', 'statut inchangé');
        assert.equal(await userStatus(p.userId), 'ACTIF', 'compte inchangé');
        const rows = await outboxRows({ type: ['PARTNER_VALIDATED', 'PARTNER_SUSPENDED', 'PARTNER_REJECTED', 'PARTNER_REACTIVATED'], userId: p.userId });
        assert.deepEqual(rows.map((r) => r.idempotency_key), [], 'aucune notification pour un refus');
    });

    test('route PATCH /api/admin/partners/[id]/status : passe par partner_status_set (statuts synchronisés), aucun SMS direct', async () => {
        const p = await newProPartner('route');
        const sa = await signInAs('SUPERADMIN');
        const { PATCH } = await importModule('../../app/api/admin/partners/[id]/status/route');
        const mark = smsMark(p.phoneE164);
        const res = await invoke(PATCH as Handler, jsonRequest(`/api/admin/partners/${p.partnerId}/status`, 'PATCH', sa.accessToken, { status: 'SUSPENDU', reason: 'Documents expirés depuis un mois' }), routeCtx({ id: p.partnerId }));
        assert.equal(res.status, 200, `suspension par la route : ${show(res)}`);
        assert.equal((await partnerRow(p.partnerId)).status, 'SUSPENDU', 'partners.status');
        assert.equal(await userStatus(p.userId), 'SUSPENDU', 'users.status');
        assert.equal(smsTo(p.phoneE164, mark).length, 0, 'la route n’envoie aucun SMS : avis dans la boîte d’envoi');
        const group = await singleGroup('PARTNER_SUSPENDED', `PARTNER_SUSPENDED:${p.partnerId}:tx`);
        await groupRows('PARTNER_SUSPENDED', group, ['EMAIL', 'IN_APP', 'SMS'], p.userId);
    });

    // Lot 9 bis (T25, R31 décision « un seul SMS à la validation », G.49) : TRIAL_STARTED en in-app et email, plus de SMS.
    test('période d’essai : TRIAL_STARTED (in-app, email) à la première activation seulement, aucun SMS', async () => {
        const p = await newProPartner('essai');
        const first = await service.rpc('activate_partner_trial', { p_partner_id: p.partnerId });
        assert.equal(first.error, null, `activation : ${first.error?.message}`);
        assert.equal((first.data as Row).is_new_activation, true, `première activation : ${JSON.stringify(first.data)}`);
        const rows = await groupRows('TRIAL_STARTED', `TRIAL_STARTED:${p.partnerId}`, ['EMAIL', 'IN_APP'], p.userId);
        assert.equal((await outboxRows({ type: 'TRIAL_STARTED', userId: p.userId, channel: 'SMS' })).length, 0, 'aucune ligne SMS TRIAL_STARTED (R31, décision)');
        const again = await service.rpc('activate_partner_trial', { p_partner_id: p.partnerId });
        assert.equal(again.error, null, `seconde activation : ${again.error?.message}`);
        assert.equal((again.data as Row).is_new_activation, false, 'seconde activation : idempotente');
        assert.equal((await outboxRows({ type: 'TRIAL_STARTED', userId: p.userId })).length, 2, 'seconde activation : aucune nouvelle ligne');
        const mark = smsMark(p.phoneE164);
        const sent = await deliver(rows, new Date());
        assert.equal(smsTo(p.phoneE164, mark).length, 0, 'aucun SMS à l’activation de l’essai : le seul SMS est celui de la validation');
        await assertInApp(sent, { userId: p.userId, title: "Période d'essai activée", contains: ['60'], actionUrl: '/partner/dashboard' });
    });

    test('abonnement : SUBSCRIPTION_ACTIVATED (in-app) au changement de formule, rien pour un rejeu de la même formule', async () => {
        const p = await newProPartner('abonnement');
        const { data: plans, error } = await service.from('subscription_plans').select('id, name').limit(1);
        assert.equal(error, null, `formules : ${error?.message}`);
        assert.ok((plans ?? []).length > 0, 'au moins une formule (seed.sql)');
        const plan = plans![0];
        const trialEnds = new Date(Date.now() + 30 * 86_400_000).toISOString();
        const { error: upErr } = await service.from('partners').update({ subscription_plan_id: plan.id, trial_ends_at: trialEnds }).eq('id', p.partnerId);
        assert.equal(upErr, null, `abonnement : ${upErr?.message}`);
        const group = await singleGroup('SUBSCRIPTION_ACTIVATED', `SUBSCRIPTION_ACTIVATED:${p.partnerId}:${plan.id}:`);
        const rows = await groupRows('SUBSCRIPTION_ACTIVATED', group, ['IN_APP', 'EMAIL'], p.userId);
        const { error: sameErr } = await service.from('partners').update({ subscription_plan_id: plan.id }).eq('id', p.partnerId);
        assert.equal(sameErr, null, `rejeu : ${sameErr?.message}`);
        assert.equal((await outboxRows({ type: 'SUBSCRIPTION_ACTIVATED', userId: p.userId })).length, 2, 'même formule : aucune nouvelle ligne (IN_APP et EMAIL, G.49)');
        const sent = await deliver(rows, new Date());
        await assertInApp(sent, { userId: p.userId, title: 'Abonnement activé', contains: [String(plan.name)], actionUrl: '/partner/subscription' });
    });
});

// ── 5. Compte suspendu ─────────────────────────────────────────────────────

describe('6.6 — aucun nouvel envoi à un compte suspendu, sauf messages indispensables liés à son argent', () => {
    test('partenaire suspendu : catégorie et événement complets SKIPPED ACCOUNT_SUSPENDED dès l’insertion ; remboursements de l’annulation (ALLOW) envoyés', async () => {
        const p = await newProPartner('compte-suspendu');
        const ev = await proEvent(p, 'Suspendu cpt', 'PUBLIE', [{ name: 'Standard', price: 5_000, total: 5 }]);
        const buyer = await newBuyer('pros-cpt-susp');
        await buyConfirmed(buyer, ev, [['Standard', 1]]);
        await rpcOk('partner_status_set', { partner_id: p.partnerId, actor_id: await superadminId(), status: 'SUSPENDU', reason: 'Contrôle des documents en cours' }, 'suspension');
        assert.equal(await userStatus(p.userId), 'SUSPENDU', 'compte suspendu');

        const cat = ev.categories.Standard.id;
        const { error: qErr } = await service.from('ticket_categories').update({ total_quantity: 1 }).eq('id', cat);
        assert.equal(qErr, null, `baisse du quota : ${qErr?.message}`);
        const blocked = [
            ...await groupRows('CATEGORY_SOLD_OUT', `CATEGORY_SOLD_OUT:${cat}:1`, ALL4, p.userId),
            ...await groupRows('EVENT_SOLD_OUT', `EVENT_SOLD_OUT:${ev.eventId}:1`, ALL4, p.userId),
        ];
        for (const r of blocked) {
            assert.equal(r.status, 'SKIPPED', `${r.idempotency_key} : SKIPPED dès l'insertion (${r.status})`);
            assert.equal(r.reason, 'ACCOUNT_SUSPENDED', `${r.idempotency_key} : motif ACCOUNT_SUSPENDED (${r.reason})`);
        }

        const advanced = await advanceEventTo(ev.eventId, 'ANNULE', { cancelledBy: 'ADMIN', partnerUserId: p.userId });
        const ids = (advanced.steps[advanced.steps.length - 1].result.cashout_ids ?? []) as string[];
        assert.equal(ids.length, 1, `un cashout de remboursement : ${JSON.stringify(advanced.steps[advanced.steps.length - 1].result)}`);
        const { CashoutService } = await importModule('../../lib/payments/cashout.service');
        await CashoutService.sendBatch(ids);
        const done = await groupRows('CANCEL_REFUNDS_DONE', `CANCEL_REFUNDS_DONE:${ev.eventId}`, ['EMAIL', 'IN_APP', 'PUSH'], p.userId);
        assert.ok(done.every((r) => r.status === 'PENDING'), `remboursements terminés (ALLOW) : non bloqués (${JSON.stringify(done.map((r) => [r.channel, r.status, r.reason]))})`);
        const sent = await deliver(done, new Date());
        assert.equal(byChannel(sent, 'IN_APP').status, 'SENT', 'compte suspendu : avis lié à son argent livré');
    });
});
