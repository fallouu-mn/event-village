/**
 * Lot Carte B3 — la migration 20261210… (lieux publics : colonnes REST, position obligatoire ; décisions du client du
 * 25/11) se rejoue sans erreur : appliquée deux fois de plus dans une transaction annulée, elle ne casse rien ; elle ne
 * gère pas elle-même sa transaction ; elle passe après celles des lots précédents (la session 11c-a prend des horodatages
 * plus petits). Chaque recopie de fonction part de la DERNIÈRE définition d'avant sa migration (fichier et lignes cités
 * en tête) : chaque ligne de cette définition se retrouve dans la recopie, sauf les lignes remplacées, listées ici.
 * La 11c-a recopie event_update, ticket_category_create et ticket_category_update : aucune des trois n'est recopiée ici.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

export const CARTE_B3_MIGRATIONS = [
    // Colonnes REST des salles et des établissements, position obligatoire à l'envoi et à la validation
    '20261210000001_cb3_lieux_publics.sql',
] as const;

/** Recopies : fonction, migration de la recopie, lignes de la définition précédente qu'elle remplace. */
const RECOPIES: Array<{ fn: string; file: string; replaced: string[] }> = [
    { fn: 'halls_validation_guard', file: CARTE_B3_MIGRATIONS[0], replaced: [
        // Salle insérée sans position : jamais validée d'office (même ligne, condition de position ajoutée)
        "NEW.validation_status := CASE WHEN public.fin_setting_bool('halls.validation_required')",
    ] },
    { fn: 'hall_submit', file: CARTE_B3_MIGRATIONS[0], replaced: [] },
    { fn: 'venues_validation_guard', file: CARTE_B3_MIGRATIONS[0], replaced: [
        "NEW.validation_status := CASE WHEN public.fin_setting_bool('tables.validation_required')",
    ] },
    { fn: 'venue_create', file: CARTE_B3_MIGRATIONS[0], replaced: [] },
    { fn: 'venue_submit', file: CARTE_B3_MIGRATIONS[0], replaced: [] },
    { fn: 'hall_validation_decide', file: CARTE_B3_MIGRATIONS[0], replaced: [] },
    { fn: 'venue_validation_decide', file: CARTE_B3_MIGRATIONS[0], replaced: [] },
    { fn: 'event_transition', file: CARTE_B3_MIGRATIONS[0], replaced: [
        // Phrase du client (25/11) à la place de « Placez le repère du lieu sur la carte (étape Accès). »
        "v_missing := v_missing || jsonb_build_object('field', 'latitude', 'message', 'Placez le repère du lieu sur la carte (étape Accès).');",
        // Position seule manquante : la phrase seule, sans « L’événement est incomplet : » (même texte dans le ELSE)
        "'message', 'L’événement est incomplet : '",
        "|| (SELECT string_agg(m->>'message', ' ' ORDER BY o) FROM jsonb_array_elements(v_missing) WITH ORDINALITY AS x(m, o)));",
    ] },
    // Contre-vérification (T2 ; décision du client du 25/11) : nom commercial, sinon « Partenaire Event Village », jamais la
    // raison sociale
    { fn: 'hall_search', file: CARTE_B3_MIGRATIONS[0], replaced: [
        "COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) AS partner_name",
    ] },
    { fn: 'venue_search', file: CARTE_B3_MIGRATIONS[0], replaced: [
        "COALESCE(NULLIF(btrim(pa.commercial_name), ''), pa.company_name) AS partner_name",
    ] },
    { fn: 'notif_tickets_scanned', file: CARTE_B3_MIGRATIONS[0], replaced: [
        "SELECT COALESCE(NULLIF(btrim(pa.company_name), ''), 'l''organisateur'), public.event_start_at(e.id), public.event_end_at(e.id)",
    ] },
];

/** Fonctions recopiées par la session 11c-a : jamais recopiées par ce lot (consigne du 25/11). */
const NOT_MINE = ['event_update', 'ticket_category_create', 'ticket_category_update'] as const;

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

    test('aucune recopie des fonctions de la session 11c-a (event_update, ticket_category_create, ticket_category_update)', () => {
        for (const name of CARTE_B3_MIGRATIONS) {
            const sql = fs.readFileSync(path.join(DIR, name), 'utf8');
            for (const fn of NOT_MINE) assert.doesNotMatch(sql, new RegExp(`FUNCTION public\\.${fn}\\s*\\(`, 'i'), `${name} recopie ${fn}`);
        }
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
