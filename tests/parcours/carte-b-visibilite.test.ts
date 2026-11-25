/**
 * Lot Carte B (B0) — visibilité sur la carte et le calendrier d'Explorer, sur la base locale (lecture réelle :
 * readMapEntries, celle que la route met en cache, puis selectMapEvents, celle que la route rend) :
 *  - rendu : un événement PUBLIE, à venir, avec position ;
 *  - jamais rendus : brouillon, en attente, validé (non publié), suspendu, annulé, terminé (statut TERMINE, même encore
 *    dans ses heures), publié mais fini (fin passée, avant le passage de la tâche planifiée), publié sans position ;
 *  - aucun champ en trop : chaque événement rendu n'a que PUBLIC_MAP_FIELDS ; ni le nom de la partenaire, ni son
 *    téléphone, ni son adresse électronique, ni le lieu en clair, ni la description n'apparaissent dans la réponse ;
 *  - une suspension retire l'événement à la lecture suivante (la disparition en moins de 5 s À TRAVERS le cache est
 *    prouvée de bout en bout par e2e/carte-b.responsive.spec.ts) ;
 *  - zone et période : un événement hors de la zone ou de la période demandées n'est pas rendu.
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent } from './acces-helpers';
import { createEventInStatus, rpcTransition, assertRpcOk, shiftEventDates, type EventStatus } from './cycle-helpers';
import { loadFixtures } from '../helpers/fixtures';
import { service } from './paiement-helpers';
import { readMapEntries } from '../../lib/events/map-data.server';
import { parseMapQuery, selectMapEvents, type MapQuery } from '../../lib/events/map-data';
import { PUBLIC_MAP_FIELDS, type PublicMapEvent } from '../../lib/events/map-shared';

const STAMP = Date.now();
const CATS = [{ name: 'Standard', price: 2500, total: 40 }];
const SECRET_PLACE = `Lieu confidentiel carte-b ${STAMP}`;

let P: TestPartner;
const ids: Record<string, string> = {};

function query(raw = ''): MapQuery {
    const q = parseMapQuery(new URLSearchParams(raw));
    assert.ok(q.ok, `paramètres ${raw} : ${q.ok ? '' : q.message}`);
    return q.query;
}

async function mapNow(raw = ''): Promise<PublicMapEvent[]> {
    return selectMapEvents(await readMapEntries(), query(raw), new Date()).events;
}

before(async () => {
    P = await newPartner('carteb');
    const common = { startsInHours: 48, location: SECRET_PLACE, city: 'Dakar' };
    const plan: Array<[string, EventStatus, Record<string, unknown>]> = [
        ['brouillon', 'BROUILLON', {}],
        ['enAttente', 'EN_ATTENTE', {}],
        ['valide', 'VALIDE', {}],
        ['publie', 'PUBLIE', { position: { latitude: 14.7444, longitude: -17.5136 } }],
        ['suspendu', 'SUSPENDU', { suspendReason: 'Contrôle carte B' }],
        ['annule', 'ANNULE', { publicNotice: 'Événement annulé pour le test de la carte.', internalReason: 'Test carte B' }],
        ['termine', 'TERMINE', { finishShift: { startsInHours: -3 } }],
        ['publieFini', 'PUBLIE', {}],
        ['aSuspendre', 'PUBLIE', { position: { latitude: 16.0179, longitude: -16.4896 } }],
    ];
    for (const [key, status, extra] of plan) {
        const ev = await createEventInStatus(P, `carteb-${key}`, CATS, status, { ...common, title: `Carte B ${key} ${STAMP}`, ...extra });
        ids[key] = ev.eventId;
    }
    // Publié puis fini (fin passée) : la tâche planifiée ne l'a pas encore clos
    await shiftEventDates(ids.publieFini, { startsInHours: -6, durationHours: 1 });
    // Publié sans position (événement ancien, d'avant la finition 2a, qui rend la position obligatoire à la soumission) :
    // publié par les aides (qui posent une position pour soumettre), puis position retirée par le rôle de service, comme
    // un événement publié avant la finition 2a (run 595 : l'aide pose la position, le montage doit la retirer)
    ids.sansPosition = (await createTimedEvent(P.partnerId, 'carteb-sans-position', CATS, { startsInHours: 48 })).eventId;
    const { error: posErr } = await service.from('events').update({ latitude: null, longitude: null }).eq('id', ids.sansPosition);
    assert.equal(posErr, null, `montage : position retirée (${posErr?.message})`);
    const { data, error } = await service.from('events').select('id, status, latitude, longitude').in('id', Object.values(ids));
    assert.equal(error, null, `relecture du montage : ${error?.message}`);
    const byId = new Map((data ?? []).map((r) => [r.id as string, r]));
    assert.equal(byId.get(ids.sansPosition)?.status, 'PUBLIE', 'montage : publié sans position');
    assert.equal(byId.get(ids.sansPosition)?.latitude, null, 'montage : sans latitude');
    assert.equal(byId.get(ids.termine)?.status, 'TERMINE', 'montage : terminé');
});

describe('carte B — seuls les événements publiés, à venir, avec position', () => {
    test('le publié avec position est rendu ; brouillon, en attente, validé, suspendu, annulé, terminé, fini, sans position jamais', async () => {
        const shown = new Set((await mapNow()).map((e) => e.id));
        assert.ok(shown.has(ids.publie), 'événement publié à venir avec position : rendu');
        for (const key of ['brouillon', 'enAttente', 'valide', 'suspendu', 'annule', 'termine', 'publieFini', 'sansPosition']) {
            assert.ok(!shown.has(ids[key]), `${key} : jamais rendu`);
        }
        // Événements du seed de test (statuts BROUILLON, TERMINE, ANNULE, avec position) : jamais rendus non plus
        const fx = await loadFixtures();
        for (const [key, ev] of Object.entries(fx.events)) {
            if (ev.status !== 'PUBLIE') assert.ok(!shown.has(ev.id), `seed ${key} (${ev.status}) : jamais rendu`);
        }
    });

    test('aucun champ en trop : identifiant, titre, dates, prix d’appel, couleur, image floutée, mise en avant, position', async () => {
        const events = await mapNow();
        assert.ok(events.length > 0, 'au moins un événement');
        for (const e of events) assert.deepEqual(Object.keys(e).sort(), [...PUBLIC_MAP_FIELDS].sort(), `champs de ${e.id}`);
        const mine = events.find((e) => e.id === ids.publie);
        assert.ok(mine);
        assert.equal(mine.price, 2500, 'prix d’appel');
        assert.equal(mine.lat, 14.7444);
        assert.equal(mine.lng, -17.5136);
        const { data: partner } = await service.from('partners').select('company_name, commercial_name, phone, email').eq('id', P.partnerId).single();
        const { data: row } = await service.from('events').select('description').eq('id', ids.publie).single();
        const description = String(row?.description ?? '');
        if (description.length >= 10) assert.ok(!JSON.stringify(mine).includes(description), 'description absente');
        const body = JSON.stringify({ events });
        for (const secret of [partner?.company_name, partner?.commercial_name, partner?.phone, partner?.email, P.partnerId, P.userId, SECRET_PLACE]) {
            assert.ok(secret, 'donnée de contrôle présente');
            assert.ok(!body.includes(String(secret)), `la réponse ne contient pas « ${secret} »`);
        }
    });

    test('suspension : l’événement n’est plus rendu à la lecture suivante', async () => {
        assert.ok((await mapNow()).some((e) => e.id === ids.aSuspendre), 'avant : rendu');
        const fx = await loadFixtures();
        assertRpcOk(await rpcTransition(ids.aSuspendre, fx.users.SUPERADMIN.id, 'SUSPENDU', 'Contrôle carte B'), 'suspension');
        assert.ok(!(await mapNow()).some((e) => e.id === ids.aSuspendre), 'après : retiré');
    });

    test('zone et période : hors zone ou hors période, pas rendu', async () => {
        // Almadies (14,7444 ; -17,5136) dans une zone autour de Dakar, pas dans une zone autour de Saint-Louis
        assert.ok((await mapNow('zone=14.6,-17.6,14.8,-17.3')).some((e) => e.id === ids.publie), 'zone de Dakar');
        assert.ok(!(await mapNow('zone=15.9,-16.6,16.1,-16.3')).some((e) => e.id === ids.publie), 'zone de Saint-Louis');
        const start = new Date(Date.now() + 48 * 3600_000).toISOString().slice(0, 10);
        const next = new Date(Date.parse(`${start}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
        const after2 = new Date(Date.parse(`${start}T00:00:00Z`) + 10 * 86_400_000).toISOString().slice(0, 10);
        const after3 = new Date(Date.parse(`${start}T00:00:00Z`) + 11 * 86_400_000).toISOString().slice(0, 10);
        assert.ok((await mapNow(`du=${start}&au=${next}`)).some((e) => e.id === ids.publie), 'jour de l’événement');
        assert.ok(!(await mapNow(`du=${after2}&au=${after3}`)).some((e) => e.id === ids.publie), 'autre période');
    });
});
