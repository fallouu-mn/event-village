/**
 * Lot 11c-c — la migration des correctifs de la contre-vérification (20261215000002) se rejoue sans erreur : appliquée
 * deux fois de plus dans une transaction annulée ; elle passe après 20261215000001 ; aucun BEGIN ni COMMIT.
 * Chaque recopie part de la DERNIÈRE définition d'avant (fichier et lignes cités en tête de migration) : chaque ligne de
 * cette définition se retrouve dans la recopie, sauf les lignes remplacées, listées ici une à une.
 * Droits : public.event_table_copy au rôle de service seulement ; aides nouvelles du schéma private à aucun rôle de l'API
 * (clé de service comprise) ; les recopies gardent leurs droits.
 * T4 : chaque texte de refus d'écriture des tables n'est écrit qu'une fois (private.event_table_refusal_message).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction, writeLocal } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');
const FILE = '20261215000002_l11cc_cv_correctifs.sql';

/** Recopies : fonction qualifiée, lignes de la définition précédente remplacées (texte exact, espaces de tête retirés). */
const RECOPIES: Array<{ fn: string; replaced: string[] }> = [
    // T4 : textes lus dans private.event_table_refusal_message
    { fn: 'private.event_table_edit_refusal', replaced: [
        "RETURN jsonb_build_object('code', 'SERVICE_UNAVAILABLE', 'message', 'La vente de tables n’est pas encore ouverte sur Event Village.');",
        "RETURN jsonb_build_object('code', 'PARTNER_SUSPENDED', 'message', 'Votre compte organisateur est suspendu : vos événements ne sont plus modifiables. Contactez le support.');",
        "RETURN jsonb_build_object('code', 'EVENT_NOT_FOUND', 'message', 'Événement introuvable.');",
        "RETURN jsonb_build_object('code', 'ADMIN_CANNOT_EDIT', 'message', 'Seul l’organisateur modifie les tables de son événement.');",
        "RETURN jsonb_build_object('code', 'ACCOUNT_NOT_ACTIVE', 'message', 'Votre compte n’est pas actif.');",
        "RETURN jsonb_build_object('code', 'EVENT_LOCKED', 'message', 'Un événement terminé ou annulé ne se modifie plus : ses tables restent en lecture.');",
        "RETURN jsonb_build_object('code', 'WITHDRAW_TO_EDIT', 'message', 'Retirez l’événement de la validation pour modifier ses tables.');",
        "RETURN jsonb_build_object('code', 'EVENT_SUSPENDED', 'message', 'Cet événement est suspendu : ses tables ne se modifient plus. Contactez le support.');",
    ] },
    // T4 : la garde d'écriture prend les verrous puis rend la règle unique (plus d'appel à ticket_category_guard)
    { fn: 'private.event_table_refusal', replaced: [
        "IF NOT public.fin_setting_bool('features.event_tables_enabled') THEN",
        "RETURN public.event_edit_refusal('SERVICE_UNAVAILABLE', 'La vente de tables n’est pas encore ouverte sur Event Village.');",
        '-- Fiche ou compte suspendu, propriétaire, compte actif, terminé ou annulé, en attente de validation ; verrou de',
        "-- l'événement puis de ses catégories",
        'v_guard := public.ticket_category_guard(p_event, p_actor);',
        "IF (v_guard->>'ok')::boolean IS NOT TRUE THEN",
        'RETURN v_guard;',
        "IF EXISTS (SELECT 1 FROM public.events e WHERE e.id = p_event AND e.status::text = 'SUSPENDU') THEN",
        "RETURN public.event_edit_refusal('EVENT_SUSPENDED', 'Cet événement est suspendu : ses tables ne se modifient plus. Contactez le support.');",
    ] },
    // T5 : la condition passe dans private.event_table_type_delete_refusal (mêmes termes, même texte)
    { fn: 'public.event_table_type_delete', replaced: [
        'IF c.sold_quantity > 0 OR c.held_quantity > 0',
        'OR EXISTS (SELECT 1 FROM public.event_table_bookings b WHERE b.category_id = c.id)',
        'OR EXISTS (SELECT 1 FROM public.stock_reservations r WHERE r.category_id = c.id) THEN',
        "RETURN public.event_edit_refusal('CATEGORY_HAS_SALES',",
        "'Des tables de ce type ont déjà été vendues ou mises en paiement : ce type ne se supprime plus, arrêtez plutôt sa vente.');",
    ] },
    // T1 : ajouts seuls
    { fn: 'public.event_table_door_list', replaced: [] },
    // T5 (ever_sold, deletable, delete_refusal), T4 (texte de l'administration), T2 (historique de la copie)
    { fn: 'public.event_table_report', replaced: [
        "'ever_sold', EXISTS (SELECT 1 FROM public.event_table_bookings b WHERE b.category_id = c.id)) || private.event_table_prices(c.id, NULL)",
        "FROM public.ticket_categories c WHERE c.event_id = v_event AND c.kind = 'TABLE'),",
        "'edit_refusal', jsonb_build_object('code', 'ADMIN_CANNOT_EDIT', 'message', 'Seul l’organisateur modifie les tables de son événement.'),",
        "'changes', (SELECT COALESCE(jsonb_agg(jsonb_build_object('at', g.at) ORDER BY g.at DESC), '[]'::jsonb)",
    ] },
];

const NEW_FUNCTIONS = ['private.event_table_refusal_message', 'private.event_table_type_delete_refusal', 'public.event_table_copy'];

