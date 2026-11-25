/**
 * Contre-vérification du lot Carte B3 (branche carte-b3/cv-rouges, jamais fusionnée) — contrôles sans base.
 *
 *  S1. Recopies de 20261210000001_cb3_lieux_publics.sql : pour chacune des huit fonctions, la définition précédente est
 *      cherchée DANS TOUTES les migrations antérieures (pas seulement celle citée par l'en-tête) ; toute ligne absente de
 *      la recopie doit être l'une des lignes volontairement réécrites, listées ici une par une.
 *  S2. event_update, ticket_category_create, ticket_category_update ne sont pas recopiées par le lot.
 *  S3. « Rien au premier chargement » : les modules nouveaux de la carte (couches, fiches de lieu, repères, lecture des
 *      lieux) ne sont importés que par le module de la carte, lui-même chargé à la demande par Explorer
 *      (components/explore/lazy.ts, next/dynamic) ; aucun import statique de la carte ailleurs.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');
const MIG = path.join(ROOT, 'supabase', 'migrations');
const LOT = '20261210000001_cb3_lieux_publics.sql';

function definitions(sql: string, fn: string): string[] {
    const re = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${fn}\\s*\\(`, 'gi');
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) {
        const open = sql.indexOf('$$', m.index);
        const close = sql.indexOf('$$', open + 2);
        out.push(sql.slice(m.index, close + 2));
    }
    return out;
}

const lines = (s: string): string[] => s.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '');

/** Lignes de la définition précédente réécrites volontairement par le lot (ajout de la condition de position, phrase). */
const REWRITTEN: Record<string, string[]> = {
    halls_validation_guard: ["NEW.validation_status := CASE WHEN public.fin_setting_bool('halls.validation_required')"],
    venues_validation_guard: ["NEW.validation_status := CASE WHEN public.fin_setting_bool('tables.validation_required')"],
    event_transition: [
        "v_missing := v_missing || jsonb_build_object('field', 'latitude', 'message', 'Placez le repère du lieu sur la carte (étape Accès).');",
        "'message', 'L’événement est incomplet : '",
        "|| (SELECT string_agg(m->>'message', ' ' ORDER BY o) FROM jsonb_array_elements(v_missing) WITH ORDINALITY AS x(m, o)));",
    ],
};

describe('S1 — recopies : aucune ligne perdue', () => {
    const files = fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
    const lot = fs.readFileSync(path.join(MIG, LOT), 'utf8');
    for (const fn of ['halls_validation_guard', 'hall_submit', 'venues_validation_guard', 'venue_create', 'venue_submit',
        'hall_validation_decide', 'venue_validation_decide', 'event_transition']) {
        test(fn, () => {
            let previous: string | null = null;
            for (const f of files) {
                if (f >= LOT) break;
                const d = definitions(fs.readFileSync(path.join(MIG, f), 'utf8'), fn);
                if (d.length) previous = d[d.length - 1];
            }
            assert.ok(previous, `${fn} : aucune définition antérieure`);
            const mine = definitions(lot, fn);
            assert.equal(mine.length, 1, `${fn} : ${mine.length} définitions dans la migration du lot`);
            const pool = new Map<string, number>();
            for (const l of lines(mine[0])) pool.set(l.trim(), (pool.get(l.trim()) ?? 0) + 1);
            const lost: string[] = [];
            for (const l of lines(previous!)) {
                const k = l.trim();
                const n = pool.get(k) ?? 0;
                if (n > 0) pool.set(k, n - 1); else lost.push(k);
            }
            assert.deepEqual(lost.filter((l) => !(REWRITTEN[fn] ?? []).includes(l)), [], `${fn} : lignes perdues`);
        });
    }
    test('aucune migration après celle du lot ne redéfinit ces fonctions', () => {
        const later = files.filter((f) => f > LOT);
        const hits = later.filter((f) => /FUNCTION\s+(public\.)?(hall_submit|venue_create|venue_submit|hall_validation_decide|venue_validation_decide|event_transition|halls_validation_guard|venues_validation_guard)\s*\(/i
            .test(fs.readFileSync(path.join(MIG, f), 'utf8')));
        assert.deepEqual(hits, []);
    });
});

describe('S2 — fonctions de la 11c-a non recopiées', () => {
    test('event_update, ticket_category_create, ticket_category_update absentes de la migration du lot', () => {
        const lot = fs.readFileSync(path.join(MIG, LOT), 'utf8');
        for (const fn of ['event_update', 'ticket_category_create', 'ticket_category_update']) {
            assert.equal(definitions(lot, fn).length, 0, `${fn} recopiée`);
        }
    });
});

describe('S3 — rien de nouveau au premier chargement d’Explorer', () => {
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return e.name === 'node_modules' || e.name.startsWith('.') ? [] : walk(p);
        return /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
    });
    const sources = ['app', 'components', 'lib'].flatMap((d) => walk(path.join(ROOT, d)));
    const rel = (p: string): string => path.relative(ROOT, p).split(path.sep).join('/');
    /** Modules nouveaux de la carte et ceux qui ont le droit de les importer (tous dans le morceau chargé à la demande). */
    const LAZY = new Set(['components/explore/ExploreMap.tsx', 'components/explore/MapLayers.tsx', 'components/explore/MapPlaceCard.tsx',
        'components/explore/place-markers.ts', 'lib/lieux/carte-lieux-client.ts']);
    const MODULES: Array<[string, RegExp]> = [
        ['MapLayers', /from\s+'(@\/components\/explore|\.)\/MapLayers'/],
        ['MapPlaceCard', /from\s+'(@\/components\/explore|\.)\/MapPlaceCard'/],
        ['place-markers', /from\s+'(@\/components\/explore|\.)\/place-markers'/],
        ['carte-lieux-client', /from\s+'@\/lib\/lieux\/carte-lieux-client'/],
        ['ExploreMap (import statique)', /from\s+'(@\/components\/explore|\.)\/ExploreMap'/],
    ];
    for (const [name, re] of MODULES) {
        test(`${name} : importé seulement dans le morceau de la carte`, () => {
            const importers = sources.map(rel).filter((f) => !f.startsWith('app/api/') && re.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
            const allowed = name.startsWith('ExploreMap') ? new Set(['components/explore/lazy.ts']) : LAZY;
            assert.deepEqual(importers.filter((f) => !allowed.has(f)), [], `${name} importé ailleurs`);
        });
    }
    test('lib/lieux/carte-lieux (valeurs) : seulement la route, le serveur et le morceau de la carte', () => {
        /** Vrai si le fichier importe une VALEUR (pas seulement des types) de lib/lieux/carte-lieux. */
        const importsValue = (src: string): boolean => [...src.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+'@\/lib\/lieux\/carte-lieux'/g)]
            .some((m) => !m[1] && m[2].split(',').map((x) => x.trim()).filter(Boolean).some((x) => !x.startsWith('type ')));
        const importers = sources.map(rel).filter((f) => importsValue(fs.readFileSync(path.join(ROOT, f), 'utf8')));
        const allowed = new Set([...LAZY, 'app/api/lieux/carte/route.ts', 'lib/lieux/carte-lieux.server.ts']);
        assert.deepEqual(importers.filter((f) => !allowed.has(f)), []);
    });
    test('Explorer charge la carte par next/dynamic', () => {
        const view = fs.readFileSync(path.join(ROOT, 'app/explore/ExploreView.tsx'), 'utf8');
        assert.match(view, /dynamic\(\(\)\s*=>\s*import\('@\/components\/explore\/lazy'\)/);
    });
});
