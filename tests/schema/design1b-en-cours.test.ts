/**
 * Design 1b (point 11) — « En cours » : entre le début et la fin retenue (public.event_end_at, miroir lib/events/event-end.ts),
 * calculé sur le téléphone (lib/events/live-status.ts, components/events/useLiveNow.ts).
 * Cas exigés : début 22:00 sans fin (fin retenue : début + 6 h, soit 04:00 le lendemain) ; 22:00 → 05:00 le lendemain.
 * Fuseau Africa/Dakar = UTC+0 : les heures saisies sont des heures UTC.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isLiveAt, liveLabel, liveWindow, liveWindowFromIso, nextLiveChange } from '../../lib/events/live-status';

const at = (iso: string): Date => new Date(iso);

describe('design 1b — « En cours » entre le début et la fin retenue', () => {
    test('début 22:00 sans fin : en cours de 22:00 à 03:59, plus à 04:00 (fin retenue : début + 6 h)', () => {
        const w = liveWindow({ start_date: '2026-12-05', start_time: '22:00:00', end_date: null, end_time: null });
        assert.ok(w);
        assert.equal(w.endsAt.toISOString(), '2026-12-06T04:00:00.000Z');
        assert.equal(isLiveAt(w, at('2026-12-05T21:59:59Z')), false, 'avant le début');
        assert.equal(isLiveAt(w, at('2026-12-05T22:00:00Z')), true, 'au début');
        assert.equal(isLiveAt(w, at('2026-12-06T03:59:00Z')), true, 'avant la fin retenue');
        assert.equal(isLiveAt(w, at('2026-12-06T04:00:00Z')), false, 'à la fin retenue');
        assert.equal(liveLabel(w), 'En cours · se termine vers 04:00');
    });

    test('22:00 → 05:00 le lendemain : en cours jusqu’à 04:59, plus à 05:00', () => {
        const w = liveWindow({ start_date: '2026-12-05', start_time: '22:00', end_date: '2026-12-06', end_time: '05:00' });
        assert.ok(w);
        assert.equal(isLiveAt(w, at('2026-12-05T23:30:00Z')), true);
        assert.equal(isLiveAt(w, at('2026-12-06T04:59:00Z')), true);
        assert.equal(isLiveAt(w, at('2026-12-06T05:00:00Z')), false);
        assert.equal(liveLabel(w), 'En cours · se termine vers 05:00');
    });

    test('le badge change à la bonne minute : prochain changement = début, puis fin, puis plus rien', () => {
        const w = liveWindow({ start_date: '2026-12-05', start_time: '22:00', end_date: '2026-12-06', end_time: '05:00' });
        assert.equal(nextLiveChange(w, at('2026-12-05T20:00:00Z'))?.toISOString(), '2026-12-05T22:00:00.000Z');
        assert.equal(nextLiveChange(w, at('2026-12-05T23:00:00Z'))?.toISOString(), '2026-12-06T05:00:00.000Z');
        assert.equal(nextLiveChange(w, at('2026-12-06T06:00:00Z')), null);
    });

    test('date de fin sans heure : fin du jour indiqué, à 23:59 (même règle que la vente et le scanner)', () => {
        const w = liveWindow({ start_date: '2026-12-05', start_time: '10:00', end_date: '2026-12-05', end_time: null });
        assert.equal(w?.endsAt.toISOString(), '2026-12-05T23:59:00.000Z');
    });

    test('instants ISO du serveur ; valeurs illisibles : jamais « en cours »', () => {
        const w = liveWindowFromIso('2026-12-05T22:00:00Z', '2026-12-06T05:00:00Z');
        assert.equal(isLiveAt(w, at('2026-12-06T01:00:00Z')), true);
        assert.equal(liveWindowFromIso(null, '2026-12-06T05:00:00Z'), null);
        assert.equal(isLiveAt(liveWindow({ start_date: 'pas une date', start_time: null }), new Date()), false);
    });

    test('jamais figé dans une page en cache : faux au premier rendu, minuterie posée sur le prochain changement', () => {
        const src = fs.readFileSync(path.join(process.cwd(), 'components', 'events', 'useLiveNow.ts'), 'utf8');
        assert.match(src, /useState\(false\)/, 'premier rendu (serveur) : pas « en cours »');
        assert.match(src, /nextLiveChange\(/, 'minuterie sur le prochain changement');
        assert.match(src, /visibilitychange/, 'recalcul au retour sur la page');
    });
});
