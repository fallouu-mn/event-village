/**
 * Design 1b (décision 1b de l'utilisateur) — relais HTTP/2 local devant `next start`, pour mesurer les pages comme en
 * production (CDN en HTTP/2 : un seul flux multiplexé, au lieu des 6 connexions HTTP/1.1 que Lighthouse simule pour
 * `next start`). TLS obligatoire pour HTTP/2 dans les navigateurs : certificat de test généré à chaque lancement par
 * `openssl` (une journée, CN localhost), jamais enregistré dans le dépôt ; Chrome est lancé avec
 * --ignore-certificate-errors par la mesure (scripts/e2e/perf-mobile.mjs) et les contextes Playwright avec
 * ignoreHTTPSErrors. Rien d'autre ne change : mêmes réponses, mêmes en-têtes (sauf ceux propres à une connexion
 * HTTP/1.1), mêmes cookies (domaine localhost, port ignoré).
 *
 *   const proxy = await startH2Proxy('http://127.0.0.1:3000', dossierTemporaire); // { origin: 'https://localhost:PORT', close }
 */
import http from 'node:http';
import http2 from 'node:http2';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

/** En-têtes propres à une connexion (interdits en HTTP/2). */
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade', 'http2-settings', 'te', 'host']);

export function selfSignedCert(dir) {
    fs.mkdirSync(dir, { recursive: true });
    const key = path.join(dir, 'h2-proxy-key.pem');
    const cert = path.join(dir, 'h2-proxy-cert.pem');
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1',
        '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
    return { key: fs.readFileSync(key), cert: fs.readFileSync(cert) };
}

export function startH2Proxy(target, dir, port = 0) {
    const upstream = new URL(target);
    const { key, cert } = selfSignedCert(dir);
    const server = http2.createSecureServer({ key, cert, allowHTTP1: false }, (req, res) => {
        const headers = {};
        for (const [name, value] of Object.entries(req.headers)) {
            if (name.startsWith(':') || HOP_BY_HOP.has(name)) continue;
            headers[name] = value;
        }
        const authority = req.headers[':authority'] ?? `localhost:${server.address().port}`;
        headers.host = authority;
        headers['x-forwarded-host'] = authority;
        headers['x-forwarded-proto'] = 'https';
        const up = http.request({ hostname: upstream.hostname, port: upstream.port, method: req.method, path: req.url, headers }, (ur) => {
            const out = {};
            for (const [name, value] of Object.entries(ur.headers)) if (!HOP_BY_HOP.has(name) && value !== undefined) out[name] = value;
            res.writeHead(ur.statusCode ?? 502, out);
            ur.pipe(res);
        });
        up.on('error', (err) => {
            if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
            res.end(`relais HTTP/2 : application injoignable (${err.message})`);
        });
        req.pipe(up);
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => {
            const { port: p } = server.address();
            resolve({ origin: `https://localhost:${p}`, port: p, close: () => new Promise((r) => server.close(() => r())) });
        });
    });
}
