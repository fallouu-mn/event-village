/**
 * SEED DE DÉMONSTRATION (lot 5, tâche 5.1) — données réalistes et FICTIVES pour les captures d'écran
 * et la relecture des écrans du lot. Instance Supabase LOCALE uniquement (garde-fou tests/helpers/env.ts).
 *
 *   EV_ENV_FILE=.env.e2e npm run seed:demo      (CI : après supabase db reset et seed:test)
 *
 * Écrit pour la base CIBLE du contrat du lot 5 (scratchpad lot5-design.md, section P) :
 *  - les statuts passent exclusivement par event_transition et event_cancel (D4, D6) et par
 *    events_finish_overdue (D7) ; aucun UPDATE de events.status ;
 *  - ventes par le service de checkout (checkout_create_payment) et confirmation par la
 *    réconciliation (payment_confirm), avec le faux SamirPay en mémoire ;
 *  - entrées par ticket_scan (code dynamique calculé comme la route),
 *    caisses par shift_open, ventes au guichet par counter_sale (C7),
 *    clôtures par la route POST /api/controller/shifts/close (C2), incidents par la route
 *    POST /api/controller/scan/incidents (C8), remboursements par event_cancel puis le module de
 *    cashout (versé, en cours, en vérification).
 * Seules écritures directes : comptes, profils, partenaires, affectations, événements créés en
 * BROUILLON et leurs catégories (D2 : INSERT toléré), désactivation d'une catégorie après sa
 * prévente, commande « à régler sur place », et horodatages déplacés (ventes sur 10 jours, entrées
 * réparties, événements passés : contrat S, dates déplacées par UPDATE de colonnes de date).
 *
 * Tant que le lot 5 n'est pas livré, le seed s'arrête au contrôle préalable avec la liste des
 * objets manquants : c'est attendu. Il écrit .e2e-captures/demo-ids.json (ignoré par git), puis
 * vérifie les invariants (a) à (l) (tests/helpers/lifecycle-invariants.ts).
 *
 * Lot 6 (contrat P2, tâche 6.12), toujours par les RPC et l'envoyeur réel (adaptateurs faux en mémoire) :
 * préférence du client (rappels par SMS coupés : SKIPPED PREFERENCE_DISABLED), numéro du client vérifié et
 * transfert PENDING vers lui (onglet « Reçus »), rappels J-1 planifiés par horloge simulée (à venir pour un
 * événement publié : PENDING futur ; pour l'événement ensuite suspendu : CANCELLED dans la transaction de
 * la suspension), journal d'un code à usage unique (sans le code), une ligne FAILED après 5 tentatives
 * (failNext) et une UNCERTAIN (uncertainNext), puis passage de l'envoyeur qui remplit les cloches (SENT,
 * SKIPPED avec motif) ; deux notifications du client marquées lues ; notifications.read et
 * notifications.write à l'ADMIN de démonstration. Fin par assertNotificationInvariants('seed-demo')
 * ((a) à (o)) ; demo-ids.json en version 2.
 *
 * Lot 7 (contrat 11.1 et 13 T24, tâche 7.6 ; commit fix(7.6)) :
 *  - schéma du lot 7 exigé au contrôle préalable (missingTerrainSchema : versions du secret, téléchargements hors
 *    ligne, colonnes ticket_scans.secret_version et client_key, triggers de rotation) ;
 *  - ticket_scan appelé comme la route (contrat 3.3) : version du secret lue avec le secret du billet
 *    (`secret_version`) et clé d'idempotence par lecture (`client_key`, D39) ;
 *  - jamais deux paiements PENDING d'un même acheteur sur un même événement (garde M6, PAYMENT_PENDING) : les
 *    deux réservations en cours de « ce soir » sont tenues par deux acheteurs distincts ;
 *  - événement « veille » (début ≈ 20 h) avec un billet du client : billet dans la fenêtre hors ligne (− 24 h) ;
 *  - paiements du client en attente, réussi et échoué (pages /paiement/<id> des captures) ;
 *  - partenaire « premiers pas » : VALIDE, période d'essai, aucun événement, fiche sans logo (première utilisation) ;
 *  - permission communications.manage à l'administrateur (page des campagnes) ;
 *  - billet « à saisir à la main » (non composté) pour la saisie manuelle des captures ;
 *  - fin par assertTerrainInvariants('seed-demo') ((a) à (q)) ; demo-ids.json en version 3.
 *
 * Lot 8 (contrat T31, L80 ; commit fix(8.0-seed), après la migration des canaux) :
 *  - catégories écrites par sale_online et sale_counter (is_visible en est le miroir, posé par trigger) ; schéma du lot 8
 *    exigé au contrôle préalable ;
 *  - sur « ce soir » : « Carré presse » vendue au guichet seulement (une vente au guichet, décision de vente figée) et
 *    une catégorie sans aucun canal (noCounter, 10 places, aucune distribution) ;
 *  - payOnSiteTickets écrit ses billets en direct, canal ONLINE par défaut de la colonne : il refuse une catégorie non
 *    vendue en ligne, que l'invariant (t1) signalerait ;
 *  - billet de la saisie manuelle exigé payant, VALIDE et payé en ligne : la capture du remboursement unitaire le recherche ;
 *  - fin par assertRecetteInvariants('seed-demo') ((a) à (t)).
 *
 * Lot 9 (AR6, T29 ; commit fix(9-seed), après les migrations du lot) : fin par assertLot9Invariants('seed-demo'), qui
 * enchaîne (a) à (t), le schéma du lot, puis (t)(u)(v).
 *
 * Toutes les personnes, entreprises, lieux et numéros sont inventés (le dépôt est public).
 */
import '../helpers/env';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium, type Browser } from '@playwright/test';
import { NextRequest } from 'next/server';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { resetServerEnvCache } from '../../lib/env';
import { startTicketCheckout } from '../../lib/payments/checkout.service';
import { loadPayment, reconcilePayment } from '../../lib/payments/confirmation.service';
import { CashoutService } from '../../lib/payments/cashout.service';
import { ShiftService } from '../../lib/shifts/shift.service';
import { buildTicketPayload, generateTicketCode, parseTicketPayload, verifyTicketCode } from '../../lib/security/totp';
import { dispatchNotifications } from '../../lib/notifications/dispatcher';
import { scheduleReminders } from '../../lib/notifications/reminders';
import { getFakes } from '../fakes';
import { inspect } from '../helpers/db';
import { TEST_PASSWORD } from '../helpers/fixture-data';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { missingRecetteSchema } from '../helpers/recette-invariants';
import { missingTerrainSchema } from '../helpers/terrain-invariants';
import { DEMO_IDS_FILE, DEMO_IDS_VERSION, writeDemoIds, type DemoAccount, type DemoAccountKey, type DemoEvent, type DemoEventKey, type DemoIds } from '../../e2e/support/demo-ids';
import { dakarDateLabel, logoHtml, posterHtml, POSTER_SIZE, renderPng, type PALETTES, type PosterMotif } from '../../e2e/support/poster';

if (process.env.EV_TEST_GUARD !== '1') {
    throw new Error('seed-demo : garde-fou de test non chargé (tests/helpers/env.ts).');
}

// Réglages propres à ce processus (jamais à l'application) : réservations « en cours de paiement »
// encore actives pendant les captures, et quotas d'achat par compte non limitants pour le seed.
process.env.PAYMENT_HOLD_MINUTES = '240';
process.env.CHECKOUT_PER_USER_15MIN = '1000';
process.env.CHECKOUT_PER_USER_DAY = '10000';
process.env.SMS_PER_PHONE_DAY = '1000';
process.env.SMS_PER_ACCOUNT_DAY = '1000';
process.env.SMS_GLOBAL_DAILY_CAP = '100000';
resetServerEnvCache();

const service = getServiceRoleClient();
const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL);
const BUCKET = 'public-images';
const BASE_URL = 'http://127.0.0.1:3000';
const started = Date.now();
const NOW = new Date();

// ── Outils ───────────────────────────────────────────────────────────────────

function log(message: string): void {
    console.log(`[seed-demo] ${message}`);
}

type DbError = { message: string; code?: string; details?: string | null; hint?: string | null } | null | undefined;

function fail(step: string, error: DbError | string): never {
    if (typeof error === 'string') throw new Error(`[seed-demo] ${step} : ${error}`);
    const parts = [error?.message || 'erreur inconnue'];
    if (error?.code) parts.push(`code=${error.code}`);
    if (error?.details) parts.push(`details=${error.details}`);
    if (error?.hint) parts.push(`hint=${error.hint}`);
    throw new Error(`[seed-demo] ${step} : ${parts.join(' | ')}`);
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même jeu de données à chaque run. */
function prng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = prng(20261102);
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const between = (min: number, max: number): number => min + Math.floor(rand() * (max - min + 1));

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Africa/Dakar = UTC+0 toute l'année : la date et l'heure locales sont celles d'UTC. */
function dakarParts(d: Date): { date: string; time: string } {
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}

function dayAt(daysFromNow: number, hh: number, mm = 0): Date {
    const d = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate() + daysFromNow, hh, mm, 0));
    return d;
}

function slugify(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
}

async function importModule(relPath: string): Promise<Record<string, unknown>> {
    const target = relPath;
    return import(target) as Promise<Record<string, unknown>>;
}

// ── Contrôle préalable : base au niveau du contrat du lot 5 ──────────────────

const LOT5_FUNCTIONS: Array<[string, string]> = [
    ['event_transition', 'D4 — transitions de statut'],
    ['event_cancel', 'D6 — annulation transactionnelle'],
    ['events_finish_overdue', 'D7 — passage automatique à TERMINE'],
    ['event_actions', 'D5 — actions possibles'],
    ['shift_close', 'C2 — clôture de caisse transactionnelle'],
    ['pilotage_compute_overview', 'I — chiffres du pilotage (invariant l)'],
    ['pilotage_compute_cash', 'I — caisses du pilotage (invariant l)'],
];
const EXISTING_FUNCTIONS = ['checkout_create_payment', 'payment_confirm', 'ticket_scan', 'shift_open', 'counter_sale', 'refund_request'];
const LOT5_TABLES: Array<[string, string]> = [
    ['event_status_history', 'D1 — journal des statuts'],
    ['event_status_transitions', 'D1 — table des transitions'],
    ['scan_incidents', 'C8 — incidents de scan'],
    ['public_event_state', 'O1 — résumé public'],
];
const LOT5_FILES: Array<[string, string]> = [
    ['tests/helpers/lifecycle-invariants.ts', 'K — invariants (j)(k)(l)'],
    ['app/api/controller/scan/incidents/route.ts', 'C8 — déclaration des incidents par l’appareil'],
];
/** Lot 7 : partenaire « premiers pas » (VALIDE, aucun événement), pour la première utilisation (E5). */
const NEW_PARTNER_COMPANY = 'Teranga Découvertes';
const ORGANIZER_COMPANIES = ['Baobab Scène Productions', 'Sine-Saloum Culture & Loisirs', 'Atelier Petite-Côte', NEW_PARTNER_COMPANY];

