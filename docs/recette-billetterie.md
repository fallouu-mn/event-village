# Recette de la billetterie

Ce document relie chaque exigence du cahier des charges V3.0 à sa preuve et liste les anomalies. La source des exigences est `docs/CDC-V3.md`.

## 1. Résumé

| Statut | Lignes |
|---|---|
| fait | 46 |
| partiel | 37 |
| non fait | 3 |
| écarté | 6 |
| hors périmètre | 14 |
| total | 106 |

Parmi les lignes « fait », 31 ont toutes leurs preuves lues vertes au run 97. Les 15 autres ont au moins une preuve à voir tourner : parcours `e2e/recette.spec.ts`, ou correctifs postérieurs à ce run.

Le run 97 a tourné sur le commit 621c804, écrans compris : 216 suites vertes sur 219, 315 captures vertes et 8 rouges, sur deux écrans. Rouges : `tests/parcours/otp-serveur.test.ts` (A35) et `tests/parcours/pilotage-remboursement-billet.test.ts` (A36), corrigées depuis, et le cas 6 de `tests/parcours/course-confirmation-annulation.test.ts`. Le parcours `e2e/recette.spec.ts` n’a pas encore tourné, il est postérieur à ce commit. La colonne CI sera à reprendre sur le run « après ».

Limite connue : l’annexe de l’audit (`docs/audit-evenementiel-annexe-constats.md`) n’a été lue qu’en version condensée à la découverte du lot. Le cahier des charges et chaque test cité ont été lus en entier.

## 2. Légende

| Statut | Sens |
|---|---|
| fait | Le code existe et chaque partie de l’exigence a une assertion dans un test dont le corps a été lu |
| partiel | Une partie manque, ou un affichage ou une route n’a pas d’assertion |
| non fait | Rien n’existe, ou seulement une donnée inutilisée |
| écarté | Écarté par une décision écrite |
| hors périmètre | Module non billetterie, renvoyé à ses lots par la consigne |

La colonne CI dit ce qui a été lu dans les journaux bruts de la branche `ci-results`, et rien d’autre :

- `vert au run N` : chaque test cité y est lu `ok` ;
- `à prouver au run après` : aucun test cité n’y est vert, parce qu’il est nouveau ou que son correctif est postérieur ;
- `vert au run N, le reste à prouver au run après` : les tests à prouver portent la mention « (à prouver) » ;
- `sans objet` : aucun test n’est cité.

Une ligne « fait » dont la colonne CI n’est pas entièrement verte reste à confirmer : le corps du test est lu, son résultat ne l’est pas.

`M/` désigne `supabase/migrations/`. Pour les migrations, le numéro de ligne est celui de la dernière définition de la fonction. Les suites à la racine de `tests/` qui ne prouvent rien (A21) ne sont jamais citées. Q1 à Q6 renvoient à la section 6, PO aux points ouverts du contrat du lot.

## 3. Matrice de traçabilité

### Parties I et II : principes et rôles

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §1, §6 P1, §183 | Un compte, plusieurs services ; un client = un compte | partiel | `M/0001_initial_schema.sql:214` | `tests/parcours/inscription-numero-dabord.test.ts:126`, `tests/parcours/inscription-numero-dabord.test.ts:194` | vert au run 97 | A12 : un client connecté ne peut pas devenir partenaire |
| §6 P2, §9 | Un partenaire cumule plusieurs activités | fait | `M/20261106000006_lot8_profil.sql:18`, `app/api/partner/profile/route.ts` | `tests/parcours/partenaire-profil-rpc.test.ts:208`, `tests/parcours/partenaire-profil-rpc.test.ts:229` | vert au run 97 | — |
| §6 P3, §85 | Le parrainage fait partie du compte client | fait | `app/wallet/page.tsx`, `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:256` | vert au run 97 | — |
| §6 P4, §13, §183, Annexe G | Ambassadeur = client, statut attribué par le SUPERADMIN | fait | `app/api/admin/users/route.ts`, `M/0001_initial_schema.sql:218` | `tests/parcours/acces-securite-urgente.test.ts:211`, `tests/parcours/acces-securite-urgente.test.ts:228`, `tests/security/r15-statut-ambassadeur.test.ts:27` | vert au run 97 | — |
| §6 P5, §74, §184 | Paiement Event Village distinct du hors plateforme | fait | `M/20261101000003_lot3_moteur.sql:151` | `tests/parcours/finance-hors-plateforme.test.ts:123`, `tests/parcours/finance-hors-plateforme.test.ts:142` | vert au run 97 | — |
| §6 P6, §80, §92 | Parrainage sur le revenu net éligible, jamais sur le brut | fait | `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:256`, `tests/parcours/commissions-plafond.test.ts:164` | vert au run 97 | — |
| §7 | Types d’utilisateurs | fait | `lib/auth/roles.ts` | `tests/parcours/attribution-roles.test.ts:73`, `tests/security/r1-inscription-roles.test.ts:30` | vert au run 97 | — |
| §10 | Administrateur : seulement ses fonctions | fait | `lib/admin/admin-auth.ts` | `tests/parcours/securite-admin-lot7.test.ts:177`, `tests/parcours/securite-admin-lot7.test.ts:311`, `tests/parcours/securite-admin-lot7.test.ts:340`, `tests/parcours/admin-evenements.test.ts:419` | vert au run 97 | — |
| §11 | Contrôleur : scanner, vérifier, paiement hors plateforme selon permission | fait | `app/api/controller/scan/route.ts`, `app/api/controller/counter-sale/route.ts` | `tests/parcours/acces-guichet.test.ts:162`, `tests/parcours/acces-encaissement.test.ts:284`, `tests/parcours/pilotage-equipe-caisse.test.ts:94`, `e2e/recette.spec.ts:615` (à prouver) | vert au run 97, le reste à prouver au run après | Réservations : hors périmètre |
| §12 | Superadmin : tous les droits, dont taux et durées | partiel | `app/admin/referral/page.tsx`, `app/api/admin/users/route.ts` | `tests/parcours/changement-role-admin.test.ts:42`, `tests/parcours/bootstrap-superadmin.test.ts:26`, `tests/parcours/finance-reglages.test.ts:91` | vert au run 97 | A1 corrigée, mais taux et durées par personne non construits (Q5) |

