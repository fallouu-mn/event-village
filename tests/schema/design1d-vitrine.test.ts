/**
 * Design 1d — règles sans base de données.
 *  1. Couleur de l'affiche (sharp) : couleur « #rrggbb » de contraste ≥ 4,5:1 avec le blanc pour des affiches claires,
 *     vives, sombres, transparentes ; image floutée data:image/webp de 3 000 caractères au plus ; valeur enregistrée
 *     trop claire ou mal formée → « bleu nuit » ; jeton --poster-fallback identique dans app/globals.css et
 *     docs/design/jetons.css (clair et sombre) et à POSTER_FALLBACK_COLOR ; dépôt et réencodage enregistrent le style.
 *  2. Comptes à rebours : plus de 7 jours → rien ; 7 j à 24 h → « Commence dans 2 j 4 h » ; dernier jour → heures,
 *     minutes, secondes ; « En cours » ; fin des ventes à 48 h ; paiement en attente ; texte des lecteurs d'écran
 *     identique pendant toute une minute.
 *  3. Agenda : fichier .ics à l'heure de Dakar (fuseau déclaré, échappements, lignes pliées, CRLF), lien Google Agenda.
 *  4. Préférences de l'appareil : opérateur et numéro gardés seulement après validation, valeurs illisibles ignorées,
 *     stockage refusé sans erreur, recherches récentes (6 au plus, sans doublon), purge à la déconnexion.
 *  5. Recherche instantanée : 2 caractères au moins, forme pliée, 8 résultats au plus, aucune affiche d'un autre hôte.
 *  6. Prix d'appel de l'aperçu de partage.
 * Sortie brute `[D1D-VITRINE]`.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
    POSTER_FALLBACK_COLOR, contrastWithWhite, hexToRgb, posterBlurOrNull, posterColorOrFallback,
} from '../../lib/events/poster-color';
import { computePosterStyle } from '../../lib/images/poster-style';
import { DAY, HOUR, MINUTE, SECOND, eventCountdown, paymentCountdown, saleCloseCountdown } from '../../lib/events/countdown';
import { buildIcs, dakarStamp, googleCalendarUrl, icsFileName } from '../../lib/events/calendar-links';
import {
    PAYMENT_PREF_KEY, RECENT_SEARCHES_KEY, addRecentSearch, clearRecentSearches, readPaymentPreference, readRecentSearches,
    savePaymentPreference,
} from '../../lib/device/device-prefs';
import { DEVICE_PREFS_PREFIX, clearDevicePrefs } from '../../lib/device/device-prefs-purge';
import { instantSearch } from '../../lib/events/instant-search';
import { sharePriceLabel } from '../../lib/events/share-preview';
import type { CatalogEventDto } from '../../lib/events/catalog.server';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('1. couleur de l’affiche', () => {
    test('couleur lisible sous du texte blanc, image floutée légère, pour tout type d’affiche', async () => {
        const cases: Array<[string, Buffer]> = [];
        for (const bg of ['#ffffff', '#ff8a3d', '#1dc8f2', '#ffee00', '#101010', '#14213d']) {
            cases.push([bg, await sharp({ create: { width: 800, height: 1000, channels: 3, background: bg } }).webp().toBuffer()]);
        }
        cases.push(['transparente', await sharp({ create: { width: 400, height: 500, channels: 4, background: { r: 255, g: 200, b: 0, alpha: 0 } } }).png().toBuffer()]);
        const stripes = Buffer.alloc(300 * 300 * 3);
        for (let i = 0; i < stripes.length; i += 3) { stripes[i] = (i / 3) % 300 < 150 ? 240 : 20; stripes[i + 1] = 60; stripes[i + 2] = 120; }
        cases.push(['rayures', await sharp(stripes, { raw: { width: 300, height: 300, channels: 3 } }).jpeg().toBuffer()]);
        for (const [name, buf] of cases) {
            const style = await computePosterStyle(buf);
            const ratio = contrastWithWhite(hexToRgb(style.color)!);
            console.log(`[D1D-VITRINE] 1. ${name} → ${style.color} (contraste ${ratio.toFixed(2)}), floutée ${style.blur.length} caractères`);
            assert.match(style.color, /^#[0-9a-f]{6}$/, name);
            assert.ok(ratio >= 4.5, `${name} : contraste ${ratio}`);
            assert.ok(style.blur.startsWith('data:image/webp;base64,') && style.blur.length <= 3000, `${name} : image floutée`);
            assert.equal(posterBlurOrNull(style.blur), style.blur);
        }
        await assert.rejects(computePosterStyle(Buffer.from('pas une image')), 'image illisible : erreur levée');
    });

    test('valeur enregistrée trop claire ou mal formée : « bleu nuit » ; jeton identique partout', () => {
        assert.equal(posterColorOrFallback('#ffffff'), POSTER_FALLBACK_COLOR);
        assert.equal(posterColorOrFallback('#ff8a3d'), POSTER_FALLBACK_COLOR);
        assert.equal(posterColorOrFallback('red'), POSTER_FALLBACK_COLOR);
        assert.equal(posterColorOrFallback(null), POSTER_FALLBACK_COLOR);
        assert.equal(posterColorOrFallback('#7c3a10'), '#7c3a10');
        assert.ok(contrastWithWhite(hexToRgb(POSTER_FALLBACK_COLOR)!) >= 4.5);
        assert.equal(posterBlurOrNull('data:image/png;base64,AAAA'), null);
        assert.equal(posterBlurOrNull('javascript:alert(1)'), null);
        const rgb = hexToRgb(POSTER_FALLBACK_COLOR)!;
        const channels = `${rgb.r} ${rgb.g} ${rgb.b}`;
        for (const file of ['app/globals.css', 'docs/design/jetons.css']) {
            const values = [...read(file).matchAll(/--poster-fallback:\s*([^;]+);/g)].map((m) => m[1].replace(/\/\*.*$/, '').trim());
            console.log(`[D1D-VITRINE] 1. ${file} : --poster-fallback ${JSON.stringify(values)}`);
            assert.ok(values.length >= 1, `${file} : jeton --poster-fallback absent`);
            for (const v of values) assert.ok(v === channels || v.toLowerCase() === POSTER_FALLBACK_COLOR, `${file} : ${v} ≠ ${channels}`);
        }
    });

    test('dépôt d’affiche et réencodage enregistrent le style ; la fiche et la carte le lisent', () => {
        assert.match(read('app/api/partner/upload/route.ts'), /if \(folder === 'events'\) await recordPosterStyle\(filePath, encoded\);/);
        assert.match(read('lib/events/poster-reencode.ts'), /await recordPosterStyle\(target, encoded\);/);
        assert.match(read('lib/events/event-detail.server.ts'), /poster_color,\s+poster_blur,/);
        assert.match(read('lib/events/catalog.server.ts'), /image_url,\s+poster_color,/);
        assert.doesNotMatch(read('lib/events/poster-color.ts'), /from 'sharp'/, 'module du navigateur sans sharp');
    });
});

describe('2. comptes à rebours', () => {
    const start = Date.UTC(2026, 10, 21, 20, 0, 0);
    const end = start + 6 * HOUR;
    const iso = (ms: number): string => new Date(ms).toISOString();

    test('début : date seule, jours et heures, horloge, en cours, rien après', () => {
        assert.deepEqual(eventCountdown(start - 8 * DAY, iso(start), iso(end)).text, null);
        assert.equal(eventCountdown(start - (2 * DAY + 4 * HOUR + 30 * MINUTE), iso(start), iso(end)).text, 'Commence dans 2 j 4 h');
        assert.equal(eventCountdown(start - 3 * DAY, iso(start), iso(end)).text, 'Commence dans 3 j');
        assert.equal(eventCountdown(start - 7 * DAY, iso(start), iso(end)).kind, 'days');
        const clock = eventCountdown(start - (3 * HOUR + 12 * MINUTE + 5 * SECOND), iso(start), iso(end));
        assert.equal(clock.text, 'Commence dans 3 h 12 min 05 s');
        assert.equal(clock.kind, 'clock');
        assert.equal(clock.nextIn, SECOND);
        assert.equal(eventCountdown(start - 45 * SECOND, iso(start), iso(end)).text, 'Commence dans 45 s');
        assert.equal(eventCountdown(start + MINUTE, iso(start), iso(end)).text, 'En cours');
        assert.equal(eventCountdown(end + SECOND, iso(start), iso(end)).text, null);
        assert.equal(eventCountdown(start, 'pas une date', iso(end)).text, null);
    });

    test('lecteurs d’écran : même texte pendant toute une minute, en mots', () => {
        const base = start - (3 * HOUR + 12 * MINUTE);
        const spoken = new Set<string | null>();
        for (let s = 0; s < 60; s++) spoken.add(eventCountdown(base + s * SECOND + 1, iso(start), iso(end)).spoken);
        console.log(`[D1D-VITRINE] 2. textes parlés sur une minute : ${JSON.stringify([...spoken])}`);
        assert.equal(spoken.size, 1, 'le texte des lecteurs d’écran change dans la minute');
        assert.equal([...spoken][0], 'Commence dans 3 heures et 12 minutes');
        assert.equal(eventCountdown(start - (2 * DAY + 4 * HOUR), iso(start), iso(end)).spoken, 'Commence dans 2 jours et 4 heures');
    });

    test('fin des ventes : rien avant 48 h, puis « Ventes closes dans … » ; paiement en attente', () => {
        const saleEnd = start - HOUR;
        assert.equal(saleCloseCountdown(saleEnd - 3 * DAY, iso(saleEnd)).text, null);
        assert.equal(saleCloseCountdown(saleEnd - (DAY + 4 * HOUR), iso(saleEnd)).text, 'Ventes closes dans 1 j 4 h');
        assert.equal(saleCloseCountdown(saleEnd - (2 * HOUR + 5 * SECOND), iso(saleEnd)).text, 'Ventes closes dans 2 h 00 min 05 s');
        assert.equal(saleCloseCountdown(saleEnd + SECOND, iso(saleEnd)).text, null);
        const expires = start;
        assert.equal(paymentCountdown(expires - (12 * MINUTE + 5 * SECOND), iso(expires)).text, '12 min 05 s pour finir le paiement');
        assert.equal(paymentCountdown(expires - (12 * MINUTE + 5 * SECOND), iso(expires)).spoken, '13 minutes pour finir le paiement');
        assert.equal(paymentCountdown(expires + 1, iso(expires)).text, 'Délai de paiement dépassé');
    });
});

describe('3. agenda', () => {
    test('fichier .ics à l’heure de Dakar ; lien Google Agenda', () => {
        const ev = {
            id: 'e1', title: 'Nuit du Sabar, édition; spéciale\nDakar', startsAt: '2026-11-21T20:00:00.000Z', endsAt: '2026-11-22T02:00:00.000Z',
            location: 'Grand Théâtre, Dakar', url: 'https://exemple.sn/events/e1', details: 'Billet dans Mes billets.',
        };
        const ics = buildIcs(ev, new Date('2026-11-20T10:15:00Z'));
        console.log(`[D1D-VITRINE] 3. .ics :\n${ics}`);
        assert.ok(ics.includes('\r\n') && !/[^\r]\n/.test(ics), 'fins de ligne CRLF seulement');
        assert.match(ics, /\r\nTZID:Africa\/Dakar\r\n/);
        assert.match(ics, /\r\nDTSTART;TZID=Africa\/Dakar:20261121T200000\r\n/);
        assert.match(ics, /\r\nDTEND;TZID=Africa\/Dakar:20261122T020000\r\n/);
        assert.match(ics, /\r\nSUMMARY:Nuit du Sabar\\, édition\\; spéciale\\nDakar\r\n/);
        assert.match(ics, /\r\nDTSTAMP:20261120T101500Z\r\n/);
        assert.match(ics, /\r\nUID:e1@event-village\r\n/);
        for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `ligne de plus de 75 octets : ${line}`);
        assert.equal(dakarStamp('2026-06-01T23:30:00Z'), '20260601T233000', 'Dakar = UTC toute l’année');
        const g = new URL(googleCalendarUrl(ev));
        assert.equal(g.hostname, 'calendar.google.com');
        assert.equal(g.searchParams.get('dates'), '20261121T200000/20261122T020000');
        assert.equal(g.searchParams.get('ctz'), 'Africa/Dakar');
        assert.equal(g.searchParams.get('text'), ev.title);
        assert.equal(icsFileName('Nuit du Sabar — édition d’automne'), 'event-village-nuit-du-sabar-edition-d-automne.ics');
    });
});

describe('4. préférences de l’appareil', () => {
    class FakeStorage {
        map = new Map<string, string>();
        failWrites = false;
        get length(): number { return this.map.size; }
        key(i: number): string | null { return [...this.map.keys()][i] ?? null; }
        getItem(k: string): string | null { return this.map.get(k) ?? null; }
        setItem(k: string, v: string): void { if (this.failWrites) throw new Error('QuotaExceededError'); this.map.set(k, v); }
        removeItem(k: string): void { this.map.delete(k); }
    }
    const g = globalThis as unknown as { window?: unknown };

    test('achat rapide : opérateur et numéro valides seulement ; recherches récentes ; purge', () => {
        const store = new FakeStorage();
        g.window = { localStorage: store };
        try {
            assert.equal(readPaymentPreference(), null);
            assert.equal(savePaymentPreference({ operator: 'WAVE', phone: '771234567' }), true);
            assert.deepEqual(readPaymentPreference(), { operator: 'WAVE', phone: '771234567' });
            assert.equal(savePaymentPreference({ operator: 'CARTE' as 'WAVE', phone: '771234567' }), false);
            assert.equal(savePaymentPreference({ operator: 'ORANGE_MONEY', phone: '+33612345678' }), false);
            store.setItem(PAYMENT_PREF_KEY, '{"operator":"WAVE","phone":"<script>"}');
            assert.equal(readPaymentPreference(), null, 'valeur illisible ignorée');
            store.setItem(PAYMENT_PREF_KEY, 'pas du JSON');
            assert.equal(readPaymentPreference(), null);

            for (const q of ['sabar', 'Youssou', 'SABAR', 'a', 'jazz', 'théâtre', 'concert', 'gala', 'lutte']) addRecentSearch(q);
            const recent = readRecentSearches();
            console.log(`[D1D-VITRINE] 4. recherches récentes : ${JSON.stringify(recent)}`);
            assert.deepEqual(recent, ['lutte', 'gala', 'concert', 'théâtre', 'jazz', 'SABAR']);
            clearRecentSearches();
            assert.deepEqual(readRecentSearches(), []);

            savePaymentPreference({ operator: 'ORANGE_MONEY', phone: '781234567' });
            addRecentSearch('sabar');
            store.setItem('theme', 'dark');
            // Page chargée sans session (visiteur compris) : le numéro de paiement seulement, les recherches restent
            clearDevicePrefs('paiement');
            assert.equal(readPaymentPreference(), null, 'numéro de paiement effacé');
            assert.deepEqual(readRecentSearches(), ['sabar'], 'recherches récentes gardées pour une visite sans compte');
            // Déconnexion (bouton, SIGNED_OUT) : tout
            savePaymentPreference({ operator: 'ORANGE_MONEY', phone: '781234567' });
            clearDevicePrefs();
            assert.deepEqual([...store.map.keys()], ['theme'], 'préférences de l’appareil effacées, rien d’autre');
            assert.ok(PAYMENT_PREF_KEY.startsWith(DEVICE_PREFS_PREFIX) && RECENT_SEARCHES_KEY.startsWith(DEVICE_PREFS_PREFIX));

            store.failWrites = true;
            assert.equal(savePaymentPreference({ operator: 'WAVE', phone: '771234567' }), false, 'stockage plein : sans erreur');
            g.window = { get localStorage(): Storage { throw new Error('SecurityError'); } };
            assert.equal(readPaymentPreference(), null, 'stockage refusé : sans erreur');
            assert.deepEqual(addRecentSearch('sabar'), []);
            clearDevicePrefs();
        } finally {
            delete g.window;
        }
    });

    test('purge : tout au bouton et sur SIGNED_OUT ; numéro de paiement sur une page chargée sans session', () => {
        const src = read('components/providers/AuthProvider.tsx');
        assert.equal((src.match(/clearDevicePrefs\(\);/g) ?? []).length, 2, 'SIGNED_OUT et bouton : tout');
        assert.equal((src.match(/clearDevicePrefs\('paiement'\);/g) ?? []).length, 1, 'session close à l’insu ou visite sans compte : le numéro');
    });
});

describe('5. recherche instantanée', () => {
    function card(i: number, over: Partial<CatalogEventDto> = {}): CatalogEventDto {
        return {
            id: `e${i}`, slug: `e${i}`, title: `Concert ${i}`, subtitle: 'Org', imageUrl: null, posterColor: '#14213d', dateFormatted: '', dayNumber: '21',
            monthShort: 'NOV', timeFormatted: '20:00', venue: 'Grand Théâtre', category: 'CONCERT', categoryLabel: 'Concert', city: 'DAKAR', price: 5000,
            priceFormatted: '5 000 F CFA', onSaleSoon: false, saleLabel: '', status: 'PUBLIE', stock: null,
            startsAt: '2026-11-21T20:00:00.000Z', endsAt: '2026-11-22T02:00:00.000Z', paidFrom: 5000, ...over,
        };
    }
    test('2 caractères au moins, forme pliée, 8 résultats au plus, aucune affiche d’un autre hôte', () => {
        const events = [...Array.from({ length: 12 }, (_, i) => card(i)), card(99, { title: 'Soirée Thiès', city: 'THIÈS', imageUrl: 'https://autre.example/a.webp' })];
        assert.deepEqual(instantSearch(events, 'c'), { q: 'c', results: [], total: 0 });
        const r = instantSearch(events, '  CONCERT\u0000  ');
        assert.equal(r.q, 'CONCERT');
        assert.equal(r.total, 12);
        assert.equal(r.results.length, 8);
        assert.deepEqual(Object.keys(r.results[0]).sort(), ['id', 'imageUrl', 'place', 'posterColor', 'price', 'title', 'when']);
        const t = instantSearch(events, 'thies');
        assert.deepEqual(t.results.map((x) => [x.id, x.place, x.imageUrl]), [['e99', 'Thiès · Grand Théâtre', null]]);
        assert.equal(instantSearch(events, 'x'.repeat(200)).q.length, 60);
    });
});

describe('6. prix d’appel de l’aperçu', () => {
    test('gratuit, gratuit ou dès, dès, aucun', () => {
        assert.equal(sharePriceLabel([0]), 'Gratuit');
        assert.equal(sharePriceLabel([0, 2000, 5000]), 'Gratuit ou dès 2 000 F CFA');
        assert.equal(sharePriceLabel([15000, 5000]), 'Dès 5 000 F CFA');
        assert.equal(sharePriceLabel([]), null);
    });
});

describe('2 bis. compte à rebours des cartes (à la minute)', () => {
    test('jours et heures, puis heures et minutes, jamais de secondes', async () => {
        const { cardCountdown } = await import('../../lib/events/countdown');
        const start = Date.UTC(2026, 10, 21, 20, 0, 0);
        const iso = (ms: number): string => new Date(ms).toISOString();
        const end = iso(start + 6 * HOUR);
        assert.equal(cardCountdown(start - 8 * DAY, iso(start), end).text, null);
        assert.equal(cardCountdown(start - (2 * DAY + 4 * HOUR), iso(start), end).text, 'Commence dans 2 j 4 h');
        assert.equal(cardCountdown(start - (3 * HOUR + 11 * MINUTE + 30 * SECOND), iso(start), end).text, 'Commence dans 3 h 12 min');
        assert.equal(cardCountdown(start - 30 * SECOND, iso(start), end).text, 'Commence dans 1 min');
        assert.ok((cardCountdown(start - 3 * HOUR - 30 * SECOND, iso(start), end).nextIn ?? 0) >= SECOND);
        assert.equal(cardCountdown(start + MINUTE, iso(start), end).text, 'En cours');
    });
});
