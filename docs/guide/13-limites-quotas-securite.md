# 13 — Limites, quotas et sécurité

> Guide complet de l'application Event Village, état de `main` à `0889df6` (lots 1 à 9 ter). Source de vérité : le code.
> Preuves `fichier:ligne` (chemins relatifs au dépôt ; `M/` = `supabase/migrations/`). **NON VÉRIFIÉ** : non établi,
> avec ce qui a été cherché. Les valeurs « par défaut » des variables d'environnement sont celles de `lib/env.ts` ; une
> variable posée sur le serveur les remplace (aucune lecture de `.env.local` ni du projet hébergé pour ce guide : les
> valeurs réellement posées en production sont **NON VÉRIFIÉES**). Les réglages SUPERADMIN (page « Réglages ») sont
> détaillés dans `11-admin-superadmin.md` ; ce fichier n'en reprend que ceux qui limitent quelque chose.

## Sommaire

1. Comment fonctionne un quota (règles communes)
2. SMS : la garde anti-abus
3. Codes à usage unique (codes SMS)
4. Connexion, compte et mot de passe
5. Liens et emails
6. Invitations (contrôleurs et invités)
7. Contrôle d'accès (scans, recherches, caisse)
8. Achats, billets et argent
9. Fichiers envoyés
10. Quantités et longueurs (événements, catégories, invitations)
11. Notifications (push, SMS optionnels, plage de nuit)
12. Délais techniques
13. Scénarios : 13.1 limite de SMS de code atteinte ; 13.2 plafond global de SMS atteint ; 13.3 garde de quota
    indisponible
14. Les protections en place, en langage simple
15. Limites connues de ces protections

---

## 1. Comment fonctionne un quota (règles communes)

- **Compteurs en base, tout ou rien.** Une action consomme d'un coup toutes ses règles (par numéro, par IP, par compte,
  global) ou aucune ; si une règle est pleine, rien n'est consommé et la réponse dit combien de secondes attendre
  (`lib/security/quota.ts:1-7`, `M/20261031000011_lot1c9_quotas.sql:35-92`).
- **Fenêtres fixes**, calées sur l'horloge : 10 s, minute, 15 min, heure, jour. Le jour commence à minuit UTC, qui est
  minuit à Dakar (`lib/env.ts:62`, `:80-81` ; calcul `M/20261031000011_lot1c9_quotas.sql:64-65`). Une fenêtre qui
  change remet le compteur à zéro : juste avant et juste après le changement, on peut donc atteindre jusqu'à deux fois la
  limite en peu de temps.
- **Chaque essai compte**, bon ou mauvais, et il est compté **avant** l'action (ex. vérification d'un code :
  `app/api/auth/verify-otp/route.ts:38-50`).
- **Garde indisponible = refus** (« échec fermé ») : si la base ne répond pas, l'action est refusée, jamais faite « à
  l'aveugle » (`lib/security/quota.ts:41-45`). Message générique : « Service momentanément indisponible. Réessayez dans
  un instant. » (`lib/security/quota-http.ts:10-16`).
- **Réponse d'un quota atteint** : statut 429, en-tête `Retry-After` et champ `retryAfterSeconds`
  (`lib/security/quota-http.ts:17-19`, `lib/sms/sms-http.ts:11-18`).
- **Adresse IP** : lue dans l'en-tête `x-forwarded-for` (première valeur) par défaut, ou `x-real-ip`, ou pas du tout
  (`CLIENT_IP_SOURCE`, `lib/env.ts:119-121`). Sans IP connue, les limites par IP des SMS de code ne s'appliquent pas
  (`lib/sms/sms-guard.ts:92-97`) et les autres limites par IP partagent un compteur commun « unknown »
  (`app/api/auth/resolve-phone/route.ts:18-20`, `:25`).
