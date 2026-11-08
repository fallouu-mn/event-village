/**
 * Lot 9, tâche 9.4 — PO10 (code mort) et preuve A21 (suites qui ne prouvaient rien), sans base. Contrat, section 5.5.
 * Preuve par grep rejouée à chaque run :
 *  - components/events/AdjustTicketQuotaModal.tsx, EventCancelModal.tsx et lib/payments/financial-calculator.service.ts
 *    n'existent plus, l'import inerte de lib/halls/hall.service.ts:3 est retiré ;
 *  - aucune mention de ces composants, de calculateTicketingFinancials, calculateOrderFinancials ni de
 *    FinancialCalculatorService dans app, lib, components ;
 *  - les 6 suites racine A21 (tableau 5.5) n'existent plus.
 * Rouge avant correctif : les trois fichiers sont présents (fix(9.4-PO10), E4), l'import aussi (fix(9.3-A32) puis
 * fix(9.4-PO10)), les 6 suites sont supprimées en vague L (T33 à T35), après lecture des ports verts au run avant.
 * Sans base : aucun appel d'invariants (aucune écriture), signalé.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEAD_FILES = [
    'components/events/AdjustTicketQuotaModal.tsx',
    'components/events/EventCancelModal.tsx',
    'lib/payments/financial-calculator.service.ts',
];
const DEAD_SYMBOLS = /\b(?:AdjustTicketQuotaModal|EventCancelModal|calculateTicketingFinancials|calculateOrderFinancials|FinancialCalculatorService)\b|financial-calculator/;
const A21_SUITES = [
    'tests/auth-rbac.test.ts',
    'tests/e2e-scenarios.test.ts',
    'tests/partner-auth-complete.test.ts',
    'tests/payment.test.ts',
    'tests/roles-isolation.test.ts',
    'tests/superadmin-complete.test.ts',
];

function sources(dir: string, out: string[] = []): string[] {
    const abs = path.join(ROOT, dir);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        const rel = path.posix.join(dir, entry.name);
        if (entry.isDirectory()) sources(rel, out);
        else if (/\.(?:ts|tsx|js|mjs|css)$/.test(entry.name)) out.push(rel);
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

describe('PO10 — code mort supprimé', () => {
    for (const file of DEAD_FILES) {
        test(`${file} n’existe plus`, () => {
            assert.equal(fs.existsSync(path.join(ROOT, file)), false, `${file} existe encore`);
        });
    }

    test('lib/halls/hall.service.ts n’importe plus le service de calcul', () => {
        const found = mentionsOf(['lib/halls/hall.service.ts'], DEAD_SYMBOLS);
        assert.deepEqual(found, [], `import inerte :\n${found.join('\n')}`);
    });

    test('app, lib, components : aucune mention des composants et des calculs retirés', () => {
        const files = ['app', 'lib', 'components'].flatMap((d) => sources(d));
        assert.ok(files.length > 100, `parcours des sources (${files.length} fichiers) : racine incorrecte`);
        const found = mentionsOf(files.filter((f) => !DEAD_FILES.includes(f)), DEAD_SYMBOLS);
        assert.deepEqual(found, [], `mentions restantes :\n${found.join('\n')}`);
    });
});

describe('A21 — suites qui ne prouvaient rien supprimées', () => {
    for (const suite of A21_SUITES) {
        test(`${suite} n’existe plus (cas réels portés, tableau 5.5)`, () => {
            assert.equal(fs.existsSync(path.join(ROOT, suite)), false, `${suite} existe encore (suppression en vague L, T33 à T35)`);
        });
    }
});
