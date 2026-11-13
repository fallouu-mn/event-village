/**
 * Lot 9 quinquies, D1 — SMS aux administrateurs pour ce qui attend leur action (décision du chef de projet).
 *
 * Déclencheurs : candidature de partenaire, dossier complété après refus, événement soumis. Destinataires : SUPERADMIN et
 * ADMIN qui peuvent agir (partners.validate ; events.write). Premier SMS dans la minute ; ce qui arrive ensuite pour le
 * même admin est regroupé (jamais plus d'un SMS par 30 minutes et par admin) ; rien de 22 h à 8 h (Dakar), le regroupement
 * de la nuit part à 8 h. Textes : « Event Village : nouvelle demande de partenaire "{société}". Vérifiez son dossier :
 * {lien}/admin/dashboard » ; regroupé : « Event Village : {n} demande(s) de partenaire et {m} événement(s) attendent votre
 * validation : {lien}/admin/dashboard » (« » remplacés par " : hors GSM-7).
 *
 * Tests de la consigne :
 *  1. une candidature (route réelle, déclencheur) → un SMS au SUPERADMIN dans la minute ; l'ADMIN sans partners.validate
 *     ne reçoit rien ; l'ADMIN qui a partners.validate reçoit ;
 *  2. trois candidatures en 10 minutes → deux SMS (le premier, puis le regroupé à +30 min) ;
 *  3. candidature à 23 h → SMS à 8 h, rien avant ;
 *  4. événement soumis → SMS à l'ADMIN qui a events.write, rien à celui qui n'a que partners.validate.
 * Les cas 2 à 4 appellent notif_admin_review_sms avec une horloge simulée future (jamais dans le passé) et la liste des
 * admins de la suite (only_admin_ids : l'éligibilité reste exigée), puis l'envoyeur à ces heures, sur leurs seules lignes.
 *
 * Rouge avant correctif : type ADMIN_REVIEW_SMS, fonction et déclencheurs absents (migration 20261112000001).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { inspect } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { randomEmail, randomSenegalPhone, registerPartnerTwoStep, STRONG_PASSWORD, uploadRegistrationDocuments } from './helpers';
import { addMinutes, dakarAt, dakarDay, dispatchAt, newAdmin, outboxRows, type OutboxRow, type TestAdmin } from './notif-helpers';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

let superadmin: TestAdmin;
let validator: TestAdmin;
let reader: TestAdmin;
let eventsWriter: TestAdmin;

before(async () => {
    superadmin = await newAdmin('d1-sa', [], { role: 'SUPERADMIN' });
    validator = await newAdmin('d1-valide', ['partners.validate', 'partners.read']);
    reader = await newAdmin('d1-lecture', ['partners.read', 'events.read']);
    eventsWriter = await newAdmin('d1-evenements', ['events.write', 'events.read']);
});

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-sms-admins');
});

function admins(): TestAdmin[] {
    return [superadmin, validator, reader, eventsWriter];
}

async function reviewRows(admin: TestAdmin): Promise<OutboxRow[]> {
    return outboxRows({ type: 'ADMIN_REVIEW_SMS', userId: admin.userId });
}

function smsCount(admin: TestAdmin): number {
    return getFakes().sms.messagesTo(admin.phoneE164).length;
}

function smsSince(admin: TestAdmin, since: number): string[] {
    return getFakes().sms.messagesTo(admin.phoneE164).slice(since).map((m) => m.message);
}

/** Appel direct de la fonction de la migration, horloge simulée, admins de la suite seulement. */
async function addReview(kind: 'PARTNER_NEW' | 'PARTNER_RESUBMITTED' | 'EVENT_SUBMITTED', now: Date, company?: string): Promise<number> {
    return inspect(async (c) => {
        const r = await c.query<{ n: number }>('SELECT public.notif_admin_review_sms($1::jsonb) AS n', [JSON.stringify({
            kind, ref: randomUUID(), company, now: now.toISOString(), only_admin_ids: admins().map((a) => a.userId),
        })]);
        return Number(r.rows[0].n);
    });
}

async function dispatchFor(admin: TestAdmin, now: Date): Promise<void> {
    const ids = (await reviewRows(admin)).filter((r) => r.status === 'PENDING').map((r) => r.id);
    if (ids.length > 0) await dispatchAt(now, { ids });
}

const singleText = (company: string): string =>
    `Event Village : nouvelle demande de partenaire "${company}". Vérifiez son dossier : ${APP_URL}/admin/dashboard`;

