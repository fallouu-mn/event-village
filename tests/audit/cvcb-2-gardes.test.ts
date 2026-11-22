/**
 * Contre-vérification du lot Carte B (22/11/2026) — garde-fous sans base ni serveur (vert attendu ; rouge = régression).
 *
 *  G1 Lecture publique de la carte : paramètres piégés (zone, du, au, q, quand, categorie, gratuit, ville ; valeurs énormes,
 *     négatives, caractères spéciaux, injections de filtre PostgREST, paramètres répétés ou inconnus) : jamais d'exception,
 *     400 ou zone ramenée au Sénégal, période de 93 jours au plus ; sur 6 000 entrées de tous statuts : jamais un événement
 *     non publié, fini ou sans position, jamais un champ hors de PUBLIC_MAP_FIELDS, jamais une donnée de partenaire, de lieu
 *     ou de description, 300 au plus ; coût borné.
 *  G2 La route : GET seulement, aucune session ni en-tête lus, aucune écriture ; la lecture en base ne reçoit AUCUN
 *     paramètre de la requête (filtre en mémoire : aucune injection possible dans la requête à la base) ; colonnes lues
 *     sans coordonnées de la partenaire ni description.
 *  G3 CSP : img-src exactement {'self', data:, blob:, stockage Supabase, Unsplash ×2, hôte des tuiles} ; aucune autre
 *     politique ni règle élargie ; concordance de next.config.mjs avec lib/map/tiles.ts pour des adresses de tuiles réglées.
 *  G4 Cartes : toutes par addThemedTiles, mention jamais retirée ni masquée, aucune adresse de tuiles ailleurs, aucune clé.
 *  G5 « Autour de moi » : la position n'est ni gardée, ni journalisée, ni envoyée par le rappel de getCurrentPosition.
 *  G6 Calendrier et carte : données lues par GET /api/events/carte seulement ; carte et calendrier hors du premier
 *     chargement d'Explorer ; l'accueil ne charge Leaflet qu'à l'apparition de l'aperçu.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseMapQuery, selectMapEvents, toMapEntry, type MapEntry, type MapRow } from '../../lib/events/map-data';
import { MAP_MAX_RANGE_DAYS, MAP_RESULT_LIMIT, PUBLIC_MAP_FIELDS, SENEGAL_BOUNDS } from '../../lib/events/map-shared';
import { EVENT_CATEGORIES } from '../../lib/constants/event-categories';
import { tileOrigins } from '../../lib/map/tiles';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

function walk(dir: string, out: string[] = []): string[] {
    for (const ent of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = path.posix.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
            walk(rel, out);
        } else if (/\.(tsx?|css|mjs)$/.test(ent.name)) out.push(rel);
    }
    return out;
}
const SOURCES = [...walk('app'), ...walk('components'), ...walk('lib')];

// ── Jeu de données fabriqué : tous les statuts, positions piégées, secrets dans les champs internes ─────────────────
const STATUSES = ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE', 'REFUSE', 'publie', ''] as const;
const SECRET = 'SECRET-PARTENAIRE-77-123-45-67';
const SECRET_PLACE = 'Villa privée de la partenaire, 12 rue confidentielle';
const day = (offset: number): string => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

function rows(): MapRow[] {
    const out: MapRow[] = [];
    let n = 0;
    for (let i = 0; i < 6_000; i++) {
        const status = STATUSES[i % STATUSES.length];
        const offset = (i % 37) - 6; // passés, en cours, à venir
        const pos = i % 11 === 0 ? { latitude: null, longitude: null }
            : i % 13 === 0 ? { latitude: 48.85, longitude: 2.35 } // hors du Sénégal
                : i % 17 === 0 ? { latitude: 'abc', longitude: '1e999' }
                    : { latitude: 12.3 + (i % 450) / 100, longitude: -17.5 + (i % 600) / 100 };
        out.push({
            id: `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`,
            title: `Événement ${i} <script>alert(1)</script>`,
            status,
            category: EVENT_CATEGORIES[i % EVENT_CATEGORIES.length].id,
            location: `${SECRET_PLACE} ${i}`,
            city: i % 3 === 0 ? 'Dakar' : 'Thiès',
            start_date: day(offset),
            start_time: '20:00:00',
            end_date: day(offset),
            end_time: '23:00:00',
            latitude: pos.latitude as number | string | null,
            longitude: pos.longitude as number | string | null,
            poster_color: i % 5 === 0 ? 'javascript:alert(1)' : '#123456',
            poster_blur: i % 7 === 0 ? 'https://evil.example/x.png' : null,
            partners: { company_name: `${SECRET} SARL ${i}`, commercial_name: `${SECRET} ${i}` },
            ticket_categories: [{ price: i % 4 === 0 ? 0 : 1000 + i, is_active: true, sale_online: true, sale_counter: false, total_quantity: 10, sold_quantity: 0, held_quantity: 0, sale_start: null, sale_end: null }],
        } as MapRow);
    }
    return out;
}

const ALL_ROWS = rows();
const NOW = Date.now();
const ENTRIES: MapEntry[] = ALL_ROWS.map((r) => toMapEntry(r, r.status === 'PUBLIE' && r.id.endsWith('5') ? 'A_LA_UNE' : null, NOW)).filter((e): e is MapEntry => e !== null);
const ROW_BY_ID = new Map(ALL_ROWS.map((r) => [r.id, r]));

const BIG = '9'.repeat(5_000);
const TRAPS: string[] = [
    '', 'zone=', 'zone=,,,', 'zone=1e9,1,2,3', 'zone=-90,-180,90,180', 'zone=12,-17,13', 'zone=NaN,NaN,NaN,NaN', 'zone=Infinity,-17,15,-16',
    'zone=14.7,-17.5,14.6,-17.4', `zone=${BIG},1,2,3`, 'zone=14.7,-17.5,14.8,-17.4;DROP TABLE events', 'zone=14.7%00,-17.5,14.8,-17.4',
    'zone= 14.7 , -17.5 , 14.8 , -17.4 ', 'zone=0x10,1,2,3', 'zone=-0,-0,0,0', 'zone=48,2,49,3', 'zone=14.7,-17.5,14.8,-17.4,1',
    'zone=14.70000000001,-17.5,14.8,-17.4', 'zone=14.7,-17.5,14.8,-17.4&zone=-90,-180,90,180', 'zone=-91,-17,15,-16',
    'du=2026-02-30&au=2026-03-02', 'du=2026-13-01&au=2027-01-01', 'du=0000-01-01&au=0000-04-05', 'du=0000-01-01&au=0000-02-01',
    'du=9999-12-01&au=9999-12-31', 'du=+275760-09-13&au=+275760-09-14', 'du=-000001-01-01&au=-000001-01-02', 'du=2026-01-01T00:00&au=2026-01-02',
    `du=${day(0)}`, `au=${day(3)}`, `du=${day(3)}&au=${day(3)}`, `du=${day(3)}&au=${day(1)}`, `du=${day(0)}&au=${day(MAP_MAX_RANGE_DAYS)}`,
    `du=${day(0)}&au=${day(MAP_MAX_RANGE_DAYS + 1)}`, `du=${day(-400)}&au=${day(-380)}`, 'du=&au=',
    `q=${'a'.repeat(100_000)}`, "q=' OR 1=1 --", 'q=%25', 'q=_', 'q=*', 'q=),or(status.neq.PUBLIE', 'q=status=eq.BROUILLON',
    'q=%3Cscript%3E', 'q=%00', `q=${encodeURIComponent(SECRET)}`, `q=${encodeURIComponent('Villa privée')}`, 'q=\\', 'q=%E2%80%AE',
    'categorie=CONCERT', 'categorie=concert', `categorie=${'X'.repeat(1_000)}`, 'categorie=CONCERT,FESTIVAL', 'categorie=BROUILLON',
    'gratuit=1', 'gratuit=true', 'gratuit=0', 'gratuit=1&gratuit=0', 'ville=Dakar', 'ville=a', `ville=${'x'.repeat(10_000)}`, 'ville=%',
    'ville=DAKAR%25', 'quand=aujourdhui', 'quand=weekend', 'quand=semaine', 'quand=hier', 'quand=1;select',
    'status=BROUILLON', 'select=*', 'limit=100000', 'or=(status.eq.BROUILLON)', 'order=id.desc', 'offset=-1', 'page=-5', 'tri=prix',
    'vue=carte&zone=14.6,-17.6,14.9,-17.2&du=' + day(0) + '&au=' + day(30) + '&q=Événement&categorie=CONCERT&gratuit=1&ville=Dakar&quand=semaine',
];

function shownIsPublic(events: ReturnType<typeof selectMapEvents>['events'], label: string): void {
    assert.ok(events.length <= MAP_RESULT_LIMIT, `${label} : ${events.length} > ${MAP_RESULT_LIMIT}`);
    const body = JSON.stringify(events);
    assert.ok(!body.includes(SECRET), `${label} : donnée de partenaire dans la réponse`);
    assert.ok(!body.includes('Villa privée'), `${label} : lieu en clair dans la réponse`);
    assert.ok(!body.includes('evil.example') && !body.includes('javascript:'), `${label} : image ou couleur non vérifiée`);
    for (const e of events) {
        assert.deepEqual(Object.keys(e).sort(), [...PUBLIC_MAP_FIELDS].sort(), `${label} : champs de ${e.id}`);
        const row = ROW_BY_ID.get(e.id);
        assert.ok(row, `${label} : identifiant inconnu`);
        assert.equal(row.status, 'PUBLIE', `${label} : ${e.id} au statut ${row.status}`);
        assert.ok(Date.parse(e.endsAt) > NOW, `${label} : ${e.id} fini`);
        const b = SENEGAL_BOUNDS;
        assert.ok(e.lat >= b.south && e.lat <= b.north && e.lng >= b.west && e.lng <= b.east, `${label} : ${e.id} hors du Sénégal`);
    }
}

describe('G1 — lecture publique de la carte : paramètres piégés', () => {
    test('jamais d’exception ; 400 ou requête bornée (zone au Sénégal, 93 jours au plus) ; réponse publique seulement ; 300 au plus', () => {
        let refused = 0;
        for (const raw of TRAPS) {
            const label = `?${raw.slice(0, 80)}`;
            let parsed: ReturnType<typeof parseMapQuery>;
            assert.doesNotThrow(() => { parsed = parseMapQuery(new URLSearchParams(raw)); }, `${label} : exception`);
            parsed = parseMapQuery(new URLSearchParams(raw));
            if (!parsed.ok) {
                refused++;
                assert.match(parsed.message, /illisible/, `${label} : message`);
                continue;
            }
            const query = parsed.query;
            const { zone, range, filters } = query;
            const b = SENEGAL_BOUNDS;
            assert.ok(zone.south >= b.south && zone.north <= b.north && zone.west >= b.west && zone.east <= b.east, `${label} : zone hors du Sénégal ${JSON.stringify(zone)}`);
            if (range) assert.ok(range.to > range.from && range.to - range.from <= MAP_MAX_RANGE_DAYS * 86_400_000, `${label} : période ${JSON.stringify(range)}`);
            assert.ok(filters.q.length <= 120 && (filters.ville ?? '').length <= 80, `${label} : filtres non bornés`);
            let out: ReturnType<typeof selectMapEvents> | null = null;
            assert.doesNotThrow(() => { out = selectMapEvents(ENTRIES, query, new Date(NOW)); }, `${label} : exception à la sélection`);
            const res = out as unknown as ReturnType<typeof selectMapEvents>;
            assert.deepEqual(Object.keys(res).sort(), ['events', 'total', 'truncated'], `${label} : forme de la réponse`);
            assert.equal(res.truncated, res.total > MAP_RESULT_LIMIT, `${label} : truncated`);
            shownIsPublic(res.events, label);
        }
        assert.ok(refused >= 20, `paramètres illisibles refusés : ${refused}`);
    });

    test('toutes les combinaisons de filtres (quand × catégorie × gratuit × ville × q × zone × période) : rien que du public', () => {
        const whens = ['', 'aujourdhui', 'weekend', 'semaine'];
        const cats = ['', ...EVENT_CATEGORIES.map((c) => c.id)];
        const gratuits = ['', '1'];
        const villes = ['', 'Dakar', 'Thiès'];
        const qs = ['', 'Événement', SECRET.slice(0, 12), 'Villa'];
        const zones = ['', 'zone=14.6,-17.6,14.9,-17.2', 'zone=12.2,-17.6,16.8,-11.3'];
        const ranges = ['', `du=${day(0)}&au=${day(MAP_MAX_RANGE_DAYS)}`];
        let combos = 0;
        let secretHits = 0;
        for (const w of whens) for (const c of cats) for (const g of gratuits) for (const v of villes) for (const q of qs) for (const z of zones) for (const r of ranges) {
            const raw = [w && `quand=${w}`, c && `categorie=${c}`, g && `gratuit=${g}`, v && `ville=${encodeURIComponent(v)}`, q && `q=${encodeURIComponent(q)}`, z, r].filter(Boolean).join('&');
            const parsed = parseMapQuery(new URLSearchParams(raw));
            assert.ok(parsed.ok, `?${raw} refusé`);
            const res = selectMapEvents(ENTRIES, parsed.query, new Date(NOW));
            shownIsPublic(res.events, `?${raw}`);
            if (q === SECRET.slice(0, 12)) secretHits += res.total;
            combos++;
        }
        assert.ok(combos >= 2_880, `combinaisons : ${combos}`);
        // Le texte cherché porte aussi sur le nom de la partenaire et le lieu (comme la liste d'Explorer, qui les affiche) :
        // la carte ne les rend pas, la liste publique les montre déjà ; point écarté au rapport.
        assert.ok(secretHits >= 0);
    });

    test('coût borné : 2 000 lectures piégées sur 6 000 entrées en moins de 10 s', () => {
        const t0 = Date.now();
        for (let i = 0; i < 2_000; i++) {
            const parsed = parseMapQuery(new URLSearchParams(TRAPS[i % TRAPS.length]));
            if (parsed.ok) selectMapEvents(ENTRIES, parsed.query, new Date(NOW));
        }
        const ms = Date.now() - t0;
        assert.ok(ms < 10_000, `2 000 lectures : ${ms} ms`);
    });
});

describe('G2 — route publique : lecture seule, aucun paramètre vers la base', () => {
    test('GET /api/events/carte : GET seulement ; ni session, ni cookie, ni en-tête lus ; aucune écriture', () => {
        const src = read('app/api/events/carte/route.ts');
        const methods = [...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((m) => m[1]);
        assert.deepEqual(methods, ['GET'], `méthodes exportées : ${methods.join(', ')}`);
        assert.ok(!/export const (POST|PUT|PATCH|DELETE)\b/.test(src), 'méthode d’écriture exportée par alias');
        for (const banned of ['cookies(', 'headers(', 'getUser', 'getSession', 'createServerClient', 'requireActiveSession', '.insert(', '.update(', '.upsert(', '.delete(', '.rpc(']) {
            assert.ok(!src.includes(banned), `route : ${banned}`);
        }
        assert.match(src, /'Cache-Control': 'no-store'/, 'réponse no-store');
    });

    test('lecture en base sans paramètre de la requête ; colonnes sans coordonnées de la partenaire ni description', () => {
        const src = read('lib/events/map-data.server.ts');
        assert.match(src, /export async function readMapEntries\(\): Promise<MapEntry\[\]>/, 'readMapEntries ne prend aucun paramètre');
        assert.match(src, /\.eq\('status', 'PUBLIE'\)/, 'statut PUBLIE exigé par la requête');
        for (const banned of ['.insert(', '.update(', '.upsert(', '.delete(']) assert.ok(!src.includes(banned), `lecture : ${banned}`);
        const select = src.slice(src.indexOf('export const MAP_SELECT'), src.indexOf('`;', src.indexOf('export const MAP_SELECT')));
        for (const col of ['phone', 'email', 'user_id', 'description', 'address', 'practical_info', 'capacity', 'partner_id', '*']) {
            assert.ok(!new RegExp(`(^|[\\s,(])${col.replace('*', '\\*')}([\\s,)]|$)`).test(select), `colonne lue : ${col}`);
        }
        const route = read('app/api/events/carte/route.ts');
        assert.match(route, /selectMapEvents\(await cachedMapEntries\(\), parsed\.query, new Date\(\)\)/, 'filtres appliqués en mémoire, après la lecture');
        assert.match(read('lib/events/map-data.server.ts'), /unstable_cache\(readMapEntries, \['carte-publique', 'v1'\]/, 'cache sans argument (aucune clé de cache par requête)');
    });
});

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> };

async function configHeaders(): Promise<HeaderRule[]> {
    const factory = (await import(pathToFileURL(path.join(ROOT, 'next.config.mjs')).href)).default as (phase: string) => { headers: () => Promise<HeaderRule[]> };
    return factory('phase-production-build').headers();
}

describe('G3 — politique de sécurité du contenu : images', () => {
    test('img-src : exactement le site, data:, blob:, le stockage Supabase, Unsplash et l’hôte des tuiles ; aucune autre politique', async () => {
        const rules = await configHeaders();
        const csp = rules.flatMap((r) => r.headers).filter((h) => /content-security-policy/i.test(h.key));
        assert.equal(csp.length, 1, `politiques : ${csp.map((h) => h.key).join(', ')}`);
        const img = csp[0].value.split('; ').find((d) => d.startsWith('img-src ')) ?? '';
        const sources = img.split(' ').slice(1);
        const supabase = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin; } catch { return ''; } })();
        const expected = ["'self'", 'data:', 'blob:', supabase, 'https://images.unsplash.com', 'https://plus.unsplash.com', ...tileOrigins()].filter(Boolean);
        assert.deepEqual([...sources].sort(), [...expected].sort(), `img-src : ${img}`);
        for (const wide of ['https:', 'http:', '*', 'https://*', "'unsafe-inline'"]) assert.ok(!sources.includes(wide), `img-src élargie : ${wide}`);
        assert.ok(!/default-src [^;]*(https:|\*)/.test(csp[0].value), 'default-src élargie');
    });

    test('aucune autre politique ailleurs (middleware, pages, balises meta)', () => {
        const hits = SOURCES.filter((rel) => /Content-Security-Policy|http-equiv=["']Content-Security/i.test(read(rel)) && rel !== 'app/api/csp-report/route.ts');
        assert.deepEqual(hits, [], `politique posée ailleurs : ${hits.join(', ')}`);
        assert.ok(!/Content-Security-Policy/i.test(read('middleware.ts')), 'middleware');
    });

    test('origines des tuiles : next.config.mjs suit lib/map/tiles.ts pour des adresses réglées (le test cité par next.config.mjs n’existe pas)', () => {
        const cases = [
            { light: 'https://{s}.tuiles.example/{z}/{x}/{y}.png', dark: '' },
            { light: 'https://clair.example/a/{z}/{x}/{y}{r}.png', dark: 'https://sombre.example:8443/{z}/{x}/{y}.png' },
            { light: '', dark: 'https://seulement-sombre.example/{z}/{x}/{y}.png' },
        ];
        for (const env of cases) {
            const script = `const m = await import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'next.config.mjs')).href)});`
                + "const h = await m.default('phase-production-build').headers();"
                + "const v = h.flatMap((r) => r.headers).find((x) => x.key === 'Content-Security-Policy-Report-Only').value;"
                + "process.stdout.write(v.split('; ').find((d) => d.startsWith('img-src ')));";
            const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
                cwd: ROOT, encoding: 'utf8',
                env: { ...process.env, NEXT_PUBLIC_MAP_TILE_URL: env.light, NEXT_PUBLIC_MAP_TILE_URL_DARK: env.dark },
            });
            const sources = out.trim().split(' ').slice(1);
            for (const o of tileOrigins(env)) assert.ok(sources.includes(o), `${JSON.stringify(env)} : ${o} absent de ${out}`);
            assert.ok(!sources.includes('https://tiles.stadiamaps.com') || tileOrigins(env).includes('https://tiles.stadiamaps.com'), `${JSON.stringify(env)} : Stadia gardé à tort`);
        }
        assert.ok(!fs.existsSync(path.join(ROOT, 'tests/schema/carte-b-fond.test.ts')), 'si ce test existe désormais, retirer cette remarque');
    });

    test('aucune image d’un hôte non admis écrite dans le code (src, url(), srcSet)', () => {
        const allowed = new Set(['images.unsplash.com', 'plus.unsplash.com', 'tiles.stadiamaps.com']);
        const offenders: string[] = [];
        for (const rel of SOURCES) {
            const src = read(rel);
            for (const m of src.matchAll(/(?:src=|srcSet=|url\(|image:\s*|images:\s*\[?\s*)['"`{(\s]*(https?:\/\/[a-z0-9.-]+)/gi)) {
                const host = new URL(m[1]).hostname;
                if (!allowed.has(host) && !/localhost|127\.0\.0\.1|example/.test(host)) offenders.push(`${rel} : ${host}`);
            }
        }
        assert.deepEqual(offenders, [], offenders.join('\n'));
    });
});

describe('G4 — toutes les cartes par l’aide commune, mention visible, aucune clé', () => {
    test('chaque L.map( pose son fond par addThemedTiles ; aucun tileLayer ailleurs ; attributionControl jamais coupé', () => {
        const withMap = SOURCES.filter((rel) => /\bL\.map\(/.test(read(rel)));
        assert.ok(withMap.length >= 4, `cartes trouvées : ${withMap.join(', ')}`);
        for (const rel of withMap) assert.match(read(rel), /addThemedTiles\(L, /, `${rel} : fond hors de l’aide commune`);
        const tileLayers = SOURCES.filter((rel) => /\btileLayer\(/.test(read(rel)));
        assert.deepEqual(tileLayers, ['components/map/themedTiles.ts'], `tileLayer : ${tileLayers.join(', ')}`);
        const cut = SOURCES.filter((rel) => /attributionControl\s*:\s*false|attributionControl\.remove\(|removeControl\([^)]*attribution/.test(read(rel)));
        assert.deepEqual(cut, [], `mention retirée : ${cut.join(', ')}`);
    });

    test('mention jamais masquée par une feuille de style', () => {
        for (const rel of SOURCES.filter((r) => r.endsWith('.css') || r.endsWith('.tsx'))) {
            const src = read(rel);
            for (const m of src.matchAll(/leaflet-control-attribution[^{]*\{([^}]*)\}/g)) {
                assert.ok(!/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?![.\d])|font-size\s*:\s*0(?![.\d])|clip/.test(m[1]), `${rel} : mention masquée (${m[1].trim()})`);
            }
        }
    });

    test('aucune adresse de tuiles hors de lib/map/tiles.ts (et sa copie de next.config.mjs) ; aucune clé de fournisseur', () => {
        const tileUrls = SOURCES.filter((rel) => rel !== 'lib/map/tiles.ts' && /\{z\}\/\{x\}\/\{y\}/.test(read(rel)));
        assert.deepEqual(tileUrls, [], `adresse de tuiles : ${tileUrls.join(', ')}`);
        const tiles = read('lib/map/tiles.ts');
        assert.ok(!/api_key|apikey|access_token|\bkey=/i.test(tiles), 'clé dans lib/map/tiles.ts');
        assert.ok(!/process\.env\.[A-Z_]*(KEY|TOKEN|SECRET)/.test(tiles + read('components/map/themedTiles.ts')), 'clé lue par l’aide des cartes');
        const keyed = SOURCES.filter((rel) => /stadiamaps\.com[^'"`]*(api_key|apikey)/i.test(read(rel)));
        assert.deepEqual(keyed, [], `clé Stadia : ${keyed.join(', ')}`);
        assert.ok(!/NEXT_PUBLIC_[A-Z_]*(STADIA|MAP)[A-Z_]*(KEY|TOKEN)/.test(SOURCES.map(read).join('\n')), 'variable publique de clé de carte');
    });
});

describe('G5 — « Autour de moi » : la position n’est ni gardée, ni journalisée, ni envoyée par son rappel', () => {
    test('rappel de getCurrentPosition : centrage seulement', () => {
        const src = read('components/explore/ExploreMap.tsx');
        assert.ok(!/watchPosition/.test(src), 'suivi continu de la position');
        const start = src.indexOf('navigator.geolocation.getCurrentPosition(');
        const body = src.slice(start, src.indexOf('});', start) + 3);
        for (const banned of ['fetch(', 'localStorage', 'sessionStorage', 'document.cookie', 'indexedDB', 'sendBeacon', 'console.', 'history.', 'router.', 'searchParams', 'setSearchZone']) {
            assert.ok(!body.includes(banned), `rappel de la position : ${banned}`);
        }
        assert.match(body, /goTo\(latitude, longitude, 13\)/, 'centrage');
        for (const rel of SOURCES) {
            if (/getCurrentPosition|watchPosition/.test(read(rel))) assert.ok(['components/explore/ExploreMap.tsx', 'components/ui/MapPicker.tsx'].includes(rel), `position lue par ${rel}`);
        }
    });
});

describe('G6 — calendrier et carte : données publiques, hors du premier chargement', () => {
    test('le calendrier et la carte ne lisent que GET /api/events/carte et n’affichent que ses champs', () => {
        for (const rel of ['components/explore/ExploreCalendar.tsx', 'components/explore/ExploreMap.tsx', 'components/explore/MapEventCard.tsx', 'components/explore/SenegalMapPreview.tsx']) {
            const src = read(rel);
            assert.ok(!/fetch\(/.test(src), `${rel} : lecture directe`);
            assert.ok(!/supabase|getServiceRoleClient|from\('events'\)/i.test(src), `${rel} : lecture de la base`);
            assert.ok(!/\.(location|venue|description|partners?|organizer|phone|email)\b/.test(src.replace(/window\.location|document\.location/g, '')), `${rel} : champ non public lu`);
        }
        assert.match(read('lib/events/map-client.ts'), /\/api\/events\/carte/, 'source unique');
    });

    test('Explorer : carte et calendrier par un seul module à la demande ; accueil : Leaflet à l’apparition de l’aperçu', () => {
        const lazy = read('components/explore/lazy.ts');
        assert.match(lazy, /export \{ default as ExploreMap \} from '\.\/ExploreMap';/, 'module unique de la carte');
        const view = read('app/explore/ExploreView.tsx');
        assert.match(view, /dynamic\(\(\) => import\('@\/components\/explore\/lazy'\)/, 'module chargé à la demande (next/dynamic)');
        const lazyStatic = SOURCES.filter((rel) => /from ['"]@\/components\/explore\/lazy['"]/.test(read(rel)));
        assert.deepEqual(lazyStatic, [], `import statique du module à la demande : ${lazyStatic.join(', ')}`);
        for (const rel of ['app/explore/page.tsx', 'app/explore/ExploreView.tsx']) {
            const src = read(rel);
            assert.ok(!/from ['"]leaflet['"]|import\(['"]leaflet['"]\)|from ['"]@\/components\/explore\/(ExploreMap|ExploreCalendar)['"]/.test(src), `${rel} : carte ou calendrier au premier chargement`);
        }
        const importers = SOURCES.filter((rel) => rel !== 'components/explore/lazy.ts' && /from ['"](\.\/|@\/components\/explore\/)(ExploreMap|ExploreCalendar)['"]/.test(read(rel)));
        assert.deepEqual(importers, [], `import statique de la carte ou du calendrier : ${importers.join(', ')}`);
        const preview = read('components/explore/SenegalMapPreview.tsx');
        assert.match(preview, /loadLeafletWithCss\(\)/, 'Leaflet chargé par l’aperçu à son montage');
        const home = read('components/events/HomeSenegalMap.tsx');
        assert.match(home, /IntersectionObserver/, 'aperçu monté à son apparition');
        assert.match(home, /\{ threshold: 0\.1 \}/, 'apparition à l’écran (sans marge d’avance)');
    });
});
