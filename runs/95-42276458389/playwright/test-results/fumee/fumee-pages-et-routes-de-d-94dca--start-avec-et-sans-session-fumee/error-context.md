# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: fumee.spec.ts >> pages et routes de développement : 404 sur next start, avec et sans session
- Location: e2e/fumee.spec.ts:807:5

# Error details

```
Error: aucune redirection vers la connexion, aucun 401 : ces adresses n’existent pas sur un build

expect(received).toEqual(expected) // deep equality

- Expected  - 3
+ Received  + 3

  Array [
-   "sans session GET /dev/paiements : 404",
-   "sans session GET /api/dev/samirpay/x : 404",
-   "sans session POST /api/dev/samirpay/x : 404",
+   "sans session GET /dev/paiements : 307",
+   "sans session GET /api/dev/samirpay/x : 401",
+   "sans session POST /api/dev/samirpay/x : 401",
    "avec session GET /dev/paiements : 404",
    "avec session GET /api/dev/samirpay/x : 404",
    "avec session POST /api/dev/samirpay/x : 404",
  ]
```

# Test source

```ts
  721 |             expect(consoleErrors, 'aucune erreur de console sur la page hors ligne').toEqual([]);
  722 |         });
  723 | 
  724 |         await test.step('14. contrôleur A en ligne : QR lu sur le téléphone hors ligne du client → entrée validée', async () => {
  725 |             if (!e3 || !swClient) throw new Error('étapes 11 à 13 non abouties');
  726 |             const clientPage: Page = swClient;
  727 |             controller = await pageAs('fumee-controleur', false, { scanProbe: true });
  728 |             await openScanner(controller, e3.title);
  729 |             const payload = String(await clientPage.locator('[data-ev-qr-payload]').getAttribute('data-ev-qr-payload'));
  730 |             expect(payload, 'payload affiché hors ligne : <préfixe>:<billet 1>:<6 chiffres>').toMatch(new RegExp(`:${e3Tickets[0]}:\\d{6}$`));
  731 |             await presentPayload(controller, payload, 'billet 1 présenté hors ligne');
  732 |             await expect(controller.locator('[data-scan-result="valid"]').first(), 'billet 1 hors ligne : « valid »').toBeVisible();
  733 |         });
  734 | 
  735 |         await test.step('15. transfert du billet 2 au second client, acceptation, puis ancien code présenté → refusé (qr_expired)', async () => {
  736 |             if (!e3 || !oldLot || !controller) throw new Error('étapes 11 à 14 non abouties');
  737 |             const lot: StoredLot = oldLot;
  738 |             const ctl: Page = controller;
  739 |             const recipient = verifyHolderPhone('client-bis');
  740 |             console.log(`[e2e][fumée] numéro du second client ${recipient.changed ? 'marqué vérifié' : 'déjà vérifié'} (${recipient.verifiedAt})`);
  741 |             await client.goto('/tickets');
  742 |             const card = client.locator('li, article').filter({ hasText: e3Numbers[1] }).last();
  743 |             await card.getByRole('button', { name: /^transférer$/i }).click();
  744 |             const dialog = client.getByRole('dialog', { name: /^transférer ce billet$/i });
  745 |             await expect(dialog).toBeVisible();
  746 |             await dialog.getByLabel(/^numéro de téléphone du destinataire/i).fill(FIXTURE_USERS.CLIENT_BIS.phone.replace(/^\+221/, ''));
  747 |             const sent = client.waitForResponse((r) => new URL(r.url()).pathname === `/api/tickets/${e3Tickets[1]}/transfer` && r.request().method() === 'POST');
  748 |             await dialog.getByRole('button', { name: /^envoyer le billet$/i }).click();
  749 |             const sentRes = await sent;
  750 |             expect(sentRes.status(), `transfert du billet 2 : ${(await sentRes.text()).slice(0, 300)}`).toBe(200);
  751 |             await dialog.getByRole('button', { name: /^terminer$/i }).click();
  752 | 
  753 |             const bis = await pageAs('fumee-client-bis');
  754 |             await bis.goto('/tickets?tab=recus');
  755 |             const offer = bis.locator('li, article, section').filter({ hasText: e3.title }).filter({ has: bis.getByRole('button', { name: /^accepter le billet$/i }) }).last();
  756 |             await offer.getByRole('button', { name: /^accepter le billet$/i }).click();
  757 |             const confirm = bis.getByRole('dialog').or(bis.getByRole('alertdialog'));
  758 |             await expect(confirm).toBeVisible();
  759 |             const claimed = bis.waitForResponse((r) => /^\/api\/tickets\/transfers\/[^/]+\/claim$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST');
  760 |             await confirm.getByRole('button', { name: /^accepter le billet$/i }).click();
  761 |             const claimRes = await claimed;
  762 |             expect(claimRes.status(), `acceptation du transfert : ${(await claimRes.text()).slice(0, 300)}`).toBe(200);
  763 | 
  764 |             const old = payloadFromLot(lot);
  765 |             console.log(`[e2e][fumée] ancien code du billet ${e3Numbers[1]} (version ${lot.secret_version}, pas ${old.counter}) présenté au contrôleur`);
  766 |             await presentPayload(ctl, old.payload, 'ancien code du billet 2 après le transfert');
  767 |             await expect(ctl.locator('[data-scan-result="qr_expired"]').first(), 'ancien code après le transfert : « qr_expired » (D3)').toBeVisible();
  768 |         });
  769 | 
  770 |         await test.step('16. caches du client : coquille hors ligne seulement, rien de /api/ ; route des codes jamais servie hors ligne', async () => {
  771 |             const page = swClient;
  772 |             if (!page) throw new Error('contexte du client avec service worker absent');
  773 |             const keys = await page.evaluate(async () => (await caches.keys()).sort());
  774 |             expect(keys, `caches du client : seul ${OFFLINE_CACHE} attendu`).toEqual([OFFLINE_CACHE]);
  775 |             const urls = await page.evaluate(async (name) => (await (await caches.open(name)).keys()).map((r) => r.url), OFFLINE_CACHE);
  776 |             const forbidden = urls.filter((u) => {
  777 |                 const url = new URL(u);
  778 |                 return url.pathname.startsWith('/api/') || url.searchParams.has('_rsc');
  779 |             });
  780 |             expect(forbidden, `aucune URL /api/ ni _rsc dans ${OFFLINE_CACHE} (${urls.length} entrée(s))`).toEqual([]);
  781 |             expect(swApiResponses, 'aucune réponse /api/ servie par le service worker').toEqual([]);
  782 |             await page.context().setOffline(true);
  783 |             const outcome = await page.evaluate(async (id) => {
  784 |                 try {
  785 |                     const r = await fetch(`/api/tickets/${id}/offline-codes`, { cache: 'no-store' });
  786 |                     return `servi (HTTP ${r.status})`;
  787 |                 } catch (err) {
  788 |                     return `rejeté (${err instanceof Error ? err.message : String(err)})`;
  789 |                 }
  790 |             }, e3Tickets[0]);
  791 |             expect(outcome, 'hors ligne, la route des codes n’est jamais servie depuis un cache').toMatch(/^rejeté/);
  792 |         });
  793 |     } finally {
  794 |         // Lot 7 (étape 11) : réglage access.scan_window_before_hours remis, même après un échec
  795 |         if (e3) restoreTerrainSetting(e3);
  796 |         const notices = guards.flatMap(({ role, guard }) => guard.nonBlockingIssues().map((i) => `${role} : ${i}`));
  797 |         if (notices.length > 0) console.log(`[e2e][fumée] avertissements non bloquants du navigateur :\n${notices.join('\n')}`);
  798 |         const issues = guards.flatMap(({ role, guard }) => guard.blockingIssues().map((i) => `${role} : ${i}`));
  799 |         if (issues.length > 0) {
  800 |             await testInfo.attach('erreurs-navigateur.txt', { body: issues.join('\n'), contentType: 'text/plain' });
  801 |             console.log(`[e2e][fumée] erreurs observées dans le navigateur :\n${issues.join('\n')}`);
  802 |         }
  803 |         for (const c of contexts) await c.close();
  804 |     }
  805 | });
  806 | 
  807 | test('pages et routes de développement : 404 sur next start, avec et sans session', async ({ browser }, testInfo) => {
  808 |     const anonymous = await browser.newContext(projectContextOptions(testInfo));
  809 |     await prepareContext(anonymous, 'clair');
  810 |     const signedIn = await openRoleContext(browser, testInfo, 'fumee-client');
  811 |     try {
  812 |         const seen: string[] = [];
  813 |         const expected: string[] = [];
  814 |         for (const [who, context] of [['sans session', anonymous], ['avec session', signedIn]] as const) {
  815 |             for (const [method, url] of [['GET', '/dev/paiements'], ['GET', '/api/dev/samirpay/x'], ['POST', '/api/dev/samirpay/x']] as const) {
  816 |                 const res = await context.request.fetch(url, { method, maxRedirects: 0 });
  817 |                 seen.push(`${who} ${method} ${url} : ${res.status()}`);
  818 |                 expected.push(`${who} ${method} ${url} : 404`);
  819 |             }
  820 |         }
> 821 |         expect(seen, 'aucune redirection vers la connexion, aucun 401 : ces adresses n’existent pas sur un build').toEqual(expected);
      |                                                                                                                    ^ Error: aucune redirection vers la connexion, aucun 401 : ces adresses n’existent pas sur un build
  822 |     } finally {
  823 |         await anonymous.close();
  824 |         await signedIn.close();
  825 |     }
  826 | });
  827 | 
```