/**
 * Lot « Avis », phase 2 — migrations du lot (20261230…, après la dernière migration de main au démarrage :
 * 20261226000003_l12b_garde_prix.sql) : rejouables (appliquées deux fois de plus dans une transaction annulée), sans BEGIN
 * ni COMMIT.
 * Recopies : chaque fonction existante redéfinie par le lot l'est UNE seule fois dans tout le lot, depuis sa DERNIÈRE
 * définition (fichier et lignes cités dans l'en-tête de la migration) : chaque ligne de cette définition se retrouve dans la
 * recopie (ajouts seuls, aucune ligne perdue). Aucune fonction des commandes du livreur (order_courier_action,
 * order_courier_remove : sous-lot 2e réservé au lot 12d) ni des recopies suivies par les audits sans accord.
 * Droits : fonctions publiques du lot au rôle de service seulement (jamais anon, authenticated ni PUBLIC) ; aides du schéma
 * private à aucun rôle de l'API (clé de service comprise).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inRolledBackTransaction } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');
const PREFIX = '20261230';
const LAST_OF_MAIN = '20261226000003_l12b_garde_prix.sql';

/** Migrations du lot, dans l'ordre. */
const FILES = [
    '20261230000001_avis_titulaires_table.sql',
    '20261230000002_avis_nouveaux_simples.sql',
    '20261230000003_avis_canaux.sql',
    '20261230000004_avis_admins.sql',
    '20261230000005_avis_parrainage_paiement.sql',
    '20261230000006_avis_mots.sql',
    // Correctifs après contre-vérification (modification signalée au rapport) : migration 07 (T4, anonymisation)
    '20261230000007_avis_cv_anonymisation.sql',
];

/** Recopies du lot : fonction → dernière définition de main (fichier, première et dernière ligne) et migration du lot. */
const RECOPIES: Record<string, { from: string; lines: [number, number]; in: string }> = {
    'public.event_notice_recipient_count': { from: '20261119000006_f2b_cadence_avis.sql', lines: [30, 61], in: FILES[0] },
    'public.event_change_notify': { from: '20261121000006_cvf2b_plafond_heure_glissante.sql', lines: [17, 325], in: FILES[0] },
    'public.notif_event_status_changed': { from: '20261109000009_lot9bis_messages.sql', lines: [106, 374], in: FILES[0] },
    'public.notification_outbox_claim': { from: '20261125000006_f4_evenement_proche.sql', lines: [46, 457], in: FILES[0] },
    'public.account_phone_finalize': { from: '20261120000006_f3d_cv_numero_profil.sql', lines: [8, 135], in: FILES[2] },
    'public.notif_enqueue_grouped': { from: '20261125000003_f4_ventes.sql', lines: [37, 92], in: FILES[2] },
    'public.notif_admin_review_sms': { from: '20261126000004_l10b_cv_correctifs.sql', lines: [317, 421], in: FILES[3] },
    'private.order_product_review_notify': { from: '20261224000001_l12c_verification.sql', lines: [441, 467], in: FILES[3] },
    'private.order_review_batch_done': { from: '20261224000005_l12c_cv_correctifs.sql', lines: [54, 75], in: FILES[3] },
    'private.order_refund_blocked_notify': { from: '20261224000005_l12c_cv_correctifs.sql', lines: [469, 503], in: FILES[3] },
    'public.notification_daily_checks': { from: '20261125000003_f4_ventes.sql', lines: [382, 564], in: FILES[4] },
    'public.cashouts_simulation_guard': { from: '20261106000002_lot8_essai.sql', lines: [110, 127], in: FILES[5] },
    // Correctifs après contre-vérification (modification signalée au rapport) : garde de la boîte d'envoi (T4)
    'public.notification_outbox_guard': { from: '20261103000002_lot6_outbox.sql', lines: [233, 260], in: FILES[6] },
};

