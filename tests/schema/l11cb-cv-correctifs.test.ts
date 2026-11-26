/**
 * Lot 11c-b — correctifs après la contre-vérification (docs/audit-lot11c-b.md), contrôles SANS BASE. Les suites de l'audit
 * (tests/audit/cv11cb-*) sont reprises sans changement ; ce test ajoute ce que leur détecteur ne voit pas.
 *
 *  T1. Signal « une table a changé » : seule l'heure des tranches publiques déjà existantes de l'événement est réécrite
 *      (aucune ligne, aucune valeur, aucun stock nouveau), après la mise en attente, la libération et le remboursement ;
 *      l'onglet relit aussi l'offre toutes les 15 s quand le plan est ouvert et visible ; aucun abonnement nouveau.
 *  T2. Onglet « Tables » d'après les ventes (serveur), bandeau du remboursement dans Mes billets, avis du report vers les
 *      billets de l'événement, et page de l'événement → « Ma table » pour le titulaire.
 *  T3. Stockage de l'appareil : prénoms des invités et table choisie écrits par des fonctions NOMMÉES dans
 *      lib/device/device-prefs.ts (écrivain classé de cvf2b-6) ; aucun accès générique réexporté ; table-prefs.ts sans
 *      accès au stockage ; purge : prénoms effacés aussi sur le chemin « page chargée sans session », recherches gardées.
 *  T4. SMS du rappel des places vers l'onglet « Tables » : un segment GSM-7 au pire cas (≤ 155 caractères).
 *  O.  Prix changé : total affiché comparé au prix de la base (avant et après la création), jamais utilisé pour payer ;
 *      fermeture ou réouverture du service : fiche invalidée tout de suite.
 */
import '../helpers/env';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { smsSegments } from '../../lib/notifications/sms-format';
import { clearDevicePrefs, DEVICE_INVITE_NAMES_KEY, DEVICE_PREFS_PREFIX } from '../../lib/device/device-prefs-purge';
import { readInviteNames, saveInviteName, saveTableChoice, takeTableChoice } from '../../lib/device/device-prefs';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

class MemoryStorage {
    private m = new Map<string, string>();
    get length() { return this.m.size; }
    key(i: number) { return [...this.m.keys()][i] ?? null; }
    getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
    setItem(k: string, v: string) { this.m.set(k, String(v)); }
    removeItem(k: string) { this.m.delete(k); }
    keys() { return [...this.m.keys()]; }
}
const g = globalThis as unknown as { window?: unknown };
afterEach(() => { delete g.window; });