- **Une unité rendue** quand l'action comptée n'a finalement pas eu lieu (SMS d'invitation de contrôleur non parti),
  sur la fenêtre en cours seulement (`lib/security/quota.ts:55-81`, `M/20261109000011_lot9bis_textes.sql:87-110`).

## 2. SMS : la garde anti-abus

Chaque SMS est facturé ; une réservation passe avant tout envoi (`lib/sms/sms-guard.ts:1-25`).

| Règle | Défaut | Ce qu'elle couvre | Preuve |
|---|---|---|---|
| Plafond global par jour | **1 000** (`SMS_GLOBAL_DAILY_CAP`) | Codes SMS (en entier) ; SMS non indispensables (invitations de contrôleur, SMS optionnels) jusqu'à leur part seulement. Les SMS **indispensables** de la boîte d'envoi (achat, transfert, annulation, remboursement, sécurité, reçus du guichet…) **n'y sont jamais soumis** | `lib/env.ts:62`, `lib/sms/sms-guard.ts:86-91`, `:100-105` |
| Part du plafond réservée aux codes | **30 %** (`SMS_GLOBAL_OTP_RESERVED_PERCENT`) : les SMS non indispensables s'arrêtent à 1 000 × 70 % = **700** | Garde des codes de connexion quand les autres SMS montent | `lib/env.ts:65-66`, `lib/sms/sms-guard.ts:78-82` |
| Codes par numéro | **3 par 15 min**, **10 par jour** | Tous les codes (connexion, inscription, mot de passe, numéro, retrait, inscription partenaire) | `lib/env.ts:57-58`, `lib/sms/sms-guard.ts:89-90` |
| Codes par IP | **10 par heure**, **30 par jour** | Idem, quand l'IP est connue | `lib/env.ts:59-60`, `lib/sms/sms-guard.ts:92-97` |
| SMS hors code par destinataire | **30 par jour** (`SMS_PER_PHONE_DAY`), indispensables compris ; compteur distinct de celui des codes | Notifications, invitations, reçus | `lib/env.ts:61`, `lib/sms/sms-guard.ts:18-19`, `:106` |
| SMS hors code déclenchés par un compte | **30 par jour** (`SMS_PER_ACCOUNT_DAY`) | Invitations, équipe, transferts, billets gratuits… envoyés à l'initiative d'un compte connecté | `lib/env.ts:63-64`, `lib/sms/sms-guard.ts:114` |
| Reçus SMS du guichet par caisse | **500 par jour** (`COUNTER_RECEIPT_PER_SHIFT_DAY`), sans limite par vendeur | Ventes en espèces | `lib/env.ts:94`, `lib/sms/sms-guard.ts:107-113` |
| SMS optionnels (rappels, annonces, signaux aux pros) | **700 par jour** (réglage `notif.sms_optional_daily_cap`, de 0 à 1 000 000) ; au-delà, ils partent sans SMS (application, push) ; alerte aux admins à 80 % | Boîte d'envoi | `M/20261105000001_lot7_reglages.sql:30`, `M/20261110000002_lot9ter_reglages.sql:94`, `app/admin/finance-settings/page.tsx:92` |
| Alerte sur les SMS indispensables | **2 000 par jour** (réglage `notif.sms_essential_daily_alert`, de 1 à 1 000 000) : simple alerte, jamais de blocage | Boîte d'envoi | `M/20261109000001_lot9bis_reglages.sql:37`, `M/20261110000002_lot9ter_reglages.sql:97`, `app/admin/finance-settings/page.tsx:93` |
| Plage de nuit sans SMS optionnel | **22 h à 8 h**, heure de Dakar (réglages `notif.sms_quiet_start` / `notif.sms_quiet_end`, de 0 à 23 ; début = fin supprime la plage) | SMS optionnels seulement ; perdu ou reporté : voir `10-notifications.md` | `M/20261103000003_lot6_reglages.sql:34-36`, `M/20261110000002_lot9ter_reglages.sql:92-93`, `app/admin/finance-settings/page.tsx:90-91` |
| Comptes de démonstration | Aucun SMS réel hors simulation ; garde indisponible = rien ne part | Tous les envois synchrones | `lib/sms/mtarget.service.ts:121-143` |

Messages des refus (`lib/sms/sms-guard.ts:156-194`) :

| Cas | Texte exact | Exemple |
|---|---|---|
| Limite par numéro ou par IP | « Trop de demandes de SMS. Réessayez dans {n} minute(s). » | « Trop de demandes de SMS. Réessayez dans 12 minutes. » |
| Plafond global (ou part non code) | « L'envoi de SMS est momentanément suspendu. Réessayez plus tard ou contactez le support. » | — |
| Limite du compte déclencheur | « Limite quotidienne de SMS de votre compte atteinte. Réessayez demain ou contactez le support. » | — |
| Garde indisponible | « Service SMS momentanément indisponible. » | — |

Le plafond global atteint déclenche **une alerte par jour et par type** aux administrateurs munis de la permission
« notifications (lecture) », jamais par SMS (scénario 13.2) (`lib/sms/sms-guard.ts:120-154`).

## 3. Codes à usage unique (codes SMS)

| Objet du code | Où | Validité | SMS (texte du modèle) | Preuve |
|---|---|---|---|---|
| Connexion | `/login`, onglet « Code SMS » | 10 min | « Event Village : votre code de vérification est {code}. Valable 10 minutes. » | `app/api/auth/send-otp/route.ts:88`, `lib/notifications/catalog.ts:1800-1804` |
| Inscription client | `/register` | 600 s (10 min) ; nouveau code proposé après 60 s | même texte | `app/api/auth/register/start/route.ts:13-16` |
| Inscription partenaire | `/partner/register` | 10 min | même texte | `app/api/partner/register/route.ts:119-128` |
| Mot de passe oublié | `/forgot-password` | 10 min | « Event Village : votre code de réinitialisation du mot de passe est {code}. Valable 10 minutes. » | `app/api/auth/send-otp/route.ts:88`, `lib/notifications/catalog.ts:1807-1808` |
| Changement de numéro | `/profile` | 10 min | même texte que la connexion | `app/api/account/phone/start/route.ts:24`, `:72-78` |
| Retrait | portefeuille, espace partenaire | 10 min | « Event Village : votre code de retrait est {code}. Valable 10 minutes. Ne le donnez à personne. » | `app/api/withdrawals/otp/route.ts:103-109`, `lib/notifications/catalog.ts:1805-1806` |
| Activation d'un contrôleur | SMS d'invitation | 24 h | voir `05-equipe-controle-acces.md` | `app/api/partner/team/invite/route.ts:482-488` |

Règles de tous les codes : 6 chiffres tirés au hasard ; seule une empreinte (HMAC avec un secret dédié, liée au numéro)
est enregistrée ; comparaison sûre ; **5 essais** par code, compteur verrouillé en base ; seul le dernier code non utilisé
d'un numéro et d'un objet est valable ; un code d'un objet n'est jamais accepté pour un autre ; la vérification d'un
compte (connexion, inscription, mot de passe) n'accepte jamais un code de retrait ou d'activation
(`lib/auth/otp-store.ts:1-41`, `M/20261102000002_lot5_dette.sql:477-534`, `app/api/auth/verify-otp/route.ts:52-58`).
**Vérifications par numéro : 10 par 15 minutes** (`VERIFY_OTP_PER_PHONE_15MIN`, `lib/env.ts:85`), sur la connexion,
l'inscription client et partenaire, le changement de numéro (`app/api/auth/verify-otp/route.ts:41-50`,
`app/api/auth/register/route.ts:151-159`, `app/api/partner/register/route.ts:158-165`,
`app/api/account/phone/confirm/route.ts:60-69`). Activation d'un contrôleur : **10 par heure et par numéro**
(`CONTROLLER_SETUP_PER_PHONE_HOUR`, `lib/env.ts:86`, `app/api/controller/setup/route.ts:48-55`). Les codes ne sont
lisibles par aucun navigateur (table fermée, `M/20261031000002_lot1a_failles_sans_privilege.sql:66-71`).

