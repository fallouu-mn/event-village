/**
 * Lot 9 quater — technique, en base (F1 : AUD-04 ; F2 : AUD-25, AUD-36). Base LOCALE.
 *  F1 : le webhook SamirPay refuse tout corps de plus de 16 Ko avant lecture et avant journal (annoncé ou non).
 *  F2 : dépôts anonymes de pièces jamais rattachés purgés après 24 h (tâche horaire) ; POST /api/partner/upload :
 *       fiche VALIDE exigée, quota par compte, taille contrôlée avant lecture.
 * Rouge avant correctif : le journal garde les gros corps, aucune purge, aucune garde sur l'image.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { assertLot9quaterInvariants } from '../helpers/lot9quater-invariants';
import { BASE_URL } from './helpers';
import { importModule, service } from './paiement-helpers';
import { newPartner } from './finance-helpers';
import { withEnv } from './notif-helpers';

after(async () => {
    await assertLot9quaterInvariants('lot9quater-technique');
});

describe('F1 — webhook SamirPay : 16 Ko au plus', () => {
    test('corps de 20 Ko, annoncé ou non : 413, aucune ligne au journal', async () => {
        const { POST } = await importModule('../../app/api/webhooks/samirpay/route') as { POST: (r: NextRequest) => Promise<Response> };
        const statuses: number[] = [];
        const markers: string[] = [];
        for (const announce of [true, false]) {
            const marker = `q-f1-${randomBytes(5).toString('hex')}`;
            markers.push(marker);
            const body = `order_id=${marker}&status=success&pad=${'A'.repeat(20 * 1024)}`;
            const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
            if (announce) headers['content-length'] = String(Buffer.byteLength(body));
            const res = await POST(new NextRequest(`${BASE_URL}/api/webhooks/samirpay`, { method: 'POST', headers, body }));
            statuses.push(res.status);
        }
        const { data } = await service.from('payment_webhook_events').select('id').in('order_id', markers);
        console.log(`[F1] statuts ${statuses.join(', ')} ; lignes ${(data ?? []).length}`);
        assert.deepEqual(statuses, [413, 413]);
        assert.deepEqual(data ?? [], []);
    });
});

describe('F2 — dépôts de pièces et images', () => {
    test('dépôt anonyme jamais rattaché : purgé après 24 h ; dépôt récent gardé', async () => {
        const bucket = 'partner_documents';
        const oldPath = `pending/${randomUUID()}/id_card.pdf`;
        const newPath = `pending/${randomUUID()}/id_card.pdf`;
        for (const path of [oldPath, newPath]) {
            const up = await service.storage.from(bucket).upload(path, Buffer.from('%PDF-1.4\n%q-f2\n'), { contentType: 'application/pdf' });
            assert.equal(up.error, null, up.error?.message);
        }
        const old = new Date(Date.now() - 25 * 3600_000).toISOString();
        const ins = await service.from('partner_document_uploads').insert([
            { object_path: oldPath, doc_type: 'id_card', mime_type: 'application/pdf', size_bytes: 14, token_hash: randomBytes(32).toString('hex'), expires_at: old, created_at: old },
            { object_path: newPath, doc_type: 'id_card', mime_type: 'application/pdf', size_bytes: 14, token_hash: randomBytes(32).toString('hex'), expires_at: new Date(Date.now() + 3600_000).toISOString() },
        ]);
        assert.equal(ins.error, null, ins.error?.message);
        const { purgeUnclaimedUploads } = await importModule('../../lib/partners/documents') as { purgeUnclaimedUploads: () => Promise<number> };
        const purged = await purgeUnclaimedUploads();
        const { data: rows } = await service.from('partner_document_uploads').select('object_path').in('object_path', [oldPath, newPath]);
        console.log(`[F2] purgés ${purged} ; restants ${JSON.stringify(rows)}`);
        assert.ok(purged >= 1);
        assert.deepEqual((rows ?? []).map((r) => r.object_path), [newPath]);
        const { data: file } = await service.storage.from(bucket).download(oldPath);
        assert.equal(file, null, 'fichier purgé du stockage');
    });

    test('image de partenaire : fiche non VALIDE refusée ; quota par compte ; taille annoncée refusée avant lecture', async () => {
        const { POST } = await importModule('../../app/api/partner/upload/route') as { POST: (r: NextRequest) => Promise<Response> };
        const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
        const send = (token: string, extra: Record<string, string> = {}) => {
            const form = new FormData();
            form.append('file', new Blob([png], { type: 'image/png' }), 'a.png');
            form.append('folder', 'misc');
            return POST(new NextRequest(`${BASE_URL}/api/partner/upload`, { method: 'POST', headers: { authorization: `Bearer ${token}`, ...extra }, body: form }));
        };
        const pending = await newPartner('q-f2-attente');
        await service.from('partners').update({ status: 'EN_ATTENTE' }).eq('id', pending.partnerId);
        const refused = await send(pending.accessToken);
        assert.equal(refused.status, 403, 'fiche non validée');
        const ok = await newPartner('q-f2-valide');
        const statuses = await withEnv({ PARTNER_IMAGE_UPLOADS_PER_ACCOUNT_HOUR: '1' }, async () => [
            (await send(ok.accessToken)).status, (await send(ok.accessToken)).status,
        ]);
        assert.deepEqual(statuses, [200, 429]);
        const big = await send(ok.accessToken, { 'content-length': String(20 * 1024 * 1024) });
        assert.equal(big.status, 413, 'taille annoncée refusée avant lecture');
    });
});
