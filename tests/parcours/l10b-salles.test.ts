/**
 * Lot 10b — salles : écrans et parcours complet (base LOCALE, faux SamirPay, service ouvert le temps de la suite).
 *
 *  A. droit unique halls.validate (« Valider les salles et les établissements ») : salles ET établissements ; un
 *     administrateur qui n'a que partners.validate est refusé ; avis aux bons administrateurs ;
 *  B. cycle de validation : création = envoi en validation (avis + SMS groupé), refus avec motif, refusée modifiée
 *     reste refusée, renvoi par la propriétaire (complétude, propriété), salle validée modifiée : avis à l'admin ;
 *  C. photos : seulement celles déposées dans le dossier des salles de la partenaire ;
 *  D. recherche, fiche, calendrier, devis publics : salles publiques seulement, aucune donnée du client ;
 *  E. client : ses réservations seulement, aperçu d'annulation = remboursement réel ;
 *  F. salle : ses réservations seulement, coordonnées du client après paiement, recettes ;
 *  G. administration : file et fiche avec halls.validate seulement ;
 *  H. réglage halls.max_pending_per_client.
 * Chaque route nouvelle est appelée par son gestionnaire réel (session, droit, propriété, état).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { api, show, type Reply } from '../audit/cvf1-helpers';
import {
    dayFromNow, decideHall, newBuyer, newHall, newPartner, openHallsService, payConfirmed, platformSetting, reservation,
    reserveRpc, setPlatformSetting, type Buyer, type Row, type TestPartner,
} from './l10a-helpers';
import { service } from './paiement-helpers';

const routeId = (method: string, rel: string, id: string, token: string | null, body?: unknown, query = ''): Promise<Reply> =>
    api(method, rel, { token, params: { id }, path: `/api/${rel.replace('[id]', id)}${query}`, body });

/** Adresse d'une photo déposée par la route de dépôt (réencodée) dans le dossier des salles d'une partenaire. */
function photoOf(partnerId: string): string {
    const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
    return `${base}/storage/v1/object/public/public-images/halls/${partnerId}/${Date.now()}_${randomBytes(4).toString('hex')}.webp`;
}