async function preflight(): Promise<void> {
    const missing: string[] = [];
    const found = await inspect(async (db) => {
        const fns = await db.query<{ proname: string }>(
            `SELECT DISTINCT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`,
            [[...LOT5_FUNCTIONS.map(([f]) => f), ...EXISTING_FUNCTIONS]]);
        const tables = await db.query<{ table_name: string }>(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
            [LOT5_TABLES.map(([t]) => t)]);
        const channel = await db.query<{ n: number }>(
            `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'sale_channel'`);
        const bucket = await db.query<{ public: boolean }>(`SELECT public FROM storage.buckets WHERE id = $1`, [BUCKET]);
        const already = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.partners WHERE company_name = ANY($1::text[])`, [ORGANIZER_COMPANIES]);
        return {
            functions: new Set(fns.rows.map((r) => r.proname)),
            tables: new Set(tables.rows.map((r) => r.table_name)),
            saleChannel: channel.rows[0].n > 0,
            bucket: bucket.rows[0] ?? null,
            already: already.rows[0].n,
        };
    });
    for (const [fn, why] of LOT5_FUNCTIONS) if (!found.functions.has(fn)) missing.push(`fonction public.${fn}(jsonb) — ${why}`);
    for (const fn of EXISTING_FUNCTIONS) if (!found.functions.has(fn)) missing.push(`fonction public.${fn} (lots 2 à 4)`);
    for (const [t, why] of LOT5_TABLES) if (!found.tables.has(t)) missing.push(`table public.${t} — ${why}`);
    if (!found.saleChannel) missing.push('colonne tickets.sale_channel — C7 (vente au guichet = entrée immédiate)');
    if (!found.bucket) missing.push(`bucket de stockage « ${BUCKET} » créé par migration — F1`);
    else if (!found.bucket.public) missing.push(`bucket « ${BUCKET} » non public — F1`);
    for (const [file, why] of LOT5_FILES) if (!fs.existsSync(path.resolve(process.cwd(), file))) missing.push(`fichier ${file} — ${why}`);
    // Lot 7 (M4, M5) : versions du secret et téléchargements hors ligne, sans lesquels (p)(q) ne se vérifient pas
    for (const object of await missingTerrainSchema()) missing.push(`${object} — lot 7 (M4, M5 : invariants (p)(q))`);
    // Lot 8 (T31) : canaux de vente et décision figée, sans lesquels ce seed n'écrit rien et (r)(s)(t) ne se vérifient pas
    for (const object of await missingRecetteSchema()) missing.push(`${object} — lot 8 (invariants (r)(s)(t))`);
    if (missing.length > 0) {
        throw new Error(
            '[seed-demo] la base locale n’a pas les objets du contrat cible (lots 5, 7 et 8).\n'
            + missing.map((m) => `  - ${m}`).join('\n')
            + '\nLe seed de démonstration ne fait passer les statuts que par les RPC du lot 5 : aucune écriture directe de events.status, aucun repli.',
        );
    }
    if (found.already > 0) {
        throw new Error('[seed-demo] les organisateurs de démonstration existent déjà : le seed s’exécute sur une base neuve (supabase db reset, puis seed:test, puis seed:demo).');
    }
}

// ── Comptes ──────────────────────────────────────────────────────────────────

interface Person { firstName: string; lastName: string; phone: string; email: string }
interface Account extends Person { userId: string; accessToken: string | null }

const PEOPLE: Record<DemoAccountKey, Person & { roles: string[]; primaryRole: string }> = {
    organisateur: { firstName: 'Mariama', lastName: 'Ndiaye', phone: '+221700000101', email: 'mariama.ndiaye@demo.eventvillage.local', roles: ['CLIENT', 'PARTENAIRE'], primaryRole: 'PARTENAIRE' },
    organisateur2: { firstName: 'Ousmane', lastName: 'Faye', phone: '+221700000102', email: 'ousmane.faye@demo.eventvillage.local', roles: ['CLIENT', 'PARTENAIRE'], primaryRole: 'PARTENAIRE' },
    organisateur3: { firstName: 'Khady', lastName: 'Sarr', phone: '+221700000103', email: 'khady.sarr@demo.eventvillage.local', roles: ['CLIENT', 'PARTENAIRE'], primaryRole: 'PARTENAIRE' },
    admin: { firstName: 'Aïda', lastName: 'Diallo', phone: '+221700000104', email: 'aida.diallo@demo.eventvillage.local', roles: ['CLIENT', 'ADMIN'], primaryRole: 'ADMIN' },
    client: { firstName: 'Fatou', lastName: 'Mbaye', phone: '+221700000105', email: 'fatou.mbaye@demo.eventvillage.local', roles: ['CLIENT'], primaryRole: 'CLIENT' },
    controleur: { firstName: 'Ibrahima', lastName: 'Gueye', phone: '+221700000106', email: 'ibrahima.gueye@demo.eventvillage.local', roles: ['CLIENT', 'CONTROLEUR'], primaryRole: 'CONTROLEUR' },
    controleur2: { firstName: 'Seynabou', lastName: 'Ba', phone: '+221700000107', email: 'seynabou.ba@demo.eventvillage.local', roles: ['CLIENT', 'CONTROLEUR'], primaryRole: 'CONTROLEUR' },
    controleur3: { firstName: 'Lamine', lastName: 'Cissé', phone: '+221700000108', email: 'lamine.cisse@demo.eventvillage.local', roles: ['CLIENT', 'CONTROLEUR'], primaryRole: 'CONTROLEUR' },
    partenaireNeuf: { firstName: 'Ndèye', lastName: 'Gning', phone: '+221700000109', email: 'ndeye.gning@demo.eventvillage.local', roles: ['CLIENT', 'PARTENAIRE'], primaryRole: 'PARTENAIRE' },
};

const BUYER_FIRST = ['Awa', 'Moussa', 'Aminata', 'Cheikh', 'Ndeye', 'Babacar', 'Mame', 'Alioune', 'Coumba', 'Pape', 'Rokhaya', 'Adama',
    'Fatoumata', 'Mamadou', 'Astou', 'Ibou', 'Yacine', 'Modou', 'Bineta', 'Saliou', 'Dieynaba', 'Omar', 'Marième', 'Assane'];
const BUYER_LAST = ['Diop', 'Fall', 'Sow', 'Gaye', 'Thiam', 'Diouf', 'Kane', 'Sy', 'Ka', 'Mbengue', 'Niang', 'Diagne', 'Camara', 'Touré',
    'Sène', 'Lo', 'Dieng', 'Badji', 'Ndour', 'Kébé', 'Tall', 'Sarr', 'Ndao', 'Mboup'];

function buyerPeople(): Person[] {
    return BUYER_FIRST.map((first, i) => {
        const last = BUYER_LAST[(i * 7) % BUYER_LAST.length];
        const n = String(i + 1).padStart(2, '0');
        return {
            firstName: first,
            lastName: last,
            phone: `+2217000002${n}`,
            email: `${slugify(first)}.${slugify(last)}.${n}@demo.eventvillage.local`,
        };
    });
}

async function signIn(email: string): Promise<string> {
    const anon = createClient(SUPABASE_URL, String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (error || !data.session) fail(`connexion de ${email}`, error ?? 'session absente');
    return data.session.access_token;
}

async function createAccount(p: Person, roles: string[], primaryRole: string, withToken: boolean): Promise<Account> {
    const { data, error } = await service.auth.admin.createUser({
        email: p.email, password: TEST_PASSWORD, email_confirm: true, phone: p.phone, phone_confirm: true,
        user_metadata: { first_name: p.firstName, last_name: p.lastName, phone: p.phone, is_demo_fixture: true },
    });
    if (error || !data.user) fail(`compte ${p.email}`, error ?? 'utilisateur absent');
    const userId = data.user.id;
    const { error: profileErr } = await service.from('users').upsert({
        id: userId, first_name: p.firstName, last_name: p.lastName, phone: p.phone, email: p.email, role: primaryRole,
        status: 'ACTIF', referral_status: 'STANDARD', updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    if (profileErr) fail(`profil ${p.email}`, profileErr);
    const { error: rolesErr } = await service.from('user_roles').upsert(roles.map((role) => ({ user_id: userId, role })), { onConflict: 'user_id,role' });
    if (rolesErr) fail(`rôles ${p.email}`, rolesErr);
    return { ...p, userId, accessToken: withToken ? await signIn(p.email) : null };
}

// ── Partenaires ──────────────────────────────────────────────────────────────

interface OrganizerSpec { key: 'organisateur' | 'organisateur2' | 'organisateur3'; company: string; commercial: string; city: string; address: string; description: string; initials: string; palette: keyof typeof PALETTES }

const ORGANIZERS: OrganizerSpec[] = [
    { key: 'organisateur', company: ORGANIZER_COMPANIES[0], commercial: 'Baobab Scène', city: 'Dakar', address: '14, rue des Fromagers, Dakar-Plateau', initials: 'BS', palette: 'terre',
        description: 'Concerts, soirées et croisières musicales à Dakar depuis 2016.' },
    { key: 'organisateur2', company: ORGANIZER_COMPANIES[1], commercial: 'Saloum Culture', city: 'Kaolack', address: '3, avenue du Marché, Kaolack', initials: 'SC', palette: 'savane',
        description: 'Festivals, galas et rencontres culturelles dans le bassin du Saloum.' },
    { key: 'organisateur3', company: ORGANIZER_COMPANIES[2], commercial: 'Petite-Côte Événements', city: 'Mbour', address: '27, route de la Plage, Saly', initials: 'PC', palette: 'lagune',
        description: 'Marchés, carnavals et soirées sur la Petite-Côte.' },
];

async function upload(objectPath: string, png: Buffer): Promise<string> {
    const { error } = await service.storage.from(BUCKET).upload(objectPath, png, { contentType: 'image/png', upsert: true });
    if (error) fail(`téléversement ${objectPath}`, error);
    const url = service.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
    if (!url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`)) fail(`URL publique ${objectPath}`, `origine inattendue : ${url}`);
    return url;
}

async function createPartner(spec: OrganizerSpec, owner: Account, browser: Browser): Promise<string> {
    const { data: plan, error: planErr } = await service.from('subscription_plans').select('id').eq('code', 'STARTER').maybeSingle();
    if (planErr) fail('subscription_plans.STARTER', planErr);
    const { data, error } = await service.from('partners').insert({
        user_id: owner.userId, company_name: spec.company, commercial_name: spec.commercial, description: spec.description,
        address: spec.address, city: spec.city, phone: owner.phone, email: owner.email, is_verified: true, status: 'VALIDE',
        subscription_plan_id: plan?.id ?? null, trial_started_at: new Date(NOW.getTime() - 90 * 86_400_000).toISOString(),
        trial_ends_at: new Date(NOW.getTime() + 60 * 86_400_000).toISOString(),
    }).select('id').single();
    if (error || !data) fail(`partenaire ${spec.company}`, error);
    const partnerId = data.id as string;
    const { error: actErr } = await service.from('partner_activities').upsert({ partner_id: partnerId, activity_type: 'ORGANISATEUR', is_active: true }, { onConflict: 'partner_id,activity_type' });
    if (actErr) fail(`activité ${spec.company}`, actErr);
    const logo = await upload(`partners/${partnerId}/logo.png`, await renderPng(browser, logoHtml(spec.initials, spec.palette), { width: 256, height: 256 }, true));
    const { error: logoErr } = await service.from('partners').update({ logo_url: logo }).eq('id', partnerId);
    if (logoErr) fail(`logo ${spec.company}`, logoErr);
    return partnerId;
}

/**
 * Lot 7 (E5, première utilisation) : partenaire VALIDE en période d'essai (essai posé ici : la page ne relance
 * pas l'activation pendant les captures), sans aucun événement et sans logo (étape « profil » encore à faire).
 */
async function createNewPartner(owner: Account): Promise<string> {
    const { data: plan, error: planErr } = await service.from('subscription_plans').select('id').eq('code', 'STARTER').maybeSingle();
    if (planErr) fail('subscription_plans.STARTER', planErr);
    const { data, error } = await service.from('partners').insert({
        user_id: owner.userId, company_name: NEW_PARTNER_COMPANY, commercial_name: 'Teranga Découvertes',
        description: 'Visites guidées et soirées découverte du patrimoine de Rufisque.',
        address: '8, rue du Port, Rufisque', city: 'Rufisque', phone: owner.phone, email: owner.email, is_verified: true, status: 'VALIDE',
        subscription_plan_id: plan?.id ?? null, trial_started_at: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
        trial_ends_at: new Date(NOW.getTime() + 88 * 86_400_000).toISOString(),
    }).select('id').single();
    if (error || !data) fail(`partenaire ${NEW_PARTNER_COMPANY}`, error);
    const partnerId = data.id as string;
    const { error: actErr } = await service.from('partner_activities').upsert({ partner_id: partnerId, activity_type: 'ORGANISATEUR', is_active: true }, { onConflict: 'partner_id,activity_type' });
    if (actErr) fail(`activité ${NEW_PARTNER_COMPANY}`, actErr);
    return partnerId;
}

// ── Événements ───────────────────────────────────────────────────────────────

