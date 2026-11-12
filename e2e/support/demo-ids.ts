/**
 * Lot 5.1 — identifiants du seed de démonstration (tests/seed/seed-demo.ts), lus par les specs.
 * Le fichier est écrit dans `.e2e-captures/` (ignoré par git). Module pur : aucun client Supabase.
 * Lot 6 (contrat P1) : version 2, avec les lignes de boîte d'envoi de la supervision admin
 * (`notifications`) et le transfert entrant du client de démonstration (`transfers`).
 * Lot 7 (contrat 11.1, fix(7.6)) : version 3, avec le partenaire « premiers pas » (`accounts.partenaireNeuf`),
 * l'événement « la veille » (`events.veille`, début ≈ 20 h après le seed), le billet du client dans la fenêtre
 * hors ligne (`tickets.clientVeille`), le billet de la saisie manuelle (`tickets.manualLookup`) et les paiements
 * du client en attente, réussi et échoué (`payments`).
 * Lot 9 ter (contrat D.3.2, amendement 3 de D ; commit fix(9t.seed)) : version 4, avec le contrôleur de l'événement à zones
 * (`accounts.controleurZones`), l'événement à zones VALIDE (`events.zones`) et l'événement presque complet
 * (`events.dernieresPlaces`), ajoutés en fin de liste.
 */
import fs from 'node:fs';
import path from 'node:path';

export const E2E_OUTPUT_DIR = path.resolve(process.cwd(), '.e2e-captures');
export const DEMO_IDS_FILE = path.join(E2E_OUTPUT_DIR, 'demo-ids.json');
export const CAPTURES_DIR = path.join(E2E_OUTPUT_DIR, 'captures');
export const RESULTS_DIR = path.join(E2E_OUTPUT_DIR, 'results');

export const DEMO_IDS_VERSION = 4;

export const DEMO_ACCOUNT_KEYS = [
    'organisateur', 'organisateur2', 'organisateur3', 'admin', 'client', 'controleur', 'controleur2', 'controleur3',
    'partenaireNeuf', 'controleurZones',
] as const;
export type DemoAccountKey = typeof DEMO_ACCOUNT_KEYS[number];

export const DEMO_EVENT_KEYS = [
    'ceSoir', 'publie', 'publieComplet', 'suspendu', 'annule', 'annuleSansVente', 'termine', 'termine2',
    'valide', 'enAttente', 'brouillon', 'refuse', 'veille', 'zones', 'dernieresPlaces',
] as const;
export type DemoEventKey = typeof DEMO_EVENT_KEYS[number];

export interface DemoAccount {
    email: string;
    userId: string;
    firstName: string;
    lastName: string;
    partnerId?: string;
}

export interface DemoEvent {
    id: string;
    title: string;
    status: string;
    organizer: DemoAccountKey;
}

export interface DemoIds {
    version: typeof DEMO_IDS_VERSION;
    generatedAt: string;
    supabaseUrl: string;
    accounts: Record<DemoAccountKey, DemoAccount>;
    events: Record<DemoEventKey, DemoEvent>;
    /** Tous les événements du seed de démonstration, dans l'ordre de création. */
    allEvents: DemoEvent[];
    /**
     * Lot 7 : `clientVeille` (billet du client sur « la veille », dans la fenêtre hors ligne) et `manualLookup`
     * (billet jamais présenté de « ce soir », numéro saisi à la main par le contrôleur des captures).
     */
    tickets: { clientValide: string; clientUtilise: string; clientVeille: string; manualLookup: { id: string; number: string } };
    /**
     * Lot 6 : lignes de notification_outbox de la page admin « Notifications » : FAILED après 5 tentatives
     * (détail avec « Relancer »), SENT, et journal d'un code à usage unique (le code n'est jamais stocké).
     */
    notifications: { failedId: string; sentId: string; otpLogId: string };
    /** Lot 6 : transfert PENDING vers le numéro vérifié du client de démonstration (onglet « Reçus »). */
    transfers: { incomingId: string };
    /** Lot 7 (7.3) : paiements du client, en attente (réservation active), réussi et refusé (pages /paiement/<id>). */
    payments: { pending: string; success: string; failed: string };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function writeDemoIds(ids: DemoIds): void {
    fs.mkdirSync(E2E_OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(DEMO_IDS_FILE, `${JSON.stringify(ids, null, 2)}\n`, 'utf8');
}

let cached: DemoIds | null = null;

/** Lit et valide le fichier ; erreur explicite s'il manque (seed de démonstration non abouti). */
export function readDemoIds(): DemoIds {
    if (cached) return cached;
    if (!fs.existsSync(DEMO_IDS_FILE)) {
        throw new Error(
            `[e2e] ${path.relative(process.cwd(), DEMO_IDS_FILE)} absent : « npm run seed:demo » n'a pas abouti ` +
            '(journal e2e-seed.log). Les écrans qui dépendent des données de démonstration ne peuvent pas être capturés.',
        );
    }
    const parsed = JSON.parse(fs.readFileSync(DEMO_IDS_FILE, 'utf8')) as Partial<DemoIds>;
    if (parsed.version !== DEMO_IDS_VERSION) {
        throw new Error(`[e2e] demo-ids.json : version ${String(parsed.version)} au lieu de ${DEMO_IDS_VERSION} (relancez seed:demo).`);
    }
    const missing = [
        ...DEMO_ACCOUNT_KEYS.filter((k) => !parsed.accounts?.[k]?.email).map((k) => `accounts.${k}`),
        ...DEMO_EVENT_KEYS.filter((k) => !parsed.events?.[k]?.id).map((k) => `events.${k}`),
        ...(['failedId', 'sentId', 'otpLogId'] as const)
            .filter((k) => !UUID_RE.test(String(parsed.notifications?.[k] ?? ''))).map((k) => `notifications.${k}`),
        ...(UUID_RE.test(String(parsed.transfers?.incomingId ?? '')) ? [] : ['transfers.incomingId']),
        ...(['clientValide', 'clientUtilise', 'clientVeille'] as const)
            .filter((k) => !UUID_RE.test(String(parsed.tickets?.[k] ?? ''))).map((k) => `tickets.${k}`),
        ...(UUID_RE.test(String(parsed.tickets?.manualLookup?.id ?? '')) && /^TCK-/.test(String(parsed.tickets?.manualLookup?.number ?? ''))
            ? [] : ['tickets.manualLookup']),
        ...(['pending', 'success', 'failed'] as const)
            .filter((k) => !UUID_RE.test(String(parsed.payments?.[k] ?? ''))).map((k) => `payments.${k}`),
        ...(parsed.accounts?.partenaireNeuf?.partnerId ? [] : ['accounts.partenaireNeuf.partnerId']),
    ];
    if (missing.length > 0) throw new Error(`[e2e] demo-ids.json incomplet : ${missing.join(', ')}.`);
    cached = parsed as DemoIds;
    return cached;
}
