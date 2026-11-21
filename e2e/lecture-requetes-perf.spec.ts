/**
 * Design 1e (décision du 21/11, run complet 561) — preuve dans un vrai navigateur : une page dont le contexte est fermé
 * PENDANT la lecture de la taille d'une réponse ne casse plus le navigateur. Avant : `req.sizes()` rejetait sans
 * gestionnaire (« Target page, context or browser has been closed »), le test e2e/perf.spec.ts échouait et la passe
 * suivante ne pouvait plus ouvrir de contexte. Projet perf (nom en « …perf.spec.ts »), aucun serveur de l'application : un
 * petit serveur local envoie l'en-tête du script puis retient la fin du corps (script encore en téléchargement, comme sous
 * la 4G simulée du run 561) ; le contexte est fermé pendant ce téléchargement. Aucune mesure ni aucun seuil de
 * perf.spec.ts n'est touché.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';
import { isTargetClosed, readRequest, type RequestRead } from './support/request-read';

test('contexte fermé pendant la lecture de la taille d’un script : requête ignorée, aucun rejet, nouveau contexte utilisable', async ({ browser }) => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };
    process.on('unhandledRejection', onUnhandled);
    let closedSeen = 0;
    let ignoredSeen = 0;
    const open = new Set<http.ServerResponse>();
    const server = http.createServer((req, res) => {
        if (req.url === '/lent.js') {
            // En-tête et début du corps tout de suite (événement « response »), fin du corps jamais envoyée avant la fermeture
            res.writeHead(200, { 'content-type': 'text/javascript' });
            res.write(`/* ${'x'.repeat(20_000)}`);
            open.add(res);
            return;
        }
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<!doctype html><title>lecture</title><script src="/lent.js"></script>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    try {
        for (let pass = 1; pass <= 5; pass += 1) {
            const context = await browser.newContext();
            const page = await context.newPage();
            const reads: Array<Promise<RequestRead<number>>> = [];
            const raw: Array<Promise<string>> = [];
            let closing: Promise<void> | null = null;
            // Le cas du run 561 : taille demandée pendant que le script se télécharge encore (Chromium n'émet la « réponse »
            // d'un script qu'avec son corps : la lecture est demandée dès la requête), puis page fermée
            page.on('request', (req) => {
                if (!req.url().endsWith('/lent.js')) return;
                reads.push(readRequest(() => req.sizes().then((s) => s.responseBodySize)));
                // Témoin : la même lecture sans protection (son rejet est seulement observé ici)
                raw.push(req.sizes().then(() => 'lue', (err: unknown) => (isTargetClosed(err) ? 'rejet : page fermée' : `autre : ${String(err)}`)));
                closing ??= context.close();
            });
            await page.goto(`${base}/`, { waitUntil: 'commit' }).catch(() => undefined);
            await expect.poll(() => reads.length, { message: `passe ${pass} : requête du script vue` }).toBeGreaterThan(0);
            await closing;
            const results = await Promise.all(reads);
            const witnesses = await Promise.all(raw);
            closedSeen += witnesses.filter((w) => w === 'rejet : page fermée').length;
            ignoredSeen += results.filter((r) => 'ignored' in r).length;
            for (const r of results) {
                expect('error' in r, `passe ${pass} : aucune erreur autre que « page fermée » (${JSON.stringify(r)})`).toBe(false);
            }
            console.log(`[LECTURE-REQUETES] passe ${pass} : lecture sûre ${results.map((r) => ('value' in r ? `${r.value} octets` : 'ignorée (contexte fermé)')).join(', ')} ; témoin sans protection : ${witnesses.join(', ')}`);
        }
        expect(closedSeen, 'le témoin sans protection a bien rejeté « page fermée » (cas du run 561 reproduit)').toBeGreaterThan(0);
        expect(ignoredSeen, 'la lecture sûre a ignoré la requête au lieu de rejeter').toBeGreaterThan(0);
        // Le navigateur reste utilisable : un nouveau contexte s'ouvre et charge une page
        const after = await browser.newContext();
        const page = await after.newPage();
        await page.setContent('<p id="ok">navigateur utilisable</p>');
        await expect(page.locator('#ok')).toHaveText('navigateur utilisable');
        await after.close();
        await new Promise((r) => setTimeout(r, 50));
        expect(unhandled, 'aucun rejet non géré').toEqual([]);
    } finally {
        process.off('unhandledRejection', onUnhandled);
        for (const res of open) res.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});
