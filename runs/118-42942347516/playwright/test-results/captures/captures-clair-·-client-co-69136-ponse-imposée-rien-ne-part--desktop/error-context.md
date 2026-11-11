# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · client >> confirmation-mot-de-passe — Mes billets — transfert : boîte « mot de passe » avant l’envoi (réponse imposée, rien ne part)
- Location: e2e/captures.spec.ts:174:9

# Error details

```
Error: boîte « mot de passe » ouverte par PASSWORD_CONFIRMATION_REQUIRED (R57)

expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: /mot de passe/i }).or(getByRole('alertdialog', { name: /mot de passe/i }))
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - boîte « mot de passe » ouverte par PASSWORD_CONFIRMATION_REQUIRED (R57) getByRole('dialog', { name: /mot de passe/i }).or(getByRole('alertdialog', { name: /mot de passe/i })) with timeout 15000ms
  - waiting for getByRole('dialog', { name: /mot de passe/i }).or(getByRole('alertdialog', { name: /mot de passe/i }))

```

```yaml
- complementary:
  - link "Event Village, accueil":
    - /url: /
    - text: EVENT VILLAGE
  - navigation "Navigation principale":
    - paragraph: Menu principal
    - link "Accueil":
      - /url: /
      - img
      - text: Accueil
    - link "Explorer":
      - /url: /explore
      - img
      - text: Explorer
    - link "Mes billets":
      - /url: /tickets
      - img
      - text: Mes billets
    - link "Portefeuille":
      - /url: /wallet
      - img
      - text: Portefeuille
    - paragraph: Espaces métier
    - link "Devenir partenaire":
      - /url: /partner/register
      - img
      - text: Devenir partenaire
  - link "Fatou Mbaye Client":
    - /url: /profile
  - button "Se déconnecter"
  - button "Basculer le thème"
- banner:
  - link "Rechercher un événement, un concert, un restaurant…":
    - /url: /explore
  - button "Notifications, 8 non lues": "8"
- main:
  - status: En direct
  - heading "Mes billets" [level=1]
  - paragraph: "Présentez le QR code de votre billet à l’entrée. Il se renouvelle tout seul : gardez la page ouverte."
  - link "Afficher mes billets hors ligne":
    - /url: /billet/hors-ligne
  - button "Comment marche le transfert ?"
  - link "Réserver un billet":
    - /url: /explore
  - tablist "Filtrer mes billets":
    - tab "À venir" [selected]
    - tab "Tous mes billets"
    - tab "Historique"
    - tab "Reçus , 1"
  - tabpanel "À venir":
    - list:
      - listitem:
        - article "Billet pour Concert des Lumières de Gorée":
          - text: Valable
          - heading "Concert des Lumières de Gorée" [level=2]
          - paragraph: Baobab Scène
          - term: Date
          - definition: 11 NOV 2026
          - term: Heure d’accès
          - definition: 22:15
          - term: Lieu
          - definition: Place du Gouvernement
          - term: Catégorie
          - definition: Entrée
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261111-6154F500B6"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 6 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - status: Ouvrez ce billet avec du réseau avant d’arriver
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
      - listitem:
        - article "Billet pour Festival Jazz sur le Fleuve":
          - text: Valable
          - heading "Festival Jazz sur le Fleuve" [level=2]
          - paragraph: Baobab Scène
          - term: Date
          - definition: 23 NOV 2026
          - term: Heure d’accès
          - definition: 18:00
          - term: Lieu
          - definition: Quai des Pêcheurs
          - term: Catégorie
          - definition: Pass soirée
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261111-6DD17B3A77"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 6 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - status: Disponible hors ligne à partir du dim. 22 nov. 2026 à 18:00
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
      - listitem:
        - article "Billet pour Nuit du Sabar — édition d’automne":
          - text: Valable
          - heading "Nuit du Sabar — édition d’automne" [level=2]
          - paragraph: Baobab Scène
          - term: Date
          - definition: 11 NOV 2026
          - term: Heure d’accès
          - definition: 03:00
          - term: Lieu
          - definition: Esplanade de la Corniche Ouest
          - term: Catégorie
          - definition: Standard
          - img "QR d’entrée dynamique"
          - paragraph: "Numéro du billet : TCK-20261111-FBE1990558"
          - text: Code renouvelé toutes les 20 s Nouveau code dans 6 secondes
          - paragraph: Une capture d’écran n’est pas acceptée au contrôle.
          - paragraph: "Sans téléphone : numéro du billet et pièce d’identité au contrôle."
          - status: Ouvrez ce billet avec du réseau avant d’arriver
          - paragraph: Billet authentique, émis par Event Village
          - paragraph: Présentez ce code au contrôle, billet ouvert dans l’application.
          - button "Transférer"
          - button "Partager le lien de l’événement sur WhatsApp": WhatsApp
          - button "Partager ou copier le lien de l’événement": Lien
          - button "Télécharger le billet en PDF": PDF
          - button "Aide au transfert"
- alert
- dialog "Transférer ce billet":
  - heading "Transférer ce billet" [level=2]
  - paragraph: Billet TCK-20261111-6154F500B6 · Entrée
  - button "Fermer"
  - paragraph: Concert des Lumières de Gorée
  - paragraph: 11 NOV 2026 à 22:15
  - paragraph: Place du Gouvernement
  - paragraph: Transfert gratuit
  - text: Numéro de téléphone du destinataire (obligatoire)
  - textbox "Numéro de téléphone du destinataire (obligatoire)":
    - /placeholder: 77 123 45 67
    - text: "771234567"
  - paragraph: Le destinataire recevra un SMS. Il devra se connecter avec ce numéro pour accepter le billet sous 48 h.
  - alert:
    - paragraph: Transfert impossible
    - text: Par sécurité, saisissez votre mot de passe pour continuer.
  - paragraph: Ce qui se passe ensuite
  - list:
    - listitem: Dès l’acceptation, un nouveau QR code est créé pour votre proche ; le vôtre ne sert plus.
    - listitem: Sans acceptation sous 48 h, le billet vous revient automatiquement.
    - listitem: Vous pouvez annuler le transfert tant qu’il n’est pas accepté.
  - button "Comment fonctionne le transfert ?"
  - button "Annuler"
  - button "Envoyer le billet"
```

