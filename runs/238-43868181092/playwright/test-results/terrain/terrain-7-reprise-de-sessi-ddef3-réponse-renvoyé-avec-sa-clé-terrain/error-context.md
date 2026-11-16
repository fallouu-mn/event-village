# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: terrain.spec.ts >> 7. reprise de session : même événement et même mode après une sortie, chiffres et historique relus, « Reprendre le contrôle », scan sans réponse renvoyé avec sa clé
- Location: e2e/terrain.spec.ts:604:5

# Error details

```
Error: [e2e][terrain] scripts/e2e/terrain-setup.ts prepare : code 1
[terrain-setup] Error: [e2e] event_create refusée : {"ok":false,"code":"IMAGE_ORIGIN_INVALID","field":"image_url","message":"L'affiche doit être déposée depuis le formulaire de l'événement."}
    at rpcOk (/home/runner/work/event-village/event-village/e2e/support/service.ts:35:42)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async createPublishedEvent (/home/runner/work/event-village/event-village/e2e/support/service.ts:100:21)
    at async prepare (/home/runner/work/event-village/event-village/scripts/e2e/terrain-setup.ts:172:21)
    at async main (/home/runner/work/event-village/event-village/scripts/e2e/terrain-setup.ts:344:44)


```

# Test source

```ts
  1   | /**
  2   |  * Lot 6 (contrat P3, tâche 6.12) — client service_role du processus Playwright, pour la fumée prolongée
  3   |  * seulement : création du second événement par les RPC (event_create, event_transition), lecture de la
  4   |  * boîte d'envoi. Aucun écran ne l'utilise.
  5   |  *
  6   |  * Garde-fous : `.env.e2e` chargé par e2eConfig(), qui refuse toute URL non locale ; l'URL Supabase est
  7   |  * revérifiée ici (même règle que scripts/e2e/env.mjs:requireLocalUrl) ; la clé vient de `.env.e2e`
  8   |  * (secret aléatoire du run en CI), jamais du code.
  9   |  */
  10  | import { randomInt } from 'node:crypto';
  11  | import { createClient, type SupabaseClient } from '@supabase/supabase-js';
  12  | import { TEST_PASSWORD } from '../../tests/helpers/fixture-data';
  13  | import { e2eConfig, LOCAL_HOSTNAMES } from './env';
  14  | 
  15  | let client: SupabaseClient | null = null;
  16  | 
  17  | export function serviceClient(): SupabaseClient {
  18  |     if (client) return client;
  19  |     const config = e2eConfig();
  20  |     const url = new URL(config.supabaseUrl);
  21  |     if (!LOCAL_HOSTNAMES.has(url.hostname)) {
  22  |         throw new Error(`[e2e] Refus : client service_role vers un hôte non local (${url.hostname}).`);
  23  |     }
  24  |     const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  25  |     if (!key) throw new Error(`[e2e] SUPABASE_SERVICE_ROLE_KEY absente de ${config.envFile} : la fumée prolongée lit la boîte d'envoi par le service_role.`);
  26  |     client = createClient(config.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
  27  |     return client;
  28  | }
  29  | 
  30  | /** RPC `(p jsonb)` attendue `{ ok: true, … }` ; sinon erreur explicite (code et message de la base). */
  31  | export async function rpcOk(fn: string, p: Record<string, unknown>): Promise<Record<string, unknown>> {
  32  |     const { data, error } = await serviceClient().rpc(fn, { p });
  33  |     if (error) throw new Error(`[e2e] ${fn} : ${error.code ?? ''} ${error.message}`);
  34  |     const body = (data ?? null) as Record<string, unknown> | null;
> 35  |     if (!body || body.ok !== true) throw new Error(`[e2e] ${fn} refusée : ${JSON.stringify(data)}`);
      |                                          ^ Error: [e2e][terrain] scripts/e2e/terrain-setup.ts prepare : code 1
  36  |     return body;
  37  | }
  38  | 
  39  | /** Identifiant du compte (public.users) d'une adresse du seed de test. */
  40  | export async function userIdByEmail(email: string): Promise<string> {
  41  |     const { data, error } = await serviceClient().from('users').select('id').eq('email', email).maybeSingle();
  42  |     if (error) throw new Error(`[e2e] compte ${email} : ${error.message}`);
  43  |     if (!data?.id) throw new Error(`[e2e] compte ${email} introuvable (seed:test non abouti ?)`);
  44  |     return String(data.id);
  45  | }
  46  | 
  47  | /**
  48  |  * Lot 9 bis (R87, contrat 7.1 acte 2, T10) : identifiant du compte (public.users) d'un numéro, au format +221… ou 221….
  49  |  * Un compte inscrit à l'écran porte l'adresse technique dans users.email : l'adresse saisie attend sa vérification
  50  |  * (users.email_pending), la lecture se fait donc par le numéro, unique.
  51  |  */
  52  | export async function userIdByPhone(phone: string): Promise<string> {
  53  |     const digits = phone.replace(/^\+/, '');
  54  |     const { data, error } = await serviceClient().from('users').select('id').in('phone', [`+${digits}`, digits]);
  55  |     if (error) throw new Error(`[e2e] compte du numéro ${phone} : ${error.message}`);
  56  |     if ((data ?? []).length !== 1) throw new Error(`[e2e] compte du numéro ${phone} : ${(data ?? []).length} compte(s) au lieu d'un`);
  57  |     return String(data![0].id);
  58  | }
  59  | 
  60  | /**
  61  |  * Lot 9 bis (R57, B35) : saisies récentes du mot de passe d'un compte effacées (table password_confirmations, base
  62  |  * LOCALE) : l'action sensible qui suit demande le mot de passe quelle que soit l'heure de la connexion du rôle
  63  |  * (la connexion par mot de passe compte comme une saisie pendant 10 minutes). Préparation, jamais une route.
  64  |  */
  65  | export async function clearPasswordConfirmations(userId: string): Promise<void> {
  66  |     const { error } = await serviceClient().from('password_confirmations').delete().eq('user_id', userId);
  67  |     if (error) throw new Error(`[e2e] saisies récentes du mot de passe de ${userId} : ${error.message}`);
  68  | }
  69  | 
  70  | export interface PublishedEventInput {
  71  |     partnerUserId: string;
  72  |     superadminId: string;
  73  |     title: string;
  74  |     description: string;
  75  |     /** Jour et heure de Dakar (AAAA-MM-JJ, HH:MM:SS). */
  76  |     startDate: string;
  77  |     startTime: string;
  78  |     endDate: string;
  79  |     endTime: string;
  80  |     location: string;
  81  |     city: string;
  82  |     capacity: number;
  83  |     /** Affiche déjà déposée par le partenaire (chemin vérifié par event_poster_path_ok). */
  84  |     imageUrl: string;
  85  |     /** Finition 2a (3) : position du lieu, obligatoire pour soumettre (défaut : Dakar). */
  86  |     latitude?: number;
  87  |     longitude?: number;
  88  |     /** maxPerOrder : limite par compte (défaut 10 ; contrainte 1 à 50). */
  89  |     category?: PublishedCategoryInput;
  90  |     /** Lot 9 ter (D.3.3, amendement 4 de D) : plusieurs catégories, prioritaires sur `category`. */
  91  |     categories?: PublishedCategoryInput[];
  92  | }
  93  | 
  94  | export interface PublishedCategoryInput { name: string; price: number; total: number; maxPerOrder?: number }
  95  | 
  96  | /** Événement créé par event_create au nom du partenaire, soumis, validé par le SUPERADMIN puis publié. */
  97  | export async function createPublishedEvent(input: PublishedEventInput): Promise<string> {
  98  |     const categories = input.categories ?? (input.category ? [input.category] : []);
  99  |     if (categories.length === 0) throw new Error(`[e2e] createPublishedEvent « ${input.title} » : aucune catégorie`);
  100 |     const created = await rpcOk('event_create', {
  101 |         actor_id: input.partnerUserId,
  102 |         event: {
  103 |             title: input.title,
  104 |             category: 'CONCERT',
  105 |             description: input.description,
  106 |             start_date: input.startDate,
  107 |             start_time: input.startTime,
  108 |             end_date: input.endDate,
  109 |             end_time: input.endTime,
  110 |             location: input.location,
  111 |             city: input.city,
  112 |             capacity: input.capacity,
  113 |             image_url: input.imageUrl,
  114 |             latitude: input.latitude ?? 14.6928,
  115 |             longitude: input.longitude ?? -17.4467,
  116 |         },
  117 |         ticket_categories: categories.map((c) => ({ name: c.name, price: c.price, total_quantity: c.total, max_per_order: c.maxPerOrder ?? 10 })),
  118 |     });
  119 |     const eventId = String(created.event_id ?? '');
  120 |     if (!/^[0-9a-f-]{36}$/.test(eventId)) throw new Error(`[e2e] event_create : identifiant absent (${JSON.stringify(created)})`);
  121 |     await rpcOk('event_transition', { event_id: eventId, actor_id: input.partnerUserId, to_status: 'EN_ATTENTE' });
  122 |     await rpcOk('event_transition', { event_id: eventId, actor_id: input.superadminId, to_status: 'VALIDE' });
  123 |     await rpcOk('event_transition', { event_id: eventId, actor_id: input.partnerUserId, to_status: 'PUBLIE' });
  124 |     return eventId;
  125 | }
  126 | 
  127 | /** Ligne de notification_outbox lue par la fumée (colonnes du contrat C2). */
  128 | export interface OutboxLine {
  129 |     id: string;
  130 |     idempotency_key: string;
  131 |     type: string;
  132 |     channel: 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';
  133 |     status: string;
  134 |     reason: string | null;
  135 |     recipient_user_id: string | null;
```