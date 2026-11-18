# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 9. résultat du scanner : plein écran égal à la fenêtre, page défilée de force
- Location: e2e/terrain.spec.ts:782:5

# Error details

```
Error: page défilée de force : {"scrollY":0,"top":0,"bottom":844,"left":0,"right":390,"innerWidth":390,"innerHeight":844}

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Test source

```ts
  703 |         const keys3 = keys.slice(keysBefore3);
  704 |         expect(keys3.length, `billet 3 : trois essais puis le renvoi au retour : ${JSON.stringify(keys3)}`).toBeGreaterThanOrEqual(4);
  705 |         expect(keys3[0], 'en-tête Idempotency-Key (D39)').toMatch(/^[0-9a-f-]{36}$/i);
  706 |         expect(new Set(keys3).size, `billet 3 : même clé pour la lecture, ses relances et le renvoi : ${JSON.stringify(keys3)}`).toBe(1);
  707 |         await expect.poll(() => pendingScanKeys(page), { message: 'billet 3 : scan en attente effacé au verdict', timeout: 10_000 }).toEqual([]);
  708 |         const db3 = ticketScans(t3.id);
  709 |         expect(db3.scans.filter((r) => r.accepted).length, `billet 3 : une seule entrée acceptée : ${JSON.stringify(db3.scans)}`).toBe(1);
  710 |         expect(db3.scans.filter((r) => r.result === 'already_used').length, `billet 3 : aucune ligne already_used : ${JSON.stringify(db3.scans)}`).toBe(0);
  711 |         expect(db3.ticket.status).toBe('UTILISE');
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
  799 |             return { scrollY: window.scrollY, top: r.top, bottom: r.bottom, left: r.left, right: r.right, innerWidth: window.innerWidth, innerHeight: window.innerHeight };
  800 |         });
  801 |         if (!box) throw new Error('plein écran du scanner fermé avant la mesure');
  802 |         const seen = JSON.stringify(box);
