/**
 * Design 1b (lot CATALOGUE : points 1, 3, 4, 5, 10 et 11) — règles pures du catalogue, testées sans base :
 *  - prix de la carte : « Gratuit », « Gratuit ou dès … », « Dès … », jamais « Gratuit » sans catégorie achetable ;
 *  - « Dernières places » relatif à la jauge (10 %, au moins 1), jamais quand c'est faux ; « Complet » inchangé ;
 *  - carte du catalogue : début et fin retenue (instants ISO), plus petit prix payant, aucun nombre de places ;
 *  - filtres de l'Explorer : aujourd'hui, ce week-end (vendredi 18:00 → lundi 00:00), cette semaine (7 jours glissants),
 *    gratuit, catégorie, ville, recherche, tri ; adresse (lecture et écriture) ; pagination « Voir plus » ;
 *  - sections de l'accueil (En ce moment, Cette semaine, Gratuits, Par catégorie) ;
 *  - lectures du code : accueil préparé par le serveur (revalidate 60, aucune lecture de session), un seul grand bouton en
 *    dégradé, rangée « À la une » en CSS seulement, taux de parrainage jamais écrits en dur, onglets Liste / Carte / Calendrier,
 *    transition de vue coupée si « réduire les animations ».
 * Fuseau Africa/Dakar = UTC+0 : les heures des cas sont en UTC.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { formatCatalogEvent, lowStockLimit, stockOf, type CatalogCategoryRow, type CatalogRow } from '../../lib/events/catalog.server';
import { cardPrice, cardWhen, featuredBadgeText } from '../../lib/events/catalog-display';
import {
    applyCatalogFilters, catalogSearchParams, EXPLORE_MAX_PAGE, EXPLORE_PAGE_SIZE, exploreHref, hasActiveFilters, matchesWhen,
    NO_FILTERS, paginate, parseCatalogParams, whenRange, type CatalogFilterState, type FilterableEvent,
} from '../../lib/events/catalog-filters';
import { homeSections } from '../../lib/events/catalog-home';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const NBSP = ' ';
const fcfa = (n: string): string => `${n.replace(/ /g, NBSP)}${NBSP}F${NBSP}CFA`;

// ── Prix de la carte ───────────────────────────────────────────────────────

describe('carte : libellé du prix', () => {
    test('payant seulement : « Dès 10 000 F CFA »', () => {
        const p = cardPrice({ price: 10_000, paidFrom: 10_000 });
        assert.equal(p.lead, 'Dès');
        assert.equal(p.value, fcfa('10 000'));
        assert.equal(p.amount, true);
    });

    test('gratuit seulement : « Gratuit » (sans « Dès »)', () => {
        const p = cardPrice({ price: 0, paidFrom: null });
        assert.equal(p.lead, null);
        assert.equal(p.text, 'Gratuit');
    });

    test('gratuit et payant : « Gratuit ou dès 5 000 F CFA »', () => {
        const p = cardPrice({ price: 0, paidFrom: 5_000 });
        assert.equal(p.text, `Gratuit ou dès ${fcfa('5 000')}`);
    });

    test('rien d’achetable : l’état de la vente du serveur, « Bientôt en vente » à défaut, jamais « Gratuit »', () => {
        assert.equal(cardPrice({ price: null, saleLabel: 'Vente sur place uniquement' }).value, 'Vente sur place uniquement');
        assert.equal(cardPrice({ price: null, saleLabel: 'Complet' }).value, 'Complet');
        assert.equal(cardPrice({ price: null }).value, 'Bientôt en vente');
        assert.equal(cardPrice({ price: null, paidFrom: 0 }).value, 'Bientôt en vente');
        assert.doesNotMatch(cardPrice({ price: null, saleLabel: '' }).text, /Gratuit/);
    });

    test('date de la carte : « sam. 21 nov. · 20:00 » (Dakar = UTC), sans heure : la date seule', () => {
        assert.equal(cardWhen('2026-11-21T20:00:00.000Z', '20:00'), 'sam. 21 nov. · 20:00');
        assert.equal(cardWhen('2027-01-01T00:00:00.000Z', null), 'ven. 1 janv.');
        assert.equal(cardWhen('pas une date', '20:00'), '');
    });

    test('étiquette de mise en avant : un seul endroit traduit le champ', () => {
        assert.equal(featuredBadgeText('A_LA_UNE'), 'À la une');
        assert.equal(featuredBadgeText('SPONSORISE'), 'Sponsorisé');
        assert.equal(featuredBadgeText(null), null);
    });
});

// ── « Dernières places » relatif à la jauge ────────────────────────────────

const NOW = Date.parse('2026-11-18T12:00:00Z');

function cat(total: number, sold: number, extra: Partial<CatalogCategoryRow> = {}): CatalogCategoryRow {
    return {
        price: 5_000, is_active: true, sale_online: true, sale_counter: false, total_quantity: total, sold_quantity: sold,
        held_quantity: 0, sale_start: null, sale_end: null, ...extra,
    };
}

describe('« Dernières places » : au plus 10 % de la jauge en ligne', () => {
    test('seuil : 10 % arrondi vers le bas, au moins 1 ; jauge vide : 0', () => {
        assert.deepEqual([5, 10, 20, 25, 30, 100, 2000].map(lowStockLimit), [1, 1, 2, 2, 3, 10, 200]);
        assert.equal(lowStockLimit(0), 0);
        assert.equal(lowStockLimit(Number.NaN), 0);
    });

    test('jauge 100 : 10 restantes → LOW ; 11 restantes → rien', () => {
        assert.equal(stockOf([cat(100, 90)], NOW), 'LOW');
        assert.equal(stockOf([cat(100, 89)], NOW), null);
    });

    test('jauge 20 (seed « dernieresPlaces ») : 6 restantes (30 %) → rien, jamais « Dernières places » à tort ; 2 → LOW', () => {
        assert.equal(stockOf([cat(20, 14)], NOW), null);
        assert.equal(stockOf([cat(20, 18)], NOW), 'LOW');
    });

    test('jauge 2 000 : 15 restantes → LOW (l’ancien seuil absolu de 10 ne le disait pas) ; 250 → rien', () => {
        assert.equal(stockOf([cat(2000, 1985)], NOW), 'LOW');
        assert.equal(stockOf([cat(2000, 1750)], NOW), null);
    });

    test('plusieurs catégories : restantes et jauge additionnées ; une catégorie épuisée compte dans la jauge', () => {
        // SIMPLE 10/10 vendues, VIP 5 restantes sur 20 : 5 restantes sur 30 → rien (limite 3)
        assert.equal(stockOf([cat(10, 10), cat(20, 15, { price: 15_000 })], NOW), null);
        // VIP 3 restantes : 3 ≤ 3 → LOW
        assert.equal(stockOf([cat(10, 10), cat(20, 17, { price: 15_000 })], NOW), 'LOW');
    });

    test('places retenues par un paiement en cours : comptées comme prises', () => {
        assert.equal(stockOf([cat(20, 10, { held_quantity: 8 })], NOW), 'LOW');
    });

    test('rien d’achetable : « Complet » si une catégorie en ligne est épuisée, jamais LOW', () => {
        assert.equal(stockOf([cat(20, 20)], NOW), 'SOLD_OUT');
        assert.equal(stockOf([cat(20, 0, { sale_start: '2026-12-01T00:00:00Z' })], NOW), null, 'vente pas commencée');
        assert.equal(stockOf([cat(20, 0, { sale_online: false, sale_counter: true })], NOW), null, 'guichet seul');
    });

    test('catégorie close : hors de la jauge ; catégorie inactive ou hors ligne : ignorée', () => {
        // Close (vente terminée) : sa jauge ne compte pas. Ouverte 2/20 restantes → LOW.
        assert.equal(stockOf([cat(1000, 0, { sale_end: '2026-11-01T00:00:00Z' }), cat(20, 18)], NOW), 'LOW');
        assert.equal(stockOf([cat(1000, 0, { is_active: false }), cat(20, 18)], NOW), 'LOW');
    });
});

// ── Carte du catalogue ─────────────────────────────────────────────────────

function row(cats: CatalogCategoryRow[], extra: Partial<CatalogRow> = {}): CatalogRow {
    return {
        id: '11111111-1111-4111-8111-111111111111', slug: null, title: 'Concert', category: 'CONCERT', location: 'Grand Théâtre',
        city: 'Dakar', start_date: '2026-11-21', start_time: '22:00:00', end_date: null, end_time: null, image_url: null,
        status: 'PUBLIE', partners: { company_name: 'Org', commercial_name: null }, ticket_categories: cats, ...extra,
    };
}

describe('carte du catalogue : instants, prix payant, aucun nombre de places', () => {
    test('début et fin retenue (sans fin : début + 6 h), plus petit prix payant', () => {
        const dto = formatCatalogEvent(row([cat(50, 0, { price: 0 }), cat(50, 0, { price: 7_000 }), cat(50, 0, { price: 3_000 })]));
        assert.equal(dto.startsAt, '2026-11-21T22:00:00.000Z');
        assert.equal(dto.endsAt, '2026-11-22T04:00:00.000Z');
        assert.equal(dto.price, 0);
        assert.equal(dto.paidFrom, 3_000);
        assert.equal(cardPrice(dto).text, `Gratuit ou dès ${fcfa('3 000')}`);
    });

    test('fin saisie gardée ; payant seulement : paidFrom = prix ; rien d’achetable : paidFrom null', () => {
        const dto = formatCatalogEvent(row([cat(50, 0, { price: 4_000 })], { end_date: '2026-11-22', end_time: '05:00:00' }));
        assert.equal(dto.endsAt, '2026-11-22T05:00:00.000Z');
        assert.equal(dto.paidFrom, 4_000);
        assert.equal(formatCatalogEvent(row([cat(50, 50)])).paidFrom, null);
    });

    test('aucune quantité, aucun identifiant de partenaire dans la carte', () => {
        const dto = formatCatalogEvent(row([cat(50, 3)]));
        const keys = Object.keys(dto);
        for (const k of ['total_quantity', 'sold_quantity', 'held_quantity', 'remaining', 'partner_id', 'partnerId']) {
            assert.ok(!keys.includes(k), `clé ${k} exposée`);
        }
        assert.doesNotMatch(JSON.stringify(dto), /"(?:remaining|quantity)"/);
    });
});

// ── Filtres de l'Explorer ──────────────────────────────────────────────────

const at = (iso: string): Date => new Date(iso);

function ev(id: string, start: string, end: string, extra: Partial<FilterableEvent> = {}): FilterableEvent & { id: string } {
    return { id, title: `Titre ${id}`, venue: 'Lieu', subtitle: 'Org', city: 'DAKAR', category: 'CONCERT', price: 5_000, startsAt: start, endsAt: end, ...extra };
}

describe('filtres de date (Dakar = UTC)', () => {
    test('aujourd’hui : de minuit à minuit', () => {
        const r = whenRange('aujourdhui', at('2026-11-18T15:30:00Z'));
        assert.equal(r.from.toISOString(), '2026-11-18T00:00:00.000Z');
        assert.equal(r.to.toISOString(), '2026-11-19T00:00:00.000Z');
    });

    test('ce week-end : du vendredi 18:00 au lundi 00:00, le prochain du lundi au jeudi, celui en cours ensuite', () => {
        const expectWe = (now: string, from: string, to: string) => {
            const r = whenRange('weekend', at(now));
            assert.deepEqual([r.from.toISOString(), r.to.toISOString()], [from, to], now);
        };
        // mercredi 18 nov. 2026
        expectWe('2026-11-18T10:00:00Z', '2026-11-20T18:00:00.000Z', '2026-11-23T00:00:00.000Z');
        // lundi 16
        expectWe('2026-11-16T08:00:00Z', '2026-11-20T18:00:00.000Z', '2026-11-23T00:00:00.000Z');
        // vendredi 20 à 12:00, samedi 21, dimanche 22 à 23:00 : même week-end
        expectWe('2026-11-20T12:00:00Z', '2026-11-20T18:00:00.000Z', '2026-11-23T00:00:00.000Z');
        expectWe('2026-11-21T09:00:00Z', '2026-11-20T18:00:00.000Z', '2026-11-23T00:00:00.000Z');
        expectWe('2026-11-22T23:00:00Z', '2026-11-20T18:00:00.000Z', '2026-11-23T00:00:00.000Z');
    });

    test('ce week-end : soirée du vendredi 20:00 oui, vendredi 12:00-14:00 non, dimanche soir oui, lundi non', () => {
        const now = at('2026-11-18T10:00:00Z');
        assert.equal(matchesWhen(ev('a', '2026-11-20T20:00:00Z', '2026-11-21T02:00:00Z'), 'weekend', now), true);
        assert.equal(matchesWhen(ev('b', '2026-11-20T12:00:00Z', '2026-11-20T14:00:00Z'), 'weekend', now), false);
        assert.equal(matchesWhen(ev('c', '2026-11-22T21:00:00Z', '2026-11-23T03:00:00Z'), 'weekend', now), true);
        assert.equal(matchesWhen(ev('d', '2026-11-23T10:00:00Z', '2026-11-23T12:00:00Z'), 'weekend', now), false);
    });

    test('cette semaine : aujourd’hui et les six jours suivants (dimanche compris, jamais vide le dimanche)', () => {
        const sunday = at('2026-11-22T10:00:00Z');
        const r = whenRange('semaine', sunday);
        assert.equal(r.from.toISOString(), '2026-11-22T00:00:00.000Z');
        assert.equal(r.to.toISOString(), '2026-11-29T00:00:00.000Z');
        assert.equal(matchesWhen(ev('e', '2026-11-28T20:00:00Z', '2026-11-29T02:00:00Z'), 'semaine', sunday), true);
        assert.equal(matchesWhen(ev('f', '2026-11-29T00:00:00Z', '2026-11-29T06:00:00Z'), 'semaine', sunday), false);
    });

    test('un festival commencé hier et qui finit demain est « aujourd’hui »', () => {
        assert.equal(matchesWhen(ev('g', '2026-11-17T10:00:00Z', '2026-11-19T23:59:00Z'), 'aujourdhui', at('2026-11-18T12:00:00Z')), true);
    });
});

describe('filtres : catégorie, gratuit, ville, recherche, tri', () => {
    const list = [
        ev('1', '2026-11-19T20:00:00Z', '2026-11-20T02:00:00Z', { title: 'Nuit du Jazz', price: 5_000 }),
        ev('2', '2026-11-20T20:00:00Z', '2026-11-21T02:00:00Z', { category: 'FESTIVAL', price: 0, city: 'THIÈS' }),
        ev('3', '2026-11-25T20:00:00Z', '2026-11-26T02:00:00Z', { price: null }),
        ev('4', '2026-11-26T20:00:00Z', '2026-11-27T02:00:00Z', { price: 2_000, subtitle: 'Sabar Productions' }),
    ];
    const now = at('2026-11-18T12:00:00Z');
    const ids = (f: Partial<CatalogFilterState>) => applyCatalogFilters(list, { ...NO_FILTERS, ...f }, now).map((e) => e.id);

    test('sans filtre : tout, dans l’ordre d’origine', () => assert.deepEqual(ids({}), ['1', '2', '3', '4']));
    test('gratuit : prix « à partir de » égal à 0', () => assert.deepEqual(ids({ gratuit: true }), ['2']));
    test('catégorie', () => assert.deepEqual(ids({ categorie: 'FESTIVAL' }), ['2']));
    test('ville sans accent ni casse (« thies » trouve « THIÈS »)', () => assert.deepEqual(ids({ ville: 'thies' }), ['2']));
    test('recherche dans le titre, le lieu, l’organisateur et la ville', () => {
        assert.deepEqual(ids({ q: 'jazz' }), ['1']);
        assert.deepEqual(ids({ q: 'sabar' }), ['4']);
    });
    test('combinaison : cette semaine et gratuit', () => assert.deepEqual(ids({ quand: 'semaine', gratuit: true }), ['2']));
    test('tri par prix croissant, sans prix en dernier', () => assert.deepEqual(ids({ tri: 'prix' }), ['2', '4', '1', '3']));
});

describe('adresse de l’Explorer', () => {
    test('lecture : valeurs inconnues ignorées, page bornée, texte borné', () => {
        const f = parseCatalogParams({ quand: 'demain', categorie: 'inconnue', gratuit: 'oui', page: '9999', q: 'x'.repeat(300), ville: 'D' });
        assert.equal(f.quand, null);
        assert.equal(f.categorie, null);
        assert.equal(f.gratuit, false);
        assert.equal(f.page, EXPLORE_MAX_PAGE);
        assert.equal(f.q.length, 120);
        assert.equal(f.ville, null);
        assert.equal(parseCatalogParams({ page: '-3' }).page, 1);
        assert.equal(parseCatalogParams({ categorie: 'concert' }).categorie, 'CONCERT');
    });

    test('écriture puis lecture : mêmes filtres ; sans filtre : /explore', () => {
        const f: CatalogFilterState = { q: 'jazz', quand: 'weekend', categorie: 'CONCERT', gratuit: true, ville: 'DAKAR', tri: 'prix', page: 2 };
        assert.equal(exploreHref(f), '/explore?q=jazz&quand=weekend&categorie=CONCERT&gratuit=1&ville=DAKAR&tri=prix&page=2');
        assert.deepEqual(parseCatalogParams(catalogSearchParams(f)), f);
        assert.equal(exploreHref(), '/explore');
        assert.equal(exploreHref({ gratuit: true }), '/explore?gratuit=1');
    });

    test('filtres actifs : la page et le tri ne restreignent rien', () => {
        assert.equal(hasActiveFilters({ ...NO_FILTERS, page: 3, tri: 'prix' }), false);
        assert.equal(hasActiveFilters({ ...NO_FILTERS, gratuit: true }), true);
    });
});

describe('pagination « Voir plus »', () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    test('page 1 : 12 cartes, suite ; page 3 : les 30, plus de suite', () => {
        assert.equal(EXPLORE_PAGE_SIZE, 12);
        const p1 = paginate(items, 1);
        assert.deepEqual([p1.shown.length, p1.total, p1.hasMore, p1.page], [12, 30, true, 1]);
        const p3 = paginate(items, 3);
        assert.deepEqual([p3.shown.length, p3.hasMore, p3.page], [30, false, 3]);
    });
    test('page au-delà de la fin ramenée à la dernière ; liste vide : page 1', () => {
        assert.equal(paginate(items, 8).page, 3);
        assert.deepEqual(paginate([], 4), { shown: [], total: 0, hasMore: false, page: 1 });
    });
});

// ── Sections de l'accueil ──────────────────────────────────────────────────

describe('sections de l’accueil', () => {
    const now = at('2026-11-18T21:00:00Z');
    const catalog = [
        ev('live', '2026-11-18T20:00:00Z', '2026-11-19T02:00:00Z'),
        ev('soon', '2026-11-19T06:00:00Z', '2026-11-19T10:00:00Z', { category: 'FESTIVAL', price: 0 }),
        ev('later', '2026-11-30T20:00:00Z', '2026-12-01T02:00:00Z', { category: 'FOOD' }),
        ev('ended', '2026-11-18T10:00:00Z', '2026-11-18T12:00:00Z'),
    ];
    const s = homeSections(catalog, now);

    test('« En ce moment » : en cours et dans les 12 h ; état au rendu = en cours seulement ; terminé absent', () => {
        assert.deepEqual(s.liveCandidates.map((e) => e.id), ['live', 'soon']);
        assert.deepEqual(s.liveAtRender, ['live']);
    });
    test('« Cette semaine », « Gratuits » : comptes réels', () => {
        assert.deepEqual(s.week.events.map((e) => e.id), ['live', 'soon']);
        assert.equal(s.week.total, 2);
        assert.deepEqual(s.free.events.map((e) => e.id), ['soon']);
    });
    test('« Par catégorie » : seulement les catégories qui ont des événements, dans l’ordre du référentiel', () => {
        assert.deepEqual(s.byCategory.map((c) => [c.id, c.total]), [['CONCERT', 1], ['FESTIVAL', 1], ['FOOD', 1]]);
    });
    test('rien en cours : rangée « En ce moment » vide au rendu', () => {
        assert.deepEqual(homeSections([catalog[2]], now).liveAtRender, []);
    });
});

// ── Lectures du code ───────────────────────────────────────────────────────

describe('accueil et Explorer : rendu serveur, cache, rien de personnel', () => {
    test('accueil : composant serveur régénéré toutes les 60 s, aucune lecture de session ni de cookie', () => {
        const src = code('app/page.tsx');
        assert.doesNotMatch(src, /^\s*['"]use client['"]/m, 'app/page.tsx doit rester un composant serveur');
        assert.match(src, /export const revalidate = 60\b/);
        for (const f of ['app/page.tsx', 'app/_accueil/data.server.ts', 'lib/events/catalog-cache.server.ts', 'lib/events/catalog-read.server.ts']) {
            const s = code(f);
            assert.doesNotMatch(s, /next\/headers|cookies\(|headers\(\)|useAuth|getSession|requireActiveSession|profile/, `${f} : rien de personnel dans une page en cache`);
        }
        assert.match(code('app/_accueil/data.server.ts'), /unstable_cache/);
        assert.match(code('lib/events/catalog-cache.server.ts'), /unstable_cache\([^)]*revalidate: PUBLIC_REVALIDATE_SECONDS/);
    });

    test('accueil : la ville et le temps réel sont des îlots client', () => {
        assert.match(read('app/_accueil/HomeNearby.tsx'), /ssr:\s*false/);
        assert.match(read('app/_accueil/HomeLive.tsx'), /^['"]use client['"]/);
        assert.match(read('app/_accueil/LiveNow.tsx'), /^['"]use client['"]/);
    });

    test('un seul grand bouton en dégradé sur l’accueil : celui du bloc organisateurs', () => {
        const files = ['app/page.tsx', 'app/_accueil/sections.tsx', 'app/_accueil/LiveNow.tsx', 'components/events/EventCard.tsx'];
        const count = files.reduce((n, f) => n + (code(f).match(/variant(?:=|:\s*)["']gradient["']/g) ?? []).length, 0);
        assert.equal(count, 1);
        const src = code('app/page.tsx');
        assert.ok(src.indexOf('variant="gradient"') > src.indexOf('organisateurs-titre'), 'dans le bloc organisateurs');
    });

    test('aucun chiffre ni promesse inventés ; taux de parrainage lus en base', () => {
        const src = code('app/page.tsx');
        for (const banned of [/#1\b/, /45\s?000/, /0\s?%\s*(?:de\s*)?frais/i, /officiel/i, /n°\s?1/i]) assert.doesNotMatch(src, banned);
        assert.doesNotMatch(src, /\b\d+(?:[.,]\d+)?\s?%/, 'aucun pourcentage écrit en dur sur l’accueil');
        assert.match(code('app/_accueil/data.server.ts'), /from\('referral_config'\)[\s\S]*\.eq\('is_active', true\)/);
    });

    test('rangée « À la une » : scroll-snap en CSS seulement, première carte plus grande', () => {
        const src = code('app/_accueil/sections.tsx');
        assert.doesNotMatch(src, /['"]use client['"]|useEffect|onScroll|scrollTo|scrollBy/);
        assert.match(src, /snap-x snap-mandatory/);
        // Design 1d (point 2) : cartes verticales, la première fait 78 % de l'écran (88 % avant) ; attente modifiée, signalée
        assert.match(src, /i === 0 \? 'w-\[78%\]/);
        assert.match(src, /size=\{i === 0 \? 'feature' : 'default'\}/);
    });

    // Lot Carte B : le bouton Liste / Carte prévu (SHOW_MAP_TOGGLE) devient trois onglets Liste / Carte / Calendrier, la carte
    // et le calendrier chargés à l'ouverture de leur onglet ; attente modifiée, signalée au rapport du lot Carte B
    test('Explorer : page serveur sur le catalogue en cache ; onglets Liste / Carte / Calendrier, carte et calendrier à la demande', () => {
        const page = code('app/explore/page.tsx');
        assert.doesNotMatch(page, /^\s*['"]use client['"]/m);
        assert.match(page, /cachedCatalogEvents\(/);
        const view = code('app/explore/ExploreView.tsx');
        assert.doesNotMatch(view, /SHOW_MAP_TOGGLE/);
        for (const label of ['Liste', 'Carte', 'Calendrier']) assert.match(view, new RegExp(`label: '${label}'`));
        assert.match(view, /dynamic\(\(\) => import\('@\/components\/explore\/lazy'\)\.then\(\(m\) => m\.ExploreMap\), \{\s*ssr: false/);
        assert.match(view, /dynamic\(\(\) => import\('@\/components\/explore\/lazy'\)\.then\(\(m\) => m\.ExploreCalendar\), \{\s*ssr: false/);
        assert.match(view, /<FilterChip\b/);
    });

    test('transition carte → fiche : API du navigateur, sans bibliothèque, coupée si « réduire les animations »', () => {
        const src = code('components/events/CardLink.tsx');
        assert.match(src, /startViewTransition/);
        assert.match(src, /prefers-reduced-motion: reduce/);
        assert.match(src, /ev-poster-\$\{id\}/);
        assert.match(src, /MAX_FREEZE_MS = 400/);
        assert.doesNotMatch(src, /from ['"](?:framer-motion|motion|react-transition-group|gsap)/);
    });
});
