/**
 * Finition 2b (A, E-66) — « Catégorie de l'événement » devient « Type d'événement ». Sans base : lecture du formulaire et
 * du schéma partagé.
 *  a. Formulaire : libellé « Type d'événement » (champ, récapitulatif des erreurs, verrou) ; plus aucun « Catégorie de
 *     l'événement » ni « Catégorie d'événement » à l'écran ; message du schéma « Choisissez un type d'événement dans la
 *     liste. ».
 * Rouge avant le correctif : anciens libellés. Suite sans base ni écriture : aucun appel d'invariants (comme les suites
 * statiques).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEventSchema, fieldErrors, parseWithFrenchErrors } from '../../lib/validations/event';

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('a. « Type d’événement »', () => {
    const form = read('components/events/EventForm.tsx');
    test('formulaire : nouveau libellé, plus d’ancien à l’écran', () => {
        assert.match(form, /'Type d’événement'/, 'libellé du champ (récapitulatif des erreurs)');
        assert.match(form, />\s*Type d’événement\s*</, 'libellé visible du groupe');
        for (const old of ['Catégorie de l’événement', 'Catégorie d’événement']) {
            assert.equal(form.includes(old), false, `ancien libellé encore présent : « ${old} »`);
        }
    });
    test('schéma : « Choisissez un type d’événement dans la liste. »', () => {
        const parsed = parseWithFrenchErrors(createEventSchema({ partnerId: '00000000-0000-4000-8000-000000000000' }), { category: 'THEATRE' });
        assert.equal(parsed.success, false);
        const issue = fieldErrors(parsed.error!).find((e) => e.path === 'category');
        console.log(`[F2B-A5] refus du type : ${JSON.stringify(issue)}`);
        assert.equal(issue?.message, 'Choisissez un type d’événement dans la liste.');
    });
});
