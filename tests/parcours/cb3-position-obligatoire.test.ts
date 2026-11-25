/**
 * Lot Carte B3 — décision du client du 25/11 : la position exacte est OBLIGATOIRE pour ce qui est publié (événement,
 * salle, établissement). Base locale, refus prouvés par la base ET par les routes :
 *  A. envoi en validation sans position refusé, avec « Placez votre lieu sur la carte avant d’envoyer. » : création d'une
 *     salle (route) et d'un établissement (route, venue_create), renvoi d'une salle et d'un établissement refusés
 *     (hall_submit, venue_submit), soumission d'un événement (event_transition) ; rien d'écrit ; avec la position : accepté ;
 *  B. une salle ou un établissement inséré sans position n'est jamais validé d'office, même validation non exigée ;
 *  C. l'administration ne valide jamais un dossier sans position (salle, établissement, événement) ; une RÉACTIVATION de
 *     ce qui était déjà publié reste possible (ce qui est en ligne sans position y reste) ;
 *  D. une position ne se retire pas par les routes de la partenaire (salle, établissement) ;
 *  E. pilotage d'un événement : `has_position` dit si le bandeau « Ajoutez la position… » doit s'afficher.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { api, show, type Reply, type Row } from '../audit/cvf1-helpers';
import { service } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { decideHall, newHall, openHallsService, platformSetting, setPlatformSetting } from './l10a-helpers';
import { decideVenue, newTable, newVenue, openTablesService } from './l11a-helpers';
import { createDraftEvent, eventStatus, rpcTransition } from './cycle-helpers';
import { createTimedEvent } from './acces-helpers';
import { PLACE_POSITION_REQUIRED } from '../../lib/places/place-texts';

const DAKAR = { latitude: 14.6928, longitude: -17.4467 };
const NO_POSITION = { latitude: null, longitude: null };

let restoreHalls: () => Promise<void>;
let restoreTables: () => Promise<void>;
let owner: TestPartner;

const base = (): string => (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
/** Photo « déposée » (nom réencodé) dans le dossier d'une partenaire. */
const photoOf = (folder: 'halls' | 'venues', partnerId: string): string =>
    `${base()}/storage/v1/object/public/public-images/${folder}/${partnerId}/${Date.now()}_${randomBytes(4).toString('hex')}.webp`;

async function rpc(name: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(name, { p });
    assert.equal(error, null, `${name} : ${error?.message}`);
    return (data ?? {}) as Row;
}

async function setRow(table: 'halls' | 'venues' | 'events', id: string, patch: Row): Promise<void> {
    const { error } = await service.from(table).update(patch).eq('id', id);
    assert.equal(error, null, `${table} ${id} : ${error?.message}`);
}

async function statusOf(table: 'halls' | 'venues', id: string): Promise<string> {
    const { data, error } = await service.from(table).select('validation_status').eq('id', id).single();
    assert.equal(error, null, error?.message);
    return String(data!.validation_status);
}

async function countNamed(table: 'halls' | 'venues', name: string): Promise<number> {
    const { count, error } = await service.from(table).select('id', { count: 'exact', head: true }).eq('name', name);
    assert.equal(error, null, error?.message);
    return count ?? 0;
}

const refusedForPosition = (r: Reply, what: string): void => {
    assert.equal(r.status, 400, `${what} : ${show(r)}`);
    assert.equal(r.body.code, 'POSITION_REQUIRED', `${what} : ${show(r)}`);
};

before(async () => {
    restoreHalls = await openHallsService();
    restoreTables = await openTablesService();
    owner = await newPartner('cb3-position');
});

after(async () => {
    await restoreHalls();
    await restoreTables();
});

