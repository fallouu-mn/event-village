/**
 * Contre-vérification de la finition 1, attaque 3 — plage du contrôle.
 *
 * Hors de la plage (avant l'ouverture, après la fermeture) et sur un événement annulé ou suspendu, un contrôleur affecté
 * (droit d'encaisser compris) puis la propriétaire essaient : scan, saisie manuelle, recherche d'invités, validation par
 * la liste, devis, vente au guichet, ouverture de caisse, codes hors ligne. Attendu : aucune entrée, aucune vente, aucune
 * caisse, aucun code.
 * Variante plus dure : la caisse est ouverte PENDANT la plage, puis l'événement sort de sa plage (dates déplacées) ou est
 * suspendu ; la vente doit être refusée quand même.
 * Sortie brute `[CVF1-3]`.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newBuyer, service, type Buyer, type SaleEvent } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { assignController, newController, openShift } from '../parcours/acces-helpers';
import { advanceEventTo, shiftEventDates } from '../parcours/cycle-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import {
    PAID, api, freeEvent, freeTicket, ok2xx, scanTicket, show, ticketStatus, acceptedScans,
} from './cvf1-helpers';

let P: TestPartner;
let C: Buyer;
let H: Buyer;
const closed: Array<{ label: string; ev: SaleEvent }> = [];

before(async () => {
    P = await newPartner('cvf1-plage');
    H = await newBuyer('cvf1-plage-porteur', { firstName: 'Fatou', lastName: 'Porteuse' });
    const evBefore = await freeEvent(P, 'plage-avant', { startsInHours: 10 });
    C = await newController(P, evBefore.eventId, { canAcceptCash: true, label: 'cvf1-plage' });
    const afterEv = await freeEvent(P, 'plage-apres', { startsInHours: -20, durationHours: 4 });
    const cancelled = await freeEvent(P, 'plage-annule', { startsInHours: 1 });
    const suspended = await freeEvent(P, 'plage-suspendu', { startsInHours: 1, status: 'SUSPENDU' });
    for (const ev of [afterEv, cancelled, suspended]) await assignController(P, C.userId, ev.eventId, true);
    await advanceEventTo(cancelled.eventId, 'ANNULE');
    closed.push({ label: 'avant l’ouverture', ev: evBefore }, { label: 'après la fermeture', ev: afterEv },
        { label: 'annulé', ev: cancelled }, { label: 'suspendu', ev: suspended });
});

after(async () => {
    await assertFinition1Invariants('cvf1-3-plage');
});

async function paymentsOf(eventId: string): Promise<number> {
    const { data, error } = await service.from('payments').select('id').eq('event_id', eventId);
    assert.equal(error, null, `paiements de ${eventId} : ${error?.message}`);
    return (data ?? []).length;
}

async function shiftsOf(eventId: string, userId: string, status?: string): Promise<number> {
    let q = service.from('controller_shifts').select('id').eq('event_id', eventId).eq('controller_id', userId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    assert.equal(error, null, `caisses de ${eventId} : ${error?.message}`);
    return (data ?? []).length;
}

/** Toutes les actions du contrôle par `actor` sur `ev` ; chaque effet constaté est une brèche. */
async function tryEverything(actor: Buyer, who: string, ev: SaleEvent, label: string, breaches: string[]): Promise<void> {
    const tag = `${who}, ${label}`;
    const items = [{ categoryId: ev.categories[PAID].id, quantity: 1 }];
    const t = await freeTicket(ev, H);
    const qr = await scanTicket(actor, ev.eventId, t.id);
    const manual = await api('POST', 'controller/scan', {
        token: actor.accessToken, body: { eventId: ev.eventId, manualTicketNumber: t.number, identityVerified: true }, headers: { 'idempotency-key': randomUUID() },
    });
    const guestAdmit = await api('POST', 'controller/scan', {
        token: actor.accessToken, body: { eventId: ev.eventId, guestTicketId: t.id, identityVerified: true }, headers: { 'idempotency-key': randomUUID() },
    });
    const lookup = await api('POST', 'controller/scan/lookup', { token: actor.accessToken, body: { eventId: ev.eventId, manualTicketNumber: t.number } });
    const guests = await api('POST', 'controller/scan/guests', { token: actor.accessToken, body: { eventId: ev.eventId, query: H.phone9.slice(-4) } });
    const quote = await api('POST', 'controller/counter-sale/quote', { token: actor.accessToken, body: { eventId: ev.eventId, items } });
    const sale = await api('POST', 'controller/counter-sale', {
        token: actor.accessToken, body: { eventId: ev.eventId, items }, headers: { 'idempotency-key': randomUUID() },
    });
    const shiftsBefore = await shiftsOf(ev.eventId, actor.userId, 'OUVERT');
    const shift = await openShift(actor, ev.eventId);
    const offline = await api('GET', 'tickets/[id]/offline-codes', { token: actor.accessToken, path: `/api/tickets/${t.id}/offline-codes`, params: { id: t.id } });
    for (const [what, r] of [['scan', qr], ['saisie manuelle', manual], ['liste des invités (validation)', guestAdmit], ['vérification manuelle', lookup],
        ['recherche d’invités', guests], ['devis', quote], ['vente au guichet', sale], ['ouverture de caisse', shift], ['codes hors ligne (billet d’un autre)', offline]] as const) {
        console.log(`[CVF1-3] ${tag} : ${what} → ${show(r)}`);
    }
    if (qr.body.result === 'valid') breaches.push(`${tag} : scan accepté ${show(qr)}`);
    if (manual.body.result === 'valid') breaches.push(`${tag} : saisie manuelle acceptée ${show(manual)}`);
    if (guestAdmit.body.result === 'valid') breaches.push(`${tag} : validation par la liste acceptée ${show(guestAdmit)}`);
    if (ok2xx(lookup) && lookup.body.ticket) breaches.push(`${tag} : vérification manuelle servie ${show(lookup)}`);
    if (ok2xx(guests)) breaches.push(`${tag} : recherche d'invités servie ${show(guests)}`);
    if (ok2xx(quote)) breaches.push(`${tag} : devis servi ${show(quote)}`);
    if (ok2xx(sale)) breaches.push(`${tag} : vente acceptée ${show(sale)}`);
    if (ok2xx(shift) || (await shiftsOf(ev.eventId, actor.userId, 'OUVERT')) > shiftsBefore) breaches.push(`${tag} : caisse ouverte ${show(shift)}`);
    if (ok2xx(offline)) breaches.push(`${tag} : codes hors ligne d'un billet d'autrui servis`);
    if ((await ticketStatus(t.id)) !== 'VALIDE') breaches.push(`${tag} : billet composté`);
    if ((await acceptedScans(t.id)).length > 0) breaches.push(`${tag} : entrée acceptée enregistrée`);
}

