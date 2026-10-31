/**
 * Règle du lot 1A : les tests de sécurité n'utilisent que la clé anon et
 * signUp / signInWithPassword. Ce test échoue si un fichier de tests/security
 * fait référence au service_role ou aux chargeurs de fixtures qui l'utilisent.
 */
import '../helpers/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN = [
    /SERVICE_ROLE/i,
    /service_role/,
    /getServiceRoleClient/,
    /helpers\/fixtures['"]/,
    /\bloadFixtures\b/,
    /\bsignInAs\b/,
    /auth\.admin\./,
];

test('aucun fichier de tests/security ne référence le service_role', () => {
    const dir = path.resolve(process.cwd(), 'tests/security');
    const self = path.basename(__filename);
    const offenders: string[] = [];
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.ts') || name === self) continue;
        const lines = fs.readFileSync(path.join(dir, name), 'utf8').split(/\r?\n/);
        lines.forEach((line, i) => {
            const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
            if (FORBIDDEN.some((re) => re.test(code))) offenders.push(`${name}:${i + 1} ${line.trim()}`);
        });
    }
    assert.deepEqual(offenders, [], `références interdites :\n${offenders.join('\n')}`);
});
