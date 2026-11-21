/**
 * Lot 10b — contrôle statique des routes nouvelles ou réécrites des salles : chaque gestionnaire vérifie d'abord la
 * session (ou le droit d'administration halls.validate), puis l'interrupteur quand la route sert le service ouvert, et
 * ne reçoit jamais de montant ni d'identifiant de compte du corps de la requête. Complète les parcours de
 * tests/parcours/l10b-salles.test.ts (comportement réel).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string): string => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

interface RouteRule { file: string; session: 'public' | 'client' | 'partner' | 'admin'; feature: boolean }

const ROUTES: RouteRule[] = [
    { file: 'app/api/halls/route.ts', session: 'public', feature: true },
    { file: 'app/api/halls/[id]/route.ts', session: 'public', feature: true },
    { file: 'app/api/halls/[id]/calendar/route.ts', session: 'public', feature: true },
    { file: 'app/api/halls/[id]/quote/route.ts', session: 'public', feature: true },
    // Le client garde l'accès à ses réservations (et à l'annulation) quand le service est fermé
    { file: 'app/api/halls/reservations/route.ts', session: 'client', feature: false },
    { file: 'app/api/halls/reservations/[id]/route.ts', session: 'client', feature: false },
    { file: 'app/api/halls/reservations/[id]/cancel/route.ts', session: 'client', feature: false },
    { file: 'app/api/partner/halls/[id]/submit/route.ts', session: 'partner', feature: true },
    // Lot 11b (décision du 20/11, modification signalée au rapport) : lectures de la propriétaire ouvertes service fermé
    { file: 'app/api/partner/halls/reservations/route.ts', session: 'partner', feature: false },
    { file: 'app/api/partner/halls/reservations/[id]/route.ts', session: 'partner', feature: false },
    { file: 'app/api/partner/halls/earnings/route.ts', session: 'partner', feature: false },
    { file: 'app/api/admin/halls/route.ts', session: 'admin', feature: false },
    { file: 'app/api/admin/halls/[id]/route.ts', session: 'admin', feature: false },
    { file: 'app/api/admin/halls/[id]/validation/route.ts', session: 'admin', feature: false },
];

describe('Lot 10b — routes des salles : session, droit, interrupteur', () => {
    for (const r of ROUTES) {
        test(r.file, () => {
            const src = read(r.file);
            const handlers = src.split(/export async function (?=GET|POST|PUT|PATCH|DELETE)/).slice(1);
            assert.ok(handlers.length > 0, 'aucun gestionnaire');
            for (const h of handlers) {
                const name = h.slice(0, h.indexOf('('));
                if (r.session === 'client' || r.session === 'partner') {
                    assert.match(h, /requireActiveSession\(/, `${name} : session active non vérifiée`);
                    assert.match(h, /session\.user\.id/, `${name} : le compte vient de la session`);
                }
                if (r.session === 'partner') assert.match(h, /serverIsPartner\(/, `${name} : rôle de partenaire non vérifié`);
                if (r.session === 'admin') assert.match(h, /verifyAdminAuth\(req, \{ requiredPermission: 'halls\.validate' \}\)/, `${name} : droit halls.validate non vérifié`);
                if (r.feature) assert.match(h, /guardFeature\('halls'/, `${name} : interrupteur non vérifié`);
                if (r.session === 'client' || r.session === 'partner') {
                    const sessionAt = h.indexOf('requireActiveSession(');
                    const guardAt = h.indexOf('guardFeature(');
                    if (guardAt >= 0) assert.ok(sessionAt < guardAt, `${name} : la session passe avant l'interrupteur`);
                }
                // Aucun montant ni compte venu du corps ou de l'adresse
                assert.doesNotMatch(h, /(body|searchParams|sp)\.(get\(')?(client_id|user_id|actor_id|amount|total|price_amount|deposit_amount)/, `${name} : montant ou compte lu dans la requête`);
            }
        });
    }

    test('lectures des salles : colonnes nommées, jamais « * » renvoyé à un écran', () => {
        const queries = read('lib/halls/queries.ts');
        assert.doesNotMatch(queries, /\.select\('\*'/, 'select(\'*\') dans lib/halls/queries.ts');
        const service = read('lib/halls/hall.service.ts');
        assert.doesNotMatch(service, /\.from\('halls'\)[\s\S]{0,200}\.select\('\*'\)/, 'salle relue avec « * » dans HallService');
    });
});
