/**
 * Lot 9 bis, tâche 41 (contrat 5.41, 4.3, 4.4 ; B84 à B88, B95 ; découverte D-txt 2) — passe de textes, cas avec base.
 *  1. R80 : adresse posée puis vidée dans la fenêtre de regroupement : la ligne SMS EVENT_CHANGED en attente ne garde
 *     pas l'ancienne adresse, porte `address_cleared` et se rend « adresse retirée, lieu … » (texte M1) ;
 *  2. R92 : event_actions sert `can_delete` : brouillon neuf → true ; soumis puis refusé → false (témoin : la suppression
 *     de ce brouillon est bien refusée par events_delete_guard) ;
 *  3. R104 : fiche publique : catégorie au stock entièrement réservé → `hasHeldSeats` ; ventes closes → `salesEnded` ;
 *     billets reçus : invitation → `kind: 'INVITATION'`, transfert → `kind: 'TRANSFER'` ;
 *  4. R105 : la propriétaire ne peut plus annuler un événement SUSPENDU ; un admin `events.write` le peut ;
 *  5. R84 : « mot de passe oublié » sur un numéro inconnu → 200 `{ success: true }`, aucun SMS, aucun code ;
 *  6. R86 : code de parrainage inconnu → 400 REFERRAL_CODE_UNKNOWN, aucun compte, et le code SMS reste valable ;
 *  7. R67 : GET /api/admin/referral/config (referrals.manage) sert les lignes actives de referral_config (12 et 24
 *     mois) ; sans la permission → 403 sans donnée ;
 *  8. R100 : point d'entrée « Porte Nord » → door_label « Porte Nord » (aujourd'hui « Porte Porte Nord ») ;
 *  9. R75 : retrait refusé par SamirPay → rejection_reason « Refusé par l’opérateur Mobile Money ».
 * Envois comptés par numéro neuf ; aucune route n'accepte d'heure.
 *
 * Rouge avant correctif : R80 la ligne fusionnée garde new_address (M/20261108000001:466-473), SMS « change de lieu :
 * {ancienne adresse} » (SUPPOSÉ ; vert → « non reproduit » pour la partie regroupement) ; R92 clé can_delete absente ;
 * R104 clés hasHeldSeats, salesEnded et kind absentes ; R105 ligne (SUSPENDU, ANNULE, PARTENAIRE) présente
 * (M/20261102000003:62) ; R84 404 « Aucun compte… » ; R86 200 et compte créé ; R67 route absente ; R100 « Porte Porte
 * Nord » ; R75 « refusé par SamirPay (REJECTED) ». after() : la garde de schéma du lot 9 bis nomme les objets absents
 * jusqu'à M12 (attendu, contrat section 10).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { renderNotification } from '../../lib/notifications/catalog';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { getFakes } from '../fakes';
import { jsonRequest as publicRequest, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { cart, checkout, newBuyer, service, setFakeMode, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, createPartnerEvent, jsonRequest, newPartner, withSettings, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, type RouteResult } from './acces-helpers';
import { advanceEventTo, createDraftEvent, eventStatus, rpcCancel, rpcTransition, type DraftEvent } from './cycle-helpers';
import { dakarDay, markPhoneVerified, outboxRows } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { issueFreeTicket, newAdminWith, registerClientFlow, registerSubmit } from './terrain-helpers';

type Row = Record<string, unknown>;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const HOUR = 3600_000;

let partner: TestPartner;

before(async () => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
    partner = await newPartner('textes-base');
});

after(async () => {
    await assertLot9bisInvariants('textes-base-9bis');
});

function sameQuotes(v: unknown): string {
    return String(v ?? '').replace(/[’‘]/g, '\'');
}

function mark(): string {
    return randomBytes(3).toString('hex');
}

// ── 1. R80 : adresse vidée dans la fenêtre de regroupement ─────────────────

describe('R80 — adresse posée puis vidée avant l’envoi : la ligne SMS ne garde pas l’ancienne adresse', () => {
    test('ligne SMS EVENT_CHANGED fusionnée : sans l’ancienne adresse, address_cleared, texte « adresse retirée, lieu … »', async () => {
        const title = `Gala R80 ${mark()}`;
        const location = 'CICAD';
        const day = dakarDay(3);
        const ev = await createDraftEvent(partner, 'textes-r80', [{ name: 'Standard', price: 3_000, total: 20 }], { title, startsInHours: 96, durationHours: 3, location });
        const firstAddress = `Route de Rufisque ${mark()}`;
        const { error: prepErr } = await service.from('events')
            .update({ start_date: day, start_time: '20:00:00', end_date: day, end_time: '23:00:00', practical_info: { address: firstAddress } })
            .eq('id', ev.eventId);
        assert.equal(prepErr, null, `préparation de l'événement : ${prepErr?.message}`);
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        const holder = await newBuyer('r80-porteur');
        await buyConfirmed(holder, ev, [['Standard', 1]]);

        const newAddress = `Corniche Ouest ${mark()}`;
        await putEvent(ev, { practical_info: { address: newAddress } }, 'adresse posée');
        await putEvent(ev, { practical_info: { address: null } }, 'adresse vidée');

        const rows = (await outboxRows({ type: 'EVENT_CHANGED', eventId: ev.eventId, userId: holder.userId, channel: 'SMS' }))
            .filter((r) => r.status !== 'CANCELLED');
        assert.equal(rows.length, 1, `une seule ligne SMS en attente, fusionnée : ${JSON.stringify(rows.map((r) => [r.status, r.template_data]))}`);
        const data = rows[0].template_data;
        const dump = JSON.stringify(data);
        assert.ok(!dump.includes(newAddress), `la ligne garde l’adresse posée puis retirée (fuite au regroupement) : ${dump}`);
        assert.ok(!dump.includes(firstAddress), `la ligne garde l’adresse d’origine : ${dump}`);
        assert.equal(data.address_cleared, true, `marqueur address_cleared absent : ${dump}`);
        const sms = renderNotification('EVENT_CHANGED', 'SMS', data, { appUrl: APP_URL });
        assert.equal(sms.channel, 'SMS');
        if (sms.channel === 'SMS') {
            assert.equal(sms.text, `Event Village : ${title} : adresse retirée, lieu ${location}. Billets toujours valables. ${APP_URL}/tickets`, 'texte M1, variante « adresse retirée »');
        }
    });
});

async function putEvent(ev: DraftEvent, patch: Row, what: string): Promise<void> {
    const { data: row, error } = await service.from('events').select('updated_at').eq('id', ev.eventId).single();
    assert.equal(error, null, `événement : ${error?.message}`);
    const handler = await routeHandler('../../app/api/partner/events/[id]/route', 'PUT', 'PUT /api/partner/events/[id]');
    const res = await invoke(handler, jsonRequest(`/api/partner/events/${ev.eventId}`, 'PUT', partner.accessToken, { patch, expected_updated_at: String(row.updated_at) }), routeContext({ id: ev.eventId }));
    assert.equal(res.status, 200, `${what} : ${show(res)}`);
}

// ── 2. R92 : can_delete ────────────────────────────────────────────────────

async function eventActions(eventId: string, actorId: string): Promise<Row> {
    const { data, error } = await service.rpc('event_actions', { p: { event_id: eventId, actor_id: actorId } });
    assert.equal(error, null, `event_actions : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `event_actions : ${JSON.stringify(data)}`);
    return data as Row;
}

describe('R92 — « Supprimer le brouillon » seulement pour un brouillon jamais soumis (can_delete)', () => {
    test('brouillon neuf → can_delete true ; soumis puis refusé → can_delete false, et la suppression est bien refusée', async () => {
        const admin = await newAdminWith(['events.read', 'events.write'], { label: 'r92-admin' });
        const ev = await createDraftEvent(partner, 'textes-r92', [{ name: 'Standard', price: 3_000, total: 20 }], { startsInHours: 96 });
        const fresh = await eventActions(ev.eventId, partner.userId);
        assert.equal(fresh.can_delete, true, `brouillon neuf : can_delete attendu true (clé absente aujourd’hui) : ${JSON.stringify(fresh)}`);

        const submitted = await rpcTransition(ev.eventId, partner.userId, 'EN_ATTENTE');
        assert.equal(submitted.error, null, submitted.error?.message);
        assert.equal(submitted.data?.ok, true, `soumission : ${JSON.stringify(submitted.data)}`);
        const refused = await rpcTransition(ev.eventId, admin.userId, 'BROUILLON', 'Affiche à refaire, merci');
        assert.equal(refused.error, null, refused.error?.message);
        assert.equal(refused.data?.ok, true, `refus : ${JSON.stringify(refused.data)}`);
        assert.equal(await eventStatus(ev.eventId), 'BROUILLON', 'brouillon refusé');

        const after = await eventActions(ev.eventId, partner.userId);
        assert.equal(after.can_delete, false, `brouillon déjà soumis : can_delete attendu false : ${JSON.stringify(after)}`);
        assert.equal(after.can_edit, true, 'un brouillon refusé reste modifiable');
        const del = await service.from('events').delete().eq('id', ev.eventId).select('id');
        assert.ok(del.error, `témoin : events_delete_guard refuse la suppression d’un brouillon déjà soumis (${JSON.stringify(del.data)})`);
    });
});

// ── 3. R104 : fiche publique et billets reçus ──────────────────────────────

/**
 * GET /api/events/[id] lit `params.id` sans await : contexte objet et promesse à la fois (patron
 * canaux-vente.test.ts:190). Avec routeContext seul (promesse), params.id vaut undefined et la route répond 404.
 */
