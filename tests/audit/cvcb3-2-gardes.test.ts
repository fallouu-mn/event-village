/**
 * Contre-vérification du lot Carte B3 (branche carte-b3/cv-rouges, jamais fusionnée) — garde-fous : chaque test est VERT
 * quand l'attaque est bloquée. Base locale seulement ; lectures publiques par les routes (sans session), par la clé anon
 * ou par le jeton d'un attaquant, jamais par la clé de service.
 *
 *  G1. Recherche : seul ce qui est publié est comparé au texte tapé (salle en attente, salle suspendue, établissement
 *      refusé : un mot de leur adresse ne les retrouve pas) ; la raison sociale d'une partenaire QUI A un nom commercial
 *      ne retrouve rien.
 *  G2. Suspension : salle et établissement suspendus absents de la fiche (ancienne URL : 404), de la recherche et de la
 *      carte ; partenaire suspendue : ses lieux aussi ; réactivés : de retour.
 *  G3. Interrupteurs fermés : GET /api/lieux/carte (couche salles ou restaurants) et les fiches répondent 404.
 *  G4. Ni l'identifiant du compte de la partenaire, ni son téléphone, ni son adresse électronique dans les réponses
 *      publiques des lieux ; la table partners n'est pas lisible par l'attaquant.
 *  G5. Événement suspendu : absent de la carte ; sa fiche (ancienne URL) n'est plus achetable (contrat E du lot 5 : la
 *      fiche reste lisible avec le bandeau, point laissé au client dans le rapport).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { anonClient, api, setFiche, show, userClient, type Reply } from './cvf1-helpers';
import { newBuyer, service, type Buyer } from '../parcours/paiement-helpers';
import { newPartner, superadminId, type TestPartner } from '../parcours/finance-helpers';
import { decideHall, newHall, openHallsService, platformSetting, setPlatformSetting } from '../parcours/l10a-helpers';
import { decideVenue, newTable, newVenue, openTablesService } from '../parcours/l11a-helpers';
import { createDraftEvent, rpcTransition } from '../parcours/cycle-helpers';
import { readPlaceEntries } from '../../lib/lieux/carte-lieux.server';
import { readMapEntries } from '../../lib/events/map-data.server';

const TOKEN = `gcb3${randomBytes(4).toString('hex')}`;

let restoreHalls: () => Promise<void>;
let restoreTables: () => Promise<void>;
let owner: TestPartner;
let attacker: Buyer;

const text = (v: unknown): string => JSON.stringify(v);
const hallSheet = (id: string): Promise<Reply> => api('GET', 'halls/[id]', { params: { id }, path: `/api/halls/${id}` });
const venueSheet = (id: string): Promise<Reply> => api('GET', 'tables/[id]', { params: { id }, path: `/api/tables/${id}` });
const venueTables = (id: string): Promise<Reply> => api('GET', 'restaurants/[id]/tables', { params: { id }, path: `/api/restaurants/${id}/tables` });
const searchHalls = (q: string): Promise<Reply> => api('GET', 'halls', { path: `/api/halls?q=${encodeURIComponent(q)}` });
const searchVenues = (q: string): Promise<Reply> => api('GET', 'tables', { path: `/api/tables?q=${encodeURIComponent(q)}` });
const onMap = async (id: string): Promise<boolean> => (await readPlaceEntries()).some((p) => p.id === id);

async function setAddress(table: 'halls' | 'venues', id: string, address: string): Promise<void> {
    const { error } = await service.from(table).update({ address }).eq('id', id);
    assert.equal(error, null, error?.message);
}

before(async () => {
    restoreHalls = await openHallsService();
    restoreTables = await openTablesService();
    owner = await newPartner('gcb3');
    attacker = await newBuyer('gcb3-attaquant');
});

after(async () => {
    await restoreHalls();
    await restoreTables();
});

describe('G1 — recherche : seul le publié est comparé', () => {
    test('salle en attente, salle suspendue, établissement refusé : un mot de leur adresse ne les retrouve pas', async () => {
        const pending = await newHall(owner, { validate: false, position: null }); // jamais validée d'office sans position
        await setAddress('halls', pending, `Villa ${TOKEN}a`);
        const suspended = await newHall(owner);
        await setAddress('halls', suspended, `Villa ${TOKEN}b`);
        assert.equal((await decideHall(suspended, 'SUSPENDRE', 'contre-vérification')).ok, true);
        const refused = await newVenue(owner, { validate: false, position: null });
        await newTable(owner, refused, 4);
        await setAddress('venues', refused, `Maison ${TOKEN}c`);
        assert.equal((await decideVenue(refused, 'REFUSER', 'contre-vérification')).ok, true);
        for (const [what, r] of [
            ['salle en attente', await searchHalls(`${TOKEN}a`)], ['salle suspendue', await searchHalls(`${TOKEN}b`)],
            ['établissement refusé', await searchVenues(`${TOKEN}c`)],
        ] as const) {
            assert.equal(r.status, 200, `${what} : ${show(r)}`);
            assert.equal(r.body.total, 0, `${what} retrouvé : ${show(r)}`);
        }
    });

    test('raison sociale d’une partenaire avec nom commercial : ne retrouve rien', async () => {
        const hallId = await newHall(owner);
        const { data } = await service.from('partners').select('company_name').eq('id', owner.partnerId).single();
        const legal = String(data?.company_name);
        const r = await searchHalls(legal);
        assert.ok(!((r.body.halls ?? []) as Array<{ id: string }>).some((h) => h.id === hallId), `salle retrouvée par la raison sociale : ${show(r)}`);
    });
});

describe('G2 — suspendu : jamais visible, même par une ancienne URL', () => {
    test('salle : suspendue absente (fiche 404, recherche, carte) ; réactivée : de retour', async () => {
        const hallId = await newHall(owner);
        await setAddress('halls', hallId, `Villa ${TOKEN}s`);
        assert.equal((await hallSheet(hallId)).status, 200);
        assert.ok(await onMap(hallId), 'salle validée absente de la carte');
        assert.equal((await decideHall(hallId, 'SUSPENDRE', 'contre-vérification')).ok, true);
        const sheet = await hallSheet(hallId);
        assert.equal(sheet.status, 404, show(sheet));
        assert.equal((await searchHalls(`${TOKEN}s`)).body.total, 0);
        assert.equal(await onMap(hallId), false, 'salle suspendue sur la carte');
        assert.equal((await decideHall(hallId, 'REACTIVER')).ok, true);
        assert.equal((await hallSheet(hallId)).status, 200);
        assert.ok(await onMap(hallId), 'salle réactivée absente de la carte');
    });

    test('établissement : suspendu absent (deux fiches 404, carte) ; réactivé : de retour', async () => {
        const venueId = await newVenue(owner);
        await newTable(owner, venueId, 4);
        assert.equal((await venueSheet(venueId)).status, 200);
        assert.equal((await decideVenue(venueId, 'SUSPENDRE', 'contre-vérification')).ok, true);
        for (const r of [await venueSheet(venueId), await venueTables(venueId)]) assert.equal(r.status, 404, show(r));
        assert.equal(await onMap(venueId), false, 'établissement suspendu sur la carte');
        assert.equal((await decideVenue(venueId, 'REACTIVER')).ok, true);
        assert.equal((await venueSheet(venueId)).status, 200);
        assert.ok(await onMap(venueId), 'établissement réactivé absent de la carte');
    });

    test('partenaire suspendue : ses salles et établissements disparaissent (fiches 404, carte)', async () => {
        const other = await newPartner('gcb3-susp');
        const hallId = await newHall(other);
        const venueId = await newVenue(other);
        await newTable(other, venueId, 4);
        await setFiche(other.partnerId, 'SUSPENDU');
        try {
            for (const r of [await hallSheet(hallId), await venueSheet(venueId), await venueTables(venueId)]) assert.equal(r.status, 404, show(r));
            assert.deepEqual([await onMap(hallId), await onMap(venueId)], [false, false]);
        } finally {
            await setFiche(other.partnerId, 'VALIDE');
        }
    });
});

describe('G3 — interrupteurs fermés : 404', () => {
    for (const [feature, layer, sheet] of [
        ['features.halls_enabled', 'salles', 'halls/[id]'], ['features.tables_enabled', 'restaurants', 'tables/[id]'],
    ] as const) {
        test(`${feature} fermé : couche « ${layer} » et fiche en 404`, async () => {
            const id = layer === 'salles' ? await newHall(owner) : await newVenue(owner);
            const before0 = await platformSetting(feature);
            await setPlatformSetting(feature, false, 'contre-vérification carte B3');
            try {
                const layerReply = await api('GET', 'lieux/carte', { path: `/api/lieux/carte?couche=${layer}` });
                const sheetReply = await api('GET', sheet, { params: { id }, path: `/api/${sheet.replace('[id]', id)}` });
                assert.deepEqual([layerReply.status, sheetReply.status], [404, 404], `${show(layerReply)} | ${show(sheetReply)}`);
                assert.ok(!text(layerReply.body).includes(id), show(layerReply));
            } finally {
                await setPlatformSetting(feature, before0, 'contre-vérification carte B3');
            }
        });
    }
});

describe('G4 — aucune donnée de compte de la partenaire', () => {
    test('fiches, recherches et carte : ni identifiant de compte, ni téléphone, ni adresse électronique', async () => {
        const hallId = await newHall(owner);
        const venueId = await newVenue(owner);
        await newTable(owner, venueId, 4);
        const { data: pa } = await service.from('partners').select('user_id, phone, email').eq('id', owner.partnerId).single();
        const secrets = [pa?.user_id, pa?.phone, pa?.email].filter((x): x is string => typeof x === 'string' && x.length > 0);
        assert.ok(secrets.length === 3, `données de la partenaire lues : ${secrets.length}`);
        const { data: names } = await service.from('halls').select('name').eq('id', hallId).single();
        const replies: Array<[string, unknown]> = [
            ['fiche de la salle', (await hallSheet(hallId)).body], ['recherche des salles', (await searchHalls(String(names?.name))).body],
            ['fiche de l’établissement', (await venueSheet(venueId)).body], ['tables de l’établissement', (await venueTables(venueId)).body],
            ['carte', (await readPlaceEntries()).filter((p) => p.id === hallId || p.id === venueId)],
        ];
        const leaks = replies.flatMap(([what, body]) => secrets.filter((s) => text(body).includes(s)).map((s) => `${what} : ${s}`));
        assert.deepEqual(leaks, []);
    });

    test('REST partners : aucune ligne pour la clé anon ni pour l’attaquant', async () => {
        for (const client of [anonClient(), userClient(attacker.accessToken)]) {
            const { data } = await client.from('partners').select('id').eq('id', owner.partnerId);
            assert.deepEqual(data ?? [], []);
        }
    });
});

describe('G5 — événement suspendu', () => {
    test('absent de la carte ; fiche (ancienne URL) non achetable', async () => {
        const d = await createDraftEvent(owner, 'gcb3-susp', [{ name: 'Standard', price: 1000, total: 10 }], { startsInHours: 72 });
        const admin = await superadminId();
        const steps: Array<[string, string, string | undefined]> = [
            [owner.userId, 'EN_ATTENTE', undefined], [admin, 'VALIDE', undefined], [owner.userId, 'PUBLIE', undefined], [admin, 'SUSPENDU', 'contre-vérification'],
        ];
        for (const [actor, to, reason] of steps) {
            const r = await rpcTransition(d.eventId, actor, to, reason);
            assert.equal(r.data?.ok, true, `${to} : ${JSON.stringify(r.data)}`);
        }
        assert.equal((await readMapEntries()).some((e) => e.pub.id === d.eventId), false, 'événement suspendu sur la carte');
        const sheet = await api('GET', 'events/[id]', { params: { id: d.eventId }, path: `/api/events/${d.eventId}` });
        const ev = (sheet.body.event ?? {}) as { status?: string; purchasable?: boolean };
        assert.equal(sheet.status, 200, show(sheet));
        assert.deepEqual([ev.status, ev.purchasable], ['SUSPENDU', false], show(sheet));
    });
});
