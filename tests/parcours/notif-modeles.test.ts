/**
 * Lot 6, tâche 6.3 — catalogue unique des modèles de messages (contrat G1 à G4, F2, F3 ; S2 « Canaux »).
 *  - registre SQL public.notification_types = NOTIFICATION_CATALOG (type, famille, sujet, canaux,
 *    audience, politique « compte suspendu », journal synchrone, permission admin), et les deux = table G2
 *    (lot 9 bis, T51 : G.49 annule l'amendement 2, EMAIL pour TRANSFER_OFFERED et TRANSFER_CANCELLED ; 26 types nouveaux, 11.1) ;
 *  - chaque type rend chaque canal qu'il déclare avec son `sample` ; aucune variable manquante ni
 *    `{…}`, `undefined`, `null`, `NaN`, `[object Object]` ; TemplateDataError sur une variable absente ;
 *  - SMS : préfixe « Event Village : », un seul SMS GSM-7 (≤ 160) avec les valeurs maximales réalistes de
 *    G3 et une URL de 27 caractères (https://app.eventvillage.sn), texte fixe sans caractère hors GSM-7,
 *    caractère hors GSM-7 retiré (lot 9 bis, R27 : un segment GSM-7, renforcé) ; textes exacts G3 pour des valeurs courtes ;
 *    OTP et invitation (renderSyncSms) : textes du lot 9 bis (R73, R107), l'invitation sur un segment ;
 *  - liens : chemin interne seulement (`/…`, jamais `//` ni schéma), URL de l'application + chemin dans le
 *    SMS et l'email, aucun raccourcisseur ; jamais `claim`, `token` ni code à 6 chiffres hors OTP ;
 *    aucun emoji, aucun « § », aucun code technique affiché ;
 *  - in-app : titres exacts de G4, variables non tronquées ; push : titre in-app, corps ≤ 160 ;
 *    email : sujet « {titre} — Event Village », HTML échappé, bouton vers l'application, pied de
 *    désabonnement pour les familles optionnelles seulement ;
 *  - formats partagés : smsAmount (espace simple), formatFcfa (U+00A0), smsDateTime / smsShortDateTime /
 *    smsTime à l'heure de Dakar (jours et mois du contrat, « aout »), smsSegments, smsVar
 *    (translittération, espaces repliés, troncature avec « ... »).
 * Le calcul GSM-7 / UCS-2 est fait ICI (table GSM 03.38 de base et extension), jamais par le module testé.
 *
 * Lot 7, tâche 7.0 a (T34) : types ADMIN_SMS_OPTIONAL_80 et ADMIN_SMS_FORECAST ajoutés à la table attendue.
 * Lot 7, tâche 7.9 (T25 à T27) : TRANSFER_RECEIVED reçoit l'email (D91) ; les emails de PURCHASE_CONFIRMED,
 * FREE_TICKETS_CONFIRMED et TRANSFER_RECEIVED ont le bouton « Voir mes billets » et les phrases obligatoires
 * (D93, exception nommée de la règle générique) ; contenu in-app de TRANSFER_RECEIVED avec le numéro (D94).
 *
 * Lot 8, T7 (contrat 10.1 et 6.1) : le lien de PAYMENT_SUCCESS dépend de la cible du paiement (8.2 m : liens
 * admis /orders et /partner/subscription) ; type ADMIN_DUPLICATE_PAYMENT ajouté à la table attendue (8.2 a).
 * Rouge jusqu'à fix(8.2m) : lien d'un abonnement (lib/notifications/catalog.ts:882, link: () => '/orders').
 * Rouge jusqu'à fix(8.2a) : le type n'est pas au catalogue ; chaque boucle sur la table le nomme par known().
 *
 * Noms de variables fixés par ce test là où le contrat se tait (G2 « Données », placeholders de G4) :
 * title, location, city, start_at, event_id ; ticket_count, service_fee, total (achat, billets gratuits) ;
 * amount, reference (guichet, retraits, remboursements) ; operator (code WAVE | ORANGE_MONEY, affiché
 * « Wave » / « Orange Money ») ; expires_at (transferts) ; refund_mode (AUTO | ORGANIZER | NONE) ;
 * changed_fields (noms de colonnes du lot 5 : start_date, start_time, end_date, end_time, location,
 * address) avec new_start_at, new_end_at, new_location ; reason (motifs) ; company (société) ; category
 * (catégorie) ; days (essai) ; controller_name, difference (écart signé) ; entry_point (null = absent),
 * can_accept_cash, events (affectations agrégées). Les données de chaque rendu partent du `sample` du
 * catalogue, surchargé par ces noms.
 *
 * Rouge avant correctif : lib/notifications/catalog.ts, lib/notifications/sms-format.ts et la table
 * public.notification_types n'existent pas (chaque cas échoue en nommant le module ou la table absents).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFcfa } from '../../lib/format';
import { NOTIFICATION_TYPE_META } from '../../lib/notifications/notification-types';
import { service } from './paiement-helpers';
import { assertNotificationInvariants, loadLotModule } from './notif-helpers';

after(async () => {
    await assertNotificationInvariants('notif-modeles');
});

// ── GSM 03.38 : calcul indépendant du module testé ─────────────────────────

/** Alphabet GSM-7 de base (127 caractères imprimables, l'échappement 0x1B exclu). */
const GSM7_BASIC = new Set(Array.from(
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
));
/** Table d'extension (chaque caractère coûte 2 septets). */
const GSM7_EXTENSION = new Set(Array.from('\f^{}\\[~]|€'));

interface SmsMeasure { encoding: 'GSM7' | 'UCS2'; length: number; segments: number }

function measureSms(text: string): SmsMeasure {
    let septets = 0;
    for (const ch of Array.from(text)) {
        if (GSM7_BASIC.has(ch)) septets += 1;
        else if (GSM7_EXTENSION.has(ch)) septets += 2;
        else {
            const units = text.length; // UTF-16
            return { encoding: 'UCS2', length: units, segments: units <= 70 ? 1 : Math.ceil(units / 67) };
        }
    }
    return { encoding: 'GSM7', length: septets, segments: septets <= 160 ? 1 : Math.ceil(septets / 153) };
}

function nonGsmChars(text: string): string[] {
    return Array.from(new Set(Array.from(text).filter((ch) => !GSM7_BASIC.has(ch) && !GSM7_EXTENSION.has(ch))));
}

// ── Types du catalogue (contrat G1), décrits localement ────────────────────

type Ch = 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';
type Data = Record<string, unknown>;
interface Ctx { appUrl: string }

interface CatalogEntry {
    type: string;
    family: 'ESSENTIAL' | 'OPTIONAL';
    topic: 'REMINDERS' | 'EVENT_UPDATES' | 'PRO_ACTIVITY' | null;
    channels: readonly Ch[];
    audience: string;
    suspendedPolicy: 'BLOCK' | 'ALLOW';
    syncOnly: boolean;
    adminPermission: string | null;
    inAppType: string;
    link(d: Data): string;
    inApp?(d: Data): { title: string; content: string };
    sms?(d: Data, ctx: Ctx): string;
    push?(d: Data): { title: string; body: string };
    email?(d: Data, ctx: Ctx): { subject: string; html: string; text: string };
    sample: Data;
}

interface CatalogModule {
    catalog: Record<string, CatalogEntry>;
    renderNotification: (type: string, channel: Ch, data: unknown, ctx: Ctx) => unknown;
    renderSyncSms: (type: string, data: { code: string; firstName?: string; setupLink?: string }) => string;
    TemplateDataError: new (...args: never[]) => Error;
}

const CATALOG_MODULE = '../../lib/notifications/catalog';
const SMS_FORMAT_MODULE = '../../lib/notifications/sms-format';

let catalogCache: CatalogModule | null = null;

async function catalogModule(): Promise<CatalogModule> {
    if (catalogCache) return catalogCache;
    const mod = await loadLotModule(CATALOG_MODULE, 'catalogue des modèles (contrat G1)');
    assert.ok(mod.NOTIFICATION_CATALOG && typeof mod.NOTIFICATION_CATALOG === 'object', 'lib/notifications/catalog.ts : NOTIFICATION_CATALOG non exporté (contrat G1)');
    for (const name of ['renderNotification', 'renderSyncSms', 'TemplateDataError']) {
        assert.equal(typeof mod[name], 'function', `lib/notifications/catalog.ts : ${name} non exporté (contrat G1)`);
    }
    catalogCache = {
        catalog: mod.NOTIFICATION_CATALOG as Record<string, CatalogEntry>,
        renderNotification: mod.renderNotification as CatalogModule['renderNotification'],
        renderSyncSms: mod.renderSyncSms as CatalogModule['renderSyncSms'],
        TemplateDataError: mod.TemplateDataError as CatalogModule['TemplateDataError'],
    };
    return catalogCache;
}

/** Entrée du catalogue pour un type de la table G2 ; un type absent est nommé, jamais une TypeError. */
function known(catalog: Record<string, CatalogEntry>, type: string): CatalogEntry {
    const e = catalog[type];
    assert.ok(e, `type ${type} absent de NOTIFICATION_CATALOG`);
    return e;
}

async function entry(type: string): Promise<CatalogEntry> {
    const { catalog } = await catalogModule();
    const e = catalog[type];
    assert.ok(e, `type ${type} absent de NOTIFICATION_CATALOG`);
    return e;
}

interface SmsFormatModule {
    smsDateTime: (v: string) => string;
    smsShortDateTime: (v: string) => string;
    smsTime: (v: string) => string;
    smsAmount: (n: number) => string;
    smsSegments: (t: string) => { encoding: string; length: number; segments: number };
    smsVar: (v: string, max: number) => string;
}

async function smsFormat(): Promise<SmsFormatModule> {
    const mod = await loadLotModule(SMS_FORMAT_MODULE, 'formats des SMS (contrat F2.2)');
    for (const name of ['smsDateTime', 'smsShortDateTime', 'smsTime', 'smsAmount', 'smsSegments', 'smsVar']) {
        assert.equal(typeof mod[name], 'function', `lib/notifications/sms-format.ts : ${name} non exporté (contrat F2)`);
    }
    return mod as unknown as SmsFormatModule;
}

// ── Table G2 (amendement 2) ────────────────────────────────────────────────

const I: Ch = 'IN_APP';
const S: Ch = 'SMS';
const M: Ch = 'EMAIL';
const P: Ch = 'PUSH';

interface ExpectedType {
    type: string;
    family: 'ESSENTIAL' | 'OPTIONAL';
    topic: 'REMINDERS' | 'EVENT_UPDATES' | 'PRO_ACTIVITY' | null;
    channels: Ch[];
    audience: 'CLIENT' | 'PARTNER' | 'CONTROLLER' | 'ADMIN' | 'ANY';
    suspendedPolicy: 'BLOCK' | 'ALLOW';
    syncOnly: boolean;
    adminPermission: string | null;
    /** notifications.type ; null : aucun canal IN_APP. */
    inAppType: string | null;
    /** Lien interne attendu (`:event` = sample.event_id, `:outbox` = sample.outbox_id) ; null : « — ». */
    links: string[] | null;
    /** Titre in-app exact (G4) ; RegExp quand le titre dépend des données. */
    title: string | RegExp | null;
}

type Aud = ExpectedType['audience'];
function ess(type: string, channels: Ch[], audience: Aud, sus: 'A' | 'B', inAppType: string | null, links: string[] | null, title: string | RegExp | null, perm: string | null = null): ExpectedType {
    return { type, family: 'ESSENTIAL', topic: null, channels, audience, suspendedPolicy: sus === 'A' ? 'ALLOW' : 'BLOCK', syncOnly: false, adminPermission: perm, inAppType, links, title };
}
function opt(type: string, topic: 'REMINDERS' | 'EVENT_UPDATES' | 'PRO_ACTIVITY', channels: Ch[], audience: Aud, inAppType: string, links: string[], title: string): ExpectedType {
    return { type, family: 'OPTIONAL', topic, channels, audience, suspendedPolicy: 'BLOCK', syncOnly: false, adminPermission: null, inAppType, links, title };
}
function sync(type: string): ExpectedType {
    return { type, family: 'ESSENTIAL', topic: null, channels: [S], audience: 'ANY', suspendedPolicy: 'ALLOW', syncOnly: true, adminPermission: null, inAppType: null, links: null, title: null };
}

