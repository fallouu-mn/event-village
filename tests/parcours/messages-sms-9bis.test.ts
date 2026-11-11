/**
 * Lot 9 bis, tâche 38 (R29, R31, R27 ; contrat 5.38, B80 à B82, 11.2 M5 à M7, 12.1) — SMS évités, alerte de volume,
 * caractères hors alphabet :
 *  R29 1. activation d'un compte contrôleur par la route (POST /api/controller/setup, code reçu par SMS) → aucune
 *         ligne PASSWORD_CHANGED pour ce compte ; témoin dans le même cas : une réinitialisation ultérieure du mot de
 *         passe en crée ;
 *      2. activate_partner_trial → aucune ligne SMS TRIAL_STARTED (un seul SMS à la validation d'une partenaire) ;
 *  R31 3. finance_setting_set de notif.sms_essential_daily_alert (SUPERADMIN) appliqué ;
 *      4. seuil 1 et un SMS indispensable SENT du jour → une alerte ADMIN_SMS_DAILY_THRESHOLD au premier passage de
 *         l'envoyeur (notification_daily_checks), aucune de plus au second ;
 *  R27 5. titre « Soirée 🎉 Teranga … » : le SMS d'annulation remis est en GSM-7, un segment, sans émoji (texte exact) ;
 *      6. smsVar : émoji retiré, espaces repliés, « ŋ » → « n » (SMS seulement).
 *
 * Rouge avant correctif : le trigger met PASSWORD_CHANGED en file à toute pose de mot de passe
 * (M/20261103000006:934-940, trois lignes) ; TRIAL_STARTED déclare le SMS (M/20261103000006:899-905) ; la clé
 * notif.sms_essential_daily_alert n'existe pas (UNKNOWN_KEY) et l'alerte n'a plus d'émetteur depuis le lot 7 ; smsVar
 * garde tout caractère non translittérable (lib/notifications/sms-format.ts:88-92, :131) : SMS UCS-2 de 3 segments.
 * after() : la garde de schéma du lot 9 bis nomme les objets absents jusqu'à M12 (attendu).
 *
 * Lot 9 bis, tâche 39 (R28 ; contrat 5.39, B83, 11.2) — décision de coût gardée (le SMS de 3 heures reste remplacé par
 * le push), seul le libellé de supervision change : OUTBOX_REASON_LABELS.PUSH_DELIVERED = « Push accepté par le
 * service, SMS non envoyé (affichage non garanti) », sans « remise » ; détail de la page admin « SMS seulement si le
 * push n’est pas accepté par le service push ». Statique, sans base. Rouge : « Notification push déjà remise »
 * (lib/notifications/outbox-labels.ts:53) et « … sans notification push remise » (app/admin/notifications/[id]/page.tsx:92).
 *
 * Lot 9 bis, tâche 40 (ex-10.0 d ; contrat 5.40, B84, 4.3) — une invitation échue ne parle plus de 48 h : l'invité
 * (compte au numéro non vérifié à l'envoi, donc invitation PENDING) vérifie son numéro, l'échéance est passée, son
 * acceptation (POST /api/tickets/transfers/[id]/claim) répond 410 TRANSFER_EXPIRED avec « Ce billet ne peut plus être
 * accepté : le délai est dépassé. ». Rouge : « Ce transfert a expiré (délai de 48 h dépassé). »
 * (lib/tickets/ticket-transfer.service.ts:140).
 * Envois comptés par numéro neuf et par texte exact, jamais globalement.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { getFakes } from '../fakes';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { smsDateTime, smsSegments, smsVar } from '../../lib/notifications/sms-format';
import { BASE_URL, randomSenegalPhone, routeContext } from './helpers';
import { importModule, newBuyer, service, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { authed, type RouteResult } from './acces-helpers';
import { advanceEventTo, assertRpcOk, createDraftEvent, rpcCancel, type DraftEvent } from './cycle-helpers';
import { flushNotifications, getNotifSetting, markPhoneVerified, outboxRows, setNotifSetting, smsMark, smsTo, withNotifSettings } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 3_000, total: 40, maxPerOrder: 10 }];
const ESSENTIAL_ALERT_KEY = 'notif.sms_essential_daily_alert';
const EMOJI_RE = new RegExp('\\p{Extended_Pictographic}', 'u');

after(async () => {
    await assertLot9bisInvariants('messages-sms-9bis');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

let partnerCache: TestPartner | null = null;
async function suitePartner(): Promise<TestPartner> {
    partnerCache ??= await newPartner('msg-sms');
    return partnerCache;
}

async function publishedEvent(label: string, title: string, startsInHours = 96): Promise<DraftEvent> {
    const partner = await suitePartner();
    const ev = await createDraftEvent(partner, `msg-sms ${label}`, CATEGORIES, { title, startsInHours });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

let ipSeq = 0;
function freshIp(): string {
    ipSeq += 1;
    return `198.18.${(process.pid % 200) + 1}.${(ipSeq % 250) + 1}`;
}

/** Codes à 6 chiffres reçus par `phone` (faux MTarget) depuis le repère `since`. */
function codesSince(phone: string, since: number): string[] {
    return getFakes().sms.messagesTo(phone).slice(since)
        .map((m) => m.message.match(/\b(\d{6})\b/)?.[1])
        .filter((c): c is string => Boolean(c));
}