/** Lignes de la dernière définition remplacées exprès (→ ligne qui la remplace dans la recopie), une par une, justifiées. */
const REPLACED: Record<string, Record<string, string>> = {
    // 2h (M17) : le message du refus devient une phrase ; code EV403 inchangé
    'public.cashouts_simulation_guard': {
        "RAISE EXCEPTION USING ERRCODE = 'EV403', MESSAGE = 'SIMULATION_MISMATCH';":
            "RAISE EXCEPTION USING ERRCODE = 'EV403', MESSAGE = 'L''envoi ne correspond pas au mode du paiement : un versement simulé ne part jamais en réel, ni l''inverse.';",
    },
};

/** Fonctions nouvelles du lot. */
const NEW_FUNCTIONS = [
    'private.event_table_holders', 'private.notif_holder_sms_count', 'private.notif_holder_status_sms_cap', 'private.notif_table_holders_status',
    // 2c : déclencheurs nouveaux (aucune recopie)
    'private.notif_withdrawal_requested', 'private.notif_withdrawal_ack_paid', 'private.notif_partner_resubmitted', 'private.notif_shift_validated',
    'private.notif_controller_post_changed',
    // 2d : SMS regroupé « argent à vérifier » et son déclencheur sur la boîte d'envoi
    'private.notif_admin_money_sms', 'private.notif_admin_money_on_alert',
    // 2f, 2g : déclencheurs nouveaux (filleul inscrit, paiement non abouti) et clé du panier
    'private.notif_referral_signup', 'private.payment_cart_key', 'private.notif_payment_not_completed', 'private.notif_payment_cart_paid',
    // Correctifs après contre-vérification (modification signalée au rapport) : boîte d'envoi d'un compte anonymisé (T4, rôle de service seulement)
    'public.notification_outbox_anonymize',
];

/** Jamais redéfinies par le lot : livreurs (12d), recopies suivies par les audits (accord requis). */
const UNTOUCHED = [
    'order_courier_action', 'order_courier_remove', 'notif_cashouts_notify', 'notif_enqueue', 'notif_event_soon', 'withdrawal_request',
    'finance_setting_set', 'fin_setting_valid', 'platform_settings_defaults', 'calculate_referral_commissions',
];

const allMigrations = (): string[] => fs.readdirSync(DIR).filter((f) => /^\d{14}_.+\.sql$/.test(f) || /^\d{4}_.+\.sql$/.test(f)).sort();

/** Toutes les définitions de schéma.nom dans les fichiers donnés (du CREATE au second $$), avec leur fichier. */
function definitions(name: string, files: readonly string[]): Array<{ file: string; start: number; end: number; text: string }> {
    const head = new RegExp(`^CREATE (OR REPLACE )?FUNCTION ${name.replace('.', '\\.')}\\s*\\(`, 'i');
    const out: Array<{ file: string; start: number; end: number; text: string }> = [];
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
            out.push({ file: f, start: i + 1, end: j + 1, text: lines.slice(i, j + 1).join('\n') });
        });
    }
    return out;
}

