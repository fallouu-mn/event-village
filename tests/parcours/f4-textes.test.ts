/**
 * Finition 4 — textes des messages, sans base (rendu du catalogue lib/notifications/catalog.ts).
 *
 *  1. Chaque SMS du catalogue, avec ses variantes de la finition 4, tient en UN segment GSM-7 (≤ 160 caractères, aucun
 *     caractère hors de l'alphabet GSM 03.38 de base, calculé ici) avec des valeurs longues (titre de 60 caractères,
 *     organisateur de 40, porte de 30) et une URL de 27 caractères ;
 *  2. textes exacts des messages nouveaux ou changés (repris mot pour mot dans docs/finition-4-rapport.md) ;
 *  3. aucun mot technique dans les textes : ni code de statut, ni « UTC », ni « refusé par l'opérateur » pour un retrait
 *     constaté non versé, ni promesse du billet hors ligne pour un compte suspendu ;
 *  4. politique de nuit du catalogue : toute la famille OPTIONAL en DEFER ; les indispensables urgents en SEND.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFICATION_CATALOG, renderNotification, renderSyncSms } from '../../lib/notifications/catalog';

type Any = Record<string, unknown>;
const CTX = { appUrl: 'https://app.eventvillage.sn' };
const LONG_TITLE = 'Festival international des musiques urbaines de Dakar 2026';
const CATALOG = NOTIFICATION_CATALOG as unknown as Record<string, { channels: readonly string[]; sample: Any; syncOnly: boolean; family: string; nightPolicy: string }>;

/** Alphabet GSM 03.38 de base (sans l'extension) : calcul indépendant du module testé. */
const GSM_BASIC = new Set([
    ...'@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
]);

function sms(type: string, data: Any): string {
    return (renderNotification(type as never, 'SMS' as never, data, CTX) as unknown as { text: string }).text;
}
/** Cloche : espaces insécables (guillemets, montants) ramenées à des espaces pour comparer les textes. */
function inApp(type: string, data: Any): { title: string; content: string } {
    const r = renderNotification(type as never, 'IN_APP' as never, data, CTX) as unknown as { title: string; content: string };
    return { title: r.title.replace(/\u00a0/g, ' '), content: r.content.replace(/\u00a0/g, ' ') };
}

function assertOneSegment(label: string, text: string): void {
    const bad = [...text].filter((c) => !GSM_BASIC.has(c));
    assert.deepEqual(bad, [], `${label} : caractères hors GSM-7 ${JSON.stringify(bad)} dans « ${text} »`);
    assert.ok(text.length <= 160, `${label} : ${text.length} caractères (> 160) : « ${text} »`);
    assert.ok(text.startsWith('Event Village : '), `${label} : préfixe absent`);
}

/** Valeurs longues réalistes appliquées à chaque échantillon. */
function long(sample: Any): Any {
    const d: Any = { ...sample };
    if (typeof d.title === 'string') d.title = LONG_TITLE;
    if (typeof d.organizer === 'string') d.organizer = 'Association culturelle des jeunes de Pikine';
    if (typeof d.gate_name === 'string') d.gate_name = 'Porte principale côté parking Est';
    if (typeof d.controller_name === 'string') d.controller_name = 'Mame Diarra Ndiaye Diop';
    if (typeof d.reason === 'string') d.reason = 'Pièce d’identité illisible et justificatif de domicile manquant';
    if (typeof d.category === 'string') d.category = 'Carré VIP premium avec boissons';
    return d;
}

