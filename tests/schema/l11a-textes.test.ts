/**
 * Lot 11a — contrôles sans base : ce que voient les gens (aucun mot technique) et aucun calcul d'argent dans une route.
 *  1. États d'une réservation de table et statuts d'un établissement : libellés en français simple ;
 *  2. conditions d'annulation affichées avant le paiement, mot pour mot ;
 *  3. avis du parcours : tous les canaux (cloche, push, email, SMS) ; SMS d'un segment GSM-7 dans le pire cas (nom
 *     d'établissement très long, montants à 7 chiffres, 50 personnes) ; aucun mot technique dans aucun canal ;
 *  4. messages de refus des fonctions en base (migrations 20261123…) : ni code, ni statut en capitales ;
 *  5. routes et services : plus aucun calcul d'argent ni écriture directe d'une réservation de table hors de la base.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { TABLE_STATE_LABELS, VENUE_VALIDATION_LABELS, tableCancellationText, tableStartsAt, tableStateLabel } from '../../lib/tables/booking';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { smsSegments } from '../../lib/notifications/sms-format';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
const TECHNICAL = /\b[A-Z]{2,}_[A-Z_]+\b|\b(EN_ATTENTE|CONFIRMEE|ARRIVEE|ABSENT|EXPIREE|REFUSEE|VALIDEE|SUSPENDUE|MANUELLE|AUTO|ESPECES|SANS_REPONSE)\b/;

type Template = {
    channels: string[];
    family: string;
    sms?: (d: unknown, c: unknown) => string;
    inApp?: (d: unknown) => { title: string; content: string };
    push?: (d: unknown) => { title: string; body: string };
    sample: Record<string, unknown>;
};
const catalog = NOTIFICATION_CATALOG as unknown as Record<string, Template>;
const ctx = { appUrl: 'https://eventvillage.sn' };

describe('1. États et statuts en français simple', () => {
    test('les 11 états d’une réservation de table ont un libellé, aucun en capitales', () => {
        assert.deepEqual(Object.keys(TABLE_STATE_LABELS).sort(), [
            'ABSENT', 'ANNULEE_CLIENT', 'ANNULEE_ETABLISSEMENT', 'ANNULEE_EV', 'ARRIVEE', 'CONFIRMEE', 'EN_ATTENTE_ACCEPTATION',
            'EN_ATTENTE_PAIEMENT', 'EXPIREE', 'REFUSEE', 'SANS_REPONSE']);
        for (const label of [...Object.values(TABLE_STATE_LABELS), ...Object.values(VENUE_VALIDATION_LABELS)]) {
            assert.doesNotMatch(label, TECHNICAL, label);
            assert.match(label, /^[A-ZÉ][a-zéèêàçûô’' ]+(Event Village)?$/, label);
        }
        assert.equal(tableStateLabel('ABSENT'), 'Absent');
        assert.equal(tableStateLabel('EN_ATTENTE_ACCEPTATION'), 'En attente de réponse de l’établissement');
        assert.equal(tableStateLabel('INCONNU'), 'État inconnu');
    });
});

describe('2. Conditions d’annulation affichées avant le paiement', () => {
    test('avec acompte (2 h par défaut, 3 h réglées) et sans acompte', () => {
        assert.equal(tableCancellationText(20_000, 2), 'Acompte remboursé si vous annulez au moins 2 h avant l’heure, rien ensuite.');
        assert.equal(tableCancellationText(20_000, 3), 'Acompte remboursé si vous annulez au moins 3 h avant l’heure, rien ensuite.');
        assert.equal(tableCancellationText(0, 2), 'Réservation sans acompte : vous pouvez l’annuler jusqu’à l’heure prévue.');
    });

    // Contre-vérification de la 11a (T4, ajout signalé au rapport) : le texte tient compte de l'heure de la réservation
    test('avec l’heure de la réservation : à moins de 2 h, l’acompte ne sera pas remboursé ; à 2 h ou plus, la règle', () => {
        const now = new Date('2026-12-31T18:00:00Z');
        const late = 'Réservation à moins de 2 h de l’heure : si vous annulez, l’acompte payé ne sera pas remboursé.';
        const rule = 'Acompte remboursé si vous annulez au moins 2 h avant l’heure, rien ensuite.';
        assert.equal(tableCancellationText(20_000, 2, tableStartsAt('2026-12-31', '19:00'), now), late);
        assert.equal(tableCancellationText(20_000, 2, tableStartsAt('2026-12-31', '19:59'), now), late);
        assert.equal(tableCancellationText(20_000, 2, tableStartsAt('2026-12-31', '20:00'), now), rule);
        assert.equal(tableCancellationText(20_000, 3, tableStartsAt('2026-12-31', '20:30'), now),
            'Réservation à moins de 3 h de l’heure : si vous annulez, l’acompte payé ne sera pas remboursé.');
        assert.equal(tableCancellationText(0, 2, tableStartsAt('2026-12-31', '19:00'), now), 'Réservation sans acompte : vous pouvez l’annuler jusqu’à l’heure prévue.');
        // Heure de Dakar = UTC ; date illisible : texte de la règle, sans plantage
        assert.equal(tableStartsAt('2026-12-31', '19:00:00')?.toISOString(), '2026-12-31T19:00:00.000Z');
        assert.equal(tableStartsAt('31/12/2026', '19:00'), null);
        assert.equal(tableCancellationText(20_000, 2, tableStartsAt(null, '19:00'), now), rule);
        for (const text of [late, rule]) assert.doesNotMatch(text, TECHNICAL);
    });
});

describe('3. Avis du parcours : tous les canaux, SMS d’un segment, aucun mot technique', () => {
    const TYPES = [
        'TABLE_RESERVATION_CONFIRMED', 'TABLE_NEW_RESERVATION', 'TABLE_REQUEST_SENT', 'TABLE_REQUEST_TO_ANSWER', 'TABLE_REQUEST_REFUSED',
        'TABLE_REQUEST_EXPIRED', 'TABLE_HOLD_EXPIRED', 'TABLE_RESERVATION_CANCELLED', 'TABLE_RESERVATION_CANCELLED_PRO', 'TABLE_NO_SHOW',
        'TABLE_PAYMENT_REFUNDED', 'TABLE_REMINDER', 'VENUE_VALIDATION_DECIDED',
    ];
    test('chaque étape du parcours a son avis sur les 4 canaux ; le rappel est un avis optionnel (sujet « rappels »)', () => {
        for (const type of TYPES) {
            assert.ok(catalog[type], `${type} absent du catalogue`);
            assert.deepEqual([...catalog[type].channels].sort(), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], type);
            assert.equal(catalog[type].family, type === 'TABLE_REMINDER' ? 'OPTIONAL' : 'ESSENTIAL', type);
        }
        assert.deepEqual([...catalog.ADMIN_VENUE_SUBMITTED.channels].sort(), ['EMAIL', 'IN_APP', 'PUSH'], 'les admins ont aussi le SMS groupé');
    });

    const long = 'Restaurant Le Grand Bleu de la Corniche Ouest, terrasse panoramique';
    const base = {
        reservation_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59', venue_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59', venue_name: long,
        date: '2026-09-28', time: '23:45', end_time: '01:45', guests: 50, table_number: 'Terrasse 12 bis',
        deposit_amount: 9_999_999, total_amount: 9_999_999, paid_amount: 9_999_999, response_due_at: '2026-09-28T21:45:00Z',
        // Lot 11b (modification signalée au rapport) : code court de la réservation (lien des SMS) et heure de garde de la table
        short_code: 'k7m2p9x', held_until: '00:15',
    };
    const cases: Array<[string, Record<string, unknown>]> = [
        ['TABLE_RESERVATION_CONFIRMED', base],
        ['TABLE_RESERVATION_CONFIRMED', { ...base, total_amount: 0, paid_amount: 0, deposit_amount: 0 }],
        ['TABLE_NEW_RESERVATION', base],
        ['TABLE_REQUEST_SENT', base],
        ['TABLE_REQUEST_SENT', { ...base, total_amount: 0, paid_amount: 0, deposit_amount: 0 }],
        ['TABLE_REQUEST_TO_ANSWER', base],
        ['TABLE_REQUEST_REFUSED', { ...base, refund_amount: 9_999_999, reason: 'Complet ce soir-là, désolé pour ce contretemps imprévu' }],
        ['TABLE_REQUEST_REFUSED', { ...base, total_amount: 0, paid_amount: 0, refund_amount: 0 }],
        ['TABLE_REQUEST_EXPIRED', { ...base, refund_amount: 9_999_999 }],
        ['TABLE_REQUEST_EXPIRED', { ...base, total_amount: 0, paid_amount: 0, refund_amount: 0 }],
        ['TABLE_HOLD_EXPIRED', { ...base, paid_amount: 0 }],
        ['TABLE_RESERVATION_CANCELLED', { ...base, origin: 'CLIENT', refund_amount: 9_999_999 }],
        ['TABLE_RESERVATION_CANCELLED', { ...base, origin: 'CLIENT', refund_amount: 0 }],
        ['TABLE_RESERVATION_CANCELLED', { ...base, origin: 'CLIENT', total_amount: 0, paid_amount: 0, refund_amount: 0 }],
        ['TABLE_RESERVATION_CANCELLED', { ...base, origin: 'ETABLISSEMENT', refund_amount: 9_999_999, reason: 'Cuisine fermée' }],
        ['TABLE_RESERVATION_CANCELLED', { ...base, origin: 'EVENT_VILLAGE', refund_amount: 9_999_999 }],
        ['TABLE_RESERVATION_CANCELLED_PRO', { ...base, origin: 'CLIENT', refund_amount: 9_999_999 }],
        ['TABLE_RESERVATION_CANCELLED_PRO', { ...base, origin: 'SANS_REPONSE', refund_amount: 9_999_999 }],
        ['TABLE_RESERVATION_CANCELLED_PRO', { ...base, origin: 'EVENT_VILLAGE', refund_amount: 9_999_999 }],
        ['TABLE_NO_SHOW', base],
        ['TABLE_NO_SHOW', { ...base, total_amount: 0, paid_amount: 0 }],
        ['TABLE_PAYMENT_REFUNDED', { ...base, paid_amount: 0, payment_id: base.reservation_id, amount: 9_999_999, operator: 'ORANGE_MONEY' }],
        ['TABLE_REMINDER', base],
        ['VENUE_VALIDATION_DECIDED', { venue_id: base.venue_id, venue_name: long, decision: 'VALIDER' }],
        ['VENUE_VALIDATION_DECIDED', { venue_id: base.venue_id, venue_name: long, decision: 'REFUSER', reason: 'Photos de la salle et adresse exacte manquantes' }],
        ['VENUE_VALIDATION_DECIDED', { venue_id: base.venue_id, venue_name: long, decision: 'SUSPENDRE', reason: 'Contrôle d’hygiène en cours' }],
        ['VENUE_VALIDATION_DECIDED', { venue_id: base.venue_id, venue_name: long, decision: 'REACTIVER' }],
    ];
    for (const [type, data] of cases) {
        test(`${type} (${String(data.origin ?? data.decision ?? (Number(data.total_amount) > 0 ? 'acompte' : 'gratuite'))})`, () => {
            const t = catalog[type];
            const sms = t.sms!(data, ctx);
            const m = smsSegments(sms);
            assert.deepEqual([m.encoding, m.segments], ['GSM7', 1], `${m.length} : ${sms}`);
            assert.match(sms, /^Event Village : /);
            assert.doesNotMatch(sms, /(?<!\.)\.\.(?!\.)/, `double point : ${sms}`);
            const inApp = t.inApp!(data);
            for (const text of [sms, inApp.title, inApp.content]) assert.doesNotMatch(text, TECHNICAL, text);
            assert.doesNotMatch(inApp.content, /undefined|null|NaN/, inApp.content);
        });
    }
    test('échantillons du catalogue : aucun mot technique, SMS d’un segment', () => {
        for (const type of [...TYPES, 'ADMIN_VENUE_SUBMITTED']) {
            const t = catalog[type];
            const inApp = t.inApp!(t.sample);
            assert.doesNotMatch(`${inApp.title} ${inApp.content}`, TECHNICAL, type);
            if (t.sms) assert.equal(smsSegments(t.sms(t.sample, ctx)).segments, 1, type);
        }
    });
    test('SMS groupé des administrateurs : un établissement à valider', () => {
        const text = catalog.ADMIN_REVIEW_SMS.sms!({ partner_count: 0, event_count: 0, venue_count: 1 }, ctx);
        assert.equal(text, 'Event Village : 1 établissement(s) attendent votre validation : https://eventvillage.sn/admin/dashboard');
        const all = catalog.ADMIN_REVIEW_SMS.sms!({ partner_count: 2, event_count: 3, venue_count: 4 }, ctx);
        assert.equal(all, 'Event Village : 2 demande(s) de partenaire et 3 événement(s) et 4 établissement(s) attendent votre validation : https://eventvillage.sn/admin/dashboard');
    });
});

describe('4. Messages de refus des fonctions en base', () => {
    test('aucun code, aucun statut en capitales dans les messages des migrations 20261123…', () => {
        const dir = path.join(ROOT, 'supabase/migrations');
        const faults: string[] = [];
        let count = 0;
        for (const f of fs.readdirSync(dir).filter((x) => /^20261123\d{6}_l11a_/.test(x))) {
            const sql = fs.readFileSync(path.join(dir, f), 'utf8');
            for (const m of sql.matchAll(/'message',\s*(?:format\()?'((?:[^']|'')*)'/g)) {
                count += 1;
                if (TECHNICAL.test(m[1])) faults.push(`${f} : ${m[1]}`);
            }
        }
        assert.ok(count >= 40, `messages trouvés : ${count}`);
        assert.deepEqual(faults, [], faults.join('\n'));
    });
});

describe('5. Aucun calcul d’argent ni écriture directe d’une réservation de table hors de la base', () => {
    test('route de réservation, service des tables, paiement, confirmation, modération', () => {
        const reserve = read('app/api/restaurants/reserve-table/route.ts');
        assert.doesNotMatch(reserve, /depositPerPerson|5000|\.insert\(|from\('restaurant_tables'\)/, 'calcul ou écriture dans la route de réservation');
        assert.match(reserve, /rpc\('table_reserve'/);
        const service = read('lib/tables/table.service.ts');
        assert.doesNotMatch(service, /create_table_reservation_atomic|from\('table_reservations'\)\s*\.(insert|update|delete)/, 'écriture directe d’une réservation dans le service des tables');
        const pay = read('lib/payments/payment.service.ts');
        const tableCase = pay.slice(pay.indexOf("case 'TABLE_RESERVATION'"));
        assert.ok(tableCase.length > 0, 'branche des tables introuvable');
        assert.doesNotMatch(tableCase.slice(0, 600), /deposit_amount|payableAmount\s*=/, 'le chemin générique ne calcule plus le paiement d’une table');
        assert.match(read('lib/tables/table-payment.service.ts'), /rpcWithRetry<Record<string, unknown>>\('table_payment_create'/);
        const confirm = read('lib/payments/confirmation.service.ts');
        assert.doesNotMatch(confirm, /from\('table_reservations'\)\.update/, 'la confirmation n’écrit plus la réservation');
        const moderation = read('app/api/admin/services/route.ts');
        assert.match(moderation, /if \(table === 'table_reservations'\) \{[\s\S]*?rpc\('table_reservation_cancel'[\s\S]*?return NextResponse\.json/, 'la modération d’une demande de table passe par la fonction en base');
    });
});
