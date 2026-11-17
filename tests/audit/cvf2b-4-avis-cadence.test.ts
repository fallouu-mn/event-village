/**
 * Contre-vérification de la finition 2b, attaque 4 — avis de changement de date et de lieu aux détenteurs de billets.
 * Règles (consigne E-27, E-28 ; rapport de la finition 2b, § 1 et § 3.3) : le serveur prévient les détenteurs de tout
 * changement de date, d'heure, de lieu, de ville, d'adresse ou de repère (> 200 m), que l'écran ait montré la fenêtre
 * « Prévenir » ou non ; au plus un SMS par détenteur et par heure glissante (changements regroupés) ; à moins d'une heure
 * du début, l'avis part tout de suite, deux SMS au plus. Comportement sûr affirmé ici : jamais plus de deux SMS par
 * détenteur dans une même heure glissante, et un seul hors de la dernière heure.
 *  a. Fenêtre « Prévenir » évitée : PUT direct sans aperçu (les détenteurs sont prévenus quand même) ; drapeaux de
 *     silence dans le corps ; retour au brouillon ou en attente pour modifier sans prévenir.
 *  b. Deux onglets (et plus) sur la même version, enregistrements simultanés (Promise.all) : un seul passe, un seul SMS.
 *  c. Onglets obstinés (rechargent et recommencent) qui alternent date, lieu, ville et petits pas du repère, sur deux
 *     heures simulées : un SMS par heure glissante.
 *  d. Un onglet enregistre pendant que l'envoyeur envoie le SMS précédent (ligne SENDING, pas encore marquée SENT) :
 *     le nouvel avis doit attendre l'heure.
 *  e. Dernière heure : rafales parallèles, puis report du début au-delà d'une heure : deux SMS au plus dans l'heure.
 *  f. Dernière heure : deux SMS partis, puis report du début de quelques minutes (on attend une minute réelle) : le
 *     plafond de la dernière heure ne doit pas repartir de zéro.
 * Horloge : l'envoyeur passe à l'heure réelle ou plus tard (dispatchAt, jamais dans le passé), limité aux événements de
 * la suite ; détenteurs neufs à numéros tirés au hasard ; comptage par la boîte d'envoi (cvf2b-34-helpers). Les SMS
 * EVENT_CHANGED sont indispensables (ESSENTIAL) : ni plage de silence, ni budget des SMS optionnels du jour simulé.
 * Vert = attaque bloquée ; rouge = trou. Sortie brute `[CVF2B-4]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { service, type Buyer } from '../parcours/paiement-helpers';
import { createTimedEvent } from '../parcours/acces-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { dispatchAt } from '../parcours/notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { getFakes } from '../fakes';
import { formatMTargetPhoneNumber } from '../../lib/sms/mtarget-http.adapter';
import { freeTicket } from './cvf1-helpers';
import {
    DAKAR, FREE, brief, endPatch, holderSms, letters, live, maxPerSlidingHour, published, putFresh, putRetry,
    putVersioned, sentTimes, show, startOf, startPatch, statusOf, transition, versionOf,
    type Reply, type Row, type SmsRow,
} from './cvf2b-34-helpers';

const MIN = 60_000;
const HOUR = 3_600_000;
let P: TestPartner;

before(async () => {
    P = await newPartner('cvf2b4');
});

after(async () => {
    await assertFinition1Invariants('cvf2b-4-avis-cadence');
});

function log(line: string): void {
    console.log(`[CVF2B-4] ${line}`);
}

const minutes = (n: number) => new Date(Date.now() + n * MIN);

/**
 * Changement n° i d'une série qui alterne date (fin + 5 min), lieu, repère (petits pas de 150 m vers le nord, cumulés)
 * et ville. Le patch se fabrique au moment de l'envoi (fin relue en base).
 */