async function publicSheet(eventId: string): Promise<Row> {
    const handler = await routeHandler('../../app/api/events/[id]/route', 'GET', 'GET /api/events/[id]');
    const params = { id: eventId };
    const res = await invoke(handler, jsonRequest(`/api/events/${eventId}`, 'GET', null), { params: Object.assign(Promise.resolve(params), params) });
    assert.equal(res.status, 200, `fiche publique : ${show(res)}`);
    assert.ok(res.body.event && typeof res.body.event === 'object', `fiche publique : objet event attendu, ${show(res)}`);
    return res.body.event as Row;
}

describe('R104 — fiche publique : places en cours de paiement, ventes closes', () => {
    test('stock entièrement réservé par un paiement en attente → hasHeldSeats true ; ventes ouvertes → salesEnded false', async () => {
        const ev = await createPartnerEvent(partner.partnerId, 'textes-r104-reserve', [{ name: 'Standard', price: 2_000, total: 2 }]);
        const buyer = await newBuyer('r104-reserve');
        const pending = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 2]], buyer));
        assert.equal(pending.status, 200, `paiement en attente qui réserve tout le stock : ${JSON.stringify(pending.body)}`);
        const sheet = await publicSheet(ev.eventId);
        assert.equal(sheet.isFullySoldOut, true, `témoin : plus aucune place proposée : ${JSON.stringify(sheet).slice(0, 400)}`);
        assert.equal(sheet.hasHeldSeats, true, `places en cours de paiement : hasHeldSeats attendu true (aujourd’hui absent, texte « Toutes les places ont été vendues ») : ${JSON.stringify(sheet).slice(0, 400)}`);
        assert.equal(sheet.salesEnded, false, 'ventes encore ouvertes : salesEnded false');
    });

    test('toutes les ventes en ligne closes → salesEnded true, hasHeldSeats false', async () => {
        const ev = await createPartnerEvent(partner.partnerId, 'textes-r104-close', [{ name: 'Standard', price: 2_000, total: 10 }]);
        const { error } = await service.from('ticket_categories')
            .update({ sale_start: new Date(Date.now() - 48 * HOUR).toISOString(), sale_end: new Date(Date.now() - HOUR).toISOString() })
            .eq('id', ev.categories.Standard.id);
        assert.equal(error, null, `fin des ventes : ${error?.message}`);
        const sheet = await publicSheet(ev.eventId);
        assert.equal(sheet.salesEnded, true, `ventes closes : salesEnded attendu true (aujourd’hui absent, « Revenez bientôt ») : ${JSON.stringify(sheet).slice(0, 400)}`);
        assert.equal(sheet.hasHeldSeats, false, 'aucune place en cours de paiement');
    });
});

