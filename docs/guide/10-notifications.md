# 10 — Notifications : le catalogue complet des messages et les règles d'envoi

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Chaque fait porte sa preuve `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`).
> Ce qui n'a pas pu être établi est marqué **NON VÉRIFIÉ**. Aucune commande n'a été lancée contre un projet distant.
> **Le catalogue de la section 10.12 est généré depuis le code**, pas écrit de mémoire : un script hors dépôt
> (`<scratchpad>/guide/w8/gen2.ts`, lancé par `npx tsx`) relit le registre `notification_types` dans toutes les migrations
> (dernière définition de chaque type), importe `lib/notifications/catalog.ts` pour rendre chaque canal, et mesure chaque SMS
> avec `smsSegments` de `lib/notifications/sms-format.ts`. Résultat du contrôle : **103 types au catalogue, 103 au registre,
> aucun écart** entre les deux (famille, sujet, canaux, destinataires, politique « compte suspendu », permission admin).
> Les autres fichiers du guide renvoient ici par le nom du type (`EVENT_CANCELLED`…). Les écarts relevés sont repris dans
> `15-constats.md` (W8-xx).

## Sommaire

| N° | Contenu |
|---|---|
| 10.0 | Comment lire ce fichier (canaux, familles, variables, caractères et segments) |
| 10.1 | Le circuit commun : boîte d'envoi, envoyeur chaque minute, tentatives, statuts |
| 10.2 | Les envois immédiats : codes, invitation d'un nouveau contrôleur, lien de vérification d'email (A3) |
| 10.3 | Heures calmes (22 h à 8 h) : un SMS optionnel la nuit est perdu, pas reporté |
| 10.4 | Plafonds et limites des SMS |
| 10.5 | Email : seulement vers une adresse vérifiée, et seulement si la clé d'envoi est présente |
| 10.6 | Push : seulement vers un appareil abonné, et seulement si le push est configuré |
| 10.7 | Comptes de démonstration |
| 10.8 | Compte suspendu, préférences par sujet |
| 10.9 | Supervision par l'administration (/admin/notifications), relance d'un échec |
| 10.10 | Liste : les messages reçus par un administrateur, et par quels canaux |
| 10.11 | Liste : les messages reçus par la partenaire à chaque vente |
| 10.12 | Catalogue complet des 103 types (tableau, puis une fiche par type) |
| 10.13 | Réponses aux questions de la recette (heures calmes, A3, A5) |

---

## 10.0 Comment lire ce fichier

- **Canaux.** « Cloche » = message dans l'application (icône cloche et page Notifications) ; « push » = notification du
  navigateur ou du téléphone ; « email » ; « SMS ». Libellés de la supervision : « Application », « SMS », « Email »,
  « Notification push » (`lib/notifications/outbox-labels.ts:35-40`).
- **Indispensable ou optionnel.** Un type indispensable ne se coupe pas ; un type optionnel appartient à un sujet que la
  personne peut couper canal par canal dans ses préférences (`lib/notifications/catalog-types.ts:43-44` ;
  `M/20261103000002_lot6_outbox.sql:57-68`). Trois sujets : « Rappels avant l’événement », « Suspension et reprise d’un
  événement », « Activité de vos ventes » (`app/api/notifications/preferences/route.ts:31-43`).
- **Variables.** Dans un modèle, `{titre}`, `{date}`, `{montant}`… sont remplacés à l'envoi. `{URL}` est l'adresse de
  l'application (variable `NEXT_PUBLIC_APP_URL`, `lib/notifications/catalog.ts:172` ; `lib/notifications/dispatcher.ts:178-180`).
  `{n} billets` devient « 1 billet » au singulier (`lib/notifications/catalog.ts:144`). Les exemples utilisent des données
  fictives : « Concert Test » au « Grand Théâtre », Dakar, samedi 14 novembre 2026 à 20:00, « Fatou Diop », « Fatou Diop
  Events », et l'adresse d'application fictive `https://app.eventvillage.sn` (27 caractères, la longueur retenue par le
  catalogue pour garantir un SMS d'un seul segment, `lib/notifications/catalog.ts:16-19`).
- **Dates et montants.** Heure de Dakar. Cloche, push, email : « sam. 14 nov. 2026 à 20:00 », « 10 100 F CFA » avec espace
  insécable. SMS : « sam. 14 nov. à 20:00 », « 10 100 F CFA » avec espace simple (`lib/notifications/sms-format.ts:10-13, 53-64`).
- **Caractères et segments d'un SMS.** Un SMS en alphabet GSM-7 tient en 160 caractères ; au-delà il est facturé en
  segments de 153. Un seul caractère hors de cet alphabet fait passer tout le message en UCS-2 (70, puis 67 par segment)
  (`lib/notifications/sms-format.ts:2-8, 73-85`). Le nombre de caractères donné ici est celui que compte
  `smsSegments` (un caractère de l'extension GSM-7 comme « { » ou « € » compte 2). Pour rester en GSM-7, chaque valeur
  saisie (titre, lieu, nom, motif) est translittérée (« ê » → « e », « ’ » → « ' »…), les émojis et autres écritures sont
  retirés, et la valeur est coupée à une longueur fixe avec « ... » (`lib/notifications/sms-format.ts:87-156`).
  Pour chaque SMS, la fiche donne la mesure de l'exemple et celle d'un **pire cas** (textes saisis de 200 caractères,
  montants à 7 chiffres, frais à 6, date la plus longue, 999 billets, 12 affectations).
- **Push.** Même titre et même texte que la cloche, texte coupé à 160 caractères avec « … »
  (`lib/notifications/catalog.ts:280-286, 316-321` ; `lib/notifications/dispatcher.ts:401`), sauf `PUSH_TEST`.
- **Email.** Sujet « {titre de la cloche} — Event Village », corps = titre et texte de la cloche, bouton « Ouvrir Event
  Village » vers le lien du type, pied « Message automatique d'Event Village, merci de ne pas y répondre. Support :
  {adresse du support} » ; pour un type optionnel seulement, pied « Ne plus recevoir ces emails : {URL}/profile/
  notifications?topic={SUJET} » et en-tête de désabonnement (`lib/notifications/catalog.ts:322-338` ;
  `lib/notifications/email-layout.ts:132-202`). Adresse du support : `support@eventvillage.sn` par défaut, remplaçable par
  la variable `SUPPORT_EMAIL` (`lib/support.ts:8-13`). Trois types ont un email propre, recopié en entier dans leur fiche :
  `PURCHASE_CONFIRMED`, `FREE_TICKETS_CONFIRMED`, `TRANSFER_RECEIVED`.

---

## 10.1 Le circuit commun : boîte d'envoi, envoyeur chaque minute, tentatives, statuts

1. **Qui, où.** Personne ne clique : chaque action métier (paiement confirmé, changement de statut d'un événement,
   versement…) écrit ses messages dans la **boîte d'envoi** (table `notification_outbox`), dans la même opération que
   l'action elle-même, par la fonction `notif_enqueue` (`M/20261109000010_lot9bis_email.sql:128-269`). Une ligne par canal
   et par destinataire ; la cloche et le push exigent un compte (`:209-211`).
2. **Ce qu'il saisit.** Rien.
3. **Ce que fait le système.**
   - **Envoyeur.** La tâche `ev_notifications_dispatch` appelle `/api/cron/notifications-dispatch` **chaque minute**
     (`supabase/ops/schedule-crons.sql:98` ; `app/api/cron/notifications-dispatch/route.ts:7-25`). À chaque passage : au plus
     10 tours de 100 lignes et 45 secondes (`lib/notifications/dispatcher.ts:165-168, 581-639`). Les lignes dues sont
     prises dans l'ordre cloche, push, email, SMS (`M/20261109000010_lot9bis_email.sql:383-395`) ; les canaux partent en
     parallèle, 5 envois à la fois par canal (`lib/notifications/dispatcher.ts:551-569`). **Délai normal : moins d'une
     minute** après l'action, sauf échéance volontaire : 2 minutes pour l'avis d'entrée (`TICKET_SCANNED`), 10 minutes pour
     le SMS et l'email d'un changement d'événement (`EVENT_CHANGED`, `CONTROLLER_EVENT_CHANGED`), heure prévue pour les
     rappels. Sans cette tâche, **aucun message de la boîte d'envoi ne part** (`12-taches-planifiees.md`, scénario 12.1).
   - **Revérification à l'envoi.** Au moment de partir, chaque ligne est revue : compte suspendu (politique du type),
     préférence coupée, événement plus d'actualité, porteur sans billet, plage de nuit, budget des SMS optionnels, email
     non vérifié (`M/20261109000010_lot9bis_email.sql:445-567`). La décision est gardée avec la ligne (« Décision » dans la
     supervision, 10.9).
   - **Cloche.** La ligne crée l'entrée de la page Notifications ; la cloche se met à jour en direct
     (`components/notifications/NotificationBell.tsx:238` ; `app/notifications/page.tsx:247`).
   - **Échec temporaire.** Nouvel essai après 1 min, puis 5 min, 15 min et 1 h (ou plus tard si le fournisseur le demande,
     4 h au plus) ; au plus 5 tentatives : un cinquième échec fait passer la ligne « En échec » et envoie l'alerte
     `ADMIN_NOTIFICATION_FAILED` aux administrateurs (`M/20261103000002_lot6_outbox.sql:1165, 1192-1196, 1206` ; `:635-655`).
   - **SMS à l'issue inconnue.** Jamais renvoyé (« Incertaine »), ni automatiquement ni à la main
     (`lib/notifications/dispatcher.ts:301-307, 325-326` ; `M/20261109000010_lot9bis_email.sql:347-367`).
   - **Statuts** (`lib/notifications/outbox-labels.ts:14-22`) : « En attente », « En cours d'envoi », « Envoyée », « En
     échec », « Non envoyée », « Annulée », « Incertaine ». « Envoyée » veut dire accepté par le fournisseur (SMS, email) ou
     par le service push ; ce n'est jamais une preuve de lecture (`lib/notifications/outbox-labels.ts:53-54`). Une ligne
     « Envoyée », « Non envoyée », « Annulée » ou « Incertaine » ne change plus ; seule une ligne « En échec » peut repartir,
     par une relance manuelle (`M/20261103000002_lot6_outbox.sql:228-259`).
   - **Motifs** affichés : liste fermée de `lib/notifications/outbox-labels.ts:43-100` (par exemple « Plage sans SMS
     (nuit) », « Désactivée dans les préférences du destinataire », « Compte suspendu », « Adresse email non vérifiée »,
     « Aucun appareil abonné aux notifications push », « Plafond journalier des SMS optionnels atteint », « Non envoyé :
     compte de démonstration »).
4. **Messages envoyés.** Ceux du catalogue (10.12).
5. **Ce que voient les autres rôles.** L'administration voit chaque ligne dans `/admin/notifications` (10.9).
6. **Impossible.** Aucune heure ni aucun filtre ne vient de la requête de la tâche (`app/api/cron/notifications-dispatch/route.ts:8-11`).
   Aucun texte n'est écrit ailleurs que dans le catalogue (`lib/notifications/catalog.ts:1-8`).
7. **Preuves.** Ci-dessus. Tâche planifiée : `12-taches-planifiees.md`.

---

## 10.2 Les envois immédiats : codes, invitation d'un nouveau contrôleur, lien de vérification d'email

Trois familles de messages **ne passent pas par la boîte d'envoi** : ils partent pendant la requête de la personne, puis
une ligne de journal est écrite dans la boîte d'envoi avec l'origine « Envoi immédiat journalisé (code à usage unique ou
invitation) », sans le code ni le lien (`M/20261108000004_lot9_compte.sql:49-111` ; `app/admin/notifications/[id]/page.tsx:476` ;
`lib/notifications/catalog.ts:1791-1819`). Ils partent à toute heure, ne sont jamais relancés à la main
(`M/20261103000008_lot6_supervision.sql:445-448`) et la supervision affiche « Contenu non conservé : code à usage unique »
(`app/admin/notifications/[id]/page.tsx:78, 510`).

### 10.2.1 Les codes à usage unique (SMS)

Code à 6 chiffres (`app/api/auth/send-otp/route.ts:14-15` ; `app/api/auth/register/start/route.ts:59` ;
`app/api/withdrawals/otp/route.ts:106` ; `app/api/account/phone/start/route.ts:72`). Textes (`lib/notifications/catalog.ts:1796-1808`) :

| Type | Modèle | Exemple (code 123456) | Mesure |
|---|---|---|---|
| `OTP_LOGIN`, `OTP_REGISTER`, `OTP_PHONE_CHANGE`, `OTP_AUTH_HOOK` | `Event Village : votre code de vérification est {code}. Valable 10 minutes.` | `Event Village : votre code de vérification est 123456. Valable 10 minutes.` | 74 caractères, GSM-7, 1 segment |
| `OTP_WITHDRAWAL` | `Event Village : votre code de retrait est {code}. Valable 10 minutes. Ne le donnez à personne.` | `Event Village : votre code de retrait est 123456. Valable 10 minutes. Ne le donnez à personne.` | 94 caractères, GSM-7, 1 segment |
| `OTP_PASSWORD_RESET` | `Event Village : votre code de réinitialisation du mot de passe est {code}. Valable 10 minutes.` | `Event Village : votre code de réinitialisation du mot de passe est 123456. Valable 10 minutes.` | 94 caractères, GSM-7, 1 segment |

Limites : plafond global de SMS du jour (1 000), 3 codes par numéro en 15 minutes et 10 par jour, 10 par adresse IP et par
heure, 30 par jour (`lib/sms/sms-guard.ts:86-98` ; `lib/env.ts:57-62`). Détail des écrans : `02-comptes.md`.

### 10.2.2 Scénario 10.2 — Invitation d'un nouveau contrôleur (A3)

1. **Qui, où.** La partenaire, page de son équipe, invite un numéro qui **n'a pas encore de compte** (ou dont le compte,
   créé par une invitation précédente, n'a jamais été activé) (`app/api/partner/team/invite/route.ts:476-481`). Écran :
   `05-equipe-controle-acces.md`.
2. **Ce qu'elle saisit.** Le numéro, le prénom (facultatif ; « Contrôleur » par défaut), le nom, les événements, la
   permission espèces (`app/api/partner/team/invite/route.ts:39-60`).
3. **Ce que fait le système.** Un code d'activation à 6 chiffres valable 24 heures est enregistré ; les codes précédents de ce
   numéro sont échus (seul le dernier active le compte) (`app/api/partner/team/invite/route.ts:476-507`). Le lien est
   `{URL}/controller/setup?phone={numéro}` (`:509`). **Le SMS part tout de suite, pendant la requête**, par
   `sendControllerInvite` (`:517-534` ; `lib/sms/mtarget.service.ts:189-195`) : il ne passe pas par la boîte d'envoi et n'attend
   pas la tâche de chaque minute. Une ligne de journal `CONTROLLER_INVITE` est écrite (statut « Envoyée », « Non envoyée »,
   « En échec » ou « Incertaine »), sans le code ni le lien (`M/20261108000004_lot9_compte.sql:49-111`).
4. **Message envoyé.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Numéro invité | SMS | indispensable (hors préférences) | immédiat, à toute heure | Modèle : `Event Village : Bonjour {prénom}, code d'activation {code} (24 h) pour scanner les billets : {URL}/controller/setup?phone={numéro}` ; sans prénom : `Event Village : code d'activation {code} (24 h) pour scanner les billets : {URL}/controller/setup?phone={numéro}` (`lib/notifications/catalog.ts:1809-1815`) |

   Exemple : `Event Village : Bonjour Fatou, code d'activation 123456 (24 h) pour scanner les billets : https://app.eventvillage.sn/controller/setup?phone=%2B221770000000`
   — **156 caractères, GSM-7, 1 segment**. Sans prénom : 141 caractères. Le prénom est translittéré et coupé à 9 caractères
   (« Marie-Christine » → « Marie-... ») : au pire 160 caractères, 1 segment. Le numéro du lien est encodé (`%2B221` +
   9 chiffres, 15 caractères). Formule : caractères = 114 + longueur de `{URL}` sans prénom, 124 + longueur du prénom (9 au
   plus) + longueur de `{URL}` avec prénom. **Le SMS reste sur un seul segment tant que l'adresse de l'application fait au
   plus 27 caractères** ; au-delà, un prénom de 9 caractères le fait passer à 2 segments. L'adresse de production n'a pas
   été lue (`.env.local` interdit) : **NON VÉRIFIÉ** pour le projet réel.
5. **Ce que voient les autres rôles.**
   - La partenaire reçoit tout de suite la réponse : « Contrôleur créé et assigné sur l'événement. SMS avec code
     d'activation envoyé. » (ou « … sur {n} événements. ») ; si le SMS ne part pas : « … SMS non envoyé : {raison}.
     Renvoyez l’invitation plus tard. », raison parmi « trop d’envois vers ce numéro aujourd’hui », « limite d’envois de
     votre compte atteinte pour aujourd’hui », « limite d’envois de la plateforme atteinte pour aujourd’hui », « le service
     SMS n’a pas confirmé l’envoi » (`app/api/partner/team/invite/route.ts:30-37, 540-553`).
   - L'administration (permission `notifications.read`) voit la ligne dans `/admin/notifications` : type « Invitation d'un
     contrôleur », canal « SMS », statut, motif ; dans le détail : origine « Envoi immédiat journalisé (code à usage unique
     ou invitation) », contenu « Contenu non conservé : code à usage unique ». La « Taille du SMS » n'y figure pas : le
     journal immédiat ne garde pas le nombre de segments (`M/20261108000004_lot9_compte.sql:101` ;
     `app/admin/notifications/[id]/page.tsx:188-193, 236-240`).
   - Après l'activation par le contrôleur : `CONTROLLER_ACTIVATED` (10.12). Le SMS d'affectation `CONTROLLER_ASSIGNED` qui
     suivrait dans l'heure n'est pas envoyé (« Déjà prévenu par l'invitation »,
     `M/20261109000010_lot9bis_email.sql:523-530`).
6. **Impossible ou refusé.** Le code n'est jamais renvoyé à la partenaire (`app/api/partner/team/invite/route.ts:564`). Une
   ligne « En échec » d'invitation ne se relance pas : bandeau « Relance non proposée — Un code à usage unique ou une
   invitation ne se renvoie pas : la personne doit en demander un nouveau. » (`app/admin/notifications/[id]/page.tsx:462-466`) ;
   la partenaire renvoie l'invitation. Limites du SMS : part hors codes du plafond global (700 sur 1 000 par jour par défaut),
   30 SMS par numéro et par jour, 30 par compte qui invite (`lib/sms/sms-guard.ts:100-115` ; `lib/sms/mtarget.service.ts:117-119`) ;
   quotas d'invitation : 20 par partenaire et par heure, 3 par numéro et par jour (`lib/env.ts:88-89`, détail dans
   `13-limites-quotas-securite.md`).
7. **Preuves.** Ci-dessus. Essai associé : essai 86 de `docs/recette-billetterie.md` (invitation d'un compte existant).

**Compte déjà établi (A5).** Si le numéro a déjà un compte Event Village actif, aucun code n'est émis : la partenaire
confirme l'envoi, puis `CONTROLLER_INVITATION` est **mis en file** (il part au passage suivant de l'envoyeur, moins d'une
minute) (`app/api/partner/team/invite/route.ts:276-314` ; `M/20261109000008_lot9bis_cycle.sql:2058-2061`). Son SMS **nomme
l'organisateur** (nom commercial, sinon raison sociale, `M/20261109000008_lot9bis_cycle.sql:2014-2015`) :
`Event Village : {organisateur} vous invite à scanner les billets de {titre}. Répondez sur {URL}/invitations` — exemple
`Event Village : Fatou Diop Events vous invite à scanner les billets de Concert Test. Répondez sur https://app.eventvillage.sn/invitations`
(137 caractères, 1 segment ; texte de plusieurs événements et mesures dans la fiche `CONTROLLER_INVITATION`, 10.12).

### 10.2.3 Le lien de vérification d'une adresse email (`EMAIL_VERIFICATION`)

Seul email envoyé à une adresse **non vérifiée** ; il part pendant la requête, si la clé d'envoi des emails est présente
(sinon journal « Non envoyée », motif « Envoi des emails non configuré ») (`lib/email/verification.ts:1-19, 103-107`).
Textes exacts (`lib/notifications/catalog.ts:1821-1828`) : sujet `Vérifiez votre adresse email — Event Village` ; titre
`Vérifiez votre adresse email` ; texte `Vous avez indiqué cette adresse pour votre compte Event Village. Confirmez-la pour recevoir vos billets et vos confirmations par email.` ;
bouton `Vérifier mon adresse` vers `{URL}/verify-email?t={jeton}` ; note `Ce lien est valable 24 heures et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : l’adresse ne sera pas ajoutée.`
Limites : 3 liens par compte et par heure, 5 par adresse et par jour (`lib/env.ts:117-118`). Écrans : `02-comptes.md`.

---

## 10.3 Heures calmes (22 h à 8 h) : un SMS optionnel la nuit est perdu, pas reporté

### Scénario 10.3 — Un SMS optionnel arrive à l'envoi pendant la nuit

1. **Qui, où.** Aucun écran ; la règle s'applique au moment où l'envoyeur prend la ligne. Réglages SUPERADMIN « Début de la
   plage sans SMS » et « Fin de la plage sans SMS », aide : « Heure de Dakar à partir de laquelle aucun SMS optionnel ne
   part ; le rappel passe alors par les autres canaux. De 0 à 23. » et « Heure de Dakar de fin de la plage. Un début égal à
   la fin supprime la plage. De 0 à 23. » (`app/admin/finance-settings/page.tsx:90-91`).
2. **Ce qu'on saisit.** Valeurs par défaut : début 22, fin 8 (`M/20261103000003_lot6_reglages.sql:34-37`) ; entiers de 0 à 23
   (`M/20261110000002_lot9ter_reglages.sql:92-93`).
3. **Ce que fait le système.** Au moment de l'envoi (pas de la mise en file), pour une ligne **SMS** d'un type
   **optionnel** seulement : si l'heure de Dakar est dans la plage (22 h ≤ heure ou heure < 8 h), la ligne passe **« Non
   envoyée »**, motif « Plage sans SMS (nuit) » (`M/20261109000010_lot9bis_email.sql:487-503` ;
   `M/20261103000002_lot6_outbox.sql:340-355` ; `lib/notifications/outbox-labels.ts:47`). C'est un statut final : la ligne
   ne change plus (`M/20261103000002_lot6_outbox.sql:228-259`), elle n'est **pas reportée à 8 h** et ne peut pas être
   relancée (la relance ne vise que « En échec », `M/20261103000008_lot6_supervision.sql:442-444`). Les lignes cloche, push et
   email du même message partent normalement, à toute heure. Réglage absent : SMS optionnel « Non envoyée », motif
   « Réglage des notifications manquant ».
   - **Types concernés** (optionnels qui ont un SMS) : `REMINDER_J1`, `REMINDER_H3`, `CONTROLLER_REMINDER`,
     `FIRST_TICKET_SOLD`, `CATEGORY_SOLD_OUT`, `EVENT_SOLD_OUT` (registre, 10.12).
   - **Non concernés** : tous les SMS indispensables (achat, annulation, changement de date ou de lieu, remboursement,
     sécurité, transferts…) partent aussi la nuit ; les envois immédiats (codes, invitation) aussi.
   - **Conséquences pratiques.** Le rappel de la veille part à l'heure réglée (10 h par défaut, réglable de 6 à 20 :
     jamais dans la plage par défaut) ; le rappel du contrôleur part à 18 h. Le rappel « quelques heures avant » (3 h par
     défaut) d'un événement qui commence entre 1 h et 10 h 59 tombe entre 22 h et 7 h 59 : **son SMS n'est jamais envoyé**,
     la cloche, le push et l'email partent. Les signaux de vente optionnels (premier billet, catégorie ou événement
     complet) survenus la nuit perdent leur SMS. La prévision du budget SMS de demain ne compte pas les rappels dont
     l'échéance tombe dans la plage (`M/20261105000002_lot7_sms.sql:740-745, 766-770`).
4. **Messages envoyés.** Aucun SMS ; les autres canaux du type, inchangés.
5. **Ce que voient les autres rôles.** Dans la supervision, la ligne SMS est « Non envoyée », motif « Plage sans SMS
   (nuit) » ; le détail affiche « Plage sans SMS : De 22 h à 8 h (heure de Dakar) ; heure de la décision : {h} h, dans la
   plage » (`app/admin/notifications/[id]/page.tsx:228-231`).
6. **Impossible.** Reporter un SMS optionnel à 8 h : aucun code ne le fait. Couper la plage : mettre début = fin.
7. **Preuves.** Ci-dessus. Essai associé : essai 48 de `docs/recette-billetterie.md` (rappels).

---

## 10.4 Plafonds et limites des SMS

