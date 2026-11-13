/**
 * Lot 9 bis, domaine G (contrat 5.49 à 5.53, 11.2, 11.3 ; décisions B96, B97, B99, B100 ; discovery-9bis-email 4 à 7) —
 * l'email, vrai canal : règle d'envoi, préférences, contenu, supervision et indépendance du SMS.
 *
 * Tâche 49 (G.49, G53-8) :
 *  - structurel : tout type ESSENTIAL non synchrone, hors PUSH_TEST et COUNTER_RECEIPT, déclare EMAIL dans le catalogue
 *    (sans base) et dans le registre public.notification_types (base) ;
 *  - par le vrai émetteur, pour un compte à l'adresse vérifiée : TRANSFER_OFFERED et TRANSFER_CANCELLED (route du
 *    transfert, ticket_transfer_initiate et ticket_transfer_cancel), CONTROLLER_ASSIGNED et CONTROLLER_UNASSIGNED
 *    (trigger de event_controllers), PHONE_CHANGED (account_phone_finalize : seconde mise en file au compte, le SMS à
 *    l'ancien numéro reste sans compte, L30), EVENT_CHANGED (PUT /api/partner/events/[id]), INVITATION_RECEIVED (route
 *    des invitations, compte connu) : une ligne EMAIL réellement créée.
 * Rouge aujourd'hui : 25 types sans EMAIL (registre M/20261103000002:77-147, catalogue) ; les émetteurs filtrent les
 * canaux à la mise en file (M/20261103000005:159-163, :222-226 ; M/20261103000006:559-566, :588-595 ;
 * M/20261108000001:453-454 ; M/20261108000002:478-482) ; PHONE_CHANGED n'est mis en file qu'au numéro. La pose de
 * users.email_verified_at (markEmailVerified, M10) échoue avant M10 en nommant la colonne.
 *
 * Les lignes sont lues par destinataire neuf et par clé, jamais globalement ; les flux qui exigent la confirmation du
 * mot de passe (transfert, R57) l'appellent par confirmPassword (rouge jusqu'à fix(9b.13)).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { OUTBOX_REASON_LABELS, OUTBOX_TYPE_LABELS } from '../../lib/notifications/outbox-labels';
import { getFakes } from '../fakes';
import { inRolledBackTransaction, openConcurrentClient } from '../helpers/db';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { authed, createTimedEvent, newController } from './acces-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';
import { buyConfirmed, jsonRequest as financeRequest, newPartner, type TestPartner } from './finance-helpers';
import { confirmPassword, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import {
    flushNotifications, insertOutboxRow, markEmailVerified, markPhoneVerified, newAdmin, outboxRows, smsTo, type OutboxRow,
} from './notif-helpers';
import { newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

after(async () => {
    await assertLot9bisInvariants('email-regle-envoi');
});

type Row = Record<string, unknown>;

interface CatalogView {
    type: string;
    family: 'ESSENTIAL' | 'OPTIONAL';
    topic: string | null;
    channels: readonly string[];
    syncOnly: boolean;
    sample: Row;
    link: ((d: Row) => string) | null;
    inApp?: (d: Row) => { title: string; content: string };
    email?: (d: Row, ctx: { appUrl: string }) => { subject: string; html: string; text: string };
}

/** Catalogue vu par chaîne de type : les types nouveaux du lot n'existent pas encore dans l'union NotificationType. */
const CATALOG = NOTIFICATION_CATALOG as unknown as Record<string, CatalogView>;
const CATALOG_TYPES = Object.keys(CATALOG).sort();

/**
 * Exclusions de la règle G.49 (contrat 5.49, 11.3) : essai d'un appareil ; reçu au guichet (numéro saisi, aucun compte).
 * Lot 9 quinquies (D1, modification signalée au rapport) : ADMIN_REVIEW_SMS, SMS regroupé qui double les avis
 * ADMIN_PARTNER_REGISTERED, ADMIN_PARTNER_RESUBMITTED et ADMIN_EVENT_SUBMITTED, qui ont déjà leur email.
 */
const G49_EXCLUDED = new Set(['PUSH_TEST', 'COUNTER_RECEIPT', 'ADMIN_REVIEW_SMS']);
const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 3_000, total: 40, maxPerOrder: 10 }];
const TRANSFER_ROUTE = '../../app/api/tickets/[id]/transfer/route';
const TRANSFER_CANCEL_ROUTE = '../../app/api/tickets/transfers/[id]/cancel/route';
const EVENT_ROUTE = '../../app/api/partner/events/[id]/route';
const INVITATIONS_ROUTE = '../../app/api/partner/events/[id]/invitations/route';

interface RegistryRow { type: string; family: string; channels: string[]; sync_only: boolean }

async function registry(): Promise<RegistryRow[]> {
    const { data, error } = await service.from('notification_types').select('type, family, channels, sync_only').order('type');
    assert.equal(error, null, `registre notification_types : ${error?.message}`);
    return (data ?? []) as RegistryRow[];
}

/** Types qui enfreignent G.49 : indispensables, non synchrones, hors exclusions, sans EMAIL. */
function g49Violations(rows: Array<{ type: string; family: string; channels: readonly string[]; syncOnly: boolean }>): string[] {
    return rows.filter((r) => r.family === 'ESSENTIAL' && !r.syncOnly && !G49_EXCLUDED.has(r.type) && !r.channels.includes('EMAIL'))
        .map((r) => `${r.type} [${r.channels.join(', ')}]`);
}