describe('R104 — billets reçus : kind INVITATION ou TRANSFER (ticket_transfers_incoming)', () => {
    test('une invitation de la partenaire → kind INVITATION ; un transfert d’un client → kind TRANSFER', async () => {
        const ev = await createDraftEvent(partner, 'textes-r104-recus', [{ name: 'Gratuit', price: 0, total: 20 }], { startsInHours: 72 });
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        const recipient = await newBuyer('r104-destinataire', { phoneVerified: false }); // lot 9 quater : numéro non prouvé (signalé)
        // Numéro vérifié APRÈS l'invitation (patron messages-sms-9bis.test.ts:239) : un numéro déjà rattaché à un compte
        // vérifié reçoit le billet directement, sans transfert (ticket_invitation_create, v_account IS NULL seulement).

        const { data: inv, error: invErr } = await service.rpc('ticket_invitation_create', {
            p: { actor_id: partner.userId, event_id: ev.eventId, category_id: ev.categories.Gratuit.id, phones: [recipient.phoneE164], quantity: 1, limits: { per_event_hour: 50, per_phone_day: 3 } },
        });
        assert.equal(invErr, null, `ticket_invitation_create : ${invErr?.message}`);
        assert.equal((inv as Row | null)?.ok, true, `invitation : ${JSON.stringify(inv)}`);
        const { data: invRows, error: trErr } = await service.from('ticket_transfers').select('id').eq('to_phone_or_email', recipient.phoneE164).is('from_user_id', null).eq('status', 'PENDING');
        assert.equal(trErr, null, trErr?.message);
        assert.equal((invRows ?? []).length, 1, 'un transfert d’invitation en attente');
        await markPhoneVerified(recipient.userId);

        const sender = await newBuyer('r104-expediteur');
        const ticketId = await issueFreeTicket(ev.eventId, ev.categories.Gratuit.id, sender);
        const { data: tr, error: initErr } = await service.rpc('ticket_transfer_initiate', {
            p: { ticket_id: ticketId, actor_id: sender.userId, recipient: recipient.phoneE164, expires_at: new Date(Date.now() + 48 * HOUR).toISOString() },
        });
        assert.equal(initErr, null, `ticket_transfer_initiate : ${initErr?.message}`);
        assert.equal((tr as Row | null)?.ok, true, `transfert : ${JSON.stringify(tr)}`);

        const { data, error } = await service.rpc('ticket_transfers_incoming', { p: { actor_id: recipient.userId } });
        assert.equal(error, null, `ticket_transfers_incoming : ${error?.message}`);
        const items = ((data as Row | null)?.items ?? []) as Row[];
        const kinds = Object.fromEntries(items.map((i) => [String(i.transfer_id), i.kind]));
        assert.deepEqual(kinds, { [String(invRows![0].id)]: 'INVITATION', [String((tr as Row).transfer_id)]: 'TRANSFER' },
            `kind attendu par billet reçu (aujourd’hui absent) : ${JSON.stringify(items).slice(0, 600)}`);
    });
});