Messages : « Code de vérification incorrect ou expiré. », « Le code a expiré. Demandez-en un nouveau. », « Trop de
tentatives infructueuses. Veuillez demander un nouveau code. » (`lib/auth/otp-store.ts:105-113`) ; « Trop de tentatives
de vérification pour ce numéro. Réessayez plus tard. » (`app/api/auth/verify-otp/route.ts:47`) ; « Trop de tentatives
d’activation pour ce numéro. Réessayez plus tard. » (`app/api/controller/setup/route.ts:53`).

## 4. Connexion, compte et mot de passe

| Ce qui est compté | Défaut | Message exact au-delà | Preuve |
|---|---|---|---|
| Connexions par mot de passe, par IP | **30 par heure** | « Trop de tentatives de connexion depuis cette connexion. Réessayez plus tard. » | `lib/env.ts:115`, `app/api/auth/login/route.ts:65-75` |
| « Ce numéro a-t-il un compte ? » (connexion par code), par IP | **30 par heure** | « Trop de requêtes depuis cette connexion. Par sécurité, réessayez plus tard. » | `lib/env.ts:84`, `app/api/auth/resolve-phone/route.ts:22-33` |
| Confirmations et changements de mot de passe, par compte | **5 par 15 min** (compteur commun) | « Trop de tentatives. Réessayez dans quelques minutes. » | `lib/env.ts:113`, `app/api/account/password-confirm/route.ts:36-46`, `app/api/account/password/route.ts:104-114` |
| Changements de numéro, par compte | **5 par jour** | « Trop de demandes de changement de numéro aujourd’hui. Réessayez demain. » | `lib/env.ts:110`, `app/api/account/phone/start/route.ts:58-67` |
| Inscriptions partenaire, par IP | **10 par heure** | « Trop de tentatives d’inscription depuis cette connexion. Réessayez plus tard. » | `lib/env.ts:87`, `app/api/partner/register/route.ts:62-68` |
| Verrou de l'écran (navigateur seulement) | 5 échecs → 60 s | « Saisie temporairement bloquée » | `components/auth/LoginForm.tsx:49-50`, `:514-531` |
| Mot de passe « récent » pour une action sensible | 10 min, lié à la session de l'appareil | « Par sécurité, saisissez votre mot de passe pour continuer. » | `lib/auth/password-confirm.ts:22-25` ; liste des actions : `02-comptes.md`, 02.10 |
| Robustesse du mot de passe | 8 caractères, majuscule, chiffre, caractère spécial ; 200 caractères au plus à l'envoi | messages de `02-comptes.md` | `lib/validations/auth.ts:93-97`, `app/api/account/password/route.ts:27-34` |
| Retraits après changement de numéro | bloqués **24 h** | « Retrait impossible pendant 24 h après un changement de numéro. Réessayez après le {jj/mm/aaaa à hh:mm}. » | `M/20261110000005_lot9ter_argent.sql:383-391` |

Côté service d'authentification (Supabase Auth), des limites existent aussi ; celles du fichier local sont des valeurs
de développement (`supabase/config.toml:174-192`) ; celles du projet hébergé sont **NON VÉRIFIÉES**.

## 5. Liens et emails

| Ce qui est compté | Défaut | Message exact | Preuve |
|---|---|---|---|
| Liens de vérification d'email, par compte | **3 par heure** | « Trop de liens demandés. Réessayez dans {n} minute(s). » | `lib/env.ts:117`, `app/api/account/email/resend/route.ts:21-29`, `M/20261109000010_lot9bis_email.sql:800-809` |
| Liens de vérification, par adresse (empreinte, rien en clair) | **5 par jour** | idem | `lib/env.ts:118`, `M/20261109000010_lot9bis_email.sql:803-804` |
| Validité d'un lien de vérification | **24 h**, un seul usage, le dernier annule les précédents | « Ce lien a expiré (24 heures). Demandez un nouveau lien depuis votre profil. » | `M/20261109000010_lot9bis_email.sql:811-817`, `app/api/account/email/verify/route.ts:19` |
| Lien « mot de passe oublié » par email | géré par Supabase Auth ; 60 min annoncées à l'écran | — | `app/forgot-password/page.tsx:594` ; durée locale `supabase/config.toml:211-212` ; projet hébergé **NON VÉRIFIÉ** |
| Lien d'un document partenaire | **5 min** (lien signé) | — | `app/api/partner/documents/signed-url/route.ts:9`, `:16` |

