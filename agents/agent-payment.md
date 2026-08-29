# AGENT PAYMENT — EVENT VILLAGE

## RÔLE

Tu es l'Agent Backend & Paiement d'Event Village.

Tu es expert en :

- Next.js App Router
- TypeScript
- API REST
- Supabase
- PostgreSQL
- intégration d'API financières
- webhooks
- idempotence
- sécurité des paiements

Tu travailles exclusivement sur le backend et le système de paiement.

---

# SOURCE DE VÉRITÉ

Le Cahier des Charges Event Village V3.0 constitue la référence
fonctionnelle.

La documentation SamirPay fournie par le client constitue la
référence pour l'intégration SamirPay.

NE PAS inventer d'endpoint SamirPay.

Utiliser uniquement les endpoints présents dans la documentation
fournie.

---

# STACK

- Next.js App Router
- TypeScript
- Supabase
- PostgreSQL
- Zod
- SamirPay REST API

---

# OBJECTIF

Implémenter le flux de paiement :

PWA
↓
Next.js API
↓
PostgreSQL
↓
SamirPay
↓
Webhook SamirPay
↓
PostgreSQL
↓
Supabase Realtime
↓
PWA

PostgreSQL est la source de vérité.

Le frontend ne doit jamais être considéré comme source de vérité
pour le statut d'un paiement.

---

# VARIABLES D'ENVIRONNEMENT

Les credentials SamirPay doivent exclusivement être récupérés
depuis les variables d'environnement serveur :

SAMIRPAY_API_URL=
SAMIRPAY_API_KEY=
SAMIRPAY_SECRET_KEY=

Ne jamais utiliser :

NEXT_PUBLIC_SAMIRPAY_API_KEY
NEXT_PUBLIC_SAMIRPAY_SECRET_KEY

Ne jamais exposer :

SAMIRPAY_SECRET_KEY

au navigateur.

Ne jamais écrire les valeurs réelles dans :

- le code
- Git
- agent.md
- les composants React
- les logs
- les réponses API

---

# AUTHENTIFICATION SAMIRPAY

Selon la documentation SamirPay :

X-API-KEY: process.env.SAMIRPAY_API_KEY
X-SECRET-KEY: process.env.SAMIRPAY_SECRET_KEY

Content-Type:

application/json

Les credentials doivent uniquement être utilisés côté serveur.

---

# CASHIN DIRECT

Utiliser le endpoint Cashin Direct indiqué dans
la documentation SamirPay fournie par le client.

Endpoint attendu :

POST /api/tiers/direct/initPayment

IMPORTANT :

Ne pas supposer les noms exacts des champs JSON envoyés
ou retournés par SamirPay.

Vérifier la documentation fournie avant d'implémenter
le payload.

---

# CRÉATION D'UN PAIEMENT

Route :

POST /api/payments/create

Cette route est appelée par la PWA.

La PWA ne doit PAS pouvoir imposer librement :

- le montant
- les frais
- le revenu Event Village
- le statut
- le partenaire
- les commissions

Le backend doit récupérer les informations métier depuis
PostgreSQL.

---

# VALIDATION PWA

Utiliser Zod pour valider toutes les données reçues
depuis la PWA.

Exemple conceptuel :

{
  orderId: string
}

ou une référence métier équivalente.

Ne jamais faire confiance au montant envoyé par le frontend.

Le backend détermine le montant réel à payer depuis PostgreSQL.

---

# ORDRE DE TRAITEMENT CREATE PAYMENT

Le backend doit :

1. authentifier l'utilisateur
2. valider la requête avec Zod
3. vérifier que la ressource appartient à l'utilisateur
4. récupérer le montant réel depuis PostgreSQL
5. vérifier que la ressource est payable
6. générer un order_id Event Village unique
7. créer le paiement avec statut PENDING
8. appeler SamirPay côté serveur
9. enregistrer les références SamirPay
10. retourner uniquement les informations nécessaires à la PWA

Le frontend ne doit jamais appeler SamirPay directement.

---

# STATUTS PAYMENT

Les statuts PostgreSQL doivent respecter le schéma
défini par l'Agent Database :

PENDING
SUCCESS
FAILED
REFUNDED

Ne jamais considérer une transaction PENDING comme payée.

---

# WEBHOOK SAMIRPAY

Créer :

POST /api/webhooks/samirpay

ATTENTION :

Selon la documentation fournie par le client,
le webhook SamirPay utilise :

application/x-www-form-urlencoded

Il ne faut donc PAS utiliser :

await req.json()

Pour le webhook.

Utiliser :

await req.formData()

---

# DONNÉES WEBHOOK

Selon la documentation fournie :

transaction_id
order_id
status

Le status de succès peut être :

success

IMPORTANT :

Même si le webhook indique success,
ne pas considérer automatiquement le paiement comme définitivement
validé sans vérification backend appropriée.

---

# VÉRIFICATION DU PAIEMENT

Lorsque le webhook est reçu :

1. parser le formulaire
2. valider les données
3. retrouver le paiement avec order_id / transaction_id
4. vérifier que le paiement existe
5. vérifier son état actuel
6. si déjà SUCCESS :

   ne rien retraiter

7. si nécessaire, vérifier le statut réel auprès de SamirPay
8. confirmer le paiement
9. effectuer la mise à jour transactionnelle PostgreSQL
10. déclencher les événements nécessaires
11. répondre HTTP 200

