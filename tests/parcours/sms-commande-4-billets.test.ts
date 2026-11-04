/**
 * Lot 7, tâche 7.0 d — preuve demandée au lot 6 : une commande de 4 billets donne exactement 1 SMS d'achat
 * et 1 seul SMS de rappel J-1 pour l'acheteur (contrat, section 4.4 ; discovery-7-dette.md §d.2).
 *  - achat de 4 billets payés par le vrai parcours (checkout, faux SamirPay, webhook : buyConfirmed) ;
 *  - envoyeur ; planification du J-1 à la veille simulée (deux fois) ; envoyeur (deux fois) ;
 *  - SMS comptés par différence sur le numéro neuf de l'acheteur (faux MTarget) : la liste exacte est
 *    [confirmation « 4 billets », rappel J-1] ; une seule ligne PURCHASE_CONFIRMED…:SMS (ticket_count = 4)
 *    et une seule ligne REMINDER_J1:<événement>:<acheteur>:<début>:SMS.
 * Couverture ajoutée, verte dès l'écriture (le comportement est déjà celui-là : clé PURCHASE_CONFIRMED par
 * paiement, clé J-1 par porteur et par événement). Elle reste au lot pour figer la règle : un correctif qui
 * enverrait un SMS par billet la rendrait rouge.
 * Horloge simulée : seulement par `now` de scheduleAt / dispatchAt, jour futur tiré au hasard (le budget
 * optionnel du jour simulé n'est consommé par aucune autre suite).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { newBuyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import {
    createReminderEvent, dakarAt, dakarDay, dispatchAt, outboxRows, scheduleAt, smsMark, smsTo, withNotifSettings,
    type NotifSettingKey,
} from './notif-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

after(async () => {
    await assertTerrainInvariants('sms-commande-4-billets');
});

const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 5_000, total: 20, maxPerOrder: 10 }];

/** Réglages des rappels au défaut du contrat (I1 du lot 6) : J-1 à 10 h, SMS toujours, silence 22 h - 8 h. */
const REMINDER_DEFAULTS: Partial<Record<NotifSettingKey, unknown>> = {
    'notif.reminder_j1_enabled': true,
    'notif.reminder_j1_hour': 10,
    'notif.j1_sms': 'ALWAYS',
    'notif.sms_quiet_start': 22,
    'notif.sms_quiet_end': 8,
};

let partner: TestPartner;

before(async () => {
    partner = await newPartner('commande-4');
});

/** Début de l'événement dans la clé d'idempotence (AAAAMMJJ"T"HH24MI"Z", UTC). */
function startKey(d: Date): string {
    const iso = d.toISOString();
    return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
}

describe('7.0 d Commande de 4 billets : exactement 1 SMS d’achat et 1 SMS J-1 pour l’acheteur', () => {
    test('achat de 4 billets payés, envoyeur, J-1 planifié et envoyé deux fois : [confirmation « 4 billets », rappel J-1], une ligne SMS de chaque', async () => {
        const day = dakarDay(60 + randomInt(0, 600));
        const eve = dakarDay(-1, new Date(`${day}T12:00:00.000Z`));
        const title = `Commande ${randomBytes(3).toString('hex')}`;
        const ev = await createReminderEvent(partner, 'commande-4', {
            startDate: day, startTime: '20:00', categories: CATEGORIES, title, location: 'Salle Sorano', city: 'Dakar',
        });
        const buyer = await newBuyer('commande-4');
        const mark = smsMark(buyer.phoneE164);

        const purchase = await buyConfirmed(buyer, ev, [[STANDARD, 4]]);
        assert.equal(purchase.tickets.length, 4, `4 billets émis (${purchase.tickets.length})`);
        const paymentId = String(purchase.payment.id);
        const queued = await outboxRows({ type: 'PURCHASE_CONFIRMED', keyPrefix: `PURCHASE_CONFIRMED:${paymentId}:` });
        assert.ok(queued.length > 0, 'confirmation d’achat mise en file par payment_confirm');
        await dispatchAt(new Date(), { ids: queued.map((r) => r.id) });

        await withNotifSettings(REMINDER_DEFAULTS, async () => {
            await scheduleAt(dakarAt(eve, '10:00:30'), [ev.eventId]);
            await scheduleAt(dakarAt(eve, '10:05'), [ev.eventId]);
            await dispatchAt(dakarAt(eve, '10:06'), { eventIds: [ev.eventId] });
            await dispatchAt(dakarAt(eve, '10:08'), { eventIds: [ev.eventId] });
        });

        const purchaseSms = await outboxRows({ type: 'PURCHASE_CONFIRMED', keyPrefix: `PURCHASE_CONFIRMED:${paymentId}:`, channel: 'SMS' });
        assert.equal(purchaseSms.length, 1, `une seule ligne SMS de confirmation pour le paiement : ${JSON.stringify(purchaseSms.map((r) => r.idempotency_key))}`);
        assert.equal(purchaseSms[0].idempotency_key, `PURCHASE_CONFIRMED:${paymentId}:SMS`, 'clé par paiement');
        assert.equal(Number(purchaseSms[0].template_data.ticket_count), 4, `ticket_count = 4 (${JSON.stringify(purchaseSms[0].template_data)})`);
        assert.equal(purchaseSms[0].status, 'SENT', `confirmation envoyée (${purchaseSms[0].status} ${purchaseSms[0].reason})`);

        const j1 = await outboxRows({ type: 'REMINDER_J1', eventId: ev.eventId, userId: buyer.userId, channel: 'SMS' });
        assert.equal(j1.length, 1, `une seule ligne SMS J-1 pour l'acheteur : ${JSON.stringify(j1.map((r) => r.idempotency_key))}`);
        assert.equal(j1[0].idempotency_key, `REMINDER_J1:${ev.eventId}:${buyer.userId}:${startKey(ev.startAt)}:SMS`, 'clé par porteur et par événement');
        assert.equal(j1[0].status, 'SENT', `rappel J-1 envoyé (${j1[0].status} ${j1[0].reason})`);
        const held = (j1[0].decision?.holder as { valid_ticket_ids?: unknown[] } | undefined)?.valid_ticket_ids ?? [];
        assert.equal(held.length, 4, `instantané : les 4 billets du porteur (${JSON.stringify(j1[0].decision)})`);

        const messages = smsTo(buyer.phoneE164, mark).map((m) => m.message);
        assert.equal(messages.length, 2, `SMS reçus par l'acheteur : exactement 2 (${JSON.stringify(messages)})`);
        assert.match(messages[0], /^Event Village : achat confirmé, 4 billets /, `1er SMS : confirmation de la commande de 4 billets (${messages[0]})`);
        assert.equal(messages[1], `Event Village : rappel, ${title} demain à 20:00, Salle Sorano. Vos billets : ${(process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '')}/tickets`,
            `2e SMS : rappel J-1, texte exact (${messages[1]})`);
        assert.equal(messages.filter((m) => /achat confirmé/.test(m)).length, 1, 'un seul SMS d’achat');
        assert.equal(messages.filter((m) => /^Event Village : rappel, /.test(m)).length, 1, 'un seul SMS J-1');
    });
});
