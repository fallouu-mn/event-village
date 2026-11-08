/**
 * Lot 9, tâche 9.3, A34 (contrat 5.4, L40, D-sec 5) — une lecture dont l'erreur était ignorée la traite : une panne n'est
 * plus présentée comme une liste vide ni comme un compte absent, et la route ne continue pas.
 *  - admin/communications POST : panne de la lecture des destinataires → 500 RECIPIENTS_UNAVAILABLE, aucune campagne ;
 *  - admin/pricing POST : panne de la lecture de l'ancienne valeur → 500 PRICING_SAVE_FAILED, pas d'upsert, pas d'audit ;
 *  - send-otp : panne avant reserveSms → 500 OTP_SEND_FAILED, aucun SMS, aucun code ;
 *  - verify-otp : panne après la vérification → 503 PHONE_VERIFY_FAILED, jamais verified: true avec user: null ;
 *  - admin/users PATCH : 500 USER_SAVE_FAILED, jamais 404 ;
 *  - verify-otp, écritures voisines (L40) : updateUserById et generateLink en erreur sont journalisés, réponse inchangée.
 *
 * Panne : `during` (panne-helpers.ts), ciblée par filtre de ligne (numéro, identifiant, clé) pour ne pas toucher les
 * lectures de la session. Comptages : SMS par numéro neuf, jamais globalement.
 *
 * Rouge avant correctif : campagne créée à 0 destinataire (200), upsert écrit (200), 404 sur panne, verified: true sur
 * panne, aucun journal. after() : assertLot9Invariants, rouge jusqu'à M2 et M4.
 * Verts dès l'écriture (témoins, signalés) : chaque route sans panne ; compte réellement absent : 404 et son message.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { POST as postCommunication } from '../../app/api/admin/communications/route';
import { POST as postPricing } from '../../app/api/admin/pricing/route';
import { PATCH as patchUser } from '../../app/api/admin/users/route';
import { POST as sendOtp } from '../../app/api/auth/send-otp/route';
import { POST as verifyOtp } from '../../app/api/auth/verify-otp/route';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { getFakes } from '../fakes';
import { authed } from './acces-helpers';
import { jsonRequest, randomSenegalPhone } from './helpers';
import { assertClean, during, reply, table, tableWhere, type Reply, type Target } from './panne-helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { newAdminWith } from './terrain-helpers';

after(async () => {
    await assertLot9Invariants('lectures-ignorees');
});

function show(r: Reply): string {
    return `HTTP ${r.status} ${r.text.slice(0, 400)}`;
}

function token(): string {
    return randomBytes(5).toString('hex');
}

// ── admin/communications POST ──────────────────────────────────────────────

async function campaignsTitled(title: string): Promise<number> {
    const { count, error } = await service.from('campaigns').select('id', { count: 'exact', head: true }).eq('title', title);
    assert.equal(error, null, `campagnes : ${error?.message}`);
    return count ?? 0;
}

function sendCampaign(admin: Buyer, title: string, targetAudience: string): Promise<Response> {
    return postCommunication(authed('/api/admin/communications', 'POST', admin, {
        title, message: 'Message de test du lot 9.', senderProfile: 'Event Village Info', targetAudience, channels: ['SMS'],
    }));
}

describe('A34 — POST /api/admin/communications', () => {
    for (const [audience, target] of [
        ['ALL_PARTNERS', table('partners', (s) => s === 'phone')],
        ['AMBASSADORS', table('users', (s) => s === 'phone')],
        ['ALL_CLIENTS', table('users', (s) => s === 'phone')],
    ] as ReadonlyArray<[string, Target]>) {
        test(`${audience}, panne des destinataires : 500 RECIPIENTS_UNAVAILABLE, aucune campagne, journal`, async () => {
            const admin = await newAdminWith(['communications.manage'], { label: `comm9-${audience.slice(0, 5).toLowerCase()}` });
            const title = `Campagne panne ${audience} ${token()}`;
            const { result, logged } = await during(target, async () => reply(await sendCampaign(admin, title, audience)));
            assert.equal(result.status, 500, `panne présentée comme un succès : ${show(result)}`);
            assertClean(result, 'admin/communications');
            assert.equal(result.body.code, 'RECIPIENTS_UNAVAILABLE', show(result));
            assert.ok(logged.length >= 1, 'panne non journalisée');
            assert.equal(await campaignsTitled(title), 0, 'campagne créée à 0 destinataire sur une panne');
        });
    }

    test('témoin : sans panne, campagne en brouillon et destinataires comptés (vert dès l’écriture)', async () => {
        const admin = await newAdminWith(['communications.manage'], { label: 'comm9-ok' });
        const title = `Campagne témoin ${token()}`;
        const r = await reply(await sendCampaign(admin, title, 'ALL_CLIENTS'));
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.success, true, show(r));
        assert.ok(Number(r.body.recipientCount) >= 1, `destinataires : ${String(r.body.recipientCount)}`);
        assert.equal(await campaignsTitled(title), 1, 'une campagne');
    });
});

// ── admin/pricing POST ─────────────────────────────────────────────────────

async function settingRow(key: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await service.from('platform_settings').select('key, value').eq('key', key).maybeSingle();
    assert.equal(error, null, `réglage : ${error?.message}`);
    return data;
}

async function dropSetting(key: string): Promise<void> {
    const { error } = await service.from('platform_settings').delete().eq('key', key);
    assert.equal(error, null, `retrait du réglage de la suite : ${error?.message}`);
}

async function pricingAudits(key: string): Promise<Array<{ old_value: unknown; new_value: unknown }>> {
    const { data, error } = await service.from('audit_logs').select('old_value, new_value').eq('action', 'UPDATE_PRICING').eq('metadata->>key', key);
    assert.equal(error, null, `journal : ${error?.message}`);
    return data ?? [];
}

function savePricing(admin: Buyer, key: string, value: unknown): Promise<Response> {
    return postPricing(authed('/api/admin/pricing', 'POST', admin, { key, value, description: 'Réglage de test du lot 9.' }));
}

describe('A34 — POST /api/admin/pricing', () => {
    test('panne de lecture de l’ancienne valeur : 500 PRICING_SAVE_FAILED, pas d’upsert, pas d’audit', async () => {
        const admin = await newAdminWith(['pricing.manage'], { label: 'pricing9-panne' });
        const key = `lot9.panne_${token()}`;
        try {
            const { result, logged } = await during(tableWhere('platform_settings', 'key', key), async () => reply(await savePricing(admin, key, { montant: 1 })));
            assert.equal(result.status, 500, `panne présentée comme un succès : ${show(result)}`);
            assertClean(result, 'admin/pricing');
            assert.equal(result.body.code, 'PRICING_SAVE_FAILED', show(result));
            assert.ok(logged.length >= 1, 'panne non journalisée');
            assert.equal(await settingRow(key), null, 'upsert écrit alors que la lecture a échoué');
            assert.deepEqual(await pricingAudits(key), [], 'aucun audit');
        } finally {
            await dropSetting(key);
        }
    });

    test('témoin : sans panne, réglage écrit et audit avec l’ancienne valeur (vert dès l’écriture)', async () => {
        const admin = await newAdminWith(['pricing.manage'], { label: 'pricing9-ok' });
        const key = `lot9.temoin_${token()}`;
        try {
            const first = await reply(await savePricing(admin, key, { montant: 1 }));
            assert.equal(first.status, 200, show(first));
            const second = await reply(await savePricing(admin, key, { montant: 2 }));
            assert.equal(second.status, 200, show(second));
            assert.deepEqual((await settingRow(key))?.value, { montant: 2 }, 'dernière valeur');
            const audits = await pricingAudits(key);
            assert.equal(audits.length, 2, 'deux audits');
            assert.ok(audits.some((a) => JSON.stringify(a.old_value) === JSON.stringify({ montant: 1 })), `ancienne valeur au journal : ${JSON.stringify(audits)}`);
        } finally {
            await dropSetting(key);
        }
    });
});

// ── send-otp ───────────────────────────────────────────────────────────────

async function otpRows(phone: string): Promise<number> {
    const { count, error } = await service.from('otp_codes').select('id', { count: 'exact', head: true }).eq('phone', phone);
    assert.equal(error, null, `codes : ${error?.message}`);
    return count ?? 0;
}

function requestReset(phone: string): Promise<Response> {
    return sendOtp(jsonRequest('/api/auth/send-otp', { phone, purpose: 'PASSWORD_RESET' }));
}

describe('A34 — POST /api/auth/send-otp', () => {
    test('panne de lecture du compte : 500 OTP_SEND_FAILED, jamais 404, aucun SMS, aucun code', async () => {
        const phone = randomSenegalPhone('76');
        const { result, logged } = await during(tableWhere('users', 'phone', phone), async () => reply(await requestReset(phone)));
        assert.equal(result.status, 500, `panne présentée comme un compte absent : ${show(result)}`);
        assertClean(result, 'send-otp');
        assert.equal(result.body.code, 'OTP_SEND_FAILED', show(result));
        assert.ok(logged.length >= 1, 'panne non journalisée');
        assert.equal(getFakes().sms.messagesTo(phone).length, 0, 'aucun SMS sur une panne');
        assert.equal(await otpRows(phone), 0, 'aucun code enregistré sur une panne');
    });

    test('témoin : compte vraiment absent, 404 et son message (vert dès l’écriture)', async () => {
        const phone = randomSenegalPhone('76');
        const r = await reply(await requestReset(phone));
        assert.equal(r.status, 404, show(r));
        assert.equal(r.body.error, 'Aucun compte n\'est associé à ce numéro de téléphone.', show(r));
        assert.equal(getFakes().sms.messagesTo(phone).length, 0, 'aucun SMS pour un compte absent');
    });
});

// ── verify-otp ─────────────────────────────────────────────────────────────

/** Code réel envoyé au numéro (faux adaptateur SMS). */
async function issueCode(phone: string): Promise<string> {
    const res = await sendOtp(jsonRequest('/api/auth/send-otp', { phone }));
    assert.equal(res.status, 200, `send-otp : HTTP ${res.status} ${JSON.stringify(await res.json())}`);
    const codes = getFakes().sms.messagesTo(phone).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c));
    assert.ok(codes.length >= 1, `aucun code envoyé au ${phone}`);
    return codes[codes.length - 1];
}