> 803 |         expect(box.scrollY, `page défilée de force : ${seen}`).toBeGreaterThan(0);
      |                                                                ^ Error: page défilée de force : {"scrollY":0,"top":0,"bottom":844,"left":0,"right":390,"innerWidth":390,"innerHeight":844}
  804 |         expect({ top: Math.round(box.top), left: Math.round(box.left), right: Math.round(box.right), bottom: Math.round(box.bottom) }, `rectangle du plein écran : ${seen}`)
  805 |             .toEqual({ top: 0, left: 0, right: box.innerWidth, bottom: box.innerHeight });
  806 |     } finally {
  807 |         await s.close();
  808 |         restoreTerrainSetting(ev);
  809 |     }
  810 | });
  811 | 
  812 | // ── 10. Taille réelle du lot hors ligne (lot 8, 8.2 x) ─────────────────────
  813 | 
  814 | const OFFLINE_LOT_MAX_ENCODED = 40_000;
  815 | 
  816 | test('10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés', async ({ browser }, testInfo) => {
  817 |     test.setTimeout(3 * 60_000);
  818 |     const s = new Session(browser, testInfo);
  819 |     let ev: TerrainEvent | null = null;
  820 |     try {
  821 |         ev = prepareTerrainEvent('taille du lot', 'client', 1);
  822 |         const ticket = ev.tickets[0];
  823 |         const client = await s.open('fumee-client');
  824 |         const lotPath = `/api/tickets/${ticket.id}/offline-codes`;
  825 |         const responded = client.page.waitForResponse((r) => new URL(r.url()).pathname === lotPath && r.request().method() === 'GET', { timeout: 45_000 });
  826 |         await client.page.goto('/tickets');
  827 |         const res = await responded;
  828 |         await res.finished();
  829 |         expect(res.status(), `téléchargement automatique du lot ${lotPath}`).toBe(200);
  830 |         const encoding = (await res.allHeaders())['content-encoding'] ?? null;
  831 |         const sizes = await res.request().sizes();
  832 |         // Ni content-length (absent en chunked), ni APIRequestContext : seule la mesure du navigateur dit ce qui a transité
  833 |         await expect.poll(() => client.page.evaluate((p) => performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname === p).length, lotPath), {
  834 |             message: 'mesure du navigateur (Resource Timing) du téléchargement du lot', timeout: 10_000,
  835 |         }).toBeGreaterThan(0);
  836 |         const timing = await client.page.evaluate((p) => {
  837 |             const entry = performance.getEntriesByType('resource').find((e) => new URL(e.name).pathname === p) as PerformanceResourceTiming;
  838 |             return { encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize };
  839 |         }, lotPath);
  840 |         console.log(`[HORS-LIGNE-TRANSFERE] content-encoding=${encoding ?? 'aucun'} encodedBodySize=${timing.encodedBodySize} decodedBodySize=${timing.decodedBodySize} `
  841 |             + `transferSize=${timing.transferSize} responseBodySize=${sizes.responseBodySize} responseHeadersSize=${sizes.responseHeadersSize}`);
  842 |         expect(timing.decodedBodySize, 'taille décompressée du lot lue par le navigateur').toBeGreaterThan(0);
  843 |         expect.soft(encoding, 'en-tête content-encoding de la réponse du lot').toBe('gzip');
  844 |         expect.soft(timing.encodedBodySize, 'corps transféré plus petit que le corps décompressé').toBeLessThan(timing.decodedBodySize);
  845 |         expect.soft(timing.encodedBodySize, `corps transféré sous ${OFFLINE_LOT_MAX_ENCODED} octets`).toBeLessThan(OFFLINE_LOT_MAX_ENCODED);
  846 |     } finally {
  847 |         await s.close();
  848 |         restoreTerrainSetting(ev);
  849 |     }
  850 | });
  851 | 
  852 | // ── 11. Scan repris sans ligne en base (lot 8, 8.2 e) ──────────────────────
  853 | 
  854 | test('11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact', async ({ browser }, testInfo) => {
  855 |     test.setTimeout(4 * 60_000);
  856 |     const s = new Session(browser, testInfo);
  857 |     let ev: TerrainEvent | null = null;
  858 |     try {
  859 |         ev = prepareTerrainEvent('renvoi seulement', 'client-bis', 1);
  860 |         const ticket = ev.tickets[0];
  861 |         const holder = await s.holder('fumee-client-bis');
  862 |         const ctl = await s.open('fumee-controleur', { probe: true });
  863 |         const page = ctl.page;
  864 |         await openScanner(page, ev.title);
  865 | 
  866 |         const keys: Array<string | null> = [];
  867 |         page.on('request', (req) => {
  868 |             if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/controller/scan') keys.push(req.headers()['idempotency-key'] ?? null);
  869 |         });
  870 | 
  871 |         // Toute lecture est coupée AVANT le serveur (aucun route.fetch) ; la première attend que l'application soit sortie
  872 |         let blocked = 0;
  873 |         let releaseAbort: () => void = () => undefined;
  874 |         const abortGate = new Promise<void>((resolve) => { releaseAbort = resolve; });
  875 |         const blockBeforeServer = async (route: Route): Promise<void> => {
  876 |             if (route.request().method() !== 'POST') {
  877 |                 await route.fallback();
  878 |                 return;
  879 |             }
  880 |             blocked += 1;
  881 |             if (blocked === 1) await abortGate;
  882 |             await route.abort('timedout');
  883 |         };
  884 |         await page.route('**/api/controller/scan', blockBeforeServer);
  885 |         const errorsBefore = await probePostErrors(page);
  886 |         await presentPayloadNoResult(page, await livePayload(holder, ticket.id), 'renvoi seulement : lecture coupée avant le serveur');
  887 |         await expect.poll(() => blocked, { message: 'lecture interceptée avant le serveur', timeout: 20_000 }).toBe(1);
  888 |         await setVisibility(page, 'hidden'); // l'application passe en arrière-plan pendant l'envoi
  889 |         releaseAbort();
  890 |         await expect.poll(async () => (await probePostErrors(page)) - errorsBefore, {
  891 |             message: 'trois essais sans réponse (même clé)', timeout: 30_000,
  892 |         }).toBeGreaterThanOrEqual(3);
  893 |         await expect.poll(() => pendingScanKeys(page), { message: 'scan gardé sur l’appareil avec sa clé', timeout: 10_000 }).toEqual([keys[0]]);
  894 |         const blockedTotal = blocked;
  895 |         await page.unroute('**/api/controller/scan', blockBeforeServer);
  896 | 
  897 |         const resumed = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/controller/scan', { timeout: 20_000 });
  898 |         await setVisibility(page, 'visible'); // retour au premier plan : le scan est renvoyé
  899 |         const body = (await resumed).postDataJSON() as Record<string, unknown>;
  900 | 
  901 |         expect.soft(body.replayOnly, `renvoi au retour : indicateur replayOnly dans le corps (${blockedTotal} envois coupés avant)`).toBe(true);
  902 |         await expect.soft(page.locator('[data-scan-result="not_processed"]').first(), 'renvoi d’une lecture que le serveur n’a jamais reçue : « non traité »').toBeVisible({ timeout: 30_000 });
  903 |         await expect.soft(page.getByText(/résultat retrouvé/i), 'jamais « Résultat retrouvé » : aucune lecture d’origine').toHaveCount(0);
```