type Lifecycle = 'BROUILLON' | 'EN_ATTENTE' | 'REFUSE' | 'VALIDE' | 'PUBLIE' | 'SUSPENDU' | 'ANNULE' | 'ANNULE_SANS_VENTE' | 'TERMINE';
type EventCategory = 'CONCERT' | 'FESTIVAL' | 'FOOD' | 'SALLE';
const CATEGORY_LABEL: Record<EventCategory, string> = { CONCERT: 'Concert', FESTIVAL: 'Festival', FOOD: 'Gastronomie', SALLE: 'Soirée & réception' };

/** hidden : non vendue en ligne (sale_online faux) ; noCounter : non vendue au guichet (sale_counter faux). Les deux : aucun canal. */
interface CategorySeed { name: string; price: number; total: number; description: string; hidden?: boolean; noCounter?: boolean; inactive?: boolean; deactivateAfterSales?: boolean; maxPerOrder?: number }
interface SaleSeed { category: string; qty: number }

interface EventSeed {
    key: DemoEventKey | null;
    organizer: OrganizerSpec['key'];
    title: string;
    category: EventCategory;
    venue: string;
    city: string;
    lat: number;
    lng: number;
    start: Date;
    hours: number;
    capacity: number;
    palette: keyof typeof PALETTES;
    motif: PosterMotif;
    description: string;
    program: Array<{ time: string; kind: 'ARTISTE' | 'INTERVENANT' | 'ACTIVITE'; title: string; participant?: string }>;
    categories: CategorySeed[];
    lifecycle: Lifecycle;
    sales: SaleSeed[];
    /** Événement terminé : jours dans le passé et heure de début (Dakar) où ses dates sont déplacées. */
    pastDays?: number;
    pastStartHour?: number;
    reason?: string;
}

const soon = (minutes: number) => {
    const d = new Date(NOW.getTime() + minutes * 60_000);
    d.setUTCSeconds(0, 0);
    d.setUTCMinutes(Math.ceil(d.getUTCMinutes() / 15) * 15);
    return d;
};

const S = (category: string, qty: number): SaleSeed => ({ category, qty });
function sales(list: Array<[string, number[]]>): SaleSeed[] {
    return list.flatMap(([category, quantities]) => quantities.map((q) => S(category, q)));
}

