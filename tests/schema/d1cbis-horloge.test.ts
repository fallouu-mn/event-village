/**
 * Design 1c bis (point 3, erreur 418) — withClock (lib/events/event-detail.ts) : l'état de la billetterie à une heure
 * donnée, calculé depuis les seuls faits sans heure de la fiche. Sans heure (fiche en cache, premier rendu du
 * navigateur) : rien d'ouvert ni de fermé. Même calcul pour la route de l'API (heure du serveur) et la billetterie
 * (heure du téléphone, après le chargement). Complète tests/parcours/d1cbis-fiche-heure (base réelle).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { POSTPONEMENT_REFUND_INFO, REFUND_INFO, withClock, type PublicCategory, type PublicEventDetail } from '../../lib/events/event-detail';

const H = 3600_000;
const T0 = Date.parse('2026-12-01T18:00:00Z');

function category(over: Partial<PublicCategory> = {}): PublicCategory {
    return {
        id: 'c1', name: 'Standard', price: 5_000, priceFormatted: '5 000 F CFA', isFree: false, availability: 'AVAILABLE',
        remainingHint: null, status: 'ACTIVE', isSoldOut: false, isHeld: false, isClosed: false,
        isAvailable: false, saleOpen: false, saleStarted: false, saleEnded: false,
        saleStart: null, saleEnd: new Date(T0 + H).toISOString(), maxPerOrder: 10, description: '', scanColor: null, ...over,
    };
}

function sheet(over: Partial<PublicEventDetail> = {}): PublicEventDetail {
    return {
        id: 'e1', slug: 'e1', title: 'Soirée', category: null, categoryLabel: null, description: '', subtitle: '',
        organizer: { name: 'Org', avatar: null }, posterUrl: null, posterColor: '#14213d', posterBlur: null, galleryUrls: [], dateFormatted: '', time: '20:00',
        startsAt: new Date(T0 + 2 * H).toISOString(), endsAt: new Date(T0 + 6 * H).toISOString(),
        venue: 'Dakar', city: 'Dakar', latitude: null, longitude: null, capacity: 100, status: 'PUBLIE',
        purchasable: false, banner: null, isFullySoldOut: false, hasHeldSeats: false, salesEnded: false,
        hasAvailableTickets: false, counterSale: false, refund: null, clockKnown: false, counterCapable: true,
        postponedOver24h: false, program: [],
        practicalInfo: { address: null, accessNotes: null, parking: null, contactPhone: null, contactPhoneTel: null, rules: null },
        categories: [category()], ...over,
    };
}

describe('design 1c bis — withClock', () => {
    test('sans heure : rien d’ouvert ni de fermé, aucun guichet, aucun remboursement de report', () => {
        const s = withClock(sheet({ postponedOver24h: true, purchasable: true, counterSale: true }), null);
        assert.equal(s.clockKnown, false);
        assert.deepEqual([s.purchasable, s.hasAvailableTickets, s.salesEnded, s.counterSale, s.refund], [false, false, false, false, null]);
        assert.deepEqual([s.categories[0].isAvailable, s.categories[0].saleOpen, s.categories[0].saleStarted, s.categories[0].saleEnded], [false, false, false, false]);
    });

    test('avant la fin de vente : achat possible ; après : vente close, même fiche', () => {
        const before = withClock(sheet(), new Date(T0));
        assert.deepEqual([before.clockKnown, before.purchasable, before.categories[0].isAvailable, before.salesEnded], [true, true, true, false]);
        const after = withClock(sheet(), new Date(T0 + H + 1));
        assert.deepEqual([after.purchasable, after.categories[0].isAvailable, after.categories[0].saleEnded, after.salesEnded], [false, false, true, true]);
        assert.equal(after.counterSale, true, 'guichet tant que l’événement n’est pas fini');
        assert.equal(withClock(sheet(), new Date(T0 + 7 * H)).counterSale, false, 'plus de guichet après la fin');
    });

    test('vente pas commencée, complet, événement suspendu : jamais achetable', () => {
        assert.equal(withClock(sheet({ categories: [category({ saleStart: new Date(T0 + H).toISOString() })] }), new Date(T0)).purchasable, false);
        assert.equal(withClock(sheet({ categories: [category({ isSoldOut: true })] }), new Date(T0)).purchasable, false);
        assert.equal(withClock(sheet({ status: 'SUSPENDU' }), new Date(T0)).purchasable, false);
    });

    test('remboursement : annulation toujours ; report de plus de 24 h jusqu’au début seulement', () => {
        const cancelled = sheet({ status: 'ANNULE', refund: { kind: 'ANNULATION', text: REFUND_INFO } });
        assert.equal(withClock(cancelled, null).refund?.kind, 'ANNULATION');
        assert.equal(withClock(cancelled, new Date(T0 + 9 * H)).refund?.kind, 'ANNULATION');
        const postponed = sheet({ postponedOver24h: true });
        assert.deepEqual(withClock(postponed, new Date(T0)).refund, { kind: 'REPORT', text: POSTPONEMENT_REFUND_INFO });
        assert.equal(withClock(postponed, new Date(T0 + 3 * H)).refund, null, 'plus après le début');
    });

    test('appliquer l’heure deux fois donne le même état (fiche relue par la route puis par le téléphone)', () => {
        const once = withClock(sheet(), new Date(T0));
        assert.deepEqual(withClock(once, new Date(T0)), once);
    });

    test('la page en cache lit la fiche sans heure ; la billetterie applique l’heure après le chargement', () => {
        const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');
        const server = read('lib/events/event-detail.server.ts');
        const cached = server.slice(server.indexOf('const cachedRead = unstable_cache('), server.indexOf('function isMissingIncrementalCache'));
        assert.match(cached, /buildPublicEventSnapshot\(eventId\)/);
        assert.doesNotMatch(cached, /buildPublicEventDetail\(/, 'la fiche à l’heure du serveur ne va jamais en cache');
        const snapshot = server.slice(server.indexOf('export async function buildPublicEventSnapshot'), server.indexOf('/** Durée du cache des pages publiques'));
        assert.doesNotMatch(snapshot, /\bnow\b|new Date\(\)|Date\.now\(\)/, 'aucune heure lue pour la fiche en cache');
        const ticketing = read('components/event-page/EventTicketing.tsx');
        assert.match(ticketing, /const \[now, setNow\] = useState<number \| null>\(null\);/);
        assert.match(ticketing, /const event = useMemo\(\(\) => withClock\(sheet, now === null \? null : new Date\(now\)\), \[sheet, now\]\);/);
        const page = read('app/events/[id]/page.tsx');
        assert.doesNotMatch(page, /event\.(purchasable|hasAvailableTickets|salesEnded|counterSale)\b/, 'la page serveur ne lit aucun état qui dépend de l’heure');
    });
});
