/**
 * Lot 9 bis, tâche 41 (R73, R74, R80, R107 ; contrat 5.41, B85, 11.2 M1, M9 à M21) — textes des SMS, sans base.
 *  - R73 : les 7 envois synchrones (SyncType) commencent par « Event Village : », en GSM-7 de base, un segment, au
 *    texte exact de la section 11 (M11 à M17) ; invitation d'un contrôleur sur un segment avec un prénom hors GSM-7
 *    (« Maïmouna », « Ousmanê ») ou de 40 lettres (prénom borné à 9, smsVar) ; CONTROLLER_ASSIGNED et
 *    CONTROLLER_UNASSIGNED au singulier « et 1 autre. » ;
 *  - R74 : aucun SMS du catalogue, rendu avec des valeurs longues (troncature « ... »), ne contient « .... » ;
 *  - R80 : EVENT_CHANGED `{ changed_fields: ['address'], address_cleared: true }` → « adresse retirée » (M1) ;
 *  - R107 : OTP_WITHDRAWAL a son texte dédié, avec le mot « retrait » (M16).
 * Le calcul GSM-7 est fait ICI (table GSM 03.38), jamais par le module testé. Lien d'activation tel que la route
 * d'invitation le construit (`encodeURIComponent('+221…')`, app/api/partner/team/invite/route.ts:405) : 3 caractères de
 * plus que la mesure du contrat, 160 septets au pire, toujours un segment.
 *
 * Rouge avant correctif (fix(9b.registre), S-D) : textes actuels de renderSyncSms (lib/notifications/catalog.ts:1257,
 * :1259, :1263-1265 : sans préfixe, « verification », « Event Village: », prénom brut, 2 à 3 segments) ; « et 1 autres »
 * (:960, :976) ; « .... » après troncature (PURCHASE_CONFIRMED, EVENT_CHANGED lieu, REMINDER_J1, FIRST_TICKET_SOLD) ;
 * « change de lieu : CICAD » au lieu de « adresse retirée » ; OTP_WITHDRAWAL au texte générique.
 * Suite sans base et sans écriture : aucune aide d'invariants en after() (signalé).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFICATION_CATALOG, renderSyncSms, type RenderContext, type SyncType } from '../../lib/notifications/catalog';

type Data = Record<string, unknown>;
type SmsRender = (d: Data, ctx: RenderContext) => string;
interface Entry { channels: readonly string[]; sms?: SmsRender; sample: Data }

const CATALOG = NOTIFICATION_CATALOG as unknown as Record<string, Entry>;

// ── GSM 03.38 : calcul indépendant du module testé ─────────────────────────

const GSM7_BASIC = new Set(Array.from(
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
));
const GSM7_EXTENSION = new Set(Array.from('\f^{}\\[~]|€'));

interface Measure { encoding: 'GSM7' | 'UCS2'; length: number; segments: number }

function measure(text: string): Measure {
    let septets = 0;
    for (const ch of Array.from(text)) {
        if (GSM7_BASIC.has(ch)) septets += 1;
        else if (GSM7_EXTENSION.has(ch)) septets += 2;
        else return { encoding: 'UCS2', length: text.length, segments: text.length <= 70 ? 1 : Math.ceil(text.length / 67) };
    }
    return { encoding: 'GSM7', length: septets, segments: septets <= 160 ? 1 : Math.ceil(septets / 153) };
}

function assertOneGsmSegment(text: string, what: string): void {
    const m = measure(text);
    assert.equal(m.encoding, 'GSM7', `${what} : hors GSM-7 (${JSON.stringify(Array.from(text).filter((c) => !GSM7_BASIC.has(c) && !GSM7_EXTENSION.has(c)))}) — ${text}`);
    assert.equal(m.segments, 1, `${what} : ${m.length} septets, ${m.segments} segments au lieu d'un — ${text}`);
}

// ── Données ────────────────────────────────────────────────────────────────

const APP_URL = 'https://app.eventvillage.sn';
const CTX: RenderContext = { appUrl: APP_URL };
const PREFIX = 'Event Village : ';
const CODE = '483920';
/** Lien d'activation tel que la route d'invitation le construit (numéro encodé). */
const SETUP_LINK = `${APP_URL}/controller/setup?phone=${encodeURIComponent('+221771234567')}`;
/** Prénom de 40 lettres, en ASCII : borné à 9 septets par smsVar (6 lettres et « ... »). */
const NAME_40 = 'Aminatabintoumariamafatoundeyesokhnadiop';

