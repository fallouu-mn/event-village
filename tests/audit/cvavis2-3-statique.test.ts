/**
 * Contre-vérification du lot « Avis », phase 2 — contrôles SANS base (rouge = trou, vert = garde-fou tenu).
 *
 *  T5 Garde de l'adresse (C3, lib/notifications/app-url-guard.ts) : en production, N'IMPORTE QUELLE valeur de
 *     EV_DEV_TUNNEL_URL lève la garde, pour n'importe quelle adresse (l'exemption n'est bornée ni au tunnel ni au
 *     développement).
 *  T6 Lien du SMS d'invitation d'un livreur (B6) : /courier/invitations n'est pas une page (ni ici, ni sur
 *     lot12d/livreur-admin, qui n'a que /courier/invitations/[id]).
 *  T7 Garde-fou des mots (design1b-mots, bloc e) : le VRAI test est lancé sur une copie de l'arbre où des messages techniques
 *     sont introduits sous différentes formes ; chaque forme doit le faire échouer. Témoins (formes attrapées) exigés.
 *  S1 SMS ajoutés ou modifiés : un segment GSM-7 au pire cas (mesure indépendante : textes de 110 caractères avec des
 *     caractères hors GSM-7, montants à 9 999 999 F, compteurs à 999, adresse de 27 caractères).
 *  S2 Recopies : 12 fonctions, une définition chacune dans le lot, depuis la DERNIÈRE définition d'avant le lot, aucune
 *     ligne perdue (sauf la ligne déclarée de cashouts_simulation_guard).
 *  S3 Aucune écriture d'argent nouvelle dans les migrations du lot (hors lignes recopiées d'account_phone_finalize).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { appUrlStartupProblem } from '../../lib/notifications/app-url-guard';

const ROOT = process.cwd();
const MIG = path.join(ROOT, 'supabase', 'migrations');
const LOT = (f: string): boolean => f >= '20261230';

// ── T5 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('T5 — garde de l’adresse de l’application (C3)', () => {
    test('production, adresse de 45 caractères, EV_DEV_TUNNEL_URL quelconque (« oui ») : le démarrage doit être refusé', () => {
        const long = 'https://billetterie.event-village-senegal.com';
        assert.ok(appUrlStartupProblem({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: long }), 'témoin : refus sans la variable du tunnel');
        const problem = appUrlStartupProblem({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: long, EV_DEV_TUNNEL_URL: 'oui' });
        assert.ok(problem,
            'TROU : en production, une valeur quelconque de EV_DEV_TUNNEL_URL lève la garde pour une adresse de 45 caractères (SMS en deux segments)');
    });
    test('production, tunnel déclaré mais adresse de l’application différente et longue : refus attendu', () => {
        const problem = appUrlStartupProblem({
            NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://billetterie.event-village-senegal.com',
            EV_DEV_TUNNEL_URL: 'https://event-village-essai.trycloudflare.com',
        });
        assert.ok(problem, 'TROU : l’exemption du tunnel couvre aussi une adresse qui n’est pas celle du tunnel');
    });
});

// ── T6 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Tpl = { sms?: (d: Record<string, unknown>, ctx: { appUrl: string }) => string; link?: (d: Record<string, unknown>) => string; sample: Record<string, unknown>; channels: string[] };
const CAT = NOTIFICATION_CATALOG as unknown as Record<string, Tpl>;
const CTX = { appUrl: 'https://app.eventvillage.sn' };

describe('T6 — lien du SMS d’invitation d’un livreur', () => {
    test('le chemin du SMS ORDER_COURIER_INVITED est une page de l’application', () => {
        const t = CAT.ORDER_COURIER_INVITED;
        const sms = t.sms!(t.sample, CTX);
        const m = sms.match(/https:\/\/app\.eventvillage\.sn(\/\S*)$/);
        assert.ok(m, sms);
        const route = path.join(ROOT, 'app', ...m![1].split('/').filter(Boolean), 'page.tsx');
        assert.ok(fs.existsSync(route),
            `TROU : le SMS mène à ${m![1]} : aucune page (app${m![1]}/page.tsx), ni ici ni sur lot12d/livreur-admin (seulement /courier/invitations/[id]) — « ${sms} »`);
    });
});

// ── T7 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** Formes introduites : [marqueur cherché dans la sortie du garde-fou, fichier relatif, contenu, témoin ?]. */
const INJECTIONS: Array<{ id: string; file: string; body: string; witness?: boolean; what: string }> = [
    { id: 'app/api/zz-cvavis2-temoin/route.ts', file: 'app/api/zz-cvavis2-temoin/route.ts', witness: true, what: 'route : texte direct (témoin)',
        body: "import { NextResponse } from 'next/server';\nexport async function GET() {\n    return NextResponse.json({ error: 'Payload invalide.' }, { status: 400 });\n}\n" },
    { id: 'app/api/zz-cvavis2-r2/route.ts', file: 'app/api/zz-cvavis2-r2/route.ts', what: 'route : texte dans un ternaire',
        body: "import { NextResponse } from 'next/server';\nexport async function GET(req: Request) {\n    const ok = req.url.length > 3;\n    return NextResponse.json({ error: ok ? 'Payload invalide.' : 'Demande illisible.' }, { status: 400 });\n}\n" },
    { id: 'app/api/zz-cvavis2-r3/route.ts', file: 'app/api/zz-cvavis2-r3/route.ts', what: 'route : texte dans une constante',
        body: "import { NextResponse } from 'next/server';\nconst MSG = 'userId requis.';\nexport async function GET() {\n    return NextResponse.json({ error: MSG }, { status: 400 });\n}\n" },
    { id: 'app/api/zz-cvavis2-r4/route.ts', file: 'app/api/zz-cvavis2-r4/route.ts', what: 'route : corps texte de new Response',
        body: "export async function GET() {\n    return new Response('Invalid token', { status: 401 });\n}\n" },
    { id: 'app/api/zz-cvavis2-r5/route.ts', file: 'app/api/zz-cvavis2-r5/route.ts', what: 'route : identifiant en snake_case',
        body: "import { NextResponse } from 'next/server';\nexport async function GET() {\n    return NextResponse.json({ error: 'event_id requis.' }, { status: 400 });\n}\n" },
    { id: 'app/api/partner/zz-cvavis2-export/route.ts', file: 'app/api/partner/zz-cvavis2-export/route.ts', what: 'export CSV : codes bruts',
        body: "export async function GET() {\n    const csv = 'Canal;Statut\\r\\nEN_LIGNE;VALIDE\\r\\n';\n    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });\n}\n" },
    { id: 'public.zz_cvavis2_temoin', file: 'supabase/migrations/29991231000001_zz_cvavis2_temoin.sql', witness: true, what: 'SQL : RAISE … MESSAGE = (témoin)',
        body: "CREATE OR REPLACE FUNCTION public.zz_cvavis2_temoin()\nRETURNS void\nLANGUAGE plpgsql\nAS $$\nBEGIN\n    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Payload invalide.';\nEND;\n$$;\n" },
    { id: 'public.zz_cvavis2_s2', file: 'supabase/migrations/29991231000002_zz_cvavis2_s2.sql', what: 'SQL : RAISE EXCEPTION \'…\' (forme classique)',
        body: "CREATE OR REPLACE FUNCTION public.zz_cvavis2_s2()\nRETURNS void\nLANGUAGE plpgsql\nAS $$\nBEGIN\n    RAISE EXCEPTION 'Payload invalide : user_id requis';\nEND;\n$$;\n" },
    { id: 'public.zz_cvavis2_s3', file: 'supabase/migrations/29991231000003_zz_cvavis2_s3.sql', what: 'SQL : clé « error » d’une réponse',
        body: "CREATE OR REPLACE FUNCTION public.zz_cvavis2_s3()\nRETURNS jsonb\nLANGUAGE plpgsql\nAS $$\nBEGIN\n    RETURN jsonb_build_object('ok', false, 'error', 'Invalid payload');\nEND;\n$$;\n" },
    { id: 'components/zz-cvavis2-temoin.tsx', file: 'components/zz-cvavis2-temoin.tsx', witness: true, what: 'erreur affichée : setError(err.message) (témoin)',
        body: "export function f(setError: (s: string) => void) {\n    try { JSON.parse('x'); } catch (err) {\n        setError(err.message);\n    }\n}\n" },
    { id: 'components/zz-cvavis2-d2.tsx', file: 'components/zz-cvavis2-d2.tsx', what: 'erreur affichée : setError((err as Error).message)',
        body: "export function f(setError: (s: string) => void) {\n    try { JSON.parse('x'); } catch (err) {\n        setError((err as Error).message);\n    }\n}\n" },
    { id: 'components/zz-cvavis2-d3.tsx', file: 'components/zz-cvavis2-d3.tsx', what: 'erreur affichée : setError(e?.message ?? …)',
        body: "export function f(setError: (s: string) => void) {\n    try { JSON.parse('x'); } catch (e) {\n        setError((e as Error)?.message ?? 'Réessayez.');\n    }\n}\n" },
];