Sans clé d'envoi d'emails (`RESEND_API_KEY`), le canal email est coupé : aucun lien n'est tenté, aucun quota consommé
(`lib/env.ts:123-124`, `lib/email/verification.ts:103-108`). Un email (hors lien de vérification) ne part qu'à une
adresse **vérifiée** (`lib/email/verification.ts:5-8` ; règle d'envoi détaillée dans 10).

## 6. Invitations (contrôleurs et invités)

| Ce qui est compté | Défaut | Message exact | Preuve |
|---|---|---|---|
| Invitations de contrôleurs, par partenaire | **20 par heure** | « Limite d'invitations atteinte : maximum {n} par heure. Réessayez plus tard. » — ex. « … maximum 20 par heure. … » | `lib/env.ts:88`, `app/api/partner/team/invite/route.ts:184-187` |
| Invitations de contrôleur reçues par un numéro (toutes partenaires) | **3 par jour** ; l'unité n'est prise que si un message part, rendue s'il ne part pas | « Trop d'invitations envoyées à ce numéro aujourd'hui (maximum {n} par jour). » | `lib/env.ts:89`, `app/api/partner/team/invite/route.ts:240-254`, `:575` |
| Invitations d'invités, par événement | **50 par heure** (une unité par numéro invité) | « Limite d’invitations atteinte. Réessayez plus tard. » | `lib/env.ts:105`, `lib/tickets/invitation.service.ts:113`, `M/20261110000008_lot9ter_invites.sql:375-385` |
| Invitations d'invités reçues par un numéro | **3 par jour** | idem | `lib/env.ts:106`, `M/20261110000008_lot9ter_invites.sql:379` |
| Numéros par envoi d'invitations | **10** | « 10 numéros au plus par envoi. » | `lib/validations/invitation.ts:9`, `:42` |
| Billets par invité | **1 à 4** | voir 07 | `lib/validations/invitation.ts:10`, `:66-67` |
| Nom d'un invité | **60** caractères | voir 07 | `lib/validations/invitation.ts:13`, `:32` |

## 7. Contrôle d'accès (scans, recherches, caisse)

| Ce qui est compté | Défaut | Message exact | Preuve |
|---|---|---|---|
| Scans par scanneur | **30 par 10 s** | « Trop de scans : patientez quelques secondes » (incident journalisé) | `lib/env.ts:82`, `app/api/controller/scan/route.ts:86-97`, `:149`, `lib/scan/scan-result.ts:70` |
| Saisies manuelles (numéro de billet) | **20 par minute** | « Trop de vérifications : patientez quelques secondes. » | `lib/env.ts:103`, `app/api/controller/scan/lookup/route.ts:61-69` |
| Recherches dans la liste des invités | **30 par heure** et par contrôleur | « Trop de recherches dans l’heure : réessayez dans {n} min. » | `lib/env.ts:108`, `app/api/controller/scan/guests/route.ts:90`, `:107-110`, `M/20261110000008_lot9ter_invites.sql:107-111` |
| Incidents déclarés par l'appareil | **10 par minute** | « Trop de déclarations d’incidents. Réessayez dans une minute. » | `lib/env.ts:95`, `app/api/controller/scan/incidents/route.ts:42-46` |
| Incidents écrits par le serveur | **60 par minute** | (silencieux) | `lib/env.ts:96`, `lib/scan/scan-incidents.ts:37` |
| Code PIN régisseur | **5 essais par 15 min** (par caisse, ou par ouverture) | « Trop de tentatives de code PIN. Réessayez dans {n} s. » | `lib/env.ts:90`, `lib/shifts/shift.service.ts:105`, `:297-301`, `:458-462` |
| Codes dynamiques du billet (QR tournant) demandés | **60 par minute** et par compte | « Trop de demandes : patientez quelques secondes. » | `lib/env.ts:83`, `app/api/tickets/[id]/live-code/route.ts:28-31` |
| Téléchargements du lot de codes hors ligne | **12 par heure** par billet, **60 par heure** par compte | « Trop de téléchargements des codes hors ligne : réessayez plus tard. » | `lib/env.ts:100-101`, `lib/tickets/offline-codes.service.ts:107-117` |
| Fenêtre de contrôle | ouverture **6 h** avant le début, fermeture **6 h** après la fin (réglages, de 0 à 48 h) | voir 05 | `M/20261101000009_lot4_reglages_acces.sql:14-15`, `M/20261110000002_lot9ter_reglages.sql:87-88` |
| Alerte de refus à une porte | **10 refus en 5 min** (réglages : 3 à 500 refus, 1 à 60 min) | voir 05 | `M/20261110000002_lot9ter_reglages.sql:40-42`, `:98-99` |

## 8. Achats, billets et argent

| Ce qui est limité | Défaut | Message exact | Preuve |
|---|---|---|---|
| Achats lancés par compte | **10 par 15 min**, **50 par jour** | « Trop de tentatives d’achat : réessayez plus tard. » | `lib/env.ts:72-73`, `lib/payments/checkout.service.ts:205-212` |
| Demandes de billets gratuits par compte | **20 par heure** | « Trop de demandes : réessayez plus tard. » | `lib/env.ts:74`, `app/api/tickets/claim-free/route.ts:36-39` |
| Billets gratuits d'une catégorie par compte | le « maximum par commande » de la catégorie, cumulé sur le compte | « Limite de {n} billet(s) gratuit(s) « {catégorie} » par compte atteinte. » | `M/20261105000007_lot7_confirmation.sql:238-242` |
| Billets par commande | « maximum par commande » de la catégorie : 1 à **50**, **10** par défaut | « Au plus {n} billet(s) « {catégorie} » par commande. » | `lib/validations/event.ts:57`, `:61`, `:320-321`, `M/20261106000001_lot8_canaux.sql:268-269`, `lib/validations/payment.ts:30` |
| Garde des places pendant un paiement | **10 min** (réglage, de 5 à 60) | voir 06 | `M/20261109000001_lot9bis_reglages.sql:33`, `M/20261110000002_lot9ter_reglages.sql:95` |
| Prix minimum d'un billet payant | **100 F CFA** (réglage, de 1 à 100 000) | voir 04 | `M/20261109000001_lot9bis_reglages.sql:35`, `M/20261110000002_lot9ter_reglages.sql:96` |
| Prix maximum d'un billet | **10 000 000 F CFA** | « Le prix ne dépasse pas 10 000 000 F CFA. » | `lib/validations/event.ts:55`, `:316-317` |
| Demandes de retrait par compte | **10 par heure** | « Trop de demandes de retrait. Réessayez dans {n} min. » | `lib/env.ts:93`, `app/api/withdrawals/request/route.ts:51-55` |
| Montant minimum de retrait | **5 000 F CFA** (réglage, de 0 à 10 000 000) | voir 03 et 08 | `M/20261101000002_lot3_reglages.sql:70`, `M/20261110000002_lot9ter_reglages.sql:85` |
| Frais de retrait | **1 %** arrondi au franc supérieur (réglage, 0 à 10 %) | voir 08 | `M/20261101000002_lot3_reglages.sql:69`, `M/20261110000002_lot9ter_reglages.sql:84` |
| Fonds gelés | part d'un événement suspendu jamais retirable | « Une partie de vos fonds est gelée : un de vos événements est suspendu. » | `M/20261110000005_lot9ter_argent.sql:375-381` |
| Contrôles de paiement demandés par l'écran d'attente | 1 toutes les **5 s** au plus | — | `lib/env.ts:75`, `app/api/payments/[transactionId]/status/route.ts:137` |
| Paiement en attente chez SamirPay | expiré après **60 min** ; premier contrôle par la tâche planifiée après **2 min** ; succès tardifs cherchés sur **48 h** ; **50** paiements par passage | voir 06 et 12 | `lib/env.ts:76-79` |

Seuls les réglages SUPERADMIN actifs s'appliquent ; un SUPERADMIN au compte actif est seul à pouvoir les changer, dans
leurs bornes (`M/20261110000002_lot9ter_reglages.sql:107-146`, bornes `:49-102`).

## 9. Fichiers envoyés

| Fichier | Taille et formats | Quota | Preuve |
|---|---|---|---|
| Photo de profil | 2 Mo ; JPEG, PNG, WebP (type lu dans le contenu) ; ressortie en WebP 256 × 256 sans métadonnées | **20 par heure** et par compte | `app/api/account/avatar/route.ts:16-22`, `:72-91`, `lib/env.ts:111` |
| Pièces d'inscription partenaire | 10 Mo ; JPEG, PNG, WebP, PDF ; dépôt privé | **20 dépôts par heure** et par IP ; « Trop de dépôts depuis cette connexion. Réessayez plus tard. » | `M/0005_storage_and_auth.sql:31-37`, `app/api/partner/documents/upload/route.ts:16`, `:34-40`, `lib/env.ts:68` |
| Affiche d'un événement | voir `04-evenement-cycle.md` (adresse de 2 048 caractères au plus) | — | `lib/validations/event.ts:58` |

## 10. Quantités et longueurs (événements, catégories, invitations)

`lib/validations/event.ts:38-59` (messages aux lignes `:184-321`, `:436`) :

| Élément | Limite |
|---|---|
| Titre | 3 à 120 caractères |
| Description | 5 000 caractères |
| Lieu | 2 à 200 caractères |
| Ville | 2 à 80 caractères |
| Information pratique | 300 caractères chacune |
| Programme | 50 lignes ; titre 120, intervenant 120, description 500 caractères |
| Jauge | 1 à 100 000 places |
| Catégories par événement | 50 |
| Nom / description d'une catégorie | 60 / 300 caractères |
| Prix | 0 à 10 000 000 F CFA |
| Quantité mise en vente | 1 à 100 000 billets |
| Maximum par commande | 1 à 50 (10 par défaut) |

Seuil « bientôt complet » affiché au public : **10** places ou moins (réglage `access.low_stock_threshold`, de 1 à 1 000)
(`M/20261102000006_lot5_temps_reel.sql:33`, `M/20261110000002_lot9ter_reglages.sql:89`).

## 11. Notifications (push, SMS optionnels, plage de nuit)

| Ce qui est limité | Défaut | Message exact | Preuve |
|---|---|---|---|
| Inscriptions d'appareils au push | **20 par heure** et par compte | « Trop d’inscriptions d’appareils en une heure. Réessayez plus tard. » | `lib/env.ts:143`, `app/api/push/subscriptions/route.ts:86-89` |
| Notifications d'essai | **5 par heure** et par compte | « Trop de notifications d’essai en une heure. Réessayez plus tard. » | `lib/env.ts:144`, `app/api/notifications/essai-push/route.ts:40-43` |
| SMS optionnels, plage de nuit, alerte des indispensables | voir section 2 | — | — |

Le push est facultatif : sans les trois clés VAPID, il est coupé et tout le reste fonctionne (`lib/env.ts:133-136`).

## 12. Délais techniques

| Délai | Défaut | Preuve |
|---|---|---|
| Appel à SamirPay | 15 s | `lib/env.ts:43` |
| Appel au fournisseur SMS (MTarget) ; au-delà, issue « incertaine », jamais renvoyé | 15 s | `lib/env.ts:130-131` |
| Envoi d'un push | 10 s | `lib/env.ts:142` |
| Envoi synchrone du lien de vérification d'email | 5 s | `lib/email/verification.ts:30-31` |
| Jeton de session après révocation | reste valable jusqu'à son expiration (1 h au plus) | `lib/auth/sessions.ts:7-8` ; durée locale `supabase/config.toml:152` |
| Signature du hook SMS de Supabase Auth | écart d'horloge ± 5 min | `app/api/auth/sms-hook/route.ts:9-10`, `:36-37` |

---

## 13. Scénarios

### 13.1 Limite de SMS de code atteinte

1. **Qui, où.** Une personne (ou un robot) qui demande des codes à répétition : `/login` (« Code SMS »), `/register`,
   `/forgot-password`, changement de numéro, retrait.
2. **Ce qu'il saisit.** Le même numéro, plusieurs fois.
3. **Ce que fait le système.** Au 4ᵉ code en 15 minutes pour un numéro (ou au 11ᵉ dans la journée, ou au-delà des limites
   par IP), la réservation est refusée **avant** d'enregistrer un nouveau code : le code déjà reçu reste valable
   (`app/api/auth/send-otp/route.ts:81-84`, `app/api/auth/register/start/route.ts:54-57`). Aucun SMS n'est facturé.
4. **Messages envoyés.** Aucun SMS. L'envoi refusé est journalisé (état « non envoyé », motif de la garde) pour les
   envois synchrones (`lib/sms/mtarget.service.ts:100-114`).
5. **Ce que voient les autres rôles.** Supervision des envois : voir `10-notifications.md` et `11-admin-superadmin.md`.
6. **Refus (texte exact).** « Trop de demandes de SMS. Réessayez dans {n} minute(s). » (`lib/sms/sms-guard.ts:185-193`).
   Sur `/register`, ce message s'affiche tel quel (`app/register/page.tsx:215-221`). Sur `/login` et `/forgot-password`,
   l'écran affiche le bandeau de blocage avec un décompte de 60 s au lieu du délai réel, et masque le message (constat
   W2-01, `components/auth/LoginForm.tsx:414-420`, `app/forgot-password/page.tsx:264-269`).