const EVENTS: EventSeed[] = [
    {
        key: 'ceSoir', organizer: 'organisateur', title: 'Nuit du Sabar — édition d’automne', category: 'CONCERT',
        venue: 'Esplanade de la Corniche Ouest', city: 'Dakar', lat: 14.6833, lng: -17.4676, start: soon(45), hours: 5, capacity: 300,
        palette: 'terre', motif: 'soleil',
        description: 'Une nuit entière de sabar avec quatre troupes de percussionnistes et danseurs, en plein air face à l’océan. Restauration sur place, accès aux personnes à mobilité réduite par l’entrée principale.',
        program: [
            { time: '19:30', kind: 'ACTIVITE', title: 'Ouverture des portes' },
            { time: '20:30', kind: 'ARTISTE', title: 'Première partie', participant: 'Troupe Kër Gëstu' },
            { time: '22:00', kind: 'ARTISTE', title: 'Grand cercle de sabar', participant: 'Ensemble Ndawrabine des Parcelles' },
            { time: '23:30', kind: 'ACTIVITE', title: 'Bœuf final avec le public' },
        ],
        categories: [
            { name: 'Prévente', price: 3000, total: 40, description: 'Tarif réduit, vente close.', deactivateAfterSales: true },
            { name: 'Standard', price: 5000, total: 180, description: 'Accès à l’esplanade.' },
            { name: 'VIP', price: 15000, total: 50, description: 'Carré assis, entrée dédiée, une boisson offerte.' },
            { name: 'Carré presse', price: 10000, total: 10, description: 'Réservé aux médias accrédités.', hidden: true },
            { name: 'Invités de la production', price: 0, total: 10, description: 'Places réservées aux invités de l’organisateur.', hidden: true, noCounter: true },
        ],
        lifecycle: 'PUBLIE',
        sales: sales([['Prévente', [2, 1, 2, 1, 1, 2, 2, 1, 1, 2, 1, 2, 1, 2, 1]], ['Standard', [1, 2, 3, 1, 2, 1, 1, 2, 2, 1, 4, 1, 2, 1, 1, 3, 2, 1, 2, 1]], ['VIP', [2, 1, 1, 2, 1]]]),
    },
    {
        // Lot 7 (contrat 11.1) : « la veille » — début ≈ 20 h après le seed, billet du client dans la fenêtre
        // de téléchargement hors ligne (début − 24 h) ; access.scan_window_before_hours n'est pas modifié.
        key: 'veille', organizer: 'organisateur', title: 'Concert des Lumières de Gorée', category: 'CONCERT',
        venue: 'Place du Gouvernement', city: 'Gorée', lat: 14.6670, lng: -17.3980, start: soon(20 * 60), hours: 4, capacity: 250,
        palette: 'nuit', motif: 'etoiles',
        description: 'Concert acoustique sur la place de l’île, chaloupe de 18 h depuis Dakar. Billet présenté sur téléphone, même sans réseau.',
        program: [
            { time: '18:30', kind: 'ACTIVITE', title: 'Accueil sur la place' },
            { time: '19:30', kind: 'ARTISTE', title: 'Récital', participant: 'Ensemble Lumières de l’Île' },
        ],
        categories: [
            { name: 'Entrée', price: 6000, total: 200, description: 'Placement libre sur la place.' },
            { name: 'Premier rang', price: 12000, total: 30, description: 'Chaises des premiers rangs.' },
        ],
        lifecycle: 'PUBLIE',
        sales: sales([['Entrée', [2, 1, 3, 1]], ['Premier rang', [1, 2]]]),
    },
    {
        key: 'publie', organizer: 'organisateur', title: 'Festival Jazz sur le Fleuve', category: 'FESTIVAL',
        venue: 'Quai des Pêcheurs', city: 'Saint-Louis', lat: 16.0179, lng: -16.4896, start: dayAt(12, 18), hours: 6, capacity: 400,
        palette: 'ocean', motif: 'vagues',
        description: 'Deux soirées de jazz au bord du fleuve : quartets, big band du conservatoire et jam session de clôture.',
        program: [
            { time: '18:00', kind: 'ACTIVITE', title: 'Accueil et marché des créateurs' },
            { time: '19:30', kind: 'ARTISTE', title: 'Quartet d’ouverture', participant: 'Quartet Langue de Barbarie' },
            { time: '21:30', kind: 'ARTISTE', title: 'Big band', participant: 'Big band du conservatoire régional' },
        ],
        categories: [
            { name: 'Pass soirée', price: 7500, total: 250, description: 'Une soirée au choix.' },
            { name: 'Pass deux soirs', price: 12000, total: 120, description: 'Les deux soirées.' },
        ],
        lifecycle: 'PUBLIE',
        sales: sales([['Pass soirée', [2, 1, 1, 2, 3, 1, 2, 1]], ['Pass deux soirs', [1, 2, 1, 1, 2, 1]]]),
    },
    {
        key: 'publieComplet', organizer: 'organisateur2', title: 'Gala des entrepreneurs du Saloum', category: 'SALLE',
        venue: 'Salle des Palétuviers', city: 'Kaolack', lat: 14.1652, lng: -16.0758, start: dayAt(21, 19, 30), hours: 5, capacity: 200,
        palette: 'nuit', motif: 'etoiles',
        description: 'Dîner de gala et remise des trophées de l’entrepreneuriat local. Tenue de soirée souhaitée.',
        program: [
            { time: '19:30', kind: 'ACTIVITE', title: 'Cocktail d’accueil' },
            { time: '20:30', kind: 'INTERVENANT', title: 'Discours d’ouverture', participant: 'Chambre des métiers (représentant)' },
            { time: '21:30', kind: 'ACTIVITE', title: 'Remise des trophées' },
        ],
        categories: [
            { name: 'Table de 8', price: 80000, total: 6, description: 'Table réservée pour huit convives.', maxPerOrder: 2 },
            { name: 'Entrée individuelle', price: 10000, total: 100, description: 'Place assise, dîner compris.' },
        ],
        lifecycle: 'PUBLIE',
        sales: sales([['Table de 8', [2, 1, 2, 1]], ['Entrée individuelle', [1, 2, 1, 2, 2]]]),
    },
    {
        key: null, organizer: 'organisateur3', title: 'Marché gourmand de la Petite-Côte', category: 'FOOD',
        venue: 'Place du Marché Central', city: 'Mbour', lat: 14.4198, lng: -16.9634, start: dayAt(5, 10), hours: 8, capacity: 500,
        palette: 'sable', motif: 'damier',
        description: 'Producteurs, cuisinières et pâtissiers de la côte réunis pour une journée de dégustation.',
        program: [
            { time: '10:00', kind: 'ACTIVITE', title: 'Ouverture du marché' },
            { time: '12:30', kind: 'ACTIVITE', title: 'Atelier dégustation de produits de la mer' },
            { time: '16:00', kind: 'ACTIVITE', title: 'Concours de pâtisserie' },
        ],
        categories: [
            { name: 'Entrée', price: 1000, total: 400, description: 'Accès au marché.' },
            { name: 'Atelier dégustation', price: 5000, total: 20, description: 'Places limitées.' },
        ],
        lifecycle: 'PUBLIE',
        sales: sales([['Entrée', [2, 3, 1, 4]], ['Atelier dégustation', [2, 2, 1, 2, 2, 1, 2, 1]]]),
    },
    {
        key: null, organizer: 'organisateur3', title: 'Carnaval des enfants de Saly', category: 'FESTIVAL',
        venue: 'Promenade des Filaos', city: 'Saly', lat: 14.4473, lng: -17.0113, start: dayAt(30, 15), hours: 4, capacity: 600,
        palette: 'bissap', motif: 'bandes',
        description: 'Défilé costumé, maquillage et spectacles pour les enfants des écoles de la commune.',
        program: [{ time: '15:00', kind: 'ACTIVITE', title: 'Départ du défilé' }, { time: '17:00', kind: 'ARTISTE', title: 'Spectacle de marionnettes', participant: 'Compagnie Les Petits Filaos' }],
        categories: [
            { name: 'Enfant', price: 2000, total: 400, description: 'Moins de 12 ans.' },
            { name: 'Adulte', price: 3000, total: 200, description: 'Accompagnateur.' },
        ],
        lifecycle: 'PUBLIE',
        sales: sales([['Enfant', [3, 2]], ['Adulte', [1]]]),
    },
    {
        key: null, organizer: 'organisateur2', title: 'Dîner-spectacle au bord du Saloum', category: 'SALLE',
        venue: 'Terrasse des Pirogues', city: 'Foundiougne', lat: 14.1333, lng: -16.4667, start: dayAt(8, 20), hours: 4, capacity: 80,
        palette: 'lagune', motif: 'vagues',
        description: 'Dîner de produits du fleuve suivi d’un spectacle de chants traditionnels sur la terrasse.',
        program: [{ time: '20:00', kind: 'ACTIVITE', title: 'Dîner' }, { time: '21:30', kind: 'ARTISTE', title: 'Chants du Saloum', participant: 'Chœur des Îles' }],
        categories: [{ name: 'Formule dîner', price: 25000, total: 80, description: 'Dîner et spectacle.' }],
        lifecycle: 'PUBLIE',
        sales: sales([['Formule dîner', [2, 2, 1, 1]]]),
    },
    {
        key: null, organizer: 'organisateur', title: 'Soirée Kora & Lumières', category: 'CONCERT',
        venue: 'Jardin de la Maison des Arts', city: 'Dakar', lat: 14.6928, lng: -17.4467, start: dayAt(17, 20, 30), hours: 3, capacity: 150,
        palette: 'indigo', motif: 'etoiles',
        description: 'Concert acoustique de kora sous les lampions du jardin. Placement libre.',
        program: [{ time: '20:30', kind: 'ARTISTE', title: 'Récital de kora', participant: 'Duo Cordes du Baobab' }],
        categories: [
            { name: 'Standard', price: 6000, total: 120, description: 'Placement libre.' },
            { name: 'Premium', price: 12000, total: 30, description: 'Premiers rangs.' },
            { name: 'Prévente', price: 4000, total: 30, description: 'Prévente terminée.', inactive: true },
            { name: 'Accès coulisses', price: 20000, total: 5, description: 'Sur invitation de l’organisateur.', hidden: true },
        ],
        lifecycle: 'PUBLIE',
        sales: sales([['Standard', [2, 1]], ['Premium', [1, 1]]]),
    },
    {
        key: null, organizer: 'organisateur3', title: 'Festival des rythmes de Casamance', category: 'FESTIVAL',
        venue: 'Esplanade du Port', city: 'Ziguinchor', lat: 12.5833, lng: -16.2719, start: dayAt(26, 17), hours: 7, capacity: 800,
        palette: 'savane', motif: 'bandes',
        description: 'Trois scènes, ateliers de percussions et village artisanal au bord du fleuve Casamance.',
        program: [{ time: '17:00', kind: 'ACTIVITE', title: 'Ateliers de percussions' }, { time: '20:00', kind: 'ARTISTE', title: 'Scène principale', participant: 'Orchestre Kassa Rythmes' }],
        categories: [
            { name: 'Pass journée', price: 5000, total: 600, description: 'Une journée.' },
            { name: 'Pass festival', price: 12000, total: 200, description: 'Trois jours.' },
        ],
        lifecycle: 'PUBLIE',
        sales: sales([['Pass journée', [2, 1]], ['Pass festival', [1]]]),
    },
    {
        key: 'suspendu', organizer: 'organisateur2', title: 'Rencontres du conte et de la parole', category: 'FESTIVAL',
        venue: 'Cour de l’ancienne gare', city: 'Kaolack', lat: 14.1468, lng: -16.0726, start: dayAt(9, 16), hours: 5, capacity: 250,
        palette: 'sable', motif: 'soleil',
        description: 'Conteurs et griots de toute la région pour un après-midi de récits et de chants.',
        program: [{ time: '16:00', kind: 'INTERVENANT', title: 'Contes pour les enfants', participant: 'Conteuse invitée' }, { time: '19:00', kind: 'ARTISTE', title: 'Veillée de la parole' }],
        categories: [{ name: 'Entrée', price: 3000, total: 200, description: 'Accès à toutes les séances.' }],
        lifecycle: 'SUSPENDU',
        sales: sales([['Entrée', [2, 1, 1, 2]]]),
        reason: 'Autorisation de la mairie en cours de renouvellement : reprise des ventes dès réception de l’arrêté.',
    },
    {
        key: 'annule', organizer: 'organisateur', title: 'Croisière musicale vers Gorée', category: 'CONCERT',
        venue: 'Embarcadère du port de Dakar', city: 'Dakar', lat: 14.6730, lng: -17.4298, start: dayAt(18, 17, 30), hours: 3, capacity: 120,
        palette: 'ocean', motif: 'vagues',
        description: 'Concert sur le pont d’une chaloupe, aller-retour vers l’île au coucher du soleil.',
        program: [{ time: '17:30', kind: 'ACTIVITE', title: 'Embarquement' }, { time: '18:15', kind: 'ARTISTE', title: 'Concert au large', participant: 'Trio Teranga Swing' }],
        categories: [
            { name: 'Pont supérieur', price: 15000, total: 60, description: 'Places en terrasse.' },
            { name: 'Pont inférieur', price: 9000, total: 60, description: 'Places abritées.' },
        ],
        lifecycle: 'ANNULE',
        sales: sales([['Pont supérieur', [2, 1, 1, 2]], ['Pont inférieur', [1, 2, 1, 1]]]),
        reason: 'La chaloupe prévue n’a pas obtenu son certificat de navigation à temps. Tous les billets payés en ligne sont remboursés automatiquement, sans démarche de votre part.',
    },
    {
        key: 'annuleSansVente', organizer: 'organisateur3', title: 'Conférence numérique et jeunesse', category: 'SALLE',
        venue: 'Centre culturel de Mbour', city: 'Mbour', lat: 14.4167, lng: -16.9667, start: dayAt(14, 9, 30), hours: 6, capacity: 150,
        palette: 'indigo', motif: 'damier',
        description: 'Journée de tables rondes sur les métiers du numérique pour les lycéens et étudiants.',
        program: [{ time: '09:30', kind: 'INTERVENANT', title: 'Table ronde d’ouverture' }],
        categories: [{ name: 'Participation', price: 2000, total: 150, description: 'Déjeuner compris.' }],
        lifecycle: 'ANNULE_SANS_VENTE',
        sales: [],
        reason: 'Les intervenants principaux ne sont plus disponibles à cette date ; une nouvelle édition sera annoncée.',
    },
    {
        key: 'termine', organizer: 'organisateur', title: 'Brunch électro des Almadies', category: 'CONCERT',
        venue: 'Rooftop de la Pointe des Almadies', city: 'Dakar', lat: 14.7444, lng: -17.5136, start: soon(60), hours: 5, capacity: 80,
        palette: 'bissap', motif: 'bandes',
        description: 'Brunch en terrasse et sets électro de l’après-midi au coucher du soleil.',
        program: [{ time: '12:00', kind: 'ACTIVITE', title: 'Brunch' }, { time: '14:00', kind: 'ARTISTE', title: 'Sets électro', participant: 'Collectif Almadies Sound' }],
        categories: [{ name: 'Brunch', price: 15000, total: 80, description: 'Brunch et accès à la terrasse.' }],
        lifecycle: 'TERMINE', pastDays: 4, pastStartHour: 12,
        sales: sales([['Brunch', [2, 1, 2, 1, 1, 2]]]),
    },
    {
        key: 'termine2', organizer: 'organisateur2', title: 'Tournoi de lutte des quartiers', category: 'FESTIVAL',
        venue: 'Arène municipale', city: 'Kaolack', lat: 14.1510, lng: -16.0800, start: soon(60), hours: 4, capacity: 300,
        palette: 'terre', motif: 'damier',
        description: 'Finales du tournoi inter-quartiers avec animation musicale et tambours.',
        program: [{ time: '16:00', kind: 'ACTIVITE', title: 'Combats de qualification' }, { time: '18:30', kind: 'ACTIVITE', title: 'Finale' }],
        categories: [{ name: 'Tribune', price: 2000, total: 300, description: 'Placement libre en tribune.' }],
        lifecycle: 'TERMINE', pastDays: 11, pastStartHour: 16,
        sales: sales([['Tribune', [3, 2, 1, 2, 2, 1, 1]]]),
    },
    {
        key: 'valide', organizer: 'organisateur3', title: 'Soirée salsa du vendredi', category: 'CONCERT',
        venue: 'Club de la Plage', city: 'Saly', lat: 14.4500, lng: -17.0170, start: dayAt(10, 21), hours: 4, capacity: 150,
        palette: 'bissap', motif: 'soleil',
        description: 'Initiation à 21 h puis soirée dansante avec orchestre.',
        program: [{ time: '21:00', kind: 'ACTIVITE', title: 'Initiation' }, { time: '22:30', kind: 'ARTISTE', title: 'Orchestre', participant: 'Salsa Mbour Social Club' }],
        categories: [{ name: 'Entrée', price: 4000, total: 150, description: 'Une boisson comprise.' }],
        lifecycle: 'VALIDE', sales: [],
    },
    {
        key: 'enAttente', organizer: 'organisateur2', title: 'Festival des musiques du Saloum', category: 'FESTIVAL',
        venue: 'Parc de la Promenade', city: 'Kaolack', lat: 14.1440, lng: -16.0660, start: dayAt(33, 17), hours: 7, capacity: 1000,
        palette: 'savane', motif: 'soleil',
        description: 'Deux jours de concerts gratuits pour les moins de douze ans, scène jeunes talents et village associatif.',
        program: [
            { time: '17:00', kind: 'ARTISTE', title: 'Scène jeunes talents' },
            { time: '20:00', kind: 'ARTISTE', title: 'Tête d’affiche', participant: 'Orchestre du Sine' },
        ],
        categories: [
            { name: 'Pass journée', price: 3000, total: 800, description: 'Une journée.' },
            { name: 'Pass deux jours', price: 5000, total: 200, description: 'Les deux journées.' },
        ],
        lifecycle: 'EN_ATTENTE', sales: [],
    },
    {
        key: null, organizer: 'organisateur2', title: 'Atelier cuisine du thiéboudienne', category: 'FOOD',
        venue: 'Maison des Saveurs', city: 'Kaolack', lat: 14.1500, lng: -16.0700, start: dayAt(16, 10), hours: 4, capacity: 20,
        palette: 'sable', motif: 'damier',
        description: 'Atelier de cuisine en petit groupe, repas partagé à la fin de la séance.',
        program: [{ time: '10:00', kind: 'ACTIVITE', title: 'Atelier' }],
        categories: [{ name: 'Atelier', price: 15000, total: 20, description: 'Ingrédients fournis.' }],
        lifecycle: 'EN_ATTENTE', sales: [],
    },
    {
        key: null, organizer: 'organisateur3', title: 'Exposition-vente de l’artisanat de Thiès', category: 'SALLE',
        venue: 'Halle du Marché Moderne', city: 'Thiès', lat: 14.7910, lng: -16.9359, start: dayAt(19, 9), hours: 9, capacity: 500,
        palette: 'terre', motif: 'bandes',
        description: 'Tisserands, vanniers et potiers de la région exposent et vendent leurs créations.',
        program: [{ time: '09:00', kind: 'ACTIVITE', title: 'Ouverture' }],
        categories: [{ name: 'Entrée', price: 1000, total: 500, description: 'Accès à l’exposition.' }],
        lifecycle: 'EN_ATTENTE', sales: [],
    },
    {
        key: null, organizer: 'organisateur', title: 'Matinée gospel et chorales', category: 'CONCERT',
        venue: 'Théâtre de verdure de Sicap', city: 'Dakar', lat: 14.7090, lng: -17.4560, start: dayAt(24, 10), hours: 3, capacity: 300,
        palette: 'indigo', motif: 'etoiles',
        description: 'Chorales de quartier réunies pour une matinée de chants.',
        program: [{ time: '10:00', kind: 'ARTISTE', title: 'Chorales invitées' }],
        categories: [{ name: 'Entrée', price: 3000, total: 300, description: 'Placement libre.' }],
        lifecycle: 'EN_ATTENTE', sales: [],
    },
    {
        key: 'brouillon', organizer: 'organisateur', title: 'Concert acoustique au jardin', category: 'CONCERT',
        venue: 'Jardin de la Maison des Arts', city: 'Dakar', lat: 14.6928, lng: -17.4467, start: dayAt(40, 19), hours: 3, capacity: 100,
        palette: 'lagune', motif: 'soleil',
        description: 'Brouillon en préparation : programmation à confirmer.',
        program: [{ time: '19:00', kind: 'ARTISTE', title: 'Programmation à confirmer' }],
        categories: [{ name: 'Entrée', price: 5000, total: 100, description: 'Placement libre.' }],
        lifecycle: 'BROUILLON', sales: [],
    },
    {
        key: 'refuse', organizer: 'organisateur2', title: 'Nuit du cinéma en plein air', category: 'FESTIVAL',
        venue: 'Terrain de la Médina', city: 'Kaolack', lat: 14.1400, lng: -16.0800, start: dayAt(28, 20), hours: 4, capacity: 300,
        palette: 'nuit', motif: 'etoiles',
        description: 'Projection de trois courts-métrages sénégalais sur écran géant.',
        program: [{ time: '20:00', kind: 'ACTIVITE', title: 'Projection' }],
        categories: [{ name: 'Entrée', price: 1500, total: 300, description: 'Chaises fournies.' }],
        lifecycle: 'REFUSE', sales: [],
        reason: 'L’affiche ne mentionne ni la date ni le lieu : merci de la compléter avant une nouvelle soumission.',
    },
];

/** Début affiché (affiche, rapport) : la date finale, passée pour un événement terminé. */
function finalStart(seed: EventSeed): Date {
    return seed.lifecycle === 'TERMINE' ? dayAt(-(seed.pastDays ?? 3), seed.pastStartHour ?? 16) : seed.start;
}

