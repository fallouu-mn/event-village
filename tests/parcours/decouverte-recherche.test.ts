/**
 * Lot 8, tâche 8.3 d, anomalie A14 (contrat 13.4, CDC §16) — preuve de la recherche publique : `q` et `city` sur
 * GET /api/events n'avaient aucun test. GARDE-FOUS ANNONCÉS VERTS DÈS L'ÉCRITURE (AR7) : le code n'est pas changé, tout
 * rouge est une anomalie à instruire.
 *  1. `q` cherche dans le titre, le lieu et le nom de l'organisateur, sans tenir compte de la casse ;
 *  2. `q` inconnu : liste vide, 200 ; `q` fait d'espaces : aucun filtre ;
 *  3. `city` filtre sur la ville servie (en capitales) ; ALL n'est pas un filtre ;
 *  4. `q` et `city` se combinent ;
 *  5. un événement non public n'est jamais trouvé, même par son titre exact ; une fiche n'expose aucun stock.
 *
 * Les événements portent des marques propres à la suite : chaque comparaison ne lit que ses lignes.
 * Limite signalée : les écrans n'appellent pas ces paramètres, app/explore/page.tsx filtre côté navigateur la liste
 * complète (lib/events/catalog-client.ts:62). Cette suite prouve donc la route, pas l'écran de recherche.
 * Suite qui écrit, annoncée verte : assertTerrainInvariants (Conventions).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as eventsRoute } from '../../app/api/events/route';
import { createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { BASE_URL } from './helpers';
import { createSaleEvent, service } from './paiement-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

type PublicEvent = Record<string, unknown>;

const MARK = randomUUID().replace(/-/g, '').slice(0, 10).toLowerCase();
const TITLE_DAKAR = `festivalx${MARK}`;
const TITLE_SAINT_LOUIS = `concertx${MARK}`;
const TITLE_DRAFT = `brouillonx${MARK}`;
const VENUE_MARK = `salle${MARK}`;
const PARTNER_MARK = `orga${MARK}`;

let partner: TestPartner;
let dakarId: string;
let saintLouisId: string;
let draftId: string;

async function publicEvent(label: string, title: string, location: string, city: string): Promise<string> {
    const { eventId } = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price: 2000, total: 10 }]);
    const { error } = await service.from('events').update({ title, location, city }).eq('id', eventId);
    assert.equal(error, null, `événement ${label} : ${error?.message}`);
    return eventId;
}

before(async () => {
    partner = await newPartner(PARTNER_MARK);
    const { data, error } = await service.from('partners').select('commercial_name').eq('id', partner.partnerId).single();
    assert.equal(error, null, `partenaire : ${error?.message}`);
    assert.ok(String(data.commercial_name).includes(PARTNER_MARK), 'précondition : le nom de l’organisateur porte la marque');

    dakarId = await publicEvent('recherche-dakar', `Grand ${TITLE_DAKAR} du Sénégal`, 'Théâtre Sorano, Dakar', 'Dakar');
    saintLouisId = await publicEvent('recherche-saint-louis', `Nuit ${TITLE_SAINT_LOUIS}`, `${VENUE_MARK}, quai Roume`, 'Saint-Louis');

    const draft = await createSaleEvent(`recherche-${MARK}`, [{ name: 'Standard', price: 2000, total: 10 }], { status: 'BROUILLON' });
    draftId = draft.eventId;
    const { error: draftErr } = await service.from('events').update({ title: `Avant-première ${TITLE_DRAFT}`, city: 'Saint-Louis' }).eq('id', draftId);
    assert.equal(draftErr, null, `brouillon : ${draftErr?.message}`);
});

after(async () => {
    await assertTerrainInvariants('decouverte-recherche');
});

async function search(params: Record<string, string> = {}): Promise<PublicEvent[]> {
    const query = new URLSearchParams(params).toString();
    const res = await eventsRoute(new NextRequest(`${BASE_URL}/api/events${query ? `?${query}` : ''}`));
    const body = await res.json() as { events?: PublicEvent[] };
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 400));
    assert.ok(Array.isArray(body.events), `liste absente : ${JSON.stringify(body).slice(0, 400)}`);
    return body.events;
}

/** Identifiants trouvés parmi les trois événements de la suite. */
function own(events: PublicEvent[]): string[] {
    return events.map((e) => String(e.id)).filter((id) => [dakarId, saintLouisId, draftId].includes(id)).sort();
}

