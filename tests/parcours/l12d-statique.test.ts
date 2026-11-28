/**
 * Lot 12d — contrôles sans base (lecture des migrations, du catalogue et des écrans).
 *
 *  S1 Recopies : chacune des 5 fonctions recopiées par le lot (order_view, order_close_apply, order_payable_refusal,
 *     order_quote_compute, order_venue_menu) l'est UNE seule fois dans les migrations du lot (fichiers « _l12d_ ») et
 *     garde chaque ligne de sa dernière définition antérieure (commentaires et blancs retirés, espaces réduits), sauf les
 *     lignes remplacées déclarées ici avec leurs remplaçantes (qui doivent y être).
 *  S2 Fonctions jamais recopiées par le lot : order_courier_action, order_courier_respond, order_courier_remove (avis A6
 *     et A7 par déclencheur ; APPEL et ABSENT par order_delivery_step), order_product_save (allergènes par
 *     order_product_details_set), order_cancel, order_partner_action, order_tick, finance_setting_set,
 *     notification_outbox_claim (recopiée par le lot « avis »).
 *  S3 Fonctions nouvelles : absentes de toute migration antérieure ; publiques au seul rôle de service, aides private à
 *     aucun rôle (REVOKE … FROM PUBLIC, anon, authenticated[, service_role] et GRANT … TO service_role).
 *  S4 Migrations sans BEGIN ni COMMIT ; types d'avis du lot : registre SQL = catalogue (canaux, public, nuit, droit).
 *  S5 SMS des avis du lot (ORDER_CLIENT_ABSENT, ORDER_ABSENCE_DECIDED) : un segment GSM-7 au pire cas ; aucun nom de
 *     famille entier dans un avis (prénom et initiale) ; aucun code de remise.
 *  S6 Écrans du lot : aucune lecture REST des commandes, des signalements ni des produits ; aucun montant additionné ou
 *     soustrait dans le navigateur (montants lus tels quels).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { NOTIFICATION_CATALOG, renderNotification } from '../../lib/notifications/catalog';

const ROOT = process.cwd();
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const FILES = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const LOT = (f: string): boolean => f.includes('_l12d_');
const FIRST_LOT = FILES.find(LOT)!;

const RECOPIED: Array<{ schema: 'public' | 'private'; name: string; from: string }> = [
    { schema: 'public', name: 'order_view', from: '20261130000006_l12a_etapes.sql' },
    { schema: 'private', name: 'order_close_apply', from: '20261130000006_l12a_etapes.sql' },
    { schema: 'public', name: 'order_payable_refusal', from: '20261130000005_l12a_paiement.sql' },
    { schema: 'public', name: 'order_quote_compute', from: '20261224000003_l12c_devis.sql' },
    { schema: 'public', name: 'order_venue_menu', from: '20261226000002_l12b_carte_des_plats.sql' },
];

/** Lignes remplacées par le lot : ligne d'origine → lignes qui la remplacent (même sens, lot 12d en plus). */
const REPLACED: Record<string, Record<string, string[]>> = {
    order_view: {
        'cu.first_name AS courier_first_name': ['cu.first_name AS courier_first_name, ve.address AS venue_address'],
        "'address', o.delivery_address, 'phone', o.contact_phone, 'notes', o.delivery_notes)) END,": [
            "'address', o.delivery_address, 'phone', CASE WHEN v_as <> 'COURIER' OR o.order_state = 'EN_ROUTE' THEN o.contact_phone END,",
            "'notes', o.delivery_notes)) END,",
        ],
    },
};

const NEVER_RECOPIED = [
    'order_courier_action', 'order_courier_respond', 'order_courier_remove', 'order_product_save', 'order_cancel',
    'order_partner_action', 'order_tick', 'finance_setting_set', 'fin_setting_valid', 'platform_settings_defaults',
    'notification_outbox_claim', 'notif_cashouts_notify', 'notification_sync_log',
];

const NEW_PUBLIC = [
    'order_courier_day', 'order_courier_invitation_view', 'order_delivery_step', 'order_watch_tick', 'order_absence_decide',
    'order_issue_report', 'order_issue_close', 'order_admin_list', 'order_admin_view', 'order_closure_orders', 'order_closure_keep',
    'order_venue_pause', 'order_partner_pauses', 'order_product_details_set',
];
const NEW_PRIVATE = [
    'order_person_short', 'order_courier_status_notify', 'order_admin_allowed', 'order_admin_role', 'order_closure_hits', 'order_closure_notify',
];