interface CreatedEvent { seed: EventSeed; id: string; partnerId: string; ownerId: string; categories: Record<string, { id: string; price: number }> }

async function createEvent(seed: EventSeed, partnerId: string, ownerId: string, organizerName: string, browser: Browser): Promise<CreatedEvent> {
    const slug = `demo-${slugify(seed.title)}`;
    const end = new Date(seed.start.getTime() + seed.hours * 3600_000);
    const s = dakarParts(seed.start);
    const e = dakarParts(end);
    const poster = await renderPng(browser, posterHtml({
        title: seed.title, kicker: CATEGORY_LABEL[seed.category], dateLabel: dakarDateLabel(finalStart(seed)), venue: seed.venue,
        city: seed.city, organizer: organizerName, palette: seed.palette, motif: seed.motif,
    }), POSTER_SIZE);
    const imageUrl = await upload(`events/${partnerId}/${slug}.png`, poster);
    const program = seed.program
        .map((p) => ({ id: randomUUID(), time: p.time, kind: p.kind, title: p.title, ...(p.participant ? { participant: p.participant } : {}) }))
        .sort((a, b) => a.time.localeCompare(b.time));
    const { data: ev, error } = await service.from('events').insert({
        partner_id: partnerId, title: seed.title, slug, description: seed.description,
        start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time,
        location: seed.venue, city: seed.city, latitude: seed.lat, longitude: seed.lng, capacity: seed.capacity,
        status: 'BROUILLON', category: seed.category, image_url: imageUrl, program,
        practical_info: {
            address: `${seed.venue}, ${seed.city}`,
            access: 'Accès par l’entrée principale ; dépose-minute devant le site.',
            parking: 'Stationnement surveillé à proximité.',
            contact: 'Contact organisateur depuis la page de l’événement.',
            rules: 'Billet présenté sur téléphone ; pièce d’identité pour les entrées à saisie manuelle.',
        },
        services: { ticketing: true, tableBooking: false, communication: false },
    }).select('id, status').single();
    if (error || !ev) fail(`événement « ${seed.title} »`, error);
    if (ev.status !== 'BROUILLON') fail(`événement « ${seed.title} »`, `créé au statut ${ev.status} au lieu de BROUILLON`);
    const categories: CreatedEvent['categories'] = {};
    const saleStart = new Date(NOW.getTime() - 12 * 86_400_000).toISOString();
    for (const c of seed.categories) {
        const { data, error: catErr } = await service.from('ticket_categories').insert({
            event_id: ev.id, name: c.name, description: c.description, price: c.price, total_quantity: c.total, sold_quantity: 0,
            is_active: !c.inactive, sale_online: !c.hidden, sale_counter: !c.noCounter, max_per_order: c.maxPerOrder ?? 10, sale_start: saleStart, sale_end: null,
        }).select('id').single();
        if (catErr || !data) fail(`catégorie « ${c.name} » de « ${seed.title} »`, catErr);
        categories[c.name] = { id: data.id as string, price: c.price };
    }
    return { seed, id: ev.id as string, partnerId, ownerId, categories };
}

async function transition(ev: CreatedEvent, actorId: string, to: string, reason?: string): Promise<void> {
    const { data, error } = await service.rpc('event_transition', { p: { event_id: ev.id, actor_id: actorId, to_status: to, ...(reason ? { reason } : {}) } });
    if (error) fail(`event_transition « ${ev.seed.title} » → ${to}`, error);
    if (!data || (data as { ok?: boolean }).ok !== true) fail(`event_transition « ${ev.seed.title} » → ${to}`, `refusée : ${JSON.stringify(data)}`);
}

async function cancelEvent(ev: CreatedEvent, actorId: string): Promise<string[]> {
    const { data, error } = await service.rpc('event_cancel', {
        p: { event_id: ev.id, actor_id: actorId, public_notice: ev.seed.reason, internal_reason: 'Annulation décidée par l’organisateur (démonstration).', confirm_title: ev.seed.title },
    });
    if (error) fail(`event_cancel « ${ev.seed.title} »`, error);
    const out = data as { ok?: boolean; cashout_ids?: string[] } | null;
    if (!out || out.ok !== true) fail(`event_cancel « ${ev.seed.title} »`, `refusée : ${JSON.stringify(data)}`);
    return [...(out.cashout_ids ?? [])];
}

// ── Ventes en ligne (checkout réel, faux SamirPay en mémoire) ────────────────

interface Purchase { paymentId: string; ticketIds: string[]; buyerId: string; category: string }

/**
 * Achat par le checkout réel. `outcome` : SUCCESS (confirmé par la réconciliation), PENDING (laissé en cours :
 * réservation active) ou FAILED (refusé par le faux SamirPay, libéré par la réconciliation : lot 7, captures).
 */
async function buyOnline(ev: CreatedEvent, buyer: Account, category: string, qty: number, outcomeWanted: 'SUCCESS' | 'PENDING' | 'FAILED' = 'SUCCESS'): Promise<Purchase> {
    const cat = ev.categories[category];
    if (!cat) fail(`achat ${ev.seed.title}`, `catégorie inconnue « ${category} »`);
    const operator = rand() < 0.6 ? 'WAVE' : 'ORANGE_MONEY';
    const outcome = await startTicketCheckout({
        userId: buyer.userId,
        body: { eventId: ev.id, items: [{ categoryId: cat.id, quantity: qty }], operator, payerPhone: buyer.phone.replace(/^\+221/, '') },
        idempotencyKey: `demo-${randomUUID()}`,
    });
    const paymentId = String(outcome.body.payment_id ?? '');
    if (outcome.status !== 200 || !paymentId) fail(`checkout « ${ev.seed.title} » / ${category} ×${qty}`, `HTTP ${outcome.status} ${JSON.stringify(outcome.body)}`);
    if (outcomeWanted === 'PENDING') return { paymentId, ticketIds: [], buyerId: buyer.userId, category };
    const payment = await loadPayment(paymentId);
    if (!payment?.external_transaction_id) fail(`paiement ${paymentId}`, 'identifiant SamirPay absent après le checkout');
    if (outcomeWanted === 'FAILED') {
        getFakes().payment.setTransactionStatus(payment.external_transaction_id, 'FAILED');
        const failed = await reconcilePayment(payment, 'WEBHOOK');
        if (failed !== 'FAILED') fail(`refus du paiement ${paymentId}`, `résultat ${failed}`);
        const { data: row, error: rowErr } = await service.from('payments').select('status').eq('id', paymentId).single();
        if (rowErr || !row) fail(`statut du paiement refusé ${paymentId}`, rowErr);
        if (row.status !== 'FAILED') fail(`paiement refusé ${paymentId}`, `statut ${String(row.status)} au lieu de FAILED`);
        return { paymentId, ticketIds: [], buyerId: buyer.userId, category };
    }
    getFakes().payment.setTransactionStatus(payment.external_transaction_id, 'SUCCESS');
    const result = await reconcilePayment(payment, 'WEBHOOK');
    if (result !== 'CONFIRMED') fail(`confirmation du paiement ${paymentId}`, `résultat ${result}`);
    const { data: tickets, error } = await service.from('tickets').select('id').eq('payment_id', paymentId).order('ticket_number');
    if (error) fail(`billets du paiement ${paymentId}`, error);
    return { paymentId, ticketIds: (tickets ?? []).map((t) => t.id as string), buyerId: buyer.userId, category };
}

async function runSales(ev: CreatedEvent, buyers: Account[]): Promise<Purchase[]> {
    const out: Purchase[] = [];
    for (const s of ev.seed.sales) out.push(await buyOnline(ev, pick(buyers), s.category, s.qty));
    return out;
}

/** Ventes réparties sur les 10 jours précédant `until` (plus nombreuses à l'approche de l'événement). */
async function spreadPurchases(purchases: Purchase[], until: Date): Promise<void> {
    for (const p of purchases) {
        const daysBack = Math.floor(Math.pow(rand(), 1.6) * 10);
        const at = new Date(until.getTime() - daysBack * 86_400_000 - between(20, 600) * 60_000);
        const iso = at.toISOString();
        const { error } = await service.from('payments').update({ created_at: iso, paid_at: iso }).eq('id', p.paymentId);
        if (error) fail(`horodatage du paiement ${p.paymentId}`, error);
        const { error: tErr } = await service.from('tickets').update({ created_at: iso }).eq('payment_id', p.paymentId);
        if (tErr) fail(`horodatage des billets du paiement ${p.paymentId}`, tErr);
    }
}

// ── Contrôle d'accès ─────────────────────────────────────────────────────────

interface ScanResult { result: string; scan_id?: string }

/** Secret et version du secret du billet, lus ensemble comme le fait la route (contrat 3.3). */
async function ticketSecret(ticketId: string): Promise<{ secret: string; version: number }> {
    const { data, error } = await service.from('tickets').select('totp_secret, security_version').eq('id', ticketId).single();
    if (error || !data) fail(`secret du billet ${ticketId}`, error);
    const version = Number(data.security_version);
    if (!Number.isInteger(version) || version < 1) fail(`version du secret du billet ${ticketId}`, `valeur illisible ${JSON.stringify(data.security_version)}`);
    return { secret: String(data.totp_secret), version };
}

/** Clé d'idempotence d'une lecture (D39 ; forme admise par ticket_scans.client_key : ^[A-Za-z0-9_-]{8,100}$). */
function scanKey(): string {
    return `seed-${randomUUID()}`;
}

/**
 * Scan caméra tel que le fait la route (app/api/controller/scan/route.ts) : payload EVT1, code vérifié hors base,
 * empreinte, version du secret avec lequel le code a été vérifié (recontrôlée sous verrou par ticket_scan) et clé
 * d'idempotence de la lecture.
 */
async function scanQr(scannerId: string, eventId: string, ticketId: string, expect: string, opts: { staleCode?: boolean } = {}): Promise<ScanResult> {
    const { secret, version } = await ticketSecret(ticketId);
    const at = opts.staleCode ? new Date(Date.now() - 10 * 60_000) : new Date();
    const payload = buildTicketPayload(ticketId, generateTicketCode(ticketId, secret, at));
    const parsed = parseTicketPayload(payload);
    if (!parsed) fail('payload de scan', `payload illisible ${payload}`);
    const totpOk = verifyTicketCode(parsed.ticketId, secret, parsed.code);
    return scanRpc({
        scanner_id: scannerId, event_id: eventId, method: 'QR', payload_hash: sha256(payload), ticket_id: parsed.ticketId,
        totp_ok: totpOk, secret_version: version,
    }, expect);
}

/** ticket_scan avec une clé d'idempotence neuve par lecture (sauf clé fournie). */
async function scanRpc(p: Record<string, unknown>, expect: string): Promise<ScanResult> {
    if (p.client_key === undefined) p = { ...p, client_key: scanKey() };
    const { data, error } = await service.rpc('ticket_scan', { p });
    if (error) fail(`ticket_scan (${expect} attendu)`, error);
    const r = data as ScanResult & { http?: number };
    if (r.result !== expect) fail('ticket_scan', `résultat ${JSON.stringify(data)} au lieu de « ${expect} »`);
    return r;
}

async function assign(ev: CreatedEvent, ctrl: Account, entryPoint: string, cash: boolean): Promise<void> {
    const { error } = await service.from('event_controllers').upsert(
        { event_id: ev.id, user_id: ctrl.userId, can_accept_cash: cash, created_by: ev.ownerId, entry_point: entryPoint },
        { onConflict: 'event_id,user_id' });
    if (error) fail(`affectation de ${ctrl.firstName} ${ctrl.lastName}`, error);
}

/** Garde M6 (lot 7) : au plus un paiement PENDING par acheteur et par événement, vérifiée sur la base. */
async function assertSinglePendingPerBuyerAndEvent(): Promise<void> {
    const duplicates = await inspect(async (db) => (await db.query<{ client_id: string; event_id: string; n: number }>(
        `SELECT client_id::text, event_id::text, count(*)::int AS n FROM public.payments
          WHERE status::text = 'PENDING' AND payment_target::text = 'TICKET'
          GROUP BY client_id, event_id HAVING count(*) > 1`)).rows);
    if (duplicates.length > 0) fail('paiements en attente', `plusieurs paiements PENDING pour un même acheteur et un même événement : ${JSON.stringify(duplicates)}`);
}