describe('A — envoi en validation sans position refusé (phrase du client)', () => {
    test('salle créée par la route : refusée sans position, rien créé ; acceptée avec', async () => {
        const name = `TEST cb3 salle ${randomBytes(3).toString('hex')}`;
        const body = { name, capacity: 80, price_per_day: 60_000, city: 'Dakar', address: 'Rue 10, Médina', images: [photoOf('halls', owner.partnerId)] };
        const refused = await api('POST', 'partner/halls', { token: owner.accessToken, body });
        refusedForPosition(refused, 'salle sans position');
        assert.equal(refused.body.error, PLACE_POSITION_REQUIRED);
        assert.equal(await countNamed('halls', name), 0, 'salle créée malgré le refus');
        const ok = await api('POST', 'partner/halls', { token: owner.accessToken, body: { ...body, ...DAKAR } });
        assert.equal(ok.status, 201, show(ok));
        assert.equal((ok.body.hall as Row).validation_status, 'EN_ATTENTE_VALIDATION');
    });

    test('établissement créé par la route (venue_create) : refusé sans position, rien créé ; accepté avec', async () => {
        const name = `TEST cb3 restaurant ${randomBytes(3).toString('hex')}`;
        const body = {
            kind: 'RESTAURANT', name, address: 'Route de Ngor', city: 'Dakar', photos: [photoOf('venues', owner.partnerId)],
            hours: [{ weekday: 5, opens_at: '12:00', closes_at: '23:00' }], tables: [{ number: '1', capacity: 4 }],
        };
        const refused = await api('POST', 'partner/venues', { token: owner.accessToken, body });
        refusedForPosition(refused, 'établissement sans position');
        assert.equal(refused.body.error, PLACE_POSITION_REQUIRED);
        assert.equal(await countNamed('venues', name), 0, 'établissement créé malgré le refus (création non annulée)');
        const ok = await api('POST', 'partner/venues', { token: owner.accessToken, body: { ...body, ...DAKAR } });
        assert.equal(ok.status, 201, show(ok));
        assert.equal(await countNamed('venues', name), 1);
    });

    test('renvoi d’une salle refusée (hall_submit) : position seule manquante = refus simple ; placée = en attente', async () => {
        const hallId = await newHall(owner, { validate: false });
        await setRow('halls', hallId, { address: 'Rue 6, Point E', images: [photoOf('halls', owner.partnerId)] });
        assert.equal((await decideHall(hallId, 'REFUSER', 'Photos à refaire, merci.')).ok, true);
        await setRow('halls', hallId, NO_POSITION);
        const refused = await rpc('hall_submit', { actor_id: owner.userId, hall_id: hallId });
        assert.deepEqual([refused.ok, refused.code, refused.message], [false, 'POSITION_REQUIRED', PLACE_POSITION_REQUIRED]);
        assert.equal(await statusOf('halls', hallId), 'REFUSEE');
        const route = await api('POST', 'partner/halls/[id]/submit', { token: owner.accessToken, params: { id: hallId }, path: `/api/partner/halls/${hallId}/submit`, body: {} });
        refusedForPosition(route, 'renvoi de la salle par la route');
        await setRow('halls', hallId, DAKAR);
        const ok = await rpc('hall_submit', { actor_id: owner.userId, hall_id: hallId });
        assert.equal(ok.ok, true, JSON.stringify(ok));
        assert.equal(await statusOf('halls', hallId), 'EN_ATTENTE_VALIDATION');
    });

    test('renvoi d’un établissement refusé (venue_submit) : position seule manquante = refus simple ; avec d’autres manques, elle est nommée', async () => {
        const venueId = await newVenue(owner, { validate: false });
        await newTable(owner, venueId, 4);
        await setRow('venues', venueId, { photos: [photoOf('venues', owner.partnerId)] });
        assert.equal((await decideVenue(venueId, 'REFUSER', 'Horaires à vérifier.')).ok, true);
        await setRow('venues', venueId, NO_POSITION);
        const refused = await rpc('venue_submit', { actor_id: owner.userId, venue_id: venueId });
        assert.deepEqual([refused.ok, refused.code, refused.message], [false, 'POSITION_REQUIRED', PLACE_POSITION_REQUIRED]);
        const route = await api('POST', 'partner/venues/[id]/submit', { token: owner.accessToken, params: { id: venueId }, path: `/api/partner/venues/${venueId}/submit`, body: {} });
        refusedForPosition(route, 'renvoi de l’établissement par la route');
        await setRow('venues', venueId, { photos: [] });
        const both = await rpc('venue_submit', { actor_id: owner.userId, venue_id: venueId });
        assert.equal(both.code, 'VENUE_INCOMPLETE', JSON.stringify(both));
        assert.match(String(both.message), /une photo au moins, la position sur la carte\.$/);
        await setRow('venues', venueId, { ...DAKAR, photos: [photoOf('venues', owner.partnerId)] });
        const ok = await rpc('venue_submit', { actor_id: owner.userId, venue_id: venueId });
        assert.equal(ok.ok, true, JSON.stringify(ok));
        assert.equal(await statusOf('venues', venueId), 'EN_ATTENTE_VALIDATION');
    });

    test('événement : soumission sans position refusée avec la phrase seule ; placée = en attente', async () => {
        const d = await createDraftEvent(owner, 'cb3-position', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72, position: null });
        const refused = await rpcTransition(d.eventId, owner.userId, 'EN_ATTENTE');
        assert.equal(refused.error, null, refused.error?.message);
        assert.deepEqual([refused.data?.ok, refused.data?.code, refused.data?.message], [false, 'POSITION_REQUIRED', PLACE_POSITION_REQUIRED]);
        assert.equal(await eventStatus(d.eventId), 'BROUILLON');
        await setRow('events', d.eventId, DAKAR);
        const ok = await rpcTransition(d.eventId, owner.userId, 'EN_ATTENTE');
        assert.equal(ok.data?.ok, true, JSON.stringify(ok.data));
    });
});

