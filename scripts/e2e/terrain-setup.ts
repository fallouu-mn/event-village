/**
 * Lot 7 (contrat, sections 11.1 et 11.5) — préparation des données du projet Playwright « terrain » (et de la
 * fumée prolongée, vague F), lancée par le processus Playwright via `node --import tsx` (le mode « dans le
 * processus » échoue en CI à cause de l'alias @/, PROUVÉ run 71 ; même modèle que scripts/e2e/clock-run.ts) :
 *
 *   node --import tsx scripts/e2e/terrain-setup.ts prepare --label <texte> --holder client|client-bis \
 *        --tickets <1..10> [--start-in-hours <h>] [--before-hours <0..48>]
 *   node --import tsx scripts/e2e/terrain-setup.ts restore-setting --key <clé access.*> --value <JSON>
 *   node --import tsx scripts/e2e/terrain-setup.ts scans --ticket <uuid>
 *   node --import tsx scripts/e2e/terrain-setup.ts payload --ticket <uuid> [--not-code <6 chiffres>]
 *
 * prepare : événement du partenaire A (seed de test) créé par les RPC (event_create, soumission, validation par
 *   le SUPERADMIN, publication ; affiche reprise d'un événement du partenaire A déjà déposée), début à l'heure
 *   réelle + N heures (défaut 20 : « la veille », décision D6), catégorie gratuite ; contrôleur A affecté
 *   (event_controllers, comme tests/seed/seed-test.ts) ; billets gratuits émis par free_tickets_claim au nom du
 *   porteur ; en dernier, `access.scan_window_before_hours` posé par finance_setting_set (SUPERADMIN) si
 *   --before-hours est donné, avec la valeur d'avant dans la réponse : l'appelant la remet par
 *   `restore-setting` dans un finally. Aucune heure simulée : tout est placé par rapport à l'heure réelle.
 * scans : lignes ticket_scans du billet et état du billet, lus par le service_role.
 * payload : QR dynamique du pas COURANT d'un billet quel que soit son statut (run 72 : la route live-code du
 *   porteur refuse un billet UTILISE par un 409, aujourd'hui comme après le lot ; la relecture d'un billet
 *   composté a besoin d'un code frais). Secret du billet lu par le service_role sur la base LOCALE, code
 *   calculé par lib/security/totp.ts (generateTicketCode, buildTicketPayload : réutilisés, jamais recopiés ;
 *   clé maître TICKET_TOTP_MASTER_KEY de `.env.e2e`, la même que l'application démarrée), puis revérifié
 *   par verifyTicketCode. Avec --not-code, si le code du pas courant est celui-là, attente RÉELLE du pas
 *   suivant (20 s au plus) : un code d'un autre pas que la lecture précédente (anti-doublon D41).
 *   Format (contrat 3.1, inchangé par fix(7.1s)) : « EVT1:<billet>:<6 chiffres> », clé dérivée du secret
 *   COURANT du billet ; la version du secret (security_version, contrôlée par la route après fix(7.2s)) est
 *   celle de la ligne lue, rendue pour le diagnostic. Ni le secret ni la clé ne sont imprimés.
 *
 * Schéma : seulement des objets du lot 6 et d'avant (le seed et ce script tournent au run « avant »).
 * Garde-fous : `.env.e2e` chargé et URL locales vérifiées par e2eConfig() (même règle que
 * scripts/e2e/env.mjs:requireLocalUrl) ; client service_role refusé vers un hôte non local
 * (e2e/support/service.ts) ; EV_INTEGRATIONS refusé. La dernière ligne de la sortie standard est la réponse JSON.
 */
import { FIXTURE_USERS } from '../../tests/helpers/fixture-data';
import { e2eConfig } from '../../e2e/support/env';
import { createPublishedEvent, serviceClient, userIdByEmail } from '../../e2e/support/service';

const TAG = '[terrain-setup]';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Seules les clés de la fenêtre de scan peuvent être posées par ce script (contrat 11.1). */
const SETTABLE_KEYS = new Set(['access.scan_window_before_hours', 'access.scan_window_after_hours']);