function definitions(schema: string, name: string): Array<{ file: string; body: string }> {
    const out: Array<{ file: string; body: string }> = [];
    const head = new RegExp(`CREATE OR REPLACE FUNCTION ${schema}\\.${name}\\s*\\(`, 'g');
    for (const file of FILES) {
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
const lotText = (): string => FILES.filter(LOT).map((f) => readFileSync(join(MIGRATIONS, f), 'utf8')).join('\n');

describe('l12d — contrôles sans base', () => {
    test('S1 — 5 recopies : une seule chacune, depuis la dernière définition, aucune ligne perdue (remplacements déclarés)', () => {
        const report: string[] = [];
        for (const r of RECOPIED) {
            const defs = definitions(r.schema, r.name);
            const before = defs.filter((d) => d.file < FIRST_LOT && !LOT(d.file));
            const lot = defs.filter((d) => LOT(d.file));
            assert.equal(lot.length, 1, `${r.name} : une seule recopie dans le lot (${lot.map((d) => d.file).join(', ')})`);
            const last = before.at(-1);
            assert.ok(last, `${r.name} : aucune définition avant le lot`);
            assert.equal(last.file, r.from, `${r.name} : la dernière définition avant le lot est dans ${last.file}, pas ${r.from}`);
            const mine = new Map<string, number>();
            for (const l of lines(lot[0].body)) mine.set(l, (mine.get(l) ?? 0) + 1);
            const replaced = REPLACED[r.name] ?? {};
            const lost: string[] = [];
            for (const l of lines(last.body)) {
                if ((mine.get(l) ?? 0) > 0) {
                    mine.set(l, mine.get(l)! - 1);
                } else if (replaced[l]) {
                    for (const rep of replaced[l]) assert.ok(lines(lot[0].body).includes(rep), `${r.name} : remplaçante absente : ${rep}`);
                } else {
                    lost.push(l);
                }
            }
            report.push(`${r.name} : ${lines(last.body).length} lignes d'origine, ${lost.length} perdue(s)`);
            assert.deepEqual(lost, [], `${r.name} : lignes perdues`);
        }
        console.log(`[L12D] S1 ${report.join(' ; ')}`);
    });

    test('S2 — fonctions jamais recopiées par le lot', () => {
        for (const name of NEVER_RECOPIED) {
            for (const schema of ['public', 'private']) {
                const lot = definitions(schema, name).filter((d) => LOT(d.file));
                assert.deepEqual(lot.map((d) => d.file), [], `${schema}.${name} ne doit pas être redéfinie par le lot`);
            }
        }
    });

    test('S3 — fonctions nouvelles : absentes avant le lot ; droits (service seul, private à personne)', () => {
        const text = lotText();
        for (const [schema, names] of [['public', NEW_PUBLIC], ['private', NEW_PRIVATE]] as const) {
            for (const name of names) {
                const defs = definitions(schema, name);
                assert.deepEqual(defs.filter((d) => !LOT(d.file)).map((d) => d.file), [], `${schema}.${name} existait avant le lot`);
                assert.equal(defs.filter((d) => LOT(d.file)).length, 1, `${schema}.${name} : une définition dans le lot`);
                const revoke = new RegExp(`REVOKE ALL ON FUNCTION ${schema}\\.${name}\\([^)]*\\) FROM PUBLIC, anon, authenticated${schema === 'private' ? ', service_role' : ''};`);
                assert.match(text, revoke, `${schema}.${name} : REVOKE manquant`);
                const grant = new RegExp(`GRANT EXECUTE ON FUNCTION ${schema}\\.${name}\\(`);
                if (schema === 'public') assert.match(text, grant, `${schema}.${name} : GRANT au rôle de service manquant`);
                else assert.doesNotMatch(text, grant, `${schema}.${name} : une aide private n'est donnée à personne`);
            }
        }
        for (const r of RECOPIED) {
            const revoke = new RegExp(`REVOKE ALL ON FUNCTION ${r.schema}\\.${r.name}\\(`);
            assert.match(text, revoke, `${r.name} : droits répétés après la recopie`);
        }
    });

    test('S4 — sans BEGIN ni COMMIT ; registre des types d’avis du lot = catalogue', () => {
        for (const f of FILES.filter(LOT)) {
            const t = readFileSync(join(MIGRATIONS, f), 'utf8');
            assert.doesNotMatch(t, /^\s*(BEGIN|COMMIT)\s*;/m, `${f} : BEGIN ou COMMIT`);
        }
        const sql = readFileSync(join(MIGRATIONS, FILES.find((f) => f.includes('_l12d_avis'))!), 'utf8');
        const rows = [...sql.matchAll(/\('([A-Z_]+)',\s*'ESSENTIAL', NULL, ARRAY\[([^\]]*)\],\s*'([A-Z]+)',\s*'([A-Z]+)', FALSE, (NULL|'[a-z.]+'),\s*'([A-Z]+)'\)/g)];
        assert.equal(rows.length, 13, 'treize types');
        for (const m of rows) {
            const tpl = (NOTIFICATION_CATALOG as Record<string, { channels: readonly string[]; audience: string; suspendedPolicy: string; nightPolicy: string; adminPermission: string | null }>)[m[1]];
            assert.ok(tpl, `${m[1]} absent du catalogue`);
            assert.deepEqual(m[2].split(',').map((c) => c.trim().replace(/'/g, '')), [...tpl.channels], `${m[1]} : canaux`);
            assert.deepEqual([m[3], m[4], m[6], m[5] === 'NULL' ? null : m[5].replace(/'/g, '')],
                [tpl.audience, tpl.suspendedPolicy, tpl.nightPolicy, tpl.adminPermission], `${m[1]} : public, compte suspendu, nuit, droit`);
        }
    });

    test('S5 — SMS d’un segment au pire cas ; prénom et initiale ; jamais de code', () => {
        const big = 999_999_999;
        const name = 'Chez Fatou’s « Grill » — cuisine du Sénégal 🍲 et Ελληνικά, ça marche très bien au bord de la mer, Ngor Almadies';
        const worst = { venue_name: name, partner_name: name, zone_name: name, items_count: 2_970, goods_total: big, paid_amount: big, balance_due: big, reason: 'x'.repeat(300) };
        const bad: string[] = [];
        for (const type of ['ORDER_CLIENT_ABSENT', 'ORDER_ABSENCE_DECIDED']) {
            const tpl = (NOTIFICATION_CATALOG as Record<string, { sample: object }>)[type];
            for (const refund of [0, 1, big]) {
                for (const mode of ['LIVRAISON', 'RETRAIT', 'SUR_PLACE']) {
                    const r = renderNotification(type as never, 'SMS' as never, { ...tpl.sample, ...worst, refund_amount: refund, mode } as never, { appUrl: 'https://eventvillage.sn' });
                    if (r.channel !== 'SMS' || r.measure.encoding !== 'GSM7' || r.measure.segments !== 1) bad.push(`${type}/${refund}/${mode} : ${JSON.stringify(r)}`);
                }
            }
        }
        assert.deepEqual(bad, []);
        const answered = renderNotification('ORDER_COURIER_ANSWERED' as never, 'IN_APP' as never,
            { invitation_id: '00000000-0000-4000-8000-000000000001', accepted: true, courier_name: 'Moussa D.' } as never, { appUrl: 'https://eventvillage.sn' });
        assert.match(JSON.stringify(answered), /Moussa D\./);
        // Le nom court vient de la base (private.order_person_short) : jamais le nom entier
        assert.match(lotText(), /upper\(left\(btrim\(p_last\), 1\)\) \|\| '\.'/);
        for (const type of Object.keys(NOTIFICATION_CATALOG).filter((t) => /^(ORDER_(COURIER_(ANSWERED|REMOVED|RETURN)|CLIENT_ABSENT|ABSENCE|ISSUE|CLOSURE|PAUSE)|ADMIN_ORDER_(ABSENT|ISSUE))/.test(t))) {
            const tpl = (NOTIFICATION_CATALOG as Record<string, { sample: object; channels: readonly string[] }>)[type];
            for (const ch of tpl.channels.filter((c) => c !== 'EMAIL')) {
                const text = JSON.stringify(renderNotification(type as never, ch as never, { ...tpl.sample, code: '7351', handover_code: '7351' } as never, { appUrl: 'https://eventvillage.sn' }));
                assert.doesNotMatch(text, /7351/, `${type}/${ch} : code de remise`);
            }
        }
    });

    test('S6 — écrans du lot : aucune lecture REST des commandes ni des produits, aucun calcul de montant', () => {
        const dirs = ['app/courier', 'components/orders/courier', 'app/admin/orders'];
        const files: string[] = [];
        const walk = (d: string): void => {
            const abs = join(ROOT, d);
            if (!existsSync(abs)) return;
            for (const e of readdirSync(abs)) {
                const rel = `${d}/${e}`;
                if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
                else if (/\.(tsx?|jsx?)$/.test(e)) files.push(rel);
            }
        };
        dirs.forEach(walk);
        assert.ok(files.length >= 4, `écrans du lot trouvés : ${files.join(', ')}`);
        const hits: string[] = [];
        for (const f of files) {
            const t = readFileSync(join(ROOT, f), 'utf8');
            if (/\.from\(\s*['"](orders|order_items|order_issues|products|partner_couriers|payments|refunds)['"]/.test(t)) hits.push(`${f} : lecture REST`);
            if (/(amount|balance|refund|paid|total|fee)\w*\s*[+-]\s*\w*(amount|balance|refund|paid|total|fee)/i.test(t)) hits.push(`${f} : calcul de montant`);
        }
        console.log(`[L12D] S6 ${files.length} fichiers ; ${JSON.stringify(hits)}`);
        assert.deepEqual(hits, []);
    });
});