const PE = '/partner/events/:event';
const EXPECTED: ExpectedType[] = [...lot9bisExpected(), ...lot9terExpected(), ...lot9quinquiesExpected(), // lot 9 bis (T51) : 26 types nouveaux (11.1), déclaration hissée en fin de fichier ; lot 9 ter (B.7 T-B1) : 4 types ; lot 9 quinquies (D1)
    ess('PURCHASE_CONFIRMED', [I, S, M], 'CLIENT', 'A', 'TICKET', ['/tickets'], 'Achat confirmé'),
    ess('FREE_TICKETS_CONFIRMED', [I, S, M], 'CLIENT', 'B', 'TICKET', ['/tickets'], 'Billets confirmés'),
    ess('COUNTER_RECEIPT', [S], 'ANY', 'A', null, null, null),
    ess('INVITATION_RECEIVED', [S, I, P, M], 'ANY', 'A', 'TICKET', ['/tickets?tab=recus'], null), // lot 9 bis (R79, 11.2 M3) : + in-app, push, email au compte
    ess('TRANSFER_OFFERED', [S, I, P, M], 'CLIENT', 'B', 'TICKET_TRANSFER', ['/tickets?tab=recus'], 'Un billet vous est transféré'), // G.49
    ess('TRANSFER_CANCELLED', [S, I, P, M], 'CLIENT', 'B', 'TICKET_TRANSFER', ['/tickets'], 'Transfert annulé'), // G.49
    ess('TRANSFER_EXPIRED', [I, P, M], 'CLIENT', 'B', 'TICKET_TRANSFER', ['/tickets'], 'Transfert expiré'), // G.49
    ess('TRANSFER_CLAIMED_SENDER', [I, P, M], 'CLIENT', 'B', 'TICKET_TRANSFER', ['/tickets?tab=historique'], 'Billet accepté'), // G.49
    // Lot 7, tâche 7.9 (D91) : TRANSFER_RECEIVED reçoit l'email (billet reçu par transfert, nouveau numéro).
    ess('TRANSFER_RECEIVED', [I, P, M], 'CLIENT', 'B', 'TICKET_TRANSFER', ['/tickets'], 'Billet reçu'),
    ess('TICKET_SCANNED', [I, P, M], 'CLIENT', 'B', 'TICKET_SCANNED', ['/tickets?tab=historique'], 'Entrée validée'), // 11.2 M4
    ess('EVENT_CANCELLED', [I, S, M, P], 'CLIENT', 'A', 'EVENT_STATUS', ['/tickets'], 'Événement annulé'),
    opt('EVENT_SUSPENDED_HOLDER', 'EVENT_UPDATES', [I, P, M], 'CLIENT', 'EVENT_STATUS', ['/events/:event'], 'Événement suspendu'), // G.50
    opt('EVENT_REACTIVATED_HOLDER', 'EVENT_UPDATES', [I, P, M], 'CLIENT', 'EVENT_STATUS', ['/events/:event'], 'Événement de nouveau en ligne'), // G.50
    ess('EVENT_CHANGED', [I, P, S, M], 'CLIENT', 'B', 'EVENT_CHANGE', ['/events/:event'], 'Événement modifié'), // lot 9 bis (R14, 11.2 M1) : indispensable
    opt('REMINDER_J1', 'REMINDERS', [I, P, S, M], 'CLIENT', 'REMINDER', ['/tickets'], 'Rappel : c\'est demain'),
    opt('REMINDER_H3', 'REMINDERS', [I, P, S, M], 'CLIENT', 'REMINDER', ['/tickets'], 'C\'est bientôt'), // G.50
    ess('REFUND_REQUESTED', [I, M], 'CLIENT', 'A', 'REFUND_REQUESTED', ['/tickets?tab=historique'], 'Remboursement demandé'), // G.49
    ess('REFUND_PAID', [I, S, M, P], 'CLIENT', 'A', 'REFUND_PROCESSED', ['/tickets?tab=historique'], 'Remboursement versé'),
    ess('PASSWORD_CHANGED', [I, S, M], 'ANY', 'B', 'SECURITY', ['/profile'], 'Mot de passe modifié'),
    ess('PHONE_CHANGED', [S, M], 'ANY', 'A', null, ['/profile'], null), // lot 9 : SMS à l'ancien numéro ; lot 9 bis (11.2 M22) : + EMAIL au compte
    // Lot 9 quater (A9 : AUD-34) : type ajouté (modification signalée au rapport)
    ess('EMAIL_CLAIMED_ELSEWHERE', [I, S, M], 'ANY', 'B', 'SECURITY', ['/profile'], 'Adresse email validée par un autre compte'),
    ess('PUSH_TEST', [P], 'ANY', 'B', 'SYSTEM', ['/profile/notifications'], null),
    ess('EVENT_VALIDATED', [I, S, M, P], 'PARTNER', 'B', 'EVENT_STATUS', [PE], 'Événement validé'),
    ess('EVENT_REJECTED', [I, S, M, P], 'PARTNER', 'B', 'EVENT_STATUS', [PE], 'Événement non validé'),
    ess('EVENT_SUSPENDED', [I, S, M, P], 'PARTNER', 'B', 'EVENT_STATUS', [PE], 'Événement suspendu'),
    ess('EVENT_REACTIVATED', [I, S, M, P], 'PARTNER', 'B', 'EVENT_STATUS', [PE], 'Événement réactivé'),
    ess('EVENT_PUBLISHED_BY_ADMIN', [I, P, M], 'PARTNER', 'B', 'EVENT_STATUS', [PE], 'Événement publié'), // G.49
    opt('FIRST_TICKET_SOLD', 'PRO_ACTIVITY', [I, P, S, M], 'PARTNER', 'SALES', [`${PE}?tab=ventes`], 'Premier billet vendu'),
    opt('NEW_ORDER', 'PRO_ACTIVITY', [I], 'PARTNER', 'SALES', [`${PE}?tab=ventes`], 'Nouvelle commande'),
    opt('CATEGORY_SOLD_OUT', 'PRO_ACTIVITY', [I, P, S, M], 'PARTNER', 'CATEGORY_SOLD_OUT', [`${PE}?tab=ventes`], 'Catégorie complète'),
    opt('EVENT_SOLD_OUT', 'PRO_ACTIVITY', [I, P, S, M], 'PARTNER', 'EVENT_FULLY_SOLD_OUT', [`${PE}?tab=ventes`], 'Événement complet'),
    ess('SHIFT_DISCREPANCY', [I, S, P, M], 'PARTNER', 'A', 'ALERT', [`${PE}?tab=caisse`], 'Écart de caisse'), // G.49
    ess('WITHDRAWAL_PAID', [I, S, M, P], 'ANY', 'A', 'WITHDRAWAL_PAID', ['/partner/finance', '/wallet'], 'Retrait versé'),
    ess('WITHDRAWAL_REJECTED', [I, S, M, P], 'ANY', 'A', 'WITHDRAWAL_REJECTED', ['/partner/finance', '/wallet'], 'Retrait refusé'),
    ess('WITHDRAWAL_UNCERTAIN', [I, S, P, M], 'ANY', 'A', 'WITHDRAWAL_PENDING_CHECK', ['/partner/finance', '/wallet'], 'Retrait en vérification'), // G.49
    ess('CANCEL_REFUNDS_DONE', [I, M, P], 'PARTNER', 'A', 'REFUND_PROGRESS', [`${PE}?tab=cloture`], 'Remboursements terminés'),
    ess('CANCEL_REFUNDS_BLOCKED', [I, M, P], 'PARTNER', 'A', 'REFUND_PROGRESS', [`${PE}?tab=cloture`], 'Remboursements en attente'),
    ess('PARTNER_REGISTERED_ACK', [I, M], 'PARTNER', 'B', 'KYC', ['/partner/dashboard'], 'Inscription reçue'),
    ess('PARTNER_VALIDATED', [I, S, M], 'PARTNER', 'B', 'KYC', ['/partner/dashboard'], 'Compte partenaire validé'),
    ess('PARTNER_REJECTED', [I, S, M], 'PARTNER', 'B', 'KYC', ['/partner/dashboard'], 'Demande refusée'),
    ess('PARTNER_SUSPENDED', [I, S, M], 'PARTNER', 'A', 'KYC', ['/partner/dashboard'], 'Compte suspendu'),
    ess('PARTNER_REACTIVATED', [I, S, M], 'PARTNER', 'B', 'KYC', ['/partner/dashboard'], 'Compte réactivé'),
    ess('TRIAL_STARTED', [I, M], 'PARTNER', 'B', 'TRIAL', ['/partner/dashboard'], 'Période d\'essai activée'), // lot 9 bis (R31, 11.2 M5) : SMS retiré, + EMAIL
    ess('SUBSCRIPTION_ACTIVATED', [I, M], 'PARTNER', 'A', 'SUBSCRIPTION_ACTIVATED', ['/partner/subscription'], 'Abonnement activé'), // G.49
    // Lot 8, tâche 8.2 m (contrat 10.1) : le lien suit la cible du paiement, voir « PAYMENT_SUCCESS : lien selon la cible ».
    ess('PAYMENT_SUCCESS', [I, M], 'CLIENT', 'A', 'PAYMENT_SUCCESS', ['/orders', '/partner/subscription'], 'Paiement confirmé'), // G.49
    ess('HALL_RESERVATION_REQUESTED', [I, M], 'PARTNER', 'B', 'HALL_RESERVATION', ['/partner/halls'], 'Nouvelle demande de réservation'), // G.49
    ess('HALL_RESERVATION_CONFIRMED', [I, M], 'CLIENT', 'B', 'HALL_RESERVATION', ['/orders'], 'Réservation confirmée'), // G.49
    ess('HALL_RESERVATION_CANCELLED', [I, M], 'ANY', 'B', 'HALL_RESERVATION', ['/orders', '/partner/halls'], 'Réservation annulée'), // G.49
    ess('PROMOTION_DECIDED', [I, M], 'PARTNER', 'B', 'PROMOTION', [PE], /^Mise en avant (acceptée|refusée)$/), // G.49
    ess('CONTROLLER_ASSIGNED', [I, P, S, M], 'CONTROLLER', 'B', 'CONTROLLER', ['/controller/scanner'], 'Nouvelle affectation'), // G.49 (11.3, minimum)
    ess('CONTROLLER_UNASSIGNED', [I, P, S, M], 'CONTROLLER', 'B', 'CONTROLLER', ['/controller/scanner'], 'Affectation retirée'), // G.49 (11.3, minimum)
    opt('CONTROLLER_REMINDER', 'REMINDERS', [I, P, S, M], 'CONTROLLER', 'CONTROLLER', ['/controller/scanner'], 'Contrôle demain'), // G.50
    ess('SHIFT_CLOSED_BY_OTHER', [I, P, M], 'CONTROLLER', 'A', 'ALERT', ['/controller/scanner'], 'Caisse fermée'), // G.49
    ess('CONTROLLER_ACTIVATED', [I, S, M], 'CONTROLLER', 'B', 'CONTROLLER', ['/controller/scanner'], 'Compte activé'), // G.49
    ess('ADMIN_EVENT_SUBMITTED', [I, P, M], 'ADMIN', 'B', 'ADMIN_REVIEW', ['/admin/events/:event'], 'Événement à valider', 'events.read'),
    ess('ADMIN_PARTNER_REGISTERED', [I, P, M], 'ADMIN', 'B', 'KYC', ['/admin/dashboard'], 'Nouvelle candidature', 'partners.read'),
    ess('ADMIN_REFUND_TO_RETRY', [I, P, M], 'ADMIN', 'B', 'CASHOUT_ALERT', ['/admin/finance'], 'Remboursement à reprendre', 'refunds.manage'),
    // Lot 8, tâche 8.2 a (contrat 6.1, L32) : alerte du second paiement réussi d'un même panier.
    ess('ADMIN_DUPLICATE_PAYMENT', [I, P, M], 'ADMIN', 'B', 'CASHOUT_ALERT', ['/admin/finance'], 'Paiement en double remboursé', 'refunds.manage'),
    ess('ADMIN_CASHOUT_UNCERTAIN', [I, P, M], 'ADMIN', 'B', 'CASHOUT_ALERT', ['/admin/finance'], 'Versement incertain', 'refunds.manage'),
    ess('ADMIN_WITHDRAWAL_REJECTED', [I, M], 'ADMIN', 'B', 'CASHOUT_ALERT', ['/admin/finance'], 'Retrait refusé par l\'opérateur', 'refunds.manage'),
    ess('ADMIN_FINANCE_DEBT', [I, M], 'ADMIN', 'B', 'FINANCE_ALERT', ['/admin/finance'], 'Créance sur un compte', 'payments.read'),
    ess('ADMIN_NOTIFICATION_FAILED', [I, M], 'ADMIN', 'B', 'NOTIFICATION_ALERT', ['/admin/notifications/:outbox'], 'Envoi en échec', 'notifications.read'), // G.49
    ess('ADMIN_SMS_DAILY_THRESHOLD', [I, M], 'ADMIN', 'B', 'SMS_DAILY_THRESHOLD', ['/admin/notifications'], 'Volume de SMS indispensables élevé', 'notifications.read'), // 11.2 M6
    ess('ADMIN_SMS_CAP_GLOBAL', [I, M], 'ADMIN', 'B', 'SMS_DAILY_CAP_REACHED', ['/admin/notifications'], 'Plafond de SMS atteint', 'notifications.read'), // G.49
    ess('ADMIN_SMS_CAP_NON_OTP', [I, M], 'ADMIN', 'B', 'SMS_NON_OTP_SHARE_REACHED', ['/admin/notifications'], 'Quota de SMS hors code atteint', 'notifications.read'), // G.49
    // Lot 9 quater (A8 : AUD-05) : type ajouté (modification signalée au rapport)
    ess('ADMIN_SMS_CAP_NEW_NUMBERS', [I, M], 'ADMIN', 'B', 'SMS_DAILY_CAP_REACHED', ['/admin/notifications'], 'Codes d’inscription : part du jour atteinte', 'notifications.read'),
    // Lot 7, tâche 7.0 a (contrat 4.1, M2.1, D15) : alerte à 80 % du plafond optionnel et prévision de la veille.
    ess('ADMIN_SMS_OPTIONAL_80', [I, M], 'ADMIN', 'B', 'SMS_DAILY_THRESHOLD', ['/admin/notifications'], 'SMS optionnels : 80 % du plafond', 'notifications.read'),
    ess('ADMIN_SMS_FORECAST', [I, M], 'ADMIN', 'B', 'SMS_DAILY_THRESHOLD', ['/admin/notifications'], 'Budget SMS de demain insuffisant', 'notifications.read'),
    sync('OTP_LOGIN'),
    sync('OTP_REGISTER'),
    sync('OTP_PASSWORD_RESET'),
    sync('OTP_WITHDRAWAL'),
    sync('OTP_PHONE_CHANGE'), // lot 9, tâche 9.2
    sync('OTP_AUTH_HOOK'),
    sync('CONTROLLER_INVITE'),
];

const EXPECTED_BY_TYPE = new Map(EXPECTED.map((e) => [e.type, e]));
const RENDERED_TYPES = EXPECTED.filter((e) => !e.syncOnly);
const SMS_TYPES = RENDERED_TYPES.filter((e) => e.channels.includes(S));