7. **Preuves et essai.** Fichiers cités ; aucun essai dédié dans `docs/recette-billetterie.md`.

### 13.2 Plafond global de SMS atteint

1. **Qui, où.** Aucun acteur : le compteur du jour atteint 1 000 (codes compris) ou 700 pour les SMS non indispensables.
2. **Ce qu'il saisit.** —
3. **Ce que fait le système.** Les codes continuent jusqu'à 1 000 ; les SMS non indispensables (invitations de
   contrôleur, SMS optionnels) s'arrêtent à 700 ; les SMS **indispensables** de la boîte d'envoi continuent dans tous
   les cas (`lib/sms/sms-guard.ts:100-105`). Journal `SMS_GLOBAL_DAILY_CAP_REACHED` ou
   `SMS_NON_OTP_DAILY_SHARE_REACHED`, puis alerte en file aux administrateurs, **une fois par jour et par type**
   (`:120-154`).
4. **Messages envoyés.**

   | Destinataire | Canal | Indispensable ou optionnel | Quand | Texte exact |
   |---|---|---|---|---|
   | Admins avec « notifications (lecture) » | Cloche, email | Alerte d'administration | File, une fois par jour | `ADMIN_SMS_CAP_GLOBAL` : « Plafond de SMS atteint » / « Le plafond de {cap} SMS par jour est atteint : les envois sont suspendus jusqu'à minuit (UTC, heure de Dakar). » — ex. « … de 1 000 SMS par jour … » (`lib/notifications/catalog.ts:1272-1279`) |
   | idem | Cloche, email | idem | idem | `ADMIN_SMS_CAP_NON_OTP` : « Quota de SMS hors code atteint » / « La part des SMS hors codes de connexion ({limite} sur {cap} par jour) est atteinte : seuls les codes de connexion partent encore jusqu'à minuit (UTC, heure de Dakar). » — ex. « (700 sur 1 000 par jour) » (`:1281-1288`) |

   Écart : ces deux textes disent que tout s'arrête (ou que seuls les codes partent), alors que les SMS indispensables
   continuent (constat W2-10).
