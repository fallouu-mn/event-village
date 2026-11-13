/**
 * Audit de sécurité du module événements — AUD-04 : journal du webhook SamirPay écrit sans limite avant toute vérification.
 *
 * lib/payments/webhook.service.ts:46-65 lit le corps entier (aucune taille maximale) et l'enregistre dans
 * payment_webhook_events (payment_webhook_record, 20261031000016_lot2_journal_webhooks.sql:36-54, colonne raw_body TEXT
 * sans borne, ligne 14) AVANT la signature (lignes 81-86), le jeton (99-101) et le format (88-91). Chaque corps différent
 * crée une ligne (clé de dédoublonnage = empreinte du corps). Aucun quota, aucune purge (grep : aucune suppression de
 * payment_webhook_events dans les migrations). Un visiteur anonyme remplit donc la base à volonté, même quand
 * SAMIRPAY_WEBHOOK_SECRET est défini.
 *
 * Test ROUGE tant que la faille existe : un corps d'un mégaoctet, non signé, sans jeton, envoyé par un inconnu alors que
 * le secret de signature est défini, ne doit laisser aucune ligne d'un mégaoctet dans le journal.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL } from '../parcours/helpers';
import { service } from '../parcours/paiement-helpers';
import { withEnv } from '../parcours/notif-helpers';

const ONE_MB = 1024 * 1024;

describe('AUD-04 — webhook SamirPay : journal écrit sans limite avant toute vérification', () => {
    test('un corps d\'un mégaoctet non signé et sans jeton n\'est pas conservé dans payment_webhook_events', async () => {
        const marker = `aud04-${randomBytes(6).toString('hex')}`;
        const body = `order_id=${marker}&status=success&pad=${'A'.repeat(ONE_MB)}`;
        const { POST } = await import('../../app/api/webhooks/samirpay/route');
        const res = await withEnv({ SAMIRPAY_WEBHOOK_SECRET: `whsec_${randomBytes(24).toString('hex')}` }, () => POST(new NextRequest(`${BASE_URL}/api/webhooks/samirpay`, {
            method: 'POST',
            headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '203.0.113.77' },
            body,
        })));
        const { data, error } = await service.from('payment_webhook_events')
            .select('id, result, result_detail, token_present, order_id').eq('order_id', marker);
        assert.equal(error, null, `lecture du journal : ${error?.message}`);
        const sizes = await Promise.all((data ?? []).map(async (r) => {
            const { data: one } = await service.from('payment_webhook_events').select('raw_body').eq('id', r.id).single();
            return String(one?.raw_body ?? '').length;
        }));
        console.log(`[AUD-04] réponse HTTP ${res.status} ; lignes du journal pour ${marker} : ${JSON.stringify((data ?? []).map((r, i) => ({ ...r, raw_body_length: sizes[i] })))}`);
        assert.deepEqual(sizes.filter((n) => n >= ONE_MB), [],
            `un inconnu a écrit ${sizes.length} ligne(s) dans payment_webhook_events (raw_body de ${sizes.join(', ')} caractères) malgré SAMIRPAY_WEBHOOK_SECRET défini et sans signature ni jeton`);
    });
});
