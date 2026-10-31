# Audit du parcours événementiel — Event Village

**Périmètre :** de la création d'un événement par le Partenaire jusqu'au scan du billet par le Contrôleur (création → validation admin → publication → catégories de billets → achat et paiement SamirPay → QR dynamique → contrôle → encaissement espèces / Z de caisse → annulation et remboursement).

**Référence fonctionnelle :** Cahier des charges V3.0 (août 2026), déposé dans `docs/CDC-V3.md`. Référence technique : `docs/architecture.md`.

**Date :** 30 octobre 2026. **Base auditée :** branche `main`, commit `5195ddb`.

**Annexe :** la liste intégrale des 151 constats (description, preuve, impact, recommandation) est dans `docs/audit-evenementiel-annexe-constats.md`. Les identifiants entre crochets dans ce document (ex. `[payment-security-1]`) renvoient à cette annexe.

---

## 1. Résumé exécutif

**Verdict : le parcours événementiel n'est pas livrable à un client en l'état, ni même déployable pour un pilote.** Le squelette fonctionnel existe et plusieurs mécanismes sont bien conçus (machine à états serveur, compostage sous verrou, QR rotatif, sessions de caisse co-signées), mais la chaîne argent → billet → contrôle est cassée à plusieurs endroits critiques, et le modèle financier implémenté contredit le CDC.

Trois familles de problèmes bloquent tout lancement :

1. **Sécurité d'accès et de la billetterie.** N'importe qui peut obtenir des billets valides gratuitement (webhook de paiement non authentifié, billets forgeables par insertion directe en base, contournement du QR dynamique par un identifiant nu). N'importe quel compte connecté peut composter ou lister les billets d'autrui. Un inscrit peut s'auto-attribuer le rôle SUPERADMIN. Les codes OTP sont lisibles sans authentification.
2. **Intégrité des paiements.** Dans au moins trois scénarios réalistes, le client est débité sans recevoir de billet (hold de stock perdu, route de statut publique qui court-circuite le webhook, panier partiellement émis). Des webhooks concurrents émettent des billets en double. Les réservations temporaires de stock ne sont jamais nettoyées.
3. **Modèle financier contraire au CDC.** Les 5 % de frais de service sont déduits du reversement de l'organisateur au lieu d'être facturés au client (§37, §79, Annexe C). Le « remboursement » unitaire d'un billet ne rembourse rien. Les ventes en espèces au guichet sont remboursées par Mobile Money depuis la trésorerie de la plateforme en cas d'annulation. Aucune régularisation des commissions de parrainage n'existe (§82, §103).

| Indicateur | Valeur |
|---|---|
| Constats au total | 151 |
| Critiques / Élevés / Moyens / Faibles | 21 / 54 / 58 / 18 |
| Constats contre-vérifiés ligne à ligne par l'auditeur principal | 59 (dont la totalité des critiques de sécurité et de finance) |
| `tsc --noEmit` | 0 erreur |
| `next lint` | 1 erreur (bloque `next build` par défaut), 6 avertissements |
| Tests automatisés | 31 suites, non exécutées (elles ciblent une base Supabase réelle avec des comptes codés en dur et envoient de vrais SMS) |

**Recommandation :** geler toute mise en production, traiter le lot P0 décrit en section 7 (estimation : trois à quatre semaines pour un développeur senior), puis rejouer un audit de sécurité ciblé avant tout pilote.

---

## 2. Méthode et limites

- **Lecture statique exhaustive** du périmètre (≈ 20 000 lignes : routes API, services, migrations SQL, politiques RLS, pages et composants), confrontée paragraphe par paragraphe au CDC.
- **Dix auditeurs automatisés** spécialisés (conformité Partie V, conformité Partie VI et finance, sécurité paiement, sécurité scan, UX client, UX partenaire, UX contrôleur, modèle de données, tests, qualité de code) : huit ont livré leurs constats. Les auditeurs « tests » et « qualité de code » ainsi que la passe de vérification adversariale ont été interrompus par une limite d'usage ; les points correspondants ont été couverts manuellement (sections 5.8 et 5.9) ou signalés comme non contre-vérifiés dans l'annexe.
- **Contre-vérification manuelle** de 59 constats, dont tous ceux cités en section 4.
- **Non réalisé :** exécution de l'application, tests sur appareil réel, mesure de performance, inspection de l'instance Supabase hébergée (les constats RLS reposent sur les fichiers de migration et sur les privilèges par défaut de Supabase, qui exposent toutes les tables du schéma `public` aux rôles `anon` et `authenticated` via PostgREST).

---

## 3. Ce qui est correctement réalisé

Il est important de le dire : une partie du socle est de bonne facture et doit être conservée.

- **Machine à états serveur** pour le cycle de publication, qui interdit l'auto-validation par le partenaire et notifie partenaire et administrateurs à chaque transition (`lib/events/event.service.ts`, `changeEventStatus`).
- **Compostage atomique** par RPC PostgreSQL avec verrou consultatif et `FOR UPDATE`, exécutable uniquement par le rôle de service (`supabase/migrations/20260904_atomic_ticket_checkin.sql`).
- **QR dynamique TOTP** (RFC 6238, fenêtre de 20 s) dont le secret ne quitte pas le serveur ; le client ne reçoit qu'un payload temporel.
- **Sessions de caisse** co-signées par un PIN régisseur haché, avec justification obligatoire des écarts et rapports Z.
- **Anti-survente** par compare-and-swap sur `sold_quantity`, contrainte `CHECK (sold + held ≤ total)` et file de réservation temporaire (hold cart).
- **Calculateur financier conforme** à l'Annexe C du CDC (`lib/payments/financial-calculator.service.ts`), couvert par des tests ; le problème est qu'il n'est pas celui utilisé pour débiter le client.
- **Moteur d'annulation d'événement** avec cashouts idempotents, contrôle préalable de la trésorerie SamirPay et notifications multicanales.
- **Onboarding contrôleur** par compte « coquille » + OTP 24 h, refus d'écraser un compte établi, modèle multi-rôles.
- **Design system** cohérent (Plus Jakarta Sans, palette Sunset Coral, classes dark) et parcours client complet dans ses grandes lignes.

