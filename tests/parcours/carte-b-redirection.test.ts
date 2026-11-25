/**
 * Correctifs de la contre-vérification du lot Carte B (T5) — redirection vers /login derrière un relais HTTPS.
 *
 * Le relais (hébergeur, CDN, relais HTTP/2 de la mesure) parle au serveur en http:// : `req.url` du middleware est en
 * http://, et la redirection d'un visiteur sans session repartait en http:// (navigateur sorti du HTTPS, signalé par la
 * CSP). Le middleware construit désormais l'adresse avec le protocole et l'hôte transmis (x-forwarded-proto,
 * x-forwarded-host), contrôlés : protocole http ou https seulement, hôte réduit à un nom et un port ; une valeur douteuse
 * est ignorée (aucune redirection vers un autre site).
 * Suite sans écriture (middleware seul, aucune session) : elle n'appelle pas d'invariants.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';

async function anonymous(pathname: string, headers: Record<string, string> = {}): Promise<{ status: number; location: string | null }> {
    const res = await middleware(new NextRequest(`http://127.0.0.1:3000${pathname}`, { headers }));
    return { status: res.status, location: res.headers.get('location') };
}

describe('T5 — redirection vers /login derrière un relais', () => {
    test('relais HTTPS : protocole et hôte transmis repris', async () => {
        // Comme le relais HTTP/2 de la mesure : Host et x-forwarded-host portent l'hôte public
        const r = await anonymous('/tickets', { host: 'localhost:44293', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'localhost:44293' });
        assert.ok(r.status === 307 || r.status === 308, `statut ${r.status}`);
        const to = new URL(String(r.location));
        assert.equal(to.protocol, 'https:', `adresse : ${r.location}`);
        assert.equal(to.host, 'localhost:44293');
        assert.equal(to.pathname, '/login');
        assert.equal(to.searchParams.get('redirect'), '/tickets');
    });

    test('relais en chaîne : première valeur, port par défaut du protocole ; sans en-têtes : adresse de la requête (inchangée)', async () => {
        const chain = new URL(String((await anonymous('/tickets', { host: 'eventvillage.sn', 'x-forwarded-proto': 'https, http', 'x-forwarded-host': 'eventvillage.sn, interne:3000' })).location));
        assert.equal(chain.origin, 'https://eventvillage.sn', 'aucun port de la requête gardé (run 630 : https://eventvillage.sn:3000)');
        // Sans relais : l'adresse de la requête telle que Next la donne (127.0.0.1 y devient localhost)
        const direct = new URL(String((await anonymous('/tickets')).location));
        assert.equal(direct.protocol, 'http:');
        assert.equal(direct.port, '3000');
        assert.equal(direct.pathname, '/login');
    });

    test('valeurs douteuses ignorées : jamais un autre schéma, jamais un autre site', async () => {
        const base = new URL(String((await anonymous('/tickets', { host: '127.0.0.1:3000' })).location));
        for (const [proto, host] of [['javascript', 'evil.example'], ['ftp', 'evil.example/@x'], ['https', 'a@evil.example'], ['https', 'evil.example/login'], ['https', 'x y'], ['https', 'evil.example']] as const) {
            const to = new URL(String((await anonymous('/tickets', { host: '127.0.0.1:3000', 'x-forwarded-proto': proto, 'x-forwarded-host': host })).location));
            assert.ok(to.protocol === 'http:' || to.protocol === 'https:', `${proto} ${host} → ${to.href}`);
            assert.equal(to.host, base.host, `${proto} ${host} → ${to.href} (hôte de la requête gardé)`);
            assert.ok(!to.hostname.includes('evil'), `${proto} ${host} → ${to.href}`);
            assert.equal(to.pathname, '/login');
        }
    });

    test('images statiques : servies sans session, même derrière un relais', async () => {
        for (const p of ['/images/paiement/wave.webp', '/images/og-image.png', '/images/event-placeholder.svg']) {
            const res = await middleware(new NextRequest(`http://127.0.0.1:3000${p}`, { headers: { 'x-forwarded-proto': 'https' } }));
            assert.equal(res.headers.get('x-middleware-next'), '1', `${p} : HTTP ${res.status} ${res.headers.get('location') ?? ''}`);
        }
    });
});