const allMigrations = (): string[] =>
    fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f) || /^\d{4}_.+\.sql$/.test(f)).sort();

/** Texte de la dernière définition de schéma.nom dans les fichiers donnés (du CREATE au second $$). */
function lastDefinition(name: string, files: readonly string[]): string | null {
    const head = new RegExp(`^CREATE (OR REPLACE )?FUNCTION ${name.replace('.', '\\.')}\\s*\\(`, 'i');
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

describe('Lot 11c-c — migration des correctifs de la contre-vérification', () => {
    test('présente, juste après 20261215000001', () => {
        const all = fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
        assert.ok(all.includes(FILE), `migration absente : supabase/migrations/${FILE}`);
        const before = all.filter((f) => f < FILE);
        assert.equal(before[before.length - 1], '20261215000001_l11cc_lectures_tables.sql');
    });

    test('sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur', async () => {
        const sql = fs.readFileSync(path.join(DIR, FILE), 'utf8');
        assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im);
        await inRolledBackTransaction(async (c) => {
            await c.query(sql);
            await c.query(sql);
        });
    });

    for (const spec of RECOPIES) {
        test(`recopie de ${spec.fn} : aucune ligne de la dernière définition précédente perdue`, () => {
            const previous = lastDefinition(spec.fn, allMigrations().filter((f) => f < FILE));
            const mine = lastDefinition(spec.fn, [FILE]);
            assert.ok(previous, `${spec.fn} : définition précédente introuvable`);
            assert.ok(mine, `${spec.fn} : recopie absente de ${FILE}`);
            const kept = new Set(mine!.split('\n').map((l) => l.trim()));
            const lost = previous!.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !kept.has(l) && !spec.replaced.includes(l));
            assert.deepEqual(lost, [], `${spec.fn} : lignes perdues`);
            // Chaque ligne déclarée remplacée l'est vraiment (liste exacte, rien de trop)
            const prevLines = new Set(previous!.split('\n').map((l) => l.trim()));
            for (const l of spec.replaced) {
                assert.ok(prevLines.has(l), `${spec.fn} : « ${l} » absente de la définition précédente`);
                assert.ok(!kept.has(l), `${spec.fn} : « ${l} » encore présente`);
            }
        });
    }

    test('la tête de la migration cite le fichier et les lignes de chaque recopie', () => {
        const head = fs.readFileSync(path.join(DIR, FILE), 'utf8');
        const missing = RECOPIES.filter((spec) => !new RegExp(`${spec.fn.replace('.', '\\.')}[^\\n]*recopie de \\d{14}_[a-z0-9_]+\\.sql:\\d+-\\d+`).test(head));
        assert.deepEqual(missing.map((s) => s.fn), []);
    });

    test('fonctions nouvelles : absentes de toute migration antérieure', () => {
        for (const fn of NEW_FUNCTIONS) {
            assert.equal(lastDefinition(fn, allMigrations().filter((f) => f < FILE)), null, `${fn} existe déjà avant`);
            assert.ok(lastDefinition(fn, [FILE]), `${fn} absente de ${FILE}`);
        }
    });

    test('T4 : chaque texte de refus d’écriture des tables n’est écrit qu’une fois dans la migration', () => {
        const sql = fs.readFileSync(path.join(DIR, FILE), 'utf8').replace(/--[^\n]*/g, '');
        const message = lastDefinition('private.event_table_refusal_message', [FILE])!;
        const texts = [...message.matchAll(/THEN '((?:[^']|'')+)'/g)].map((m) => m[1]);
        assert.equal(texts.length, 8, texts.join('\n'));
        for (const t of texts) assert.equal(sql.split(t).length - 1, 1, `« ${t} » écrit plusieurs fois`);
        const edit = lastDefinition('private.event_table_edit_refusal', [FILE])!;
        assert.doesNotMatch(edit, /'message', '/, 'event_table_edit_refusal : aucun texte en dur');
        const guard = lastDefinition('private.event_table_refusal', [FILE])!;
        assert.match(guard, /private\.event_table_edit_refusal\(p_event, p_actor\)/);
        assert.doesNotMatch(guard, /ticket_category_guard\(|event_edit_refusal\('/, 'la garde d’écriture ne définit aucun refus elle-même');
    });

    test('droits : event_table_copy au rôle de service seulement ; aides de private à aucun rôle de l’API ; recopies inchangées', async () => {
        const rows = await writeLocal(async (c) => (await c.query<{ fn: string; anon: boolean; auth: boolean; svc: boolean }>(
            `SELECT x.fn,
                    has_function_privilege('anon', x.fn, 'execute') AS anon,
                    has_function_privilege('authenticated', x.fn, 'execute') AS auth,
                    has_function_privilege('service_role', x.fn, 'execute') AS svc
               FROM unnest($1::text[]) AS x(fn)`,
            [['public.event_table_copy(jsonb)', 'public.event_table_report(jsonb)', 'public.event_table_door_list(jsonb)', 'public.event_table_type_delete(jsonb)',
                'private.event_table_refusal_message(text)', 'private.event_table_type_delete_refusal(uuid)', 'private.event_table_edit_refusal(uuid,uuid)',
                'private.event_table_refusal(uuid,uuid)']])).rows);
        const bad = rows.filter((r) => r.anon || r.auth || (r.fn.startsWith('public.') ? !r.svc : r.svc));
        assert.deepEqual(bad, [], `droits inattendus : ${JSON.stringify(bad)}`);
    });
});