---

## 4. Risques majeurs (à corriger avant tout pilote)

Chaque risque ci-dessous a été vérifié par lecture directe du code. Les références de lignes sont celles du commit audité.

### 4.1 Sécurité de la plateforme

**R1 — Élévation de privilèges à l'inscription.** Le trigger `handle_new_user` lit le rôle demandé dans les métadonnées d'inscription (`raw_user_meta_data->>'role'`) et l'insère dans `user_roles`, y compris `ADMIN` ou `SUPERADMIN` (`supabase/migrations/20260906_user_roles_multi_role.sql` L397-424). L'inscription publique est activée (`supabase/config.toml` L163). Un appel `supabase.auth.signUp({ options: { data: { role: 'SUPERADMIN' } } })` avec la clé anonyme suffit pour obtenir tous les droits. La route `/api/auth/register` force bien `CLIENT`, mais rien n'oblige à passer par elle. `[data-model-1]`

**R2 — Codes OTP lisibles sans authentification.** La table `otp_codes` est créée sans RLS (`supabase/migrations/0005_storage_and_auth.sql` L19-28) et aucune migration ultérieure ne l'active. Avec les privilèges par défaut de Supabase, `GET /rest/v1/otp_codes` avec la clé anonyme renvoie les codes en cours. Combiné à `/api/controller/setup` (route publique : téléphone + OTP → nouveau mot de passe), cela permet de prendre le contrôle des comptes contrôleurs ; combiné à `/api/auth/verify-otp`, celui des inscriptions. `[data-model-3]`

**R3 — Compostage de n'importe quel billet par un appel RPC anonyme.** La fonction `validate_and_check_in_ticket(p_qr_code, p_controller_id)` est `SECURITY DEFINER`, n'a jamais reçu de `REVOKE EXECUTE` (contrairement à `atomic_ticket_checkin`), et vérifie les droits de l'identifiant *passé en paramètre*, pas de l'appelant (`supabase/migrations/20260906_user_roles_multi_role.sql` L235-307). Quiconque connaît un `qr_code` et l'UUID d'un contrôleur ou d'un propriétaire d'événement (les profils des partenaires validés sont lisibles par `anon`, `0003_rls.sql` L80) peut invalider des billets en masse. `[data-model-4]`

**R4 — Billets forgeables et modifiables via l'API REST.** La politique `tickets_insert_auth` autorise tout utilisateur connecté à insérer un billet pour lui-même (`0003_rls.sql` L161-162) ; `tickets_update_controller` autorise tout CONTROLEUR à modifier n'importe quel billet (L164-165) ; `tickets_read` donne à tout contrôleur la lecture de tous les billets de la plateforme, `qr_code` compris (L154-159). Un client peut donc insérer un billet `VALIDE` sur un événement publié (prix 0, `order_id` nul) : le scan le trouvera et l'acceptera. Un contrôleur peut remettre un billet utilisé en `VALIDE`. `[data-model-2]` `[scan-security-3]`

**R5 — Journal d'audit falsifiable et annuaire exposé.** `audit_logs_insert_system` accepte toute insertion (`WITH CHECK (TRUE)`, `0003_rls.sql` L358-359). `users_select_policy` rend l'intégralité de la table `users` (noms, téléphones, emails) lisible par tout contrôleur, et les profils des partenaires validés lisibles par `anon` (L75-81). `[scan-security-9]` `[scan-security-10]`

**R6 — Politique `payments_insert_auth`.** Tout client connecté peut insérer des lignes `payments` arbitraires (`0003_rls.sql` L281-282), ce qui empoisonne la file de réservation de stock et les tableaux financiers. `[payment-security-11]`

### 4.2 Paiement et émission des billets

**R7 — Webhook SamirPay non authentifié.** `POST /api/webhooks/samirpay` est public (`middleware.ts` L6), le champ `signature` est optionnel et jamais vérifié (`lib/validations/payment.ts` L53), `SAMIRPAY_WEBHOOK_SECRET` n'est utilisé nulle part et `checkTransactionStatus` n'est jamais appelé par le traitement du webhook (`lib/payments/payment.service.ts` L473-517). Un `POST` avec `order_id=<ORD-EV-…>&status=success&transaction_id=x` émet les billets. Les identifiants de commande sont au format `ORD-EV-<timestamp>-<6 hex>` et transitent dans les URLs de retour. `[payment-security-1]`

**R8 — Injection de filtre PostgREST.** `.or(\`external_order_id.eq.${order_id},transaction_id.eq.${order_id}\`)` avec `order_id` non authentifié (`payment.service.ts` L500) ; idem avec `transactionId` dans la route publique `/api/payments/[transactionId]/status` (L27). Une valeur contenant `,status.eq.PENDING` ou des opérateurs PostgREST permet de cibler d'autres paiements. `[payment-security-10]`

**R9 — Client débité, aucun billet (scénario 1 : hold perdu).** Dans `verifyAndEnforceHoldAtomic`, les `throw` de rupture de stock (`lib/events/event.service.ts` L1535, L1565, L1575) sont englobés par un `try { … } catch {}` (L1518-1580) qui les avale. La fonction supprime l'enregistrement `payments` (L1534, L1564, L1574) puis retourne `true` ; le checkout continue, appelle SamirPay (L237-255 de `app/api/checkout/route.ts`), le client paie, et le webhook ne retrouve plus la transaction (« Transaction introuvable », `payment.service.ts` L503-506). Aucun billet, aucun remboursement automatique, aucune trace. `[payment-security-2]`

