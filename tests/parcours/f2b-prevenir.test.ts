/**
 * Finition 2b (D, E-27) — fenêtre « Prévenir » avant d'enregistrer un changement de date, d'heure, de lieu ou de repère
 * (> 200 m de la position annoncée) : « {n} détenteurs seront prévenus par SMS {à HH:MM | tout de suite}. » avec
 * « Enregistrer et prévenir » / « Annuler » ; l'heure affichée est l'heure réelle d'envoi. Encadré de modification
 * réécrit ; l'aide « les détenteurs de billets seront prévenus » dès Validé et sous la date et l'heure de fin.
 *  a. Aperçu (POST …/notice-preview) d'un changement de fin : 1 SMS, heure = maintenant + 10 minutes ; RIEN n'est écrit
 *     (événement et version, avis, retenue, journal) ; l'enregistrement qui suit rend le même nombre de SMS.
 *  b. Avis retenu : un avis parti, l'aperçu d'un nouveau changement rend « retenu », heure = départ + 1 h.
 *  c. Dernière heure : « tout de suite ».
 *  d. Repère déplacé de 50 m : aucun SMS (pas de fenêtre) ; de 330 m : 1 SMS.
 *  e. Dès Validé : un invité (numéro sans compte) compte parmi les détenteurs prévenus.
 *  f. Mêmes refus que l'enregistrement : version périmée (409 EDIT_CONFLICT), autre organisatrice (même statut et même
 *     code que PUT), fiche suspendue (403 PARTNER_SUSPENDED) ; rien n'est écrit.
 *  g. Écran : aide dès VALIDE et sous la date et l'heure de fin, aperçu demandé avant l'enregistrement, fenêtre (texte,
 *     boutons), encadré réécrit (phrase du repère inchangée), bilan à l'heure réelle.
 * Rouge avant le correctif : route et fonction absentes ; écran sans fenêtre ; aide absente à Validé et sous la fin.
 * Sortie brute `[F2B-D4]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent } from './acces-helpers';
import { dispatchAt } from './notif-helpers';
import { randomSenegalPhone } from './helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, FREE, freeTicket, setFiche, show, type Reply, type Row } from '../audit/cvf1-helpers';
import { putEvent, versionOf } from '../audit/cvf2a-helpers';

const ROOT = process.cwd();
const DAKAR = { latitude: 14.6928, longitude: -17.4467 };
let P: TestPartner;
let Other: TestPartner;

before(async () => {
    P = await newPartner('f2b-prevenir');
    Other = await newPartner('f2b-prevenir-autre');
});

after(async () => {
    await assertFinition1Invariants('f2b-prevenir');
});

async function preview(token: string, eventId: string, patch: Row, version?: string): Promise<Reply> {
    return api('POST', 'partner/events/[id]/notice-preview', {
        token, path: `/api/partner/events/${eventId}/notice-preview`, params: { id: eventId },
        body: { patch, expected_updated_at: version ?? await versionOf(eventId) },
    });
}

async function published(label: string, startsInHours: number, status = 'PUBLIE'): Promise<{ ev: SaleEvent; holder: Buyer }> {
    const ev = await createTimedEvent(P.partnerId, `f2b-${label}`, [{ name: FREE, price: 0, total: 20 }], { startsInHours, durationHours: 4, status });
    const { error } = await service.from('events').update(DAKAR).eq('id', ev.eventId);
    assert.equal(error, null, `repère (montage) : ${error?.message}`);
    const holder = await newBuyer(`f2b-${label}-detenteur`);
    await freeTicket(ev, holder);
    return { ev, holder };
}

/** Fin décalée de `minutes` (date et heure de Dakar, UTC). */
async function endPatch(eventId: string, minutes: number): Promise<Row> {
    const { data, error } = await service.from('events').select('end_date, end_time').eq('id', eventId).single();
    assert.equal(error, null, error?.message);
    const end = new Date(`${data.end_date}T${String(data.end_time).slice(0, 8)}Z`).getTime() + minutes * 60_000;
    const iso = new Date(end).toISOString();
    return { end_date: iso.slice(0, 10), end_time: iso.slice(11, 16) };
}

/** État écrit de l'événement : ligne, avis, retenue, journal. */
async function written(eventId: string): Promise<string> {
    const [ev, outbox, notices, audit] = await Promise.all([
        service.from('events').select('updated_at, end_date, end_time, latitude, longitude, location').eq('id', eventId).single(),
        service.from('notification_outbox').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        service.from('event_place_notices').select('event_id, held_fields, last_sent_at, announced_latitude').eq('event_id', eventId),
        service.from('audit_logs').select('id', { count: 'exact', head: true }).eq('object_id', eventId),
    ]);
    for (const r of [ev, outbox, notices, audit]) assert.equal(r.error, null, r.error?.message);
    return JSON.stringify({ ev: ev.data, outbox: outbox.count, notices: notices.data, audit: audit.count });
}

