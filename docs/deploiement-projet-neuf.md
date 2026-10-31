# Déploiement — montage du futur projet de production depuis zéro

**Statut :** procédure préparée au lot 1A, **à ne pas exécuter maintenant**. Elle sera relue et complétée après les lots 1B à 5 (en particulier la vérification de signature des webhooks SamirPay, lot 2).

**Principe :** la production se fait sur un projet Supabase **neuf**. On n'y copie rien du projet de test : ni données, ni comptes, ni clés. Le schéma vient uniquement des migrations du dépôt.

---

## 1. Pré-requis

- Branche du dépôt validée (CI verte : `npm run verify`).
- Supabase CLI à la version figée dans `.github/workflows/verify.yml`.
- Accès administrateur au compte Supabase de l'organisation, aux comptes SamirPay, MTarget et Resend de production.
- Un poste de confiance pour l'opérateur. Les secrets ne transitent ni par le dépôt, ni par un chat, ni par une capture d'écran.

## 2. Créer le projet

1. Créer un nouveau projet Supabase dans l'organisation, région la plus proche de Dakar, mot de passe de base généré et conservé dans le gestionnaire de secrets.
2. Dans **Authentication > Providers** :
   - email : activé ; « Confirm email » : **activé** ;
   - inscription publique : activée (le trigger `handle_new_user` ne crée plus que des comptes CLIENT) ;
   - téléphone : selon le choix produit ; l'envoi passe par le hook SMS (étape 5).
