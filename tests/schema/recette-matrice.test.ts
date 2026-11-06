/**
 * Lot 8, 8.3 a, c et d (contrat 13.1, 13.3, 13.4, AM1, AM7, AM12, AM13) — docs/recette-billetterie.md tient debout.
 * Sans base. Le corps de chaque test cité a été lu à la rédaction (AR14) : ce contrôle ne remplace pas cette lecture,
 * il empêche la matrice de dériver.
 *  - chaque statut est dans la légende, et le résumé compte les lignes réelles ;
 *  - chaque fichier cité existe, chaque numéro de ligne aussi ; dans tests/ et e2e/, la ligne ouvre un test ;
 *  - aucune suite qui ne prouve rien n'est citée (AR14, L92, A21) ;
 *  - « fait » a au moins un test, « partiel » et « non fait » disent ce qui manque ;
 *  - la colonne CI dit la même chose que la colonne Test ;
 *  - A1 à A40 une fois chacune, avec gravité, état et référence ;
 *  - les essais 1 à 61 ont leurs étapes, leur résultat attendu, leur case et aucun nom de route ni de table.
 * Un test cité qui bouge rend cette suite rouge : reprendre le numéro de ligne dans le document.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOC = 'docs/recette-billetterie.md';

const STATUTS = ['fait', 'partiel', 'non fait', 'écarté', 'hors périmètre'];
const GRAVITES = ['Élevée', 'Moyenne', 'Faible'];
const ETATS = ['corrigée', 'preuve ajoutée', 'listée'];
const SUITES_INTERDITES = [
    'tests/superadmin-complete.test.ts',
    'tests/auth-rbac.test.ts',
    'tests/e2e-scenarios.test.ts',
    'tests/roles-isolation.test.ts',
    'tests/partner-auth-complete.test.ts',
    'tests/payment.test.ts',
];
const CORRIGEES = ['A1', 'A2', 'A3', 'A4', 'A13', 'A20', 'A23', 'A29', 'A35', 'A36'];
const PREUVES = ['A11', 'A14', 'A15'];
const ECARTS = ['Voix Wolof', 'Audio du scanner', 'Wallet', 'panier multi-événements', 'billets à régler sur place'];
const NOMBRE_ESSAIS = 61;
const CI_RE = /^(?:vert au run \d+|à prouver au run après|vert au run \d+, le reste à prouver au run après|sans objet)$/;
const PATH_RE = /^(?:M\/|tests\/|e2e\/|app\/|lib\/|components\/|docs\/|supabase\/|scripts\/|public\/|middleware\.ts|playwright\.config\.ts)/;
const TEST_LINE_RE = /^\s*(?:await\s+)?(?:test|it)(?:\.\w+)?\(/;

interface Citation { raw: string; file: string; line: number | null }

function section(text: string, title: RegExp): string {
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex((l) => l.startsWith('## ') && title.test(l));
    if (start < 0) return '';
    const after = lines.slice(start + 1);
    const end = after.findIndex((l) => l.startsWith('## '));
    return (end < 0 ? after : after.slice(0, end)).join('\n');
}

function tableRows(block: string): string[][] {
    return block.split(/\r?\n/)
        .filter((l) => l.startsWith('| ') && !l.startsWith('|---'))
        .map((l) => l.slice(2, l.endsWith(' |') ? -2 : undefined).split(' | ').map((c) => c.trim()))
        .filter((cells) => !['§', 'Id', 'Statut'].includes(cells[0]));
}

function citations(text: string): Citation[] {
    const out: Citation[] = [];
    for (const m of Array.from(text.matchAll(/`([^`\n]+)`/g))) {
        const raw = m[1];
        if (!PATH_RE.test(raw) || raw.endsWith('/')) continue;
        const parsed = /^(.*?)(?::(\d+))?$/.exec(raw);
        if (!parsed) continue;
        out.push({ raw, file: parsed[1].replace(/^M\//, 'supabase/migrations/'), line: parsed[2] ? Number(parsed[2]) : null });
    }
    return out;
}

const fileCache = new Map<string, string[] | null>();
function linesOf(file: string): string[] | null {
    if (!fileCache.has(file)) {
        const abs = path.join(ROOT, ...file.split('/'));
        fileCache.set(file, fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs, 'utf8').split(/\r?\n/) : null);
    }
    return fileCache.get(file) ?? null;
}

function auditCitations(text: string): string[] {
    const faults: string[] = [];
    for (const c of citations(text)) {
        if (SUITES_INTERDITES.includes(c.file)) faults.push(`suite interdite citée : ${c.raw}`);
        const lines = linesOf(c.file);
        if (!lines) {
            faults.push(`fichier absent : ${c.raw}`);
            continue;
        }
        if (c.line === null) continue;
        if (c.line < 1 || c.line > lines.length) {
            faults.push(`ligne hors du fichier : ${c.raw} (${lines.length} lignes)`);
            continue;
        }
        if (/^(?:tests|e2e)\//.test(c.file) && /\.(?:test|spec)\.ts$/.test(c.file) && !TEST_LINE_RE.test(lines[c.line - 1])) {
            faults.push(`la ligne n'ouvre pas un test : ${c.raw}`);
        }
    }
    return faults;
}

function auditMatrix(text: string): string[] {
    const faults: string[] = [];
    const rows = [...tableRows(section(text, /^## 3\./)), ...tableRows(section(text, /^## 4\./))];
    if (rows.length === 0) faults.push('matrice vide');
    const counts = new Map(STATUTS.map((s) => [s, 0]));
    for (const cells of rows) {
        const id = cells[0];
        if (cells.length !== 7) {
            faults.push(`${id} : ${cells.length} colonnes au lieu de 7`);
            continue;
        }
        const [, , statut, , tests, ci, manque] = cells;
        if (!STATUTS.includes(statut)) {
            faults.push(`${id} : statut hors légende « ${statut} »`);
            continue;
        }
        counts.set(statut, (counts.get(statut) ?? 0) + 1);
        const cited = citations(tests);
        if (cited.some((c) => !/^(?:tests|e2e)\//.test(c.file))) faults.push(`${id} : la colonne Test cite autre chose qu'un test`);
        if (statut === 'fait' && cited.length === 0) faults.push(`${id} : « fait » sans test`);
        if (['partiel', 'non fait', 'écarté'].includes(statut) && (manque === '—' || manque === '')) faults.push(`${id} : ${statut} sans dire ce qui manque`);
        if (!CI_RE.test(ci)) faults.push(`${id} : colonne CI hors légende « ${ci} »`);
        if ((cited.length === 0) !== (ci === 'sans objet')) faults.push(`${id} : colonne CI « ${ci} » pour ${cited.length} test(s) cité(s)`);
        const pending = tests.includes('(à prouver)');
        const claimsPending = ci.includes('à prouver');
        if (pending !== claimsPending) faults.push(`${id} : mention « à prouver » et colonne CI en désaccord`);
        const allPending = cited.length > 0 && (tests.match(/\(à prouver\)/g) ?? []).length === cited.length;
        if (ci === 'à prouver au run après' && !allPending) faults.push(`${id} : tout à prouver, mais des tests sans la mention`);
    }

    const summary = new Map(tableRows(section(text, /^## 1\./)).map((c) => [c[0], Number(c[1])]));
    for (const s of STATUTS) {
        if (summary.get(s) !== counts.get(s)) faults.push(`résumé : ${s} annonce ${String(summary.get(s))}, la matrice en compte ${String(counts.get(s))}`);
    }
    if (summary.get('total') !== rows.length) faults.push(`résumé : total ${String(summary.get('total'))}, ${rows.length} lignes`);

    const ecarts = section(text, /^## 4\./);
    for (const e of ECARTS) if (!ecarts.includes(e)) faults.push(`écart absent : ${e}`);
    return faults;
}

function auditAnomalies(text: string): string[] {
    const faults: string[] = [];
    const rows = tableRows(section(text, /^## 5\./)).filter((c) => /^A\d+$/.test(c[0]));
    const ids = rows.map((c) => c[0]);
    for (let i = 1; i <= 40; i++) {
        const n = ids.filter((id) => id === `A${i}`).length;
        if (n !== 1) faults.push(`A${i} présente ${n} fois`);
    }
    for (const id of ids) if (Number(id.slice(1)) > 40) faults.push(`anomalie inconnue : ${id}`);
    for (const cells of rows) {
        const id = cells[0];
        if (cells.length !== 8) {
            faults.push(`${id} : ${cells.length} colonnes au lieu de 8`);
            continue;
        }
        const [, gravite, exigence, constat, etat, reference, tests] = cells;
        if (!GRAVITES.includes(gravite)) faults.push(`${id} : gravité « ${gravite} »`);
        if (!ETATS.includes(etat)) faults.push(`${id} : état « ${etat} »`);
        if (!exigence || !constat) faults.push(`${id} : exigence ou constat vide`);
        if (citations(reference).length === 0) faults.push(`${id} : aucune référence`);
        if (etat !== 'listée' && citations(tests).length === 0) faults.push(`${id} : ${etat} sans test`);
        if (CORRIGEES.includes(id) && etat !== 'corrigée') faults.push(`${id} : attendue corrigée, « ${etat} »`);
        if (PREUVES.includes(id) && etat !== 'preuve ajoutée') faults.push(`${id} : attendue preuve ajoutée, « ${etat} »`);
    }
    return faults;
}

function auditCahier(text: string): string[] {
    const faults: string[] = [];
    const cahier = section(text, /^## 7\./);
    if (!cahier.includes('docs/essai-local.md')) faults.push('le cahier ne renvoie pas à docs/essai-local.md');
    const blocks = cahier.split(/^#### Essai /m).slice(1);
    const numbers = blocks.map((b) => Number(/^(\d+)\./.exec(b)?.[1] ?? NaN));
    const expected = Array.from({ length: NOMBRE_ESSAIS }, (_, i) => i + 1);
    if (JSON.stringify(numbers) !== JSON.stringify(expected)) faults.push(`essais : ${numbers.join(', ')}`);
    for (const b of blocks) {
        const n = /^(\d+)\./.exec(b)?.[1] ?? '?';
        for (const part of ['**Appareil :**', '**Préparation :**', '\n1. ', '**Résultat attendu :**', '- [ ] OK', '- [ ] Anomalie', 'Remarque :']) {
            if (!b.includes(part)) faults.push(`essai ${n} : « ${part.trim()} » absent`);
        }
        const prose = b.replace(/```[\s\S]*?```/g, '');
        const technical = /\/api\/|\/admin\b|\/partner\b|\/controller\b|\b[a-z]+_[a-z_]+\b/.exec(prose);
        if (technical) faults.push(`essai ${n} : vocabulaire technique « ${technical[0]} »`);
    }
    return faults;
}

const audit = (text: string): string[] => [...auditCitations(text), ...auditMatrix(text), ...auditAnomalies(text), ...auditCahier(text)];

const docPath = path.join(ROOT, ...DOC.split('/'));
const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, 'utf8') : '';

describe('8.3 — docs/recette-billetterie.md', () => {
    test('le document existe et sa légende reprend les cinq statuts', () => {
        assert.ok(doc.length > 0, `${DOC} absent`);
        const legend = tableRows(section(doc, /^## 2\./)).map((c) => c[0]);
        assert.deepEqual(legend, STATUTS);
    });

    test('8.3 a : matrice, statuts, résumé, colonne CI et écarts', () => {
        assert.deepEqual(auditMatrix(doc), []);
    });

    test('8.3 a : chaque fichier et chaque ligne cités existent, aucune suite interdite', () => {
        assert.deepEqual(auditCitations(doc), []);
    });

    test('8.3 d : A1 à A40, gravité, état, référence', () => {
        assert.deepEqual(auditAnomalies(doc), []);
    });

    test('8.3 c : essais 1 à 61, écrits pour un non-développeur', () => {
        assert.deepEqual(auditCahier(doc), []);
    });
});

describe('8.3 — le contrôle se vérifie lui-même', () => {
    const firstTest = /`(tests\/parcours\/[^`]+?):(\d+)`/.exec(doc);
    const cases: Array<[string, (t: string) => string, RegExp]> = [
        ['statut hors légende', (t) => t.replace(' | fait | ', ' | fini | '), /statut hors légende/],
        ['résumé faux', (t) => t.replace(/\| fait \| \d+ \|/, '| fait | 1 |'), /résumé : fait/],
        ['suite interdite', (t) => t.replace('`docs/CDC-V3.md`', '`docs/CDC-V3.md`, `tests/auth-rbac.test.ts`'), /suite interdite citée/],
        ['fichier absent', (t) => t.replace('`docs/CDC-V3.md`', '`docs/inconnu.md`'), /fichier absent/],
        ['ligne hors du fichier', (t) => t.replace(firstTest?.[0] ?? '', `\`${firstTest?.[1] ?? ''}:9999999\``), /ligne hors du fichier/],
        ['ligne qui n’ouvre pas un test', (t) => t.replace(firstTest?.[0] ?? '', `\`${firstTest?.[1] ?? ''}:1\``), /n'ouvre pas un test/],
        ['« fait » sans test', (t) => t.replace(/\| fait \| ([^|]*) \| [^|]* \| [^|]* \| /, '| fait | $1 | — | sans objet | '), /« fait » sans test/],
        ['partiel sans manque', (t) => t.replace(/\| partiel \| ([^|]*) \| ([^|]*) \| ([^|]*) \| [^|]* \|\n/, '| partiel | $1 | $2 | $3 | — |\n'), /sans dire ce qui manque/],
        ['A28 retirée', (t) => t.replace(/^\| A28 \|.*\n/m, ''), /A28 présente 0 fois/],
        ['A1 redevenue listée', (t) => t.replace(/^(\| A1 \|.*?)\| corrigée \|/m, '$1| listée |'), /A1 : attendue corrigée/],
        ['essai 61 retiré', (t) => t.replace(/^#### Essai 61\.[\s\S]*$/m, ''), /essais : /],
        ['case retirée', (t) => t.replace(/(#### Essai 3\.[\s\S]*?)- \[ \] Anomalie/, '$1'), /essai 3 : « - \[ \] Anomalie » absent/],
        ['nom de route dans un essai', (t) => t.replace(/(#### Essai 3\.[\s\S]*?)Ouvrez l’accueil\./, '$1Ouvrez /api/events.'), /essai 3 : vocabulaire technique/],
    ];

    for (const [name, mutate, expected] of cases) {
        test(`accuse : ${name}`, () => {
            const changed = mutate(doc);
            assert.notEqual(changed, doc, 'la mutation n’a rien changé');
            const faults = audit(changed);
            assert.ok(faults.some((f) => expected.test(f)), `non détecté : ${faults.slice(0, 5).join(' ; ')}`);
        });
    }
});