function change(eventId: string, i: number, tag: string): () => Promise<Row> | Row {
    switch (i % 4) {
        case 0: return () => endPatch(eventId, 5);
        case 1: return () => ({ location: `Salle ${tag} ${letters(4)}` });
        case 2: return () => ({ latitude: DAKAR.latitude + 0.00135 * (1 + Math.floor(i / 4)), longitude: DAKAR.longitude });
        default: return () => ({ city: Math.floor(i / 4) % 2 === 0 ? 'Rufisque' : 'Mbour' });
    }
}

/** `workers` onglets en parallèle, chacun `each` changements successifs (recharge et recommence sur conflit). */
async function burst(eventId: string, workers: number, each: number, tag: string, offset = 0): Promise<Reply[]> {
    const replies = await Promise.all(Array.from({ length: workers }, async (_, w) => {
        const out: Reply[] = [];
        for (let k = 0; k < each; k++) {
            const i = offset + w * each + k;
            const { reply, attempts, patch } = await putRetry(P.accessToken, eventId, change(eventId, i, tag));
            log(`onglet ${w + 1}, changement ${k + 1} ${JSON.stringify(patch)} (${attempts} essai(s)) → ${show(reply).slice(0, 160)} ; tenu=${String(reply.body.sms_notice_held)} à ${String(reply.body.sms_notice_at)}`);
            out.push(reply);
        }
        return out;
    }));
    const flat = replies.flat();
    const failed = flat.filter((r) => r.status !== 200).map((r) => show(r).slice(0, 200));
    assert.deepEqual(failed, [], `enregistrements refusés (montage de l'attaque) :\n${failed.join('\n')}`);
    return flat;
}

async function dump(label: string, eventId: string, holders: Buyer[]): Promise<SmsRow[][]> {
    const all: SmsRow[][] = [];
    for (const h of holders) {
        const rows = await holderSms(eventId, h.userId);
        log(`${label} — détenteur ${h.phoneE164} : ${brief(rows)} ; faux MTarget (ce processus) : ${getFakes().sms.deliveredTo(h.phoneE164).length}`);
        all.push(rows);
    }
    return all;
}

// ── a. Fenêtre « Prévenir » évitée ──────────────────────────────────────────

