# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> mes-billets-recus-refuser — Mes billets — Reçus : confirmation « Refuser » d’un transfert entrant
- Location: e2e/captures.spec.ts:174:9

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /^refuser/i }).visible().first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Event Village, accueil" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e11]:
          - generic [ref=e12]: EVENT
          - generic [ref=e13]: VILLAGE
      - navigation "Navigation principale" [ref=e14]:
        - generic [ref=e15]:
          - paragraph [ref=e16]: Menu principal
          - generic [ref=e17]:
            - link "Accueil" [ref=e18] [cursor=pointer]:
              - /url: /
            - link "Explorer" [ref=e23] [cursor=pointer]:
              - /url: /explore
            - link "Mes billets" [ref=e28] [cursor=pointer]:
              - /url: /tickets
            - link "Portefeuille" [ref=e32] [cursor=pointer]:
              - /url: /wallet
        - generic [ref=e37]:
          - paragraph [ref=e38]: Espaces métier
          - link "Devenir partenaire" [ref=e40] [cursor=pointer]:
            - /url: /partner/register
      - generic [ref=e46]:
        - link "Fatou Mbaye Client" [ref=e47] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=e48]: FM
          - generic [ref=e49]:
            - generic [ref=e50]: Fatou Mbaye
            - generic [ref=e51]: Client
        - generic [ref=e52]:
          - button "Se déconnecter" [ref=e53] [cursor=pointer]
          - button "Basculer le thème" [pressed] [ref=e58] [cursor=pointer]
    - generic [ref=e66]:
      - banner [ref=e67]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=e69] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 8 non lues" [ref=e76] [cursor=pointer]:
          - generic [ref=e80]: "8"
      - main [ref=e81]:
        - generic [ref=e83]:
          - generic [ref=e85]:
            - generic [ref=e86]:
              - status [ref=e88]: En direct
              - heading "Mes billets" [level=1] [ref=e90]
              - paragraph [ref=e91]: "Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la page ouverte."
            - generic [ref=e92]:
              - link "Afficher mes billets hors ligne" [ref=e93] [cursor=pointer]:
                - /url: /billet/hors-ligne
              - button "Comment marche le transfert ?" [ref=e101] [cursor=pointer]
              - link "Réserver un billet" [ref=e107] [cursor=pointer]:
                - /url: /explore
          - tablist "Filtrer mes billets" [ref=e114]:
            - tab "À venir" [ref=e115] [cursor=pointer]
            - tab "Tous mes billets" [ref=e117] [cursor=pointer]
            - tab "Historique" [ref=e119] [cursor=pointer]
            - tab "Reçus , 1" [selected] [ref=e121] [cursor=pointer]:
              - generic [ref=e122]: Reçus
              - generic [ref=e123]:
                - generic [ref=e124]: ","
                - text: "1"
          - tabpanel "Reçus , 1" [ref=e125]:
            - list [ref=e127]:
              - listitem [ref=e128]:
                - article [ref=e129]:
                  - generic [ref=e134]:
                    - heading "Festival Jazz sur le Fleuve" [level=3] [ref=e135]
                    - paragraph [ref=e136]: Envoyé par Marième N.
                  - generic [ref=e140]:
                    - generic [ref=e141]:
                      - term [ref=e142]: Date
                      - definition [ref=e143]:
                        - generic [ref=e148]: lun. 23 nov. 2026 à 18:00
                    - generic [ref=e149]:
                      - term [ref=e150]: Lieu
                      - definition [ref=e151]:
                        - generic [ref=e155]: Quai des Pêcheurs, Saint-Louis
                    - generic [ref=e156]:
                      - term [ref=e157]: Billet
                      - definition [ref=e158]:
                        - generic [ref=e161]: Pass soirée · 7 500 F CFA
                    - generic [ref=e162]:
                      - term [ref=e163]: Délai
                      - definition [ref=e164]:
                        - generic [ref=e168]: À accepter avant le ven. 13 nov. 2026 à 02:15
                  - button "Accepter le billet" [ref=e169] [cursor=pointer]
  - alert [ref=e176]