const VARIANTS: Record<string, Any[]> = {
    REFUND_REQUESTED: [{ by: 'ORGANIZER' }, { by: 'ADMIN' }, { by: 'CLIENT' }, { by: 'CANCELLATION' }, { by: 'ADMIN', operator: 'WAVE', amount: 1_250_000 }],
    WITHDRAWAL_REJECTED: [{ not_paid: true }, { not_paid: false }],
    PARTNER_REJECTED: [{ resubmitted: true }, { resubmitted: false }],
    PROMOTION_DECIDED: [{ status: 'APPROUVEE' }, { status: 'REFUSEE', reason: 'Visuel non conforme à la charte' }, { status: 'REFUSEE' }],
    CONTROLLER_EVENT_STATUS: [{ status: 'SUSPENDU' }, { status: 'PUBLIE' }],
    SHIFT_CLOSED_BY_OTHER: [{ closed_by: 'ADMIN', declared: 1_250_000 }, { closed_by: 'PARTNER', declared: null }],
    PARTNER_DAILY_SUMMARY: [
        { event_count: 4, title: undefined, sold_count: 12_345, sold_amount: 12_345_678, refund_count: 1_234, refund_amount: 1_234_567, entry_count: 12_345 },
        { sold_count: 0, sold_amount: 0, refund_count: 2, refund_amount: 10_000, entry_count: 0 },
        { sold_count: 1, sold_amount: 5_000, refund_count: 0, refund_amount: 0, entry_count: 1 },
    ],
    SALES_UPDATE_SMS: [{ ticket_count: 1, total: 5_000 }, { ticket_count: 1_234, total: 12_345_678 }],
    PARTNER_REFUND_REQUESTS: [{ ticket_count: 1, amount: 5_000 }, { ticket_count: 999, amount: 1_234_567 }],
    SCAN_REFUSALS_ALERT: [{ refused_count: 999, window_minutes: 15 }],
    EVENT_SOLD_OUT: [{ category: 'Carré VIP' }],
};

describe('1. chaque SMS en un segment GSM-7, variantes de la finition 4 comprises', () => {
    for (const [type, tpl] of Object.entries(CATALOG)) {
        if (tpl.syncOnly || !tpl.channels.includes('SMS')) continue;
        test(type, () => {
            for (const variant of [{}, ...(VARIANTS[type] ?? [])]) {
                assertOneSegment(`${type} ${JSON.stringify(variant)}`, sms(type, { ...long(tpl.sample), ...variant }));
            }
        });
    }
});

const S = (type: string, over: Any = {}): string => sms(type, { ...CATALOG[type].sample, ...over });
const I = (type: string, over: Any = {}): { title: string; content: string } => inApp(type, { ...CATALOG[type].sample, ...over });

describe('2. textes exacts (échantillons du catalogue)', () => {
    test('ventes : SMS groupé, résumé du matin, demandes de remboursement, complet', () => {
        assert.equal(S('SALES_UPDATE_SMS'), 'Event Village : 12 billets vendus depuis 14:00 pour Gala de la Teranga : 60 000 F CFA.');
        assert.equal(S('PARTNER_DAILY_SUMMARY', { sold_count: 12, sold_amount: 60_000, refund_count: 1, refund_amount: 5_000, entry_count: 40 }),
            'Event Village : hier pour Gala de la Teranga : 12 billets vendus (60 000 F CFA), 1 remboursé (-5 000 F CFA), 40 entrées.');
        assert.equal(S('PARTNER_REFUND_REQUESTS'), 'Event Village : 3 billets de Gala de la Teranga remboursés à la demande des acheteurs depuis 14:05 (-15 000 F CFA).');
        assert.equal(S('PARTNER_REFUND_REQUESTS', { ticket_count: 1, amount: 5_000 }), 'Event Village : un billet de Gala de la Teranga est remboursé à la demande de son acheteur (-5 000 F CFA).');
        assert.equal(I('NEW_ORDER', { order_count: 2, ticket_count: 3, total: 30_000, since: '2026-11-14T14:05:00.000Z' }).content,
            '3 billets vendus pour « Gala de la Teranga » en 2 commandes depuis 14:05 (+30 000 F CFA).');
        assert.equal(I('NEW_ORDER', { order_count: 2, since: '2026-11-14T14:05:00.000Z' }).title, 'Nouvelles ventes');
        assert.equal(I('NEW_ORDER').title, 'Nouvelle commande');
        assert.equal(I('EVENT_SOLD_OUT', { category: 'Carré VIP' }).content, 'Toutes les catégories de « Gala de la Teranga » sont vendues, la dernière : « Carré VIP ».');
    });

    test('spectateur : bienvenue et merci', () => {
        assert.equal(S('ENTRY_WELCOME'), 'Event Village : Bienvenue à Gala de la Teranga ! Bonne soirée avec Sabar Events.');
        assert.equal(S('ENTRY_THANKS'), 'Event Village : merci de votre présence à Gala de la Teranga ! https://app.eventvillage.sn/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01');
        assert.equal(I('ENTRY_WELCOME').content, 'Bienvenue à « Gala de la Teranga » ! Bonne soirée avec Sabar Events. Votre entrée est validée.');
    });

    test('remboursement lancé par quelqu’un d’autre que le client', () => {
        assert.equal(S('REFUND_REQUESTED', { by: 'ORGANIZER' }),
            'Event Village : billet Gala de la Teranga annulé par l\'organisateur : remboursement de 5 000 F CFA en cours sur votre compte Orange Money.');
        assert.equal(S('REFUND_REQUESTED', { by: 'ADMIN' }),
            'Event Village : billet Gala de la Teranga annulé par l\'équipe Event Village : remboursement de 5 000 F CFA en cours sur votre compte Orange Money.');
        assert.equal(I('REFUND_REQUESTED', { by: 'ADMIN' }).title, 'Billet annulé par Event Village');
        assert.equal(I('REFUND_REQUESTED', { by: 'CLIENT' }).title, 'Remboursement en cours');
    });

    test('billet revenu à l’expéditeur, recettes, porte', () => {
        assert.equal(S('TRANSFER_EXPIRED'), 'Event Village : votre billet Gala de la Teranga n\'a pas été accepté à temps : il vous revient. https://app.eventvillage.sn/tickets');
        assert.equal(S('FUNDS_AVAILABLE'), 'Event Village : les recettes de Gala de la Teranga sont disponibles. Demandez votre retrait : https://app.eventvillage.sn/partner/finance');
        assert.equal(S('SCAN_REFUSALS_ALERT'), 'Event Village : Porte B : 12 refus en 5 min pour Gala de la Teranga. Vérifiez cette porte avec votre équipe. https://app.eventvillage.sn/partner/events');
    });
});

