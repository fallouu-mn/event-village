/**
 * Lot 9 bis, tâche 43 (R98 ; contrat 5.43, B90) — le quota d'invitations par numéro (INVITE_PER_PHONE_DAY, portée
 * `invite_phone`) ne compte que les SMS qui partent réellement :
 *  1. contrôleur déjà activé, affecté à 4 événements le même jour avec INVITE_PER_PHONE_DAY=3 : la 4ᵉ affectation est
 *     acceptée, aucun SMS d'activation ne part, le compteur du numéro reste à 0 ;
 *  2. client existant : étape de confirmation (aucun SMS), puis confirmation (`confirm_promotion`) : une seule unité
 *     comptée ;
 *  3. numéro neuf dont le SMS d'activation est refusé par le faux MTarget : l'unité est rendue (compteur à 0).
 * Le quota par partenaire (INVITE_PER_PARTNER_HOUR) reste compté à chaque essai : il est relevé ici pour ne pas gêner.
 * Compteurs lus par numéro (quota_counters, bucket = numéro E.164), jamais globalement ; fenêtre du jour alignée.
 *
 * Rouge avant correctif (fix(9b.43) de S-E : quota_release, M11 ; fix(9b.43-SC) : app/api/partner/team/invite/route.ts) :
 * `invite_phone` est réservé avant tout contrôle, à chaque appel (route :95-105) : 429 PHONE_INVITE_RATE_LIMIT à la 4ᵉ
 * affectation, 2 unités pour confirmation + confirmation, 1 unité pour un SMS refusé (aucun retour arrière).
 * after() : la garde de schéma du lot 9 bis nomme les objets absents jusqu'à M12 (attendu, contrat section 10).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { getFakes } from '../fakes';
import { randomSenegalPhone } from './helpers';
import { newBuyer, service, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController, type RouteResult } from './acces-helpers';
import { withEnv } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { alignQuotaWindow, assertSameQuotaWindow } from './terrain-helpers';

type Row = Record<string, unknown>;

const INVITE_ROUTE = '../../app/api/partner/team/invite/route';
const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 3_000, total: 20 }];
const LIMITS = { INVITE_PER_PHONE_DAY: '3', INVITE_PER_PARTNER_HOUR: '1000' };

let partner: TestPartner;
let events: SaleEvent[];

before(async () => {
    partner = await newPartner('quota-invit');
    events = [];
    for (let i = 0; i < 4; i++) events.push(await createTimedEvent(partner.partnerId, `quota-invit-${i}`, CATEGORIES, { startsInHours: 48 + i }));
});

after(async () => {
    await assertLot9bisInvariants('invitations-controleur-quota');
});

async function invite(body: Row): Promise<RouteResult> {
    const handler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/team/invite');
    return invoke(handler, jsonRequest('/api/partner/team/invite', 'POST', partner.accessToken, body));
}

async function invitePhoneHits(phone: string): Promise<number> {
    const { data, error } = await service.from('quota_counters').select('hits').eq('scope', 'invite_phone').eq('bucket', phone);
    assert.equal(error, null, `quota_counters : ${error?.message}`);
    return (data ?? []).reduce((sum, r) => sum + Number(r.hits), 0);
}

async function assignedEvents(userId: string): Promise<string[]> {
    const { data, error } = await service.from('event_controllers').select('event_id').eq('user_id', userId);
    assert.equal(error, null, `affectations : ${error?.message}`);
    return (data ?? []).map((r) => String(r.event_id)).sort();
}

describe('R98 — invite_phone ne compte que les SMS envoyés', () => {
    test('contrôleur déjà activé, 4 affectations le même jour (limite 3) : la 4ᵉ est acceptée, aucun SMS, compteur à 0', async () => {
        const ctrl = await newController(partner, null, { label: 'quota-etabli' });
        await withEnv(LIMITS, async () => {
            const win = await alignQuotaWindow(86_400, 60_000);
            const since = getFakes().sms.messagesTo(ctrl.phoneE164).length;
            const results: RouteResult[] = [];
            for (const ev of events) results.push(await invite({ phone: ctrl.phoneE164, event_ids: [ev.eventId] }));
            await assertSameQuotaWindow(win, 'quatre affectations');
            assert.deepEqual(results.map((r) => r.status < 300), [true, true, true, true],
                `les 4 affectations d’un compte établi sont acceptées (aujourd’hui 429 à la 4ᵉ) : ${results.map(show).join(' | ')}`);
            assert.deepEqual(await assignedEvents(ctrl.userId), events.map((e) => e.eventId).sort(), 'affecté aux 4 événements');
            assert.equal(getFakes().sms.messagesTo(ctrl.phoneE164).length - since, 0, 'aucun SMS d’activation pour un compte établi');
            assert.equal(await invitePhoneHits(ctrl.phoneE164), 0, 'compteur invite_phone du numéro : aucune unité sans SMS');
        });
    });

    test('client existant : étape de confirmation puis confirmation → une seule unité', async () => {
        const client = await newBuyer('quota-client');
        await withEnv(LIMITS, async () => {
            const win = await alignQuotaWindow(86_400, 60_000);
            const ask = await invite({ phone: client.phoneE164, event_ids: [events[0].eventId] });
            assert.equal(ask.status, 200, show(ask));
            assert.equal(ask.body.requires_confirmation, true, `étape de confirmation : ${show(ask)}`);
            assert.equal(await invitePhoneHits(client.phoneE164), 0, 'l’étape de confirmation n’envoie rien : aucune unité');
            const confirmed = await invite({ phone: client.phoneE164, event_ids: [events[0].eventId], confirm_promotion: true });
            assert.ok(confirmed.status < 300, show(confirmed));
            await assertSameQuotaWindow(win, 'confirmation');
            assert.equal(await invitePhoneHits(client.phoneE164), 1, 'une seule unité pour la confirmation (aujourd’hui 2)');
        });
    });

    test('numéro neuf, SMS d’activation refusé par le fournisseur : l’unité est rendue, compteur à 0', async () => {
        const phone = randomSenegalPhone('76');
        await withEnv(LIMITS, async () => {
            const win = await alignQuotaWindow(86_400, 60_000);
            getFakes().sms.rejectNext();
            const res = await invite({ phone, event_ids: [events[1].eventId], first_name: 'Awa' });
            assert.equal(getFakes().sms.pendingScenarios(), 0, 'le refus programmé a bien été consommé par l’invitation');
            assert.ok(res.status < 300, show(res));
            assert.equal(res.body.sms_sent, false, `SMS refusé : ${show(res)}`);
            assert.equal(getFakes().sms.deliveredTo(phone).length, 0, 'aucun SMS remis');
            await assertSameQuotaWindow(win, 'invitation au SMS refusé');
            assert.equal(await invitePhoneHits(phone), 0, 'unité rendue par quota_release (aujourd’hui 1)');
        });
    });
});