5. **Ce que voient les autres rôles.** Les personnes qui demandent un code ou reçoivent une invitation reçoivent les
   refus de la section 2.
6. **Refus.** « L'envoi de SMS est momentanément suspendu. Réessayez plus tard ou contactez le support. »
   (`lib/sms/sms-guard.ts:164-173`).
7. **Preuves.** Fichiers cités.

### 13.3 Garde de quota indisponible

1. **Qui, où.** N'importe quelle action comptée quand la base ne répond pas à la réservation.
2. **Ce qu'il saisit.** —
3. **Ce que fait le système.** Refus, journalisé « garde de quota indisponible, refus (fail-closed) »
   (`lib/security/quota.ts:41-45`). Pour un scan, l'incident est journalisé (`app/api/controller/scan/route.ts:89-92`).
4. **Messages envoyés.** Aucun.
5. **Ce que voient les autres rôles.** Rien.
6. **Refus (texte exact).** « Service momentanément indisponible. Réessayez dans un instant. »
   (`lib/security/quota-http.ts:13`) ; SMS : « Service SMS momentanément indisponible. » (`lib/sms/sms-guard.ts:161-163`) ;
   scan : « Contrôle momentanément indisponible. » (`app/api/controller/scan/route.ts:91`) ; code du billet : « Code
   momentanément indisponible. » (`app/api/tickets/[id]/live-code/route.ts:30`) ; saisie manuelle : « Vérification
   momentanément indisponible. » (`app/api/controller/scan/lookup/route.ts:65`).