describe('a. fenêtre « Prévenir » évitée : le serveur prévient quand même', () => {
    test('PUT direct d’un changement de lieu, sans aperçu : chaque détenteur reçoit l’avis', async () => {
        const { ev, holders } = await published(P, 'sans-apercu', 48, 2);
        const r = await putFresh(P.accessToken, ev.eventId, { location: `Salle ${letters()}` });
        log(`PUT direct (sans notice-preview) → ${show(r)}`);
        assert.equal(r.status, 200, show(r));
        const pending = await dump('après le PUT direct', ev.eventId, holders);
        for (const [i, rows] of pending.entries()) {
            const sms = live(rows);
            assert.equal(sms.length, 1, `détenteur ${i + 1} non prévenu par SMS après un PUT direct : ${brief(rows)}`);
            assert.ok(JSON.stringify(sms[0].template_data.changed_fields).includes('location'), brief(rows));
        }
        await dispatchAt(minutes(11), { eventIds: [ev.eventId] });
        const sent = await dump('après l’envoyeur (+11 min)', ev.eventId, holders);
        for (const [i, rows] of sent.entries()) {
            assert.equal(rows.filter((x) => x.status === 'SENT').length, 1, `détenteur ${i + 1} : avis non parti : ${brief(rows)}`);
        }
    });

    test('drapeaux de silence dans le corps ou le patch : refusés, ou les détenteurs sont prévenus quand même', async () => {
        const { ev, holders } = await published(P, 'silence', 48, 1);
        const before = (await service.from('events').select('location').eq('id', ev.eventId).single()).data?.location;
        const attempts: Array<[string, Row, Row]> = [
            ['corps : notify false', { location: `Salle ${letters()}` }, { notify: false }],
            ['corps : silent, skip_notice, sms false', { location: `Salle ${letters()}` }, { silent: true, skip_notice: true, sms: false }],
            ['corps : confirmed false (fenêtre annulée)', { location: `Salle ${letters()}` }, { confirmed: false }],
            ['patch : notify_holders false', { location: `Salle ${letters()}`, notify_holders: false }, {}],
            ['patch : notify_version recopiée', { location: `Salle ${letters()}`, notify_version: 0 }, {}],
            ['patch : status inchangé', { location: `Salle ${letters()}`, status: 'PUBLIE' }, {}],
        ];
        const accepted: string[] = [];
        for (const [label, patch, extra] of attempts) {
            const r = await putVersioned(P.accessToken, ev.eventId, patch, await versionOf(ev.eventId), extra);
            log(`${label} → ${show(r).slice(0, 220)}`);
            if (r.status < 400) accepted.push(label);
        }
        const now = (await service.from('events').select('location').eq('id', ev.eventId).single()).data?.location;
        const rows = await holderSms(ev.eventId, holders[0].userId);
        log(`lieu avant ${before} ; après ${now} ; acceptés ${JSON.stringify(accepted)} ; SMS : ${brief(rows)}`);
        if (now !== before) {
            const sms = live(rows);
            assert.ok(sms.length >= 1 && sms.some((x) => JSON.stringify(x.template_data.changed_fields).includes('location')),
                `lieu changé (${before} → ${now}) par un corps « silencieux » sans avis au détenteur : ${brief(rows)}`);
        } else {
            assert.deepEqual(accepted, [], 'réponse 2xx sans changement enregistré');
        }
    });

    test('retour au brouillon ou en attente pour modifier sans prévenir : refusé', async () => {
        const pub = await published(P, 'retour-publie', 48, 1);
        const val = await createTimedEvent(P.partnerId, 'cvf2b-retour-valide', [{ name: FREE, price: 0, total: 20 }], { startsInHours: 48, durationHours: 4, status: 'VALIDE' });
        await freeTicket(val, pub.holders[0]);
        const accepted: string[] = [];
        for (const [label, eventId, from] of [['PUBLIE', pub.ev.eventId, 'PUBLIE'], ['VALIDE', val.eventId, 'VALIDE']] as const) {
            for (const to of ['BROUILLON', 'EN_ATTENTE']) {
                const r = await transition(P.accessToken, eventId, to);
                log(`${label} → ${to} : ${show(r)}`);
                if (r.status < 400) accepted.push(`${label} → ${to} : ${show(r)}`);
                assert.equal(await statusOf(eventId), from, `${label} : statut changé par ${to}`);
            }
        }
        assert.deepEqual(accepted, [], `retour en arrière accepté (les modifications d'un brouillon ne préviennent personne) :\n${accepted.join('\n')}`);
    });
});

// ── b. Onglets sur la même version ──────────────────────────────────────────

describe('b. six onglets sur la même version, enregistrements simultanés', () => {
    test('un seul enregistrement passe (409 EDIT_CONFLICT pour les autres), un seul SMS par détenteur', async () => {
        const { ev, holders } = await published(P, 'meme-version', 48, 1);
        const version = await versionOf(ev.eventId);
        const tag = letters();
        const patches: Row[] = await Promise.all(Array.from({ length: 6 }, async (_, i) => change(ev.eventId, i, tag)()));
        const replies = await Promise.all(patches.map((patch) => putVersioned(P.accessToken, ev.eventId, patch, version)));
        replies.forEach((r, i) => log(`onglet ${i + 1} ${JSON.stringify(patches[i])} → ${show(r).slice(0, 160)}`));
        const ok = replies.filter((r) => r.status === 200);
        const others = replies.filter((r) => r.status !== 200).map((r) => `${r.status} ${String(r.body.code)}`);
        assert.equal(ok.length, 1, `enregistrements acceptés sur la même version : ${ok.length}`);
        assert.ok(others.every((o) => o === '409 EDIT_CONFLICT'), `refus inattendus : ${JSON.stringify(others)}`);
        const [rows] = await dump('six onglets', ev.eventId, holders);
        assert.equal(live(rows).length, 1, `SMS mis en file pour un seul détenteur : ${brief(rows)}`);
    });
});

// ── c. Onglets obstinés sur deux heures ─────────────────────────────────────

