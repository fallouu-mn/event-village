/**
 * Lot 4.9 (contrat D, partie API et contrôles statiques de l'interface) — traçabilité du contrôle et
 * contrat de résultat partagé.
 *  - ticket_scans : une ligne par tentative, acceptée ou refusée (valid, already_used, qr_expired,
 *    dynamic_qr_required, manual_entry_refused, saisie manuelle valide), avec billet, événement,
 *    scanneur, résultat, accepted, méthode QR / MANUAL, identité vérifiée et empreinte du payload ;
 *    jamais le payload ni le numéro de billet en clair ; scan_id de la réponse = ligne du journal ;
 *    table illisible par les rôles de l'API ;
 *  - lib/scan/scan-result.ts : type ScanResult = exactement l'union du contrat (vérifiée par le
 *    compilateur TypeScript) ;
 *  - quota par scanneur : rafale au-delà de SCAN_PER_SCANNER_10S → 429 rate_limited ; lot 7 (T0) : la
 *    rafale est alignée sur une fenêtre de 10 s de l'horloge de la base (fenêtres fixes de quota_reserve),
 *    puis le test vérifie qu'elle y est restée : même limite, mêmes assertions, plus d'instabilité (run 70) ;
 *  - scanner contrôleur (contrôle statique) : statut HTTP lu, 401 → connexion, erreurs techniques
 *    (rate_limited, server_error, network_error) traitées à part, jamais « invalide » par défaut ni son
 *    de rejet (lot 7 : l'audio du scanner est supprimé ; l'absence de tout son est vérifiée plus largement
 *    par tests/parcours/scanner-interface.test.ts), compteur de refus réservé aux refus de billet, caméra
 *    en pause pendant une confirmation espèces, union importée de lib/scan/scan-result.
 * Rouge avant correctif : aucune table ticket_scans (app/api/controller/scan/route.ts:355-367 n'audite
 * que le succès) ; lib/scan/scan-result.ts n'existe pas ; limiteur en mémoire 5/s (route.ts:41-57),
 * SCAN_PER_SCANNER_10S absent de .env.test.example ; app/controller/scanner/page.tsx:483 et :548
 * (`|| 'invalid'`), :418-421 (voix INVALID par défaut), :452-457 (refus comptés sans exclure les erreurs
 * techniques), :475-488 (statut HTTP ignoré), :1060-1065 (caméra active pendant un encaissement).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { resetServerEnvCache } from '../../lib/env';
import { STRONG_PASSWORD } from './helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { createTimedEvent, newController, scan, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import { alignQuotaWindow, assertSameQuotaWindow } from '../helpers/quota-window';

type Row = Record<string, unknown>;

const ROOT = process.cwd();
const CONTRACT_RESULTS = [
    'valid', 'already_used', 'invalid', 'cancelled', 'refunded', 'wrong_event', 'event_cancelled', 'event_ended',
    'event_suspended', 'event_not_open', 'payment_required', 'qr_expired', 'dynamic_qr_required',
    'manual_entry_refused', 'rate_limited', 'network_error', 'server_error', 'not_processed',
];

let partner: TestPartner;
let ev: SaleEvent;
let scanner: Buyer;
let buyer: Buyer;

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`;
}

async function freeTicket(): Promise<Row> {
    const cat = ev.categories['Entrée libre'];
    const { data, error } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: buyer.userId, price: 0, status: 'VALIDE',
        ticket_number: `TCK-TRACE-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
        qr_code: `EV-QR-${randomUUID().replace(/-/g, '')}`,
    }).select('*').single();
    assert.equal(error, null, `billet gratuit : ${error?.message}`);
    const { data: c } = await service.from('ticket_categories').select('sold_quantity').eq('id', cat.id).single();
    await service.from('ticket_categories').update({ sold_quantity: Number(c?.sold_quantity ?? 0) + 1 }).eq('id', cat.id);
    return data as Row;
}

async function scansBy(scannerId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_scans').select('*').eq('scanner_id', scannerId).order('created_at');
    assert.equal(error, null, `ticket_scans : ${error?.message}`);
    return (data ?? []) as Row[];
}

before(async () => {
    partner = await newPartner('accestrace');
    ev = await createTimedEvent(partner.partnerId, 'trace', [{ name: 'Entrée libre', price: 0, total: 30 }]);
    scanner = await newController(partner, ev.eventId, { label: 'trace' });
    buyer = await newBuyer('accestrace');
});

after(async () => {
    await assertAccessInvariants('acces-tracabilite');
});

describe('4.9 Journal ticket_scans', () => {
    test('une ligne par tentative (acceptée ou refusée), complète, sans payload en clair ; scan_id = ligne du journal', async () => {
        const t1 = await freeTicket();
        const t2 = await freeTicket();
        const id1 = String(t1.id);
        const id2 = String(t2.id);
        const live1 = await ticketPayload(id1);
        const expired2 = await ticketPayload(id2, new Date(Date.now() - 60_000));
        const attempts: Array<{ label: string; body: Row; expected: string; method: 'QR' | 'MANUAL'; ticketId: string | null; raw: string; identity?: boolean }> = [
            { label: 'QR valide', body: { eventId: ev.eventId, payload: live1 }, expected: 'valid', method: 'QR', ticketId: id1, raw: live1 },
            { label: 'même QR une seconde fois', body: { eventId: ev.eventId, payload: live1 }, expected: 'already_used', method: 'QR', ticketId: id1, raw: live1 },
            { label: 'QR expiré', body: { eventId: ev.eventId, payload: expired2 }, expected: 'qr_expired', method: 'QR', ticketId: id2, raw: expired2 },
            { label: 'identifiant nu', body: { eventId: ev.eventId, payload: String(t2.ticket_number) }, expected: 'dynamic_qr_required', method: 'QR', ticketId: null, raw: String(t2.ticket_number) },
            // ticketId null : refus décidé avant la résolution du billet possible (ligne sans billet ou avec le billet visé)
            { label: 'saisie sans identité', body: { eventId: ev.eventId, manualTicketNumber: t2.ticket_number, identityVerified: false }, expected: 'manual_entry_refused', method: 'MANUAL', ticketId: null, raw: String(t2.ticket_number), identity: false },
            { label: 'saisie valide', body: { eventId: ev.eventId, manualTicketNumber: t2.ticket_number, identityVerified: true }, expected: 'valid', method: 'MANUAL', ticketId: id2, raw: String(t2.ticket_number), identity: true },
        ];
        const responses: RouteResult[] = [];
        for (const a of attempts) {
            const r = await scan(scanner, a.body);
            assert.equal(r.status, 200, `${a.label} : ${show(r)}`);
            assert.equal(r.body.result, a.expected, `${a.label} : ${show(r)}`);
            assert.equal(typeof r.body.scan_id, 'string', `${a.label} : scan_id attendu`);
            responses.push(r);
        }

        const rows = await scansBy(scanner.userId);
        assert.equal(rows.length, attempts.length, `une ligne par tentative : ${rows.length} ligne(s) pour ${attempts.length} tentative(s)`);
        const byId = new Map(rows.map((row) => [String(row.id), row]));
        attempts.forEach((a, i) => {
            const row = byId.get(String(responses[i].body.scan_id));
            assert.ok(row, `${a.label} : la ligne ${responses[i].body.scan_id} correspond au scan_id renvoyé`);
            assert.equal(row.result, a.expected, `${a.label} : result`);
            assert.equal(row.accepted, a.expected === 'valid', `${a.label} : accepted`);
            assert.equal(row.method, a.method, `${a.label} : method`);
            assert.equal(row.event_id, ev.eventId, `${a.label} : event_id`);
            assert.equal(row.scanner_id, scanner.userId, `${a.label} : scanner_id`);
            if (a.ticketId) assert.equal(row.ticket_id, a.ticketId, `${a.label} : ticket_id`);
            else assert.ok(row.ticket_id === null || row.ticket_id === id2, `${a.label} : ticket_id vide ou billet visé`);
            if (a.identity !== undefined) assert.equal(row.identity_verified === true, a.identity, `${a.label} : identity_verified`);
            assert.equal(typeof row.payload_hash, 'string', `${a.label} : empreinte du payload`);
            assert.ok(String(row.payload_hash).length >= 16, `${a.label} : empreinte de 16 caractères au moins`);
            const json = JSON.stringify(row);
            assert.ok(!json.includes(a.raw), `${a.label} : le payload ne doit jamais être stocké en clair`);
            assert.ok(!json.includes(String(t1.ticket_number)) && !json.includes(String(t2.ticket_number)), `${a.label} : aucun numéro de billet en clair`);
            assert.ok(!json.includes('EVT1'), `${a.label} : aucun payload EVT1 en clair`);
        });
        const hash = (i: number) => byId.get(String(responses[i].body.scan_id))?.payload_hash;
        assert.equal(hash(0), hash(1), 'même payload, même empreinte');
        assert.notEqual(hash(0), hash(2), 'payloads différents, empreintes différentes');

        assert.equal((await ticketRow(id1)).status, 'UTILISE');
        assert.equal((await ticketRow(id2)).status, 'UTILISE');
    });

    test('colonnes du contrat ; journal illisible par un compte connecté (service_role seul)', async () => {
        const rows = await scansBy(scanner.userId);
        assert.ok(rows.length > 0, 'des lignes existent pour ce scanneur (test précédent)');
        for (const col of ['id', 'ticket_id', 'event_id', 'scanner_id', 'result', 'accepted', 'method', 'identity_verified', 'payload_hash', 'shift_id', 'consumed_at', 'created_at']) {
            assert.ok(col in rows[0], `colonne ticket_scans.${col}`);
        }
        const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error: signErr } = await client.auth.signInWithPassword({ email: scanner.email, password: STRONG_PASSWORD });
        assert.equal(signErr, null, signErr?.message);
        const { data, error } = await client.from('ticket_scans').select('id').eq('scanner_id', scanner.userId);
        assert.ok(error !== null || (data ?? []).length === 0, `le scanneur ne lit pas le journal par l’API : ${JSON.stringify(data)}`);
    });
});

describe('4.9 Union des résultats (lib/scan/scan-result.ts)', () => {
    test('type ScanResult = exactement l’union du contrat', () => {
        const file = path.resolve(ROOT, 'lib/scan/scan-result.ts');
        assert.ok(fs.existsSync(file), 'lib/scan/scan-result.ts doit exister');
        const program = ts.createProgram([file], { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2020, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext });
        const checker = program.getTypeChecker();
        const source = program.getSourceFile(file);
        assert.ok(source, 'fichier compilé');
        const moduleSymbol = checker.getSymbolAtLocation(source);
        assert.ok(moduleSymbol, 'module');
        const exported = checker.getExportsOfModule(moduleSymbol).find((s) => s.getName() === 'ScanResult');
        assert.ok(exported, 'lib/scan/scan-result.ts doit exporter le type ScanResult');
        const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
        const type = checker.getDeclaredTypeOfSymbol(symbol);
        const members = (type.isUnion() ? type.types : [type]).map((m) => (m.isStringLiteral() ? m.value : checker.typeToString(m)));
        assert.deepEqual(members.slice().sort(), CONTRACT_RESULTS.slice().sort(), `ScanResult = ${members.join(' | ')}`);
    });
});

describe('4.9 Quota par scanneur', () => {
    test('SCAN_PER_SCANNER_10S déclaré dans .env.test.example ; rafale au-delà → 429 rate_limited', async () => {
        assert.match(fs.readFileSync(path.resolve(ROOT, '.env.test.example'), 'utf8'), /^SCAN_PER_SCANNER_10S=\d+/m, 'SCAN_PER_SCANNER_10S dans .env.test.example');
        const burster = await newController(partner, ev.eventId, { label: 'rafale' });
        const limit = 3;
        const saved = process.env.SCAN_PER_SCANNER_10S;
        process.env.SCAN_PER_SCANNER_10S = String(limit);
        resetServerEnvCache();
        try {
            // Lot 7 (T0) : fenêtres fixes de 10 s (quota_reserve) ; la rafale doit tenir dans une seule. La route
            // est chargée avant l'alignement : son premier import (suite filtrée) ne compte pas dans la rafale.
            await importModule('../../app/api/controller/scan/route');
            const win = await alignQuotaWindow(10, 3000);
            const out: RouteResult[] = [];
            for (let i = 0; i < limit + 2; i++) out.push(await scan(burster, { eventId: ev.eventId, payload: `TCK-RAFALE-${i}` }));
            await assertSameQuotaWindow(win, 'rafale de scans');
            for (const r of out.slice(0, limit)) {
                assert.equal(r.status, 200, `sous le quota : ${show(r)}`);
                assert.equal(r.body.result, 'dynamic_qr_required', `sous le quota : ${show(r)}`);
            }
            const limited = out.slice(limit);
            for (const r of limited) {
                assert.equal(r.status, 429, `au-delà du quota : ${show(r)}`);
                assert.equal(r.body.result, 'rate_limited', `au-delà du quota : ${show(r)}`);
            }
        } finally {
            if (saved === undefined) delete process.env.SCAN_PER_SCANNER_10S;
            else process.env.SCAN_PER_SCANNER_10S = saved;
            resetServerEnvCache();
        }
    });
});

// ── Scanner contrôleur (contrôle statique) ─────────────────────────────────

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Source de la page et des modules de scan partagés qu'elle importe (components/scan, lib/scan, hooks). */
function scannerSources(): string {
    const page = 'app/controller/scanner/page.tsx';
    const pageSrc = fs.readFileSync(path.resolve(ROOT, page), 'utf8');
    const parts = [pageSrc];
    for (const m of Array.from(pageSrc.matchAll(/from\s+['"]@\/((?:components\/scan|lib\/scan|hooks|lib\/hooks)\/[^'"]+)['"]/g))) {
        for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
            const p = path.resolve(ROOT, `${m[1]}${ext}`);
            if (fs.existsSync(p)) parts.push(fs.readFileSync(p, 'utf8'));
        }
    }
    return stripComments(parts.join('\n'));
}

