/**
 * Lot 9 bis, tâche 45 (ex-10.0 e ; contrat 5.45, B94, 4.3) — recherche et villes insensibles aux accents (GET /api/events,
 * route publique) :
 *  1. `q=thies…` trouve la ville « Thiès… » ; `q=FETE…` trouve le titre « Fête… » ;
 *  2. `city=THIES…` trouve « Thiès… » et « THIES… » (même ville pliée) ;
 *  3. `cities` : « Thiès… » et « THIES… » ne font qu'une ville ;
 *  4. `foldText` (lib/text/fold.ts) : accents retirés, œ et æ dépliés, minuscules, espaces repliés.
 * Villes et titres portent une marque propre à la suite : chaque comparaison ne lit que ses lignes. Aucune donnée
 * réécrite par la route (B94) : les lignes gardent leur forme saisie.
 * Ex-10.0 f (questions Q1 à Q6 et N2 fermées) : contrôlé par tests/schema/recette-matrice.test.ts (écart WhatsApp, tâche 44).
 *
 * Rouge avant correctif (fix(9b.45) de S-E : lib/text/fold.ts, app/api/events/route.ts, lib/events/catalog.server.ts) :
 * `q` comparé par toLowerCase et includes (app/api/events/route.ts:34-66), `city` par toUpperCase et égalité,
 * `cities` dédoublonnées sur la forme en capitales (lib/events/catalog.server.ts:93) ; lib/text/fold.ts absent.
 * after() : la garde de schéma du lot 9 bis nomme les objets absents jusqu'à M12 (attendu, contrat section 10).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { GET as eventsRoute } from '../../app/api/events/route';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { BASE_URL } from './helpers';
import { importModule, service } from './paiement-helpers';

interface CatalogReply { events: Array<Record<string, unknown>>; cities: unknown }

/** Marque de 8 lettres (chiffres hexadécimaux changés en lettres g à p), sans accent ni chiffre. */
const MARK = randomBytes(4).toString('hex').replace(/\d/g, (d) => 'ghijklmnop'[Number(d)]);
/** Ville accentuée et sa forme en capitales sans accent : même ville une fois pliée. */
const CITY_ACCENT = `Thièsx${MARK}`;
const CITY_PLAIN = `THIESX${MARK.toUpperCase()}`;
const TITLE_FETE = `Grande Fête ${MARK}`;

let partner: TestPartner;
let idAccent: string;
let idPlain: string;
let idFete: string;

async function publicEvent(label: string, fields: { city?: string; title?: string }): Promise<string> {
    const { eventId } = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price: 2000, total: 10 }]);
    const { error } = await service.from('events').update({ location: 'Salle de test', ...fields }).eq('id', eventId);
    assert.equal(error, null, `événement ${label} : ${error?.message}`);
    return eventId;
}

before(async () => {
    assert.ok(/^[a-p]{8}$/.test(MARK), `marque de la suite en lettres : ${MARK}`);
    partner = await newPartner(`rech-9bis-${MARK.slice(0, 4)}`);
    idAccent = await publicEvent('recherche-9bis-accent', { city: CITY_ACCENT });
    idPlain = await publicEvent('recherche-9bis-plain', { city: CITY_PLAIN });
    idFete = await publicEvent('recherche-9bis-fete', { title: TITLE_FETE, city: 'Dakar' });
});

after(async () => {
    await assertLot9bisInvariants('decouverte-recherche-lot9bis');
});

async function search(params: Record<string, string> = {}): Promise<CatalogReply> {
    const query = new URLSearchParams(params).toString();
    const res = await eventsRoute(new NextRequest(`${BASE_URL}/api/events${query ? `?${query}` : ''}`));
    const body = await res.json() as Partial<CatalogReply>;
    assert.equal(res.status, 200, JSON.stringify(body).slice(0, 400));
    assert.ok(Array.isArray(body.events), `liste absente : ${JSON.stringify(body).slice(0, 400)}`);
    return { events: body.events, cities: body.cities };
}