function describeRows(rows: OutboxRow[]): string {
    return JSON.stringify(rows.map((r) => [r.type, r.channel, r.status, r.reason, r.recipient_user_id ? 'compte' : r.recipient_phone ? 'numéro' : '-']));
}

/** Une seule ligne EMAIL au compte, en attente d'envoi (adresse vérifiée : ni SKIPPED ni motif). */
function assertOneEmailRow(rows: OutboxRow[], userId: string, what: string): OutboxRow {
    const email = rows.filter((r) => r.channel === 'EMAIL');
    assert.equal(email.length, 1, `${what} : une ligne EMAIL au compte vérifié (G.49) ; lignes : ${describeRows(rows)}`);
    assert.equal(email[0].recipient_user_id, userId, `${what} : la ligne EMAIL vise le compte`);
    assert.deepEqual([email[0].status, email[0].reason], ['PENDING', null], `${what} : adresse vérifiée, la ligne EMAIL attend l’envoi : ${describeRows(email)}`);
    return email[0];
}

/** Compte neuf, numéro et adresse vérifiés (G.49 : l'email ne part qu'à une adresse vérifiée). */
async function verifiedAccount(label: string): Promise<Buyer> {
    const b = await newBuyer(`regle-${label}`, { firstName: 'Fatou', lastName: 'Verifiee' });
    await markPhoneVerified(b.userId);
    await markEmailVerified(b.userId);
    return b;
}

function shortTitle(prefix: string): string {
    return `${prefix} ${randomBytes(2).toString('hex')}`;
}

// ── Tâche 49 : règle structurelle ──────────────────────────────────────────

describe('9b.49 G.49 — règle structurelle (G53-8)', () => {
    test('catalogue (sans base) : tout type ESSENTIAL non synchrone, hors PUSH_TEST et COUNTER_RECEIPT, déclare EMAIL', () => {
        const views = CATALOG_TYPES.map((t) => ({ type: t, family: CATALOG[t].family, channels: CATALOG[t].channels, syncOnly: CATALOG[t].syncOnly }));
        assert.deepEqual(g49Violations(views), [], 'types indispensables sans EMAIL dans lib/notifications/catalog.ts (G.49, B97)');
    });

    test('catalogue (sans base) : le minimum de la consigne déclare EMAIL (changement, invitation, transfert, compte, remboursement, retrait, contrôleur)', () => {
        const minimum = [
            'EVENT_CHANGED', 'INVITATION_RECEIVED', 'TRANSFER_RECEIVED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_REACTIVATED', 'REFUND_DELAYED',
            'PAYMENT_REFUND_STARTED', 'WITHDRAWAL_PAID', 'CONTROLLER_ASSIGNED', 'CONTROLLER_UNASSIGNED', 'TRANSFER_OFFERED', 'TRANSFER_CANCELLED',
            'PHONE_CHANGED',
        ];
        const missing = minimum.filter((t) => !CATALOG[t] || !CATALOG[t].channels.includes('EMAIL'));
        assert.deepEqual(missing, [], 'minimum de la consigne G.49 sans EMAIL (ou type absent du catalogue)');
    });

    test('registre public.notification_types : même règle, et EMAIL déclaré à l’identique dans le registre et le catalogue', async () => {
        const rows = await registry();
        assert.deepEqual(g49Violations(rows.map((r) => ({ type: r.type, family: r.family, channels: r.channels, syncOnly: r.sync_only }))), [],
            'types indispensables sans EMAIL dans le registre (M03, G.49)');
        const disagree = rows.filter((r) => CATALOG[r.type] && CATALOG[r.type].channels.includes('EMAIL') !== r.channels.includes('EMAIL'))
            .map((r) => `${r.type} : registre [${r.channels.join(', ')}], catalogue [${CATALOG[r.type].channels.join(', ')}]`);
        assert.deepEqual(disagree, [], 'canal EMAIL différent entre le registre et le catalogue');
    });
});

// ── Tâche 49 : lignes EMAIL créées par les vrais émetteurs ─────────────────

