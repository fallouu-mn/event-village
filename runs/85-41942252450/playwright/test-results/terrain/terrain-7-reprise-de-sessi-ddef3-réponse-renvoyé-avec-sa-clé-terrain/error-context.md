# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 7. reprise de session : même événement et même mode après une sortie, chiffres et historique relus, « Reprendre le contrôle », scan sans réponse renvoyé avec sa clé
- Location: e2e/terrain.spec.ts:608:5

# Error details

```
Error: billet 3 : la lecture a bien été traitée par le serveur

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 0
```

# Test source

```ts
  592 |         if (!probe) throw new Error('sonde du scanner absente de la page');
  593 |         return probe.posts.filter((p) => p.error !== null).length;
  594 |     });
  595 | }
  596 | 
  597 | /** Clés d'idempotence des scans en attente gardés sur l'appareil (localStorage). */
  598 | async function pendingScanKeys(page: Page): Promise<string[]> {
  599 |     return page.evaluate((prefix) => Object.keys(window.localStorage).filter((k) => k.startsWith(prefix)).map((k) => {
  600 |         try {
  601 |             return String((JSON.parse(window.localStorage.getItem(k) ?? '{}') as { key?: unknown }).key ?? '');
  602 |         } catch (err) {
  603 |             return `illisible : ${err instanceof Error ? err.message : String(err)}`;
  604 |         }
  605 |     }), PENDING_PREFIX);
  606 | }
  607 | 
  608 | test('7. reprise de session : même événement et même mode après une sortie, chiffres et historique relus, « Reprendre le contrôle », scan sans réponse renvoyé avec sa clé', async ({ browser }, testInfo) => {
  609 |     test.setTimeout(6 * 60_000);
  610 |     const s = new Session(browser, testInfo);
  611 |     let ev: TerrainEvent | null = null;
  612 |     try {
  613 |         ev = prepareTerrainEvent('reprise de session', 'client-bis', 4);
  614 |         const [t1, t2, t3, t4] = ev.tickets;
  615 |         const holder = await s.holder('fumee-client-bis');
  616 |         const ctl = await s.open('fumee-controleur', { probe: true });
  617 |         const page = ctl.page;
  618 |         await openScanner(page, ev.title);
  619 | 
  620 |         // 1. Un billet valide
  621 |         await scanAndExpect(page, await livePayload(holder, t1.id), 'reprise : billet 1', 'valid');
  622 |         await expectDoorCount(page, 1, 'après le billet 1');
  623 | 
  624 |         // 2a. Autre page, puis retour arrière
  625 |         await page.goto('/controller/profile');
  626 |         await expect(page.getByRole('heading', { level: 1 }).first(), 'page du profil du contrôleur ouverte').toBeVisible({ timeout: 30_000 });
  627 |         await page.goBack();
  628 |         await expectResumed(page, ev.title, 'camera', 'retour arrière depuis le profil');
  629 |         await expectDoorCount(page, 1, 'retour arrière');
  630 |         await expectHistory(page, [t1.number], 'retour arrière');
  631 | 
  632 |         // 2b. Mode « Saisie manuelle » retenu au rechargement ; retour à la caméra (démarrage immédiat : toucher)
  633 |         await page.getByRole('button', { name: /^saisie manuelle$/i }).click();
  634 |         await expect(page.getByRole('button', { name: /^saisie manuelle$/i })).toHaveAttribute('aria-pressed', 'true');
  635 |         await page.reload();
  636 |         await expectResumed(page, ev.title, 'manual', 'rechargement en saisie manuelle');
  637 |         await expectDoorCount(page, 1, 'rechargement');
  638 |         await expectHistory(page, [t1.number], 'rechargement');
  639 |         await page.getByRole('button', { name: /^caméra$/i }).click();
  640 |         await waitVideoPlaying(page, 'retour à la caméra après le rechargement');
  641 | 
  642 |         // 2c. Arrière-plan (appel, autre application) : caméra coupée ; au retour, chiffres relus et « Reprendre le contrôle »
  643 |         await setVisibility(page, 'hidden');
  644 |         await expect.poll(async () => (await probeTracks(page)).filter((t) => t.kind === 'video' && t.readyState !== 'ended').length, {
  645 |             message: 'arrière-plan : pistes vidéo arrêtées (D48)', timeout: 10_000,
  646 |         }).toBe(0);
  647 |         const reread = page.waitForRequest((r) => r.method() === 'GET' && new URL(r.url()).pathname === '/api/controller/scans', { timeout: 15_000 });
  648 |         await setVisibility(page, 'visible');
  649 |         await reread.catch((err: unknown) => {
  650 |             throw new Error(`retour au premier plan : GET /api/controller/scans non relu (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  651 |         });
  652 |         const resume = page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i });
  653 |         await expect(resume, 'retour au premier plan : écran « Reprendre le contrôle » (aucun redémarrage sans geste)').toBeVisible();
  654 |         expect((await probeTracks(page)).filter((t) => t.kind === 'video' && t.readyState === 'live').length,
  655 |             'retour au premier plan : caméra encore coupée avant le geste').toBe(0);
  656 |         await expect(page.getByRole('heading', { level: 1, name: ev.title }), 'arrière-plan : même événement').toBeVisible();
  657 | 
  658 |         // 3. Un geste relance la caméra, puis un autre billet
  659 |         await resume.click();
  660 |         await waitVideoPlaying(page, '« Reprendre le contrôle »');
  661 |         await scanAndExpect(page, await livePayload(holder, t2.id), 'reprise : billet 2 après « Reprendre le contrôle »', 'valid');
  662 |         await expectDoorCount(page, 2, 'après le billet 2');
  663 | 
  664 |         // 4. Scan en cours au moment de la sortie : le serveur traite la lecture, l'écran n'en voit jamais la réponse
  665 |         const keys: Array<string | null> = [];
  666 |         page.on('request', (req) => {
  667 |             if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/controller/scan') keys.push(req.headers()['idempotency-key'] ?? null);
  668 |         });
  669 | 
  670 |         // 4a. Réponse perdue (route.abort) pendant que l'application est en arrière-plan (appel entrant), puis retour
  671 |         let served = 0;
  672 |         let servedStatus = 0;
  673 |         let releaseAbort: () => void = () => undefined;
  674 |         const abortGate = new Promise<void>((resolve) => { releaseAbort = resolve; });
  675 |         const loseWhileAway = async (route: Route): Promise<void> => {
  676 |             if (route.request().method() !== 'POST') {
  677 |                 await route.fallback();
  678 |                 return;
  679 |             }
  680 |             if (served === 0) {
  681 |                 served += 1;
  682 |                 servedStatus = (await route.fetch()).status(); // le serveur traite la lecture…
  683 |                 await abortGate;
  684 |             }
  685 |             await route.abort('timedout'); // … mais aucune réponse n'arrive, ni aux relances
  686 |         };
  687 |         await page.route('**/api/controller/scan', loseWhileAway);
  688 |         const keysBefore3 = keys.length;
  689 |         const errorsBefore3 = await probePostErrors(page);
  690 |         await presentPayloadNoResult(page, await livePayload(holder, t3.id), 'reprise : billet 3, réponse perdue pendant la sortie');
  691 |         await expect.poll(() => served, { message: 'billet 3 : lecture reçue par le serveur', timeout: 20_000 }).toBe(1);