describe('T7 — garde-fou des mots (bloc e) : chaque mot technique introduit doit le faire échouer', () => {
    test('le vrai garde-fou, lancé sur une copie de l’arbre avec des messages techniques introduits', { timeout: 600_000 }, () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cvavis2-mots-'));
        try {
            for (const d of ['app', 'components', 'lib', 'hooks', path.join('e2e', 'support'), path.join('supabase', 'migrations')]) {
                fs.cpSync(path.join(ROOT, d), path.join(tmp, d), { recursive: true });
            }
            for (const f of ['tsconfig.json', 'package.json']) fs.copyFileSync(path.join(ROOT, f), path.join(tmp, f));
            fs.symlinkSync(fs.realpathSync(path.join(ROOT, 'node_modules')), path.join(tmp, 'node_modules'), 'junction');
            for (const inj of INJECTIONS) {
                fs.mkdirSync(path.dirname(path.join(tmp, inj.file)), { recursive: true });
                fs.writeFileSync(path.join(tmp, inj.file), inj.body);
            }
            const envFile = path.resolve(ROOT, process.env.EV_ENV_FILE || '.env.test');
            // Sans NODE_TEST_CONTEXT : sinon le lanceur de node:test du sous-processus refuse de tourner (appel « récursif »)
            const childEnv: NodeJS.ProcessEnv = { ...process.env, EV_ENV_FILE: envFile };
            delete childEnv.NODE_TEST_CONTEXT;
            const run = spawnSync(process.execPath, ['--import', 'tsx', '--test', path.join(ROOT, 'tests', 'schema', 'design1b-mots.test.ts')], {
                cwd: tmp, env: childEnv, encoding: 'utf8', timeout: 540_000, maxBuffer: 64 * 1024 * 1024,
            });
            const out = `${run.stdout}\n${run.stderr}`;
            const caught = (id: string): boolean => out.includes(id);
            const report = INJECTIONS.map((i) => `${caught(i.id) ? 'attrapé ' : 'PASSE   '} ${i.what}`);
            console.log(`[CVAVIS2-T7] code de sortie du garde-fou : ${run.status}\n${report.join('\n')}`);
            const witnesses = INJECTIONS.filter((i) => i.witness && !caught(i.id));
            assert.deepEqual(witnesses.map((w) => w.what), [], `exécution du garde-fou invalide (témoins non attrapés) :\n${out.slice(-4000)}`);
            assert.notEqual(run.status, 0, 'le garde-fou échoue sur la copie modifiée');
            const missed = INJECTIONS.filter((i) => !i.witness && !caught(i.id)).map((i) => i.what);
            assert.deepEqual(missed, [], `TROU : formes de messages techniques qui passent le garde-fou des mots :\n  ${missed.join('\n  ')}`);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

// ── S1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const EXT = '^{}\\[~]|€';
const septets = (t: string): number => { let n = 0; for (const c of t) { if (BASIC.includes(c)) n += 1; else if (EXT.includes(c)) n += 2; else return -1; } return n; };
const NASTY = ('Soirée «Ndëkk» – ça va être génial’ 🎉 à Thiès, Kaolack et Ziguinchor : œuvres, façades, garçons et hôtes~€{}[]|^' + 'W'.repeat(110)).slice(0, 110);

describe('S1 — SMS ajoutés ou modifiés : un segment GSM-7 au pire cas', () => {
    const variants: Record<string, Array<Record<string, unknown>>> = {
        WITHDRAWAL_REQUESTED: ['WAVE', 'ORANGE_MONEY', null].flatMap((operator) => ['MOBILE_MONEY', 'BANK', null].map((method) => ({ amount: 9_999_999, operator, method }))),
        PAYMENT_SUCCESS: ['SUBSCRIPTION', 'TICKET', 'ORDER'].map((payment_target) => ({ payment_target, amount: 9_999_999 })),
        ADMIN_REVIEW_SMS: [
            { partner_count: 999, event_count: 999, venue_count: 999, hall_count: 999, hall_changed_count: 999, product_count: 999, company: NASTY },
            { partner_count: 1, event_count: 999, venue_count: 0, hall_count: 0, hall_changed_count: 0, product_count: 999, company: NASTY },
            { partner_count: 0, event_count: 999, venue_count: 999, hall_count: 0, hall_changed_count: 0, product_count: 999, company: null },
        ],
        ADMIN_MONEY_SMS: [{ resume_count: 999, uncertain_count: 999, duplicate_count: 999, debt_count: 999 }, { resume_count: 1, uncertain_count: 0, duplicate_count: 0, debt_count: 0 }],
        SHIFT_DISCREPANCY: [{ difference: -9_999_999 }, { difference: 9_999_999 }],
        PAYMENT_NOT_COMPLETED: ['TICKET', 'ORDER', 'HALL_RESERVATION', 'TABLE_RESERVATION', 'SUBSCRIPTION'].map((target) => ({ target, order_number: `CMD-${'X'.repeat(40)}` })),
    };
    const types = ['WITHDRAWAL_REQUESTED', 'TRANSFER_RECEIVED', 'PAYMENT_SUCCESS', 'ORDER_COURIER_INVITED', 'ADMIN_REVIEW_SMS', 'ADMIN_MONEY_SMS', 'SHIFT_DISCREPANCY',
        'CONTROLLER_INVITATION_ACCEPTED', 'CONTROLLER_BECAME_ADMIN', 'REFERRAL_AVAILABLE', 'PAYMENT_NOT_COMPLETED', 'ACCOUNT_ANONYMIZATION_NOTICE'];
    for (const type of types) {
        test(`${type} : ≤ 160 septets, aucun caractère hors GSM-7`, () => {
            const t = CAT[type];
            assert.ok(t?.sms, `${type} : rendu SMS`);
            const base: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(t.sample)) {
                if (typeof v === 'string' && /(name|title|company|venue|hall|partner|category|gate)/i.test(k)) base[k] = NASTY;
                else if (typeof v === 'number') base[k] = /count|quantity/i.test(k) ? 999 : 9_999_999;
            }
            for (const over of variants[type] ?? [{}]) {
                const text = t.sms!({ ...t.sample, ...base, ...over }, CTX);
                const n = septets(text);
                console.log(`[CVAVIS2-S1] ${type} ${n} | ${text}`);
                assert.ok(n >= 0, `${type} : caractère hors GSM-7 : « ${text} »`);
                assert.ok(n <= 160, `${type} : ${n} septets : « ${text} »`);
            }
        });
    }
});

// ── S2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function definitions(name: string): Array<{ file: string; lines: string[] }> {
    const [schema, fn] = name.split('.');
    const re = new RegExp(`^\\s*CREATE\\s+(OR\\s+REPLACE\\s+)?FUNCTION\\s+("?${schema}"?\\.)?"?${fn}"?\\s*\\(`, 'i');
    const out: Array<{ file: string; lines: string[] }> = [];
    for (const f of fs.readdirSync(MIG).filter((x) => /^\d+_.+\.sql$/.test(x)).sort()) {
        const lines = fs.readFileSync(path.join(MIG, f), 'utf8').split('\n');
        for (let i = 0; i < lines.length; i += 1) {
            if (!re.test(lines[i])) continue;
            let j = i; let dollars = 0;
            while (j < lines.length) { dollars += (lines[j].match(/\$\$/g) ?? []).length; if (dollars >= 2) break; j += 1; }
            out.push({ file: f, lines: lines.slice(i, j + 1) });
        }
    }
    return out;
}

describe('S2 — recopies : une seule, depuis la dernière définition, aucune ligne perdue', () => {
    const RECOPIES: Record<string, string> = {
        'public.event_notice_recipient_count': '20261119000006_f2b_cadence_avis.sql', 'public.event_change_notify': '20261121000006_cvf2b_plafond_heure_glissante.sql',
        'public.notif_event_status_changed': '20261109000009_lot9bis_messages.sql', 'public.notification_outbox_claim': '20261125000006_f4_evenement_proche.sql',
        'public.account_phone_finalize': '20261120000006_f3d_cv_numero_profil.sql', 'public.notif_enqueue_grouped': '20261125000003_f4_ventes.sql',
        'public.notif_admin_review_sms': '20261126000004_l10b_cv_correctifs.sql', 'private.order_product_review_notify': '20261224000001_l12c_verification.sql',
        'private.order_review_batch_done': '20261224000005_l12c_cv_correctifs.sql', 'private.order_refund_blocked_notify': '20261224000005_l12c_cv_correctifs.sql',
        'public.notification_daily_checks': '20261125000003_f4_ventes.sql', 'public.cashouts_simulation_guard': '20261106000002_lot8_essai.sql',
    };
    const REPLACED = new Set(["RAISE EXCEPTION USING ERRCODE = 'EV403', MESSAGE = 'SIMULATION_MISMATCH';"]);
    for (const [name, from] of Object.entries(RECOPIES)) {
        test(name, () => {
            const defs = definitions(name);
            const before = defs.filter((d) => !LOT(d.file));
            const inLot = defs.filter((d) => LOT(d.file));
            assert.equal(before.at(-1)?.file, from, `${name} : dernière définition d'avant le lot`);
            assert.equal(inLot.length, 1, `${name} : une seule recopie dans le lot (${inLot.map((d) => d.file)})`);
            const count = (ls: string[]): Map<string, number> => { const m = new Map<string, number>(); for (const l of ls.map((x) => x.trim()).filter(Boolean)) m.set(l, (m.get(l) ?? 0) + 1); return m; };
            const o = count(before.at(-1)!.lines); const n = count(inLot[0].lines);
            const lost = [...o].filter(([l, k]) => (n.get(l) ?? 0) < k && !REPLACED.has(l)).map(([l]) => l);
            assert.deepEqual(lost, [], `${name} : lignes perdues`);
        });
    }
});

// ── S3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe('S3 — aucune écriture d’argent nouvelle', () => {
    test('migrations du lot : aucun INSERT, UPDATE ni DELETE sur les tables d’argent (hors lignes recopiées)', () => {
        const money = /(INSERT INTO|UPDATE|DELETE FROM)\s+public\.(finance_ledger|payments|cashouts|refunds|withdrawals|referral_commissions|referral_commission_payouts|finance_debts)\b/;
        const found: string[] = [];
        for (const f of fs.readdirSync(MIG).filter(LOT)) {
            fs.readFileSync(path.join(MIG, f), 'utf8').split('\n').forEach((l, i) => { if (money.test(l)) found.push(`${f}:${i + 1} ${l.trim()}`); });
        }
        assert.deepEqual(found, []);
    });
});
