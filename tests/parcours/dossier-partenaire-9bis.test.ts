/**
 * Lot 9 bis, tâche 17 (R53, R54, R90 ; contrat 5.17, B40 à B42, 4.2) — dossier partenaire.
 *  - R53 : POST /api/partner/register en deux appels. Appel 1 sans `otpCode` : 200 `{ otpSent: true, phone }`, un SMS de
 *    code au numéro, RIEN de créé (ni users, ni partners, ni ADMIN_PARTNER_REGISTERED en file). Appel 2 avec un mauvais
 *    code : 400 OTP_INVALID, aucune création. Appel 2 avec le bon code : 201, compte et fiche, `partners.phone_verified`
 *    vrai et `users.phone_verified_at` posé ;
 *  - R90 : `ninea` et `rccm` enregistrés (partners) et servis par GET /api/admin/partners ;
 *  - R54 : une partenaire REJETE complète son dossier une fois (POST /api/partner/dossier/complete) : EN_ATTENTE,
 *    `resubmitted_at` posé, ADMIN_PARTNER_RESUBMITTED aux admins ; second essai → 409 RESUBMIT_ALREADY_USED ;
 *    partenaire VALIDE → 409 DOSSIER_NOT_REJECTED.
 * Aides : registerPartnerTwoStep et uploadRegistrationDocuments (tests/parcours/helpers.ts, test(9b.17) des aides).
 * Choix d'écriture (contrat muet, signalé) : `upload_ids` de la route de complément reçoit les jetons de dépôt rendus par
 * /api/partner/documents/upload (seul identifiant que le navigateur connaît).
 *
 * Rouge avant correctif (fix(9b.17), M04) : l'appel 1 crée déjà compte, fiche et avis aux admins
 * (app/api/partner/register/route.ts:103-131, M/20261103000006:644-656) puis l'appel 2 répond 409 ; ninea et rccm
 * n'ont aucune colonne ; la route dossier/complete n'existe pas.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { getFakes } from '../fakes';
import { randomEmail, randomSenegalPhone, registerPartnerTwoStep, STRONG_PASSWORD, uploadRegistrationDocuments } from './helpers';
import { service } from './paiement-helpers';
import { jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import type { RouteResult } from './acces-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';

after(async () => {
    await assertLot9bisInvariants('dossier-partenaire-9bis');
});

type Row = Record<string, unknown>;

const DONE_TEXT = 'Dossier envoyé : il est de nouveau en cours de vérification.';

function sameQuotes(v: unknown): string {
    return String(v ?? '').replace(/’/g, '\'');
}

async function body(label: string, extra: Row = {}): Promise<Row> {
    return {
        companyName: `Dossier ${label} ${randomUUID().slice(0, 8)} SARL`,
        description: 'Organisateur fictif pour les tests du dossier partenaire (lot 9 bis).',
        address: '3 rue du Dossier',
        city: 'Dakar',
        activities: ['ORGANISATEUR'],
        firstName: 'Fatou',
        lastName: 'Dossier',
        phone: randomSenegalPhone('77'),
        email: randomEmail(`r53-${label}`),
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
        ...(await uploadRegistrationDocuments()),
        ...extra,
    };
}

async function accountsByPhone(phone: string): Promise<Row[]> {
    const { data, error } = await service.from('users').select('id, status, phone_verified_at').in('phone', [phone, phone.replace(/^\+/, '')]);
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

async function partnersByCompany(company: string): Promise<Row[]> {
    const { data, error } = await service.from('partners').select('*').eq('company_name', company);
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

async function adminNotices(type: string, company: string, since: number): Promise<number> {
    // Lot 9 quater : filtre posé dans la requête. Lu par type seul, l'historique dépasse le plafond de 1000 lignes de
    // PostgREST (max_rows) quand les suites créent plus d'admins, et les lignes les plus récentes étaient coupées.
    const { data, error } = await service.from('notification_outbox').select('created_at')
        .eq('type', type).eq('template_data->>company', company);
    assert.equal(error, null, `lecture de notification_outbox : ${error?.message}`);
    return (data ?? []).filter((r) => Date.parse(String(r.created_at)) >= since).length;
}

describe('R53 — le dossier n’est ouvert qu’après la vérification du code SMS', () => {
    test('appel 1 sans code : 200 { otpSent: true, phone }, un SMS de code, aucun compte, aucune fiche, aucun avis aux admins', async () => {
        const b = await body('appel1');
        const t0 = Date.now() - 1_000;
        const reg = await registerPartnerTwoStep(b, { stopAfterFirst: true });
        assert.equal(reg.first.status, 200, `appel 1 : ${JSON.stringify(reg.first.body)}`);
        assert.equal(reg.first.body.otpSent, true, `R53 : réponse de l’appel 1 (contrat 4.2) : ${JSON.stringify(reg.first.body)}`);
        assert.equal(reg.smsDuringFirst, 1, 'un SMS de code au numéro');
        assert.ok(reg.code, 'code à 6 chiffres reçu');
        assert.deepEqual(await accountsByPhone(String(b.phone)), [], 'R53 : aucun compte avant le code');
        assert.deepEqual(await partnersByCompany(String(b.companyName)), [], 'R53 : aucune fiche avant le code');
        assert.equal(await adminNotices('ADMIN_PARTNER_REGISTERED', String(b.companyName), t0), 0, 'R53 : aucun avis aux admins avant le code');
    });

    test('appel 2 avec un mauvais code : 400 OTP_INVALID, aucune création', async () => {
        const b = await body('mauvais-code');
        const reg = await registerPartnerTwoStep(b, { otpCode: '000000' });
        assert.equal(reg.first.status, 200, JSON.stringify(reg.first.body));
        assert.notEqual(reg.code, '000000', 'garde-fou : le code reçu diffère du code faux envoyé');
        assert.equal(reg.second?.status, 400, `R53 : mauvais code : ${JSON.stringify(reg.second?.body)}`);
        assert.equal(reg.second?.body.code, 'OTP_INVALID', JSON.stringify(reg.second?.body));
        assert.deepEqual(await accountsByPhone(String(b.phone)), [], 'aucun compte');
        assert.deepEqual(await partnersByCompany(String(b.companyName)), [], 'aucune fiche');
    });

    test('appel 2 avec le bon code : 201, compte et fiche, numéro vérifié (partners.phone_verified, users.phone_verified_at), avis aux admins', async () => {
        const b = await body('bon-code');
        const t0 = Date.now() - 1_000;
        const reg = await registerPartnerTwoStep(b);
        assert.equal(reg.second?.status, 201, `R53 : appel 2 avec le bon code : ${JSON.stringify(reg.second?.body)}`);
        const accounts = await accountsByPhone(String(b.phone));
        assert.equal(accounts.length, 1, 'un compte');
        assert.ok(accounts[0].phone_verified_at, 'users.phone_verified_at posé');
        const [partner] = await partnersByCompany(String(b.companyName));
        assert.ok(partner, 'fiche créée');
        assert.equal(partner.phone_verified, true, 'partners.phone_verified vrai');
        assert.equal(partner.status, 'EN_ATTENTE');
        assert.ok(await adminNotices('ADMIN_PARTNER_REGISTERED', String(b.companyName), t0) >= 1, 'admins prévenus après le code');
        assert.equal(getFakes().sms.messagesTo(String(b.phone)).filter((m) => /\b\d{6}\b/.test(m.message)).length, 1, 'un seul SMS de code pour toute l’inscription');
    });
});

describe('R90 — NINEA et RCCM', () => {
    test('enregistrés sur la fiche et servis à l’admin par GET /api/admin/partners', async () => {
        const ninea = `00${randomUUID().replace(/\D/g, '').slice(0, 7)}`;
        const rccm = `SN-DKR-2026-B-${randomUUID().replace(/\D/g, '').slice(0, 5)}`;
        const b = await body('ninea', { ninea, rccm });
        const reg = await registerPartnerTwoStep(b);
        assert.equal(reg.second?.status, 201, `inscription avec NINEA et RCCM : ${JSON.stringify(reg.second?.body ?? reg.first.body)}`);
        const [partner] = await partnersByCompany(String(b.companyName));
        assert.ok(partner, 'fiche créée');
        assert.equal(partner.ninea, ninea, 'R90 : partners.ninea');
        assert.equal(partner.rccm, rccm, 'R90 : partners.rccm');

        const admin = await newAdminWith(['partners.read'], { label: 'r90' });
        const res = await invoke(await routeHandler('../../app/api/admin/partners/route', 'GET', 'GET /api/admin/partners'), jsonRequest('/api/admin/partners?status=EN_ATTENTE', 'GET', admin.accessToken));
        assert.equal(res.status, 200, show(res));
        const row = ((res.body.partners ?? []) as Row[]).find((p) => p.id === partner.id);
        assert.ok(row, 'fiche listée');
        assert.equal(row.ninea, ninea, 'R90 : NINEA servi à l’admin');
        assert.equal(row.rccm, rccm, 'R90 : RCCM servi à l’admin');
        assert.equal(row.phone_verified, true, 'numéro vérifié servi à l’admin');
    });
});

describe('R54 — complément de dossier, une fois', () => {
    async function complete(p: TestPartner): Promise<RouteResult> {
        const docs = await uploadRegistrationDocuments();
        const handler = await routeHandler('../../app/api/partner/dossier/complete/route', 'POST', 'POST /api/partner/dossier/complete (R54)');
        return invoke(handler, jsonRequest('/api/partner/dossier/complete', 'POST', p.accessToken, {
            upload_ids: [docs.idCardUploadToken, docs.businessDocUploadToken], ninea: '009876543', rccm: 'SN-DKR-2026-B-12345',
        }));
    }

    async function rejected(label: string): Promise<TestPartner> {
        const p = await newPartner(label);
        const { error } = await service.from('partners').update({ status: 'EN_ATTENTE', is_verified: false }).eq('id', p.partnerId);
        assert.equal(error, null, error?.message);
        const { data, error: rErr } = await service.rpc('partner_status_set', { p: { partner_id: p.partnerId, actor_id: await superadminId(), status: 'REJETE', reason: 'Pièce d’identité illisible (test lot 9 bis)' } });
        assert.equal(rErr, null, rErr?.message);
        assert.equal((data as Row).ok, true, `refus du dossier : ${JSON.stringify(data)}`);
        return p;
    }

    async function partnerRow(p: TestPartner): Promise<Row> {
        const { data, error } = await service.from('partners').select('*').eq('id', p.partnerId).single();
        assert.equal(error, null, error?.message);
        return data as Row;
    }

    test('partenaire REJETE : complément → 200, EN_ATTENTE, resubmitted_at, motif gardé, ADMIN_PARTNER_RESUBMITTED ; second essai → 409 RESUBMIT_ALREADY_USED', async () => {
        const p = await rejected('r54-refus');
        const reason = (await partnerRow(p)).rejection_reason;
        const t0 = Date.now() - 1_000;
        const res = await complete(p);
        assert.equal(res.status, 200, `R54 : complément d’un dossier refusé : ${show(res)}`);
        assert.ok(sameQuotes(JSON.stringify(res.body)).includes(sameQuotes(DONE_TEXT)), `message du contrat 4.2 : ${show(res)}`);
        const row = await partnerRow(p);
        assert.equal(row.status, 'EN_ATTENTE', 'dossier de nouveau en attente');
        assert.ok(row.resubmitted_at, 'resubmitted_at posé');
        assert.equal(row.rejection_reason, reason, 'motif du refus gardé pour l’historique');
        const company = String(row.company_name);
        assert.ok(await adminNotices('ADMIN_PARTNER_RESUBMITTED', company, t0) >= 1, 'admins prévenus (ADMIN_PARTNER_RESUBMITTED)');

        const again = await complete(p);
        assert.equal(again.status, 409, `second complément : ${show(again)}`);
        assert.equal(again.body.code, 'RESUBMIT_ALREADY_USED', show(again));
    });

    test('partenaire VALIDE : complément → 409 DOSSIER_NOT_REJECTED, fiche inchangée', async () => {
        const p = await newPartner('r54-valide');
        const res = await complete(p);
        assert.equal(res.status, 409, `R54 : complément d’un dossier validé : ${show(res)}`);
        assert.equal(res.body.code, 'DOSSIER_NOT_REJECTED', show(res));
        const row = await partnerRow(p);
        assert.equal(row.status, 'VALIDE');
        assert.equal(row.resubmitted_at ?? null, null, 'resubmitted_at non posé');
    });
});
