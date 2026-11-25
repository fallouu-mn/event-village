/**
 * Lot Carte B3 — la migration 20261210… (lieux de particuliers : zone, droits REST, recherches) se rejoue sans erreur :
 * appliquée deux fois de plus dans une transaction annulée, elle ne casse rien ; elle ne gère pas elle-même sa
 * transaction ; elle passe après celles des lots précédents (la session 11c-a prend des horodatages plus petits).
 * Chaque recopie de fonction part de la DERNIÈRE définition d'avant sa migration (fichier et lignes cités en tête) :
 * chaque ligne de cette définition se retrouve dans la recopie, sauf les lignes remplacées, listées ici.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

export const CARTE_B3_MIGRATIONS = [
    // Particulier ou professionnel, zone stockée, colonnes REST, recherches sans l'adresse d'un particulier
    '20261210000001_cb3_lieux_particuliers.sql',
] as const;

/** Recopies : fonction, migration de la recopie, lignes de la définition précédente qu'elle remplace. */
const RECOPIES: Array<{ fn: string; file: string; replaced: string[] }> = [
    { fn: 'hall_search', file: CARTE_B3_MIGRATIONS[0], replaced: [
        // Texte cherché comparé à l'adresse d'un professionnel seulement
        "WHERE (v_like IS NULL OR v.name ILIKE v_like OR v.city ILIKE v_like OR v.address ILIKE v_like OR v.partner_name ILIKE v_like)",
        // Adresse et point d'un particulier jamais rendus (zone à la place), champ « exact »
        "'id', m.id, 'name', m.name, 'city', m.city, 'address', m.address, 'capacity', m.capacity,",
        "'latitude', m.latitude, 'longitude', m.longitude, 'partner_name', m.partner_name,",
    ] },
    { fn: 'venue_search', file: CARTE_B3_MIGRATIONS[0], replaced: [
        "WHERE (v_like IS NULL OR vi.name ILIKE v_like OR vi.city ILIKE v_like OR vi.address ILIKE v_like OR vi.partner_name ILIKE v_like)",
        "'id', f.id, 'name', f.name, 'kind', f.kind, 'city', f.city, 'address', f.address,",
        "'photo', f.photos[1], 'photo_count', cardinality(f.photos), 'latitude', f.latitude, 'longitude', f.longitude,",
    ] },
];

/** Texte de la dernière définition de public.<nom> dans les fichiers donnés (du CREATE au second $$). */
function lastDefinition(name: string, files: readonly string[]): string | null {
    const head = new RegExp(`^CREATE (OR REPLACE )?FUNCTION public\\.${name}\\s*\\(`, 'i');
    let found: string | null = null;
    for (const f of files) {
        const lines = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n').split('\n');
        lines.forEach((line, i) => {
            if (!head.test(line)) return;
            let dollars = 0;
            let j = i;
            for (; j < lines.length; j += 1) {
                dollars += (lines[j].match(/\$\$/g) ?? []).length;
                if (dollars >= 2) break;
            }
            found = lines.slice(i, j + 1).join('\n');
        });
    }
    return found;
}

const allMigrations = (): string[] =>
    fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f) || /^\d{4}_.+\.sql$/.test(f)).sort();

describe('Lot Carte B3 — migration 20261210… rejouable, recopies complètes', () => {
    test('les migrations du lot sont exactement celles-ci, après celles des lots précédents', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        const present = all.filter((f) => /_cb3_/.test(f));
        assert.deepEqual(present, [...CARTE_B3_MIGRATIONS], `migrations du lot présentes : ${present.join(', ') || 'aucune'}`);
        assert.ok(CARTE_B3_MIGRATIONS[0].startsWith('20261210'), 'horodatage 20261210… (consigne du lot)');
        const earlier = all.filter((f) => f < CARTE_B3_MIGRATIONS[0]);
        assert.ok(earlier.length > 0, 'les migrations des lots précédents passent avant');
    });

    for (const name of CARTE_B3_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const file = path.join(DIR, name);
            assert.ok(fs.existsSync(file), `migration du lot absente : supabase/migrations/${name}`);
            const sql = fs.readFileSync(file, 'utf8');
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }

    for (const spec of RECOPIES) {
        test(`recopie de ${spec.fn} (${spec.file.slice(0, 14)}) : aucune ligne de la dernière définition précédente perdue`, () => {
            const previous = lastDefinition(spec.fn, allMigrations().filter((f) => f < spec.file));
            const mine = lastDefinition(spec.fn, [spec.file]);
            assert.ok(previous, `${spec.fn} : définition précédente introuvable`);
            assert.ok(mine, `${spec.fn} : recopie absente de ${spec.file}`);
            const kept = new Set(mine!.split('\n').map((l) => l.trim()));
            const lost = previous!.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !kept.has(l) && !spec.replaced.includes(l));
            assert.deepEqual(lost, [], `${spec.fn} : lignes perdues`);
        });
    }

    test('la tête de la migration cite le fichier et les lignes de chaque recopie', () => {
        const missing: string[] = [];
        for (const spec of RECOPIES) {
            const head = fs.readFileSync(path.join(DIR, spec.file), 'utf8');
            const cite = new RegExp(`${spec.fn}[^\\n]*\\n?[^\\n]*recopie de \\d{14}_[a-z0-9_]+\\.sql:\\d+-\\d+`, 'i');
            if (!cite.test(head)) missing.push(`${spec.file} : ${spec.fn}`);
        }
        assert.deepEqual(missing, [], `recopies sans fichier ni lignes cités :\n${missing.join('\n')}`);
    });

    test('les lignes citées sont bien la dernière définition précédente', () => {
        const head = fs.readFileSync(path.join(DIR, CARTE_B3_MIGRATIONS[0]), 'utf8').replace(/\r\n/g, '\n');
        for (const spec of RECOPIES) {
            const m = new RegExp(`${spec.fn} : recopie de (\\d{14}_[a-z0-9_]+\\.sql):(\\d+)-(\\d+)`).exec(head);
            assert.ok(m, `${spec.fn} : citation absente`);
            const lines = fs.readFileSync(path.join(DIR, m![1]), 'utf8').replace(/\r\n/g, '\n').split('\n');
            const cited = lines.slice(Number(m![2]) - 1, Number(m![3])).join('\n');
            const previous = lastDefinition(spec.fn, allMigrations().filter((f) => f < spec.file));
            assert.equal(cited, previous, `${spec.fn} : les lignes ${m![2]}-${m![3]} de ${m![1]} ne sont pas la dernière définition`);
        }
    });
});
