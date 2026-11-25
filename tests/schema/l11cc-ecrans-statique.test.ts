/**
 * Lot 11c-c — tables d'un événement : contrôles sans base des écrans.
 *
 *  1. Gabarits du plan : toujours N positions, distinctes, dans le cadre, sur la grille douce ; renumérotation qui garde le
 *     numéro des tables vendues.
 *  2. Aperçu du prix par personne : règle de la base (round(prix / places), exact), bornes de la base.
 *  3. Poids : l'éditeur, le plan et le pilotage passent par UN seul import() (components/event-tables/load.ts) ; aucun
 *     import statique de ces écrans ailleurs ; le scanner n'importe rien des écrans des tables (son badge vient du serveur).
 *  4. Aucun montant ni nombre de places calculé dans le navigateur : aucune multiplication ni division d'un prix ou d'un
 *     nombre de places dans les écrans ; « soit … F par personne » vient du serveur.
 *  5. Migration 20261215000001 : sans BEGIN ni COMMIT, deux fonctions NOUVELLES (aucune recopie), droits fermés.
 *  6. Pilotage : l'onglet « Tables » est ajouté en dernier, l'ordre existant inchangé ; éditeur : types de tables écartés
 *     des catégories de billets ; liste de la porte : feuille d'impression propre.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { GRID_STEP, EDGE, TEMPLATES, AREAS, nextFreeNumber, renumber, snap, templatePositions } from '../../components/event-tables/plan-templates';
import { pricePerPerson } from '../../lib/event-tables/report.server';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/gm, '$1');

function walk(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) walk(rel, out);
        else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(rel);
    }
    return out;
}

describe('1. Gabarits du plan et numéros', () => {
    for (const t of TEMPLATES) {
        for (const area of AREAS) {
            test(`${t.id} / ${area.id} : 1 à 40 tables → N positions distinctes, dans le cadre, sur la grille`, () => {
                for (let n = 1; n <= 40; n++) {
                    const pts = templatePositions(t.id, n, area.id);
                    assert.equal(pts.length, n, `${n} positions`);
                    const keys = new Set(pts.map((p) => `${p.x}:${p.y}`));
                    assert.equal(keys.size, n, `${t.id} ${area.id} ${n} : positions distinctes`);
                    for (const p of pts) {
                        assert.ok(p.x >= EDGE && p.x <= 100 - EDGE && p.y >= EDGE && p.y <= 100 - EDGE, `dans le cadre : ${JSON.stringify(p)}`);
                        assert.equal(Math.round(p.x / GRID_STEP) * GRID_STEP, p.x, `x sur la grille : ${p.x}`);
                        assert.equal(Math.round(p.y / GRID_STEP) * GRID_STEP, p.y, `y sur la grille : ${p.y}`);
                    }
                }
            });
        }
    }

    test('libellés des gabarits en mots simples (« 10 tables en 2 rangées », « Carré de 4 tables »)', () => {
        assert.equal(TEMPLATES.find((t) => t.id === 'rangees')!.label(10), '10 tables en 2 rangées');
        assert.equal(TEMPLATES.find((t) => t.id === 'carre')!.label(4), 'Carré de 4 tables');
    });

    test('grille douce : snap borne au cadre et arrondit au pas', () => {
        assert.equal(snap(51.2), 50);
        assert.equal(snap(52), 52.5);
        assert.equal(snap(0), EDGE);
        assert.equal(snap(100), 100 - EDGE);
    });

    test('renumérotation : les tables vendues gardent leur numéro, les autres prennent les plus petits libres', () => {
        const map = renumber([
            { key: 'a', number: 7, fixed: false },
            { key: 'b', number: 2, fixed: true },
            { key: 'c', number: 9, fixed: false },
            { key: 'd', number: 1, fixed: false },
        ]);
        assert.deepEqual(Object.fromEntries(map), { a: 1, b: 2, c: 3, d: 4 });
        assert.equal(nextFreeNumber([1, 2, 4]), 3);
        assert.equal(nextFreeNumber(Array.from({ length: 999 }, (_, i) => i + 1)), null);
    });
});

describe('2. Aperçu du prix par personne (règle de la base)', () => {
    test('arrondi au plus proche, moitié vers le haut ; exact si la division tombe juste ; bornes', () => {
        assert.deepEqual(pricePerPerson('150000', '6'), { price: 150_000, seats: 6, price_per_person: 25_000, price_per_person_exact: true });
        assert.deepEqual(pricePerPerson('100000', '3'), { price: 100_000, seats: 3, price_per_person: 33_333, price_per_person_exact: false });
        assert.equal(pricePerPerson('100001', '2')?.price_per_person, 50_001);
        assert.equal(pricePerPerson('5', '2')?.price_per_person, 3);
        for (const [p, s] of [['150000', '1'], ['150000', '21'], ['0', '6'], ['abc', '6'], ['1e5', '6'], ['12.5', '4'], ['1000000000', '6'], [' ', '6']]) {
            assert.equal(pricePerPerson(p, s), null, `${p} / ${s} refusé`);
        }
        assert.equal(pricePerPerson(undefined, '6'), null);
    });

    test('la règle est celle de private.event_table_prices (round(price / seats_per_unit), mod = 0)', () => {
        const sql = read('supabase/migrations/20261201000004_l11c_vente.sql');
        assert.match(sql, /'price_per_person', round\(c\.price \/ c\.seats_per_unit\), 'price_per_person_exact', mod\(c\.price, c\.seats_per_unit\) = 0/);
    });
});

describe('3. Poids : un seul chargeur, rien de lourd au premier chargement', () => {
    const files = [...walk('app'), ...walk('components'), ...walk('lib')];
    const HEAVY = ['TablesEditor', 'TablesPilotage', 'PlanWorkbench', 'TableTypeDialog', 'EventTablesScreens'];

    test('un seul import() des écrans des tables, dans components/event-tables/load.ts', () => {
        const dyn = files.filter((f) => /import\(\s*['"][^'"]*EventTablesScreens['"]\s*\)/.test(read(f)));
        assert.deepEqual(dyn, ['components/event-tables/load.ts']);
    });

    test('aucun import statique de l’éditeur, du plan ou du pilotage hors de components/event-tables', () => {
        const bad: string[] = [];
        for (const f of files) {
            if (f.startsWith('components/event-tables/')) continue;
            const src = stripComments(read(f));
            for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
                if (HEAVY.some((h) => m[1].endsWith(`/${h}`))) bad.push(`${f} → ${m[1]}`);
            }
        }
        assert.deepEqual(bad, []);
    });

    test('les pages qui proposent l’onglet passent par loadEventTables()', () => {
        for (const f of ['components/events/EventForm.tsx', 'app/partner/events/[id]/page.tsx']) {
            assert.match(read(f), /dynamic\(\(\) => loadEventTables\(\)\.then/, `${f} : chargement à l'ouverture par le chargeur unique`);
        }
    });

    test('le scanner (page budgétée) n’importe rien des écrans des tables ; le badge n’est que le texte du serveur', () => {
        const scanner = read('app/controller/scanner/page.tsx');
        assert.doesNotMatch(scanner, /components\/event-tables/);
        for (const f of ['components/scan/ScanResultPanel.tsx', 'components/scan/CombatFlashOverlay.tsx', 'components/scan/scan-client.ts']) {
            const src = stripComments(read(f));
            assert.doesNotMatch(src, /event-tables|FloorPlan/, `${f} : aucun import des tables`);
        }
        const panel = read('components/scan/ScanResultPanel.tsx');
        assert.match(panel, /\{outcome\.table\.label\}/);
        assert.match(panel, /\{outcome\.table\.entered\}\/\{outcome\.table\.seats\} entrés/);
        const overlay = read('components/scan/CombatFlashOverlay.tsx');
        assert.match(overlay, /\{table\.label\}/);
    });
});

describe('4. Aucun montant ni nombre de places calculé dans le navigateur', () => {
    test('aucune multiplication ni division d’un prix, d’un montant ou d’un nombre de places dans les écrans des tables', () => {
        const bad: string[] = [];
        for (const f of walk('components/event-tables')) {
            if (f.endsWith('plan-templates.ts')) continue;
            stripComments(read(f)).split('\n').forEach((line, i) => {
                if (line.includes('/api/')) return; // adresses des routes (« /tables/price?price= »)
                if (/\b(price|seats|amount|revenue|capacity|total|fee)\w*\s*[*/]\s*[\w(]/i.test(line)
                    || /[\w)]\s*[*/]\s*\(?\s*\w*\.?(price|seats|amount|capacity)\b/i.test(line)) bad.push(`${f}:${i + 1} ${line.trim()}`);
            });
        }
        // Seule exception admise : la largeur des parts de la barre de la jauge (dessin), part / capacité
        assert.deepEqual(bad.filter((l) => !/SeatsGauge\.tsx:\d+ const width = \(part: number\) =>/.test(l)), []);
    });

    test('« soit … F par personne » : réponse du serveur (type enregistré) ou aperçu GET …/tables/price', () => {
        const dialog = read('components/event-tables/TableTypeDialog.tsx');
        assert.match(dialog, /\/tables\/price\?price=/);
        assert.match(dialog, /price_per_person/);
    });
});