describe('a. aperçu d’un changement de fin : nombre et heure réelle, rien d’écrit', () => {
    test('1 SMS dans 10 minutes ; événement, avis, retenue et journal inchangés ; l’enregistrement rend le même nombre', async () => {
        const { ev } = await published('prevenir-fenetre', 48);
        const patch = await endPatch(ev.eventId, 30);
        const beforeState = await written(ev.eventId);
        const t0 = Date.now();
        const r = await preview(P.accessToken, ev.eventId, patch);
        console.log(`[F2B-D4] aperçu (fin décalée) → ${show(r)}`);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.sms_recipients, 1, show(r));
        assert.equal(r.body.sms_notice_immediate, false, show(r));
        assert.equal(r.body.sms_notice_held, false, show(r));
        const at = Date.parse(String(r.body.sms_notice_at));
        assert.ok(at >= t0 + 9 * 60_000 && at <= Date.now() + 11 * 60_000, `heure = maintenant + 10 minutes : ${r.body.sms_notice_at}`);
        assert.ok(!('event' in r.body), 'l’aperçu ne rend pas la ligne de l’événement');
        assert.equal(await written(ev.eventId), beforeState, 'l’aperçu a écrit quelque chose');

        const saved = await putEvent(P.accessToken, ev.eventId, patch);
        console.log(`[F2B-D4] enregistrement → ${show(saved).slice(0, 300)}`);
        assert.equal(saved.status, 200, show(saved));
        assert.equal(saved.body.sms_recipients, r.body.sms_recipients, 'même nombre de SMS que l’aperçu');
        assert.ok(Math.abs(Date.parse(String(saved.body.sms_notice_at)) - at) < 120_000, 'heure de l’enregistrement proche de celle de l’aperçu');
    });
});

describe('b. avis retenu par la cadence d’une heure', () => {
    test('un avis parti : l’aperçu rend « retenu », heure = départ + 1 h', async () => {
        const { ev, holder } = await published('prevenir-retenu', 48);
        const first = await putEvent(P.accessToken, ev.eventId, await endPatch(ev.eventId, 15));
        assert.equal(first.status, 200, show(first));
        await dispatchAt(new Date(Date.now() + 11 * 60_000), { eventIds: [ev.eventId] });
        const { data: sent, error } = await service.from('notification_outbox').select('sent_at')
            .eq('event_id', ev.eventId).eq('recipient_user_id', holder.userId).eq('type', 'EVENT_CHANGED').eq('channel', 'SMS').eq('status', 'SENT');
        assert.equal(error, null, error?.message);
        assert.equal(sent?.length, 1, 'précondition : premier avis parti');
        const sentAt = Date.parse(String(sent![0].sent_at));
        const beforeState = await written(ev.eventId);
        const r = await preview(P.accessToken, ev.eventId, await endPatch(ev.eventId, 15));
        console.log(`[F2B-D4] aperçu retenu → ${show(r)}`);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.sms_notice_held, true, show(r));
        assert.equal(r.body.sms_recipients, 1, show(r));
        assert.ok(Math.abs(Date.parse(String(r.body.sms_notice_at)) - (sentAt + 3_600_000)) < 2_000, `heure = départ + 1 h : ${r.body.sms_notice_at}`);
        assert.equal(await written(ev.eventId), beforeState, 'l’aperçu a écrit quelque chose');
    });
});

describe('c. dernière heure : tout de suite', () => {
    test('début dans 40 minutes : l’aperçu dit « tout de suite »', async () => {
        const { ev } = await published('prevenir-urgent', 40 / 60);
        const r = await preview(P.accessToken, ev.eventId, await endPatch(ev.eventId, 10));
        console.log(`[F2B-D4] aperçu dernière heure → ${show(r)}`);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.sms_notice_immediate, true, show(r));
        assert.equal(r.body.sms_recipients, 1, show(r));
    });
});

describe('d. repère : plus de 200 m de la position annoncée', () => {
    test('50 m : aucun SMS ; 330 m : 1 SMS', async () => {
        const { ev } = await published('prevenir-repere', 48);
        const near = await preview(P.accessToken, ev.eventId, { latitude: DAKAR.latitude + 0.00045, longitude: DAKAR.longitude });
        const far = await preview(P.accessToken, ev.eventId, { latitude: DAKAR.latitude + 0.003, longitude: DAKAR.longitude });
        console.log(`[F2B-D4] repère 50 m → ${show(near)} ; 330 m → ${show(far)}`);
        assert.equal(near.status, 200, show(near));
        assert.equal(near.body.sms_recipients, 0, show(near));
        assert.equal(far.status, 200, show(far));
        assert.equal(far.body.sms_recipients, 1, show(far));
        assert.ok(JSON.stringify(far.body.changed_fields).includes('position'), show(far));
    });
});