describe('c. onglets obstinés : date, lieu, ville et petits pas du repère en alternance', () => {
    test('quatre onglets × trois changements, trois fois en deux heures simulées : un SMS par heure glissante', async () => {
        const { ev, holders } = await published(P, 'obstines', 48, 2);
        const tag = letters();
        // 1. Première rafale : tout dans la fenêtre de 10 minutes
        await burst(ev.eventId, 4, 3, tag, 0);
        let rows = await dump('rafale 1', ev.eventId, holders);
        for (const [i, r] of rows.entries()) {
            assert.equal(live(r).length, 1, `détenteur ${i + 1} : plusieurs SMS en file dans la première fenêtre : ${brief(r)}`);
        }
        await dispatchAt(minutes(11), { eventIds: [ev.eventId] });
        rows = await dump('envoyeur à +11 min', ev.eventId, holders);
        const first = rows[0].find((x) => x.status === 'SENT');
        assert.ok(first?.sent_at, `précondition : premier avis parti : ${brief(rows[0])}`);
        const sentAt1 = Date.parse(String(first!.sent_at));

        // 2. Deuxième rafale dans l'heure qui suit le premier SMS
        await burst(ev.eventId, 4, 3, tag, 12);
        rows = await dump('rafale 2 (dans l’heure)', ev.eventId, holders);
        for (const [i, r] of rows.entries()) {
            assert.equal(live(r).length, 1, `détenteur ${i + 1} : nouvel SMS en file moins d'une heure après le premier : ${brief(r)}`);
        }
        await dispatchAt(new Date(sentAt1 + 30 * MIN), { eventIds: [ev.eventId] });
        rows = await dump('envoyeur à départ + 30 min', ev.eventId, holders);
        for (const [i, r] of rows.entries()) {
            assert.equal(live(r).length, 1, `détenteur ${i + 1} : SMS parti avant l'heure : ${brief(r)}`);
        }
        await dispatchAt(new Date(sentAt1 + 61 * MIN), { eventIds: [ev.eventId] });
        rows = await dump('envoyeur à départ + 61 min', ev.eventId, holders);
        const second = rows[0].filter((x) => x.status === 'SENT')[1];
        assert.ok(second?.sent_at, `précondition : avis regroupé parti à l'heure : ${brief(rows[0])}`);
        const sentAt2 = Date.parse(String(second.sent_at));

        // 3. Troisième rafale juste après le deuxième SMS
        await burst(ev.eventId, 2, 2, tag, 24);
        await dispatchAt(new Date(sentAt2 + 30 * MIN), { eventIds: [ev.eventId] });
        rows = await dump('rafale 3, envoyeur à départ 2 + 30 min', ev.eventId, holders);
        for (const [i, r] of rows.entries()) {
            const times = sentTimes(r);
            assert.equal(live(r).length, 2, `détenteur ${i + 1} : ${live(r).length} SMS au lieu de 2 sur la période : ${brief(r)}`);
            assert.ok(maxPerSlidingHour(times) <= 1, `détenteur ${i + 1} : ${maxPerSlidingHour(times)} SMS dans une même heure : ${brief(r)}`);
        }
    });
});

// ── d. Enregistrement pendant l'envoi du SMS précédent ──────────────────────