// ── 4. R105 : annulation d'un événement suspendu ───────────────────────────

describe('R105 — seul un admin annule un événement SUSPENDU', () => {
    test('propriétaire → refus, statut SUSPENDU inchangé ; admin events.write → ANNULE', async () => {
        const admin = await newAdminWith(['events.read', 'events.write'], { label: 'r105-admin' });
        const ev = await createDraftEvent(partner, 'textes-r105', [{ name: 'Standard', price: 3_000, total: 20 }], { startsInHours: 96 });
        await advanceEventTo(ev.eventId, 'SUSPENDU', { partnerUserId: partner.userId });
        const input = { publicNotice: 'Événement annulé : vos billets sont remboursés.', internalReason: 'Essai du lot 9 bis', confirmTitle: ev.title };

        const byOwner = await rpcCancel(ev.eventId, partner.userId, input);
        assert.equal(byOwner.error, null, byOwner.error?.message);
        assert.equal(byOwner.data?.ok, false, `la propriétaire annule un événement suspendu (ligne SUSPENDU → ANNULE PARTENAIRE encore présente) : ${JSON.stringify(byOwner.data)}`);
        assert.equal(await eventStatus(ev.eventId), 'SUSPENDU', 'statut inchangé après le refus');

        const byAdmin = await rpcCancel(ev.eventId, admin.userId, input);
        assert.equal(byAdmin.error, null, byAdmin.error?.message);
        assert.equal(byAdmin.data?.ok, true, `admin events.write : annulation acceptée : ${JSON.stringify(byAdmin.data)}`);
        assert.equal(await eventStatus(ev.eventId), 'ANNULE');
    });
});

// ── 5. R84 : réponse neutre par téléphone ──────────────────────────────────

async function otpRows(phone: string): Promise<number> {
    const { count, error } = await service.from('otp_codes').select('id', { count: 'exact', head: true }).eq('phone', phone);
    assert.equal(error, null, `codes : ${error?.message}`);
    return count ?? 0;
}

async function sendOtp(phone: string, purpose: string): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/auth/send-otp/route', 'POST', 'POST /api/auth/send-otp');
    return invoke(handler, publicRequest('/api/auth/send-otp', { phone, purpose }));
}

