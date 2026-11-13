/**
 * Lot 9 bis, tâche I2 (contrat 4.7, 5.64, B109 ; textes D-ree 2) — cœur pur de npm run essai:check-reel.
 *
 * Aucun réseau ici : choix du projet visé et refus, lecture de la réponse de la RPC public.essai_check_reel
 * (migration 20261109000012_lot9bis_mode_reel), rendu des rubriques et du code de sortie. Seuls des champs choisis
 * sont affichés : jamais la clé, jamais un numéro ni une adresse, même présents dans la réponse.
 *
 * Codes de sortie : 0 rien ne partirait en réel ; 1 au moins une rubrique à traiter ; 2 contrôle impossible.
 */

export const RPC_PATH = '/rest/v1/rpc/essai_check_reel';
export const TAG = '[check-reel]';
export const EXIT_CLEAR = 0;
export const EXIT_FOUND = 1;
export const EXIT_IMPOSSIBLE = 2;

export const MISSING_FUNCTION_TEXT = `${TAG} contrôle impossible : fonction essai_check_reel absente. Appliquez les migrations 20261109 (docs/essai-local.md, section 3).`;
export const CLEAR_TEXT = `${TAG} Rien ne partirait en réel : vous pouvez passer en réel (docs/essai-local.md, « Tout en réel depuis votre PC »).`;

const HOSTED_PROJECT = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const RUBRICS = ['outbox', 'payments', 'cashouts', 'tickets', 'seed_events_on_sale'];
const EXAMPLES_SHOWN = 10;

/**
 * Projet visé, ou refus nommé (aucune valeur affichée) : URL https ou de la boucle locale, sans identifiant ;
 * EV_DEV_PROJECT_REF, si elle est posée, doit être la référence du projet hébergé de NEXT_PUBLIC_SUPABASE_URL.
 * @param {Record<string, string | undefined>} env
 * @returns {{ url: string, key: string, label: string }}
 */
export function resolveCheckTarget(env) {
    const raw = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim();
    const key = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
    if (!raw) throw new Error('NEXT_PUBLIC_SUPABASE_URL absente de .env.local.');
    if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente de .env.local.');
    if (!URL.canParse(raw)) throw new Error('NEXT_PUBLIC_SUPABASE_URL illisible : refus.');
    const url = new URL(raw);
    const local = LOCAL_HOSTS.has(url.hostname);
    if (url.username !== '' || url.password !== '' || !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL doit être en https, ou une adresse locale (localhost, 127.0.0.1) : refus.');
    }
    const hosted = HOSTED_PROJECT.exec(raw);
    const expectedRef = (env.EV_DEV_PROJECT_REF ?? '').trim();
    if (expectedRef && (!hosted || hosted[1] !== expectedRef)) {
        throw new Error('EV_DEV_PROJECT_REF diffère de la référence du projet de NEXT_PUBLIC_SUPABASE_URL : refus.');
    }
    return { url: url.origin, key, label: hosted ? hosted[1] : `local (${url.host})` };
}

export function projectLine(label) {
    return `${TAG} projet ${label} : lecture seule, aucune écriture.`;
}