async function outboxRows(filter: { userId: string; type: string; key?: string }): Promise<Row[]> {
    let q = service.from('notification_outbox').select('type, channel, status, template_data, idempotency_key, recipient_user_id')
        .eq('recipient_user_id', filter.userId).eq('type', filter.type);
    if (filter.key) q = q.like('idempotency_key', `${filter.key}%`);
    const { data, error } = await q;
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

const channelsOf = (rows: Row[]): string[] => [...new Set(rows.map((r) => String(r.channel)))].sort();

let restore: () => Promise<void>;
let owner: TestPartner;
let other: TestPartner;
let alice: Buyer;
let bob: Buyer;
let validator: TestAdmin;
let oldValidator: TestAdmin;
let weakAdmin: TestAdmin;

before(async () => {
    restore = await openHallsService();
    owner = await newPartner('l10b-proprietaire');
    other = await newPartner('l10b-autre');
    alice = await newBuyer('l10b-alice', { firstName: 'Awa', lastName: 'Diop' });
    bob = await newBuyer('l10b-bob');
    validator = await newAdmin('l10b-valide', ['halls.validate']);
    oldValidator = await newAdmin('l10b-ancien-droit', ['partners.read', 'partners.validate', 'events.read', 'events.write']);
    weakAdmin = await newAdmin('l10b-faible', ['events.read']);
});

after(async () => {
    await restore();
    await assertLot10aInvariants('l10b-salles');
    await assertFinanceInvariants('l10b-salles');
});

describe('A. Droit unique « Valider les salles et les établissements »', () => {
    test('salle : partners.validate seul ne suffit plus (fonction et route) ; halls.validate valide', async () => {
        const hall = await newHall(owner, { validate: false });
        const byOld = await decideHall(hall, 'VALIDER', null, oldValidator.userId);
        assert.equal(byOld.code, 'FORBIDDEN', JSON.stringify(byOld));
        const routeOld = await routeId('POST', 'admin/halls/[id]/validation', hall, oldValidator.accessToken, { decision: 'VALIDER' });
        assert.equal(routeOld.status, 403, show(routeOld));
        const routeNew = await routeId('POST', 'admin/halls/[id]/validation', hall, validator.accessToken, { decision: 'VALIDER' });
        assert.equal(routeNew.status, 200, show(routeNew));
        const { data } = await service.from('halls').select('validation_status').eq('id', hall).single();
        assert.equal(data!.validation_status, 'VALIDEE');
    });

    test('établissement : même droit (fonction) ; partners.validate seul refusé', async () => {
        const { data: v, error } = await service.from('venues').insert({
            partner_id: owner.partnerId, name: `TEST Établissement 10b ${Date.now()}`, kind: 'RESTAURANT', city: 'Dakar', is_active: true,
        }).select('id, validation_status').single();
        assert.equal(error, null, error?.message);
        const call = (actor: string) => service.rpc('venue_validation_decide', { p: { actor_id: actor, venue_id: v!.id, decision: 'VALIDER' } });
        const old = await call(oldValidator.userId);
        assert.equal((old.data as Row).code, 'FORBIDDEN', JSON.stringify(old.data));
        const ok = await call(validator.userId);
        assert.equal((ok.data as Row).ok, true, JSON.stringify(ok.data));
        const route = await routeId('POST', 'admin/venues/[id]/validation', String(v!.id), weakAdmin.accessToken, { decision: 'SUSPENDRE', reason: 'Essai sans droit' });
        assert.equal(route.status, 403, show(route));
    });

    test('profil « Validation » : halls.validate compris ; libellé en mots', async () => {
        const { PERMISSION_PROFILES } = await import('../../lib/admin/permission-profiles');
        const { PERMISSION_LABELS } = await import('../../lib/admin/permission-labels');
        const { ADMIN_PERMISSIONS } = await import('../../lib/admin/permissions');
        const validation = PERMISSION_PROFILES.find((p) => p.key === 'validation');
        assert.ok(validation?.permissions.includes('halls.validate'), JSON.stringify(validation));
        assert.equal(PERMISSION_LABELS['halls.validate'], 'Valider les salles et les établissements');
        assert.ok((ADMIN_PERMISSIONS as readonly string[]).includes('halls.validate'));
    });
});

describe('B. Validation : envoi, refus, renvoi, salle validée modifiée', () => {
    let hallId = '';

    test('création par la route = envoi en validation ; avis ADMIN_HALL_SUBMITTED (cloche, push, email) et SMS groupé', async () => {
        const post = await api('POST', 'partner/halls', {
            token: owner.accessToken,
            body: { name: 'Salle des Almadies 10b', capacity: 150, price_per_day: 150_000, city: 'Dakar', address: 'Route des Almadies' },
        });
        assert.equal(post.status, 201, show(post));
        const hall = post.body.hall as Row;
        hallId = String(hall.id);
        assert.equal(hall.validation_status, 'EN_ATTENTE_VALIDATION');
        const rows = (await outboxRows({ userId: validator.userId, type: 'ADMIN_HALL_SUBMITTED' })).filter((r) => (r.template_data as Row).hall_id === hallId);
        assert.deepEqual(channelsOf(rows), ['EMAIL', 'IN_APP', 'PUSH'], JSON.stringify(rows));
        const sms = await outboxRows({ userId: validator.userId, type: 'ADMIN_REVIEW_SMS' });
        assert.ok(sms.some((r) => Number((r.template_data as Row).hall_count ?? 0) >= 1), `SMS groupé : ${JSON.stringify(sms.map((r) => r.template_data))}`);
        const weak = await outboxRows({ userId: weakAdmin.userId, type: 'ADMIN_HALL_SUBMITTED' });
        assert.equal(weak.length, 0, 'administrateur sans le droit prévenu');
    });

    test('refus avec motif → avis à la partenaire sur les 4 canaux ; modifiée, elle reste refusée', async () => {
        const refused = await routeId('POST', 'admin/halls/[id]/validation', hallId, validator.accessToken, { decision: 'REFUSER', reason: 'Ajoutez des photos de la salle.' });
        assert.equal(refused.status, 200, show(refused));
        const rows = (await outboxRows({ userId: owner.userId, type: 'HALL_VALIDATION_DECIDED' })).filter((r) => (r.template_data as Row).hall_id === hallId);
        assert.deepEqual(channelsOf(rows), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], JSON.stringify(rows));
        const put = await routeId('PUT', 'partner/halls/[id]', hallId, owner.accessToken, { description: 'Grande salle climatisée.' });
        assert.equal(put.status, 200, show(put));
        const { data } = await service.from('halls').select('validation_status').eq('id', hallId).single();
        assert.equal(data!.validation_status, 'REFUSEE');
    });

    test('renvoi : incomplet refusé (400, en mots) ; autre partenaire, client : 404/403 ; complet → en attente', async () => {
        const incomplete = await routeId('POST', 'partner/halls/[id]/submit', hallId, owner.accessToken, {});
        assert.equal(incomplete.status, 400, show(incomplete));
        assert.match(String(incomplete.body.error), /ajoutez .*une photo au moins.*la position sur la carte/);
        const byOther = await routeId('POST', 'partner/halls/[id]/submit', hallId, other.accessToken, {});
        assert.equal(byOther.status, 404, show(byOther));
        const byClient = await routeId('POST', 'partner/halls/[id]/submit', hallId, alice.accessToken, {});
        assert.ok(byClient.status === 403 || byClient.status === 404, show(byClient));
        const put = await routeId('PUT', 'partner/halls/[id]', hallId, owner.accessToken, {
            images: [photoOf(owner.partnerId)], latitude: 14.745, longitude: -17.51,
        });
        assert.equal(put.status, 200, show(put));
        const ok = await routeId('POST', 'partner/halls/[id]/submit', hallId, owner.accessToken, {});
        assert.equal(ok.status, 200, show(ok));
        const { data } = await service.from('halls').select('validation_status').eq('id', hallId).single();
        assert.equal(data!.validation_status, 'EN_ATTENTE_VALIDATION');
        const again = await routeId('POST', 'partner/halls/[id]/submit', hallId, owner.accessToken, {});
        assert.equal(again.status, 409, show(again));
    });

    test('salle validée modifiée (prix, photos) : reste validée, avis ADMIN_HALL_CHANGED ; description seule : aucun avis', async () => {
        const v = await routeId('POST', 'admin/halls/[id]/validation', hallId, validator.accessToken, { decision: 'VALIDER' });
        assert.equal(v.status, 200, show(v));
        const before = (await outboxRows({ userId: validator.userId, type: 'ADMIN_HALL_CHANGED' })).filter((r) => (r.template_data as Row).hall_id === hallId).length;
        const desc = await routeId('PUT', 'partner/halls/[id]', hallId, owner.accessToken, { description: 'Description revue.' });
        assert.equal(desc.status, 200, show(desc));
        const afterDesc = (await outboxRows({ userId: validator.userId, type: 'ADMIN_HALL_CHANGED' })).filter((r) => (r.template_data as Row).hall_id === hallId).length;
        assert.equal(afterDesc, before, 'avis pour une description');
        const price = await routeId('PUT', 'partner/halls/[id]', hallId, owner.accessToken, { price_per_day: 175_000 });
        assert.equal(price.status, 200, show(price));
        const rows = (await outboxRows({ userId: validator.userId, type: 'ADMIN_HALL_CHANGED' })).filter((r) => (r.template_data as Row).hall_id === hallId);
        assert.ok(rows.length > afterDesc, 'aucun avis pour un changement de prix');
        assert.ok(rows.some((r) => JSON.stringify((r.template_data as Row).changes) === '["PRIX"]'), JSON.stringify(rows.map((r) => r.template_data)));
        const { data } = await service.from('halls').select('validation_status').eq('id', hallId).single();
        assert.equal(data!.validation_status, 'VALIDEE');
    });
});