describe('R84 — « mot de passe oublié » : même réponse que le compte existe ou non', () => {
    test('numéro inconnu → 200 { success: true }, aucun SMS, aucun code enregistré', async () => {
        const phone = randomSenegalPhone('76');
        const r = await sendOtp(phone, 'PASSWORD_RESET');
        assert.deepEqual({ status: r.status, body: r.body }, { status: 200, body: { success: true } }, `réponse neutre attendue (aujourd’hui 404 « Aucun compte… ») : ${show(r)}`);
        assert.equal(getFakes().sms.messagesTo(phone).length, 0, 'aucun SMS pour un numéro inconnu');
        assert.equal(await otpRows(phone), 0, 'aucun code enregistré pour un numéro inconnu');
    });

    test('témoin : compte existant → 200 et un SMS de code au numéro (vert aujourd’hui)', async () => {
        const user = await newBuyer('r84-existant');
        const before = getFakes().sms.messagesTo(user.phoneE164).length;
        const r = await sendOtp(user.phoneE164, 'PASSWORD_RESET');
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.success, true, show(r));
        assert.equal(getFakes().sms.messagesTo(user.phoneE164).length - before, 1, 'un SMS de code');
    });
});

// ── 6. R86 : code de parrainage inconnu ────────────────────────────────────

describe('R86 — code de parrainage inconnu signalé avant de consommer le code SMS', () => {
    test('code inconnu → 400 REFERRAL_CODE_UNKNOWN (champ referralCode), aucun compte ; le même code SMS sert ensuite sans parrainage', async () => {
        const unknown = `ZZ${randomBytes(4).toString('hex').toUpperCase()}`;
        const flow = await registerClientFlow({ referralCode: unknown }, { expectOk: false });
        assert.equal(flow.start.status, 200, `démarrage : ${JSON.stringify(flow.start.body)}`);
        assert.ok(flow.code, 'code reçu par SMS');
        assert.ok(flow.register, 'inscription tentée');
        assert.equal(flow.register.status, 400, `code de parrainage inconnu : 400 attendu (aujourd’hui 200 et compte créé) : ${JSON.stringify(flow.register.body)}`);
        assert.equal(flow.register.body.code, 'REFERRAL_CODE_UNKNOWN', JSON.stringify(flow.register.body));
        assert.equal(flow.register.body.field, 'referralCode', JSON.stringify(flow.register.body));
        assert.equal(sameQuotes(flow.register.body.error), 'Code de parrainage inconnu. Vérifiez-le ou laissez le champ vide.', JSON.stringify(flow.register.body));
        const { count, error } = await service.from('users').select('id', { count: 'exact', head: true }).in('phone', [flow.phone, flow.phone.replace(/^\+/, '')]);
        assert.equal(error, null, error?.message);
        assert.equal(count, 0, 'aucun compte créé');

        const again = await registerSubmit({ phone: flow.phone, code: flow.code, firstName: 'Aminata', lastName: 'Inscrite', password: STRONG_PASSWORD });
        assert.equal(again.status, 200, `le code SMS n’a pas été consommé : ${JSON.stringify(again.body)}`);
        assert.equal(typeof again.body.userId, 'string', JSON.stringify(again.body));
    });
});

// ── 7. R67 : configuration du parrainage ───────────────────────────────────

async function referralConfig(user: Buyer): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/admin/referral/config/route', 'GET', 'GET /api/admin/referral/config (contrat 4.4, fix(9b.41-R67))');
    return invoke(handler, authed('/api/admin/referral/config', 'GET', user));
}

/** Lignes de configuration de la réponse : la réponse elle-même si c'est une liste, sinon sa seule liste de lignes. */
function configRows(body: unknown): Row[] {
    if (Array.isArray(body)) return body as Row[];
    const lists = Object.values((body ?? {}) as Row).filter((v): v is Row[] => Array.isArray(v) && v.some((x) => x && typeof x === 'object' && 'duration_months' in (x as Row)));
    assert.equal(lists.length, 1, `une liste de lignes referral_config attendue : ${JSON.stringify(body).slice(0, 400)}`);
    return lists[0];
}