Toutes les limites sont comptées en base avant l'envoi ; une garde indisponible bloque l'envoi (jamais d'envoi « à
l'aveugle ») (`lib/sms/sms-guard.ts:1-25`). Valeurs par défaut dans `lib/env.ts:57-66, 94`.

| Limite | Valeur par défaut | S'applique à | Effet | Preuve |
|---|---|---|---|---|
| Budget des SMS optionnels | 700 par jour de Dakar (`notif.sms_optional_daily_cap`, 0 = aucun SMS optionnel) | SMS des types optionnels | « Non envoyée », motif « Plafond journalier des SMS optionnels atteint » ; alerte admin à 80 % | `M/20261109000010_lot9bis_email.sql:546-567` ; `M/20261105000001_lot7_reglages.sql:30-31` |
| Plafond global | 1 000 SMS par jour UTC (= jour de Dakar) | codes à usage unique en entier ; autres SMS non indispensables jusqu'à 70 % (700) | refus ; alerte `ADMIN_SMS_CAP_GLOBAL` ou `ADMIN_SMS_CAP_NON_OTP` une fois par jour | `lib/sms/sms-guard.ts:78-105, 126-174` |
| SMS indispensables | **aucun plafond global** | types indispensables de la boîte d'envoi | alerte `ADMIN_SMS_DAILY_THRESHOLD` au-delà de 2 000 par jour (`notif.sms_essential_daily_alert`) | `lib/sms/sms-guard.ts:100-105` ; `M/20261109000009_lot9bis_messages.sql:1313-1340` |
| Par numéro destinataire | 30 SMS hors codes par jour | tous les SMS hors codes, indispensables compris | « Non envoyée », motif « Limite de SMS du destinataire atteinte » | `lib/sms/sms-guard.ts:106` ; `lib/env.ts:61` |
| Par compte déclencheur | 30 SMS par jour | SMS dont la ligne porte un compte déclencheur (expéditeur d'un transfert, client des billets gratuits, partenaire qui affecte ou annule, administrateur qui suspend…), indispensables compris | « Non envoyée », motif « Limite de SMS du compte déclencheur atteinte » | `lib/sms/sms-guard.ts:114` ; `lib/notifications/dispatcher.ts:295-300` ; `lib/env.ts:64` |
| Par caisse | 500 reçus par caisse et par jour | `COUNTER_RECEIPT` | « Limite de reçus de la caisse atteinte » | `lib/sms/sms-guard.ts:107-112` ; `lib/env.ts:94` |
| Codes | 3 par numéro en 15 min, 10 par jour ; 10 par IP et par heure, 30 par jour | codes à usage unique | refus de la demande | `lib/sms/sms-guard.ts:86-98` |

Le compteur « SMS aujourd'hui » et « SMS optionnels aujourd'hui » de la supervision suit ces chiffres (10.9). Les alertes
`ADMIN_SMS_*` ne partent jamais par SMS (registre, 10.12).

---

## 10.5 Email : adresse vérifiée et clé d'envoi

- **Clé absente** (`RESEND_API_KEY`) : aucun appel, ligne « Non envoyée », motif « Envoi des emails non configuré » ; un seul
  avertissement par processus ; tout le reste fonctionne (`lib/notifications/channels.ts:1-33` ;
  `lib/notifications/dispatcher.ts:332-334`).
- **Adresse vérifiée exigée**, à la mise en file comme à l'envoi : adresse absente ou technique (domaine
  `eventvillage.sn` et ses sous-domaines, adresse d'un compte inscrit par téléphone ou anonymisé) → « Aucune adresse email
  réelle » ; adresse réelle mais pas encore vérifiée par le lien → « Adresse email non vérifiée »
  (`M/20261109000010_lot9bis_email.sql:219-239, 419-423, 531-536` ; `M/20261109000010_lot9bis_email.sql:100-122`).
- Le seul email vers une adresse non vérifiée est le lien de vérification (10.2.3).
- Email refusé définitivement par le fournisseur : « En échec » (« Email refusé par le fournisseur ») ; panne temporaire :
  nouvel essai avec la même clé d'idempotence, sans doublon (`lib/notifications/dispatcher.ts:351-371`).
- Dans les préférences, l'interrupteur Email est grisé pour un compte sans adresse vérifiée
  (`app/api/notifications/preferences/route.ts:127-135`).

---

## 10.6 Push : appareil abonné et push configuré

- Push configuré seulement si les trois variables VAPID sont présentes et valides ; sinon « Non envoyée », motif
  « Notifications push non configurées » (`lib/push/config.ts:60-85` ; `lib/notifications/dispatcher.ts:388-394`).
- Seulement vers les appareils abonnés du compte ; aucun : « Aucun appareil abonné aux notifications push » ; abonnement
  d'une ancienne clé : supprimé ; abonnement expiré (404, 410) : supprimé (`lib/notifications/dispatcher.ts:409-488`).
- « Envoyée » = accepté par le service push d'au moins un appareil, sans preuve d'affichage. Durée de vie : 24 h, sauf le
  rappel avant le début (jusqu'au début de l'événement) ; urgence haute pour `REMINDER_H3`, `EVENT_CANCELLED`, `PUSH_TEST`
  (`lib/notifications/dispatcher.ts:173, 376-382, 429-432`).
- Notification d'essai : bouton des préférences ; réponses « Notification d'essai envoyée : elle arrive dans la minute. »,
  « Activez d'abord les notifications sur cet appareil. », « Les notifications push ne sont pas disponibles pour le
  moment. », « Trop de notifications d’essai en une heure. Réessayez plus tard. » (`app/api/notifications/essai-push/route.ts:24, 43, 57, 72`).

---

## 10.7 Comptes de démonstration

Hors simulation (mode réel, production, tests), **aucun SMS, email ni push** ne part vers un compte créé par le jeu de
démonstration (`users.demo_account`), ni vers son numéro (9 derniers chiffres), son adresse, une adresse du domaine du jeu
de démonstration, ni pour un événement d'une partenaire de démonstration ; la cloche n'est jamais retenue. Ligne « Non
envoyée », motif « Non envoyé : compte de démonstration » ; contrôle injoignable : nouvel essai, rien ne part
(`lib/notifications/demo-guard.ts:1-76` ; `lib/notifications/dispatcher.ts:511-536` ;
`M/20261109000012_lot9bis_mode_reel.sql:32-41`). Les envois immédiats (codes, invitation, lien email) suivent la même règle
(`lib/sms/mtarget.service.ts:121-145` ; `lib/email/verification.ts:17-18`). En simulation (essai local), la garde est
inactive (`lib/integrations/simulation.ts:32-35`).

---

## 10.8 Compte suspendu, préférences par sujet

- **Compte suspendu.** Un compte « Suspendu » ou « Supprimé », ou dont la fiche partenaire est suspendue, ne reçoit que les
  types dont la politique est « envoyé quand même » (ligne « Compte suspendu » de chaque fiche) ; les autres passent « Non
  envoyée », motif « Compte suspendu », à la mise en file et de nouveau à l'envoi (`M/20261103000002_lot6_outbox.sql:374-387` ;
  `M/20261109000010_lot9bis_email.sql:225-227, 446-447`). Un compte « En attente » reçoit ses messages.
- **Préférences.** Page « Notifications » du profil (`/profile/notifications`), un interrupteur par sujet et par canal ;
  sans réglage, tout est activé (`M/20261103000002_lot6_outbox.sql:285, 389-398`). Le sujet « Activité de vos ventes »
  n'est proposé qu'aux partenaires (`app/api/notifications/preferences/route.ts:116, 152-156`). Liste des indispensables
  affichée : « Codes de connexion », « Confirmations d’achat et reçus », « Billets transférés », « Annulations »,
  « Remboursements », « Sécurité du compte », « Changements de date ou de lieu » (`app/api/notifications/preferences/route.ts:54-62`).
  Un sujet coupé : la ligne passe « Non envoyée », motif « Désactivée dans les préférences du destinataire ». Écran détaillé :
  `02-comptes.md` ; essai associé : essai 47.

---

## 10.9 Supervision par l'administration (`/admin/notifications`)

### Scénario 10.9 — Superviser les envois et relancer un échec

1. **Qui, où.** SUPERADMIN, ou ADMIN avec la permission `notifications.read` : menu admin « Notifications », page titrée
   « Notifications », description « Supervision des envois : application, SMS, email et notifications push. »
   (`app/admin/notifications/page.tsx:430` ; `app/api/admin/notifications/route.ts:25`). Sans la permission : « Accès refusé ».
2. **Ce qu'il saisit.** Filtres : onglets par statut (« Toutes », puis chaque statut), « Rechercher » (« Numéro, email ou titre
   de l’événement »), « Canal » (« Tous les canaux »), « Type » (« Tous les types »), « Du », « Au »
   (`app/admin/notifications/page.tsx:346-352, 516-537`).
3. **Ce que fait le système.** Compteurs « SMS aujourd'hui », « SMS optionnels aujourd'hui » (avec le plafond : « Plafond non
   réglé : les SMS optionnels ne partent pas. » ou « Plafond à 0 : aucun SMS optionnel n’est envoyé. »), « SMS ce mois-ci »
   (`:213-217, 467-487`) ; liste « Envois » : Date, Type, Canal, Destinataire (masqué), Statut, Motif, Détail (`:355-380`) ;
   tableau « Par jour et par canal » : Envoyées, En échec, Non envoyées, Incertaines, Annulées (`:404-413, 604-608`). Le
   détail (`/admin/notifications/{id}`) montre l'envoi (type, canal, statut, motif, famille, origine, dates), le
   destinataire, la **décision** (moment, compte, préférence, événement, porteur, plage sans SMS, règle du SMS, réponse du
   fournisseur, « Taille du SMS » : « {n} SMS facturé(s), {encodage} »), un **aperçu du contenu** rendu par le serveur, et les
   tentatives (`app/admin/notifications/[id]/page.tsx:180-241, 468-528` ; `app/api/admin/notifications/[id]/route.ts:40-56`).
4. **Relance.** Sur une ligne « En échec » de la boîte d'envoi seulement, bouton « Relancer », confirmation « Relancer cette
   notification ? » — « Elle repartira au prochain passage de l'envoyeur. », puis message « Notification remise en
   attente : elle repartira au prochain passage de l’envoyeur. » (`app/admin/notifications/[id]/page.tsx:369, 445-448, 536-538`).
   Permission `notifications.write` exigée ; la ligne repart avec 0 tentative (`M/20261103000008_lot6_supervision.sql:400-470`).
5. **Ce que voient les autres rôles.** Le destinataire reçoit le message au passage suivant de l'envoyeur.
6. **Refusé.** « Seule une notification en échec peut être relancée. » ; « Un code à usage unique ne se renvoie pas : la
   personne doit en demander un nouveau. » ; « Un message plus récent sur ce changement est déjà en attente : cette
   notification ne repart pas. » ; « Relance réservée aux administrateurs qui ont la permission notifications.write. » ;
   « La relance est momentanément impossible. Réessayez dans un instant. » (`M/20261103000008_lot6_supervision.sql:425-470` ;
   `app/api/admin/notifications/[id]/retry/route.ts:38, 47`). Ligne « Incertaine » : bandeau « Remise non confirmée — Le
   fournisseur a peut-être remis ce message : il n’est jamais renvoyé, ni automatiquement ni à la main, pour éviter un
   doublon. » (`app/admin/notifications/[id]/page.tsx:457-460`).
7. **Preuves.** Ci-dessus. Essai associé : essai 54. Écran détaillé de l'administration : `11-admin-superadmin.md`.

---

## 10.10 Liste : les messages reçus par un administrateur, et par quels canaux

Destinataires : chaque compte **actif** qui a le rôle SUPERADMIN (toujours), ou le rôle ADMIN **avec la permission du
type** (`M/20261103000002_lot6_outbox.sql:400-423, 596-626`). Un administrateur ne reçoit **jamais de SMS** : aucun type
d'administration n'a le canal SMS (registre). Le push n'arrive que si l'administrateur a abonné son appareil (10.6),
l'email que si son adresse est vérifiée et la clé présente (10.5).

| Type | Ce qui le déclenche | Permission | Canaux |
|---|---|---|---|
| `ADMIN_EVENT_SUBMITTED` | événement soumis à validation | events.read | cloche, push, email |
| `ADMIN_EVENT_CANCELLED` | événement annulé par la partenaire (motif interne) | events.read | cloche, email |
| `ADMIN_EVENT_CHANGED` | titre, affiche, lieu, date changés, catégorie ajoutée, prix ou canaux d'une catégorie changés après validation | events.read | cloche, email |
| `ADMIN_EVENT_PUBLISHED` | partenaire publie son événement validé | events.read | cloche, email |
| `ADMIN_EVENT_WITHDRAWN` | partenaire retire sa soumission | events.read | cloche, email |
| `ADMIN_PARTNER_REGISTERED` | nouvelle candidature partenaire | partners.read | cloche, push, email |
| `ADMIN_PARTNER_RESUBMITTED` | dossier refusé complété | partners.read | cloche, push, email |
| `ADMIN_REFUND_TO_RETRY` | remboursement bloqué ou refusé par l'opérateur | refunds.manage | cloche, push, email |
| `ADMIN_CASHOUT_TO_RESUME` | versement en attente depuis plus de 30 min, retrait bloqué | refunds.manage | cloche, push, email |
| `ADMIN_CASHOUT_UNCERTAIN` | versement à l'issue incertaine | refunds.manage | cloche, push, email |
| `ADMIN_DUPLICATE_PAYMENT` | paiement en double remboursé | refunds.manage | cloche, push, email |
| `ADMIN_WITHDRAWAL_REJECTED` | retrait refusé par l'opérateur | refunds.manage | cloche, email |
| `ADMIN_FINANCE_DEBT` | créance sur un compte | payments.read | cloche, email |
| `ADMIN_NOTIFICATION_FAILED` | une notification passe « En échec » | notifications.read | cloche, email |
| `ADMIN_SMS_DAILY_THRESHOLD` | SMS indispensables du jour au-delà du seuil | notifications.read | cloche, email |
| `ADMIN_SMS_CAP_GLOBAL` | plafond global de SMS atteint par les codes | notifications.read | cloche, email |
| `ADMIN_SMS_CAP_NON_OTP` | part hors codes du plafond atteinte | notifications.read | cloche, email |
| `ADMIN_SMS_OPTIONAL_80` | 80 % du budget des SMS optionnels | notifications.read | cloche, email |
| `ADMIN_SMS_FORECAST` | rappels de demain au-delà du budget SMS | notifications.read | cloche, email |

Un administrateur reçoit aussi, comme toute personne, les messages de **son propre compte** (`PASSWORD_CHANGED`,
`PHONE_CHANGED`, `ACCOUNT_SUSPENDED`…, `PUSH_TEST`) et ceux de ses billets s'il en achète. Preuves : fiche de chaque type
(10.12).

---

## 10.11 Liste : les messages reçus par la partenaire à chaque vente

### Scénario 10.11 — Une vente a lieu

1. **Qui, où.** Un client paie en ligne, demande des billets gratuits, ou un contrôleur vend au guichet. La partenaire est
   la propriétaire de l'événement.
2. **Ce qu'elle saisit.** Rien.
3. **Ce que fait le système / 4. Messages envoyés à la partenaire.**

   | Situation | Type | Canaux | Indispensable ou optionnel | Quand | Texte (cloche) |
   |---|---|---|---|---|---|
   | **Chaque** paiement en ligne confirmé | `NEW_ORDER` | **cloche seulement** | optionnel (« Activité de vos ventes ») | file, moins d'une minute | `{n} billets vendus pour « {titre} » ({montant hors frais}).` |
   | **Premier** billet vendu de l'événement, en ligne ou au guichet (gratuits et invitations exclus) | `FIRST_TICKET_SOLD` | cloche, push, SMS, email | optionnel | une seule fois par événement ; SMS perdu la nuit | `Le premier billet de « {titre} » est vendu.` |
   | Une catégorie atteint sa quantité | `CATEGORY_SOLD_OUT` | cloche, push, SMS, email | optionnel | une fois par quantité | `La catégorie « {catégorie} » de « {titre} » est complète.` |
   | Toutes les catégories actives sont épuisées | `EVENT_SOLD_OUT` | cloche, push, SMS, email | optionnel | une fois par total | `Toutes les catégories de « {titre} » sont vendues.` |
   | Vente au guichet (après la première) | aucun | — | — | — | — |
   | Billets gratuits demandés | aucun (`FIRST_TICKET_SOLD` exclut les gratuits) | — | — | — | — |

   **Réponse à la question :** la partenaire reçoit **un avis à chaque commande payée en ligne** (`NEW_ORDER`, dans la
   cloche seulement, sans SMS, push ni email), et **un avis complet (cloche, push, SMS, email) pour le premier billet
   seulement** (`FIRST_TICKET_SOLD`). Les ventes au guichet ne déclenchent que le premier billet et les « complet ». Tous ces
   avis sont optionnels : la partenaire peut les couper (sujet « Activité de vos ventes »).
5. **Ce que voient les autres rôles.** Le client reçoit `PURCHASE_CONFIRMED`, `FREE_TICKETS_CONFIRMED` ou `COUNTER_RECEIPT`
   (10.12) ; les chiffres de vente de la partenaire se mettent à jour dans son pilotage (`04-evenement-cycle.md`).
6. **Impossible.** Recevoir un SMS à chaque vente : aucun type ne le prévoit.
7. **Preuves.** `M/20261106000003_lot8_paiement.sql:236-248` (NEW_ORDER par paiement) ; `M/20261103000005_lot6_billetterie.sql:831-863`
   (premier billet, une fois, canaux ONLINE et COUNTER) ; `:891-935` (complet) ; registre : `M/20261103000002_lot6_outbox.sql:102-105` ;
   libellé du sujet : `app/api/notifications/preferences/route.ts:40-43`.

---

## 10.12 Catalogue complet des 103 types

Ordre : celui du catalogue (`lib/notifications/catalog.ts:647-1697`). Le tableau récapitulatif donne, pour chaque SMS, le
nombre de caractères de l'exemple (le plus court et le plus long si plusieurs variantes) / le pire cas, et le nombre de
segments au pire cas. **Aucun SMS du catalogue ne dépasse un segment** avec une adresse d'application de 27 caractères ;
chaque fiche dit jusqu'à quelle longueur d'adresse le SMS reste sur un segment.

### 10.12.1 Tableau récapitulatif

| Type | Nom | Destinataire | Famille | Canaux | SMS (exemple / pire cas, segments au pire) |
|---|---|---|---|---|---|
| `PURCHASE_CONFIRMED` | Confirmation d’achat | client | indispensable | cloche, SMS, email | 144 / 159 car., 1 seg. |
| `FREE_TICKETS_CONFIRMED` | Billets gratuits confirmés | client | indispensable | cloche, SMS, email | 127 / 148 car., 1 seg. |
| `COUNTER_RECEIPT` | Reçu de vente au guichet | tout compte ou numéro | indispensable | SMS | 107 / 133 car., 1 seg. |
| `INVITATION_RECEIVED` | Invitation reçue | tout compte ou numéro | indispensable | SMS, cloche, push, email | 140 / 159 car., 1 seg. |
| `TRANSFER_OFFERED` | Billet transféré (offre) | client | indispensable | SMS, cloche, push, email | 151 / 160 car., 1 seg. |
| `TRANSFER_CANCELLED` | Transfert annulé | client | indispensable | SMS, cloche, push, email | 86 / 104 car., 1 seg. |
| `TRANSFER_EXPIRED` | Transfert expiré | client | indispensable | cloche, push, email | — |
| `TRANSFER_CLAIMED_SENDER` | Transfert accepté (expéditeur) | client | indispensable | cloche, push, email | — |
| `TRANSFER_RECEIVED` | Billet reçu | client | indispensable | cloche, push, email | — |
| `TICKET_SCANNED` | Entrée validée | client | indispensable | cloche, push, email | — |
| `EVENT_CANCELLED` | Annulation d’un événement | client | indispensable | cloche, SMS, email, push | 98 à 138 / 157 car., 1 seg. |
| `EVENT_SUSPENDED_HOLDER` | Suspension d’un événement (porteurs) | client | optionnel | cloche, push, email | — |
| `EVENT_REACTIVATED_HOLDER` | Reprise d’un événement (porteurs) | client | optionnel | cloche, push, email | — |
| `EVENT_CHANGED` | Changement d’un événement | client | indispensable | cloche, push, SMS, email | 130 à 150 / 159 car., 1 seg. |
| `REMINDER_J1` | Rappel la veille | client | optionnel | cloche, push, SMS, email | 117 / 151 car., 1 seg. |
| `REMINDER_H3` | Rappel avant le début | client | optionnel | cloche, push, SMS, email | 141 / 154 car., 1 seg. |
| `REFUND_REQUESTED` | Remboursement demandé | client | indispensable | cloche, email | — |
| `REFUND_PAID` | Remboursement versé | client | indispensable | cloche, SMS, email, push | 73 à 88 / 110 car., 1 seg. |
| `PASSWORD_CHANGED` | Mot de passe modifié | tout compte ou numéro | indispensable | cloche, SMS, email | 116 / 116 car., 1 seg. |
| `PHONE_CHANGED` | Numéro de téléphone modifié | tout compte ou numéro | indispensable | SMS, email | 100 / 100 car., 1 seg. |
| `PUSH_TEST` | Notification d’essai | tout compte ou numéro | indispensable | push | — |
| `EVENT_VALIDATED` | Événement validé | partenaire | indispensable | cloche, SMS, email, push | 132 / 150 car., 1 seg. |
| `EVENT_REJECTED` | Événement non validé | partenaire | indispensable | cloche, SMS, email, push | 142 / 155 car., 1 seg. |
| `EVENT_SUSPENDED` | Événement suspendu | partenaire | indispensable | cloche, SMS, email, push | 130 / 153 car., 1 seg. |
| `EVENT_REACTIVATED` | Événement réactivé | partenaire | indispensable | cloche, SMS, email, push | 112 / 130 car., 1 seg. |
| `EVENT_PUBLISHED_BY_ADMIN` | Événement publié par l’administration | partenaire | indispensable | cloche, push, email | — |
| `FIRST_TICKET_SOLD` | Premier billet vendu | partenaire | optionnel | cloche, push, SMS, email | 118 / 135 car., 1 seg. |
| `NEW_ORDER` | Nouvelle commande | partenaire | optionnel | cloche | — |
| `CATEGORY_SOLD_OUT` | Catégorie complète | partenaire | optionnel | cloche, push, SMS, email | 111 / 145 car., 1 seg. |
| `EVENT_SOLD_OUT` | Événement complet | partenaire | optionnel | cloche, push, SMS, email | 120 / 138 car., 1 seg. |
| `SHIFT_DISCREPANCY` | Écart de caisse | partenaire | indispensable | cloche, SMS, push, email | 132 / 159 car., 1 seg. |
| `WITHDRAWAL_PAID` | Retrait versé | tout compte ou numéro | indispensable | cloche, SMS, email, push | 80 / 83 car., 1 seg. |
| `WITHDRAWAL_REJECTED` | Retrait refusé | tout compte ou numéro | indispensable | cloche, SMS, email, push | 114 / 117 car., 1 seg. |
| `WITHDRAWAL_UNCERTAIN` | Retrait en vérification | tout compte ou numéro | indispensable | cloche, SMS, push, email | 117 / 120 car., 1 seg. |
| `CANCEL_REFUNDS_DONE` | Remboursements d’une annulation terminés | partenaire | indispensable | cloche, email, push | — |
| `CANCEL_REFUNDS_BLOCKED` | Remboursements d’une annulation bloqués | partenaire | indispensable | cloche, email, push | — |
| `PARTNER_REGISTERED_ACK` | Inscription partenaire reçue | partenaire | indispensable | cloche, email | — |
| `PARTNER_VALIDATED` | Compte partenaire validé | partenaire | indispensable | cloche, SMS, email | 120 / 133 car., 1 seg. |
| `PARTNER_REJECTED` | Demande de compte partenaire refusée | partenaire | indispensable | cloche, SMS, email | 106 / 139 car., 1 seg. |
| `PARTNER_SUSPENDED` | Compte partenaire suspendu | partenaire | indispensable | cloche, SMS, email | 125 / 144 car., 1 seg. |
| `PARTNER_REACTIVATED` | Compte partenaire réactivé | partenaire | indispensable | cloche, SMS, email | 104 / 104 car., 1 seg. |
| `TRIAL_STARTED` | Période d’essai activée | partenaire | indispensable | cloche, email | — |
| `SUBSCRIPTION_ACTIVATED` | Abonnement activé | partenaire | indispensable | cloche, email | — |
| `PAYMENT_SUCCESS` | Paiement confirmé | client | indispensable | cloche, email | — |
| `HALL_RESERVATION_REQUESTED` | Demande de réservation de salle | partenaire | indispensable | cloche, email | — |
| `HALL_RESERVATION_CONFIRMED` | Réservation de salle confirmée | client | indispensable | cloche, email | — |
| `HALL_RESERVATION_CANCELLED` | Réservation de salle annulée | tout compte ou numéro | indispensable | cloche, email | — |
| `PROMOTION_DECIDED` | Décision sur une mise en avant | partenaire | indispensable | cloche, email | — |
| `CONTROLLER_ASSIGNED` | Affectation d’un contrôleur | contrôleur | indispensable | cloche, push, SMS, email | 111 à 141 / 159 car., 1 seg. |
| `CONTROLLER_UNASSIGNED` | Retrait d’affectation | contrôleur | indispensable | cloche, push, SMS, email | 73 à 85 / 105 car., 1 seg. |
| `CONTROLLER_REMINDER` | Rappel de contrôle la veille | contrôleur | optionnel | cloche, push, SMS, email | 128 à 132 / 156 car., 1 seg. |
| `SHIFT_CLOSED_BY_OTHER` | Caisse fermée par un tiers | contrôleur | indispensable | cloche, push, email | — |
| `CONTROLLER_ACTIVATED` | Compte de contrôleur activé | contrôleur | indispensable | cloche, SMS, email | 91 / 91 car., 1 seg. |
| `ADMIN_EVENT_SUBMITTED` | Événement à valider | administration (events.read) | indispensable | cloche, push, email | — |
| `ADMIN_PARTNER_REGISTERED` | Nouvelle candidature partenaire | administration (partners.read) | indispensable | cloche, push, email | — |
| `ADMIN_REFUND_TO_RETRY` | Remboursement à reprendre | administration (refunds.manage) | indispensable | cloche, push, email | — |
| `ADMIN_DUPLICATE_PAYMENT` | Paiement en double remboursé | administration (refunds.manage) | indispensable | cloche, push, email | — |
| `ADMIN_CASHOUT_UNCERTAIN` | Versement incertain | administration (refunds.manage) | indispensable | cloche, push, email | — |
| `ADMIN_WITHDRAWAL_REJECTED` | Retrait refusé par l’opérateur | administration (refunds.manage) | indispensable | cloche, email | — |
| `ADMIN_FINANCE_DEBT` | Créance sur un compte | administration (payments.read) | indispensable | cloche, email | — |
| `ADMIN_NOTIFICATION_FAILED` | Envoi en échec | administration (notifications.read) | indispensable | cloche, email | — |
| `ADMIN_SMS_DAILY_THRESHOLD` | Volume de SMS indispensables élevé | administration (notifications.read) | indispensable | cloche, email | — |
| `ADMIN_SMS_CAP_GLOBAL` | Plafond de SMS atteint | administration (notifications.read) | indispensable | cloche, email | — |
| `ADMIN_SMS_CAP_NON_OTP` | Quota de SMS hors code atteint | administration (notifications.read) | indispensable | cloche, email | — |
| `ADMIN_SMS_OPTIONAL_80` | SMS optionnels à 80 % du plafond | administration (notifications.read) | indispensable | cloche, email | — |
| `ADMIN_SMS_FORECAST` | Rappels de demain au-delà du budget SMS | administration (notifications.read) | indispensable | cloche, email | — |
| `REFUND_DELAYED` | Remboursement retardé | client | indispensable | cloche, SMS, email, push | 119 à 136 / 157 car., 1 seg. |
| `WITHDRAWAL_DELAYED` | Retrait retardé | tout compte ou numéro | indispensable | cloche, SMS, email, push | 123 / 126 car., 1 seg. |
| `ADMIN_CASHOUT_TO_RESUME` | Versement à reprendre | administration (refunds.manage) | indispensable | cloche, push, email | — |
| `PAYMENT_REFUND_STARTED` | Remboursement d’un paiement | client | indispensable | cloche, SMS, email, push | 125 à 131 / 150 car., 1 seg. |
| `ADMIN_PARTNER_RESUBMITTED` | Dossier partenaire complété | administration (partners.read) | indispensable | cloche, push, email | — |
| `EVENT_CLOSED_HOLDER` | Clôture d’un événement suspendu (porteurs) | client | indispensable | cloche, SMS, email, push | 140 / 158 car., 1 seg. |
| `EVENT_CLOSED_BY_ADMIN` | Clôture d’un événement par l’administration | partenaire | indispensable | cloche, SMS, email, push | 119 / 152 car., 1 seg. |
| `SHIFT_OPEN_AT_END` | Caisse encore ouverte à la fin | partenaire | indispensable | cloche, push, SMS, email | 139 à 144 / 158 car., 1 seg. |
| `TRANSFER_REVOKED` | Transfert annulé par un remboursement | client | indispensable | SMS, cloche, push, email | 120 / 138 car., 1 seg. |
| `TRANSFER_DECLINED_SENDER` | Transfert refusé (expéditeur) | client | indispensable | cloche, push, email | — |
| `TRANSFER_RECIPIENT_CHANGED` | Transfert annulé (numéro du destinataire changé) | client | indispensable | cloche, push, email | — |
| `CONTROLLER_INVITATION` | Invitation à contrôler l’entrée | client | indispensable | SMS, cloche, push, email | 137 à 149 / 158 car., 1 seg. |
| `EVENT_CANCELLED_BY_ADMIN` | Annulation d’un événement par l’administration | partenaire | indispensable | cloche, SMS, email | 100 à 141 / 157 car., 1 seg. |
| `ADMIN_EVENT_CANCELLED` | Événement annulé par l’organisateur | administration (events.read) | indispensable | cloche, email | — |
| `CONTROLLER_EVENT_CANCELLED` | Annulation d’un événement contrôlé | contrôleur | indispensable | cloche, SMS, email | 106 / 125 car., 1 seg. |
| `CONTROLLER_EVENT_CHANGED` | Changement d’un événement contrôlé | contrôleur | indispensable | cloche, SMS, email | 125 à 134 / 147 car., 1 seg. |
| `CONTROLLER_EVENT_STATUS` | Suspension ou reprise d’un événement contrôlé | contrôleur | indispensable | cloche, email | — |
| `TICKET_CANCELLED` | Billet annulé | tout compte ou numéro | indispensable | cloche, SMS, email | 106 à 116 / 135 car., 1 seg. |
| `ACCOUNT_SUSPENDED` | Compte suspendu | tout compte ou numéro | indispensable | cloche, SMS, email | 140 / 155 car., 1 seg. |
| `ACCOUNT_REACTIVATED` | Compte réactivé | tout compte ou numéro | indispensable | cloche, SMS, email | 116 / 116 car., 1 seg. |
| `ADMIN_EVENT_CHANGED` | Événement modifié après validation | administration (events.read) | indispensable | cloche, email | — |
| `EVENT_SUBMITTED_ACK` | Événement envoyé en validation | partenaire | indispensable | cloche, email | — |
| `EVENT_FINISHED` | Événement terminé | partenaire | indispensable | cloche, email | — |
| `CLOSING_REPORT_READY` | Rapport de clôture prêt | partenaire | indispensable | cloche, email | — |
| `FUNDS_AVAILABLE` | Recettes disponibles | partenaire | indispensable | cloche, email | — |
| `TICKET_REFUNDED_HOLDER` | Billet transféré annulé (détenteur) | client | indispensable | SMS, cloche, push, email | 115 / 155 car., 1 seg. |
| `ADMIN_EVENT_PUBLISHED` | Événement publié par l’organisateur | administration (events.read) | indispensable | cloche, email | — |
| `ADMIN_EVENT_WITHDRAWN` | Soumission retirée par l’organisateur | administration (events.read) | indispensable | cloche, email | — |
| `SCAN_REFUSALS_ALERT` | Refus en série à une porte | partenaire | indispensable | cloche, push, email | — |
| `OTP_LOGIN` | Code de connexion | tout compte ou numéro | indispensable | SMS | voir 10.2 |
| `OTP_REGISTER` | Code d’inscription | tout compte ou numéro | indispensable | SMS | voir 10.2 |
| `OTP_PASSWORD_RESET` | Code de réinitialisation du mot de passe | tout compte ou numéro | indispensable | SMS | voir 10.2 |
| `OTP_WITHDRAWAL` | Code de confirmation d’un retrait | tout compte ou numéro | indispensable | SMS | voir 10.2 |
| `OTP_PHONE_CHANGE` | Code de changement de numéro | tout compte ou numéro | indispensable | SMS | voir 10.2 |
| `OTP_AUTH_HOOK` | Code de connexion (Supabase) | tout compte ou numéro | indispensable | SMS | voir 10.2 |
| `CONTROLLER_INVITE` | Invitation d’un contrôleur | tout compte ou numéro | indispensable | SMS | voir 10.2 |
| `EMAIL_VERIFICATION` | Vérification de l’adresse email | tout compte ou numéro | indispensable | email | — |

