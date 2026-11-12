/**
 * Lot 9 ter, tâche 9t.14 (consigne 0.10, contrat A.6) — suppression des alias, contrôle statique sans base.
 *  - retryRefund (lib/events/event-cancellation.service.ts), son type RefundRetryResult, resumeUnsentRefunds et
 *    sendOutcomeLabel (lib/payments/cashout.service.ts) n'ont aucun appelant applicatif : ils sont supprimés, avec les
 *    tables SKIPPED_LABELS et UNSENT_STATUS_LABELS qui ne servaient qu'à sendOutcomeLabel (D-A22) ;
 *  - aucun des quatre noms ne reste dans app/, lib/, components/, hooks/, scripts/ (texte entier, commentaires compris :
 *    un commentaire qui cite un nom disparu tromperait le lecteur) ;
 *  - tests/parcours/essai-simule.test.ts n'appelle plus les alias (adapté dans le même commit, section 9, A.6.4 :
 *    décision « Renvoyer » par CashoutService.adminDecide, reprise par CashoutService.resumeUnsent).
 * Rouge avant correctif (cas 1) : les définitions de lib/events/event-cancellation.service.ts:19, :43, :196, :230 et
 * lib/payments/cashout.service.ts:145, :480 ; l'échec liste fichier:ligne. Le cas 2 est vert dès l'écriture : il garde
 * l'adaptation d'essai-simule (le rapport le signale).
 * Suite sans base et sans écriture : aucune aide d'invariants en after() (signalé).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_DIRS = ['app', 'lib', 'components', 'hooks', 'scripts'];
const ALIASES = /\b(?:retryRefund|RefundRetryResult|resumeUnsentRefunds|sendOutcomeLabel)\b/;
const ESSAI_SIMULE = 'tests/parcours/essai-simule.test.ts';

function sources(dir: string, out: string[] = []): string[] {
    const abs = path.join(ROOT, dir);
    assert.ok(fs.existsSync(abs), `${dir}/ absent : le contrôle ne prouverait rien`);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const rel = path.posix.join(dir, entry.name);
        if (entry.isDirectory()) sources(rel, out);
        else if (/\.(?:ts|tsx|mjs|js)$/.test(entry.name)) out.push(rel);
    }
    return out;
}

function mentionsOf(files: string[], pattern: RegExp): string[] {
    const found: string[] = [];
    for (const file of files) {
        fs.readFileSync(path.join(ROOT, file), 'utf8').split(/\r?\n/).forEach((line, i) => {
            if (pattern.test(line)) found.push(`${file}:${i + 1} ${line.trim()}`);
        });
    }
    return found;
}

describe('0.10 — alias supprimés (lot 9 ter, 9t.14)', () => {
    test('0.10 : retryRefund, RefundRetryResult, resumeUnsentRefunds et sendOutcomeLabel n’existent plus dans app/, lib/, components/, hooks/, scripts/', () => {
        const files = SOURCE_DIRS.flatMap((dir) => sources(dir));
        // Garde : le parcours lit bien les deux fichiers qui portaient les alias (sinon le contrôle ne prouverait rien).
        assert.ok(files.includes('lib/payments/cashout.service.ts'), 'lib/payments/cashout.service.ts non parcouru');
        assert.ok(files.includes('lib/events/event-cancellation.service.ts'), 'lib/events/event-cancellation.service.ts non parcouru');
        const found = mentionsOf(files, ALIASES);
        assert.deepEqual(found, [], `alias encore présents (${found.length}) :\n${found.join('\n')}`);
    });

    test('0.10 : essai-simule n’appelle plus les alias', () => {
        assert.ok(fs.existsSync(path.join(ROOT, ESSAI_SIMULE)), `${ESSAI_SIMULE} absent : le contrôle ne prouverait rien`);
        const found = mentionsOf([ESSAI_SIMULE], ALIASES);
        assert.deepEqual(found, [], `alias encore cités par ${ESSAI_SIMULE} (${found.length}) :\n${found.join('\n')}`);
    });
});