const HOLDERS = {
    client: FIXTURE_USERS.CLIENT,
    'client-bis': FIXTURE_USERS.CLIENT_BIS,
} as const;
type HolderKey = keyof typeof HOLDERS;

function usage(message: string): never {
    process.stderr.write(
        `${TAG} ${message}\nUsage : terrain-setup.ts prepare --label <texte> --holder client|client-bis --tickets <1..10> [--start-in-hours <h>] [--before-hours <0..48>]\n`
        + '        terrain-setup.ts restore-setting --key <access.*> --value <JSON>\n'
        + '        terrain-setup.ts scans --ticket <uuid>\n'
        + '        terrain-setup.ts payload --ticket <uuid> [--not-code <6 chiffres>]\n',
    );
    process.exit(2);
}

function parseFlags(rest: string[]): Map<string, string> {
    const out = new Map<string, string>();
    for (let i = 0; i < rest.length; i += 2) {
        const flag = rest[i];
        const value = rest[i + 1];
        if (!flag.startsWith('--')) usage(`option attendue, reçu « ${flag} »`);
        if (value === undefined) usage(`valeur manquante après ${flag}`);
        out.set(flag.slice(2), value);
    }
    return out;
}

function intFlag(flags: Map<string, string>, name: string, min: number, max: number, fallback: number | null): number {
    const raw = flags.get(name);
    if (raw === undefined) {
        if (fallback === null) usage(`--${name} obligatoire`);
        return fallback;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) usage(`--${name} : entier de ${min} à ${max} attendu, reçu « ${raw} »`);
    return n;
}

/** Jour et heure de Dakar (UTC+0) au format des champs de event_create. */
function dakarParts(d: Date): { date: string; time: string } {
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: `${iso.slice(11, 16)}:00` };
}

async function partnerIdOf(userId: string): Promise<string> {
    const { data, error } = await serviceClient().from('partners').select('id').eq('user_id', userId).maybeSingle();
    if (error) throw new Error(`${TAG} partenaire du compte ${userId} : ${error.message}`);
    if (!data?.id) throw new Error(`${TAG} aucun partenaire pour le compte ${userId} (seed:test non abouti ?)`);
    return String(data.id);
}

/** Affiche déjà déposée par le partenaire (chemin admis par event_poster_path_ok) : la plus ancienne. */
async function partnerPosterUrl(partnerId: string): Promise<string> {
    const { data, error } = await serviceClient().from('events').select('image_url')
        .eq('partner_id', partnerId).not('image_url', 'is', null)
        .order('created_at', { ascending: true }).limit(1);
    if (error) throw new Error(`${TAG} affiche du partenaire ${partnerId} : ${error.message}`);
    const url = String(data?.[0]?.image_url ?? '');
    if (!url) throw new Error(`${TAG} aucun événement du partenaire ${partnerId} n'a d'affiche (seed:test non abouti ?)`);
    return url;
}

async function readSetting(key: string): Promise<unknown> {
    const { data, error } = await serviceClient().from('platform_settings').select('value').eq('key', key).maybeSingle();
    if (error) throw new Error(`${TAG} lecture du réglage ${key} : ${error.message}`);
    if (!data) throw new Error(`${TAG} réglage ${key} absent de platform_settings`);
    return (data.value as { value?: unknown } | null)?.value;
}

async function writeSetting(key: string, value: unknown, reason: string): Promise<void> {
    if (!SETTABLE_KEYS.has(key)) throw new Error(`${TAG} réglage ${key} non admis (clés admises : ${Array.from(SETTABLE_KEYS).join(', ')})`);
    const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
    const { data, error } = await serviceClient().rpc('finance_setting_set', { p_key: key, p_value: { value }, p_actor: superadminId, p_reason: reason });
    if (error) throw new Error(`${TAG} finance_setting_set ${key} : ${error.code ?? ''} ${error.message}`);
    if ((data as { ok?: boolean } | null)?.ok !== true) throw new Error(`${TAG} finance_setting_set ${key} refusé : ${JSON.stringify(data)}`);
}