describe('B — inséré sans position : jamais validé d’office', () => {
    for (const [table, key] of [['halls', 'halls.validation_required'], ['venues', 'tables.validation_required']] as const) {
        test(`${table} : validation non exigée, insertion sans position → en attente ; avec position → validé`, async () => {
            const before0 = await platformSetting(key);
            await setPlatformSetting(key, false, 'test du lot Carte B3');
            try {
                const row: Row = table === 'halls'
                    ? { partner_id: owner.partnerId, name: `TEST cb3 sans position ${Date.now()}`, capacity: 50, price_per_day: 40_000, city: 'Dakar' }
                    : { partner_id: owner.partnerId, name: `TEST cb3 sans position ${Date.now()}`, city: 'Dakar', address: 'Plateau' };
                const without = await service.from(table).insert(row).select('validation_status').single();
                assert.equal(without.error, null, without.error?.message);
                assert.equal(without.data!.validation_status, 'EN_ATTENTE_VALIDATION', 'validé d’office sans position');
                const withPos = await service.from(table).insert({ ...row, name: `${String(row.name)} placé`, ...DAKAR }).select('validation_status').single();
                assert.equal(withPos.error, null, withPos.error?.message);
                assert.equal(withPos.data!.validation_status, 'VALIDEE', 'réglage non suivi avec une position');
            } finally {
                await setPlatformSetting(key, before0, 'test du lot Carte B3');
            }
        });
    }
});