describe('C. Photos : réencodées, du dossier de la partenaire seulement', () => {
    test('adresse extérieure, photo d’une autre partenaire : 400 IMAGE_ORIGIN_INVALID, rien d’écrit ; la sienne : 201', async () => {
        const name = `Salle photos 10b ${Date.now()}`;
        const bad = [
            'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800',
            photoOf(other.partnerId),
            `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')}/storage/v1/object/public/public-images/halls/${owner.partnerId}/photo.jpg`,
        ];
        for (const url of bad) {
            const r = await api('POST', 'partner/halls', { token: owner.accessToken, body: { name, capacity: 50, price_per_day: 50_000, images: [url] } });
            assert.equal(r.status, 400, `${url} : ${show(r)}`);
            assert.equal(r.body.code, 'IMAGE_ORIGIN_INVALID', show(r));
        }
        const { count } = await service.from('halls').select('id', { count: 'exact', head: true }).eq('name', name);
        assert.equal(count ?? 0, 0);
        const good = await api('POST', 'partner/halls', { token: owner.accessToken, body: { name, capacity: 50, price_per_day: 50_000, images: [photoOf(owner.partnerId)] } });
        assert.equal(good.status, 201, show(good));
    });
});

describe('D. Public : recherche, fiche, calendrier, devis', () => {
    let hall = '';
    let pending = '';
    let resId = '';
    const day = dayFromNow(75);

    before(async () => {
        hall = await newHall(owner, { price_per_day: 90_000 });
        pending = await newHall(owner, { validate: false });
        const r = await reserveRpc(alice, hall, { startDate: day, days: 2 });
        assert.equal(r.ok, true, JSON.stringify(r));
        resId = String(r.reservation_id);
    });

    test('recherche : salle validée servie, en attente absente ; date prise : salle exclue ; aucune donnée du client', async () => {
        const all = await api('GET', 'halls', { token: null, path: '/api/halls?limit=48' });
        assert.equal(all.status, 200, show(all));
        const ids = (all.body.halls as Row[]).map((h) => h.id);
        assert.ok(ids.includes(hall), 'salle validée absente');
        assert.ok(!ids.includes(pending), 'salle en attente servie');
        const busy = await api('GET', 'halls', { token: null, path: `/api/halls?date=${day}&days=1&limit=48&q=${encodeURIComponent('TEST Salle 10a')}` });
        assert.equal(busy.status, 200, show(busy));
        assert.ok(!(busy.body.halls as Row[]).some((h) => h.id === hall), 'salle prise ce jour-là servie');
        const text = JSON.stringify(all.body) + JSON.stringify(busy.body);
        assert.ok(!text.includes(alice.userId) && !text.includes(resId), 'donnée de réservation servie');
        const bad = await api('GET', 'halls', { token: null, path: '/api/halls?date=hier' });
        assert.equal(bad.status, 400, show(bad));
        const past = await api('GET', 'halls', { token: null, path: `/api/halls?date=${dayFromNow(-2)}` });
        assert.equal(past.status, 400, show(past));
        assert.equal(past.body.error, 'Choisissez une date à venir.');
    });

    test('fiche : publique seulement (en attente : 404), règle d’annulation en mots ; calendrier : dates prises, rien sur le client', async () => {
        const pub = await routeId('GET', 'halls/[id]', hall, null);
        assert.equal(pub.status, 200, show(pub));
        assert.match(String((pub.body.hall as Row).cancellation), /^Règle Modérée/);
        assert.equal((await routeId('GET', 'halls/[id]', pending, null)).status, 404);
        const cal = await routeId('GET', 'halls/[id]/calendar', hall, null, undefined, `?from=${dayFromNow(70)}&to=${dayFromNow(80)}`);
        assert.equal(cal.status, 200, show(cal));
        const busy = cal.body.busy as Row[];
        assert.ok(busy.some((b) => b.startDate === day), JSON.stringify(busy));
        assert.ok(!JSON.stringify(cal.body).includes(alice.userId) && !JSON.stringify(cal.body).includes(resId));
        assert.equal((await routeId('GET', 'halls/[id]/calendar', pending, null)).status, 404);
        const tooLong = await routeId('GET', 'halls/[id]/calendar', hall, null, undefined, `?from=${dayFromNow(1)}&to=${dayFromNow(200)}`);
        assert.equal(tooLong.status, 400, show(tooLong));
    });

    test('devis : montants de hall_quote (aucun montant de la requête), rien d’écrit', async () => {
        const date = dayFromNow(120);
        const q = await routeId('GET', 'halls/[id]/quote', hall, null, undefined, `?date=${date}&mode=JOUR&units=2&total_amount=1`);
        assert.equal(q.status, 200, show(q));
        const { data: db } = await service.rpc('hall_quote', { p: { hall_id: hall, mode: 'JOUR', start_date: date, units: 2 } });
        const quote = q.body.quote as Row;
        assert.deepEqual([quote.priceAmount, quote.totalAmount, quote.depositAmount, quote.balanceAmount],
            [Number((db as Row).price_amount), Number((db as Row).total_amount), Number((db as Row).deposit_amount), Number((db as Row).balance_amount)]);
        assert.equal(quote.priceAmount, 180_000);
        const { count } = await service.from('hall_reservations').select('id', { count: 'exact', head: true }).eq('hall_id', hall).eq('start_date', date);
        assert.equal(count ?? 0, 0, 'le devis a écrit une réservation');
    });

    test('service fermé : routes publiques nouvelles en 404', async () => {
        await setPlatformSetting('features.halls_enabled', false);
        try {
            for (const r of [
                await api('GET', 'halls', { token: null }),
                await routeId('GET', 'halls/[id]/calendar', hall, null),
                await routeId('GET', 'halls/[id]/quote', hall, null, undefined, `?date=${dayFromNow(30)}&units=1`),
                await api('GET', 'partner/halls/reservations', { token: owner.accessToken }),
                await api('GET', 'partner/halls/earnings', { token: owner.accessToken }),
                await routeId('POST', 'partner/halls/[id]/submit', hall, owner.accessToken, {}),
            ]) assert.equal(r.status, 404, show(r));
        } finally {
            await setPlatformSetting('features.halls_enabled', true);
        }
    });
});

