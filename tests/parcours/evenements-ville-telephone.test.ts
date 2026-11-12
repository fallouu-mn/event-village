/**
 * Lot 9 ter, tâche 9t.11 (consigne 0.8, R96 ; contrat 5.B 9t.11, 4.2 B.3, B.5 point 5 et 8, décisions B-D17 à B-D20) —
 * ville dans une liste fermée, téléphone de contact normalisé :
 *  - lib/events/senegal-cities.ts : SENEGAL_CITIES (26 villes : 14 chefs-lieux de région et 12 communes et lieux
 *    d'événements, D-R96-1), OTHER_CITY_VALUE, senegalCity, canonicalCity ; une ville de la liste saisie sans accents
 *    ou en majuscules est ramenée à sa forme de la liste ; une autre ville est gardée ;
 *  - modification : une ville égale à la ville actuelle une fois pliée (foldText) garde la ville actuelle (aucun
 *    EVENT_CHANGED parasite) ;
 *  - téléphone de contact (practical_info.contactPhone) : mobiles 7[05678] et fixes 3[03], stocké +221… ; ancienne valeur
 *    gardée telle quelle si elle n'est pas modifiée ; refus « Numéro sénégalais invalide. Exemple : 77 123 45 67 ou 33 821
 *    00 00. » ; formatSnPhone pour l'affichage ; la fiche publique sert contactPhone formaté et contactPhoneTel (E.164).
 * Cas 1 à 5 sans base (modules importés dynamiquement : les signatures nouvelles n'existent pas encore) ; cas 6 et 7 avec
 * base, after() : assertLot9terInvariants.
 *
 * Rouge avant correctif (S-E fix(9t.11), E-B fix(9t.11e)) : lib/events/senegal-cities.ts absent ; ville libre 2-80
 * (lib/validations/event.ts:187-189) gardée telle quelle ; téléphone libre ≤ 300 (:215-224) ; formatSnPhone absent ;
 * event_update prévient les porteurs dès que la ville diffère (« Thies » → « Thiès ») ; la fiche publique sert le
 * numéro brut, sans contactPhoneTel ; EventForm.tsx a un champ ville libre.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import { callMiddleware } from '../helpers/middleware';
import { foldText } from '../../lib/text/fold';
import { importModule, newBuyer, service, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { advanceEventTo, createDraftEvent } from './cycle-helpers';
import { outboxRows } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;
type Schema = { parse: (v: unknown) => any; safeParse: (v: unknown) => { success: boolean; data?: any; error?: { issues: Array<{ message: string; path: Array<string | number> }> } } };

const ROOT = process.cwd();
const CITIES_MODULE = '../../lib/events/senegal-cities';
const EVENT_VALIDATION = '../../lib/validations/event';
const AUTH_VALIDATION = '../../lib/validations/auth';
const INVALID_PHONE = 'Numéro sénégalais invalide. Exemple : 77 123 45 67 ou 33 821 00 00.';
const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 3_000, total: 20 }];

/** Les 14 chefs-lieux de région et les 12 communes et lieux d'événements retenus (D-R96-1, décision B-D17). */
const REGION_CAPITALS = ['Dakar', 'Diourbel', 'Fatick', 'Kaffrine', 'Kaolack', 'Kédougou', 'Kolda', 'Louga', 'Matam', 'Saint-Louis', 'Sédhiou', 'Tambacounda', 'Thiès', 'Ziguinchor'];
const OTHER_PLACES = ['Guédiawaye', 'Pikine', 'Rufisque', 'Diamniadio', 'Mbour', 'Saly', 'Touba', 'Mbacké', 'Tivaouane', 'Richard-Toll', 'Joal-Fadiouth', 'Cap Skirring'];

async function moduleOf(rel: string, what: string): Promise<Record<string, any>> {
    try {
        return (await importModule(rel)) as Record<string, any>;
    } catch (err) {
        assert.fail(`${what} absent (${rel}) : ${err instanceof Error ? err.message : String(err)}`);
    }
}

