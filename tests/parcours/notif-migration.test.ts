/**
 * Lot 6, tâche 6.7 — migration des envois existants (contrat K1, K2, J1.9, J1.11, J2, B5 ; S2 groupe Pros).
 *  1. Contrôle statique K2 : dans app, lib, components et hooks (.ts, .tsx, commentaires retirés), aucun
 *     appel direct aux adaptateurs hors de la liste blanche nominative : l'envoyeur
 *     (lib/notifications/dispatcher.ts), les adaptateurs et façades (lib/sms, lib/email, lib/push,
 *     lib/integrations), les routes OTP (seulement `.sendOtp(`) et l'invitation d'un contrôleur (seulement
 *     `.sendControllerInvite(`). Tests réciproques : chaque entrée de la liste existe, chaque route de la
 *     liste appelle la méthode permise et rien d'autre ; chaque `.sendOtp(` et `.sendControllerInvite(`
 *     de app/ passe `log:` (journal, contrat E7).
 *  2. Base : seule notification_outbox_mark écrit dans public.notifications (corps des fonctions par
 *     pg_get_functiondef) ; event_change_notifications, ses deux RPC et event_notify n'existent plus.
 *  3. Code retiré : module et route du cron event-change-notifications, NotificationService en entier,
 *     stock-notifications, fonctions d'envoi TypeScript (J1.11, J2), méthodes send* mortes de
 *     MTargetService (K, « code mort supprimé »).
 *  4. Inventaire K1 : chaque type « après » est dans le registre notification_types, et son point
 *     d'insertion (RPC recopiée, trigger) existe en base et nomme le type ; plafond SMS par
 *     notification_admin_alert (J2.13).
 *  5. Reprise des lignes d'event_change_notifications (J1.9) : le bloc balisé `-- reprise:debut` /
 *     `-- reprise:fin` de la migration 20261103000005 est exécuté, dans une transaction annulée, sur une
 *     table temporaire du même schéma (une ligne par statut) ; la table de correspondance est vérifiée.
 *  6. Destinataires admin : notif_admin_recipients ne lit pas users.role (un compte ADMIN par users.role
 *     seulement n'est pas destinataire ; un ADMIN de user_roles dont users.role vaut CLIENT l'est) ; aucun
 *     filtre `role` sur `from('users')` dans lib.
 *
 * Rouge avant correctif : les envois directs sont partout (notification.service.ts, routes d'équipe,
 * invitation par sendNotification, counter-sale, setup, cashout, sms-guard, alerts…), lib/push et
 * lib/notifications/dispatcher.ts n'existent pas, event_notify, event_update, shift_close et
 * fin_alert_superadmins écrivent dans notifications, event_change_notifications existe, les migrations
 * 20261103* et le registre notification_types sont absents.
 *
 * Interprétations retenues (à respecter par les correcteurs) :
 *  - inventaire : le type est écrit en littéral (`'FIRST_TICKET_SOLD'`) dans le corps de la fonction ou
 *    de la fonction de trigger qui l'insère ;
 *  - reprise : le bloc nomme la table sans schéma ou par `public.event_change_notifications` ; le test
 *    remplace la seconde forme par `pg_temp.event_change_notifications` avant de l'exécuter ;
 *  - méthodes send* conservées dans MTargetService : sendSms, sendNotification (alias,
 *    tests/fondations-lot0.test.ts:51), sendOtp, sendControllerInvite.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createDraftEvent, type DraftEvent } from './cycle-helpers';
import { assertNotificationInvariants, newAdmin, type TestAdmin } from './notif-helpers';

after(async () => {
    await assertNotificationInvariants('notif-migration');
});

const ROOT = process.cwd();
const SCAN_DIRS = ['app', 'lib', 'components', 'hooks'];
const MIGRATIONS_DIR = 'supabase/migrations';
const BILLETTERIE_MIGRATION = 'supabase/migrations/20261103000005_lot6_billetterie.sql';

// ── Lecture des sources ────────────────────────────────────────────────────

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function rel(full: string): string {
    return path.relative(ROOT, full).split(path.sep).join('/');
}

function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel(full));
        }
    };
    for (const d of SCAN_DIRS) {
        const abs = path.resolve(ROOT, d);
        if (fs.existsSync(abs)) walk(abs);
    }
    assert.ok(out.length > 100, `parcours des sources : ${out.length} fichier(s) seulement sous ${SCAN_DIRS.join(', ')} (cwd ${ROOT})`);
    return out.sort();
}

const sourceCache = new Map<string, string>();
function source(file: string): string {
    let s = sourceCache.get(file);
    if (s === undefined) {
        s = stripComments(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
        sourceCache.set(file, s);
    }
    return s;
}

function lineOf(src: string, index: number): number {
    return src.slice(0, index).split('\n').length;
}

function exists(relPath: string): boolean {
    return fs.existsSync(path.resolve(ROOT, relPath));
}

/** Texte d'un appel à partir de la parenthèse ouvrante (parenthèses équilibrées, chaînes ignorées). */
function callText(src: string, openParen: number): string {
    let depth = 0;
    let quote: string | null = null;
    for (let i = openParen; i < src.length; i++) {
        const c = src[i];
        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }
        if (c === '"' || c === "'" || c === '`') quote = c;
        else if (c === '(') depth++;
        else if (c === ')') {
            depth--;
            if (depth === 0) return src.slice(openParen, i + 1);
        }
    }
    return src.slice(openParen);
}

