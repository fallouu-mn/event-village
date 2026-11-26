/**
 * Contre-vérification du lot 11c-b — contrôles SANS BASE (stockage de l'appareil, SMS, fichiers partagés, sources).
 * Rouge = trou ; vert = garde-fou en place.
 *
 *  T3. Prénoms des invités gardés sur le téléphone (lib/device/table-prefs.ts) : effacés au bouton « Se déconnecter » et sur
 *      SIGNED_OUT, mais PAS quand la page se charge sans session (session close à l'insu du navigateur : « Déconnecter tous
 *      mes appareils », cvf2b 6.5) : AuthProvider n'y appelle que clearDevicePrefs('paiement'), qui n'efface que le
 *      numéro de paiement et les demandes des tables de restaurant (précédent : CV du lot 11b, T5). Lettre de cvf2b-6
 *      respectée (écrivain classé), esprit non : l'écriture passe par un accès générique réexporté (writeDevicePref), le
 *      classement de lib/device/device-prefs.ts n'en dit rien et le détecteur d'écrivains ne voit plus table-prefs.ts.
 *  T4. SMS de EVENT_TABLE_SEATS_REMINDER : lien /tickets (onglet « À venir ») alors que /tickets?tab=tables tient dans la
 *      marge de 155 caractères au pire cas (154) ; la raison donnée par docs/apres-lancement.md (« le lien long ferait
 *      passer le pire cas au-delà ») ne vaut que pour EVENT_TABLE_CONFIRMED (157).
 *  G-S. Garde-fous : prénom jamais envoyé au serveur, transfert ordinaire inchangé, modale ordinaire inchangée, offre en
 *      cache sans donnée de compte, identifiant de la vente au seul titulaire, aucune migration, aucun abonnement temps
 *      réel nouveau.
 */
import '../helpers/env';
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { smsSegments } from '../../lib/notifications/sms-format';
import { clearDevicePrefs, DEVICE_PREFS_PREFIX } from '../../lib/device/device-prefs-purge';
import { INVITE_NAMES_KEY, saveInviteName, readInviteNames, saveTableChoice, TABLE_CHOICE_PREFIX } from '../../lib/device/table-prefs';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

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

describe('T3 — prénoms des invités et purge sans session (cvf2b 6.5)', () => {
    test('page chargée sans session : les prénoms des invités (donnée du compte) sont effacés comme le numéro de paiement', () => {
        const storage = new MemoryStorage();
        g.window = { localStorage: storage, sessionStorage: new MemoryStorage() };
        assert.equal(saveInviteName('5b0e2f7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b', 'Fatou Ndiaye'), true, 'prénom gardé');
        saveTableChoice('7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f', { typeId: '8d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a', tableId: null });
        storage.setItem(`${DEVICE_PREFS_PREFIX}paiement`, JSON.stringify({ operator: 'WAVE', phone: '771234567' }));
        const before = storage.keys();

        const auth = strip(read('components/providers/AuthProvider.tsx'));
        const silent = /event === 'INITIAL_SESSION'[\s\S]*?\{([\s\S]*?)\n\s*\}/.exec(auth)?.[1] ?? '';
        const silentScope = /clearDevicePrefs\('([a-z]+)'\)/.exec(silent)?.[1] ?? (/clearDevicePrefs\(\)/.test(silent) ? 'tout' : 'absent');
        clearDevicePrefs(silentScope === 'tout' ? 'tout' : 'paiement');
        const left = storage.keys();

        const prefs = strip(read('lib/device/device-prefs.ts'));
        const generic = /export \{ readJson as readDevicePref, writeJson as writeDevicePref \}/.test(prefs);
        const detected = /\b(?:localStorage|sessionStorage)\b/.test(read('lib/device/table-prefs.ts')) && /\.setItem\(/.test(read('lib/device/table-prefs.ts'));
        const classed = /'lib\/device\/device-prefs\.ts': \{ what: '([^']+)'/.exec(read('tests/audit/cvf2b-6-deconnexion.test.ts'))?.[1] ?? '';
        console.log(`[CV11CB] T3. purge du chemin sans session : clearDevicePrefs('${silentScope}') ; clés avant ${JSON.stringify(before)} ; après ${JSON.stringify(left)} ; `
            + `accès générique réexporté : ${generic} ; table-prefs.ts vu par le détecteur d’écrivains de cvf2b-6 : ${detected} ; classement de device-prefs.ts : « ${classed} »`);
        assert.ok(!left.includes(`${DEVICE_PREFS_PREFIX}paiement`), 'témoin : le numéro de paiement est effacé sur ce chemin');
        assert.deepEqual(left.filter((k) => k === INVITE_NAMES_KEY), [], `prénoms des invités gardés après une session close à l’insu du navigateur : ${JSON.stringify(readInviteNames())}`);
        assert.ok(TABLE_CHOICE_PREFIX.startsWith(DEVICE_PREFS_PREFIX), 'choix gardé sous le préfixe des préférences (effacé au bouton)');
    });
});