> 692 |         expect(servedStatus, 'billet 3 : la lecture a bien été traitée par le serveur').toBe(200);
      |                                                                                         ^ Error: billet 3 : la lecture a bien été traitée par le serveur
  693 |         await setVisibility(page, 'hidden'); // l'application passe en arrière-plan pendant l'envoi
  694 |         releaseAbort();
  695 |         await expect.poll(async () => (await probePostErrors(page)) - errorsBefore3, {
  696 |             message: 'billet 3 : trois essais sans réponse (même clé)', timeout: 30_000,
  697 |         }).toBeGreaterThanOrEqual(3);
  698 |         await expect.poll(() => pendingScanKeys(page), { message: 'billet 3 : scan gardé sur l’appareil avec sa clé', timeout: 10_000 })
  699 |             .toEqual([keys[keysBefore3]]);
  700 |         await expect(page.locator('[data-scan-result]'), 'billet 3 : aucun écran d’incident pendant la sortie (renvoi au retour)').toHaveCount(0);
  701 |         await page.unroute('**/api/controller/scan', loseWhileAway);
  702 |         await setVisibility(page, 'visible'); // retour au premier plan
  703 |         await expectRecovered(page, 'billet 3, retour au premier plan');
  704 |         const keys3 = keys.slice(keysBefore3);
  705 |         expect(keys3.length, `billet 3 : trois essais puis le renvoi au retour : ${JSON.stringify(keys3)}`).toBeGreaterThanOrEqual(4);
  706 |         expect(keys3[0], 'en-tête Idempotency-Key (D39)').toMatch(/^[0-9a-f-]{36}$/i);
  707 |         expect(new Set(keys3).size, `billet 3 : même clé pour la lecture, ses relances et le renvoi : ${JSON.stringify(keys3)}`).toBe(1);
  708 |         await expect.poll(() => pendingScanKeys(page), { message: 'billet 3 : scan en attente effacé au verdict', timeout: 10_000 }).toEqual([]);
  709 |         const db3 = ticketScans(t3.id);
  710 |         expect(db3.scans.filter((r) => r.accepted).length, `billet 3 : une seule entrée acceptée : ${JSON.stringify(db3.scans)}`).toBe(1);
  711 |         expect(db3.scans.filter((r) => r.result === 'already_used').length, `billet 3 : aucune ligne already_used : ${JSON.stringify(db3.scans)}`).toBe(0);
  712 |         expect(db3.ticket.status).toBe('UTILISE');
  713 |         await expectDoorCount(page, 3, 'après le renvoi du billet 3');
  714 | 
  715 |         // Le résultat retrouvé attend un toucher ; la caméra, coupée pendant la sortie, repart d'un geste
  716 |         await page.locator('[data-scan-recovered="true"]').first().click();
  717 |         await expect(page.locator('[data-scan-result]'), 'résultat retrouvé fermé d’un toucher').toHaveCount(0);
  718 |         await page.getByRole('button', { name: /^reprendre le contr[ôo]le$/i }).click();
  719 |         await waitVideoPlaying(page, 'avant le billet 4');
  720 | 
  721 |         // 4b. Application fermée puis rouverte pendant l'envoi (réponse jamais reçue)
  722 |         let held = 0;
  723 |         let heldStatus = 0;
  724 |         let released = false;
  725 |         const holdResponse = async (route: Route): Promise<void> => {
  726 |             if (released || route.request().method() !== 'POST') {
  727 |                 await route.fallback();
  728 |                 return;
  729 |             }
  730 |             if (held === 0) {
  731 |                 held += 1;
  732 |                 heldStatus = (await route.fetch()).status(); // le serveur traite la lecture…
  733 |             }
  734 |             // … et la réponse n'est jamais rendue : la page est rechargée pendant l'attente
  735 |             await new Promise<void>((resolve) => { page.once('close', () => resolve()); });
  736 |         };
  737 |         await page.route('**/api/controller/scan', holdResponse);
  738 |         const keysBefore4 = keys.length;
  739 |         await presentPayloadNoResult(page, await livePayload(holder, t4.id), 'reprise : billet 4, application fermée pendant l’envoi');
  740 |         await expect.poll(() => held, { message: 'billet 4 : lecture reçue par le serveur', timeout: 20_000 }).toBe(1);
  741 |         expect(heldStatus, 'billet 4 : la lecture a bien été traitée par le serveur').toBe(200);
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
```