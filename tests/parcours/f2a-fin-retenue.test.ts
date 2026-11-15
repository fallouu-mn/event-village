/**
 * Finition 2a, 2 (E-01) — une seule fin retenue partout, celle de event_end_at : fin saisie ; date de fin sans heure :
 * 23:59 ; aucune fin : début + 6 h (heure de Dakar).
 * Pour un début à 22:00 sans fin et un début à 10:00 sans fin (il y a trois jours), mêmes heures dans :
 *  - la base (event_end_at) ;
 *  - le catalogue (eventEndAt, lib/events/event-end.ts) ;
 *  - l'équipe (partner_team_view : événements et affectations, end_at et « passé ») ;
 *  - « Mes soirées » (controller_evenings, end_at) ;
 *  - la fiche admin et l'onglet Infos du pilotage (retainedEnd, même calcul, texte « … à HH:MM ») ;
 * soit 04:00 le lendemain pour 22:00, 16:00 le jour même pour 10:00. Textes : « Fin retenue : … » et son aide dans le
 * formulaire, plus jamais « Non précisée (fin de journée) » ; commentaire de events-finish conforme à la règle.
 * Rouge avant le correctif : l'équipe et « Mes soirées » prenaient le jour du début à 23:59 ; la fiche admin affichait
 * « Non précisée (fin de journée) ».
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { service, type Buyer } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { newController } from './acces-helpers';
import { createDraftEvent } from './cycle-helpers';
import { inspect } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { eventEndAt } from '../../lib/events/event-end';
import type { Row } from '../audit/cvf1-helpers';

const HELP_TEXT = 'La vente s’arrête à cette heure. Indiquez l’heure de fin si votre événement dure plus longtemps.';

interface Case { label: string; startTime: string; eventId?: string; expected?: Date; expectedClock: string; nextDay: boolean }
const CASES: Case[] = [
    { label: 'début 22:00 sans fin', startTime: '22:00:00', expectedClock: '04:00', nextDay: true },
    { label: 'début 10:00 sans fin', startTime: '10:00:00', expectedClock: '16:00', nextDay: false },
];

let P: TestPartner;
let C: Buyer;
let startDate: string;

function isoDay(d: Date): string {
    return d.toISOString().slice(0, 10);
}

before(async () => {
    P = await newPartner('f2a-fin');
    C = await newController(P, null, { label: 'f2a-fin' });
    startDate = isoDay(new Date(Date.now() - 3 * 86_400_000));
    for (const c of CASES) {
        const draft = await createDraftEvent(P, `f2a-fin-${c.startTime.slice(0, 2)}`, [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72, durationHours: null });
        const { error } = await service.from('events').update({ start_date: startDate, start_time: c.startTime, end_date: null, end_time: null }).eq('id', draft.eventId);
        assert.equal(error, null, `dates (montage) : ${error?.message}`);
        const { error: aErr } = await service.from('event_controllers').insert({ event_id: draft.eventId, user_id: C.userId, created_by: P.userId, can_accept_cash: false });
        assert.equal(aErr, null, `affectation (montage) : ${aErr?.message}`);
        c.eventId = draft.eventId;
        const start = new Date(`${startDate}T${c.startTime}Z`);
        c.expected = new Date(start.getTime() + 6 * 3_600_000);
        assert.equal(c.expected.toISOString().slice(11, 16), c.expectedClock, 'précondition du calcul attendu');
        assert.equal(isoDay(c.expected) !== startDate, c.nextDay, 'précondition : lendemain ou même jour');
    }
});

after(async () => {
    await assertFinition1Invariants('f2a-fin-retenue');
});

function same(actual: unknown, expected: Date, what: string): void {
    assert.ok(actual !== undefined && actual !== null, `${what} : fin absente`);
    assert.equal(new Date(String(actual)).toISOString(), expected.toISOString(), `${what} : ${String(actual)}`);
}

describe('2. fin retenue : mêmes heures partout', () => {
    test('base, catalogue, équipe, « Mes soirées »', async () => {
        const team = (await service.rpc('partner_team_view', { p: { partner_id: P.partnerId } })).data as Row;
        const evenings = (await service.rpc('controller_evenings', { p: { user_id: C.userId } })).data as Row;
        for (const c of CASES) {
            const db = await inspect(async (cl) => (await cl.query<{ end_at: Date }>('SELECT public.event_end_at($1) AS end_at', [c.eventId])).rows[0].end_at);
            same(db, c.expected!, `${c.label} : base`);
            same(eventEndAt({ start_date: startDate, start_time: c.startTime, end_date: null, end_time: null }).toISOString(), c.expected!, `${c.label} : catalogue`);
            const tEvent = ((team.events as Row[]) ?? []).find((e) => e.id === c.eventId);
            console.log(`[F2A-2] ${c.label} : base ${new Date(db).toISOString()} ; équipe ${JSON.stringify(tEvent && { end_at: tEvent.end_at, past: tEvent.past })}`);
            same(tEvent?.end_at, c.expected!, `${c.label} : équipe (événement)`);
            assert.equal(tEvent?.past, true, `${c.label} : équipe, événement passé`);
            const member = ((team.members as Row[]) ?? []).find((m) => m.user_id === C.userId || m.id === C.userId);
            const assignment = ((member?.assignments as Row[]) ?? []).find((a) => a.event_id === c.eventId);
            same(assignment?.end_at, c.expected!, `${c.label} : équipe (affectation)`);
            const item = ((evenings.items as Row[]) ?? []).find((i) => i.event_id === c.eventId);
            same(item?.end_at, c.expected!, `${c.label} : « Mes soirées »`);
        }
    });

    test('fiche admin et pilotage : fin retenue calculée, au même texte', async () => {
        const mod = (await import('../../lib/events/event-end')) as Record<string, unknown>;
        const retainedEnd = mod.retainedEnd as ((row: { start_date: string; start_time: string | null; end_date: string | null; end_time: string | null }) => { at: Date; time: string; text: string; computed: boolean }) | undefined;
        assert.equal(typeof retainedEnd, 'function', 'retainedEnd absente de lib/events/event-end.ts');
        for (const c of CASES) {
            const r = retainedEnd!({ start_date: startDate, start_time: c.startTime, end_date: null, end_time: null });
            console.log(`[F2A-2] ${c.label} : fiche admin « ${r.text} »`);
            same(r.at.toISOString(), c.expected!, `${c.label} : fiche admin`);
            assert.equal(r.time, c.expectedClock, `${c.label} : heure`);
            assert.ok(r.text.endsWith(`à ${c.expectedClock}`), `${c.label} : texte « ${r.text} »`);
            assert.ok(r.text.includes(String(c.expected!.getUTCDate())), `${c.label} : jour dans « ${r.text} »`);
            assert.equal(r.computed, true, 'fin calculée (aucune fin saisie)');
        }
        const admin = fs.readFileSync('app/admin/events/[id]/page.tsx', 'utf8');
        assert.ok(!admin.includes('Non précisée (fin de journée)'), 'la fiche admin affiche encore « Non précisée (fin de journée) »');
        assert.ok(/retainedEnd\(/.test(admin), 'la fiche admin ne calcule pas la fin retenue');
    });

    test('formulaire : « Fin retenue : … » et son aide ; commentaire de events-finish', () => {
        const form = fs.readFileSync('components/events/EventForm.tsx', 'utf8');
        assert.ok(form.includes('Fin retenue : '), 'formulaire sans « Fin retenue : … »');
        assert.ok(form.includes(HELP_TEXT), 'formulaire sans l’aide de la fin retenue');
        const cron = fs.readFileSync('app/api/cron/events-finish/route.ts', 'utf8');
        assert.ok(!/début à 23:59/.test(cron), 'events-finish décrit encore une fin « début à 23:59 »');
        assert.ok(/début \+ 6 h/.test(cron), 'events-finish ne décrit pas la règle de event_end_at (début + 6 h)');
    });
});
