/**
 * Lot 4.3 (contrat D) — une seule voie de scan (/api/controller/scan) pour le contrôleur affecté, le
 * partenaire propriétaire et l'administrateur, décidée par la RPC ticket_scan.
 *  - périmètre vérifié AVANT tout le reste : partenaire B ou contrôleur non affecté visant l'événement
 *    de A → 403 SCAN_FORBIDDEN sans aucune donnée du billet ; partenaire B présentant un billet de A sur
 *    son propre événement → wrong_event sans donnée du billet ;
 *  - double scan simultané depuis deux portes : un seul valid, l'autre already_used, une seule ligne
 *    ticket_scans acceptée ;
 *  - billet payant sans paiement ni commande, scanné par le partenaire propriétaire → payment_required,
 *    non composté ;
 *  - partenaire propriétaire et administrateur : valid par la même route, ligne acceptée à leur nom ;
 *  - middleware : /api/controller/scan ouvert au PARTENAIRE (et à l'ADMIN), fermé au CLIENT ;
 *  - /api/tickets/verify supprimée ; /partner/scan appelle /api/controller/scan et partage le composant
 *    de résultat du scanner contrôleur.
 * Rouge avant correctif : app/api/controller/scan/route.ts:14-16 (corps { qr_code } seul : 400),
 * L135-163 TOTP et fuite de ticket_info avant l'affectation (L197-209), L306-352 branche partenaire sans
 * contrôle de paiement ni RPC, L241-280 contrôle de paiement sur orders seulement ; middleware.ts:190-204
 * refuse /api/controller/* au PARTENAIRE ; app/api/tickets/verify/route.ts existe et
 * app/partner/scan/page.tsx:53 l'appelle.
 *
 * Lot 8 (8.2 v) : cas T3.2 de tests/legacy/security-fixes.test.ts porté, vert dès l'écriture : un contrôleur SUSPENDU
 * est refusé au scan. Écart au legacy : code ACCOUNT_NOT_ACTIVE, plus strict que le texte (le legacy cherchait
 * « inactif » ou « suspendu », absents du message actuel).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { signInAs } from '../helpers/fixtures';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { STRONG_PASSWORD } from './helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { createTimedEvent, newController, scan, scansOf, ticketPayload, ticketRow, type RouteResult } from './acces-helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

type Row = Record<string, unknown>;

const CATEGORY = `Gradin-${randomUUID().slice(0, 6)}`;
const ROOT = process.cwd();

let partnerA: TestPartner;
let partnerB: TestPartner;
let evA: SaleEvent;
let evB: SaleEvent;
let door1: Buyer;
let door2: Buyer;
let outsider: Buyer;
let buyer: Buyer;
let tickets: Row[] = [];

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`;
}

function assertNoTicketData(r: RouteResult, t: Row, label: string): void {
    assert.equal(r.body.ticket, undefined, `${label} : aucune donnée de billet attendue : ${show(r)}`);
    const json = JSON.stringify(r.body);
    for (const leak of [String(t.ticket_number), String(t.id), buyer.lastName, CATEGORY]) {
        assert.ok(!json.includes(leak), `${label} : la réponse ne doit pas contenir « ${leak} » : ${json}`);
    }
}

async function assertNotConsumed(ticketId: string, label: string): Promise<void> {
    const t = await ticketRow(ticketId);
    assert.equal(t.status, 'VALIDE', `${label} : le billet ne doit pas être composté (statut ${t.status})`);
    const accepted = (await scansOf(ticketId)).filter((s) => s.accepted === true);
    assert.deepEqual(accepted, [], `${label} : aucune ligne ticket_scans acceptée attendue`);
}

function asUser(userId: string, accessToken: string): Buyer {
    return { userId, accessToken, email: '', phoneE164: '', phone9: '', firstName: '', lastName: '' };
}

before(async () => {
    partnerA = await newPartner('accesscana');
    partnerB = await newPartner('accesscanb');
    evA = await createTimedEvent(partnerA.partnerId, 'scanA', [{ name: CATEGORY, price: 2500, total: 30 }]);
    evB = await createTimedEvent(partnerB.partnerId, 'scanB', [{ name: 'Standard', price: 1000, total: 10 }]);
    door1 = await newController(partnerA, evA.eventId, { label: 'porte1' });
    door2 = await newController(partnerA, evA.eventId, { label: 'porte2' });
    outsider = await newController(partnerB, evB.eventId, { label: 'horsA' });
    buyer = await newBuyer('accesscan');
    tickets = (await buyConfirmed(buyer, evA, [[CATEGORY, 4]])).tickets;
    assert.equal(tickets.length, 4, 'quatre billets émis par le checkout');
});

after(async () => {
    await assertAccessInvariants('acces-scan');
});

describe('4.3 Périmètre du scanneur', () => {
    test('partenaire B ou contrôleur de B visant l’événement de A → 403 SCAN_FORBIDDEN, sans donnée du billet', async () => {
        const t = tickets[0];
        const payload = await ticketPayload(String(t.id));
        for (const [label, user] of [['partenaire B', partnerB], ['contrôleur non affecté à A', outsider]] as Array<[string, Buyer]>) {
            const r = await scan(user, { eventId: evA.eventId, payload });
            assert.equal(r.status, 403, `${label} : ${show(r)}`);
            assert.equal(r.body.code, 'SCAN_FORBIDDEN', `${label} : ${show(r)}`);
            assertNoTicketData(r, t, label);
        }
        await assertNotConsumed(String(t.id), 'scanneurs hors périmètre');
    });

    test('partenaire B présentant un billet de A sur son propre événement → wrong_event, sans donnée du billet', async () => {
        const t = tickets[0];
        const r = await scan(partnerB, { eventId: evB.eventId, payload: await ticketPayload(String(t.id)) });
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.result, 'wrong_event', show(r));
        assertNoTicketData(r, t, 'billet d’un autre événement');
        await assertNotConsumed(String(t.id), 'billet d’un autre événement');
    });

    test('contrôleur affecté dont le compte est SUSPENDU → 403 ACCOUNT_NOT_ACTIVE, sans donnée du billet, aucune ligne de scan (cas T3.2 porté)', async () => {
        const t = tickets[0];
        const suspended = await newController(partnerA, evA.eventId, { label: 'porte-suspendue' });
        const payload = await ticketPayload(String(t.id));
        const scansBefore = (await scansOf(String(t.id))).length;
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const r = await scan(suspended, { eventId: evA.eventId, payload });
        assert.equal(r.status, 403, `contrôleur SUSPENDU : ${show(r)}`);
        assert.equal(r.body.code, 'ACCOUNT_NOT_ACTIVE', show(r));
        assertNoTicketData(r, t, 'contrôleur SUSPENDU');
        await assertNotConsumed(String(t.id), 'contrôleur SUSPENDU');
        assert.equal((await scansOf(String(t.id))).length, scansBefore, 'aucune ligne ticket_scans pour un compte suspendu');
    });
});

describe('4.3 Compostage atomique', () => {
    test('double scan simultané depuis deux portes → un seul valid, l’autre already_used, une seule ligne acceptée', async () => {
        const t = tickets[1];
        const payload = await ticketPayload(String(t.id));
        const settled = await Promise.allSettled([
            scan(door1, { eventId: evA.eventId, payload }),
            scan(door2, { eventId: evA.eventId, payload }),
        ]);
        const results = settled.map((s) => {
            assert.equal(s.status, 'fulfilled', `appel rejeté : ${s.status === 'rejected' ? String(s.reason) : ''}`);
            const r = (s as PromiseFulfilledResult<RouteResult>).value;
            assert.equal(r.status, 200, show(r));
            return String(r.body.result);
        });
        assert.deepEqual(results.sort(), ['already_used', 'valid'], `résultats des deux portes : ${JSON.stringify(results)}`);
        assert.equal((await ticketRow(String(t.id))).status, 'UTILISE');
        const rows = await scansOf(String(t.id));
        assert.equal(rows.length, 2, 'une ligne ticket_scans par tentative');
        assert.equal(rows.filter((s) => s.accepted === true).length, 1, 'exactement une ligne acceptée');
    });

    test('billet payant sans paiement ni commande, scanné par le partenaire propriétaire → payment_required, non composté', async () => {
        const cat = evA.categories[CATEGORY];
        const { data: unpaid, error } = await service.from('tickets').insert({
            event_id: evA.eventId, category_id: cat.id, user_id: buyer.userId, price: cat.price, status: 'VALIDE',
            ticket_number: `TCK-IMPAYE-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
            qr_code: `EV-QR-${randomUUID().replace(/-/g, '')}`,
        }).select('id').single();
        assert.equal(error, null, `billet impayé : ${error?.message}`);
        try {
            const r = await scan(partnerA, { eventId: evA.eventId, payload: await ticketPayload(unpaid.id) });
            assert.equal(r.status, 200, show(r));
            assert.equal(r.body.result, 'payment_required', show(r));
            await assertNotConsumed(unpaid.id, 'billet impayé');
        } finally {
            // Un billet payant VALIDE sans paiement viole l'invariant (b) du lot 2 : il est annulé après le test.
            await service.from('tickets').update({ status: 'ANNULE' }).eq('id', unpaid.id).eq('status', 'VALIDE');
        }
    });

    test('partenaire propriétaire : valid par la même route, données du billet renvoyées, ligne acceptée à son nom', async () => {
        const t = tickets[2];
        const r = await scan(partnerA, { eventId: evA.eventId, payload: await ticketPayload(String(t.id)) });
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.result, 'valid', show(r));
        assert.equal(typeof r.body.scan_id, 'string', 'scan_id renvoyé');
        assert.ok(r.body.ticket && JSON.stringify(r.body.ticket).includes(String(t.ticket_number)), `numéro du billet renvoyé à l’appelant autorisé : ${show(r)}`);
        assert.equal((await ticketRow(String(t.id))).status, 'UTILISE');
        const accepted = (await scansOf(String(t.id))).filter((s) => s.accepted === true);
        assert.equal(accepted.length, 1);
        assert.equal(accepted[0].scanner_id, partnerA.userId);
        assert.equal(accepted[0].method, 'QR');
    });

    test('administrateur : valid par la même route', async () => {
        const t = tickets[3];
        const admin = await signInAs('ADMIN');
        const r = await scan(asUser(admin.userId, admin.accessToken), { eventId: evA.eventId, payload: await ticketPayload(String(t.id)) });
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.result, 'valid', show(r));
        assert.equal((await ticketRow(String(t.id))).status, 'UTILISE');
    });
});

describe('4.3 Voie unique', () => {
    async function cookiesOf(user: Buyer) {
        const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
        });
        const { error } = await client.auth.signInWithPassword({ email: await gotrueEmail(user.email), password: STRONG_PASSWORD });
        assert.equal(error, null, `connexion : ${error?.message}`);
        return sessionCookies(client);
    }

    test('middleware : /api/controller/scan ouvert au PARTENAIRE, fermé au CLIENT', async () => {
        const asPartner = await callMiddleware('/api/controller/scan', await cookiesOf(partnerA));
        assert.ok(asPartner.passedThrough, `partenaire : HTTP ${asPartner.status} (le middleware doit laisser passer, la route vérifie la propriété)`);
        const asClient = await callMiddleware('/api/controller/scan', await cookiesOf(buyer));
        assert.ok(!asClient.passedThrough, 'un CLIENT ne passe pas');
        assert.equal(asClient.status, 403);
    });

    test('/api/tickets/verify supprimée et plus appelée nulle part', () => {
        assert.ok(!fs.existsSync(path.resolve(ROOT, 'app/api/tickets/verify')), 'app/api/tickets/verify doit être supprimée');
        const offenders: string[] = [];
        const walk = (dir: string) => {
            if (!fs.existsSync(path.resolve(ROOT, dir))) return;
            for (const e of fs.readdirSync(path.resolve(ROOT, dir), { withFileTypes: true })) {
                const rel = `${dir}/${e.name}`;
                if (e.isDirectory()) walk(rel);
                else if (/\.(ts|tsx)$/.test(e.name) && fs.readFileSync(path.resolve(ROOT, rel), 'utf8').includes('/api/tickets/verify')) offenders.push(rel);
            }
        };
        for (const dir of ['app', 'components', 'hooks', 'lib']) walk(dir);
        assert.deepEqual(offenders, [], `appels de /api/tickets/verify restants : ${offenders.join(', ')}`);
    });

    test('/partner/scan appelle /api/controller/scan et partage un composant de résultat avec le scanner contrôleur', () => {
        const scanImports = (file: string): string[] => {
            const src = fs.readFileSync(path.resolve(ROOT, file), 'utf8');
            return Array.from(src.matchAll(/from\s+['"]@\/(components\/scan\/[^'"]+|lib\/scan\/[^'"]+)['"]/g)).map((m) => m[1]);
        };
        const sources = (file: string): string => {
            const parts = [fs.readFileSync(path.resolve(ROOT, file), 'utf8')];
            for (const imp of scanImports(file)) {
                for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
                    const p = path.resolve(ROOT, `${imp}${ext}`);
                    if (fs.existsSync(p)) parts.push(fs.readFileSync(p, 'utf8'));
                }
            }
            return parts.join('\n');
        };
        const partnerPage = 'app/partner/scan/page.tsx';
        const partnerSrc = sources(partnerPage);
        assert.ok(partnerSrc.includes('/api/controller/scan'), `${partnerPage} doit appeler /api/controller/scan`);
        assert.ok(!partnerSrc.includes('/api/tickets/verify'), `${partnerPage} ne doit plus appeler /api/tickets/verify`);
        const shared = scanImports(partnerPage)
            .filter((m) => !m.endsWith('CameraQrScanner'))
            .filter((m) => scanImports('app/controller/scanner/page.tsx').includes(m));
        assert.ok(shared.length > 0, 'les deux pages de scan doivent importer le même composant ou module de résultat (components/scan ou lib/scan)');
    });
});