const sorted = (...ids: string[]): string[] => [...ids].sort();

describe('A14 — GET /api/events : recherche q (§16)', () => {
    test('témoin : sans filtre, les deux événements publics sont listés, le brouillon non', async () => {
        assert.deepEqual(own(await search()), sorted(dakarId, saintLouisId));
    });

    test('par titre, sans tenir compte de la casse', async () => {
        assert.deepEqual((await search({ q: TITLE_DAKAR })).map((e) => e.id), [dakarId]);
        assert.deepEqual((await search({ q: TITLE_DAKAR.toUpperCase() })).map((e) => e.id), [dakarId]);
    });

    test('par lieu', async () => {
        assert.deepEqual((await search({ q: VENUE_MARK })).map((e) => e.id), [saintLouisId]);
    });

    test('par nom de l’organisateur', async () => {
        assert.deepEqual(sorted(...(await search({ q: PARTNER_MARK })).map((e) => String(e.id))), sorted(dakarId, saintLouisId));
    });

    test('rien de trouvé : liste vide, 200', async () => {
        assert.deepEqual(await search({ q: `introuvablex${MARK}` }), []);
    });

    test('espaces seuls : aucun filtre', async () => {
        assert.deepEqual(own(await search({ q: '   ' })), sorted(dakarId, saintLouisId));
    });
});

describe('A14 — GET /api/events : ville et combinaison', () => {
    test('city filtre sur la ville servie, en capitales', async () => {
        const events = await search({ city: 'SAINT-LOUIS' });
        assert.deepEqual(own(events), [saintLouisId], 'seul l’événement de Saint-Louis');
        assert.ok(events.every((e) => e.city === 'SAINT-LOUIS'), `ville d’une autre ligne : ${JSON.stringify(events.map((e) => e.city))}`);
        assert.deepEqual(own(await search({ city: 'DAKAR' })), [dakarId], 'seul l’événement de Dakar');
    });

    test('ALL n’est pas un filtre', async () => {
        assert.deepEqual(own(await search({ city: 'ALL' })), sorted(dakarId, saintLouisId));
    });

    test('q et city se combinent', async () => {
        assert.deepEqual((await search({ q: PARTNER_MARK, city: 'SAINT-LOUIS' })).map((e) => e.id), [saintLouisId]);
        assert.deepEqual(await search({ q: TITLE_DAKAR, city: 'SAINT-LOUIS' }), [], 'le titre de Dakar n’est pas à Saint-Louis');
    });
});

describe('A14 — ce que la recherche ne doit pas montrer', () => {
    test('un événement non public n’est jamais trouvé, même par son titre exact', async () => {
        assert.deepEqual(await search({ q: TITLE_DRAFT }), []);
        assert.deepEqual(own(await search({ city: 'SAINT-LOUIS', q: MARK })), [saintLouisId]);
    });

    test('une fiche trouvée n’expose ni catégorie ni stock', async () => {
        const [found] = await search({ q: TITLE_DAKAR });
        assert.ok(found, 'événement trouvé');
        const raw = JSON.stringify(found);
        for (const hidden of ['ticket_categories', 'total_quantity', 'sold_quantity', 'is_visible']) {
            assert.equal(raw.includes(hidden), false, `${hidden} exposé par la recherche`);
        }
        assert.equal(found.price, 2000, 'prix « à partir de » du serveur');
    });
});