describe('Lot « Avis » phase 2 — migrations', () => {
    test(`présentes, dans l’ordre, toutes après ${LAST_OF_MAIN}`, () => {
        const all = allMigrations();
        const lot = all.filter((f) => f.startsWith(PREFIX));
        assert.deepEqual(lot, FILES, `intervalle ${PREFIX}… : les migrations du lot seulement`);
        assert.ok(all.includes(LAST_OF_MAIN), 'dernière migration de main au démarrage présente');
        for (const f of FILES) assert.ok(f > LAST_OF_MAIN, `${f} après ${LAST_OF_MAIN}`);
    });

    test('sans BEGIN ni COMMIT, appliquées deux fois de plus sans erreur', async () => {
        const sqls = FILES.map((f) => fs.readFileSync(path.join(DIR, f), 'utf8'));
        for (const [i, sql] of sqls.entries()) assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, FILES[i]);
        await inRolledBackTransaction(async (c) => {
            for (const sql of sqls) await c.query(sql);
            for (const sql of sqls) await c.query(sql);
        });
    });

    for (const [name, r] of Object.entries(RECOPIES)) {
        test(`recopie ${name} : une seule fois, depuis sa dernière définition (${r.from}:${r.lines.join('-')}), aucune ligne perdue`, () => {
            const before = allMigrations().filter((f) => f < `${PREFIX}000000`);
            const previous = definitions(name, before).at(-1);
            assert.ok(previous, 'définition précédente introuvable');
            assert.equal(previous!.file, r.from, 'dernière définition de main');
            assert.deepEqual([previous!.start, previous!.end], r.lines, 'lignes de la dernière définition');
            const mine = definitions(name, FILES);
            assert.deepEqual(mine.map((d) => d.file), [r.in], `une seule recopie dans le lot, dans ${r.in}`);
            const kept = new Set(mine[0].text.split('\n').map((l) => l.trim()));
            const replaced = REPLACED[name] ?? {};
            const lost = previous!.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !kept.has(l) && !(l in replaced));
            assert.deepEqual(lost, [], 'lignes perdues');
            const missing = Object.entries(replaced).filter(([, r]) => !kept.has(r)).map(([l, r]) => `${l} → ${r}`);
            assert.deepEqual(missing, [], 'remplaçantes absentes');
            const head = fs.readFileSync(path.join(DIR, r.in), 'utf8');
            assert.ok(head.includes(`${r.from}:${r.lines.join('-')}`), `fichier et lignes de la dernière définition cités dans ${r.in}`);
        });
    }

    test('fonctions nouvelles : absentes avant le lot, une définition ; aucune autre fonction redéfinie', () => {
        const before = allMigrations().filter((f) => f < `${PREFIX}000000`);
        for (const fn of NEW_FUNCTIONS) {
            assert.equal(definitions(fn, before).length, 0, `${fn} existe déjà avant le lot`);
            assert.equal(definitions(fn, FILES).length, 1, `${fn} : une définition dans le lot`);
        }
        const redefined = UNTOUCHED.filter((n) => definitions(`public.${n}`, FILES).length > 0 || definitions(`private.${n}`, FILES).length > 0);
        assert.deepEqual(redefined, [], 'fonctions interdites au lot');
        const created = FILES.flatMap((f) => [...fs.readFileSync(path.join(DIR, f), 'utf8').matchAll(/^CREATE (?:OR REPLACE )?FUNCTION ([a-z_]+\.[a-z_]+)\s*\(/gim)].map((m) => m[1]));
        assert.deepEqual([...new Set(created)].sort(), [...NEW_FUNCTIONS, ...Object.keys(RECOPIES)].sort(), 'toute fonction du lot est nouvelle ou recopiée');
    });

    test('droits : publiques du lot au rôle de service seulement ; private à aucun rôle de l’API', async () => {
        const pub = [...NEW_FUNCTIONS, ...Object.keys(RECOPIES)].filter((f) => f.startsWith('public.')).map((f) => f.slice(7));
        const priv = [...NEW_FUNCTIONS, ...Object.keys(RECOPIES)].filter((f) => f.startsWith('private.')).map((f) => f.slice(8));
        await inRolledBackTransaction(async (c) => {
            const { rows } = await c.query<{ nsp: string; proname: string; anon: boolean; auth: boolean; svc: boolean; pub: boolean; trigger: boolean }>(
                `SELECT n.nspname AS nsp, p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                        has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc,
                        EXISTS (SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a WHERE a.grantee = 0) AS pub,
                        p.prorettype = 'trigger'::regtype AS trigger
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE (n.nspname = 'public' AND p.proname = ANY ($1)) OR (n.nspname = 'private' AND p.proname = ANY ($2))
                  ORDER BY 1, 2`, [pub, priv]);
            assert.deepEqual(rows.filter((r) => r.nsp === 'public').map((r) => r.proname).sort(), [...pub].sort());
            assert.deepEqual(rows.filter((r) => r.nsp === 'private').map((r) => r.proname).sort(), [...priv].sort());
            for (const r of rows) {
                if (r.nsp === 'private') assert.deepEqual([r.proname, r.anon, r.auth, r.svc, r.pub], [r.proname, false, false, false, false]);
                else assert.deepEqual([r.proname, r.anon, r.auth, r.pub, r.trigger || r.svc], [r.proname, false, false, false, true]);
            }
        });
    });
});