interface PreparedTicket { id: string; number: string }
interface PrepareReport {
    eventId: string;
    title: string;
    startAt: string;
    endAt: string;
    categoryId: string;
    holder: HolderKey;
    holderUserId: string;
    controllerUserId: string;
    tickets: PreparedTicket[];
    setting: { key: string; previous: unknown; applied: unknown } | null;
}

async function prepare(flags: Map<string, string>): Promise<PrepareReport> {
    const label = (flags.get('label') ?? '').trim();
    if (label.length < 1 || label.length > 60 || /[<>"`$]/.test(label)) usage('--label : 1 à 60 caractères, sans < > " ` $');
    const holderRaw = flags.get('holder') ?? '';
    if (!(holderRaw in HOLDERS)) usage(`--holder : client ou client-bis, reçu « ${holderRaw} »`);
    const holder = holderRaw as HolderKey;
    const count = intFlag(flags, 'tickets', 1, 10, null);
    const startInHours = intFlag(flags, 'start-in-hours', 1, 47, 20);
    const beforeHours = flags.has('before-hours') ? intFlag(flags, 'before-hours', 0, 48, null) : null;

    const partnerUserId = await userIdByEmail(FIXTURE_USERS.PARTNER_A.email);
    const superadminId = await userIdByEmail(FIXTURE_USERS.SUPERADMIN.email);
    const controllerUserId = await userIdByEmail(FIXTURE_USERS.CONTROLLER_A.email);
    const holderUserId = await userIdByEmail(HOLDERS[holder].email);
    const partnerId = await partnerIdOf(partnerUserId);

    const start = new Date(Date.now() + startInHours * 3600_000);
    start.setUTCSeconds(0, 0);
    start.setUTCMinutes(Math.ceil(start.getUTCMinutes() / 5) * 5);
    const end = new Date(start.getTime() + 4 * 3600_000);
    const s = dakarParts(start);
    const e = dakarParts(end);
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '.');
    const title = `Terrain — ${label} ${stamp}`;

    const eventId = await createPublishedEvent({
        partnerUserId,
        superadminId,
        title,
        description: 'Événement du projet terrain (lot 7) : billet hors ligne et scanner. Données fictives.',
        startDate: s.date, startTime: s.time, endDate: e.date, endTime: e.time,
        location: 'Esplanade des Parcelles Assainies', city: 'Dakar', capacity: 100,
        imageUrl: await partnerPosterUrl(partnerId),
        category: { name: 'Entrée libre', price: 0, total: 50 },
    });

    const { data: cats, error: catErr } = await serviceClient().from('ticket_categories').select('id').eq('event_id', eventId);
    if (catErr) throw new Error(`${TAG} catégorie de ${eventId} : ${catErr.message}`);
    if (!cats || cats.length !== 1) throw new Error(`${TAG} une catégorie attendue pour ${eventId}, ${cats?.length ?? 0} trouvée(s)`);
    const categoryId = String(cats[0].id);

    const { error: assignErr } = await serviceClient().from('event_controllers')
        .upsert({ event_id: eventId, user_id: controllerUserId, can_accept_cash: false, created_by: partnerUserId }, { onConflict: 'event_id,user_id' });
    if (assignErr) throw new Error(`${TAG} affectation du contrôleur A à ${eventId} : ${assignErr.message}`);

    const { data: claim, error: claimErr } = await serviceClient().rpc('free_tickets_claim', {
        p_user_id: holderUserId, p_event_id: eventId, p_items: [{ category_id: categoryId, quantity: count }],
    });
    if (claimErr) throw new Error(`${TAG} free_tickets_claim : ${claimErr.code ?? ''} ${claimErr.message}`);
    const claimed = claim as { ok?: boolean; ticket_ids?: string[] } | null;
    if (claimed?.ok !== true || !Array.isArray(claimed.ticket_ids) || claimed.ticket_ids.length !== count) {
        throw new Error(`${TAG} free_tickets_claim refusé ou incomplet (${count} attendus) : ${JSON.stringify(claim)}`);
    }
    const { data: rows, error: tErr } = await serviceClient().from('tickets').select('id, ticket_number, status').in('id', claimed.ticket_ids);
    if (tErr) throw new Error(`${TAG} lecture des billets émis : ${tErr.message}`);
    const byId = new Map((rows ?? []).map((r) => [String(r.id), r]));
    const tickets: PreparedTicket[] = claimed.ticket_ids.map((id) => {
        const row = byId.get(id);
        if (!row || row.status !== 'VALIDE' || !row.ticket_number) throw new Error(`${TAG} billet ${id} absent ou non VALIDE : ${JSON.stringify(row ?? null)}`);
        return { id, number: String(row.ticket_number) };
    });

    const { data: ev, error: evErr } = await serviceClient().from('events').select('status').eq('id', eventId).maybeSingle();
    if (evErr) throw new Error(`${TAG} statut de ${eventId} : ${evErr.message}`);
    if (ev?.status !== 'PUBLIE') throw new Error(`${TAG} événement ${eventId} au statut ${String(ev?.status)} au lieu de PUBLIE`);

    let setting: PrepareReport['setting'] = null;
    if (beforeHours !== null) {
        const key = 'access.scan_window_before_hours';
        const previous = await readSetting(key);
        await writeSetting(key, beforeHours, `projet e2e terrain (lot 7) : ${label}`);
        setting = { key, previous, applied: beforeHours };
    }
    return {
        eventId, title, startAt: start.toISOString(), endAt: end.toISOString(), categoryId, holder, holderUserId, controllerUserId, tickets, setting,
    };
}

async function restoreSetting(flags: Map<string, string>): Promise<{ key: string; restored: unknown }> {
    const key = flags.get('key') ?? '';
    if (!SETTABLE_KEYS.has(key)) usage(`--key : ${Array.from(SETTABLE_KEYS).join(' ou ')}`);
    const raw = flags.get('value');
    if (raw === undefined) usage('--value obligatoire (JSON)');
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch (err) {
        usage(`--value illisible : ${err instanceof Error ? err.message : String(err)}`);
    }
    await writeSetting(key, value, 'restauration après le projet e2e terrain (lot 7)');
    const now = await readSetting(key);
    if (JSON.stringify(now) !== JSON.stringify(value)) throw new Error(`${TAG} ${key} vaut ${JSON.stringify(now)} après restauration, attendu ${JSON.stringify(value)}`);
    return { key, restored: now };
}

interface ScanRow { result: string; accepted: boolean; method: string; scanner_id: string; created_at: string }

async function scans(flags: Map<string, string>): Promise<{ ticket: { id: string; status: string; checked_in_at: string | null }; scans: ScanRow[] }> {
    const id = flags.get('ticket') ?? '';
    if (!UUID_RE.test(id)) usage(`--ticket : identifiant de billet invalide « ${id} »`);
    const { data: t, error: tErr } = await serviceClient().from('tickets').select('id, status, checked_in_at').eq('id', id).maybeSingle();
    if (tErr) throw new Error(`${TAG} billet ${id} : ${tErr.message}`);
    if (!t) throw new Error(`${TAG} billet ${id} introuvable`);
    const { data, error } = await serviceClient().from('ticket_scans').select('result, accepted, method, scanner_id, created_at')
        .eq('ticket_id', id).order('created_at', { ascending: true });
    if (error) throw new Error(`${TAG} lignes ticket_scans de ${id} : ${error.message}`);
    return { ticket: { id: String(t.id), status: String(t.status), checked_in_at: (t.checked_in_at as string | null) ?? null }, scans: (data ?? []) as ScanRow[] };
}

interface PayloadReport {
    ticket_id: string;
    status: string;
    secret_version: number | null;
    step_seconds: number;
    counter: number;
    code: string;
    payload: string;
    computed_at: string;
    /** Millisecondes avant le pas suivant, à l'heure du calcul. */
    next_step_in_ms: number;
    /** Attente réelle du pas suivant (--not-code), en millisecondes. */
    waited_ms: number;
}

async function payload(flags: Map<string, string>): Promise<PayloadReport> {
    const id = (flags.get('ticket') ?? '').toLowerCase();
    if (!UUID_RE.test(id)) usage(`--ticket : identifiant de billet invalide « ${id} »`);
    const notCode = flags.get('not-code') ?? null;
    if (notCode !== null && !/^\d{6}$/.test(notCode)) usage(`--not-code : 6 chiffres attendus, reçu « ${notCode} »`);
    if (!process.env.TICKET_TOTP_MASTER_KEY) throw new Error(`${TAG} TICKET_TOTP_MASTER_KEY absente de l'environnement (.env.e2e) : code dynamique incalculable`);
    // Import différé : seule cette commande charge lib/env (validation de tout l'environnement serveur)
    const totp = await import('../../lib/security/totp');
    const { data: t, error } = await serviceClient().from('tickets').select('id, status, totp_secret, security_version').eq('id', id).maybeSingle();
    if (error) throw new Error(`${TAG} billet ${id} : ${error.message}`);
    if (!t) throw new Error(`${TAG} billet ${id} introuvable`);
    const secret = String(t.totp_secret ?? '');
    const started = Date.now();
    let at = new Date();
    let code = totp.generateTicketCode(id, secret, at);
    if (notCode !== null && code === notCode) {
        const nextStep = (totp.counterAt(at) + 1) * totp.TOTP_STEP_SECONDS * 1000;
        const waitMs = Math.max(0, nextStep - Date.now()) + 50;
        if (waitMs > (totp.TOTP_STEP_SECONDS * 1000) + 1000) throw new Error(`${TAG} attente du pas suivant incohérente : ${waitMs} ms`);
        await new Promise<void>((resolve) => { setTimeout(resolve, waitMs); });
        at = new Date();
        code = totp.generateTicketCode(id, secret, at);
        if (code === notCode) throw new Error(`${TAG} billet ${id} : même code au pas suivant (${totp.counterAt(at)}), collision improbable`);
    }
    if (!totp.verifyTicketCode(id, secret, code, at)) throw new Error(`${TAG} billet ${id} : le code calculé ne se vérifie pas (lib/security/totp.ts)`);
    const counter = totp.counterAt(at);
    const built = totp.buildTicketPayload(id, code);
    const parsed = totp.parseTicketPayload(built);
    if (!parsed || parsed.ticketId !== id || parsed.code !== code) throw new Error(`${TAG} payload construit illisible par parseTicketPayload : « ${built} »`);
    const version = t.security_version === null || t.security_version === undefined ? null : Number(t.security_version);
    return {
        ticket_id: id,
        status: String(t.status),
        secret_version: version,
        step_seconds: totp.TOTP_STEP_SECONDS,
        counter,
        code,
        payload: built,
        computed_at: at.toISOString(),
        next_step_in_ms: (counter + 1) * totp.TOTP_STEP_SECONDS * 1000 - at.getTime(),
        waited_ms: Date.now() - started,
    };
}

async function main(): Promise<void> {
    const [command, ...rest] = process.argv.slice(2);
    if (command !== 'prepare' && command !== 'restore-setting' && command !== 'scans' && command !== 'payload') usage(`commande inconnue : ${command ?? '(aucune)'}`);
    const flags = parseFlags(rest);
    e2eConfig();
    if (process.env.EV_INTEGRATIONS) usage('EV_INTEGRATIONS est défini : le projet terrain utilise les vrais adaptateurs pointés sur les faux services.');
    const report = command === 'prepare' ? await prepare(flags)
        : command === 'restore-setting' ? await restoreSetting(flags)
        : command === 'scans' ? await scans(flags)
        : await payload(flags);
    process.stdout.write(`${JSON.stringify(report)}\n`);
}

main().catch((err: unknown) => {
    process.stderr.write(`${TAG} ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
});
