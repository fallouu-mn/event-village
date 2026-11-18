/**
 * Design 1b (décision 2 de l'utilisateur) — tout changement d'état, de date ou de lieu d'un événement (publication,
 * suspension, réactivation, annulation, report, modification) et toute écriture « À la une » invalident AUSSITÔT la
 * fiche, l'accueil et l'Explorer (caches de 60 s), sans base ni serveur :
 *  - invalidatePublicEvent : étiquettes `fiche-publique`, `catalogue-public`, `accueil`, chemins `/`, `/explore`,
 *    `/events/<id>` ; identifiant invalide ignoré pour le chemin ; jamais d'exception (appel hors du serveur Next) ;
 *  - chaque cache public porte son étiquette (sinon revalidateTag ne le viderait pas) ;
 *  - chaque service appelle l'invalidation APRÈS l'écriture réussie (jamais avant, jamais sur un refus).
 * Le comportement de bout en bout est couvert par la recette (acte 7 : avis d'annulation visible sans attente).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_CACHE_TAGS, invalidatePublicEvent } from '../../lib/events/public-cache.server';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const EVENT_ID = '0b9c2f7e-4a1d-4c3e-9f00-1234567890ab';

describe('design 1b — invalidation des pages publiques', () => {
    test('invalide les trois étiquettes et les trois pages (fiche de l’événement comprise)', () => {
        const tags: string[] = [];
        const paths: string[] = [];
        const done = invalidatePublicEvent(EVENT_ID, 'annulation', { tag: (t) => tags.push(t), path: (p) => paths.push(p) });
        assert.deepEqual([...PUBLIC_CACHE_TAGS].sort(), ['accueil', 'catalogue-public', 'fiche-publique']);
        assert.deepEqual(tags.sort(), ['accueil', 'catalogue-public', 'fiche-publique']);
        assert.deepEqual(paths.sort(), ['/', `/events/${EVENT_ID}`, '/explore']);
        assert.equal(done.length, 6);
    });

    test('sans identifiant (« À la une ») ou identifiant invalide : accueil et Explorer seulement, aucun chemin forgé', () => {
        for (const id of [null, '../../admin', 'abc']) {
            const paths: string[] = [];
            invalidatePublicEvent(id, 'test', { tag: () => undefined, path: (p) => paths.push(p) });
            assert.deepEqual(paths.sort(), ['/', '/explore'], `id ${String(id)}`);
        }
    });

    test('jamais d’exception : une invalidation impossible n’annule pas l’action déjà écrite', () => {
        const boom = () => { throw new Error('hors du serveur Next'); };
        assert.doesNotThrow(() => invalidatePublicEvent(EVENT_ID, 'test', { tag: boom, path: boom }));
        assert.deepEqual(invalidatePublicEvent(EVENT_ID, 'test', { tag: boom, path: boom }), []);
        // Appel réel (next/cache) hors d'une requête Next : ne lève pas non plus
        assert.doesNotThrow(() => invalidatePublicEvent(EVENT_ID, 'test'));
    });

    test('chaque cache public porte son étiquette', () => {
        assert.match(read('lib/events/event-detail.server.ts'), /tags:\s*\['fiche-publique'\]/);
        assert.match(read('lib/events/catalog-cache.server.ts'), /unstable_cache\(readCatalogEvents,[^\n]*tags:\s*\['catalogue-public'\]/);
        const home = read('app/_accueil/data.server.ts');
        assert.match(home, /const cachedFeatured = unstable_cache\([^\n]*tags:\s*\['accueil'\]/);
        assert.match(home, /const cachedPopular = unstable_cache\([^\n]*tags:\s*\['accueil'\]/);
        // L'accueil et l'Explorer lisent le catalogue étiqueté
        assert.match(read('app/explore/page.tsx'), /cachedCatalogEvents\(\)/);
    });

    /** L'appel suit l'écriture réussie : après `after`, avant `before` (fin de la fonction). */
    const calledAfter = (rel: string, after: RegExp, call: RegExp, label: string) => {
        const src = read(rel);
        assert.match(src, /import \{ invalidatePublicEvent \} from '@\/lib\/events\/public-cache\.server';/, `${label} : import`);
        const a = src.search(after);
        assert.ok(a >= 0, `${label} : point d'écriture introuvable`);
        const c = src.slice(a).search(call);
        assert.ok(c > 0, `${label} : invalidation absente après l'écriture`);
        assert.ok(src.slice(0, a).search(call) < 0, `${label} : invalidation avant l'écriture`);
    };

    test('statut (publication, suspension, réactivation, clôture, retrait) : après le succès de event_transition', () => {
        calledAfter('lib/events/event-lifecycle.service.ts', /if \(body\.ok !== true\) throw refusalToError/, /invalidatePublicEvent\(input\.eventId, /, 'transition');
    });

    test('annulation : après le succès de event_cancel', () => {
        calledAfter('lib/events/event-cancellation.service.ts', /'Annulation de l’événement'\);/, /invalidatePublicEvent\(eventId, 'annulation'\)/, 'annulation');
    });

    test('date, heure, lieu (report compris) : après le succès de event_update', () => {
        calledAfter('lib/events/event.service.ts', /rpcWithRetry\('event_update', \{/, /invalidatePublicEvent\(eventId, 'modification'\)/, 'modification');
        // pas sur l'aperçu (event_update_preview : rien n'est écrit)
        const src = read('lib/events/event.service.ts');
        const preview = src.slice(src.indexOf("rpcWithRetry('event_update_preview'"));
        assert.ok(!/invalidatePublicEvent/.test(preview.slice(0, preview.indexOf('\n    }\n'))), 'aperçu : aucune invalidation');
    });

    test('« À la une » : ajout, ordre, période et retrait invalident l’accueil ; les lectures non', () => {
        const src = read('lib/events/featured.server.ts');
        assert.match(src, /FEATURED_WRITES[^\n]*'home_featured_add', 'home_featured_reorder', 'home_featured_set_window', 'home_featured_remove'/);
        assert.match(src, /if \(reply\.ok === true\) \{\n[^\n]*\n\s*if \(FEATURED_WRITES\.has\(fn\)\) invalidatePublicEvent\(null, fn\);/);
    });
});