3. Dans **Authentication > Rate limits** : conserver les valeurs par défaut de Supabase (la valeur relevée de `supabase/config.toml` ne concerne que l'instance locale de test).
4. Ne créer **aucune** fonction, table ni politique à la main dans l'éditeur SQL. Tout passe par les migrations (étape 3). Une fonction créée à la main échappe aux tests de privilèges (c'est ainsi qu'`exec_sql` est apparue sur le projet de test).

## 3. Appliquer le schéma depuis zéro

Sur un projet neuf, l'historique de migrations est vide : `db push` applique tout, dans l'ordre.

```bash
supabase link --project-ref <ref-du-projet-de-production>
supabase db push --dry-run     # relire la liste : toutes les migrations du dépôt, rien d'autre
supabase db push
```

Puis exécuter `supabase/hotfix/2026-10-31-lot1a/03-verification.sql` dans l'éditeur SQL : **toutes** les lignes doivent être `OK`. Sur un projet neuf, cette vérification doit passer sans appliquer `02-hotfix.sql` (la migration du lot 1A est déjà incluse).

## 4. Données de référence (sans données de test)

- `supabase/seed.sql` n'est **pas** joué par `db push`. Les données de référence nécessaires au fonctionnement sont créées par les migrations : `platform_settings` (dont `ticketing_fee_config`, migration `0012`) et `subscription_plans`.
- **Ne jamais exécuter** `npm run seed:test` ni `tests/seed/seed-test.ts` contre ce projet : ce seed crée des comptes de test avec un mot de passe connu. Le garde-fou `tests/helpers/env.ts` refuse de toute façon une URL non locale.
- Avant l'ouverture, vérifier et corriger les valeurs métier contradictoires relevées par l'audit (taux de parrainage `referral_config` de la migration `0011` contre CDC §95-§97, tarifs des packs) : traité dans un lot ultérieur, à valider avec le client.

## 5. Variables d'environnement de l'application

À saisir dans l'hébergeur (jamais dans un fichier versionné). `lib/env.ts` refuse de démarrer les routes serveur si une variable obligatoire manque et liste les absentes.

| Variable | Obligatoire | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | oui | Projet de production > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui | idem (clé publique) |
| `SUPABASE_SERVICE_ROLE_KEY` | oui | idem (secret serveur) |
| `NEXT_PUBLIC_APP_URL` | oui | URL publique définitive (sert aux liens d'activation et aux URLs de retour de paiement) |
| `SAMIRPAY_API_URL` | oui | `https://app.samirpay.com/samirpays` (jamais l'URL sandbox) |
| `SAMIRPAY_API_KEY`, `SAMIRPAY_SECRET_KEY` | oui | compte SamirPay de **production**, clés nouvelles |
| `SAMIRPAY_TIMEOUT_MS` | non (défaut 15000) | délai maximal d'un appel SamirPay ; au-delà, un cashout est classé INCERTAIN et n'est jamais renvoyé automatiquement |
| `MTARGET_USERNAME`, `MTARGET_PASSWORD`, `MTARGET_SENDER`, `MTARGET_SERVICE_ID` | oui (le SMS est le canal essentiel : sans `MTARGET_USERNAME` / `MTARGET_PASSWORD`, les routes serveur refusent de démarrer) | compte MTarget, identifiants renouvelés |
| `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`, `SUPPORT_EMAIL` | non : sans `RESEND_API_KEY`, le canal email est désactivé (un avertissement au démarrage, aucun envoi tenté) ; SMS et notifications in-app partent normalement | compte Resend du client, à configurer plus tard (clé nouvelle, domaine vérifié) |
| `SUPABASE_AUTH_HOOK_SECRET` | oui (sans lui, le hook SMS refuse tout appel) | **nouveau** secret généré à l'étape 6 (jamais la valeur du projet de test, publiée) |
| `CRON_SECRET` | oui (les routes `/api/cron` des paiements refusent tout appel sans lui, sans repli) | secret aléatoire propre aux tâches planifiées |
| `PAYMENT_HOLD_MINUTES`, `CHECKOUT_PER_USER_15MIN`, `CHECKOUT_PER_USER_DAY`, `CLAIM_FREE_PER_USER_HOUR`, `PAYMENT_RECONCILE_MIN_AGE_MINUTES`, `PAYMENT_PENDING_MAX_AGE_MINUTES`, `PAYMENT_LATE_SUCCESS_WINDOW_HOURS` | non (défauts : 15, 10, 50, 20, 2, 60, 48) | durée de réservation du stock, quotas d'achat par compte, fenêtres de la réconciliation (lot 2) |
| `OTP_HASH_SECRET` | oui | secret aléatoire dédié (`openssl rand -hex 32`), différent de toute autre clé ; le changer invalide seulement les codes OTP en cours (10 min) |
| `SMS_OTP_PER_PHONE_15MIN`, `SMS_OTP_PER_PHONE_DAY`, `SMS_OTP_PER_IP_HOUR`, `SMS_OTP_PER_IP_DAY`, `SMS_PER_PHONE_DAY`, `SMS_GLOBAL_DAILY_CAP` | non (défauts : 3, 10, 10, 30, 30, 1000) | à ajuster au budget SMS du client ; le plafond global quotidien bloque tout SMS et alerte les SUPERADMIN (notification in-app, journal d'audit) |
| `CLIENT_IP_SOURCE` | non (défaut `x-forwarded-for`) | garder `x-forwarded-for` uniquement derrière un hébergeur qui réécrit l'en-tête (Vercel) ; sinon `x-real-ip` ou `none` (pas de limite par IP) |
| `DOCUMENT_UPLOADS_PER_IP_HOUR` | non (défaut 20) | dépôts publics de pièces d'inscription partenaire, par IP et par heure |
| `EV_INTEGRATIONS` | non | ne pas définir (valeur `fake` interdite en production) |

Règles :

- aucune clé du projet de test ou de l'ancien `.env.local` n'est réutilisée ;
- `SUPABASE_AUTH_HOOK_SECRET` sert aussi, à ce jour, de clé de dérivation des QR dynamiques et du sel des PIN régisseur (retiré au lot 4) : il doit être unique à la production.

## 6. Paiements SamirPay (lot 2)

- Contrat appliqué : cashin direct (`/api/tiers/direct/initPayment`), statut (`/api/tiers/payments/{id}/status`), cashout (`/api/tiers/payments/send`), solde, sous `SAMIRPAY_API_URL`. Les anciennes variables `SAMIRPAY_CASHIN_URL`, `_CASHOUT_URL`, `_SOLDE_URL`, `_STATUS_URL` et `SAMIRPAY_WEBHOOK_SECRET` ne sont plus lues : les retirer.
- Le webhook est adressé par SamirPay au `callBackUrl` transmis à chaque paiement (`https://<domaine>/api/webhooks/samirpay?t=<jeton du paiement>`) : aucune configuration côté SamirPay, mais `NEXT_PUBLIC_APP_URL` doit être l'URL publique HTTPS définitive.
- Le solde du compte partenaire SamirPay doit couvrir les remboursements : il est vérifié avant chaque envoi (refus et alerte aux SUPERADMIN sinon).

## 6 bis. Hook SMS de Supabase Auth

1. **Authentication > Hooks > Send SMS hook** : type HTTPS, URL `https://<domaine>/api/auth/sms-hook`.
2. Générer le secret dans ce même écran, le reporter dans `SUPABASE_AUTH_HOOK_SECRET` de l'application, redéployer.
3. Tester l'envoi d'un OTP vers un numéro de l'équipe.

Le hook n'accepte que la signature Standard Webhooks de Supabase (horodatage à ± 5 minutes) ou le secret complet ; chaque envoi passe par les limites anti-abus des OTP et le plafond global.

## 7. Tâches planifiées

Toutes les routes `/api/cron/*` s'appellent avec l'en-tête `Authorization: Bearer <CRON_SECRET>` (elles sont publiques au middleware et se protègent elles-mêmes).

| Route | Fréquence | Rôle |
|---|---|---|
| `/api/cron/payments-reconcile` | toutes les 5 minutes (**obligatoire**) | statut SamirPay des paiements en attente : confirmation (billets), échec ou annulation (stock rendu), expiration des paiements trop anciens, succès tardifs, confirmation et contrôle des remboursements ; le webhook SamirPay n'étant envoyé qu'en cas de succès, c'est le seul moyen de connaître FAILED et CANCELLED |
| `/api/cron/stock-reservations` | toutes les 5 minutes | purge des réservations de stock échues (aussi faite au début de la réconciliation) |
| `/api/cron/moratoriums` | quotidienne | moratoires des réservations de salle |
| `/api/cron/ticket-transfers` | horaire | expiration des transferts de billets |

Planification, selon l'hébergement retenu :
- **Vercel (offre Pro)** : fichier `vercel.json` avec `{"crons":[{"path":"/api/cron/payments-reconcile","schedule":"*/5 * * * *"},{"path":"/api/cron/stock-reservations","schedule":"*/5 * * * *"}]}` et la variable `CRON_SECRET` (Vercel l'envoie dans l'en-tête Authorization). L'offre Hobby limite les crons à un par jour : insuffisant, et un `vercel.json` plus fréquent y fait échouer le déploiement — c'est pourquoi le fichier n'est pas versionné ;
- **Supabase (pg_cron + pg_net)** : `select cron.schedule('paiements', '*/5 * * * *', $ select net.http_get(url := 'https://<domaine>/api/cron/payments-reconcile', headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>')) $);` (secret à stocker dans Vault plutôt qu'en clair) ;
- **planificateur externe** (cron d'un serveur, service de tâches planifiées) : requête GET avec l'en-tête.

## 8. Bootstrap du premier SUPERADMIN

Le rôle SUPERADMIN n'est **plus** attribué par l'inscription (l'ancien trigger le donnait à quiconque déclarait le téléphone 773780756, y compris en métadonnée). Procédure :

1. La personne désignée crée son compte par l'inscription normale de l'application (email et téléphone réels), puis vérifie son téléphone.
2. L'opérateur, sur son poste, avec les variables du projet de **production** chargées dans le shell :

   ```bash
   npx tsx scripts/bootstrap-superadmin.ts --phone +221XXXXXXXXX --operator "Prénom Nom de l'opérateur"
   ```

   Le script refuse si un SUPERADMIN existe déjà, attribue le rôle dans `user_roles`, met à jour le profil et journalise l'opération (`audit_logs`, action `SUPERADMIN_BOOTSTRAP`).
3. Les administrateurs suivants sont créés depuis l'administration (`/api/admin/users`), qui attribue désormais le rôle explicitement.
4. Vérifier : la personne se reconnecte et accède à `/admin` ; `03-verification.sql` reste entièrement `OK`.

## 9. Recette avant ouverture

- `03-verification.sql` : tout `OK`.
- `supabase/hotfix/2026-10-31-lot1a/04-smoke-test.md` contre le projet de production : résultats « attendu après ».
- Parcours manuels : inscription client avec OTP, inscription partenaire puis validation par l'administration, création d'un événement, achat d'un billet en paiement réel de faible montant, scan par un contrôleur.
- Surveillance : journaux de l'hébergeur et **Logs > API** de Supabase pendant les premiers jours.

## 10. Ce que cette procédure ne couvre pas encore

- vérification de signature des webhooks SamirPay et confirmation de transaction (lot 2) ;
- politiques partenaire / contrôleur et confiance du middleware dans les métadonnées du jeton (lot 1B) ;
- correction de l'enregistrement des codes OTP en base par les routes d'inscription (colonne `user_id` inexistante), indispensable avant un hébergement à plusieurs instances ;
- secrets de dérivation TOTP et PIN dédiés (lot 4).