async function openShift(ev: CreatedEvent, ctrl: Account, openingFloat: number): Promise<string> {
    const { data, error } = await service.rpc('shift_open', { p: { user_id: ctrl.userId, event_id: ev.id, opening_float: openingFloat, pin_verified: false } });
    if (error) fail(`shift_open ${ctrl.firstName}`, error);
    const r = data as { ok?: boolean; shift_id?: string } | null;
    if (!r?.ok || !r.shift_id) fail(`shift_open ${ctrl.firstName}`, `refusée : ${JSON.stringify(data)}`);
    return r.shift_id;
}

async function counterSale(ev: CreatedEvent, ctrl: Account, category: string, qty: number, buyerPhone?: string): Promise<void> {
    const { data, error } = await service.rpc('counter_sale', {
        p: { seller_id: ctrl.userId, event_id: ev.id, items: [{ category_id: ev.categories[category].id, quantity: qty }], idempotency_key: randomUUID(), ...(buyerPhone ? { buyer_phone: buyerPhone } : {}) },
    });
    if (error) fail(`counter_sale ${ctrl.firstName}`, error);
    if ((data as { ok?: boolean } | null)?.ok !== true) fail(`counter_sale ${ctrl.firstName}`, `refusée : ${JSON.stringify(data)}`);
}

