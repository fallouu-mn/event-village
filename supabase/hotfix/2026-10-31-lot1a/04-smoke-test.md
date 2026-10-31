# Lot 1A — 04 : test de fumée avec la clé anon publique

À lancer **après** `02-hotfix.sql` et `03-verification.sql`, depuis n'importe quel poste. Ces commandes n'utilisent que la clé anon publique (celle du navigateur) : elles reproduisent ce qu'un visiteur anonyme peut tenter. Elles n'écrivent rien si le correctif est en place.

```bash
export SUPABASE_URL="https://<ref-projet>.supabase.co"
export ANON_KEY="<clé anon publique du projet>"
```

## 1. Lecture des codes OTP

```bash
curl -s -o /dev/stdout -w "\nHTTP %{http_code}\n" \
  "$SUPABASE_URL/rest/v1/otp_codes?select=phone,code&limit=3" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

| | Résultat |
|---|---|
| Avant correctif | `HTTP 200` et une liste de numéros avec leurs codes |
| Attendu après | `HTTP 401` et `{"code":"42501", … "message":"permission denied for table otp_codes"}` |

## 2. Insertion d'un billet

Prendre un `event_id` et un `category_id` publics (visibles sur la page d'un événement publié), puis :

```bash
curl -s -o /dev/stdout -w "\nHTTP %{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/tickets" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" -H "Prefer: return=minimal" \
  -d '{"event_id":"<event_id>","category_id":"<category_id>","user_id":"00000000-0000-0000-0000-000000000000","ticket_number":"TCK-SMOKE-1","qr_code":"EV-QR-SMOKE-1","price":0,"status":"VALIDE"}'
```

| | Résultat |
|---|---|
| Avant correctif | refusé pour anon (`user_id = auth.uid()` faux), mais **accepté** avec le jeton d'un compte gratuit dont c'est l'identifiant |
| Attendu après | `HTTP 401` / `403` et `{"code":"42501", … "new row violates row-level security policy for table \"tickets\""}`, y compris avec le jeton d'un compte gratuit |

Pour tester avec un compte gratuit, remplacer `Authorization: Bearer $ANON_KEY` par le jeton obtenu avec :

```bash
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" -d '{"email":"<compte-de-test>","password":"<mot de passe>"}'
```

## 3. Fonctions dangereuses

```bash
curl -s -o /dev/stdout -w "\nHTTP %{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/rpc/validate_and_check_in_ticket" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"p_qr_code":"EV-QR-INEXISTANT","p_controller_id":"00000000-0000-0000-0000-000000000000"}'

curl -s -o /dev/stdout -w "\nHTTP %{http_code}\n" -X POST "$SUPABASE_URL/rest/v1/rpc/exec_sql" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" -d '{}'
```

| | Résultat |
|---|---|
| Avant correctif | `HTTP 200` pour `validate_and_check_in_ticket` (réponse `{"success":false,"error":"Ticket invalide ou inexistant"}`) ; `exec_sql` : selon son existence sur le projet |
| Attendu après | `HTTP 404` et `{"code":"PGRST202", … "Could not find the function …"}` pour les deux |

Si l'une de ces commandes ne donne pas le résultat attendu, ne pas considérer le projet comme corrigé : relancer `03-verification.sql` et transmettre sa sortie.