describe('T1 — signal des tables sur la tranche publique existante, relecture du plan ouvert', () => {
    test('le serveur ne réécrit que updated_at des tranches de l’événement, après attente, libération et remboursement', () => {
        const server = strip(read('lib/event-tables/event-tables.server.ts'));
        const fn = /export async function signalTablesChanged\(eventId: string, why: string\): Promise<void> \{([\s\S]*?)\n\}/.exec(server)?.[1] ?? '';
        assert.match(fn, /\.from\('public_category_stock'\)\s*\.update\(\{ updated_at: new Date\(\)\.toISOString\(\) \}\)\s*\.eq\('event_id', eventId\)/, 'seule l’heure des tranches de l’événement');
        assert.doesNotMatch(fn, /insert\(|upsert\(|availability|remaining_hint|delete\(/, 'aucune ligne ni valeur nouvelle');
        assert.match(server, /await signalTablesChanged\(params\.eventId, 'table en attente de paiement'\);/);
        assert.match(server, /await signalTablesChanged\(params\.eventId, 'table rendue'\);/);
        assert.match(strip(read('app/api/event-tables/[bookingId]/refund/route.ts')), /await signalTablesChanged\(String\(booking\.event_id\), 'table remboursée, de nouveau en vente'\)/);
        assert.deepEqual(fs.readdirSync(path.join(ROOT, 'supabase', 'migrations')).filter((f) => f > '20261210000001_cb3_lieux_publics.sql'), [], 'aucune migration');
    });

    test('plan ouvert et visible : offre relue toutes les 15 s ; un seul abonnement, la tranche publique', () => {
        const offer = strip(read('components/event-tables/client/TablesOffer.tsx'));
        assert.match(offer, /if \(!planOpen \|\| step === 'done'\) return undefined;\s*const timer = window\.setInterval\(\(\) => \{ if \(document\.visibilityState === 'visible'\) void refresh\(\); \}, 15_000\);/);
        assert.deepEqual([...offer.matchAll(/table: '([a-z_]+)'/g)].map((m) => m[1]), ['public_category_stock']);
    });
});

describe('T2 — « Ma table » d’après les ventes', () => {
    test('GET /api/tickets sert les tables du titulaire ; Mes billets montre l’onglet et le bandeau du remboursement', () => {
        const helper = strip(read('lib/event-tables/ticket-tables.server.ts'));
        assert.match(helper, /\.from\('event_table_bookings'\)\s*\.select\('id, event_id'\)\s*\.eq\('holder_id', userId\)\s*\.eq\('status', 'ACTIVE'\)/, 'd’après les ventes du compte');
        assert.match(strip(read('app/api/tickets/route.ts')), /const tables = await holderTablesOf\(effectiveUserId\);/);
        const view = strip(read('app/tickets/TicketsView.tsx'));
        assert.match(view, /const hasTables = useMemo\(\(\) => Boolean\(tablesInfo\?\.holder\) \|\| tickets\.some/);
        assert.match(view, /\{refundTable && tab !== 'tables' && \(/);
        assert.match(view, /onClick=\{\(\) => openTable\(refundTable\.bookingId\)\}/);
    });

    test('avis du report qui ouvre le remboursement → billets de l’événement ; page de l’événement → « Ma table » du titulaire', () => {
        const e = NOTIFICATION_CATALOG.EVENT_CHANGED;
        const sample = e.sample as unknown as Record<string, unknown>;
        assert.equal(e.link!({ ...sample, refund_open: true } as never), `/tickets/${String(sample.event_id)}`);
        assert.equal(e.link!(sample as never), `/events/${String(sample.event_id)}`, 'autre changement : la fiche, comme avant');
        const focus = strip(read('app/tickets/focus-read.ts'));
        assert.match(focus, /const refundTable = tableOf\(tables\?\.refundOpen\);\s*if \(refundTable\) return \{ kind: 'table', bookingId: refundTable \};/);
        assert.match(focus, /const heldTable = tableOf\(tables\?\.held\);\s*if \(!ofEvent && heldTable\) return \{ kind: 'table', bookingId: heldTable \};/);
        // Ligne figée par f5-liens-avis (finition 5), gardée telle quelle
        assert.match(focus, /return ofEvent \? \{ kind: 'ok', focus: 'event', tickets: ofEvent \} : \{ kind: 'not-found' \};/);
        assert.match(strip(read('app/tickets/[id]/page.tsx')), /if \(read\.kind === 'table'\) redirect\(`\/tickets\?tab=tables#table-\$\{read\.bookingId\}`\);/);
    });
});

describe('T3 — stockage de l’appareil des tables', () => {
    test('écritures nommées dans device-prefs.ts, aucun accès générique, table-prefs.ts sans stockage', () => {
        const prefs = strip(read('lib/device/device-prefs.ts'));
        assert.doesNotMatch(prefs, /export \{[^}]*\b(readJson|writeJson)\b/, 'aucun accès générique réexporté');
        assert.doesNotMatch(prefs, /writeDevicePref|readDevicePref|removeDevicePref/);
        assert.match(prefs, /export function saveInviteName\(ticketId: string, name: string\): boolean \{/);
        assert.match(prefs, /export function saveTableChoice\(eventId: string, choice: TableChoice\): boolean \{/);
        const tp = strip(read('lib/device/table-prefs.ts'));
        assert.doesNotMatch(tp, /localStorage|sessionStorage|setItem|removeItem/, 'table-prefs.ts ne touche pas au stockage');
        assert.match(tp, /from '\.\/device-prefs';/);
    });

    test('purge : prénoms effacés au bouton ET sur une page chargée sans session ; recherches d’un visiteur gardées', () => {
        const storage = new MemoryStorage();
        g.window = { localStorage: storage, sessionStorage: new MemoryStorage() };
        assert.equal(saveInviteName('5b0e2f7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b', 'Fatou Ndiaye'), true);
        assert.deepEqual(readInviteNames(), { '5b0e2f7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b': 'Fatou Ndiaye' });
        storage.setItem(`${DEVICE_PREFS_PREFIX}recherches`, JSON.stringify(['jazz']));
        clearDevicePrefs('paiement');
        assert.deepEqual(storage.keys(), [`${DEVICE_PREFS_PREFIX}recherches`], 'sans session : prénoms effacés, recherches gardées');
        saveInviteName('5b0e2f7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b', 'Fatou');
        assert.equal(saveTableChoice('7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f', { typeId: '8d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a', tableId: null }), true);
        clearDevicePrefs();
        assert.deepEqual(storage.keys(), [], 'bouton « Se déconnecter » : tout effacé');
        assert.equal(storage.getItem(DEVICE_INVITE_NAMES_KEY), null);
        assert.equal(takeTableChoice('7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f'), null);
        assert.match(strip(read('components/providers/AuthProvider.tsx')), /event === 'INITIAL_SESSION' && !nextUserId && sessionEnded\(\)\) \{[\s\S]*?clearDevicePrefs\('paiement'\);/);
    });
});

describe('T4 — SMS du rappel des places', () => {
    test('/tickets?tab=tables, un segment GSM-7 au pire cas (titre long, table 999, 98 places)', () => {
        const cat = NOTIFICATION_CATALOG as unknown as Record<string, { sample: Record<string, unknown>; sms: (d: unknown, c: unknown) => string }>;
        const sms = cat.EVENT_TABLE_SEATS_REMINDER.sms({
            ...cat.EVENT_TABLE_SEATS_REMINDER.sample, title: 'Nuit blanche « Prestige » à la Corniche des Almadies 2026 édition spéciale', table_number: 999, seats_left: 98,
        }, { appUrl: 'https://app.eventvillage.sn' });
        const m = smsSegments(sms);
        console.log(`[L11CB-CV] T4. rappel au pire cas : ${m.encoding} ${m.length} caractères, ${m.segments} segment(s) — ${sms}`);
        assert.ok(sms.endsWith('https://app.eventvillage.sn/tickets?tab=tables'), sms);
        assert.equal(m.encoding, 'GSM7');
        assert.ok(m.length <= 155, `${m.length} caractères`);
        assert.equal(m.segments, 1);
    });
});

describe('Observations — prix changé, cache', () => {
    test('total affiché : comparé avant et après la création, jamais utilisé pour payer', () => {
        const server = strip(read('lib/event-tables/event-tables.server.ts'));
        assert.match(server, /expectedTotal: z\.number\(\)\.nonnegative\(\)\.max\(100_000_000\)\.optional\(\),/);
        assert.match(server, /if \(quote\.ok === true && Number\(quote\.total\) !== input\.expectedTotal\) return priceChanged\(Number\(quote\.total\)\);/);
        assert.match(server, /if \(input\.expectedTotal !== undefined && amount !== input\.expectedTotal\) \{\s*const \{ error: relErr \} = await rpcWithRetry\('payment_release', \{ p_payment_id: paymentId, p_status: 'CANCELLED', p_reason: 'PRICE_CHANGED' \}\);/);
        assert.equal((server.match(/expectedTotal/g) ?? []).length, 5, 'le total affiché ne sert qu’aux deux comparaisons');
        assert.match(server, /error: `Le prix de cette table a changé : \$\{formatFcfa\(total\)\}\. Vérifiez avant de payer\.`, code: 'TABLE_PRICE_CHANGED'/);
        const pay = strip(read('components/event-tables/client/PayStep.tsx'));
        assert.match(pay, /\.\.\.\(total !== null \? \{ expectedTotal: total \} : \{\}\)/);
        assert.match(pay, /if \(error\.code === 'TABLE_PRICE_CHANGED'\) onPriceChanged\(\);/);
    });

    test('ouverture ou fermeture du service des tables : fiche invalidée tout de suite', () => {
        assert.match(strip(read('app/api/admin/finance-settings/route.ts')), /if \(parsed\.data\.key === 'features\.event_tables_enabled'\) invalidatePublicEvent\(null, 'service des tables ouvert ou fermé'\);/);
    });
});