### 10.12.2 Fiches (une par type)

#### `PURCHASE_CONFIRMED` — Confirmation d’achat

| | |
|---|---|
| Destinataires | L’acheteur : compte qui a payé (application, email) ; le SMS part au numéro qui a payé chez Wave ou Orange Money s’il est connu (9 chiffres), sinon au numéro du compte. |
| Déclencheur | Paiement en ligne confirmé : les billets sont émis et le message est mis en file dans la même opération (fonction payment_confirm). |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par paiement, quel que soit le nombre de billets du panier. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261106000003_lot8_paiement.sql:224-235 ; numéro du SMS : M/20261109000010_lot9bis_email.sql:416 ; catalogue : lib/notifications/catalog.ts:648 ; registre : M/20261103000002_lot6_outbox.sql:78 |
| Scénario détaillé | 06-achat-paiement.md |

- Cloche — titre : `Achat confirmé` ; texte : `{n} billets pour « {titre} » le {date}. Total payé : {total}. Vos billets sont dans Mes billets.` ; lien : `/tickets`
  - Exemple : `Achat confirmé` — `2 billets pour « Concert Test » le sam. 14 nov. 2026 à 20:00. Total payé : 10 100 F CFA. Vos billets sont dans Mes billets.`
- SMS — modèle : `Event Village : achat confirmé, {n} billets {titre}. Frais de service {frais de service}, total payé {total}. {URL}/tickets`
  - Exemple : `Event Village : achat confirmé, 2 billets Concert Test. Frais de service 100 F CFA, total payé 10 100 F CFA. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 144 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 159 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 28 caractères ; valeurs saisies coupées à : titre ≤ 19 (avec « ... »).
- Email — sujet : `Achat confirmé — Event Village` ; exemple : `Achat confirmé — Event Village` ; bouton vers `{URL}/tickets`
  - Version texte complète de l’exemple (email propre au type) :

```text
Achat confirmé

2 billets pour « Concert Test » le sam. 14 nov. 2026 à 20:00. Total payé : 10 100 F CFA. Vos billets sont dans Mes billets.

Événement : Concert Test
Date : sam. 14 nov. 2026 à 20:00
Lieu : Grand Théâtre, Dakar
Billets : 1 × Standard, 1 × VIP
Montant payé : 10 100 F CFA, dont frais de service 100 F CFA

Numéros de billets :
- TCK-20261104-3F9A1C7E2B
- TCK-20261104-8D2E6B4A1F

Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée.

Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion.

Voir mes billets : {URL}/tickets

En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.

—
Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn
```


#### `FREE_TICKETS_CONFIRMED` — Billets gratuits confirmés

| | |
|---|---|
| Destinataires | Le client qui demande des billets gratuits. |
| Déclencheur | Demande de billets gratuits acceptée (fonction free_tickets_claim, route /api/tickets/claim-free). |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par demande. Le client est aussi le « compte déclencheur » du SMS (limite de 30 SMS par jour et par compte). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261105000007_lot7_confirmation.sql:258-269 ; app/api/tickets/claim-free/route.ts:46 ; catalogue : lib/notifications/catalog.ts:670 ; registre : M/20261103000002_lot6_outbox.sql:79 |
| Scénario détaillé | 06-achat-paiement.md |

- Cloche — titre : `Billets confirmés` ; texte : `{n} billets gratuits pour « {titre} » le {date}. Vos billets sont dans Mes billets.` ; lien : `/tickets`
  - Exemple : `Billets confirmés` — `2 billets gratuits pour « Concert Test » le sam. 14 nov. 2026 à 20:00. Vos billets sont dans Mes billets.`
- SMS — modèle : `Event Village : {n} billets gratuits pour {titre} le {date}. Vos billets : {URL}/tickets`
  - Exemple : `Event Village : 2 billets gratuits pour Concert Test le sam. 14 nov. à 20:00. Vos billets : https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 127 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 148 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 39 caractères ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Billets confirmés — Event Village` ; exemple : `Billets confirmés — Event Village` ; bouton vers `{URL}/tickets`
  - Version texte complète de l’exemple (email propre au type) :

```text
Billets confirmés

2 billets gratuits pour « Concert Test » le sam. 14 nov. 2026 à 20:00. Vos billets sont dans Mes billets.

Événement : Concert Test
Date : sam. 14 nov. 2026 à 20:00
Lieu : Grand Théâtre, Dakar
Billets gratuits : 1 × Entree libre, 1 × Invitation

Numéros de billets :
- TCK-20261104-5B7D9F1A3C
- TCK-20261104-6C8E0A2B4D

Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée.

Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion.

Voir mes billets : {URL}/tickets

En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.

—
Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn
```


#### `COUNTER_RECEIPT` — Reçu de vente au guichet

| | |
|---|---|
| Destinataires | Le numéro saisi par le vendeur au guichet (aucun compte) ; aucun message si le numéro n’est pas saisi. |
| Déclencheur | Vente au guichet enregistrée (fonction counter_sale). |
| Canaux | SMS |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un SMS par vente. Quota : 500 reçus par caisse et par jour (COUNTER_RECEIPT_PER_SHIFT_DAY, lib/env.ts:94), au-delà « Limite de reçus de la caisse atteinte ». |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261110000009_lot9ter_zones.sql:1625-1636 ; catalogue : lib/notifications/catalog.ts:690 ; registre : M/20261103000002_lot6_outbox.sql:80 |
| Scénario détaillé | 05-equipe-controle-acces.md |

- SMS — modèle : `Event Village : achat au guichet pour {titre}, {n} billets, {montant}. Entrée validée. Réf. {réf}.`
  - Exemple : `Event Village : achat au guichet pour Concert Test, 2 billets, 10 000 F CFA. Entrée validée. Réf. 1F6E2B9C.`
  - Mesure de l’exemple : 107 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 133 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30, réf ≤ 12 (avec « ... »).

#### `INVITATION_RECEIVED` — Invitation reçue

| | |
|---|---|
| Destinataires | Chaque numéro invité (SMS, sans compte) ; si le numéro appartient à un compte vérifié, ce compte reçoit aussi application, push et email. |
| Déclencheur | L’organisatrice envoie des invitations (fonction ticket_invitation_create). |
| Canaux | SMS, cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par numéro et par envoi, avec le nombre d’invitations de ce numéro. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261110000008_lot9ter_invites.sql:418-431 ; catalogue : lib/notifications/catalog.ts:698 ; registre : M/20261109000003_lot9bis_registre.sql:89 |
| Scénario détaillé | 07-billets.md |

- SMS — modèle : `Event Village : {n} invitations pour {titre} le {date}. Connectez-vous avec ce numéro : {URL}/tickets`
  - Exemple : `Event Village : 2 invitations pour Concert Test le sam. 14 nov. à 20:00. Connectez-vous avec ce numéro : https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 140 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 159 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 28 caractères ; valeurs saisies coupées à : titre ≤ 28 (avec « ... »).
- Cloche — titre : `Invitation reçue` ; texte : `{n} invitations pour « {titre} » le {date} : vos billets sont dans Mes billets.` ; lien : `/tickets?tab=recus`
  - Exemple : `Invitation reçue` — `2 invitations pour « Concert Test » le sam. 14 nov. 2026 à 20:00 : vos billets sont dans Mes billets.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Invitation reçue — Event Village` ; exemple : `Invitation reçue — Event Village` ; bouton vers `{URL}/tickets?tab=recus`

#### `TRANSFER_OFFERED` — Billet transféré (offre)

| | |
|---|---|
| Destinataires | Le destinataire du transfert : SMS au numéro saisi ; application, push et email au compte dont le numéro vérifié par code est ce numéro. |
| Déclencheur | Un client transfère un billet (fonction ticket_transfer_initiate). |
| Canaux | SMS, cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par transfert. L’expéditeur est le « compte déclencheur » du SMS. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000008_lot9bis_cycle.sql:1482-1500 ; catalogue : lib/notifications/catalog.ts:708 ; registre : M/20261109000003_lot9bis_registre.sql:101 |
| Scénario détaillé | 07-billets.md |

- SMS — modèle : `Event Village : un billet {titre} vous est transféré. Connectez-vous avec ce numéro avant le {échéance courte} : {URL}/tickets`
  - Exemple : `Event Village : un billet Concert Test vous est transféré. Connectez-vous avec ce numéro avant le 12 nov. à 18:30 : https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 151 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 160 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 27 caractères ; valeurs saisies coupées à : titre ≤ 20 (avec « ... »).
- Cloche — titre : `Un billet vous est transféré` ; texte : `Un billet pour « {titre} » vous attend. Acceptez-le avant le {échéance}.` ; lien : `/tickets?tab=recus`
  - Exemple : `Un billet vous est transféré` — `Un billet pour « Concert Test » vous attend. Acceptez-le avant le jeu. 12 nov. 2026 à 18:30.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Un billet vous est transféré — Event Village` ; exemple : `Un billet vous est transféré — Event Village` ; bouton vers `{URL}/tickets?tab=recus`

#### `TRANSFER_CANCELLED` — Transfert annulé

| | |
|---|---|
| Destinataires | Le destinataire du transfert (SMS au numéro ; application, push, email au compte vérifié de ce numéro). |
| Déclencheur | L’expéditeur annule son transfert (fonction ticket_transfer_cancel). |
| Canaux | SMS, cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par transfert annulé. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000008_lot9bis_cycle.sql:2543-2562 ; catalogue : lib/notifications/catalog.ts:718 ; registre : M/20261109000003_lot9bis_registre.sql:102 |
| Scénario détaillé | 07-billets.md |

- SMS — modèle : `Event Village : le transfert du billet {titre} a été annulé par son propriétaire.`
  - Exemple : `Event Village : le transfert du billet Concert Test a été annulé par son propriétaire.`
  - Mesure de l’exemple : 86 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 104 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Cloche — titre : `Transfert annulé` ; texte : `Le transfert du billet pour « {titre} » a été annulé par son propriétaire.` ; lien : `/tickets`
  - Exemple : `Transfert annulé` — `Le transfert du billet pour « Concert Test » a été annulé par son propriétaire.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Transfert annulé — Event Village` ; exemple : `Transfert annulé — Event Village` ; bouton vers `{URL}/tickets`

#### `TRANSFER_EXPIRED` — Transfert expiré

| | |
|---|---|
| Destinataires | L’expéditeur du transfert (jamais pour une invitation, qui n’a pas d’expéditeur). |
| Déclencheur | Transfert resté sans réponse 48 h : tâche horaire ticket-transfers, ou tentative d’accepter ou de refuser après l’échéance. |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par transfert (même clé dans les deux chemins : aucun doublon). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000008_lot9bis_cycle.sql:1556-1564 (tâche) et M/20261109000008_lot9bis_cycle.sql:982-990 (à la tentative) ; catalogue : lib/notifications/catalog.ts:725 ; registre : M/20261109000003_lot9bis_registre.sql:103 |
| Scénario détaillé | 07-billets.md |

- Cloche — titre : `Transfert expiré` ; texte : `Votre billet pour « {titre} » n'a pas été accepté à temps : il reste dans vos billets.` ; lien : `/tickets`
  - Exemple : `Transfert expiré` — `Votre billet pour « Concert Test » n'a pas été accepté à temps : il reste dans vos billets.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Transfert expiré — Event Village` ; exemple : `Transfert expiré — Event Village` ; bouton vers `{URL}/tickets`

#### `TRANSFER_CLAIMED_SENDER` — Transfert accepté (expéditeur)

| | |
|---|---|
| Destinataires | L’expéditeur du transfert. |
| Déclencheur | Le destinataire accepte le billet (fonction ticket_transfer_accept). |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par transfert accepté. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261110000008_lot9ter_invites.sql:636-640 ; catalogue : lib/notifications/catalog.ts:731 ; registre : M/20261109000003_lot9bis_registre.sql:104 |
| Scénario détaillé | 07-billets.md |

- Cloche — titre : `Billet accepté` ; texte : `Votre billet pour « {titre} » a été accepté par son destinataire.` ; lien : `/tickets?tab=historique`
  - Exemple : `Billet accepté` — `Votre billet pour « Concert Test » a été accepté par son destinataire.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Billet accepté — Event Village` ; exemple : `Billet accepté — Event Village` ; bouton vers `{URL}/tickets?tab=historique`

#### `TRANSFER_RECEIVED` — Billet reçu

| | |
|---|---|
| Destinataires | Le compte qui accepte le billet (transfert d’un client ou invitation réclamée). |
| Déclencheur | Acceptation du billet (fonction ticket_transfer_accept), avec le nouveau numéro du billet. |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par acceptation. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261110000008_lot9ter_invites.sql:643-649 ; catalogue : lib/notifications/catalog.ts:740 ; registre : M/20261105000007_lot7_confirmation.sql:397 |
| Scénario détaillé | 07-billets.md |

**Variante : avec le numéro du billet (cas normal)**

- Cloche — titre : `Billet reçu` ; texte : `Le billet {numéro du billet} pour « {titre} » du {date} est ajouté à Mes billets.` ; lien : `/tickets`
  - Exemple : `Billet reçu` — `Le billet TCK-20261104-9E4B1C7A2F pour « Concert Test » du sam. 14 nov. 2026 à 20:00 est ajouté à Mes billets.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Billet reçu — Event Village` ; exemple : `Billet reçu — Event Village` ; bouton vers `{URL}/tickets`
  - Version texte complète de l’exemple (email propre au type) :

```text
Billet reçu

Le billet TCK-20261104-9E4B1C7A2F pour « Concert Test » du sam. 14 nov. 2026 à 20:00 est ajouté à Mes billets.

Événement : Concert Test
Date : sam. 14 nov. 2026 à 20:00
Lieu : Grand Théâtre, Dakar
Catégorie : VIP
Numéro du billet : TCK-20261104-9E4B1C7A2F

Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée.

Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion.

Voir mes billets : {URL}/tickets

En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.

—
Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn
```


**Variante : sans numéro (ligne mise en file avant le lot 7)**

- Cloche — titre : `Billet reçu` ; texte : `Le billet pour « {titre} » est ajouté à vos billets.` ; lien : `/tickets`
  - Exemple : `Billet reçu` — `Le billet pour « Concert Test » est ajouté à vos billets.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Billet reçu — Event Village` ; exemple : `Billet reçu — Event Village` ; bouton vers `{URL}/tickets`
  - Version texte complète de l’exemple (email propre au type) :

```text
Billet reçu

Le billet pour « Concert Test » est ajouté à vos billets.

Événement : Concert Test
Date : sam. 14 nov. 2026 à 20:00
Lieu : Grand Théâtre, Dakar

Votre billet s'affiche dans l'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d'écran ne sera pas acceptée à l'entrée.

Ouvrez votre billet avec du réseau avant d'arriver : il restera disponible même sans connexion.

Voir mes billets : {URL}/tickets

En cas de problème à l'entrée, présentez le numéro de votre billet et une pièce d'identité : le contrôleur peut l'enregistrer à la main.

—
Message automatique d'Event Village, merci de ne pas y répondre. Support : support@eventvillage.sn
```


#### `TICKET_SCANNED` — Entrée validée

| | |
|---|---|
| Destinataires | Le porteur (compte) du billet contrôlé ; jamais pour un billet vendu au guichet. |
| Déclencheur | Billet passé de « valable » à « utilisé » par le scanner ou l’entrée payée en espèces. |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Regroupé par commande : le message part 2 minutes après le premier billet contrôlé ; chaque billet de la même commande contrôlé avant le départ s’ajoute au compte ({n} billets). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000005_lot6_billetterie.sql:883-887 (déclencheur) ; M/20261109000009_lot9bis_messages.sql:1561-1593 (regroupement) ; catalogue : lib/notifications/catalog.ts:763 ; registre : M/20261109000003_lot9bis_registre.sql:90 |

**Variante : un billet**

- Cloche — titre : `Entrée validée` ; texte : `Votre billet pour « {titre} » a été contrôlé à l'entrée.` ; lien : `/tickets?tab=historique`
  - Exemple : `Entrée validée` — `Votre billet pour « Concert Test » a été contrôlé à l'entrée.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Entrée validée — Event Village` ; exemple : `Entrée validée — Event Village` ; bouton vers `{URL}/tickets?tab=historique`

**Variante : plusieurs billets de la même commande**

- Cloche — titre : `Entrée validée` ; texte : `{n} billets de votre commande pour « {titre} » ont été contrôlés à l'entrée.` ; lien : `/tickets?tab=historique`
  - Exemple : `Entrée validée` — `3 billets de votre commande pour « Concert Test » ont été contrôlés à l'entrée.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Entrée validée — Event Village` ; exemple : `Entrée validée — Event Village` ; bouton vers `{URL}/tickets?tab=historique`

#### `EVENT_CANCELLED` — Annulation d’un événement

| | |
|---|---|
| Destinataires | Porteurs d’un billet valable ou utilisé, et acheteurs d’origine des billets payés en ligne (comptes) ; numéros sans compte (invitation non réclamée, acheteur au guichet, destinataire d’un transfert révoqué) : SMS seul, sans lien. |
| Déclencheur | Passage de l’événement à « Annulé » (par la partenaire ou par l’administration) : déclencheur sur l’historique des statuts. |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par destinataire et par événement. Le mode de remboursement est choisi par destinataire (premier cas vrai : a payé en ligne → automatique ; billet reçu d’un autre acheteur → à l’acheteur d’origine ; payé au guichet → auprès de l’organisateur ; sinon aucun). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261103000005_lot6_billetterie.sql:1326-1328 ; M/20261109000009_lot9bis_messages.sql:223-302 ; catalogue : lib/notifications/catalog.ts:777 ; registre : M/20261103000002_lot6_outbox.sql:87 |
| Scénario détaillé | 04-evenement-cycle.md |

**Variante : compte, remboursement automatique**

- Cloche — titre : `Événement annulé` ; texte : `« {titre} » du {date} est annulé. {avis public}. Votre remboursement est en cours.` ; lien : `/tickets`
  - Exemple : `Événement annulé` — `« Concert Test » du sam. 14 nov. 2026 à 20:00 est annulé. Intempéries annoncées sur Dakar. Votre remboursement est en cours.`
- SMS — modèle : `Event Village : {titre} du {date} est annulé. Remboursement automatique en cours. {URL}/tickets`
  - Exemple : `Event Village : Concert Test du sam. 14 nov. à 20:00 est annulé. Remboursement automatique en cours. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 136 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 155 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 32 caractères ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Événement annulé — Event Village` ; exemple : `Événement annulé — Event Village` ; bouton vers `{URL}/tickets`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

**Variante : compte, billet reçu par transfert**

- Cloche — titre : `Événement annulé` ; texte : `« {titre} » du {date} est annulé. {avis public}. Le remboursement va à l'acheteur d'origine du billet.` ; lien : `/tickets`
  - Exemple : `Événement annulé` — `« Concert Test » du sam. 14 nov. 2026 à 20:00 est annulé. Intempéries annoncées sur Dakar. Le remboursement va à l'acheteur d'origine du billet.`
- SMS — modèle : `Event Village : {titre} du {date} est annulé. Remboursement à l'acheteur d'origine. {URL}/tickets`
  - Exemple : `Event Village : Concert Test du sam. 14 nov. à 20:00 est annulé. Remboursement à l'acheteur d'origine. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 138 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 157 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 30 caractères ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Événement annulé — Event Village` ; exemple : `Événement annulé — Event Village` ; bouton vers `{URL}/tickets`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

**Variante : compte, payé au guichet**

- Cloche — titre : `Événement annulé` ; texte : `« {titre} » du {date} est annulé. {avis public}. Le remboursement se fait auprès de l'organisateur.` ; lien : `/tickets`
  - Exemple : `Événement annulé` — `« Concert Test » du sam. 14 nov. 2026 à 20:00 est annulé. Intempéries annoncées sur Dakar. Le remboursement se fait auprès de l'organisateur.`
- SMS — modèle : `Event Village : {titre} du {date} est annulé. Remboursement par l'organisateur. {URL}/tickets`
  - Exemple : `Event Village : Concert Test du sam. 14 nov. à 20:00 est annulé. Remboursement par l'organisateur. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 134 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 153 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 34 caractères ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Événement annulé — Event Village` ; exemple : `Événement annulé — Event Village` ; bouton vers `{URL}/tickets`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

**Variante : compte, billet gratuit ou invitation**

- Cloche — titre : `Événement annulé` ; texte : `« {titre} » du {date} est annulé.` ; lien : `/tickets`
  - Exemple : `Événement annulé` — `« Concert Test » du sam. 14 nov. 2026 à 20:00 est annulé.`
- SMS — modèle : `Event Village : {titre} du {date} est annulé. Détails : {URL}/tickets`
  - Exemple : `Event Village : Concert Test du sam. 14 nov. à 20:00 est annulé. Détails : https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 110 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 129 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 58 caractères ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Événement annulé — Event Village` ; exemple : `Événement annulé — Event Village` ; bouton vers `{URL}/tickets`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

**Variante : numéro seul, acheteur au guichet (SMS seul)**

- SMS — modèle : `Event Village : {titre} du {date} est annulé. Remboursement par l'organisateur.`
  - Exemple : `Event Village : Concert Test du sam. 14 nov. à 20:00 est annulé. Remboursement par l'organisateur.`
  - Mesure de l’exemple : 98 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 117 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).

**Variante : numéro seul, invitation non réclamée ou transfert révoqué (SMS seul)**

- SMS — modèle : `Event Village : {titre} du {date} est annulé. Le billet qui vous était destiné n'est plus valable.`
  - Exemple : `Event Village : Concert Test du sam. 14 nov. à 20:00 est annulé. Le billet qui vous était destiné n'est plus valable.`
  - Mesure de l’exemple : 117 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 136 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).

#### `EVENT_SUSPENDED_HOLDER` — Suspension d’un événement (porteurs)

| | |
|---|---|
| Destinataires | Porteurs (comptes) d’un billet valable ou utilisé. |
| Déclencheur | Passage de « Publié » à « Suspendu ». |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | optionnel — sujet « Suspension et reprise d’un événement » (préférences) |
| Regroupement | Un message par porteur. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:171,178-187 ; catalogue : lib/notifications/catalog.ts:811 ; registre : M/20261109000003_lot9bis_registre.sql:96 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement suspendu` ; texte : `« {titre} » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite.` ; lien : `/events/{id}`
  - Exemple : `Événement suspendu` — `« Concert Test » est suspendu pour le moment. Vos billets restent valables, vous serez prévenu de la suite.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Événement suspendu — Event Village` ; exemple : `Événement suspendu — Event Village` ; bouton vers `{URL}/events/{id}` ; pied « Ne plus recevoir ces emails : {URL}/profile/notifications?topic=EVENT_UPDATES »

#### `EVENT_REACTIVATED_HOLDER` — Reprise d’un événement (porteurs)

| | |
|---|---|
| Destinataires | Porteurs (comptes) d’un billet valable ou utilisé. |
| Déclencheur | Passage de « Suspendu » à « Publié ». |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | optionnel — sujet « Suspension et reprise d’un événement » (préférences) |
| Regroupement | Un message par porteur. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:198,205-212 ; catalogue : lib/notifications/catalog.ts:817 ; registre : M/20261109000003_lot9bis_registre.sql:97 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement de nouveau en ligne` ; texte : `« {titre} » reprend comme prévu. Vos billets restent valables.` ; lien : `/events/{id}`
  - Exemple : `Événement de nouveau en ligne` — `« Concert Test » reprend comme prévu. Vos billets restent valables.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Événement de nouveau en ligne — Event Village` ; exemple : `Événement de nouveau en ligne — Event Village` ; bouton vers `{URL}/events/{id}` ; pied « Ne plus recevoir ces emails : {URL}/profile/notifications?topic=EVENT_UPDATES »

#### `EVENT_CHANGED` — Changement d’un événement

| | |
|---|---|
| Destinataires | Porteurs (comptes, non supprimés) d’un billet valable, ou utilisé pour un événement de plusieurs jours ; numéros sans compte (invitation non réclamée, acheteur au guichet) : SMS seul. |
| Déclencheur | Modification par la partenaire d’un événement Validé, Publié ou Suspendu, si le titre, la date ou l’heure (début ou fin), le lieu, la ville ou l’adresse changent (fonction event_update). |
| Canaux | cloche (application), push, SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Application et push : un message à chaque modification. SMS et email : dus 10 minutes après la première modification ; les modifications suivantes dans ces 10 minutes s’ajoutent au même message (fenêtre fixe, jamais prolongée) ; tout de suite si l’ancien ou le nouveau début est à moins d’une heure (M/20261109000009_lot9bis_messages.sql:732-733). Titre seul : aucun SMS (ligne « Non envoyée », motif « Seul le titre a changé », M/20261109000009_lot9bis_messages.sql:783-786) et aucun email nouveau. À l’envoi, la ligne est annulée si l’événement n’est plus Validé, Publié ou Suspendu, et non envoyée si le porteur n’a plus de billet valable (M/20261109000010_lot9bis_email.sql:476-485). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:505,655-676 (champs suivis) ; M/20261109000009_lot9bis_messages.sql:705-865 (mise en file) ; catalogue : lib/notifications/catalog.ts:824 ; registre : M/20261109000003_lot9bis_registre.sql:88 |
| Scénario détaillé | 04-evenement-cycle.md |

**Variante : date de début changée**

