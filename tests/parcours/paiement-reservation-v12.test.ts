/**
 * Lot 9 bis, tâche H2 — réservation des places (réglage SUPERADMIN, 10 minutes par défaut) contre validité du paiement
 * SamirPay (1 heure). Consigne H2 ; contrat 5.55, 4.1, 12, B103 ; découverte 9bis/discovery-9bis-samirpay.md section 3.
 *  1. le SUPERADMIN règle finance.payment_hold_minutes à 7 : un checkout garde les places 7 minutes
 *     (held_expires_at), la route de statut rend holdMinutes = 7 et paymentDeadline = création + 60 minutes ;
 *  2. bornes : 4 et 61 refusés (INVALID_VALUE), 5 et 60 acceptés ; un ADMIN est refusé (FORBIDDEN) ;
 *  3. sans modification, la réservation dure 10 minutes (valeur posée par la migration M01) ;
 *  4. statique : /paiement/[id] dit « Vos places sont gardées {N} minutes… », puis « Vos places ne sont plus
 *     garanties… » et « Confirmation non reçue » ; « Le délai de paiement est écoulé » disparaît.
 *
 * Rouge aujourd'hui : clé absente (finance_setting_set rend UNKNOWN_KEY, 20261105000001_lot7_reglages.sql:123) ; la
 * réservation suit PAYMENT_HOLD_MINUTES, 15 minutes (lib/env.ts:68) ; holdMinutes et paymentDeadline absents de la route
 * de statut ; textes de la page (app/paiement/[id]/page.tsx:217-224, :818).
 * after() : assertLot9bisInvariants (garde de schéma rouge jusqu'aux migrations du lot).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { cart, checkout, createSaleEvent, newBuyer, paymentById, pollStatus, service, type SaleEvent } from './paiement-helpers';
import { superadminId } from './finance-helpers';
import { getPlatformSetting, newAdminWith, withSettings } from './terrain-helpers';

type Row = Record<string, unknown>;

const KEY = 'finance.payment_hold_minutes';
const MINUTE = 60_000;
/** Tolérance entre now() du serveur et l'horloge du test. */
const TOLERANCE_MS = 60_000;
const PAGE = 'app/paiement/[id]/page.tsx';

let ev: SaleEvent;

before(async () => {
    ev = await createSaleEvent('reservation-v12', [{ name: 'Standard', price: 2_000, total: 60, maxPerOrder: 5 }]);
});

after(async () => {
    await assertLot9bisInvariants('paiement-reservation-v12');
});

async function settingSet(value: unknown, actor: string): Promise<Row> {
    const { data, error } = await service.rpc('finance_setting_set', { p_key: KEY, p_value: { value }, p_actor: actor, p_reason: 'test du lot 9 bis (H2)' });
    assert.equal(error, null, `finance_setting_set(${KEY}, ${String(value)}) : ${error?.message}`);
    return (data ?? {}) as Row;
}

/** Checkout d'un acheteur neuf ; minutes de réservation lues sur le paiement créé (held_expires_at − maintenant). */
async function holdOf(label: string): Promise<{ minutes: number; paymentId: string; token: string }> {
    const buyer = await newBuyer(`resa-${label}`);
    const before0 = Date.now();
    const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
    assert.equal(r.status, 200, `checkout : HTTP ${r.status} ${JSON.stringify(r.body)}`);
    const p = await paymentById(r.payment!.id);
    assert.ok(p.held_expires_at, 'précondition : réservation datée');
    return { minutes: (Date.parse(String(p.held_expires_at)) - before0) / MINUTE, paymentId: p.id, token: buyer.accessToken };
}

describe('H2 — durée de réservation réglable par le SUPERADMIN (B103)', () => {
    test('1. réglage à 7 minutes : places gardées 7 minutes ; statut : holdMinutes 7 et paymentDeadline = création + 60 minutes', async () => {
        await withSettings({ [KEY]: 7 }, async () => {
            const h = await holdOf('sept');
            assert.ok(Math.abs(h.minutes - 7) * MINUTE <= TOLERANCE_MS, `réservation de 7 minutes (aujourd’hui PAYMENT_HOLD_MINUTES) : ${h.minutes.toFixed(2)} min`);
            const s = await pollStatus(h.token, h.paymentId);
            assert.equal(s.status, 200, JSON.stringify(s.body));
            const created = Date.parse(String((await paymentById(h.paymentId)).created_at));
            assert.deepEqual({ hold: s.body.holdMinutes, deadline: Date.parse(String(s.body.paymentDeadline)) }, { hold: 7, deadline: created + 60 * MINUTE },
                `holdMinutes et paymentDeadline (contrat 4.1) : ${JSON.stringify(s.body).slice(0, 400)}`);
        });
    });

    test('2. bornes : 4 et 61 refusés (INVALID_VALUE), 5 et 60 acceptés ; un ADMIN est refusé (FORBIDDEN)', async () => {
        const actor = await superadminId();
        for (const bad of [4, 61, 7.5]) {
            const r = await settingSet(bad, actor);
            assert.deepEqual([r.ok, r.code], [false, 'INVALID_VALUE'], `valeur ${bad} refusée (5 à 60, entier) : ${JSON.stringify(r)}`);
        }
        for (const good of [5, 60]) await withSettings({ [KEY]: good }, async () => assert.equal(await getPlatformSetting(KEY), good, `valeur ${good} acceptée`));
        const admin = await newAdminWith(['payments.read'], { label: 'resa-admin' });
        const r = await settingSet(8, admin.userId);
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', admin.userId);
        assert.equal(error, null, `administrateur de test suspendu : ${error?.message}`);
        assert.deepEqual([r.ok, r.code], [false, 'FORBIDDEN'], `réglage réservé au SUPERADMIN : ${JSON.stringify(r)}`);
    });

    test('3. sans modification : 10 minutes (valeur par défaut posée par la migration)', async () => {
        assert.equal(await getPlatformSetting(KEY), 10, 'valeur par défaut du réglage (contrat 12)');
        const h = await holdOf('defaut');
        assert.ok(Math.abs(h.minutes - 10) * MINUTE <= TOLERANCE_MS, `réservation de 10 minutes (aujourd’hui 15) : ${h.minutes.toFixed(2)} min`);
    });
});

describe('H2 — page d’attente : durée de garde dite, paiement suivi jusqu’à 1 heure (statique)', () => {
    test('4. « Vos places sont gardées … minutes », « Vos places ne sont plus garanties… », « Confirmation non reçue » ; plus « Le délai de paiement est écoulé »', () => {
        const source = fs.readFileSync(path.join(process.cwd(), PAGE), 'utf8').replace(/&apos;|&rsquo;|’/g, "'").replace(/\s+/g, ' ');
        for (const part of [
            'Vos places sont gardées',
            "minutes. Validez le paiement sur votre téléphone avant l'échéance.",
            "Vos places ne sont plus garanties. Si vous validez quand même le paiement, vos billets seront émis s'il reste des places ; sinon vous serez remboursé automatiquement.",
            'Confirmation non reçue',
        ]) assert.ok(source.includes(part), `${PAGE} : texte du contrat 5.55 absent : « ${part} »`);
        assert.equal(source.includes('Le délai de paiement est écoulé'), false, `${PAGE} : « Le délai de paiement est écoulé » est faux (le paiement reste valable 1 h)`);
    });
});
