/**
 * Lot 1C.2 — documents d'inscription partenaire.
 *  - Le dépôt (public) produit un chemin non devinable (UUID) et un jeton de dépôt ; type de
 *    pièce limité, contenu vérifié par sa signature (et non par le type annoncé).
 *  - L'inscription rattache les pièces par leurs jetons (usage unique).
 *  - /api/partner/documents/signed-url : URL délivrée au propriétaire du dossier, à l'admin, et
 *    au porteur du jeton tant que l'inscription n'est pas finalisée ; un compte tiers reçoit 403 ;
 *    un chemin fourni par le client n'est plus accepté.
 *  - Dossier antérieur au lot 1C.2 (chemin hérité dans partners, aucune ligne de dépôt) :
 *    consultable par l'admin, pas par le propriétaire (ce chemin avait été saisi par le client).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { bearer, signInAs } from '../helpers/fixtures';
import { POST as upload } from '../../app/api/partner/documents/upload/route';
import { GET as signedUrl } from '../../app/api/partner/documents/signed-url/route';
import { POST as registerPartner } from '../../app/api/partner/register/route';
import { BASE_URL, MINIMAL_PDF, jsonRequest, randomEmail, randomSenegalPhone, STRONG_PASSWORD, uploadRegistrationDocuments, uploadRequest } from './helpers';

function getSigned(query: string, headers: Record<string, string> = {}): Promise<Response> {
    return signedUrl(new NextRequest(`${BASE_URL}/api/partner/documents/signed-url?${query}`, { method: 'GET', headers }));
}

async function registerWithDocuments() {
    const docs = await uploadRegistrationDocuments();
    const email = randomEmail('kyc');
    const res = await registerPartner(jsonRequest('/api/partner/register', {
        companyName: 'KYC Test SARL',
        description: 'Organisateur fictif pour les tests de pièces justificatives.',
        address: '5 rue des Pièces',
        city: 'Dakar',
        activities: ['ORGANISATEUR'],
        firstName: 'Khady',
        lastName: 'Kyc',
        phone: randomSenegalPhone('77'),
        email,
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
        ...docs,
    }));
    const body = await res.json();
    assert.ok(res.status < 300, `inscription : HTTP ${res.status} ${JSON.stringify(body)}`);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: session, error } = await anon.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion du partenaire : ${error?.message}`);
    return { docs, partnerId: body.partnerId as string, ownerToken: session.session!.access_token };
}

describe('Documents d’inscription partenaire', () => {
    test('dépôt : chemin non devinable et jeton de dépôt', async () => {
        const res = await upload(uploadRequest('id_card'));
        const body = await res.json();
        assert.equal(res.status, 200, `HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.match(String(body.filePath), /^pending\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/id_card\.pdf$/, `chemin aléatoire attendu : ${body.filePath}`);
        assert.ok(typeof body.uploadToken === 'string' && body.uploadToken.length >= 40, 'jeton de dépôt renvoyé');
    });

    test('dépôt : type de pièce hors liste et contenu non conforme refusés', async () => {
        const badType = await upload(uploadRequest('../autre'));
        assert.equal(badType.status, 400, `docType hors liste : HTTP ${badType.status}`);
        const fakePdf = await upload(uploadRequest('id_card', Buffer.from('ceci n’est pas un PDF'), 'application/pdf'));
        assert.equal(fakePdf.status, 400, `contenu non PDF annoncé comme PDF : HTTP ${fakePdf.status}`);
        const goodPdf = await upload(uploadRequest('business_doc', MINIMAL_PDF));
        assert.equal(goodPdf.status, 200);
    });

    test('URL signée : propriétaire et admin oui, compte tiers 403', async () => {
        const { partnerId, ownerToken } = await registerWithDocuments();
        const owner = await getSigned(`partnerId=${partnerId}&docType=id_card`, bearer(ownerToken));
        const ownerBody = await owner.json();
        assert.equal(owner.status, 200, `propriétaire : HTTP ${owner.status} ${JSON.stringify(ownerBody)}`);
        assert.ok(ownerBody.signedUrl, 'URL signée délivrée au propriétaire');

        const admin = await signInAs('SUPERADMIN');
        const adminRes = await getSigned(`partnerId=${partnerId}&docType=business_doc`, bearer(admin.accessToken));
        assert.equal(adminRes.status, 200, `admin : HTTP ${adminRes.status} ${JSON.stringify(await adminRes.json())}`);

        const third = await signInAs('CLIENT');
        const thirdRes = await getSigned(`partnerId=${partnerId}&docType=id_card`, bearer(third.accessToken));
        assert.equal(thirdRes.status, 403, `compte tiers : HTTP ${thirdRes.status} ${JSON.stringify(await thirdRes.json())}`);
    });

    test('URL signée : un chemin fourni par le client n’est plus accepté', async () => {
        const { docs } = await registerWithDocuments();
        const { data: row } = await getServiceRoleClient().from('partners').select('id_card_url').not('id_card_url', 'is', null).order('created_at', { ascending: false }).limit(1).single();
        const path = row?.id_card_url || docs.idCardUrl;
        const third = await signInAs('CLIENT');
        const res = await getSigned(`path=${encodeURIComponent(path)}`, bearer(third.accessToken));
        const body = await res.json();
        assert.ok(res.status >= 400 && !body.signedUrl, `URL délivrée sur simple chemin : HTTP ${res.status} ${JSON.stringify(body)}`);
    });

    test('URL signée par jeton de dépôt : valable avant l’inscription, plus après', async () => {
        const res = await upload(uploadRequest('id_card'));
        const { uploadToken } = await res.json();
        const before = await getSigned(`uploadToken=${encodeURIComponent(String(uploadToken))}`);
        assert.equal(before.status, 200, `jeton non réclamé : HTTP ${before.status} ${JSON.stringify(await before.json())}`);

        const { docs } = await registerWithDocuments();
        const claimed = await getSigned(`uploadToken=${encodeURIComponent(docs.idCardUploadToken)}`);
        assert.equal(claimed.status, 403, `jeton déjà rattaché à un dossier : HTTP ${claimed.status}`);
    });

    test('dossier antérieur au lot 1C.2 : chemin hérité servi à l’admin seulement', async () => {
        const { partnerId, ownerToken } = await registerWithDocuments();
        const service = getServiceRoleClient();
        const legacyPath = `pending_registrations/id_card_${Date.now()}_legacy.pdf`;
        const { error: upErr } = await service.storage.from('partner_documents').upload(legacyPath, MINIMAL_PDF, { contentType: 'application/pdf' });
        assert.equal(upErr, null, `dépôt hérité : ${upErr?.message}`);
        try {
            const { error: delErr } = await service.from('partner_document_uploads').delete().eq('claimed_partner_id', partnerId);
            assert.equal(delErr, null, `simulation d'un dossier ancien : ${delErr?.message}`);
            const { error: pErr } = await service.from('partners').update({ id_card_url: legacyPath }).eq('id', partnerId);
            assert.equal(pErr, null, `chemin hérité : ${pErr?.message}`);

            const owner = await getSigned(`partnerId=${partnerId}&docType=id_card`, bearer(ownerToken));
            assert.equal(owner.status, 404, `propriétaire, chemin hérité : HTTP ${owner.status} ${JSON.stringify(await owner.json())}`);

            const admin = await signInAs('SUPERADMIN');
            const adminRes = await getSigned(`partnerId=${partnerId}&docType=id_card`, bearer(admin.accessToken));
            const adminBody = await adminRes.json();
            assert.equal(adminRes.status, 200, `admin, chemin hérité : HTTP ${adminRes.status} ${JSON.stringify(adminBody)}`);
            assert.ok(String(adminBody.signedUrl).includes('pending_registrations'), 'URL signée du chemin hérité');
        } finally {
            const { error: rmErr } = await service.storage.from('partner_documents').remove([legacyPath]);
            if (rmErr) throw new Error(`nettoyage du dépôt hérité : ${rmErr.message}`);
        }
    });
});