- Cloche — titre : `Événement modifié` ; texte : `« {titre} » : nouvelle date : {nouvelle date}. Vos billets restent valables.` ; lien : `/events/{id}`
  - Exemple : `Événement modifié` — `« Concert Test » : nouvelle date : sam. 21 nov. 2026 à 21:00. Vos billets restent valables.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} change de date : {nouvelle date}. Vos billets restent valables. {URL}/tickets`
  - Exemple : `Event Village : Concert Test change de date : sam. 21 nov. à 21:00. Vos billets restent valables. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 133 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 152 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 35 caractères.
- Email — sujet : `Événement modifié — Event Village` ; exemple : `Événement modifié — Event Village` ; bouton vers `{URL}/events/{id}`

**Variante : lieu changé**

- Cloche — titre : `Événement modifié` ; texte : `« {titre} » : nouveau lieu : {nouveau lieu}. Vos billets restent valables.` ; lien : `/events/{id}`
  - Exemple : `Événement modifié` — `« Concert Test » : nouveau lieu : Place de l’Obélisque. Vos billets restent valables.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} change de lieu : {nouveau lieu}. Vos billets restent valables. {URL}/tickets`
  - Exemple : `Event Village : Concert Test change de lieu : Place de l'Obélisque. Vos billets restent valables. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 133 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 155 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 32 caractères.
- Email — sujet : `Événement modifié — Event Village` ; exemple : `Événement modifié — Event Village` ; bouton vers `{URL}/events/{id}`

**Variante : date et lieu changés**

- Cloche — titre : `Événement modifié` ; texte : `« {titre} » : nouvelle date : {nouvelle date}, nouveau lieu : {nouveau lieu}. Vos billets restent valables.` ; lien : `/events/{id}`
  - Exemple : `Événement modifié` — `« Concert Test » : nouvelle date : sam. 21 nov. 2026 à 21:00, nouveau lieu : Place de l’Obélisque. Vos billets restent valables.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} change : {nouvelle date}, {nouveau lieu}. Billets toujours valables. {URL}/tickets`
  - Exemple : `Event Village : Concert Test change : sam. 21 nov. à 21:00, Place de l'Obélisque. Billets toujours valables. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 144 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 157 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 30 caractères.
- Email — sujet : `Événement modifié — Event Village` ; exemple : `Événement modifié — Event Village` ; bouton vers `{URL}/events/{id}`

**Variante : ville seule changée**

- Cloche — titre : `Événement modifié` ; texte : `« {titre} » : nouvelle ville : {ville}. Vos billets restent valables.` ; lien : `/events/{id}`
  - Exemple : `Événement modifié` — `« Concert Test » : nouvelle ville : Thiès. Vos billets restent valables.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} change de lieu : {lieu}, {ville}. Vos billets restent valables. {URL}/tickets`
  - Exemple : `Event Village : Concert Test change de lieu : Grand Théatre, Thiès. Vos billets restent valables. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 133 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 155 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 32 caractères.
- Email — sujet : `Événement modifié — Event Village` ; exemple : `Événement modifié — Event Village` ; bouton vers `{URL}/events/{id}`

**Variante : heure de fin seule changée**

- Cloche — titre : `Événement modifié` ; texte : `« {titre} » : nouvelle fin : {nouvelle fin}. Vos billets restent valables.` ; lien : `/events/{id}`
  - Exemple : `Événement modifié` — `« Concert Test » : nouvelle fin : dim. 15 nov. 2026 à 02:00. Vos billets restent valables.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} : nouvelle fin le {nouvelle fin}. Vos billets restent valables. {URL}/tickets`
  - Exemple : `Event Village : Concert Test : nouvelle fin le dim. 15 nov. à 02:00. Vos billets restent valables. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 134 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 153 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 34 caractères.
- Email — sujet : `Événement modifié — Event Village` ; exemple : `Événement modifié — Event Village` ; bouton vers `{URL}/events/{id}`

**Variante : report de plus de 24 h qui ouvre le remboursement**

- Cloche — titre : `Événement modifié` ; texte : `« {titre} » est reporté au {nouvelle date}. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement.` ; lien : `/events/{id}`
  - Exemple : `Événement modifié` — `« Concert Test » est reporté au sam. 21 nov. 2026 à 21:00. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} reporté au {nouvelle date}. Remboursement total possible avant cette date : {URL}/tickets`
  - Exemple : `Event Village : Concert Test reporté au sam. 21 nov. à 21:00. Remboursement total possible avant cette date : https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 145 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 154 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 33 caractères.
- Email — sujet : `Événement modifié — Event Village` ; exemple : `Événement modifié — Event Village` ; bouton vers `{URL}/events/{id}`

**Variante : report qui ouvre le remboursement, avec nouveau lieu**

- Cloche — titre : `Événement modifié` ; texte : `« {titre} » est reporté au {nouvelle date}, nouveau lieu : {nouveau lieu}. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement.` ; lien : `/events/{id}`
  - Exemple : `Événement modifié` — `« Concert Test » est reporté au sam. 21 nov. 2026 à 21:00, nouveau lieu : Place de l’Obélisque. Vos billets restent valables ; vous pouvez aussi demander leur remboursement total, frais compris, dans Mes billets jusqu'au début de l'événement.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} reporté au {nouvelle date}, nouveau lieu. Remboursement total avant cette date : {URL}/tickets`
  - Exemple : `Event Village : Concert Test reporté au sam. 21 nov. à 21:00, nouveau lieu. Remboursement total avant cette date : https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 150 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 159 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 28 caractères.
- Email — sujet : `Événement modifié — Event Village` ; exemple : `Événement modifié — Event Village` ; bouton vers `{URL}/events/{id}`

**Variante : adresse retirée**

- Cloche — titre : `Événement modifié` ; texte : `« {titre} » : adresse retirée. Vos billets restent valables.` ; lien : `/events/{id}`
  - Exemple : `Événement modifié` — `« Concert Test » : adresse retirée. Vos billets restent valables.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} : adresse retirée, lieu {lieu}. Billets toujours valables. {URL}/tickets`
  - Exemple : `Event Village : Concert Test : adresse retirée, lieu Grand Théatre. Billets toujours valables. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 130 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 154 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 33 caractères.
- Email — sujet : `Événement modifié — Event Village` ; exemple : `Événement modifié — Event Village` ; bouton vers `{URL}/events/{id}`

**Variante : titre seul changé (aucun SMS)**

- Cloche — titre : `Événement modifié` ; texte : `« {titre} » : nouveau titre (ancien titre : « {ancien titre} »). Vos billets restent valables.` ; lien : `/events/{id}`
  - Exemple : `Événement modifié` — `« Concert Test » : nouveau titre (ancien titre : « Concert Essai »). Vos billets restent valables.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS : aucun. Le catalogue ne produit pas de SMS quand seul le titre change (lib/notifications/catalog.ts:452-453) ; la ligne SMS est écrite « Non envoyée », motif « Seul le titre a changé » (M/20261109000009_lot9bis_messages.sql:783-786).
- Email — sujet : `Événement modifié — Event Village` ; exemple : `Événement modifié — Event Village` ; bouton vers `{URL}/events/{id}`

#### `REMINDER_J1` — Rappel la veille

| | |
|---|---|
| Destinataires | Porteurs (comptes) d’un billet valable acheté ou reçu avant l’heure du rappel. |
| Déclencheur | La veille du début, à l’heure réglée (notif.reminder_j1_hour, 10 h par défaut, de 6 à 20) ; tâche « reminders » toutes les 5 minutes, fenêtre de 15 minutes. |
| Canaux | cloche (application), push, SMS, email |
| Indispensable ou optionnel | optionnel — sujet « Rappels avant l’événement » (préférences) |
| Regroupement | Un rappel par porteur, par événement et par date de début. SMS selon notif.j1_sms (ALWAYS par défaut) ; porteur de billets gratuits ou d’invitations seulement : pas de SMS si notif.free_ticket_reminder_sms = NEVER (défaut, M/20261105000001_lot7_reglages.sql:32-33), ligne « Billets gratuits seulement : rappel sans SMS ». À l’envoi : annulé si l’événement n’est plus publié, a changé de début ou a commencé ; non envoyé sans billet valable (M/20261109000010_lot9bis_email.sql:452-475). |
| Heures calmes (22 h–8 h) | **SMS : non envoyé, perdu** (motif « Plage sans SMS (nuit) ») ; cloche, push et email : envoyés normalement |
| Plafond quotidien | SMS : budget des SMS optionnels (700 par jour de Dakar), part hors codes du plafond global, 30 par numéro et par jour |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261105000002_lot7_sms.sql:637-662 ; réglages M/20261103000003_lot6_reglages.sql:22-31 ; catalogue : lib/notifications/catalog.ts:831 ; registre : M/20261103000002_lot6_outbox.sql:91 |
| Scénario détaillé | 12-taches-planifiees.md |

- Cloche — titre : `Rappel : c'est demain` ; texte : `« {titre} » demain à {heure}, {lieu}, {ville}. Vos billets sont dans Mes billets.` ; lien : `/tickets`
  - Exemple : `Rappel : c'est demain` — `« Concert Test » demain à 20:00, Grand Théâtre, Dakar. Vos billets sont dans Mes billets.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : rappel, {titre} demain à {heure}, {lieu}. Vos billets : {URL}/tickets`
  - Exemple : `Event Village : rappel, Concert Test demain à 20:00, Grand Théatre. Vos billets : https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 117 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 151 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 36 caractères ; valeurs saisies coupées à : titre ≤ 30, lieu ≤ 30 (avec « ... »).
- Email — sujet : `Rappel : c'est demain — Event Village` ; exemple : `Rappel : c'est demain — Event Village` ; bouton vers `{URL}/tickets` ; pied « Ne plus recevoir ces emails : {URL}/profile/notifications?topic=REMINDERS »

#### `REMINDER_H3` — Rappel avant le début

| | |
|---|---|
| Destinataires | Porteurs (comptes) d’un billet valable acheté ou reçu avant l’heure du rappel. |
| Déclencheur | Quelques heures avant le début (notif.reminder_h3_hours, 3 h par défaut, de 1 à 12) ; même tâche que la veille. |
| Canaux | cloche (application), push, SMS, email |
| Indispensable ou optionnel | optionnel — sujet « Rappels avant l’événement » (préférences) |
| Regroupement | Un rappel par porteur, par événement et par date de début. SMS selon notif.h3_sms (IF_NO_PUSH par défaut : le SMS attend jusqu’à 15 minutes le résultat du push et ne part pas si le push a été accepté, motif « Push accepté par le service, SMS non envoyé (affichage non garanti) », M/20261109000010_lot9bis_email.sql:505-521). |
| Heures calmes (22 h–8 h) | **SMS : non envoyé, perdu** (motif « Plage sans SMS (nuit) ») ; cloche, push et email : envoyés normalement |
| Plafond quotidien | SMS : budget des SMS optionnels (700 par jour de Dakar), part hors codes du plafond global, 30 par numéro et par jour |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261105000002_lot7_sms.sql:665-697 ; catalogue : lib/notifications/catalog.ts:841 ; registre : M/20261109000003_lot9bis_registre.sql:98 |
| Scénario détaillé | 12-taches-planifiees.md |

- Cloche — titre : `C'est bientôt` ; texte : `« {titre} » commence à {heure} ({lieu}). Ouvrez votre billet dans l'application avant d'arriver : il restera disponible sans réseau.` ; lien : `/tickets`
  - Exemple : `C'est bientôt` — `« Concert Test » commence à 20:00 (Grand Théâtre). Ouvrez votre billet dans l'application avant d'arriver : il restera disponible sans réseau.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} à {heure}. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. {URL}/tickets`
  - Exemple : `Event Village : Concert Test à 20:00. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 141 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 154 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 33 caractères ; valeurs saisies coupées à : titre ≤ 25 (avec « ... »).
- Email — sujet : `C'est bientôt — Event Village` ; exemple : `C'est bientôt — Event Village` ; bouton vers `{URL}/tickets` ; pied « Ne plus recevoir ces emails : {URL}/profile/notifications?topic=REMINDERS »

#### `REFUND_REQUESTED` — Remboursement demandé

| | |
|---|---|
| Destinataires | Le titulaire du remboursement (compte). |
| Déclencheur | Création d’un remboursement de billet (versement de type « remboursement d’un billet »). |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par remboursement. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:384-392 ; catalogue : lib/notifications/catalog.ts:852 ; registre : M/20261109000003_lot9bis_registre.sql:105 |
| Scénario détaillé | 08-argent.md |

- Cloche — titre : `Remboursement demandé` ; texte : `Le remboursement de votre billet pour « {titre} » ({montant}) est en cours.` ; lien : `/tickets?tab=historique`
  - Exemple : `Remboursement demandé` — `Le remboursement de votre billet pour « Concert Test » (5 000 F CFA) est en cours.`
- Email — sujet : `Remboursement demandé — Event Village` ; exemple : `Remboursement demandé — Event Village` ; bouton vers `{URL}/tickets?tab=historique`

#### `REFUND_PAID` — Remboursement versé

| | |
|---|---|
| Destinataires | Le bénéficiaire du remboursement : son compte ; sans numéro sur le compte, le numéro du versement (SMS). |
| Déclencheur | Versement d’un remboursement confirmé (remboursement d’un paiement, d’une annulation ou d’un billet). |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par versement. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:466-476 ; catalogue : lib/notifications/catalog.ts:858 ; registre : M/20261103000002_lot6_outbox.sql:94 |
| Scénario détaillé | 08-argent.md |

**Variante : avec l’événement**

- Cloche — titre : `Remboursement versé` ; texte : `{montant} vous ont été remboursés sur votre compte {opérateur} pour « {titre} ».` ; lien : `/tickets?tab=historique`
  - Exemple : `Remboursement versé` — `5 000 F CFA vous ont été remboursés sur votre compte Wave pour « Concert Test ».`
- SMS — modèle : `Event Village : remboursement de {montant} versé sur votre compte {opérateur} ({titre}).`
  - Exemple : `Event Village : remboursement de 5 000 F CFA versé sur votre compte Wave (Concert Test).`
  - Mesure de l’exemple : 88 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 110 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Remboursement versé — Event Village` ; exemple : `Remboursement versé — Event Village` ; bouton vers `{URL}/tickets?tab=historique`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

**Variante : sans événement connu**

- Cloche — titre : `Remboursement versé` ; texte : `{montant} vous ont été remboursés sur votre compte {opérateur}.` ; lien : `/tickets?tab=historique`
  - Exemple : `Remboursement versé` — `5 000 F CFA vous ont été remboursés sur votre compte Wave.`
- SMS — modèle : `Event Village : remboursement de {montant} versé sur votre compte {opérateur}.`
  - Exemple : `Event Village : remboursement de 5 000 F CFA versé sur votre compte Wave.`
  - Mesure de l’exemple : 73 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 77 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Remboursement versé — Event Village` ; exemple : `Remboursement versé — Event Village` ; bouton vers `{URL}/tickets?tab=historique`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `PASSWORD_CHANGED` — Mot de passe modifié

| | |
|---|---|
| Destinataires | Le compte dont le mot de passe vient d’être défini ou modifié (tous rôles). |
| Déclencheur | Toute écriture d’un nouveau mot de passe (déclencheur sur la table des comptes d’authentification), sauf l’activation d’un compte de contrôleur créé par invitation. |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par changement. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:945-950 ; M/20261109000009_lot9bis_messages.sql:1608-1631 ; catalogue : lib/notifications/catalog.ts:874 ; registre : M/20261103000002_lot6_outbox.sql:95 |
| Scénario détaillé | 02-comptes.md |

- Cloche — titre : `Mot de passe modifié` ; texte : `Le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.` ; lien : `/profile`
  - Exemple : `Mot de passe modifié` — `Le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.`
- SMS — modèle : `Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.`
  - Exemple : `Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n'est pas vous, contactez le support.`
  - Mesure de l’exemple : 116 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 116 caractères, GSM-7, 1 segment.
- Email — sujet : `Mot de passe modifié — Event Village` ; exemple : `Mot de passe modifié — Event Village` ; bouton vers `{URL}/profile`

#### `PHONE_CHANGED` — Numéro de téléphone modifié

| | |
|---|---|
| Destinataires | L’ANCIEN numéro du compte (SMS) et le compte lui-même (email seulement). |
| Déclencheur | Changement de numéro confirmé par code (fonction account_phone_finalize). |
| Canaux | SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Deux lignes : SMS à l’ancien numéro, email au compte. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000004_lot9bis_droits.sql:839-855 ; catalogue : lib/notifications/catalog.ts:886 ; registre : M/20261109000003_lot9bis_registre.sql:92 |
| Scénario détaillé | 02-comptes.md |

- SMS — modèle : `Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support.`
  - Exemple : `Event Village : le numéro de votre compte a été modifié. Si ce n'est pas vous, contactez le support.`
  - Mesure de l’exemple : 100 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 100 caractères, GSM-7, 1 segment.
- Email — sujet : `Numéro de téléphone modifié — Event Village` ; exemple : `Numéro de téléphone modifié — Event Village` ; bouton vers `{URL}/profile`

#### `PUSH_TEST` — Notification d’essai

| | |
|---|---|
| Destinataires | Le compte qui demande une notification d’essai depuis ses préférences. |
| Déclencheur | Bouton d’essai (route /api/notifications/essai-push, fonction notification_test_push_enqueue). |
| Canaux | push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Au plus un essai par compte et par minute (clé à la minute) ; limite PUSH_TEST_PER_USER_HOUR = 5 par heure (lib/env.ts:144). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : app/api/notifications/essai-push/route.ts:67 ; M/20261103000002_lot6_outbox.sql:1360-1386 ; catalogue : lib/notifications/catalog.ts:896 ; registre : M/20261103000002_lot6_outbox.sql:96 |

- Push — titre : `Notification d'essai` ; texte : `Les notifications fonctionnent sur cet appareil.` ; lien : `/profile/notifications`

#### `EVENT_VALIDATED` — Événement validé

| | |
|---|---|
| Destinataires | La propriétaire de l’événement (compte de la partenaire). |
| Déclencheur | Passage de « En attente » à « Validé » (validation par l’administration). |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par validation. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:157-162 ; catalogue : lib/notifications/catalog.ts:902 ; registre : M/20261103000002_lot6_outbox.sql:97 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement validé` ; texte : `« {titre} » est validé. Vous pouvez le publier depuis votre espace.` ; lien : `/partner/events/{id}`
  - Exemple : `Événement validé` — `« Concert Test » est validé. Vous pouvez le publier depuis votre espace.`
- SMS — modèle : `Event Village : votre événement {titre} est validé. Publiez-le depuis votre espace : {URL}/partner/events`
  - Exemple : `Event Village : votre événement Concert Test est validé. Publiez-le depuis votre espace : https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 132 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 150 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 37 caractères ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Événement validé — Event Village` ; exemple : `Événement validé — Event Village` ; bouton vers `{URL}/partner/events/{id}`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `EVENT_REJECTED` — Événement non validé

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Passage de « En attente » à « Brouillon » décidé par l’administration (refus avec motif). |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par refus. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:149-155 ; catalogue : lib/notifications/catalog.ts:909 ; registre : M/20261103000002_lot6_outbox.sql:98 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement non validé` ; texte : `« {titre} » n'est pas validé. Motif : {motif}.` ; lien : `/partner/events/{id}`
  - Exemple : `Événement non validé` — `« Concert Test » n'est pas validé. Motif : Affiche illisible, merci d’en déposer une nouvelle.`
- SMS — modèle : `Event Village : événement {titre} non validé. Motif : {motif}. {URL}/partner/events`
  - Exemple : `Event Village : événement Concert Test non validé. Motif : Affiche illisible, merci d'en déposer... https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 142 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 155 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 32 caractères ; valeurs saisies coupées à : titre ≤ 25, motif ≤ 40 (avec « ... »).
- Email — sujet : `Événement non validé — Event Village` ; exemple : `Événement non validé — Event Village` ; bouton vers `{URL}/partner/events/{id}`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `EVENT_SUSPENDED` — Événement suspendu

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Passage de « Publié » à « Suspendu », sauf quand la suspension vient de celle du compte partenaire (cascade : la partenaire a déjà PARTNER_SUSPENDED). |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par suspension. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:171-177 ; catalogue : lib/notifications/catalog.ts:916 ; registre : M/20261103000002_lot6_outbox.sql:99 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement suspendu` ; texte : `« {titre} » est suspendu par l'administration. Motif : {motif}.` ; lien : `/partner/events/{id}`
  - Exemple : `Événement suspendu` — `« Concert Test » est suspendu par l'administration. Motif : Signalement en cours d’examen.`
- SMS — modèle : `Event Village : événement {titre} suspendu. Motif : {motif}. {URL}/partner/events`
  - Exemple : `Event Village : événement Concert Test suspendu. Motif : Signalement en cours d'examen. https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 130 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 153 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 34 caractères ; valeurs saisies coupées à : titre ≤ 25, motif ≤ 40 (avec « ... »).
- Email — sujet : `Événement suspendu — Event Village` ; exemple : `Événement suspendu — Event Village` ; bouton vers `{URL}/partner/events/{id}`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `EVENT_REACTIVATED` — Événement réactivé

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Passage de « Suspendu » à « Publié », sauf réactivation en cascade du compte partenaire. |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par reprise. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:198-203 ; catalogue : lib/notifications/catalog.ts:923 ; registre : M/20261103000002_lot6_outbox.sql:100 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement réactivé` ; texte : `« {titre} » est de nouveau en ligne.` ; lien : `/partner/events/{id}`
  - Exemple : `Événement réactivé` — `« Concert Test » est de nouveau en ligne.`
- SMS — modèle : `Event Village : votre événement {titre} est de nouveau en ligne. {URL}/partner/events`
  - Exemple : `Event Village : votre événement Concert Test est de nouveau en ligne. https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 112 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 130 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 57 caractères ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Événement réactivé — Event Village` ; exemple : `Événement réactivé — Event Village` ; bouton vers `{URL}/partner/events/{id}`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `EVENT_PUBLISHED_BY_ADMIN` — Événement publié par l’administration

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Passage de « Validé » à « Publié » fait par l’administration. |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par publication. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:164-169 ; catalogue : lib/notifications/catalog.ts:930 ; registre : M/20261109000003_lot9bis_registre.sql:106 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement publié` ; texte : `« {titre} » a été publié par l'administration.` ; lien : `/partner/events/{id}`
  - Exemple : `Événement publié` — `« Concert Test » a été publié par l'administration.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Événement publié — Event Village` ; exemple : `Événement publié — Event Village` ; bouton vers `{URL}/partner/events/{id}`

#### `FIRST_TICKET_SOLD` — Premier billet vendu

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Premier billet vendu en ligne ou au guichet (billets gratuits et invitations exclus). |
| Canaux | cloche (application), push, SMS, email |
| Indispensable ou optionnel | optionnel — sujet « Activité de vos ventes » (préférences) |
| Regroupement | Une seule fois par événement (aucun message si une ligne existe déjà pour l’événement). |
| Heures calmes (22 h–8 h) | **SMS : non envoyé, perdu** (motif « Plage sans SMS (nuit) ») ; cloche, push et email : envoyés normalement |
| Plafond quotidien | SMS : budget des SMS optionnels (700 par jour de Dakar), part hors codes du plafond global, 30 par numéro et par jour |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000005_lot6_billetterie.sql:831-863 ; billet en ligne par défaut M/20261102000002_lot5_dette.sql:48, gratuit « FREE » M/20261105000007_lot7_confirmation.sql:246 ; catalogue : lib/notifications/catalog.ts:936 ; registre : M/20261103000002_lot6_outbox.sql:102 |

- Cloche — titre : `Premier billet vendu` ; texte : `Le premier billet de « {titre} » est vendu.` ; lien : `/partner/events/{id}?tab=ventes`
  - Exemple : `Premier billet vendu` — `Le premier billet de « Concert Test » est vendu.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : premier billet vendu pour {titre}. Suivez vos ventes : {URL}/partner/events`
  - Exemple : `Event Village : premier billet vendu pour Concert Test. Suivez vos ventes : https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 118 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 135 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 52 caractères ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Premier billet vendu — Event Village` ; exemple : `Premier billet vendu — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=ventes` ; pied « Ne plus recevoir ces emails : {URL}/profile/notifications?topic=PRO_ACTIVITY »

#### `NEW_ORDER` — Nouvelle commande

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Chaque paiement en ligne confirmé (pas les ventes au guichet, ni les billets gratuits, ni les invitations). |
| Canaux | cloche (application) |
| Indispensable ou optionnel | optionnel — sujet « Activité de vos ventes » (préférences) |
| Regroupement | Un message par commande payée ; montant = montant des billets hors frais de service. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261106000003_lot8_paiement.sql:236-248 ; catalogue : lib/notifications/catalog.ts:943 ; registre : M/20261103000002_lot6_outbox.sql:103 |

- Cloche — titre : `Nouvelle commande` ; texte : `{n} billets vendus pour « {titre} » ({total}).` ; lien : `/partner/events/{id}?tab=ventes`
  - Exemple : `Nouvelle commande` — `2 billets vendus pour « Concert Test » (10 000 F CFA).`

#### `CATEGORY_SOLD_OUT` — Catégorie complète

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Une catégorie active atteint sa quantité (achat en ligne, billets gratuits, guichet, ou baisse de la quantité). |
| Canaux | cloche (application), push, SMS, email |
| Indispensable ou optionnel | optionnel — sujet « Activité de vos ventes » (préférences) |
| Regroupement | Une fois par catégorie et par quantité totale : une hausse puis un nouvel épuisement prévient de nouveau. |
| Heures calmes (22 h–8 h) | **SMS : non envoyé, perdu** (motif « Plage sans SMS (nuit) ») ; cloche, push et email : envoyés normalement |
| Plafond quotidien | SMS : budget des SMS optionnels (700 par jour de Dakar), part hors codes du plafond global, 30 par numéro et par jour |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000005_lot6_billetterie.sql:891-935 ; catalogue : lib/notifications/catalog.ts:952 ; registre : M/20261103000002_lot6_outbox.sql:104 |