function verify(phone: string, otpCode: string, isLogin: boolean): Promise<Response> {
    return verifyOtp(jsonRequest('/api/auth/verify-otp', { phone, otpCode, isLogin }));
}

describe('A34 — POST /api/auth/verify-otp', () => {
    for (const isLogin of [true, false]) {
        test(`panne de lecture du profil (isLogin ${String(isLogin)}) : 503 PHONE_VERIFY_FAILED, jamais verified: true ni 404`, async () => {
            const phone = randomSenegalPhone('76');
            const code = await issueCode(phone);
            const { result, logged } = await during(tableWhere('users', 'phone', phone), async () => reply(await verify(phone, code, isLogin)));
            assert.equal(result.status, 503, `panne présentée comme un succès ou une absence : ${show(result)}`);
            assertClean(result, 'verify-otp');
            assert.equal(result.body.code, 'PHONE_VERIFY_FAILED', show(result));
            assert.equal(result.body.error, 'Vérification momentanément impossible. Demandez un nouveau code.', show(result));
            assert.ok(!('verified' in result.body), 'une panne ne dit jamais que le numéro est vérifié');
            assert.ok(logged.length >= 1, 'panne non journalisée');
        });
    }

    test('témoin : isLogin et compte absent, 404 et son message (vert dès l’écriture)', async () => {
        const phone = randomSenegalPhone('76');
        const code = await issueCode(phone);
        const r = await reply(await verify(phone, code, true));
        assert.equal(r.status, 404, show(r));
        assert.equal(r.body.error, 'Aucun compte n\'est associé à ce numéro de téléphone. Veuillez vous inscrire.', show(r));
    });

    test('témoin : hors connexion et compte absent, verified: true et user null (vert dès l’écriture)', async () => {
        const phone = randomSenegalPhone('76');
        const code = await issueCode(phone);
        const r = await reply(await verify(phone, code, false));
        assert.equal(r.status, 200, show(r));
        assert.deepEqual([r.body.verified, r.body.user], [true, null], show(r));
    });

    test('L40 : updateUserById en erreur journalisé, réponse inchangée', async () => {
        const buyer = await newBuyer('verif9-confirm');
        const code = await issueCode(buyer.phoneE164);
        const target: Target = (url, method) => method === 'PUT' && url.pathname === `/auth/v1/admin/users/${buyer.userId}`;
        const { result, logged } = await during(target, async () => reply(await verify(buyer.phoneE164, code, true)));
        assert.equal(result.status, 200, show(result));
        assert.equal(result.body.verified, true, show(result));
        assert.equal((result.body.user as { id: string }).id, buyer.userId, 'profil renvoyé');
        assert.ok(logged.length >= 1, 'erreur de updateUserById ignorée : aucun journal');
    });

    test('L40 : generateLink en erreur journalisé, réponse inchangée, sans jeton', async () => {
        const buyer = await newBuyer('verif9-lien');
        const code = await issueCode(buyer.phoneE164);
        const target: Target = (url, method) => method === 'POST' && url.pathname === '/auth/v1/admin/generate_link';
        const { result, logged } = await during(target, async () => reply(await verify(buyer.phoneE164, code, true)));
        assert.equal(result.status, 200, show(result));
        assert.equal(result.body.verified, true, show(result));
        assert.equal(result.body.token_hash, undefined, 'aucun jeton sans lien généré');
        assert.ok(logged.length >= 1, 'erreur de generateLink ignorée : aucun journal');
    });
});