/** Texte saisi long, entièrement translittérable (troncature « ... » garantie). */
const LONG_GSM_TEXT = 'Grande soirée « Ndëkk » – l’été à Saly : édition spéciale où ça va être très, très grand… vraiment très long';
const LONGEST_DATE = '2026-09-30T20:00:00.000Z';
const FREE_TEXT_KEYS = new Set(['title', 'location', 'city', 'reason', 'company', 'category', 'controller_name', 'entry_point',
    'justification', 'public_notice', 'address', 'new_location', 'new_address', 'old_title', 'plan', 'hall_name', 'blocked_reason']);
const AMOUNT_KEYS = new Set(['amount', 'total', 'declared', 'price']);
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function clone(d: Data): Data {
    return JSON.parse(JSON.stringify(d)) as Data;
}

function dataFrom(sample: Data, over: Data, drop: string[] = []): Data {
    const d: Data = { ...clone(sample), ...over };
    for (const k of drop) delete d[k];
    return d;
}

/** Valeurs longues réalistes (patron de notif-modeles.test.ts, G3) appliquées au sample. */
function stress(sample: Data, value: string): Data {
    const d = clone(sample);
    const walk = (o: Data): void => {
        for (const [k, v] of Object.entries(o)) {
            if (typeof v === 'string' && FREE_TEXT_KEYS.has(k)) o[k] = value;
            else if (typeof v === 'string' && ISO_RE.test(v)) o[k] = LONGEST_DATE;
            else if (typeof v === 'number' && AMOUNT_KEYS.has(k)) o[k] = 9_999_999;
            else if (typeof v === 'number' && k === 'service_fee') o[k] = 99_999;
            else if (typeof v === 'number' && k === 'ticket_count') o[k] = 10;
            else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v as Data);
        }
    };
    walk(d);
    if (Array.isArray(d.events) && d.events.length > 0) {
        const first = d.events[0] as Data;
        d.events = Array.from({ length: 99 }, (_, i) => ({ ...first, title: `${value} ${i}`, start_at: LONGEST_DATE }));
    }
    return d;
}

/** Variantes de rendu d'un type (une par texte possible), comme G3. */
function variants(type: string, base: Data): Data[] {
    if (type === 'EVENT_CANCELLED') return ['AUTO', 'ORGANIZER', 'NONE'].map((refund_mode) => ({ ...base, refund_mode }));
    if (type === 'EVENT_CHANGED') {
        const b = dataFrom(base, {}, ['new_start_at', 'new_end_at', 'new_location', 'new_address', 'old_title']);
        return [
            { ...b, changed_fields: ['start_date', 'start_time'], new_start_at: LONGEST_DATE },
            { ...b, changed_fields: ['end_date', 'end_time'], new_end_at: LONGEST_DATE },
            { ...b, changed_fields: ['location'], new_location: LONG_GSM_TEXT },
            { ...b, changed_fields: ['start_date', 'location'], new_start_at: LONGEST_DATE, new_location: LONG_GSM_TEXT },
            { ...b, changed_fields: ['address'], address_cleared: true },
        ];
    }
    if (type === 'CONTROLLER_REMINDER' || type === 'CONTROLLER_ASSIGNED') {
        return [{ ...base, can_accept_cash: false }, { ...base, can_accept_cash: true }, { ...base, entry_point: null }];
    }
    return [base];
}

function smsEntries(): Array<[string, Entry]> {
    return Object.entries(CATALOG).filter(([, e]) => e.channels.includes('SMS') && typeof e.sms === 'function');
}

function entry(type: string): Entry {
    const e = CATALOG[type];
    assert.ok(e && typeof e.sms === 'function', `${type} : type SMS absent du catalogue`);
    return e;
}

// ── R73 et R107 : envois synchrones ────────────────────────────────────────

const SYNC_TYPES: SyncType[] = ['OTP_LOGIN', 'OTP_REGISTER', 'OTP_PASSWORD_RESET', 'OTP_WITHDRAWAL', 'OTP_PHONE_CHANGE', 'OTP_AUTH_HOOK', 'CONTROLLER_INVITE'];