- Cloche — titre : `Catégorie complète` ; texte : `La catégorie « {catégorie} » de « {titre} » est complète.` ; lien : `/partner/events/{id}?tab=ventes`
  - Exemple : `Catégorie complète` — `La catégorie « Carré VIP » de « Concert Test » est complète.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : la catégorie {catégorie} de {titre} est complète. {URL}/partner/events`
  - Exemple : `Event Village : la catégorie Carré VIP de Concert Test est complète. https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 111 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 145 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 42 caractères ; valeurs saisies coupées à : catégorie ≤ 25, titre ≤ 30 (avec « ... »).
- Email — sujet : `Catégorie complète — Event Village` ; exemple : `Catégorie complète — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=ventes` ; pied « Ne plus recevoir ces emails : {URL}/profile/notifications?topic=PRO_ACTIVITY »

#### `EVENT_SOLD_OUT` — Événement complet

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Dernière catégorie active épuisée (dans le même déclencheur que CATEGORY_SOLD_OUT). |
| Canaux | cloche (application), push, SMS, email |
| Indispensable ou optionnel | optionnel — sujet « Activité de vos ventes » (préférences) |
| Regroupement | Une fois par total des quantités actives. |
| Heures calmes (22 h–8 h) | **SMS : non envoyé, perdu** (motif « Plage sans SMS (nuit) ») ; cloche, push et email : envoyés normalement |
| Plafond quotidien | SMS : budget des SMS optionnels (700 par jour de Dakar), part hors codes du plafond global, 30 par numéro et par jour |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000005_lot6_billetterie.sql:917-926 ; catalogue : lib/notifications/catalog.ts:959 ; registre : M/20261103000002_lot6_outbox.sql:105 |

- Cloche — titre : `Événement complet` ; texte : `Toutes les catégories de « {titre} » sont vendues.` ; lien : `/partner/events/{id}?tab=ventes`
  - Exemple : `Événement complet` — `Toutes les catégories de « Concert Test » sont vendues.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} est complet, toutes les catégories sont vendues. {URL}/partner/events`
  - Exemple : `Event Village : Concert Test est complet, toutes les catégories sont vendues. https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 120 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 138 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 49 caractères ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Événement complet — Event Village` ; exemple : `Événement complet — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=ventes` ; pied « Ne plus recevoir ces emails : {URL}/profile/notifications?topic=PRO_ACTIVITY »

#### `SHIFT_DISCREPANCY` — Écart de caisse

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Fermeture d’une caisse avec un écart non nul entre le montant déclaré et le montant attendu. |
| Canaux | cloche (application), SMS, push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par caisse. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000008_lot9bis_cycle.sql:897-915 ; catalogue : lib/notifications/catalog.ts:966 ; registre : M/20261109000003_lot9bis_registre.sql:107 |
| Scénario détaillé | 05-equipe-controle-acces.md |

**Variante : avec justification**

- Cloche — titre : `Écart de caisse` ; texte : `La caisse de {nom} pour « {titre} » est fermée avec un écart de {écart signé}. Justification : {justification}.` ; lien : `/partner/events/{id}?tab=caisse`
  - Exemple : `Écart de caisse` — `La caisse de Fatou Diop pour « Concert Test » est fermée avec un écart de -2 500 F CFA. Justification : Erreur de monnaie rendue.`
- SMS — modèle : `Event Village : caisse de {nom} fermée ({titre}) avec un écart de {écart signé}. {URL}/partner/events`
  - Exemple : `Event Village : caisse de Fatou Diop fermée (Concert Test) avec un écart de -2 500 F CFA. https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 132 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 159 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 28 caractères ; valeurs saisies coupées à : nom ≤ 20, titre ≤ 25 (avec « ... »).
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Écart de caisse — Event Village` ; exemple : `Écart de caisse — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=caisse`

**Variante : sans justification**

- Cloche — titre : `Écart de caisse` ; texte : `La caisse de {nom} pour « {titre} » est fermée avec un écart de {écart signé}.` ; lien : `/partner/events/{id}?tab=caisse`
  - Exemple : `Écart de caisse` — `La caisse de Fatou Diop pour « Concert Test » est fermée avec un écart de -2 500 F CFA.`
- SMS — modèle : `Event Village : caisse de {nom} fermée ({titre}) avec un écart de {écart signé}. {URL}/partner/events`
  - Exemple : `Event Village : caisse de Fatou Diop fermée (Concert Test) avec un écart de -2 500 F CFA. https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 132 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 159 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 28 caractères ; valeurs saisies coupées à : nom ≤ 20, titre ≤ 25 (avec « ... »).
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Écart de caisse — Event Village` ; exemple : `Écart de caisse — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=caisse`

#### `WITHDRAWAL_PAID` — Retrait versé

| | |
|---|---|
| Destinataires | Le bénéficiaire du retrait (partenaire ou parrain) : son compte, sinon le numéro du versement (SMS). |
| Déclencheur | Versement d’un retrait confirmé. |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par retrait. Lien : /partner/finance (retrait organisateur) ou /wallet (retrait de parrainage). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:466,492-500 ; catalogue : lib/notifications/catalog.ts:979 ; registre : M/20261103000002_lot6_outbox.sql:107 |
| Scénario détaillé | 08-argent.md |

- Cloche — titre : `Retrait versé` ; texte : `Votre retrait de {montant} a été versé sur votre compte {opérateur}.` ; lien : `/partner/finance`
  - Exemple : `Retrait versé` — `Votre retrait de 25 000 F CFA a été versé sur votre compte Wave.`
- SMS — modèle : `Event Village : votre retrait de {montant} a été versé sur votre compte {opérateur}.`
  - Exemple : `Event Village : votre retrait de 25 000 F CFA a été versé sur votre compte Wave.`
  - Mesure de l’exemple : 80 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 83 caractères, GSM-7, 1 segment.
- Email — sujet : `Retrait versé — Event Village` ; exemple : `Retrait versé — Event Village` ; bouton vers `{URL}/partner/finance`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `WITHDRAWAL_REJECTED` — Retrait refusé

| | |
|---|---|
| Destinataires | Le bénéficiaire du retrait. |
| Déclencheur | Retrait refusé par l’opérateur (versement en échec). |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par retrait. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:505,522-530 ; catalogue : lib/notifications/catalog.ts:986 ; registre : M/20261103000002_lot6_outbox.sql:108 |
| Scénario détaillé | 08-argent.md |

- Cloche — titre : `Retrait refusé` ; texte : `Votre retrait de {montant} a été refusé par l'opérateur. Le montant est revenu sur votre solde.` ; lien : `/partner/finance`
  - Exemple : `Retrait refusé` — `Votre retrait de 25 000 F CFA a été refusé par l'opérateur. Le montant est revenu sur votre solde.`
- SMS — modèle : `Event Village : votre retrait de {montant} a été refusé par l'opérateur. Le montant est revenu sur votre solde.`
  - Exemple : `Event Village : votre retrait de 25 000 F CFA a été refusé par l'opérateur. Le montant est revenu sur votre solde.`
  - Mesure de l’exemple : 114 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 117 caractères, GSM-7, 1 segment.
- Email — sujet : `Retrait refusé — Event Village` ; exemple : `Retrait refusé — Event Village` ; bouton vers `{URL}/partner/finance`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `WITHDRAWAL_UNCERTAIN` — Retrait en vérification

| | |
|---|---|
| Destinataires | Le bénéficiaire du retrait. |
| Déclencheur | Issue du versement d’un retrait inconnue (statut incertain). |
| Canaux | cloche (application), SMS, push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par tentative de versement incertaine. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:541-550 ; catalogue : lib/notifications/catalog.ts:993 ; registre : M/20261109000003_lot9bis_registre.sql:111 |
| Scénario détaillé | 08-argent.md |

- Cloche — titre : `Retrait en vérification` ; texte : `Votre retrait de {montant} est en vérification auprès de l'opérateur. Aucune action n'est nécessaire.` ; lien : `/partner/finance`
  - Exemple : `Retrait en vérification` — `Votre retrait de 25 000 F CFA est en vérification auprès de l'opérateur. Aucune action n'est nécessaire.`
- SMS — modèle : `Event Village : votre retrait de {montant} est en vérification auprès de l'opérateur. Aucune action de votre part.`
  - Exemple : `Event Village : votre retrait de 25 000 F CFA est en vérification auprès de l'opérateur. Aucune action de votre part.`
  - Mesure de l’exemple : 117 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 120 caractères, GSM-7, 1 segment.
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Retrait en vérification — Event Village` ; exemple : `Retrait en vérification — Event Village` ; bouton vers `{URL}/partner/finance`

#### `CANCEL_REFUNDS_DONE` — Remboursements d’une annulation terminés

| | |
|---|---|
| Destinataires | La propriétaire de l’événement annulé. |
| Déclencheur | Dernier remboursement en ligne d’une annulation confirmé. |
| Canaux | cloche (application), email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par événement. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:477-490 ; catalogue : lib/notifications/catalog.ts:1000 ; registre : M/20261103000002_lot6_outbox.sql:110 |
| Scénario détaillé | 08-argent.md |

- Cloche — titre : `Remboursements terminés` ; texte : `Tous les remboursements en ligne de « {titre} » sont versés.` ; lien : `/partner/events/{id}?tab=cloture`
  - Exemple : `Remboursements terminés` — `Tous les remboursements en ligne de « Concert Test » sont versés.`
- Email — sujet : `Remboursements terminés — Event Village` ; exemple : `Remboursements terminés — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=cloture`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `CANCEL_REFUNDS_BLOCKED` — Remboursements d’une annulation bloqués

| | |
|---|---|
| Destinataires | La propriétaire de l’événement annulé. |
| Déclencheur | Un remboursement d’annulation est bloqué ou refusé par l’opérateur. |
| Canaux | cloche (application), email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Au plus un par événement et par jour de Dakar. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:419-427, 511-519 ; catalogue : lib/notifications/catalog.ts:1006 ; registre : M/20261103000002_lot6_outbox.sql:111 |
| Scénario détaillé | 08-argent.md |

- Cloche — titre : `Remboursements en attente` ; texte : `Des remboursements de « {titre} » sont bloqués : l'administration les reprend.` ; lien : `/partner/events/{id}?tab=cloture`
  - Exemple : `Remboursements en attente` — `Des remboursements de « Concert Test » sont bloqués : l'administration les reprend.`
- Email — sujet : `Remboursements en attente — Event Village` ; exemple : `Remboursements en attente — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=cloture`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `PARTNER_REGISTERED_ACK` — Inscription partenaire reçue

| | |
|---|---|
| Destinataires | Le compte qui vient de s’inscrire comme partenaire. |
| Déclencheur | Création de la fiche partenaire (inscription). |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par inscription. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:643-649 ; catalogue : lib/notifications/catalog.ts:1012 ; registre : M/20261103000002_lot6_outbox.sql:112 |
| Scénario détaillé | 03-partenaire.md |

- Cloche — titre : `Inscription reçue` ; texte : `Votre demande de compte partenaire « {organisateur} » est en cours d'examen.` ; lien : `/partner/dashboard`
  - Exemple : `Inscription reçue` — `Votre demande de compte partenaire « Fatou Diop Events » est en cours d'examen.`
- Email — sujet : `Inscription reçue — Event Village` ; exemple : `Inscription reçue — Event Village` ; bouton vers `{URL}/partner/dashboard`

#### `PARTNER_VALIDATED` — Compte partenaire validé

| | |
|---|---|
| Destinataires | Le compte de la partenaire. |
| Déclencheur | Statut de la partenaire passé de « En attente » ou « Rejeté » à « Validé ». |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par changement de statut. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:663-664 ; catalogue : lib/notifications/catalog.ts:1018 ; registre : M/20261103000002_lot6_outbox.sql:113 |
| Scénario détaillé | 03-partenaire.md |

- Cloche — titre : `Compte partenaire validé` ; texte : `Votre compte partenaire « {organisateur} » est validé. Vous pouvez créer et publier vos événements.` ; lien : `/partner/dashboard`
  - Exemple : `Compte partenaire validé` — `Votre compte partenaire « Fatou Diop Events » est validé. Vous pouvez créer et publier vos événements.`
- SMS — modèle : `Event Village : votre compte partenaire {organisateur} est validé. Connectez-vous : {URL}/login`
  - Exemple : `Event Village : votre compte partenaire Fatou Diop Events est validé. Connectez-vous : https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 120 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 133 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 54 caractères ; valeurs saisies coupées à : organisateur ≤ 30 (avec « ... »).
- Email — sujet : `Compte partenaire validé — Event Village` ; exemple : `Compte partenaire validé — Event Village` ; bouton vers `{URL}/partner/dashboard`

#### `PARTNER_REJECTED` — Demande de compte partenaire refusée

| | |
|---|---|
| Destinataires | Le compte de la partenaire. |
| Déclencheur | Statut de la partenaire passé à « Rejeté » (motif saisi, sinon « motif non précisé »). |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par changement de statut. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:667-669 ; catalogue : lib/notifications/catalog.ts:1025 ; registre : M/20261103000002_lot6_outbox.sql:114 |
| Scénario détaillé | 03-partenaire.md |

- Cloche — titre : `Demande refusée` ; texte : `Votre demande de compte partenaire n'est pas acceptée. Motif : {motif}. Vous pouvez compléter votre dossier une fois depuis votre tableau de bord.` ; lien : `/partner/dashboard`
  - Exemple : `Demande refusée` — `Votre demande de compte partenaire n'est pas acceptée. Motif : Pièce d’identité illisible. Vous pouvez compléter votre dossier une fois depuis votre tableau de bord.`
- SMS — modèle : `Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : {motif}.`
  - Exemple : `Event Village : votre demande de compte partenaire n'est pas acceptée. Motif : Pièce d'identité illisible.`
  - Mesure de l’exemple : 106 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 139 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : motif ≤ 60 (avec « ... »).
- Email — sujet : `Demande refusée — Event Village` ; exemple : `Demande refusée — Event Village` ; bouton vers `{URL}/partner/dashboard`

#### `PARTNER_SUSPENDED` — Compte partenaire suspendu

| | |
|---|---|
| Destinataires | Le compte de la partenaire (envoyé même si le compte est suspendu). |
| Déclencheur | Statut de la partenaire passé à « Suspendu » (motif saisi, sinon « motif non précisé »). |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par changement de statut. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:670-672 ; catalogue : lib/notifications/catalog.ts:1036 ; registre : M/20261103000002_lot6_outbox.sql:115 |
| Scénario détaillé | 03-partenaire.md |

- Cloche — titre : `Compte suspendu` ; texte : `Votre compte partenaire est suspendu. Motif : {motif}. Contactez le support.` ; lien : `/partner/dashboard`
  - Exemple : `Compte suspendu` — `Votre compte partenaire est suspendu. Motif : Signalements de fraude en cours d’examen. Contactez le support.`
- SMS — modèle : `Event Village : votre compte partenaire est suspendu. Motif : {motif}. Contactez le support.`
  - Exemple : `Event Village : votre compte partenaire est suspendu. Motif : Signalements de fraude en cours d'examen. Contactez le support.`
  - Mesure de l’exemple : 125 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 144 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : motif ≤ 60 (avec « ... »).
- Email — sujet : `Compte suspendu — Event Village` ; exemple : `Compte suspendu — Event Village` ; bouton vers `{URL}/partner/dashboard`

#### `PARTNER_REACTIVATED` — Compte partenaire réactivé

| | |
|---|---|
| Destinataires | Le compte de la partenaire. |
| Déclencheur | Statut de la partenaire passé de « Suspendu » à « Validé ». |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par changement de statut. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:665-666 ; catalogue : lib/notifications/catalog.ts:1043 ; registre : M/20261103000002_lot6_outbox.sql:116 |
| Scénario détaillé | 03-partenaire.md |

- Cloche — titre : `Compte réactivé` ; texte : `Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements.` ; lien : `/partner/dashboard`
  - Exemple : `Compte réactivé` — `Votre compte partenaire est réactivé. Vous pouvez de nouveau publier vos événements.`
- SMS — modèle : `Event Village : votre compte partenaire est réactivé. Connectez-vous : {URL}/login`
  - Exemple : `Event Village : votre compte partenaire est réactivé. Connectez-vous : https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 104 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 104 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 83 caractères.
- Email — sujet : `Compte réactivé — Event Village` ; exemple : `Compte réactivé — Event Village` ; bouton vers `{URL}/partner/dashboard`

#### `TRIAL_STARTED` — Période d’essai activée

| | |
|---|---|
| Destinataires | Le compte de la partenaire. |
| Déclencheur | Première activation de l’espace partenaire (période d’essai), fonction activate_partner_trial. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par partenaire. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:897-903 ; app/api/partner/activation/route.ts:68-70 ; catalogue : lib/notifications/catalog.ts:1051 ; registre : M/20261109000003_lot9bis_registre.sql:91 |
| Scénario détaillé | 03-partenaire.md |

- Cloche — titre : `Période d'essai activée` ; texte : `Votre période d'essai de {jours} jours commence aujourd'hui.` ; lien : `/partner/dashboard`
  - Exemple : `Période d'essai activée` — `Votre période d'essai de 60 jours commence aujourd'hui.`
- Email — sujet : `Période d'essai activée — Event Village` ; exemple : `Période d'essai activée — Event Village` ; bouton vers `{URL}/partner/dashboard`

#### `SUBSCRIPTION_ACTIVATED` — Abonnement activé

| | |
|---|---|
| Destinataires | Le compte de la partenaire. |
| Déclencheur | Changement de formule d’abonnement enregistré sur la fiche partenaire. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par formule et par échéance. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:776-815 ; catalogue : lib/notifications/catalog.ts:1057 ; registre : M/20261109000003_lot9bis_registre.sql:108 |
| Scénario détaillé | 14-non-implemente.md |

- Cloche — titre : `Abonnement activé` ; texte : `Votre pack « {formule} » est activé pour {jours} jours.` ; lien : `/partner/subscription`
  - Exemple : `Abonnement activé` — `Votre pack « Pro » est activé pour 30 jours.`
- Email — sujet : `Abonnement activé — Event Village` ; exemple : `Abonnement activé — Event Village` ; bouton vers `{URL}/partner/subscription`

#### `PAYMENT_SUCCESS` — Paiement confirmé

| | |
|---|---|
| Destinataires | Le compte qui a payé. |
| Déclencheur | Paiement réussi qui n’est pas un achat de billets (abonnement, salle…). |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par paiement. Lien : /partner/subscription pour un abonnement, sinon /orders. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:979-984 ; M/20261106000003_lot8_paiement.sql:423-440 ; catalogue : lib/notifications/catalog.ts:1063 ; registre : M/20261109000003_lot9bis_registre.sql:112 |
| Scénario détaillé | 14-non-implemente.md |

- Cloche — titre : `Paiement confirmé` ; texte : `Votre paiement de {montant} a été validé.` ; lien : `/orders`
  - Exemple : `Paiement confirmé` — `Votre paiement de 15 000 F CFA a été validé.`
- Email — sujet : `Paiement confirmé — Event Village` ; exemple : `Paiement confirmé — Event Village` ; bouton vers `{URL}/orders`

#### `HALL_RESERVATION_REQUESTED` — Demande de réservation de salle

| | |
|---|---|
| Destinataires | Le compte de la partenaire qui propose la salle. |
| Déclencheur | Nouvelle demande de réservation de salle. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par demande. Salles : module non construit (lot 10), voir 14-non-implemente.md. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:1009-1016, 1052-1054 ; catalogue : lib/notifications/catalog.ts:1069 ; registre : M/20261109000003_lot9bis_registre.sql:110 |
| Scénario détaillé | 14-non-implemente.md |

- Cloche — titre : `Nouvelle demande de réservation` ; texte : `Demande de réservation de « {salle} » du {début} au {fin}.` ; lien : `/partner/halls`
  - Exemple : `Nouvelle demande de réservation` — `Demande de réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026.`
- Email — sujet : `Nouvelle demande de réservation — Event Village` ; exemple : `Nouvelle demande de réservation — Event Village` ; bouton vers `{URL}/partner/halls`

#### `HALL_RESERVATION_CONFIRMED` — Réservation de salle confirmée

| | |
|---|---|
| Destinataires | Le client qui a réservé la salle. |
| Déclencheur | Réservation de salle passée à « Confirmée ». |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par confirmation. Module non construit (lot 10). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:1024-1030 ; catalogue : lib/notifications/catalog.ts:1078 ; registre : M/20261109000003_lot9bis_registre.sql:113 |
| Scénario détaillé | 14-non-implemente.md |

- Cloche — titre : `Réservation confirmée` ; texte : `Votre réservation de « {salle} » du {début} au {fin} est confirmée.` ; lien : `/orders`
  - Exemple : `Réservation confirmée` — `Votre réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026 est confirmée.`
- Email — sujet : `Réservation confirmée — Event Village` ; exemple : `Réservation confirmée — Event Village` ; bouton vers `{URL}/orders`

#### `HALL_RESERVATION_CANCELLED` — Réservation de salle annulée

| | |
|---|---|
| Destinataires | Le client et la partenaire de la salle (deux messages). |
| Déclencheur | Réservation de salle passée à « Annulée ». |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par destinataire. Module non construit (lot 10). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:1031-1044 ; catalogue : lib/notifications/catalog.ts:1087 ; registre : M/20261109000003_lot9bis_registre.sql:114 |
| Scénario détaillé | 14-non-implemente.md |

**Variante : au client, avec motif**

- Cloche — titre : `Réservation annulée` ; texte : `La réservation de « {salle} » du {début} au {fin} est annulée. Motif : {motif}.` ; lien : `/orders`
  - Exemple : `Réservation annulée` — `La réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026 est annulée. Motif : Travaux imprévus.`
- Email — sujet : `Réservation annulée — Event Village` ; exemple : `Réservation annulée — Event Village` ; bouton vers `{URL}/orders`

**Variante : à la partenaire, sans motif**

- Cloche — titre : `Réservation annulée` ; texte : `La réservation de « {salle} » du {début} au {fin} est annulée.` ; lien : `/partner/halls`
  - Exemple : `Réservation annulée` — `La réservation de « Salle des fêtes de Ngor » du sam. 5 déc. 2026 au dim. 6 déc. 2026 est annulée.`
- Email — sujet : `Réservation annulée — Event Village` ; exemple : `Réservation annulée — Event Village` ; bouton vers `{URL}/partner/halls`

#### `PROMOTION_DECIDED` — Décision sur une mise en avant

| | |
|---|---|
| Destinataires | La partenaire qui a demandé la mise en avant. |
| Déclencheur | Demande de mise en avant acceptée ou refusée par l’administration. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par décision. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:1066-1090 ; catalogue : lib/notifications/catalog.ts:1099 ; registre : M/20261109000003_lot9bis_registre.sql:109 |
| Scénario détaillé | 14-non-implemente.md |

**Variante : acceptée**

- Cloche — titre : `Mise en avant acceptée` ; texte : `La mise en avant de « {titre} » est acceptée.` ; lien : `/partner/events/{id}`
  - Exemple : `Mise en avant acceptée` — `La mise en avant de « Concert Test » est acceptée.`
- Email — sujet : `Mise en avant acceptée — Event Village` ; exemple : `Mise en avant acceptée — Event Village` ; bouton vers `{URL}/partner/events/{id}`

**Variante : refusée, avec motif**

- Cloche — titre : `Mise en avant refusée` ; texte : `La demande de mise en avant de « {titre} » est refusée. Motif : {motif}.` ; lien : `/partner/events/{id}`
  - Exemple : `Mise en avant refusée` — `La demande de mise en avant de « Concert Test » est refusée. Motif : Visuel non conforme.`
- Email — sujet : `Mise en avant refusée — Event Village` ; exemple : `Mise en avant refusée — Event Village` ; bouton vers `{URL}/partner/events/{id}`

#### `CONTROLLER_ASSIGNED` — Affectation d’un contrôleur

| | |
|---|---|
| Destinataires | Le contrôleur affecté. |
| Déclencheur | Ajout d’une affectation (invitation d’un compte déjà contrôleur, acceptation d’une invitation, affectation par la partenaire ou l’administration). |
| Canaux | cloche (application), push, SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Application, push, email : un message par affectation. SMS : un seul par compte et par opération, qui cite la première affectation puis « , et N autres » (M/20261103000006_lot6_pros_admin.sql:64-150). SMS non envoyé si un SMS d’invitation (code d’activation) est parti à ce compte ou ce numéro moins d’une heure avant (motif « Déjà prévenu par l’invitation », M/20261109000010_lot9bis_email.sql:523-530). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000010_lot9bis_email.sql:1082-1110 ; déclencheur M/20261103000006_lot6_pros_admin.sql:616-618 ; catalogue : lib/notifications/catalog.ts:1113 ; registre : M/20261109000003_lot9bis_registre.sql:93 |
| Scénario détaillé | 05-equipe-controle-acces.md |

**Variante : une affectation, point d’entrée, espèces autorisées**

- Cloche — titre : `Nouvelle affectation` ; texte : `Vous contrôlez l'entrée de « {titre} » le {date}, point d'entrée {point}. Encaissement des espèces autorisé.` ; lien : `/controller/scanner`
  - Exemple : `Nouvelle affectation` — `Vous contrôlez l'entrée de « Concert Test » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : affectation à l'entrée de {titre}, {date}, point {point}. {URL}/login`
  - Exemple : `Event Village : affectation à l'entrée de Concert Test, sam. 14 nov. à 20:00, point Porte Nord. https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 129 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 144 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 43 caractères ; valeurs saisies coupées à : titre ≤ 25, point ≤ 12 (avec « ... »).
- Email — sujet : `Nouvelle affectation — Event Village` ; exemple : `Nouvelle affectation — Event Village` ; bouton vers `{URL}/controller/scanner`

**Variante : deux affectations dans la même opération**

- Cloche — titre : `Nouvelle affectation` ; texte : `Vous contrôlez l'entrée de « {titre} » le {date}, point d'entrée {point}. Encaissement des espèces autorisé.` ; lien : `/controller/scanner`
  - Exemple : `Nouvelle affectation` — `Vous contrôlez l'entrée de « Concert Test » le sam. 14 nov. 2026 à 20:00, point d'entrée Porte Nord. Encaissement des espèces autorisé.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : affectation à l'entrée de {titre}, {date}, point {point}, et 1 autre. {URL}/login`
  - Exemple : `Event Village : affectation à l'entrée de Concert Test, sam. 14 nov. à 20:00, point Porte Nord, et 1 autre. https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 141 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 159 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 28 caractères ; valeurs saisies coupées à : titre ≤ 25, point ≤ 12 (avec « ... »).
- Email — sujet : `Nouvelle affectation — Event Village` ; exemple : `Nouvelle affectation — Event Village` ; bouton vers `{URL}/controller/scanner`

**Variante : sans point d’entrée, espèces non autorisées**

- Cloche — titre : `Nouvelle affectation` ; texte : `Vous contrôlez l'entrée de « {titre} » le {date}.` ; lien : `/controller/scanner`
  - Exemple : `Nouvelle affectation` — `Vous contrôlez l'entrée de « Concert Test » le sam. 14 nov. 2026 à 20:00.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : affectation à l'entrée de {titre}, {date}. {URL}/login`
  - Exemple : `Event Village : affectation à l'entrée de Concert Test, sam. 14 nov. à 20:00. https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 111 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 125 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 62 caractères ; valeurs saisies coupées à : titre ≤ 25, point ≤ 12 (avec « ... »).
- Email — sujet : `Nouvelle affectation — Event Village` ; exemple : `Nouvelle affectation — Event Village` ; bouton vers `{URL}/controller/scanner`

#### `CONTROLLER_UNASSIGNED` — Retrait d’affectation

| | |
|---|---|
| Destinataires | Le contrôleur dont l’affectation est retirée (pas lors d’une suppression en cascade du compte ou de l’événement). |
| Déclencheur | Suppression d’une affectation. |
| Canaux | cloche (application), push, SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Comme l’affectation : application, push, email par affectation ; un SMS par compte et par opération. Les rappels de la veille encore en attente sont annulés (« Affectation retirée »). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000010_lot9bis_email.sql:1113-1146 ; catalogue : lib/notifications/catalog.ts:1138 ; registre : M/20261109000003_lot9bis_registre.sql:94 |
| Scénario détaillé | 05-equipe-controle-acces.md |

**Variante : un retrait**

- Cloche — titre : `Affectation retirée` ; texte : `Vous ne contrôlez plus l'entrée de « {titre} ».` ; lien : `/controller/scanner`
  - Exemple : `Affectation retirée` — `Vous ne contrôlez plus l'entrée de « Concert Test ».`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : votre affectation à l'entrée de {titre} est retirée.`
  - Exemple : `Event Village : votre affectation à l'entrée de Concert Test est retirée.`
  - Mesure de l’exemple : 73 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 91 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Affectation retirée — Event Village` ; exemple : `Affectation retirée — Event Village` ; bouton vers `{URL}/controller/scanner`

**Variante : deux retraits dans la même opération**

- Cloche — titre : `Affectation retirée` ; texte : `Vous ne contrôlez plus l'entrée de « {titre} ».` ; lien : `/controller/scanner`
  - Exemple : `Affectation retirée` — `Vous ne contrôlez plus l'entrée de « Concert Test ».`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : votre affectation à l'entrée de {titre} est retirée, et 1 autre.`
  - Exemple : `Event Village : votre affectation à l'entrée de Concert Test est retirée, et 1 autre.`
  - Mesure de l’exemple : 85 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 105 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Affectation retirée — Event Village` ; exemple : `Affectation retirée — Event Village` ; bouton vers `{URL}/controller/scanner`

#### `CONTROLLER_REMINDER` — Rappel de contrôle la veille

| | |
|---|---|
| Destinataires | Chaque contrôleur affecté à l’événement à l’heure du rappel. |
| Déclencheur | La veille du début à 18:00 (heure de Dakar), tâche « reminders ». |
| Canaux | cloche (application), push, SMS, email |
| Indispensable ou optionnel | optionnel — sujet « Rappels avant l’événement » (préférences) |
| Regroupement | Un rappel par affectation. À l’envoi : annulé si l’affectation n’existe plus, si l’événement n’est plus publié, a changé de début ou a commencé. |
| Heures calmes (22 h–8 h) | **SMS : non envoyé, perdu** (motif « Plage sans SMS (nuit) ») ; cloche, push et email : envoyés normalement |
| Plafond quotidien | SMS : budget des SMS optionnels (700 par jour de Dakar), part hors codes du plafond global, 30 par numéro et par jour |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261105000002_lot7_sms.sql:700-722 ; catalogue : lib/notifications/catalog.ts:1154 ; registre : M/20261109000003_lot9bis_registre.sql:99 |
| Scénario détaillé | 05-equipe-controle-acces.md |

**Variante : point d’entrée, espèces autorisées**

- Cloche — titre : `Contrôle demain` ; texte : `Demain « {titre} » à {heure}, point d'entrée {point}, espèces autorisées.` ; lien : `/controller/scanner`
  - Exemple : `Contrôle demain` — `Demain « Concert Test » à 20:00, point d'entrée Porte Nord, espèces autorisées.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : demain {titre} à {heure}, point {point}, espèces autorisées. Connexion : {URL}/login`
  - Exemple : `Event Village : demain Concert Test à 20:00, point Porte Nord, espèces autorisées. Connexion : https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 128 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 156 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 31 caractères ; valeurs saisies coupées à : titre ≤ 30, point ≤ 20 (avec « ... »).
- Email — sujet : `Contrôle demain — Event Village` ; exemple : `Contrôle demain — Event Village` ; bouton vers `{URL}/controller/scanner` ; pied « Ne plus recevoir ces emails : {URL}/profile/notifications?topic=REMINDERS »

**Variante : sans point d’entrée, espèces non autorisées**

- Cloche — titre : `Contrôle demain` ; texte : `Demain « {titre} » à {heure}, point d'entrée à préciser, espèces non autorisées.` ; lien : `/controller/scanner`
  - Exemple : `Contrôle demain` — `Demain « Concert Test » à 20:00, point d'entrée à préciser, espèces non autorisées.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : demain {titre} à {heure}, point à préciser, espèces non autorisées. Connexion : {URL}/login`
  - Exemple : `Event Village : demain Concert Test à 20:00, point à préciser, espèces non autorisées. Connexion : https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 132 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 150 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 37 caractères ; valeurs saisies coupées à : titre ≤ 30, point ≤ 20 (avec « ... »).
- Email — sujet : `Contrôle demain — Event Village` ; exemple : `Contrôle demain — Event Village` ; bouton vers `{URL}/controller/scanner` ; pied « Ne plus recevoir ces emails : {URL}/profile/notifications?topic=REMINDERS »

#### `SHIFT_CLOSED_BY_OTHER` — Caisse fermée par un tiers

| | |
|---|---|
| Destinataires | Le contrôleur titulaire de la caisse. |
| Déclencheur | Sa caisse est fermée par la partenaire ou par l’administration. |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par caisse. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000008_lot9bis_cycle.sql:918-930 ; catalogue : lib/notifications/catalog.ts:1167 ; registre : M/20261109000003_lot9bis_registre.sql:115 |
| Scénario détaillé | 05-equipe-controle-acces.md |

**Variante : fermée par l’organisatrice**

- Cloche — titre : `Caisse fermée` ; texte : `Votre caisse pour « {titre} » a été fermée par l'organisateur. Montant déclaré : {montant déclaré}.` ; lien : `/controller/scanner`
  - Exemple : `Caisse fermée` — `Votre caisse pour « Concert Test » a été fermée par l'organisateur. Montant déclaré : 47 500 F CFA.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Caisse fermée — Event Village` ; exemple : `Caisse fermée — Event Village` ; bouton vers `{URL}/controller/scanner`