async function routePost(modPath: string, req: NextRequest): Promise<RouteResult> {
    const { POST } = (await importModule(modPath)) as { POST: Handler };
    return invoke(POST, req);
}

// ── R29 : SMS évités ───────────────────────────────────────────────────────

describe('9b.38 R29 : plus d\'alerte de mot de passe à l\'activation d\'un contrôleur, un seul SMS à la validation d\'une partenaire', () => {
    test('activation d\'un compte contrôleur par la route : aucune ligne PASSWORD_CHANGED ; une réinitialisation ultérieure en crée', async () => {
        const partner = await suitePartner();
        const ev = await publishedEvent('Activation', `Activation ${randomBytes(2).toString('hex')}`);
        const phone = randomSenegalPhone('76');
        const since = getFakes().sms.messagesTo(phone).length;
        const invite = await routePost('../../app/api/partner/team/invite/route', authed('/api/partner/team/invite', 'POST', partner,
            { phone, event_ids: [ev.eventId], first_name: 'Moussa' }, { 'x-forwarded-for': `${freshIp()}, 10.0.0.1` }));
        assert.ok(invite.status === 200 || invite.status === 201, `invitation d'un nouveau contrôleur : ${show(invite)}`);
        const codes = codesSince(phone, since);
        assert.equal(codes.length, 1, `un SMS d'activation avec un code : ${JSON.stringify(getFakes().sms.messagesTo(phone).slice(since).map((m) => m.message))}`);
        const setup = await routePost('../../app/api/controller/setup/route', new NextRequest(`${BASE_URL}/api/controller/setup`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-forwarded-for': `${freshIp()}, 10.0.0.1` },
            body: JSON.stringify({ phone, otp_code: codes[0], new_password: `Ctrl#${randomBytes(6).toString('hex')}A1` }),
        }));
        assert.equal(setup.status, 200, `activation du compte : ${show(setup)}`);
        const { data: user, error } = await service.from('users').select('id').in('phone', [phone, phone.slice(1)]).single();
        assert.equal(error, null, `compte du contrôleur : ${error?.message}`);
        const userId = String(user.id);

        const atActivation = await outboxRows({ type: 'PASSWORD_CHANGED', userId });
        assert.deepEqual(atActivation.map((r) => r.channel), [], 'aucune alerte de mot de passe à l\'activation du compte coquille (R29)');

        const { error: resetErr } = await service.auth.admin.updateUserById(userId, { password: `Reset#${randomBytes(6).toString('hex')}A1` });
        assert.equal(resetErr, null, `réinitialisation du mot de passe : ${resetErr?.message}`);
        const afterReset = await outboxRows({ type: 'PASSWORD_CHANGED', userId });
        assert.ok(afterReset.some((r) => r.channel === 'SMS'), `témoin : une réinitialisation ultérieure met PASSWORD_CHANGED en file : ${JSON.stringify(afterReset.map((r) => r.channel))}`);
    });

    test('activate_partner_trial : aucune ligne SMS TRIAL_STARTED (in-app seul, plus email)', async () => {
        const partner = await newPartner('msg-sms-essai');
        const first = await service.rpc('activate_partner_trial', { p_partner_id: partner.partnerId });
        assert.equal(first.error, null, `activation de l'essai : ${first.error?.message}`);
        assert.equal((first.data as Row).is_new_activation, true, `première activation : ${JSON.stringify(first.data)}`);
        const rows = await outboxRows({ type: 'TRIAL_STARTED', userId: partner.userId });
        assert.ok(rows.some((r) => r.channel === 'IN_APP'), `TRIAL_STARTED en in-app : ${JSON.stringify(rows.map((r) => r.channel))}`);
        assert.deepEqual(rows.filter((r) => r.channel === 'SMS').map((r) => r.idempotency_key), [], 'aucune ligne SMS TRIAL_STARTED (décision R31 de la consigne : un seul SMS à la validation)');
    });
});