// ── admin/users PATCH ──────────────────────────────────────────────────────

describe('A34 — PATCH /api/admin/users', () => {
    test('panne de lecture de la cible : 500 USER_SAVE_FAILED, jamais 404, journal, statut inchangé', async () => {
        const admin = await newAdminWith(['users.write'], { label: 'users9-panne' });
        const target = await newBuyer('users9-cible');
        const { result, logged } = await during(tableWhere('users', 'id', target.userId), async () => reply(await patchUser(authed('/api/admin/users', 'PATCH', admin, { userId: target.userId, status: 'SUSPENDU' }))));
        assert.equal(result.status, 500, `panne présentée comme une absence : ${show(result)}`);
        assertClean(result, 'admin/users');
        assert.equal(result.body.code, 'USER_SAVE_FAILED', show(result));
        assert.ok(logged.length >= 1, 'panne non journalisée');
        const { data, error } = await service.from('users').select('status').eq('id', target.userId).single();
        assert.equal(error, null, `compte : ${error?.message}`);
        assert.equal(data.status, 'ACTIF', 'statut modifié malgré la panne');
    });

    test('témoin : cible absente, 404 (vert dès l’écriture)', async () => {
        const admin = await newAdminWith(['users.write'], { label: 'users9-absent' });
        const r = await reply(await patchUser(authed('/api/admin/users', 'PATCH', admin, { userId: randomUUID(), status: 'ACTIF' })));
        assert.equal(r.status, 404, show(r));
        assert.match(String(r.body.error), /introuvable/i, show(r));
    });
});