```

# Test source

```ts
  1108 |     {
  1109 |         id: 'admin-versements-marquer-verse', titre: 'Administration — versements à reprendre : boîte « Marquer versé » (justification, référence ; réponses imposées)',
  1110 |         role: 'fumee-superadmin', needsIds: false, path: () => '/admin/finance',
  1111 |         stubResponses: CASHOUTS_STUBS,
  1112 |         ready: async ({ page }) => { await cashoutsReady(page); },
  1113 |         actions: async ({ page }) => {
  1114 |             // Ligne incertaine sans identifiant SamirPay : « Marquer versé » seul, avec la référence (B2)
  1115 |             const row = page.locator('tr, li, article').filter({ hasText: 'Festival Jazz sur le Fleuve' });
  1116 |             await row.getByRole('button', { name: /^marquer versé/i }).filter({ visible: true }).first().click();
  1117 |             const dialog = anyDialog(page, /marquer/i);
  1118 |             await expect(dialog).toBeVisible();
  1119 |             await expect(dialog.getByLabel(/justification/i), 'justification obligatoire (contrat 5.1)').toBeVisible();
  1120 |             await expect(dialog.getByLabel(/référence/i), 'référence SamirPay du versement (contrat 4.1, REFERENCE_REQUIRED)').toBeVisible();
  1121 |         },
  1122 |     },
  1123 |     {
  1124 |         id: 'pilotage-especes-a-rembourser', titre: 'Événement annulé — espèces à rembourser par l’organisateur (ventes au guichet)', role: 'organisateur', needsIds: true,
  1125 |         path: pilotage('annule'),
  1126 |         ready: async ({ page }) => {
  1127 |             const heading = page.getByRole('heading', { name: /^espèces à rembourser par l[’']organisateur/i });
  1128 |             await expect(heading, 'section des ventes au guichet d’un événement annulé (R20)').toBeVisible({ timeout: 30_000 });
  1129 |             await expect(page.getByRole('checkbox', { name: /remboursé/i }).first(), 'case « Remboursé » d’une vente au guichet du seed').toBeVisible();
  1130 |             await revealCenter(heading);
  1131 |         },
  1132 |     },
  1133 |     {
  1134 |         id: 'admin-fiche-partenaire-suspendre', titre: 'Administration — fiche d’un partenaire validé : boîte « Suspendre » (motif)', role: 'fumee-superadmin', needsIds: true,
  1135 |         path: (i) => `/admin/dashboard?partenaires=ALL&dossier=${encodeURIComponent(partnerIdOf(i, 'organisateur'))}`,
  1136 |         ready: async ({ page }) => {
  1137 |             await expect(page.getByRole('dialog', { name: /^dossier du partenaire/i }), 'fiche ouverte par le lien profond ?dossier= (R6)').toBeVisible({ timeout: 30_000 });
  1138 |         },
  1139 |         actions: async ({ page }) => {
  1140 |             const dossier = page.getByRole('dialog', { name: /^dossier du partenaire/i });
  1141 |             // Partenaire VALIDE : « Valider » et « Refuser » réservés à un dossier en attente, « Réactiver » à un suspendu (5.15)
  1142 |             await expect(dossier.getByRole('button', { name: /^valider/i }), '« Valider » sur un partenaire validé').toHaveCount(0);
  1143 |             await expect(dossier.getByRole('button', { name: /^refuser/i }), '« Refuser » sur un partenaire validé').toHaveCount(0);
  1144 |             await expect(dossier.getByRole('button', { name: /^réactiver/i }), '« Réactiver » sur un partenaire validé').toHaveCount(0);
  1145 |             await dossier.getByRole('button', { name: /^suspendre/i }).click();
  1146 |             const box = anyDialog(page, /^suspendre/i);
  1147 |             await expect(box).toBeVisible();
  1148 |             await expect(box.getByLabel(/^motif/i), 'motif obligatoire de la suspension (R55)').toBeVisible();
  1149 |         },
  1150 |     },
  1151 |     {
  1152 |         id: 'profil-email-non-verifie', titre: 'Profil du client — adresse email en attente de vérification (Renvoyer le lien)', role: 'client', needsIds: true, path: () => '/profile',
  1153 |         ready: async ({ page }) => {
  1154 |             await expect(page.getByText('Email non vérifié', { exact: true }).first(), 'adresse en attente du client du seed (email_pending, R87)').toBeVisible();
  1155 |             const resend = page.getByRole('button', { name: /^renvoyer le lien$/i });
  1156 |             await expect(resend).toBeVisible();
  1157 |             await revealCenter(resend);
  1158 |         },
  1159 |     },
  1160 |     {
  1161 |         id: 'profil-mot-de-passe', titre: 'Profil du client — « Changer de mot de passe » ouvert (trois champs, règle)', role: 'client', needsIds: true, path: () => '/profile',
  1162 |         ready: async ({ page }) => {
  1163 |             await expect(page.getByText('Les autres appareils seront déconnectés.', { exact: true }), 'bloc « Mot de passe » du profil (5.42)').toBeVisible();
  1164 |         },
  1165 |         actions: async ({ page }) => {
  1166 |             await page.getByRole('button', { name: /^changer de mot de passe$/i }).click();
  1167 |             const dialog = anyDialog(page, /mot de passe/i);
  1168 |             await expect(dialog).toBeVisible();
  1169 |             await expect(dialog.locator('input[type="password"]'), 'mot de passe actuel, nouveau et confirmation (R85)').toHaveCount(3);
  1170 |             await expect(dialog.getByText(PASSWORD_RULES_HELP, { exact: true })).toBeVisible();
  1171 |         },
  1172 |     },
  1173 |     {
  1174 |         id: 'confirmation-mot-de-passe', titre: 'Mes billets — transfert : boîte « mot de passe » avant l’envoi (réponse imposée, rien ne part)', role: 'client', needsIds: true,
  1175 |         path: () => '/tickets',
  1176 |         // Le transfert ne part jamais au serveur : réponse 403 du contrat 4.2 imposée (le seed reste intact)
  1177 |         stubResponses: [{ url: TRANSFER_URL, method: 'POST', status: 403, body: PASSWORD_CONFIRMATION_REQUIRED }],
  1178 |         allowFailures: [TRANSFER_URL],
  1179 |         actions: async ({ page }) => {
  1180 |             await page.getByRole('button', { name: /^transférer$/i }).filter({ visible: true }).first().click();
  1181 |             const transfer = page.getByRole('dialog', { name: /^transférer ce billet$/i });
  1182 |             await expect(transfer).toBeVisible();
  1183 |             await transfer.getByLabel(/^numéro de téléphone du destinataire/i).fill('771234567');
  1184 |             await transfer.getByRole('button', { name: /^envoyer le billet$/i }).click();
  1185 |             const confirm = anyDialog(page, /mot de passe/i);
  1186 |             await expect(confirm, 'boîte « mot de passe » ouverte par PASSWORD_CONFIRMATION_REQUIRED (R57)').toBeVisible();
  1187 |             await expect(confirm.locator('input[type="password"]'), 'un seul champ : le mot de passe du compte').toHaveCount(1);
  1188 |         },
  1189 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1190 |     },
  1191 |     {
  1192 |         id: 'invitation-controleur', titre: 'Invitations — invitation de contrôleur en attente (Accepter, Refuser)', role: 'client', needsIds: true,
  1193 |         path: () => '/invitations', expectStatus: 200,
  1194 |         ready: async ({ page }) => {
  1195 |             await expectPageTitle(page);
  1196 |             await expect(page.getByRole('button', { name: /^accepter/i }).first(), 'invitation en attente du seed (R37)').toBeVisible();
  1197 |             await expect(page.getByRole('button', { name: /^refuser/i }).first()).toBeVisible();
  1198 |         },
  1199 |     },
  1200 |     {
  1201 |         id: 'mes-billets-recus-refuser', titre: 'Mes billets — Reçus : confirmation « Refuser » d’un transfert entrant', role: 'client', needsIds: true,
  1202 |         path: () => '/tickets?tab=recus',
  1203 |         ready: async ({ page }) => {
  1204 |             await expect(page.getByRole('tab', { name: /^reçus/i })).toHaveAttribute('aria-selected', 'true');
  1205 |             await expect(page.getByRole('button', { name: /^accepter le billet$/i }).first()).toBeVisible();
  1206 |         },
  1207 |         actions: async ({ page }) => {
> 1208 |             await page.getByRole('button', { name: /^refuser/i }).filter({ visible: true }).first().click();
       |                                                                                                     ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  1209 |             const confirm = anyDialog(page);
  1210 |             await expect(confirm, 'confirmation du refus (R46)').toBeVisible();
  1211 |             await expect(confirm.getByRole('button', { name: /^refuser/i })).toBeVisible();
  1212 |         },
  1213 |     },
  1214 |     withExtraActions(
  1215 |         scanResultScreen('scanner-transfert-en-cours', 'Scanner — billet en cours de transfert (plein écran « Transfert en cours »)', {
  1216 |             result: 'transfer_pending', scan_id: 'c6e1f2a3-b4c5-4d6e-8f70-81a2b3c4d5e6', ticket: SCAN_TICKET,
  1217 |         }),
  1218 |         async ({ page }) => {
  1219 |             await expect(page.locator('[data-scan-state="result"]').getByText(/^transfert en cours/i).first(), 'libellé du résultat transfer_pending (R19)').toBeVisible();
  1220 |         },
  1221 |     ),
  1222 |     {
  1223 |         id: 'verification-email', titre: 'Vérification d’une adresse email — « Confirmer mon adresse » (rien n’est validé au chargement)', role: 'anonyme', needsIds: false,
  1224 |         path: () => `/verify-email?t=${VERIFY_EMAIL_TOKEN}`, expectStatus: 200,
  1225 |         ready: async ({ page }) => {
  1226 |             await expectHeading(page, /^vérifier mon adresse email$/i);
  1227 |             await expect(page.getByRole('button', { name: /^confirmer mon adresse$/i })).toBeVisible();
  1228 |         },
  1229 |         actions: async ({ page }) => {
  1230 |             await expect.poll(() => new URL(page.url()).searchParams.has('t'), { message: 'jeton effacé de l’adresse (history.replaceState, contrat 4.6)' }).toBe(false);
  1231 |             const referrers = await page.evaluate(() => Array.from(document.querySelectorAll('meta[name="referrer"]'), (m) => m.getAttribute('content')));
  1232 |             expect(referrers, 'politique de référent de la page (contrat 4.6)').toEqual(['no-referrer']);
  1233 |             expect(await requestsTo(page, VERIFY_EMAIL_API), `aucun appel à ${VERIFY_EMAIL_API} au chargement (contrat 4.6)`).toBe(0);
  1234 |         },
  1235 |     },
  1236 | ];
  1237 | 
```