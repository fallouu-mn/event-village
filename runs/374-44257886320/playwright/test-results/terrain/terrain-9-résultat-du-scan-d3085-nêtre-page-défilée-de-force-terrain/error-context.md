# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 9. résultat du scanner : plein écran égal à la fenêtre, page défilée de force
- Location: e2e/terrain.spec.ts:782:5

# Error details

```
Error: page défilée de force : {"scrollY":0,"top":0,"bottom":844,"left":0,"right":390,"innerWidth":390,"innerHeight":844,"diag":{"scrolling":"HTML","scrollTop":0,"htmlScrollHeight":844,"html":"visible/visible h=844px min=0px max=none d=block pos=static contain=none cls=__variable_a8fb83","body":"visible/visible h=844px min=844px max=none d=block pos=static contain=none cls=min-h-screen antialiased font-sans","bodyInline":"min-height: 3000px;","htmlInline":"color-scheme: light;"}}

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Test source

```ts
  712 |         await expectDoorCount(page, 3, 'après le renvoi du billet 3');
  713 | 
  714 |         // Le résultat retrouvé attend un toucher ; la caméra, coupée pendant la sortie, repart d'un geste
  715 |         await page.locator('[data-scan-recovered="true"]').first().click();
  716 |         await expect(page.locator('[data-scan-result]'), 'résultat retrouvé fermé d’un toucher').toHaveCount(0);
  717 |         await page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i }).click();
  718 |         await waitVideoPlaying(page, 'avant le billet 4');
  719 | 
  720 |         // 4b. Application fermée puis rouverte pendant l'envoi (réponse jamais reçue)
  721 |         let held = 0;
  722 |         let heldStatus = 0;
  723 |         let released = false;
  724 |         const holdResponse = async (route: Route): Promise<void> => {
  725 |             if (released || route.request().method() !== 'POST') {
  726 |                 await route.fallback();
  727 |                 return;
  728 |             }
  729 |             if (held === 0) {
  730 |                 held += 1;
  731 |                 heldStatus = (await route.fetch()).status(); // le serveur traite la lecture…
  732 |             }
  733 |             // … et la réponse n'est jamais rendue : la page est rechargée pendant l'attente
  734 |             await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  735 |         };
  736 |         await page.route('**/api/controller/scan', holdResponse);
  737 |         const keysBefore4 = keys.length;
  738 |         await presentPayloadNoResult(page, await livePayload(holder, t4.id), 'reprise : billet 4, application fermée pendant l’envoi');
  739 |         await expect.poll(() => held, { message: 'billet 4 : lecture reçue par le serveur', timeout: 20_000 }).toBe(1);
  740 |         // held passe à 1 avant la fin de route.fetch() : le statut est attendu, pas lu dans la foulée (run 162 : 0).
  741 |         await expect.poll(() => heldStatus, { message: 'billet 4 : la lecture a bien été traitée par le serveur', timeout: 20_000 }).toBe(200);
  742 |         await expect(page.locator('[data-scan-state="pending"], [data-scan-state="slow"]').first(), 'billet 4 : envoi en cours, réponse attendue').toBeAttached();
  743 |         expect(await pendingScanKeys(page), 'billet 4 : clé gardée sur l’appareil pendant l’envoi').toEqual([keys[keysBefore4]]);
  744 |         released = true;
  745 |         await page.reload(); // fermeture puis réouverture de l'application pendant l'envoi
  746 |         await expectRecovered(page, 'billet 4, réouverture');
  747 |         await page.unroute('**/api/controller/scan', holdResponse);
  748 |         const keys4 = keys.slice(keysBefore4);
  749 |         expect(keys4.length, `billet 4 : lecture puis renvoi à la réouverture : ${JSON.stringify(keys4)}`).toBeGreaterThanOrEqual(2);
  750 |         expect(new Set(keys4).size, `billet 4 : même clé pour la lecture et le renvoi : ${JSON.stringify(keys4)}`).toBe(1);
  751 |         await expect.poll(() => pendingScanKeys(page), { message: 'billet 4 : scan en attente effacé au verdict', timeout: 10_000 }).toEqual([]);
  752 |         const db4 = ticketScans(t4.id);
  753 |         expect(db4.scans.filter((r) => r.accepted).length, `billet 4 : une seule entrée acceptée : ${JSON.stringify(db4.scans)}`).toBe(1);
  754 |         expect(db4.scans.filter((r) => r.result === 'already_used').length, `billet 4 : aucune ligne already_used : ${JSON.stringify(db4.scans)}`).toBe(0);
  755 |         expect(db4.ticket.status).toBe('UTILISE');
  756 |         await expectDoorCount(page, 4, 'après le renvoi du billet 4');
  757 |         await expectResumed(page, ev.title, 'camera', 'réouverture pendant l’envoi');
  758 |     } finally {
  759 |         await s.close();
  760 |         restoreTerrainSetting(ev);
  761 |     }
  762 | });
  763 | 
  764 | // ── 8 et 9. Éléments fixes de l'interface (lot 8, 8.2 s) ───────────────────
  765 | 
  766 | test('8. barre d’achat de la fiche : collée au bas de l’écran en haut de page et à mi-page, pleine largeur', async ({ browser }, testInfo) => {
  767 |     test.setTimeout(3 * 60_000);
  768 |     const s = new Session(browser, testInfo);
  769 |     let ev: TerrainEvent | null = null;
  770 |     try {
  771 |         ev = prepareTerrainEvent('barre achat', 'client', 0, { priceFcfa: 5000 });
  772 |         const client = await s.open('fumee-client');
  773 |         await client.page.goto(`/events/${ev.eventId}`);
  774 |         await client.page.getByRole('button', { name: /^ajouter un billet entrée générale/i }).click();
  775 |         await expectBuyBarAnchored(client.page, 'fiche de l’événement');
  776 |     } finally {
  777 |         await s.close();
  778 |         restoreTerrainSetting(ev);
  779 |     }
  780 | });
  781 | 
  782 | test('9. résultat du scanner : plein écran égal à la fenêtre, page défilée de force', async ({ browser }, testInfo) => {
  783 |     test.setTimeout(3 * 60_000);
  784 |     const s = new Session(browser, testInfo);
  785 |     let ev: TerrainEvent | null = null;
  786 |     try {
  787 |         ev = prepareTerrainEvent('plein ecran', 'client-bis', 1);
  788 |         const holder = await s.holder('fumee-client-bis');
  789 |         const ctl = await s.open('fumee-controleur', { probe: true });
  790 |         await openScanner(ctl.page, ev.title);
  791 |         // Code refusé : l'écran reste 3 s, le temps de la mesure, et le billet ne change pas d'état
  792 |         await presentPayload(ctl.page, forgedPayload(await livePayload(holder, ev.tickets[0].id)), 'code qui ne se vérifie pas');
  793 |         const box = await ctl.page.evaluate(() => {
  794 |             const overlay = document.querySelector('[data-scan-state="result"]');
  795 |             if (!overlay) return null;
  796 |             document.body.style.minHeight = '3000px';
  797 |             window.scrollTo({ top: 1000, behavior: 'instant' });
  798 |             const r = overlay.getBoundingClientRect();
  799 |             // Diagnostic (runs 342, 367, 371 : scrollY 0) : élément qui défile, débordements et hauteurs de <html> et <body>
  800 |             const cs = (el: Element) => { const c = getComputedStyle(el); return `${c.overflowX}/${c.overflowY} h=${c.height} min=${c.minHeight} max=${c.maxHeight} d=${c.display} pos=${c.position} contain=${c.contain} cls=${el.getAttribute("class")}`; };
  801 |             const diag = {
  802 |                 scrolling: document.scrollingElement?.tagName ?? null,
  803 |                 scrollTop: document.scrollingElement?.scrollTop ?? null,
  804 |                 htmlScrollHeight: document.documentElement.scrollHeight,
  805 |                 html: cs(document.documentElement), body: cs(document.body),
  806 |                 bodyInline: document.body.getAttribute('style'), htmlInline: document.documentElement.getAttribute('style'),
  807 |             };
  808 |             return { scrollY: window.scrollY, top: r.top, bottom: r.bottom, left: r.left, right: r.right, innerWidth: window.innerWidth, innerHeight: window.innerHeight, diag };
  809 |         });
  810 |         if (!box) throw new Error('plein écran du scanner fermé avant la mesure');
  811 |         const seen = JSON.stringify(box);
> 812 |         expect(box.scrollY, `page défilée de force : ${seen}`).toBeGreaterThan(0);
      |                                                                ^ Error: page défilée de force : {"scrollY":0,"top":0,"bottom":844,"left":0,"right":390,"innerWidth":390,"innerHeight":844,"diag":{"scrolling":"HTML","scrollTop":0,"htmlScrollHeight":844,"html":"visible/visible h=844px min=0px max=none d=block pos=static contain=none cls=__variable_a8fb83","body":"visible/visible h=844px min=844px max=none d=block pos=static contain=none cls=min-h-screen antialiased font-sans","bodyInline":"min-height: 3000px;","htmlInline":"color-scheme: light;"}}
  813 |         expect({ top: Math.round(box.top), left: Math.round(box.left), right: Math.round(box.right), bottom: Math.round(box.bottom) }, `rectangle du plein écran : ${seen}`)
  814 |             .toEqual({ top: 0, left: 0, right: box.innerWidth, bottom: box.innerHeight });
  815 |     } finally {
  816 |         await s.close();
  817 |         restoreTerrainSetting(ev);
  818 |     }
  819 | });
  820 | 
  821 | // ── 10. Taille réelle du lot hors ligne (lot 8, 8.2 x) ─────────────────────
  822 | 
  823 | const OFFLINE_LOT_MAX_ENCODED = 40_000;
  824 | 
  825 | test('10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés', async ({ browser }, testInfo) => {
  826 |     test.setTimeout(3 * 60_000);
  827 |     const s = new Session(browser, testInfo);
  828 |     let ev: TerrainEvent | null = null;
  829 |     try {
  830 |         ev = prepareTerrainEvent('taille du lot', 'client', 1);
  831 |         const ticket = ev.tickets[0];
  832 |         const client = await s.open('fumee-client');
  833 |         const lotPath = `/api/tickets/${ticket.id}/offline-codes`;
  834 |         const responded = client.page.waitForResponse((r) => new URL(r.url()).pathname === lotPath && r.request().method() === 'GET', { timeout: 45_000 });
  835 |         await client.page.goto('/tickets');
  836 |         const res = await responded;
  837 |         await res.finished();
  838 |         expect(res.status(), `téléchargement automatique du lot ${lotPath}`).toBe(200);
  839 |         const encoding = (await res.allHeaders())['content-encoding'] ?? null;
  840 |         const sizes = await res.request().sizes();
  841 |         // Ni content-length (absent en chunked), ni APIRequestContext : seule la mesure du navigateur dit ce qui a transité
  842 |         await expect.poll(() => client.page.evaluate((p) => performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname === p).length, lotPath), {
  843 |             message: 'mesure du navigateur (Resource Timing) du téléchargement du lot', timeout: 10_000,
  844 |         }).toBeGreaterThan(0);
  845 |         const timing = await client.page.evaluate((p) => {
  846 |             const entry = performance.getEntriesByType('resource').find((e) => new URL(e.name).pathname === p) as PerformanceResourceTiming;
  847 |             return { encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize };
  848 |         }, lotPath);
  849 |         console.log(`[HORS-LIGNE-TRANSFERE] content-encoding=${encoding ?? 'aucun'} encodedBodySize=${timing.encodedBodySize} decodedBodySize=${timing.decodedBodySize} `
  850 |             + `transferSize=${timing.transferSize} responseBodySize=${sizes.responseBodySize} responseHeadersSize=${sizes.responseHeadersSize}`);
  851 |         expect(timing.decodedBodySize, 'taille décompressée du lot lue par le navigateur').toBeGreaterThan(0);
  852 |         expect.soft(encoding, 'en-tête content-encoding de la réponse du lot').toBe('gzip');
  853 |         expect.soft(timing.encodedBodySize, 'corps transféré plus petit que le corps décompressé').toBeLessThan(timing.decodedBodySize);
  854 |         expect.soft(timing.encodedBodySize, `corps transféré sous ${OFFLINE_LOT_MAX_ENCODED} octets`).toBeLessThan(OFFLINE_LOT_MAX_ENCODED);
  855 |     } finally {
  856 |         await s.close();
  857 |         restoreTerrainSetting(ev);
  858 |     }
  859 | });
  860 | 
  861 | // ── 11. Scan repris sans ligne en base (lot 8, 8.2 e) ──────────────────────
  862 | 
  863 | test('11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact', async ({ browser }, testInfo) => {
  864 |     test.setTimeout(4 * 60_000);
  865 |     const s = new Session(browser, testInfo);
  866 |     let ev: TerrainEvent | null = null;
  867 |     try {
  868 |         ev = prepareTerrainEvent('renvoi seulement', 'client-bis', 1);
  869 |         const ticket = ev.tickets[0];
  870 |         const holder = await s.holder('fumee-client-bis');
  871 |         const ctl = await s.open('fumee-controleur', { probe: true });
  872 |         const page = ctl.page;
  873 |         await openScanner(page, ev.title);
  874 | 
  875 |         const keys: Array<string | null> = [];
  876 |         page.on('request', (req) => {
  877 |             if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/controller/scan') keys.push(req.headers()['idempotency-key'] ?? null);
  878 |         });
  879 | 
  880 |         // Toute lecture est coupée AVANT le serveur (aucun route.fetch) ; la première attend que l'application soit sortie
  881 |         let blocked = 0;
  882 |         let releaseAbort: () => void = () => undefined;
  883 |         const abortGate = new Promise<void>((resolve) => { releaseAbort = resolve; });
  884 |         const blockBeforeServer = async (route: Route): Promise<void> => {
  885 |             if (route.request().method() !== 'POST') {
  886 |                 await route.fallback();
  887 |                 return;
  888 |             }
  889 |             blocked += 1;
  890 |             if (blocked === 1) await abortGate;
  891 |             await route.abort('timedout');
  892 |         };
  893 |         await page.route('**/api/controller/scan', blockBeforeServer);
  894 |         const errorsBefore = await probePostErrors(page);
  895 |         await presentPayloadNoResult(page, await livePayload(holder, ticket.id), 'renvoi seulement : lecture coupée avant le serveur');
  896 |         await expect.poll(() => blocked, { message: 'lecture interceptée avant le serveur', timeout: 20_000 }).toBe(1);
  897 |         await setVisibility(page, 'hidden'); // l'application passe en arrière-plan pendant l'envoi
  898 |         releaseAbort();
  899 |         await expect.poll(async () => (await probePostErrors(page)) - errorsBefore, {
  900 |             message: 'trois essais sans réponse (même clé)', timeout: 30_000,
  901 |         }).toBeGreaterThanOrEqual(3);
  902 |         await expect.poll(() => pendingScanKeys(page), { message: 'scan gardé sur l’appareil avec sa clé', timeout: 10_000 }).toEqual([keys[0]]);
  903 |         const blockedTotal = blocked;
  904 |         await page.unroute('**/api/controller/scan', blockBeforeServer);
  905 | 
  906 |         const resumed = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/controller/scan', { timeout: 20_000 });
  907 |         await setVisibility(page, 'visible'); // retour au premier plan : le scan est renvoyé
  908 |         const body = (await resumed).postDataJSON() as Record<string, unknown>;
  909 | 
  910 |         expect.soft(body.replayOnly, `renvoi au retour : indicateur replayOnly dans le corps (${blockedTotal} envois coupés avant)`).toBe(true);
  911 |         await expect.soft(page.locator('[data-scan-result="not_processed"]').first(), 'renvoi d’une lecture que le serveur n’a jamais reçue : « non traité »').toBeVisible({ timeout: 30_000 });
  912 |         await expect.soft(page.getByText(/résultat retrouvé/i), 'jamais « Résultat retrouvé » : aucune lecture d’origine').toHaveCount(0);
```