describe('D1 — SMS aux administrateurs pour ce qui attend leur action', () => {
    test('une candidature (route réelle) : SMS au SUPERADMIN dans la minute, à l\'ADMIN qui a partners.validate, rien à celui qui ne l\'a pas', async () => {
        const company = `Sabar ${randomUUID().slice(0, 6)} SARL`;
        const phone = randomSenegalPhone('77');
        const before = { sa: smsCount(superadmin), validator: smsCount(validator), reader: smsCount(reader) };
        const reg = await registerPartnerTwoStep({
            companyName: company,
            description: 'Organisateur fictif (lot 9 quinquies, D1).',
            address: '1 rue des Admins',
            city: 'Dakar',
            activities: ['ORGANISATEUR'],
            firstName: 'Awa',
            lastName: 'Candidate',
            phone,
            email: randomEmail('d1-candidate'),
            password: STRONG_PASSWORD,
            confirmPassword: STRONG_PASSWORD,
            ...(await uploadRegistrationDocuments()),
        });
        assert.equal(reg.second?.status, 201, `inscription partenaire : appel 2 HTTP ${reg.second?.status} ${JSON.stringify(reg.second?.body)}`);

        const saRows = await reviewRows(superadmin);
        assert.equal(saRows.length, 1, `SUPERADMIN : une ligne ADMIN_REVIEW_SMS (${JSON.stringify(saRows.map((r) => r.template_data))})`);
        assert.equal(saRows[0].family, 'ESSENTIAL', 'SMS indispensable (hors plafond optionnel)');
        assert.ok(Date.parse(saRows[0].due_at) <= Date.now() + 60_000 || new Date(saRows[0].due_at).getUTCHours() === 8,
            `échéance dans la minute (ou 8 h si la candidature tombe la nuit) : ${saRows[0].due_at}`);
        assert.equal((await reviewRows(validator)).length, 1, 'l\'ADMIN qui a partners.validate reçoit');
        assert.equal((await reviewRows(reader)).length, 0, 'l\'ADMIN sans partners.validate ne reçoit rien');
        assert.equal((await reviewRows(eventsWriter)).length, 0, 'l\'ADMIN qui n\'a que events.write ne reçoit rien pour une candidature');

        const due = new Date(Math.max(Date.now(), Date.parse(saRows[0].due_at)));
        await dispatchFor(superadmin, due);
        await dispatchFor(validator, due);
        assert.deepEqual(smsSince(superadmin, before.sa), [singleText(company)], 'SMS du SUPERADMIN, texte exact');
        assert.deepEqual(smsSince(validator, before.validator), [singleText(company)], 'SMS de l\'ADMIN qui a partners.validate');
        assert.deepEqual(smsSince(reader, before.reader), [], 'aucun SMS à l\'ADMIN sans partners.validate');
    });

    test('trois candidatures en 10 minutes : deux SMS, le premier puis le regroupé 30 minutes après le premier', async () => {
        const t0 = dakarAt(dakarDay(220), '12:00');
        const start = smsCount(superadmin);
        assert.equal(await addReview('PARTNER_NEW', t0, 'Teranga Sons'), 2, 'SUPERADMIN et ADMIN partners.validate touchés');
        await dispatchFor(superadmin, t0);
        assert.deepEqual(smsSince(superadmin, start), [singleText('Teranga Sons')], 'premier SMS, tout de suite');

        await addReview('PARTNER_NEW', addMinutes(t0, 3), 'Dakar Live');
        await addReview('PARTNER_NEW', addMinutes(t0, 8), 'Goree Prod');
        const pending = (await reviewRows(superadmin)).filter((r) => r.status === 'PENDING');
        assert.equal(pending.length, 1, `une seule ligne en attente pour les deux candidatures suivantes (${pending.length})`);
        assert.equal(Date.parse(pending[0].due_at), addMinutes(t0, 30).getTime(), `échéance = premier envoi + 30 min : ${pending[0].due_at}`);

        await dispatchFor(superadmin, addMinutes(t0, 10));
        assert.equal(smsSince(superadmin, start).length, 1, 'rien avant 30 minutes');
        await dispatchFor(superadmin, addMinutes(t0, 30));
        assert.deepEqual(smsSince(superadmin, start), [
            singleText('Teranga Sons'),
            `Event Village : 2 demande(s) de partenaire attendent votre validation : ${APP_URL}/admin/dashboard`,
        ], 'deux SMS en tout : le premier, puis le regroupé');
    });

    test('candidature à 23 h : rien la nuit, SMS à 8 h', async () => {
        const day = dakarDay(230);
        const night = dakarAt(day, '23:00');
        const start = smsCount(superadmin);
        await addReview('PARTNER_NEW', night, 'Nuit Blanche Events');
        const row = (await reviewRows(superadmin)).find((r) => r.status === 'PENDING');
        assert.ok(row, 'ligne en attente');
        assert.equal(Date.parse(row.due_at), dakarAt(dakarDay(231), '08:00').getTime(), `échéance à 8 h : ${row.due_at}`);
        await dispatchFor(superadmin, addMinutes(night, 30));
        await dispatchFor(superadmin, dakarAt(dakarDay(231), '07:59'));
        assert.equal(smsSince(superadmin, start).length, 0, 'aucun SMS entre 22 h et 8 h');
        await dispatchFor(superadmin, dakarAt(dakarDay(231), '08:00'));
        assert.deepEqual(smsSince(superadmin, start), [singleText('Nuit Blanche Events')], 'SMS à 8 h');
    });

    test('événement soumis : SMS à l\'ADMIN qui a events.write et au SUPERADMIN, rien à celui qui n\'a que partners.validate', async () => {
        const t0 = dakarAt(dakarDay(240), '10:00');
        const start = { sa: smsCount(superadmin), ev: smsCount(eventsWriter), validator: smsCount(validator) };
        assert.equal(await addReview('EVENT_SUBMITTED', t0), 2, 'SUPERADMIN et ADMIN events.write touchés');
        await dispatchFor(superadmin, t0);
        await dispatchFor(eventsWriter, t0);
        await dispatchFor(validator, t0);
        const expected = `Event Village : 1 événement(s) attendent votre validation : ${APP_URL}/admin/dashboard`;
        assert.deepEqual(smsSince(eventsWriter, start.ev), [expected], 'ADMIN events.write');
        assert.deepEqual(smsSince(superadmin, start.sa), [expected], 'SUPERADMIN');
        assert.deepEqual(smsSince(validator, start.validator), [], 'ADMIN partners.validate seul : rien pour un événement');
    });
});
