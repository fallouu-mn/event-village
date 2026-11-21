/**
 * Contre-vérification du lot 11b — SMS des tables et des établissements : un segment GSM-7 avec AU MOINS 5 caractères de
 * marge (155 au plus) au pire cas réel, chaque origine d'annulation comprise. L'annulation par Event Village était à
 * 160 caractères pile (« notre équipe a annulé votre table chez … ») : tout mot ajouté la faisait passer à deux SMS.
 * Pire cas (celui de la contre-vérification, tests/audit/cv11b-3-statique.test.ts S1) : lien de l'application de 27
 * caractères (contrat G3), 52 500 000 F, 50 personnes, noms d'établissement longs et hors GSM-7, motif de 227 caractères.
 * Sans base.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { smsSegments } from '../../lib/notifications/sms-format';

const MAX = 155;

describe('SMS des tables : 5 caractères de marge au pire cas', () => {
    type Template = { channels: string[]; sms?: (d: unknown, c: unknown) => string };
    const catalog = NOTIFICATION_CATALOG as unknown as Record<string, Template>;
    const types = Object.keys(catalog).filter((k) => (k.startsWith('TABLE_') || k.startsWith('VENUE_')) && catalog[k].sms && catalog[k].channels.includes('SMS'));
    const big = 52_500_000;
    const names = ['Restaurant Le Grand Bleu de la Corniche Ouest, terrasse panoramique', 'Chez Fatou – l’Île de Gorée, côté mer & ça bouge à la Pointe des Almadies'];

    test(`${types.length} types, chaque origine et chaque décision : ${MAX} caractères au plus, un segment GSM-7`, () => {
        const worst: Record<string, number> = {};
        const bad: string[] = [];
        for (const type of types) {
            for (const venue_name of names) {
                for (const origin of ['CLIENT', 'ETABLISSEMENT', 'EVENT_VILLAGE', 'SANS_REPONSE']) {
                    for (const decision of ['VALIDER', 'REFUSER', 'SUSPENDRE', 'REACTIVER']) {
                        const d = {
                            reservation_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59', venue_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59', venue_name,
                            date: '2026-12-30', time: '23:45', end_time: '01:45', guests: 50, table_number: 'Terrasse 12 bis 4',
                            deposit_amount: 50_000_000, total_amount: big, paid_amount: big, refund_amount: big, amount: big, operator: 'ORANGE_MONEY',
                            payment_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59', cashout_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59',
                            response_due_at: '2026-12-30T21:45:00Z', hold_expires_at: '2026-12-30T21:45:00Z', cancel_free_until: '2026-12-30T21:45',
                            short_code: 'k7m2p9x', held_until: '00:15', origin, decision,
                            reason: `Fermeture exceptionnelle : ${'travaux importants dans la cuisine '.repeat(6)}`.slice(0, 227),
                        };
                        const sms = catalog[type].sms!(d, { appUrl: 'https://app.eventvillage.sn' });
                        const m = smsSegments(sms);
                        const key = type === 'TABLE_RESERVATION_CANCELLED' ? `${type}/${origin}` : type;
                        worst[key] = Math.max(worst[key] ?? 0, m.length);
                        if (m.encoding !== 'GSM7' || m.segments !== 1 || m.length > MAX) bad.push(`${key}/${decision} ${m.encoding} ${m.length} : ${sms}`);
                    }
                }
            }
        }
        console.log(`[L11B-CV] SMS : longueur maximale par type ${JSON.stringify(worst)}`);
        assert.ok(worst['TABLE_RESERVATION_CANCELLED/EVENT_VILLAGE'] > 0, 'annulation par Event Village mesurée');
        assert.deepEqual(bad, [], `SMS sans 5 caractères de marge :\n${bad.join('\n')}`);
    });
});