describe('5. Migration 20261215000001 (lecture des écrans)', () => {
    const FILE = 'supabase/migrations/20261215000001_l11cc_lectures_tables.sql';
    const sql = read(FILE);

    test('sans BEGIN ni COMMIT ; seules deux fonctions NOUVELLES ; aucune table, politique ni donnée touchée', () => {
        assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im);
        const defined = Array.from(sql.matchAll(/CREATE OR REPLACE FUNCTION\s+([a-z_]+\.[a-z_]+)\s*\(/gi)).map((m) => m[1]);
        assert.deepEqual(defined, ['private.event_table_edit_refusal', 'public.event_table_report']);
        assert.doesNotMatch(sql, /\b(CREATE|ALTER|DROP)\s+(TABLE|POLICY|TRIGGER|INDEX|VIEW)\b/i);
        assert.doesNotMatch(sql, /\b(INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM)\b/i);
    });

    test('aucune recopie : ces fonctions n’existaient dans aucune migration précédente', () => {
        const dir = path.join(ROOT, 'supabase', 'migrations');
        const earlier = fs.readdirSync(dir).filter((f) => f.endsWith('.sql') && f < '20261215000001').map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
        assert.doesNotMatch(earlier, /FUNCTION\s+(private|public)\.(event_table_edit_refusal|event_table_report)\s*\(/);
    });

    test('droits : publique au rôle de service seulement ; aide de private à aucun rôle de l’API', () => {
        assert.match(sql, /REVOKE ALL ON FUNCTION private\.event_table_edit_refusal\(uuid, uuid\) FROM PUBLIC, anon, authenticated, service_role;/);
        assert.match(sql, /REVOKE ALL ON FUNCTION public\.event_table_report\(jsonb\) FROM PUBLIC, anon, authenticated;/);
        assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.event_table_report\(jsonb\) TO service_role;/);
        assert.match(sql, /public\.pilotage_access\(v_event, v_actor\)/, 'accès du pilotage');
    });

    test('titulaires en prénom et initiale (private.event_table_person) ; jamais de téléphone ni de courriel', () => {
        const body = sql.slice(sql.indexOf('FUNCTION public.event_table_report'));
        assert.match(body, /private\.event_table_person\(b\.holder_id\)/);
        assert.doesNotMatch(body, /\bphone\b|\bemail\b|last_name/);
    });
});

