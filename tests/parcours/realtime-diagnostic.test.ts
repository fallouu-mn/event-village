/**
 * Lot 8, tâche 8.2 g — diagnostic des échecs Realtime (contrat 7.3, L48 ; écrivain W4). temps-reel-billets a échoué
 * au lot 7 sans qu'on puisse dire si le conteneur realtime tournait : les messages d'échec de tests/helpers/realtime.ts
 * disent déjà les états du canal et les horodatages, il leur manque le statut du conteneur. Ajout demandé sans
 * relâcher aucun délai.
 *  - realtimeDiagnostics() rend une ligne `conteneur realtime : …`, par `docker inspect`, seulement à l'échec ;
 *    Docker absent ou en échec : `conteneur realtime : indisponible (raison)`, jamais d'exception ;
 *  - la ligne figure dans les messages de waitForEvent, de produceUntilReceived et du rejet de `ready` ;
 *  - garde-fou (V, déjà vert) : RECEIVE_TIMEOUT_MS = SUBSCRIBE_TIMEOUT_MS = 20 000 ms, vivacité de 30 s par défaut.
 * Aucune base, aucun abonnement réel : `Collector` factice et faux client. Le fichier ne contient volontairement aucun
 * appel écrit sous la forme que détecte REALTIME_SUITE (scripts/run-tests.mjs:75) : la suite reste hors du classement
 * temps réel, sans effet sur l'ordre des suites. Elle n'écrit rien : pas d'appel d'invariants (écart signalé, précédent
 * r24).
 * Rouge avant correctif (fix(8.2g)) : aucune fonction realtimeDiagnostics dans tests/helpers/realtime.ts, aucun
 * `conteneur realtime :` dans ses messages (:232, :297 et rejet de `ready` :195). Les deux cas qui posent un faux
 * `docker` sont réservés à la CI Linux (script exécutable) : ils sont ignorés sur le poste Windows.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    produceUntilReceived,
    RECEIVE_TIMEOUT_MS,
    SUBSCRIBE_TIMEOUT_MS,
    subscribeCollect as openCollector,
    waitForEvent,
    type Collector,
} from '../helpers/realtime';

const REALTIME_HELPER = 'tests/helpers/realtime.ts';
const CONTAINER_LINE = /conteneur realtime : /;

function fakeCollector(): Collector {
    return {
        label: 'canal factice',
        target: { table: 'tickets' },
        events: [],
        states: ['SUBSCRIBED'],
        outcome: Promise.resolve({ status: 'SUBSCRIBED', error: null }),
        ready: Promise.resolve(),
        clear() { /* aucun message à vider */ },
        close: async () => 'ok',
    };
}

/** Faux client : le canal répond CHANNEL_ERROR dès l'abonnement. */
function refusingClient(): SupabaseClient {
    const channel = {
        on: () => channel,
        subscribe(cb: (status: string, err?: Error) => void) {
            cb('CHANNEL_ERROR', new Error('refus simulé'));
            return channel;
        },
    };
    return { channel: () => channel } as unknown as SupabaseClient;
}

async function diagnosticsFn(): Promise<() => string> {
    const mod = await import('../helpers/realtime') as unknown as Record<string, unknown>;
    assert.equal(typeof mod.realtimeDiagnostics, 'function', `${REALTIME_HELPER} : realtimeDiagnostics() non exportée (contrat 7.3)`);
    return mod.realtimeDiagnostics as () => string;
}

async function failureOf(run: () => Promise<unknown>, what: string): Promise<string> {
    let message: string | null = null;
    try {
        await run();
    } catch (err) {
        message = err instanceof Error ? err.message : String(err);
    }
    assert.ok(message !== null, `${what} : un échec était attendu`);
    return message;
}

function withPath<T>(value: string, run: () => T): T {
    const saved = process.env.PATH;
    process.env.PATH = value;
    try {
        return run();
    } finally {
        process.env.PATH = saved;
    }
}

