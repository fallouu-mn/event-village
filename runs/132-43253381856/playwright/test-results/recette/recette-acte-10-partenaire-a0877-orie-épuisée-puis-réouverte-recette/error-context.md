# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 10 [partenaire] [contrôleur] [client] : grande soirée, deux zones, trois portes, liste des invités, mauvaise zone, double entrée, catégorie épuisée puis réouverte
- Location: e2e/recette.spec.ts:1191:5

# Error details

```
Error: live-code du billet c75890a5-b3b7-4889-b7e4-fda586648ca7 : HTTP 409 {"error":"Ce billet n’est plus valable à l’entrée.","status":"UTILISE"}
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e3]:
      - link "Event Village, accueil" [ref=f5e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f5e11]:
          - generic [ref=f5e12]: EVENT
          - generic [ref=f5e13]: VILLAGE
      - navigation "Navigation principale" [ref=f5e14]:
        - generic [ref=f5e15]: Administration
        - link "Tableau de bord" [ref=f5e20] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f5e27]:
          - paragraph [ref=f5e28]: Gestion
          - generic [ref=f5e29]:
            - link "Événements" [ref=f5e30] [cursor=pointer]:
              - /url: /admin/events
            - link "Utilisateurs" [ref=f5e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f5e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f5e47]:
          - paragraph [ref=f5e48]: Finances
          - generic [ref=f5e49]:
            - link "Finance" [ref=f5e50] [cursor=pointer]:
              - /url: /admin/finance
            - link "Tarification" [ref=f5e54] [cursor=pointer]:
              - /url: /admin/pricing
        - generic [ref=f5e57]:
          - paragraph [ref=f5e58]: Engagement
          - generic [ref=f5e59]:
            - link "Parrainage" [ref=f5e60] [cursor=pointer]:
              - /url: /admin/referral
            - link "Communications" [ref=f5e65] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=f5e70]:
          - paragraph [ref=f5e71]: Système
          - generic [ref=f5e72]:
            - link "Journal d’audit" [ref=f5e73] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f5e78] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f5e85] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=f5e94] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e99]:
        - link "Elhadji SuperAdmin Super administrateur" [ref=f5e100] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e101]: ES
          - generic [ref=f5e102]:
            - generic [ref=f5e103]: Elhadji SuperAdmin
            - generic [ref=f5e104]: Super administrateur
        - generic [ref=f5e105]:
          - button "Se déconnecter" [ref=f5e106] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e111] [cursor=pointer]
    - generic [ref=f5e115]:
      - banner [ref=f5e116]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e118] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 99+ non lues" [ref=f5e125] [cursor=pointer]:
          - generic [ref=f5e129]: 99+
      - main [ref=f5e130]:
        - generic [ref=f5e132]:
          - generic [ref=f5e134]:
            - generic [ref=f5e135]:
              - heading "Tableau de bord" [level=1] [ref=f5e136]
              - paragraph [ref=f5e137]: Dossiers à traiter et vue d’ensemble de la plateforme.
            - generic [ref=f5e138]:
              - status [ref=f5e139]: Mis à jour à 17:04
              - button "Actualiser" [ref=f5e141] [cursor=pointer]
          - region [ref=f5e149]:
            - heading "À traiter" [level=2] [ref=f5e150]
            - generic [ref=f5e151]:
              - generic [ref=f5e152]:
                - generic [ref=f5e153]:
                  - paragraph [ref=f5e155]: Événements à valider
                  - paragraph [ref=f5e161]: "4"
                  - paragraph [ref=f5e162]: Soumis par les organisateurs, en attente de votre examen.
                - link "Ouvrir la file de validation" [ref=f5e163] [cursor=pointer]:
                  - /url: /admin/events
              - generic [ref=f5e168]:
                - generic [ref=f5e169]:
                  - paragraph [ref=f5e171]: Partenaires à valider
                  - paragraph [ref=f5e177]: "0"
                  - paragraph [ref=f5e178]: Inscriptions avec leurs pièces justificatives.
                - link "Voir les candidatures" [ref=f5e179] [cursor=pointer]:
                  - /url: "#partenaires"
          - region [ref=f5e184]:
            - heading "Indicateurs" [level=2] [ref=f5e185]
            - generic [ref=f5e186]:
              - generic [ref=f5e187]:
                - paragraph [ref=f5e189]: Volume des transactions
                - paragraph [ref=f5e194]: 2 039 700 F CFA
                - paragraph [ref=f5e195]: Paiements en ligne encaissés
              - generic [ref=f5e196]:
                - paragraph [ref=f5e198]: Revenu net de la plateforme
                - paragraph [ref=f5e202]: 57 739 F CFA
                - paragraph [ref=f5e203]: Commissions et frais Event Village
              - generic [ref=f5e204]:
                - paragraph [ref=f5e206]: Partenaires validés
                - paragraph [ref=f5e212]: "6"
                - paragraph [ref=f5e213]: sur 7 inscrits
              - generic [ref=f5e214]:
                - paragraph [ref=f5e216]: Utilisateurs inscrits
                - paragraph [ref=f5e223]: "47"
                - paragraph [ref=f5e224]: 0 ambassadeur(s) actif(s)
          - region [ref=f5e225]:
            - generic [ref=f5e226]:
              - heading "Candidatures des partenaires" [level=2] [ref=f5e227]
              - paragraph [ref=f5e228]: Validez ou refusez les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier.
            - tablist "Statut des candidatures" [ref=f5e230]:
              - tab "En attente , 0" [ref=f5e231] [cursor=pointer]:
                - generic [ref=f5e232]: En attente
                - generic [ref=f5e233]:
                  - generic [ref=f5e234]: ","
                  - text: "0"
              - tab "Validés , 6" [ref=f5e235] [cursor=pointer]:
                - generic [ref=f5e236]: Validés
                - generic [ref=f5e237]:
                  - generic [ref=f5e238]: ","
                  - text: "6"
              - tab "Refusés , 0" [ref=f5e239] [cursor=pointer]:
                - generic [ref=f5e240]: Refusés
                - generic [ref=f5e241]:
                  - generic [ref=f5e242]: ","
                  - text: "0"
              - tab "Tous , 7" [selected] [ref=f5e243] [cursor=pointer]:
                - generic [ref=f5e244]: Tous
                - generic [ref=f5e245]:
                  - generic [ref=f5e246]: ","
                  - text: "7"
            - tabpanel "Tous , 7" [ref=f5e247]:
              - table [ref=f5e250]:
                - caption [ref=f5e251]: Candidatures des partenaires
                - rowgroup [ref=f5e252]:
                  - row [ref=f5e253]:
                    - columnheader "Partenaire" [ref=f5e254]
                    - columnheader "Responsable" [ref=f5e255]
                    - columnheader "Statut" [ref=f5e256]
                    - columnheader "Inscrit le" [ref=f5e257]
                    - columnheader "Actions" [ref=f5e258]
                - rowgroup [ref=f5e259]:
                  - row [ref=f5e260]:
                    - cell "Recette Productions 17.03.27 Organisateur" [ref=f5e261]:
                      - generic [ref=f5e262]:
                        - generic [ref=f5e263]: Recette Productions 17.03.27
                        - generic [ref=f5e264]: Organisateur
                    - cell "Mame Recette +221773007811 Dakar" [ref=f5e267]:
                      - generic [ref=f5e268]:
                        - generic [ref=f5e269]: Mame Recette
                        - generic [ref=f5e270]: "+221773007811"
                        - generic [ref=f5e271]: Dakar
                    - cell "Suspendu" [ref=f5e272]
                    - cell [ref=f5e275]:
                      - time [ref=f5e276]: jeu. 12 nov. 2026 à 17:03
                    - cell [ref=f5e277]:
                      - button "Dossier" [ref=f5e279] [cursor=pointer]
                  - row [ref=f5e285]:
                    - cell "Teranga Découvertes Organisateur" [ref=f5e286]:
                      - generic [ref=f5e287]:
                        - generic [ref=f5e288]: Teranga Découvertes
                        - generic [ref=f5e289]: Organisateur
                    - cell "Ndèye Gning +221700000109 Rufisque" [ref=f5e292]:
                      - generic [ref=f5e293]:
                        - generic [ref=f5e294]: Ndèye Gning
                        - generic [ref=f5e295]: "+221700000109"
                        - generic [ref=f5e296]: Rufisque
                    - cell "Validé" [ref=f5e297]
                    - cell [ref=f5e300]:
                      - time [ref=f5e301]: jeu. 12 nov. 2026 à 16:35
                    - cell [ref=f5e302]:
                      - button "Dossier" [ref=f5e304] [cursor=pointer]
                  - row [ref=f5e310]:
                    - cell "Atelier Petite-Côte Petite-Côte Événements Organisateur" [ref=f5e311]:
                      - generic [ref=f5e312]:
                        - generic [ref=f5e313]: Atelier Petite-Côte
                        - generic [ref=f5e314]: Petite-Côte Événements
                        - generic [ref=f5e315]: Organisateur
                    - cell "Khady Sarr +221700000103 Mbour" [ref=f5e318]:
                      - generic [ref=f5e319]:
                        - generic [ref=f5e320]: Khady Sarr
                        - generic [ref=f5e321]: "+221700000103"
                        - generic [ref=f5e322]: Mbour
                    - cell "Validé" [ref=f5e323]
                    - cell [ref=f5e326]:
                      - time [ref=f5e327]: jeu. 12 nov. 2026 à 16:34
                    - cell [ref=f5e328]:
                      - button "Dossier" [ref=f5e330] [cursor=pointer]
                  - row [ref=f5e336]:
                    - cell "Sine-Saloum Culture & Loisirs Saloum Culture Organisateur" [ref=f5e337]:
                      - generic [ref=f5e338]:
                        - generic [ref=f5e339]: Sine-Saloum Culture & Loisirs
                        - generic [ref=f5e340]: Saloum Culture
                        - generic [ref=f5e341]: Organisateur
                    - cell "Ousmane Faye +221700000102 Kaolack" [ref=f5e344]:
                      - generic [ref=f5e345]:
                        - generic [ref=f5e346]: Ousmane Faye
                        - generic [ref=f5e347]: "+221700000102"
                        - generic [ref=f5e348]: Kaolack
                    - cell "Validé" [ref=f5e349]
                    - cell [ref=f5e352]:
                      - time [ref=f5e353]: jeu. 12 nov. 2026 à 16:34
                    - cell [ref=f5e354]:
                      - button "Dossier" [ref=f5e356] [cursor=pointer]
                  - row [ref=f5e362]:
                    - cell "Baobab Scène Productions Baobab Scène Organisateur" [ref=f5e363]:
                      - generic [ref=f5e364]:
                        - generic [ref=f5e365]: Baobab Scène Productions
                        - generic [ref=f5e366]: Baobab Scène
                        - generic [ref=f5e367]: Organisateur
                    - cell "Mariama Ndiaye +221700000101 Dakar" [ref=f5e370]:
                      - generic [ref=f5e371]:
                        - generic [ref=f5e372]: Mariama Ndiaye
                        - generic [ref=f5e373]: "+221700000101"
                        - generic [ref=f5e374]: Dakar
                    - cell "Validé" [ref=f5e375]
                    - cell [ref=f5e378]:
                      - time [ref=f5e379]: jeu. 12 nov. 2026 à 16:34
                    - cell [ref=f5e380]:
                      - button "Dossier" [ref=f5e382] [cursor=pointer]
                  - row [ref=f5e388]:
                    - cell "TEST Organisateur B Orga B (test) Organisateur" [ref=f5e389]:
                      - generic [ref=f5e390]:
                        - generic [ref=f5e391]: TEST Organisateur B
                        - generic [ref=f5e392]: Orga B (test)
                        - generic [ref=f5e393]: Organisateur
                    - cell "Bassirou OrgaB +221700000004 Thiès" [ref=f5e396]:
                      - generic [ref=f5e397]:
                        - generic [ref=f5e398]: Bassirou OrgaB
                        - generic [ref=f5e399]: "+221700000004"
                        - generic [ref=f5e400]: Thiès
                    - cell "Validé" [ref=f5e401]
                    - cell [ref=f5e404]:
                      - time [ref=f5e405]: jeu. 12 nov. 2026 à 16:34
                    - cell [ref=f5e406]:
                      - button "Dossier" [ref=f5e408] [cursor=pointer]
                  - row [ref=f5e414]:
                    - cell "TEST Organisateur A Orga A (test) Organisateur" [ref=f5e415]:
                      - generic [ref=f5e416]:
                        - generic [ref=f5e417]: TEST Organisateur A
                        - generic [ref=f5e418]: Orga A (test)
                        - generic [ref=f5e419]: Organisateur
                    - cell "Aïssatou OrgaA +221700000003 Dakar" [ref=f5e422]:
                      - generic [ref=f5e423]:
                        - generic [ref=f5e424]: Aïssatou OrgaA
                        - generic [ref=f5e425]: "+221700000003"
                        - generic [ref=f5e426]: Dakar
                    - cell "Validé" [ref=f5e427]
                    - cell [ref=f5e430]:
                      - time [ref=f5e431]: jeu. 12 nov. 2026 à 16:34
                    - cell [ref=f5e432]:
                      - button "Dossier" [ref=f5e434] [cursor=pointer]
          - region [ref=f5e440]:
            - heading "Raccourcis" [level=2] [ref=f5e441]
            - generic [ref=f5e442]:
              - link "Parrainage et ambassadeurs" [ref=f5e443] [cursor=pointer]:
                - /url: /admin/referral
              - link "Journal d’audit" [ref=f5e449] [cursor=pointer]:
                - /url: /admin/audit
              - link "Catalogues et services" [ref=f5e454] [cursor=pointer]:
                - /url: /admin/services
  - alert [ref=f5e461]
```