**Variante : fermée par l’administration, sans montant déclaré**

- Cloche — titre : `Caisse fermée` ; texte : `Votre caisse pour « {titre} » a été fermée par l'administration.` ; lien : `/controller/scanner`
  - Exemple : `Caisse fermée` — `Votre caisse pour « Concert Test » a été fermée par l'administration.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Caisse fermée — Event Village` ; exemple : `Caisse fermée — Event Village` ; bouton vers `{URL}/controller/scanner`

#### `CONTROLLER_ACTIVATED` — Compte de contrôleur activé

| | |
|---|---|
| Destinataires | Le contrôleur qui vient d’activer son compte. |
| Déclencheur | Activation du compte avec le code reçu par SMS (route /api/controller/setup). |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par compte. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : app/api/controller/setup/route.ts:205 ; M/20261103000006_lot6_pros_admin.sql:1097-1120 ; catalogue : lib/notifications/catalog.ts:1182 ; registre : M/20261109000003_lot9bis_registre.sql:116 |
| Scénario détaillé | 05-equipe-controle-acces.md |

- Cloche — titre : `Compte activé` ; texte : `Votre compte est activé : vous pouvez scanner les billets.` ; lien : `/controller/scanner`
  - Exemple : `Compte activé` — `Votre compte est activé : vous pouvez scanner les billets.`
- SMS — modèle : `Event Village : votre compte est activé. Vous pouvez vous connecter et scanner les billets.`
  - Exemple : `Event Village : votre compte est activé. Vous pouvez vous connecter et scanner les billets.`
  - Mesure de l’exemple : 91 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 91 caractères, GSM-7, 1 segment.
- Email — sujet : `Compte activé — Event Village` ; exemple : `Compte activé — Event Village` ; bouton vers `{URL}/controller/scanner`

#### `ADMIN_EVENT_SUBMITTED` — Événement à valider

| | |
|---|---|
| Destinataires | Administrateurs actifs : SUPERADMIN, et ADMIN qui ont la permission events.read. |
| Déclencheur | Soumission d’un événement (« Brouillon » → « En attente »). |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par soumission. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | events.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:138-141 ; catalogue : lib/notifications/catalog.ts:1189 ; registre : M/20261103000002_lot6_outbox.sql:129 |
| Scénario détaillé | 11-admin-superadmin.md |

- Cloche — titre : `Événement à valider` ; texte : `« {titre} » de {organisateur} attend votre validation.` ; lien : `/admin/events/{id}`
  - Exemple : `Événement à valider` — `« Concert Test » de Fatou Diop Events attend votre validation.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Événement à valider — Event Village` ; exemple : `Événement à valider — Event Village` ; bouton vers `{URL}/admin/events/{id}`

#### `ADMIN_PARTNER_REGISTERED` — Nouvelle candidature partenaire

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec partners.read. |
| Déclencheur | Inscription d’une partenaire. |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par inscription. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | partners.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:650-654 ; catalogue : lib/notifications/catalog.ts:1198 ; registre : M/20261103000002_lot6_outbox.sql:130 |
| Scénario détaillé | 11-admin-superadmin.md |

- Cloche — titre : `Nouvelle candidature` ; texte : `{organisateur} demande un compte partenaire.` ; lien : `/admin/dashboard`
  - Exemple : `Nouvelle candidature` — `Fatou Diop Events demande un compte partenaire.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Nouvelle candidature — Event Village` ; exemple : `Nouvelle candidature — Event Village` ; bouton vers `{URL}/admin/dashboard`

