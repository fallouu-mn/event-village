/**
 * Lot 9 ter, tâche 9t.9 (consigne 0.8, R93 ; contrat 5.B 9t.9, B.2.3 (2) F17, 4.2 B.3, B.5 points 5 à 7, décisions B-D15
 * et B-D16) — jauge, verrous d'écran et avertissement avant de quitter :
 *  - GET /api/partner/events/[id] sert `edit_locks` (RPC event_edit_locks : has_sales, engaged, active_quota,
 *    capacity_floor, capacity_removable, categories[{ id, has_sales }]), mêmes règles que le serveur (un billet de tout
 *    statut ou une réservation active) : un billet vendu puis remboursé garde le verrou, comme event_update ;
 *  - l'écran lit ses verrous dans edit_locks (plus dans sold_quantity, held_quantity), textes de la jauge corrigés,
 *    prix verrouillé expliqué sans texte vide ; avertissement avant de quitter par hooks/useUnsavedGuard.ts (liens
 *    internes interceptés en capture, fenêtre « Quitter sans enregistrer ? »).
 * Montage : partenaire neuve, événements créés par createDraftEvent puis avancés par les RPC ; achats par le parcours
 * complet, remboursement par la route de la partenaire, invitations par la route ; GET et PUT par la route importée
 * dynamiquement avec le jeton de la partenaire.
 *
 * Rouge avant correctif (S-E fix(9t.9), M07 F17 ; E-B fix(9t.9e)) : `edit_locks` absent de la réponse (cas 1 à 4) ;
 * EventForm.tsx:447 calcule le verrou depuis sold_quantity et held_quantity, :752 dit « la jauge peut seulement
 * augmenter », EventTicketing.tsx:165-167 idem, hooks/useUnsavedGuard.ts absent (cas 5 et 6). Le refus 409 du serveur
 * (cas 1, 3) est déjà vrai : il fixe la règle que edit_locks doit reproduire. La capture edition-quitter-sans-enregistrer
 * est écrite par R-E2E (B.6). after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CashoutService } from '../../lib/payments/cashout.service';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { routeContext } from './helpers';
import { categoryState, fakePay, newBuyer, service, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, cashoutsByKey, confirmCashouts, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { createEventInStatus, type DraftEvent } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import type { RouteResult } from './acces-helpers';

type Row = Record<string, unknown>;

const ROOT = process.cwd();
const EVENT_ROUTE = '../../app/api/partner/events/[id]/route';
const REFUND_ROUTE = '../../app/api/partner/events/[id]/tickets/[ticketId]/refund/route';
const INVITE_ROUTE = '../../app/api/partner/events/[id]/invitations/route';
const FORM = 'components/events/EventForm.tsx';
const TICKETING = 'components/events/EventTicketing.tsx';
const GUARD = 'hooks/useUnsavedGuard.ts';

const TWO: CategorySpec[] = [{ name: 'Standard', price: 5_000, total: 10 }, { name: 'VIP', price: 10_000, total: 5 }];

let partner: TestPartner;

after(async () => {
    await assertLot9terInvariants('evenements-verrous-ecran');
});

// ── Routes ─────────────────────────────────────────────────────────────────

async function getEvent(eventId: string): Promise<RouteResult> {
    const handler = await routeHandler(EVENT_ROUTE, 'GET', 'GET /api/partner/events/[id]');
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}`, 'GET', partner.accessToken), { params: Promise.resolve({ id: eventId }) });
}

async function editLocks(eventId: string): Promise<Row> {
    const res = await getEvent(eventId);
    assert.equal(res.status, 200, `GET de l'événement : ${show(res)}`);
    const locks = res.body.edit_locks;
    assert.ok(locks && typeof locks === 'object', `edit_locks servi par GET /api/partner/events/[id] (contrat 4.2 B.3, F17) : clés ${Object.keys(res.body).join(', ')}`);
    return locks as Row;
}

async function updatedAt(eventId: string): Promise<string> {
    const { data, error } = await service.from('events').select('updated_at').eq('id', eventId).single();
    assert.equal(error, null, `version de l'événement : ${error?.message}`);
    return String(data.updated_at);
}

async function put(eventId: string, patch: Row): Promise<RouteResult> {
    const handler = await routeHandler(EVENT_ROUTE, 'PUT', 'PUT /api/partner/events/[id]');
    const body = { patch, expected_updated_at: await updatedAt(eventId) };
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}`, 'PUT', partner.accessToken, body), { params: Promise.resolve({ id: eventId }) });
}

/** Remboursement d'un billet par la route de la partenaire ; versement envoyé puis confirmé. */
async function refund(eventId: string, ticketId: string): Promise<void> {
    const handler = await routeHandler(REFUND_ROUTE, 'POST', 'POST /api/partner/events/[id]/tickets/[ticketId]/refund');
    const res = await invoke(handler, jsonRequest(`/api/partner/events/${eventId}/tickets/${ticketId}/refund`, 'POST', partner.accessToken, { reason: 'Test 9 ter, verrous' }),
        routeContext({ id: eventId, ticketId }));
    for (const c of await cashoutsByKey(`REFUND-TKT-${ticketId}`)) {
        if (c.status === 'A_ENVOYER' && !c.blocked_reason) await CashoutService.send(String(c.id));
    }
    for (const c of await cashoutsByKey(`REFUND-TKT-${ticketId}`)) {
        if (c.samirpay_transaction_id) fakePay().setTransactionStatus(String(c.samirpay_transaction_id), 'SUCCESS');
    }
    await confirmCashouts();
    assert.equal(res.status, 200, `remboursement : ${show(res)}`);
}

