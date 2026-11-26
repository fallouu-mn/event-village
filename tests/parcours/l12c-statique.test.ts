/**
 * Lot 12c — contrôles sans base (migrations 20261224…, code applicatif).
 *  S1 Recopies : product_regulated, products_order_guard, order_product_regulation_decide (dernière définition :
 *     20261130000002_l12a_catalogue.sql) et order_quote_compute (20261130000004_l12a_devis_commande.sql:196-456) sont
 *     recopiées UNE seule fois dans le lot et gardent chaque ligne de leur dernière définition (commentaires et blancs
 *     retirés, espaces réduits), sauf les lignes élargies, listées une à une avec leur remplaçante.
 *  S2 Fonctions non recopiées : finance_setting_set, fin_setting_valid, platform_settings_defaults (cv12a-3 S1 n'en admet
 *     qu'une recopie après main), private.order_issue_code et la règle products_read (lot 12b), order_partner_action et
 *     order_view (lot 12a, inchangées).
 *  S3 Migrations : sans BEGIN ni COMMIT ; chaque fonction publique créée est retirée à PUBLIC, anon, authenticated et
 *     donnée au seul rôle de service (sauf la fonction du déclencheur) ; chaque aide private est retirée à tous les rôles
 *     de l'API, rôle de service compris, et jamais donnée.
 *  S4 Écritures des produits : aucun code applicatif n'écrit products directement, sauf le statut
 *     (ProductService.writeProduct) ; création, modification et retrait passent par order_product_save /
 *     order_product_remove (seuls chemins qui posent l'état « à vérifier » et l'archivage).
 *  S5 Fiche SUSPENDU : chaque écriture ajoutée par le lot est refusée par la garde de la fiche (partnerEventWrite).
 *  S6 Avis : les deux types ajoutés ont, dans le catalogue, les canaux, le public, le droit et la règle de nuit de la base.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { partnerEventWrite } from '../../lib/auth/partner-fiche-guard';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const FIRST_12C = '20261224000001';
const lotFiles = (): string[] => readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql') && f >= FIRST_12C && f < '20261228').sort();

function definitions(schema: string, name: string): Array<{ file: string; body: string }> {
    const out: Array<{ file: string; body: string }> = [];
    const head = new RegExp(`CREATE OR REPLACE FUNCTION ${schema}\\.${name}\\s*\\(`, 'g');
    for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
        const text = readFileSync(join(MIGRATIONS, file), 'utf8');
        for (const m of text.matchAll(head)) {
            const as = text.indexOf('AS $', m.index!);
            const tag = text.slice(as + 3, text.indexOf('$', as + 4) + 1);
            const start = as + 3 + tag.length;
            out.push({ file, body: text.slice(start, text.indexOf(tag, start)) });
        }
    }
    return out;
}
const lines = (body: string): string[] => body.split(/\r?\n/).map((l) => l.replace(/--.*$/, '').replace(/\s+/g, ' ').trim()).filter(Boolean);

const RECOPIED = ['product_regulated', 'products_order_guard', 'order_product_regulation_decide', 'order_quote_compute'] as const;

/** Lignes de la dernière définition élargies par le lot : ligne d'origine → lignes qui la remplacent (même sens, plus). */
const REPLACED: Record<string, Record<string, string[]>> = {
    product_regulated: {
        'SELECT COALESCE((SELECT pr.is_regulated OR COALESCE(pr.regulated_admin, FALSE) FROM public.products pr WHERE pr.id = p_product_id), TRUE);':
            ['SELECT COALESCE((SELECT pr.is_regulated OR COALESCE(pr.regulated_admin, FALSE) OR pr.review_state IS NOT NULL FROM public.products pr WHERE pr.id = p_product_id), TRUE);'],
    },
    order_product_regulation_decide: {
        'SET regulated_admin = v_value, regulated_checked_by = v_actor, regulated_checked_at = now(), updated_at = now()':
            ['SET regulated_admin = v_value, regulated_checked_by = v_actor, regulated_checked_at = now(), updated_at = now(),',
                'review_state = NULL, review_words = NULL, review_requested_at = NULL'],
        "jsonb_build_object('reason', v_reason, 'partner_box', pr.is_regulated));":
            ["jsonb_build_object('reason', v_reason, 'partner_box', pr.is_regulated)",
                "|| jsonb_strip_nulls(jsonb_build_object('review_words', to_jsonb(pr.review_words), 'product_name', pr.name)));"],
    },
};