describe('6. Pilotage, éditeur, porte', () => {
    test('pilotage : « tables » ajouté en dernier, ordre existant inchangé', () => {
        const page = read('app/partner/events/[id]/page.tsx');
        assert.match(page, /const TAB_IDS = \['apercu', 'infos', 'ventes', 'invitations', 'entrees', 'equipe', 'caisse', 'cloture', 'tables'\] as const;/);
        assert.match(page, /tabs=\{showTables \? \[\.\.\.TABS, TABLES_TAB\] : TABS\}/);
    });

    test('éditeur : les types de tables (kind TABLE) ne sont jamais des catégories de billets', () => {
        const form = read('components/events/EventForm.tsx');
        assert.match(form, /const isTicketCategory = \(c: Row\): boolean => c\.kind !== 'TABLE';/);
        assert.match(form, /\.filter\(isTicketCategory\)\.map\(\(c\) => \(\{/);
        assert.match(read('lib/admin/admin-events.service.ts'), /\.neq\('kind', 'TABLE'\)/);
    });

    test('porte : feuille d’impression propre (seule la liste, noir sur blanc) et ouverture de l’impression par ?imprimer=1', () => {
        const door = read('components/event-tables/DoorList.tsx');
        assert.match(door, /@media print/);
        assert.match(door, /#porte-impression, #porte-impression \* \{ visibility: visible !important; color: black !important;/);
        assert.match(door, /get\('imprimer'\) === '1'/);
    });

    test('plan partagé : libellés facultatifs, comportement du lot 11b inchangé sans eux', () => {
        const plan = read('components/tables/plan/FloorPlan.tsx');
        assert.match(plan, /labels\?: Partial<Record<StateKey, \{ legend: string; spoken: string \}>>;/);
        assert.match(plan, /labels\?\.\[k\]\?\.legend \?\? STATE_VIEW\[k\]\.legend/);
        assert.match(plan, /labels\?\.\[state\]\?\.spoken \?\? STATE_VIEW\[state\]\.spoken/);
    });
});