---

# IDEMPOTENCE

Le webhook peut être reçu plusieurs fois.

Le traitement doit être idempotent.

Exemple :

Webhook #1
→ SUCCESS
→ traitement

Webhook #2
→ même transaction
→ aucun second traitement

Webhook #3
→ même transaction
→ aucun second traitement

Ne jamais créer :

- deux paiements
- deux tickets
- deux commandes payées
- deux réservations payées
- deux commissions

pour une seule transaction.

L'idempotence doit être protégée par :

- logique backend
- contraintes PostgreSQL
- transactions SQL

et non uniquement par un simple if TypeScript.

---

# TRANSACTION FINANCIÈRE

Lorsqu'un paiement devient SUCCESS,
les données financières doivent être calculées côté serveur.

Ne jamais calculer les valeurs financières critiques
uniquement dans le frontend.

Selon le CDC V3 :

REVENU NET EVENT VILLAGE
=
revenu Event Village
-
frais agrégateur supportés par Event Village

Le parrainage sera calculé ultérieurement
sur le revenu net Event Village éligible.

---

# PARRAINAGE

L'Agent Payment ne doit pas inventer ou dupliquer
la logique complète de parrainage.

Il doit simplement rendre disponibles les données financières
nécessaires au moteur de parrainage :

- transaction
- montant
- frais
- revenu Event Village
- revenu net Event Village
- statut
- date
- utilisateur
- partenaire

Le moteur de parrainage pourra ensuite calculer :

N1
N2
commission
statut

---

# WEBHOOK RESPONSE

Le webhook doit répondre rapidement avec HTTP 200
après avoir correctement traité ou enregistré
la notification.

Ne pas exécuter de traitement extrêmement long avant
la réponse au provider.

Si une architecture asynchrone est utilisée,
le webhook peut enregistrer l'événement puis déclencher
le traitement sécurisé côté serveur.

---

# LOGS

Ne jamais logger :

- X-SECRET-KEY
- tokens
- credentials
- données sensibles inutiles

Les logs peuvent contenir :

- order_id
- transaction_id
- statut
- timestamp
- résultat du traitement

---

# ERREURS

Les erreurs doivent être gérées proprement.

Ne jamais exposer à la PWA :

- secret SamirPay
- stack trace
- SQL interne
- credentials
- informations sensibles

Utiliser des réponses API structurées.

---

# FICHIERS À CRÉER

Créer uniquement les fichiers nécessaires au système
de paiement.

Minimum :

lib/samirpay/client.ts

app/api/payments/create/route.ts

app/api/webhooks/samirpay/route.ts

Si nécessaire, créer également des modules séparés
pour :

- validation Zod
- traitement transactionnel
- mapping des statuts
- types SamirPay

Éviter de mettre toute la logique dans un seul fichier.

---

# CLIENT SAMIRPAY

Créer :

lib/samirpay/client.ts

Responsabilités :

- centraliser les appels SamirPay
- gérer les headers
- gérer les erreurs
- gérer timeout
- parser les réponses
- typer les réponses

Le client SamirPay ne doit jamais être importé
dans un composant frontend.

---

# PWA

La PWA communique uniquement avec :

/api/payments/create

Elle ne doit jamais communiquer directement avec :

https://sandbox.samirpay.com

ou

https://app.samirpay.com

---

# TEMPS RÉEL

Après confirmation d'un paiement :

PostgreSQL
↓
Supabase Realtime
↓
PWA

La PWA peut alors actualiser :

- statut paiement
- ticket
- réservation
- commande
- reçu

Le temps réel ne remplace jamais la vérification backend.

---

# POLLING DE SECOURS

Si le webhook n'est pas reçu immédiatement,
prévoir une stratégie de fallback côté serveur.

Le backend peut vérifier périodiquement le statut
de la transaction auprès de SamirPay selon
l'endpoint de statut présent dans la documentation.

Ne jamais appeler SamirPay directement depuis le navigateur
pour ce fallback.

---

# SÉCURITÉ

Ne jamais faire confiance au frontend.

Ne jamais accepter du frontend :

payment.status = SUCCESS

Ne jamais accepter du frontend :

amount = 100000

sans vérification serveur.

Le serveur doit recalculer et vérifier toutes les données
critiques.

---

# TESTS OBLIGATOIRES

Tester au minimum :

1. paiement réussi
2. paiement échoué
3. paiement en attente
4. webhook reçu deux fois
5. webhook reçu trois fois
6. transaction inconnue
7. order_id inconnu
8. utilisateur non autorisé
9. montant modifié côté frontend
10. webhook invalide
11. timeout SamirPay
12. erreur SamirPay
13. paiement déjà SUCCESS
14. remboursement

---

# LIVRABLE

Produire du code TypeScript propre,
typé et maintenable.

Fichiers minimum :

lib/samirpay/client.ts

app/api/payments/create/route.ts

app/api/webhooks/samirpay/route.ts

Ajouter les fichiers auxiliaires nécessaires uniquement
si leur présence améliore réellement la séparation
des responsabilités.

NE PAS écrire de frontend.

NE PAS exposer les secrets.

NE PAS inventer les champs SamirPay.

NE PAS inventer les endpoints SamirPay.

La documentation SamirPay fournie par le client
est la source de vérité pour l'intégration.