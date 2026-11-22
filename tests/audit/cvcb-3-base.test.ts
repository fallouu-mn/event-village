/**
 * Contre-vérification du lot Carte B (22/11/2026) — garde-fous sur la base locale (vert attendu ; rouge = régression).
 *
 *  B1 Données réelles : un événement de CHAQUE statut (brouillon, en attente, validé, publié, suspendu, annulé, terminé),
 *     publié fini, publié sans position — TOUS dotés d'une position valide sauf le dernier (l'exclusion ne tient donc pas
 *     à l'absence de position) ; lecture réelle (readMapEntries, celle que la route met en cache) puis selectMapEvents pour
 *     toutes les combinaisons de filtres et des paramètres piégés : seul le publié à venir avec position sort, avec les seuls
 *     champs publics ; ni nom, téléphone, adresse électronique ou identifiant de la partenaire, ni lieu, ni description.
 *  B2 Middleware : le préfixe public /leaflet/ ne rend publique aucune autre page ni route (chemins détournés que le
 *     navigateur ou Next normalisent : ../, %2e%2e, //, majuscules) ; les fichiers statiques prévus passent.
 *     Les chemins que l'URL ne normalise pas (..%2f, %5c) passent le middleware par le préfixe : leur sort est décidé par le
 *     routeur de Next, éprouvé de bout en bout (requêtes brutes) par e2e/cvcb.responsive.spec.ts.
 *
 * Écart signalé : suite de lecture (montage par les aides des suites du lot), elle n'appelle pas assertRecetteInvariants.
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { createTimedEvent } from '../parcours/acces-helpers';
import { createEventInStatus, shiftEventDates, type EventStatus } from '../parcours/cycle-helpers';
import { service } from '../parcours/paiement-helpers';
import { callMiddleware } from '../helpers/middleware';
import { readMapEntries } from '../../lib/events/map-data.server';
import { parseMapQuery, selectMapEvents } from '../../lib/events/map-data';
import { PUBLIC_MAP_FIELDS, type PublicMapEvent } from '../../lib/events/map-shared';
import { EVENT_CATEGORIES } from '../../lib/constants/event-categories';

const STAMP = Date.now();
const CATS = [{ name: 'Standard', price: 2500, total: 40 }];
const SECRET_PLACE = `Domicile confidentiel cvcb ${STAMP}`;
const SECRET_DESC = `Description réservée cvcb ${STAMP} : code portail 4471`;

let P: TestPartner;
const ids: Record<string, string> = {};
const SECRETS: string[] = [];

before(async () => {
    P = await newPartner('cvcb');
    const common = { startsInHours: 30, location: SECRET_PLACE, city: 'Dakar' };
    const plan: Array<[string, EventStatus, Record<string, unknown>]> = [
        ['brouillon', 'BROUILLON', {}],
        ['enAttente', 'EN_ATTENTE', {}],
        ['valide', 'VALIDE', {}],
        ['publie', 'PUBLIE', {}],
        ['suspendu', 'SUSPENDU', { suspendReason: 'Contre-vérification carte B' }],
        ['annule', 'ANNULE', { publicNotice: 'Annulé pour la contre-vérification de la carte.', internalReason: 'cvcb' }],
        ['termine', 'TERMINE', { finishShift: { startsInHours: -3 } }],
        ['publieFini', 'PUBLIE', {}],
    ];
    for (const [key, status, extra] of plan) {
        const ev = await createEventInStatus(P, `cvcb-${key}`, CATS, status, { ...common, title: `CVCB ${key} ${STAMP}`, ...extra });
        ids[key] = ev.eventId;
    }
    await shiftEventDates(ids.publieFini, { startsInHours: -6, durationHours: 1 });
    ids.sansPosition = (await createTimedEvent(P.partnerId, 'cvcb-sans-position', CATS, { startsInHours: 30 })).eventId;
    // Position valide (Almadies) pour TOUS, description secrète ; puis sans position pour le dernier
    const { error: upErr } = await service.from('events')
        .update({ latitude: 14.7447, longitude: -17.5106, description: SECRET_DESC, location: SECRET_PLACE })
        .in('id', Object.values(ids));
    assert.equal(upErr, null, `montage : position et description (${upErr?.message})`);
    const { error: posErr } = await service.from('events').update({ latitude: null, longitude: null }).eq('id', ids.sansPosition);
    assert.equal(posErr, null, `montage : position retirée (${posErr?.message})`);
    const { data, error } = await service.from('events').select('id, status, latitude').in('id', Object.values(ids));
    assert.equal(error, null, `relecture du montage : ${error?.message}`);
    const byId = new Map((data ?? []).map((r) => [String(r.id), r]));
    for (const [key, status] of plan) assert.equal(byId.get(ids[key])?.status, status, `montage : ${key} au statut ${status}`);
    for (const key of plan.map(([k]) => k)) assert.equal(Number(byId.get(ids[key])?.latitude), 14.7447, `montage : ${key} avec position`);
    const { data: partner } = await service.from('partners').select('company_name, commercial_name, phone, email').eq('id', P.partnerId).single();
    for (const s of [partner?.company_name, partner?.commercial_name, partner?.phone, partner?.email, P.partnerId, P.userId, SECRET_PLACE, SECRET_DESC]) {
        if (s) SECRETS.push(String(s));
    }
    assert.ok(SECRETS.length >= 6, 'données de contrôle présentes');
});

function check(events: PublicMapEvent[], label: string): void {
    const body = JSON.stringify(events);
    for (const s of SECRETS) assert.ok(!body.includes(s), `${label} : « ${s} » dans la réponse`);
    for (const e of events) assert.deepEqual(Object.keys(e).sort(), [...PUBLIC_MAP_FIELDS].sort(), `${label} : champs de ${e.id}`);
    const shown = new Set(events.map((e) => e.id));
    for (const key of ['brouillon', 'enAttente', 'valide', 'suspendu', 'annule', 'termine', 'publieFini', 'sansPosition']) {
        assert.ok(!shown.has(ids[key]), `${label} : ${key} rendu`);
    }
}

describe('B1 — données réelles, tous statuts, toutes combinaisons de filtres', () => {
    test('seul le publié à venir avec position sort, champs publics seulement, quelle que soit la combinaison', async () => {
        const entries = await readMapEntries();
        const now = new Date();
        const base = parseMapQuery(new URLSearchParams(''));
        assert.ok(base.ok);
        const all = selectMapEvents(entries, base.query, now).events;
        assert.ok(all.some((e) => e.id === ids.publie), 'le publié à venir avec position est rendu');
        check(all, 'sans filtre');
        const qs = ['', `CVCB`, `${STAMP}`, 'Domicile confidentiel', 'code portail', 'Moussa', 'Organisateur', "' or '1'='1", '%', '),or(status.neq.PUBLIE'];
        const villes = ['', 'Dakar', 'DAKAR', 'Thiès'];
        const whens = ['', 'aujourdhui', 'weekend', 'semaine'];
        const cats = ['', ...EVENT_CATEGORIES.map((c) => c.id), 'BROUILLON'];
        const zones = ['', 'zone=14.70,-17.55,14.78,-17.47', 'zone=-90,-180,90,180'];
        const d0 = now.toISOString().slice(0, 10);
        const d93 = new Date(now.getTime() + 93 * 86_400_000).toISOString().slice(0, 10);
        const ranges = ['', `du=${d0}&au=${d93}`];
        let n = 0;
        for (const q of qs) for (const v of villes) for (const w of whens) for (const c of cats) for (const g of ['', '1']) for (const z of zones) for (const r of ranges) {
            const raw = [q && `q=${encodeURIComponent(q)}`, v && `ville=${encodeURIComponent(v)}`, w && `quand=${w}`, c && `categorie=${c}`, g && `gratuit=${g}`, z, r].filter(Boolean).join('&');
            const parsed = parseMapQuery(new URLSearchParams(raw));
            assert.ok(parsed.ok, `?${raw} refusé`);
            check(selectMapEvents(entries, parsed.query, now).events, `?${raw}`);
            n++;
        }
        assert.ok(n > 10_000, `combinaisons : ${n}`);
    });

    test('paramètres piégés sur données réelles : refus ou réponse publique, jamais d’exception', async () => {
        const entries = await readMapEntries();
        for (const raw of ['zone=1e9,1,2,3', 'zone=NaN,1,2,3', `zone=${'9'.repeat(4000)},1,2,3`, 'du=2026-02-30&au=2026-03-01', 'du=0000-01-01&au=9999-01-01',
            `q=${'x'.repeat(50_000)}`, 'status=BROUILLON&select=*&limit=100000', 'categorie=CONCERT&categorie=BROUILLON', 'gratuit=1&ville=%25']) {
            const parsed = parseMapQuery(new URLSearchParams(raw));
            if (!parsed.ok) continue;
            const res = selectMapEvents(entries, parsed.query, new Date());
            assert.ok(res.events.length <= 300, `?${raw.slice(0, 60)} : ${res.events.length}`);
            check(res.events, `?${raw.slice(0, 60)}`);
        }
    });
});

describe('B2 — middleware : /leaflet/ ne rend rien d’autre public', () => {
    test('fichiers statiques de Leaflet servis sans session', async () => {
        for (const p of ['/leaflet/leaflet-1.9.4.css', '/leaflet/marker-icon.png', '/leaflet/marker-icon-2x.png', '/leaflet/marker-shadow.png']) {
            const r = await callMiddleware(p, []);
            assert.ok(r.passedThrough, `${p} : HTTP ${r.status}${r.location ? ` vers ${r.location}` : ''}`);
        }
    });

    test('chemins détournés vers des pages et routes protégées : jamais laissés passer sans session', async () => {
        const targets = ['/admin', '/admin/events', '/partner/dashboard', '/tickets', '/api/admin/users', '/api/partner/profile', '/api/tickets', '/controller/scanner'];
        const forms = (t: string): string[] => [
            `/leaflet/..${t}`, `/leaflet/%2e%2e${t}`, `/leaflet/%2E%2E${t}`, `/leaflet/.%2e${t}`, `/leaflet/x/../..${t}`, `/leaflet/./..${t}`,
            `/LEAFLET/..${t}`, `/leaflet${t}`, `/leafletx${t}`, `${t}/leaflet/`, `${t}?x=/leaflet/`, `${t}#/leaflet/`,
        ];
        const leaks: string[] = [];
        for (const t of targets) {
            for (const p of forms(t)) {
                const r = await callMiddleware(p, []);
                const normalized = new URL(`http://127.0.0.1:3000${p}`).pathname;
                // Laissé passer seulement si le chemin VU par Next commence vraiment par /leaflet/ (fichier statique ou 404)
                if (r.passedThrough && !normalized.startsWith('/leaflet/')) leaks.push(`${p} (vu : ${normalized}) → laissé passer`);
            }
        }
        assert.deepEqual(leaks, [], leaks.join('\n'));
    });

    test('témoin : un chemin non normalisé par l’URL (..%2f) passe le middleware par le préfixe ; le routeur décide (e2e)', async () => {
        const r = await callMiddleware('/leaflet/..%2fadmin', []);
        const seen = new URL('http://127.0.0.1:3000/leaflet/..%2fadmin').pathname;
        assert.equal(seen, '/leaflet/..%2fadmin', 'l’URL ne décode pas %2f');
        assert.ok(r.passedThrough, 'laissé passer par le préfixe (attendu : sort décidé par le routeur, prouvé par l’e2e)');
    });
});