**R10 — Client débité, aucun billet (scénario 2 : route de statut).** `/api/payments/[transactionId]/status` est publique et, si SamirPay répond « succès » avant le webhook, passe le paiement en `SUCCESS` sans émettre de billet ni libérer le hold (L38-57). Le webhook qui arrive ensuite se croit déjà traité (`payment.service.ts` L509-512). Le trigger SQL génère par ailleurs des commissions de parrainage sur cette vente sans billet. Le client sondage cette route toutes les 4 s (`hooks/usePaymentStatus.ts` L120-124). `[payment-security-3]`

**R11 — Client débité, billets partiels (scénario 3 : panier).** Pour un panier multi-catégories, le webhook émet catégorie par catégorie ; si une catégorie échoue, le paiement passe quand même en `SUCCESS` pour le montant total, sans remboursement de la part non émise (`payment.service.ts` L566-602, L818-828). `[ticketing-finance-9]`

**R12 — Transition `PENDING → SUCCESS` non atomique.** Le webhook lit le statut puis traite ; deux notifications concurrentes (rejeu fournisseur) émettent deux fois les billets (`payment.service.ts` L497-512, L543-589). Aucun `UPDATE … WHERE status = 'PENDING'` ne sérialise la transition. `[payment-security-4]`

**R13 — Hold cart incohérent.** Le hold est décrémenté deux fois au succès (dans le CAS de `reserveTicketsAtomic` L1094-1102, puis par `releaseHoldTicketsAtomic` dans le `finally` du webhook L561-565 et L593-597), ce qui efface les réservations des autres acheteurs et permet la survente. Les holds fuient définitivement si le deuxième article d'un panier échoue (paiement supprimé, premier hold jamais libéré) ou si SamirPay refuse au niveau du corps de réponse (`checkout/route.ts` L289-297 sans libération). Enfin, `cleanupExpiredHolds` n'est appelé par aucun cron (`app/api/cron` ne contient que `moratoriums` et `ticket-transfers`). `[payment-security-5]` `[payment-security-6]` `[payment-security-7]`

**R14 — Contrôles de vente appliqués après encaissement.** Le checkout ne vérifie ni `sale_start`/`sale_end`, ni `max_per_order`, ni `held_quantity` (`checkout/route.ts` L73-96) ; ces règles ne sont appliquées qu'au webhook (`event.service.ts` L1005-1027), après débit, et déclenchent alors un remboursement automatique par cashout. Ce cashout part toujours sur Wave (l'opérateur choisi n'est jamais persisté) et, à défaut de téléphone, vers le numéro fictif `770000000` (`payment.service.ts` L605-628). `[payment-security-8]` `[payment-security-9]` `[ticketing-finance-4]`

### 4.3 Contrôle d'accès aux événements

**R15 — Le QR dynamique est contournable.** Tout payload sans préfixe `EVT1:` est traité comme une saisie manuelle et validé sans jeton TOTP (`app/api/controller/scan/route.ts` L72-78 et L135 ; `lib/security/totp.ts` L148-152). Or le `qr_code` statique est renvoyé au client (`app/api/tickets/route.ts` L107), imprimé dans le PDF, et le numéro de billet est partagé par les boutons WhatsApp du wallet (`components/tickets/TicketCard.tsx` L123-139). Il suffit d'encoder `EV-QR-…` dans un QR ordinaire pour entrer. L'anti-capture d'écran, objectif affiché du TOTP, est donc inopérant. `[scan-security-1]` `[client-ux-9]`

**R16 — `/api/tickets/verify` : compostage par n'importe quel compte.** Cette route (utilisée par la page `/partner/scan`) n'a aucune vérification de rôle, de propriété ni de statut d'événement (`app/api/tickets/verify/route.ts` L14-28), composte sans verrou (L145-151) et impute l'audit au porteur du billet (L155). Tout client connecté peut invalider le billet de quelqu'un d'autre. `[scan-security-2]` `[partner-ux-1]`

**R17 — IDOR sur la liste des billets.** `GET /api/tickets?userId=<uuid>` renvoie les billets (avec `qr_code`) de l'utilisateur demandé dès qu'aucun jeton Bearer n'est fourni (`app/api/tickets/route.ts` L22-27). Le front appelle d'ailleurs la route ainsi. Combiné à R15 : vol de billets à distance. `[scan-security-5]` `[client-ux-8]`

**R18 — `live-code` pour tout le staff.** Tout CONTROLEUR ou PARTENAIRE obtient le payload QR valide de n'importe quel billet, même d'un autre partenaire (`app/api/tickets/[id]/live-code/route.ts` L43-47). `[scan-security-4]`

**R19 — Branche partenaire du scan.** Pour PARTENAIRE/ADMIN, pas de contrôle de paiement (« cash gate »), compostage non atomique dont le résultat n'est pas vérifié, réponse « valide » et audit même si rien n'a été mis à jour (`scan/route.ts` L306-352). `[scan-security-7]`

**R20 — Encaissement espèces fragile.** `PUT /api/controller/scan` composte avant de vérifier la commande, exige `total_amount === price` (incompatible avec plusieurs billets par commande et avec le modèle « prix + frais »), n'impose la session de caisse qu'au CONTROLEUR, et affiche comme montant dû le solde de toute la commande pour chaque billet (L249, L472-503, L508-560). `[scan-security-6]`

**R21 — Secret TOTP.** La colonne `tickets.totp_secret` n'est jamais renseignée à l'émission (`event.service.ts` L1169-1178) ; tous les billets utilisent une dérivation HMAC dont la clé est le secret du hook SMS, ou la clé service role, ou une constante codée en dur (`totp.ts` L17-20). Réutilisation d'un secret critique comme clé de dérivation, rotation impossible, codes forgeables si l'environnement est incomplet. `[scan-security-12]` `[data-model-15]`