/** Types dont le contenu in-app (G4) cite le titre de l'événement en entier (variables non tronquées). */
const IN_APP_WITH_TITLE = new Set([
    'PURCHASE_CONFIRMED', 'FREE_TICKETS_CONFIRMED', 'TRANSFER_OFFERED', 'TRANSFER_CANCELLED', 'TRANSFER_EXPIRED',
    'TRANSFER_CLAIMED_SENDER', 'TRANSFER_RECEIVED', 'TICKET_SCANNED', 'EVENT_CANCELLED', 'EVENT_SUSPENDED_HOLDER',
    'EVENT_REACTIVATED_HOLDER', 'EVENT_CHANGED', 'REMINDER_J1', 'REMINDER_H3', 'REFUND_REQUESTED', 'EVENT_VALIDATED',
    'EVENT_REJECTED', 'EVENT_SUSPENDED', 'EVENT_REACTIVATED', 'EVENT_PUBLISHED_BY_ADMIN', 'FIRST_TICKET_SOLD', 'NEW_ORDER',
    'CATEGORY_SOLD_OUT', 'EVENT_SOLD_OUT', 'SHIFT_DISCREPANCY', 'SHIFT_CLOSED_BY_OTHER', 'CANCEL_REFUNDS_DONE',
    'CANCEL_REFUNDS_BLOCKED', 'CONTROLLER_ASSIGNED', 'CONTROLLER_UNASSIGNED', 'CONTROLLER_REMINDER', 'ADMIN_EVENT_SUBMITTED',
    'PROMOTION_DECIDED', 'TICKET_REFUNDED_HOLDER', 'ADMIN_EVENT_PUBLISHED', 'ADMIN_EVENT_WITHDRAWN', 'SCAN_REFUSALS_ALERT',
]);

/**
 * Lot 7, tâche 7.9 (D93, contrat 19.4) : confirmations dont l'email a son propre contenu ; bouton « Voir mes
 * billets » au lieu de « Ouvrir Event Village », et les trois phrases (P1, P2 de la consigne, P3 de D99).
 */
const CONFIRMATION_EMAIL_TYPES = new Set(['PURCHASE_CONFIRMED', 'FREE_TICKETS_CONFIRMED', 'TRANSFER_RECEIVED']);
const CONFIRMATION_PHRASES = [
    'Votre billet s\'affiche dans l\'application, rubrique Mes billets. Son QR code change toutes les 20 secondes : une capture d\'écran ne sera pas acceptée à l\'entrée.',
    'Ouvrez votre billet avec du réseau avant d\'arriver : il restera disponible même sans connexion.',
    'En cas de problème à l\'entrée, présentez le numéro de votre billet et une pièce d\'identité : le contrôleur peut l\'enregistrer à la main.',
] as const;

// ── Contexte et données ────────────────────────────────────────────────────

/** URL de 27 caractères (F2.3). */
const APP_URL = 'https://app.eventvillage.sn';
const CTX: Ctx = { appUrl: APP_URL };
assert.equal(APP_URL.length, 27);

/** Espaces insécables et apostrophes typographiques ramenés à leur forme simple (in-app, push, email). */
function norm(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'');
}

function clone(d: Data): Data {
    return JSON.parse(JSON.stringify(d)) as Data;
}

/** sample du catalogue, surchargé par `over`, sans les clés `drop`. */
function dataFrom(sample: Data, over: Data, drop: string[] = []): Data {
    const d: Data = { ...clone(sample), ...over };
    for (const k of drop) delete d[k];
    return d;
}

const EVENT_ID = '7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01';
const SHORT_EVENT: Data = { event_id: EVENT_ID, title: 'Gala Dakar', location: 'CICAD', city: 'Diamniadio', start_at: '2026-11-14T20:00:00.000Z' };
const NO_EVENT_KEYS = ['event_id', 'title', 'location', 'city', 'start_at'];

/** Texte saisi long, entièrement translittérable vers GSM-7 (ê, ë, ç, « », ’, –, …). */
const LONG_GSM_TEXT = 'Grande soirée « Ndëkk » – l’été à Saly : édition spéciale où ça va être très, très grand… vraiment très long';
/** Texte saisi long dont une partie n'est pas translittérable (autres écritures) : SMS UCS-2. */
const LONG_UCS2_TEXT = 'Soirée 日本の夏祭り et مهرجان دكار – édition très spéciale, très longue et encore plus longue que prévu';
/** Date au format le plus long (« mer. 30 sept. à 20:00 », 21 caractères). */
const LONGEST_DATE = '2026-09-30T20:00:00.000Z';

const FREE_TEXT_KEYS = new Set(['title', 'location', 'city', 'reason', 'company', 'category', 'controller_name', 'entry_point',
    'justification', 'public_notice', 'address', 'new_location', 'new_address', 'old_title', 'plan', 'hall_name', 'blocked_reason']);
const AMOUNT_KEYS = new Set(['amount', 'total', 'declared', 'price']);
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Valeurs maximales réalistes de G3, appliquées à toutes les variables du sample qui en relèvent. */
function stress(sample: Data, text: string): Data {
    const d = clone(sample);
    const walk = (o: Data): void => {
        for (const [k, v] of Object.entries(o)) {
            if (typeof v === 'string' && FREE_TEXT_KEYS.has(k)) o[k] = text;
            else if (typeof v === 'string' && ISO_RE.test(v)) o[k] = LONGEST_DATE;
            else if (typeof v === 'number' && AMOUNT_KEYS.has(k)) o[k] = 9_999_999;
            else if (typeof v === 'number' && k === 'service_fee') o[k] = 99_999; // maximum de G3 (script smslen6/final.mjs)
            else if (typeof v === 'number' && k === 'difference') o[k] = -9_999_999;
            else if (typeof v === 'number' && k === 'ticket_count') o[k] = 10;
            else if (typeof v === 'boolean' && k === 'can_accept_cash') o[k] = false;
            else if (typeof v === 'string' && k === 'operator') o[k] = v === v.toUpperCase() ? 'ORANGE_MONEY' : 'Orange Money';
        }
    };
    walk(d);
    if (Array.isArray(d.events) && d.events.length > 0) {
        const first = d.events[0] as Data;
        d.events = Array.from({ length: 99 }, (_, i) => ({ ...first, title: `${text} ${i}`, start_at: LONGEST_DATE }));
    }
    return d;
}

/** Variantes de rendu d'un type pour la mesure de longueur (G3 : une ligne par variante). */
function variants(type: string, base: Data): Data[] {
    if (type === 'EVENT_CANCELLED') return [...['AUTO', 'ORGANIZER', 'NONE', 'TRANSFERRED'].map((refund_mode) => ({ ...base, refund_mode })), { ...base, refund_mode: 'ORGANIZER', recipient_kind: 'PHONE' }, { ...base, refund_mode: 'NONE', recipient_kind: 'PHONE' }]; // lot 9 bis (11.2 M2)
    if (type === 'EVENT_CHANGED') {
        const loc = typeof base.title === 'string' ? base.title : LONG_GSM_TEXT;
        const strip = ['new_start_at', 'new_end_at', 'new_location', 'new_address', 'old_title'];
        const b = dataFrom(base, {}, strip);
        return [
            { ...b, changed_fields: ['start_date', 'start_time'], new_start_at: LONGEST_DATE },
            { ...b, changed_fields: ['end_date', 'end_time'], new_end_at: LONGEST_DATE },
            { ...b, changed_fields: ['location'], new_location: loc },
            { ...b, changed_fields: ['start_date', 'location'], new_start_at: LONGEST_DATE, new_location: loc },
        ];
    }
    if (type === 'CONTROLLER_REMINDER' || type === 'CONTROLLER_ASSIGNED') {
        return [{ ...base, can_accept_cash: false }, { ...base, can_accept_cash: true }, { ...base, entry_point: null }];
    }
    // Lot 9 quinquies (D1) : texte nominatif (une candidature) et texte regroupé au pire cas (99 et 99).
    if (type === 'ADMIN_REVIEW_SMS') return [base, dataFrom(base, { partner_count: 99, event_count: 99 }, ['company']), dataFrom(base, { partner_count: 0, event_count: 99 }, ['company'])];
    return type === 'ADMIN_EVENT_CHANGED' ? adminChangeVariants(base) : [base]; // lot 9 ter (B.7 T-B3) : parties PRICE et CHANNELS
}

/** Toutes les sorties texte d'un type pour un jeu de données (canaux déclarés). */
interface Rendered { channel: Ch; field: string; value: string }

function renderAll(e: CatalogEntry, d: Data): Rendered[] {
    const out: Rendered[] = [];
    if (e.channels.includes(I) && e.inApp) {
        const r = e.inApp(d);
        out.push({ channel: I, field: 'title', value: r.title }, { channel: I, field: 'content', value: r.content });
    }
    if (e.channels.includes(S) && e.sms) out.push({ channel: S, field: 'sms', value: e.sms(d, CTX) });
    if (e.channels.includes(P) && e.push) {
        const r = e.push(d);
        out.push({ channel: P, field: 'title', value: r.title }, { channel: P, field: 'body', value: r.body });
    }
    if (e.channels.includes(M) && e.email) {
        const r = e.email(d, CTX);
        out.push({ channel: M, field: 'subject', value: r.subject }, { channel: M, field: 'text', value: r.text }, { channel: M, field: 'html', value: r.html });
    }
    return out;
}

const EMOJI_RE = new RegExp('\\p{Extended_Pictographic}', 'u');

/** Défauts de rendu : variable non remplacée, valeur JS affichée, emoji, « § », code technique, lien externe. */
function renderDefects(r: Rendered): string[] {
    const v = r.value;
    const issues: string[] = [];
    if (typeof v !== 'string' || v.trim() === '') return [`${r.channel}.${r.field} vide ou non textuel (${JSON.stringify(v)})`];
    if (r.field === 'html') {
        if (/\{\{|\}\}|\$\{|\{[a-zA-Z_][\w.]*(?::\d+)?\}/.test(v)) issues.push('variable non remplacée dans le HTML');
    } else if (/[{}]/.test(v)) issues.push('accolade (variable non remplacée)');
    for (const bad of [/\bundefined\b/, /\bnull\b/, /\bNaN\b/, /\[object Object\]/, /Invalid Date/]) {
        if (bad.test(v)) issues.push(`valeur JS affichée (${bad.source})`);
    }
    if (EMOJI_RE.test(v)) issues.push('emoji');
    if (v.includes('§')) issues.push('« § »');
    if (r.field !== 'html') {
        const visible = v.replace(/https?:\/\/\S+/g, '');
        const code = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b(WAVE|ORANGE_MONEY|ESSENTIAL|OPTIONAL|PUBLIE|SUSPENDU|ANNULE)\b/.exec(visible);
        if (code) issues.push(`code technique affiché « ${code[0]} »`);
        for (const url of v.match(/https?:\/\/\S+/g) ?? []) {
            if (!url.startsWith(`${APP_URL}/`) || url.slice(APP_URL.length).startsWith('//')) issues.push(`lien hors de l'application : ${url}`);
        }
        if (/claim|token/i.test(v)) issues.push('« claim » ou « token » dans le texte');
        if (/(?<![\w-])\d{6}(?![\w-])/.test(v)) issues.push('code à 6 chiffres');
    } else {
        const hrefRe = /href\s*=\s*"([^"]*)"/g;
        let m: RegExpExecArray | null;
        while ((m = hrefRe.exec(v)) !== null) {
            const href = m[1].replace(/&amp;/g, '&');
            if (href !== APP_URL && !href.startsWith(`${APP_URL}/`) && !href.startsWith('mailto:')) issues.push(`lien HTML hors de l'application : ${href}`);
        }
        if (/claim|token/i.test(v.replace(/<[^>]+>/g, ''))) issues.push('« claim » ou « token » dans le HTML');
    }
    return issues;
}

// ── Registre et catalogue ──────────────────────────────────────────────────

