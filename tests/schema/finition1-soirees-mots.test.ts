/**
 * Finition 1 (complément 13) — mots d'une soirée, sans base : la porte de « Mes soirées ».
 * Constat à la relecture des captures du run 199 : « Porte Porte VIP » quand le nom de la porte commence déjà par
 * « Porte ». Règle reprise de la route du scanner (lot 9 bis, R100) : « Porte » n'est ajouté que si le nom ne se nomme
 * pas déjà (Porte, Portail, Entrée, Accès, Guichet).
 * Rouge avant le correctif : eveningPlaceText n'existe pas (la page formait le texte elle-même).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as words from '../../lib/shifts/evening-format';

const place = (words as unknown as {
    eveningPlaceText?: (p: { gate: string | null; zone: string | null; entry_point: string | null }) => string;
}).eveningPlaceText;

describe('Finition 1 — porte de « Mes soirées »', () => {
    test('eveningPlaceText existe dans lib/shifts/evening-format.ts', () => {
        assert.equal(typeof place, 'function');
    });

    test('nom déjà « Porte … », « Entrée … », « Accès … » : pas de « Porte » en double', () => {
        assert.equal(place!({ gate: 'Porte VIP', zone: 'Carré VIP', entry_point: null }), 'Porte VIP · Carré VIP');
        assert.equal(place!({ gate: 'porte nord', zone: null, entry_point: null }), 'porte nord');
        assert.equal(place!({ gate: 'Entrée principale', zone: 'Pelouse', entry_point: null }), 'Entrée principale · Pelouse');
        assert.equal(place!({ gate: 'Accès carré', zone: null, entry_point: null }), 'Accès carré');
        assert.equal(place!({ gate: 'Guichet 2', zone: null, entry_point: null }), 'Guichet 2');
    });

    test('nom nu : « Porte » ajouté ; sinon point d’entrée, sinon « Porte non précisée »', () => {
        assert.equal(place!({ gate: 'Sud', zone: 'Tribune', entry_point: null }), 'Porte Sud · Tribune');
        assert.equal(place!({ gate: 'B', zone: null, entry_point: 'Entrée principale' }), 'Porte B');
        assert.equal(place!({ gate: null, zone: null, entry_point: 'Entrée principale' }), 'Point d’entrée : Entrée principale');
        assert.equal(place!({ gate: null, zone: null, entry_point: null }), 'Porte non précisée');
    });

    test('la page « Mes soirées » utilise eveningPlaceText et ne forme plus le texte elle-même', () => {
        const page = fs.readFileSync(path.join(process.cwd(), 'app/profile/soirees/page.tsx'), 'utf8');
        assert.match(page, /eveningPlaceText\(/);
        assert.doesNotMatch(page, /`Porte \$\{/);
    });
});
