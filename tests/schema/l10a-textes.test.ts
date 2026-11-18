/**
 * Lot 10a — contrôles sans base : ce que voient les gens (aucun mot technique) et aucun calcul d'argent dans une route.
 *  1. États d'une réservation et statuts d'une salle : libellés en français simple, aucun code en capitales ;
 *  2. conditions d'annulation affichées avant le paiement, mot pour mot ;
 *  3. SMS du parcours : un segment GSM-7 dans le pire cas (nom de salle très long, montants à 8 chiffres) ;
 *  4. messages de refus des fonctions en base (migrations 20261122…) : ni code, ni statut en capitales ;
 *  5. routes et services : plus aucun calcul d'argent d'une réservation de salle hors de la base.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BOOKING_STATE_LABELS, HALL_VALIDATION_LABELS, bookingStateLabel, cancellationText } from '../../lib/halls/booking';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { smsSegments } from '../../lib/notifications/sms-format';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
const TECHNICAL = /\b[A-Z]{2,}_[A-Z_]+\b|\b(EN_ATTENTE|PAYEE|EXPIREE|VALIDEE|REFUSEE|SUSPENDUE|MORATOIRE)\b/;

describe('1. États et statuts en français simple', () => {
    test('les 8 états d’une réservation ont un libellé, aucun en capitales', () => {
        assert.deepEqual(Object.keys(BOOKING_STATE_LABELS).sort(),
            ['ACOMPTE_PAYE', 'ANNULEE_CLIENT', 'ANNULEE_EV', 'ANNULEE_SALLE', 'DELAI_DEPASSE', 'EN_ATTENTE_PAIEMENT', 'EXPIREE', 'PAYEE']);
        for (const label of [...Object.values(BOOKING_STATE_LABELS), ...Object.values(HALL_VALIDATION_LABELS)]) {
            assert.doesNotMatch(label, TECHNICAL, label);
            assert.match(label, /^[A-ZÉ][a-zéèêàçûô’' ]+(Event Village)?[a-zéèêàçûô ]*$/, label);
        }
        assert.equal(bookingStateLabel('DELAI_DEPASSE'), 'Délai de paiement dépassé');
        assert.equal(bookingStateLabel('EN_ATTENTE_PAIEMENT'), 'En attente de paiement');
        assert.equal(bookingStateLabel('INCONNU'), 'État inconnu');
    });
});

describe('2. Conditions d’annulation affichées avant le paiement', () => {
    test('souple, modérée, stricte (seuils par défaut)', () => {
        assert.equal(cancellationText({ policy: 'SOUPLE', partial_percent: 50, full_days: 7, partial_days: 0 }),
            'Règle Souple : remboursement total si vous annulez au moins 7 jours avant la date, 50 % ensuite.');
        assert.equal(cancellationText({ policy: 'MODEREE', partial_percent: 50, full_days: 30, partial_days: 7 }),
            'Règle Modérée : remboursement total si vous annulez au moins 30 jours avant la date, 50 % jusqu’à 7 jours avant, rien ensuite.');
        assert.equal(cancellationText({ policy: 'STRICTE', partial_percent: 50, full_days: null, partial_days: 30 }),
            'Règle Stricte : 50 % remboursés si vous annulez au moins 30 jours avant la date, rien ensuite.');
    });
});

describe('3. SMS du parcours : un segment GSM-7 dans le pire cas', () => {
    const long = 'Grande salle des fêtes Cheikh Anta Diop de Ngor-Almadies, espace VIP';
    const base = {
        reservation_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59', hall_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59', hall_name: long,
        start_date: '2026-09-28', end_date: '2026-09-30', mode: 'JOUR', total_amount: 99_999_999, paid_amount: 29_999_999,
    };
    const cases: Array<[string, Record<string, unknown>]> = [
        ['HALL_RESERVATION_CONFIRMED', { ...base, balance_amount: 99_999_999, balance_due_at: '2026-09-21T00:00:00Z' }],
        ['HALL_RESERVATION_CONFIRMED', { ...base, paid_amount: 99_999_999 }],
        ['HALL_RESERVATION_CONFIRMED', { ...base, end_date: '2026-09-28', start_time: '18:30', end_time: '23:30', balance_amount: 99_999_999, balance_due_at: '2026-09-21T00:00:00Z' }],
        ['HALL_BALANCE_REMINDER', { ...base, balance_amount: 99_999_999, balance_due_at: '2026-09-21T00:00:00Z' }],
        ['HALL_PAYMENT_DEADLINE_PASSED', { ...base, origin: 'DELAI', refund_amount: 0 }],
        ['HALL_PAYMENT_DEADLINE_PASSED', { ...base, origin: 'DELAI', refund_amount: 99_999_999 }],
        ['HALL_RESERVATION_CANCELLED', { ...base, origin: 'CLIENT', refund_amount: 0 }],
        ['HALL_RESERVATION_CANCELLED', { ...base, origin: 'CLIENT', refund_amount: 99_999_999 }],
        ['HALL_RESERVATION_CANCELLED', { ...base, origin: 'SALLE', refund_amount: 99_999_999 }],
        ['HALL_RESERVATION_CANCELLED', { ...base, origin: 'EVENT_VILLAGE', refund_amount: 99_999_999 }],
        ['HALL_PAYMENT_REFUNDED', { ...base, payment_id: base.reservation_id, amount: 99_999_999, operator: 'ORANGE_MONEY' }],
    ];
    const catalog = NOTIFICATION_CATALOG as unknown as Record<string, { sms?: (d: unknown, c: unknown) => string; channels: string[] }>;
    for (const [type, data] of cases) {
        test(`${type} (${String(data.origin ?? data.start_time ?? (data.balance_amount ? 'acompte' : 'payée'))})`, () => {
            const text = catalog[type].sms!(data, { appUrl: 'https://eventvillage.sn' });
            const m = smsSegments(text);
            assert.deepEqual([m.encoding, m.segments], ['GSM7', 1], `${m.length} : ${text}`);
            assert.doesNotMatch(text, TECHNICAL, text);
            assert.doesNotMatch(text, /(?<!\.)\.\.(?!\.)/, `double point : ${text}`);
        });
    }
    test('SMS seulement pour la confirmation, le rappel, le délai dépassé, l’annulation et le remboursement', () => {
        const withSms = Object.entries(catalog).filter(([type, t]) => type.startsWith('HALL_') && t.channels.includes('SMS')).map(([type]) => type).sort();
        assert.deepEqual(withSms, ['HALL_BALANCE_REMINDER', 'HALL_PAYMENT_DEADLINE_PASSED', 'HALL_PAYMENT_REFUNDED', 'HALL_RESERVATION_CANCELLED', 'HALL_RESERVATION_CONFIRMED']);
    });
});

describe('4. Messages de refus des fonctions en base', () => {
    test('aucun code, aucun statut en capitales dans les messages des migrations 20261122…', () => {
        const dir = path.join(ROOT, 'supabase/migrations');
        const faults: string[] = [];
        let count = 0;
        for (const f of fs.readdirSync(dir).filter((x) => x.startsWith('20261122'))) {
            const sql = fs.readFileSync(path.join(dir, f), 'utf8');
            for (const m of sql.matchAll(/'message',\s*'((?:[^']|'')*)'/g)) {
                count += 1;
                if (TECHNICAL.test(m[1])) faults.push(`${f} : ${m[1]}`);
            }
        }
        assert.ok(count >= 30, `messages trouvés : ${count}`);
        assert.deepEqual(faults, [], faults.join('\n'));
    });
});

describe('5. Aucun calcul d’argent d’une réservation de salle hors de la base', () => {
    test('route de réservation, service des salles, service de paiement', () => {
        const reserve = read('app/api/halls/reserve/route.ts');
        assert.doesNotMatch(reserve, /price_per_day|deposit_percentage|depositRate|\btotalAmount\s*=|\.insert\(/, 'calcul ou écriture dans la route de réservation');
        assert.match(reserve, /rpc\('hall_reserve'/);
        const halls = read('lib/halls/hall.service.ts');
        assert.doesNotMatch(halls, /depositRate|v_total|totalAmount\s*\*|from\('hall_reservations'\)\s*\.insert/, 'calcul ou écriture d’une réservation dans le service des salles');
        const pay = read('lib/payments/payment.service.ts');
        const hallCase = pay.slice(pay.indexOf("case 'HALL_RESERVATION'"), pay.indexOf("case 'TABLE_RESERVATION'"));
        assert.ok(hallCase.length > 0, 'branche des salles introuvable');
        assert.doesNotMatch(hallCase, /balance_amount|deposit_amount|payableAmount\s*=/, 'le chemin générique ne calcule plus le paiement d’une salle');
        assert.match(hallCase, /throw new PaymentInputError/);
        assert.match(read('lib/halls/hall-payment.service.ts'), /rpcWithRetry<Record<string, unknown>>\('hall_payment_create'/);
        const confirm = read('lib/payments/confirmation.service.ts');
        assert.doesNotMatch(confirm, /from\('hall_reservations'\)\.update/, 'la confirmation n’écrit plus la réservation');
    });
});
