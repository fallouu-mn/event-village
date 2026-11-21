/**
 * Design 1e (décision du 21/11, run complet 561) — lectures de requêtes de e2e/perf.spec.ts : une page fermée pendant la
 * lecture ne laisse plus de rejet non géré (seule la requête est ignorée), toute autre erreur reste visible, et aucune
 * lecture de requête du test n'échappe au module (e2e/support/request-read.ts). Aucun seuil ni aucune mesure changés.
 * La preuve dans un vrai navigateur est e2e/lecture-requetes-perf.spec.ts (projet perf).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isTargetClosed, readRequest, sumReads } from '../../e2e/support/request-read';

const CLOSED = 'request.sizes: Target page, context or browser has been closed';
const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');

describe('design 1e — lecture sûre des requêtes (e2e perf, run 561)', () => {
    test('page fermée pendant la lecture : requête ignorée, jamais de rejet (même si personne n’attend la promesse)', async () => {
        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };
        process.on('unhandledRejection', onUnhandled);
        try {
            const late = readRequest(() => Promise.reject(new Error(CLOSED))); // poussée puis jamais attendue
            void late;
            const sync = await readRequest(() => { throw new Error('Target closed'); });
            assert.equal('ignored' in sync, true);
            await new Promise((r) => setTimeout(r, 30));
            assert.deepEqual(unhandled, [], 'aucun rejet non géré');
        } finally {
            process.off('unhandledRejection', onUnhandled);
        }
        assert.equal(isTargetClosed(new Error(CLOSED)), true);
        assert.equal(isTargetClosed(new Error('net::ERR_FAILED')), false);
    });

    test('somme : requêtes ignorées laissées de côté ; toute autre erreur relancée (rien n’est masqué)', async () => {
        const ok = await sumReads([
            readRequest(() => Promise.resolve(1200)),
            readRequest(() => Promise.reject(new Error(CLOSED))),
            readRequest(() => Promise.resolve(800)),
        ]);
        assert.deepEqual(ok, { total: 2000, ignored: 1 });
        await assert.rejects(sumReads([readRequest(() => Promise.reject(new Error('Protocol error: autre panne')))]), /autre panne/);
    });

    test('e2e/perf.spec.ts : toute lecture de requête passe par readRequest ; seuils inchangés', () => {
        const spec = read('e2e/perf.spec.ts');
        const reads = spec.match(/\.(sizes|allHeaders|headerValue|headersArray|body|text|json|response|timing)\(\)/g) ?? [];
        assert.deepEqual(reads, ['.sizes()'], 'une seule lecture de requête dans le test');
        assert.match(spec, /networkSizes\.push\(readRequest\(\(\) => req\.sizes\(\)\.then\(\(s\) => s\.responseBodySize\)\)\);/);
        assert.match(spec, /const sized = await sumReads\(networkSizes\);/);
        assert.doesNotMatch(spec, /req\.sizes\(\)\.then\(\(s\) => s\.responseBodySize\)\);\n/, 'plus de req.sizes() poussée sans gestionnaire');
    });
});