function isCount(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isRubric(value, listKey) {
    return value !== null && typeof value === 'object' && isCount(value.total)
        && (listKey === null || Array.isArray(value[listKey]));
}

/**
 * Lecture de la réponse HTTP de la RPC.
 * @param {number} status
 * @param {string} text
 * @returns {{ kind: 'ok', reply: any } | { kind: 'missing' } | { kind: 'error', message: string }}
 */
export function readReply(status, text) {
    let body = null;
    let parsed = false;
    if (text) {
        try {
            body = JSON.parse(text);
            parsed = true;
        } catch {
            parsed = false;
        }
    }
    const code = parsed && body && typeof body === 'object' && typeof body.code === 'string' ? body.code : null;
    if (status === 404 || code === 'PGRST202') return { kind: 'missing' };
    if (status < 200 || status >= 300) return { kind: 'error', message: `réponse HTTP ${status}${code ? ` (code ${code})` : ''} de la fonction essai_check_reel.` };
    if (!parsed) return { kind: 'error', message: 'réponse illisible de la fonction essai_check_reel (JSON attendu).' };
    const shape = { outbox: null, payments: 'examples', cashouts: 'examples', tickets: 'events', seed_events_on_sale: 'events' };
    const complete = body && typeof body === 'object' && body.ok === true
        && RUBRICS.every((name) => isRubric(body[name], shape[name]))
        && ['sms', 'email', 'push'].every((channel) => isCount(body.outbox[channel]));
    if (!complete) return { kind: 'error', message: 'réponse sans les rubriques attendues de la fonction essai_check_reel.' };
    return { kind: 'ok', reply: body };
}

function text(value, max = 120) {
    return typeof value === 'string' ? value.slice(0, max) : '';
}

function amount(value) {
    return typeof value === 'number' && Number.isFinite(value) ? `${value} F CFA` : 'montant inconnu';
}

function eventList(events) {
    return events.map((e) => `« ${text(e?.title)} » (${text(e?.start_date, 10)})`).join(', ');
}

/**
 * Lignes du rapport et code de sortie. Seuls ces champs sont lus : outbox (compteurs), payments.examples
 * (id, created_at, amount), cashouts.examples (id, kind, status, amount), tickets.events et seed_events_on_sale.events
 * (title, start_date).
 * @param {any} reply réponse lue par readReply
 * @returns {{ lines: string[], code: number }}
 */
/**
 * Lot 9 quinquies (B1 : AUTH-06 ; A4 : AUTH-04) — points de configuration avant une séance réelle : au moins un contact du
 * support renseigné (champ `support.filled` de la RPC, migration 20261112000009) ; délai d'inactivité de l'administration
 * au plus 30 minutes (ADMIN_IDLE_TIMEOUT_MINUTES n'est relevé que pour l'e2e). Rend { lines, points }.
 */
export function configReport(reply, env) {
    const lines = [];
    let points = 0;
    const filled = Number(reply?.support?.filled);
    if (!Number.isInteger(filled)) {
        points += 1;
        lines.push('Contact du support non contrôlé : appliquez la migration 20261112000009 (lot 9 quinquies).');
    } else if (filled === 0) {
        points += 1;
        lines.push('Contact du support absent : renseignez au moins un réglage (WhatsApp, téléphone ou email du support) dans Administration > Réglages > Contact du support.');
    }
    const idle = String(env?.ADMIN_IDLE_TIMEOUT_MINUTES ?? '').trim();
    if (idle !== '' && !(Number.isInteger(Number(idle)) && Number(idle) <= 30)) {
        points += 1;
        lines.push(`ADMIN_IDLE_TIMEOUT_MINUTES=${idle.slice(0, 6)} : au plus 30 en réel (le mot de passe de l'administration est redemandé après 30 minutes sans activité). Retirez la variable.`);
    }
    return { lines, points };
}

export function report(reply, env = {}) {
    const lines = [];
    let points = 0;

    const { outbox, payments, cashouts, tickets, seed_events_on_sale: seed } = reply;
    if (outbox.total > 0) {
        points += 1;
        lines.push(`Notifications en file : ${outbox.total} (SMS ${outbox.sms}, email ${outbox.email}, push ${outbox.push}). Laissez cron:local tourner en simulé jusqu'à 0.`);
    }
    if (payments.total > 0) {
        points += 1;
        lines.push(`Paiements simulés en attente : ${payments.total}. Validez-les ou refusez-les sur /dev/paiements.`);
        for (const p of payments.examples.slice(0, EXAMPLES_SHOWN)) lines.push(`  - paiement ${text(p?.id, 36)} du ${text(p?.created_at, 32)} : ${amount(p?.amount)}`);
    }
    if (cashouts.total > 0) {
        points += 1;
        lines.push(`Versements simulés en cours ou vers un compte de démonstration : ${cashouts.total}. Laissez-les aboutir en simulé.`);
        for (const c of cashouts.examples.slice(0, EXAMPLES_SHOWN)) lines.push(`  - versement ${text(c?.id, 36)} (${text(c?.kind, 40)}, ${text(c?.status, 20)}) : ${amount(c?.amount)}`);
    }
    if (tickets.total > 0) {
        points += 1;
        lines.push(`Billets de démonstration sur des événements à venir : ${tickets.total}, sur ${tickets.events.length} événement(s) : ${eventList(tickets.events)}. Annulez ces événements en simulé, ou attendez leur fin.`);
    }
    if (seed.total > 0) {
        lines.push(`Pour information : ${seed.total} événement(s) de démonstration encore en vente, sans effet sur ce contrôle : ${eventList(seed.events)}. En réel, leurs messages restent retenus (compte de démonstration).`);
    }

    // Lot 9 quinquies (B1, A4) : configuration avant le réel
    const config = configReport(reply, env);
    lines.push(...config.lines);
    points += config.points;

    if (points === 0) {
        lines.push(CLEAR_TEXT);
        return { lines, code: EXIT_CLEAR };
    }
    lines.push(`${TAG} ${points} point(s) à traiter avant le réel : ne retirez pas EV_INTEGRATIONS=fake.`);
    return { lines, code: EXIT_FOUND };
}