describe('R67 — durées et taux du parrainage lus dans la configuration', () => {
    test('referrals.manage → lignes actives de referral_config, 12 mois en standard et 24 en ambassadeur', async () => {
        const admin = await newAdminWith(['referrals.manage'], { label: 'r67' });
        const res = await referralConfig(admin);
        assert.equal(res.status, 200, show(res));
        const { data: db, error } = await service.from('referral_config').select('sponsor_status, referral_type, rate_n1, rate_n2, duration_months').eq('is_active', true);
        assert.equal(error, null, error?.message);
        const key = (r: Row): string => `${String(r.sponsor_status)}/${String(r.referral_type)}`;
        const served = Object.fromEntries(configRows(res.body).map((r) => [key(r), [Number(r.duration_months), Number(r.rate_n1), Number(r.rate_n2)]]));
        const expected = Object.fromEntries((db ?? []).map((r) => [key(r), [Number(r.duration_months), Number(r.rate_n1), Number(r.rate_n2)]]));
        assert.deepEqual(served, expected, 'les lignes actives de la base, telles quelles');
        assert.equal(served['STANDARD/CLIENT_TO_CLIENT']?.[0], 12, 'standard : 12 mois (la page affiche 24 Mois en dur)');
        assert.equal(served['AMBASSADEUR/CLIENT_TO_CLIENT']?.[0], 24, 'ambassadeur : 24 mois');
    });

    test('admin sans referrals.manage → 403, aucune ligne', async () => {
        const admin = await newAdminWith(['events.read'], { label: 'r67-sans' });
        const res = await referralConfig(admin);
        assert.equal(res.status, 403, show(res));
        assert.ok(!JSON.stringify(res.body).includes('duration_months'), `aucune donnée : ${show(res)}`);
    });
});

// ── 8. R100 : libellé de la porte ──────────────────────────────────────────

describe('R100 — libellé de la porte sans « Porte Porte »', () => {
    test('point « Porte Nord » → « Porte Nord » ; « Entrée VIP » → « Entrée VIP » ; témoin « A » → « Porte A »', async () => {
        const ev = await createTimedEvent(partner.partnerId, 'textes-r100', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 1, durationHours: 6 });
        const handler = await routeHandler('../../app/api/controller/scans/route', 'GET', 'GET /api/controller/scans');
        const labels: Record<string, unknown> = {};
        for (const entry of ['Porte Nord', 'Entrée VIP', 'A']) {
            const ctrl = await newController(partner, ev.eventId, { label: `r100-${entry.length}` });
            const { error } = await service.from('event_controllers').update({ entry_point: entry }).eq('event_id', ev.eventId).eq('user_id', ctrl.userId);
            assert.equal(error, null, `point d’entrée ${entry} : ${error?.message}`);
            const res = await invoke(handler, authed(`/api/controller/scans?event_id=${ev.eventId}`, 'GET', ctrl));
            assert.equal(res.status, 200, show(res));
            labels[entry] = res.body.door_label;
        }
        assert.deepEqual(labels, { 'Porte Nord': 'Porte Nord', 'Entrée VIP': 'Entrée VIP', A: 'Porte A' }, 'préfixe « Porte » seulement si la valeur n’en a pas déjà un');
    });
});

// ── 9. R75 : motif d'un retrait refusé ─────────────────────────────────────

describe('R75 — retrait refusé par SamirPay : motif lisible', () => {
    test('rejection_reason « Refusé par l’opérateur Mobile Money » (aujourd’hui « refusé par SamirPay (REJECTED) »)', async () => {
        const owner = await newPartner('textes-r75');
        const ev = await createPartnerEvent(owner.partnerId, 'textes-r75', [{ name: 'Standard', price: 10_000, total: 10 }]);
        const buyer = await newBuyer('r75-acheteur');
        await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
        const rules = { 'finance.withdrawal_fee_rate': 1, 'finance.withdrawal_min_amount': 5000, 'finance.withdrawal_bank_enabled': false };
        const reply = await withSettings(rules, async () => {
            const { data, error } = await service.rpc('withdrawal_request', {
                p: {
                    user_id: owner.userId, account_kind: 'ORGANISATEUR', gross_amount: 6_000, method: 'MOBILE_MONEY', operator: 'WAVE',
                    phone_number: owner.phone9, client_key: `r75-${mark()}`,
                },
            });
            assert.equal(error, null, `withdrawal_request : ${error?.message}`);
            return data as Row;
        });
        assert.equal(reply.ok, true, `retrait accepté : ${JSON.stringify(reply)}`);
        setFakeMode('cashoutMode', 'rejected');
        try {
            await CashoutService.send(String(reply.cashout_id));
        } finally {
            setFakeMode('cashoutMode', 'success');
        }
        const { data: w, error } = await service.from('withdrawals').select('status, rejection_reason').eq('id', String(reply.withdrawal_id)).single();
        assert.equal(error, null, error?.message);
        assert.equal(w.status, 'REJECTED', 'retrait refusé');
        assert.equal(sameQuotes(w.rejection_reason), 'Refusé par l\'opérateur Mobile Money', `motif montré à la partenaire (app/partner/finance/page.tsx:172) : ${JSON.stringify(w)}`);
    });
});