describe('E. Client : ses réservations seulement, aperçu = remboursement réel', () => {
    let hall = '';
    let resId = '';

    before(async () => {
        hall = await newHall(owner, { price_per_day: 200_000, cancellation_policy: 'MODEREE' });
        const r = await reserveRpc(alice, hall, { startDate: dayFromNow(20), days: 1 });
        assert.equal(r.ok, true, JSON.stringify(r));
        resId = String(r.reservation_id);
    });

    test('réservation demandée : avis HALL_RESERVATION_PENDING au client sur les 4 canaux', async () => {
        const rows = (await outboxRows({ userId: alice.userId, type: 'HALL_RESERVATION_PENDING' })).filter((r) => (r.template_data as Row).reservation_id === resId);
        assert.deepEqual(channelsOf(rows), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], JSON.stringify(rows));
    });

    test('liste et détail : le client voit la sienne ; un autre client : absente de sa liste, 404 sur le détail et l’aperçu', async () => {
        const mine = await api('GET', 'halls/reservations', { token: alice.accessToken });
        assert.equal(mine.status, 200, show(mine));
        assert.ok((mine.body.reservations as Row[]).some((r) => r.id === resId));
        const theirs = await api('GET', 'halls/reservations', { token: bob.accessToken });
        assert.ok(!(theirs.body.reservations as Row[]).some((r) => r.id === resId), 'réservation d’un autre servie');
        assert.equal((await routeId('GET', 'halls/reservations/[id]', resId, bob.accessToken)).status, 404);
        assert.equal((await routeId('GET', 'halls/reservations/[id]/cancel', resId, bob.accessToken)).status, 404);
        assert.equal((await api('GET', 'halls/reservations', { token: null })).status, 401);
        const detail = await routeId('GET', 'halls/reservations/[id]', resId, alice.accessToken);
        assert.equal(detail.status, 200, show(detail));
        const r = detail.body.reservation as Row;
        assert.equal(r.stateLabel, 'À payer pour garder la date');
        assert.deepEqual((r.canPay as Row).parts, ['ACOMPTE', 'INTEGRAL']);
        assert.ok(!/[A-Z]{2,}_[A-Z]/.test(String(r.stateLabel)));
    });

    test('acompte payé, puis aperçu : montant égal au remboursement réel de l’annulation', async () => {
        await payConfirmed(alice, resId, 'ACOMPTE');
        const detail = await routeId('GET', 'halls/reservations/[id]', resId, alice.accessToken);
        assert.deepEqual(((detail.body.reservation as Row).canPay as Row).parts, ['SOLDE']);
        const preview = await routeId('GET', 'halls/reservations/[id]/cancel', resId, alice.accessToken);
        assert.equal(preview.status, 200, show(preview));
        const p = preview.body.preview as Row;
        const cancel = await routeId('POST', 'halls/reservations/[id]/cancel', resId, alice.accessToken, {});
        assert.equal(cancel.status, 200, show(cancel));
        const row = await reservation(resId);
        assert.equal(Number(p.refundAmount), Number(row.refunded_amount), `aperçu ${JSON.stringify(p)} ; réservation ${JSON.stringify(row)}`);
        assert.ok(Number(p.refundAmount) > 0);
        assert.match(String(p.message), /^Si vous annulez maintenant, vous serez remboursé de /);
    });
});

