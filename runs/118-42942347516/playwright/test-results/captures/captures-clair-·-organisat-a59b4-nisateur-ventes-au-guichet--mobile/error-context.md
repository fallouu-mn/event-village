# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> clair · organisateur >> pilotage-especes-a-rembourser — Événement annulé — espèces à rembourser par l’organisateur (ventes au guichet)
- Location: e2e/captures.spec.ts:174:9

# Error details

```
Error: section des ventes au guichet d’un événement annulé (R20)

expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /^espèces à rembourser par l[’']organisateur/i })
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - section des ventes au guichet d’un événement annulé (R20) getByRole('heading', { name: /^espèces à rembourser par l[’']organisateur/i }) with timeout 30000ms
  - waiting for getByRole('heading', { name: /^espèces à rembourser par l[’']organisateur/i })

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 97 non lues": "97"
  - button "Basculer le thème"
  - link "Mon profil (Mariama Ndiaye)":
    - /url: /profile
- main:
  - link "Mes événements":
    - /url: /partner/events
  - text: Annulé
  - heading "Croisière musicale vers Gorée" [level=1]
  - paragraph: dim. 29 nov. 2026 à 17:30 Embarcadère du port de Dakar, Dakar
  - region "Remboursements":
    - heading "Remboursements" [level=2]
    - paragraph: Avancement des remboursements des billets payés en ligne après l’annulation.
    - button "Actualiser l’avancement des remboursements"
    - paragraph: Versés
    - paragraph: 88 200 F CFA
    - paragraph: 5 remboursements
    - paragraph: En cours
    - paragraph: 28 350 F CFA
    - paragraph: 2 remboursements
    - paragraph: En vérification
    - paragraph: 40 950 F CFA
    - paragraph: "2 remboursements : issue à confirmer auprès de l’opérateur"
  - tablist "Rubriques du pilotage":
    - tab "Aperçu" [selected]
    - tab "Ventes"
    - tab "Invitations"
    - tab "Entrées"
    - tab "Équipe"
    - tab "Caisse"
    - tab "Clôture"
  - tabpanel "Aperçu":
    - region "Billetterie":
      - heading "Billetterie" [level=2]
      - paragraph: Billets valides et utilisés, hors invitations.
      - paragraph: Billets vendus
      - paragraph: "0"
      - paragraph: Toutes catégories, y compris désactivées
      - paragraph: Vente
      - paragraph: Arrêtée
      - paragraph: "Événement annulé : aucune place n’est plus proposée"
      - paragraph: Invitations
      - paragraph: "0"
      - paragraph: Places offertes, comptées à part
    - region "Contrôle d’accès":
      - heading "Contrôle d’accès" [level=2]
      - paragraph: Passages validés au scan et au guichet.
      - paragraph: Entrées
      - paragraph: "0"
      - paragraph: dont 0 au guichet
      - paragraph: Taux de présence
      - paragraph: —
      - paragraph: Part des participants attendus (ventes et invitations) déjà passés
    - region "Recettes":
      - heading "Recettes" [level=2]
      - paragraph: Montants des billets, remboursements déduits pour les ventes en ligne.
      - paragraph: En ligne
      - paragraph: 0 F CFA
      - paragraph: Paiements mobiles confirmés
      - paragraph: En espèces
      - paragraph: 0 F CFA
      - paragraph: Encaissées par vos contrôleurs
      - paragraph: Remboursé
      - paragraph: 150 000 F CFA
      - paragraph: Remboursements en ligne
    - paragraph:
      - text: Chiffres calculés le
      - time: mer. 11 nov. 2026 à 02:19
      - text: .
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /partner/dashboard
  - link "Billetterie":
    - /url: /partner/events
  - link "Scanner":
    - /url: /partner/scan
  - link "Finances":
    - /url: /partner/finance
  - link "Profil":
    - /url: /partner/profile
- alert
```

# Test source