// ── R31 : alerte des SMS indispensables du jour ────────────────────────────

describe('9b.38 R31 : alerte admin quand les SMS indispensables du jour dépassent le seuil réglable', () => {
    test('finance_setting_set (SUPERADMIN) : notif.sms_essential_daily_alert est une clé admise, appliquée', async () => {
        const saved = await getNotifSetting(ESSENTIAL_ALERT_KEY);
        try {
            const { data, error } = await service.rpc('finance_setting_set', { p_key: ESSENTIAL_ALERT_KEY, p_value: { value: 1500 }, p_actor: await superadminId(), p_reason: 'test du lot 9 bis (R31)' });
            assert.equal(error, null, `finance_setting_set : ${error?.message}`);
            assert.equal((data as Row | null)?.ok, true, `clé refusée (aujourd'hui UNKNOWN_KEY) : ${JSON.stringify(data)}`);
            assert.equal(await getNotifSetting(ESSENTIAL_ALERT_KEY), 1500, 'valeur appliquée');
        } finally {
            await setNotifSetting(ESSENTIAL_ALERT_KEY, saved, 'restauration après messages-sms-9bis');
        }
    });

    test('seuil 1 et un SMS indispensable SENT du jour : une alerte ADMIN_SMS_DAILY_THRESHOLD au premier passage, aucune de plus au second', async () => {
        const dayStart = new Date();
        dayStart.setUTCHours(0, 0, 0, 0); // jour de Dakar (UTC+0)
        const ev = await publishedEvent('Seuil', `Seuil ${randomBytes(2).toString('hex')}`);
        const buyer = await newBuyer('sms-seuil');
        await withNotifSettings({ [ESSENTIAL_ALERT_KEY]: 1 }, async () => {
            await buyConfirmed(buyer, ev, [[STANDARD, 1]]);
            await flushNotifications({ eventIds: [ev.eventId] });
            const sent = await outboxRows({ type: 'PURCHASE_CONFIRMED', userId: buyer.userId, channel: 'SMS', status: 'SENT' });
            assert.equal(sent.length, 1, 'un SMS indispensable SENT aujourd\'hui');
            const first = (await outboxRows({ type: 'ADMIN_SMS_DAILY_THRESHOLD' })).filter((r) => Date.parse(r.created_at) >= dayStart.getTime());
            assert.ok(first.length > 0, 'au premier passage de l\'envoyeur, l\'alerte du jour existe (seuil 1 dépassé)');
            await flushNotifications({ eventIds: [ev.eventId] });
            const second = (await outboxRows({ type: 'ADMIN_SMS_DAILY_THRESHOLD' })).filter((r) => Date.parse(r.created_at) >= dayStart.getTime());
            assert.deepEqual(second.map((r) => r.id).sort(), first.map((r) => r.id).sort(), 'une seule alerte par jour : rien de plus au second passage');
        });
    });
});