7. **Preuves.** Fichiers cités.

---

## 14. Les protections en place, en langage simple

| Protection | Ce qu'elle empêche | Preuve |
|---|---|---|
| **Le navigateur n'écrit dans aucune table.** Toutes les écritures passent par le serveur ou par des fonctions contrôlées ; 25 anciennes autorisations d'écriture supprimées, droits d'écriture retirés partout, et la base refuse de démarrer la migration s'il en reste une (lot 9 ter) | Qu'une partenaire change elle-même son statut, ou qu'un client modifie une table en appelant la base directement | `M/20261110000001_lot9ter_rls.sql:8-26`, `:31-80` |
| **Les rôles sont lus en base**, jamais dans les informations modifiables par la personne ; une lecture en échec = accès refusé | Qu'un client se donne le rôle d'administrateur | `middleware.ts:82-88`, `lib/auth/session.ts:94-97` |
| **Un administrateur doit avoir un compte actif** (contrôles en base et dans l'administration) | Qu'un admin suspendu garde ses droits | `M/20261110000001_lot9ter_rls.sql:20-22`, `lib/admin/admin-auth.ts:177` |
| **Compte actif exigé** par les routes du compte, des billets, du partenaire | Qu'un compte suspendu agisse avec un jeton encore valable | `lib/auth/session.ts:40-66` |
| **Codes SMS hachés**, liés au numéro et à l'objet, 5 essais, 10 min, table fermée | La lecture ou la devinette d'un code ; l'usage d'un code de retrait pour se connecter | section 3 |
| **Réponses neutres** : même message pour un numéro inconnu et un mauvais mot de passe ; même écran « mot de passe oublié » qu'un compte existe ou non | Deviner quels numéros ont un compte (voir les exceptions en 15) | `app/api/auth/login/route.ts:23-26`, `app/api/auth/send-otp/route.ts:73-77`, `app/forgot-password/page.tsx:225-231` |
| **Connexion par mot de passe côté serveur** : la correspondance numéro → compte ne quitte pas le serveur | Récupérer l'identifiant interne d'un numéro | `app/api/auth/login/route.ts:47-62` |
| **Inscription en deux temps** : le compte n'est créé qu'après le code reçu sur le numéro | Créer un compte au numéro d'autrui | `app/api/auth/register/route.ts:66-84` |
| **Mot de passe redemandé** (moins de 10 min) avant un transfert, un changement de numéro ou d'email, un constat de versement | Qu'une personne qui trouve un téléphone ouvert vide le compte | `lib/auth/password-confirm.ts:159-186` ; `02-comptes.md`, 02.10 |
| **Révocation des sessions** à la suspension, au changement de mot de passe (sauf l'appareil utilisé), au changement de numéro (idem), à la réinitialisation, à l'anonymisation | Qu'un appareil perdu reste connecté | `lib/auth/sessions.ts:14-31`, `M/20261109000004_lot9bis_droits.sql:507-509`, `:791-797`, `M/20261109000011_lot9bis_textes.sql:54-61` |
| **Avis de sécurité** : mot de passe changé (SMS, cloche, email), numéro changé (SMS à l'ancien numéro, email) | Un changement fait à l'insu du titulaire | `02-comptes.md`, 02.8 et 02.11 |
| **Retraits bloqués 24 h** après un changement de numéro | Le vol d'argent après une prise de contrôle du numéro | `M/20261110000005_lot9ter_argent.sql:383-391` |
| **Quotas en base, refus si la garde ne répond pas** | Le pilonnage (codes, connexions, scans) et la facture de SMS | sections 1 à 11 |
| **Secrets dédiés et distincts** (codes SMS, code dynamique des billets, PIN régisseur), vérifiés au démarrage ; le mode « faux services » est interdit hors développement et tests | La réutilisation d'un secret ; un faux paiement en production | `lib/env.ts:9-12`, `:146-153`, `:173-187`, `:219-223` |
| **Tâches planifiées protégées** par un secret | Le déclenchement d'une tâche par un inconnu | `lib/env.ts:14-15`, `lib/security/cron-auth.ts` |
| **Hook SMS de Supabase Auth** : signature ou secret complet obligatoires, sinon refus | Un relais SMS ouvert | `app/api/auth/sms-hook/route.ts:18-67` |
| **Webhooks SamirPay** : signature exigée si le secret est posé ; sinon jeton de rappel par paiement ; statut toujours reconfirmé auprès de SamirPay | Un faux « paiement réussi » | `lib/env.ts:44-47` ; détail dans 06 |
| **Pièces partenaires** dans un dépôt privé, lues par lien signé de 5 min, rattachées par jeton de dépôt | La lecture d'une pièce d'identité par un tiers | `M/0005_storage_and_auth.sql:30-37`, `app/api/partner/documents/signed-url/route.ts:9`, `lib/validations/auth.ts:232-235` |
| **Photo de profil réécrite** (sans métadonnées, chemin choisi par le serveur, seul le serveur écrit) | La fuite de la position GPS ; l'écrasement de la photo d'un autre | `app/api/account/avatar/route.ts:32-48`, `:84-101`, `:138-142` |
| **Lien de vérification d'email** : jeton de 256 bits dont seule l'empreinte est en base ; rien n'est validé à l'ouverture de la page ; jeton retiré de l'adresse ; aucune session ouverte | La validation par un antivirus de messagerie ; la fuite du jeton | `lib/email/verification.ts:13-15`, `app/verify-email/page.tsx:13-24`, `app/api/account/email/verify/route.ts:89-95` |
| **Adresse technique réservée** (`eventvillage.sn` et sous-domaines refusés à la saisie) | Prendre l'adresse interne d'un autre numéro | `lib/validations/auth.ts:149-153`, `app/api/account/profile/route.ts:47-50` |
| **En-têtes de sécurité** : page non affichable dans un cadre, type de contenu imposé, référent limité, réponses d'API jamais mises en cache | Le détournement de clics ; la mise en cache d'une donnée privée | `next.config.mjs:51-93` |
| **Pages de développement** inexistantes en production | L'accès à des outils de test | `middleware.ts:76-95`, `next.config.mjs:96-103` |
| **Comptes de démonstration** : aucun SMS ni email réel hors simulation | L'envoi à de vrais numéros depuis des données de test | `lib/sms/mtarget.service.ts:121-143`, `lib/email/verification.ts:110-126` |
| **Administration** : seul un SUPERADMIN crée un admin, change un rôle d'admin, suspend un admin, change le statut Ambassadeur, modifie les réglages ; un partenaire ne se suspend que depuis sa fiche avec motif | L'élévation de privilèges | `M/20261109000004_lot9bis_droits.sql:488-496`, `app/api/admin/users/route.ts:284-294`, `:340-346`, `M/20261110000002_lot9ter_reglages.sql:131-136` ; détail dans 11 |
| **Journal d'audit** des actes sensibles (statut, mot de passe, numéro, email, anonymisation, alertes SMS) | L'acte sans trace | `M/20261109000004_lot9bis_droits.sql:511-515`, `M/20261109000011_lot9bis_textes.sql:72-75`, `lib/admin/admin.service.ts:464-487` |

## 15. Limites connues de ces protections

- **Deux réponses disent si un numéro a un compte** : la connexion par code (« Aucun compte n'est associé à ce numéro de
  téléphone. Veuillez vous inscrire. ») et l'inscription (« Ce numéro de téléphone est déjà associé à un compte. Veuillez
  vous connecter. ») ; décision conservée, freinée par 30 recherches par heure et par IP et par la garde SMS
  (`app/api/auth/resolve-phone/route.ts:12-17`, `:62-67` ; `app/api/auth/register/start/route.ts:45-52`).
- **Le verrou de l'écran n'est qu'un confort** : il est effacé avec les données du navigateur ; seul le serveur fait foi
  (`components/auth/LoginForm.tsx:34-36`).
- **Une session révoquée reste utilisable jusqu'à une heure** côté jeton ; les droits sont relus en base à chaque
  requête (`lib/auth/sessions.ts:7-8`).
- **Fenêtres fixes** : jusqu'à deux fois la limite autour d'un changement de fenêtre (section 1).
- **Aucun captcha** : la configuration locale ne l'active pas (`supabase/config.toml:194-198`) ; projet hébergé
  **NON VÉRIFIÉ**.
- **L'adresse IP vient d'un en-tête** : à réserver à un hébergement qui le réécrit (`lib/env.ts:119-121`).
- **La page `/reset-password` accepte toute session ouverte**, sans l'ancien mot de passe ni confirmation récente, et
  ne contrôle la robustesse que dans le navigateur (constat W2-05).
- **La destination après connexion (`/login?redirect=`) n'est pas filtrée** : une adresse externe est suivie après la
  connexion (constat W2-11).
- **Inscription directe auprès du service d'authentification** : la configuration locale l'autorise
  (`supabase/config.toml:163`, `:199`) et le déclencheur d'inscription crée alors un compte client actif sans numéro
  vérifié (`M/20261031000002_lot1a_failles_sans_privilege.sql:18-53`) ; réglage du projet hébergé **NON VÉRIFIÉ**
  (constat W2-12).
