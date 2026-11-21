/**
 * Contre-vérification du lot 11b — suite 3 : contrôles SANS BASE (code et migrations lus tels quels).
 *
 *  T5. Demande particulière du client gardée sur l'appareil (« table-demande:<établissement> ») NON effacée quand la
 *      session se ferme à l'insu du navigateur (page chargée sans session, cvf2b 6.5 : « tout ce que le compte a laissé
 *      sur l'appareil est effacé ») : AuthProvider n'y appelle que clearDevicePrefs('paiement').
 *  S1. SMS des tables d'un segment GSM-7 au PIRE cas réel : lien de 27 caractères (contrat G3), montants maximaux réels
 *      (1 000 000 F × 50 personnes + frais = 52 500 000 F), nom d'établissement long et hors GSM-7, motif de 200 caractères,
 *      chaque origine ; y compris TABLE_CLIENT_COMING et TABLE_REFUND_PAID (absents des cas du test du lot).
 *  S2. Recopies (point 10) : venues_validation_guard, table_reserve, table_hold_refusal, table_reservation_presence,
 *      table_reservation_cancel, table_notif_data, notif_event_soon, notif_cashouts_notify, storage_public_citations :
 *      aucune ligne perdue par rapport à leur dernière définition de main (multiensemble des lignes, commentaires ôtés) ;
 *      seules pertes admises : le retour automatique en attente de venues_validation_guard (changement annoncé).
 *  S3. Types d'avis nouveaux : mêmes canaux au catalogue et en base ; nuit : une demande à accepter n'est jamais reportée.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { smsSegments } from '../../lib/notifications/sms-format';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8');
const trace = (tag: string, what: unknown): void => console.log(`[CV11B] ${tag} : ${typeof what === 'string' ? what : JSON.stringify(what)}`);

class FakeStorage {
    private m = new Map<string, string>();
    get length(): number { return this.m.size; }
    key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
    getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
    setItem(k: string, v: string): void { this.m.set(k, String(v)); }
    removeItem(k: string): void { this.m.delete(k); }
    keys(): string[] { return [...this.m.keys()]; }
}

describe('T5. Demande particulière gardée sur l’appareil', () => {
    test('session fermée à l’insu du navigateur (page chargée sans session) : la demande particulière du client est effacée', async () => {
        const storage = new FakeStorage();
        (globalThis as unknown as { window: unknown }).window = { localStorage: storage };
        const prefs = await import('../../lib/device/device-prefs');
        const purge = await import('../../lib/device/device-prefs-purge');
        const venue = '0b8c1f3e-5a2d-4c7b-9e1f-2a3b4c5d6e7f';
        assert.equal(prefs.saveTableNotes(venue, 'Allergie aux arachides, anniversaire de Fatou'), true);
        prefs.savePaymentPreference({ operator: 'WAVE', phone: '771234567' });
        // Chemin réel : AuthProvider, branche INITIAL_SESSION sans session (sessionEnded()), cvf2b 6.5
        const provider = read('components/providers/AuthProvider.tsx');
        const branch = provider.slice(provider.indexOf("event === 'INITIAL_SESSION'"), provider.indexOf("event === 'INITIAL_SESSION'") + 1500);
        const call = /clearDevicePrefs\(([^)]*)\)/.exec(branch)?.[0] ?? '(aucun appel)';
        purge.clearDevicePrefs(call.includes("'paiement'") ? 'paiement' : 'tout');
        const left = storage.keys();
        trace('T5 appareil après une session fermée à son insu', { appelDeAuthProvider: call, clesRestantes: left, demande: prefs.readTableNotes(venue) });
        assert.equal(prefs.readTableNotes(venue), '', `demande particulière du compte encore sur l’appareil : ${left.join(', ')}`);
    });
});

describe('S1. SMS des tables : un segment GSM-7 au pire cas réel', () => {
    type Template = { channels: string[]; sms?: (d: unknown, c: unknown) => string };
    const catalog = NOTIFICATION_CATALOG as unknown as Record<string, Template>;
    const ctx = { appUrl: 'https://app.eventvillage.sn' };
    const big = 52_500_000;
    const names = ['Restaurant Le Grand Bleu de la Corniche Ouest, terrasse panoramique', 'Chez Fatou – l’Île de Gorée, côté mer & ça bouge à la Pointe des Almadies'];
    const types = Object.keys(catalog).filter((k) => (k.startsWith('TABLE_') || k.startsWith('VENUE_')) && catalog[k].sms && catalog[k].channels.includes('SMS'));
    test(`${types.length} types, 2 noms, 4 origines, 4 décisions`, () => {
        const worst: Record<string, number> = {};
        const bad: string[] = [];
        for (const type of types) {
            for (const venue_name of names) {
                for (const origin of ['CLIENT', 'ETABLISSEMENT', 'EVENT_VILLAGE', 'SANS_REPONSE']) {
                    for (const decision of ['VALIDER', 'REFUSER', 'SUSPENDRE', 'REACTIVER']) {
                        const d = {
                            reservation_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59', venue_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59', venue_name,
                            date: '2026-12-30', time: '23:45', end_time: '01:45', guests: 50, table_number: 'Terrasse 12 bis 4',
                            deposit_amount: 50_000_000, total_amount: big, paid_amount: big, refund_amount: big, amount: big, operator: 'ORANGE_MONEY',
                            payment_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59', cashout_id: 'a3c5e7b9-1d2f-4a6c-8e4b-5f7a9c1e3d59',
                            response_due_at: '2026-12-30T21:45:00Z', hold_expires_at: '2026-12-30T21:45:00Z', cancel_free_until: '2026-12-30T21:45',
                            short_code: 'k7m2p9x', held_until: '00:15', origin, decision,
                            reason: `Fermeture exceptionnelle : ${'travaux importants dans la cuisine '.repeat(6)}`.slice(0, 227),
                        };
                        const sms = catalog[type].sms!(d, ctx);
                        const m = smsSegments(sms);
                        worst[type] = Math.max(worst[type] ?? 0, m.length);
                        if (m.encoding !== 'GSM7' || m.segments !== 1) bad.push(`${type}/${origin}/${decision} ${m.encoding} ${m.length} : ${sms}`);
                        if (!sms.includes('https://app.eventvillage.sn/') && type !== 'VENUE_VALIDATION_DECIDED') bad.push(`${type} sans lien : ${sms}`);
                    }
                }
            }
        }
        trace('S1 longueur maximale par type', worst);
        assert.ok(types.includes('TABLE_CLIENT_COMING') && types.includes('TABLE_REFUND_PAID'), types.join(','));
        assert.deepEqual(bad, []);
    });
});

describe('S2. Recopies : aucune ligne perdue par rapport à la dernière version de main', () => {
    const MIG = path.join(ROOT, 'supabase', 'migrations');
    const files = fs.readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
    const bodyOf = (file: string, fn: string): string | null => {
        const s = fs.readFileSync(path.join(MIG, file), 'utf8');
        const re = new RegExp(`CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${fn}\\s*\\(`, 'gi');
        let last: string | null = null;
        for (let m = re.exec(s); m; m = re.exec(s)) {
            const rest = s.slice(m.index);
            const tag = /AS\s+(\$[a-zA-Z_]*\$)/.exec(rest);
            if (!tag) continue;
            const start = rest.indexOf(tag[1], tag.index) + tag[1].length;
            last = rest.slice(start, rest.indexOf(tag[1], start));
        }
        return last;
    };
    const lines = (body: string): string[] => body.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !l.startsWith('--'));
    const ALLOWED_LOST: Record<string, string[]> = {
        venues_validation_guard: ["IF OLD.validation_status = 'REFUSEE' THEN", "NEW.validation_status := 'EN_ATTENTE_VALIDATION';", 'END IF;'],
    };
    for (const fn of ['venues_validation_guard', 'table_reserve', 'table_hold_refusal', 'table_reservation_presence', 'table_reservation_cancel',
        'table_notif_data', 'notif_event_soon', 'notif_cashouts_notify', 'storage_public_citations']) {
        test(fn, () => {
            let prev: [string, string] | null = null;
            let next: [string, string] | null = null;
            for (const f of files) {
                const b = bodyOf(f, fn);
                if (!b) continue;
                if (f.startsWith('20261129')) next = [f, b];
                else prev = [f, b];
            }
            assert.ok(prev && next, `${fn} : définitions trouvées`);
            const left = new Map<string, number>();
            for (const l of lines(next![1])) left.set(l, (left.get(l) ?? 0) + 1);
            const lost: string[] = [];
            for (const l of lines(prev![1])) {
                const c = left.get(l) ?? 0;
                if (c > 0) left.set(l, c - 1);
                else lost.push(l);
            }
            trace(`S2 ${fn}`, { main: prev![0], lot: next![0], lignesMain: lines(prev![1]).length, lignesLot: lines(next![1]).length, perdues: lost });
            assert.deepEqual(lost.sort(), [...(ALLOWED_LOST[fn] ?? [])].sort(), `${fn} : lignes perdues`);
        });
    }
});

describe('S3. Avis nouveaux et nuit', () => {
    test('TABLE_CLIENT_COMING et TABLE_REFUND_PAID : 4 canaux au catalogue et en base ; demandes à accepter et envoyées jamais en DEFER', () => {
        const sql = read('supabase/migrations/20261129000004_l11b_avis.sql');
        const catalog = NOTIFICATION_CATALOG as unknown as Record<string, { channels: string[] }>;
        for (const t of ['TABLE_CLIENT_COMING', 'TABLE_REFUND_PAID']) {
            assert.match(sql, new RegExp(`\\('${t}',[^\\n]*ARRAY\\['IN_APP','PUSH','EMAIL','SMS'\\]`), t);
            assert.deepEqual([...catalog[t].channels].sort(), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], t);
        }
        const deferred = /SET night_policy = 'DEFER'[\s\S]*?\);/.exec(sql)?.[0] ?? '';
        trace('S3 types passés en DEFER', deferred.replace(/\s+/g, ' '));
        for (const t of ['TABLE_REQUEST_TO_ANSWER', 'TABLE_REQUEST_SENT', 'TABLE_RESERVATION_CANCELLED', 'TABLE_NO_SHOW', 'TABLE_REQUEST_EXPIRED']) {
            assert.ok(!deferred.includes(`'${t}'`), `${t} reporté la nuit`);
        }
    });
});
