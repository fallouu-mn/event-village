#!/usr/bin/env node
/**
 * Génère supabase/hotfix/2026-10-31-lot1a/02-hotfix.sql à partir de la migration du lot 1A :
 * BEGIN; <corps de la migration, à l'identique>; COMMIT;
 * Le test tests/schema/hotfix-identique.test.ts vérifie que les deux restent identiques.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
export const MIGRATION = 'supabase/migrations/20261031000002_lot1a_failles_sans_privilege.sql';
export const HOTFIX = 'supabase/hotfix/2026-10-31-lot1a/02-hotfix.sql';
export const HEADER = [
    '-- ============================================================================',
    '-- EVENT VILLAGE — LOT 1A — 02 : CORRECTIF (projet de test, éditeur SQL Supabase)',
    '-- ============================================================================',
    '-- Exécuter APRÈS 01-detection.sql (exporter son résultat), puis lancer 03-verification.sql.',
    '-- Transactionnel : tout ou rien. Idempotent : peut être relancé.',
    `-- Corps STRICTEMENT identique à ${MIGRATION}`,
    '-- (généré par scripts/build-hotfix-lot1a.mjs, contrôlé par tests/schema/hotfix-identique.test.ts).',
    '-- Ne pas faire de « supabase db push » sur ce projet : son historique de migrations n\'est pas aligné.',
    '-- ============================================================================',
    '',
    'BEGIN;',
    '',
].join('\n');
export const FOOTER = '\nCOMMIT;\n';

export function buildHotfix(migrationSql) {
    return HEADER + migrationSql.replace(/\r\n/g, '\n').trimEnd() + '\n' + FOOTER;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, 'scripts/build-hotfix-lot1a.mjs');
if (isMain) {
    const sql = fs.readFileSync(path.resolve(ROOT, MIGRATION), 'utf8');
    fs.mkdirSync(path.dirname(path.resolve(ROOT, HOTFIX)), { recursive: true });
    fs.writeFileSync(path.resolve(ROOT, HOTFIX), buildHotfix(sql), 'utf8');
    console.log(`${HOTFIX} généré (${buildHotfix(sql).split('\n').length} lignes)`);
}
