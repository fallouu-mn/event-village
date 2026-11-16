/**
 * Contre-vérification de la finition 2a, attaque 5 — fin retenue : aucune différence entre la base (event_end_at), le
 * catalogue (GET /api/events, et la fonction qu'il utilise), l'équipe (partner_team_view : événement, affectation,
 * « passé »), « Mes soirées » (controller_evenings) et la fiche admin et l'onglet Infos (retainedEnd).
 *  a. Valeurs : début 22:00 sans fin, début 10:00 sans fin, date de fin sans heure, événement de plusieurs jours, heure de
 *     fin sans date de fin (donnée ancienne) ; chaque source comparée à la règle écrite (fin saisie ; date de fin sans
 *     heure : 23:59 ; sinon début + 6 h, heure de Dakar) et à la base.
 *  b. Catalogue par la route : événements PUBLIE autour de l'instant présent (fin dans 10 minutes, fin il y a 10 minutes,
 *     plusieurs jours, date de fin sans heure aujourd'hui) : listé si et seulement si event_end_at est à venir.
 *  c. Aucune fonction de la base ne calcule encore une autre fin (« jour du début à 23:59 »).
 * Sortie brute `[CVF2A-5]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { service, type Buyer } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { createTimedEvent, newController } from '../parcours/acces-helpers';
import { createDraftEvent } from '../parcours/cycle-helpers';
import { inspect } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { eventEndAt, retainedEnd } from '../../lib/events/event-end';
import { api, show, type Row } from './cvf1-helpers';

const H = 3_600_000;

interface Dates { start_date: string; start_time: string; end_date: string | null; end_time: string | null }
interface Case { label: string; dates: Dates; expected: Date; eventId?: string }

let P: TestPartner;
let C: Buyer;

function day(offsetDays: number): string {
    return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function at(dateStr: string, time: string): Date {
    return new Date(`${dateStr}T${time.length === 5 ? `${time}:00` : time}Z`);
}

const CASES: Case[] = [];

before(async () => {
    P = await newPartner('cvf2a-fin');
    C = await newController(P, null, { label: 'cvf2a-fin' });
    const y = day(-1);
    const t = day(0);
    CASES.push(
        { label: 'début 22:00 sans fin (hier)', dates: { start_date: y, start_time: '22:00:00', end_date: null, end_time: null }, expected: new Date(at(y, '22:00').getTime() + 6 * H) },
        { label: 'début 10:00 sans fin (aujourd’hui)', dates: { start_date: t, start_time: '10:00:00', end_date: null, end_time: null }, expected: new Date(at(t, '10:00').getTime() + 6 * H) },
        { label: 'date de fin sans heure (demain)', dates: { start_date: t, start_time: '18:00:00', end_date: day(1), end_time: null }, expected: at(day(1), '23:59') },
        { label: 'plusieurs jours (avant-hier 20:00 → après-demain 03:00)', dates: { start_date: day(-2), start_time: '20:00:00', end_date: day(2), end_time: '03:00:00' }, expected: at(day(2), '03:00') },
        { label: 'heure de fin sans date de fin (22:00 → 02:00, donnée ancienne)', dates: { start_date: y, start_time: '22:00:00', end_date: null, end_time: '02:00:00' }, expected: new Date(at(y, '22:00').getTime() + 6 * H) },
    );
    for (const c of CASES) {
        const d = await createDraftEvent(P, `cvf2a-fin-${CASES.indexOf(c)}`, [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72, durationHours: null });
        const { error } = await service.from('events').update(c.dates).eq('id', d.eventId);
        assert.equal(error, null, `dates (montage, ${c.label}) : ${error?.message}`);
        const { error: aErr } = await service.from('event_controllers').insert({ event_id: d.eventId, user_id: C.userId, created_by: P.userId, can_accept_cash: false });
        assert.equal(aErr, null, `affectation (montage) : ${aErr?.message}`);
        c.eventId = d.eventId;
    }
});

after(async () => {
    await assertFinition1Invariants('cvf2a-5-fin');
});

function iso(v: unknown): string {
    return v === undefined || v === null ? String(v) : new Date(String(v)).toISOString();
}

describe('a. mêmes heures partout', () => {
    test('base, catalogue, équipe (événement, affectation, « passé »), « Mes soirées », fiche admin', async () => {
        const team = (await service.rpc('partner_team_view', { p: { partner_id: P.partnerId } })).data as Row;
        const evenings = (await service.rpc('controller_evenings', { p: { user_id: C.userId } })).data as Row;
        const now = Date.now();
        const diffs: string[] = [];
        for (const c of CASES) {
            const base = await inspect(async (cl) => (await cl.query<{ end_at: Date }>('SELECT public.event_end_at($1) AS end_at', [c.eventId])).rows[0].end_at);
            const tEvent = ((team.events as Row[]) ?? []).find((e) => e.id === c.eventId);
            const member = ((team.members as Row[]) ?? []).find((m) => m.user_id === C.userId || m.id === C.userId);
            const assignment = ((member?.assignments as Row[]) ?? []).find((a) => a.event_id === c.eventId);
            const item = ((evenings.items as Row[]) ?? []).find((i) => i.event_id === c.eventId);
            const admin = retainedEnd(c.dates);
            const sources: Record<string, string> = {
                règle: c.expected.toISOString(),
                base: iso(base),
                catalogue: eventEndAt(c.dates).toISOString(),
                'équipe (événement)': iso(tEvent?.end_at),
                'équipe (affectation)': iso(assignment?.end_at),
                '« Mes soirées »': iso(item?.end_at),
                'fiche admin / Infos': admin ? admin.at.toISOString() : 'aucune',
            };
            const pastExpected = c.expected.getTime() < now;
            console.log(`[CVF2A-5] ${c.label} : ${JSON.stringify(sources)} ; passé (équipe) ${String(tEvent?.past)} ; texte admin « ${admin?.text ?? ''} » ; note « ${admin?.note ?? ''} »`);
            for (const [k, v] of Object.entries(sources)) if (v !== sources.règle) diffs.push(`${c.label} : ${k} = ${v} au lieu de ${sources.règle}`);
            if (tEvent && tEvent.past !== pastExpected) diffs.push(`${c.label} : équipe dit passé=${String(tEvent.past)} alors que la fin ${sources.règle} est ${pastExpected ? 'passée' : 'à venir'}`);
            const hhmm = c.expected.toISOString().slice(11, 16);
            if (admin && !admin.text.endsWith(`à ${hhmm}`)) diffs.push(`${c.label} : fiche admin « ${admin.text} » au lieu de « … à ${hhmm} »`);
        }
        assert.deepEqual(diffs, [], `fins différentes selon l'écran :\n${diffs.map((d) => `  - ${d}`).join('\n')}`);
    });
});

describe('b. catalogue par la route : listé si et seulement si la fin est à venir', () => {
    test('fin dans 10 min, fin il y a 10 min, plusieurs jours, date de fin sans heure aujourd’hui', async () => {
        const now = Date.now();
        const dakar = (ms: number) => ({ date: new Date(ms).toISOString().slice(0, 10), time: new Date(ms).toISOString().slice(11, 19) });
        const s1 = dakar(now - 6 * H + 10 * 60_000);
        const s2 = dakar(now - 6 * H - 10 * 60_000);
        const s3 = dakar(now - 50 * H);
        const e3 = dakar(now + 3 * H);
        const s4 = dakar(now - 2 * H);
        const pubCases: Array<{ label: string; dates: Dates }> = [
            { label: 'sans fin, début il y a 5 h 50 (fin dans 10 min)', dates: { start_date: s1.date, start_time: s1.time, end_date: null, end_time: null } },
            { label: 'sans fin, début il y a 6 h 10 (fin il y a 10 min)', dates: { start_date: s2.date, start_time: s2.time, end_date: null, end_time: null } },
            { label: 'plusieurs jours, fin dans 3 h', dates: { start_date: s3.date, start_time: s3.time, end_date: e3.date, end_time: e3.time } },
            { label: 'date de fin sans heure (jour de la fin dans 3 h)', dates: { start_date: s4.date, start_time: s4.time, end_date: e3.date, end_time: null } },
        ];
        const ids: string[] = [];
        for (const c of pubCases) {
            const ev = await createTimedEvent(P.partnerId, `cvf2a-fin-cat-${pubCases.indexOf(c)}`, [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 48 });
            const { error } = await service.from('events').update(c.dates).eq('id', ev.eventId);
            assert.equal(error, null, `dates (montage, ${c.label}) : ${error?.message}`);
            ids.push(ev.eventId);
        }
        const r = await api('GET', 'events', { token: null });
        assert.equal(r.status, 200, show(r));
        const listed = new Set(((r.body.events as Row[]) ?? []).map((e) => String(e.id)));
        const diffs: string[] = [];
        for (const [i, c] of pubCases.entries()) {
            const base = await inspect(async (cl) => (await cl.query<{ end_at: Date }>('SELECT public.event_end_at($1) AS end_at', [ids[i]])).rows[0].end_at);
            const upcoming = new Date(base).getTime() > Date.now();
            console.log(`[CVF2A-5] catalogue : ${c.label} → fin en base ${iso(base)}, ${upcoming ? 'à venir' : 'passée'} ; listé ${listed.has(ids[i])}`);
            if (listed.has(ids[i]) !== upcoming) diffs.push(`${c.label} : listé=${listed.has(ids[i])} alors que la fin en base (${iso(base)}) est ${upcoming ? 'à venir' : 'passée'}`);
        }
        // Événements passés laissés PUBLIE : terminés par la tâche planifiée (comme en production), pas d'événement PUBLIE fini
        const { GET } = (await import('../../app/api/cron/events-finish/route')) as { GET: (req: import('next/server').NextRequest) => Promise<Response> };
        const { NextRequest } = await import('next/server');
        const { BASE_URL } = await import('../parcours/helpers');
        const cron = await GET(new NextRequest(`${BASE_URL}/api/cron/events-finish`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
        console.log(`[CVF2A-5] tâche planifiée events-finish → HTTP ${cron.status}`);
        assert.deepEqual(diffs, [], `catalogue différent de la base :\n${diffs.map((d) => `  - ${d}`).join('\n')}`);
    });
});

describe('c. aucune autre fin calculée en base', () => {
    test('aucune fonction ne prend encore « jour de fin, sinon jour du début, à 23:59 » ni event_end_from(date, date, time)', async () => {
        const rows = await inspect(async (cl) => (await cl.query<{ proname: string }>(`
            SELECT p.proname
              FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname <> 'event_end_from'
               AND (p.prosrc ~* 'coalesce\\s*\\(\\s*(e\\.)?end_date\\s*,\\s*(e\\.)?start_date\\s*\\)'
                    OR p.prosrc ~* 'event_end_from\\s*\\(')
             ORDER BY 1`)).rows);
        console.log(`[CVF2A-5] fonctions qui calculent une autre fin : ${rows.map((r) => r.proname).join(', ') || 'aucune'}`);
        assert.deepEqual(rows.map((r) => r.proname), [], `fonctions qui calculent encore « jour du début à 23:59 » : ${rows.map((r) => r.proname).join(', ')}`);
    });
});