describe('d. un onglet enregistre pendant que l’envoyeur envoie le SMS précédent', () => {
    test('nouvel avis pendant que le premier SMS est en cours d’envoi (SENDING) : pas de second SMS dans l’heure', async () => {
        const { ev, holders } = await published(P, 'pendant-envoi', 48, 1);
        const h = holders[0];
        const first = await putFresh(P.accessToken, ev.eventId, await endPatch(ev.eventId, 15));
        assert.equal(first.status, 200, `premier changement (montage) : ${show(first)}`);
        const fake = getFakes().sms;
        const target = formatMTargetPhoneNumber(h.phoneE164);
        let attack: Reply | null = null;
        let during = '';
        // Fournisseur lent : pendant l'appel au fournisseur pour ce détenteur (ligne réservée SENDING, marquage en fin de
        // lot), un second onglet enregistre un changement de lieu.
        fake.sendSms = async (to: string, message: string) => {
            if (attack === null && formatMTargetPhoneNumber(to) === target) {
                during = brief(await holderSms(ev.eventId, h.userId));
                attack = await putFresh(P.accessToken, ev.eventId, { location: `Salle ${letters()}` });
            }
            return Object.getPrototypeOf(fake).sendSms.call(fake, to, message);
        };
        try {
            await dispatchAt(minutes(11), { eventIds: [ev.eventId] });
        } finally {
            Reflect.deleteProperty(fake, 'sendSms');
        }
        const attackReply = attack as Reply | null;
        log(`ligne pendant l'appel au fournisseur : ${during}`);
        log(`enregistrement pendant l'envoi → ${attackReply ? show(attackReply) : 'non joué'}`);
        assert.ok(attackReply, 'le SMS du détenteur n’est pas passé par ce processus (envoyé ailleurs ?) : attaque non jouée');
        assert.equal(attackReply.status, 200, `changement pendant l'envoi (montage) : ${show(attackReply)}`);
        assert.match(during, /SENDING/, `précondition : ligne SENDING pendant l'appel au fournisseur : ${during}`);
        let rows = await holderSms(ev.eventId, h.userId);
        log(`après le premier passage : ${brief(rows)}`);
        const sent1 = rows.find((x) => x.status === 'SENT');
        assert.ok(sent1?.sent_at, `précondition : premier SMS parti : ${brief(rows)}`);
        await dispatchAt(minutes(22), { eventIds: [ev.eventId] });
        rows = await holderSms(ev.eventId, h.userId);
        log(`après l'envoyeur à +22 min : ${brief(rows)} ; faux MTarget : ${getFakes().sms.deliveredTo(h.phoneE164).length}`);
        const times = sentTimes(rows);
        assert.ok(maxPerSlidingHour(times) <= 1,
            `TROU : ${maxPerSlidingHour(times)} SMS au même détenteur en moins d'une heure (changement enregistré pendant l'envoi du précédent, non retenu) : ${brief(rows)}`);
        const early = rows.filter((x) => x.status === 'PENDING' && Date.parse(x.due_at) < Date.parse(String(sent1!.sent_at)) + HOUR);
        assert.deepEqual(early.map((x) => x.due_at), [], `SMS en attente dû moins d'une heure après le premier : ${brief(rows)}`);
    });
});

// ── e. Dernière heure : rafales et report au-delà d'une heure ───────────────

describe('e. dernière heure : rafales parallèles, puis report du début au-delà d’une heure', () => {
    test('deux SMS au plus dans l’heure ; après le report, l’avis suivant attend l’heure', async () => {
        const { ev, holders } = await published(P, 'derniere-heure', 40 / 60, 1);
        const h = holders[0];
        const tag = letters();
        for (let k = 0; k < 4; k++) {
            await burst(ev.eventId, 3, 1, tag, k * 3);
            await dispatchAt(new Date(), { eventIds: [ev.eventId] });
            log(`dernière heure, rafale ${k + 1} : ${brief(await holderSms(ev.eventId, h.userId))}`);
        }
        let rows = await holderSms(ev.eventId, h.userId);
        assert.ok(live(rows).length <= 2, `${live(rows).length} SMS dans la dernière heure (au plus 2) : ${brief(rows)}`);

        const later = await putRetry(P.accessToken, ev.eventId, async () => startPatch(Date.now() + 3 * HOUR));
        log(`report du début à +3 h → ${show(later.reply).slice(0, 220)}`);
        assert.equal(later.reply.status, 200, `report (montage) : ${show(later.reply)}`);
        const next = await putRetry(P.accessToken, ev.eventId, () => endPatch(ev.eventId, 5));
        log(`changement après le report → ${show(next.reply).slice(0, 220)}`);
        assert.equal(next.reply.status, 200, show(next.reply));
        await dispatchAt(new Date(), { eventIds: [ev.eventId] });
        rows = await holderSms(ev.eventId, h.userId);
        log(`après le report et l'envoyeur : ${brief(rows)}`);
        assert.ok(live(rows).length <= 2, `SMS parti tout de suite après le report : ${brief(rows)}`);
        const last = Math.max(...sentTimes(rows), Date.now());
        await dispatchAt(new Date(last + 61 * MIN), { eventIds: [ev.eventId] });
        rows = await holderSms(ev.eventId, h.userId);
        log(`envoyeur une heure après le dernier SMS : ${brief(rows)}`);
        assert.ok(maxPerSlidingHour(sentTimes(rows)) <= 2, `${maxPerSlidingHour(sentTimes(rows))} SMS dans une même heure : ${brief(rows)}`);
    });
});