function futureDay(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function createInput(over: Row = {}): Row {
    return { title: 'Gala de test ville', category: 'CONCERT', start_date: futureDay(20), start_time: '20:00', location: 'Salle de test', city: 'Dakar', ...over };
}

async function createSchema(): Promise<Schema> {
    const mod = await moduleOf(EVENT_VALIDATION, 'lib/validations/event');
    return mod.createEventSchema({ partnerId: randomUUID(), now: new Date() }) as Schema;
}

async function updateSchema(current: Row): Promise<Schema> {
    const mod = await moduleOf(EVENT_VALIDATION, 'lib/validations/event');
    const base = { start_date: futureDay(20), start_time: '20:00:00', end_date: null, end_time: null, image_url: null };
    return mod.updateEventSchema({ partnerId: randomUUID(), now: new Date(), current: { ...base, ...current } }) as Schema;
}

function issuesOf(r: ReturnType<Schema['safeParse']>): string[] {
    return (r.error?.issues ?? []).map((i) => i.message);
}

describe('9t.11 (R96) : liste des villes et normalisation (sans base)', () => {
    test('liste des villes : 26 entrées, les 14 chefs-lieux de région, aucun doublon une fois pliée, triée en français', async () => {
        const mod = await moduleOf(CITIES_MODULE, 'lib/events/senegal-cities.ts (contrat B.0, 9t.11)');
        const list = mod.SENEGAL_CITIES as string[];
        assert.ok(Array.isArray(list), 'SENEGAL_CITIES exporté (tableau)');
        assert.equal(list.length, 26, `26 villes : ${JSON.stringify(list)}`);
        assert.deepEqual(REGION_CAPITALS.filter((c) => !list.includes(c)), [], 'les 14 chefs-lieux de région, forme accentuée');
        assert.deepEqual([...list].sort(), [...REGION_CAPITALS, ...OTHER_PLACES].sort(), 'liste fermée de D-R96-1');
        assert.equal(new Set(list.map((c) => foldText(c))).size, 26, 'aucun doublon une fois pliée');
        assert.deepEqual(list, [...list].sort((a, b) => a.localeCompare(b, 'fr')), 'triée en français');
        assert.equal(mod.OTHER_CITY_VALUE, 'AUTRE', 'valeur de l\'option « Autre ville »');
        assert.equal(typeof mod.senegalCity, 'function', 'senegalCity exporté');
        assert.equal(typeof mod.canonicalCity, 'function', 'canonicalCity exporté');
    });

    test('création : ville de la liste ramenée à sa forme, autre ville gardée', async () => {
        const schema = await createSchema();
        const city = (value: string): unknown => {
            const r = schema.safeParse(createInput({ city: value }));
            assert.equal(r.success, true, `ville « ${value} » acceptée : ${issuesOf(r).join(' | ')}`);
            return r.data.city;
        };
        assert.equal(city('THIES'), 'Thiès');
        assert.equal(city('  thiès '), 'Thiès');
        assert.equal(city('Ndiass'), 'Ndiass', 'ville hors liste gardée');
        assert.equal(city('Ab'), 'Ab', 'ville hors liste de 2 caractères gardée');
        assert.equal(city('x'.repeat(80)), 'x'.repeat(80), 'ville hors liste de 80 caractères gardée');
    });

    test('modification : même ville une fois pliée = ville actuelle gardée ; autre ville de la liste acceptée', async () => {
        const schema = await updateSchema({ city: 'Thies', contact_phone: null });
        const same = schema.safeParse({ city: 'Thiès' });
        assert.equal(same.success, true, issuesOf(same).join(' | '));
        assert.equal(same.data.city, 'Thies', 'ville actuelle gardée telle quelle : aucun changement détecté');
        const other = schema.safeParse({ city: 'Kaolack' });
        assert.equal(other.success, true, issuesOf(other).join(' | '));
        assert.equal(other.data.city, 'Kaolack');
    });

    test('téléphone de contact : stocké en +221, fixes acceptés, refus au texte exact, ancienne valeur gardée telle quelle', async () => {
        const schema = await createSchema();
        const phone = (value: string): ReturnType<Schema['safeParse']> => schema.safeParse(createInput({ practical_info: { contactPhone: value } }));
        for (const v of ['77 123 45 67', '+221 77 123 45 67', '00221771234567', '221771234567']) {
            const r = phone(v);
            assert.equal(r.success, true, `« ${v} » accepté : ${issuesOf(r).join(' | ')}`);
            assert.equal(r.data.practical_info.contactPhone, '+221771234567', `« ${v} » stocké en E.164`);
        }
        const fixed = phone('33 821 00 00');
        assert.equal(fixed.success, true, issuesOf(fixed).join(' | '));
        assert.equal(fixed.data.practical_info.contactPhone, '+221338210000', 'fixe accepté (D-R96-2)');
        const empty = phone('');
        assert.equal(empty.success, true, issuesOf(empty).join(' | '));
        assert.equal(empty.data.practical_info.contactPhone, null, 'vide : null');
        for (const v of ['12345', '+33612345678', '80 123 45 67']) {
            const r = phone(v);
            assert.equal(r.success, false, `« ${v} » refusé`);
            assert.ok(issuesOf(r).includes(INVALID_PHONE), `« ${v} » : texte exact du refus : ${issuesOf(r).join(' | ')}`);
        }

        const update = await updateSchema({ city: 'Dakar', contact_phone: 'Appeler Awa' });
        const kept = update.safeParse({ practical_info: { contactPhone: 'Appeler Awa' } });
        assert.equal(kept.success, true, `ancienne valeur renvoyée à l'identique : acceptée : ${issuesOf(kept).join(' | ')}`);
        assert.equal(kept.data.practical_info.contactPhone, 'Appeler Awa', 'ancienne valeur gardée telle quelle');

        const auth = await moduleOf(AUTH_VALIDATION, 'lib/validations/auth');
        assert.equal(auth.INVALID_SN_CONTACT_PHONE_MESSAGE, INVALID_PHONE, 'INVALID_SN_CONTACT_PHONE_MESSAGE');
        assert.equal(typeof auth.formatSnPhone, 'function', 'formatSnPhone exporté');
        assert.equal(typeof auth.toSenegaleseContactE164, 'function', 'toSenegaleseContactE164 exporté');
        assert.equal(auth.formatSnPhone('+221771234567'), '77 123 45 67');
        assert.equal(auth.formatSnPhone('+221338210000'), '33 821 00 00');
        assert.equal(auth.formatSnPhone('Appeler Awa'), null);
        assert.equal(auth.toSenegaleseContactE164('33 821 00 00'), '+221338210000');
        assert.equal(auth.toSenegaleseContactE164('80 123 45 67'), null);
    });

    test('statique : formulaire (liste des villes, « Autre ville », « Précisez la ville ») et fiche publique (lien tel: depuis contactPhoneTel)', () => {
        const form = fs.readFileSync(path.join(ROOT, 'components/events/EventForm.tsx'), 'utf8');
        assert.match(form, /import\s*\{[^}]*\bSENEGAL_CITIES\b[^}]*\}\s*from\s*['"]@\/lib\/events\/senegal-cities['"]/, 'EventForm importe SENEGAL_CITIES');
        assert.match(form, /<Select\b[^>]*\bid=["']ev-city["']/, 'Select d\'identifiant ev-city');
        assert.ok(form.includes('Autre ville'), 'option « Autre ville »');
        assert.ok(form.includes('Précisez la ville'), 'champ « Précisez la ville »');
        assert.match(form, /\bid=["']ev-city-other["']/, 'champ ev-city-other');
        const page = fs.readFileSync(path.join(ROOT, 'app/events/[id]/page.tsx'), 'utf8');
        assert.match(page, /tel:\$\{[^}]*\bcontactPhoneTel\b/, 'lien tel: construit depuis contactPhoneTel');
    });
});

// ── Avec base ──────────────────────────────────────────────────────────────

let partner: TestPartner | null = null;

async function owner(): Promise<TestPartner> {
    partner ??= await newPartner('ville9t');
    return partner;
}

after(async () => {
    await assertLot9terInvariants('evenements-ville-telephone');
});

describe('9t.11 (R96) : modification et fiche publique (base)', () => {
    test('« Thies » en base, PUT « Thiès » : aucun porteur prévenu, ville inchangée, aucune alerte', async () => {
        const p = await owner();
        const ev = await createDraftEvent(p, 'ville-thies', CATEGORIES, { city: 'Thies', startsInHours: 96 });
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: p.userId });
        await buyConfirmed(await newBuyer('ville-porteur'), ev, [['Standard', 1]]);
        const { data: before, error } = await service.from('events').select('updated_at').eq('id', ev.eventId).single();
        assert.equal(error, null, error?.message);
        const handler = await routeHandler('../../app/api/partner/events/[id]/route', 'PUT', 'PUT /api/partner/events/[id]');
        const res = await invoke(handler, jsonRequest(`/api/partner/events/${ev.eventId}`, 'PUT', p.accessToken,
            { patch: { city: 'Thiès' }, expected_updated_at: before.updated_at }), { params: Promise.resolve({ id: ev.eventId }) });
        assert.equal(res.status, 200, show(res));
        assert.equal(res.body.notified_holders, 0, `même ville une fois pliée : aucun porteur prévenu (aujourd'hui 1) : ${show(res)}`);
        const { data: after, error: afterErr } = await service.from('events').select('city').eq('id', ev.eventId).single();
        assert.equal(afterErr, null, afterErr?.message);
        assert.equal(after.city, 'Thies', 'ville inchangée');
        assert.deepEqual(await outboxRows({ type: 'EVENT_CHANGED', eventId: ev.eventId }), [], 'aucune ligne EVENT_CHANGED');
        assert.deepEqual(await outboxRows({ type: 'ADMIN_EVENT_CHANGED', eventId: ev.eventId }), [], 'aucune alerte admin pour ce PUT');
    });

    test('fiche publique : numéro formaté et lien E.164, ancienne valeur affichée telle quelle ; route publique ouverte par le middleware', async () => {
        const p = await owner();
        const sheet = async (contactPhone: string): Promise<Row> => {
            const ev = await createDraftEvent(p, 'ville-fiche', CATEGORIES, { startsInHours: 96 });
            const { error } = await service.from('events').update({ practical_info: { contactPhone } }).eq('id', ev.eventId);
            assert.equal(error, null, `informations pratiques : ${error?.message}`);
            await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: p.userId });
            const mw = await callMiddleware(`/api/events/${ev.eventId}`, []);
            assert.equal(mw.passedThrough, true, `GET /api/events/[id] sans session : ouvert par le middleware (${JSON.stringify(mw)})`);
            const handler = await routeHandler('../../app/api/events/[id]/route', 'GET', 'GET /api/events/[id]');
            const params = { id: ev.eventId };
            const res = await invoke(handler, jsonRequest(`/api/events/${ev.eventId}`, 'GET', null), { params: Object.assign(Promise.resolve(params), params) });
            assert.equal(res.status, 200, show(res));
            return ((res.body.event as Row).practicalInfo ?? {}) as Row;
        };
        const e164 = await sheet('+221771234567');
        assert.deepEqual({ contactPhone: e164.contactPhone, contactPhoneTel: e164.contactPhoneTel },
            { contactPhone: '77 123 45 67', contactPhoneTel: '+221771234567' }, `numéro stocké en E.164 : ${JSON.stringify(e164)}`);
        const legacy = await sheet('Appeler Awa');
        assert.deepEqual({ contactPhone: legacy.contactPhone, contactPhoneTel: legacy.contactPhoneTel },
            { contactPhone: 'Appeler Awa', contactPhoneTel: null }, `ancienne valeur libre : ${JSON.stringify(legacy)}`);
    });
});