### Partie III : compte client

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §14, §145 | Création : prénom, nom, téléphone, email, mot de passe, OTP | fait | `app/api/auth/register/route.ts`, `app/api/auth/register/start/route.ts` | `tests/parcours/inscription-numero-dabord.test.ts:147`, `tests/parcours/inscription-numero-dabord.test.ts:194`, `tests/parcours/inscription-numero-dabord.test.ts:254`, `tests/parcours/email-optionnel.test.ts:66`, `e2e/recette.spec.ts:486` (à prouver) | vert au run 97, le reste à prouver au run après | Email facultatif : choix du lot 1C.8 |
| §15 | Profil modifiable : photo, nom, téléphone, email, préférences | partiel | `app/profile/page.tsx`, `app/profile/notifications/page.tsx` | `tests/parcours/notif-preferences.test.ts:367`, `tests/security/r7-profil-colonnes.test.ts:45` | vert au run 97 | A6 : profil en lecture seule à l’écran, préférences seules |
| §16 | Recherche par événement et par localisation | partiel | `app/api/events/route.ts`, `app/explore/page.tsx` | `tests/parcours/decouverte-recherche.test.ts:88`, `tests/parcours/decouverte-recherche.test.ts:97`, `tests/parcours/decouverte-recherche.test.ts:111`, `tests/parcours/decouverte-recherche.test.ts:122`, `tests/parcours/decouverte-recherche.test.ts:129`, `e2e/recette.spec.ts:486` (à prouver) | vert au run 97, le reste à prouver au run après | A28 : les écrans filtrent dans le navigateur, sans q ni city. Restaurant, salle, produit : hors périmètre |
| §17 | Événements populaires et proches | non fait | `app/api/events/route.ts` | — | sans objet | A7, Q4 |
| §18, §19 | Réservations et commandes du client | hors périmètre | — | — | sans objet | — |
| §20, §138 | Billet consulté : événement, catégorie, prix, QR, statut | partiel | `app/api/tickets/route.ts`, `components/tickets/TicketCard.tsx` | `tests/parcours/acces-qr.test.ts:340`, `tests/parcours/confirmation-achat.test.ts:579`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:794` (à prouver) | vert au run 97, le reste à prouver au run après | Catégorie et prix de la carte sans assertion d’affichage |
| §21, §8 | Historique : tickets, paiements, commissions, parrainage | partiel | `app/tickets/page.tsx`, `app/wallet/page.tsx` | `tests/parcours/finance-commissions.test.ts:475` | vert au run 97 | A17 : aucune liste des paiements du client ; A9 pour le parrainage |
| §22, §124 | Notifications : SMS, WhatsApp, Email, Push | partiel | `lib/notifications/dispatcher.ts` | `tests/parcours/notif-canaux.test.ts:213`, `tests/parcours/notif-canaux.test.ts:313`, `tests/parcours/notif-canaux.test.ts:494`, `tests/parcours/notif-canaux.test.ts:802` | vert au run 97 | A8 : WhatsApp absent (Q1) |

### Partie IV : espace partenaire

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §23, §145 | Inscription avec pièces | fait | `app/api/partner/register/route.ts`, `app/partner/register/page.tsx` | `tests/parcours/documents-inscription.test.ts:54`, `tests/parcours/documents-inscription.test.ts:71`, `tests/parcours/notif-admins.test.ts:208`, `e2e/recette.spec.ts:322` (à prouver) | vert au run 97, le reste à prouver au run après | — |
| §24, §129 | Validation : en attente, validé, refusé, suspendu | fait | `M/20261103000006_lot6_pros_admin.sql:698` | `tests/parcours/notif-pros.test.ts:665`, `tests/parcours/notif-pros.test.ts:679`, `tests/parcours/notif-pros.test.ts:700`, `tests/parcours/notif-pros.test.ts:748`, `tests/parcours/revocation-sessions.test.ts:81`, `e2e/recette.spec.ts:322` (à prouver), `e2e/recette.spec.ts:838` (à prouver) | vert au run 97, le reste à prouver au run après | — |
| §25 à §27 | Essai et packs | hors périmètre | — | — | sans objet | — |
| §28 | Page professionnelle | hors périmètre | — | — | sans objet | — |
| §29 | Tableau de bord : ventes, tickets, revenus, paiements, statistiques | partiel | `lib/partner/partner-dashboard.service.ts`, `app/partner/dashboard/page.tsx` | `tests/parcours/finance-rapports.test.ts:106`, `tests/parcours/finance-rapports.test.ts:116`, `tests/parcours/partenaire-lot7.test.ts:750`, `tests/parcours/partenaire-lot7.test.ts:892`, `tests/parcours/pilotage-apercu-ventes.test.ts:89`, `e2e/recette.spec.ts:725` (à prouver) | vert au run 97, le reste à prouver au run après | Montants de /partner/dashboard contrôlés par leur type, pas par leur valeur. Réservations, commandes, abonnement : hors périmètre |

### Partie V : événements

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §30, §137 | Titre, description, date, heure, lieu, image, programme | fait | `components/events/EventForm.tsx`, `lib/validations/event.ts`, `M/20261106000001_lot8_canaux.sql:637` | `tests/parcours/edition-formulaire.test.ts:378`, `tests/parcours/edition-validation.test.ts:321`, `tests/parcours/edition-validation.test.ts:424`, `tests/parcours/edition-validation.test.ts:496`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:322` (à prouver) | vert au run 97, le reste à prouver au run après | — |
| §31 | Statuts du cycle (ANNULE ajouté pour §41) | fait | `lib/events/event-status.ts`, `M/20261103000005_lot6_billetterie.sql:942` | `tests/parcours/cycle-transitions.test.ts:242`, `tests/parcours/cycle-transitions.test.ts:272`, `tests/parcours/cycle-transitions.test.ts:328`, `tests/parcours/cycle-transitions.test.ts:375`, `tests/parcours/cycle-cron.test.ts:176`, `tests/parcours/cycle-visibilite.test.ts:141`, `tests/parcours/cycle-visibilite.test.ts:216`, `tests/parcours/evenement-404.test.ts:198` | vert au run 97 | — |
| §32 | Programme : artistes, horaires, activités, intervenants | fait | `components/events/EventForm.tsx`, `app/events/[id]/page.tsx` | `tests/parcours/edition-validation.test.ts:458`, `tests/parcours/edition-validation.test.ts:476`, `e2e/recette.spec.ts:322` (à prouver), `e2e/recette.spec.ts:486` (à prouver) | vert au run 97, le reste à prouver au run après | — |
| §33 | Adresse, accès, parking, contact, règles | partiel | `components/events/EventForm.tsx`, `app/api/events/[id]/route.ts`, `app/events/[id]/page.tsx` | `tests/parcours/edition-formulaire.test.ts:562`, `e2e/recette.spec.ts:486` (à prouver) | vert au run 97, le reste à prouver au run après | A15 : adresse, accès, parking et règles assertés à l’écran, contact de l’organisateur non |
| §34 | Services associés : ticketing, tables, communication, promotion | écarté | `app/api/events/route.ts` | `tests/parcours/edition-services.test.ts:195`, `tests/parcours/edition-services.test.ts:204`, `tests/parcours/edition-services.test.ts:223`, `tests/parcours/edition-services.test.ts:250` | vert au run 97 | Billetterie seule, tâche 5.9 (`docs/lot5-rapport.md:2870`). Origine client à confirmer |