// ── R27 : caractères hors alphabet SMS retirés ─────────────────────────────

describe('9b.38 R27 : émojis et caractères hors alphabet SMS retirés du texte des SMS seulement', () => {
    test('smsVar : émoji retiré et espaces repliés, « ŋ » translittéré en « n », résultat en GSM-7', () => {
        assert.equal(smsVar('Soirée 🎉 Teranga', 30), 'Soirée Teranga', 'émoji retiré, espaces repliés (« é » est du GSM-7 de base)');
        assert.equal(smsVar('Xew-xew ŋ Dakar', 30), 'Xew-xew n Dakar', '« ŋ » → « n »');
        assert.equal(smsVar('Ŋoor', 30), 'Noor', '« Ŋ » → « N »');
        for (const v of ['Soirée 🎉 Teranga', 'Xew-xew ŋ Dakar', 'Gala 日本']) {
            assert.equal(smsSegments(`Event Village : ${smsVar(v, 30)}`).encoding, 'GSM7', `variable « ${v} » rendue en GSM-7`);
        }
    });

    test('titre « Soirée 🎉 Teranga … » : SMS d\'annulation remis en GSM-7, un segment, sans émoji, texte exact', async () => {
        const suffix = randomBytes(2).toString('hex');
        const ev = await publishedEvent('Emoji', `Soirée 🎉 Teranga ${suffix}`);
        const holder = await newBuyer('sms-emoji');
        await buyConfirmed(holder, ev, [[STANDARD, 1]]);
        const { data, error } = await service.from('events').select('start_date, start_time').eq('id', ev.eventId).single();
        assert.equal(error, null, `événement : ${error?.message}`);
        const date = smsDateTime(`${String(data.start_date)}T${String(data.start_time).length === 5 ? `${String(data.start_time)}:00` : String(data.start_time)}.000Z`);
        await flushNotifications({ eventIds: [ev.eventId] }); const mark = smsMark(holder.phoneE164); // confirmation d’achat remise avant la marque
        const partner = await suitePartner();
        assertRpcOk(await rpcCancel(ev.eventId, partner.userId, { publicNotice: 'Salle indisponible ce soir', internalReason: 'Test du lot 9 bis', confirmTitle: ev.title }), 'annulation');
        await flushNotifications({ eventIds: [ev.eventId] });

        const texts = smsTo(holder.phoneE164, mark).map((m) => m.message);
        assert.deepEqual(texts, [`Event Village : Soirée Teranga ${suffix} du ${date} est annulé. Remboursement automatique en cours. ${APP_URL}/tickets`],
            'SMS exact, émoji retiré du titre');
        assert.ok(!EMOJI_RE.test(texts[0]), 'aucun émoji dans le SMS');
        const m = smsSegments(texts[0]);
        assert.deepEqual([m.encoding, m.segments], ['GSM7', 1], `un segment GSM-7 (aujourd'hui UCS-2) : ${JSON.stringify(m)}`);
    });
});

// ── R28 : libellé de supervision du SMS H-3 ────────────────────────────────

