/**
 * Lot « Avis », phase 2 (étape 7) — pire cas de CHAQUE SMS ajouté ou modifié par le lot (sans base) : un seul SMS GSM-7
 * (160 caractères au plus, aucun caractère hors de l'alphabet de base ni de son extension), avec les valeurs les plus longues
 * réalistes (titre et noms de 110 caractères, montants de 9 999 999 F, compteurs à 99 et 999) et une adresse de l'application
 * de 27 caractères (https://app.eventvillage.sn, la plus longue admise au démarrage : lib/notifications/app-url-guard.ts).
 * Le calcul GSM-7 est fait ICI (table GSM 03.38), jamais par le module testé. Chaque longueur mesurée est imprimée (rapport).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { APP_URL_MAX_LENGTH, appUrlStartupProblem } from '../../lib/notifications/app-url-guard';

const CTX = { appUrl: 'https://app.eventvillage.sn' };
const BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const EXT = '^{}\\[~]|€';
const LONG = 'Grande soirée " Ndekk " - la nuit des étoiles du Sénégal et de la Teranga, avec Wally Seck et ses amis de Dakar et';
const LONG_NAME = 'Fatoumata Binetou Diallo Ndiaye épouse Sarr, gérante de la grande maison de la culture et des arts de Pikine Est';

function septets(text: string): number {
    let n = 0;
    for (const ch of text) {
        if (BASIC.includes(ch)) n += 1;
        else if (EXT.includes(ch)) n += 2;
        else return -1;
    }
    return n;
}

type Tpl = { sms?: (d: Record<string, unknown>, ctx: typeof CTX) => string; sample: Record<string, unknown> };
const tpl = (type: string): Tpl => (NOTIFICATION_CATALOG as unknown as Record<string, Tpl>)[type];

/** SMS ajoutés ou modifiés par le lot, au pire cas. */
const WORST: Array<[string, string, Record<string, unknown>]> = [
    ['A2 retrait demandé (Orange Money)', 'WITHDRAWAL_REQUESTED', { amount: 9_999_999, operator: 'ORANGE_MONEY', method: 'MOBILE_MONEY' }],
    ['A2 retrait demandé (virement)', 'WITHDRAWAL_REQUESTED', { amount: 9_999_999, operator: null, method: 'BANK' }],
    ['B1 billet reçu', 'TRANSFER_RECEIVED', { title: LONG }],
    ['B5 paiement d’un abonnement', 'PAYMENT_SUCCESS', { amount: 9_999_999, payment_target: 'SUBSCRIPTION' }],
    ['B5 paiement (autre cible)', 'PAYMENT_SUCCESS', { amount: 9_999_999, payment_target: 'OTHER' }],
    ['B6 livreur invité', 'ORDER_COURIER_INVITED', { partner_name: LONG }],
    ['B8 validations avec produits (cinq parties)', 'ADMIN_REVIEW_SMS', { partner_count: 99, event_count: 99, venue_count: 99, hall_count: 99, hall_changed_count: 99, product_count: 99, company: null }],
    ['B8 produits seuls', 'ADMIN_REVIEW_SMS', { partner_count: 0, event_count: 0, product_count: 999, company: null }],
    // Correctifs après contre-vérification (observation 3, ajout signalé) : trois rubriques, « A, B et C »
    ['B8 validations, trois rubriques', 'ADMIN_REVIEW_SMS', { partner_count: 999, event_count: 999, venue_count: 0, hall_count: 0, hall_changed_count: 0, product_count: 999, company: null }],
    ['B9 argent à vérifier (quatre parties à 99)', 'ADMIN_MONEY_SMS', { resume_count: 99, uncertain_count: 99, duplicate_count: 99, debt_count: 99 }],
    ['B9 argent à vérifier (quatre parties à 999)', 'ADMIN_MONEY_SMS', { resume_count: 999, uncertain_count: 999, duplicate_count: 999, debt_count: 999 }],
    ['C1 écart de caisse (prénom et initiale)', 'SHIFT_DISCREPANCY', { title: LONG, controller_name: LONG_NAME, difference: -9_999_999 }],
    ['C1 invitation acceptée (prénom et initiale)', 'CONTROLLER_INVITATION_ACCEPTED', { controller_name: LONG_NAME }],
    ['C1 contrôleur devenu administrateur', 'CONTROLLER_BECAME_ADMIN', { controller_name: LONG_NAME }],
    ['D2 commissions disponibles', 'REFERRAL_AVAILABLE', { amount: 9_999_999 }],
    ['D1 paiement non abouti (billets)', 'PAYMENT_NOT_COMPLETED', { target: 'TICKET', title: LONG }],
    ['D1 paiement non abouti (commande)', 'PAYMENT_NOT_COMPLETED', { target: 'ORDER', order_number: 'CMD-261205-A1B2C3D4E5F6G7H8' }],
    ['D1 paiement non abouti (salle)', 'PAYMENT_NOT_COMPLETED', { target: 'HALL_RESERVATION' }],
    ['D1 paiement non abouti (table)', 'PAYMENT_NOT_COMPLETED', { target: 'TABLE_RESERVATION' }],
    ['D1 paiement non abouti (abonnement)', 'PAYMENT_NOT_COMPLETED', { target: 'SUBSCRIPTION' }],
    ['D8 avant l’anonymisation', 'ACCOUNT_ANONYMIZATION_NOTICE', {}],
];

describe('étape 7 — pire cas de chaque SMS ajouté ou modifié', () => {
    for (const [label, type, over] of WORST) {
        test(`${label} (${type}) : un SMS GSM-7, 160 caractères au plus`, () => {
            const t = tpl(type);
            assert.ok(t.sms, `${type} : rendu SMS`);
            const text = t.sms!({ ...t.sample, ...over }, CTX);
            const n = septets(text);
            console.log(`[AVIS2-PIRE-CAS] ${type} | ${label} | ${n} septets | ${text}`);
            assert.ok(n >= 0, `${type} : caractère hors GSM-7 dans « ${text} »`);
            assert.ok(n <= 160, `${type} : ${n} septets (plus d'un SMS) : « ${text} »`);
            assert.doesNotMatch(text, /\.\.\.\./, `${type} : jamais « .... » (R74)`);
        });
    }

    test('C3 : adresse de 27 caractères admise, 28 refusée au démarrage en production, essai par tunnel exempté', () => {
        assert.equal(APP_URL_MAX_LENGTH, 27);
        assert.equal(CTX.appUrl.length, 27);
        assert.equal(appUrlStartupProblem({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://app.eventvillage.sn/' }), null);
        const refusal = appUrlStartupProblem({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://app2.eventvillage.sn' });
        assert.ok(refusal && /fait 28 caractères, 27 au plus/.test(refusal), String(refusal));
        assert.match(String(refusal), /Choisissez un domaine court/);
        assert.equal(appUrlStartupProblem({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://event-village-essai.trycloudflare.com', EV_DEV_TUNNEL_URL: 'https://event-village-essai.trycloudflare.com' }), null);
        assert.equal(appUrlStartupProblem({ NODE_ENV: 'test', NEXT_PUBLIC_APP_URL: 'http://localhost:3000/une/adresse/tres/longue' }), null);
    });
});
