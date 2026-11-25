/**
 * Lot Carte B (B0) — trous d'invalidation des pages publiques (caches de 60 s : catalogue, accueil, fiche, carte),
 * sans base ni serveur (même méthode que tests/schema/design1b-cache-invalidation.test.ts) :
 *  1. catégories de billets (POST /api/partner/events/[id]/categories, PATCH et DELETE …/[categoryId]) : l'arrêt de
 *     vente d'une catégorie (is_active, sale_online, sale_end), un prix ou un quota changés changent le prix d'appel,
 *     « Gratuit », « Complet » ; rien n'était invalidé (état des lieux du 21/11) ;
 *  2. suspension d'une partenaire (partner_status_set) : la cascade suspend ses événements publiés (lot 9 bis, R5) et la
 *     réactivation les rétablit ; rien n'était invalidé, les événements suspendus restaient sur les pages publiques
 *     (et sur la carte) jusqu'à 60 s.
 * Chaque appel suit l'écriture réussie (jamais avant, jamais sur un refus). La preuve de bout en bout (disparition en
 * moins de 5 s) est dans e2e/carte-b.responsive.spec.ts.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

/** L'appel suit l'écriture réussie : après `after`, et pas avant. */
function calledAfter(rel: string, after: RegExp, call: RegExp, label: string): void {
    const src = read(rel);
    assert.match(src, /import \{ invalidatePublicEvent \} from '@\/lib\/events\/public-cache\.server';/, `${label} : import`);
    const a = src.search(after);
    assert.ok(a >= 0, `${label} : point d'écriture introuvable`);
    const c = src.slice(a).search(call);
    assert.ok(c > 0, `${label} : invalidation absente après l'écriture`);
    assert.ok(src.slice(0, a).search(call) < 0, `${label} : invalidation avant l'écriture`);
}

/** Corps d'une méthode statique de EventService (de sa signature à la méthode suivante). */
function methodBody(name: string): string {
    const src = read('lib/events/event.service.ts');
    const start = src.indexOf(`public static async ${name}(`);
    assert.ok(start >= 0, `EventService.${name} introuvable`);
    const next = src.indexOf('public static async ', start + 10);
    return src.slice(start, next < 0 ? undefined : next);
}

describe('carte B — invalidation après les écritures des catégories de billets', () => {
    for (const [method, rpc] of [
        ['createTicketCategory', 'ticket_category_create'],
        ['updateTicketCategory', 'ticket_category_update'],
        ['deleteTicketCategory', 'ticket_category_delete'],
    ] as const) {
        test(`${method} : invalidatePublicEvent(eventId, …) après le succès de ${rpc}`, () => {
            const body = methodBody(method);
            const write = body.indexOf(`rpcWithRetry('${rpc}'`);
            assert.ok(write > 0, `${method} : appel de ${rpc} introuvable`);
            const call = body.search(/invalidatePublicEvent\(eventId, '[^']+'\)/);
            assert.ok(call > write, `${method} : invalidation absente après ${rpc} (le prix d'appel et « Complet » restaient en cache 60 s)`);
            assert.match(read('lib/events/event.service.ts'), /import \{ invalidatePublicEvent \} from '@\/lib\/events\/public-cache\.server';/);
        });
    }
});

describe('carte B — invalidation après la suspension ou la réactivation d’une partenaire', () => {
    test('PATCH /api/admin/partners/[id]/status : invalidation quand des événements ont été suspendus ou rétablis', () => {
        const rel = 'app/api/admin/partners/[id]/status/route.ts';
        calledAfter(rel, /if \(reply\.ok !== true\) \{/, /invalidatePublicEvent\(null, /, 'statut de la partenaire');
        const src = read(rel);
        const okAt = src.search(/if \(reply\.ok !== true\) \{/);
        const tail = src.slice(okAt);
        // seulement si la cascade a changé des événements
        assert.match(tail, /events_suspended[\s\S]{0,200}events_restored[\s\S]{0,300}invalidatePublicEvent\(null, /, 'condition : événements suspendus ou rétablis');
    });
});
