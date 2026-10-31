/**
 * R11 — Lot 1C.2 : bucket « partner_documents » (pièces d'identité, RCCM).
 * Avec la clé anon ou un compte gratuit, aucune liste, aucune lecture, aucune écriture.
 * Les pièces sont déposées par la route publique de dépôt (comme le fait l'écran d'inscription),
 * puis l'attaquant tente d'y accéder directement par l'API Storage.
 * (Clé anon + signUp uniquement.)
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { POST as upload } from '../../app/api/partner/documents/upload/route';
import { uploadRequest } from '../parcours/helpers';
import { anonClient, signUpAttacker } from './helpers';

const BUCKET = 'partner_documents';

async function depositedPath(): Promise<string> {
    const res = await upload(uploadRequest('id_card'));
    const body = await res.json();
    assert.equal(res.status, 200, `dépôt : HTTP ${res.status} ${JSON.stringify(body)}`);
    return body.filePath as string;
}

describe('R11 — Storage des documents d’inscription', () => {
    test('anon : ni téléchargement ni liste', async () => {
        const path = await depositedPath();
        const anon = anonClient();
        const { data: file, error } = await anon.storage.from(BUCKET).download(path);
        assert.ok(error && !file, 'téléchargement anonyme d’une pièce accepté');
        const folder = path.split('/').slice(0, -1).join('/');
        const { data: listed } = await anon.storage.from(BUCKET).list(folder);
        assert.deepEqual(listed ?? [], [], `liste anonyme du dossier ${folder} non vide`);
    });

    test('compte tiers connecté : ni téléchargement ni liste', async () => {
        const path = await depositedPath();
        const attacker = await signUpAttacker('r11-lecture');
        const { data: file, error } = await attacker.client.storage.from(BUCKET).download(path);
        assert.ok(error && !file, 'téléchargement par un compte tiers accepté');
        const { data: listed } = await attacker.client.storage.from(BUCKET).list('pending');
        assert.deepEqual(listed ?? [], [], 'liste des dépôts par un compte tiers non vide');
    });

    test('compte connecté : aucune écriture directe dans le bucket, même dans son propre dossier', async () => {
        const attacker = await signUpAttacker('r11-ecriture');
        const { error } = await attacker.client.storage
            .from(BUCKET)
            .upload(`${attacker.userId}/r11-${Date.now()}.pdf`, new Blob(['%PDF-1.4\n%%EOF\n'], { type: 'application/pdf' }), { upsert: false });
        assert.ok(error, 'écriture directe dans le bucket des pièces acceptée');
    });
});