describe('F. Salle : ses réservations, coordonnées après paiement, annulation, recettes', () => {
    let hall = '';
    let resId = '';

    before(async () => {
        hall = await newHall(owner, { price_per_day: 120_000 });
        const r = await reserveRpc(bob, hall, { startDate: dayFromNow(40), days: 1 });
        assert.equal(r.ok, true, JSON.stringify(r));
        resId = String(r.reservation_id);
    });

    test('calendrier et détail : propriétaire seulement ; téléphone du client caché tant que rien n’est payé', async () => {
        const from = dayFromNow(35);
        const to = dayFromNow(45);
        const mine = await api('GET', 'partner/halls/reservations', { token: owner.accessToken, path: `/api/partner/halls/reservations?from=${from}&to=${to}` });
        assert.equal(mine.status, 200, show(mine));
        const row = (mine.body.reservations as Row[]).find((r) => r.id === resId);
        assert.ok(row, 'réservation absente du calendrier de la salle');
        assert.equal(row!.clientPhone, null);
        const theirs = await api('GET', 'partner/halls/reservations', { token: other.accessToken, path: `/api/partner/halls/reservations?from=${from}&to=${to}` });
        assert.ok(!(theirs.body.reservations as Row[]).some((r) => r.id === resId), 'réservation d’une autre salle servie');
        assert.equal((await routeId('GET', 'partner/halls/reservations/[id]', resId, other.accessToken)).status, 404);
        assert.equal((await routeId('GET', 'partner/halls/reservations/[id]', resId, bob.accessToken)).status, 403);
        await payConfirmed(bob, resId, 'ACOMPTE');
        const detail = await routeId('GET', 'partner/halls/reservations/[id]', resId, owner.accessToken);
        assert.equal(detail.status, 200, show(detail));
        assert.equal((detail.body.reservation as Row).clientPhone, bob.phoneE164, 'téléphone du client après paiement');
        const requested = (await outboxRows({ userId: owner.userId, type: 'HALL_RESERVATION_REQUESTED' })).filter((r) => (r.template_data as Row).reservation_id === resId);
        assert.deepEqual(channelsOf(requested), ['EMAIL', 'IN_APP', 'PUSH', 'SMS']);
    });

    test('annulation par la salle : motif obligatoire ; client remboursé en entier ; avis sur les 4 canaux', async () => {
        const noReason = await routeId('POST', 'partner/halls/reservations/[id]/status', resId, owner.accessToken, { action: 'CANCEL', reason: '' });
        assert.ok(noReason.status >= 400 && noReason.status < 500, show(noReason));
        const byOther = await routeId('POST', 'partner/halls/reservations/[id]/status', resId, other.accessToken, { action: 'CANCEL', reason: 'Salle indisponible ce jour.' });
        assert.ok(byOther.status === 404 || byOther.status === 403, show(byOther));
        const ok = await routeId('POST', 'partner/halls/reservations/[id]/status', resId, owner.accessToken, { action: 'CANCEL', reason: 'Dégât des eaux dans la salle.' });
        assert.equal(ok.status, 200, show(ok));
        const row = await reservation(resId);
        assert.deepEqual([row.booking_state, Number(row.refunded_amount)], ['ANNULEE_SALLE', Number(row.paid_amount)]);
        const pro = (await outboxRows({ userId: owner.userId, type: 'HALL_RESERVATION_CANCELLED_PRO' })).filter((r) => (r.template_data as Row).reservation_id === resId);
        assert.deepEqual(channelsOf(pro), ['EMAIL', 'IN_APP', 'PUSH', 'SMS']);
    });

    test('recettes : la partenaire ne voit que les siennes ; un client : 403', async () => {
        const mine = await api('GET', 'partner/halls/earnings', { token: owner.accessToken });
        assert.equal(mine.status, 200, show(mine));
        const theirs = await api('GET', 'partner/halls/earnings', { token: other.accessToken });
        assert.equal(theirs.status, 200, show(theirs));
        assert.ok(!(theirs.body.rows as Row[]).some((r) => r.reservationId === resId), 'recettes d’une autre salle servies');
        assert.equal((await api('GET', 'partner/halls/earnings', { token: alice.accessToken })).status, 403);
    });
});