// ── f. Dernière heure : report de quelques minutes ──────────────────────────

describe('f. dernière heure : report du début de quelques minutes pour rouvrir le plafond', () => {
    test('deux SMS partis, une minute d’attente, début reporté de ~20 min : aucun troisième SMS dans la foulée', async () => {
        const { ev, holders } = await published(P, 'report-plafond', 40 / 60, 1);
        const h = holders[0];
        for (let k = 1; k <= 3; k++) {
            const r = await putRetry(P.accessToken, ev.eventId, () => endPatch(ev.eventId, 10));
            log(`dernière heure, changement ${k} → ${show(r.reply).slice(0, 200)}`);
            assert.equal(r.reply.status, 200, show(r.reply));
            await dispatchAt(new Date(), { eventIds: [ev.eventId] });
        }
        let rows = await holderSms(ev.eventId, h.userId);
        log(`avant le report : ${brief(rows)}`);
        assert.equal(live(rows).length, 2, `précondition : deux SMS partis, le troisième écarté : ${brief(rows)}`);
        const lastSent = Math.max(...live(rows).map((x) => Date.parse(String(x.sent_at ?? x.created_at))));

        // Nouveau début M (minute pleine) tel que M − 1 h tombe juste après le dernier SMS ; on attend que M soit à moins
        // d'une heure (la modification reste « dans la dernière heure »). Attente réelle d'environ une minute.
        const oldStart = await startOf(ev.eventId);
        const M = Math.ceil((lastSent + HOUR + 1_000) / MIN) * MIN;
        assert.ok(M > oldStart, `précondition : M (${new Date(M).toISOString()}) après le début actuel (${new Date(oldStart).toISOString()})`);
        const wait = M - HOUR + 5_000 - Date.now();
        log(`dernier SMS ${new Date(lastSent).toISOString()} ; début ${new Date(oldStart).toISOString()} → ${new Date(M).toISOString()} ; attente ${wait} ms`);
        if (wait > 0) await sleep(wait);

        const postpone = await putRetry(P.accessToken, ev.eventId, () => startPatch(M));
        log(`report du début → ${show(postpone.reply).slice(0, 260)}`);
        assert.equal(postpone.reply.status, 200, `report (montage) : ${show(postpone.reply)}`);
        await dispatchAt(new Date(), { eventIds: [ev.eventId] });
        for (let k = 1; k <= 2; k++) {
            const r = await putRetry(P.accessToken, ev.eventId, () => endPatch(ev.eventId, 10));
            log(`après le report, changement ${k} → ${show(r.reply).slice(0, 260)}`);
            assert.equal(r.reply.status, 200, show(r.reply));
            await dispatchAt(new Date(), { eventIds: [ev.eventId] });
        }
        rows = await holderSms(ev.eventId, h.userId);
        const span = sentTimes(rows);
        log(`après le report : ${brief(rows)} ; faux MTarget : ${getFakes().sms.deliveredTo(h.phoneE164).length}`);
        assert.ok(live(rows).length <= 2 && maxPerSlidingHour(span) <= 2,
            `TROU : ${live(rows).length} SMS au même détenteur en ${span.length > 1 ? Math.round((span[span.length - 1] - span[0]) / 1000) : 0} s (plafond de 2 rouvert par un report du début) : ${brief(rows)}`);
    });
});
