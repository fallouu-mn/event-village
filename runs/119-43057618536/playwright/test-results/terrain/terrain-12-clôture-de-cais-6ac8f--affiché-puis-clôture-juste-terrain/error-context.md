# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 12. clôture de caisse avec écart, sans réponse imposée : refus 400, écart du serveur affiché, puis clôture juste
- Location: e2e/terrain.spec.ts:924:5

# Error details

```
Error: ouverture de la caisse : {"error":"Saisissez le code PIN du régisseur.","code":"PIN_REQUIRED"}

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 400
```

# Test source

```ts
  842 |         expect.soft(encoding, 'en-tête content-encoding de la réponse du lot').toBe('gzip');
  843 |         expect.soft(timing.encodedBodySize, 'corps transféré plus petit que le corps décompressé').toBeLessThan(timing.decodedBodySize);
  844 |         expect.soft(timing.encodedBodySize, `corps transféré sous ${OFFLINE_LOT_MAX_ENCODED} octets`).toBeLessThan(OFFLINE_LOT_MAX_ENCODED);
  845 |     } finally {
  846 |         await s.close();
  847 |         restoreTerrainSetting(ev);
  848 |     }
  849 | });
  850 | 
  851 | // ── 11. Scan repris sans ligne en base (lot 8, 8.2 e) ──────────────────────
  852 | 
  853 | test('11. lecture jamais arrivée au serveur : au retour, « non traité », pas de « Résultat retrouvé », billet intact', async ({ browser }, testInfo) => {
  854 |     test.setTimeout(4 * 60_000);
  855 |     const s = new Session(browser, testInfo);
  856 |     let ev: TerrainEvent | null = null;
  857 |     try {
  858 |         ev = prepareTerrainEvent('renvoi seulement', 'client-bis', 1);
  859 |         const ticket = ev.tickets[0];
  860 |         const holder = await s.holder('fumee-client-bis');
  861 |         const ctl = await s.open('fumee-controleur', { probe: true });
  862 |         const page = ctl.page;
  863 |         await openScanner(page, ev.title);
  864 | 
  865 |         const keys: Array<string | null> = [];
  866 |         page.on('request', (req) => {
  867 |             if (req.method() === 'POST' && new URL(req.url()).pathname === '/api/controller/scan') keys.push(req.headers()['idempotency-key'] ?? null);
  868 |         });
  869 | 
  870 |         // Toute lecture est coupée AVANT le serveur (aucun route.fetch) ; la première attend que l'application soit sortie
  871 |         let blocked = 0;
  872 |         let releaseAbort: () => void = () => undefined;
  873 |         const abortGate = new Promise<void>((resolve) => { releaseAbort = resolve; });
  874 |         const blockBeforeServer = async (route: Route): Promise<void> => {
  875 |             if (route.request().method() !== 'POST') {
  876 |                 await route.fallback();
  877 |                 return;
  878 |             }
  879 |             blocked += 1;
  880 |             if (blocked === 1) await abortGate;
  881 |             await route.abort('timedout');
  882 |         };
  883 |         await page.route('**/api/controller/scan', blockBeforeServer);
  884 |         const errorsBefore = await probePostErrors(page);
  885 |         await presentPayloadNoResult(page, await livePayload(holder, ticket.id), 'renvoi seulement : lecture coupée avant le serveur');
  886 |         await expect.poll(() => blocked, { message: 'lecture interceptée avant le serveur', timeout: 20_000 }).toBe(1);
  887 |         await setVisibility(page, 'hidden'); // l'application passe en arrière-plan pendant l'envoi
  888 |         releaseAbort();
  889 |         await expect.poll(async () => (await probePostErrors(page)) - errorsBefore, {
  890 |             message: 'trois essais sans réponse (même clé)', timeout: 30_000,
  891 |         }).toBeGreaterThanOrEqual(3);
  892 |         await expect.poll(() => pendingScanKeys(page), { message: 'scan gardé sur l’appareil avec sa clé', timeout: 10_000 }).toEqual([keys[0]]);
  893 |         const blockedTotal = blocked;
  894 |         await page.unroute('**/api/controller/scan', blockBeforeServer);
  895 | 
  896 |         const resumed = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/controller/scan', { timeout: 20_000 });
  897 |         await setVisibility(page, 'visible'); // retour au premier plan : le scan est renvoyé
  898 |         const body = (await resumed).postDataJSON() as Record<string, unknown>;
  899 | 
  900 |         expect.soft(body.replayOnly, `renvoi au retour : indicateur replayOnly dans le corps (${blockedTotal} envois coupés avant)`).toBe(true);
  901 |         await expect.soft(page.locator('[data-scan-result="not_processed"]').first(), 'renvoi d’une lecture que le serveur n’a jamais reçue : « non traité »').toBeVisible({ timeout: 30_000 });
  902 |         await expect.soft(page.getByText(/résultat retrouvé/i), 'jamais « Résultat retrouvé » : aucune lecture d’origine').toHaveCount(0);
  903 |         expect.soft(new Set(keys).size, `même clé pour la lecture et son renvoi : ${JSON.stringify(keys)}`).toBe(1);
  904 |         const db = ticketScans(ticket.id);
  905 |         expect(db.ticket.status, `billet ${ticket.number} intact : rien n’a été composté par le renvoi`).toBe('VALIDE');
  906 |         expect(db.scans, 'aucune ligne ticket_scans pour ce billet').toEqual([]);
  907 |         await expect.poll(() => pendingScanKeys(page), { message: 'scan en attente effacé au verdict', timeout: 10_000 }).toEqual([]);
  908 |     } finally {
  909 |         await s.close();
  910 |         restoreTerrainSetting(ev);
  911 |     }
  912 | });
  913 | 
  914 | // ── 12. Écart de caisse (lot 8, 8.2 f) ─────────────────────────────────────
  915 | 
  916 | /** Permission espèces du contrôleur A sur cet événement : prepareTerrainEvent l'affecte sans elle. */
  917 | async function allowControllerCash(ev: TerrainEvent): Promise<void> {
  918 |     const { data, error } = await serviceClient().from('event_controllers').update({ can_accept_cash: true })
  919 |         .eq('event_id', ev.eventId).eq('user_id', ev.controllerUserId).select('user_id');
  920 |     if (error) throw new Error(`permission espèces du contrôleur A sur ${ev.eventId} : ${error.message}`);
  921 |     if ((data ?? []).length !== 1) throw new Error(`affectation du contrôleur A sur ${ev.eventId} introuvable`);
  922 | }
  923 | 
  924 | test('12. clôture de caisse avec écart, sans réponse imposée : refus 400, écart du serveur affiché, puis clôture juste', async ({ browser }, testInfo) => {
  925 |     test.setTimeout(3 * 60_000);
  926 |     const s = new Session(browser, testInfo);
  927 |     let ev: TerrainEvent | null = null;
  928 |     try {
  929 |         ev = prepareTerrainEvent('ecart de caisse', 'client-bis', 1);
  930 |         await allowControllerCash(ev);
  931 |         const ctl = await s.open('fumee-controleur', { probe: true });
  932 |         const page = ctl.page;
  933 |         await openScanner(page, ev.title);
  934 | 
  935 |         await page.getByRole('tab', { name: /^caisse$/i }).click();
  936 |         await page.getByRole('button', { name: /^ouvrir ma caisse$/i }).click();
  937 |         const opening = page.getByRole('dialog', { name: /^ouvrir ma caisse$/i });
  938 |         await expect(opening).toBeVisible();
  939 |         const opened = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/controller/shifts/open' && r.request().method() === 'POST');
  940 |         await opening.getByRole('button', { name: /^ouvrir la caisse$/i }).click();
  941 |         const openedRes = await opened;
> 942 |         expect(openedRes.status(), `ouverture de la caisse : ${(await openedRes.text()).slice(0, 300)}`).toBe(200);
      |                                                                                                          ^ Error: ouverture de la caisse : {"error":"Saisissez le code PIN du régisseur.","code":"PIN_REQUIRED"}
  943 | 
  944 |         await page.getByRole('button', { name: /^clôturer ma caisse$/i }).click();
  945 |         const dialog = page.getByRole('dialog', { name: /^clôturer ma caisse$/i });
  946 |         await expect(dialog).toBeVisible();
  947 |         const closeResponse = () => page.waitForResponse((r) => new URL(r.url()).pathname === '/api/controller/shifts/close' && r.request().method() === 'POST');
  948 | 
  949 |         // Rien d'encaissé : 1 000 F comptés font un écart de +1 000 F
  950 |         const counted = dialog.getByLabel(/^espèces encaissées comptées/i);
  951 |         await counted.fill('1000');
  952 |         const refusal = closeResponse();
  953 |         await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  954 |         const refused = await refusal;
  955 |         const refusedBody = (await refused.json()) as Record<string, unknown>;
  956 |         expect(refused.status(), `clôture avec écart : ${JSON.stringify(refusedBody)}`).toBe(400);
  957 |         expect(refusedBody.code, `clôture avec écart : ${JSON.stringify(refusedBody)}`).toBe('JUSTIFICATION_REQUIRED');
  958 |         await expect(dialog.getByText(/^écart constaté$/i)).toBeVisible();
  959 |         // Soft : la caisse est fermée ensuite, même quand l'écart n'est pas affiché
  960 |         expect.soft(refusedBody.discrepancy, 'écart renvoyé par le serveur (contrat 3.6)').toBe(1000);
  961 |         await expect.soft(dialog.getByText(/écart de\s1\s000\sF\sCFA/i), 'texte « Écart de 1 000 F CFA » à l’écran').toBeVisible();
  962 | 
  963 |         await counted.fill('0');
  964 |         const closed = closeResponse();
  965 |         await dialog.getByRole('button', { name: /^clôturer la caisse$/i }).click();
  966 |         const closedRes = await closed;
  967 |         expect(closedRes.status(), `clôture sans écart : ${(await closedRes.text()).slice(0, 300)}`).toBe(200);
  968 |         await expect(page.getByRole('dialog', { name: /^caisse clôturée$/i })).toBeVisible();
  969 |     } finally {
  970 |         await s.close();
  971 |         restoreTerrainSetting(ev);
  972 |     }
  973 | });
  974 | 
```