describe('G. Administration : file et fiche avec halls.validate seulement', () => {
    test('sans le droit : 403 ; avec : la salle en attente est dans la file, fiche lisible', async () => {
        const pending = await newHall(other, { validate: false });
        assert.equal((await api('GET', 'admin/halls', { token: weakAdmin.accessToken })).status, 403);
        assert.equal((await api('GET', 'admin/halls', { token: oldValidator.accessToken })).status, 403);
        assert.equal((await api('GET', 'admin/halls', { token: owner.accessToken })).status === 200, false);
        const list = await api('GET', 'admin/halls', { token: validator.accessToken, path: '/api/admin/halls?status=EN_ATTENTE_VALIDATION&page=1' });
        assert.equal(list.status, 200, show(list));
        assert.ok(Number((list.body.counts as Row).EN_ATTENTE_VALIDATION) >= 1);
        const sheet = await routeId('GET', 'admin/halls/[id]', pending, validator.accessToken);
        assert.equal(sheet.status, 200, show(sheet));
        assert.equal((sheet.body.hall as Row).statusLabel, 'En attente de validation');
        assert.equal((await routeId('GET', 'admin/halls/[id]', pending, weakAdmin.accessToken)).status, 403);
        const badFilter = await api('GET', 'admin/halls', { token: validator.accessToken, path: '/api/admin/halls?status=TOUT' });
        assert.equal(badFilter.status, 400, show(badFilter));
    });
});

describe('H. Réglage halls.max_pending_per_client', () => {
    test('limite à 1 : deuxième attente refusée (429, en mots) ; valeur d’origine rendue', async () => {
        const before = await platformSetting('halls.max_pending_per_client');
        assert.equal(before, 3);
        const hallA = await newHall(owner);
        const hallB = await newHall(owner);
        const carol = await newBuyer('l10b-carol');
        await setPlatformSetting('halls.max_pending_per_client', 1);
        try {
            const a = await reserveRpc(carol, hallA, { startDate: dayFromNow(90) });
            assert.equal(a.ok, true, JSON.stringify(a));
            const b = await reserveRpc(carol, hallB, { startDate: dayFromNow(91) });
            assert.deepEqual([b.ok, b.code, b.message], [false, 'TOO_MANY_PENDING', 'Vous avez déjà une réservation en attente de paiement. Payez-la ou attendez qu’elle se libère.']);
        } finally {
            await setPlatformSetting('halls.max_pending_per_client', before);
        }
        const { data } = await service.rpc('fin_setting_valid', { p_key: 'halls.max_pending_per_client', v: 11 });
        assert.equal(data, false, 'borne supérieure 10');
    });
});
