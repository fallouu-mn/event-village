# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> connexion : organisateur (démonstration)
- Location: e2e/auth.setup.ts:54:10

# Error details

```
Error: [e2e] .e2e-captures/demo-ids.json absent : « npm run seed:demo » n'a pas abouti (journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.
```

# Test source

```ts
  1   | /**
  2   |  * Lot 5.1 — identifiants du seed de démonstration (tests/seed/seed-demo.ts), lus par les specs.
  3   |  * Le fichier est écrit dans `.e2e-captures/` (ignoré par git). Module pur : aucun client Supabase.
  4   |  * Lot 6 (contrat P1) : version 2, avec les lignes de boîte d'envoi de la supervision admin
  5   |  * (`notifications`) et le transfert entrant du client de démonstration (`transfers`).
  6   |  * Lot 7 (contrat 11.1, fix(7.6)) : version 3, avec le partenaire « premiers pas » (`accounts.partenaireNeuf`),
  7   |  * l'événement « la veille » (`events.veille`, début ≈ 20 h après le seed), le billet du client dans la fenêtre
  8   |  * hors ligne (`tickets.clientVeille`), le billet de la saisie manuelle (`tickets.manualLookup`) et les paiements
  9   |  * du client en attente, réussi et échoué (`payments`).
  10  |  * Lot 9 ter (contrat D.3.2, amendement 3 de D ; commit fix(9t.seed)) : version 4, avec le contrôleur de l'événement à zones
  11  |  * (`accounts.controleurZones`), l'événement à zones VALIDE (`events.zones`) et l'événement presque complet
  12  |  * (`events.dernieresPlaces`), ajoutés en fin de liste.
  13  |  */
  14  | import fs from 'node:fs';
  15  | import path from 'node:path';
  16  | 
  17  | export const E2E_OUTPUT_DIR = path.resolve(process.cwd(), '.e2e-captures');
  18  | export const DEMO_IDS_FILE = path.join(E2E_OUTPUT_DIR, 'demo-ids.json');
  19  | export const CAPTURES_DIR = path.join(E2E_OUTPUT_DIR, 'captures');
  20  | export const RESULTS_DIR = path.join(E2E_OUTPUT_DIR, 'results');
  21  | 
  22  | export const DEMO_IDS_VERSION = 4;
  23  | 
  24  | export const DEMO_ACCOUNT_KEYS = [
  25  |     'organisateur', 'organisateur2', 'organisateur3', 'admin', 'client', 'controleur', 'controleur2', 'controleur3',
  26  |     'partenaireNeuf', 'controleurZones',
  27  | ] as const;
  28  | export type DemoAccountKey = typeof DEMO_ACCOUNT_KEYS[number];
  29  | 
  30  | export const DEMO_EVENT_KEYS = [
  31  |     'ceSoir', 'publie', 'publieComplet', 'suspendu', 'annule', 'annuleSansVente', 'termine', 'termine2',
  32  |     'valide', 'enAttente', 'brouillon', 'refuse', 'veille', 'zones', 'dernieresPlaces',
  33  | ] as const;
  34  | export type DemoEventKey = typeof DEMO_EVENT_KEYS[number];
  35  | 
  36  | export interface DemoAccount {
  37  |     email: string;
  38  |     userId: string;
  39  |     firstName: string;
  40  |     lastName: string;
  41  |     partnerId?: string;
  42  | }
  43  | 
  44  | export interface DemoEvent {
  45  |     id: string;
  46  |     title: string;
  47  |     status: string;
  48  |     organizer: DemoAccountKey;
  49  | }
  50  | 
  51  | export interface DemoIds {
  52  |     version: typeof DEMO_IDS_VERSION;
  53  |     generatedAt: string;
  54  |     supabaseUrl: string;
  55  |     accounts: Record<DemoAccountKey, DemoAccount>;
  56  |     events: Record<DemoEventKey, DemoEvent>;
  57  |     /** Tous les événements du seed de démonstration, dans l'ordre de création. */
  58  |     allEvents: DemoEvent[];
  59  |     /**
  60  |      * Lot 7 : `clientVeille` (billet du client sur « la veille », dans la fenêtre hors ligne) et `manualLookup`
  61  |      * (billet jamais présenté de « ce soir », numéro saisi à la main par le contrôleur des captures).
  62  |      */
  63  |     tickets: { clientValide: string; clientUtilise: string; clientVeille: string; manualLookup: { id: string; number: string } };
  64  |     /**
  65  |      * Lot 6 : lignes de notification_outbox de la page admin « Notifications » : FAILED après 5 tentatives
  66  |      * (détail avec « Relancer »), SENT, et journal d'un code à usage unique (le code n'est jamais stocké).
  67  |      */
  68  |     notifications: { failedId: string; sentId: string; otpLogId: string };
  69  |     /** Lot 6 : transfert PENDING vers le numéro vérifié du client de démonstration (onglet « Reçus »). */
  70  |     transfers: { incomingId: string };
  71  |     /** Lot 7 (7.3) : paiements du client, en attente (réservation active), réussi et refusé (pages /paiement/<id>). */
  72  |     payments: { pending: string; success: string; failed: string };
  73  | }
  74  | 
  75  | const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  76  | 
  77  | export function writeDemoIds(ids: DemoIds): void {
  78  |     fs.mkdirSync(E2E_OUTPUT_DIR, { recursive: true });
  79  |     fs.writeFileSync(DEMO_IDS_FILE, `${JSON.stringify(ids, null, 2)}\n`, 'utf8');
  80  | }
  81  | 
  82  | let cached: DemoIds | null = null;
  83  | 
  84  | /** Lit et valide le fichier ; erreur explicite s'il manque (seed de démonstration non abouti). */
  85  | export function readDemoIds(): DemoIds {
  86  |     if (cached) return cached;
  87  |     if (!fs.existsSync(DEMO_IDS_FILE)) {
> 88  |         throw new Error(
      |               ^ Error: [e2e] .e2e-captures/demo-ids.json absent : « npm run seed:demo » n'a pas abouti (journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.
  89  |             `[e2e] ${path.relative(process.cwd(), DEMO_IDS_FILE)} absent : « npm run seed:demo » n'a pas abouti ` +
  90  |             '(journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.',
  91  |         );
  92  |     }
  93  |     const parsed = JSON.parse(fs.readFileSync(DEMO_IDS_FILE, 'utf8')) as Partial<DemoIds>;
  94  |     if (parsed.version !== DEMO_IDS_VERSION) {
  95  |         throw new Error(`[e2e] demo-ids.json : version ${String(parsed.version)} au lieu de ${DEMO_IDS_VERSION} (relancez seed:demo).`);
  96  |     }
  97  |     const missing = [
  98  |         ...DEMO_ACCOUNT_KEYS.filter((k) => !parsed.accounts?.[k]?.email).map((k) => `accounts.${k}`),
  99  |         ...DEMO_EVENT_KEYS.filter((k) => !parsed.events?.[k]?.id).map((k) => `events.${k}`),
  100 |         ...(['failedId', 'sentId', 'otpLogId'] as const)
  101 |             .filter((k) => !UUID_RE.test(String(parsed.notifications?.[k] ?? ''))).map((k) => `notifications.${k}`),
  102 |         ...(UUID_RE.test(String(parsed.transfers?.incomingId ?? '')) ? [] : ['transfers.incomingId']),
  103 |         ...(['clientValide', 'clientUtilise', 'clientVeille'] as const)
  104 |             .filter((k) => !UUID_RE.test(String(parsed.tickets?.[k] ?? ''))).map((k) => `tickets.${k}`),
  105 |         ...(UUID_RE.test(String(parsed.tickets?.manualLookup?.id ?? '')) && /^TCK-/.test(String(parsed.tickets?.manualLookup?.number ?? ''))
  106 |             ? [] : ['tickets.manualLookup']),
  107 |         ...(['pending', 'success', 'failed'] as const)
  108 |             .filter((k) => !UUID_RE.test(String(parsed.payments?.[k] ?? ''))).map((k) => `payments.${k}`),
  109 |         ...(parsed.accounts?.partenaireNeuf?.partnerId ? [] : ['accounts.partenaireNeuf.partnerId']),
  110 |     ];
  111 |     if (missing.length > 0) throw new Error(`[e2e] demo-ids.json incomplet : ${missing.join(', ')}.`);
  112 |     cached = parsed as DemoIds;
  113 |     return cached;
  114 | }
  115 | 
```