### Partie VI : ticketing

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §35 | Catégorie, prix, quantité, début et fin de vente ; canaux de vente (consigne 8.0) | fait | `components/events/EventTicketing.tsx`, `M/20261106000001_lot8_canaux.sql:211` | `tests/parcours/edition-categories.test.ts:259`, `tests/parcours/edition-categories.test.ts:318`, `tests/parcours/edition-categories.test.ts:362`, `tests/parcours/paiement-controles.test.ts:53`, `tests/parcours/canaux-vente.test.ts:285`, `tests/parcours/canaux-vente.test.ts:294`, `tests/parcours/canaux-vente.test.ts:343`, `tests/parcours/canaux-vente.test.ts:368`, `tests/parcours/canaux-vente.test.ts:385`, `tests/parcours/canaux-vente.test.ts:491`, `tests/parcours/canaux-vente.test.ts:506`, `tests/parcours/canaux-invariant.test.ts:235`, `tests/parcours/canaux-interface.test.ts:197`, `tests/parcours/canaux-interface.test.ts:205`, `tests/parcours/canaux-interface.test.ts:275`, `e2e/recette.spec.ts:322` (à prouver) | vert au run 97, le reste à prouver au run après | PO1 : une catégorie sans canal n’est distribuée à personne (outil d’invitations : question au client) |
| §36, §179 | Choisir, commander, payer, recevoir | fait | `lib/payments/checkout.service.ts`, `M/20261106000003_lot8_paiement.sql:84` | `tests/parcours/achat-serveur.test.ts:59`, `tests/parcours/confirmation-achat.test.ts:574`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:486` (à prouver) | vert au run 97, le reste à prouver au run après | — |
| §37, §79, §111, Annexes C et F | Prix + frais de service : 1 000 / 50 / 15,75 / 34,25 | fait | `M/20261101000003_lot3_moteur.sql:47` | `tests/parcours/finance-moteur.test.ts:73`, `tests/parcours/finance-moteur.test.ts:95`, `tests/parcours/finance-moteur.test.ts:153`, `tests/parcours/finance-affichage.test.ts:79`, `tests/parcours/finance-affichage.test.ts:104` | vert au run 97 | — |
| §38 | Moyens intégrés : Wave et Orange Money | fait | `lib/validations/payment.ts` | `tests/parcours/paiement-operateur.test.ts:27`, `tests/samirpay-contrat.test.ts:97` | vert au run 97 | Carte retirée : choix du lot 2 (`docs/lot2-rapport.md:28`) |
| §39, §154 | QR unique, sécurisé, vérifiable, historisé | fait | `lib/security/totp.ts`, `M/20261106000005_lot8_scan.sql:21` | `tests/parcours/acces-qr.test.ts:119`, `tests/parcours/acces-qr.test.ts:131`, `tests/parcours/acces-totp.test.ts:223`, `tests/parcours/acces-totp.test.ts:235`, `tests/parcours/acces-totp.test.ts:257`, `tests/parcours/acces-tracabilite.test.ts:90`, `tests/parcours/acces-tracabilite.test.ts:144` | vert au run 97 | — |
| §40 | Scan : vert, ou rouge invalide ou déjà utilisé | fait | `M/20261106000005_lot8_scan.sql:21`, `lib/scan/scan-result.ts` | `tests/parcours/acces-tracabilite.test.ts:90`, `tests/parcours/acces-scan.test.ts:108`, `tests/parcours/acces-fenetre.test.ts:95`, `tests/parcours/acces-fenetre.test.ts:116`, `tests/parcours/scan-renvoi-seulement.test.ts:143`, `e2e/terrain.spec.ts:119`, `e2e/terrain.spec.ts:468`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:615` (à prouver) | vert au run 97, le reste à prouver au run après | — |
| §41, §82, §184 | Annulation, remboursement, régularisations financière et de parrainage | fait | `M/20261106000003_lot8_paiement.sql:266`, `M/20261101000005_lot3_remboursements.sql:85`, `M/20261106000004_lot8_commissions.sql:123`, `components/partner/pilotage/TicketRefundPanel.tsx`, `components/admin/RefundsToRetry.tsx` | `tests/parcours/finance-annulation.test.ts:89`, `tests/parcours/finance-annulation.test.ts:140`, `tests/parcours/finance-remboursement-billet.test.ts:155`, `tests/parcours/finance-remboursement-billet.test.ts:231`, `tests/parcours/finance-commissions.test.ts:346`, `tests/parcours/finance-commissions.test.ts:375`, `tests/parcours/finance-commissions.test.ts:401`, `tests/parcours/commissions-plafond.test.ts:226`, `tests/parcours/commissions-plafond.test.ts:251`, `tests/parcours/double-paiement.test.ts:258`, `tests/parcours/admin-remboursements.test.ts:350`, `tests/parcours/admin-remboursements.test.ts:467`, `tests/parcours/admin-remboursements.test.ts:479`, `tests/parcours/pilotage-remboursement-billet.test.ts:235`, `tests/parcours/pilotage-remboursement-billet.test.ts:356`, `tests/parcours/pilotage-remboursement-billet.test.ts:369`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:725` (à prouver), `e2e/recette.spec.ts:794` (à prouver), `e2e/recette.spec.ts:838` (à prouver) | vert au run 97, le reste à prouver au run après | — |

### Parties VII à IX : salles, tables, commandes

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §42 à §73 | Salles, tables, commandes | hors périmètre | `lib/features/flags.ts` | `tests/parcours/interrupteurs.test.ts:358` | vert au run 97 | Modules derrière interrupteurs, lots à venir |

### Partie X : paiements et finances

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §75 | Transaction, montant, client, partenaire, frais, agrégateur, revenu, statut | fait | `M/20261105000006_lot7_client.sql:24` | `tests/parcours/finance-moteur.test.ts:153`, `tests/parcours/finance-moteur.test.ts:191` | vert au run 97 | — |
| §76 | Hors plateforme hors du solde Event Village | fait | `M/20261101000003_lot3_moteur.sql:151` | `tests/parcours/finance-hors-plateforme.test.ts:142`, `tests/parcours/finance-hors-plateforme.test.ts:223`, `tests/parcours/finance-retraits.test.ts:215` | vert au run 97 | — |
| §77 | Frais agrégateur configurables par moyen de paiement | fait | `M/20261101000002_lot3_reglages.sql:64` | `tests/parcours/finance-moteur.test.ts:119`, `tests/parcours/finance-reglages.test.ts:91` | vert au run 97 | — |
| §78, Annexe F | Service direct : agrégateur à la charge d’Event Village | fait | `M/20261101000003_lot3_moteur.sql:47` | `tests/parcours/finance-moteur.test.ts:136` | vert au run 97 | — |
| §81 | Soldes | fait | `app/api/finance/balance/route.ts` | `tests/parcours/finance-retraits.test.ts:215`, `tests/parcours/finance-retraits.test.ts:242`, `tests/parcours/finance-retraits.test.ts:522` | vert au run 97 | — |
| §83, §118 | Retraits : Mobile Money, banque, 1 %, seuil 5 000 | partiel | `M/20261101000014_lot4_correctif_retraits_concurrents.sql:12`, `app/partner/finance/page.tsx` | `tests/parcours/finance-retraits.test.ts:301`, `tests/parcours/finance-retraits.test.ts:316`, `tests/parcours/finance-retraits.test.ts:325`, `e2e/recette.spec.ts:725` (à prouver) | vert au run 97, le reste à prouver au run après | A10 : virement non traité, réglage fermé par défaut |
| §84 | Rapprochement : paiements, frais, agrégateurs, revenus, commissions, retraits | partiel | `app/api/admin/finance/reconciliation/route.ts`, `lib/admin/admin.service.ts`, `app/admin/finance/page.tsx` | `tests/parcours/finance-hors-plateforme.test.ts:167`, `tests/parcours/paiement-reconciliation.test.ts:47`, `tests/parcours/paiement-reconciliation.test.ts:64` | vert au run 97 | Le test vérifie quelles lignes figurent, pas les montants ni les totaux de commissions et de retraits |

### Partie XI : parrainage, part billetterie

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §86 | Lien pour devenir client | fait | `app/api/referrals/my-stats/route.ts`, `app/register/page.tsx` | `tests/parcours/inscription-numero-dabord.test.ts:254`, `tests/parcours/parrainage-lien.test.ts:122`, `tests/parcours/parrainage-lien.test.ts:132`, `tests/parcours/parrainage-lien.test.ts:159`, `tests/parcours/parrainage-lien.test.ts:227` | vert au run 97 | — |
| §87, §88 | Lien prestataire, deux liens distincts | non fait | `app/api/auth/register/route.ts` | — | sans objet | A5, Q2 |
| §89 | Attribution non modifiable | fait | `M/0001_initial_schema.sql:594` | `tests/security/r13-parrainage-relations.test.ts:47`, `tests/security/r13-parrainage-relations.test.ts:57`, `tests/parcours/parrainage-gardes.test.ts:156`, `tests/parcours/parrainage-gardes.test.ts:167` | vert au run 97 | — |
| §90, §91, §94, Annexe C | N1 et N2 sur le net : 1,71 et 0,69 sur 34,25 (client standard) | fait | `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:256`, `tests/parcours/commissions-plafond.test.ts:203` | vert au run 97 | — |
| §93, Annexe B | Exemple abonnement | hors périmètre | — | — | sans objet | — |
| §95, §185 | Client standard : 5 %, 2 %, 12 mois | fait | `M/20261101000006_lot3_commissions.sql:49` | `tests/parcours/finance-commissions.test.ts:227`, `tests/parcours/inscription-numero-dabord.test.ts:254` | vert au run 97 | — |
| §96, §97, Annexe A | Prestataire 7/2 ; ambassadeur 7/2 et 10/3 | partiel | `M/20261101000006_lot3_commissions.sql:49` | `tests/parcours/finance-commissions.test.ts:227` | vert au run 97 | A5 : grille en base, lignes prestataire jamais utilisées ; N2 à 2 % (décision) |
| §98, §99 | Personnalisation, durées, historique, sans rétroactivité | partiel | `app/api/admin/users/route.ts`, `app/admin/referral/page.tsx` | `tests/parcours/acces-securite-urgente.test.ts:228`, `tests/parcours/finance-commissions.test.ts:284` | vert au run 97 | A1 : la fausse sauvegarde est retirée, la personnalisation n’existe pas (Q5, Q6) |
| §100 | Ticketing éligible | fait | `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:256` | vert au run 97 | — |
| §101 | Transactions non éligibles | partiel | `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-hors-plateforme.test.ts:142`, `tests/parcours/finance-commissions.test.ts:346`, `tests/parcours/commissions-plafond.test.ts:213` | vert au run 97 | Aucun mécanisme pour la fraude et le chargeback |
| §102 | En attente puis disponible, 7 à 14 jours | fait | `M/20261101000006_lot3_commissions.sql:131` | `tests/parcours/finance-commissions.test.ts:256`, `tests/parcours/finance-commissions.test.ts:284`, `tests/parcours/finance-commissions.test.ts:315` | vert au run 97 | — |
| §103 | Commission annulée ou déduite, journalisée | fait | `M/20261106000004_lot8_commissions.sql:123` | `tests/parcours/finance-commissions.test.ts:346`, `tests/parcours/finance-commissions.test.ts:375`, `tests/parcours/finance-commissions.test.ts:401`, `tests/parcours/commissions-plafond.test.ts:226`, `tests/parcours/commissions-plafond.test.ts:251` | vert au run 97 | — |
| §104 | Anti-fraude | partiel | `M/0001_initial_schema.sql:593`, `M/0011_referral_codes.sql:100` | `tests/parcours/parrainage-gardes.test.ts:90`, `tests/parcours/parrainage-gardes.test.ts:128`, `tests/parcours/parrainage-gardes.test.ts:139`, `tests/security/r13-parrainage-relations.test.ts:67` | vert au run 97 | A11 : auto-parrainage et boucles prouvés. Rien sur les transactions artificielles ; A27 |
| §105 | Retrait : 5 000 F, 1 %, Mobile Money, banque | partiel | `M/20261101000014_lot4_correctif_retraits_concurrents.sql:12` | `tests/parcours/finance-retraits.test.ts:301`, `tests/parcours/finance-retraits.test.ts:325`, `tests/parcours/finance-retraits.test.ts:424` | vert au run 97 | A10 |
| §106, §143 | Historique complet | partiel | `app/api/referrals/my-stats/route.ts`, `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:475`, `tests/parcours/commissions-plafond.test.ts:164` | vert au run 97 | A9 : ni filleul, ni taux, ni base, ni transaction à l’écran |

### Parties XII et XIII : modèle économique et communication

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §107 à §110, §112 à §117 | Modèle économique hors ticketing | hors périmètre | — | — | sans objet | — |
| §119 | ROI du parrainage | non fait | `app/api/admin/metrics/route.ts` | — | sans objet | A9 |
| §120 à §126 | Campagnes | hors périmètre | `app/admin/communications/page.tsx` | — | sans objet | Envoi désactivé, brouillon : décision 43 du lot 6 |

### Partie XIV : administration

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §127 | Vue globale du superadmin | partiel | `app/admin/dashboard/page.tsx`, `app/api/admin/metrics/route.ts` | `tests/parcours/finance-hors-plateforme.test.ts:132` | vert au run 97 | Route assertée sur le volume et le revenu net seulement ; affichage sans assertion |
| §128 | Utilisateurs | fait | `app/admin/users/page.tsx`, `app/api/admin/users/route.ts` | `tests/parcours/securite-admin-lot7.test.ts:177`, `tests/parcours/securite-admin-lot7.test.ts:237`, `tests/parcours/changement-role-admin.test.ts:42`, `e2e/recette.spec.ts:838` (à prouver) | vert au run 97, le reste à prouver au run après | — |
| §129 | Partenaires : validation, suspension, activités, statistiques | partiel | `app/admin/dashboard/page.tsx`, `app/api/admin/partners/[id]/status/route.ts` | `tests/parcours/notif-pros.test.ts:665`, `tests/parcours/notif-pros.test.ts:700`, `tests/parcours/notif-pros.test.ts:748`, `e2e/recette.spec.ts:322` (à prouver), `e2e/recette.spec.ts:838` (à prouver) | vert au run 97, le reste à prouver au run après | Activités et statistiques du partenaire sans assertion à l’administration. Abonnement : hors périmètre |
| §130 | Supervision des services | fait | `app/admin/events/page.tsx`, `app/admin/services/page.tsx` | `tests/parcours/admin-evenements.test.ts:346`, `tests/parcours/admin-evenements.test.ts:464`, `tests/parcours/admin-evenements.test.ts:530`, `tests/parcours/admin-services-mention.test.ts:189` | vert au run 97 | Salles, tables, commandes : hors périmètre |
| §131 | Finance : transactions, frais, revenus, commissions, retraits, remboursements | partiel | `app/admin/finance/page.tsx`, `components/admin/RefundsToRetry.tsx` | `tests/parcours/finance-hors-plateforme.test.ts:167`, `tests/parcours/securite-admin-lot7.test.ts:311`, `tests/parcours/admin-remboursements.test.ts:180`, `tests/parcours/admin-remboursements.test.ts:350`, `tests/parcours/admin-remboursements.test.ts:467`, `tests/parcours/admin-remboursements.test.ts:479`, `tests/parcours/admin-remboursements.test.ts:498`, `e2e/recette.spec.ts:838` (à prouver) | vert au run 97, le reste à prouver au run après | A3 corrigée ; même manque que §84 pour les montants affichés |
| §132, §133 | Parrainage et ambassadeurs | partiel | `app/admin/referral/page.tsx` | `tests/parcours/acces-securite-urgente.test.ts:228`, `tests/parcours/admin-parrainage.test.ts:239`, `tests/parcours/admin-parrainage.test.ts:250` | vert au run 97 | A1 corrigée ; A9 : ni revenus, ni commissions, ni ROI par ambassadeur (Q5) |
| §134 | Journal d’activité | partiel | `app/api/admin/audit/route.ts`, `app/admin/audit/page.tsx` | `tests/parcours/admin-audit.test.ts:107`, `tests/parcours/admin-audit.test.ts:127`, `tests/parcours/admin-audit.test.ts:180`, `tests/parcours/admin-audit.test.ts:246`, `tests/parcours/admin-audit.test.ts:277` | vert au run 97 | A13 corrigée ; champ « statut » absent de la table ; A24, A25, A38 |

### Parties XV à XVIII : données, automatisation, sécurité, statistiques

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §135, §137 | Données client et événement | fait | `M/0001_initial_schema.sql:214`, `M/0001_initial_schema.sql:218` | `tests/parcours/inscription-numero-dabord.test.ts:194`, `tests/parcours/edition-formulaire.test.ts:378` | vert au run 97 | — |
| §136, §139 à §141 | Données partenaire, réservation, produit, commande | hors périmètre | — | — | sans objet | — |
| §142 | Données financières : du montant brut au revenu final | partiel | `M/20261101000003_lot3_moteur.sql:47` | `tests/parcours/finance-moteur.test.ts:153`, `tests/parcours/finance-commissions.test.ts:256` | vert au run 97 | « Revenu final » (net moins commissions) ni stocké ni calculé |
| §144 | API : agrégateur, Mobile Money, SMS, email, WhatsApp | partiel | `lib/samirpay/http-client.ts`, `lib/notifications/dispatcher.ts` | `tests/samirpay-contrat.test.ts:97`, `tests/parcours/notif-canaux.test.ts:313`, `tests/parcours/notif-canaux.test.ts:802` | vert au run 97 | A8 |
| §146, §147 | Automatisation des réservations et des commandes | hors périmètre | — | — | sans objet | — |
| §148 | Paiements : confirmation, frais, revenu, remboursement, retrait | fait | `supabase/ops/schedule-crons.sql`, `M/20261106000003_lot8_paiement.sql:84` | `tests/parcours/paiement-webhook.test.ts:52`, `tests/parcours/paiement-webhook.test.ts:101`, `tests/parcours/paiement-reconciliation.test.ts:47`, `tests/parcours/paiement-reconciliation.test.ts:64`, `tests/parcours/finance-moteur.test.ts:153`, `tests/parcours/finance-retraits.test.ts:325` | vert au run 97 | — |
| §149 | Chaîne du parrainage | partiel | `M/20261106000004_lot8_commissions.sql:37` | `tests/parcours/finance-commissions.test.ts:256`, `tests/parcours/finance-commissions.test.ts:315` | vert au run 97 | A5 : complète pour un filleul client, absente pour un prestataire |
| §150 | Confirmation, rappel, expiration, notification | fait | `lib/notifications/reminders.ts`, `lib/notifications/dispatcher.ts` | `tests/parcours/confirmation-achat.test.ts:574`, `tests/parcours/notif-rappels.test.ts:320`, `tests/parcours/notif-rappels-annulation.test.ts:310`, `tests/parcours/dette-transferts.test.ts:552`, `e2e/fumee.spec.ts:91` | vert au run 97 | Campagne : hors périmètre |
| §151 | Mot de passe, OTP, récupération | partiel | `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`, `lib/auth/otp-store.ts` | `tests/parcours/otp-serveur.test.ts:68`, `tests/parcours/otp-objet.test.ts:77`, `tests/parcours/invitation-identite.test.ts:95` | vert au run 97 | Récupération : le code et le compte visé sont testés, le changement final du mot de passe (Supabase) ne l’est pas |
| §152 | Droits minimaux | partiel | `lib/admin/admin-auth.ts`, `middleware.ts` | `tests/security/r1-inscription-roles.test.ts:30`, `tests/security/r8-controleur-lectures.test.ts:14`, `tests/schema/rls-toutes-tables.test.ts:12`, `tests/schema/fonctions-privileges.test.ts:86`, `tests/schema/fonctions-privileges.test.ts:124` | vert au run 97 | A24 : le journal d’audit sert tout ADMIN. A30 et A31 : hors périmètre, derrière interrupteur |
| §153 | OTP pour les opérations sensibles | fait | `app/api/withdrawals/otp/route.ts` | `tests/parcours/otp-objet.test.ts:77`, `tests/parcours/otp-objet.test.ts:130`, `tests/parcours/finance-retraits.test.ts:325`, `e2e/recette.spec.ts:725` (à prouver) | vert au run 97, le reste à prouver au run après | — |
| §155 | Protection des données | fait | `middleware.ts`, `lib/supabase/server.ts` | `tests/security/r5-lectures-anon.test.ts:12`, `tests/security/r8-controleur-lectures.test.ts:42`, `tests/security/r18-partenaires-public.test.ts:61`, `tests/parcours/notif-admin.test.ts:293` | vert au run 97 | A30 : hors périmètre, service fermé |
| §156 | Traçabilité | fait | `M/20261105000001_lot7_reglages.sql:103`, `M/20261106000005_lot8_scan.sql:21` | `tests/parcours/cycle-transitions.test.ts:579`, `tests/parcours/acces-tracabilite.test.ts:144`, `tests/parcours/finance-reglages.test.ts:159`, `tests/parcours/pilotage-equipe-caisse.test.ts:94` | vert au run 97 | — |
| §157 | Statistiques client | partiel | `app/tickets/page.tsx`, `app/wallet/page.tsx` | `tests/parcours/finance-commissions.test.ts:475` | vert au run 97 | A18 |
| §158 | Statistiques partenaire | partiel | `app/partner/stats/page.tsx`, `components/partner/pilotage/OverviewTab.tsx` | `tests/parcours/pilotage-apercu-ventes.test.ts:76`, `tests/parcours/pilotage-apercu-ventes.test.ts:89` | vert au run 97 | Pilotage assertés par événement ; /partner/stats sans assertion de chiffres |
| §159 | Statistiques des commandes | hors périmètre | — | — | sans objet | — |
| §160 | Tickets, participants, taux de présence | fait | `M/20261102000005_lot5_pilotage.sql:375`, `components/partner/pilotage/OverviewTab.tsx` | `tests/parcours/pilotage-invariant.test.ts:67`, `tests/parcours/pilotage-invariant.test.ts:100`, `tests/parcours/pilotage-entrees.test.ts:68`, `tests/parcours/pilotage-apercu-ventes.test.ts:98`, `e2e/recette.spec.ts:725` (à prouver) | vert au run 97, le reste à prouver au run après | — |
| §161 | Finance : volume, frais, revenus, commissions, retraits | partiel | `M/20261101000008_lot3_rapports.sql:77`, `app/api/admin/metrics/route.ts` | `tests/parcours/finance-hors-plateforme.test.ts:132` | vert au run 97 | Volume et revenu net assertés ; frais, commissions et retraits non |
| §162 | Parrainage : filleuls, apports, commissions, ROI | partiel | `app/api/admin/metrics/route.ts` | — | sans objet | A9 : total des commissions et nombre d’ambassadeurs seulement, sans test |
| §163 | Tableau de bord global | partiel | `app/admin/dashboard/page.tsx` | `tests/parcours/finance-hors-plateforme.test.ts:132` | vert au run 97 | Comme §127 ; parrainage réduit (A9) |

### Parties XX à XXIII : architecture, règles, livrables

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| §2 à §5, §192 | Vision et objectifs | hors périmètre | — | — | sans objet | Pas d’exigence vérifiable |
| §178 | Architecture par espaces | fait | `app/admin/page.tsx`, `app/partner/page.tsx`, `app/controller/layout.tsx` | `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:322` (à prouver), `e2e/recette.spec.ts:615` (à prouver) | vert au run 97, le reste à prouver au run après | Salles, tables, produits : hors périmètre |
| §179 | Parcours client | fait | `lib/payments/checkout.service.ts` | `tests/parcours/acces-qr.test.ts:258`, `tests/parcours/parrainage-lien.test.ts:159`, `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:486` (à prouver), `e2e/recette.spec.ts:615` (à prouver), `e2e/recette.spec.ts:794` (à prouver) | vert au run 97, le reste à prouver au run après | Reçu PDF sans QR : voulu |
| §180 | Parcours partenaire | partiel | `app/partner/register/page.tsx`, `app/partner/events/new/page.tsx` | `e2e/recette.spec.ts:322` (à prouver), `e2e/recette.spec.ts:452` (à prouver), `e2e/recette.spec.ts:725` (à prouver) | à prouver au run après | Essai, page professionnelle, activation de services : hors périmètre |
| §181 | Parcours financier | fait | `M/20261101000003_lot3_moteur.sql:47` | `tests/parcours/finance-moteur.test.ts:153`, `tests/parcours/finance-invariant.test.ts:22` | vert au run 97 | — |
| §182 | Parcours parrainage | fait | `app/api/referrals/my-stats/route.ts`, `M/20261101000006_lot3_commissions.sql:131` | `tests/parcours/parrainage-lien.test.ts:159`, `tests/parcours/finance-commissions.test.ts:256`, `tests/parcours/finance-commissions.test.ts:315`, `tests/parcours/finance-retraits.test.ts:424` | vert au run 97 | — |
| §185 | Règles de parrainage, toutes lignes | partiel | `M/20261101000006_lot3_commissions.sql:49` | `tests/parcours/finance-commissions.test.ts:227` | vert au run 97 | A5 |
| §186, §187 | Règles de commande et de réservation | hors périmètre | — | — | sans objet | — |
| §188 | Web, mobile, back-office, API, base | partiel | `public/manifest.json` | `e2e/installable.spec.ts:109`, `e2e/installable.spec.ts:193` | vert au run 97 | Mobile = application web installable ; aucune application native, sans décision écrite |
| §189 | Documentation | partiel | `docs/guide-organisateur-entrees.md`, `docs/installer-application.md`, `docs/essai-local.md` | — | sans objet | A19 : guide client, guide d’administration |
| §190 | Tests : fonctionnels, sécurité, paiement, QR, charge, compatibilité, mobile, web | partiel | `playwright.config.ts`, `scripts/run-tests.mjs` | `e2e/fumee.spec.ts:91`, `e2e/recette.spec.ts:486` (à prouver) | vert au run 97, le reste à prouver au run après | Charge : derniers lots ; iPhone : aucun test possible ; A21 |
| §191 | Déploiement | hors périmètre | — | — | sans objet | Derniers lots |
| Annexes D et E | Tarifs partenaires, services gratuits ou payants | hors périmètre | — | — | sans objet | — |

## 4. Écarts par décision du client

Ces lignes comptent dans le résumé. Aucun de ces points ne figure au cahier des charges : la colonne de droite donne leur trace écrite. Trois n’ont qu’une seule trace, la consigne du lot 8.

| § | Exigence | Statut | Code | Test | CI | Manque ou remarque |
|---|---|---|---|---|---|---|
| Décision 7.2 | Voix Wolof abandonnée | écarté | `components/scan/ScanResultPanel.tsx` | `tests/parcours/scanner-interface.test.ts:158` | vert au run 97 | Trace : `docs/lot7-rapport.md:132`, D52 (`docs/lot7-rapport.md:3950`), consigne du lot 8 |
| Décision 7.2 | Audio du scanner abandonné, la vibration le remplace | écarté | `lib/hardware/feedback.ts` | `tests/parcours/scanner-interface.test.ts:158`, `e2e/terrain.spec.ts:468` | vert au run 97 | Trace : `docs/lot7-rapport.md:132`, D50 et D52, consigne du lot 8 |
| Consigne 8.3 | Pas de Wallet Apple ou Google (rien à voir avec la page /wallet, portefeuille de parrainage) | écarté | — | — | sans objet | Trace unique : la consigne du lot 8 |
| Consigne 8.3 | Pas de panier multi-événements | écarté | `app/api/checkout/route.ts` | `tests/parcours/finance-affichage.test.ts:96` | vert au run 97 | Trace unique : la consigne du lot 8. §62 ne vise que les produits |
| Consigne 8.3 | Pas de billets à régler sur place | écarté | `lib/scan/scan-result.ts` | — | sans objet | Trace : la consigne du lot 8, question de `docs/lot4-rapport.md:2488`. Code conservé : A16 |

Autres choix écrits, qui s’écartent du cahier des charges :

- carte bancaire retirée : `docs/lot2-rapport.md:28` ;
- email facultatif : lot 1C.8, `docs/lot1c-rapport.md:17` ;
- services associés masqués : tâche 5.9, `docs/lot5-rapport.md:2870` ;
- campagnes en brouillon : décision 43 du lot 6 ;
- taux N2 à 2 % : consigne 8.2 c.

Sans aucune trace écrite : WhatsApp, événements populaires et proches, virement bancaire, application native.

## 5. Anomalies

Gravité : **Élevée** trompe un utilisateur, ou bloque une opération d’argent ou une exigence nommée. **Moyenne** : exigence manquante avec un contournement. **Faible** : finition ou preuve manquante.

État : `corrigée` (test rouge puis correctif), `preuve ajoutée` (le code était juste, le test manquait), `listée` (non corrigée dans ce lot).

| Id | Gravité | Exigence | Constat | État | Référence | Test | CI |
|---|---|---|---|---|---|---|---|
| A1 | Élevée | §98, §133 | Fausse sauvegarde sur la page de parrainage de l’administration. Bouton et modale retirés, mention « La personnalisation des taux n’est pas disponible pour le moment. » | corrigée | `fix(8.3-A1)` 3fa31ed ; `app/admin/referral/page.tsx:157` | `tests/parcours/admin-parrainage.test.ts:229`, `tests/parcours/admin-parrainage.test.ts:239`, `tests/parcours/admin-parrainage.test.ts:250` | vert au run 97 |
| A2 | Élevée | §86 | Lien de parrainage mort. Lien sur l’adresse de l’application, /register lit ref et ouvre les options | corrigée | `fix(8.3-A2s)` b92928e, `fix(8.3-A2e)` 407d09c ; `app/api/referrals/my-stats/route.ts`, `app/register/page.tsx` | `tests/parcours/parrainage-lien.test.ts:122`, `tests/parcours/parrainage-lien.test.ts:159`, `tests/parcours/parrainage-lien.test.ts:227` | vert au run 97 |
| A3 | Élevée | §41, §131 | Relance d’un remboursement bloqué sans écran. Panneau sur les finances de l’administration, double étape, cas incertain sans bouton | corrigée | `fix(8.3-A3s)` 9a92e59, `fix(8.3-A3e)` 2506b89 et 5a6dcbc ; `app/api/admin/refunds/route.ts`, `components/admin/RefundsToRetry.tsx` | `tests/parcours/admin-remboursements.test.ts:180`, `tests/parcours/admin-remboursements.test.ts:350`, `tests/parcours/admin-remboursements.test.ts:467`, `tests/parcours/admin-remboursements.test.ts:479`, `tests/parcours/admin-remboursements.test.ts:498`, `e2e/recette.spec.ts:838` (à prouver) | vert au run 97, le reste à prouver au run après |
| A4 | Élevée | §41, §82 | Remboursement d’un billet sans écran. Recherche par numéro et double confirmation dans l’onglet Ventes | corrigée | `fix(8.3-A4s)` c1eabd6, `fix(8.3-A4e)` 18c69b8 ; `app/api/partner/events/[id]/tickets/lookup/route.ts`, `components/partner/pilotage/TicketRefundPanel.tsx` | `tests/parcours/pilotage-remboursement-billet.test.ts:138`, `tests/parcours/pilotage-remboursement-billet.test.ts:191`, `tests/parcours/pilotage-remboursement-billet.test.ts:235`, `tests/parcours/pilotage-remboursement-billet.test.ts:356`, `tests/parcours/pilotage-remboursement-billet.test.ts:369`, `e2e/recette.spec.ts:725` (à prouver) | vert au run 97, le reste à prouver au run après |
| A5 | Élevée | §87, §88, §96, §97 | Parrainage prestataire absent : Q2 à trancher d’abord | listée | `app/api/auth/register/route.ts` | — | sans objet |
| A6 | Moyenne | §15 | Profil en lecture seule. Changer téléphone ou email touche à l’identité du compte | listée | `app/profile/page.tsx` | — | sans objet |
| A7 | Moyenne | §17 | Événements populaires et proches absents : Q4 | listée | `app/api/events/route.ts` | — | sans objet |
| A8 | Moyenne | §22, §144 | WhatsApp absent, sans décision écrite : Q1 | listée | `lib/notifications/dispatcher.ts` | — | sans objet |
| A9 | Moyenne | §106, §119, §132, §133, §162 | Historique du parrainage incomplet, ROI absent | listée | `app/api/referrals/my-stats/route.ts`, `app/admin/referral/page.tsx` | — | sans objet |
| A10 | Moyenne | §83, §105 | Virement bancaire non traité, réglage fermé par défaut | listée | `docs/lot3-rapport.md:1900` | — | sans objet |
| A11 | Moyenne | §104 | Auto-parrainage et boucles sans test. Preuve ajoutée, verte dès l’écriture | preuve ajoutée | `test(8.3)[garde-fous]` 2769248 ; `tests/parcours/parrainage-gardes.test.ts` | `tests/parcours/parrainage-gardes.test.ts:90`, `tests/parcours/parrainage-gardes.test.ts:128`, `tests/parcours/parrainage-gardes.test.ts:139` | vert au run 97 |
| A12 | Moyenne | §1, §183 | Un client ne devient pas partenaire (D8, D63) | listée | `docs/lot7-rapport.md` | — | sans objet |
| A13 | Moyenne | §134 | Une erreur de lecture du journal d’audit s’affichait comme une liste vide. ErrorState et colonne Utilisateur | corrigée | `fix(8.3-A13)` 404d06a ; `app/admin/audit/page.tsx` | `tests/parcours/admin-audit.test.ts:107`, `tests/parcours/admin-audit.test.ts:180`, `tests/parcours/admin-audit.test.ts:246`, `tests/parcours/admin-audit.test.ts:277` | vert au run 97 |
| A14 | Faible | §16 | q et city de la liste publique sans test. Preuve ajoutée, verte dès l’écriture | preuve ajoutée | `test(8.3)[garde-fous]` 2769248 ; `tests/parcours/decouverte-recherche.test.ts` | `tests/parcours/decouverte-recherche.test.ts:88`, `tests/parcours/decouverte-recherche.test.ts:97`, `tests/parcours/decouverte-recherche.test.ts:111`, `tests/parcours/decouverte-recherche.test.ts:122`, `tests/parcours/decouverte-recherche.test.ts:129` | vert au run 97 |
| A15 | Faible | §32, §33 | Affichage public sans assertion. Assertions ajoutées à l’acte 4, sauf le contact de l’organisateur | preuve ajoutée | `test(8.3b)` f7d8c5d ; `e2e/recette.spec.ts` | `e2e/recette.spec.ts:486` (à prouver) | à prouver au run après |
| A16 | Faible | décision | Code « à régler sur place » conservé, sans émetteur en production | listée | `lib/scan/scan-result.ts:20` | — | sans objet |
| A17 | Faible | §21 | Pas de liste des paiements du client | listée | `app/tickets/page.tsx` | — | sans objet |
| A18 | Faible | §157 | Pas d’écran de statistiques client | listée | `app/wallet/page.tsx` | — | sans objet |
| A19 | Faible | §189 | Guides client et administration absents, pages légales à prévoir | listée | `docs/guide-organisateur-entrees.md` | — | sans objet |
| A20 | Moyenne | outillage | Instabilité de la fumée au run 92 : case forcée hors de l’écran | corrigée | `test(e2e)[run 92]` ef2b36b ; `e2e/fumee.spec.ts` | `e2e/fumee.spec.ts:91` | vert au run 97 |
| A21 | Moyenne | §190 | Suites à la racine de tests/ qui ne prouvent rien : jamais citées ici | listée | `docs/lot0-rapport.md:547` | — | sans objet |
| A22 | Faible | design | Pages d’administration non migrées, hors du contrôle de design | listée | `tests/parcours/design-systeme.test.ts` | — | sans objet |
| A23 | Moyenne | export | Injection de formule dans l’export CSV ; statut technique affiché au refus du PDF ; statut brut à l’annulation | corrigée | `fix(8.3-A23)` 1fa3fe9 ; `lib/partner/partner-dashboard.service.ts`, `app/api/tickets/[id]/pdf/route.ts` | `tests/parcours/legacy-exports-partenaire.test.ts:221`, `tests/parcours/legacy-billet-pdf.test.ts:115` | vert au run 97 |
| A24 | Moyenne | §134, §152 | La route du journal d’audit sert tout ADMIN alors que la RLS réserve le superadmin | listée | `app/api/admin/audit/route.ts:15`, `M/0003_rls.sql:355` | — | sans objet |
| A25 | Faible | §134 | `limit` de cette route non borné | listée | `app/api/admin/audit/route.ts:23` | — | sans objet |
| A26 | Faible | §31 | Fiche partenaire d’un événement : une panne de lecture reste un 404 | listée | `app/api/partner/events/[id]/route.ts` | — | sans objet |
| A27 | Faible | §104 | Le trigger de boucle de parrainage ne couvre pas l’UPDATE par service_role | listée | `M/0011_referral_codes.sql:107` | — | sans objet |
| A28 | Faible | §16 | Écrans de recherche sans q ni city : filtre dans le navigateur, sur la liste déjà chargée. Le serveur sait filtrer (A14) | listée | `app/explore/page.tsx:140` | — | sans objet |
| A29 | Moyenne | §131 | L’alerte d’un remboursement bloqué pour solde insuffisant parlait d’un bénéficiaire incomplet | corrigée | `fix(8.3-A29)` f2334de ; `lib/notifications/catalog.ts` | `tests/parcours/notif-modeles.test.ts:501` | vert au run 97 |
| A30 | Élevée | §152, §155 | GET partner/halls/[id] sans contrôle de rôle ni de propriétaire : réservations et téléphone du partenaire lisibles par tout compte connecté quand le service est ouvert. Hors périmètre, service fermé aujourd’hui | listée | `app/api/partner/halls/[id]/route.ts` | — | sans objet |
| A31 | Moyenne | §152 | GET partner/products/[id] sans contrôle de propriétaire. Hors périmètre, service fermé | listée | `app/api/partner/products/[id]/route.ts` | — | sans objet |
| A32 | Faible | qualité | Panne présentée comme une absence, non journalisée : getEventById, getHallById, getProductById, GET orders/[id] | listée | `lib/events/event.service.ts:291`, `lib/halls/hall.service.ts:124`, `lib/products/product.service.ts:163` | — | sans objet |
| A33 | Moyenne | qualité | Écritures ignorées : admin/permissions POST, partner/register | listée | `app/api/admin/permissions/route.ts`, `app/api/partner/register/route.ts` | — | sans objet |
| A34 | Moyenne | qualité | Lectures ignorées : admin/communications POST, admin/pricing POST, send-otp, verify-otp, admin/users PATCH | listée | `app/api/admin/communications/route.ts`, `app/api/admin/pricing/route.ts`, `app/api/auth/send-otp/route.ts`, `app/api/auth/verify-otp/route.ts`, `app/api/admin/users/route.ts` | — | sans objet |
| A35 | Faible | 8.2 i | Un refus du fournisseur SMS arrivait à l’écran : send-otp recopiait `sendResult.error`. Texte fixe, détail au journal | corrigée | `test(8.3-A35)` 02e331f, `fix(8.3-A35)` 15dc7d0 ; `app/api/auth/send-otp/route.ts` | `tests/parcours/otp-serveur.test.ts:77` (à prouver) | à prouver au run après |
| A36 | Faible | 8.2 i | Le refus de rembourser un billet utilisé montrait le statut technique : `ticket_refund_request` l’écrit, migration gelée, la route met un texte fixe | corrigée | `test(8.3-A36)` ef3e9fa, `fix(8.3-A36)` ffc0167 ; `app/api/partner/events/[id]/tickets/[ticketId]/refund/route.ts`, `M/20261101000005_lot3_remboursements.sql:85` | `tests/parcours/pilotage-remboursement-billet.test.ts:266` (à prouver) | à prouver au run après |
| A37 | Faible | design | Effet de 8.2 s : les barres fixes en bas des pages salles, menu et tables passent sous la navigation mobile. Hors périmètre, derrière interrupteurs | listée | `app/halls/[id]/page.tsx:347`, `app/restaurants/[id]/menu/page.tsx:395`, `app/restaurants/[id]/tables/page.tsx:343` | — | sans objet |
| A38 | Faible | §134 | La route du journal lit `select('*')` sans jointure : la colonne Utilisateur montre un identifiant tronqué | listée | `app/api/admin/audit/route.ts:29`, `app/admin/audit/page.tsx:187` | — | sans objet |
| A39 | Moyenne | §158 | Le PDF de clôture garde « Document comptable certifie » et « Certificat de cloture » | listée | `lib/partner/partner-dashboard.service.ts:1069`, `lib/partner/partner-dashboard.service.ts:1072` | — | sans objet |
| A40 | Faible | outil d’essai | La route de développement ignore le statut du webhook : un webhook en 500 rend ok:true. Message prudent à l’écran | listée | `app/api/dev/samirpay/[action]/route.dev.ts`, `components/dev/FakePaymentPanel.tsx` | — | sans objet |

## 6. Questions au client

| N° | Question |
|---|---|
| Q1 | WhatsApp : faut-il le construire, et pour quels messages ? |
| Q2 | Parrainage prestataire : quelles transactions d’un prestataire comptent ? |
| Q3 | Que recouvre « Wallet » : Apple ou Google Wallet, ou la page Portefeuille ? |
| Q4 | Événements populaires et proches : selon quels critères ? |
| Q5 | Personnalisation des taux par le superadmin : à construire quand ? |
| Q6 | Quels taux après le passage d’un client en Ambassadeur ? |
| Sans numéro | Outil d’invitations : une catégorie sans canal n’est distribuée à personne aujourd’hui. Faut-il un outil pour envoyer des invitations ? |
