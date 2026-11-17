/**
 * Finition 2b (A) — « Leaflet » retiré du pied de toutes les cartes, « © contributeurs OpenStreetMap » gardé. Sans base :
 * lecture des deux seules cartes de l'application (MapPicker et EventMap, toutes deux Leaflet).
 *  b. Préfixe retiré (setPrefix(false)), mention d'OpenStreetMap gardée par défaut.
 * Rouge avant le correctif : setPrefix('Leaflet'). Suite sans base ni écriture : aucun appel d'invariants.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('b. pied des cartes : OpenStreetMap seulement', () => {
    for (const file of ['components/ui/MapPicker.tsx', 'components/ui/EventMap.tsx']) {
        test(`${file} : préfixe « Leaflet » retiré, mention d’OpenStreetMap gardée`, () => {
            const src = read(file);
            assert.doesNotMatch(src, /setPrefix\(\s*['"]Leaflet['"]\s*\)/, 'préfixe « Leaflet » encore posé');
            assert.match(src, /setPrefix\(\s*false\s*\)/, 'préfixe retiré (setPrefix(false))');
            assert.match(src, /&copy; contributeurs OpenStreetMap/, 'mention d’OpenStreetMap par défaut');
        });
    }
});
