/**
 * Lot 9 bis (consigne H, contrat 8.1, D-out 2.4) — documents confidentiels jamais versionnés : le contrat SamirPay
 * v1.2 (.private/samirpay-api-v1.2.pdf) et la version précédente (docs/private/) restent sur le poste. Garde-fou :
 *  - .gitignore ignore les deux dossiers, sans règle de négation qui en ré-inclurait un fichier ;
 *  - git les ignore réellement (git check-ignore --no-index, règle lue dans .gitignore) ;
 *  - git ls-files ne rend aucun chemin sous ces dossiers : un `git add -f` ultérieur rendrait la suite rouge.
 * Sans base et sans écriture : vert dès l'écriture, annoncé ; aucun appel d'invariants (écart signalé, comme
 * migrations-gelees).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

/** Dossiers confidentiels, tels qu'écrits dans .gitignore. */
const PRIVATE_DIRS = ['.private/', 'docs/private/'] as const;

/** Chemins témoins : le PDF v1.2 réel et un document quelconque de la version précédente. */
const SAMPLES = ['.private/samirpay-api-v1.2.pdf', 'docs/private/SamirPay — Documentation API Partenaires.pdf'] as const;

function gitignoreRules(): string[] {
    assert.ok(fs.existsSync('.gitignore'), '.gitignore absent à la racine du dépôt');
    return fs.readFileSync('.gitignore', 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'));
}

describe('Lot 9 bis — documents confidentiels jamais versionnés (.private/, docs/private/)', () => {
    test('.gitignore ignore .private/ et docs/private/, sans règle de négation sur ces dossiers', () => {
        const rules = gitignoreRules();
        for (const dir of PRIVATE_DIRS) {
            assert.ok(rules.includes(dir) || rules.includes(`/${dir}`), `.gitignore : règle « ${dir} » absente`);
        }
        const negations = rules.filter((r) => r.startsWith('!') && PRIVATE_DIRS.some((d) => r.replace(/^!\/?/, '').startsWith(d.replace(/\/$/, ''))));
        assert.deepEqual(negations, [], `.gitignore : règle de négation qui ré-inclut un document confidentiel : ${negations.join(', ')}`);
    });

    test('git ignore réellement les documents témoins des deux dossiers (règle lue dans .gitignore)', () => {
        for (const sample of SAMPLES) {
            const r = spawnSync('git', ['check-ignore', '--no-index', '-v', '--', sample], { encoding: 'utf8' });
            assert.equal(r.error, undefined, `git check-ignore impossible à lancer : ${String(r.error)}`);
            assert.equal(r.status, 0, `${sample} : non ignoré par git (code ${String(r.status)}, ${r.stderr.trim() || 'aucune règle'})`);
            assert.match(r.stdout, /^\.gitignore:\d+:/, `${sample} : règle attendue dans .gitignore, obtenu « ${r.stdout.trim()} »`);
        }
    });

    test('aucun fichier suivi par git sous .private/ ni docs/private/', () => {
        const out = execFileSync('git', ['ls-files', '--', ...PRIVATE_DIRS], { encoding: 'utf8' });
        const tracked = out.split('\n').map((l) => l.trim()).filter(Boolean);
        assert.deepEqual(tracked, [], `documents confidentiels suivis par git : ${tracked.join(', ')}`);
    });
});