function categoryLocks(locks: Row): Map<string, unknown> {
    assert.ok(Array.isArray(locks.categories), `edit_locks.categories : ${JSON.stringify(locks)}`);
    return new Map((locks.categories as Row[]).map((c) => [String(c.id), c.has_sales]));
}

describe('9t.9 (R93) : verrous servis par le serveur, mêmes règles qu\'event_update', () => {
    before(async () => {
        partner = await newPartner('verrous9t');
    });

    test('billet vendu puis remboursé : edit_locks dit has_sales comme le serveur, et le serveur refuse la catégorie d\'événement', async () => {
        const ev = await createEventInStatus(partner, 'verrous-remb', TWO, 'PUBLIE', { startsInHours: 240 });
        const buyer = await newBuyer('verrous-remb');
        const { tickets } = await buyConfirmed(buyer, ev, [['Standard', 1]]);
        await refund(ev.eventId, String(tickets[0].id));
        assert.equal((await categoryState(ev.categories.Standard.id)).sold, 0, 'précondition : sold_quantity revenu à 0 après le remboursement');

        const locks = await editLocks(ev.eventId);
        assert.equal(locks.has_sales, true, `un billet a été émis : has_sales vrai (règle du serveur) : ${JSON.stringify(locks)}`);
        const byCategory = categoryLocks(locks);
        assert.equal(byCategory.get(ev.categories.Standard.id), true, 'Standard : has_sales vrai');
        assert.equal(byCategory.get(ev.categories.VIP.id), false, 'VIP : has_sales faux');

        const refused = await put(ev.eventId, { category: 'FESTIVAL' });
        assert.equal(refused.status, 409, `catégorie d'événement après un billet émis : ${show(refused)}`);
        assert.equal(refused.body.code, 'LOCKED_AFTER_SALES', show(refused));
    });

    test('témoin : sans billet, has_sales faux et la catégorie d\'événement change', async () => {
        const ev = await createEventInStatus(partner, 'verrous-vide', TWO, 'PUBLIE', { startsInHours: 240 });
        const locks = await editLocks(ev.eventId);
        assert.equal(locks.has_sales, false, JSON.stringify(locks));
        assert.deepEqual(Array.from(categoryLocks(locks).values()), [false, false], 'aucune catégorie verrouillée');
        const res = await put(ev.eventId, { category: 'FESTIVAL' });
        assert.equal(res.status, 200, `catégorie d'événement sans billet : ${show(res)}`);
    });

    test('plancher de la jauge : capacity_floor = quotas actifs sans vente, max(vendus + en cours, quotas actifs) avec ventes ; le serveur suit le même plancher', async () => {
        const categories: CategorySpec[] = [
            { name: 'Standard', price: 5_000, total: 100 }, { name: 'VIP', price: 10_000, total: 50 }, { name: 'Ancienne', price: 2_000, total: 30, isActive: false },
        ];
        const ev = await createEventInStatus(partner, 'verrous-jauge', categories, 'PUBLIE', { startsInHours: 240, capacity: 200 });

        const empty = await editLocks(ev.eventId);
        assert.deepEqual({ active_quota: empty.active_quota, capacity_floor: empty.capacity_floor, capacity_removable: empty.capacity_removable, engaged: empty.engaged },
            { active_quota: 150, capacity_floor: 150, capacity_removable: true, engaged: 0 }, `sans vente : ${JSON.stringify(empty)}`);
        const below = await put(ev.eventId, { capacity: 149 });
        assert.equal(below.status, 409, show(below));
        assert.equal(below.body.code, 'CAPACITY_BELOW_QUOTAS', show(below));

        await buyConfirmed(await newBuyer('verrous-jauge-1'), ev, [['Standard', 1]]);
        await buyConfirmed(await newBuyer('verrous-jauge-2'), ev, [['VIP', 1]]);
        const sold = await editLocks(ev.eventId);
        assert.deepEqual({ engaged: sold.engaged, capacity_floor: sold.capacity_floor, capacity_removable: sold.capacity_removable, has_sales: sold.has_sales },
            { engaged: 2, capacity_floor: 150, capacity_removable: false, has_sales: true }, `après 2 achats : ${JSON.stringify(sold)}`);
        const atFloor = await put(ev.eventId, { capacity: 150 });
        assert.equal(atFloor.status, 200, `jauge au plancher : ${show(atFloor)}`);
    });

    test('invitation seule sur un événement VALIDE : has_sales vrai', async () => {
        const ev = await createEventInStatus(partner, 'verrous-invit', TWO, 'VALIDE', { startsInHours: 240 });
        const handler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/events/[id]/invitations');
        const guest = await newBuyer('verrous-invite');
        const invited = await invoke(handler, jsonRequest(`/api/partner/events/${ev.eventId}/invitations`, 'POST', partner.accessToken,
            { category_id: ev.categories.VIP.id, phones: [guest.phoneE164], quantity: 1 }), routeContext({ id: ev.eventId }));
        assert.equal(invited.status, 200, `invitation : ${show(invited)}`);
        const locks = await editLocks(ev.eventId);
        assert.equal(locks.has_sales, true, `un billet offert verrouille comme une vente : ${JSON.stringify(locks)}`);
        assert.equal(categoryLocks(locks).get(ev.categories.VIP.id), true, 'VIP : has_sales vrai');
    });
});