describe('C — l’administration ne valide jamais un dossier sans position', () => {
    test('salle : VALIDER refusé, puis accepté une fois placée ; route de l’administration aussi', async () => {
        const hallId = await newHall(owner, { validate: false, position: null });
        const refused = await decideHall(hallId, 'VALIDER');
        assert.deepEqual([refused.ok, refused.code], [false, 'POSITION_REQUIRED'], JSON.stringify(refused));
        assert.equal(await statusOf('halls', hallId), 'EN_ATTENTE_VALIDATION');
        await setRow('halls', hallId, DAKAR);
        assert.equal((await decideHall(hallId, 'VALIDER')).ok, true);
    });
    test('établissement : VALIDER refusé, puis accepté une fois placé', async () => {
        const venueId = await newVenue(owner, { validate: false, position: null });
        const refused = await decideVenue(venueId, 'VALIDER');
        assert.deepEqual([refused.ok, refused.code], [false, 'POSITION_REQUIRED'], JSON.stringify(refused));
        assert.equal(await statusOf('venues', venueId), 'EN_ATTENTE_VALIDATION');
        await setRow('venues', venueId, DAKAR);
        assert.equal((await decideVenue(venueId, 'VALIDER')).ok, true);
    });
    test('déjà publié sans position : suspension puis RÉACTIVATION acceptées (reste en ligne)', async () => {
        const hallId = await newHall(owner);
        await setRow('halls', hallId, NO_POSITION);
        assert.equal((await decideHall(hallId, 'SUSPENDRE', 'Contrôle du lot Carte B3.')).ok, true);
        const back = await decideHall(hallId, 'REACTIVER');
        assert.equal(back.ok, true, JSON.stringify(back));
        assert.equal(await statusOf('halls', hallId), 'VALIDEE');
        const venueId = await newVenue(owner);
        await setRow('venues', venueId, NO_POSITION);
        assert.equal((await decideVenue(venueId, 'SUSPENDRE', 'Contrôle du lot Carte B3.')).ok, true);
        assert.equal((await decideVenue(venueId, 'REACTIVER')).ok, true);
    });
    test('événement : EN_ATTENTE → VALIDE refusé sans position, accepté une fois placé', async () => {
        const d = await createDraftEvent(owner, 'cb3-validation', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        assert.equal((await rpcTransition(d.eventId, owner.userId, 'EN_ATTENTE')).data?.ok, true);
        await setRow('events', d.eventId, NO_POSITION);
        const admin = await superadminId();
        const refused = await rpcTransition(d.eventId, admin, 'VALIDE');
        assert.deepEqual([refused.data?.ok, refused.data?.code], [false, 'POSITION_REQUIRED'], JSON.stringify(refused.data));
        assert.equal(await eventStatus(d.eventId), 'EN_ATTENTE');
        await setRow('events', d.eventId, DAKAR);
        assert.equal((await rpcTransition(d.eventId, admin, 'VALIDE')).data?.ok, true);
    });
});

describe('D — une position ne se retire pas par les routes de la partenaire', () => {
    test('salle (PUT) et établissement (PATCH) : 400 POSITION_REQUIRED, position gardée', async () => {
        const hallId = await newHall(owner);
        const hall = await api('PUT', 'partner/halls/[id]', { token: owner.accessToken, params: { id: hallId }, path: `/api/partner/halls/${hallId}`, body: NO_POSITION });
        refusedForPosition(hall, 'salle');
        const venueId = await newVenue(owner);
        const venue = await api('PATCH', 'partner/venues/[id]', { token: owner.accessToken, params: { id: venueId }, path: `/api/partner/venues/${venueId}`, body: NO_POSITION });
        refusedForPosition(venue, 'établissement');
        const { data } = await service.from('halls').select('latitude').eq('id', hallId).single();
        assert.notEqual(data!.latitude, null);
    });
});

describe('E — pilotage : bandeau de la position manquante', () => {
    test('événement publié sans position : has_position false ; placé : true', async () => {
        const ev = await createTimedEvent(owner.partnerId, 'cb3-bandeau', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 48 });
        const read = () => api('GET', 'partner/events/[id]/pilotage/overview', { token: owner.accessToken, params: { id: ev.eventId }, path: `/api/partner/events/${ev.eventId}/pilotage/overview` });
        await setRow('events', ev.eventId, NO_POSITION);
        const without = await read();
        assert.equal(without.status, 200, show(without));
        assert.equal(without.body.has_position, false, show(without));
        await setRow('events', ev.eventId, DAKAR);
        const withPos = await read();
        assert.equal(withPos.body.has_position, true, show(withPos));
    });
});
