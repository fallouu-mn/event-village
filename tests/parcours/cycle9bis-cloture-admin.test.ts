/**
 * Lot 9 bis, tâche 20 (R3 ; contrat 5.20, B46, 11.1 N6 et N7) — clôture par l'admin d'un événement SUSPENDU dont la
 * fin est passée : ligne `SUSPENDU → TERMINE` (ADMIN, motif obligatoire, canal TRANSITION), fin passée exigée
 * (`EVENT_NOT_ENDED`), permission `events.write` ; `event_actions` propose « Clore l’événement » au lieu de
 * « Réactiver » une fois la fin passée ; dans la même transaction, `EVENT_CLOSED_HOLDER` (SMS sans motif) à chaque
 * porteur d'un billet VALIDE ou UTILISE, et `EVENT_CLOSED_BY_ADMIN` (motif) à la partenaire.
 *
 * Rouge avant correctif : aucune ligne SUSPENDU → TERMINE (M/20261102000003:57-63) : `TRANSITION_NOT_ALLOWED` ; sans
 * motif, même refus au lieu de `REASON_REQUIRED` ; non fini, même refus au lieu de `EVENT_NOT_ENDED` ; `event_actions`
 * d'un SUSPENDU fini rend `[PUBLIE]` (M/20261102000003:519-523) ; aucun type EVENT_CLOSED_* au registre.
 * Verts dès l'écriture (témoins, signalés) : refus de la partenaire et de l'admin sans `events.write` (aujourd'hui
 * refusés faute de ligne : le garde-fou est le cas 1, rouge) ; actions d'un SUSPENDU non fini `[PUBLIE]`.
 * SMS : textes exacts de la section 11.1 (titre ≤ 30 caractères GSM-7, motif ≤ 40), envoyeur appelé sur les seules
 * lignes de l'événement, comptage par numéro neuf.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { newController, scan, ticketPayload, ticketRow } from './acces-helpers';
import {
    advanceEventTo, assertRpcOk, createDraftEvent, eventHistory, eventStatus, rpcTransition, shiftEventDates,
    type DraftEvent, type RpcBody,
} from './cycle-helpers';
import { dispatchAt, outboxRows, smsMark, smsTo, type TestAdmin } from './notif-helpers';
import { issueFreeTicket, newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;

const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 5_000, total: 20 }, { name: 'Gratuit', price: 0, total: 20 }];
const SUSPENSION = 'Verification des autorisations';
/** Motif de clôture : ≤ 40 caractères, GSM-7 sans caractère translittéré (SMS exact). */
const CLOSING_REASON = 'Litige regle avec la prefecture';

let partner: TestPartner;
let writer: TestAdmin;
let reader: TestAdmin;
let superId: string;
let appUrl: string;

before(async () => {
    partner = await newPartner('cloture-admin');
    writer = await newAdminWith(['events.read', 'events.write'], { label: 'cloture-ecrit' });
    reader = await newAdminWith(['events.read'], { label: 'cloture-lit' });
    superId = await superadminId();
    appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    assert.ok(appUrl, 'NEXT_PUBLIC_APP_URL définie (.env.test)');
});

