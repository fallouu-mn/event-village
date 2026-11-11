# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: captures.spec.ts >> sombre · client >> profil-email-non-verifie — Profil du client — adresse email en attente de vérification (Renvoyer le lien)
- Location: e2e/captures.spec.ts:174:9

# Error details

```
Error: adresse en attente du client du seed (email_pending, R87)

expect(locator).toBeVisible() failed

Locator: getByText('Email non vérifié', { exact: true }).first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - adresse en attente du client du seed (email_pending, R87) getByText('Email non vérifié', { exact: true }).first() with timeout 15000ms
  - waiting for getByText('Email non vérifié', { exact: true }).first()

```

```yaml
- banner:
  - button "Ouvrir le menu"
  - link "Event Village, accueil":
    - /url: /
  - button "Notifications, 8 non lues": "8"
  - button "Basculer le thème" [pressed]
  - link "Mon profil (Fatou Mbaye)":
    - /url: /profile
- main:
  - heading "Mon profil" [level=1]
  - paragraph: Vos coordonnées, l’affichage de l’application, vos notifications et vos accès.
  - region "Fatou Mbaye":
    - button "Choisir une photo"
    - paragraph: JPEG, PNG ou WebP, 2 Mo au plus.
    - heading "Fatou Mbaye" [level=2]
    - term: Téléphone
    - definition: +221 70 000 01 05
    - term: Email
    - definition: fatou.mbaye@demo.eventvillage.local
    - term: "Rôle :"
    - definition: Client
    - term: Statut du compte
    - definition: Compte actif
  - region "Mes informations":
    - heading "Mes informations" [level=2]
    - text: Prénom
    - textbox "Prénom": Fatou
    - text: Nom
    - textbox "Nom": Mbaye
    - text: Adresse email
    - textbox "Adresse email": fatou.mbaye@demo.eventvillage.local
    - paragraph: Facultative. Laissez ce champ vide si vous n’en avez pas.
    - button "Enregistrer le profil"
    - paragraph: Numéro de téléphone
    - paragraph: Un code envoyé au nouveau numéro confirme le changement.
    - button "Changer de numéro"
  - region "Réglages et espaces":
    - heading "Réglages et espaces" [level=2]
    - list:
      - listitem:
        - link "Préférences de notification Rappels, changements d’événement, SMS et notifications push sur cet appareil":
          - /url: /profile/notifications
      - listitem:
        - link "Mes paiements L’historique de vos paiements et de vos remboursements":
          - /url: /profile/payments
      - listitem:
        - link "Portefeuille et parrainage Vos gains de parrainage et vos demandes de retrait":
          - /url: /wallet
  - region "Affichage":
    - heading "Affichage" [level=2]
    - group "Thème de l’application":
      - button "Clair"
      - button "Sombre" [pressed]
      - button "Système"
  - button "Se déconnecter"
- navigation "Navigation rapide":
  - link "Accueil":
    - /url: /
  - link "Explorer":
    - /url: /explore
  - link "Billets":
    - /url: /tickets
  - link "Solde":
    - /url: /wallet
- alert
```

# Test source

```ts
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
> 1154 |             await expect(page.getByText('Email non vérifié', { exact: true }).first(), 'adresse en attente du client du seed (email_pending, R87)').toBeVisible();
       |                                                                                                                                                     ^ Error: adresse en attente du client du seed (email_pending, R87)
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