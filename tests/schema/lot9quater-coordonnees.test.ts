/**
 * Lot 9 quater (D3 : AUD-26) — titre, lieu, ville, nom d'invité et consigne d'entrée refusent les adresses web et les
 * numéros de téléphone. Sans base : règle commune (lib/validations/contact-info.ts) et schémas Zod des routes.
 * Rouge avant correctif : le module n'existe pas, les schémas acceptent « www.… » et « 77 123 45 67 ».
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const CASES: Array<[string, boolean]> = [
    ['Gala de Dakar 2026', false], ['Festival 2026-2027', false], ['Concert à 20h30', false], ['Place du Souvenir', false],
    ['Stade Léopold Senghor', false], ['Salle 12, porte 3', false], ['Entrée porte B, 19 h', false],
    ['Payez sur bit.ly/abc', true], ['Infos www.arnaque.com', true], ['https://x.example', true], ['eventvillage.sn', true],
    ['Appelez le 77 123 45 67', true], ['771234567', true], ['+221 77.123.45.67', true], ['Tél 33 821 00 00', true],
    ['Billets 0123456789', true],
];

describe('D3 — adresses web et numéros refusés', () => {
    test('règle commune hasContactInfo', async () => {
        const { hasContactInfo } = await import('../../lib/validations/contact-info');
        const wrong = CASES.filter(([t, e]) => hasContactInfo(t) !== e).map(([t, e]) => `${JSON.stringify(t)} attendu ${e}`);
        assert.deepEqual(wrong, []);
    });

    test('schémas : titre, lieu, ville, consigne d’entrée, nom d’invité', async () => {
        const ev = await import('../../lib/validations/event');
        const inv = await import('../../lib/validations/invitation');
        const fields = ev.EVENT_CONTACT_FIELDS as Record<string, { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ message: string }> } } }>;
        const expected: Record<string, string> = {
            title: 'Le titre ne peut pas contenir d\'adresse web ni de numéro de téléphone.',
            location: 'Le lieu ne peut pas contenir d\'adresse web ni de numéro de téléphone.',
            city: 'La ville ne peut pas contenir d\'adresse web ni de numéro de téléphone.',
            entry_instruction: 'La consigne ne peut pas contenir d\'adresse web ni de numéro de téléphone.',
        };
        for (const [key, message] of Object.entries(expected)) {
            const bad = fields[key].safeParse('Infos www.arnaque.com');
            assert.equal(bad.success, false, `${key} accepte une adresse web`);
            assert.equal(bad.error?.issues[0]?.message, message, key);
            assert.equal(fields[key].safeParse('Gala de Dakar').success, true, `${key} refuse un texte ordinaire`);
        }
        const guest = inv.UpdateGuestNameSchema.safeParse({ guest_name: 'Moussa 77 123 45 67' });
        assert.equal(guest.success, false, 'nom d’invité avec un numéro');
        assert.equal(guest.error?.issues[0]?.message, 'Le nom de l\'invité ne peut pas contenir d\'adresse web ni de numéro de téléphone.');
    });
});