### 4.4 Modèle financier et conformité CDC

**R22 — Frais de service prélevés sur l'organisateur.** Pour un billet de 1 000 F, le CDC (§37, §79, Annexe C) prévoit : client 1 050, agrégateur 15,75, organisateur 1 000, Event Village 34,25. L'implémentation (`checkout/route.ts` L155-162 ; `payment.service.ts` L248-255) fait : client 1 000 (c'est aussi ce que la page et la modale affichent), agrégateur 15, organisateur 950, Event Village 35. Les commissions de parrainage (`0002_functions.sql` L144) sont assises sur cette base erronée. Le calculateur conforme existe mais n'est utilisé que pour des tableaux de bord et des tickets guichet, jamais pour le débit. Il y a donc deux moteurs de calcul contradictoires. `[ticketing-finance-1]` `[ticketing-finance-2]` `[client-ux-1]`

**R23 — Remboursement unitaire fictif.** `refundTicket` marque le billet `REMBOURSE`, insère une ligne `refunds` au statut `PROCESSED` sans aucun cashout, laisse le paiement en `SUCCESS`, ne corrige ni revenu ni commission, et envoie au client un message « a été remboursé (X FCFA) » (`event.service.ts` L1637-1771). Les billets achetés en panier n'ont même pas de ligne `refunds` (le paiement n'est pas lié par `ticket_id`). Un CONTROLEUR peut déclencher ce « remboursement » (L1673 ; route L14). `[ticketing-finance-5]`

**R24 — Aucune régularisation des commissions de parrainage.** Le trigger ne réagit qu'au passage à `SUCCESS` ; aucun code ne passe une commission en `CANCELLED` lors d'un remboursement ou d'une annulation (§41, §82, §103). `[ticketing-finance-6]` `[data-model-5]`

**R25 — Annulation d'événement : la plateforme rembourse de l'argent qu'elle n'a jamais encaissé.** Les ventes guichet en espèces créent des lignes `payments` `SUCCESS` (`event.service.ts` L1222-1250) ; le moteur d'annulation sélectionne tous les paiements `SUCCESS` liés aux billets sans filtrer `is_platform_payment` (`event-cancellation.service.ts` L261-290) et les rembourse par cashout Mobile Money depuis la trésorerie Event Village. Ces mêmes ventes espèces génèrent un « revenu Event Village » de 5 % alors qu'aucun flux ne transite (§76). `[ticketing-finance-3]` `[ticketing-finance-7]`

**R26 — Solde partenaire incohérent et non retirable.** La page finance partenaire calcule le solde à partir de la somme des prix faciaux de tous les billets `VALIDE`/`UTILISE`, invitations et espèces compris (`app/api/partner/finance/route.ts` L58-66, L121), mais la RPC `request_withdrawal` ne compte que les commissions de parrainage (`20260903_atomic_withdrawal_rpc.sql` L36-41). Un organisateur voit un solde qu'il ne peut jamais retirer ; il n'existe pas de flux de reversement partenaire (§81, §83). `[ticketing-finance-8]`

### 4.5 Cycle de vie des événements

**R27 — Le statut ANNULE est un trou dans la machine à états.** `changeEventStatus` n'a aucune branche pour `ANNULE` ni de `else` par défaut (`event.service.ts` L746-801) : un partenaire peut remettre `PUBLIE` un événement annulé et remboursé par un simple `POST /api/partner/events/{id}/status`. La route ne valide pas le statut reçu. `[events-cdc-1]`

**R28 — Événements non publiés visibles.** `/api/events/[id]` ne filtre pas le statut (L19-53) et la page publique ne lit jamais `event.status` : brouillons, suspendus, annulés et terminés sont consultables par URL avec le module d'achat ; la bannière d'annulation existe mais n'est importée nulle part. `[events-cdc-2]` `[client-ux-4]`

**R29 — L'édition d'un événement publié échoue toujours.** Le formulaire envoie systématiquement `ticket_categories` (`app/partner/events/[id]/edit/page.tsx` L337-345), champ refusé pour les événements `PUBLIE` (`event.service.ts` L261-276). Par ailleurs, les modifications de catégories saisies en édition sont ignorées silencieusement. `[events-cdc-3]` `[events-cdc-4]`