# Test source

```ts
  399 |         if (Date.now() > deadline) {
  400 |             const detail = await describeProbe(page, index);
  401 |             await page.evaluate((i) => (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe?.withdraw(i), index);
  402 |             throw new Error(`${failure} (${Math.round(timeoutMs / 1000)} s) — ${detail}`);
  403 |         }
  404 |         await page.waitForTimeout(200);
  405 |     }
  406 | }
  407 | 
  408 | /**
  409 |  * Présente un payload au scanner (QR tenu jusqu'à l'envoi de la lecture ou au résultat) et attend sa lecture
  410 |  * puis le changement de résultat (sonde). En cas d'échec, le message donne readAt, les lectures, les POST
  411 |  * du scan observés et l'état de l'écran.
  412 |  */
  413 | export async function presentPayload(page: Page, payload: string, what: string, timeoutMs = 45_000): Promise<{ index: number; record: ProbeRecord }> {
  414 |     const index = await presentOnPage(page, payload, true);
  415 |     await waitProbe(page, index, 'readAt', timeoutMs, `${what} : le scanner n'a pas lu le QR présenté (caméra en pause, en veille, ou détection arrêtée)`);
  416 |     const record = await waitProbe(page, index, 'resultAt', timeoutMs, `${what} : aucun résultat de scan affiché ([data-scan-result]) après la lecture`);
  417 |     return { index, record };
  418 | }
  419 | 
  420 | /** Présente un payload une seule fois, sans attendre de résultat (lecture hors ligne : écran technique attendu). */
  421 | export async function presentPayloadNoResult(page: Page, payload: string, what: string): Promise<{ index: number; record: ProbeRecord }> {
  422 |     const index = await presentOnPage(page, payload, false);
  423 |     const record = await waitProbe(page, index, 'readAt', 30_000, `${what} : le scanner n'a pas lu le QR présenté`);
  424 |     return { index, record };
  425 | }
  426 | 
  427 | export async function probeRecord(page: Page, index: number): Promise<ProbeRecord> {
  428 |     return page.evaluate((i) => {
  429 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  430 |         if (!probe) throw new Error('sonde du scanner absente de la page');
  431 |         const r = probe.records[i];
  432 |         if (!r) throw new Error(`lecture ${i} inconnue de la sonde`);
  433 |         return { ...r };
  434 |     }, index);
  435 | }
  436 | 
  437 | export async function probeVibrations(page: Page): Promise<ProbeVibration[]> {
  438 |     return page.evaluate(() => {
  439 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  440 |         if (!probe) throw new Error('sonde du scanner absente de la page');
  441 |         return probe.vibrations.map((v) => ({ at: v.at, pattern: [...v.pattern] }));
  442 |     });
  443 | }
  444 | 
  445 | export async function probeTracks(page: Page): Promise<Array<{ kind: string; readyState: string }>> {
  446 |     return page.evaluate(() => {
  447 |         const probe = (window as unknown as { __evScanProbe?: ProbeHandle }).__evScanProbe;
  448 |         if (!probe) throw new Error('sonde du scanner absente de la page');
  449 |         return probe.tracks();
  450 |     });
  451 | }
  452 | 
  453 | /** Marques de l'application (`performance.mark('ev-scan:read'|'ev-scan:pending'|'ev-scan:result')`). */
  454 | export async function scanMarks(page: Page): Promise<Array<{ name: string; startTime: number }>> {
  455 |     return page.evaluate(() => performance.getEntriesByType('mark')
  456 |         .filter((m) => m.name.startsWith('ev-scan:'))
  457 |         .map((m) => ({ name: m.name, startTime: m.startTime })));
  458 | }
  459 | 
  460 | // ── Écran du contrôleur ────────────────────────────────────────────────────
  461 | 
  462 | function escapeRe(s: string): string {
  463 |     return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  464 | }
  465 | 
  466 | /**
  467 |  * Ouvre /controller/scanner sur l'écran « Commencer le contrôle » (ScannerStartScreen, D49, écran committé par
  468 |  * fix(7.2e)) : bouton radio de l'événement (nom accessible = titre, date, lieu), puis « Commencer le contrôle »,
  469 |  * mode caméra (aria-pressed), titre de l'événement dans la barre d'état, flux vidéo en lecture. Les replis du lot 6
  470 |  * (liste déroulante, bouton d'événement) sont retirés : l'écran réel est exigé.
  471 |  */
  472 | export async function openScanner(page: Page, eventTitle: string): Promise<void> {
  473 |     await page.goto('/controller/scanner');
  474 |     await expect(page.getByRole('heading', { level: 1, name: /^commencer le contr[ôo]le$/i }),
  475 |         'scanner : écran « Commencer le contrôle » (D49)').toBeVisible({ timeout: 45_000 });
  476 |     const radio = page.getByRole('radio', { name: new RegExp(escapeRe(eventTitle)) });
  477 |     await expect(radio, `scanner : l'événement « ${eventTitle} » est proposé sur l'écran de départ`).toHaveCount(1, { timeout: 45_000 });
  478 |     await radio.check();
  479 |     await expect(radio, `scanner : événement « ${eventTitle} » choisi`).toBeChecked();
  480 |     await page.getByRole('button', { name: /^commencer le contr[ôo]le$/i }).click();
  481 |     const camera = page.getByRole('button', { name: /^caméra$/i });
  482 |     await expect(camera, 'scanner : bascule « Caméra / Saisie manuelle » affichée après le départ').toBeVisible({ timeout: 30_000 });
  483 |     if ((await camera.getAttribute('aria-pressed')) !== 'true') await camera.click();
  484 |     await expect(camera, 'scanner : mode caméra').toHaveAttribute('aria-pressed', 'true');
  485 |     await expect(page.getByText(eventTitle).filter({ visible: true }).first(), `scanner : événement « ${eventTitle} » affiché`).toBeVisible();
  486 |     await page.waitForFunction(() => Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2), null, { timeout: 30_000 })
  487 |         .catch((err: unknown) => {
  488 |             throw new Error(`scanner : aucun flux vidéo en lecture après le choix de l'événement (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  489 |         });
  490 | }
  491 | 
  492 | /** Payload du QR dynamique courant d'un billet, lu par la route du porteur depuis sa page (cookies de session). */
  493 | export async function livePayload(holderPage: Page, ticketId: string): Promise<string> {
  494 |     const out = await holderPage.evaluate(async (id) => {
  495 |         const res = await fetch(`/api/tickets/${id}/live-code`, { cache: 'no-store' });
  496 |         const text = await res.text();
  497 |         return { status: res.status, text };
  498 |     }, ticketId);
> 499 |     if (out.status !== 200) throw new Error(`live-code du billet ${ticketId} : HTTP ${out.status} ${out.text.slice(0, 200)}`);
      |                                   ^ Error: live-code du billet c75890a5-b3b7-4889-b7e4-fda586648ca7 : HTTP 409 {"error":"Ce billet n’est plus valable à l’entrée.","status":"UTILISE"}
  500 |     let payload = '';
  501 |     try {
  502 |         payload = String((JSON.parse(out.text) as { payload?: unknown }).payload ?? '');
  503 |     } catch (err) {
  504 |         throw new Error(`live-code du billet ${ticketId} : réponse illisible (${err instanceof Error ? err.message : String(err)}) : ${out.text.slice(0, 200)}`);
  505 |     }
  506 |     if (!payload.includes(ticketId)) throw new Error(`live-code du billet ${ticketId} : payload inattendu « ${payload.slice(0, 120)} »`);
  507 |     return payload;
  508 | }
  509 | 
  510 | /** Payload dont le code ne se vérifie pas (même billet, même préfixe) : refus attendu (qr_expired / invalid). */
  511 | export function forgedPayload(payload: string): string {
  512 |     const m = /^(.*:)(\d{6})$/.exec(payload);
  513 |     if (!m) throw new Error(`payload sans code à 6 chiffres : « ${payload.slice(0, 120)} »`);
  514 |     const forged = String((Number(m[2]) + 500_001) % 1_000_000).padStart(6, '0');
  515 |     return `${m[1]}${forged}`;
  516 | }
  517 | 
  518 | // ── Barre d'achat de la fiche d'un événement (lot 8, 8.2 s) ────────────────
  519 | 
  520 | /** Décalage du bas de la barre dans app/events/[id]/page.tsx : `bottom-[calc(4.5rem+…)]`, soit 72 px sans zone sûre. */
  521 | const BUY_BAR_OFFSET_PX = 72;
  522 | const POSITION_TOLERANCE_PX = 2;
  523 | 
  524 | interface BarPosition { scrollY: number; scrollMax: number; top: number; bottom: number; left: number; right: number; innerWidth: number; innerHeight: number; navHeight: number }
  525 | 
  526 | /**
  527 |  * Barre d'achat posée sur l'écran, en haut de page puis à mi-page (panier non vide attendu). Bloc conteneur piégé par
  528 |  * `.ev-page-enter` (PROUVÉ, contrat 11.3) : elle défile avec la page, loin sous l'écran, et n'a pas la largeur de l'écran.
  529 |  * Exigé aux deux positions : largeur pleine ; bas de la barre au-dessus de la barre de navigation, jamais recouvert ; et
  530 |  * au plus 72 px du bas de l'écran. La borne haute est le décalage actuel de la page, pas la hauteur de la navigation
  531 |  * (53 px mesurés) : voir la réponse de l'agent e2e, l'égalité du contrat 15.4 resterait fausse après le correctif 11.3.
  532 |  * Finit à mi-page.
  533 |  */
  534 | export async function expectBuyBarAnchored(page: Page, what: string): Promise<void> {
  535 |     const button = page.getByRole('button', { name: /^acheter \(/i });
  536 |     await expect(button, `${what} : bouton de la barre d'achat, montant calculé`).toBeVisible({ timeout: 20_000 });
  537 |     const bar = page.locator('div.fixed').filter({ has: button });
  538 |     await expect(bar, `${what} : une seule barre d'achat fixe`).toHaveCount(1);
  539 |     const at = (fraction: number): Promise<BarPosition> => bar.evaluate((el, f) => {
  540 |         const scrollMax = document.documentElement.scrollHeight - window.innerHeight;
  541 |         window.scrollTo({ top: Math.round(scrollMax * f), behavior: 'instant' });
  542 |         const r = el.getBoundingClientRect();
  543 |         const nav = document.querySelector('nav[aria-label="Navigation rapide"]');
  544 |         return {
  545 |             scrollY: window.scrollY, scrollMax, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
  546 |             innerWidth: window.innerWidth, innerHeight: window.innerHeight, navHeight: nav ? nav.getBoundingClientRect().height : 0,
  547 |         };
  548 |     }, fraction);
  549 |     for (const [label, fraction] of [['haut de page', 0], ['mi-page', 0.5]] as const) {
  550 |         const p = await at(fraction);
  551 |         const seen = `${what}, ${label} : ${JSON.stringify(p)}`;
  552 |         expect(p.navHeight, `barre de navigation du bas présente — ${seen}`).toBeGreaterThan(0);
  553 |         if (fraction > 0) expect(p.scrollY, `page réellement défilée — ${seen}`).toBeGreaterThan(0);
  554 |         expect(Math.abs(p.left), `gauche de la barre au bord de l'écran — ${seen}`).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  555 |         expect(Math.abs(p.right - p.innerWidth), `droite de la barre au bord de l'écran — ${seen}`).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  556 |         const fromBottom = p.innerHeight - p.bottom;
  557 |         expect(fromBottom, `bas de la barre au-dessus de la navigation, jamais recouvert — ${seen}`).toBeGreaterThanOrEqual(p.navHeight - POSITION_TOLERANCE_PX);
  558 |         expect(fromBottom, `bas de la barre près du bas de l'écran — ${seen}`).toBeLessThanOrEqual(BUY_BAR_OFFSET_PX + POSITION_TOLERANCE_PX);
  559 |     }
  560 | }
  561 | 
  562 | // ── Statistiques et fichiers de mesure ─────────────────────────────────────
  563 | 
  564 | export function median(values: number[]): number | null {
  565 |     if (values.length === 0) return null;
  566 |     const s = [...values].sort((a, b) => a - b);
  567 |     const mid = Math.floor(s.length / 2);
  568 |     return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  569 | }
  570 | 
  571 | /** Centile par rang (nearest-rank) : p95 de 10 valeurs = la plus grande. */
  572 | export function percentile(values: number[], p: number): number | null {
  573 |     if (values.length === 0) return null;
  574 |     const s = [...values].sort((a, b) => a - b);
  575 |     const rank = Math.max(1, Math.ceil((p / 100) * s.length));
  576 |     return s[rank - 1];
  577 | }
  578 | 
  579 | export function fmtMs(v: number | null): string {
  580 |     return v === null ? '—' : String(Math.round(v));
  581 | }
  582 | 
  583 | /** Écrit un TSV dans .e2e-captures/perf/ (remplace le fichier). */
  584 | export function writePerfFile(name: string, content: string): string {
  585 |     fs.mkdirSync(PERF_DIR, { recursive: true });
  586 |     const file = path.join(PERF_DIR, name);
  587 |     fs.writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
  588 |     return file;
  589 | }
  590 | 
  591 | /** Ajoute des lignes à un fichier de .e2e-captures/perf/ ; l'en-tête n'est écrit qu'à la création. */
  592 | export function appendPerfFile(name: string, header: string | null, lines: string[]): string {
  593 |     fs.mkdirSync(PERF_DIR, { recursive: true });
  594 |     const file = path.join(PERF_DIR, name);
  595 |     const prefix = !fs.existsSync(file) && header ? `${header}\n` : '';
  596 |     fs.appendFileSync(file, `${prefix}${lines.join('\n')}\n`, 'utf8');
  597 |     return file;
  598 | }
  599 | 
```