describe('R73 — envois synchrones : préfixe « Event Village : », GSM-7 de base, un segment', () => {
    test('les 7 SyncType commencent par « Event Village : », en GSM-7, un segment', () => {
        const issues: string[] = [];
        for (const type of SYNC_TYPES) {
            const text = renderSyncSms(type, { code: CODE, firstName: 'Awa', setupLink: SETUP_LINK });
            if (!text.startsWith(PREFIX)) issues.push(`${type} : préfixe « Event Village : » absent — ${text}`);
            const m = measure(text);
            if (m.encoding !== 'GSM7' || m.segments !== 1) issues.push(`${type} : ${m.encoding}, ${m.length}, ${m.segments} segment(s) — ${text}`);
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('codes de vérification (M11 à M14) et de réinitialisation (M15) : textes exacts de la section 11', () => {
        for (const type of ['OTP_LOGIN', 'OTP_REGISTER', 'OTP_PHONE_CHANGE', 'OTP_AUTH_HOOK'] as const) {
            const text = renderSyncSms(type, { code: CODE });
            assert.equal(text, `Event Village : votre code de vérification est ${CODE}. Valable 10 minutes.`, `${type} (M11 à M14)`);
            assert.deepEqual(measure(text), { encoding: 'GSM7', length: 74, segments: 1 }, `${type} : 74 septets`);
        }
        const reset = renderSyncSms('OTP_PASSWORD_RESET', { code: CODE });
        assert.equal(reset, `Event Village : votre code de réinitialisation du mot de passe est ${CODE}. Valable 10 minutes.`, 'OTP_PASSWORD_RESET (M15)');
        assert.deepEqual(measure(reset), { encoding: 'GSM7', length: 94, segments: 1 }, 'OTP_PASSWORD_RESET : 94 septets');
    });

    test('invitation d’un contrôleur (M17) : texte exact, avec et sans prénom, lien inchangé', () => {
        const withName = renderSyncSms('CONTROLLER_INVITE', { code: CODE, firstName: 'Awa', setupLink: SETUP_LINK });
        assert.equal(withName, `Event Village : Bonjour Awa, code d'activation ${CODE} (24 h) pour scanner les billets : ${SETUP_LINK}`, 'avec prénom');
        assertOneGsmSegment(withName, 'invitation, prénom « Awa »');
        const anonymous = renderSyncSms('CONTROLLER_INVITE', { code: CODE, setupLink: SETUP_LINK });
        assert.equal(anonymous, `Event Village : code d'activation ${CODE} (24 h) pour scanner les billets : ${SETUP_LINK}`, 'sans prénom');
        assertOneGsmSegment(anonymous, 'invitation sans prénom');
    });

    test('invitation : prénoms « Maïmouna », « Ousmanê » et prénom de 40 lettres → translittérés, bornés à 9, un segment GSM-7', () => {
        assert.equal(NAME_40.length, 40, 'précondition : prénom de 40 lettres');
        const cases: Array<[string, string]> = [['Maïmouna', 'Maimouna'], ['Ousmanê', 'Ousmane'], [NAME_40, 'Aminat...']];
        const issues: string[] = [];
        for (const [firstName, shown] of cases) {
            const text = renderSyncSms('CONTROLLER_INVITE', { code: CODE, firstName, setupLink: SETUP_LINK });
            const expected = `Event Village : Bonjour ${shown}, code d'activation ${CODE} (24 h) pour scanner les billets : ${SETUP_LINK}`;
            if (text !== expected) issues.push(`« ${firstName} »\n  reçu    : ${text}\n  attendu : ${expected}`);
            const m = measure(text);
            if (m.encoding !== 'GSM7' || m.segments !== 1) issues.push(`« ${firstName} » : ${m.encoding}, ${m.length}, ${m.segments} segment(s) au lieu d'un`);
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });
});

describe('R107 — code de retrait : texte dédié (M16)', () => {
    test('OTP_WITHDRAWAL : « Event Village : votre code de retrait est … Ne le donnez à personne. », 94 septets', () => {
        const text = renderSyncSms('OTP_WITHDRAWAL', { code: CODE });
        assert.match(text, /retrait/, `le code de retrait ne dit pas « retrait » : ${text}`);
        assert.equal(text, `Event Village : votre code de retrait est ${CODE}. Valable 10 minutes. Ne le donnez à personne.`, 'texte exact M16');
        assert.deepEqual(measure(text), { encoding: 'GSM7', length: 94, segments: 1 });
    });
});

// ── R73 : pluriel des affectations ─────────────────────────────────────────

describe('R73 — CONTROLLER_ASSIGNED et CONTROLLER_UNASSIGNED : « et 1 autre. » au singulier (M9, M10)', () => {
    function twoEvents(e: Entry): Data {
        const events = (e.sample.events as Data[]).slice(0, 1);
        assert.equal(events.length, 1, 'sample : au moins une affectation');
        return { ...clone(e.sample), events: [events[0], { ...events[0], event_id: '0d1f2e3c-4b5a-4968-8776-655443322110', title: 'Nuit du Mbalax' }] };
    }

    test('deux affectations : « , et 1 autre. » (aujourd’hui « et 1 autres »)', () => {
        const assigned = entry('CONTROLLER_ASSIGNED').sms!(twoEvents(entry('CONTROLLER_ASSIGNED')), CTX);
        assert.ok(assigned.endsWith(`, et 1 autre. ${APP_URL}/login`), `CONTROLLER_ASSIGNED : ${assigned}`);
        const unassigned = entry('CONTROLLER_UNASSIGNED').sms!(twoEvents(entry('CONTROLLER_UNASSIGNED')), CTX);
        assert.ok(unassigned.endsWith(' est retirée, et 1 autre.'), `CONTROLLER_UNASSIGNED : ${unassigned}`);
    });

    test('témoin : trois affectations restent au pluriel « et 2 autres. »', () => {
        for (const type of ['CONTROLLER_ASSIGNED', 'CONTROLLER_UNASSIGNED']) {
            const e = entry(type);
            const d = twoEvents(e);
            d.events = [...(d.events as Data[]), { ...(d.events as Data[])[0], event_id: '1e2f3a4b-5c6d-4e7f-8091-a2b3c4d5e6f7', title: 'Soirée Sabar' }];
            const text = e.sms!(d, CTX);
            assert.match(text, /, et 2 autres\./, `${type} : ${text}`);
        }
    });
});

// ── R74 : « .... » ─────────────────────────────────────────────────────────

describe('R74 — aucun SMS ne finit une valeur tronquée par « .... »', () => {
    test('chaque type SMS du catalogue, valeurs longues et variantes : aucun « .... »', () => {
        const entries = smsEntries();
        assert.ok(entries.length >= 20, `types SMS du catalogue : ${entries.length}`);
        const issues: string[] = [];
        for (const [type, e] of entries) {
            for (const d of variants(type, stress(e.sample, LONG_GSM_TEXT))) {
                let text: string;
                try {
                    text = e.sms!(d, CTX);
                } catch (err) {
                    issues.push(`${type} : rendu impossible avec des valeurs longues (${(err as Error).message})`);
                    continue;
                }
                if (text.includes('....')) issues.push(`${type} : « .... » — ${text}`);
            }
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });
});

// ── R80 : adresse retirée ──────────────────────────────────────────────────

describe('R80 — EVENT_CHANGED, adresse retirée : « adresse retirée, lieu … » (M1)', () => {
    const CLEARED = { changed_fields: ['address'], address_cleared: true };
    const DROP = ['new_start_at', 'new_end_at', 'new_location', 'new_address', 'old_title'];

    test('valeurs courtes : texte exact, aucun « change de lieu »', () => {
        const e = entry('EVENT_CHANGED');
        const text = e.sms!(dataFrom(e.sample, { ...CLEARED, title: 'Gala Dakar', location: 'CICAD' }, DROP), CTX);
        assert.equal(text, `Event Village : Gala Dakar : adresse retirée, lieu CICAD. Billets toujours valables. ${APP_URL}/tickets`,
            'texte de la section 11 (M1, variante « adresse retirée »)');
        assertOneGsmSegment(text, 'adresse retirée, valeurs courtes');
    });

    test('valeurs longues : un segment GSM-7, aucun « .... », toujours « adresse retirée »', () => {
        const e = entry('EVENT_CHANGED');
        const text = e.sms!(dataFrom(stress(e.sample, LONG_GSM_TEXT), CLEARED, DROP), CTX);
        assert.match(text, /^Event Village : .+ : adresse retirée, lieu .+ Billets toujours valables\. https:\/\/app\.eventvillage\.sn\/tickets$/, text);
        assert.ok(!text.includes('....'), `« .... » : ${text}`);
        assertOneGsmSegment(text, 'adresse retirée, valeurs longues');
    });
});