```ts
  1028 |     {
  1029 |         id: 'controleur-profil', titre: 'Profil du contrôleur (événements assignés, mot de passe)', role: 'controleur', needsIds: true, path: () => '/controller/profile', views: DARK_VIEWS,
  1030 |         ready: async ({ page }) => { await expectHeading(page, /^mon profil$/i); },
  1031 |     },
  1032 |     {
  1033 |         id: 'admin-campagnes', titre: 'Administration — campagnes de communication', role: 'admin', needsIds: true, path: () => '/admin/communications',
  1034 |         ready: async ({ page }) => { await expectHeading(page, /^campagnes de communication$/i); },
  1035 |     },
  1036 |     {
  1037 |         id: 'aide-transfert', titre: 'Mes billets — aide « Comment marche le transfert ? »', role: 'client', needsIds: true, path: () => '/tickets',
  1038 |         actions: async ({ page }) => {
  1039 |             await page.getByRole('button', { name: /^comment marche le transfert/i }).click();
  1040 |             await expect(page.getByRole('dialog')).toBeVisible();
  1041 |         },
  1042 |         masks: (page) => [page.getByRole('img', { name: /QR/i })],
  1043 |     },
  1044 |     { id: 'portefeuille', titre: 'Portefeuille du client (solde, parrainage)', role: 'client', needsIds: true, path: () => '/wallet', ready: async ({ page }) => expectPageTitle(page) },
  1045 |     // ── Lot 9 : invitations, découverte, compte (contrat section 7) ─────────
  1046 |     {
  1047 |         id: 'invitations-onglet', titre: 'Pilotage — Invitations (catégorie, numéros, liste)', role: 'organisateur', needsIds: true,
  1048 |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}?tab=invitations`,
  1049 |         ready: async ({ page }) => invitationsReady(page),
  1050 |     },
  1051 |     {
  1052 |         id: 'invitations-confirmation', titre: 'Pilotage — Invitations : confirmation de l’envoi', role: 'organisateur', needsIds: true,
  1053 |         path: (i) => `/partner/events/${ids(i).events.ceSoir.id}?tab=invitations`,
  1054 |         ready: async ({ page }) => invitationsReady(page),
  1055 |         actions: async ({ page }) => {
  1056 |             const category = page.getByRole('tabpanel').getByLabel(/^catégorie/i);
  1057 |             const value = await category.locator('option:not([value=""]):not([disabled])').first().getAttribute('value');
  1058 |             if (!value) throw new Error('[e2e] aucune catégorie proposée dans le champ Catégorie des invitations');
  1059 |             await category.selectOption(value);
  1060 |             await page.getByLabel(/^numéros de téléphone/i).fill('771234567');
  1061 |             await page.getByRole('button', { name: /^envoyer les invitations$/i }).click();
  1062 |             await expect(page.getByRole('alertdialog', { name: /^confirmer l.envoi/i })).toBeVisible();
  1063 |         },
  1064 |     },
  1065 |     {
  1066 |         id: 'mes-paiements', titre: 'Mes paiements (date, événement, montant, opérateur, statut, totaux)', role: 'client', needsIds: true,
  1067 |         path: () => '/profile/payments', expectStatus: 200,
  1068 |         ready: async ({ page }) => {
  1069 |             await expectHeading(page, /^mes paiements$/i);
  1070 |             await expect(page.locator('a[href^="/paiement/"]').first()).toBeVisible();
  1071 |         },
  1072 |     },
  1073 |     {
  1074 |         id: 'profil', titre: 'Profil du client (identité, photo, numéro)', role: 'client', needsIds: true, path: () => '/profile',
  1075 |         ready: async ({ page }) => {
  1076 |             await expect(page.getByRole('button', { name: /^enregistrer le profil$/i })).toBeVisible();
  1077 |             await expect(page.getByRole('button', { name: /^changer de numéro$/i })).toBeVisible();
  1078 |             await expect(page.getByRole('button', { name: /^choisir une photo$/i })).toBeVisible();
  1079 |         },
  1080 |     },
  1081 |     {
  1082 |         id: 'changement-numero', titre: 'Profil du client — changement de numéro (boîte ouverte)', role: 'client', needsIds: true, path: () => '/profile',
  1083 |         actions: async ({ page }) => {
  1084 |             await page.getByRole('button', { name: /^changer de numéro$/i }).click();
  1085 |             await expect(page.getByRole('dialog')).toBeVisible();
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
> 1128 |             await expect(heading, 'section des ventes au guichet d’un événement annulé (R20)').toBeVisible({ timeout: 30_000 });
       |                                                                                                ^ Error: section des ventes au guichet d’un événement annulé (R20)
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
```