describe('9b.49 G.49 — une ligne EMAIL réellement créée pour un compte vérifié (G53-8)', () => {
    let partner: TestPartner;
    let ev: DraftEvent;

    before(async () => {
        partner = await newPartner('regle-envoi');
        ev = await createDraftEvent(partner, 'regle-envoi', CATEGORIES, { title: shortTitle('Regle'), startsInHours: 96 });
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    });

    test('TRANSFER_OFFERED puis TRANSFER_CANCELLED : une ligne EMAIL au destinataire vérifié (compte MATCH), en plus du SMS au numéro', async () => {
        const owner = await newBuyer('regle-exp', { firstName: 'Awa', lastName: 'Expeditrice' });
        const recipient = await verifiedAccount('dest');
        const { tickets } = await buyConfirmed(owner, ev, [['Standard', 1]]);
        const ticketId = String(tickets[0].id);
        await confirmPassword(owner, STRONG_PASSWORD);
        const initiate = await routeHandler(TRANSFER_ROUTE, 'POST', 'POST /api/tickets/[id]/transfer');
        const res = await invoke(initiate, authed(`/api/tickets/${ticketId}/transfer`, 'POST', owner, { recipient: recipient.phoneE164 }), routeContext({ id: ticketId }));
        assert.equal(res.status, 200, `transfert : ${show(res)}`);
        const transferId = String((res.body.transfer as Row | undefined)?.transfer_id ?? '');
        assert.match(transferId, /^[0-9a-f-]{36}$/, `identifiant du transfert : ${show(res)}`);
        const forRecipient = (r: OutboxRow): boolean => r.recipient_phone === recipient.phoneE164 || r.recipient_user_id === recipient.userId;
        const offered = (await outboxRows({ type: 'TRANSFER_OFFERED', eventId: ev.eventId })).filter(forRecipient);
        assert.ok(offered.some((r) => r.channel === 'SMS' && r.recipient_phone === recipient.phoneE164), `SMS au numéro gardé : ${describeRows(offered)}`);
        assertOneEmailRow(offered.filter((r) => r.recipient_user_id === recipient.userId), recipient.userId, 'TRANSFER_OFFERED');

        const cancel = await routeHandler(TRANSFER_CANCEL_ROUTE, 'POST', 'POST /api/tickets/transfers/[id]/cancel');
        const c = await invoke(cancel, authed(`/api/tickets/transfers/${transferId}/cancel`, 'POST', owner, {}), routeContext({ id: transferId }));
        assert.equal(c.status, 200, `annulation du transfert : ${show(c)}`);
        const cancelled = (await outboxRows({ type: 'TRANSFER_CANCELLED', eventId: ev.eventId })).filter(forRecipient);
        assertOneEmailRow(cancelled.filter((r) => r.recipient_user_id === recipient.userId), recipient.userId, 'TRANSFER_CANCELLED');
    });

    test('CONTROLLER_ASSIGNED puis CONTROLLER_UNASSIGNED (trigger de event_controllers) : une ligne EMAIL au contrôleur vérifié', async () => {
        const ctrl = await newController(partner, null, { label: 'regle-email' });
        await markEmailVerified(ctrl.userId);
        const { data, error } = await service.from('event_controllers')
            .insert({ event_id: ev.eventId, user_id: ctrl.userId, can_accept_cash: false, created_by: partner.userId }).select('id').single();
        assert.equal(error, null, `affectation : ${error?.message}`);
        assertOneEmailRow(await outboxRows({ type: 'CONTROLLER_ASSIGNED', userId: ctrl.userId }), ctrl.userId, 'CONTROLLER_ASSIGNED');
        const { error: delErr } = await service.from('event_controllers').delete().eq('id', String(data.id));
        assert.equal(delErr, null, `retrait de l’affectation : ${delErr?.message}`);
        assertOneEmailRow(await outboxRows({ type: 'CONTROLLER_UNASSIGNED', userId: ctrl.userId }), ctrl.userId, 'CONTROLLER_UNASSIGNED');
    });

    test('PHONE_CHANGED (account_phone_finalize) : une ligne EMAIL au compte vérifié ; le SMS à l’ancien numéro reste sans compte (L30)', async () => {
        const a = await verifiedAccount('numero');
        const newPhone = randomSenegalPhone('78');
        const claims = JSON.parse(Buffer.from(a.accessToken.split('.')[1], 'base64url').toString('utf8')) as { session_id?: string };
        assert.ok(claims.session_id, 'session_id du jeton d’accès');
        // Ordre de la route (AR2) : l'API d'authentification d'abord, puis la RPC de finalisation.
        const { error: authErr } = await service.auth.admin.updateUserById(a.userId, { phone: newPhone, phone_confirm: true });
        assert.equal(authErr, null, `numéro d’authentification : ${authErr?.message}`);
        const { data, error } = await service.rpc('account_phone_finalize', {
            p: { user_id: a.userId, new_phone: newPhone, expected_phone: a.phoneE164, keep_session_id: claims.session_id },
        });
        assert.equal(error, null, `account_phone_finalize : ${error?.message}`);
        assert.equal((data as Row | null)?.ok, true, `account_phone_finalize : ${JSON.stringify(data)}`);
        const rows = await outboxRows({ type: 'PHONE_CHANGED', keyPrefix: `PHONE_CHANGED:${a.userId}:` });
        const sms = rows.filter((r) => r.channel === 'SMS');
        assert.deepEqual(sms.map((r) => [r.recipient_phone, r.recipient_user_id]), [[a.phoneE164, null]], `SMS à l’ancien numéro, sans compte (L30) : ${describeRows(rows)}`);
        assertOneEmailRow(rows, a.userId, 'PHONE_CHANGED');
    });

    test('EVENT_CHANGED (PUT /api/partner/events/[id], nouveau lieu) : une ligne EMAIL au détenteur vérifié', async () => {
        const changed = await createDraftEvent(partner, 'regle-changement', CATEGORIES, { title: shortTitle('Chg'), startsInHours: 96 });
        await advanceEventTo(changed.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        const holder = await verifiedAccount('detenteur');
        await buyConfirmed(holder, changed, [['Standard', 1]]);
        const { data: row, error } = await service.from('events').select('updated_at').eq('id', changed.eventId).single();
        assert.equal(error, null, `événement : ${error?.message}`);
        const put = await routeHandler(EVENT_ROUTE, 'PUT', 'PUT /api/partner/events/[id]');
        const res = await invoke(put, financeRequest(`/api/partner/events/${changed.eventId}`, 'PUT', partner.accessToken,
            { patch: { location: `Salle ${randomBytes(3).toString('hex')}` }, expected_updated_at: String(row.updated_at) }), routeContext({ id: changed.eventId }));
        assert.equal(res.status, 200, `changement de lieu : ${show(res)}`);
        assertOneEmailRow(await outboxRows({ type: 'EVENT_CHANGED', eventId: changed.eventId, userId: holder.userId }), holder.userId, 'EVENT_CHANGED');
    });

    test('INVITATION_RECEIVED (route des invitations, numéro d’un compte connu) : une ligne EMAIL au compte vérifié, en plus du SMS au numéro', async () => {
        const invited = await createTimedEvent(partner.partnerId, 'regle-invitation', CATEGORIES, { startsInHours: 48 });
        const account = await verifiedAccount('invite');
        const post = await routeHandler(INVITATIONS_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations');
        const res = await invoke(post, authed(`/api/partner/events/${invited.eventId}/invitations`, 'POST', partner,
            { category_id: invited.categories.Standard.id, phones: [account.phoneE164], quantity: 1 }), routeContext({ id: invited.eventId }));
        assert.equal(res.status, 200, `invitation : ${show(res)}`);
        const rows = await outboxRows({ type: 'INVITATION_RECEIVED', eventId: invited.eventId });
        assert.ok(rows.some((r) => r.channel === 'SMS' && r.recipient_phone === account.phoneE164 && r.recipient_user_id === null), `SMS au numéro gardé (AR15) : ${describeRows(rows)}`);
        assertOneEmailRow(rows.filter((r) => r.recipient_user_id === account.userId), account.userId, 'INVITATION_RECEIVED');
    });
});

// ── Tâche 50 : préférences (G.50, G53-9) ───────────────────────────────────

const PREFERENCES_ROUTE = '../../app/api/notifications/preferences/route';
/** Optionnels qui ont le push et reçoivent EMAIL (contrat 5.50, 11.2 « + EMAIL seul », décision D-E2). */
const OPTIONAL_WITH_EMAIL = ['EVENT_SUSPENDED_HOLDER', 'EVENT_REACTIVATED_HOLDER', 'REMINDER_H3', 'CONTROLLER_REMINDER'];

/** Préférence posée par la route, comme l'écran (200 exigé). */
async function setPreference(user: Buyer, topic: string, channel: string, enabled: boolean): Promise<void> {
    const put = await routeHandler(PREFERENCES_ROUTE, 'PUT', 'PUT /api/notifications/preferences');
    const res = await invoke(put, authed('/api/notifications/preferences', 'PUT', user, { topic, channel, enabled }));
    assert.equal(res.status, 200, `préférence ${topic}/${channel} = ${enabled} : ${show(res)}`);
}

/** notif_enqueue dans une transaction annulée (rien ne reste en base) ; lignes du groupe par canal. */
async function enqueueRolledBack(type: string, userId: string): Promise<Partial<Record<string, OutboxRow>>> {
    const key = `${type}:${randomUUID()}`;
    return inRolledBackTransaction(async (db) => {
        await db.query('SELECT public.notif_enqueue($1::jsonb)', [JSON.stringify({ type, key, user_id: userId, data: catalogSample(type) })]);
        const rows = (await db.query<OutboxRow>('SELECT * FROM public.notification_outbox WHERE group_key = $1', [key])).rows;
        return Object.fromEntries(rows.map((r) => [r.channel, r]));
    });
}

function catalogSample(type: string): Row {
    assert.ok(CATALOG[type]?.sample, `${type} absent du catalogue`);
    return { ...CATALOG[type].sample };
}

function state(r: OutboxRow | undefined): [string | null, string | null] | 'absente' {
    return r ? [r.status, r.reason] : 'absente';
}

/** Source du fichier et de ses imports directs « @/components/… » et « @/lib/… », espaces et apostrophes normalisées. */
function screenSource(rel: string, why: string): string {
    const norm = (s: string): string => s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'').replace(/\s+/g, ' ');
    const abs = path.resolve(process.cwd(), rel);
    assert.ok(fs.existsSync(abs), `${rel} absent (${why})`);
    const src = fs.readFileSync(abs, 'utf8');
    const parts = [src];
    for (const m of Array.from(src.matchAll(/from\s+['"]@\/((?:components|lib)\/[^'"]+)['"]/g))) {
        const file = [`${m[1]}.tsx`, `${m[1]}.ts`, `${m[1]}/index.tsx`, `${m[1]}/index.ts`].find((f) => fs.existsSync(path.resolve(process.cwd(), f)));
        if (file) parts.push(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
    }
    return norm(parts.join('\n'));
}

describe('9b.50 G.50 — préférences : l’email se règle comme le push, les indispensables ne se coupent pas (G53-9)', () => {
    test('catalogue (sans base) : tout type optionnel qui a le push déclare EMAIL, dont les quatre types de la consigne', () => {
        const withoutEmail = CATALOG_TYPES.filter((t) => CATALOG[t].family === 'OPTIONAL' && CATALOG[t].channels.includes('PUSH') && !CATALOG[t].channels.includes('EMAIL'));
        assert.deepEqual(withoutEmail, [], 'optionnels avec push sans EMAIL (G.50 : « comme le push »)');
        assert.deepEqual(OPTIONAL_WITH_EMAIL.filter((t) => !CATALOG[t]?.channels.includes('EMAIL')), [], 'EVENT_*_HOLDER, REMINDER_H3, CONTROLLER_REMINDER sans EMAIL');
    });

    test('registre : tout type optionnel qui a le push déclare EMAIL', async () => {
        const rows = await registry();
        const withoutEmail = rows.filter((r) => r.family === 'OPTIONAL' && r.channels.includes('PUSH') && !r.channels.includes('EMAIL')).map((r) => r.type);
        assert.deepEqual(withoutEmail, [], 'optionnels avec push sans EMAIL dans le registre (M03)');
    });

    test('garde (vert sur le fond, M10 pour la pose de l’adresse vérifiée) : REMINDERS/EMAIL coupé par la route → REMINDER_J1 EMAIL SKIPPED PREFERENCE_DISABLED, SMS en attente', async () => {
        const a = await verifiedAccount('pref-rappel');
        await setPreference(a, 'REMINDERS', 'EMAIL', false);
        const rows = await enqueueRolledBack('REMINDER_J1', a.userId);
        assert.deepEqual(state(rows.EMAIL), ['SKIPPED', 'PREFERENCE_DISABLED'], 'email du rappel coupé par la préférence');
        assert.deepEqual(state(rows.SMS), ['PENDING', null], 'le SMS du rappel n’est pas touché');
    });

    test('EVENT_SUSPENDED_HOLDER : EVENT_UPDATES/EMAIL coupé → EMAIL SKIPPED PREFERENCE_DISABLED ; préférence ouverte → EMAIL en attente', async () => {
        const off = await verifiedAccount('pref-off');
        await setPreference(off, 'EVENT_UPDATES', 'EMAIL', false);
        assert.deepEqual(state((await enqueueRolledBack('EVENT_SUSPENDED_HOLDER', off.userId)).EMAIL), ['SKIPPED', 'PREFERENCE_DISABLED'],
            'préférence coupée : ligne EMAIL SKIPPED (aujourd’hui aucune ligne EMAIL, type sans EMAIL)');
        const on = await verifiedAccount('pref-on');
        assert.deepEqual(state((await enqueueRolledBack('EVENT_SUSPENDED_HOLDER', on.userId)).EMAIL), ['PENDING', null], 'préférence ouverte : email en attente');
    });

    test('indispensables : emails optionnels coupés, PURCHASE_CONFIRMED et EVENT_CHANGED partent quand même par email', async () => {
        const a = await verifiedAccount('pref-indisp');
        await setPreference(a, 'REMINDERS', 'EMAIL', false);
        await setPreference(a, 'EVENT_UPDATES', 'EMAIL', false);
        const purchase = await enqueueRolledBack('PURCHASE_CONFIRMED', a.userId);
        assert.deepEqual(state(purchase.EMAIL), ['PENDING', null], 'confirmation d’achat : email indispensable, aucune préférence ne le coupe');
        const changed = await enqueueRolledBack('EVENT_CHANGED', a.userId);
        assert.deepEqual(state(changed.EMAIL), ['PENDING', null], 'changement de date ou de lieu : indispensable (R14) et par email (G.49), malgré EVENT_UPDATES/EMAIL coupé');
        assert.equal(changed.EMAIL?.family, 'ESSENTIAL', 'famille ESSENTIAL copiée du registre');
    });

    test('page des préférences (statique, E-D) : aide d’un compte sans adresse vérifiée', () => {
        const src = screenSource('app/profile/notifications/page.tsx', 'page des préférences, contrat 5.50');
        assert.ok(src.includes('Ajoutez et vérifiez une adresse email dans votre profil pour recevoir ces emails.'),
            'aide « Ajoutez et vérifiez une adresse email dans votre profil pour recevoir ces emails. » absente (interrupteur Email désactivé)');
    });
});

// ── Tâche 51 : contenu des emails (G.51, sans base) ────────────────────────

const RENDER_APP = 'https://eventvillage.sn';
/** Aucun lien de réclamation ni de connexion automatique dans un email (11.3, notif-modeles.test.ts:641-660). */
const FORBIDDEN_LINK = /claim|token|access_token|magic/i;

function plain(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'');
}

/** Défauts G.51 d'un rendu email : fond in-app, bouton interne, aucune image ni lien externe, de connexion ou de réclamation. */
function emailFaults(type: string): string[] {
    const tpl = CATALOG[type];
    if (!tpl.inApp || !tpl.link || !tpl.email) return [`${type} : contenu in-app, lien ou rendu email absent`];
    const faults: string[] = [];
    const mail = tpl.email(tpl.sample, { appUrl: RENDER_APP });
    const content = tpl.inApp(tpl.sample).content;
    const link = tpl.link(tpl.sample);
    if (!link.startsWith('/') || link.startsWith('//')) faults.push(`${type} : lien hors de l’application « ${link} »`);
    if (!mail.text.includes(content)) faults.push(`${type} : le corps ne reprend pas le contenu in-app « ${content} »`);
    if (!mail.text.includes(`${RENDER_APP}${link}`)) faults.push(`${type} : aucun bouton vers ${link}`);
    if (/<img|data:image/i.test(mail.html)) faults.push(`${type} : image ou QR dans l’email`);
    for (const m of Array.from(mail.html.matchAll(/href="([^"]+)"/g))) {
        const href = m[1].replace(/&amp;/g, '&');
        if (!href.startsWith(`${RENDER_APP}/`) && !href.startsWith('mailto:')) faults.push(`${type} : lien externe ${href}`);
        if (FORBIDDEN_LINK.test(href)) faults.push(`${type} : lien de connexion ou de réclamation ${href}`);
    }
    return faults;
}

describe('9b.51 G.51 — contenu des emails (rendu du catalogue, sans base)', () => {
    test('garde : chaque type EMAIL non synchrone a le fond de l’in-app, un bouton vers son chemin interne, aucune image ni QR, aucun lien claim, token, access_token ni magic', () => {
        const types = CATALOG_TYPES.filter((t) => CATALOG[t].channels.includes('EMAIL') && !CATALOG[t].syncOnly);
        assert.ok(types.length >= 29, `au moins les 29 types email d’avant le lot (11.3) : ${types.length}`);
        assert.deepEqual(types.flatMap(emailFaults), [], 'rendus email hors de la règle G.51');
    });

    test('garde : la confirmation d’achat garde les numéros des billets et la phrase du QR qui change (catalog.ts:449-454)', () => {
        const tpl = CATALOG.PURCHASE_CONFIRMED;
        const mail = tpl.email!(tpl.sample, { appUrl: RENDER_APP });
        const numbers = tpl.sample.ticket_numbers as string[];
        assert.ok(Array.isArray(numbers) && numbers.length > 0, 'exemple du catalogue avec des numéros de billets');
        for (const n of numbers) assert.ok(mail.text.includes(n), `numéro ${n} absent de la confirmation d’achat`);
        assert.ok(plain(mail.text).includes('Son QR code change toutes les 20 secondes'), 'phrase du QR qui change absente');
    });

    test('INVITATION_RECEIVED (11.2 M3) : email au compte, fond « N invitations pour « titre » le date : vos billets sont dans Mes billets. », bouton vers /tickets?tab=recus', () => {
        const tpl = CATALOG.INVITATION_RECEIVED;
        assert.ok(tpl.channels.includes('EMAIL') && tpl.inApp && tpl.link, `INVITATION_RECEIVED : EMAIL, contenu in-app et lien attendus (aujourd’hui SMS seul, catalog.ts:565) [${tpl.channels.join(', ')}]`);
        assert.equal(tpl.link!(tpl.sample), '/tickets?tab=recus', 'bouton vers Mes billets, onglet Reçus');
        assert.match(plain(tpl.inApp!(tpl.sample).content), /^\d+ invitations? pour « .+ » le .+ : vos billets sont dans Mes billets\.$/, 'fond de l’email');
        assert.deepEqual(emailFaults('INVITATION_RECEIVED'), []);
    });

    test('PHONE_CHANGED (11.2 M22) : email au compte, « Numéro de téléphone modifié », fond du SMS, bouton vers /profile', () => {
        const tpl = CATALOG.PHONE_CHANGED;
        assert.ok(tpl.channels.includes('EMAIL') && tpl.inApp && tpl.link, `PHONE_CHANGED : EMAIL, contenu in-app et lien attendus (aujourd’hui SMS seul, catalog.ts:728-732) [${tpl.channels.join(', ')}]`);
        assert.equal(tpl.link!(tpl.sample), '/profile', 'bouton vers le profil');
        const body = tpl.inApp!(tpl.sample);
        assert.deepEqual([plain(body.title), plain(body.content)],
            ['Numéro de téléphone modifié', 'Le numéro de téléphone de votre compte a été modifié. Si ce n\'est pas vous, ouvrez la page Aide pour joindre le support.'] /* lot 9 quinquies (B1) */, 'titre et fond de l’email');
        assert.equal(plain(tpl.email!(tpl.sample, { appUrl: RENDER_APP }).subject), 'Numéro de téléphone modifié — Event Village', 'sujet');
        assert.deepEqual(emailFaults('PHONE_CHANGED'), []);
    });
});

// ── Tâche 52 : supervision et indépendance du SMS (G.52, B99) ──────────────

const RESEND_ROUTE = '../../app/api/account/email/resend/route';
const ADMIN_NOTIFICATIONS_ROUTE = '../../app/api/admin/notifications/route';
/** Délai d'un email lent : assez long pour que l'ordre « SMS avant le premier email fini » soit sans ambiguïté. */
const SLOW_EMAIL_MS = 1500;

/** Ligne due tout de suite (une seconde dans le passé), écrite par le service_role comme une mise en file. */
async function dueRow(row: Row): Promise<OutboxRow> {
    const due = new Date(Date.now() - 1000).toISOString();
    return insertOutboxRow({ type: 'PURCHASE_CONFIRMED', template_data: catalogSample('PURCHASE_CONFIRMED'), due_at: due, next_attempt_at: due, ...row });
}

describe('9b.52 G.52 — un email lent ou refusé ne retarde ni ne bloque le SMS ; supervision des emails', () => {
    test('10 lignes EMAIL lentes et 1 SMS dans le même lot : le SMS est remis avant la fin du premier email (un groupe d’envoi par canal, B99)', async () => {
        const buyer = await verifiedAccount('lent');
        const phone = randomSenegalPhone('76');
        const emails: OutboxRow[] = [];
        for (let i = 0; i < 10; i++) emails.push(await dueRow({ channel: 'EMAIL', recipient_user_id: buyer.userId }));
        const sms = await dueRow({ channel: 'SMS', recipient_phone: phone });
        const fake = getFakes().email;
        const since = fake.messagesTo(buyer.email).length;
        fake.delayNext(SLOW_EMAIL_MS, 10);
        try {
            await flushNotifications({ ids: [...emails.map((r) => r.id), sms.id] });
        } finally {
            const left = fake.clearQueued();
            assert.deepEqual(left, { failures: 0, delays: 0 }, 'les dix emails ont été tentés (délais consommés)');
        }
        const rows = await outboxRows({ ids: [...emails.map((r) => r.id), sms.id] });
        assert.deepEqual(rows.map((r) => r.status).sort(), Array(11).fill('SENT'), `toutes les lignes SENT : ${JSON.stringify(rows.map((r) => [r.channel, r.status, r.reason]))}`);
        const delivered = smsTo(phone);
        assert.equal(delivered.length, 1, 'un SMS remis');
        const mails = fake.messagesTo(buyer.email).slice(since);
        assert.equal(mails.length, 10, 'dix emails envoyés');
        const firstEmailDone = Math.min(...mails.map((m) => Date.parse(m.finishedAt)));
        assert.ok(Date.parse(delivered[0].at) < firstEmailDone,
            `SMS remis à ${delivered[0].at}, après la fin du premier email (${new Date(firstEmailDone).toISOString()}) : `
            + 'les emails passent avant les SMS et partagent les 5 places (dispatcher.ts:503-513, M/20261105000002:202)');
    });

    test('garde (vert sur le fond, M10 pour la pose de l’adresse vérifiée) : email refusé (failNext) → EMAIL FAILED EMAIL_REJECTED, le SMS du même lot SENT', async () => {
        const buyer = await verifiedAccount('refus');
        const phone = randomSenegalPhone('76');
        const email = await dueRow({ channel: 'EMAIL', recipient_user_id: buyer.userId });
        const sms = await dueRow({ channel: 'SMS', recipient_phone: phone });
        const fake = getFakes().email;
        fake.failNext('Adresse refusée par le fournisseur (simulation)');
        try {
            await flushNotifications({ ids: [email.id, sms.id] });
        } finally {
            assert.deepEqual(fake.clearQueued(), { failures: 0, delays: 0 }, 'l’email a été tenté (refus consommé)');
        }
        const [e] = await outboxRows({ ids: [email.id] });
        const [s] = await outboxRows({ ids: [sms.id] });
        assert.deepEqual([e.status, e.reason], ['FAILED', 'EMAIL_REJECTED'], 'email refusé');
        assert.deepEqual([s.status, s.reason], ['SENT', null], 'SMS envoyé malgré l’email refusé');
        assert.equal(smsTo(phone).length, 1, 'un SMS remis');
    });

    test('supervision (sans base) : motif EMAIL_NOT_VERIFIED « Adresse email non vérifiée » ; EMAIL_VERIFICATION a un libellé humain', () => {
        assert.equal(OUTBOX_REASON_LABELS.EMAIL_NOT_VERIFIED, 'Adresse email non vérifiée', 'libellé du motif (11.2, G.52)');
        const label = OUTBOX_TYPE_LABELS.EMAIL_VERIFICATION;
        assert.ok(typeof label === 'string' && label.trim() !== '' && !/[A-Z]{2,}_[A-Z]/.test(label),
            `libellé humain du type EMAIL_VERIFICATION attendu (11.2 : OUTBOX_TYPE_LABELS de chacun des 26 types) : ${String(label)}`);
    });

    test('journal EMAIL_VERIFICATION (SYNC_LOG, sans jeton) visible dans la supervision avec l’adresse masquée', async () => {
        const a = await newBuyer('regle-journal'); // adresse réelle non vérifiée d'avant le lot (B98) : cible du renvoi
        const resend = await routeHandler(RESEND_ROUTE, 'POST', 'POST /api/account/email/resend (contrat 4.6)');
        const r = await invoke(resend, authed('/api/account/email/resend', 'POST', a, {}));
        assert.equal(r.status, 200, `renvoi du lien : ${show(r)}`);
        const journal = await outboxRows({ type: 'EMAIL_VERIFICATION', userId: a.userId });
        assert.equal(journal.length, 1, `une ligne de journal par lien envoyé : ${describeRows(journal)}`);
        const j = journal[0];
        assert.deepEqual([j.origin, j.channel, j.status, j.reason, (j.recipient_email ?? '').toLowerCase()], ['SYNC_LOG', 'EMAIL', 'SENT', null, a.email.toLowerCase()]);
        assert.deepEqual(j.template_data, { purpose: 'EMAIL_VERIFY' }, 'données du journal : l’objet seul, jamais le jeton');
        const admin = await newAdmin('regle-journal', ['notifications.read']);
        const list = await routeHandler(ADMIN_NOTIFICATIONS_ROUTE, 'GET', 'GET /api/admin/notifications');
        const res = await invoke(list, authed('/api/admin/notifications?type=EMAIL_VERIFICATION&channel=EMAIL&pageSize=50', 'GET', admin));
        assert.equal(res.status, 200, `supervision : ${show(res)}`);
        const item = ((res.body.items ?? []) as Row[]).find((i) => i.id === j.id);
        assert.ok(item, `ligne du journal absente de la supervision : ${show(res)}`);
        const masked = String(item.recipient_masked);
        assert.equal(masked.toLowerCase().includes(a.email.toLowerCase()), false, `adresse en clair dans la supervision : ${masked}`);
        assert.match(masked, /^.{1,2}\*\*\*@test\.eventvillage\.local$/, `adresse masquée (règle de la supervision) : ${masked}`);
        assert.deepEqual([item.type, item.status], ['EMAIL_VERIFICATION', 'SENT']);
    });
});

// ── Tâche 53 : aucun envoi vers une adresse non vérifiée (G53-5) ; invariants w12 et w13 ligne à ligne (G53-13) ──

/** notif_enqueue validé (COMMIT), comme une RPC appelée par l'application ; lignes du groupe. */
async function enqueueCommitted(type: string, userId: string): Promise<OutboxRow[]> {
    const key = `${type}:${randomUUID()}`;
    const db = await openConcurrentClient({ applicationName: 'ev-test-email-regle' });
    try {
        await db.query('SELECT public.notif_enqueue($1::jsonb)', [JSON.stringify({ type, key, user_id: userId, data: catalogSample(type) })]);
        await db.commit();
    } finally {
        await db.close();
    }
    return outboxRows({ keyPrefix: `${key}:` });
}

function emailRowOf(rows: OutboxRow[], what: string): OutboxRow {
    const email = rows.filter((r) => r.channel === 'EMAIL');
    assert.equal(email.length, 1, `${what} : une ligne EMAIL (canal du registre) : ${describeRows(rows)}`);
    return email[0];
}

describe('9b.53 G53-5, G53-13 — aucun email vers une adresse non vérifiée, à la mise en file comme à la réservation', () => {
    test('G53-5 adresse réelle non vérifiée : PURCHASE_CONFIRMED → EMAIL SKIPPED EMAIL_NOT_VERIFIED dès la mise en file, aucun email', async () => {
        const a = await newBuyer('g53-5-nv'); // adresse réelle d'avant le lot, jamais vérifiée (B98)
        const since = getFakes().email.messagesTo(a.email).length;
        const email = emailRowOf(await enqueueCommitted('PURCHASE_CONFIRMED', a.userId), 'mise en file');
        assert.deepEqual(state(email), ['SKIPPED', 'EMAIL_NOT_VERIFIED'], 'adresse non vérifiée : rien à envoyer (aujourd’hui PENDING, M/20261103000002:563-565)');
        await flushNotifications({ ids: [email.id] });
        assert.equal(getFakes().email.messagesTo(a.email).length, since, 'aucun email vers une adresse non vérifiée');
    });

    test('G53-5 adresse dévérifiée entre la mise en file et la réservation : EMAIL SKIPPED EMAIL_NOT_VERIFIED à la réservation, decision.email.verified faux, aucun email', async () => {
        const a = await verifiedAccount('g53-5-dev');
        const email = emailRowOf(await enqueueCommitted('PURCHASE_CONFIRMED', a.userId), 'mise en file');
        assert.deepEqual(state(email), ['PENDING', null], 'adresse vérifiée à la mise en file : la ligne attend');
        const { error } = await service.from('users').update({ email_verified_at: null }).eq('id', a.userId);
        assert.equal(error, null, `adresse dévérifiée : ${error?.message}`);
        const since = getFakes().email.messagesTo(a.email).length;
        await flushNotifications({ ids: [email.id] });
        const [row] = await outboxRows({ ids: [email.id] });
        assert.deepEqual(state(row), ['SKIPPED', 'EMAIL_NOT_VERIFIED'], 'l’état à la réservation compte (M/20261105000002:334-337)');
        assert.equal((row.decision?.email as Row | undefined)?.verified, false, `decision.email.verified : ${JSON.stringify(row.decision)}`);
        assert.equal(getFakes().email.messagesTo(a.email).length, since, 'aucun email');
    });

    test('G53-13 témoin positif (w12, w13) : adresse vérifiée → EMAIL SENT, decision.email.verified vrai, un email à l’adresse vérifiée', async () => {
        const a = await verifiedAccount('g53-13');
        const since = getFakes().email.messagesTo(a.email).length;
        const email = emailRowOf(await enqueueCommitted('PURCHASE_CONFIRMED', a.userId), 'mise en file');
        await flushNotifications({ ids: [email.id] });
        const [row] = await outboxRows({ ids: [email.id] });
        assert.deepEqual(state(row), ['SENT', null], 'email envoyé à l’adresse vérifiée');
        assert.equal((row.decision?.email as Row | undefined)?.verified, true, `w12 : decision.email.verified vrai sur une ligne EMAIL SENT : ${JSON.stringify(row.decision)}`);
        assert.ok(!/@([a-z0-9-]+\.)*eventvillage\.sn$/i.test(row.recipient_email ?? a.email), 'w13 : jamais une adresse technique');
        assert.equal(getFakes().email.messagesTo(a.email).length - since, 1, 'un email');
    });
});
