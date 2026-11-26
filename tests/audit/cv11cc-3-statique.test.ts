/**
 * Contre-vérification du lot 11c-c — contrôles STATIQUES (fichiers lus sur le disque, sans base).
 *
 *  S1. Migration 20261215000001 : deux fonctions NOUVELLES (absentes de toute migration antérieure), aucune autre
 *      instruction que CREATE OR REPLACE FUNCTION, REVOKE, GRANT et COMMENT ; search_path fixé ; droits (service seul
 *      pour la fonction publique, aucun rôle pour l'aide de private) ; sans BEGIN ni COMMIT.
 *  S2. private.event_table_edit_refusal rend les mêmes codes, dans le même ordre, que la dernière définition de
 *      private.event_table_refusal et de public.ticket_category_guard.
 *  S3. Scanner : aucun import (statique ni dynamique) depuis app/controller/scanner/page.tsx et app/controller/layout.tsx
 *      n'atteint components/event-tables ; le badge ne vient que du champ `table` de la réponse du serveur.
 *  S4. Formulaire : chaque lecture de event.ticket_categories passe par isTicketCategory.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MIG = path.join(ROOT, 'supabase/migrations');
const FILE = '20261215000001_l11cc_lectures_tables.sql';
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const migrations = () => fs.readdirSync(MIG).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();

/** Corps de la DERNIÈRE définition d'une fonction parmi les migrations antérieures ou égales à `upTo`. */
function lastDefinition(name: string, upTo: string): string {
    let found = '';
    const re = new RegExp(`CREATE OR REPLACE FUNCTION ${name.replace('.', '\\.')}\\(`, 'g');
    for (const f of migrations().filter((x) => x <= upTo)) {
        const sql = fs.readFileSync(path.join(MIG, f), 'utf8');
        let m: RegExpExecArray | null;
        while ((m = re.exec(sql)) !== null) {
            const start = m.index;
            const open = sql.indexOf('$$', start);
            const close = sql.indexOf('$$', open + 2);
            found = sql.slice(start, close + 2);
        }
    }
    assert.ok(found, `définition de ${name} introuvable`);
    return found;
}

/** Codes de refus d'une définition, dans l'ordre de première apparition (sans les codes en double). */
function codeOrder(body: string): string[] {
    const out: string[] = [];
    for (const m of body.matchAll(/'([A-Z][A-Z_]{3,})'/g)) {
        const code = m[1];
        if (['TERMINE', 'ANNULE', 'EN_ATTENTE', 'SUSPENDU', 'TABLE', 'TICKET', 'ACTIF', 'VALIDE'].includes(code)) continue;
        if (!out.includes(code)) out.push(code);
    }
    return out;
}

describe('S1. Migration du lot 11c-c', () => {
    const sql = fs.readFileSync(path.join(MIG, FILE), 'utf8');
    const code = sql.replace(/--[^\n]*/g, '');
    const bodies = [...code.matchAll(/\$\$[\s\S]*?\$\$/g)].map((m) => m[0]);
    const outside = bodies.reduce((s, b) => s.replace(b, () => 'CORPS'), code);

    test('deux fonctions nouvelles, absentes de toute migration antérieure', () => {
        const created = [...outside.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\(/gi)].map((m) => m[1]);
        assert.deepEqual(created, ['private.event_table_edit_refusal', 'public.event_table_report']);
        for (const f of migrations().filter((x) => x < FILE)) {
            const other = fs.readFileSync(path.join(MIG, f), 'utf8');
            assert.ok(!/event_table_edit_refusal|event_table_report/.test(other), `${f} cite déjà une des deux fonctions`);
        }
    });

    test('aucune autre instruction hors des corps : ni table, ni politique, ni déclencheur, ni donnée', () => {
        const statements = outside.split(';').map((s) => s.trim()).filter(Boolean);
        const bad = statements.filter((s) => !/^(CREATE OR REPLACE FUNCTION|REVOKE ALL ON FUNCTION|GRANT EXECUTE ON FUNCTION|COMMENT ON FUNCTION)\b/i.test(s)
            && !/^'/.test(s));
        assert.deepEqual(bad.map((s) => s.slice(0, 80)), []);
        assert.doesNotMatch(outside, /\b(ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|CREATE\s+(TABLE|POLICY|TRIGGER|INDEX|VIEW))\b/i);
        assert.doesNotMatch(code, /^\s*(BEGIN|COMMIT)\s*;/im);
        for (const b of bodies) assert.doesNotMatch(b, /\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|FOR\s+UPDATE|FOR\s+NO\s+KEY\s+UPDATE)\b/i, 'lecture seule, sans verrou');
    });

    test('search_path fixé, SECURITY DEFINER, droits', () => {
        assert.equal((code.match(/SECURITY DEFINER\s+SET search_path = public/g) ?? []).length, 2);
        assert.match(code, /REVOKE ALL ON FUNCTION private\.event_table_edit_refusal\(uuid, uuid\) FROM PUBLIC, anon, authenticated, service_role;/);
        assert.doesNotMatch(code, /GRANT[^;]*event_table_edit_refusal/);
        assert.match(code, /REVOKE ALL ON FUNCTION public\.event_table_report\(jsonb\) FROM PUBLIC, anon, authenticated;/);
        assert.match(code, /GRANT EXECUTE ON FUNCTION public\.event_table_report\(jsonb\) TO service_role;/);
        assert.doesNotMatch(code, /GRANT[^;]*TO\s+(anon|authenticated|PUBLIC)/i);
    });
});