# Test source

```ts
  1086 |         },
  1087 |     },
  1088 |     {
  1089 |         id: 'accueil-ville', titre: 'Accueil — Près de chez vous, ville gardée sur l’appareil', role: 'anonyme', needsIds: false, path: () => '/',
  1090 |         initStorage: { 'ev-city': 'DAKAR' },
  1091 |         ready: async ({ page }) => {
  1092 |             await expect(nearbySection(page).getByRole('combobox'), 'ville du visiteur relue sur l’appareil').toHaveValue('DAKAR', { timeout: 30_000 });
  1093 |             await revealCenter(nearbySection(page).getByRole('combobox'));
  1094 |         },
  1095 |     },
  1096 |     {
  1097 |         id: 'accueil-populaires-erreur', titre: 'Accueil — Populaires, état d’erreur (Réessayer)', role: 'anonyme', needsIds: false, path: () => '/',
  1098 |         injectError: /\/api\/events\/popular/,
  1099 |         injectErrorMessage: 'Populaires momentanément indisponibles.',
  1100 |         // Section sous « À l'affiche » : hors de l'image sans défilement
  1101 |         ready: async (c) => {
  1102 |             await expectRetry(c);
  1103 |             await revealCenter(c.page.getByRole('button', { name: /réessayer/i }));
  1104 |         },
  1105 |     },
  1106 |     // ── Lot 9 bis : versements, droits, transferts, email (contrat 7.3, T9) ──
  1107 |     // Rouges jusqu'à leurs écrans (vague E) et aux données du seed (fix(9b.seed)) ; aucune boîte n'est confirmée.
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
> 1186 |             await expect(confirm, 'boîte « mot de passe » ouverte par PASSWORD_CONFIRMATION_REQUIRED (R57)').toBeVisible();
       |                                                                                                              ^ Error: boîte « mot de passe » ouverte par PASSWORD_CONFIRMATION_REQUIRED (R57)
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
  1208 |             await page.getByRole('button', { name: /^refuser/i }).filter({ visible: true }).first().click();
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