**R30 — Cycle incomplet.** Aucun passage automatique à `TERMINE` (les événements passés restent vendables) ; l'annulation (§41) n'est accessible depuis aucune interface (`EventCancelModal` jamais monté) ; `SUSPENDU` est une impasse (pas d'annulation possible, détenteurs jamais informés) ; l'admin ne peut ni réactiver un suspendu ni voir le contenu avant validation ; aucune validation serveur structurée (pas de schéma Zod pour les événements : dates passées, fin avant début, JSON arbitraire acceptés). `[events-cdc-5]` `[events-cdc-6]` `[events-cdc-8]` `[events-cdc-9]` `[events-cdc-10]`

**R31 — Services associés (§34) sans effet.** « tables », « communication » et « promotion » sont des booléens stockés sans aucune fonctionnalité derrière ; la réservation de tables liée à un événement (§51) n'est pas modélisée. `[events-cdc-7]`

### 4.6 Schéma et données

- `activate_partner_trial` écrit `partners.status = 'ACTIF'`, valeur absente de l'enum `partner_status` : la RPC échoue toujours (`0008_partner_auth_production.sql` L63-69). `[data-model-8]`
- L'annulation d'événement révoque les transferts P2P sur des colonnes inexistantes (`ticket_transfers.event_id`, `updated_at`) et avale l'erreur : les transferts en attente survivent à l'annulation (`event-cancellation.service.ts` L225-237). `[data-model-9]`
- Les politiques RLS de `event_cancellations` référencent `partners.partner_id`, colonne inexistante ; PostgreSQL résout le nom sur `events.partner_id`, ce qui rend la condition toujours vraie pour tout utilisateur possédant un profil partenaire (`20260910_event_cancellation_and_refunds.sql` L43-87). `[data-model-6]`
- `REPLICA IDENTITY FULL` sur `tickets` et publication Realtime : les lignes complètes (dont `totp_secret` si un jour renseigné) sont diffusées à tout contrôleur abonné. `[data-model-14]`
- Les taux de frais ne sont pas historisés dans `payments` (seulement les montants), contrairement à `docs/architecture.md` §27. `[data-model-13]`

### 4.7 Outil terrain du contrôleur

- Toute erreur serveur ou de session (401, 403, 429, 500) est affichée au spectateur comme « BILLET INVALIDE » avec voix et comptée en refus. `[controller-ux-1]`
- Les fichiers audio Wolof livrés font 72 octets chacun (silence) et seuls trois des six fichiers référencés existent (`public/sounds/wolof/`). `[controller-ux-4]`
- Les abonnements Realtime sur `events`, `event_controllers` et `users` sont inertes : ces tables ne sont pas dans la publication `supabase_realtime` (`0004_indexes.sql` L142-148, `20260907_*`). `[controller-ux-7]`
- Caméra redémarrée à chaque scan, boucles de décodage non arrêtées, statistiques fausses (« Billets valides » retombe à 0 après chaque scan). `[controller-ux-2]` `[controller-ux-3]` `[controller-ux-6]`

---

## 5. Constats par dimension

Les tableaux ci-dessous résument les constats de sévérité élevée et moyenne non repris en section 4. Le détail est dans l'annexe.

### 5.1 Partie V — Événements

| Sujet | Constat | Réf. |
|---|---|---|
| Catalogue public | Prix « à partir de » et liste incluent les catégories masquées | events-cdc-11 |
| Post-publication | Tous les champs structurants restent modifiables ; changements de fin non notifiés | events-cdc-12 |
| Programme §32 | Modèle plat sans typage artistes/intervenants/activités, horaires en texte libre | events-cdc-13 |
| Slug / SEO | Slug généré mais inexploitable (route publique exige un UUID) | events-cdc-14 |
| Édition | Catégorie d'événement, géolocalisation et galerie non modifiables ; `gallery_urls` mort | events-cdc-15 |
| Notifications | `TERMINE` et retrait jamais notifiés ; `PUBLIE` in-app seulement | events-cdc-16 |
| Robustesse | Paramètre `status` non validé (500), recherche `ilike` non échappée | events-cdc-17 |

### 5.2 Partie VI — Ticketing et finance

| Sujet | Constat | Réf. |
|---|---|---|
| §35 | Dates de vente non modifiables après création | ticketing-finance-11 |
| §77 | Frais agrégateur non configurables par moyen de paiement | ticketing-finance-12 |
| Statistiques | Billets remboursés comptés comme ventes | ticketing-finance-13 |
| Arrondis | Centimes en XOF sans règle centralisée | ticketing-finance-14 |
| Configuration | Repli silencieux 5 % / 1,5 % dans le checkout ; taux 0 impossible | ticketing-finance-15, payment-security-17 |
| Panier mixte | Billets gratuits émis et notifiés avant le paiement de la partie payante, ré-émis à chaque tentative | ticketing-finance-16, payment-security-12 |

### 5.3 Sécurité paiement (complément)

| Sujet | Constat | Réf. |
|---|---|---|
| Webhook | Réponse 200 systématique même en erreur ; aucun journal des webhooks reçus ; PII dans les logs | payment-security-13 |
| Hold cart | Replis « colonne absente » masquant les dérives | payment-security-14 |
| Route legacy | `/api/events/[id]/tickets/purchase` : tout CONTROLEUR/ADMIN émet des billets et des paiements `CASH SUCCESS` pour n'importe quel événement, hors session de caisse | payment-security-15 |
| Client SamirPay | Réponse de statut non corrélée à l'`order_id`, parsing JSON avant contrôle HTTP | payment-security-16 |

### 5.4 Sécurité scan et caisse (complément)

| Sujet | Constat | Réf. |
|---|---|---|
| Comptes | Un partenaire peut réactiver un compte suspendu par l'administration (`status: 'ACTIF'` inconditionnel) | scan-security-8 |
| Traçabilité §154 | Refus de scan, saisie manuelle et tentatives suspectes non journalisés | scan-security-11 |
| PIN régisseur | Hash exposé via la RLS `events_read_public` ; PIN généré par `Math.random` | scan-security-13 |
| Dates | Aucun contrôle de date au scan ; événements `VALIDE` non publiés scannables ; encaissement possible sur événement annulé | scan-security-14 |
| Rate limiting | Effectif en mémoire locale uniquement ; aucune limite sur `PUT` et `live-code` | scan-security-15 |
| IDOR | Tout contrôleur consulte le Z de caisse de n'importe quelle session | scan-security-16 |
| Affectations | Retrait d'un contrôleur en plein événement sans vérifier sa session de caisse | scan-security-17 |
| ShiftService | Replis mémoire créant des états de caisse fantômes | scan-security-18 |
| Comptes suspendus | Routes partenaire sans contrôle de `user.status` | scan-security-19 |

### 5.5 Parcours client

| Sujet | Constat | Réf. |
|---|---|---|
| Paiement | Option « Carte bancaire » inopérante (rejetée par le checkout) | client-ux-2 |
| Fenêtre de vente | Ignorée par l'UI et par le checkout | client-ux-3 |
| Wallet | Le billet du jour J bascule en historique dès minuit | client-ux-5 |
| Explore | Filtre prix plafonné et villes codées en dur masquent des événements | client-ux-6 |
| Retour paiement | Pas d'écran d'attente ; atterrissage sur un wallet vide ; timeout 3 min vs hold 10 min | client-ux-7 |
| Hors ligne | « Code actif en cache » affiché alors que le TOTP est périmé ; pas de repli | client-ux-10 |
| Mobile | CTA fixe sans safe-area, toasts débordants, cibles de 28 px | client-ux-11 |
| Finition | Emojis, placeholders, Unsplash de secours, badges non fondés, liens morts, libellés Orange Money sur Wave | client-ux-12, 13, 15 |
| Design system | Classes Tailwind inopérantes (`/8`, `shadow-xs`, `h-13`), dark mode non natif | client-ux-14 |
| Découverte | Pas d'événements « proches », recherche du hero non transmise, pas de pagination | client-ux-16 |
| Erreurs / i18n | Messages techniques bruts, heure « 20:00 » fabriquée, panier perdu après connexion | client-ux-17 |
| Performance | Catalogue 100 % client, Leaflet depuis unpkg à l'exécution, hook realtime non filtré | client-ux-18 |
| Architecture | Numéros Superadmin codés en dur dans le layout client | client-ux-19 |
| Accessibilité | Lignes cliquables non focalisables, contrôles sans `aria-label`, double `h1` | client-ux-20 |

### 5.6 Parcours partenaire

| Sujet | Constat | Réf. |
|---|---|---|
| Cycle de vie | Pas de « Retirer », « Terminer » ; aucun affichage pour SUSPENDU / TERMINE / ANNULE | partner-ux-4 |
| Rejet admin | Invisible pour le partenaire (retour à BROUILLON sans motif persistant) | partner-ux-5 |
| Navigation | Pages Équipe et Caisse par événement orphelines (PIN régisseur inaccessible sans URL) | partner-ux-6 |
| Rapport Z | Remboursements déduits deux fois ; ligne frais Event Village toujours à 0 | partner-ux-7 |
| KPI | « Billets vendus » et « CA » calculés de quatre façons différentes ; holds comptés | partner-ux-8 |
| Formulaire | Pas de validation par étape, pas de brouillon, perte de saisie au rechargement | partner-ux-9 |
| Édition | Divergence création / édition (catégorie, carte, dates de vente, limite par commande absentes) | partner-ux-10 |
| Dates / prix | Dates de vente en jour exclusif, validation sur l'horloge du navigateur, décimales acceptées en FCFA | partner-ux-11, 12 |
| Quotas | Quota 0 acceptable, prix figé après publication, modale non accessible | partner-ux-13 |
| Équipe | Statut « En attente » déduit du prénom, permission espèces non modifiable par événement | partner-ux-14 |
| Caisse | Écart « 100 % exact » avec sessions ouvertes, régénération du PIN sans confirmation | partner-ux-15 |
| Dashboard | Capacité par défaut à 1 (« 25 / 1 »), activité récente non triée | partner-ux-16 |
| Scan partenaire | « QR expiré » non géré, pipeline dupliqué avec le scanner contrôleur | partner-ux-17 |
| Erreurs | Erreurs réseau avalées, états vides trompeurs | partner-ux-18 |
| Mobile / a11y | Inputs 12 px (zoom iOS), stepper tronqué, modales sans a11y | partner-ux-19 |
| Finition | 215 couleurs codées en dur, accents absents, composants de 760 à 1 339 lignes | partner-ux-20, 21, 22 |

### 5.7 Parcours contrôleur (complément)

| Sujet | Constat | Réf. |
|---|---|---|
| Encaissement | Refus serveur affichés comme « BILLET INVALIDE » éphémère ; confirmation perdue | controller-ux-5 |
| Codes résultat | `event_cancelled` traité comme faux billet ; `rate_limited` sans titre | controller-ux-8 |
| Erreurs | Écran de chargement sans issue ; 401 traité comme erreur générique | controller-ux-9 |
| Setup | Page d'activation rendue dans le layout connecté ; pas de renvoi de code | controller-ux-10 |
| Saisie manuelle | `is_manual_entry` jamais affiché ; pas de rappel de contrôle d'identité | controller-ux-11 |
| Batterie | Mode veille ne coupe pas la caméra ; pas de Wake Lock ni d'indicateur hors ligne | controller-ux-12 |
| Overlay | Minuterie réinitialisée à chaque rendu | controller-ux-13 |
| Robustesse | Crash si l'événement joint est nul | controller-ux-14 |
| Ergonomie | Cibles < 44 px, textes 8–10 px, PIN sans clavier numérique, PWA incomplète | controller-ux-15, 16, 17 |
| Dette | Composant de 1 185 lignes, second moteur de scan sans règles métier | controller-ux-18, 19 |

### 5.8 Santé du build et qualité du code (vérifié manuellement)

- `npx tsc --noEmit` : aucune erreur.
- `npx next lint` : **1 erreur** (`react/no-unescaped-entities`, `components/scan/CameraQrScanner.tsx` L440) et 6 avertissements (dépendances de hooks manquantes, `<img>` non optimisées). `next.config.mjs` ne désactive pas le lint au build : **`next build` échoue en l'état.**
- Logique métier dans les routes : `app/api/checkout/route.ts` (330 lignes) réimplémente `createPayment` avec des résultats différents ; trois moteurs de calcul financier coexistent (checkout, `createPayment`, `FinancialCalculatorService`).
- Fichiers hors de contrôle : `event.service.ts` 1 773 lignes, `notification.service.ts` 1 347, `payment.service.ts` 1 179, `controller/scanner/page.tsx` 1 185, `partner/events/new/page.tsx` 1 131, `partner/team/page.tsx` 1 339.
- Code défensif « au cas où la migration manque » (repli sans verrou si la RPC n'existe pas, `hasHeldCol`, `try/catch` vides) : symptôme d'un schéma non maîtrisé, et cause directe de R9.
- Routes mortes ou de débogage exposées : `/api/tickets/verify`, `/api/events/[id]/tickets/purchase`, `/api/test-notify-superadmins`, `/scan` → `/partner/scan`.
- Variables d'environnement non validées au démarrage ; valeurs par défaut dangereuses (`'event-village-totp-master-salt-2026'`, `CRON_SECRET || SERVICE_ROLE_KEY`).
- Pas de types générés Supabase, `any` et `as any` répandus, deux conventions pour `params` (Promise ou objet).
- Dépôt encombré de synthèses générées par IA à la racine (`DIAGNOSTIC.md`, `FIX_SUMMARY.md`, `IMPROVEMENTS_SUMMARY.md`, `IMPLEMENTATION_SUMMARY.md`, `TEST_SUMMARY.md`, `agent-production-audit-final.md`) dont les affirmations (« 100 % pass », « blindage ») ne résistent pas à la lecture du code.
- `docs/architecture.md` décrit une structure (`app/(client)`, `lib/referrals`, `lib/qr`, Vitest, Playwright, `docs/database.md`) qui n'existe pas.

### 5.9 Tests (vérifié manuellement)

- Les 31 suites sont des scripts `node:test` lancés par `tsx`, enchaînés par `&&` dans `package.json` : un échec arrête tout, aucune parallélisation.
- Elles ciblent la **base Supabase réelle** configurée dans `.env.local`, avec des **UUID d'utilisateurs codés en dur** (`tests/ticketing-e2e-final.test.ts` L31-35), réinitialisent des mots de passe et des rôles de comptes réels (L54-58), et peuvent envoyer de vrais SMS et emails. Elles ne sont ni reproductibles, ni exécutables en intégration continue, ni sûres.
- Aucun test unitaire pur de la machine à états ni du modèle financier tel qu'il est réellement appliqué au débit ; aucun test de webhook forgé, d'injection de filtre, de double webhook concurrent, de contournement TOTP par identifiant nu, ni de RLS depuis un client `anon`/`authenticated`.
- Aucun test E2E navigateur (Playwright) ni test de charge, contrairement au CDC §190 et à `docs/architecture.md` §39.

---

## 6. Tableau de conformité CDC

| Exigence | Référence | Statut | Commentaire |
|---|---|---|---|
| Création : titre, description, date, heure, lieu, image, programme | §30 | Partiel | Champs présents ; pas de validation serveur ; galerie morte |
| Statuts Brouillon → En attente → Validé → Publié → Suspendu → Terminé | §31 | Non conforme | ANNULE non géré, pas de TERMINE automatique, SUSPENDU impasse, événements non publiés visibles |
| Programme : artistes, horaires, activités, intervenants | §32 | Partiel | Modèle plat, texte libre |
| Infos pratiques : adresse, accès, parking, contact, règles | §33 | Conforme | Saisies et affichées |
| Services associés : ticketing, tables, communication, promotion | §34 | Non conforme | Booléens sans effet ; tables événement non modélisées |
| Catégories : catégorie, prix, quantité, date début, date fin | §35 | Partiel | Dates non appliquées à l'achat ni modifiables |
| Vente : choisir, commander, payer, recevoir | §36 | Partiel | Trois scénarios de paiement sans billet |
| Prix + frais de service facturés au client | §37, §79, Annexe C | Non conforme | Frais déduits de l'organisateur |
| QR unique | §39 | Conforme | `qr_code` unique |
| Contrôle : vert / rouge | §40 | Partiel | Contournement du TOTP ; route alternative sans contrôle |
| Annulation, remboursement, régularisation financière et des commissions | §41, §82, §103 | Non conforme | Remboursement unitaire fictif ; aucune régularisation ; annulation inaccessible depuis l'UI |
| Paiement hors plateforme non comptabilisé comme encaissement EV | §76 | Non conforme | Ventes espèces génèrent un revenu EV et sont remboursées par la plateforme |
| Frais agrégateur configurables par moyen de paiement | §77 | Non conforme | Taux unique |
| Revenu net éligible, base du parrainage | §80, §92 | Partiel | Mécanisme présent mais base erronée (R22) |
| Soldes et retraits partenaire | §81, §83 | Non conforme | Solde affiché non retirable |
| Contrôleur : scanner, vérifier, enregistrer un paiement hors plateforme selon permission | §11 | Partiel | Permission espèces présente ; encaissement fragile |
| Permissions minimales par rôle | §152 | Non conforme | RLS permissives, routes sans contrôle, élévation de privilèges |
| QR sécurisé, vérifiable, historisé | §154 | Non conforme | Contournable ; refus non journalisés ; audit falsifiable |
| Traçabilité des modifications sensibles | §156 | Partiel | Audit applicatif partiel ; pas de trigger sur events/tickets |
| Statistiques événements : tickets, participants, taux de présence | §160 | Partiel | KPI calculés de quatre façons, holds et remboursés comptés |
| Tests fonctionnels, sécurité, paiement, QR, charge, mobile, web | §190 | Non conforme | Voir 5.9 |

---

## 7. Plan de remédiation priorisé

### P0 — Bloquant avant tout pilote (ordre recommandé)

1. **Verrouiller la base.**
   - Retirer le rôle demandé des métadonnées dans `handle_new_user` (toujours `CLIENT`, sauf numéro Superadmin bootstrap) et migrer les comptes existants.
   - Activer la RLS sur `otp_codes` (aucune politique : accès service role uniquement).
   - `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` sur toutes les fonctions `SECURITY DEFINER` (`validate_and_check_in_ticket`, `calculate_referral_commissions`, `activate_partner_trial`, etc.), ou les supprimer si inutilisées.
   - Supprimer `tickets_insert_auth`, `tickets_update_controller`, `payments_insert_auth` ; restreindre `tickets_read` au porteur et au partenaire propriétaire ; `audit_logs` en insertion service role uniquement ; `users_select_policy` sans lecture globale pour les contrôleurs ; corriger `event_cancellations`.
   - Désactiver `REPLICA IDENTITY FULL` sur `tickets` ou filtrer les colonnes diffusées (vue dédiée).
2. **Authentifier le webhook SamirPay** : vérification HMAC avec `SAMIRPAY_WEBHOOK_SECRET` selon la documentation fournisseur, **et** confirmation systématique par `checkTransactionStatus` avant toute émission. Journaliser chaque webhook reçu (table `payment_webhooks`). Paramétrer les requêtes PostgREST (`.eq()` sur une seule colonne, jamais d'interpolation dans `.or()`).
3. **Rendre la confirmation de paiement atomique** : une RPC PostgreSQL `confirm_ticket_payment(payment_id)` qui, dans une transaction, passe le paiement de `PENDING` à `SUCCESS` (`UPDATE … WHERE status = 'PENDING' RETURNING`), décrémente le hold, incrémente les ventes et insère les billets. Le webhook et la route de statut appellent la même RPC. Retirer la route de statut de la liste publique et la limiter au propriétaire du paiement.
4. **Réécrire le hold cart** en SQL (RPC `hold_tickets` / `release_hold`) sans `try/catch` vide, avec un cron `cleanup_expired_holds` (Vercel Cron ou `pg_cron`) et libération garantie sur tous les chemins d'échec.
5. **Appliquer le modèle financier du CDC** dans un seul moteur : total client = prix + frais de service ; organisateur = prix facial ; agrégateur sur le total ; taux historisés dans `payments` (`service_fee_rate`, `aggregator_fee_rate`). Supprimer le calcul dupliqué du checkout (la route appelle `createPayment`). Afficher les frais au client avant paiement.
6. **Fermer les contournements du contrôle** : refuser tout identifiant nu venant de la caméra (le serveur n'accepte sans TOTP qu'une saisie manuelle explicitement déclarée, journalisée, et réservée au contrôleur assigné) ; supprimer `/api/tickets/verify` et `/partner/scan` (ou les faire passer par la route de scan contrôleur) ; supprimer le paramètre `userId` de `/api/tickets` ; restreindre `live-code` au porteur ; unifier la branche partenaire du scan avec la RPC atomique ; renseigner `totp_secret` à l'émission et retirer la dérivation à clé partagée.
7. **Corriger la machine à états** : branche `ANNULE` terminale, `else` par défaut, validation Zod du statut dans les deux routes ; filtrer `/api/events/[id]` sur `PUBLIE`/`TERMINE`/`ANNULE` (avec notice publique) ; cron de passage à `TERMINE`.
8. **Remboursements** : implémenter un vrai remboursement unitaire (cashout, statut `PENDING` jusqu'à confirmation, paiement `REFUNDED`, revenu corrigé, commissions `CANCELLED`), exclure les paiements hors plateforme du moteur d'annulation, persister l'opérateur et le téléphone de paiement.
9. **Build** : corriger l'erreur ESLint ; ajouter la validation des variables d'environnement au démarrage (schéma Zod) ; supprimer les valeurs de repli secrètes codées en dur.

### P1 — Avant lancement commercial

- Validation Zod de toutes les routes partenaire (événements, catégories), contrôles de dates et de cohérence serveur.
- Flux de reversement partenaire cohérent (solde = reversements dus sur paiements plateforme `SUCCESS` moins retraits), ou retrait explicitement désactivé avec message.
- Annulation d'événement accessible depuis l'UI partenaire et admin ; motif de rejet persistant et visible ; actions admin complètes (réactiver, publier, terminer, consulter avant validation).
- Édition d'un événement publié fonctionnelle ; édition des catégories (dates de vente, limite par commande, visibilité).
- Encaissement espèces : vérifier la commande avant de composter, supporter plusieurs billets par commande, imposer la session de caisse à tous les rôles, rapport Z corrigé.
- Scanner : différencier erreurs techniques et refus, caméra persistante, arrêt correct de ZXing, statistiques serveur complètes, Realtime sur des tables effectivement publiées, fichiers audio réels.
- Journalisation des refus de scan et des saisies manuelles ; rate limiting persistant.
- Services associés §34 : soit implémenter tables/communication/promotion, soit retirer les options de l'UI.

### P2 — Qualité, UX, dette

- Découper les fichiers de plus de 700 lignes ; types générés Supabase ; logger structuré et monitoring (Sentry) ; suppression des routes mortes et des synthèses IA à la racine ; mise à jour de `docs/architecture.md`.
- Pyramide de tests : Vitest unitaire (calcul financier réel, machine à états, parseur TOTP), intégration sur Supabase local (`supabase start` + seed, sans SMS réel), Playwright sur les parcours achat et scan, tests de sécurité (webhook forgé, RLS `anon`/`authenticated`), CI GitHub Actions avec `typecheck`, `lint`, `test`.
- Finition UX : états de chargement et d'erreur honnêtes, mobile (safe areas, cibles 44 px, zoom iOS), accessibilité, dark mode natif, suppression des emojis et placeholders, pagination et géolocalisation côté découverte, écran d'attente de paiement.

---

## 8. Annexes

- **Annexe A — Constats détaillés** : `docs/audit-evenementiel-annexe-constats.md` (151 constats, avec mention « Vérifié » ou « Non contre-vérifié »).
- **Annexe B — Limites de l'audit automatisé** : les auditeurs « tests » et « qualité de code », la critique de complétude et les 38 agents de vérification adversariale n'ont pas pu s'exécuter (limite d'usage). Les constats UX non marqués « Vérifié » proviennent d'un seul lecteur automatisé et doivent être confirmés à l'exécution avant d'être traités.
- **Annexe C — Commandes exécutées** : `npx tsc --noEmit` (0 erreur) ; `npx next lint` (1 erreur, 6 avertissements). La suite de tests n'a volontairement pas été lancée.