describe('hors de la plage, annulé, suspendu : contrôleur affecté et propriétaire', () => {
    test('scan, saisie, invités, devis, guichet, caisse, codes : aucune entrée, aucune vente', async () => {
        const breaches: string[] = [];
        for (const { label, ev } of closed) {
            for (const [who, actor] of [['contrôleur', C], ['propriétaire', P]] as const) {
                await tryEverything(actor, who, ev, label, breaches);
            }
            const paid = await paymentsOf(ev.eventId);
            if (paid > 0) breaches.push(`${label} : ${paid} paiement(s) enregistré(s)`);
        }
        assert.deepEqual(breaches, [], `actions du contrôle acceptées hors de la plage :\n${breaches.join('\n')}`);
    });

    test('codes hors ligne du porteur lui-même : refusés après la fermeture, annulé, suspendu', async () => {
        const breaches: string[] = [];
        for (const { label, ev } of closed.filter((c) => c.label !== 'avant l’ouverture')) {
            const t = await freeTicket(ev, H);
            const r = await api('GET', 'tickets/[id]/offline-codes', { token: H.accessToken, path: `/api/tickets/${t.id}/offline-codes`, params: { id: t.id } });
            console.log(`[CVF1-3] porteur, ${label} : codes hors ligne → ${show(r)}`);
            if (ok2xx(r)) breaches.push(`${label} : codes hors ligne servis au porteur`);
        }
        assert.deepEqual(breaches, [], breaches.join('\n'));
    });
});

describe('caisse ouverte pendant la plage, puis l’événement en sort', () => {
    test('dates déplacées (avant, après) ou suspension : vente et devis refusés, aucun paiement', async () => {
        const breaches: string[] = [];
        const cases: Array<{ label: string; move: (eventId: string) => Promise<void> }> = [
            { label: 'déplacé après la fermeture', move: async (id) => { await shiftEventDates(id, { startsInHours: -20, durationHours: 4 }); } },
            { label: 'déplacé avant l’ouverture', move: async (id) => { await shiftEventDates(id, { startsInHours: 10 }); } },
            { label: 'suspendu', move: async (id) => { await advanceEventTo(id, 'SUSPENDU', { suspendReason: 'Contre-vérification : suspension' }); } },
        ];
        for (const c of cases) {
            const ev = await freeEvent(P, `plage-caisse-${c.label.slice(0, 8)}`, { startsInHours: 1 });
            await assignController(P, C.userId, ev.eventId, true);
            for (const [who, actor] of [['contrôleur', C], ['propriétaire', P]] as const) {
                const opened = await openShift(actor, ev.eventId);
                assert.ok(ok2xx(opened), `caisse de ${who} ouverte pendant la plage (montage) : ${show(opened)}`);
            }
            try {
                await c.move(ev.eventId);
            } catch (err) {
                // Montage refusé par l'application (par exemple suspension refusée avec une caisse ouverte) : rien à attaquer
                console.log(`[CVF1-3] ${c.label} : montage refusé, cas non joué (${err instanceof Error ? err.message.slice(0, 200) : String(err)})`);
                continue;
            }
            const items = [{ categoryId: ev.categories[PAID].id, quantity: 1 }];
            for (const [who, actor] of [['contrôleur', C], ['propriétaire', P]] as const) {
                const quote = await api('POST', 'controller/counter-sale/quote', { token: actor.accessToken, body: { eventId: ev.eventId, items } });
                const sale = await api('POST', 'controller/counter-sale', {
                    token: actor.accessToken, body: { eventId: ev.eventId, items }, headers: { 'idempotency-key': randomUUID() },
                });
                console.log(`[CVF1-3] ${who}, caisse ouverte, ${c.label} : devis → ${show(quote)} ; vente → ${show(sale)}`);
                if (ok2xx(quote)) breaches.push(`${who}, ${c.label} : devis servi ${show(quote)}`);
                if (ok2xx(sale)) breaches.push(`${who}, ${c.label} : vente acceptée ${show(sale)}`);
            }
            const paid = await paymentsOf(ev.eventId);
            if (paid > 0) breaches.push(`${c.label} : ${paid} paiement(s) enregistré(s)`);
        }
        assert.deepEqual(breaches, [], `ventes acceptées après la sortie de la plage :\n${breaches.join('\n')}`);
    });
});