describe('S2. Ordre des refus', () => {
    test('event_table_edit_refusal = event_table_refusal + ticket_category_guard (codes et ordre)', () => {
        const guard = codeOrder(lastDefinition('public.ticket_category_guard', FILE));
        const write = codeOrder(lastDefinition('private.event_table_refusal', FILE));
        // event_table_refusal : service, puis la garde des catégories, puis l'événement suspendu
        const expected = [write[0], ...guard, ...write.slice(1)].filter((c, i, a) => a.indexOf(c) === i);
        const readOrder = codeOrder(lastDefinition('private.event_table_edit_refusal', FILE));
        assert.deepEqual(readOrder, expected);
    });
});

describe('S3. Scanner', () => {
    const resolve = (from: string, spec: string): string | null => {
        let base: string;
        if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
        else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
        else return null;
        for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
            if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
        }
        return null;
    };

    test('aucun chemin d’import du scanner vers components/event-tables', () => {
        const seen = new Set<string>();
        const stack = ['app/controller/scanner/page.tsx', 'app/controller/layout.tsx'].map((f) => path.join(ROOT, f));
        const reached: string[] = [];
        while (stack.length > 0) {
            const file = stack.pop()!;
            if (seen.has(file)) continue;
            seen.add(file);
            const rel = path.relative(ROOT, file).replace(/\\/g, '/');
            if (rel.startsWith('components/event-tables/')) reached.push(rel);
            const src = fs.readFileSync(file, 'utf8');
            for (const m of src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)) {
                const target = resolve(file, m[1]);
                if (target && /\.(ts|tsx)$/.test(target)) stack.push(target);
            }
        }
        assert.ok(seen.size > 10, `graphe lu (${seen.size} fichiers)`);
        assert.deepEqual(reached, []);
    });

    test('le badge ne vient que du champ `table` de la réponse du serveur', () => {
        const client = read('components/scan/scan-client.ts');
        assert.equal((client.match(/\btable:\s/g) ?? []).length, 1, 'une seule production du champ table');
        assert.match(client, /table: tableOf\(body\.table\)/);
        const page = read('app/controller/scanner/page.tsx');
        assert.doesNotMatch(page, /\btable:\s*\{/, 'aucun badge fabriqué par la page');
        assert.match(read('app/api/controller/scan/route.ts'), /return scanResponse\(table \? \{ \.\.\.data, table \} : data\);/);
    });
});

describe('S4. Formulaire de l’événement', () => {
    test('chaque lecture de event.ticket_categories est filtrée par isTicketCategory', () => {
        const form = read('components/events/EventForm.tsx');
        const reads = [...form.matchAll(/\.ticket_categories as Row\[\]\)([^\n]*)/g)].map((m) => m[1]);
        assert.ok(reads.length >= 2, `${reads.length} lectures`);
        for (const r of reads) assert.match(r, /^\.filter\(isTicketCategory\)/);
    });
});