describe('6.3 Catalogue : registre SQL = catalogue TS = table G2 (contrat C1, G1, G2)', () => {
    test('NOTIFICATION_CATALOG contient exactement les types de G2, chacun avec ses attributs', async () => {
        const { catalog } = await catalogModule();
        assert.deepEqual(Object.keys(catalog).sort(), EXPECTED.map((e) => e.type).sort(), 'types du catalogue = types de G2');
        for (const exp of EXPECTED) {
            const e = known(catalog, exp.type);
            assert.equal(e.type, exp.type, `${exp.type} : champ type`);
            assert.deepEqual(
                { family: e.family, topic: e.topic, channels: [...e.channels].sort(), audience: e.audience, suspendedPolicy: e.suspendedPolicy, syncOnly: e.syncOnly, adminPermission: e.adminPermission },
                { family: exp.family, topic: exp.topic, channels: [...exp.channels].sort(), audience: exp.audience, suspendedPolicy: exp.suspendedPolicy, syncOnly: exp.syncOnly, adminPermission: exp.adminPermission },
                `${exp.type} : attributs du catalogue (G2)`);
            if (exp.inAppType) {
                assert.equal(e.inAppType, exp.inAppType, `${exp.type} : inAppType (notifications.type)`);
                assert.ok(Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPE_META, e.inAppType),
                    `${exp.type} : inAppType ${e.inAppType} sans libellé dans lib/notifications/notification-types.ts (G1)`);
            }
        }
    });

    test('public.notification_types = NOTIFICATION_CATALOG (type, famille, sujet, canaux, audience, politique, journal, permission)', async () => {
        const { catalog } = await catalogModule();
        const { data, error } = await service.from('notification_types').select('*');
        assert.equal(error, null, `lecture de public.notification_types : ${error?.message} (code ${error?.code}) — registre du contrat C1, migration 20261103000002`);
        const rows = (data ?? []) as Array<Record<string, unknown>>;
        const fromDb = rows.map((r) => ({
            type: r.type, family: r.family, topic: r.topic ?? null, channels: [...(r.channels as string[])].sort(), audience: r.audience,
            suspendedPolicy: r.suspended_policy, syncOnly: r.sync_only, adminPermission: r.admin_permission ?? null,
        })).sort((a, b) => String(a.type).localeCompare(String(b.type)));
        const fromTs = Object.values(catalog).map((e) => ({
            type: e.type, family: e.family, topic: e.topic, channels: [...e.channels].sort(), audience: e.audience,
            suspendedPolicy: e.suspendedPolicy, syncOnly: e.syncOnly, adminPermission: e.adminPermission,
        })).sort((a, b) => a.type.localeCompare(b.type));
        assert.deepEqual(fromDb, fromTs, 'registre SQL et catalogue TS identiques');
    });

    test('chaque type rend chaque canal qu\'il déclare (sample), sans variable manquante ni valeur JS affichée', async () => {
        const { catalog } = await catalogModule();
        const issues: string[] = [];
        for (const exp of RENDERED_TYPES) {
            const e = known(catalog, exp.type);
            assert.ok(e.sample && typeof e.sample === 'object', `${exp.type} : sample absent (G1)`);
            const fns: Record<Ch, keyof CatalogEntry> = { IN_APP: 'inApp', SMS: 'sms', PUSH: 'push', EMAIL: 'email' };
            const missing = exp.channels.filter((ch) => typeof e[fns[ch]] !== 'function');
            for (const ch of missing) issues.push(`${exp.type} : rendu ${ch} absent (${String(fns[ch])})`);
            if (missing.length > 0) continue;
            for (const r of renderAll(e, e.sample)) {
                for (const issue of renderDefects(r)) issues.push(`${exp.type} ${r.channel}.${r.field} : ${issue} — ${JSON.stringify(r.value).slice(0, 200)}`);
            }
        }
        assert.deepEqual(issues, [], `rendus défectueux :\n${issues.join('\n')}`);
    });

    test('A29 : ADMIN_REFUND_TO_RETRY nomme le solde insuffisant, pas un bénéficiaire incomplet', async () => {
        const { renderNotification } = await catalogModule();
        const rendered = renderNotification('ADMIN_REFUND_TO_RETRY', 'IN_APP', { cashout_id: '00000000-0000-4000-8000-000000000001', amount: 5000, cashout_status: 'BLOQUE', blocked_reason: 'SOLDE_INSUFFISANT' }, CTX) as { content: string };
        assert.match(rendered.content, /solde/i, rendered.content);
        assert.doesNotMatch(rendered.content, /bénéficiaire/i, rendered.content);
        assert.doesNotMatch(rendered.content, /SOLDE_INSUFFISANT/, rendered.content);
    });

    test('renderNotification lève TemplateDataError quand une variable obligatoire manque, et rend le même texte que le catalogue', async () => {
        const { catalog, renderNotification, TemplateDataError } = await catalogModule();
        const e = catalog.PURCHASE_CONFIRMED;
        const missing = dataFrom(e.sample, {}, ['title']);
        let caught: unknown = null;
        try {
            renderNotification('PURCHASE_CONFIRMED', 'SMS', missing, CTX);
        } catch (err) {
            caught = err;
        }
        assert.ok(caught instanceof TemplateDataError, `TemplateDataError attendue sans « title » (reçu : ${String(caught)})`);
        const err = caught as Error & { variable?: unknown };
        assert.ok(err.variable === 'title' || /\btitle\b/.test(err.message), `l'erreur nomme la variable manquante : ${err.message}`);

        const rendered = renderNotification('PURCHASE_CONFIRMED', 'SMS', e.sample, CTX);
        const sms = e.sms!(e.sample, CTX);
        assert.ok(JSON.stringify(rendered).includes(JSON.stringify(sms).slice(1, -1)), `renderNotification (SMS) = catalogue : ${JSON.stringify(rendered)}`);
    });

    test('liens : chemin interne de G2 (« / », jamais « // » ni schéma), avec l\'identifiant du sample', async () => {
        const { catalog } = await catalogModule();
        const issues: string[] = [];
        for (const exp of RENDERED_TYPES) {
            if (!exp.links) continue;
            const e = known(catalog, exp.type);
            const link = e.link(e.sample);
            if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(link) || /\s/.test(link)) {
                issues.push(`${exp.type} : lien non interne ${JSON.stringify(link)}`);
                continue;
            }
            const allowed = exp.links.map((l) => l.replace(':event', String(e.sample.event_id)).replace(':outbox', String(e.sample.outbox_id)));
            if (!allowed.includes(link)) issues.push(`${exp.type} : lien ${link}, attendu ${allowed.join(' ou ')}`);
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('PAYMENT_SUCCESS : lien selon la cible, un abonnement mène à /partner/subscription (8.2 m, contrat 10.1)', async () => {
        const e = await entry('PAYMENT_SUCCESS');
        const { renderNotification } = await catalogModule();
        const data = dataFrom(e.sample, { payment_target: 'SUBSCRIPTION' });
        assert.equal(e.link(data), '/partner/subscription', 'lien du catalogue pour payment_target = SUBSCRIPTION');
        const rendered = renderNotification('PAYMENT_SUCCESS', 'IN_APP', data, CTX) as { actionUrl?: unknown };
        assert.equal(rendered.actionUrl, '/partner/subscription', `renderNotification (IN_APP) : ${JSON.stringify(rendered)}`);
    });

    test('témoin PAYMENT_SUCCESS : /orders pour les autres cibles et pour une ligne déjà en file, sans la clé (lecture tolérante, L57)', async () => {
        const e = await entry('PAYMENT_SUCCESS');
        for (const target of ['ORDER', 'HALL_RESERVATION', 'TABLE_RESERVATION']) {
            assert.equal(e.link(dataFrom(e.sample, { payment_target: target })), '/orders', `lien pour payment_target = ${target}`);
        }
        const queued = dataFrom(e.sample, {}, ['payment_target']);
        assert.ok(!('payment_target' in queued), 'ligne d\'avant la migration : données sans payment_target');
        assert.equal(e.link(queued), '/orders', 'ligne déjà en file : aucune levée, lien inchangé');
    });
});

// ── In-app, push, email ────────────────────────────────────────────────────

describe('6.3 Catalogue : in-app, push et email (contrat G4, F3)', () => {
    test('titres in-app exacts (G4) ; variables in-app non tronquées (titre complet de l\'événement)', async () => {
        const { catalog } = await catalogModule();
        const issues: string[] = [];
        for (const exp of RENDERED_TYPES) {
            if (!exp.channels.includes(I) || !exp.title) continue;
            const e = known(catalog, exp.type);
            const r = e.inApp!(e.sample);
            const ok = typeof exp.title === 'string' ? norm(r.title) === norm(exp.title) : exp.title.test(norm(r.title));
            if (!ok) issues.push(`${exp.type} : titre « ${r.title} », attendu « ${String(exp.title)} »`);
            if (IN_APP_WITH_TITLE.has(exp.type)) {
                const long = dataFrom(e.sample, { title: LONG_GSM_TEXT });
                if (!norm(e.inApp!(long).content).includes(norm(LONG_GSM_TEXT))) issues.push(`${exp.type} : le contenu in-app ne cite pas le titre complet`);
            }
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('contenus in-app exacts pour des valeurs courtes (G4)', async () => {
        // Cinquième élément facultatif : clés retirées du sample (variables facultatives absentes).
        const cases: Array<[string, Data, string, string, string[]?]> = [
            ['TICKET_SCANNED', SHORT_EVENT, 'Entrée validée', 'Votre billet pour « Gala Dakar » a été contrôlé à l\'entrée.'],
            // Lot 7, tâche 7.9 (D94, contrat 19.4) : numéro du billet reçu et date ; sans numéro (ligne d'avant la
            // migration 20261105000007), texte du lot 6.
            ['TRANSFER_RECEIVED', { ...SHORT_EVENT, ticket_number: 'TCK-20261114-4F7A8E162D' }, 'Billet reçu',
                'Le billet TCK-20261114-4F7A8E162D pour « Gala Dakar » du sam. 14 nov. 2026 à 20:00 est ajouté à Mes billets.'],
            ['TRANSFER_RECEIVED', SHORT_EVENT, 'Billet reçu', 'Le billet pour « Gala Dakar » est ajouté à vos billets.', ['ticket_number', 'category']],
            ['TRANSFER_CLAIMED_SENDER', SHORT_EVENT, 'Billet accepté', 'Votre billet pour « Gala Dakar » a été accepté par son destinataire.'],
            ['FIRST_TICKET_SOLD', SHORT_EVENT, 'Premier billet vendu', 'Le premier billet de « Gala Dakar » est vendu.'],
            ['EVENT_SOLD_OUT', SHORT_EVENT, 'Événement complet', 'Toutes les catégories de « Gala Dakar » sont vendues.'],
            ['PASSWORD_CHANGED', {}, 'Mot de passe modifié', 'Le mot de passe de votre compte a été défini ou modifié. Si ce n\'est pas vous, contactez le support.'],
            ['CONTROLLER_ACTIVATED', {}, 'Compte activé', 'Votre compte est activé : vous pouvez scanner les billets.'],
        ];
        for (const [type, over, title, content, drop] of cases) {
            const e = await entry(type);
            const r = e.inApp!(dataFrom(e.sample, over, drop ?? []));
            assert.deepEqual({ title: norm(r.title), content: norm(r.content) }, { title, content }, `${type} : in-app${drop ? ` (sans ${drop.join(', ')})` : ''}`);
        }
    });

    test('push : titre = titre in-app, corps = contenu in-app (tronqué à 160 caractères au plus)', async () => {
        const { catalog } = await catalogModule();
        const issues: string[] = [];
        for (const exp of RENDERED_TYPES) {
            if (!exp.channels.includes(P)) continue;
            const e = known(catalog, exp.type);
            for (const d of [e.sample, stress(e.sample, LONG_GSM_TEXT)]) {
                const push = e.push!(d);
                if (push.body.length > 160) issues.push(`${exp.type} : corps push de ${push.body.length} caractères`);
                if (!exp.channels.includes(I)) continue;
                const inApp = e.inApp!(d);
                if (push.title !== inApp.title) issues.push(`${exp.type} : titre push « ${push.title} » ≠ in-app « ${inApp.title} »`);
                const expectedPrefix = push.body.replace(/(\.\.\.|…)$/, '');
                const ok = inApp.content.length <= 160 ? push.body === inApp.content : inApp.content.startsWith(expectedPrefix) && expectedPrefix.length > 0;
                if (!ok) issues.push(`${exp.type} : corps push « ${push.body} » ≠ contenu in-app « ${inApp.content} »`);
            }
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('email : sujet « {titre} — Event Village », corps = contenu in-app, bouton vers l\'application, désabonnement des seules familles optionnelles', async () => {
        const { catalog } = await catalogModule();
        const issues: string[] = [];
        for (const exp of RENDERED_TYPES) {
            if (!exp.channels.includes(M)) continue;
            const e = known(catalog, exp.type);
            const mail = e.email!(e.sample, CTX);
            const inApp = e.inApp!(e.sample);
            const link = e.link(e.sample);
            if (norm(mail.subject) !== `${norm(inApp.title)} — Event Village`) issues.push(`${exp.type} : sujet « ${mail.subject} »`);
            if (!norm(mail.text).includes(norm(inApp.content))) issues.push(`${exp.type} : la version texte ne contient pas le contenu in-app`);
            if (CONFIRMATION_EMAIL_TYPES.has(exp.type)) {
                // Lot 7, tâche 7.9 (D93) : exception nommée, vérifiée en détail par confirmation-achat.test.ts.
                if (!mail.html.includes('Voir mes billets')) issues.push(`${exp.type} : bouton « Voir mes billets » absent (D93)`);
                if (mail.html.includes('Ouvrir Event Village')) issues.push(`${exp.type} : bouton « Ouvrir Event Village » au lieu de « Voir mes billets » (D93)`);
                for (const phrase of CONFIRMATION_PHRASES) {
                    if (!norm(mail.text).includes(phrase)) issues.push(`${exp.type} : phrase obligatoire absente de la version texte : « ${phrase} »`);
                }
            } else if (!mail.html.includes('Ouvrir Event Village')) issues.push(`${exp.type} : bouton « Ouvrir Event Village » absent`);
            if (!mail.html.includes(`href="${APP_URL}${link.replace(/&/g, '&amp;')}"`) && !mail.html.includes(`href="${APP_URL}${link}"`)) {
                issues.push(`${exp.type} : bouton sans lien ${APP_URL}${link}`);
            }
            const unsubscribe = `${APP_URL}/profile/notifications?topic=${exp.topic}`;
            if (exp.family === 'OPTIONAL') {
                if (!norm(mail.text).includes(`Ne plus recevoir ces emails : ${unsubscribe}`)) issues.push(`${exp.type} : pied de désabonnement absent de la version texte`);
                if (!mail.html.includes(unsubscribe)) issues.push(`${exp.type} : lien de désabonnement absent du HTML`);
            } else if (/Ne plus recevoir/.test(mail.text) || /Ne plus recevoir/.test(mail.html)) {
                issues.push(`${exp.type} : pied de désabonnement sur un message indispensable`);
            }
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('email : toute variable est échappée dans le HTML (balise, &, guillemets), la version texte garde la valeur', async () => {
        const e = await entry('PURCHASE_CONFIRMED');
        const hostile = '<img src=x onerror=alert(1)> & "Cie" \'x\'';
        const mail = e.email!(dataFrom(e.sample, { title: hostile }), CTX);
        assert.ok(!/<img/i.test(mail.html), `balise injectée dans le HTML : ${mail.html.slice(0, 400)}`);
        assert.ok(mail.html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'balise échappée');
        assert.ok(mail.html.includes('&amp; '), '« & » échappé');
        assert.ok(mail.html.includes('&quot;Cie&quot;'), 'guillemets échappés');
        assert.ok(/&#0?39;x&#0?39;|&#x27;x&#x27;|&apos;x&apos;/.test(mail.html), 'apostrophes échappées');
        assert.ok(norm(mail.text).includes(hostile), 'la version texte garde la valeur telle quelle');
        assert.ok(!/<img/i.test(mail.subject), `sujet sans balise injectée : ${mail.subject}`);
    });
});

// ── SMS ────────────────────────────────────────────────────────────────────

describe('6.3 Catalogue : SMS (contrat F2, G3)', () => {
    test('chaque SMS tient en un SMS GSM-7 (≤ 160) avec les valeurs maximales réalistes de G3 et une URL de 27 caractères', async () => {
        const { catalog } = await catalogModule();
        const issues: string[] = [];
        for (const exp of SMS_TYPES) {
            const e = known(catalog, exp.type);
            for (const d of variants(exp.type, stress(e.sample, LONG_GSM_TEXT))) {
                const text = e.sms!(d, CTX);
                const m = measureSms(text);
                if (m.encoding !== 'GSM7') issues.push(`${exp.type} : hors GSM-7 (${nonGsmChars(text).map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`).join(', ')}) — ${text}`);
                else if (m.length > 160) issues.push(`${exp.type} : ${m.length} septets > 160 — ${text}`);
                for (const issue of renderDefects({ channel: S, field: 'sms', value: text })) issues.push(`${exp.type} : ${issue} — ${text}`);
            }
        }
        assert.deepEqual(issues, [], `SMS trop longs ou hors GSM-7 :\n${issues.join('\n')}`);
    });

    test('texte fixe en GSM-7 de base : rendu avec des valeurs ASCII, aucun caractère interdit (« » ’ ° ç ê â ô î û ï ë œ, espaces insécables)', async () => {
        const { catalog } = await catalogModule();
        const forbidden = /[«»’‘“”°çêâôîûïëœ  –—…]/;
        const issues: string[] = [];
        for (const exp of SMS_TYPES) {
            const e = known(catalog, exp.type);
            for (const d of variants(exp.type, stress(e.sample, 'Gala Dakar'))) {
                const text = e.sms!(d, CTX);
                const bad = nonGsmChars(text);
                if (bad.length > 0) issues.push(`${exp.type} : caractères hors GSM-7 ${JSON.stringify(bad)} — ${text}`);
                if (forbidden.test(text)) issues.push(`${exp.type} : caractère interdit par F2.1 — ${text}`);
                if (!text.startsWith('Event Village : ')) issues.push(`${exp.type} : préfixe « Event Village : » absent — ${text}`);
            }
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    // Lot 9 bis (R27, T51, renforcé) : avant, une saisie dans d'autres écritures donnait un SMS UCS-2 de 3 segments au plus ;
    // désormais smsVar retire tout caractère hors GSM-7 : un segment GSM-7, caractères retirés.
    test('variable non translittérable (autres écritures) : caractères retirés, un SMS GSM-7 d\'un segment', async () => {
        const { catalog } = await catalogModule();
        const issues: string[] = [];
        for (const exp of SMS_TYPES) {
            const e = known(catalog, exp.type);
            for (const d of variants(exp.type, stress(e.sample, LONG_UCS2_TEXT))) {
                const text = e.sms!(d, CTX);
                const m = measureSms(text);
                if (m.encoding !== 'GSM7' || m.segments !== 1) issues.push(`${exp.type} : ${m.segments} segment(s) ${m.encoding} (${m.length}) — ${text}`);
                if (nonGsmChars(text).length > 0) issues.push(`${exp.type} : caractères hors GSM-7 ${JSON.stringify(nonGsmChars(text))} — ${text}`);
                if (/[{}]/.test(text)) issues.push(`${exp.type} : variable non remplacée — ${text}`);
            }
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('textes exacts G3 pour des valeurs courtes', async () => {
        const { catalog } = await catalogModule();
        const U = APP_URL;
        const ev = SHORT_EVENT;
        const cases: Array<[string, Data, string[], string]> = [
            ['PURCHASE_CONFIRMED', { ...ev, ticket_count: 1, service_fee: 50, total: 5050 }, [],
                `Event Village : achat confirmé, 1 billet Gala Dakar. Frais de service 50 F CFA, total payé 5 050 F CFA. ${U}/tickets`],
            ['PURCHASE_CONFIRMED', { ...ev, ticket_count: 3, service_fee: 150, total: 15150 }, [],
                `Event Village : achat confirmé, 3 billets Gala Dakar. Frais de service 150 F CFA, total payé 15 150 F CFA. ${U}/tickets`],
            ['FREE_TICKETS_CONFIRMED', { ...ev, ticket_count: 1 }, [],
                `Event Village : 1 billet gratuit pour Gala Dakar le sam. 14 nov. à 20:00. Vos billets : ${U}/tickets`],
            ['FREE_TICKETS_CONFIRMED', { ...ev, ticket_count: 2 }, [],
                `Event Village : 2 billets gratuits pour Gala Dakar le sam. 14 nov. à 20:00. Vos billets : ${U}/tickets`],
            ['COUNTER_RECEIPT', { ...ev, ticket_count: 2, amount: 10000, reference: 'AB12CD34' }, [],
                'Event Village : achat au guichet pour Gala Dakar, 2 billets, 10 000 F CFA. Entrée validée. Réf. AB12CD34.'],
            ['INVITATION_RECEIVED', { ...ev, ticket_count: 1 }, [], `Event Village : 1 invitation pour Gala Dakar le sam. 14 nov. à 20:00. Connectez-vous avec ce numéro : ${U}/tickets`],
            ['INVITATION_RECEIVED', { ...ev, ticket_count: 3 }, [], `Event Village : 3 invitations pour Gala Dakar le sam. 14 nov. à 20:00. Connectez-vous avec ce numéro : ${U}/tickets`],
            ['TRANSFER_OFFERED', { ...ev, expires_at: '2026-11-12T18:30:00.000Z' }, [],
                `Event Village : un billet Gala Dakar vous est transféré. Connectez-vous avec ce numéro avant le 12 nov. à 18:30 : ${U}/tickets`],
            ['TRANSFER_CANCELLED', ev, [], 'Event Village : le transfert du billet Gala Dakar a été annulé par son propriétaire.'],
            ['EVENT_CANCELLED', { ...ev, refund_mode: 'AUTO' }, [],
                `Event Village : Gala Dakar du sam. 14 nov. à 20:00 est annulé. Remboursement automatique en cours. ${U}/tickets`],
            ['EVENT_CANCELLED', { ...ev, refund_mode: 'ORGANIZER' }, [],
                `Event Village : Gala Dakar du sam. 14 nov. à 20:00 est annulé. Remboursement par l'organisateur. ${U}/tickets`],
            ['EVENT_CANCELLED', { ...ev, refund_mode: 'NONE' }, [],
                `Event Village : Gala Dakar du sam. 14 nov. à 20:00 est annulé. Détails : ${U}/tickets`],
            // Lot 9 bis (11.2 M2, R13, R12, R23) : billet reçu par transfert ; numéro seul (guichet, invitation, transfert révoqué), sans lien.
            ['EVENT_CANCELLED', { ...ev, refund_mode: 'TRANSFERRED' }, [],
                `Event Village : Gala Dakar du sam. 14 nov. à 20:00 est annulé. Remboursement à l'acheteur d'origine. ${U}/tickets`],
            ['EVENT_CANCELLED', { ...ev, refund_mode: 'ORGANIZER', recipient_kind: 'PHONE' }, [],
                'Event Village : Gala Dakar du sam. 14 nov. à 20:00 est annulé. Remboursement par l\'organisateur.'],
            ['EVENT_CANCELLED', { ...ev, refund_mode: 'NONE', recipient_kind: 'PHONE' }, [],
                'Event Village : Gala Dakar du sam. 14 nov. à 20:00 est annulé. Le billet qui vous était destiné n\'est plus valable.'],
            ['EVENT_CHANGED', { ...ev, changed_fields: ['start_date', 'start_time'], new_start_at: '2026-11-21T21:00:00.000Z' }, ['new_end_at', 'new_location', 'new_address', 'old_title'],
                `Event Village : Gala Dakar change de date : sam. 21 nov. à 21:00. Vos billets restent valables. ${U}/tickets`],
            ['EVENT_CHANGED', { ...ev, changed_fields: ['end_date', 'end_time'], new_end_at: '2026-11-15T02:00:00.000Z' }, ['new_start_at', 'new_location', 'new_address', 'old_title'],
                `Event Village : Gala Dakar : nouvelle fin le dim. 15 nov. à 02:00. Vos billets restent valables. ${U}/tickets`],
            ['EVENT_CHANGED', { ...ev, changed_fields: ['location'], new_location: 'Place du Souvenir' }, ['new_start_at', 'new_end_at', 'new_address', 'old_title'],
                `Event Village : Gala Dakar change de lieu : Place du Souvenir. Vos billets restent valables. ${U}/tickets`],
            ['EVENT_CHANGED', { ...ev, changed_fields: ['start_date', 'location'], new_start_at: '2026-11-21T21:00:00.000Z', new_location: 'Place du Souvenir' }, ['new_end_at', 'new_address', 'old_title'],
                `Event Village : Gala Dakar change : sam. 21 nov. à 21:00, Place du Souvenir. Billets toujours valables. ${U}/tickets`],
            ['REMINDER_J1', ev, [], `Event Village : rappel, Gala Dakar demain à 20:00, CICAD. Vos billets : ${U}/tickets`],
            ['REMINDER_H3', ev, [], `Event Village : Gala Dakar à 20:00. Ouvrez votre billet avant d'arriver : QR renouvelé toutes les 20 s. ${U}/tickets`],
            ['REFUND_PAID', { ...ev, amount: 5000, operator: 'WAVE' }, [], 'Event Village : remboursement de 5 000 F CFA versé sur votre compte Wave (Gala Dakar).'],
            ['REFUND_PAID', { amount: 5000, operator: 'ORANGE_MONEY' }, NO_EVENT_KEYS, 'Event Village : remboursement de 5 000 F CFA versé sur votre compte Orange Money.'],
            ['PASSWORD_CHANGED', {}, [], 'Event Village : le mot de passe de votre compte a été défini ou modifié. Si ce n\'est pas vous, contactez le support.'],
            ['PHONE_CHANGED', {}, [], 'Event Village : le numéro de votre compte a été modifié. Si ce n\'est pas vous, contactez le support.'],
            // Lot 9 quater (A9 : AUD-34) : type ajouté (modification signalée au rapport)
            ['EMAIL_CLAIMED_ELSEWHERE', {}, [], 'Event Village : l\'adresse email en attente sur votre compte a été validée par un autre compte. Si c\'est votre adresse, contactez le support.'],
            ['EVENT_VALIDATED', ev, [], `Event Village : votre événement Gala Dakar est validé. Publiez-le depuis votre espace : ${U}/partner/events`],
            ['EVENT_REJECTED', { ...ev, reason: 'Affiche illisible' }, [], `Event Village : événement Gala Dakar non validé. Motif : Affiche illisible. ${U}/partner/events`],
            ['EVENT_SUSPENDED', { ...ev, reason: 'Signalement en cours' }, [], `Event Village : événement Gala Dakar suspendu. Motif : Signalement en cours. ${U}/partner/events`],
            ['EVENT_REACTIVATED', ev, [], `Event Village : votre événement Gala Dakar est de nouveau en ligne. ${U}/partner/events`],
            ['FIRST_TICKET_SOLD', ev, [], `Event Village : premier billet vendu pour Gala Dakar. Suivez vos ventes : ${U}/partner/events`],
            ['CATEGORY_SOLD_OUT', { ...ev, category: 'VIP' }, [], `Event Village : la catégorie VIP de Gala Dakar est complète. ${U}/partner/events`],
            ['EVENT_SOLD_OUT', ev, [], `Event Village : Gala Dakar est complet, toutes les catégories sont vendues. ${U}/partner/events`],
            ['SHIFT_DISCREPANCY', { ...ev, controller_name: 'Fatou Sow', difference: -2500 }, [],
                `Event Village : caisse de Fatou Sow fermée (Gala Dakar) avec un écart de -2 500 F CFA. ${U}/partner/events`],
            ['SHIFT_DISCREPANCY', { ...ev, controller_name: 'Fatou Sow', difference: 1000 }, [],
                `Event Village : caisse de Fatou Sow fermée (Gala Dakar) avec un écart de +1 000 F CFA. ${U}/partner/events`],
            ['WITHDRAWAL_PAID', { amount: 25000, operator: 'WAVE' }, [], 'Event Village : votre retrait de 25 000 F CFA a été versé sur votre compte Wave.'],
            ['WITHDRAWAL_REJECTED', { amount: 25000, operator: 'WAVE' }, [],
                'Event Village : votre retrait de 25 000 F CFA a été refusé par l\'opérateur. Le montant est revenu sur votre solde.'],
            ['WITHDRAWAL_UNCERTAIN', { amount: 25000, operator: 'ORANGE_MONEY' }, [],
                'Event Village : votre retrait de 25 000 F CFA est en vérification auprès de l\'opérateur. Aucune action de votre part.'],
            ['PARTNER_VALIDATED', { company: 'Sabar Events' }, [], `Event Village : votre compte partenaire Sabar Events est validé. Connectez-vous : ${U}/login`],
            ['PARTNER_REJECTED', { reason: 'Pieces illisibles' }, [], 'Event Village : votre demande de compte partenaire n\'est pas acceptée. Motif : Pieces illisibles.'],
            ['PARTNER_SUSPENDED', { reason: 'Fraude signalee' }, [], 'Event Village : votre compte partenaire est suspendu. Motif : Fraude signalee. Contactez le support.'],
            ['PARTNER_REACTIVATED', {}, [], `Event Village : votre compte partenaire est réactivé. Connectez-vous : ${U}/login`],
            // Lot 9 bis (R31, T51) : TRIAL_STARTED n'a plus de SMS, son texte exact est retiré (couverture par type SMS ci-dessous).
            ['CONTROLLER_ASSIGNED', { ...ev, entry_point: null }, ['events'], `Event Village : affectation à l'entrée de Gala Dakar, sam. 14 nov. à 20:00. ${U}/login`],
            ['CONTROLLER_ASSIGNED', { ...ev, entry_point: 'Porte B' }, ['events'], `Event Village : affectation à l'entrée de Gala Dakar, sam. 14 nov. à 20:00, point Porte B. ${U}/login`],
            ['CONTROLLER_UNASSIGNED', ev, ['events'], 'Event Village : votre affectation à l\'entrée de Gala Dakar est retirée.'],
            ['CONTROLLER_REMINDER', { ...ev, entry_point: 'Porte B', can_accept_cash: true }, [],
                `Event Village : demain Gala Dakar à 20:00, point Porte B, espèces autorisées. Connexion : ${U}/login`],
            ['CONTROLLER_REMINDER', { ...ev, entry_point: null, can_accept_cash: false }, [],
                `Event Village : demain Gala Dakar à 20:00, point à préciser, espèces non autorisées. Connexion : ${U}/login`],
            ['CONTROLLER_ACTIVATED', {}, [], 'Event Village : votre compte est activé. Vous pouvez vous connecter et scanner les billets.'],
            // Lot 9 ter (9t.2, contrat 11.1 et 11.2 N1) : détenteur actuel d'un billet transféré, texte de la consigne 0.2 mot pour mot.
            ['TICKET_REFUNDED_HOLDER', { ...ev, ticket_id: '5d1f0c3e-8a2b-4c6d-9e0f-1a2b3c4d5e6f', category: 'VIP' }, [],
                'Event Village : votre billet VIP pour Gala Dakar a été annulé. Le remboursement est versé à l\'acheteur d\'origine.'],
            // Lot 9 quinquies (D1) : textes du chef de projet (« » hors GSM-7 : guillemets droits), partie à zéro omise.
            ['ADMIN_REVIEW_SMS', { partner_count: 1, event_count: 0, company: 'Sabar Events' }, [],
                `Event Village : nouvelle demande de partenaire "Sabar Events". Vérifiez son dossier : ${U}/admin/dashboard`],
            ['ADMIN_REVIEW_SMS', { partner_count: 3, event_count: 2 }, ['company'],
                `Event Village : 3 demande(s) de partenaire et 2 événement(s) attendent votre validation : ${U}/admin/dashboard`],
            ['ADMIN_REVIEW_SMS', { partner_count: 2, event_count: 0 }, ['company'],
                `Event Village : 2 demande(s) de partenaire attendent votre validation : ${U}/admin/dashboard`],
            ['ADMIN_REVIEW_SMS', { partner_count: 0, event_count: 1 }, ['company'],
                `Event Village : 1 événement(s) attendent votre validation : ${U}/admin/dashboard`],
            // Lot 9 quinquies (A1 : AUTH-01) : 160 septets avec l'URL de 27 caractères (texte de la consigne : 169, deux segments).
            ['ACCOUNT_LOGIN_FAILURES', {}, [],
                `Event Village : plusieurs connexions ont échoué sur votre compte. Si ce n'est pas vous, changez votre mot de passe : ${U}/forgot-password`],
        ];
        const covered = new Set(cases.map((c) => c[0]));
        // Lot 9 bis (T51) : un type nouveau est couvert par son texte fixe du contrat (LOT9BIS_SMS_PATTERNS, test dédié en fin de fichier).
        assert.deepEqual(SMS_TYPES.map((e) => e.type).filter((t) => !covered.has(t) && !(t in LOT9BIS_SMS_PATTERNS)), [], 'chaque type SMS de G3 a son texte exact');
        const issues: string[] = [];
        for (const [type, over, drop, expected] of cases) {
            const e = known(catalog, type); // lot 9 ter : type absent nommé (jamais une TypeError)
            const text = e.sms!(dataFrom(e.sample, over, drop), CTX);
            if (text !== expected) issues.push(`${type}\n  reçu    : ${text}\n  attendu : ${expected}`);
            else if (measureSms(text).encoding !== 'GSM7') issues.push(`${type} : hors GSM-7`);
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    // Lot 9 bis (R73, R107, T51, contrat 11.2 M11 à M17) : préfixe unique « Event Village : », OTP_WITHDRAWAL dédié,
    // invitation de contrôleur sur un segment (renforcé : 2 segments admis avant).
    test('OTP et invitation (renderSyncSms) : textes du lot 9 bis, le code n\'est jamais stocké ; l\'invitation sur un segment', async () => {
        const { renderSyncSms } = await catalogModule();
        const code = '483920';
        const otp = `Event Village : votre code de vérification est ${code}. Valable 10 minutes.`;
        for (const type of ['OTP_LOGIN', 'OTP_REGISTER', 'OTP_AUTH_HOOK', 'OTP_PHONE_CHANGE']) {
            const text = renderSyncSms(type, { code });
            assert.equal(text, otp, `${type} : texte du contrat (11.2 M11 à M14)`);
            assert.deepEqual(measureSms(text), { encoding: 'GSM7', length: 74, segments: 1 }, `${type} : un SMS GSM-7`);
        }
        const withdrawal = renderSyncSms('OTP_WITHDRAWAL', { code });
        assert.equal(withdrawal, `Event Village : votre code de retrait est ${code}. Valable 10 minutes. Ne le donnez à personne.`, 'OTP_WITHDRAWAL : texte dédié (11.2 M16, R107)');
        assert.deepEqual(measureSms(withdrawal), { encoding: 'GSM7', length: 94, segments: 1 });
        const reset = renderSyncSms('OTP_PASSWORD_RESET', { code });
        assert.equal(reset, `Event Village : votre code de réinitialisation du mot de passe est ${code}. Valable 10 minutes.`, 'OTP_PASSWORD_RESET : texte du contrat (11.2 M15)');
        assert.deepEqual(measureSms(reset), { encoding: 'GSM7', length: 94, segments: 1 });

        const setupLink = `${APP_URL}/controller/setup?phone=221771234567`;
        const invite = renderSyncSms('CONTROLLER_INVITE', { code, firstName: 'Awa', setupLink });
        assert.equal(invite, `Event Village : Bonjour Awa, code d'activation ${code} (24 h) pour scanner les billets : ${setupLink}`,
            'CONTROLLER_INVITE : texte du contrat (11.2 M17)');
        assert.deepEqual([measureSms(invite).encoding, measureSms(invite).segments], ['GSM7', 1], 'invitation : un segment GSM-7');
        const longName = renderSyncSms('CONTROLLER_INVITE', { code, firstName: 'Maïmouna', setupLink });
        assert.deepEqual([measureSms(longName).encoding, measureSms(longName).segments], ['GSM7', 1], `prénom long translittéré : un segment GSM-7 (${longName})`);
        const anonymous = renderSyncSms('CONTROLLER_INVITE', { code, setupLink });
        assert.equal(anonymous, `Event Village : code d'activation ${code} (24 h) pour scanner les billets : ${setupLink}`, 'invitation sans prénom (11.2 M17)');
    });
});

// ── Formats partagés ───────────────────────────────────────────────────────

describe('6.3 Formats partagés (contrat F2.2, G1)', () => {
    test('montants : smsAmount avec espace simple, formatFcfa (in-app, push, email) avec U+00A0', async () => {
        const f = await smsFormat();
        assert.equal(f.smsAmount(1050), '1 050 F CFA');
        assert.equal(f.smsAmount(9_999_999), '9 999 999 F CFA');
        assert.equal(f.smsAmount(500), '500 F CFA');
        assert.equal(f.smsAmount(0), '0 F CFA');
        for (const n of [1050, 9_999_999]) assert.ok(!/[  ]/.test(f.smsAmount(n)), 'aucune espace insécable dans un SMS');
        assert.equal(formatFcfa(1050), '1 050 F CFA', 'formatFcfa garde U+00A0');
    });

    test('dates des SMS à l\'heure de Dakar : jours et mois du contrat, « aout », heure sur 24 h', async () => {
        const f = await smsFormat();
        const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
        const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'aout', 'sept.', 'oct.', 'nov.', 'déc.'];
        for (let m = 0; m < 12; m++) {
            const iso = `2026-${String(m + 1).padStart(2, '0')}-15T20:00:00.000Z`;
            const day = days[new Date(iso).getUTCDay()];
            assert.equal(f.smsDateTime(iso), `${day} 15 ${months[m]} à 20:00`, `smsDateTime ${iso}`);
            assert.equal(f.smsShortDateTime(iso), `15 ${months[m]} à 20:00`, `smsShortDateTime ${iso}`);
        }
        for (let d = 9; d <= 15; d++) {
            const iso = `2026-11-${String(d).padStart(2, '0')}T18:30:00.000Z`;
            assert.ok(f.smsDateTime(iso).startsWith(`${days[new Date(iso).getUTCDay()]} ${d} nov.`), `jour de la semaine de ${iso} : ${f.smsDateTime(iso)}`);
        }
        assert.equal(f.smsDateTime(LONGEST_DATE), 'mer. 30 sept. à 20:00');
        assert.equal(f.smsDateTime(LONGEST_DATE).length, 21, 'date la plus longue : 21 caractères (G3)');
        assert.equal(f.smsTime('2026-11-14T20:00:00.000Z'), '20:00');
        // Heure de Dakar (UTC+0) quel que soit le décalage de la valeur d'entrée.
        assert.equal(f.smsDateTime('2026-11-14T23:30:00-01:00'), 'dim. 15 nov. à 00:30', 'conversion vers Dakar');
        assert.equal(f.smsTime('2026-11-14T21:05:00+01:00'), '20:05', 'smsTime à Dakar');
        for (const s of [f.smsDateTime(LONGEST_DATE), f.smsShortDateTime(LONGEST_DATE), f.smsDateTime('2026-08-15T20:00:00.000Z')]) {
            assert.deepEqual(nonGsmChars(s), [], `format de date en GSM-7 : ${s}`);
        }
    });

    test('smsSegments : encodage et segments conformes à GSM 03.38 (calcul indépendant)', async () => {
        const f = await smsFormat();
        const samples = [
            'Event Village : test',
            'a'.repeat(160),
            'a'.repeat(161),
            `${'a'.repeat(158)}€`,
            `${'a'.repeat(159)}€`,
            'é'.repeat(160),
            `Gala ${'日'.repeat(65)}`,
            `Gala ${'日'.repeat(66)}`,
            `${'ç'.repeat(134)}`,
            `${'ç'.repeat(135)}`,
        ];
        for (const s of samples) {
            const mine = measureSms(s);
            const got = f.smsSegments(s);
            assert.deepEqual({ encoding: got.encoding, segments: got.segments }, { encoding: mine.encoding, segments: mine.segments }, `smsSegments(${s.slice(0, 12)}… ${s.length})`);
        }
        assert.equal(f.smsSegments('a'.repeat(161)).length, 161, 'longueur GSM-7 en septets');
    });

    test('smsVar : translittération vers GSM-7, espaces repliés, troncature avec « ... » au maximum indiqué', async () => {
        const f = await smsFormat();
        assert.equal(f.smsVar('Fête “Noël” – l’été…', 40), 'Fete "Noel" - l\'été...');
        assert.equal(f.smsVar('« Gala » à Saly', 40), '" Gala " à Saly');
        assert.equal(f.smsVar('Fête  de la   ville', 40), 'Fete de la ville', 'espaces repliés, U+202F en espace');
        assert.equal(f.smsVar('ç â ô î û ï ë œ ° ‘x’ — fin', 40), 'c a o i u i e oe o \'x\' - fin');
        assert.equal(f.smsVar('Gala Dakar', 30), 'Gala Dakar', 'valeur courte inchangée');
        assert.equal(f.smsVar('Abcdefghijklmnopqrstuvwxyz', 10), 'Abcdefg...', 'troncature : 10 caractères au plus, « ... » compris');
        assert.equal(f.smsVar('É Ç à é è ù', 30), 'É Ç à é è ù', 'lettres du GSM-7 de base conservées');
        const kept = f.smsVar('Gala 日本', 30); // lot 9 bis (R27, T51) : caractère hors GSM-7 retiré, plus de SMS UCS-2
        assert.equal(kept, 'Gala', 'caractère non translittérable retiré, espaces repliés');
        for (const v of [LONG_GSM_TEXT, 'ç'.repeat(80)]) {
            const out = f.smsVar(v, 30);
            assert.ok(out.length <= 30, `troncature à 30 : ${out}`);
            assert.deepEqual(nonGsmChars(out), [], `translittération complète : ${out}`);
        }
    });
});

// Garde-fou : la table G2 locale ne contient aucun doublon (sinon le test d'égalité serait trompeur).
assert.equal(EXPECTED_BY_TYPE.size, EXPECTED.length, 'table G2 locale sans doublon');

// ── Lot 9 bis (T51) : types nouveaux, textes fixes du contrat 11.1 et 11.2 ─────────────────────────────────

/**
 * Lot 9 bis (T51, contrat 11.1 N1 à N26) : les 26 types nouveaux, insérés en tête de la table G2 par cette déclaration
 * hissée (le fichier est cité par la matrice : les lignes avant la citation gardent leur numéro). Famille, canaux
 * (EMAIL par G.49), audience, politique, permission, inAppType (11.1, note finale) et titres in-app du contrat ; liens
 * vérifiés là où le contrat les fixe (N3, N8, N12), null ailleurs. EMAIL_VERIFICATION : synchrone, EMAIL seul.
 */
function lot9bisExpected(): ExpectedType[] {
    const PEV = '/partner/events/:event';
    return [
        ess('REFUND_DELAYED', [I, S, M, P], 'CLIENT', 'A', 'REFUND_PROGRESS', null, 'Remboursement retardé'),
        ess('WITHDRAWAL_DELAYED', [I, S, M, P], 'ANY', 'A', 'WITHDRAWAL_PENDING_CHECK', null, 'Retrait retardé'),
        ess('ADMIN_CASHOUT_TO_RESUME', [I, P, M], 'ADMIN', 'B', 'CASHOUT_ALERT', ['/admin/finance'], 'Versement à reprendre', 'refunds.manage'),
        ess('PAYMENT_REFUND_STARTED', [I, S, M, P], 'CLIENT', 'A', 'REFUND_PROGRESS', null, 'Remboursement de votre paiement'),
        ess('ADMIN_PARTNER_RESUBMITTED', [I, P, M], 'ADMIN', 'B', 'ADMIN_REVIEW', null, 'Dossier complété', 'partners.read'),
        ess('EVENT_CLOSED_HOLDER', [I, S, M, P], 'CLIENT', 'A', 'EVENT_STATUS', null, 'Événement clos'),
        ess('EVENT_CLOSED_BY_ADMIN', [I, S, M, P], 'PARTNER', 'B', 'EVENT_STATUS', null, 'Événement clos par l\'administration'),
        ess('SHIFT_OPEN_AT_END', [I, P, S, M], 'PARTNER', 'A', 'EVENT_STATUS', [`${PEV}?tab=caisse`], 'Caisse encore ouverte'),
        ess('TRANSFER_REVOKED', [S, I, P, M], 'CLIENT', 'B', 'TICKET_TRANSFER', null, 'Transfert annulé'),
        ess('TRANSFER_DECLINED_SENDER', [I, P, M], 'CLIENT', 'B', 'TICKET_TRANSFER', null, 'Billet refusé'),
        ess('TRANSFER_RECIPIENT_CHANGED', [I, P, M], 'CLIENT', 'B', 'TICKET_TRANSFER', null, 'Transfert annulé'),
        ess('CONTROLLER_INVITATION', [S, I, P, M], 'CLIENT', 'B', 'CONTROLLER', ['/invitations'], /^Invitation de .+$/),
        ess('EVENT_CANCELLED_BY_ADMIN', [I, S, M], 'PARTNER', 'A', 'EVENT_STATUS', null, 'Événement annulé par l\'administration'),
        ess('ADMIN_EVENT_CANCELLED', [I, M], 'ADMIN', 'B', 'EVENT_STATUS', null, 'Événement annulé par l\'organisateur', 'events.read'),
        ess('CONTROLLER_EVENT_CANCELLED', [I, S, M], 'CONTROLLER', 'B', 'CONTROLLER', null, 'Contrôle annulé'),
        ess('CONTROLLER_EVENT_CHANGED', [I, S, M], 'CONTROLLER', 'B', 'CONTROLLER', null, 'Contrôle modifié'),
        ess('CONTROLLER_EVENT_STATUS', [I, M], 'CONTROLLER', 'B', 'CONTROLLER', null, /^Événement (suspendu|de nouveau en ligne)$/),
        ess('TICKET_CANCELLED', [I, S, M], 'ANY', 'A', 'TICKET', null, /^(Invitation annulée|Billet annulé)$/),
        ess('ACCOUNT_SUSPENDED', [I, S, M], 'ANY', 'A', 'SECURITY', null, 'Compte suspendu'),
        ess('ACCOUNT_REACTIVATED', [I, S, M], 'ANY', 'A', 'SECURITY', null, 'Compte réactivé'),
        ess('ADMIN_EVENT_CHANGED', [I, M], 'ADMIN', 'B', 'ADMIN_REVIEW', null, 'Événement modifié après validation', 'events.read'),
        ess('EVENT_SUBMITTED_ACK', [I, M], 'PARTNER', 'B', 'EVENT_STATUS', null, 'Événement envoyé en validation'),
        ess('EVENT_FINISHED', [I, M], 'PARTNER', 'A', 'EVENT_STATUS', null, 'Événement terminé'),
        ess('CLOSING_REPORT_READY', [I, M], 'PARTNER', 'A', 'EVENT_STATUS', null, 'Rapport de clôture prêt'),
        ess('FUNDS_AVAILABLE', [I, M], 'PARTNER', 'B', 'SALES', null, 'Recettes disponibles'),
        { type: 'EMAIL_VERIFICATION', family: 'ESSENTIAL', topic: null, channels: [M], audience: 'ANY', suspendedPolicy: 'ALLOW', syncOnly: true, adminPermission: null, inAppType: null, links: null, title: null },
    ];
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Texte fixe du contrat, variables libres : `{url}` = URL de l'application de CTX, toute autre `{…}` = `.+`. Les noms
 * des variables de template_data ne sont pas fixés par le contrat pour les types nouveaux : le texte fixe est exigé mot
 * pour mot, les valeurs réelles sont prouvées par les suites de parcours (messages-*-9bis, cycle9bis-*, versements-*).
 */
function fixedText(template: string): RegExp {
    const body = template.split(/(\{[^}]+\})/).map((part) => {
        if (!/^\{[^}]+\}$/.test(part)) return escapeRe(part);
        return part === '{url}' ? escapeRe(APP_URL) : '.+';
    }).join('');
    return new RegExp(`^${body}$`);
}

/** Lot 9 bis (T51) : SMS des types nouveaux, texte fixe exact (11.1), une variante au moins doit correspondre. */
const LOT9BIS_SMS_PATTERNS: Record<string, RegExp[]> = {
    REFUND_DELAYED: [fixedText('Event Village : remboursement de {montant} retardé ("{titre}"). L\'équipe Event Village s\'en occupe, aucune action de votre part.')],
    WITHDRAWAL_DELAYED: [fixedText('Event Village : votre retrait de {montant} est retardé. L\'équipe Event Village s\'en occupe, aucune action de votre part.')],
    PAYMENT_REFUND_STARTED: [
        fixedText('Event Village : paiement de {montant} ("{titre}") sans billet possible : il vous est remboursé sur votre compte {opérateur}.'),
        fixedText('Event Village : paiement en double de {montant} ("{titre}"), remboursé sur votre compte {opérateur}. Vos billets restent valables.'),
    ],
    EVENT_CLOSED_HOLDER: [fixedText('Event Village : {titre} est clos après sa suspension, sans annulation ni remboursement automatique. {url}/tickets')],
    EVENT_CLOSED_BY_ADMIN: [fixedText('Event Village : {titre} est clos par l\'équipe Event Village après sa suspension. Motif : {motif}.')],
    SHIFT_OPEN_AT_END: [
        fixedText('Event Village : {titre} est terminé et 1 caisse reste ouverte. Fermez-la dans le pilotage : {url}/partner/events'),
        fixedText('Event Village : {titre} est terminé et {n} caisses restent ouvertes. Fermez-les dans le pilotage : {url}/partner/events'),
    ],
    TRANSFER_REVOKED: [fixedText('Event Village : le billet {titre} qui vous était transféré a été remboursé à son acheteur. Le transfert est annulé.')],
    CONTROLLER_INVITATION: [fixedText('Event Village : {société} vous invite à scanner les billets de {titre}. Répondez sur {url}/invitations')],
    EVENT_CANCELLED_BY_ADMIN: [fixedText('Event Village : {titre} annulé par l\'administration. Motif : {avis public}. {url}/partner/events')],
    CONTROLLER_EVENT_CANCELLED: [fixedText('Event Village : {titre} du {date} est annulé. Votre affectation à l\'entrée est retirée.')],
    CONTROLLER_EVENT_CHANGED: [
        fixedText('Event Village : affectation à l\'entrée de {titre} : nouvelle date {date}. {url}/login'),
        fixedText('Event Village : affectation à l\'entrée de {titre} : nouveau lieu {lieu}. {url}/login'),
        fixedText('Event Village : affectation à l\'entrée de {titre} : {date}, {lieu}. {url}/login'),
        fixedText('Event Village : affectation à l\'entrée de {titre} : nouvelle fin le {date}. {url}/login'),
    ],
    TICKET_CANCELLED: [
        fixedText('Event Village : votre invitation pour {titre} du {date} est annulée par l\'organisateur.'),
        fixedText('Event Village : votre billet gratuit pour {titre} du {date} est annulé par l\'organisateur.'),
        fixedText('Event Village : votre billet pour {titre} du {date} est annulé. Remboursement par l\'organisateur.'),
    ],
    ACCOUNT_SUSPENDED: [fixedText('Event Village : votre compte est suspendu. Motif : {motif}. Vos billets payés restent valables à l\'entrée. Contactez le support.')],
    ACCOUNT_REACTIVATED: [fixedText('Event Village : votre compte est réactivé. Vous pouvez de nouveau vous connecter : {url}/login')],
};

/** Lot 9 bis (T51) : contenus in-app (et donc push et email) des types nouveaux et modifiés, texte fixe exact. */
const LOT9BIS_IN_APP_PATTERNS: Record<string, RegExp[]> = {
    REFUND_DELAYED: [fixedText('Le remboursement de {montant} pour « {titre} » est retardé. L\'équipe Event Village s\'en occupe : vous serez prévenu dès le versement.')],
    WITHDRAWAL_DELAYED: [fixedText('Votre retrait de {montant} est retardé. L\'équipe Event Village s\'en occupe : le montant reste réservé et vous serez prévenu du versement.')],
    ADMIN_CASHOUT_TO_RESUME: [
        fixedText('Un versement de {montant} ({nature}) attend depuis plus de 30 minutes.'),
        fixedText('Un retrait de {montant} est bloqué : {motif}.'),
    ],
    PAYMENT_REFUND_STARTED: [
        fixedText('Votre paiement de {montant} pour « {titre} » a été reçu, mais aucun billet n\'a pu être émis. Il vous est remboursé sur votre compte {opérateur} : vous serez prévenu du versement.'),
        fixedText('Un second paiement de {montant} pour « {titre} » a été encaissé pour le même panier. Il vous est remboursé sur votre compte {opérateur} ; vos billets restent valables.'),
    ],
    ADMIN_PARTNER_RESUBMITTED: [fixedText('{société} a complété son dossier refusé : il attend un nouvel examen.')],
    EVENT_CLOSED_HOLDER: [fixedText('« {titre} » est clos par l\'équipe Event Village après sa suspension. Il n\'est pas annulé : aucun remboursement automatique.')],
    EVENT_CLOSED_BY_ADMIN: [fixedText('« {titre} » du {date} est clos par l\'administration, sans annulation. Motif : {motif}')],
    SHIFT_OPEN_AT_END: [/^« .+ » est terminé et \d+ caisses? restent? ouvertes?\. Fermez-les dans l'onglet Caisse du pilotage\.$/],
    TRANSFER_REVOKED: [fixedText('Le billet pour « {titre} » a été remboursé à son acheteur : le transfert est annulé.')],
    TRANSFER_DECLINED_SENDER: [fixedText('Le destinataire a refusé votre billet pour « {titre} » : il reste dans vos billets.')],
    TRANSFER_RECIPIENT_CHANGED: [fixedText('Le destinataire de votre billet pour « {titre} » a changé de numéro : le transfert est annulé et le billet reste dans vos billets.')],
    CONTROLLER_INVITATION: [/^.+ vous invite à contrôler l'entrée de « .+ »( et \d+ autres? événements?)?\. Répondez avant le .+\.$/],
    EVENT_CANCELLED_BY_ADMIN: [fixedText('« {titre} » du {date} est annulé par l\'administration. Motif : {avis public} Les remboursements en ligne sont lancés : suivez-les dans l\'onglet Clôture.')],
    ADMIN_EVENT_CANCELLED: [fixedText('« {titre} » de {société} est annulé par l\'organisateur. Motif interne : {motif}')],
    CONTROLLER_EVENT_CANCELLED: [fixedText('« {titre} » du {date} est annulé : votre affectation à l\'entrée est retirée.')],
    CONTROLLER_EVENT_CHANGED: [fixedText('« {titre} » : {changement}. Votre affectation est maintenue.')],
    CONTROLLER_EVENT_STATUS: [
        fixedText('« {titre} » est suspendu : le contrôle d\'accès est fermé jusqu\'à nouvel avis.'),
        fixedText('« {titre} » reprend : votre affectation est maintenue.'),
    ],
    TICKET_CANCELLED: [
        fixedText('Votre invitation pour « {titre} » du {date} est annulée par l\'organisateur.'),
        fixedText('Votre billet gratuit pour « {titre} » du {date} est annulé par l\'organisateur.'),
        fixedText('Votre billet pour « {titre} » du {date} est annulé. Le remboursement se fait auprès de l\'organisateur.'),
    ],
    ACCOUNT_SUSPENDED: [fixedText('Votre compte est suspendu. Motif : {motif} Vos billets payés restent valables à l\'entrée : présentez le billet hors ligne déjà enregistré sur votre téléphone, ou donnez le numéro du billet avec une pièce d\'identité. Contactez le support.')],
    ACCOUNT_REACTIVATED: [fixedText('Votre compte est réactivé : vous pouvez de nouveau vous connecter.')],
    ADMIN_EVENT_CHANGED: [fixedText('« {titre} » de {société} : {changements} après validation. Vérifiez la fiche.')],
    EVENT_SUBMITTED_ACK: [fixedText('« {titre} » est envoyé à l\'équipe Event Village pour validation. Vous serez prévenu de la décision.')],
    EVENT_FINISHED: [fixedText('« {titre} » est terminé. Le rapport de clôture est prêt dans l\'onglet Clôture.')],
    CLOSING_REPORT_READY: [fixedText('Toutes les caisses de « {titre} » sont fermées : le rapport de clôture est prêt.')],
    FUNDS_AVAILABLE: [fixedText('Les recettes de « {titre} » sont disponibles sur votre solde : vous pouvez demander un retrait.')],
    // 11.2 : types modifiés.
    INVITATION_RECEIVED: [/^\d+ invitations? pour « .+ » le .+ : vos billets sont dans Mes billets\.$/],
    ADMIN_SMS_DAILY_THRESHOLD: [fixedText('{count} SMS indispensables envoyés aujourd\'hui (seuil d\'alerte : {threshold}). Ils n\'ont pas de plafond : vérifiez leur origine dans la supervision.')],
    PARTNER_REJECTED: [/^.+ Vous pouvez compléter votre dossier une fois depuis votre tableau de bord\.$/],
    PHONE_CHANGED: [fixedText('Le numéro de téléphone de votre compte a été modifié. Si ce n\'est pas vous, contactez le support.')],
};

describe('Lot 9 bis (T51) : textes fixes des types nouveaux et modifiés (contrat 11.1, 11.2)', () => {
    test('SMS des types nouveaux : texte fixe du contrat mot pour mot (sample du catalogue)', async () => {
        const { catalog } = await catalogModule();
        const issues: string[] = [];
        for (const [type, patterns] of Object.entries(LOT9BIS_SMS_PATTERNS)) {
            const e = known(catalog, type);
            assert.equal(typeof e.sms, 'function', `${type} : rendu SMS absent`);
            const text = e.sms!(e.sample, CTX);
            if (!patterns.some((re) => re.test(text))) issues.push(`${type} : « ${text} » ne suit aucun texte du contrat`);
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });

    test('in-app des types nouveaux et modifiés : texte fixe du contrat mot pour mot ; PHONE_CHANGED titré « Numéro de téléphone modifié »', async () => {
        const { catalog } = await catalogModule();
        const issues: string[] = [];
        for (const [type, patterns] of Object.entries(LOT9BIS_IN_APP_PATTERNS)) {
            const e = known(catalog, type);
            assert.equal(typeof e.inApp, 'function', `${type} : rendu in-app absent`);
            const content = norm(e.inApp!(e.sample).content);
            if (!patterns.some((re) => re.test(content))) issues.push(`${type} : « ${content} » ne suit aucun texte du contrat`);
        }
        assert.deepEqual(issues, [], issues.join('\n'));
        const phone = await entry('PHONE_CHANGED');
        assert.equal(norm(phone.inApp!(phone.sample).title), 'Numéro de téléphone modifié', 'PHONE_CHANGED : titre de l\'email (11.2 M22)');
        assert.equal(phone.link(phone.sample), '/profile', 'PHONE_CHANGED : lien vers le profil (11.2 M22)');
    });

    test('TICKET_SCANNED regroupé (11.2 M4) : « {n} billets de votre commande pour « {titre} » ont été contrôlés à l\'entrée. »', async () => {
        const e = await entry('TICKET_SCANNED');
        const r = e.inApp!(dataFrom(e.sample, { ...SHORT_EVENT, ticket_count: 4 }));
        assert.deepEqual({ title: norm(r.title), content: norm(r.content) },
            { title: 'Entrée validée', content: '4 billets de votre commande pour « Gala Dakar » ont été contrôlés à l\'entrée.' }, 'in-app regroupé');
    });

    test('SMS de chaque type : aucun caractère hors GSM-7, même avec une saisie dans d\'autres écritures (R27, renforcé)', async () => {
        const { catalog } = await catalogModule();
        const issues: string[] = [];
        for (const exp of SMS_TYPES) {
            const e = known(catalog, exp.type);
            for (const d of variants(exp.type, stress(e.sample, `${LONG_UCS2_TEXT} 🎉 Xew-xew ŋ`))) {
                const text = e.sms!(d, CTX);
                const m = measureSms(text);
                if (m.encoding !== 'GSM7' || m.segments !== 1) issues.push(`${exp.type} : ${m.encoding}, ${m.segments} segment(s), ${m.length} — ${text}`);
                if (EMOJI_RE.test(text)) issues.push(`${exp.type} : émoji conservé — ${text}`);
            }
        }
        assert.deepEqual(issues, [], issues.join('\n'));
    });
});

// ── Lot 9 ter (B.7 T-B1 à T-B3, contrat 11.1 et 11.2) : types nouveaux et parties nouvelles d'ADMIN_EVENT_CHANGED ──

/**
 * Lot 9 ter (B.7 T-B1, contrat 11.1 N1 à N4) : les 4 types nouveaux du lot, dont SCAN_REFUSALS_ALERT de la section D
 * (9t.18), insérés dans la table G2 par cette déclaration hissée (le fichier est cité par la matrice à la ligne 504 : les
 * lignes d'avant gardent leur numéro). Rouge jusqu'à fix(9t.registre) (M04 et catalogue) : chaque boucle nomme le type absent.
 */
function lot9terExpected(): ExpectedType[] {
    return [
        ess('TICKET_REFUNDED_HOLDER', [S, I, P, M], 'CLIENT', 'A', 'TICKET', ['/tickets'], 'Billet annulé'),
        ess('ADMIN_EVENT_PUBLISHED', [I, M], 'ADMIN', 'B', 'ADMIN_REVIEW', ['/admin/events/:event'], 'Événement publié par l\'organisateur', 'events.read'),
        ess('ADMIN_EVENT_WITHDRAWN', [I, M], 'ADMIN', 'B', 'ADMIN_REVIEW', ['/admin/events/:event'], 'Soumission retirée par l\'organisateur', 'events.read'),
        ess('SCAN_REFUSALS_ALERT', [I, P, M], 'PARTNER', 'B', 'ALERT', ['/partner/events/:event?tab=entrees'], 'Refus en série à une porte'),
    ];
}

/**
 * Lot 9 quinquies (D1) : SMS aux administrateurs pour ce qui attend leur action (migration 20261112000001) ; SMS seul,
 * indispensable, destinataires choisis par notif_admin_review_sms (aucune permission au registre). Ajout signalé au rapport.
 */
function lot9quinquiesExpected(): ExpectedType[] {
    return [
        ess('ADMIN_REVIEW_SMS', [S], 'ADMIN', 'B', null, ['/admin/dashboard'], null),
        ess('ACCOUNT_LOGIN_FAILURES', [S, M], 'ANY', 'B', null, ['/forgot-password'], null), // A1 (AUTH-01)
    ];
}

/** Lot 9 ter (B.7 T-B3, 9t.10) : ADMIN_EVENT_CHANGED rendu aussi avec les parties PRICE, CHANNELS et les deux ensemble. */
function adminChangeVariants(base: Data): Data[] {
    return [
        base,
        { ...base, changes: ['PRICE'], category: base.category ?? 'VIP', old_price: 10000, new_price: 15000 },
        { ...base, changes: ['CHANNELS'], category: base.category ?? 'VIP', sale_online: false, sale_counter: true },
        { ...base, changes: ['PRICE', 'CHANNELS'], category: base.category ?? 'VIP', old_price: 10000, new_price: 15000, sale_online: true, sale_counter: false },
    ];
}

const LOT9TER_TICKET_ID = '5d1f0c3e-8a2b-4c6d-9e0f-1a2b3c4d5e6f';

describe('Lot 9 ter : textes exacts des types nouveaux et des parties nouvelles (contrat 11.1, 11.2 N1 à N4, M1)', () => {
    test('TICKET_REFUNDED_HOLDER (N1, 9t.2) : in-app « Billet annulé », catégorie et titre en entier, lien /tickets ; SMS d\'un segment GSM-7 au pire cas', async () => {
        const e = await entry('TICKET_REFUNDED_HOLDER');
        const d = dataFrom(e.sample, { ...SHORT_EVENT, ticket_id: LOT9TER_TICKET_ID, category: 'VIP' });
        const r = e.inApp!(d);
        assert.equal(norm(r.title), 'Billet annulé');
        assert.match(norm(r.content), fixedText('Votre billet VIP pour « Gala Dakar » du {date} a été annulé. Le remboursement est versé à l\'acheteur d\'origine.'),
            `contenu in-app (N1) : « ${norm(r.content)} »`);
        assert.ok(norm(r.content).startsWith('Votre billet VIP pour « Gala Dakar » du '), `catégorie et titre en clair : « ${norm(r.content)} »`);
        assert.equal(e.link(d), '/tickets', 'lien N1');
        const worst = dataFrom(e.sample, { title: LONG_GSM_TEXT, category: 'Carré VVIP « Prestige » {[~]} € tribune d’honneur' });
        const text = e.sms!(worst, CTX);
        const m = measureSms(text);
        assert.deepEqual({ encoding: m.encoding, segments: m.segments }, { encoding: 'GSM7', segments: 1 }, `SMS au pire cas : ${m.length} septets — ${text}`);
        assert.ok(text.endsWith(' a été annulé. Le remboursement est versé à l\'acheteur d\'origine.'), `fin du SMS (consigne 0.2) : ${text}`);
    });

    test('ADMIN_EVENT_PUBLISHED et ADMIN_EVENT_WITHDRAWN (N2, N3, 9t.10) : titres, contenus exacts avec et sans société, lien de la fiche admin, aucun SMS', async () => {
        const pub = await entry('ADMIN_EVENT_PUBLISHED');
        const wd = await entry('ADMIN_EVENT_WITHDRAWN');
        const withCompany = { ...SHORT_EVENT, company: 'Sabar Events' };
        const rendered = (e: CatalogEntry, d: Data): { title: string; content: string } => {
            const r = e.inApp!(d);
            return { title: norm(r.title), content: norm(r.content) };
        };
        assert.deepEqual(rendered(pub, dataFrom(pub.sample, withCompany)), {
            title: 'Événement publié par l\'organisateur',
            content: '« Gala Dakar » de Sabar Events est publié par l\'organisateur : sa page publique est en ligne.',
        }, 'N2 avec société');
        assert.equal(rendered(pub, dataFrom(pub.sample, SHORT_EVENT, ['company'])).content,
            '« Gala Dakar » est publié par l\'organisateur : sa page publique est en ligne.', 'N2 sans société');
        assert.deepEqual(rendered(wd, dataFrom(wd.sample, withCompany)), {
            title: 'Soumission retirée par l\'organisateur',
            content: '« Gala Dakar » de Sabar Events est retiré de la validation par l\'organisateur : il n\'attend plus votre examen.',
        }, 'N3 avec société');
        assert.equal(rendered(wd, dataFrom(wd.sample, SHORT_EVENT, ['company'])).content,
            '« Gala Dakar » est retiré de la validation par l\'organisateur : il n\'attend plus votre examen.', 'N3 sans société');
        assert.equal(pub.link(dataFrom(pub.sample, withCompany)), `/admin/events/${EVENT_ID}`, 'lien N2');
        assert.equal(wd.link(dataFrom(wd.sample, withCompany)), `/admin/events/${EVENT_ID}`, 'lien N3');
        assert.equal(pub.sms, undefined, 'N2 : aucun SMS');
        assert.equal(wd.sms, undefined, 'N3 : aucun SMS');
    });

    test('SCAN_REFUSALS_ALERT (N4, 9t.18) : « {porte} : {n} refus en {m} minutes pour « {titre} ». » ; « minute » au singulier ; lien vers l\'onglet Entrées ; aucun SMS', async () => {
        const e = await entry('SCAN_REFUSALS_ALERT');
        const d = dataFrom(e.sample, { ...SHORT_EVENT, gate_name: 'Porte B', zone_name: 'Entrée générale', refused_count: 12, window_minutes: 5, threshold: 10 });
        const r = e.inApp!(d);
        assert.deepEqual({ title: norm(r.title), content: norm(r.content) }, {
            title: 'Refus en série à une porte',
            content: 'Porte B : 12 refus en 5 minutes pour « Gala Dakar ». Vérifiez la porte avec vos contrôleurs.',
        }, 'N4, 5 minutes');
        assert.equal(norm(e.inApp!(dataFrom(d, { window_minutes: 1 })).content),
            'Porte B : 12 refus en 1 minute pour « Gala Dakar ». Vérifiez la porte avec vos contrôleurs.', 'N4, 1 minute');
        assert.equal(e.link(d), `/partner/events/${EVENT_ID}?tab=entrees`, 'lien N4');
        assert.equal(e.sms, undefined, 'N4 : aucun SMS (D-P3)');
    });

    test('ADMIN_EVENT_CHANGED (M1, 9t.10) : parties PRICE et CHANNELS, phrase finale inchangée', async () => {
        const e = await entry('ADMIN_EVENT_CHANGED');
        const base: Data = { ...SHORT_EVENT, company: 'Sabar Events', category: 'VIP' };
        const content = (over: Data): string => norm(e.inApp!(dataFrom(e.sample, { ...base, ...over }, ['old_title'])).content);
        const fcfa = (n: number): string => norm(formatFcfa(n));
        assert.equal(content({ changes: ['PRICE'], old_price: 10000, new_price: 15000 }),
            `« Gala Dakar » de Sabar Events : nouveau prix pour « VIP » (${fcfa(15000)} au lieu de ${fcfa(10000)}) après validation. Vérifiez la fiche.`, 'PRICE');
        const channels: Array<[boolean, boolean, string]> = [
            [true, true, 'en ligne et au guichet'], [true, false, 'en ligne seulement'], [false, true, 'au guichet seulement'], [false, false, 'aucun canal'],
        ];
        for (const [online, counter, label] of channels) {
            assert.equal(content({ changes: ['CHANNELS'], sale_online: online, sale_counter: counter }),
                `« Gala Dakar » de Sabar Events : canaux de vente de « VIP » changés (${label}) après validation. Vérifiez la fiche.`, `CHANNELS ${online}/${counter}`);
        }
        assert.equal(content({ changes: ['PRICE', 'CHANNELS'], old_price: 10000, new_price: 15000, sale_online: true, sale_counter: false }),
            `« Gala Dakar » de Sabar Events : nouveau prix pour « VIP » (${fcfa(15000)} au lieu de ${fcfa(10000)}), canaux de vente de « VIP » changés (en ligne seulement) après validation. Vérifiez la fiche.`,
            'PRICE et CHANNELS : une alerte, deux parties');
    });
});