describe('3. textes justes', () => {
    test('retrait constaté non versé : jamais « refusé par l’opérateur »', () => {
        assert.doesNotMatch(S('WITHDRAWAL_REJECTED', { not_paid: true }), /opérateur|refus/);
        assert.doesNotMatch(I('WITHDRAWAL_REJECTED', { not_paid: true }).content, /opérateur|refus/);
        assert.equal(I('WITHDRAWAL_REJECTED', { not_paid: true }).title, 'Retrait non versé');
        assert.doesNotMatch(I('ADMIN_WITHDRAWAL_REJECTED', { not_paid: true }).title, /opérateur/);
    });
    test('compte suspendu : aucune promesse du billet hors ligne', () => {
        for (const t of [S('ACCOUNT_SUSPENDED'), I('ACCOUNT_SUSPENDED').content]) assert.doesNotMatch(t, /hors ligne|enregistré sur votre téléphone/);
        assert.match(I('ACCOUNT_SUSPENDED').content, /Vos billets payés restent valables\./);
    });
    test('alertes de plafond SMS : plus de « UTC », ce qui continue est dit', () => {
        for (const type of ['ADMIN_SMS_CAP_GLOBAL', 'ADMIN_SMS_CAP_NON_OTP', 'ADMIN_SMS_DAILY_THRESHOLD']) {
            const c = I(type).content;
            assert.doesNotMatch(c, /UTC|n'ont pas de plafond :|jamais plafonn/, type);
        }
        assert.match(I('ADMIN_SMS_CAP_GLOBAL').content, /indispensables .* partent toujours/);
        assert.match(I('ADMIN_SMS_CAP_NON_OTP').content, /indispensables .* partent toujours/);
    });
    test('second refus d’une demande de partenaire : la suite est le support', () => {
        assert.doesNotMatch(I('PARTNER_REJECTED', { resubmitted: true }).content, /Vous pouvez compléter/);
        assert.match(S('PARTNER_REJECTED', { resubmitted: true }), /Dossier déjà complété une fois\. Aide : https:\/\/app\.eventvillage\.sn\/aide$/);
        assert.match(S('PARTNER_REJECTED', { resubmitted: false }), /Complétez votre dossier : https:\/\/app\.eventvillage\.sn\/partner\/dashboard$/);
    });
    test('réactivation : aucun motif transmis, texte inchangé', () => {
        assert.equal(I('ACCOUNT_REACTIVATED', {}).content, 'Votre compte est réactivé : vous pouvez de nouveau vous connecter.');
        assert.doesNotMatch(S('PARTNER_REACTIVATED'), /Motif/);
    });
});

describe('5. design 1c : « super-administrateur », écart de caisse en mots', () => {
    test('aucun modèle ne dit « Superadmin » (cloche, SMS, libellé), code du numéro administrateur compris', () => {
        const found: string[] = [];
        for (const [type, tpl] of Object.entries(CATALOG)) {
            if (tpl.syncOnly) continue;
            const t = tpl as unknown as { label: string };
            if (/Superadmin/.test(t.label)) found.push(`${type} : libellé`);
            if (tpl.channels.includes('IN_APP')) { const r = I(type); if (/Superadmin/.test(r.title + r.content)) found.push(`${type} : cloche`); }
            if (tpl.channels.includes('SMS') && /Superadmin/.test(S(type))) found.push(`${type} : SMS`);
        }
        for (const type of ['ADMIN_PHONE_CHANGED', 'ADMIN_PHONE_CONFIRMED']) {
            for (const by_self of [true, false]) {
                const text = S(type, { by_self });
                assertOneSegment(`${type} ${by_self}`, text);
                if (/Superadmin/.test(text)) found.push(`${type} by_self=${by_self}`);
            }
        }
        const code = renderSyncSms('OTP_ADMIN_PHONE', { code: '483920' });
        if (/Superadmin/.test(code)) found.push('OTP_ADMIN_PHONE');
        assert.deepEqual(found, []);
        assertOneSegment('OTP_ADMIN_PHONE', code);
        assert.match(code, /Donnez-le seulement au super-administrateur\./);
    });
    test('écart de caisse : « Il manque … », « … de trop », un seul SMS au pire cas', () => {
        assert.equal(S('SHIFT_DISCREPANCY', { difference: -2_500 }), 'Event Village : caisse de Fatou Sow fermée (Gala de la Teranga). Il manque 2 500 F CFA. https://app.eventvillage.sn/partner/events');
        assert.equal(S('SHIFT_DISCREPANCY', { difference: 2_500 }), 'Event Village : caisse de Fatou Sow fermée (Gala de la Teranga). 2 500 F CFA de trop. https://app.eventvillage.sn/partner/events');
        assert.equal(I('SHIFT_DISCREPANCY', { difference: -2_500, justification: null }).content, 'La caisse de Fatou Sow pour « Gala de la Teranga » est fermée. Il manque 2 500 F CFA.');
        for (const difference of [-9_999_999, 9_999_999, -1, 1]) {
            const text = sms('SHIFT_DISCREPANCY', { ...long(CATALOG.SHIFT_DISCREPANCY.sample), controller_name: 'Mame Diarra Ndiaye Diop Sarr', difference });
            assertOneSegment(`écart ${difference}`, text);
            assert.doesNotMatch(text, /écart de [-+]/);
        }
    });
});

describe('4. politique de nuit du catalogue', () => {
    test('famille OPTIONAL : DEFER ; urgents : SEND', () => {
        for (const [type, tpl] of Object.entries(CATALOG)) {
            if (tpl.family === 'OPTIONAL') assert.equal(tpl.nightPolicy, 'DEFER', type);
        }
        for (const type of ['PURCHASE_CONFIRMED', 'EVENT_CANCELLED', 'EVENT_CHANGED', 'REFUND_PAID', 'PASSWORD_CHANGED', 'ENTRY_WELCOME', 'SCAN_REFUSALS_ALERT', 'TRANSFER_OFFERED']) {
            assert.equal(CATALOG[type].nightPolicy, 'SEND', type);
        }
        for (const type of ['ADMIN_REVIEW_SMS', 'FUNDS_AVAILABLE', 'PARTNER_REFUND_REQUESTS', 'TRANSFER_EXPIRED']) {
            assert.equal(CATALOG[type].nightPolicy, 'DEFER', type);
        }
    });
});
