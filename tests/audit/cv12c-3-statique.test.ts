/**
 * Contre-vérification du lot 12c — contrôles sans base (rouge = trou, vert = garde-fou tenu), calculés indépendamment des
 * tests du lot.
 *
 *  T3b Les produits déjà enregistrés (créés avant le lot par les routes du lot 7, ou par le rôle de service) ne sont pas
 *      revus par la migration : aucune instruction hors fonction ne pose l'état « à vérifier » sur les produits existants.
 *  S1  Recopies : chaque ligne de la dernière définition (avant le lot) de product_regulated, products_order_guard,
 *      order_product_regulation_decide et order_quote_compute se retrouve dans la recopie (lignes élargies déclarées à part) ;
 *      une seule recopie par fonction dans le lot ; finance_setting_set, fin_setting_valid et platform_settings_defaults
 *      non recopiées.
 *  S2  Aucune écriture directe de products, product_options, order_delivery_zones dans le code serveur, tous dossiers
 *      (app, lib, components, hooks, scripts, middleware, supabase/functions), quelle que soit la forme des guillemets.
 *  S3  Avis : les deux types nouveaux n'ont pas de SMS ; liens vers des pages qui existent ; textes sans mot technique.
 *      Tous les SMS de commande : GSM-7, un segment, au pire cas (noms longs, accents, signes de la table d'extension).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';

const ROOT = process.cwd();
const MIG = join(ROOT, 'supabase', 'migrations');
const LOT = (f: string): boolean => f >= '20261224000001' && f < '20261228';
const files = (): string[] => readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();

function defs(name: string): Array<{ file: string; body: string }> {
    const out: Array<{ file: string; body: string }> = [];
    const head = new RegExp(`CREATE OR REPLACE FUNCTION (?:public\\.)?${name}\\s*\\(`, 'gi');
    for (const file of files()) {
        const text = readFileSync(join(MIG, file), 'utf8');
        for (const m of text.matchAll(head)) {
            const as = text.indexOf('$$', m.index!);
            const end = text.indexOf('$$', as + 2);
            out.push({ file, body: text.slice(as + 2, end) });
        }
    }
    return out;
}
const norm = (body: string): string[] => body.split(/\r?\n/).map((l) => l.replace(/--.*$/, '').replace(/\s+/g, ' ').trim()).filter(Boolean);

describe('T3b — produits existants revus par la migration', () => {
    test('une instruction hors fonction pose « à vérifier » sur les produits déjà enregistrés qui contiennent un mot de la liste', () => {
        const found: string[] = [];
        for (const f of files().filter(LOT)) {
            // Corps des fonctions retirés : seules les instructions exécutées par la migration elle-même restent
            const top = readFileSync(join(MIG, f), 'utf8').replace(/\$\$[\s\S]*?\$\$/g, '$$$$').replace(/--.*$/gm, '');
            if (/UPDATE\s+public\.products[\s\S]{0,600}review_state/i.test(top)) found.push(f);
        }
        assert.ok(found.length > 0, 'aucune migration du lot ne revoit les produits déjà enregistrés (un « Bière Gazelle » créé avant le lot reste vendable en ligne)');
    });
});

describe('S1 — recopies', () => {
    const REPLACED: Record<string, string[]> = {
        product_regulated: ['SELECT COALESCE((SELECT pr.is_regulated OR COALESCE(pr.regulated_admin, FALSE) FROM public.products pr WHERE pr.id = p_product_id), TRUE);'],
        order_product_regulation_decide: [
            'SET regulated_admin = v_value, regulated_checked_by = v_actor, regulated_checked_at = now(), updated_at = now()',
            "jsonb_build_object('reason', v_reason, 'partner_box', pr.is_regulated));",
        ],
    };
    for (const name of ['product_regulated', 'products_order_guard', 'order_product_regulation_decide', 'order_quote_compute']) {
        test(`${name} : une recopie dans le lot, aucune ligne perdue`, () => {
            const all = defs(name);
            const inLot = all.filter((d) => LOT(d.file));
            assert.equal(inLot.length, 1, `${inLot.length} recopies dans le lot`);
            const previous = all.filter((d) => !LOT(d.file)).at(-1)!;
            const now = new Set(norm(inLot[0].body));
            const lost = norm(previous.body).filter((l) => !now.has(l) && !(REPLACED[name] ?? []).includes(l));
            assert.deepEqual(lost, [], `${name} : lignes de ${previous.file} absentes de la recopie`);
        });
    }
    test('finance_setting_set, fin_setting_valid, platform_settings_defaults : non recopiées dans le lot', () => {
        for (const name of ['finance_setting_set', 'fin_setting_valid', 'platform_settings_defaults']) {
            assert.equal(defs(name).filter((d) => LOT(d.file)).length, 0, `${name} recopiée`);
        }
    });
});

describe('S2 — écritures directes des tables du catalogue', () => {
    test('aucun code serveur ni client n’écrit products, product_options, order_delivery_zones directement (hors statut)', () => {
        const hits: string[] = [];
        const walk = (dir: string): void => {
            if (!existsSync(dir)) return;
            for (const e of readdirSync(dir)) {
                const full = join(dir, e);
                if (statSync(full).isDirectory()) {
                    if (!['node_modules', '.next', 'tests'].includes(e)) walk(full);
                    continue;
                }
                if (!/\.(ts|tsx|js|mjs|cjs)$/.test(e)) continue;
                const src = readFileSync(full, 'utf8');
                for (const m of src.matchAll(/from\(\s*[`'"](products|product_options|order_delivery_zones)[`'"]\s*\)([\s\S]{0,400})/g)) {
                    const chain = m[2].split(/;\s*\n/)[0];
                    if (/\.(insert|update|upsert|delete)\s*\(/.test(chain)) hits.push(`${relative(ROOT, full).split('\\').join('/')} : ${m[1]} ${chain.replace(/\s+/g, ' ').slice(0, 80)}`);
                }
            }
        };
        for (const d of ['app', 'lib', 'components', 'hooks', 'scripts', 'supabase/functions']) walk(join(ROOT, d));
        for (const f of ['middleware.ts', 'instrumentation.ts']) {
            const src = readFileSync(join(ROOT, f), 'utf8');
            if (/from\(\s*[`'"](products|product_options|order_delivery_zones)[`'"]/.test(src)) hits.push(f);
        }
        const status = hits.filter((h) => h.startsWith('lib/products/product.service.ts : products') && /\.update\(\{ \.\.\.fields, updated_at/.test(h));
        assert.deepEqual(hits.filter((h) => !status.includes(h)), [], 'écriture directe hors fonctions en base');
    });
});

// ── GSM 03.38 (calcul indépendant) ──────────────────────────────────────────────────────────────────────────────────
const GSM7 = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const EXT = new Set(Array.from('\f^{}\\[~]|€'));
function septets(text: string): number | null {
    let s = 0;
    for (const ch of Array.from(text)) {
        if (GSM7.has(ch)) s += 1;
        else if (EXT.has(ch)) s += 2;
        else return null;
    }
    return s;
}

type Entry = { channels: readonly string[]; sms?: (d: object, ctx: { appUrl: string }) => string; inApp?: (d: object) => { title: string; content: string }; link: (d: object) => string; sample: object };
const catalog = NOTIFICATION_CATALOG as unknown as Record<string, Entry>;

describe('S3 — avis', () => {
    test('ADMIN_PRODUCT_REVIEW, PRODUCT_REVIEW_DECIDED : pas de SMS, lien vers une page qui existe, aucun mot technique', () => {
        const pages: Record<string, string> = { ADMIN_PRODUCT_REVIEW: 'app/admin/products/page.tsx', PRODUCT_REVIEW_DECIDED: 'app/partner/products/[id]/page.tsx' };
        for (const type of ['ADMIN_PRODUCT_REVIEW', 'PRODUCT_REVIEW_DECIDED']) {
            const e = catalog[type];
            assert.ok(!e.channels.includes('SMS') && !e.sms, `${type} part par SMS`);
            assert.ok(existsSync(join(ROOT, pages[type])), `${type} : page ${pages[type]} absente`);
            const variants = type === 'PRODUCT_REVIEW_DECIDED'
                ? [{ decision: 'AUTORISE', partner_box: false }, { decision: 'AUTORISE', partner_box: true }, { decision: 'REFUSE', reason: 'Boisson alcoolisée' }]
                : [{ words: ['bière', 'whisky'] }, { words: ['bière'], venue_name: undefined }];
            for (const v of variants) {
                const d = { ...e.sample, ...v };
                const r = e.inApp!(d);
                const text = `${r.title} ${r.content} ${e.link(d)}`;
                assert.ok(!/\b[A-Z]{2,}_[A-Z_]+\b|partners\.validate|review_|null|undefined|NaN/.test(`${r.title} ${r.content}`), `${type} : mot technique dans « ${r.title} — ${r.content} »`);
                assert.match(e.link(d), type === 'ADMIN_PRODUCT_REVIEW' ? /^\/admin\/products\?produit=[0-9a-f-]{36}$/ : /^\/partner\/products\/[0-9a-f-]{36}$/, text);
            }
        }
    });

    test('tous les SMS de commande : GSM-7, un segment au pire cas', () => {
        const LONG = 'Chez Mame Diarra « Tëranga » – grillades {[~]} € & poissons du fleuve, un nom vraiment très très long';
        const origins = [undefined, 'CLIENT', 'PARTENAIRE', 'EVENT_VILLAGE', 'REFUSEE', 'SANS_REPONSE', 'EXPIREE', 'NON_RETIREE', 'REGLEMENTE'];
        const report: string[] = [];
        const bad: string[] = [];
        for (const [type, e] of Object.entries(catalog)) {
            if (!type.startsWith('ORDER_') || !e.sms) continue;
            let worst = 0;
            for (const mode of ['LIVRAISON', 'RETRAIT', 'SUR_PLACE']) {
                for (const origin of origins) {
                    for (const balance of [0, 9_875_000]) {
                        const d = { ...e.sample, venue_name: LONG, zone_name: LONG, mode, ...(origin ? { origin } : {}), balance_due: balance, refund_amount: 9_875_000, amount: 9_875_000, reason: LONG };
                        let text: string;
                        try {
                            text = e.sms(d, { appUrl: 'https://www.event-village.sn' });
                        } catch (err) {
                            // Combinaison que la base ne produit pas pour ce type (donnée refusée par le modèle) : ignorée
                            if ((err as Error).name === 'TemplateDataError') continue;
                            throw err;
                        }
                        const s = septets(text);
                        if (s === null || s > 160) bad.push(`${type} (${mode}, ${origin ?? '-'}) : ${s ?? 'UCS-2'} — ${text}`);
                        else worst = Math.max(worst, s);
                    }
                }
            }
            report.push(`${type}=${worst}`);
        }
        console.log(`[CV12C-S3] pire cas en septets : ${report.join(' ')}`);
        assert.deepEqual(bad, []);
    });
});