describe('l12c — contrôles sans base', () => {
    test('S1 — 4 recopies, une fois chacune dans le lot, sans ligne perdue (lignes élargies déclarées)', () => {
        const report: string[] = [];
        for (const name of RECOPIED) {
            const defs = definitions('public', name);
            const mainDef = defs.filter((d) => d.file < FIRST_12C).at(-1);
            const lotDefs = defs.filter((d) => d.file >= FIRST_12C);
            assert.ok(mainDef, `${name} : aucune définition avant le lot`);
            assert.equal(lotDefs.length, 1, `${name} : une seule recopie dans le lot (${lotDefs.map((d) => d.file).join(', ')})`);
            const expected = name === 'order_quote_compute' ? '20261130000004_l12a_devis_commande.sql' : '20261130000002_l12a_catalogue.sql';
            assert.equal(mainDef!.file, expected, `${name} : dernière définition attendue dans ${expected}`);
            const lot = new Map<string, number>();
            for (const l of lines(lotDefs[0].body)) lot.set(l, (lot.get(l) ?? 0) + 1);
            for (const l of lines(mainDef!.body)) {
                if ((lot.get(l) ?? 0) > 0) {
                    lot.set(l, lot.get(l)! - 1);
                    continue;
                }
                const repl = REPLACED[name]?.[l];
                if (repl && repl.every((r) => (lot.get(r) ?? 0) > 0)) continue;
                report.push(`${name} (${mainDef!.file} → ${lotDefs[0].file}) : ligne perdue ${JSON.stringify(l)}`);
            }
        }
        console.log(`[L12C-S1] ${report.length === 0 ? 'aucune ligne perdue' : report.join('\n')}`);
        assert.deepEqual(report, []);
    });

    test('S2 — réglages, code de remise, règle de lecture des produits et actions de la partenaire non recopiés', () => {
        const text = lotFiles().map((f) => readFileSync(join(MIGRATIONS, f), 'utf8')).join('\n');
        assert.ok(lotFiles().length >= 4, `migrations du lot : ${lotFiles().join(', ')}`);
        for (const fn of ['finance_setting_set', 'fin_setting_valid', 'platform_settings_defaults', 'order_partner_action', 'order_view', 'order_partner_list', 'order_create']) {
            assert.doesNotMatch(text, new RegExp(`FUNCTION\\s+public\\.${fn}\\s*\\(`), `${fn} recopiée par le lot`);
        }
        assert.doesNotMatch(text, /FUNCTION\s+private\.order_issue_code\s*\(/, 'private.order_issue_code recopiée (lot 12b)');
        assert.doesNotMatch(text, /POLICY\s+"?products_read"?/i, 'règle products_read touchée (lot 12b)');
    });

    test('S3 — sans BEGIN ni COMMIT ; fonctions publiques au rôle de service seulement, aides private à aucun rôle de l’API', () => {
        const faults: string[] = [];
        for (const f of lotFiles()) {
            const raw = readFileSync(join(MIGRATIONS, f), 'utf8');
            const code = raw.replace(/--[^\n]*/g, '');
            const outside = code.replace(/\$\$[\s\S]*?\$\$/g, 'CORPS');
            if (/^\s*(BEGIN|COMMIT)\s*;/im.test(outside)) faults.push(`${f} : BEGIN ou COMMIT`);
            for (const m of outside.matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+(public|private)\.(\w+)\s*\(([^)]*)\)/gi)) {
                const [, schema, name] = m;
                const revoke = new RegExp(`REVOKE ALL ON FUNCTION ${schema}\\.${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated${schema === 'private' ? ', service_role' : ''};`);
                if (!revoke.test(outside)) faults.push(`${f} : ${schema}.${name} sans REVOKE complet`);
                const grant = new RegExp(`GRANT EXECUTE ON FUNCTION ${schema}\\.${name}\\(`);
                if (schema === 'private' && grant.test(outside)) faults.push(`${f} : aide private.${name} donnée à un rôle`);
                if (schema === 'public' && name !== 'products_order_guard' && !new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^)]*\\) TO service_role;`).test(outside)) {
                    faults.push(`${f} : public.${name} non donnée au rôle de service`);
                }
                if (schema === 'public' && new RegExp(`GRANT [^;]*${name}[^;]* TO [^;]*(anon|authenticated)`).test(outside)) faults.push(`${f} : public.${name} donnée à anon ou authenticated`);
            }
            for (const m of raw.matchAll(/CREATE OR REPLACE FUNCTION [\s\S]*?\$\$;/g)) {
                if (!/SET search_path = public/.test(m[0])) faults.push(`${f} : fonction sans search_path fixé (${m[0].slice(27, 80)})`);
            }
        }
        assert.deepEqual(faults, []);
    });

    test('S4 — aucune écriture directe de products dans le code applicatif, sauf le statut', () => {
        const hits: string[] = [];
        const walk = (dir: string): void => {
            for (const e of readdirSync(dir)) {
                const full = join(dir, e);
                if (statSync(full).isDirectory()) {
                    if (e !== 'node_modules') walk(full);
                    continue;
                }
                if (!/\.(ts|tsx)$/.test(e)) continue;
                const src = readFileSync(full, 'utf8');
                for (const m of src.matchAll(/from\(\s*['"]products['"]\s*\)([\s\S]{0,400})/g)) {
                    const chain = m[1].split(/;\s*\n/)[0];
                    if (/\.(insert|update|upsert|delete)\s*\(/.test(chain)) hits.push(`${relative(ROOT, full).split('\\').join('/')} : ${chain.replace(/\s+/g, ' ').slice(0, 90)}`);
                }
            }
        };
        walk(join(ROOT, 'app'));
        walk(join(ROOT, 'lib'));
        const allowed = hits.filter((h) => h.startsWith('lib/products/product.service.ts') && /\.update\(\{ \.\.\.fields, updated_at/.test(h));
        assert.deepEqual(hits.filter((h) => !allowed.includes(h)), [], 'écriture directe de products hors du statut');
        assert.equal(allowed.length, 1, `écriture du statut (writeProduct) : ${JSON.stringify(hits)}`);
        const service = readFileSync(join(ROOT, 'lib/products/product.service.ts'), 'utf8');
        assert.match(service, /rpc\('order_product_save'/);
        assert.match(service, /rpc\('order_product_remove'/);
        assert.match(service, /return this\.writeProduct\(productId, partnerId, \{ status \}\)/, 'writeProduct sert au statut seulement');
        assert.equal((service.match(/this\.writeProduct\(/g) ?? []).length, 1, 'writeProduct appelé ailleurs que pour le statut');
    });

    test('S5 — chaque écriture ajoutée est refusée à une fiche SUSPENDU par la garde de la fiche', () => {
        const id = '00000000-0000-4000-8000-000000000000';
        for (const [method, path] of [
            ['POST', `/api/partner/products/${id}/options`], ['PATCH', `/api/partner/products/${id}/options/${id}`], ['DELETE', `/api/partner/products/${id}/options/${id}`],
            ['POST', `/api/partner/venues/${id}/zones`], ['PUT', `/api/partner/venues/${id}/zones`], ['PATCH', `/api/partner/venues/${id}/zones/${id}`],
            ['DELETE', `/api/partner/venues/${id}/zones/${id}`], ['DELETE', `/api/partner/products/${id}`], ['POST', '/api/partner/products'], ['PATCH', `/api/partner/products/${id}`],
        ] as const) {
            assert.equal(partnerEventWrite(method, path), true, `${method} ${path} non gardée`);
        }
        for (const path of ['/api/partner/catalog', '/api/partner/orders/day']) assert.equal(partnerEventWrite('GET', path), false, `${path} : lecture`);
    });

    test('S6 — avis ADMIN_PRODUCT_REVIEW et PRODUCT_REVIEW_DECIDED : catalogue identique à la base', () => {
        const sql = readFileSync(join(MIGRATIONS, '20261224000001_l12c_verification.sql'), 'utf8');
        const expected: Record<string, { channels: string[]; audience: string; policy: string; perm: string | null; night: string }> = {};
        for (const m of sql.matchAll(/\('(ADMIN_PRODUCT_REVIEW|PRODUCT_REVIEW_DECIDED)',\s*'ESSENTIAL', NULL, ARRAY\[([^\]]+)\],\s*'(\w+)',\s*'(\w+)', FALSE, (NULL|'[\w.]+'),\s*'(\w+)'\)/g)) {
            expected[m[1]] = { channels: m[2].replace(/'/g, '').split(',').map((s) => s.trim()), audience: m[3], policy: m[4], perm: m[5] === 'NULL' ? null : m[5].replace(/'/g, ''), night: m[6] };
        }
        assert.deepEqual(Object.keys(expected).sort(), ['ADMIN_PRODUCT_REVIEW', 'PRODUCT_REVIEW_DECIDED']);
        for (const [type, e] of Object.entries(expected)) {
            const tpl = (NOTIFICATION_CATALOG as unknown as Record<string, { channels: readonly string[]; audience: string; suspendedPolicy: string; adminPermission: string | null; nightPolicy: string }>)[type];
            assert.ok(tpl, `${type} absent du catalogue`);
            assert.deepEqual([[...tpl.channels].sort(), tpl.audience, tpl.suspendedPolicy, tpl.adminPermission, tpl.nightPolicy], [[...e.channels].sort(), e.audience, e.policy, e.perm, e.night], type);
        }
    });
});