/** Identifiants trouvés parmi les événements de la suite, triés. */
function own(reply: CatalogReply): string[] {
    return reply.events.map((e) => String(e.id)).filter((id) => [idAccent, idPlain, idFete].includes(id)).sort();
}

const sorted = (...ids: string[]): string[] => [...ids].sort();

/** Pliage indépendant du module testé (oracle du test) : accents retirés, minuscules. */
function oracleFold(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

describe('ex-10.0 e — `q` insensible aux accents', () => {
    test('q sans accent trouve la ville accentuée : « thiesx… » → « Thièsx… »', async () => {
        assert.deepEqual(own(await search({ q: `thiesx${MARK}` })), sorted(idAccent, idPlain),
            'les deux formes de la ville (aujourd’hui seule « THIESX… » répond)');
    });

    test('q en capitales sans accent trouve le titre accentué : « FETE … » → « Grande Fête … »', async () => {
        assert.deepEqual(own(await search({ q: `FETE ${MARK.toUpperCase()}` })), [idFete], 'titre « Fête » (aujourd’hui aucun résultat)');
    });

    test('témoin : q avec l’accent trouve toujours la ville accentuée', async () => {
        assert.ok(own(await search({ q: CITY_ACCENT })).includes(idAccent), 'recherche exacte');
    });
});

describe('ex-10.0 e — `city` et `cities` pliées', () => {
    test('city=THIESX… trouve « Thièsx… » et « THIESX… »', async () => {
        assert.deepEqual(own(await search({ city: CITY_PLAIN })), sorted(idAccent, idPlain), 'même ville une fois pliée (aujourd’hui « THIÈSX… » manque)');
    });

    test('cities : « Thièsx… » et « THIESX… » ne font qu’une ville', async () => {
        const reply = await search();
        assert.ok(Array.isArray(reply.cities), `cities absent : ${JSON.stringify(reply.cities)}`);
        const mine = (reply.cities as unknown[]).map(String).filter((c) => oracleFold(c) === oracleFold(CITY_PLAIN));
        assert.equal(mine.length, 1, `une seule ville pour les deux formes (aujourd’hui deux) : ${JSON.stringify(mine)}`);
        assert.ok([CITY_ACCENT, CITY_PLAIN, CITY_ACCENT.toUpperCase()].includes(mine[0]), `forme affichée tirée des événements : ${mine[0]}`);
    });

    test('aucune donnée réécrite : les deux événements gardent leur ville saisie', async () => {
        const { data, error } = await service.from('events').select('id, city').in('id', [idAccent, idPlain]);
        assert.equal(error, null, error?.message);
        assert.deepEqual(Object.fromEntries((data ?? []).map((r) => [String(r.id), r.city])), { [idAccent]: CITY_ACCENT, [idPlain]: CITY_PLAIN });
    });
});

describe('ex-10.0 e — foldText (lib/text/fold.ts)', () => {
    test('accents retirés, œ et æ dépliés, minuscules, espaces repliés', async () => {
        let mod: { foldText?: (s: string) => string };
        try {
            mod = (await importModule('../../lib/text/fold')) as { foldText?: (s: string) => string };
        } catch (err) {
            assert.fail(`lib/text/fold.ts absent (contrat 5.45, fix(9b.45)) : ${String((err as Error).message).split('\n')[0]}`);
        }
        assert.equal(typeof mod.foldText, 'function', 'foldText exporté par lib/text/fold.ts');
        const foldText = mod.foldText!;
        const cases: Array<[string, string]> = [
            ['Thiès', 'thies'], ['THIÈS', 'thies'], ['Fête', 'fete'], ['Œuvre', 'oeuvre'], ['cœur', 'coeur'],
            ['Cæsar', 'caesar'], ['  Saint   Louis ', 'saint louis'], ['Ziguinchor', 'ziguinchor'], ['Ngaparou Ñ', 'ngaparou n'],
        ];
        assert.deepEqual(cases.map(([input]) => foldText(input)), cases.map(([, out]) => out));
    });
});
