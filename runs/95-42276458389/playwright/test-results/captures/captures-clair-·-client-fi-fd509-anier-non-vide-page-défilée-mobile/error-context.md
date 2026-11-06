# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> fiche-barre-achat — Fiche d’un événement — barre d’achat fixe, panier non vide, page défilée
- Location: e2e/captures.spec.ts:159:9

# Error details

```
Error: gauche de la barre au bord de l'écran — fiche de « ce soir », haut de page : {"scrollY":0,"scrollMax":2351,"top":2953.625,"bottom":3026.625,"left":16,"right":374,"innerWidth":390,"innerHeight":844,"navHeight":53}

expect(received).toBeLessThanOrEqual(expected)

Expected: <= 2
Received:    16
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - banner [ref=e4]:
        - generic [ref=e5]:
          - button "Ouvrir le menu" [ref=e6] [cursor=pointer]
          - link "Event Village, accueil" [ref=e10] [cursor=pointer]:
            - /url: /
        - generic [ref=e16]:
          - button "Notifications, 8 non lues" [ref=e18] [cursor=pointer]:
            - generic [ref=e22]: "8"
          - button "Basculer le thème" [ref=e24] [cursor=pointer]
          - link "Mon profil (Fatou Mbaye)" [ref=e28] [cursor=pointer]:
            - /url: /profile
            - generic [aria-hidden] [ref=e29]: FM
      - main [ref=e31]:
        - generic [ref=e33]:
          - generic [ref=e34]:
            - link "Retour aux événements" [ref=e35] [cursor=pointer]:
              - /url: /explore
            - generic [ref=e40]:
              - status [ref=e41]: En direct
              - button "Partager l’événement" [ref=e43] [cursor=pointer]
          - generic [ref=e51]:
            - generic [ref=e52]:
              - img "Affiche de l’événement Nuit du Sabar — édition d’automne" [ref=e54]
              - generic [ref=e55]:
                - generic [ref=e56]: Concerts & Musique
                - heading "Nuit du Sabar — édition d’automne" [level=1] [ref=e59]
                - paragraph [ref=e60]: Organisé par Baobab Scène
              - generic [ref=e61]:
                - generic [ref=e66]:
                  - paragraph [ref=e67]: Date et heure
                  - generic [ref=e68]: Vendredi 6 novembre 2026 à 20:15
                - generic [ref=e74]:
                  - paragraph [ref=e75]: Lieu
                  - generic [ref=e76]: Esplanade de la Corniche Ouest, Dakar
              - generic [ref=e77]:
                - heading "À propos de l’événement" [level=2] [ref=e78]
                - paragraph [ref=e79]: Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.
              - generic [ref=e80]:
                - heading "Programme" [level=2] [ref=e81]
                - list [ref=e85]:
                  - listitem [ref=e86]:
                    - generic [ref=e88]:
                      - paragraph [ref=e89]: 19:30
                      - generic [ref=e90]: Activité
                    - paragraph [ref=e92]: Ouverture des portes
                  - listitem [ref=e93]:
                    - generic [ref=e95]:
                      - paragraph [ref=e96]: 20:30
                      - generic [ref=e97]: Artiste
                    - paragraph [ref=e99]: Première partie
                    - paragraph [ref=e100]: Troupe Kër Gëstu
                  - listitem [ref=e101]:
                    - generic [ref=e103]:
                      - paragraph [ref=e104]: 22:00
                      - generic [ref=e105]: Artiste
                    - paragraph [ref=e107]: Grand cercle de sabar
                    - paragraph [ref=e108]: Ensemble Ndawrabine des Parcelles
                  - listitem [ref=e109]:
                    - generic [ref=e111]:
                      - paragraph [ref=e112]: 23:30
                      - generic [ref=e113]: Activité
                    - paragraph [ref=e115]: Bœuf final avec le public
              - generic [ref=e116]:
                - heading "Lieu et accès" [level=2] [ref=e117]
                - generic [ref=e122]:
                  - paragraph [ref=e123]: Esplanade de la Corniche Ouest
                  - paragraph [ref=e124]: Esplanade de la Corniche Ouest, Dakar
                - link "Voir l’itinéraire" [ref=e127] [cursor=pointer]:
                  - /url: https://www.google.com/maps/dir/?api=1&destination=14.6833,-17.4676
                - generic [ref=e137]:
                  - generic [ref=e144]:
                    - paragraph [ref=e145]: Stationnement
                    - generic [ref=e146]: Stationnement surveillé à proximité.
                  - generic [ref=e152]:
                    - paragraph [ref=e153]: Règlement et consignes
                    - generic [ref=e154]: Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.
              - generic [ref=e157]:
                - paragraph [ref=e158]: Organisateur
                - heading "Baobab Scène" [level=2] [ref=e159]
            - complementary [ref=e160]:
              - generic [ref=e161]:
                - heading "Choisissez vos billets" [level=2] [ref=e162]
                - paragraph [ref=e163]: Places et disponibilités mises à jour en direct.
              - list [ref=e164]:
                - listitem [ref=e165]:
                  - generic [ref=e166]:
                    - generic [ref=e167]:
                      - heading "VIP" [level=3] [ref=e168]
                      - paragraph [ref=e169]: 15 000 F CFA
                      - paragraph [ref=e170]: Disponible
                      - paragraph [ref=e171]: Carré assis, entrée dédiée, une boisson offerte.
                    - group "Quantité VIP" [ref=e172]:
                      - button "Retirer un billet VIP" [disabled] [ref=e173]
                      - status [ref=e176]: "0"
                      - button "Ajouter un billet VIP" [ref=e177] [cursor=pointer]
                - listitem [ref=e180]:
                  - generic [ref=e181]:
                    - generic [ref=e182]:
                      - heading "Standard" [level=3] [ref=e183]
                      - paragraph [ref=e184]: 5 000 F CFA
                      - paragraph [ref=e185]: Disponible
                      - paragraph [ref=e186]: Accès à l’esplanade.
                    - group "Quantité Standard" [ref=e187]:
                      - button "Retirer un billet Standard" [ref=e188] [cursor=pointer]
                      - status [ref=e191]: "1"
                      - button "Ajouter un billet Standard" [active] [ref=e192] [cursor=pointer]
                  - paragraph [ref=e195]: "1 × 5 000 F CFA : 5 000 F CFA"
              - generic [ref=e196]:
                - generic [ref=e197]:
                  - generic [ref=e198]:
                    - term [ref=e199]: Billets
                    - definition [ref=e200]: 5 000 F CFA
                  - generic [ref=e201]:
                    - term [ref=e202]: Frais de service
                    - definition [ref=e203]: 250 F CFA
                - generic [ref=e204]:
                  - generic [ref=e205]: Total (1 billet)
                  - generic [ref=e206]: 5 250 F CFA
                - button "Acheter 1 billet (5 250 F CFA)" [ref=e207] [cursor=pointer]
                - paragraph [ref=e212]: Paiement Wave ou Orange Money. Frais de service calculés par Event Village sur chaque billet.
                - paragraph [ref=e213]: Billet avec QR code émis dès le paiement
          - button "Acheter (5 250 F CFA)" [ref=e218] [cursor=pointer]
    - navigation "Navigation rapide" [ref=e223]:
      - generic [ref=e224]:
        - link "Accueil" [ref=e225] [cursor=pointer]:
          - /url: /
        - link "Explorer" [ref=e230] [cursor=pointer]:
          - /url: /explore
        - link "Billets" [ref=e235] [cursor=pointer]:
          - /url: /tickets
        - link "Solde" [ref=e239] [cursor=pointer]:
          - /url: /wallet
  - alert [ref=e244]
```

# Test source

```ts
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
  499 |     if (out.status !== 200) throw new Error(`live-code du billet ${ticketId} : HTTP ${out.status} ${out.text.slice(0, 200)}`);
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
> 554 |         expect(Math.abs(p.left), `gauche de la barre au bord de l'écran — ${seen}`).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
      |                                                                                     ^ Error: gauche de la barre au bord de l'écran — fiche de « ce soir », haut de page : {"scrollY":0,"scrollMax":2351,"top":2953.625,"bottom":3026.625,"left":16,"right":374,"innerWidth":390,"innerHeight":844,"navHeight":53}
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