/**
 * Lot 9 quater — technique, sans base (F3 : AUD-39 ; F4 : AUD-11).
 *  F3 : en production réelle, PUSH_ENDPOINT_ALLOWED_ORIGINS refuse http et les hôtes locaux (règle et contrôle du
 *       démarrage) ; les essais (production, services locaux) gardent leur service push local.
 *  F4 : HSTS, Permissions-Policy et CSP en mode rapport seulement posées sur toutes les pages ; /api/csp-report
 *       journalise une violation distincte une fois, répond 204, refuse un corps de plus de 8 Ko.
 * Rouge avant correctif : ni pushOriginsStartupProblem, ni en-têtes, ni route de rapport.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

const REAL_PROD = { NODE_ENV: 'production', SAMIRPAY_API_URL: 'https://api.samirpay.example', EV_INTEGRATIONS: undefined, EV_SIMULATION: undefined } as Record<string, string | undefined>;

describe('F3 — origines push en production', () => {
    test('production réelle : http et hôte local refusés au démarrage et à l’abonnement ; https admis', async () => {
        const push = await import('../../lib/push/endpoints');
        const env = { ...REAL_PROD, PUSH_ENDPOINT_ALLOWED_ORIGINS: 'http://127.0.0.1:4010,https://fcm.googleapis.com' } as unknown as NodeJS.ProcessEnv;
        assert.match(String(push.pushOriginsStartupProblem(env)), /Refus de démarrer.*http:\/\/127\.0\.0\.1:4010/);
        assert.equal(push.pushOriginsStartupProblem({ ...env, PUSH_ENDPOINT_ALLOWED_ORIGINS: 'https://fcm.googleapis.com' } as unknown as NodeJS.ProcessEnv), null);
        assert.equal(push.pushOriginsStartupProblem({ ...env, SAMIRPAY_API_URL: 'http://127.0.0.1:4010' } as unknown as NodeJS.ProcessEnv), null, 'essai local : non concerné');
        assert.equal(push.isAllowedPushEndpoint('http://127.0.0.1:4010/push/abc', env), false, 'hôte local refusé en production');
        assert.equal(push.isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc', env), true, 'https admis');
    });
});

describe('F4 — en-têtes de sécurité', () => {
    test('HSTS, Permissions-Policy et CSP en mode rapport seulement sur toutes les pages', async () => {
        const factory = (await import('../../next.config.mjs')).default as (phase: string) => { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> };
        const config = factory('phase-production-build');
        const all = (await config.headers()).find((h) => h.source === '/(.*)');
        assert.ok(all, 'règle des pages');
        const byKey = new Map(all!.headers.map((h) => [h.key, h.value]));
        assert.match(String(byKey.get('Strict-Transport-Security')), /max-age=63072000; includeSubDomains/);
        assert.match(String(byKey.get('Permissions-Policy')), /camera=\(self\)/);
        assert.match(String(byKey.get('Permissions-Policy')), /microphone=\(\)/);
        const csp = String(byKey.get('Content-Security-Policy-Report-Only'));
        for (const d of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", 'report-uri /api/csp-report']) assert.ok(csp.includes(d), `${d} dans la CSP`);
        assert.equal(byKey.has('Content-Security-Policy'), false, 'aucune CSP bloquante dans ce lot');
    });

    test('/api/csp-report : 204, violation journalisée une fois, corps trop gros refusé', async () => {
        const { POST } = await import('../../app/api/csp-report/route');
        const lines: string[] = [];
        const original = console.warn;
        console.warn = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
        try {
            const report = JSON.stringify({ 'csp-report': { 'document-uri': 'https://site.example/events/1?t=secret', 'effective-directive': 'script-src-elem', 'blocked-uri': 'https://evil.example/x.js' } });
            const send = (body: string) => POST(new NextRequest('http://127.0.0.1:3000/api/csp-report', { method: 'POST', headers: { 'content-type': 'application/csp-report' }, body }));
            assert.equal((await send(report)).status, 204);
            assert.equal((await send(report)).status, 204);
            assert.equal((await send('x'.repeat(9000))).status, 413);
        } finally {
            console.warn = original;
        }
        const reports = lines.filter((l) => l.startsWith('[CSP-REPORT]'));
        assert.deepEqual(reports, ['[CSP-REPORT] script-src-elem https://evil.example/x.js /events/1'], 'une ligne, sans la requête de la page');
    });
});
