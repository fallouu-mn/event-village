# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 7. reprise de session : même événement et même mode après une sortie, chiffres et historique relus, « Reprendre le contrôle », scan sans réponse renvoyé avec sa clé
- Location: e2e/terrain.spec.ts:604:5

# Error details

```
Error: billet 4 : la lecture a bien été traitée par le serveur

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 0
```

# Test source

```ts
  640 |         await expect.poll(async () => (await probeTracks(page)).filter((t) => t.kind === 'video' && t.readyState !== 'ended').length, {
  641 |             message: 'arrière-plan : pistes vidéo arrêtées (D48)', timeout: 10_000,
  642 |         }).toBe(0);
  643 |         const reread = page.waitForRequest((r) => r.method() === 'GET' && new URL(r.url()).pathname === '/api/controller/scans', { timeout: 15_000 });
  644 |         await setVisibility(page, 'visible');
  645 |         await reread.catch((err: unknown) => {
  646 |             throw new Error(`retour au premier plan : GET /api/controller/scans non relu (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  647 |         });
  648 |         const resume = page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i });
  649 |         await expect(resume, 'retour au premier plan : écran « Reprendre le contrôle » (aucun redémarrage sans geste)').toBeVisible();
  650 |         expect((await probeTracks(page)).filter((t) => t.kind === 'video' && t.readyState === 'live').length,
  651 |             'retour au premier plan : caméra encore coupée avant le geste').toBe(0);
  652 |         await expect(page.getByRole('heading', { level: 1, name: ev.title }), 'arrière-plan : même événement').toBeVisible();
  653 | 
  654 |         // 3. Un geste relance la caméra, puis un autre billet
  655 |         await resume.click();
  656 |         await waitVideoPlaying(page, '« Reprendre le contrôle »');
  657 |         await scanAndExpect(page, await livePayload(holder, t2.id), 'reprise : billet 2 après « Reprendre le contrôle »', 'valid');
  658 |         await expectDoorCount(page, 2, 'après le billet 2');
  659 | 
  660 |         // 4. Scan en cours au moment de la sortie : le serveur traite la lecture, l'écran n'en voit jamais la réponse
  661 |         const keys: Array<string | null> = [];
  662 |         page.on('request', (req) => {
  663 |             if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/controller/scan') keys.push(req.headers()['idempotency-key'] ?? null);
  664 |         });
  665 | 
  666 |         // 4a. Réponse perdue (route.abort) pendant que l'application est en arrière-plan (appel entrant), puis retour
  667 |         let served = 0;
  668 |         let servedStatus = 0;
  669 |         let releaseAbort: () => void = () => undefined;
  670 |         const abortGate = new Promise<void>((resolve) => { releaseAbort = resolve; });
  671 |         const loseWhileAway = async (route: Route): Promise<void> => {
  672 |             if (route.request().method() !== 'POST') {
  673 |                 await route.fallback();
  674 |                 return;
  675 |             }
  676 |             if (served === 0) {
  677 |                 served += 1;
  678 |                 servedStatus = (await route.fetch()).status(); // le serveur traite la lecture…
  679 |                 await abortGate;
  680 |             }
  681 |             await route.abort('timedout'); // … mais aucune réponse n'arrive, ni aux relances
  682 |         };
  683 |         await page.route('**/api/controller/scan', loseWhileAway);
  684 |         const keysBefore3 = keys.length;
  685 |         const errorsBefore3 = await probePostErrors(page);
  686 |         await presentPayloadNoResult(page, await livePayload(holder, t3.id), 'reprise : billet 3, réponse perdue pendant la sortie');
  687 |         await expect.poll(() => served, { message: 'billet 3 : lecture reçue par le serveur', timeout: 20_000 }).toBe(1);
  688 |         // served passe à 1 avant la fin de route.fetch() : attendre la réponse du serveur avant d'en lire le statut
  689 |         // (run 85 : statut lu à 0, la réponse n'était pas encore arrivée).
  690 |         await expect.poll(() => servedStatus, { message: 'billet 3 : réponse du serveur reçue par l’interception', timeout: 20_000 }).not.toBe(0);
  691 |         expect(servedStatus, 'billet 3 : la lecture a bien été traitée par le serveur').toBe(200);
  692 |         await setVisibility(page, 'hidden'); // l'application passe en arrière-plan pendant l'envoi
  693 |         releaseAbort();
  694 |         await expect.poll(async () => (await probePostErrors(page)) - errorsBefore3, {
  695 |             message: 'billet 3 : trois essais sans réponse (même clé)', timeout: 30_000,
  696 |         }).toBeGreaterThanOrEqual(3);
  697 |         await expect.poll(() => pendingScanKeys(page), { message: 'billet 3 : scan gardé sur l’appareil avec sa clé', timeout: 10_000 })
  698 |             .toEqual([keys[keysBefore3]]);
  699 |         await expect(page.locator('[data-scan-result]'), 'billet 3 : aucun écran d’incident pendant la sortie (renvoi au retour)').toHaveCount(0);
  700 |         await page.unroute('**/api/controller/scan', loseWhileAway);
  701 |         await setVisibility(page, 'visible'); // retour au premier plan
  702 |         await expectRecovered(page, 'billet 3, retour au premier plan');
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
> 740 |         expect(heldStatus, 'billet 4 : la lecture a bien été traitée par le serveur').toBe(200);
      |                                                                                       ^ Error: billet 4 : la lecture a bien été traitée par le serveur
  741 |         await expect(page.locator('[data-scan-state="pending"], [data-scan-state="slow"]').first(), 'billet 4 : envoi en cours, réponse attendue').toBeAttached();
  742 |         expect(await pendingScanKeys(page), 'billet 4 : clé gardée sur l’appareil pendant l’envoi').toEqual([keys[keysBefore4]]);
  743 |         released = true;
  744 |         await page.reload(); // fermeture puis réouverture de l'application pendant l'envoi
  745 |         await expectRecovered(page, 'billet 4, réouverture');
  746 |         await page.unroute('**/api/controller/scan', holdResponse);
  747 |         const keys4 = keys.slice(keysBefore4);
  748 |         expect(keys4.length, `billet 4 : lecture puis renvoi à la réouverture : ${JSON.stringify(keys4)}`).toBeGreaterThanOrEqual(2);
  749 |         expect(new Set(keys4).size, `billet 4 : même clé pour la lecture et le renvoi : ${JSON.stringify(keys4)}`).toBe(1);
  750 |         await expect.poll(() => pendingScanKeys(page), { message: 'billet 4 : scan en attente effacé au verdict', timeout: 10_000 }).toEqual([]);
  751 |         const db4 = ticketScans(t4.id);
  752 |         expect(db4.scans.filter((r) => r.accepted).length, `billet 4 : une seule entrée acceptée : ${JSON.stringify(db4.scans)}`).toBe(1);
  753 |         expect(db4.scans.filter((r) => r.result === 'already_used').length, `billet 4 : aucune ligne already_used : ${JSON.stringify(db4.scans)}`).toBe(0);
  754 |         expect(db4.ticket.status).toBe('UTILISE');
  755 |         await expectDoorCount(page, 4, 'après le renvoi du billet 4');
  756 |         await expectResumed(page, ev.title, 'camera', 'réouverture pendant l’envoi');
  757 |     } finally {
  758 |         await s.close();
  759 |         restoreTerrainSetting(ev);
  760 |     }
  761 | });
  762 | 
  763 | // ── 8 et 9. Éléments fixes de l'interface (lot 8, 8.2 s) ───────────────────
  764 | 
  765 | test('8. barre d’achat de la fiche : collée au bas de l’écran en haut de page et à mi-page, pleine largeur', async ({ browser }, testInfo) => {
  766 |     test.setTimeout(3 * 60_000);
  767 |     const s = new Session(browser, testInfo);
  768 |     let ev: TerrainEvent | null = null;
  769 |     try {
  770 |         ev = prepareTerrainEvent('barre achat', 'client', 0, { priceFcfa: 5000 });
  771 |         const client = await s.open('fumee-client');
  772 |         await client.page.goto(`/events/${ev.eventId}`);
  773 |         await client.page.getByRole('button', { name: /^ajouter un billet entrée générale/i }).click();
  774 |         await expectBuyBarAnchored(client.page, 'fiche de l’événement');
  775 |     } finally {
  776 |         await s.close();
  777 |         restoreTerrainSetting(ev);
  778 |     }
  779 | });
  780 | 
  781 | test('9. résultat du scanner : plein écran égal à la fenêtre, page défilée de force', async ({ browser }, testInfo) => {
  782 |     test.setTimeout(3 * 60_000);
  783 |     const s = new Session(browser, testInfo);
  784 |     let ev: TerrainEvent | null = null;
  785 |     try {
  786 |         ev = prepareTerrainEvent('plein ecran', 'client-bis', 1);
  787 |         const holder = await s.holder('fumee-client-bis');
  788 |         const ctl = await s.open('fumee-controleur', { probe: true });
  789 |         await openScanner(ctl.page, ev.title);
  790 |         // Code refusé : l'écran reste 3 s, le temps de la mesure, et le billet ne change pas d'état
  791 |         await presentPayload(ctl.page, forgedPayload(await livePayload(holder, ev.tickets[0].id)), 'code qui ne se vérifie pas');
  792 |         const box = await ctl.page.evaluate(() => {
  793 |             const overlay = document.querySelector('[data-scan-state="result"]');
  794 |             if (!overlay) return null;
  795 |             document.body.style.minHeight = '3000px';
  796 |             window.scrollTo({ top: 1000, behavior: 'instant' });
  797 |             const r = overlay.getBoundingClientRect();
  798 |             return { scrollY: window.scrollY, top: r.top, bottom: r.bottom, left: r.left, right: r.right, innerWidth: window.innerWidth, innerHeight: window.innerHeight };
  799 |         });
  800 |         if (!box) throw new Error('plein écran du scanner fermé avant la mesure');
  801 |         const seen = JSON.stringify(box);
  802 |         expect(box.scrollY, `page défilée de force : ${seen}`).toBeGreaterThan(0);
  803 |         expect({ top: Math.round(box.top), left: Math.round(box.left), right: Math.round(box.right), bottom: Math.round(box.bottom) }, `rectangle du plein écran : ${seen}`)
  804 |             .toEqual({ top: 0, left: 0, right: box.innerWidth, bottom: box.innerHeight });
  805 |     } finally {
  806 |         await s.close();
  807 |         restoreTerrainSetting(ev);
  808 |     }
  809 | });
  810 | 
  811 | // ── 10. Taille réelle du lot hors ligne (lot 8, 8.2 x) ─────────────────────
  812 | 
  813 | const OFFLINE_LOT_MAX_ENCODED = 40_000;
  814 | 
  815 | test('10. lot hors ligne : réponse compressée en gzip, moins de 40 000 octets transférés', async ({ browser }, testInfo) => {
  816 |     test.setTimeout(3 * 60_000);
  817 |     const s = new Session(browser, testInfo);
  818 |     let ev: TerrainEvent | null = null;
  819 |     try {
  820 |         ev = prepareTerrainEvent('taille du lot', 'client', 1);
  821 |         const ticket = ev.tickets[0];
  822 |         const client = await s.open('fumee-client');
  823 |         const lotPath = `/api/tickets/${ticket.id}/offline-codes`;
  824 |         const responded = client.page.waitForResponse((r) => new URL(r.url()).pathname === lotPath && r.request().method() === 'GET', { timeout: 45_000 });
  825 |         await client.page.goto('/tickets');
  826 |         const res = await responded;
  827 |         await res.finished();
  828 |         expect(res.status(), `téléchargement automatique du lot ${lotPath}`).toBe(200);
  829 |         const encoding = (await res.allHeaders())['content-encoding'] ?? null;
  830 |         const sizes = await res.request().sizes();
  831 |         // Ni content-length (absent en chunked), ni APIRequestContext : seule la mesure du navigateur dit ce qui a transité
  832 |         await expect.poll(() => client.page.evaluate((p) => performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname === p).length, lotPath), {
  833 |             message: 'mesure du navigateur (Resource Timing) du téléchargement du lot', timeout: 10_000,
  834 |         }).toBeGreaterThan(0);
  835 |         const timing = await client.page.evaluate((p) => {
  836 |             const entry = performance.getEntriesByType('resource').find((e) => new URL(e.name).pathname === p) as PerformanceResourceTiming;
  837 |             return { encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize };
  838 |         }, lotPath);
  839 |         console.log(`[HORS-LIGNE-TRANSFERE] content-encoding=${encoding ?? 'aucun'} encodedBodySize=${timing.encodedBodySize} decodedBodySize=${timing.decodedBodySize} `
  840 |             + `transferSize=${timing.transferSize} responseBodySize=${sizes.responseBodySize} responseHeadersSize=${sizes.responseHeadersSize}`);
```