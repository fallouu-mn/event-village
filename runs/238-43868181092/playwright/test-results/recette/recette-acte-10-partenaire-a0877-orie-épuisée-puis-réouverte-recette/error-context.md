# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recette.spec.ts >> acte 10 [partenaire] [contrôleur] [client] : grande soirée, deux zones, trois portes, liste des invités, mauvaise zone, double entrée, catégorie épuisée puis réouverte
- Location: e2e/recette.spec.ts:1202:5

# Error details

```
Error: [e2e] event_create refusée : {"ok":false,"code":"IMAGE_ORIGIN_INVALID","field":"image_url","message":"L'affiche doit être déposée depuis le formulaire de l'événement."}
```

# Page snapshot

```yaml
- generic [active] [ref=f5e1]:
  - generic [ref=f5e2]:
    - complementary [ref=f5e3]:
      - link "Event Village, accueil" [ref=f5e5] [cursor=pointer]:
        - /url: /
        - generic [ref=f5e11]:
          - generic [ref=f5e12]: EVENT
          - generic [ref=f5e13]: VILLAGE
      - navigation "Navigation principale" [ref=f5e14]:
        - generic [ref=f5e15]: Administration
        - link "Tableau de bord" [ref=f5e20] [cursor=pointer]:
          - /url: /admin/dashboard
        - generic [ref=f5e27]:
          - paragraph [ref=f5e28]: Gestion
          - generic [ref=f5e29]:
            - link "Événements" [ref=f5e30] [cursor=pointer]:
              - /url: /admin/events
            - link "Utilisateurs" [ref=f5e34] [cursor=pointer]:
              - /url: /admin/users
            - link "Catalogues et services" [ref=f5e41] [cursor=pointer]:
              - /url: /admin/services
        - generic [ref=f5e47]:
          - paragraph [ref=f5e48]: Finances
          - generic [ref=f5e49]:
            - link "Finance" [ref=f5e50] [cursor=pointer]:
              - /url: /admin/finance
            - link "Tarification" [ref=f5e54] [cursor=pointer]:
              - /url: /admin/pricing
        - generic [ref=f5e57]:
          - paragraph [ref=f5e58]: Engagement
          - generic [ref=f5e59]:
            - link "Parrainage" [ref=f5e60] [cursor=pointer]:
              - /url: /admin/referral
            - link "Communications" [ref=f5e65] [cursor=pointer]:
              - /url: /admin/communications
        - generic [ref=f5e70]:
          - paragraph [ref=f5e71]: Système
          - generic [ref=f5e72]:
            - link "Journal d’audit" [ref=f5e73] [cursor=pointer]:
              - /url: /admin/audit
            - link "Notifications" [ref=f5e78] [cursor=pointer]:
              - /url: /admin/notifications
            - link "Scanner" [ref=f5e85] [cursor=pointer]:
              - /url: /scan
        - link "Retour au site" [ref=f5e94] [cursor=pointer]:
          - /url: /
      - generic [ref=f5e99]:
        - link "Elhadji SuperAdmin Super administrateur" [ref=f5e100] [cursor=pointer]:
          - /url: /profile
          - generic [aria-hidden] [ref=f5e101]: ES
          - generic [ref=f5e102]:
            - generic [ref=f5e103]: Elhadji SuperAdmin
            - generic [ref=f5e104]: Super administrateur
        - generic [ref=f5e105]:
          - button "Se déconnecter" [ref=f5e106] [cursor=pointer]
          - button "Basculer le thème" [ref=f5e111] [cursor=pointer]
    - generic [ref=f5e115]:
      - banner [ref=f5e116]:
        - link "Rechercher un événement, un concert, un restaurant…" [ref=f5e118] [cursor=pointer]:
          - /url: /explore
        - button "Notifications, 72 non lues" [ref=f5e125] [cursor=pointer]:
          - generic [ref=f5e129]: "72"
      - main [ref=f5e130]:
        - generic [ref=f5e132]:
          - generic [ref=f5e134]:
            - generic [ref=f5e135]:
              - heading "Tableau de bord" [level=1] [ref=f5e136]
              - paragraph [ref=f5e137]: Dossiers à traiter et vue d’ensemble de la plateforme.
            - generic [ref=f5e138]:
              - status [ref=f5e139]: Mis à jour à 13:57
              - button "Actualiser" [ref=f5e141] [cursor=pointer]
          - region [ref=f5e149]:
            - heading "À traiter" [level=2] [ref=f5e150]
            - generic [ref=f5e151]:
              - generic [ref=f5e152]:
                - generic [ref=f5e153]:
                  - paragraph [ref=f5e155]: Événements à valider
                  - paragraph [ref=f5e161]: "4"
                  - paragraph [ref=f5e162]: Soumis par les organisateurs, en attente de votre examen.
                - link "Ouvrir la file de validation" [ref=f5e163] [cursor=pointer]:
                  - /url: /admin/events
              - generic [ref=f5e168]:
                - generic [ref=f5e169]:
                  - paragraph [ref=f5e171]: Partenaires à valider
                  - paragraph [ref=f5e177]: "0"
                  - paragraph [ref=f5e178]: Inscriptions avec leurs pièces justificatives.
                - link "Voir les candidatures" [ref=f5e179] [cursor=pointer]:
                  - /url: "#partenaires"
          - region [ref=f5e184]:
            - heading "Indicateurs" [level=2] [ref=f5e185]
            - generic [ref=f5e186]:
              - generic [ref=f5e187]:
                - paragraph [ref=f5e189]: Volume des transactions
                - paragraph [ref=f5e194]: 2 029 200 F CFA
                - paragraph [ref=f5e195]: Paiements en ligne encaissés
              - generic [ref=f5e196]:
                - paragraph [ref=f5e198]: Revenu net de la plateforme
                - paragraph [ref=f5e202]: 57 397 F CFA
                - paragraph [ref=f5e203]: Commissions et frais Event Village
              - generic [ref=f5e204]:
                - paragraph [ref=f5e206]: Partenaires validés
                - paragraph [ref=f5e212]: "6"
                - paragraph [ref=f5e213]: sur 7 inscrits
              - generic [ref=f5e214]:
                - paragraph [ref=f5e216]: Utilisateurs inscrits
                - paragraph [ref=f5e223]: "46"
                - paragraph [ref=f5e224]: 0 ambassadeur(s) actif(s)
          - region [ref=f5e225]:
            - generic [ref=f5e226]:
              - heading "Candidatures des partenaires" [level=2] [ref=f5e227]
              - paragraph [ref=f5e228]: Validez ou refusez les organisateurs, restaurants et gestionnaires de salles après examen de leur dossier.
            - tablist "Statut des candidatures" [ref=f5e230]:
              - tab "En attente , 0" [ref=f5e231] [cursor=pointer]:
                - generic [ref=f5e232]: En attente
                - generic [ref=f5e233]:
                  - generic [ref=f5e234]: ","
                  - text: "0"
              - tab "Validés , 6" [ref=f5e235] [cursor=pointer]:
                - generic [ref=f5e236]: Validés
                - generic [ref=f5e237]:
                  - generic [ref=f5e238]: ","
                  - text: "6"
              - tab "Refusés , 0" [ref=f5e239] [cursor=pointer]:
                - generic [ref=f5e240]: Refusés
                - generic [ref=f5e241]:
                  - generic [ref=f5e242]: ","
                  - text: "0"
              - tab "Tous , 7" [selected] [ref=f5e243] [cursor=pointer]:
                - generic [ref=f5e244]: Tous
                - generic [ref=f5e245]:
                  - generic [ref=f5e246]: ","
                  - text: "7"
            - tabpanel "Tous , 7" [ref=f5e247]:
              - table [ref=f5e250]:
                - caption [ref=f5e251]: Candidatures des partenaires
                - rowgroup [ref=f5e252]:
                  - row [ref=f5e253]:
                    - columnheader "Partenaire" [ref=f5e254]
                    - columnheader "Responsable" [ref=f5e255]
                    - columnheader "Statut" [ref=f5e256]
                    - columnheader "Inscrit le" [ref=f5e257]
                    - columnheader "Actions" [ref=f5e258]
                - rowgroup [ref=f5e259]:
                  - row [ref=f5e260]:
                    - cell "Recette Productions 13.56.20 Organisateur" [ref=f5e261]:
                      - generic [ref=f5e262]:
                        - generic [ref=f5e263]: Recette Productions 13.56.20
                        - generic [ref=f5e264]: Organisateur
                    - cell "Mame Recette +221777380973 Dakar" [ref=f5e267]:
                      - generic [ref=f5e268]:
                        - generic [ref=f5e269]: Mame Recette
                        - generic [ref=f5e270]: "+221777380973"
                        - generic [ref=f5e271]: Dakar
                    - cell "Suspendu" [ref=f5e272]
                    - cell [ref=f5e275]:
                      - time [ref=f5e276]: lun. 16 nov. 2026 à 13:56
                    - cell [ref=f5e277]:
                      - button "Dossier" [ref=f5e279] [cursor=pointer]
                  - row [ref=f5e285]:
                    - cell "Teranga Découvertes Organisateur" [ref=f5e286]:
                      - generic [ref=f5e287]:
                        - generic [ref=f5e288]: Teranga Découvertes
                        - generic [ref=f5e289]: Organisateur
                    - cell "Ndèye Gning +221700000109 Rufisque" [ref=f5e292]:
                      - generic [ref=f5e293]:
                        - generic [ref=f5e294]: Ndèye Gning
                        - generic [ref=f5e295]: "+221700000109"
                        - generic [ref=f5e296]: Rufisque
                    - cell "Validé" [ref=f5e297]
                    - cell [ref=f5e300]:
                      - time [ref=f5e301]: lun. 16 nov. 2026 à 13:27
                    - cell [ref=f5e302]:
                      - button "Dossier" [ref=f5e304] [cursor=pointer]
                  - row [ref=f5e310]:
                    - cell "Atelier Petite-Côte Petite-Côte Événements Organisateur" [ref=f5e311]:
                      - generic [ref=f5e312]:
                        - generic [ref=f5e313]: Atelier Petite-Côte
                        - generic [ref=f5e314]: Petite-Côte Événements
                        - generic [ref=f5e315]: Organisateur
                    - cell "Khady Sarr +221700000103 Mbour" [ref=f5e318]:
                      - generic [ref=f5e319]:
                        - generic [ref=f5e320]: Khady Sarr
                        - generic [ref=f5e321]: "+221700000103"
                        - generic [ref=f5e322]: Mbour
                    - cell "Validé" [ref=f5e323]
                    - cell [ref=f5e326]:
                      - time [ref=f5e327]: lun. 16 nov. 2026 à 13:27
                    - cell [ref=f5e328]:
                      - button "Dossier" [ref=f5e330] [cursor=pointer]
                  - row [ref=f5e336]:
                    - cell "Sine-Saloum Culture & Loisirs Saloum Culture Organisateur" [ref=f5e337]:
                      - generic [ref=f5e338]:
                        - generic [ref=f5e339]: Sine-Saloum Culture & Loisirs
                        - generic [ref=f5e340]: Saloum Culture
                        - generic [ref=f5e341]: Organisateur
                    - cell "Ousmane Faye +221700000102 Kaolack" [ref=f5e344]:
                      - generic [ref=f5e345]:
                        - generic [ref=f5e346]: Ousmane Faye
                        - generic [ref=f5e347]: "+221700000102"
                        - generic [ref=f5e348]: Kaolack
                    - cell "Validé" [ref=f5e349]
                    - cell [ref=f5e352]:
                      - time [ref=f5e353]: lun. 16 nov. 2026 à 13:27
                    - cell [ref=f5e354]:
                      - button "Dossier" [ref=f5e356] [cursor=pointer]
                  - row [ref=f5e362]:
                    - cell "Baobab Scène Productions Baobab Scène Organisateur" [ref=f5e363]:
                      - generic [ref=f5e364]:
                        - generic [ref=f5e365]: Baobab Scène Productions
                        - generic [ref=f5e366]: Baobab Scène
                        - generic [ref=f5e367]: Organisateur
                    - cell "Mariama Ndiaye +221700000101 Dakar" [ref=f5e370]:
                      - generic [ref=f5e371]:
                        - generic [ref=f5e372]: Mariama Ndiaye
                        - generic [ref=f5e373]: "+221700000101"
                        - generic [ref=f5e374]: Dakar
                    - cell "Validé" [ref=f5e375]
                    - cell [ref=f5e378]:
                      - time [ref=f5e379]: lun. 16 nov. 2026 à 13:27
                    - cell [ref=f5e380]:
                      - button "Dossier" [ref=f5e382] [cursor=pointer]
                  - row [ref=f5e388]:
                    - cell "TEST Organisateur B Orga B (test) Organisateur" [ref=f5e389]:
                      - generic [ref=f5e390]:
                        - generic [ref=f5e391]: TEST Organisateur B
                        - generic [ref=f5e392]: Orga B (test)
                        - generic [ref=f5e393]: Organisateur
                    - cell "Bassirou OrgaB +221700000004 Thiès" [ref=f5e396]:
                      - generic [ref=f5e397]:
                        - generic [ref=f5e398]: Bassirou OrgaB
                        - generic [ref=f5e399]: "+221700000004"
                        - generic [ref=f5e400]: Thiès
                    - cell "Validé" [ref=f5e401]
                    - cell [ref=f5e404]:
                      - time [ref=f5e405]: lun. 16 nov. 2026 à 13:27
                    - cell [ref=f5e406]:
                      - button "Dossier" [ref=f5e408] [cursor=pointer]
                  - row [ref=f5e414]:
                    - cell "TEST Organisateur A Orga A (test) Organisateur" [ref=f5e415]:
                      - generic [ref=f5e416]:
                        - generic [ref=f5e417]: TEST Organisateur A
                        - generic [ref=f5e418]: Orga A (test)
                        - generic [ref=f5e419]: Organisateur
                    - cell "Aïssatou OrgaA +221700000003 Dakar" [ref=f5e422]:
                      - generic [ref=f5e423]:
                        - generic [ref=f5e424]: Aïssatou OrgaA
                        - generic [ref=f5e425]: "+221700000003"
                        - generic [ref=f5e426]: Dakar
                    - cell "Validé" [ref=f5e427]
                    - cell [ref=f5e430]:
                      - time [ref=f5e431]: lun. 16 nov. 2026 à 13:27
                    - cell [ref=f5e432]:
                      - button "Dossier" [ref=f5e434] [cursor=pointer]
          - region [ref=f5e440]:
            - heading "Raccourcis" [level=2] [ref=f5e441]
            - generic [ref=f5e442]:
              - link "Parrainage et ambassadeurs" [ref=f5e443] [cursor=pointer]:
                - /url: /admin/referral
              - link "Journal d’audit" [ref=f5e449] [cursor=pointer]:
                - /url: /admin/audit
              - link "Catalogues et services" [ref=f5e454] [cursor=pointer]:
                - /url: /admin/services
  - alert [ref=f5e461]
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
      |                                          ^ Error: [e2e] event_create refusée : {"ok":false,"code":"IMAGE_ORIGIN_INVALID","field":"image_url","message":"L'affiche doit être déposée depuis le formulaire de l'événement."}
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