describe('T4 — SMS des avis des tables', () => {
    const cat = NOTIFICATION_CATALOG as unknown as Record<string, { sample: Record<string, unknown>; sms: (d: unknown, c: unknown) => string }>;
    const worst = (type: string) => cat[type].sms({
        ...cat[type].sample, title: 'Nuit blanche « Prestige » à la Corniche des Almadies 2026 édition spéciale', table_number: 999, seats: 99, seats_left: 98,
    }, { appUrl: 'https://app.eventvillage.sn' });

    test('EVENT_TABLE_SEATS_REMINDER : le SMS ouvre l’onglet « Tables » quand le lien tient dans 155 caractères au pire cas', () => {
        const sms = worst('EVENT_TABLE_SEATS_REMINDER');
        const withTab = sms.includes('/tickets?tab=tables') ? sms : sms.replace(/\/tickets\b/, '/tickets?tab=tables');
        const m = smsSegments(withTab);
        console.log(`[CV11CB] T4. rappel au pire cas avec l’onglet : ${m.encoding} ${m.length} caractères (lien actuel : ${smsSegments(sms).length}) — ${sms}`);
        assert.ok(sms.includes('/tickets?tab=tables') || m.length > 155 || m.encoding !== 'GSM7',
            `SMS du rappel vers /tickets (onglet « À venir ») alors que /tickets?tab=tables tient (${m.length} ≤ 155)`);
    });

    test('EVENT_TABLE_CONFIRMED : l’écart du lien SMS est justifié (avec l’onglet, plus de 155 caractères au pire cas)', () => {
        const sms = worst('EVENT_TABLE_CONFIRMED');
        const m = smsSegments(sms.replace(/\/tickets\b/, '/tickets?tab=tables'));
        console.log(`[CV11CB] G-S. confirmation au pire cas avec l’onglet : ${m.length} caractères ; actuel ${smsSegments(sms).length}`);
        assert.ok(smsSegments(sms).length <= 155, 'SMS actuel dans la marge');
        assert.ok(m.length > 155, `avec l’onglet : ${m.length}`);
    });
});