// ── K2 : motifs interdits et liste blanche ─────────────────────────────────

interface Forbidden { id: string; re: RegExp }

const FORBIDDEN: Forbidden[] = [
    { id: 'mTargetService.send*(', re: /\bmTargetService\.(send\w*)\s*\(/g },
    { id: 'getSmsAdapter(', re: /\bgetSmsAdapter\s*\(/g },
    { id: 'getEmailAdapter(', re: /\bgetEmailAdapter\s*\(/g },
    { id: 'getPushAdapter(', re: /\bgetPushAdapter\s*\(/g },
    { id: 'EmailService.send(', re: /\bEmailService\.send\s*\(/g },
    { id: 'new <adaptateur>', re: /\bnew (MTargetHttpAdapter|ResendHttpAdapter|WebPushAdapter)\b/g },
    { id: "import 'web-push'", re: /from\s+['"]web-push['"]/g },
    { id: '.sendNotification(', re: /\.sendNotification\s*\(/g },
    { id: "from('notifications') écriture", re: /from\(\s*['"]notifications['"]\s*\)\s*\.\s*(insert|upsert|update)\b/g },
];

/** Liste blanche nominative (contrat K2) : raison sur la ligne. */
const WHITELIST_PREFIXES: ReadonlyArray<[string, string]> = [
    ['lib/sms/', 'adaptateur SMS et façade MTarget, garde anti-abus'],
    ['lib/email/', 'adaptateur et façade email'],
    ['lib/push/', 'adaptateur push web et configuration VAPID (contrat F4)'],
    ['lib/integrations/', 'registre des adaptateurs'],
];
const WHITELIST_FILES: ReadonlyArray<[string, string]> = [
    ['lib/notifications/dispatcher.ts', "l'envoyeur unique (contrat E4)"],
];
/** Routes synchrones : une seule méthode permise (contrat E7). */
const SYNC_ROUTES: Readonly<Record<string, { method: 'sendOtp' | 'sendControllerInvite'; why: string }>> = {
    'app/api/auth/register/route.ts': { method: 'sendOtp', why: "code d'inscription" },
    'app/api/auth/send-otp/route.ts': { method: 'sendOtp', why: 'code de connexion, inscription, réinitialisation' },
    'app/api/auth/sms-hook/route.ts': { method: 'sendOtp', why: 'hook « Send SMS » de Supabase Auth' },
    'app/api/withdrawals/otp/route.ts': { method: 'sendOtp', why: 'code de retrait' },
    'app/api/partner/register/route.ts': { method: 'sendOtp', why: "code d'inscription partenaire" },
    'app/api/partner/team/invite/route.ts': { method: 'sendControllerInvite', why: "code d'activation d'un nouveau contrôleur" },
};

function fullyWhitelisted(file: string): boolean {
    return WHITELIST_FILES.some(([f]) => f === file) || WHITELIST_PREFIXES.some(([p]) => file.startsWith(p));
}

interface Offence { file: string; line: number; rule: string; text: string }

function offences(file: string): Offence[] {
    const src = source(file);
    const out: Offence[] = [];
    const sync = SYNC_ROUTES[file];
    for (const f of FORBIDDEN) {
        f.re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = f.re.exec(src))) {
            if (sync && f.id === 'mTargetService.send*(' && m[1] === sync.method) continue;
            out.push({ file, line: lineOf(src, m.index), rule: f.id, text: m[0] });
        }
    }
    return out;
}

describe('6.7 K2 — aucun appel direct aux adaptateurs hors de l’envoyeur, de l’OTP et de l’invitation', () => {
    test('liste blanche : chaque entrée existe (fichier ou dossier)', () => {
        const missing: string[] = [];
        for (const [f, why] of WHITELIST_FILES) if (!exists(f)) missing.push(`${f} (${why})`);
        for (const [p, why] of WHITELIST_PREFIXES) if (!exists(p)) missing.push(`${p} (${why})`);
        for (const [f, r] of Object.entries(SYNC_ROUTES)) if (!exists(f)) missing.push(`${f} (${r.why})`);
        assert.deepEqual(missing, [], `entrées de la liste blanche absentes :\n${missing.join('\n')}`);
    });

    test('app, lib, components, hooks : aucun motif interdit hors de la liste blanche', () => {
        const found: Offence[] = [];
        for (const file of sourceFiles()) {
            if (fullyWhitelisted(file)) continue;
            found.push(...offences(file));
        }
        const lines = found.map((o) => `${o.file}:${o.line} [${o.rule}] ${o.text}`);
        assert.deepEqual(lines, [], `${found.length} appel(s) direct(s) aux adaptateurs ou écriture(s) dans notifications :\n${lines.join('\n')}`);
    });

    test('routes synchrones de la liste : la méthode permise est appelée, et elle seule', () => {
        const problems: string[] = [];
        for (const [file, r] of Object.entries(SYNC_ROUTES)) {
            if (!exists(file)) {
                problems.push(`${file} absent`);
                continue;
            }
            const src = source(file);
            const calls = Array.from(src.matchAll(/\bmTargetService\.(\w+)\s*\(/g)).map((m) => m[1]);
            if (!calls.includes(r.method)) problems.push(`${file} : aucun appel mTargetService.${r.method}( (${r.why})`);
            const others = calls.filter((c) => c !== r.method);
            if (others.length > 0) problems.push(`${file} : autre(s) méthode(s) appelée(s) : ${others.join(', ')}`);
        }
        assert.deepEqual(problems, [], problems.join('\n'));
    });

    test('contrat E7 : chaque appel .sendOtp( et .sendControllerInvite( de app/ passe `log:` (journal sans code)', () => {
        const problems: string[] = [];
        let count = 0;
        for (const file of sourceFiles().filter((f) => f.startsWith('app/'))) {
            const src = source(file);
            for (const m of Array.from(src.matchAll(/\.(sendOtp|sendControllerInvite)\s*\(/g))) {
                count++;
                const open = (m.index ?? 0) + m[0].length - 1;
                const args = callText(src, open);
                if (!/\blog\s*:/.test(args)) problems.push(`${file}:${lineOf(src, m.index ?? 0)} ${m[1]}${args.replace(/\s+/g, ' ').slice(0, 160)}`);
            }
        }
        assert.ok(count >= Object.keys(SYNC_ROUTES).length, `appels .sendOtp( / .sendControllerInvite( trouvés dans app/ : ${count}`);
        assert.deepEqual(problems, [], `appels sans journal (ctx.log) :\n${problems.join('\n')}`);
    });
});

// ── Code retiré (J1.11, J2, K « code mort supprimé ») ──────────────────────

const REMOVED_FILES: ReadonlyArray<[string, string]> = [
    ['lib/notifications/notification.service.ts', 'NotificationService supprimé en entier (K)'],
    ['lib/events/event-change-notifications.ts', 'absorbé par la boîte d’envoi (J1.9)'],
    ['app/api/cron/event-change-notifications/route.ts', 'ancien cron supprimé (J1.9)'],
    ['lib/payments/stock-notifications.ts', 'remplacé par trg_ticket_categories_sold_out (J1.5)'],
];

const REMOVED_IDENTIFIERS: ReadonlyArray<[RegExp, string]> = [
    [/\bNotificationService\b/, 'NotificationService (K)'],
    [/notifications\/notification\.service/, 'import de notification.service (K)'],
    [/event-change-notifications/, 'module ou route event-change-notifications (J1.9)'],
    [/\bnotifyTicketPurchase\b/, 'notifyTicketPurchase (J1.11)'],
    [/\bnotifyScanned\b/, 'notifyScanned (J1.11)'],
    [/\bnotifyAfterTransition\b/, 'notifyAfterTransition (J1.11)'],
    [/\bnotifySuperadmins\b/, 'notifySuperadmins (J1.11)'],
    [/\bdispatchRefundNotifications\b/, 'dispatchRefundNotifications (J1.11)'],
    [/\bnotifyStockMilestones\b/, 'notifyStockMilestones (J1.5)'],
    [/\bsendShiftDiscrepancySms\b/, 'sendShiftDiscrepancySms (J2.1)'],
    [/\bnotifyRecipient\b/, 'notifyRecipient (B5)'],
    [/\bsendTicketTransferClaimedNotifications\b/, 'sendTicketTransferClaimedNotifications (K1 T3-T6)'],
    [/\bsendControllerAssignmentsUpdatedNotice\b|\bsendControllerRevocationNotice\b|\bsendControllerAllEventsRevokedNotice\b|\bsendControllerAccountDeletedNotice\b|\bsendControllerActivationConfirmation\b|\bsendCounterReceipt\b/, 'méthodes send* mortes de MTargetService (K)'],
];

describe('6.7 — envois TypeScript retirés', () => {
    test('fichiers supprimés : NotificationService, module et route event-change-notifications, stock-notifications', () => {
        const still = REMOVED_FILES.filter(([f]) => exists(f)).map(([f, why]) => `${f} (${why})`);
        assert.deepEqual(still, [], `fichiers encore présents :\n${still.join('\n')}`);
    });

    test('aucune référence aux fonctions d’envoi retirées dans app, lib, components, hooks', () => {
        const found: string[] = [];
        for (const file of sourceFiles()) {
            const src = source(file);
            for (const [re, what] of REMOVED_IDENTIFIERS) {
                const m = re.exec(src);
                if (m) found.push(`${file}:${lineOf(src, m.index)} ${what} « ${m[0]} »`);
            }
        }
        assert.deepEqual(found, [], `références restantes :\n${found.join('\n')}`);
    });

    test('MTargetService : seules sendSms, sendNotification (alias), sendOtp et sendControllerInvite restent', () => {
        const file = 'lib/sms/mtarget.service.ts';
        assert.ok(exists(file), `${file} absent`);
        const methods = Array.from(source(file).matchAll(/^\s*(?:public\s+)?(?:async\s+)?(send\w*)\s*\(/gm)).map((m) => m[1]).sort();
        assert.deepEqual(Array.from(new Set(methods)), ['sendControllerInvite', 'sendNotification', 'sendOtp', 'sendSms'],
            `méthodes send* de MTargetService : ${methods.join(', ')}`);
    });

    test('plafond SMS (J2.13) : raiseCapAlert garde l’audit et passe par notification_admin_alert, sans écrire dans notifications', () => {
        const file = 'lib/sms/sms-guard.ts';
        const src = source(file);
        assert.match(src, /audit_logs/, `${file} : journal d'audit du plafond conservé`);
        assert.match(src, /['"]notification_admin_alert['"]/, `${file} : appel de la RPC notification_admin_alert`);
        assert.match(src, /ADMIN_SMS_CAP_GLOBAL/, `${file} : type ADMIN_SMS_CAP_GLOBAL`);
        assert.match(src, /ADMIN_SMS_CAP_NON_OTP/, `${file} : type ADMIN_SMS_CAP_NON_OTP`);
        assert.doesNotMatch(src, /from\(\s*['"]notifications['"]\s*\)/, `${file} : plus aucune écriture directe dans notifications`);
    });

    test('alertes de cashout (J2.2) : lib/admin/alerts.ts garde l’audit et n’écrit plus dans notifications', () => {
        const file = 'lib/admin/alerts.ts';
        const src = source(file);
        assert.match(src, /audit_logs/, `${file} : journal d'audit conservé`);
        assert.doesNotMatch(src, /from\(\s*['"]notifications['"]\s*\)/, `${file} : plus aucune écriture dans notifications`);
    });
});

// ── Base : écritures dans notifications et objets supprimés ────────────────

interface FnDef { name: string; def: string }

async function publicFunctions(db: Client, names?: string[]): Promise<FnDef[]> {
    const { rows } = await db.query<{ name: string; def: string }>(
        `SELECT p.proname AS name, pg_get_functiondef(p.oid) AS def
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.prokind = 'f' AND ($1::text[] IS NULL OR p.proname = ANY($1::text[]))
          ORDER BY p.proname`, [names ?? null]);
    return rows;
}

describe('6.7 — base : un seul écrivain de notifications, objets du lot 5 supprimés', () => {
    test('migrations du lot présentes (20261103000001 à …08)', () => {
        const files = fs.readdirSync(path.resolve(ROOT, MIGRATIONS_DIR)).filter((f) => /^20261103\d{6}_.*\.sql$/.test(f)).sort();
        const prefixes = files.map((f) => f.slice(0, 14));
        const expected = Array.from({ length: 8 }, (_, i) => `2026110300000${i + 1}`);
        assert.deepEqual(prefixes.filter((p) => expected.includes(p)), expected, `migrations 20261103* du lot (contrat R) : ${files.join(', ') || 'aucune'}`);
    });

    test('pg_get_functiondef : seule notification_outbox_mark contient INSERT INTO public.notifications', async () => {
        const writers = await inspect(async (db) => (await publicFunctions(db))
            .filter((f) => /insert\s+into\s+(public\.)?notifications\b/i.test(f.def))
            .map((f) => f.name));
        assert.deepEqual(Array.from(new Set(writers)).sort(), ['notification_outbox_mark'],
            `fonctions qui écrivent dans public.notifications : ${writers.join(', ') || 'aucune'}`);
    });

    test('event_change_notifications, event_change_notifications_claim, _mark et event_notify n’existent plus', async () => {
        const left = await inspect(async (db) => {
            const t = await db.query<{ reg: string | null }>(`SELECT to_regclass('public.event_change_notifications')::text AS reg`);
            const f = await publicFunctions(db, ['event_change_notifications_claim', 'event_change_notifications_mark', 'event_notify']);
            return { table: t.rows[0].reg, functions: f.map((x) => x.name) };
        });
        assert.equal(left.table, null, 'table public.event_change_notifications encore présente (J1.9)');
        assert.deepEqual(left.functions, [], `fonctions encore présentes : ${left.functions.join(', ')}`);
    });

    test('la migration 20261103000005 supprime la table et les RPC du lot 5 après la reprise', () => {
        assert.ok(exists(BILLETTERIE_MIGRATION), `${BILLETTERIE_MIGRATION} absent (contrat R)`);
        const sql = fs.readFileSync(path.resolve(ROOT, BILLETTERIE_MIGRATION), 'utf8');
        const reprise = sql.indexOf('-- reprise:fin');
        assert.ok(reprise > 0, `${BILLETTERIE_MIGRATION} : bloc « -- reprise:fin » absent`);
        for (const stmt of [
            /DROP\s+FUNCTION\s+(IF\s+EXISTS\s+)?public\.event_change_notifications_claim\s*\(\s*jsonb\s*\)/i,
            /DROP\s+FUNCTION\s+(IF\s+EXISTS\s+)?public\.event_change_notifications_mark\s*\(\s*jsonb\s*\)/i,
            /DROP\s+TABLE\s+(IF\s+EXISTS\s+)?public\.event_change_notifications\b/i,
            /DROP\s+FUNCTION\s+(IF\s+EXISTS\s+)?public\.event_notify\s*\(/i,
        ]) {
            const m = stmt.exec(sql);
            assert.ok(m, `${BILLETTERIE_MIGRATION} : instruction ${stmt} absente`);
            if (!/event_notify/.test(stmt.source)) assert.ok(m.index > reprise, `${BILLETTERIE_MIGRATION} : ${m[0]} placé avant la reprise des lignes`);
        }
    });
});

// ── Inventaire K1 : registre et points d'insertion ─────────────────────────

interface Insertion {
    types: string[];
    /** RPC recopiée (public) qui met le type en file. */
    fn?: string;
    /** Trigger : nom, table (schéma.table). */
    trigger?: { name: string; table: string };
    k1: string;
}

const INVENTORY: Insertion[] = [
    { k1: 'B1-B3, B4', fn: 'payment_confirm', types: ['PURCHASE_CONFIRMED', 'NEW_ORDER'] },
    { k1: 'gratuits', fn: 'free_tickets_claim', types: ['FREE_TICKETS_CONFIRMED'] },
    { k1: 'B16', fn: 'counter_sale', types: ['COUNTER_RECEIPT'] },
    { k1: 'B5', trigger: { name: 'trg_tickets_first_sale', table: 'public.tickets' }, types: ['FIRST_TICKET_SOLD'] },
    { k1: 'B13', trigger: { name: 'trg_tickets_scanned_notify', table: 'public.tickets' }, types: ['TICKET_SCANNED'] },
    { k1: 'B7-B12', trigger: { name: 'trg_ticket_categories_sold_out', table: 'public.ticket_categories' }, types: ['CATEGORY_SOLD_OUT', 'EVENT_SOLD_OUT'] },
    { k1: 'T1', fn: 'ticket_transfer_initiate', types: ['TRANSFER_OFFERED'] },
    { k1: 'T2', fn: 'ticket_transfer_cancel', types: ['TRANSFER_CANCELLED'] },
    { k1: 'expiration', fn: 'ticket_transfers_expire', types: ['TRANSFER_EXPIRED'] },
    { k1: 'T3-T6', fn: 'ticket_transfer_accept', types: ['TRANSFER_CLAIMED_SENDER', 'TRANSFER_RECEIVED'] },
    {
        k1: 'E1-E5', trigger: { name: 'trg_event_status_notify', table: 'public.event_status_history' },
        types: ['ADMIN_EVENT_SUBMITTED', 'EVENT_REJECTED', 'EVENT_VALIDATED', 'EVENT_PUBLISHED_BY_ADMIN', 'EVENT_SUSPENDED',
            'EVENT_SUSPENDED_HOLDER', 'EVENT_REACTIVATED', 'EVENT_REACTIVATED_HOLDER', 'EVENT_CANCELLED'],
    },
    { k1: 'E7-E8', fn: 'event_update', types: ['EVENT_CHANGED'] },
    {
        k1: 'E6, F1-F7', trigger: { name: 'trg_cashouts_notify', table: 'public.cashouts' },
        types: ['REFUND_REQUESTED', 'REFUND_PAID', 'WITHDRAWAL_PAID', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_UNCERTAIN',
            'CANCEL_REFUNDS_DONE', 'CANCEL_REFUNDS_BLOCKED', 'ADMIN_REFUND_TO_RETRY', 'ADMIN_CASHOUT_UNCERTAIN', 'ADMIN_WITHDRAWAL_REJECTED'],
    },
    { k1: 'F8', fn: 'fin_alert_superadmins', types: ['ADMIN_FINANCE_DEBT'] },
    { k1: 'F9', trigger: { name: 'trg_payments_other_success', table: 'public.payments' }, types: ['PAYMENT_SUCCESS'] },
    { k1: 'F10', trigger: { name: 'trg_partners_subscription', table: 'public.partners' }, types: ['SUBSCRIPTION_ACTIVATED'] },
    { k1: 'C1-C2', fn: 'shift_close', types: ['SHIFT_DISCREPANCY', 'SHIFT_CLOSED_BY_OTHER'] },
    { k1: 'C3, C5-C12', trigger: { name: 'trg_event_controllers_notify', table: 'public.event_controllers' }, types: ['CONTROLLER_ASSIGNED', 'CONTROLLER_UNASSIGNED'] },
    { k1: 'C4', fn: 'notification_controller_activated', types: ['CONTROLLER_ACTIVATED'] },
    { k1: 'rappels', fn: 'notification_reminders_schedule', types: ['REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER'] },
    {
        k1: 'P1-P7', trigger: { name: 'trg_partners_notify', table: 'public.partners' },
        types: ['PARTNER_REGISTERED_ACK', 'ADMIN_PARTNER_REGISTERED', 'PARTNER_VALIDATED', 'PARTNER_REJECTED', 'PARTNER_SUSPENDED', 'PARTNER_REACTIVATED'],
    },
    { k1: 'P8', fn: 'activate_partner_trial', types: ['TRIAL_STARTED'] },
    { k1: 'P9', trigger: { name: 'trg_sponsored_promotions_notify', table: 'public.sponsored_promotions' }, types: ['PROMOTION_DECIDED'] },
    {
        k1: 'P10-P12', trigger: { name: 'trg_hall_reservations_notify', table: 'public.hall_reservations' },
        types: ['HALL_RESERVATION_REQUESTED', 'HALL_RESERVATION_CONFIRMED', 'HALL_RESERVATION_CANCELLED'],
    },
    { k1: 'sécurité', trigger: { name: 'on_auth_user_password_changed', table: 'auth.users' }, types: ['PASSWORD_CHANGED'] },
    { k1: 'essai push', fn: 'notification_test_push_enqueue', types: ['PUSH_TEST'] },
    // Point d'insertion réel : notif_failed_alert, appelée par notification_outbox_mark et par la reprise des SENDING
    // de notification_outbox_claim (comportement prouvé par notif-envoyeur, « 5 échecs → FAILED + alerte ») ;
    // l'entrée visait notification_outbox_mark, qui ne nomme pas le type (run 61).
    { k1: 'échec', fn: 'notif_failed_alert', types: ['ADMIN_NOTIFICATION_FAILED'] },
    { k1: 'seuil', fn: 'notification_daily_checks', types: ['ADMIN_SMS_DAILY_THRESHOLD'] },
];

/** Types sans point d'insertion SQL littéral : appelés par TypeScript (OTP, invitation, plafond SMS). */
const TS_TYPES = ['OTP_LOGIN', 'OTP_REGISTER', 'OTP_PASSWORD_RESET', 'OTP_WITHDRAWAL', 'OTP_AUTH_HOOK', 'CONTROLLER_INVITE', 'ADMIN_SMS_CAP_GLOBAL', 'ADMIN_SMS_CAP_NON_OTP'];

describe('6.7 K1 — inventaire : chaque envoi migré a son type au registre et son point d’insertion en base', () => {
    let registry: Set<string> | null = null;

    before(async () => {
        const reg = await inspect(async (db) => {
            const t = await db.query<{ reg: string | null }>(`SELECT to_regclass('public.notification_types')::text AS reg`);
            if (!t.rows[0].reg) return null;
            return (await db.query<{ type: string }>('SELECT type FROM public.notification_types')).rows.map((r) => r.type);
        });
        registry = reg ? new Set(reg) : null;
    });

    test('registre notification_types : tous les types de l’inventaire (K1) et des envois TypeScript', () => {
        assert.ok(registry, 'table public.notification_types absente (contrat C1, migration 20261103000002)');
        const wanted = Array.from(new Set([...INVENTORY.flatMap((i) => i.types), ...TS_TYPES])).sort();
        const missing = wanted.filter((t) => !registry!.has(t));
        assert.deepEqual(missing, [], `types absents du registre : ${missing.join(', ')}`);
    });

    test('RPC recopiées : chacune existe et nomme ses types', async () => {
        const fnNames = INVENTORY.filter((i) => i.fn).map((i) => i.fn!);
        const defs = await inspect(async (db) => publicFunctions(db, fnNames));
        const problems: string[] = [];
        for (const i of INVENTORY.filter((x) => x.fn)) {
            const def = defs.filter((d) => d.name === i.fn).map((d) => d.def).join('\n');
            if (!def) {
                problems.push(`${i.k1} : fonction public.${i.fn} absente`);
                continue;
            }
            for (const t of i.types) if (!def.includes(`'${t}'`)) problems.push(`${i.k1} : public.${i.fn} ne met pas '${t}' en file`);
        }
        assert.deepEqual(problems, [], problems.join('\n'));
    });

    test('triggers : chacun existe sur sa table et sa fonction nomme ses types', async () => {
        const triggers = await inspect(async (db) => (await db.query<{ name: string; tbl: string; def: string }>(
            `SELECT t.tgname AS name, n.nspname || '.' || c.relname AS tbl, pg_get_functiondef(t.tgfoid) AS def
               FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE NOT t.tgisinternal AND t.tgname = ANY($1::text[])`,
            [INVENTORY.filter((i) => i.trigger).map((i) => i.trigger!.name)])).rows);
        const problems: string[] = [];
        for (const i of INVENTORY.filter((x) => x.trigger)) {
            const tr = triggers.find((t) => t.name === i.trigger!.name && t.tbl === i.trigger!.table);
            if (!tr) {
                problems.push(`${i.k1} : trigger ${i.trigger!.name} absent de ${i.trigger!.table}`);
                continue;
            }
            for (const t of i.types) if (!tr.def.includes(`'${t}'`)) problems.push(`${i.k1} : ${i.trigger!.name} ne met pas '${t}' en file`);
        }
        assert.deepEqual(problems, [], problems.join('\n'));
    });
});

// ── Reprise des lignes d'event_change_notifications (J1.9) ─────────────────

interface LegacyRow {
    status: string;
    code?: string;
    expect: { status: string; reason: string | null; detail?: string | null };
}

const LEGACY_ROWS: LegacyRow[] = [
    { status: 'PENDING', expect: { status: 'PENDING', reason: null } },
    { status: 'SENDING', expect: { status: 'UNCERTAIN', reason: 'MIGRATED_WHILE_SENDING' } },
    { status: 'SENT', expect: { status: 'SENT', reason: null } },
    { status: 'NOT_REQUIRED', expect: { status: 'SKIPPED', reason: 'TITLE_ONLY' } },
    { status: 'REFUSED', code: 'NO_PHONE', expect: { status: 'SKIPPED', reason: 'MIGRATED_NO_PHONE' } },
    { status: 'REFUSED', code: 'SMS_RATE_LIMITED', expect: { status: 'FAILED', reason: 'MIGRATED_FAILED', detail: 'SMS_RATE_LIMITED' } },
    { status: 'FAILED', code: 'SMS_PROVIDER_ERROR', expect: { status: 'FAILED', reason: 'MIGRATED_FAILED', detail: 'SMS_PROVIDER_ERROR' } },
    { status: 'CANCELLED', expect: { status: 'CANCELLED', reason: 'NO_LONGER_RELEVANT' } },
    { status: 'SUPERSEDED', expect: { status: 'CANCELLED', reason: 'SUPERSEDED' } },
];

/** Schéma d'event_change_notifications (20261102000004_lot5_edition.sql:119-135), en table temporaire. */
const LEGACY_TABLE_SQL = `
CREATE TEMP TABLE event_change_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    user_id UUID NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    changed_fields TEXT[] NOT NULL,
    sms_required BOOLEAN NOT NULL,
    sms_status TEXT NOT NULL CHECK (sms_status IN ('NOT_REQUIRED', 'PENDING', 'SENDING', 'SENT', 'REFUSED', 'FAILED', 'CANCELLED', 'SUPERSEDED')),
    sms_code TEXT,
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT event_change_notifications_sms_coherent CHECK (sms_required OR sms_status = 'NOT_REQUIRED')
) ON COMMIT DROP`;

function repriseBlock(): string {
    assert.ok(exists(BILLETTERIE_MIGRATION), `${BILLETTERIE_MIGRATION} absent (contrat R, J1.9)`);
    const sql = fs.readFileSync(path.resolve(ROOT, BILLETTERIE_MIGRATION), 'utf8');
    const start = sql.indexOf('-- reprise:debut');
    const end = sql.indexOf('-- reprise:fin');
    assert.ok(start >= 0 && end > start, `${BILLETTERIE_MIGRATION} : bloc « -- reprise:debut » … « -- reprise:fin » absent (contrat J1.9)`);
    const block = sql.slice(start + '-- reprise:debut'.length, end);
    assert.match(block, /INSERT\s+INTO\s+(public\.)?notification_outbox\b/i, 'bloc de reprise : un INSERT dans notification_outbox');
    assert.match(block, /\bevent_change_notifications\b/, 'bloc de reprise : lecture depuis event_change_notifications');
    return block.replace(/\bpublic\.event_change_notifications\b/g, 'pg_temp.event_change_notifications');
}

describe('6.7 J1.9 — reprise des lignes d’event_change_notifications dans la boîte d’envoi', () => {
    let partner: TestPartner;
    let ev: DraftEvent;
    let holder: Buyer;

    before(async () => {
        partner = await newPartner('migr-reprise');
        ev = await createDraftEvent(partner, 'migr-reprise', [{ name: 'Standard', price: 1000, total: 5 }], { startsInHours: 72 });
        holder = await newBuyer('migr-reprise');
    });

    test('une ligne par statut : statut, motif, détail, tentatives, dates et données repris selon la table du contrat', async () => {
        const block = repriseBlock();
        const created = new Date(Date.now() - 3600_000);
        const nextAttempt = new Date(Date.now() + 120_000);
        const sentAt = new Date(Date.now() - 1800_000);
        const result = await inRolledBackTransaction(async (db) => {
            await db.query('SET LOCAL search_path = pg_temp, public');
            await db.query(LEGACY_TABLE_SQL);
            const ids: string[] = [];
            for (let i = 0; i < LEGACY_ROWS.length; i++) {
                const r = LEGACY_ROWS[i];
                const { rows } = await db.query<{ id: string }>(
                    `INSERT INTO pg_temp.event_change_notifications
                        (event_id, user_id, version, changed_fields, sms_required, sms_status, sms_code, attempts, next_attempt_at, claimed_at, sent_at, created_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
                    [ev.eventId, holder.userId, i + 1, r.status === 'NOT_REQUIRED' ? ['title'] : ['start_date', 'location'],
                        r.status !== 'NOT_REQUIRED', r.status, r.code ?? null, r.status === 'PENDING' ? 2 : 1,
                        r.status === 'PENDING' ? nextAttempt.toISOString() : null,
                        r.status === 'SENDING' ? new Date().toISOString() : null,
                        r.status === 'SENT' ? sentAt.toISOString() : null, created.toISOString()]);
                ids.push(rows[0].id);
            }
            await db.query(block);
            const { rows } = await db.query<Record<string, unknown>>(
                `SELECT * FROM public.notification_outbox WHERE event_id = $1 AND recipient_user_id = $2 AND type = 'EVENT_CHANGED' ORDER BY idempotency_key`,
                [ev.eventId, holder.userId]);
            return rows;
        });
        assert.equal(result.length, LEGACY_ROWS.length, `une ligne de boîte d'envoi par ligne reprise (${result.length} / ${LEGACY_ROWS.length}) : ${JSON.stringify(result.map((r) => [r.idempotency_key, r.status]))}`);
        for (let i = 0; i < LEGACY_ROWS.length; i++) {
            const r = LEGACY_ROWS[i];
            const version = i + 1;
            const key = `EVENT_CHANGED:${ev.eventId}:${holder.userId}:v${version}:SMS`;
            const row = result.find((x) => x.idempotency_key === key);
            const label = `${r.status}${r.code ? ` (${r.code})` : ''}`;
            assert.ok(row, `${label} : ligne de clé ${key} absente`);
            assert.equal(row.group_key, key.slice(0, -':SMS'.length), `${label} : group_key`);
            assert.equal(row.channel, 'SMS', `${label} : canal SMS`);
            assert.equal(row.family, 'OPTIONAL', `${label} : famille OPTIONAL`);
            assert.equal(row.topic, 'EVENT_UPDATES', `${label} : sujet EVENT_UPDATES`);
            assert.equal(row.status, r.expect.status, `${label} : statut ${row.status} (attendu ${r.expect.status})`);
            assert.equal(row.reason ?? null, r.expect.reason, `${label} : motif ${row.reason}`);
            if (r.expect.detail !== undefined) assert.equal(row.reason_detail, r.expect.detail, `${label} : détail = sms_code`);
            // pg rend une Date : String() la réécrivait sans millisecondes (écart de 433 ms au run 61, défaut du test).
            assert.equal(new Date(row.due_at as string | Date).getTime(), created.getTime(), `${label} : due_at = created_at de la ligne reprise`);
            const data = row.template_data as Record<string, unknown>;
            assert.equal(data.migrated_from, 'event_change_notifications', `${label} : template_data.migrated_from`);
            assert.deepEqual(data.changed_fields, r.status === 'NOT_REQUIRED' ? ['title'] : ['start_date', 'location'], `${label} : template_data.changed_fields`);
            if (r.status === 'PENDING') {
                assert.equal(Number(row.attempts), 2, 'PENDING : tentatives reprises');
                assert.equal(new Date(String(row.next_attempt_at)).getTime(), nextAttempt.getTime(), 'PENDING : prochain essai repris');
            }
            if (r.status === 'SENT') assert.equal(new Date(String(row.sent_at)).getTime(), sentAt.getTime(), 'SENT : sent_at repris');
        }
    });
});

// ── Destinataires admin : user_roles, jamais users.role ────────────────────

describe('6.7 — destinataires admin par user_roles et permissions, jamais par users.role (décision 13)', () => {
    let legacy: Buyer;
    let admin: TestAdmin;

    before(async () => {
        legacy = await newBuyer('migr-role-herite');
        admin = await newAdmin('migr-role', ['events.read']);
    });

    test('notif_admin_recipients : users.role = ADMIN sans user_roles → exclu ; ADMIN de user_roles avec users.role = CLIENT → inclus', async () => {
        const out = await inRolledBackTransaction(async (db) => {
            const fn = await db.query<{ n: number }>(
                `SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'notif_admin_recipients'`);
            if (fn.rows[0].n === 0) return null;
            await db.query(`UPDATE public.users SET role = 'ADMIN' WHERE id = $1`, [legacy.userId]);
            await db.query(`UPDATE public.users SET role = 'CLIENT' WHERE id = $1`, [admin.userId]);
            const roles = await db.query<{ id: string; role: string }>(`SELECT id, role::text AS role FROM public.users WHERE id = ANY($1::uuid[])`, [[legacy.userId, admin.userId]]);
            const recipients = await db.query<{ id: string }>(`SELECT r AS id FROM public.notif_admin_recipients('events.read') AS r`);
            return { roles: Object.fromEntries(roles.rows.map((r) => [r.id, r.role])), recipients: recipients.rows.map((r) => String(r.id)) };
        });
        assert.ok(out, 'fonction public.notif_admin_recipients absente (contrat D)');
        assert.equal(out.roles[legacy.userId], 'ADMIN', `précondition : users.role du compte hérité = ADMIN (${JSON.stringify(out.roles)})`);
        assert.equal(out.roles[admin.userId], 'CLIENT', `précondition : users.role de l'admin = CLIENT (${JSON.stringify(out.roles)})`);
        assert.ok(!out.recipients.includes(legacy.userId), 'un compte ADMIN par users.role seulement ne reçoit rien');
        assert.ok(out.recipients.includes(admin.userId), 'un ADMIN de user_roles avec la permission reçoit, quel que soit users.role');
    });

    test('lib : aucune requête from(\'users\') filtrée sur role pour choisir des destinataires', () => {
        const found: string[] = [];
        const re = /from\(\s*['"]users['"]\s*\)[^;]*?(\.eq\(\s*['"]role['"]|\.in\(\s*['"]role['"]|role\.eq\.)/g;
        for (const file of sourceFiles().filter((f) => f.startsWith('lib/'))) {
            const src = source(file);
            re.lastIndex = 0;
            let m: RegExpExecArray | null;
            while ((m = re.exec(src))) found.push(`${file}:${lineOf(src, m.index)}`);
        }
        assert.deepEqual(found, [], `destinataires lus par users.role :\n${found.join('\n')}`);
    });
});

describe('6.7 — destinataires admin actifs', () => {
    test('notif_admin_recipients(NULL) : au moins le SUPERADMIN du seed, uniquement des comptes ACTIF, aucun identifiant inconnu', async () => {
        const unknown = randomUUID();
        const rows = await inspect(async (db) => {
            const fn = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'notif_admin_recipients'`);
            if (fn.rows[0].n === 0) return null;
            return (await db.query<{ id: string }>(`SELECT r AS id FROM public.notif_admin_recipients(NULL) AS r`)).rows.map((r) => String(r.id));
        });
        assert.ok(rows, 'fonction public.notif_admin_recipients absente (contrat D)');
        assert.ok(rows.length > 0, 'au moins un destinataire (SUPERADMIN du seed)');
        assert.ok(!rows.includes(unknown), 'identifiant inconnu');
        const { data, error } = await service.from('users').select('id, status').in('id', rows);
        assert.equal(error, null, `comptes destinataires : ${error?.message}`);
        assert.ok((data ?? []).every((u) => u.status === 'ACTIF'), `destinataires ACTIF seulement : ${JSON.stringify((data ?? []).filter((u) => u.status !== 'ACTIF'))}`);
    });
});
