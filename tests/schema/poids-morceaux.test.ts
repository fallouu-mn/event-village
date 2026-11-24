/**
 * Lot poids (piste 4) — table des morceaux chargeables à la demande (webpack.js, chargé par toutes les pages).
 *  - next.config.mjs : morceaux chargeables du NAVIGATEUR en production nommés avec une empreinte de 8 caractères
 *    (« [name].[contenthash:8].js ») au lieu de 16 : la table de webpack.js garde 8 caractères par morceau ; serveur et
 *    développement inchangés ;
 *  - le nom reste unique (numéro du morceau) et change avec le contenu (empreinte du contenu) : cache « immutable » sûr ;
 *  - scripts/js-budget.mjs compte toujours les entrées de la table (empreintes de 8 à 16 caractères) ;
 *  - le service worker repère les ressources par un motif sans longueur d'empreinte (public/sw.js, ASSET_RE).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

describe('lot poids — empreintes courtes dans la table des morceaux', () => {
    test('next.config.mjs : navigateur en production seulement, empreinte du contenu sur 8 caractères', () => {
        const conf = read('next.config.mjs');
        const corps = conf.slice(conf.indexOf('webpack(config'), conf.indexOf('return config;'));
        assert.match(corps, /if \(!isServer && !dev\) \{\n\s+config\.output\.chunkFilename = 'static\/chunks\/\[name\]\.\[contenthash:8\]\.js';\n\s+\}/);
        assert.doesNotMatch(corps, /config\.output\.filename/, 'fichiers d\'entrée (premier chargement) inchangés');
    });

    test('js-budget.mjs compte les entrées de la table avec des empreintes de 8 caractères', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'poids-morceaux-'));
        const chunks = path.join(dir, 'static', 'chunks');
        fs.mkdirSync(path.join(chunks, 'app'), { recursive: true });
        const runtime = 'static/chunks/webpack-0123456789abcdef.js';
        fs.writeFileSync(path.join(dir, runtime), 'u=e=>"static/chunks/"+e+"."+{123:"0a1b2c3d",4567:"89abcdef",89:"fedcba98"}[e]+".js"');
        for (const [id, h] of [['123', '0a1b2c3d'], ['4567', '89abcdef'], ['89', 'fedcba98']]) fs.writeFileSync(path.join(chunks, `${id}.${h}.js`), `/* ${id} */`);
        const pages: Record<string, string[]> = { '/layout': [runtime] };
        for (const p of ['/page', '/events/[id]/page', '/tickets/page', '/controller/scanner/page', '/billet/hors-ligne/page', '/explore/page']) {
            const f = `static/chunks/app/${p.replace(/[[\]/]/g, '_')}.js`;
            fs.writeFileSync(path.join(dir, f), 'x');
            pages[p] = [f];
        }
        fs.writeFileSync(path.join(dir, 'app-build-manifest.json'), JSON.stringify({ pages }));
        const r = spawnSync(process.execPath, ['scripts/js-budget.mjs', '--next-dir', dir, '--budget', path.join(dir, 'aucun.json'), '--out', path.join(dir, 'o.tsv')], { cwd: ROOT, encoding: 'utf8' });
        assert.equal(r.status, 0, r.stderr);
        assert.match(r.stdout, /\/ · table des morceaux : 3 entrées/);
        assert.match(r.stdout, /morceau 4567 : \d+ octets gzip/);
        assert.doesNotMatch(r.stdout, /fichier introuvable/);
        fs.rmSync(dir, { recursive: true, force: true });
    });

    test('carte d\'un lieu (EventMap) : un seul import() dans tout le code (components/ui/event-map-load.ts), aucune variante', () => {
        const sites: string[] = [];
        const walk = (p: string) => {
            for (const e of fs.readdirSync(p, { withFileTypes: true })) {
                const f = path.join(p, e.name);
                if (e.isDirectory()) { if (!e.name.startsWith('.')) walk(f); } else if (/\.(tsx?|jsx?)$/.test(e.name)) {
                    const n = (fs.readFileSync(f, 'utf8').match(/import\(\s*['"](?:@\/components\/ui|\.)\/EventMap['"]\s*\)/g) ?? []).length;
                    for (let i = 0; i < n; i++) sites.push(path.relative(ROOT, f).split(path.sep).join('/'));
                }
            }
        };
        for (const d of ['app', 'components', 'lib', 'hooks']) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
        assert.deepEqual(sites, ['components/ui/event-map-load.ts']);
        for (const f of ['app/admin/events/[id]/page.tsx', 'app/admin/halls/[id]/page.tsx', 'app/admin/venues/[id]/page.tsx',
            'components/partner/pilotage/InfosTab.tsx', 'components/event-page/VenueMap.tsx']) {
            assert.match(read(f), /dynamic\(\s*\(\) => loadEventMap\(\)\.then\(\(m\) => \(\{ default: m\.EventMap \}\)\),\s*\{\s*ssr: false,/, `${f} : chargeur unique, sans rendu serveur`);
        }
    });

    test('service worker : ressources repérées sans longueur d\'empreinte', () => {
        assert.match(read('public/sw.js'), /const ASSET_RE = \/\(\?:\\\/_next\\\/\)\?static\\\/\(\?:chunks\|css\|media\)\\\/\[\^"'\\s\)\\\\\]\+\/g;/);
    });
});