/** Dossier temporaire avec un faux `docker` qui journalise ses arguments, écrit `stdout` et sort avec `code`. */
function withFakeDocker<T>(stdout: string, code: number, run: (argsFile: string) => T): T {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-faux-docker-'));
    const argsFile = path.join(dir, 'args.txt');
    fs.writeFileSync(path.join(dir, 'docker'), `#!/bin/sh\nprintf '%s\\n' "$@" > '${argsFile}'\nprintf '%s\\n' '${stdout}'\nexit ${code}\n`, { mode: 0o755 });
    try {
        return withPath(`${dir}${path.delimiter}${process.env.PATH ?? ''}`, () => run(argsFile));
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe('8.2 g — realtimeDiagnostics() (contrat 7.3)', () => {
    test('Docker absent : une ligne « conteneur realtime : indisponible (raison) », jamais d’exception', async () => {
        const diagnostics = await diagnosticsFn();
        const line = withPath('', () => diagnostics());
        assert.match(line, /^conteneur realtime : indisponible \([\s\S]+\)$/, `ligne rendue : ${line}`);
    });

    test('Docker présent : statut, démarrage et redémarrages lus par docker inspect sur le conteneur de l’instance', { skip: process.platform === 'win32' }, async () => {
        const diagnostics = await diagnosticsFn();
        const status = 'running démarré=2026-11-06T10:00:00Z redémarrages=2';
        withFakeDocker(status, 0, (argsFile) => {
            assert.equal(diagnostics().trim(), `conteneur realtime : ${status}`);
            const args = fs.readFileSync(argsFile, 'utf8').trim().split('\n');
            assert.equal(args[0], 'inspect', `arguments de docker : ${args.join(' ')}`);
            assert.equal(args[args.length - 1], 'supabase_realtime_event-village', `conteneur visé : ${args.join(' ')}`);
        });
    });

    test('docker en échec (code de sortie non nul) : « indisponible (raison) », jamais d’exception', { skip: process.platform === 'win32' }, async () => {
        const diagnostics = await diagnosticsFn();
        withFakeDocker('No such object', 1, () => {
            assert.match(diagnostics(), /^conteneur realtime : indisponible \([\s\S]+\)$/);
        });
    });

    test('source : docker inspect avec un délai de 3 s, sans passer par un shell', () => {
        const src = fs.readFileSync(path.resolve(process.cwd(), REALTIME_HELPER), 'utf8');
        assert.match(src, /execFileSync\(\s*'docker'\s*,\s*\[\s*'inspect'/, `${REALTIME_HELPER} : execFileSync('docker', ['inspect', …])`);
        assert.match(src, /'supabase_realtime_event-village'/, `${REALTIME_HELPER} : nom du conteneur realtime de l’instance locale`);
        assert.match(src, /timeout\s*:\s*3_?000\b/, `${REALTIME_HELPER} : délai de 3 s, l’échec ne doit pas bloquer plus longtemps`);
    });
});

describe('8.2 g — le statut du conteneur figure dans chaque message d’échec', () => {
    test('waitForEvent : états du canal, instant de l’échec et conteneur realtime', async () => {
        const message = await failureOf(() => waitForEvent(fakeCollector(), () => false, 50), 'waitForEvent');
        assert.match(message, /états du canal : SUBSCRIBED/, message);
        assert.match(message, /échec à \d{4}-\d{2}-\d{2}T/, message);
        assert.match(message, CONTAINER_LINE, `statut du conteneur absent du message : ${message}`);
    });

    test('produceUntilReceived : états du canal, instant de l’échec et conteneur realtime', async () => {
        let actions = 0;
        const message = await failureOf(
            () => produceUntilReceived(fakeCollector(), async () => { actions += 1; }, () => false, { timeoutMs: 50, intervalMs: 10 }),
            'produceUntilReceived');
        assert.ok(actions > 0, 'au moins une action produite');
        assert.match(message, /états du canal : SUBSCRIBED/, message);
        assert.match(message, /échec à \d{4}-\d{2}-\d{2}T/, message);
        assert.match(message, CONTAINER_LINE, `statut du conteneur absent du message : ${message}`);
    });

    test('rejet de ready : raison de l’abonnement et conteneur realtime', async () => {
        const collector = openCollector(refusingClient(), { table: 'tickets' }, { label: 'canal refusé', timeoutMs: 50 });
        const message = await failureOf(() => collector.ready, 'ready');
        assert.match(message, /CHANNEL_ERROR refus simulé/, message);
        assert.match(message, CONTAINER_LINE, `statut du conteneur absent du message : ${message}`);
    });
});

describe('8.2 g — aucun délai relâché (V, garde-fou)', () => {
    test('attente d’un message et abonnement : 20 s ; vivacité : 30 s par défaut ; défauts toujours branchés sur ces constantes', () => {
        assert.equal(RECEIVE_TIMEOUT_MS, 20_000, 'RECEIVE_TIMEOUT_MS');
        assert.equal(SUBSCRIBE_TIMEOUT_MS, 20_000, 'SUBSCRIBE_TIMEOUT_MS');
        const src = fs.readFileSync(path.resolve(process.cwd(), REALTIME_HELPER), 'utf8');
        assert.match(src, /const timeoutMs = opts\.timeoutMs \?\? 30_000;/, 'vivacité de produceUntilReceived : 30 s par défaut');
        assert.match(src, /const timeoutMs = opts\.timeoutMs \?\? SUBSCRIBE_TIMEOUT_MS;/, 'abonnement : SUBSCRIBE_TIMEOUT_MS par défaut');
        assert.equal((src.match(/timeoutMs: number = RECEIVE_TIMEOUT_MS/g) ?? []).length, 2, 'waitForEvent et expectSome : RECEIVE_TIMEOUT_MS par défaut');
    });
});