async function payOnSiteTickets(ev: CreatedEvent, buyer: Account, category: string, count: number): Promise<string[]> {
    const cat = ev.categories[category];
    // Insertion directe, canal ONLINE par défaut de la colonne : sur une catégorie non vendue en ligne, l'invariant (t1) la signalerait
    if (ev.seed.categories.find((c) => c.name === category)?.hidden) fail('billets à régler sur place', `catégorie « ${category} » non vendue en ligne`);
    const total = cat.price * count;
    const { data: order, error } = await service.from('orders').insert({
        order_number: `CMD-DEMO-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`,
        client_id: buyer.userId, partner_id: ev.partnerId, subtotal: total, total_amount: total, paid_amount: 0, balance_amount: total,
        payment_type: 'DIFFERE', delivery_mode: 'SUR_PLACE', order_status: 'CONFIRMEE', payment_status: 'PENDING',
    }).select('id').single();
    if (error || !order) fail('commande à régler sur place', error);
    const rows = Array.from({ length: count }, () => ({
        event_id: ev.id, category_id: cat.id, user_id: buyer.userId, order_id: order.id,
        ticket_number: `TCK-${dakarParts(NOW).date.replace(/-/g, '')}-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
        qr_code: `EV-QR-${randomUUID().replace(/-/g, '')}`, price: cat.price, status: 'VALIDE',
    }));
    const { data: tickets, error: tErr } = await service.from('tickets').insert(rows).select('id');
    if (tErr || !tickets) fail('billets à régler sur place', tErr);
    const { data: c, error: cErr } = await service.from('ticket_categories').select('sold_quantity').eq('id', cat.id).single();
    if (cErr || !c) fail('stock de la catégorie', cErr);
    const { error: uErr } = await service.from('ticket_categories').update({ sold_quantity: Number(c.sold_quantity) + count }).eq('id', cat.id);
    if (uErr) fail('stock de la catégorie', uErr);
    return tickets.map((t) => t.id as string);
}

interface RouteResult { status: number; body: Record<string, unknown> }

async function callRoute(modulePath: string, urlPath: string, token: string, body: unknown): Promise<RouteResult> {
    const mod = await importModule(modulePath);
    const handler = mod.POST as ((req: NextRequest) => Promise<Response>) | undefined;
    if (typeof handler !== 'function') fail(`route ${urlPath}`, `aucun gestionnaire POST dans ${modulePath}`);
    const res = await handler(new NextRequest(`${BASE_URL}${urlPath}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
    }));
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    if (text) {
        try {
            parsed = JSON.parse(text) as Record<string, unknown>;
        } catch (err) {
            fail(`route ${urlPath}`, `réponse non JSON (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
        }
    }
    return { status: res.status, body: parsed };
}

async function closeShift(ctrl: Account, shiftId: string, declared: number, justification?: string, pin?: string): Promise<void> {
    if (!ctrl.accessToken) fail('clôture de caisse', `jeton absent pour ${ctrl.email}`);
    const r = await callRoute('../../app/api/controller/shifts/close/route', '/api/controller/shifts/close', ctrl.accessToken, {
        shiftId, declaredCashTotal: declared, ...(justification ? { justification } : {}), ...(pin ? { regisseurPin: pin } : {}),
    });
    if (r.status !== 200) fail(`clôture de la caisse ${shiftId}`, `HTTP ${r.status} ${JSON.stringify(r.body)}`);
}

async function reportIncidents(ev: CreatedEvent, ctrl: Account, kinds: Array<'NETWORK' | 'TIMEOUT'>): Promise<void> {
    if (!ctrl.accessToken) fail('incidents de scan', `jeton absent pour ${ctrl.email}`);
    const count = async () => {
        const { count: n, error } = await service.from('scan_incidents').select('id', { count: 'exact', head: true }).eq('scanner_id', ctrl.userId);
        if (error) fail('lecture de scan_incidents', error);
        return n ?? 0;
    };
    const before = await count();
    const incidents = kinds.map((kind, i) => ({ kind, at: new Date(Date.now() - (40 - i * 7) * 60_000).toISOString() }));
    const r = await callRoute('../../app/api/controller/scan/incidents/route', '/api/controller/scan/incidents', ctrl.accessToken, { eventId: ev.id, incidents });
    if (r.status < 200 || r.status >= 300) fail('déclaration des incidents', `HTTP ${r.status} ${JSON.stringify(r.body)}`);
    const after = await count();
    if (after - before !== kinds.length) fail('déclaration des incidents', `${after - before} incident(s) enregistré(s) au lieu de ${kinds.length}`);
}

async function shiftExpected(shiftId: string): Promise<number> {
    const { data, error } = await service.from('controller_shifts').select('expected_cash_total').eq('id', shiftId).single();
    if (error || !data) fail(`caisse ${shiftId}`, error);
    return Number(data.expected_cash_total);
}

/** Entrées réparties dans le temps (flux par quart d'heure) : horodatages des scans et des compostages. */
async function spreadScans(eventId: string, from: Date, to: Date): Promise<void> {
    const { data: scans, error } = await service.from('ticket_scans').select('id, ticket_id, accepted').eq('event_id', eventId).order('created_at').order('id');
    if (error) fail('lecture des scans', error);
    const list = scans ?? [];
    const span = to.getTime() - from.getTime();
    for (let i = 0; i < list.length; i++) {
        const at = new Date(from.getTime() + Math.round((span * (i + rand() * 0.6)) / Math.max(list.length, 1)));
        const iso = at.toISOString();
        const { error: sErr } = await service.from('ticket_scans').update({ created_at: iso }).eq('id', list[i].id);
        if (sErr) fail('horodatage d’un scan', sErr);
        if (list[i].accepted && list[i].ticket_id) {
            const { error: tErr } = await service.from('tickets').update({ checked_in_at: iso }).eq('id', list[i].ticket_id);
            if (tErr) fail('horodatage d’un compostage', tErr);
        }
    }
}

// ── Notifications (lot 6, contrat P2) ────────────────────────────────────────

async function rpcOk(fn: string, p: Record<string, unknown>, step: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.rpc(fn, { p });
    if (error) fail(step, error);
    const out = (data ?? null) as Record<string, unknown> | null;
    if (!out || out.ok !== true) fail(step, `refusée : ${JSON.stringify(data)}`);
    return out;
}

async function settingInt(key: string): Promise<number> {
    const { data, error } = await service.from('platform_settings').select('value').eq('key', key).maybeSingle();
    if (error) fail(`réglage ${key}`, error);
    const value = Number((data?.value as { value?: unknown } | null | undefined)?.value);
    if (!Number.isInteger(value)) fail(`réglage ${key}`, `valeur illisible ${JSON.stringify(data)}`);
    return value;
}

/** Planifie le J-1 d'un événement à venir par horloge simulée (veille, heure réglée + 1 min) : lignes à échéance future. */
async function scheduleJ1(ev: CreatedEvent): Promise<number> {
    const hour = await settingInt('notif.reminder_j1_hour');
    const veille = new Date(`${dakarParts(ev.seed.start).date}T00:00:00.000Z`);
    veille.setUTCDate(veille.getUTCDate() - 1);
    veille.setUTCHours(hour, 1, 0, 0);
    if (veille.getTime() <= Date.now() + 60_000) fail(`rappel J-1 de « ${ev.seed.title} »`, `veille ${veille.toISOString()} passée ou imminente`);
    const report = await scheduleReminders({ now: veille, onlyEventIds: [ev.id] });
    if (report.created.REMINDER_J1 === 0) fail(`rappel J-1 de « ${ev.seed.title} »`, `aucune ligne créée (${JSON.stringify(report)})`);
    return report.created.REMINDER_J1;
}

interface OutboxPick { id: string; status: string; reason: string | null; attempts: number }

async function outboxRow(id: string): Promise<OutboxPick> {
    const { data, error } = await service.from('notification_outbox').select('id, status, reason, attempts').eq('id', id).single();
    if (error || !data) fail(`ligne de boîte d'envoi ${id}`, error);
    return data as OutboxPick;
}

/** Lignes SMS de confirmation d'achat en attente et dues, d'acheteurs autres que le client de démonstration. */
async function duePurchaseSms(exclude: Account, count: number): Promise<string[]> {
    const { data, error } = await service.from('notification_outbox').select('id, recipient_user_id, recipient_phone')
        .eq('type', 'PURCHASE_CONFIRMED').eq('channel', 'SMS').eq('status', 'PENDING')
        .lte('next_attempt_at', new Date().toISOString())
        .order('created_at').order('id').limit(50);
    if (error) fail('lignes SMS de confirmation d’achat', error);
    const ids = (data ?? []).filter((r) => r.recipient_user_id !== exclude.userId && r.recipient_phone !== exclude.phone).map((r) => String(r.id)).slice(0, count);
    if (ids.length < count) fail('lignes SMS de confirmation d’achat', `${ids.length} ligne(s) en attente au lieu de ${count}`);
    return ids;
}

/** SMS refusé à réessayer 5 fois (failNext), relances à 1, 5, 15 et 60 min par horloge simulée : FAILED, relançable. */
async function failFiveTimes(id: string): Promise<void> {
    const sms = getFakes().sms;
    const waits = [1, 5, 15, 60];
    let t = new Date();
    for (let attempt = 1; attempt <= 5; attempt++) {
        sms.failNext(`refus temporaire ${attempt} (démonstration)`);
        await dispatchNotifications({ now: t, onlyIds: [id] });
        if (sms.pendingScenarios() !== 0) fail('ligne FAILED de démonstration', `tentative ${attempt} : refus simulé non consommé (ligne ${JSON.stringify(await outboxRow(id))})`);
        if (attempt < 5) t = new Date(t.getTime() + waits[attempt - 1] * 60_000 + 1000);
    }
    const row = await outboxRow(id);
    if (row.status !== 'FAILED' || row.attempts !== 5) fail('ligne FAILED de démonstration', `état ${JSON.stringify(row)} au lieu de FAILED après 5 tentatives`);
}

/** Passages de l'envoyeur à l'heure réelle jusqu'à ce qu'aucune ligne due ne reste (30 au plus). */
async function drainOutbox(): Promise<number> {
    let total = 0;
    for (let i = 0; i < 30; i++) {
        const report = await dispatchNotifications();
        total += report.claimed;
        if (report.claimed === 0) return total;
    }
    fail('passage de l’envoyeur', `lignes encore dues après 30 passages (${total} réservées)`);
}

// ── Exécution ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    log(`Instance : ${SUPABASE_URL}`);
    log('contrôle préalable (objets du contrat du lot 5)…');
    await preflight();

    log('comptes de démonstration…');
    const accounts = {} as Record<DemoAccountKey, Account>;
    for (const key of Object.keys(PEOPLE) as DemoAccountKey[]) {
        const p = PEOPLE[key];
        accounts[key] = await createAccount(p, p.roles, p.primaryRole, key.startsWith('controleur'));
    }
    const { error: permErr } = await service.from('admin_permissions').upsert(
        // Lot 7 (7.0 f) : communications.manage pour la page des campagnes (/admin/communications)
        ['events.read', 'events.write', 'notifications.read', 'notifications.write', 'communications.manage'].map((permission) => ({ user_id: accounts.admin.userId, permission })), { onConflict: 'user_id,permission' });
    if (permErr) fail('permissions de l’administrateur de démonstration', permErr);
    const buyers: Account[] = [];
    for (const p of buyerPeople()) buyers.push(await createAccount(p, ['CLIENT'], 'CLIENT', false));
    log(`${Object.keys(accounts).length} comptes nommés, ${buyers.length} acheteurs`);

    const browser = await chromium.launch();
    const created: CreatedEvent[] = [];
    const partners = {} as Record<OrganizerSpec['key'], string>;
    try {
        log('organisateurs, logos et affiches (rendu HTML → PNG)…');
        for (const o of ORGANIZERS) partners[o.key] = await createPartner(o, accounts[o.key], browser);
        for (const seed of EVENTS) {
            const org = ORGANIZERS.find((o) => o.key === seed.organizer);
            if (!org) fail('organisateur', seed.organizer);
            created.push(await createEvent(seed, partners[seed.organizer], accounts[seed.organizer].userId, org.commercial, browser));
        }
    } finally {
        await browser.close();
    }
    log(`${created.length} événements créés en brouillon`);
    const newPartnerId = await createNewPartner(accounts.partenaireNeuf);
    log(`partenaire « premiers pas » ${NEW_PARTNER_COMPANY} : VALIDE, en essai, aucun événement, sans logo`);

    const admin = accounts.admin.userId;
    const byKey = (key: DemoEventKey): CreatedEvent => {
        const ev = created.find((c) => c.seed.key === key);
        if (!ev) fail('événement de démonstration', key);
        return ev;
    };

    log('cycle de vie (event_transition, event_cancel)…');
    for (const ev of created) {
        const owner = ev.ownerId;
        const lc = ev.seed.lifecycle;
        if (lc === 'BROUILLON') continue;
        await transition(ev, owner, 'EN_ATTENTE');
        if (lc === 'EN_ATTENTE') continue;
        if (lc === 'REFUSE') {
            await transition(ev, admin, 'BROUILLON', ev.seed.reason);
            continue;
        }
        await transition(ev, admin, 'VALIDE');
        if (lc === 'VALIDE') continue;
        if (lc === 'ANNULE_SANS_VENTE') {
            const cashouts = await cancelEvent(ev, owner);
            if (cashouts.length > 0) fail('annulation sans vente', `${cashouts.length} remboursement(s) inattendu(s)`);
            continue;
        }
        await transition(ev, owner, 'PUBLIE');
    }

    log('ventes en ligne (checkout, confirmation)…');
    const purchases = new Map<string, Purchase[]>();
    for (const ev of created) {
        if (ev.seed.sales.length === 0) continue;
        purchases.set(ev.id, await runSales(ev, buyers));
    }
    const client = accounts.client;
    const ceSoir = byKey('ceSoir');
    const clientCeSoir = await buyOnline(ceSoir, client, 'Standard', 2);
    const clientPublie = await buyOnline(byKey('publie'), client, 'Pass soirée', 1);
    const clientAnnule = await buyOnline(byKey('annule'), client, 'Pont supérieur', 1);
    const clientTermine = await buyOnline(byKey('termine'), client, 'Brunch', 1);
    purchases.get(ceSoir.id)?.push(clientCeSoir);
    purchases.get(byKey('publie').id)?.push(clientPublie);
    purchases.get(byKey('annule').id)?.push(clientAnnule);
    purchases.get(byKey('termine').id)?.push(clientTermine);
    // Lot 7 : billet du client « la veille » (fenêtre hors ligne ouverte : début − 24 h)
    const veille = byKey('veille');
    const clientVeille = await buyOnline(veille, client, 'Entrée', 1);
    purchases.get(veille.id)?.push(clientVeille);
    // Réservations en cours : deux acheteurs DISTINCTS (garde M6 du lot 7 : un seul paiement PENDING par acheteur
    // et par événement, refus PAYMENT_PENDING sinon ; A5 l'avait relevé ici, deux tirages pick() pouvant coïncider)
    const pendingBuyers = [buyers[0], buyers[1]];
    for (const b of pendingBuyers) await buyOnline(ceSoir, b, 'Standard', 1, 'PENDING');
    log(`2 paiements laissés en cours (réservations actives) par ${pendingBuyers.map((b) => `${b.firstName} ${b.lastName}`).join(' et ')}`);
    // Lot 7 (7.3, captures /paiement/<id>) : paiements du client en attente et échoué, sur deux autres événements
    // (aucun paiement en attente du client sur « ce soir » : la modale d'achat des captures reste sans bandeau)
    const clientPending = await buyOnline(byKey('publieComplet'), client, 'Entrée individuelle', 1, 'PENDING');
    const clientFailed = await buyOnline(byKey('publie'), client, 'Pass soirée', 1, 'FAILED');
    await assertSinglePendingPerBuyerAndEvent();
    log(`paiements du client : en attente ${clientPending.paymentId}, réussi ${clientCeSoir.paymentId}, échoué ${clientFailed.paymentId}`);

    // Prévente close après ses ventes : catégorie désactivée (exclue du prix « à partir de »)
    for (const ev of created) {
        for (const c of ev.seed.categories.filter((x) => x.deactivateAfterSales)) {
            const { error } = await service.from('ticket_categories').update({ is_active: false }).eq('id', ev.categories[c.name].id);
            if (error) fail(`désactivation de « ${c.name} »`, error);
        }
    }

    log('événement « ce soir » : équipe, caisses, entrées, refus, guichet, incidents…');
    const [c1, c2, c3] = [accounts.controleur, accounts.controleur2, accounts.controleur3];
    await assign(ceSoir, c1, 'Entrée principale', true);
    await assign(ceSoir, c2, 'Entrée VIP', true);
    await assign(ceSoir, c3, 'Entrée principale', true);
    const shift1 = await openShift(ceSoir, c1, 10000);
    const shift2 = await openShift(ceSoir, c2, 5000);
    const shift3 = await openShift(ceSoir, c3, 5000);

    const online = (purchases.get(ceSoir.id) ?? []).filter((p) => p !== clientCeSoir);
    const scanned = new Set<string>();
    let turn = 0;
    for (const p of online) {
        for (const ticketId of p.ticketIds) {
            if (rand() > 0.72) continue;
            const scanner = p.category === 'VIP' ? c2 : (turn++ % 2 === 0 ? c1 : c3);
            await scanQr(scanner.userId, ceSoir.id, ticketId, 'valid');
            scanned.add(ticketId);
        }
    }
    await scanQr(c1.userId, ceSoir.id, clientCeSoir.ticketIds[0], 'valid');
    scanned.add(clientCeSoir.ticketIds[0]);
    const notYet = online.flatMap((p) => p.ticketIds).filter((t) => !scanned.has(t));
    if (notYet.length < 6) fail('jeu de données « ce soir »', `trop peu de billets non scannés (${notYet.length})`);
    // Saisie manuelle par un contrôleur affecté, pièce vérifiée
    for (const ticketId of notYet.slice(0, 2)) {
        const { data: t, error } = await service.from('tickets').select('ticket_number').eq('id', ticketId).single();
        if (error || !t) fail('numéro de billet', error);
        await scanRpc({ scanner_id: c1.userId, event_id: ceSoir.id, method: 'MANUAL', ticket_number: t.ticket_number, identity_verified: true, payload_hash: sha256(String(t.ticket_number).toUpperCase()) }, 'valid');
        scanned.add(ticketId);
    }
    // Refus : doublons (tentatives multiples), code expiré, autre événement, QR non dynamique, inconnu, saisie sans pièce
    const accepted = Array.from(scanned);
    await scanQr(c3.userId, ceSoir.id, accepted[0], 'already_used');
    await scanQr(c1.userId, ceSoir.id, accepted[0], 'already_used');
    await scanQr(c2.userId, ceSoir.id, accepted[3], 'already_used');
    await scanQr(c1.userId, ceSoir.id, notYet[2], 'qr_expired', { staleCode: true });
    await scanQr(c3.userId, ceSoir.id, notYet[3], 'qr_expired', { staleCode: true });
    const otherEvent = (purchases.get(byKey('publie').id) ?? [])[0];
    await scanQr(c1.userId, ceSoir.id, otherEvent.ticketIds[0], 'wrong_event');
    await scanQr(c3.userId, ceSoir.id, otherEvent.ticketIds[0], 'wrong_event');
    await scanRpc({ scanner_id: c1.userId, event_id: ceSoir.id, method: 'QR', payload_hash: sha256('TCK-PHOTOCOPIE'), pre_result: 'dynamic_qr_required' }, 'dynamic_qr_required');
    const unknown = randomUUID();
    await scanRpc({ scanner_id: c3.userId, event_id: ceSoir.id, method: 'QR', payload_hash: sha256(`EVT1:${unknown}:000000`), ticket_id: unknown, totp_ok: false }, 'invalid');
    const { data: t4, error: t4Err } = await service.from('tickets').select('ticket_number').eq('id', notYet[4]).single();
    if (t4Err || !t4) fail('numéro de billet', t4Err);
    await scanRpc({ scanner_id: c1.userId, event_id: ceSoir.id, method: 'MANUAL', ticket_number: t4.ticket_number, identity_verified: false, payload_hash: sha256(String(t4.ticket_number).toUpperCase()) }, 'manual_entry_refused');
    // Lot 7 (capture de la saisie manuelle) : billet jamais présenté, vérifié par le contrôleur 1 (lecture seule)
    const { data: t5, error: t5Err } = await service.from('tickets').select('id, ticket_number, status, price, sale_channel, payment_id').eq('id', notYet[5]).single();
    if (t5Err || !t5) fail('billet de la saisie manuelle', t5Err);
    if (t5.status !== 'VALIDE') fail('billet de la saisie manuelle', `statut ${String(t5.status)} au lieu de VALIDE`);
    // Lot 8 : même billet pour la capture du remboursement unitaire, qui attend « Rembourser ce billet » (payant, payé en ligne)
    if (!(Number(t5.price) > 0) || t5.sale_channel !== 'ONLINE' || !t5.payment_id) {
        fail('billet de la saisie manuelle', `billet payant payé en ligne attendu, reçu prix ${String(t5.price)}, canal ${String(t5.sale_channel)}, paiement ${String(t5.payment_id)}`);
    }
    const manualTicket = { id: String(t5.id), number: String(t5.ticket_number) };

    // Billet « à régler sur place » : resté impayé, porteur absent (L47)
    await payOnSiteTickets(ceSoir, pick(buyers), 'Standard', 1);

    // Guichet : vente = entrée immédiate (C7), reçu SMS pour certaines ventes
    for (const [ctrl, category, qty, phone] of [
        [c1, 'Standard', 2, '700000301'], [c1, 'Standard', 1, undefined], [c1, 'Standard', 1, '700000302'], [c1, 'Standard', 3, undefined],
        [c2, 'VIP', 1, '700000303'], [c2, 'VIP', 2, undefined], [c2, 'Standard', 1, undefined],
        [c3, 'Standard', 1, undefined], [c3, 'Standard', 2, '700000304'],
        // Lot 8 : catégorie non vendue en ligne, vendue au guichet (décision de vente figée, invariant (t2))
        [c1, 'Carré presse', 1, undefined],
        // Lot 9 (A16, L47) : remplace les deux billets encaissés au scan, même caisse, même montant, mêmes entrées
        [c1, 'Standard', 2, undefined],
    ] as Array<[Account, string, number, string | undefined]>) {
        await counterSale(ceSoir, ctrl, category, qty, phone);
    }

    await reportIncidents(ceSoir, c1, ['NETWORK', 'NETWORK']);
    await reportIncidents(ceSoir, c3, ['TIMEOUT']);

    // Clôtures : avec écart (justifié, PIN régisseur) et sans écart ; la caisse 1 reste ouverte
    const pin = await ShiftService.generateRegisseurPin(ceSoir.id, ceSoir.ownerId, { confirm: true, confirmOpenShifts: true, actorRole: 'PARTENAIRE' });
    const expected2 = await shiftExpected(shift2);
    await closeShift(c2, shift2, expected2 - 2000, 'Erreur de rendu de monnaie sur une vente VIP, signalée au régisseur en fin de service.', pin.pin);
    await closeShift(c3, shift3, await shiftExpected(shift3));
    log(`caisses : ${shift1} ouverte, ${shift2} clôturée avec écart de −2 000 F, ${shift3} clôturée sans écart`);

    log('événements terminés (ventes, entrées, dates déplacées, events_finish_overdue)…');
    const ended: CreatedEvent[] = created.filter((c) => c.seed.lifecycle === 'TERMINE');
    for (const ev of ended) {
        const list = purchases.get(ev.id) ?? [];
        // Billets du client de démonstration d'abord : son entrée figure dans « Mes billets »
        const tickets = [...list]
            .sort((a, b) => Number(b.buyerId === client.userId) - Number(a.buyerId === client.userId))
            .flatMap((p) => p.ticketIds);
        const keep = Math.max(2, Math.round(tickets.length * 0.2));
        for (const ticketId of tickets.slice(0, tickets.length - keep)) await scanQr(ev.ownerId, ev.id, ticketId, 'valid');
        const newStart = finalStart(ev.seed);
        const newEnd = new Date(newStart.getTime() + ev.seed.hours * 3600_000);
        const s = dakarParts(newStart);
        const e = dakarParts(newEnd);
        const { error } = await service.from('events').update({ start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time }).eq('id', ev.id);
        if (error) fail(`dates de « ${ev.seed.title} »`, error);
        await spreadPurchases(list, new Date(newStart.getTime() - 3 * 3600_000));
        await spreadScans(ev.id, new Date(newStart.getTime() - 30 * 60_000), new Date(newStart.getTime() + 150 * 60_000));
    }
    const { data: finished, error: finErr } = await service.rpc('events_finish_overdue', { p: { limit: 100 } });
    if (finErr) fail('events_finish_overdue', finErr);
    if ((finished as { ok?: boolean } | null)?.ok !== true) fail('events_finish_overdue', `refusé : ${JSON.stringify(finished)}`);
    const finishedIds = new Set(((finished as { ids?: string[] } | null)?.ids ?? []).map(String));
    for (const ev of ended) if (!finishedIds.has(ev.id)) fail('events_finish_overdue', `« ${ev.seed.title} » non terminé (réponse ${JSON.stringify(finished)})`);

    log('notifications : préférence du client, transfert entrant, rappels J-1 planifiés (horloge simulée)…');
    await rpcOk('notification_preference_set', { user_id: client.userId, topic: 'REMINDERS', channel: 'SMS', enabled: false }, 'préférence du client (rappels par SMS coupés)');
    const { error: verifiedErr } = await service.from('users').update({ phone_verified_at: new Date().toISOString() }).eq('id', client.userId);
    if (verifiedErr) fail('numéro vérifié du client de démonstration', verifiedErr);
    const publie = byKey('publie');
    const gift = (purchases.get(publie.id) ?? []).find((p) => p.buyerId !== client.userId && p.ticketIds.length > 0);
    if (!gift) fail('transfert entrant', `aucun billet d’un autre acheteur pour « ${publie.seed.title} »`);
    const transfer = await rpcOk('ticket_transfer_initiate', {
        ticket_id: gift.ticketIds[0], actor_id: gift.buyerId, recipient: client.phone,
        expires_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    }, 'transfert vers le client de démonstration');
    const incomingTransferId = String(transfer.transfer_id ?? '');
    const futureJ1 = await scheduleJ1(publie);
    const suspendedJ1 = await scheduleJ1(byKey('suspendu'));
    log(`rappels J-1 planifiés : ${futureJ1} ligne(s) à venir (« ${publie.seed.title} »), ${suspendedJ1} annulées par la suspension qui suit`);

    log('suspension et annulation avec remboursements…');
    const suspendu = byKey('suspendu');
    await transition(suspendu, admin, 'SUSPENDU', suspendu.seed.reason);
    const annule = byKey('annule');
    const cashoutIds = await cancelEvent(annule, annule.ownerId);
    const { data: cashouts, error: coErr } = await service.from('cashouts').select('id, beneficiary_user_id').in('id', cashoutIds);
    if (coErr) fail('lecture des remboursements', coErr);
    const ordered = [...(cashouts ?? [])].sort((a, b) => Number(b.beneficiary_user_id === client.userId) - Number(a.beneficiary_user_id === client.userId) || String(a.id).localeCompare(String(b.id)));
    if (ordered.length < 6) fail('remboursements de l’annulation', `${ordered.length} remboursement(s) au lieu d’au moins 6`);
    const plan: Array<['success' | 'pending' | 'timeout-after-send', string]> = ordered.map((c, i) => [i < Math.ceil(ordered.length / 2) ? 'success' : i < ordered.length - 2 ? 'pending' : 'timeout-after-send', String(c.id)]);
    const fake = getFakes().payment;
    const outcomes: Record<string, number> = {};
    for (const [mode, id] of plan) {
        fake.setCashoutMode(mode);
        const out = await CashoutService.send(id);
        outcomes[out.status] = (outcomes[out.status] ?? 0) + 1;
    }
    fake.setCashoutMode('success');
    for (const status of ['CONFIRME', 'ENVOYE', 'INCERTAIN']) {
        if (!outcomes[status]) fail('remboursements de l’annulation', `aucun remboursement au statut ${status} (${JSON.stringify(outcomes)})`);
    }
    log(`remboursements : ${JSON.stringify(outcomes)}`);

    log('notifications : journal OTP, ligne FAILED après 5 tentatives, ligne UNCERTAIN, passage de l’envoyeur…');
    const { data: cancelledJ1, error: cjErr } = await service.from('notification_outbox').select('id', { count: 'exact' })
        .eq('event_id', suspendu.id).eq('type', 'REMINDER_J1').eq('status', 'CANCELLED');
    if (cjErr) fail('rappels annulés par la suspension', cjErr);
    if ((cancelledJ1 ?? []).length === 0) fail('rappels annulés par la suspension', 'aucune ligne REMINDER_J1 CANCELLED');
    const otp = await rpcOk('notification_sync_log', {
        type: 'OTP_LOGIN', ref: randomUUID(), phone: client.phone, user_id: client.userId, outcome: 'SENT', provider_message_id: `demo-${randomUUID()}`,
    }, 'journal d’un code de connexion (sans le code)');
    const otpLogId = String(otp.id ?? '');
    const [failedId, uncertainId] = await duePurchaseSms(client, 2);
    await failFiveTimes(failedId);
    getFakes().sms.uncertainNext(1);
    await dispatchNotifications({ onlyIds: [uncertainId] });
    const uncertain = await outboxRow(uncertainId);
    if (uncertain.status !== 'UNCERTAIN') fail('ligne UNCERTAIN de démonstration', `état ${JSON.stringify(uncertain)}`);
    const drained = await drainOutbox();
    log(`envoyeur : ${drained} ligne(s) traitées`);
    const { data: clientNotifs, error: cnErr } = await service.from('notifications').select('id').eq('user_id', client.userId)
        .order('created_at', { ascending: true }).order('id', { ascending: true });
    if (cnErr) fail('notifications du client', cnErr);
    if ((clientNotifs ?? []).length < 3) fail('notifications du client', `${(clientNotifs ?? []).length} notification(s) au lieu d’au moins 3`);
    for (const n of (clientNotifs ?? []).slice(0, 2)) {
        await rpcOk('notifications_mark_read', { user_id: client.userId, id: n.id }, 'notification du client marquée lue');
    }
    let sentId = '';
    for (const [column, value] of [['recipient_user_id', client.userId], ['recipient_phone', client.phone]] as const) {
        const { data: sentRows, error: sentErr } = await service.from('notification_outbox').select('id')
            .eq(column, value).eq('channel', 'SMS').eq('status', 'SENT').order('created_at').limit(1);
        if (sentErr) fail('SMS envoyé au client', sentErr);
        sentId = String(sentRows?.[0]?.id ?? '');
        if (sentId) break;
    }
    if (!sentId) fail('SMS envoyé au client', 'aucune ligne SMS SENT pour le client de démonstration');
    log(`notifications : FAILED ${failedId}, UNCERTAIN ${uncertainId}, SENT ${sentId}, journal OTP ${otpLogId}, ${(clientNotifs ?? []).length} dans la cloche du client (2 lues)`);

    log('horodatages : ventes sur 10 jours, entrées réparties…');
    for (const ev of created.filter((c) => c.seed.lifecycle !== 'TERMINE')) {
        const list = purchases.get(ev.id);
        if (list?.length) await spreadPurchases(list, new Date(NOW.getTime() - 30 * 60_000));
    }
    await spreadScans(ceSoir.id, new Date(NOW.getTime() - 100 * 60_000), new Date(NOW.getTime() - 2 * 60_000));

    const demoEvent = (ev: CreatedEvent, status: string): DemoEvent => ({ id: ev.id, title: ev.seed.title, status, organizer: ev.seed.organizer });
    const finalStatus: Record<Lifecycle, string> = {
        BROUILLON: 'BROUILLON', EN_ATTENTE: 'EN_ATTENTE', REFUSE: 'BROUILLON', VALIDE: 'VALIDE', PUBLIE: 'PUBLIE',
        SUSPENDU: 'SUSPENDU', ANNULE: 'ANNULE', ANNULE_SANS_VENTE: 'ANNULE', TERMINE: 'TERMINE',
    };
    const toAccount = (key: DemoAccountKey): DemoAccount => ({
        email: accounts[key].email, userId: accounts[key].userId, firstName: accounts[key].firstName, lastName: accounts[key].lastName,
        ...(key.startsWith('organisateur') ? { partnerId: partners[key as OrganizerSpec['key']] } : {}),
        ...(key === 'partenaireNeuf' ? { partnerId: newPartnerId } : {}),
    });
    const veilleTicket = clientVeille.ticketIds[0];
    if (!veilleTicket) fail('billet « la veille » du client', 'aucun billet émis');
    const ids: DemoIds = {
        version: DEMO_IDS_VERSION,
        generatedAt: new Date().toISOString(),
        supabaseUrl: SUPABASE_URL,
        accounts: Object.fromEntries((Object.keys(accounts) as DemoAccountKey[]).map((k) => [k, toAccount(k)])) as Record<DemoAccountKey, DemoAccount>,
        events: Object.fromEntries(created.filter((c) => c.seed.key !== null).map((c) => [String(c.seed.key), demoEvent(c, finalStatus[c.seed.lifecycle])])) as Record<DemoEventKey, DemoEvent>,
        allEvents: created.map((c) => demoEvent(c, finalStatus[c.seed.lifecycle])),
        tickets: {
            clientValide: clientCeSoir.ticketIds[1], clientUtilise: clientCeSoir.ticketIds[0], clientVeille: veilleTicket,
            manualLookup: manualTicket,
        },
        notifications: { failedId, sentId, otpLogId },
        transfers: { incomingId: incomingTransferId },
        payments: { pending: clientPending.paymentId, success: clientCeSoir.paymentId, failed: clientFailed.paymentId },
    };
    writeDemoIds(ids);
    log(`identifiants écrits : ${path.relative(process.cwd(), DEMO_IDS_FILE)}`);

    // Lot 7 (contrat 10.1, fix(7.6)) : (a) à (o), envoyeur compris, puis (p)(q) et schéma du lot 7 ; lot 8 (T31) : (r)(s)(t) ; lot 9 (T29) : (t)(u)(v)
    log('invariants (a) à (v)…');
    await assertLot9Invariants('seed-demo');

    log(`OK en ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