describe('4.9 Scanner contrôleur (contrôle statique)', () => {
    test('le statut HTTP de la réponse est lu ; 401 renvoie vers la connexion', () => {
        const src = scannerSources();
        assert.ok(/\.status\s*(?:===|!==|==|>=|<=|>|<)\s*[1-5]\d\d\b|\bcase\s+[1-5]\d\d\s*:|\b(?:res|response)\.ok\b/.test(src),
            'le statut HTTP de /api/controller/scan doit être lu (res.status / res.ok)');
        assert.ok(/\b401\b[\s\S]{0,600}?['"`]\/login/.test(src), 'un 401 doit renvoyer vers /login (session expirée), pas vers un « billet invalide »');
    });

    test('erreurs techniques traitées à part : jamais « invalide » par défaut, aucun son de rejet, ni compteur de refus', () => {
        const src = scannerSources();
        for (const technical of ['rate_limited', 'server_error', 'network_error']) {
            assert.ok(src.includes(`'${technical}'`) || src.includes(`"${technical}"`), `résultat technique ${technical} traité explicitement`);
        }
        assert.ok(!/(?:result|scan_result)\s*(?:\|\||\?\?)\s*['"]invalid['"]/.test(src), 'une réponse sans résultat ne doit pas devenir « invalid »');
        assert.ok(!/\?\s*['"]invalid['"]\s*:\s*['"]valid['"]/.test(src), 'une erreur d’encaissement ne doit pas devenir « invalid »');
        assert.ok(!/else\s*\{\s*combatType\s*=\s*['"]reject['"]\s*;\s*wolofType\s*=\s*['"]INVALID['"]/.test(src), 'aucun son « billet invalide » pour un résultat non prévu');
        for (const m of Array.from(src.matchAll(/set\w*(?:Refus|Reject)\w*\s*\(/gi))) {
            const guard = src.slice(Math.max(0, (m.index ?? 0) - 600), m.index);
            assert.ok(/server_error|rate_limited|network_error|technical|technique|isTicketRefusal|isRefusal|REFUSAL/i.test(guard),
                `le compteur de refus (${m[0]}) doit exclure explicitement les erreurs techniques`);
        }
    });

    test('caméra en pause pendant une confirmation d’encaissement espèces', () => {
        const src = scannerSources();
        const camera = /<CameraQrScanner[\s\S]*?\/>/.exec(src);
        assert.ok(camera, 'le scanner caméra est présent');
        const preceding = src.slice(Math.max(0, camera.index - 400), camera.index);
        const guarded = /cash/i.test(camera[0]) || /cash/i.test(preceding) || /if\s*\([^)]*cash[^)]*\)\s*return\b/i.test(src);
        assert.ok(guarded, 'la caméra doit être suspendue (prop ou rendu conditionnel) tant qu’une confirmation espèces est en attente');
    });

    test('l’union des résultats est importée de lib/scan/scan-result (API et interfaces)', () => {
        assert.ok(/scan\/scan-result/.test(scannerSources()), 'app/controller/scanner/page.tsx (ou son composant de résultat) importe lib/scan/scan-result');
        const route = fs.readFileSync(path.resolve(ROOT, 'app/api/controller/scan/route.ts'), 'utf8');
        assert.ok(/scan\/scan-result/.test(route), 'app/api/controller/scan/route.ts importe lib/scan/scan-result');
    });
});