describe('9b.39 R28 : libellé de supervision du SMS de 3 heures remplacé par le push (statique)', () => {
    test('OUTBOX_REASON_LABELS.PUSH_DELIVERED ne parle plus de push « remis » ; détail de la page admin aligné', async () => {
        const labels = (await importModule('../../lib/notifications/outbox-labels')) as Record<string, unknown>;
        const reasons = labels.OUTBOX_REASON_LABELS as Record<string, string> | undefined;
        assert.ok(reasons && typeof reasons === 'object', 'lib/notifications/outbox-labels.ts : OUTBOX_REASON_LABELS exporté');
        const label = String(reasons.PUSH_DELIVERED ?? '').replace(/[\u00a0\u202f]/g, ' ');
        assert.doesNotMatch(label, /remis/i, `le libellé ne dit plus que le push est remis : « ${label} »`);
        assert.equal(label, 'Push accepté par le service, SMS non envoyé (affichage non garanti)', 'libellé du contrat (11.2, R28)');
        const page = fs.readFileSync(path.join(process.cwd(), 'app', 'admin', 'notifications', '[id]', 'page.tsx'), 'utf8');
        assert.match(page, /SMS seulement si le push n['’]est pas accepté par le service push/, 'détail de la page admin (contrat 5.39, écran E-D)');
        assert.doesNotMatch(page, /notification push remise/, 'ancien détail retiré');
    });
});

// ── Ex-10.0 d : invitation échue sans « 48 h » ─────────────────────────────

describe('9b.40 ex-10.0 d : le message d\'une invitation expirée ne parle plus de 48 h', () => {
    test('acceptation d\'une invitation échue : 410 TRANSFER_EXPIRED, « Ce billet ne peut plus être accepté : le délai est dépassé. »', async () => {
        const partner = await suitePartner();
        const ev = await publishedEvent('Invit echue', `Invitation ${randomBytes(2).toString('hex')}`);
        const invitee = await newBuyer('sms-echue', { firstName: 'Awa', lastName: 'Invitee' });
        const inviteRoute = await routeHandler('../../app/api/partner/events/[id]/invitations/route', 'POST', 'POST /api/partner/events/[id]/invitations (lot 9)');
        const sent = await invoke(inviteRoute, authed(`/api/partner/events/${ev.eventId}/invitations`, 'POST', partner,
            { category_id: ev.categories[STANDARD].id, phones: [invitee.phoneE164], quantity: 1 }), routeContext({ id: ev.eventId }));
        assert.equal(sent.status, 200, `invitation : ${show(sent)}`);
        const { data, error } = await service.from('ticket_transfers').select('id').eq('to_phone_or_email', invitee.phoneE164).eq('status', 'PENDING');
        assert.equal(error, null, `invitation en attente : ${error?.message}`);
        assert.equal((data ?? []).length, 1, `précondition : une invitation PENDING vers un numéro non vérifié (${JSON.stringify(data)})`);
        const transferId = String(data![0].id);
        await markPhoneVerified(invitee.userId);
        // created_at reculé aussi : CHECK (expires_at > created_at) de chk_ticket_transfers_dates (patron notif-transferts.test.ts:366).
        const { error: expErr } = await service.from('ticket_transfers')
            .update({ created_at: new Date(Date.now() - 49 * 3600_000).toISOString(), expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', transferId);
        assert.equal(expErr, null, `échéance passée : ${expErr?.message}`);

        const claim = await routeHandler('../../app/api/tickets/transfers/[id]/claim/route', 'POST', 'POST /api/tickets/transfers/[id]/claim');
        const res = await invoke(claim, authed(`/api/tickets/transfers/${transferId}/claim`, 'POST', invitee), routeContext({ id: transferId }));
        assert.equal(res.status, 410, show(res));
        assert.equal(res.body.code, 'TRANSFER_EXPIRED', show(res));
        assert.doesNotMatch(String(res.body.error ?? ''), /48/, `aucune mention de 48 h : ${show(res)}`);
        assert.equal(String(res.body.error ?? '').replace(/[\u00a0\u202f]/g, ' '), 'Ce billet ne peut plus être accepté : le délai est dépassé.', 'texte du contrat (B84, 4.3), espaces insécables admis');
    });
});