// ── Écrans (sources) ───────────────────────────────────────────────────────

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1');
}

/** Normalisation de textes-techniques-9bis.test.ts:58 (X1) : apostrophes et espaces insécables simples. */
function norm(s: string): string {
    return s.replace(/[’‘]/g, '\'').replace(/[  ]/g, ' ');
}

function read(rel: string): string {
    const file = path.join(ROOT, rel);
    assert.ok(fs.existsSync(file), `${rel} absent`);
    return norm(stripComments(fs.readFileSync(file, 'utf8')));
}

/** Déclaration `const <name> = …;` (une instruction). */
function declaration(src: string, name: string): string {
    const m = new RegExp(`\\bconst\\s+${name}\\s*=([^;]*);`).exec(src);
    assert.ok(m, `déclaration de ${name}`);
    return m[1];
}

describe('9t.9 (R93) : écrans de modification', () => {
    test('les verrous de l\'écran viennent du serveur et les textes de la jauge suivent la règle', () => {
        const form = read(FORM);
        const sales = declaration(form, 'salesStarted');
        assert.ok(!/sold_quantity|held_quantity/.test(sales), `salesStarted ne lit plus sold_quantity ni held_quantity : ${sales.trim()}`);
        assert.match(sales, /editLocks/, `salesStarted lit editLocks : ${sales.trim()}`);
        for (const t of [
            'Catégorie d\'événement : verrouillée dès qu\'un billet est vendu, réservé ou offert. Jauge : elle ne peut alors plus être retirée ni descendre sous les billets vendus et en cours de paiement, et jamais sous la somme des quantités des catégories actives.',
            'Des billets sont vendus ou réservés : la jauge ne peut plus être retirée ni descendre sous',
            'Facultative. Elle ne descend pas sous la somme des quantités des catégories actives :',
            'Facultative. La somme des quantités des catégories actives ne peut pas la dépasser.',
        ]) assert.ok(form.includes(t), `${FORM} : texte de B.5 absent : « ${t} »`);
        assert.ok(!form.includes('peut seulement augmenter'), `${FORM} : « la jauge peut seulement augmenter » retiré`);

        const ticketing = read(TICKETING);
        const body = /function\s+hasSales\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\}/.exec(ticketing);
        assert.ok(body, `${TICKETING} : fonction hasSales`);
        assert.match(body[1], /\bhas_sales\b/, `hasSales lit has_sales (edit_locks.categories) : ${body[1].trim()}`);
        assert.ok(ticketing.includes('Prix verrouillé : des billets ont déjà été émis pour cette catégorie. Créez une autre catégorie pour un nouveau tarif.'),
            `${TICKETING} : texte du prix verrouillé sans vente comptée (B.5 point 6)`);
    });

    test('avertissement avant de quitter : hooks/useUnsavedGuard.ts (sans JSX, beforeunload, liens en capture) et sa fenêtre dans EventForm', () => {
        assert.ok(fs.existsSync(path.join(ROOT, GUARD)), `${GUARD} absent (B.5 point 7)`);
        const guard = read(GUARD);
        assert.match(guard, /export\s+function\s+useUnsavedGuard\s*\(/, 'useUnsavedGuard exporté');
        assert.ok(!/<[A-Z][A-Za-z]*[\s/>]/.test(guard), `${GUARD} sans JSX`);
        assert.match(guard, /['"]beforeunload['"]/, 'beforeunload tant que des modifications ne sont pas enregistrées');
        assert.match(guard, /addEventListener\s*\(\s*['"]click['"]\s*,\s*[\w.]+\s*,\s*(?:true|\{[^}]*\bcapture\s*:\s*true[^}]*\})\s*\)/,
            'écouteur click en capture sur le document (liens internes)');

        const form = read(FORM);
        assert.match(form, /from\s+['"]@\/hooks\/useUnsavedGuard['"]/, `${FORM} importe @/hooks/useUnsavedGuard`);
        for (const t of ['Quitter sans enregistrer ?', 'Quitter sans enregistrer', 'Rester sur la page']) {
            assert.ok(form.includes(t), `${FORM} : « ${t} »`);
        }
        const ticketing = read(TICKETING);
        assert.match(ticketing, /\bonDirtyChange\??\s*:/, `${TICKETING} : EventTicketingManager déclare onDirtyChange`);
    });
});