#### `ADMIN_REFUND_TO_RETRY` — Remboursement à reprendre

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec refunds.manage. |
| Déclencheur | Remboursement bloqué (motif posé) ou refusé par l’opérateur. |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur, par versement, par tentative et par cause. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | refunds.manage (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:413-420, 505-512 ; catalogue : lib/notifications/catalog.ts:1204 ; registre : M/20261103000002_lot6_outbox.sql:131 |
| Remarques | Le motif du blocage s’affiche par son libellé (lib/notifications/catalog.ts:190-199) : « opérateur du paiement inconnu », « numéro du payeur inconnu », « nom du bénéficiaire incomplet », « solde du compte partenaire SamirPay insuffisant », « opération créée en mode simulé : aucun versement », « limite du compte Mobile Money du bénéficiaire atteinte », « compte du bénéficiaire suspendu » ; autre code : « informations du bénéficiaire incomplètes ». |
| Scénario détaillé | 08-argent.md |

**Variante : bloqué, motif connu**

- Cloche — titre : `Remboursement à reprendre` ; texte : `Un remboursement de {montant} est bloqué : opérateur du paiement inconnu.` ; lien : `/admin/finance`
  - Exemple : `Remboursement à reprendre` — `Un remboursement de 5 000 F CFA est bloqué : opérateur du paiement inconnu.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Remboursement à reprendre — Event Village` ; exemple : `Remboursement à reprendre — Event Village` ; bouton vers `{URL}/admin/finance`

**Variante : refusé par l’opérateur**

- Cloche — titre : `Remboursement à reprendre` ; texte : `Un remboursement de {montant} est refusé par l'opérateur.` ; lien : `/admin/finance`
  - Exemple : `Remboursement à reprendre` — `Un remboursement de 5 000 F CFA est refusé par l'opérateur.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Remboursement à reprendre — Event Village` ; exemple : `Remboursement à reprendre — Event Village` ; bouton vers `{URL}/admin/finance`

#### `ADMIN_DUPLICATE_PAYMENT` — Paiement en double remboursé

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec refunds.manage. |
| Déclencheur | Second paiement réussi pour le même panier : son remboursement est lancé. |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par paiement en double. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | refunds.manage (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261106000003_lot8_paiement.sql:189-192 ; catalogue : lib/notifications/catalog.ts:1219 ; registre : M/20261106000003_lot8_paiement.sql:32 |
| Scénario détaillé | 06-achat-paiement.md |

- Cloche — titre : `Paiement en double remboursé` ; texte : `Un second paiement de {montant} a été encaissé pour le même panier : son remboursement au client est lancé.` ; lien : `/admin/finance`
  - Exemple : `Paiement en double remboursé` — `Un second paiement de 21 000 F CFA a été encaissé pour le même panier : son remboursement au client est lancé.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Paiement en double remboursé — Event Village` ; exemple : `Paiement en double remboursé — Event Village` ; bouton vers `{URL}/admin/finance`

#### `ADMIN_CASHOUT_UNCERTAIN` — Versement incertain

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec refunds.manage. |
| Déclencheur | Versement (remboursement ou retrait) au statut incertain. |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur, par versement et par tentative. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | refunds.manage (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:541,551-557 ; catalogue : lib/notifications/catalog.ts:1225 ; registre : M/20261103000002_lot6_outbox.sql:132 |
| Scénario détaillé | 08-argent.md |

- Cloche — titre : `Versement incertain` ; texte : `L'issue d'un versement de {montant} est incertaine : vérifiez-le avant toute action.` ; lien : `/admin/finance`
  - Exemple : `Versement incertain` — `L'issue d'un versement de 25 000 F CFA est incertaine : vérifiez-le avant toute action.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Versement incertain — Event Village` ; exemple : `Versement incertain — Event Village` ; bouton vers `{URL}/admin/finance`

#### `ADMIN_WITHDRAWAL_REJECTED` — Retrait refusé par l’opérateur

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec refunds.manage. |
| Déclencheur | Retrait refusé par l’opérateur. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par retrait. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | refunds.manage (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:531-536 ; catalogue : lib/notifications/catalog.ts:1231 ; registre : M/20261103000002_lot6_outbox.sql:133 |
| Scénario détaillé | 08-argent.md |

- Cloche — titre : `Retrait refusé par l'opérateur` ; texte : `Le retrait de {montant} a été refusé ; le montant est revenu sur le solde du bénéficiaire.` ; lien : `/admin/finance`
  - Exemple : `Retrait refusé par l'opérateur` — `Le retrait de 25 000 F CFA a été refusé ; le montant est revenu sur le solde du bénéficiaire.`
- Email — sujet : `Retrait refusé par l'opérateur — Event Village` ; exemple : `Retrait refusé par l'opérateur — Event Village` ; bouton vers `{URL}/admin/finance`

#### `ADMIN_FINANCE_DEBT` — Créance sur un compte

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec payments.read. |
| Déclencheur | Un débit dépasse le solde disponible d’un compte : une créance est créée (débit du grand livre, frais SamirPay d’un remboursement). |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par créance. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | payments.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261103000006_lot6_pros_admin.sql:515-536 ; appelants M/20261101000004_lot3_grand_livre.sql:204-213, M/20261110000005_lot9ter_argent.sql:235-246 ; catalogue : lib/notifications/catalog.ts:1237 ; registre : M/20261103000002_lot6_outbox.sql:134 |
| Scénario détaillé | 08-argent.md |

**Variante : compte organisateur**

- Cloche — titre : `Créance sur un compte` ; texte : `Un débit de {montant} sur le compte organisateur dépasse le solde disponible : une créance de {créance} sera compensée sur les gains futurs.` ; lien : `/admin/finance`
  - Exemple : `Créance sur un compte` — `Un débit de 5 000 F CFA sur le compte organisateur dépasse le solde disponible : une créance de 3 000 F CFA sera compensée sur les gains futurs.`
- Email — sujet : `Créance sur un compte — Event Village` ; exemple : `Créance sur un compte — Event Village` ; bouton vers `{URL}/admin/finance`

**Variante : compte de parrainage**

- Cloche — titre : `Créance sur un compte` ; texte : `Un débit de {montant} sur le compte de parrainage dépasse le solde disponible : une créance de {créance} sera compensée sur les gains futurs.` ; lien : `/admin/finance`
  - Exemple : `Créance sur un compte` — `Un débit de 5 000 F CFA sur le compte de parrainage dépasse le solde disponible : une créance de 3 000 F CFA sera compensée sur les gains futurs.`
- Email — sujet : `Créance sur un compte — Event Village` ; exemple : `Créance sur un compte — Event Village` ; bouton vers `{URL}/admin/finance`

#### `ADMIN_NOTIFICATION_FAILED` — Envoi en échec

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec notifications.read. |
| Déclencheur | Une ligne de la boîte d’envoi passe « En échec » (tentatives épuisées, refus du fournisseur, contenu incomplet, envoi interrompu à la dernière tentative) ; jamais pour cette alerte elle-même. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par ligne en échec. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | notifications.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261103000002_lot6_outbox.sql:635-655 ; catalogue : lib/notifications/catalog.ts:1250 ; registre : M/20261109000003_lot9bis_registre.sql:117 |
| Remarques | {nom du type} = nom humain du type en échec (champ « label » du catalogue, par exemple « Confirmation d’achat ») ; {par canal} = « dans l’application », « par SMS », « par email » ou « par notification push » (lib/notifications/catalog.ts:1714-1735) ; « après N tentatives » seulement si le nombre est connu et positif. |
| Scénario détaillé | 11-admin-superadmin.md |

- Cloche — titre : `Envoi en échec` ; texte : `Une notification « {nom du type} » {par canal} a échoué après {tentatives} tentatives.` ; lien : `/admin/notifications/{id}`
  - Exemple : `Envoi en échec` — `Une notification « Confirmation d’achat » par SMS a échoué après 5 tentatives.`
- Email — sujet : `Envoi en échec — Event Village` ; exemple : `Envoi en échec — Event Village` ; bouton vers `{URL}/admin/notifications/{id}`

#### `ADMIN_SMS_DAILY_THRESHOLD` — Volume de SMS indispensables élevé

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec notifications.read. |
| Déclencheur | Le nombre de SMS indispensables du jour de Dakar atteint notif.sms_essential_daily_alert (2 000 par défaut) ; contrôlé à la fin de chaque passage de l’envoyeur. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par jour. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | notifications.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:1313-1340 ; réglage M/20261109000001_lot9bis_reglages.sql:37-38 ; catalogue : lib/notifications/catalog.ts:1263 ; registre : M/20261103000002_lot6_outbox.sql:136 |
| Scénario détaillé | 11-admin-superadmin.md |

- Cloche — titre : `Volume de SMS indispensables élevé` ; texte : `{nombre} SMS indispensables envoyés aujourd'hui (seuil d'alerte : {seuil}). Ils n'ont pas de plafond : vérifiez leur origine dans la supervision.` ; lien : `/admin/notifications`
  - Exemple : `Volume de SMS indispensables élevé` — `2 150 SMS indispensables envoyés aujourd'hui (seuil d'alerte : 2 000). Ils n'ont pas de plafond : vérifiez leur origine dans la supervision.`
- Email — sujet : `Volume de SMS indispensables élevé — Event Village` ; exemple : `Volume de SMS indispensables élevé — Event Village` ; bouton vers `{URL}/admin/notifications`

#### `ADMIN_SMS_CAP_GLOBAL` — Plafond de SMS atteint

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec notifications.read. |
| Déclencheur | Un code de connexion est refusé parce que le plafond global de SMS du jour (SMS_GLOBAL_DAILY_CAP, 1 000 par défaut) est atteint. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par jour UTC (quota sms_alert, lib/sms/sms-guard.ts:128). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | notifications.read (et tout SUPERADMIN) |
| Preuves | déclencheur : lib/sms/sms-guard.ts:126-154, 164-166 ; M/20261103000002_lot6_outbox.sql:727-747 ; catalogue : lib/notifications/catalog.ts:1272 ; registre : M/20261109000003_lot9bis_registre.sql:118 |
| Scénario détaillé | 13-limites-quotas-securite.md |

- Cloche — titre : `Plafond de SMS atteint` ; texte : `Le plafond de {plafond} SMS par jour est atteint : les envois sont suspendus jusqu'à minuit (UTC, heure de Dakar).` ; lien : `/admin/notifications`
  - Exemple : `Plafond de SMS atteint` — `Le plafond de 1 000 SMS par jour est atteint : les envois sont suspendus jusqu'à minuit (UTC, heure de Dakar).`
- Email — sujet : `Plafond de SMS atteint — Event Village` ; exemple : `Plafond de SMS atteint — Event Village` ; bouton vers `{URL}/admin/notifications`

#### `ADMIN_SMS_CAP_NON_OTP` — Quota de SMS hors code atteint

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec notifications.read. |
| Déclencheur | Un SMS hors code (optionnel, invitation de contrôleur) est refusé parce que la part hors codes du plafond global est atteinte (70 % de 1 000 par défaut). |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par jour UTC. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | notifications.read (et tout SUPERADMIN) |
| Preuves | déclencheur : lib/sms/sms-guard.ts:78-82, 100-105, 126-154, 164-166 ; catalogue : lib/notifications/catalog.ts:1281 ; registre : M/20261109000003_lot9bis_registre.sql:119 |
| Scénario détaillé | 13-limites-quotas-securite.md |

- Cloche — titre : `Quota de SMS hors code atteint` ; texte : `La part des SMS hors codes de connexion ({part hors codes} sur {plafond} par jour) est atteinte : seuls les codes de connexion partent encore jusqu'à minuit (UTC, heure de Dakar).` ; lien : `/admin/notifications`
  - Exemple : `Quota de SMS hors code atteint` — `La part des SMS hors codes de connexion (700 sur 1 000 par jour) est atteinte : seuls les codes de connexion partent encore jusqu'à minuit (UTC, heure de Dakar).`
- Email — sujet : `Quota de SMS hors code atteint — Event Village` ; exemple : `Quota de SMS hors code atteint — Event Village` ; bouton vers `{URL}/admin/notifications`

#### `ADMIN_SMS_OPTIONAL_80` — SMS optionnels à 80 % du plafond

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec notifications.read. |
| Déclencheur | Les SMS optionnels du jour de Dakar atteignent 80 % de notif.sms_optional_daily_cap (700 par défaut) ; plafond 0 ou absent : jamais. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par jour. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | notifications.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:1283-1311 ; catalogue : lib/notifications/catalog.ts:1292 ; registre : M/20261105000002_lot7_sms.sql:42 |
| Scénario détaillé | 11-admin-superadmin.md |

- Cloche — titre : `SMS optionnels : 80 % du plafond` ; texte : `{utilisés} SMS optionnels envoyés aujourd'hui sur un plafond de {plafond}. Au-delà, rappels et annonces partent sans SMS.` ; lien : `/admin/notifications`
  - Exemple : `SMS optionnels : 80 % du plafond` — `560 SMS optionnels envoyés aujourd'hui sur un plafond de 700. Au-delà, rappels et annonces partent sans SMS.`
- Email — sujet : `SMS optionnels : 80 % du plafond — Event Village` ; exemple : `SMS optionnels : 80 % du plafond — Event Village` ; bouton vers `{URL}/admin/notifications`

#### `ADMIN_SMS_FORECAST` — Rappels de demain au-delà du budget SMS

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec notifications.read. |
| Déclencheur | À la planification des rappels : les SMS de rappel prévus pour demain dépassent le budget optionnel restant de demain. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par jour visé. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | notifications.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261105000002_lot7_sms.sql:727-822 ; catalogue : lib/notifications/catalog.ts:1303 ; registre : M/20261105000002_lot7_sms.sql:43 |
| Scénario détaillé | 12-taches-planifiees.md |

- Cloche — titre : `Budget SMS de demain insuffisant` ; texte : `{prévus} SMS de rappel prévus le {jour} pour {disponibles} disponibles (plafond {plafond}). Les rappels au-delà partiront sans SMS.` ; lien : `/admin/notifications`
  - Exemple : `Budget SMS de demain insuffisant` — `812 SMS de rappel prévus le ven. 6 nov. 2026 pour 700 disponibles (plafond 700). Les rappels au-delà partiront sans SMS.`
- Email — sujet : `Budget SMS de demain insuffisant — Event Village` ; exemple : `Budget SMS de demain insuffisant — Event Village` ; bouton vers `{URL}/admin/notifications`

#### `REFUND_DELAYED` — Remboursement retardé

| | |
|---|---|
| Destinataires | Le bénéficiaire du remboursement : compte, sinon numéro du versement (SMS). |
| Déclencheur | Remboursement bloqué (sauf opération simulée), refusé, incertain, ou en attente depuis plus de 30 minutes. |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un seul avis par versement, quelle que soit la cause. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:430-433, 450-462, 520, 559-571 ; catalogue : lib/notifications/catalog.ts:1314 ; registre : M/20261109000003_lot9bis_registre.sql:61 |
| Scénario détaillé | 08-argent.md |

**Variante : avec l’événement**

- Cloche — titre : `Remboursement retardé` ; texte : `Le remboursement de {montant} pour « {titre} » est retardé. L'équipe Event Village s'en occupe : vous serez prévenu dès le versement.` ; lien : `/tickets?tab=historique`
  - Exemple : `Remboursement retardé` — `Le remboursement de 10 200 F CFA pour « Concert Test » est retardé. L'équipe Event Village s'en occupe : vous serez prévenu dès le versement.`
- SMS — modèle : `Event Village : remboursement de {montant} retardé ("{titre}"). L'équipe Event Village s'en occupe, aucune action de votre part.`
  - Exemple : `Event Village : remboursement de 10 200 F CFA retardé ("Concert Test"). L'équipe Event Village s'en occupe, aucune action de votre part.`
  - Mesure de l’exemple : 136 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 157 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Remboursement retardé — Event Village` ; exemple : `Remboursement retardé — Event Village` ; bouton vers `{URL}/tickets?tab=historique`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

**Variante : sans événement connu**

- Cloche — titre : `Remboursement retardé` ; texte : `Le remboursement de {montant} est retardé. L'équipe Event Village s'en occupe : vous serez prévenu dès le versement.` ; lien : `/tickets?tab=historique`
  - Exemple : `Remboursement retardé` — `Le remboursement de 10 200 F CFA est retardé. L'équipe Event Village s'en occupe : vous serez prévenu dès le versement.`
- SMS — modèle : `Event Village : remboursement de {montant} retardé. L'équipe Event Village s'en occupe, aucune action de votre part.`
  - Exemple : `Event Village : remboursement de 10 200 F CFA retardé. L'équipe Event Village s'en occupe, aucune action de votre part.`
  - Mesure de l’exemple : 119 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 122 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Remboursement retardé — Event Village` ; exemple : `Remboursement retardé — Event Village` ; bouton vers `{URL}/tickets?tab=historique`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `WITHDRAWAL_DELAYED` — Retrait retardé

| | |
|---|---|
| Destinataires | Le bénéficiaire du retrait : compte, sinon numéro du versement (SMS). |
| Déclencheur | Retrait bloqué (sauf opération simulée) ou en attente depuis plus de 30 minutes. |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un seul avis par versement. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:438-447, 450-462, 575-583 ; catalogue : lib/notifications/catalog.ts:1331 ; registre : M/20261109000003_lot9bis_registre.sql:62 |
| Scénario détaillé | 08-argent.md |

- Cloche — titre : `Retrait retardé` ; texte : `Votre retrait de {montant} est retardé. L'équipe Event Village s'en occupe : le montant reste réservé et vous serez prévenu du versement.` ; lien : `/partner/finance`
  - Exemple : `Retrait retardé` — `Votre retrait de 25 000 F CFA est retardé. L'équipe Event Village s'en occupe : le montant reste réservé et vous serez prévenu du versement.`
- SMS — modèle : `Event Village : votre retrait de {montant} est retardé. L'équipe Event Village s'en occupe, aucune action de votre part.`
  - Exemple : `Event Village : votre retrait de 25 000 F CFA est retardé. L'équipe Event Village s'en occupe, aucune action de votre part.`
  - Mesure de l’exemple : 123 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 126 caractères, GSM-7, 1 segment.
- Email — sujet : `Retrait retardé — Event Village` ; exemple : `Retrait retardé — Event Village` ; bouton vers `{URL}/partner/finance`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `ADMIN_CASHOUT_TO_RESUME` — Versement à reprendre

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec refunds.manage. |
| Déclencheur | Versement en attente depuis plus de 30 minutes (tous types), ou retrait bloqué (sauf opération simulée). |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur, par versement, par tentative et par cause. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | refunds.manage (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:438-462 ; catalogue : lib/notifications/catalog.ts:1342 ; registre : M/20261109000003_lot9bis_registre.sql:63 |
| Remarques | Nature du versement : « remboursement d’un paiement », « remboursement d’une annulation », « remboursement d’un billet », « retrait », sinon « versement » (lib/notifications/catalog.ts:202-211) ; motif : mêmes libellés que ADMIN_REFUND_TO_RETRY. |
| Scénario détaillé | 08-argent.md |

**Variante : en attente depuis plus de 30 minutes**

- Cloche — titre : `Versement à reprendre` ; texte : `Un versement de {montant} (remboursement d’un paiement) attend depuis plus de 30 minutes.` ; lien : `/admin/finance`
  - Exemple : `Versement à reprendre` — `Un versement de 10 200 F CFA (remboursement d’un paiement) attend depuis plus de 30 minutes.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Versement à reprendre — Event Village` ; exemple : `Versement à reprendre — Event Village` ; bouton vers `{URL}/admin/finance`

**Variante : retrait bloqué**

- Cloche — titre : `Versement à reprendre` ; texte : `Un retrait de {montant} est bloqué : solde du compte partenaire SamirPay insuffisant.` ; lien : `/admin/finance`
  - Exemple : `Versement à reprendre` — `Un retrait de 10 200 F CFA est bloqué : solde du compte partenaire SamirPay insuffisant.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Versement à reprendre — Event Village` ; exemple : `Versement à reprendre — Event Village` ; bouton vers `{URL}/admin/finance`

**Variante : remboursement bloqué**

- Cloche — titre : `Versement à reprendre` ; texte : `Un versement de {montant} (remboursement d’un billet) est bloqué : numéro du payeur inconnu.` ; lien : `/admin/finance`
  - Exemple : `Versement à reprendre` — `Un versement de 10 200 F CFA (remboursement d’un billet) est bloqué : numéro du payeur inconnu.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Versement à reprendre — Event Village` ; exemple : `Versement à reprendre — Event Village` ; bouton vers `{URL}/admin/finance`

#### `PAYMENT_REFUND_STARTED` — Remboursement d’un paiement

| | |
|---|---|
| Destinataires | Le client qui a payé : compte, sinon numéro du versement (SMS). |
| Déclencheur | Création du remboursement d’un paiement reçu sans billet possible, ou d’un second paiement du même panier. |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par remboursement. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000007_lot9bis_versements.sql:394-410 ; catalogue : lib/notifications/catalog.ts:1365 ; registre : M/20261109000003_lot9bis_registre.sql:64 |
| Scénario détaillé | 06-achat-paiement.md |

**Variante : paiement reçu sans billet possible**

- Cloche — titre : `Remboursement de votre paiement` ; texte : `Votre paiement de {montant} pour « {titre} » a été reçu, mais aucun billet n'a pu être émis. Il vous est remboursé sur votre compte {opérateur} : vous serez prévenu du versement.` ; lien : `/tickets?tab=historique`
  - Exemple : `Remboursement de votre paiement` — `Votre paiement de 10 200 F CFA pour « Concert Test » a été reçu, mais aucun billet n'a pu être émis. Il vous est remboursé sur votre compte Wave : vous serez prévenu du versement.`
- SMS — modèle : `Event Village : paiement de {montant} ("{titre}") sans billet possible : il vous est remboursé sur votre compte {opérateur}.`
  - Exemple : `Event Village : paiement de 10 200 F CFA ("Concert Test") sans billet possible : il vous est remboursé sur votre compte Wave.`
  - Mesure de l’exemple : 125 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 146 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 28, titre ≤ 30 (avec « ... »).
- Email — sujet : `Remboursement de votre paiement — Event Village` ; exemple : `Remboursement de votre paiement — Event Village` ; bouton vers `{URL}/tickets?tab=historique`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

**Variante : paiement en double**

- Cloche — titre : `Remboursement de votre paiement` ; texte : `Un second paiement de {montant} pour « {titre} » a été encaissé pour le même panier. Il vous est remboursé sur votre compte {opérateur} ; vos billets restent valables.` ; lien : `/tickets?tab=historique`
  - Exemple : `Remboursement de votre paiement` — `Un second paiement de 10 200 F CFA pour « Concert Test » a été encaissé pour le même panier. Il vous est remboursé sur votre compte Wave ; vos billets restent valables.`
- SMS — modèle : `Event Village : paiement en double de {montant} ("{titre}"), remboursé sur votre compte {opérateur}. Vos billets restent valables.`
  - Exemple : `Event Village : paiement en double de 10 200 F CFA ("Concert Test"), remboursé sur votre compte Wave. Vos billets restent valables.`
  - Mesure de l’exemple : 131 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 150 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 28, titre ≤ 30 (avec « ... »).
- Email — sujet : `Remboursement de votre paiement — Event Village` ; exemple : `Remboursement de votre paiement — Event Village` ; bouton vers `{URL}/tickets?tab=historique`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `ADMIN_PARTNER_RESUBMITTED` — Dossier partenaire complété

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec partners.read. |
| Déclencheur | Une partenaire refusée complète son dossier (une fois). |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par partenaire. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | partners.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261109000004_lot9bis_droits.sql:709-714 ; catalogue : lib/notifications/catalog.ts:1391 ; registre : M/20261109000003_lot9bis_registre.sql:65 |
| Scénario détaillé | 03-partenaire.md |

- Cloche — titre : `Dossier complété` ; texte : `{organisateur} a complété son dossier refusé : il attend un nouvel examen.` ; lien : `/admin/dashboard`
  - Exemple : `Dossier complété` — `Fatou Diop Events a complété son dossier refusé : il attend un nouvel examen.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Dossier complété — Event Village` ; exemple : `Dossier complété — Event Village` ; bouton vers `{URL}/admin/dashboard`

#### `EVENT_CLOSED_HOLDER` — Clôture d’un événement suspendu (porteurs)

| | |
|---|---|
| Destinataires | Porteurs (comptes) d’un billet valable ou utilisé. |
| Déclencheur | Événement suspendu puis clos par l’administration (« Suspendu » → « Terminé »). |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par porteur. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:346-356 ; catalogue : lib/notifications/catalog.ts:1398 ; registre : M/20261109000003_lot9bis_registre.sql:66 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement clos` ; texte : `« {titre} » est clos par l'équipe Event Village après sa suspension. Il n'est pas annulé : aucun remboursement automatique.` ; lien : `/tickets`
  - Exemple : `Événement clos` — `« Concert Test » est clos par l'équipe Event Village après sa suspension. Il n'est pas annulé : aucun remboursement automatique.`
- SMS — modèle : `Event Village : {titre} est clos après sa suspension, sans annulation ni remboursement automatique. {URL}/tickets`
  - Exemple : `Event Village : Concert Test est clos après sa suspension, sans annulation ni remboursement automatique. https://app.eventvillage.sn/tickets`
  - Mesure de l’exemple : 140 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 158 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 29 caractères ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Événement clos — Event Village` ; exemple : `Événement clos — Event Village` ; bouton vers `{URL}/tickets`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `EVENT_CLOSED_BY_ADMIN` — Clôture d’un événement par l’administration

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Même transition, avec le motif de l’administration. |
| Canaux | cloche (application), SMS, email, push |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par clôture. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:357-362 ; catalogue : lib/notifications/catalog.ts:1409 ; registre : M/20261109000003_lot9bis_registre.sql:67 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement clos par l'administration` ; texte : `« {titre} » du {date} est clos par l'administration, sans annulation. Motif : {motif}.` ; lien : `/partner/events/{id}`
  - Exemple : `Événement clos par l'administration` — `« Concert Test » du sam. 14 nov. 2026 à 20:00 est clos par l'administration, sans annulation. Motif : Organisateur injoignable.`
- SMS — modèle : `Event Village : {titre} est clos par l'équipe Event Village après sa suspension. Motif : {motif}.`
  - Exemple : `Event Village : Concert Test est clos par l'équipe Event Village après sa suspension. Motif : Organisateur injoignable.`
  - Mesure de l’exemple : 119 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 152 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30, motif ≤ 40 (avec « ... »).
- Email — sujet : `Événement clos par l'administration — Event Village` ; exemple : `Événement clos par l'administration — Event Village` ; bouton vers `{URL}/partner/events/{id}`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).

#### `SHIFT_OPEN_AT_END` — Caisse encore ouverte à la fin

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Passage à « Terminé » (fin automatique ou clôture d’un suspendu) avec au moins une caisse ouverte ; jamais à l’annulation. Remplace alors EVENT_FINISHED. |
| Canaux | cloche (application), push, SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par passage à Terminé. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:334-339, 365-370 ; catalogue : lib/notifications/catalog.ts:1420 ; registre : M/20261109000003_lot9bis_registre.sql:68 |
| Scénario détaillé | 05-equipe-controle-acces.md |

**Variante : une caisse ouverte**

- Cloche — titre : `Caisse encore ouverte` ; texte : `« {titre} » est terminé et 1 caisse reste ouverte. Fermez-la dans l'onglet Caisse du pilotage.` ; lien : `/partner/events/{id}?tab=caisse`
  - Exemple : `Caisse encore ouverte` — `« Concert Test » est terminé et 1 caisse reste ouverte. Fermez-la dans l'onglet Caisse du pilotage.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} est terminé et 1 caisse reste ouverte. Fermez-la dans le pilotage : {URL}/partner/events`
  - Exemple : `Event Village : Concert Test est terminé et 1 caisse reste ouverte. Fermez-la dans le pilotage : https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 139 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 152 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 35 caractères ; valeurs saisies coupées à : titre ≤ 25 (avec « ... »).
- Email — sujet : `Caisse encore ouverte — Event Village` ; exemple : `Caisse encore ouverte — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=caisse`

**Variante : plusieurs caisses ouvertes**

- Cloche — titre : `Caisse encore ouverte` ; texte : `« {titre} » est terminé et {n} caisses restent ouvertes. Fermez-les dans l'onglet Caisse du pilotage.` ; lien : `/partner/events/{id}?tab=caisse`
  - Exemple : `Caisse encore ouverte` — `« Concert Test » est terminé et 2 caisses restent ouvertes. Fermez-les dans l'onglet Caisse du pilotage.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- SMS — modèle : `Event Village : {titre} est terminé et {n} caisses restent ouvertes. Fermez-les dans le pilotage : {URL}/partner/events`
  - Exemple : `Event Village : Concert Test est terminé et 2 caisses restent ouvertes. Fermez-les dans le pilotage : https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 144 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 158 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 29 caractères ; valeurs saisies coupées à : titre ≤ 25 (avec « ... »).
- Email — sujet : `Caisse encore ouverte — Event Village` ; exemple : `Caisse encore ouverte — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=caisse`

#### `TRANSFER_REVOKED` — Transfert annulé par un remboursement

| | |
|---|---|
| Destinataires | Le destinataire d’un transfert en attente : SMS au numéro ; application, push, email au compte vérifié de ce numéro. |
| Déclencheur | Le billet est remboursé pendant que son transfert attend (hors annulation de l’événement). |
| Canaux | SMS, cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par transfert. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261110000006_lot9ter_equipe_messages.sql:366-392 ; catalogue : lib/notifications/catalog.ts:1440 ; registre : M/20261109000003_lot9bis_registre.sql:69 |
| Scénario détaillé | 07-billets.md |

- SMS — modèle : `Event Village : le billet {titre} qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé.`
  - Exemple : `Event Village : le billet Concert Test qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé.`
  - Mesure de l’exemple : 120 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 138 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Cloche — titre : `Transfert annulé` ; texte : `Le billet pour « {titre} » a été remboursé à son acheteur : le transfert est annulé.` ; lien : `/tickets`
  - Exemple : `Transfert annulé` — `Le billet pour « Concert Test » a été remboursé à son acheteur : le transfert est annulé.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Transfert annulé — Event Village` ; exemple : `Transfert annulé — Event Village` ; bouton vers `{URL}/tickets`

#### `TRANSFER_DECLINED_SENDER` — Transfert refusé (expéditeur)

| | |
|---|---|
| Destinataires | L’expéditeur du transfert (pas pour une invitation refusée : billet annulé sans avis). |
| Déclencheur | Le destinataire refuse le billet. |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par refus. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000008_lot9bis_cycle.sql:1377-1390 ; catalogue : lib/notifications/catalog.ts:1448 ; registre : M/20261109000003_lot9bis_registre.sql:70 |
| Scénario détaillé | 07-billets.md |

- Cloche — titre : `Billet refusé` ; texte : `Le destinataire a refusé votre billet pour « {titre} » : il reste dans vos billets.` ; lien : `/tickets`
  - Exemple : `Billet refusé` — `Le destinataire a refusé votre billet pour « Concert Test » : il reste dans vos billets.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Billet refusé — Event Village` ; exemple : `Billet refusé — Event Village` ; bouton vers `{URL}/tickets`

#### `TRANSFER_RECIPIENT_CHANGED` — Transfert annulé (numéro du destinataire changé)

| | |
|---|---|
| Destinataires | L’expéditeur du transfert. |
| Déclencheur | Le destinataire change le numéro de son compte : ses transferts en attente sont annulés (les invitations à réclamer sont annulées sans avis). |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par transfert annulé. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000004_lot9bis_droits.sql:813-838 ; catalogue : lib/notifications/catalog.ts:1455 ; registre : M/20261109000003_lot9bis_registre.sql:71 |
| Scénario détaillé | 07-billets.md |

- Cloche — titre : `Transfert annulé` ; texte : `Le destinataire de votre billet pour « {titre} » a changé de numéro : le transfert est annulé et le billet reste dans vos billets.` ; lien : `/tickets`
  - Exemple : `Transfert annulé` — `Le destinataire de votre billet pour « Concert Test » a changé de numéro : le transfert est annulé et le billet reste dans vos billets.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Transfert annulé — Event Village` ; exemple : `Transfert annulé — Event Village` ; bouton vers `{URL}/tickets`

#### `CONTROLLER_INVITATION` — Invitation à contrôler l’entrée

| | |
|---|---|
| Destinataires | Le titulaire d’un compte Event Village déjà établi, invité à contrôler (il doit accepter dans l’application). |
| Déclencheur | La partenaire (ou un admin) invite un numéro qui a déjà un compte et confirme l’envoi (route /api/partner/team/invite, fonction controller_invitation_create). |
| Canaux | SMS, cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par invitation (plusieurs événements dans le même message). Une nouvelle invitation de la même partenaire au même compte remplace la précédente. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : app/api/partner/team/invite/route.ts:296-314 ; M/20261109000008_lot9bis_cycle.sql:2015-2060 ; catalogue : lib/notifications/catalog.ts:1465 ; registre : M/20261109000003_lot9bis_registre.sql:72 |
| Scénario détaillé | 05-equipe-controle-acces.md |

**Variante : un événement**

- SMS — modèle : `Event Village : {organisateur} vous invite à scanner les billets de {titre}. Répondez sur {URL}/invitations`
  - Exemple : `Event Village : Fatou Diop Events vous invite à scanner les billets de Concert Test. Répondez sur https://app.eventvillage.sn/invitations`
  - Mesure de l’exemple : 137 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 143 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 44 caractères ; valeurs saisies coupées à : organisateur ≤ 18, titre ≤ 18 (avec « ... »).
- Cloche — titre : `Invitation de {organisateur}` ; texte : `{organisateur} vous invite à contrôler l'entrée de « {titre} ». Répondez avant le {échéance}.` ; lien : `/invitations`
  - Exemple : `Invitation de Fatou Diop Events` — `Fatou Diop Events vous invite à contrôler l'entrée de « Concert Test ». Répondez avant le jeu. 12 nov. 2026 à 18:30.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Invitation de {organisateur} — Event Village` ; exemple : `Invitation de Fatou Diop Events — Event Village` ; bouton vers `{URL}/invitations`

**Variante : deux événements**

- SMS — modèle : `Event Village : {organisateur} vous invite à scanner les billets de {titre}, et 1 autre. Répondez sur {URL}/invitations`
  - Exemple : `Event Village : Fatou Diop Events vous invite à scanner les billets de Concert Test, et 1 autre. Répondez sur https://app.eventvillage.sn/invitations`
  - Mesure de l’exemple : 149 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 158 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 29 caractères ; valeurs saisies coupées à : organisateur ≤ 18, titre ≤ 18 (avec « ... »).
- Cloche — titre : `Invitation de {organisateur}` ; texte : `{organisateur} vous invite à contrôler l'entrée de « {titre} » et 1 autre événement. Répondez avant le {échéance}.` ; lien : `/invitations`
  - Exemple : `Invitation de Fatou Diop Events` — `Fatou Diop Events vous invite à contrôler l'entrée de « Concert Test » et 1 autre événement. Répondez avant le jeu. 12 nov. 2026 à 18:30.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Invitation de {organisateur} — Event Village` ; exemple : `Invitation de Fatou Diop Events — Event Village` ; bouton vers `{URL}/invitations`

#### `EVENT_CANCELLED_BY_ADMIN` — Annulation d’un événement par l’administration

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Annulation décidée par l’administration ; l’avis public est cité, jamais le motif interne. |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par annulation. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:309-315 ; catalogue : lib/notifications/catalog.ts:1491 ; registre : M/20261109000003_lot9bis_registre.sql:73 |
| Scénario détaillé | 04-evenement-cycle.md |

**Variante : avec avis public**

- Cloche — titre : `Événement annulé par l'administration` ; texte : `« {titre} » du {date} est annulé par l'administration. Motif : {avis public}. Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture.` ; lien : `/partner/events/{id}?tab=cloture`
  - Exemple : `Événement annulé par l'administration` — `« Concert Test » du sam. 14 nov. 2026 à 20:00 est annulé par l'administration. Motif : Intempéries annoncées sur Dakar. Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture.`
- SMS — modèle : `Event Village : {titre} annulé par l'administration. Motif : {avis public}. {URL}/partner/events`
  - Exemple : `Event Village : Concert Test annulé par l'administration. Motif : Intempéries annoncées sur Dakar. https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 141 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 157 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 30 caractères ; valeurs saisies coupées à : titre ≤ 25, avis public ≤ 35 (avec « ... »).
- Email — sujet : `Événement annulé par l'administration — Event Village` ; exemple : `Événement annulé par l'administration — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=cloture`

**Variante : sans avis public**

- Cloche — titre : `Événement annulé par l'administration` ; texte : `« {titre} » du {date} est annulé par l'administration. Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture.` ; lien : `/partner/events/{id}?tab=cloture`
  - Exemple : `Événement annulé par l'administration` — `« Concert Test » du sam. 14 nov. 2026 à 20:00 est annulé par l'administration. Les remboursements en ligne sont lancés : suivez-les dans l'onglet Clôture.`
- SMS — modèle : `Event Village : {titre} annulé par l'administration. {URL}/partner/events`
  - Exemple : `Event Village : Concert Test annulé par l'administration. https://app.eventvillage.sn/partner/events`
  - Mesure de l’exemple : 100 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 113 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 74 caractères ; valeurs saisies coupées à : titre ≤ 25, avis public ≤ 35 (avec « ... »).
- Email — sujet : `Événement annulé par l'administration — Event Village` ; exemple : `Événement annulé par l'administration — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=cloture`

#### `ADMIN_EVENT_CANCELLED` — Événement annulé par l’organisateur

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec events.read. |
| Déclencheur | Annulation décidée par la partenaire, avec son motif interne. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par annulation. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | events.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:316-324 ; catalogue : lib/notifications/catalog.ts:1508 ; registre : M/20261109000003_lot9bis_registre.sql:74 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement annulé par l'organisateur` ; texte : `« {titre} » de {organisateur} est annulé par l'organisateur. Motif interne : {motif}.` ; lien : `/admin/events/{id}`
  - Exemple : `Événement annulé par l'organisateur` — `« Concert Test » de Fatou Diop Events est annulé par l'organisateur. Motif interne : Salle indisponible à la date prévue.`
- Email — sujet : `Événement annulé par l'organisateur — Event Village` ; exemple : `Événement annulé par l'organisateur — Event Village` ; bouton vers `{URL}/admin/events/{id}`

#### `CONTROLLER_EVENT_CANCELLED` — Annulation d’un événement contrôlé

| | |
|---|---|
| Destinataires | Contrôleurs affectés (affectations acceptées). |
| Déclencheur | Passage de l’événement à « Annulé ». |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par contrôleur. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:326-333 ; catalogue : lib/notifications/catalog.ts:1522 ; registre : M/20261109000003_lot9bis_registre.sql:75 |
| Scénario détaillé | 05-equipe-controle-acces.md |

- Cloche — titre : `Contrôle annulé` ; texte : `« {titre} » du {date} est annulé : votre affectation à l'entrée est retirée.` ; lien : `/controller/scanner`
  - Exemple : `Contrôle annulé` — `« Concert Test » du sam. 14 nov. 2026 à 20:00 est annulé : votre affectation à l'entrée est retirée.`
- SMS — modèle : `Event Village : {titre} du {date} est annulé. Votre affectation à l'entrée est retirée.`
  - Exemple : `Event Village : Concert Test du sam. 14 nov. à 20:00 est annulé. Votre affectation à l'entrée est retirée.`
  - Mesure de l’exemple : 106 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 125 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Contrôle annulé — Event Village` ; exemple : `Contrôle annulé — Event Village` ; bouton vers `{URL}/controller/scanner`

#### `CONTROLLER_EVENT_CHANGED` — Changement d’un événement contrôlé

| | |
|---|---|
| Destinataires | Contrôleurs affectés (affectations acceptées). |
| Déclencheur | Même modification que EVENT_CHANGED, quand la date, l’heure ou le lieu changent. |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Application : tout de suite. SMS et email : dus 10 minutes après la première modification, fusionnés comme EVENT_CHANGED ; titre seul : aucun message nouveau. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:877-915 ; catalogue : lib/notifications/catalog.ts:1533 ; registre : M/20261109000003_lot9bis_registre.sql:76 |
| Scénario détaillé | 05-equipe-controle-acces.md |

**Variante : date changée**

- Cloche — titre : `Contrôle modifié` ; texte : `« {titre} » : nouvelle date : {nouvelle date}. Votre affectation est maintenue.` ; lien : `/controller/scanner`
  - Exemple : `Contrôle modifié` — `« Concert Test » : nouvelle date : sam. 21 nov. 2026 à 21:00. Votre affectation est maintenue.`
- SMS — modèle : `Event Village : affectation à l'entrée de {titre} : nouvelle date {nouvelle date}. {URL}/login`
  - Exemple : `Event Village : affectation à l'entrée de Concert Test : nouvelle date sam. 21 nov. à 21:00. https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 126 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 140 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 47 caractères.
- Email — sujet : `Contrôle modifié — Event Village` ; exemple : `Contrôle modifié — Event Village` ; bouton vers `{URL}/controller/scanner`

**Variante : lieu changé**

- Cloche — titre : `Contrôle modifié` ; texte : `« {titre} » : nouveau lieu : {nouveau lieu}. Votre affectation est maintenue.` ; lien : `/controller/scanner`
  - Exemple : `Contrôle modifié` — `« Concert Test » : nouveau lieu : Place de l’Obélisque. Votre affectation est maintenue.`
- SMS — modèle : `Event Village : affectation à l'entrée de {titre} : nouveau lieu {nouveau lieu}. {URL}/login`
  - Exemple : `Event Village : affectation à l'entrée de Concert Test : nouveau lieu Place de l'Obélisque. https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 125 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 142 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 45 caractères.
- Email — sujet : `Contrôle modifié — Event Village` ; exemple : `Contrôle modifié — Event Village` ; bouton vers `{URL}/controller/scanner`

**Variante : date et lieu changés**

- Cloche — titre : `Contrôle modifié` ; texte : `« {titre} » : nouvelle date : {nouvelle date}, nouveau lieu : {nouveau lieu}. Votre affectation est maintenue.` ; lien : `/controller/scanner`
  - Exemple : `Contrôle modifié` — `« Concert Test » : nouvelle date : sam. 21 nov. 2026 à 21:00, nouveau lieu : Place de l’Obélisque. Votre affectation est maintenue.`
- SMS — modèle : `Event Village : affectation à l'entrée de {titre} : {nouvelle date}, {nouveau lieu}. {URL}/login`
  - Exemple : `Event Village : affectation à l'entrée de Concert Test : sam. 21 nov. à 21:00, Place de l'Obélisque. https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 134 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 147 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 40 caractères.
- Email — sujet : `Contrôle modifié — Event Village` ; exemple : `Contrôle modifié — Event Village` ; bouton vers `{URL}/controller/scanner`

**Variante : heure de fin seule**

- Cloche — titre : `Contrôle modifié` ; texte : `« {titre} » : nouvelle fin : {nouvelle fin}. Votre affectation est maintenue.` ; lien : `/controller/scanner`
  - Exemple : `Contrôle modifié` — `« Concert Test » : nouvelle fin : dim. 15 nov. 2026 à 02:00. Votre affectation est maintenue.`
- SMS — modèle : `Event Village : affectation à l'entrée de {titre} : nouvelle fin le {nouvelle fin}. {URL}/login`
  - Exemple : `Event Village : affectation à l'entrée de Concert Test : nouvelle fin le dim. 15 nov. à 02:00. https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 128 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 142 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 45 caractères.
- Email — sujet : `Contrôle modifié — Event Village` ; exemple : `Contrôle modifié — Event Village` ; bouton vers `{URL}/controller/scanner`

#### `CONTROLLER_EVENT_STATUS` — Suspension ou reprise d’un événement contrôlé

| | |
|---|---|
| Destinataires | Contrôleurs affectés (affectations acceptées). |
| Déclencheur | Passage de « Publié » à « Suspendu », ou de « Suspendu » à « Publié ». |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par contrôleur et par transition. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:188-195, 213-220 ; catalogue : lib/notifications/catalog.ts:1541 ; registre : M/20261109000003_lot9bis_registre.sql:77 |
| Scénario détaillé | 05-equipe-controle-acces.md |

**Variante : suspension**

- Cloche — titre : `Événement suspendu` ; texte : `« {titre} » est suspendu : le contrôle d'accès est fermé jusqu'à nouvel avis.` ; lien : `/controller/scanner`
  - Exemple : `Événement suspendu` — `« Concert Test » est suspendu : le contrôle d'accès est fermé jusqu'à nouvel avis.`
- Email — sujet : `Événement suspendu — Event Village` ; exemple : `Événement suspendu — Event Village` ; bouton vers `{URL}/controller/scanner`

**Variante : reprise**

- Cloche — titre : `Événement de nouveau en ligne` ; texte : `« {titre} » reprend : votre affectation est maintenue.` ; lien : `/controller/scanner`
  - Exemple : `Événement de nouveau en ligne` — `« Concert Test » reprend : votre affectation est maintenue.`
- Email — sujet : `Événement de nouveau en ligne — Event Village` ; exemple : `Événement de nouveau en ligne — Event Village` ; bouton vers `{URL}/controller/scanner`

#### `TICKET_CANCELLED` — Billet annulé

| | |
|---|---|
| Destinataires | Le porteur du billet (compte) ; pour une invitation non réclamée, son numéro (SMS seul). |
| Déclencheur | Billet gratuit, invitation ou billet payé en espèces annulé hors annulation de l’événement (remboursement d’un billet, annulation d’une invitation). |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par billet. La personne qui annule (organisatrice) est le « compte déclencheur » du SMS dans le remboursement d’un billet. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261110000006_lot9ter_equipe_messages.sql:400-419 ; M/20261109000009_lot9bis_messages.sql:1058-1072 ; catalogue : lib/notifications/catalog.ts:1555 ; registre : M/20261109000003_lot9bis_registre.sql:78 |
| Scénario détaillé | 07-billets.md |

**Variante : invitation**

- Cloche — titre : `Invitation annulée` ; texte : `Votre invitation pour « {titre} » du {date} est annulée par l'organisateur.` ; lien : `/tickets`
  - Exemple : `Invitation annulée` — `Votre invitation pour « Concert Test » du sam. 14 nov. 2026 à 20:00 est annulée par l'organisateur.`
- SMS — modèle : `Event Village : votre invitation pour {titre} du {date} est annulée par l'organisateur.`
  - Exemple : `Event Village : votre invitation pour Concert Test du sam. 14 nov. à 20:00 est annulée par l'organisateur.`
  - Mesure de l’exemple : 106 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 125 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Invitation annulée — Event Village` ; exemple : `Invitation annulée — Event Village` ; bouton vers `{URL}/tickets`

**Variante : billet gratuit**

- Cloche — titre : `Billet annulé` ; texte : `Votre billet gratuit pour « {titre} » du {date} est annulé par l'organisateur.` ; lien : `/tickets`
  - Exemple : `Billet annulé` — `Votre billet gratuit pour « Concert Test » du sam. 14 nov. 2026 à 20:00 est annulé par l'organisateur.`
- SMS — modèle : `Event Village : votre billet gratuit pour {titre} du {date} est annulé par l'organisateur.`
  - Exemple : `Event Village : votre billet gratuit pour Concert Test du sam. 14 nov. à 20:00 est annulé par l'organisateur.`
  - Mesure de l’exemple : 109 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 128 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Billet annulé — Event Village` ; exemple : `Billet annulé — Event Village` ; bouton vers `{URL}/tickets`

**Variante : billet payé en espèces**

- Cloche — titre : `Billet annulé` ; texte : `Votre billet pour « {titre} » du {date} est annulé. Le remboursement se fait auprès de l'organisateur.` ; lien : `/tickets`
  - Exemple : `Billet annulé` — `Votre billet pour « Concert Test » du sam. 14 nov. 2026 à 20:00 est annulé. Le remboursement se fait auprès de l'organisateur.`
- SMS — modèle : `Event Village : votre billet pour {titre} du {date} est annulé. Remboursement par l'organisateur.`
  - Exemple : `Event Village : votre billet pour Concert Test du sam. 14 nov. à 20:00 est annulé. Remboursement par l'organisateur.`
  - Mesure de l’exemple : 116 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 135 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : titre ≤ 30 (avec « ... »).
- Email — sujet : `Billet annulé — Event Village` ; exemple : `Billet annulé — Event Village` ; bouton vers `{URL}/tickets`

#### `ACCOUNT_SUSPENDED` — Compte suspendu

| | |
|---|---|
| Destinataires | Le compte suspendu (envoyé malgré la suspension). |
| Déclencheur | Un administrateur passe le compte à « Suspendu » (fonction admin_user_status_set). |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par changement. L’administrateur est le « compte déclencheur » du SMS. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000004_lot9bis_droits.sql:514-523 ; catalogue : lib/notifications/catalog.ts:1577 ; registre : M/20261109000003_lot9bis_registre.sql:79 |
| Scénario détaillé | 02-comptes.md |

- Cloche — titre : `Compte suspendu` ; texte : `Votre compte est suspendu. Motif : {motif}. Vos billets payés restent valables à l'entrée : présentez le billet hors ligne déjà enregistré sur votre téléphone, ou donnez le numéro du billet avec une pièce d'identité. Contactez le support.` ; lien : `/billet/hors-ligne`
  - Exemple : `Compte suspendu` — `Votre compte est suspendu. Motif : Paiements contestés. Vos billets payés restent valables à l'entrée : présentez le billet hors ligne déjà enregistré sur votre téléphone, ou donnez le numéro du billet avec une pièce d'identité. Contactez le support.`
- SMS — modèle : `Event Village : votre compte est suspendu. Motif : {motif}. Vos billets payés restent valables à l'entrée. Contactez le support.`
  - Exemple : `Event Village : votre compte est suspendu. Motif : Paiements contestés. Vos billets payés restent valables à l'entrée. Contactez le support.`
  - Mesure de l’exemple : 140 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 155 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : motif ≤ 35 (avec « ... »).
- Email — sujet : `Compte suspendu — Event Village` ; exemple : `Compte suspendu — Event Village` ; bouton vers `{URL}/billet/hors-ligne`

#### `ACCOUNT_REACTIVATED` — Compte réactivé

| | |
|---|---|
| Destinataires | Le compte réactivé. |
| Déclencheur | Un administrateur sort le compte de « Suspendu ». |
| Canaux | cloche (application), SMS, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par changement. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000004_lot9bis_droits.sql:514-523 ; catalogue : lib/notifications/catalog.ts:1588 ; registre : M/20261109000003_lot9bis_registre.sql:80 |
| Scénario détaillé | 02-comptes.md |

- Cloche — titre : `Compte réactivé` ; texte : `Votre compte est réactivé : vous pouvez de nouveau vous connecter.` ; lien : `/login`
  - Exemple : `Compte réactivé` — `Votre compte est réactivé : vous pouvez de nouveau vous connecter.`
- SMS — modèle : `Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : {URL}/login`
  - Exemple : `Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : https://app.eventvillage.sn/login`
  - Mesure de l’exemple : 116 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 116 caractères, GSM-7, 1 segment ; reste sur 1 segment tant que l’adresse de l’application fait au plus 71 caractères.
- Email — sujet : `Compte réactivé — Event Village` ; exemple : `Compte réactivé — Event Village` ; bouton vers `{URL}/login`

#### `ADMIN_EVENT_CHANGED` — Événement modifié après validation

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec events.read. |
| Déclencheur | Après validation (Validé, Publié, Suspendu) : titre, affiche, lieu ou date changés ; catégorie ajoutée ; prix ou canaux de vente d’une catégorie changés. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par enregistrement. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | events.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:1090-1139 (fiche), 1148-1180 (catégorie ajoutée) ; M/20261110000006_lot9ter_equipe_messages.sql:150-197 (prix, canaux) ; catalogue : lib/notifications/catalog.ts:1597 ; registre : M/20261109000003_lot9bis_registre.sql:81 |
| Scénario détaillé | 04-evenement-cycle.md |

**Variante : titre et affiche**

- Cloche — titre : `Événement modifié après validation` ; texte : `« {titre} » de {organisateur} : nouveau titre (ancien : « {ancien titre} »), nouvelle affiche après validation. Vérifiez la fiche.` ; lien : `/admin/events/{id}`
  - Exemple : `Événement modifié après validation` — `« Concert Test » de Fatou Diop Events : nouveau titre (ancien : « Gala Teranga »), nouvelle affiche après validation. Vérifiez la fiche.`
- Email — sujet : `Événement modifié après validation — Event Village` ; exemple : `Événement modifié après validation — Event Village` ; bouton vers `{URL}/admin/events/{id}`

**Variante : lieu et date**

- Cloche — titre : `Événement modifié après validation` ; texte : `« {titre} » de {organisateur} : nouveau lieu, nouvelle date après validation. Vérifiez la fiche.` ; lien : `/admin/events/{id}`
  - Exemple : `Événement modifié après validation` — `« Concert Test » de Fatou Diop Events : nouveau lieu, nouvelle date après validation. Vérifiez la fiche.`
- Email — sujet : `Événement modifié après validation — Event Village` ; exemple : `Événement modifié après validation — Event Village` ; bouton vers `{URL}/admin/events/{id}`

**Variante : catégorie ajoutée**

- Cloche — titre : `Événement modifié après validation` ; texte : `« {titre} » de {organisateur} : catégorie « {catégorie} » ajoutée après validation. Vérifiez la fiche.` ; lien : `/admin/events/{id}`
  - Exemple : `Événement modifié après validation` — `« Concert Test » de Fatou Diop Events : catégorie « Carré VIP » ajoutée après validation. Vérifiez la fiche.`
- Email — sujet : `Événement modifié après validation — Event Village` ; exemple : `Événement modifié après validation — Event Village` ; bouton vers `{URL}/admin/events/{id}`

**Variante : prix d’une catégorie**

- Cloche — titre : `Événement modifié après validation` ; texte : `« {titre} » de {organisateur} : nouveau prix pour « {catégorie} » ({nouveau prix} au lieu de {ancien prix}) après validation. Vérifiez la fiche.` ; lien : `/admin/events/{id}`
  - Exemple : `Événement modifié après validation` — `« Concert Test » de Fatou Diop Events : nouveau prix pour « Carré VIP » (7 500 F CFA au lieu de 5 000 F CFA) après validation. Vérifiez la fiche.`
- Email — sujet : `Événement modifié après validation — Event Village` ; exemple : `Événement modifié après validation — Event Village` ; bouton vers `{URL}/admin/events/{id}`

**Variante : canaux de vente d’une catégorie**

- Cloche — titre : `Événement modifié après validation` ; texte : `« {titre} » de {organisateur} : canaux de vente de « {catégorie} » changés (au guichet seulement) après validation. Vérifiez la fiche.` ; lien : `/admin/events/{id}`
  - Exemple : `Événement modifié après validation` — `« Concert Test » de Fatou Diop Events : canaux de vente de « Carré VIP » changés (au guichet seulement) après validation. Vérifiez la fiche.`
- Email — sujet : `Événement modifié après validation — Event Village` ; exemple : `Événement modifié après validation — Event Village` ; bouton vers `{URL}/admin/events/{id}`

#### `EVENT_SUBMITTED_ACK` — Événement envoyé en validation

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Soumission (« Brouillon » → « En attente »). |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par soumission. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:138-146 ; catalogue : lib/notifications/catalog.ts:1610 ; registre : M/20261109000003_lot9bis_registre.sql:82 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement envoyé en validation` ; texte : `« {titre} » est envoyé à l'équipe Event Village pour validation. Vous serez prévenu de la décision.` ; lien : `/partner/events/{id}`
  - Exemple : `Événement envoyé en validation` — `« Concert Test » est envoyé à l'équipe Event Village pour validation. Vous serez prévenu de la décision.`
- Email — sujet : `Événement envoyé en validation — Event Village` ; exemple : `Événement envoyé en validation — Event Village` ; bouton vers `{URL}/partner/events/{id}`

#### `EVENT_FINISHED` — Événement terminé

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Passage de « Publié » à « Terminé » sans caisse ouverte. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par événement. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:334-344 ; catalogue : lib/notifications/catalog.ts:1620 ; registre : M/20261109000003_lot9bis_registre.sql:83 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement terminé` ; texte : `« {titre} » est terminé. Le rapport de clôture est prêt dans l'onglet Clôture.` ; lien : `/partner/events/{id}?tab=cloture`
  - Exemple : `Événement terminé` — `« Concert Test » est terminé. Le rapport de clôture est prêt dans l'onglet Clôture.`
- Email — sujet : `Événement terminé — Event Village` ; exemple : `Événement terminé — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=cloture`

#### `CLOSING_REPORT_READY` — Rapport de clôture prêt

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Fermeture de la dernière caisse d’un événement déjà Terminé. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par événement. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:1189-1222 ; catalogue : lib/notifications/catalog.ts:1627 ; registre : M/20261109000003_lot9bis_registre.sql:84 |
| Scénario détaillé | 05-equipe-controle-acces.md |

- Cloche — titre : `Rapport de clôture prêt` ; texte : `Toutes les caisses de « {titre} » sont fermées : le rapport de clôture est prêt.` ; lien : `/partner/events/{id}?tab=cloture`
  - Exemple : `Rapport de clôture prêt` — `Toutes les caisses de « Concert Test » sont fermées : le rapport de clôture est prêt.`
- Email — sujet : `Rapport de clôture prêt — Event Village` ; exemple : `Rapport de clôture prêt — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=cloture`

#### `FUNDS_AVAILABLE` — Recettes disponibles

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Toutes les recettes en ligne d’un événement Terminé (depuis moins de 30 jours) sont disponibles au retrait ; contrôlé à la fin de chaque passage de l’envoyeur. |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Une fois par événement (100 événements au plus par passage). |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261109000009_lot9bis_messages.sql:1343-1362 ; catalogue : lib/notifications/catalog.ts:1634 ; registre : M/20261109000003_lot9bis_registre.sql:85 |
| Scénario détaillé | 08-argent.md |

- Cloche — titre : `Recettes disponibles` ; texte : `Les recettes de « {titre} » sont disponibles sur votre solde : vous pouvez demander un retrait.` ; lien : `/partner/finance`
  - Exemple : `Recettes disponibles` — `Les recettes de « Concert Test » sont disponibles sur votre solde : vous pouvez demander un retrait.`
- Email — sujet : `Recettes disponibles — Event Village` ; exemple : `Recettes disponibles — Event Village` ; bouton vers `{URL}/partner/finance`

#### `TICKET_REFUNDED_HOLDER` — Billet transféré annulé (détenteur)

| | |
|---|---|
| Destinataires | Le porteur actuel d’un billet reçu par transfert, quand ce billet est remboursé à son acheteur d’origine. |
| Déclencheur | Remboursement d’un billet (versé ou auprès de l’organisateur) hors annulation, billet transféré à un autre compte. |
| Canaux | SMS, cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par billet. L’acheteur d’origine reçoit REFUND_REQUESTED. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | SMS : aucun plafond global ; 30 par numéro et par jour, 30 par compte déclencheur s’il y en a un |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : M/20261110000006_lot9ter_equipe_messages.sql:351-354, 421-430 ; catalogue : lib/notifications/catalog.ts:1642 ; registre : M/20261110000004_lot9ter_registre.sql:19 |
| Scénario détaillé | 07-billets.md |

- SMS — modèle : `Event Village : votre billet {catégorie} pour {titre} a été annulé. Le remboursement est versé à l'acheteur d'origine.`
  - Exemple : `Event Village : votre billet VIP pour Concert Test a été annulé. Le remboursement est versé à l'acheteur d'origine.`
  - Mesure de l’exemple : 115 caractères, GSM-7, 1 segment ; pire cas (textes saisis très longs, montants à 7 chiffres) : 155 caractères, GSM-7, 1 segment ; valeurs saisies coupées à : catégorie ≤ 25, titre ≤ 30 (avec « ... »).
- Cloche — titre : `Billet annulé` ; texte : `Votre billet {catégorie} pour « {titre} » du {date} a été annulé. Le remboursement est versé à l'acheteur d'origine.` ; lien : `/tickets`
  - Exemple : `Billet annulé` — `Votre billet VIP pour « Concert Test » du sam. 14 nov. 2026 à 20:00 a été annulé. Le remboursement est versé à l'acheteur d'origine.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Billet annulé — Event Village` ; exemple : `Billet annulé — Event Village` ; bouton vers `{URL}/tickets`

#### `ADMIN_EVENT_PUBLISHED` — Événement publié par l’organisateur

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec events.read. |
| Déclencheur | La partenaire publie son événement validé (« Validé » → « Publié »). |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par publication. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | events.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261110000006_lot9ter_equipe_messages.sql:115-129 ; catalogue : lib/notifications/catalog.ts:1653 ; registre : M/20261110000004_lot9ter_registre.sql:20 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Événement publié par l'organisateur` ; texte : `« {titre} » de {organisateur} est publié par l'organisateur : sa page publique est en ligne.` ; lien : `/admin/events/{id}`
  - Exemple : `Événement publié par l'organisateur` — `« Concert Test » de Fatou Diop Events est publié par l'organisateur : sa page publique est en ligne.`
- Email — sujet : `Événement publié par l'organisateur — Event Village` ; exemple : `Événement publié par l'organisateur — Event Village` ; bouton vers `{URL}/admin/events/{id}`

#### `ADMIN_EVENT_WITHDRAWN` — Soumission retirée par l’organisateur

| | |
|---|---|
| Destinataires | SUPERADMIN et ADMIN avec events.read. |
| Déclencheur | La partenaire retire sa soumission (« En attente » → « Brouillon »). |
| Canaux | cloche (application), email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Un message par administrateur et par retrait. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Permission admin | events.read (et tout SUPERADMIN) |
| Preuves | déclencheur : M/20261110000006_lot9ter_equipe_messages.sql:117-129 ; catalogue : lib/notifications/catalog.ts:1666 ; registre : M/20261110000004_lot9ter_registre.sql:21 |
| Scénario détaillé | 04-evenement-cycle.md |

- Cloche — titre : `Soumission retirée par l'organisateur` ; texte : `« {titre} » de {organisateur} est retiré de la validation par l'organisateur : il n'attend plus votre examen.` ; lien : `/admin/events/{id}`
  - Exemple : `Soumission retirée par l'organisateur` — `« Concert Test » de Fatou Diop Events est retiré de la validation par l'organisateur : il n'attend plus votre examen.`
- Email — sujet : `Soumission retirée par l'organisateur — Event Village` ; exemple : `Soumission retirée par l'organisateur — Event Village` ; bouton vers `{URL}/admin/events/{id}`

#### `SCAN_REFUSALS_ALERT` — Refus en série à une porte

| | |
|---|---|
| Destinataires | La propriétaire de l’événement. |
| Déclencheur | Au moins access.refusal_alert_threshold refus (10 par défaut) à une même porte en access.refusal_alert_minutes minutes (5 par défaut). |
| Canaux | cloche (application), push, email |
| Indispensable ou optionnel | indispensable |
| Regroupement | Au plus une alerte par porte et par durée observée. |
| Heures calmes (22 h–8 h) | aucun effet : envoyé à toute heure sur tous ses canaux |
| Plafond quotidien | aucun (pas de SMS) |
| Compte suspendu | non envoyé (motif « Compte suspendu ») |
| Preuves | déclencheur : M/20261110000010_lot9ter_pilotage.sql:887-955 ; réglages M/20261110000002_lot9ter_reglages.sql:40-43 ; catalogue : lib/notifications/catalog.ts:1679 ; registre : M/20261110000004_lot9ter_registre.sql:22 |
| Scénario détaillé | 05-equipe-controle-acces.md |

- Cloche — titre : `Refus en série à une porte` ; texte : `{porte} : {nombre de refus} refus en {minutes} minutes pour « {titre} ». Vérifiez la porte avec vos contrôleurs.` ; lien : `/partner/events/{id}?tab=entrees`
  - Exemple : `Refus en série à une porte` — `Porte B : 12 refus en 5 minutes pour « Concert Test ». Vérifiez la porte avec vos contrôleurs.`
- Push : même titre et même texte que la cloche, texte coupé à 160 caractères avec « … » (lib/notifications/catalog.ts:282-286 ; lib/notifications/dispatcher.ts:401).
- Email — sujet : `Refus en série à une porte — Event Village` ; exemple : `Refus en série à une porte — Event Village` ; bouton vers `{URL}/partner/events/{id}?tab=entrees`

#### `OTP_LOGIN` — Code de connexion

| | |
|---|---|
| Destinataires | Le numéro qui demande un code de connexion. |
| Déclencheur | Demande de code (route /api/auth/send-otp). |
| Canaux | SMS (envoi immédiat, hors boîte d’envoi) |
| Indispensable ou optionnel | indispensable |
| Regroupement | Envoi immédiat, un par demande. |
| Heures calmes (22 h–8 h) | aucun effet : envoi immédiat à toute heure |
| Plafond quotidien | plafond global (1 000 par jour), 3 codes par numéro en 15 min et 10 par jour, 10 par adresse IP et par heure, 30 par jour |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : app/api/auth/send-otp/route.ts:101 ; lib/notifications/catalog.ts:1796-1806 ; catalogue : lib/notifications/catalog.ts:1688 ; registre : M/20261103000002_lot6_outbox.sql:139 |
| Scénario détaillé | 02-comptes.md |

Texte : voir 10.2 (envois immédiats).

#### `OTP_REGISTER` — Code d’inscription

| | |
|---|---|
| Destinataires | Le numéro qui s’inscrit (client ou partenaire). |
| Déclencheur | Inscription (routes /api/auth/register/start et /api/partner/register). |
| Canaux | SMS (envoi immédiat, hors boîte d’envoi) |
| Indispensable ou optionnel | indispensable |
| Regroupement | Envoi immédiat, un par demande. |
| Heures calmes (22 h–8 h) | aucun effet : envoi immédiat à toute heure |
| Plafond quotidien | plafond global (1 000 par jour), 3 codes par numéro en 15 min et 10 par jour, 10 par adresse IP et par heure, 30 par jour |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : app/api/auth/register/start/route.ts:64 ; app/api/partner/register/route.ts:136 ; catalogue : lib/notifications/catalog.ts:1689 ; registre : M/20261103000002_lot6_outbox.sql:140 |
| Scénario détaillé | 02-comptes.md |

Texte : voir 10.2 (envois immédiats).

#### `OTP_PASSWORD_RESET` — Code de réinitialisation du mot de passe

| | |
|---|---|
| Destinataires | Le numéro qui a oublié son mot de passe. |
| Déclencheur | Demande de réinitialisation (route /api/auth/send-otp, objet PASSWORD_RESET). |
| Canaux | SMS (envoi immédiat, hors boîte d’envoi) |
| Indispensable ou optionnel | indispensable |
| Regroupement | Envoi immédiat, un par demande. |
| Heures calmes (22 h–8 h) | aucun effet : envoi immédiat à toute heure |
| Plafond quotidien | plafond global (1 000 par jour), 3 codes par numéro en 15 min et 10 par jour, 10 par adresse IP et par heure, 30 par jour |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : app/api/auth/send-otp/route.ts:101 ; lib/notifications/catalog.ts:1807-1808 ; catalogue : lib/notifications/catalog.ts:1690 ; registre : M/20261103000002_lot6_outbox.sql:141 |
| Scénario détaillé | 02-comptes.md |

Texte : voir 10.2 (envois immédiats).

#### `OTP_WITHDRAWAL` — Code de confirmation d’un retrait

| | |
|---|---|
| Destinataires | Le numéro du compte qui demande un retrait. |
| Déclencheur | Demande de code de retrait (route /api/withdrawals/otp). |
| Canaux | SMS (envoi immédiat, hors boîte d’envoi) |
| Indispensable ou optionnel | indispensable |
| Regroupement | Envoi immédiat, un par demande. |
| Heures calmes (22 h–8 h) | aucun effet : envoi immédiat à toute heure |
| Plafond quotidien | plafond global (1 000 par jour), 3 codes par numéro en 15 min et 10 par jour, 10 par adresse IP et par heure, 30 par jour |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : app/api/withdrawals/otp/route.ts:115 ; lib/notifications/catalog.ts:1805-1806 ; catalogue : lib/notifications/catalog.ts:1691 ; registre : M/20261103000002_lot6_outbox.sql:142 |
| Scénario détaillé | 08-argent.md |

Texte : voir 10.2 (envois immédiats).

#### `OTP_PHONE_CHANGE` — Code de changement de numéro

| | |
|---|---|
| Destinataires | Le NOUVEAU numéro saisi. |
| Déclencheur | Changement de numéro (route /api/account/phone/start). |
| Canaux | SMS (envoi immédiat, hors boîte d’envoi) |
| Indispensable ou optionnel | indispensable |
| Regroupement | Envoi immédiat, un par demande. |
| Heures calmes (22 h–8 h) | aucun effet : envoi immédiat à toute heure |
| Plafond quotidien | plafond global (1 000 par jour), 3 codes par numéro en 15 min et 10 par jour, 10 par adresse IP et par heure, 30 par jour |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : app/api/account/phone/start/route.ts:74 ; catalogue : lib/notifications/catalog.ts:1692 ; registre : M/20261108000004_lot9_compte.sql:32 |
| Scénario détaillé | 02-comptes.md |

Texte : voir 10.2 (envois immédiats).

#### `OTP_AUTH_HOOK` — Code de connexion (Supabase)

| | |
|---|---|
| Destinataires | Le numéro qui demande un code par l’authentification Supabase. |
| Déclencheur | Appel du crochet SMS de Supabase (route /api/auth/sms-hook). |
| Canaux | SMS (envoi immédiat, hors boîte d’envoi) |
| Indispensable ou optionnel | indispensable |
| Regroupement | Envoi immédiat, un par demande. |
| Heures calmes (22 h–8 h) | aucun effet : envoi immédiat à toute heure |
| Plafond quotidien | plafond global (1 000 par jour), 3 codes par numéro en 15 min et 10 par jour, 10 par adresse IP et par heure, 30 par jour |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : app/api/auth/sms-hook/route.ts:93 ; catalogue : lib/notifications/catalog.ts:1693 ; registre : M/20261103000002_lot6_outbox.sql:143 |
| Scénario détaillé | 02-comptes.md |

Texte : voir 10.2 (envois immédiats).

#### `CONTROLLER_INVITE` — Invitation d’un contrôleur

| | |
|---|---|
| Destinataires | Le numéro d’un contrôleur à activer : numéro sans compte, ou compte créé par une invitation et jamais activé. |
| Déclencheur | La partenaire invite ce numéro (route /api/partner/team/invite) ; le SMS part pendant la requête. |
| Canaux | SMS (envoi immédiat, hors boîte d’envoi) |
| Indispensable ou optionnel | indispensable |
| Regroupement | Envoi immédiat, un par invitation (le dernier code envoyé est le seul valable, app/api/partner/team/invite/route.ts:493-506). |
| Heures calmes (22 h–8 h) | aucun effet : envoi immédiat à toute heure |
| Plafond quotidien | part hors codes du plafond global (700 sur 1 000 par jour par défaut), 30 SMS par numéro et par jour, 30 par compte déclencheur |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : app/api/partner/team/invite/route.ts:481-534 ; texte lib/notifications/catalog.ts:1809-1815 ; catalogue : lib/notifications/catalog.ts:1694 ; registre : M/20261103000002_lot6_outbox.sql:144 |
| Scénario détaillé | 05-equipe-controle-acces.md |

Texte : voir 10.2 (envois immédiats).

#### `EMAIL_VERIFICATION` — Vérification de l’adresse email

| | |
|---|---|
| Destinataires | L’adresse email saisie, en attente de vérification. |
| Déclencheur | Saisie ou changement d’adresse (inscription client ou partenaire, profil, création par un admin, renvoi du lien). |
| Canaux | email (envoi immédiat, hors boîte d’envoi) |
| Indispensable ou optionnel | indispensable |
| Regroupement | Envoi immédiat, un par demande ; lien valable 24 heures. |
| Heures calmes (22 h–8 h) | aucun effet : envoi immédiat à toute heure |
| Plafond quotidien | liens par compte et par heure (3) et par adresse et par jour (5) |
| Compte suspendu | envoyé quand même |
| Preuves | déclencheur : lib/email/verification.ts:1-19 ; appelants app/api/auth/register/route.ts:230, app/api/partner/register/route.ts:264, app/api/account/profile/route.ts:105, app/api/admin/users/route.ts:224, app/api/account/email/resend/route.ts:35 ; catalogue : lib/notifications/catalog.ts:1696 ; registre : M/20261109000003_lot9bis_registre.sql:86 |
| Scénario détaillé | 02-comptes.md |

Texte : voir 10.2 (envois immédiats).

---

## 10.13 Réponses aux questions de la recette

- **Le SMS optionnel en heures calmes est-il perdu ou reporté à 8 h ?** **Perdu.** À l'envoi, entre 22 h et 8 h (heure de
  Dakar, réglable), la ligne SMS d'un type optionnel passe « Non envoyée », motif « Plage sans SMS (nuit) » : statut final,
  jamais reporté, jamais relançable. La cloche, le push et l'email du même message partent normalement, et les SMS
  indispensables partent aussi la nuit. Six types sont concernés : `REMINDER_J1`, `REMINDER_H3`, `CONTROLLER_REMINDER`,
  `FIRST_TICKET_SOLD`, `CATEGORY_SOLD_OUT`, `EVENT_SOLD_OUT`. Preuves : `M/20261109000010_lot9bis_email.sql:487-503` ;
  `M/20261103000002_lot6_outbox.sql:228-259` ; `M/20261103000008_lot6_supervision.sql:442-444` (scénario 10.3).
- **A3 — L'invitation d'un nouveau contrôleur part-elle immédiatement ?** **Oui** : le SMS (code d'activation et lien)
  part pendant la requête de la partenaire, hors boîte d'envoi, à toute heure (`app/api/partner/team/invite/route.ts:509-534`).
  **Caractères et segments :** 141 caractères sans prénom, 156 avec « Fatou », 160 au plus (prénom coupé à 9 caractères),
  GSM-7, **1 segment**, avec une adresse d'application de 27 caractères ; formule 114 + longueur de l'adresse (sans
  prénom), 124 + prénom + adresse (avec prénom) : une adresse de plus de 27 caractères peut faire passer le SMS à 2 segments
  (adresse de production **NON VÉRIFIÉE**). **Où voir son état :** `/admin/notifications` (permission `notifications.read`),
  type « Invitation d'un contrôleur », statut « Envoyée », « Non envoyée », « En échec » ou « Incertaine », origine « Envoi
  immédiat journalisé (code à usage unique ou invitation) » ; le nombre de segments n'y est pas conservé. La partenaire voit
  le résultat dans la réponse : « SMS avec code d'activation envoyé. » ou « SMS non envoyé : {raison}. Renvoyez l’invitation
  plus tard. » (scénario 10.2).
- **A5 — Texte du SMS d'invitation à contrôler envoyé à un compte existant ; nomme-t-il l'organisateur ?**
  `Event Village : {organisateur} vous invite à scanner les billets de {titre}. Répondez sur {URL}/invitations` (plusieurs
  événements : `…de {titre}, et 1 autre.` / `…, et {N} autres.`). **Oui, il nomme l'organisateur** : nom commercial de la
  partenaire, sinon sa raison sociale, coupé à 18 caractères ; le titre est coupé à 18 caractères. Ce SMS est mis en file
  (`CONTROLLER_INVITATION`, départ au passage suivant de l'envoyeur). Preuves : `lib/notifications/catalog.ts:1477-1481` ;
  `M/20261109000008_lot9bis_cycle.sql:2014-2015, 2058-2061`.
- **Messages reçus par un administrateur :** 19 types, jamais par SMS ; cloche et email toujours, push en plus pour 7 types
  (10.10).
- **Messages reçus par la partenaire à chaque vente :** `NEW_ORDER` à chaque commande payée en ligne, dans la cloche
  seulement ; `FIRST_TICKET_SOLD` (cloche, push, SMS, email) pour le premier billet seulement ; rien de plus par vente au
  guichet ou par billet gratuit (10.11).