describe('G-S — garde-fous sans base', () => {
    test('prénom de l’invité : jamais dans une requête ; transfert ordinaire : aucun champ ni numéro prérempli', () => {
        const modal = strip(read('components/tickets/TransferModal.tsx'));
        const bodies = [...modal.matchAll(/body: JSON\.stringify\(([^)]*)\)/g)].map((m) => m[1].trim());
        assert.deepEqual(bodies, ['{ recipient: value }'], `corps envoyés par la fenêtre de transfert : ${JSON.stringify(bodies)}`);
        assert.match(modal, /useState\(initialRecipient \?\? ''\)/, 'sans numéro prérempli : champ vide comme avant');
        assert.match(modal, /\{guestName && \(\s*<TextInput/, 'champ « Prénom » seulement pour une place de table');
        assert.match(modal, /guestName\?\.onSent\(guest\)/, 'prénom remis à l’écran appelant seulement');
        const myTables = strip(read('components/event-tables/client/MyTables.tsx'));
        assert.doesNotMatch(myTables, /fetch\([^)]*\{[^}]*body:[^}]*name/i, 'aucun prénom dans une requête de « Ma table »');
        assert.match(myTables, /href=\{table\.whatsappUrl\}/, 'lien WhatsApp du serveur tel quel');
    });

    test('modale ordinaire et fenêtre de transfert : classes d’avant inchangées hors plein écran', () => {
        const m = read('components/ui/Modal.tsx');
        assert.match(m, /cn\('fixed inset-0 z-50 flex items-end justify-center', !fullScreen && 'sm:items-center sm:p-4 md:p-6'\)/);
        assert.match(m, /fullScreen \? 'h-\[100dvh\] max-h-none rounded-none border-0 sm:max-h-none sm:rounded-none' : MAX_WIDTH\[maxWidth\]/);
        assert.match(m, /: 'min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-6'\}/);
        assert.match(m, /fullScreen = false,/, 'plein écran : option, défaut faux');
    });

    test('offre en cache de la fiche : nombre de types et plus petit prix seulement ; identifiant de la vente au seul titulaire', () => {
        const summary = strip(read('lib/event-tables/offer-summary.server.ts'));
        assert.match(summary, /return \{ types: offer\.types\.length, fromPrice: Math\.min\(\.\.\.prices\) \};/);
        assert.match(summary, /callTables\('event_table_offer', \{ event_id: eventId \}\)/, 'offre publique, sans compte');
        assert.doesNotMatch(summary, /cookies\(|headers\(|session|user/i, 'rien du visiteur dans la fonction mise en cache');
        const tt = strip(read('lib/event-tables/ticket-tables.server.ts'));
        assert.match(tt, /bookingId: holder === readerId \? String\(booking\.id\) : null/);
        assert.match(tt, /invitedBy: holder === readerId \? null : \(names\.get\(holder\) \?\? null\)/);
        assert.match(tt, /\.from\('users'\)\.select\('id, first_name, last_name'\)/, 'aucun numéro du titulaire lu');
    });

    test('aucune migration du lot ; un seul abonnement temps réel, sur la tranche publique existante', () => {
        const toutes = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations')).filter((f) => f > '20261210000001_cb3_lieux_publics.sql');
        // Jusqu'à la fusion du 11c-b : seules les deux migrations du 11c-c (fusionné en 7d45274fb6) ; les lots suivants commencent à 20261216.
        assert.deepEqual(toutes.filter((f) => f < '20261216'), ['20261215000001_l11cc_lectures_tables.sql', '20261215000002_l11cc_cv_correctifs.sql'], 'migration ajoutée par le lot');
        assert.deepEqual(toutes.filter((f) => /l11cb/i.test(f)), [], 'migration ajoutée par le lot');
        const files = ['components/event-tables/client', 'components/event-page/TicketingSwitch.tsx', 'lib/event-tables'].flatMap((p) => {
            const full = path.join(ROOT, p);
            return fs.statSync(full).isDirectory() ? fs.readdirSync(full).map((f) => path.join(p, f)) : [p];
        });
        const subs = files.flatMap((f) => [...read(f).matchAll(/table: '([a-z_]+)'/g)].map((m) => `${f.replace(/\\/g, '/')} : ${m[1]}`));
        const direct = files.filter((f) => /\.channel\(|postgres_changes|from\('(event_|stock_|tickets)/.test(strip(read(f))) && !f.endsWith('.server.ts'));
        console.log(`[CV11CB] G-S. abonnements des écrans des tables : ${JSON.stringify(subs)} ; lectures directes : ${JSON.stringify(direct)}`);
        assert.deepEqual(subs, ['components/event-tables/client/TablesOffer.tsx : public_category_stock']);
        assert.deepEqual(direct, [], 'lecture directe de la base depuis un écran');
    });
});
