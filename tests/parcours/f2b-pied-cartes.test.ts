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

// Lot Carte B (B1) : le fond et sa mention sont posés par une seule aide (components/map/themedTiles.ts, addThemedTiles),
// utilisée par toutes les cartes ; mention par défaut de Stadia (lib/map/tiles.ts), qui garde « contributeurs
// OpenStreetMap ». Attente déplacée des deux fichiers vers l'aide (modification signalée au rapport du lot Carte B).
describe('b. pied des cartes : sans « Leaflet », mention d’OpenStreetMap gardée', () => {
    test('aide commune : préfixe « Leaflet » retiré', () => {
        const src = read('components/map/themedTiles.ts');
        assert.doesNotMatch(src, /setPrefix\(\s*['"]Leaflet['"]\s*\)/, 'préfixe « Leaflet » encore posé');
        assert.match(src, /setPrefix\(\s*false\s*\)/, 'préfixe retiré (setPrefix(false))');
        assert.match(read('lib/map/tiles.ts'), /&copy; <a [^>]+>contributeurs OpenStreetMap<\/a>/, 'mention d’OpenStreetMap par défaut');
    });
    for (const file of ['components/ui/MapPicker.tsx', 'components/ui/EventMap.tsx']) {
        test(`${file} : fond posé par l’aide commune, aucun préfixe « Leaflet »`, () => {
            const src = read(file);
            assert.doesNotMatch(src, /setPrefix\(\s*['"]Leaflet['"]\s*\)/, 'préfixe « Leaflet » encore posé');
            assert.match(src, /addThemedTiles\(L, map, /, 'fond et mention par addThemedTiles');
            assert.doesNotMatch(src, /L\.tileLayer\(/, 'aucune couche de tuiles posée à part');
        });
    }
});
