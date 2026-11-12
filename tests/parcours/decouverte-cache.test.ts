/**
 * Lot 9, tâche 9.1 (contrat 5.2, L21, AR12) ; lot 9 ter, 9t.19 (consigne 5, D-S4) — cache de « Populaires », qui porte le
 * seul classement : mémoire du module, 60 s strictes, panne jamais gardée, appels simultanés partagés. Suite SANS BASE.
 * Contrat : getPopularRanking(deps?: { now, read }) (getPopularEvents au lot 9), `now()` en millisecondes (entrée `{ at: number, value }`),
 * `read()` rend la liste. Le cache vit dans le module, partagé par tous les cas : chaque cas prend une horloge
 * une heure après le précédent, donc toujours une entrée périmée au départ.
 *
 * Rouge avant correctif : le module lib/events/popular.service n'existe pas, chaque cas échoue à l'import en le
 * nommant. Suite sans écriture en base : aucun appel aux invariants (signalé au commit).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

const SERVICE_PATH = '../../lib/events/popular.service';

type Reader = () => Promise<unknown[]>;
type GetPopular = (deps: { now: () => number; read: Reader }) => Promise<unknown[]>; // getPopularRanking : le classement (lot 9 ter)

async function loadService(): Promise<GetPopular> {
    const mod = (await import(SERVICE_PATH)) as { getPopularRanking?: GetPopular };
    assert.equal(typeof mod.getPopularRanking, 'function', 'lib/events/popular.service doit exporter getPopularRanking (lot 9 ter, consigne 5 : le cache porte le classement)');
    return mod.getPopularRanking as GetPopular;
}

let lastStart = 1_800_000_000_000;

/** Horloge manuelle, une heure après la précédente : l'entrée laissée par le cas précédent est périmée. */
function newClock(): { t: number; now: () => number } {
    lastStart += 3_600_000;
    const clock = { t: lastStart, now: () => clock.t };
    return clock;
}

const LIST_A = [{ id: 'a' }];
const LIST_B = [{ id: 'b' }];

/** Lecteur compté, qui rend les réponses données dans l'ordre (une Error est rejetée). */
function countedReader(...replies: Array<unknown[] | Error>): { read: Reader; calls: () => number } {
    let calls = 0;
    return {
        calls: () => calls,
        read: async () => {
            const reply = replies[calls];
            calls++;
            assert.ok(reply !== undefined, `lecture ${calls} non prévue par le cas`);
            if (reply instanceof Error) throw reply;
            return reply;
        },
    };
}

describe('Populaires : cache de 60 s, mémoire du module', () => {
    test('à 59 s et à 59,999 s : aucune relecture, même liste', async () => {
        const getPopularEvents = await loadService();
        const clock = newClock();
        const reader = countedReader(LIST_A, LIST_B);
        assert.deepEqual(await getPopularEvents({ now: clock.now, read: reader.read }), LIST_A);
        assert.equal(reader.calls(), 1, 'une lecture au premier appel');
        clock.t += 59_000;
        assert.deepEqual(await getPopularEvents({ now: clock.now, read: reader.read }), LIST_A);
        clock.t += 999;
        assert.deepEqual(await getPopularEvents({ now: clock.now, read: reader.read }), LIST_A);
        assert.equal(reader.calls(), 1, 'aucune relecture avant 60 s');
    });

    test('à 60 s exactement : relecture, la nouvelle liste est rendue', async () => {
        const getPopularEvents = await loadService();
        const clock = newClock();
        const reader = countedReader(LIST_A, LIST_B);
        assert.deepEqual(await getPopularEvents({ now: clock.now, read: reader.read }), LIST_A);
        clock.t += 60_000;
        assert.deepEqual(await getPopularEvents({ now: clock.now, read: reader.read }), LIST_B, 'liste relue à 60 s');
        assert.equal(reader.calls(), 2, 'une relecture à 60 s');
    });

    test('la relecture repart pour 60 s', async () => {
        const getPopularEvents = await loadService();
        const clock = newClock();
        const reader = countedReader(LIST_A, LIST_B);
        await getPopularEvents({ now: clock.now, read: reader.read });
        clock.t += 60_000;
        await getPopularEvents({ now: clock.now, read: reader.read });
        clock.t += 59_000;
        assert.deepEqual(await getPopularEvents({ now: clock.now, read: reader.read }), LIST_B);
        assert.equal(reader.calls(), 2, 'pas de troisième lecture 59 s après la deuxième');
    });

    test('une lecture en échec n’est jamais gardée : l’appel suivant relit, à la même heure', async () => {
        const getPopularEvents = await loadService();
        const clock = newClock();
        const reader = countedReader(new Error('panne de lecture'), LIST_A);
        await assert.rejects(getPopularEvents({ now: clock.now, read: reader.read }), /panne de lecture/);
        assert.deepEqual(await getPopularEvents({ now: clock.now, read: reader.read }), LIST_A, 'relecture après la panne');
        assert.equal(reader.calls(), 2, 'la panne n’occupe pas le cache');
        assert.deepEqual(await getPopularEvents({ now: clock.now, read: reader.read }), LIST_A);
        assert.equal(reader.calls(), 2, 'la réussite, elle, est gardée');
    });

    test('panne à l’expiration : erreur rendue, jamais l’ancienne liste, et l’appel suivant relit', async () => {
        const getPopularEvents = await loadService();
        const clock = newClock();
        const reader = countedReader(LIST_A, new Error('panne à l’expiration'), LIST_B);
        await getPopularEvents({ now: clock.now, read: reader.read });
        clock.t += 60_000;
        await assert.rejects(getPopularEvents({ now: clock.now, read: reader.read }), /panne à l’expiration/, 'aucune liste périmée servie en cas de panne');
        assert.deepEqual(await getPopularEvents({ now: clock.now, read: reader.read }), LIST_B);
        assert.equal(reader.calls(), 3, 'relecture après la panne');
    });

    test('deux appels simultanés : une seule lecture, même liste pour les deux', async () => {
        const getPopularEvents = await loadService();
        const clock = newClock();
        let calls = 0;
        let release: (value: unknown[]) => void = () => assert.fail('lecture non lancée');
        const read: Reader = () => {
            calls++;
            return new Promise<unknown[]>((resolve) => { release = resolve; });
        };
        const first = getPopularEvents({ now: clock.now, read });
        const second = getPopularEvents({ now: clock.now, read });
        assert.equal(calls, 1, 'le second appel attend la lecture du premier');
        release(LIST_A);
        assert.deepEqual(await first, LIST_A);
        assert.deepEqual(await second, LIST_A);
        assert.equal(calls, 1, 'une seule lecture');
    });

    test('deux appels simultanés en panne : une lecture, deux rejets, puis relecture', async () => {
        const getPopularEvents = await loadService();
        const clock = newClock();
        const reader = countedReader(new Error('panne partagée'), LIST_A);
        const [first, second] = await Promise.allSettled([
            getPopularEvents({ now: clock.now, read: reader.read }),
            getPopularEvents({ now: clock.now, read: reader.read }),
        ]);
        assert.equal(first.status, 'rejected', 'premier appel rejeté');
        assert.equal(second.status, 'rejected', 'second appel rejeté');
        assert.equal(reader.calls(), 1, 'une seule lecture pendant la panne');
        assert.deepEqual(await getPopularEvents({ now: clock.now, read: reader.read }), LIST_A, 'relecture après la panne partagée');
        assert.equal(reader.calls(), 2);
    });
});