describe('e. dès Validé : les invités sont des détenteurs', () => {
    test('événement validé, un invité par numéro : l’aperçu compte 1 SMS', async () => {
        const ev = await createTimedEvent(P.partnerId, 'f2b-prevenir-valide', [{ name: FREE, price: 0, total: 20 }], { startsInHours: 48, durationHours: 4, status: 'VALIDE' });
        const inv = await api('POST', 'partner/events/[id]/invitations', {
            token: P.accessToken, path: `/api/partner/events/${ev.eventId}/invitations`, params: { id: ev.eventId },
            body: { category_id: ev.categories[FREE].id, phones: [randomSenegalPhone('77')], quantity: 1 },
        });
        assert.ok(inv.status < 300, `invitation (montage) : ${show(inv)}`);
        const r = await preview(P.accessToken, ev.eventId, await endPatch(ev.eventId, 30));
        console.log(`[F2B-D4] validé, un invité → ${show(r)}`);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.sms_recipients, 1, show(r));
    });
});

describe('f. mêmes refus que l’enregistrement, rien d’écrit', () => {
    let ev: SaleEvent;
    before(async () => {
        ({ ev } = await published('prevenir-refus', 48));
    });

    test('version périmée : 409 EDIT_CONFLICT', async () => {
        const beforeState = await written(ev.eventId);
        const r = await preview(P.accessToken, ev.eventId, await endPatch(ev.eventId, 30), '2000-01-01T00:00:00.000Z');
        console.log(`[F2B-D4] version périmée → ${show(r)}`);
        assert.equal(r.status, 409, show(r));
        assert.equal(r.body.code, 'EDIT_CONFLICT', show(r));
        assert.equal(await written(ev.eventId), beforeState);
    });

    test('autre organisatrice : même statut et même code que la modification', async () => {
        const patch = await endPatch(ev.eventId, 30);
        const beforeState = await written(ev.eventId);
        const r = await preview(Other.accessToken, ev.eventId, patch);
        const put = await putEvent(Other.accessToken, ev.eventId, patch);
        console.log(`[F2B-D4] autre organisatrice → aperçu ${show(r)} ; modification ${show(put)}`);
        assert.ok(r.status >= 400 && r.status < 500, show(r));
        assert.equal(r.status, put.status);
        assert.equal(r.body.code, put.body.code);
        assert.equal(await written(ev.eventId), beforeState);
    });

    test('fiche suspendue : 403 PARTNER_SUSPENDED', async () => {
        const patch = await endPatch(ev.eventId, 30);
        const beforeState = await written(ev.eventId);
        await setFiche(P.partnerId, 'SUSPENDU');
        try {
            const r = await preview(P.accessToken, ev.eventId, patch);
            console.log(`[F2B-D4] fiche suspendue → ${show(r)}`);
            assert.equal(r.status, 403, show(r));
            assert.equal(r.body.code, 'PARTNER_SUSPENDED', show(r));
        } finally {
            await setFiche(P.partnerId, 'VALIDE');
        }
        assert.equal(await written(ev.eventId), beforeState);
    });
});

describe('g. écran', () => {
    const form = fs.readFileSync(path.join(ROOT, 'components/events/EventForm.tsx'), 'utf8');

    test('aide « les détenteurs de billets seront prévenus » dès Validé, sous la date et l’heure de fin', () => {
        assert.match(form, /const WITH_HOLDERS = new Set\(\['VALIDE', 'PUBLIE', 'SUSPENDU'\]\)/);
        assert.match(form, /id="ev-end_date"[\s\S]{0,400}hint=\{hint\('Facultative\. Pour une soirée qui passe minuit, indiquez la date du lendemain\.', true\)\}/);
        assert.match(form, /id="ev-end_time"[\s\S]{0,400}hint=\{hint\('Facultative ; avec une heure de fin, la date de fin est demandée\.', true\)\}/);
    });

    test('aperçu demandé avant l’enregistrement ; fenêtre « Prévenir » (texte, boutons)', () => {
        assert.match(form, /\/notice-preview/);
        assert.ok(form.includes('`${formatInteger(count)} détenteurs seront prévenus par SMS ${when}.`'), 'phrase de la fenêtre');
        assert.ok(form.includes("const when = immediate || !at ? 'tout de suite' : `à ${formatTime(at)}`;"), 'heure réelle ou « tout de suite »');
        assert.match(form, /confirmLabel="Enregistrer et prévenir"/);
        assert.match(form, /title="Prévenir les détenteurs de billets"[\s\S]{0,120}cancelLabel="Annuler"/);
    });

    test('encadré réécrit, phrase du repère inchangée ; bilan à l’heure réelle', () => {
        assert.ok(form.includes('<li>Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS.</li>'));
        assert.ok(!form.includes('Modifications encadrées après la validation'), 'ancien titre de l’encadré retiré');
        assert.ok(form.includes('Un seul SMS par heure : les changements faits dans l’heure partent ensemble.'));
        assert.match(form, /smsNoticeAt: typeof data\.sms_notice_at === 'string'/);
        assert.ok(form.includes("'1 SMS part tout de suite.'"));
    });
});