after(async () => {
    await assertLot9bisInvariants('cycle9bis-cloture-admin');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

let seq = 0;

/** Titre court et GSM-7 (≤ 30 caractères) : cité sans troncature par les SMS. */
function shortTitle(): string {
    seq += 1;
    return `Gala clos ${String(Date.now() % 100_000).padStart(5, '0')}${seq}`.slice(0, 30);
}

/** Événement PUBLIE dans 1 h (fenêtre de scan ouverte), puis SUSPENDU par le SUPERADMIN. */
async function suspendedEvent(label: string): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, label, CATEGORIES, { title: shortTitle(), startsInHours: 1, durationHours: 4 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

async function suspend(ev: DraftEvent): Promise<void> {
    assertRpcOk(await rpcTransition(ev.eventId, superId, 'SUSPENDU', SUSPENSION), `suspension de ${ev.title}`);
}

/** Fin passée depuis 2 h (début il y a 6 h, durée 4 h). */
async function endedTwoHoursAgo(ev: DraftEvent): Promise<void> {
    await shiftEventDates(ev.eventId, { startsInHours: -6, durationHours: 4 });
}

/** Refus métier sans effet : `{ ok: false }` (code attendu si donné), statut et historique inchangés. */
async function expectRefused(ev: DraftEvent, actorId: string, label: string, code: string | null, reason?: string): Promise<RpcBody> {
    const before = (await eventHistory(ev.eventId)).length;
    const call = await rpcTransition(ev.eventId, actorId, 'TERMINE', reason);
    assert.equal(call.error, null, `${label} : refus métier attendu, pas une erreur Postgres : ${call.error?.message}`);
    assert.ok(call.data, `${label} : réponse vide`);
    assert.equal(call.data.ok, false, `${label} : refus attendu, reçu ${JSON.stringify(call.data)}`);
    if (code !== null) assert.equal(call.data.code, code, `${label} : code ${code} attendu, reçu ${JSON.stringify(call.data)}`);
    assert.equal(await eventStatus(ev.eventId), 'SUSPENDU', `${label} : toujours SUSPENDU`);
    assert.equal((await eventHistory(ev.eventId)).length, before, `${label} : aucune ligne d'historique`);
    return call.data;
}

interface ActionsBody { ok?: boolean; status?: string; actions?: Array<{ to?: string; reason_required?: boolean; label?: string }> }

async function eventActions(eventId: string, actorId: string): Promise<ActionsBody> {
    const { data, error } = await service.rpc('event_actions', { p: { event_id: eventId, actor_id: actorId } });
    assert.equal(error, null, `event_actions : ${error?.message}`);
    return (data ?? {}) as ActionsBody;
}

function transitionTargets(body: ActionsBody): string[] {
    return (body.actions ?? []).map((a) => String(a.to)).filter((to) => to !== 'ANNULE').sort();
}

// ── 1. Clôture d'un SUSPENDU fini ──────────────────────────────────────────

describe('R3 — SUSPENDU fini depuis 2 h : clôture par un admin events.write, avis aux porteurs et à la partenaire', () => {
    let ev: DraftEvent;
    let payer: Buyer;
    let entered: Buyer;
    let outsider: Buyer;
    let closed: RpcBody | null = null;

    before(async () => {
        ev = await suspendedEvent('cloture-fini');
        payer = await newBuyer('cloture-payeur');
        await buyConfirmed(payer, ev, [['Standard', 1]]);
        entered = await newBuyer('cloture-entre');
        const freeId = await issueFreeTicket(ev.eventId, ev.categories.Gratuit.id, entered);
        const ctrl = await newController(partner, ev.eventId, { label: 'cloture' });
        const scanned = await scan(ctrl, { eventId: ev.eventId, payload: await ticketPayload(freeId) });
        assert.equal(scanned.body.result, 'valid', `précondition : entrée validée avant la suspension (${JSON.stringify(scanned.body)})`);
        assert.equal((await ticketRow(freeId)).status, 'UTILISE', 'précondition : billet UTILISE');
        outsider = await newBuyer('cloture-tiers');
        await suspend(ev);
        await endedTwoHoursAgo(ev);
    });

    test('event_transition TERMINE avec motif → ok, TERMINE, historique (SUSPENDU → TERMINE, admin, ADMIN, TRANSITION, motif)', async () => {
        const call = await rpcTransition(ev.eventId, writer.userId, 'TERMINE', CLOSING_REASON);
        closed = assertRpcOk(call, 'R3 : clôture d’un SUSPENDU fini par un admin events.write (aujourd’hui TRANSITION_NOT_ALLOWED, aucune ligne)');
        assert.equal(await eventStatus(ev.eventId), 'TERMINE', 'statut relu');
        const rows = await eventHistory(ev.eventId);
        const last = rows[rows.length - 1];
        assert.deepEqual(
            { old: last.old_status, next: last.new_status, actor: last.actor_id, role: last.actor_role, channel: last.channel, reason: last.reason },
            { old: 'SUSPENDU', next: 'TERMINE', actor: writer.userId, role: 'ADMIN', channel: 'TRANSITION', reason: CLOSING_REASON },
            'ligne d’historique de la clôture',
        );
    });

    test('même transaction : EVENT_CLOSED_HOLDER (SMS) à chaque porteur VALIDE ou UTILISE, EVENT_CLOSED_BY_ADMIN (SMS, motif) à la partenaire ; textes exacts', async () => {
        assert.ok(closed, 'précondition : clôture acceptée (cas précédent)');
        const holderSms = await outboxRows({ type: 'EVENT_CLOSED_HOLDER', eventId: ev.eventId, channel: 'SMS' });
        assert.deepEqual(holderSms.map((r) => r.recipient_user_id).sort(), [payer.userId, entered.userId].sort(),
            `un SMS EVENT_CLOSED_HOLDER par porteur (payé VALIDE, entré UTILISE), rien pour un tiers : ${JSON.stringify(holderSms.map((r) => [r.recipient_user_id, r.status]))}`);
        assert.ok(!holderSms.some((r) => r.recipient_user_id === outsider.userId), 'aucun avis au compte sans billet');
        const partnerSms = await outboxRows({ type: 'EVENT_CLOSED_BY_ADMIN', eventId: ev.eventId, userId: partner.userId, channel: 'SMS' });
        assert.equal(partnerSms.length, 1, `un SMS EVENT_CLOSED_BY_ADMIN à la partenaire : ${JSON.stringify(partnerSms.map((r) => r.status))}`);
        const partnerInApp = await outboxRows({ type: 'EVENT_CLOSED_BY_ADMIN', eventId: ev.eventId, userId: partner.userId, channel: 'IN_APP' });
        assert.equal(partnerInApp.length, 1, 'un avis in-app EVENT_CLOSED_BY_ADMIN à la partenaire');
        assert.deepEqual(await outboxRows({ type: 'EVENT_CLOSED_HOLDER', eventId: ev.eventId, userId: partner.userId }), [], 'la partenaire ne reçoit pas l’avis des porteurs');

        const payerMark = smsMark(payer.phoneE164);
        const partnerMark = smsMark(partner.phoneE164);
        const mine = holderSms.filter((r) => r.recipient_user_id === payer.userId).map((r) => r.id);
        await dispatchAt(new Date(), { ids: [...mine, partnerSms[0].id] });
        assert.deepEqual(smsTo(payer.phoneE164, payerMark).map((m) => m.message),
            [`Event Village : ${ev.title} est clos après sa suspension, sans annulation ni remboursement automatique. ${appUrl}/tickets`],
            'SMS du porteur : texte exact (11.1 N6), sans le motif');
        assert.deepEqual(smsTo(partner.phoneE164, partnerMark).map((m) => m.message),
            [`Event Village : ${ev.title} est clos par l'équipe Event Village après sa suspension. Motif : ${CLOSING_REASON}.`],
            'SMS de la partenaire : texte exact (11.1 N7), avec le motif');
    });
});

// ── 2. Refus ───────────────────────────────────────────────────────────────

describe('R3 — refus : motif, fin non passée, rôle, permission', () => {
    test('sans motif (ou motif de 2 caractères) → REASON_REQUIRED, rien n’est écrit', async () => {
        const ev = await suspendedEvent('cloture-sans-motif');
        await suspend(ev);
        await endedTwoHoursAgo(ev);
        await expectRefused(ev, writer.userId, 'sans motif', 'REASON_REQUIRED');
        await expectRefused(ev, writer.userId, 'motif de 2 caractères', 'REASON_REQUIRED', 'ok');
    });

    test('SUSPENDU dont la fin n’est pas passée → EVENT_NOT_ENDED (réactivez-le ou annulez-le), rien n’est écrit', async () => {
        const ev = await suspendedEvent('cloture-en-cours');
        await suspend(ev);
        await shiftEventDates(ev.eventId, { startsInHours: -1, durationHours: 4 });
        await expectRefused(ev, writer.userId, 'fin dans 3 h', 'EVENT_NOT_ENDED', CLOSING_REASON);
    });

    test('témoins : la partenaire propriétaire et un admin sans events.write ne clôturent pas (refus sans effet)', async () => {
        const ev = await suspendedEvent('cloture-roles');
        await suspend(ev);
        await endedTwoHoursAgo(ev);
        await expectRefused(ev, partner.userId, 'partenaire propriétaire', null, CLOSING_REASON);
        await expectRefused(ev, reader.userId, 'admin events.read seul', null, CLOSING_REASON);
    });
});

// ── 3. Actions proposées ───────────────────────────────────────────────────

describe('R3 — event_actions : « Clore l’événement » une fois la fin passée, plus « Réactiver »', () => {
    test('SUSPENDU fini → [TERMINE] (motif obligatoire, libellé « Clore… ») ; SUSPENDU non fini → [PUBLIE] (témoin)', async () => {
        const ended = await suspendedEvent('actions-fini');
        await suspend(ended);
        await endedTwoHoursAgo(ended);
        const body = await eventActions(ended.eventId, writer.userId);
        assert.notEqual(body.ok, false, `event_actions refusé : ${JSON.stringify(body)}`);
        assert.equal(body.status, 'SUSPENDU', JSON.stringify(body));
        assert.deepEqual(transitionTargets(body), ['TERMINE'], `SUSPENDU fini : clore, plus réactiver (aujourd’hui [PUBLIE]) : ${JSON.stringify(body.actions)}`);
        const close = (body.actions ?? []).find((a) => a.to === 'TERMINE') as Row;
        assert.equal(close.reason_required, true, `motif obligatoire : ${JSON.stringify(close)}`);
        assert.match(String(close.label), /^Clore l[’']événement$/, `libellé « Clore l’événement » : ${JSON.stringify(close)}`);

        const running = await suspendedEvent('actions-en-cours');
        await suspend(running);
        const witness = await eventActions(running.eventId, writer.userId);
        assert.deepEqual(transitionTargets(witness), ['PUBLIE'], `SUSPENDU à venir : réactiver seulement : ${JSON.stringify(witness.actions)}`);
    });
});
