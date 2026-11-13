/**
 * Audit de sécurité du module événements — AUD-07 : énumération des comptes par numéro de téléphone, sans compte.
 *
 * POST /api/auth/resolve-phone (anonyme) répond 200 { success: true } si un compte porte le numéro, 404 sinon
 * (app/api/auth/resolve-phone/route.ts, recherche public.users puis réponse différente) ; POST /api/auth/register/start
 * répond 409 PHONE_ALREADY_REGISTERED pour un numéro inscrit (app/api/auth/register/start/route.ts:46-50). La seule limite
 * est par IP (RESOLVE_PHONE_PER_IP_HOUR), lue dans x-forwarded-for (lib/security/client-ip.ts).
 *
 * Test ROUGE tant que la faille existe : un visiteur ne distingue pas un numéro inscrit d'un numéro libre.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomSenegalPhone } from '../parcours/helpers';
import { newBuyer } from '../parcours/paiement-helpers';
import { NextRequest } from 'next/server';
import { BASE_URL } from '../parcours/helpers';

async function resolvePhone(phone: string, ip: string): Promise<{ status: number; body: unknown }> {
    const { POST } = await import('../../app/api/auth/resolve-phone/route');
    const res = await POST(new NextRequest(`${BASE_URL}/api/auth/resolve-phone`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ phone }),
    }));
    return { status: res.status, body: await res.json() };
}

describe('AUD-07 — énumération des comptes par numéro', () => {
    test('resolve-phone répond la même chose pour un numéro inscrit et pour un numéro libre', async () => {
        const known = await newBuyer('aud-enum');
        const unknown = randomSenegalPhone('76');
        const a = await resolvePhone(known.phoneE164, '203.0.113.201');
        const b = await resolvePhone(unknown, '203.0.113.202');
        console.log(`[AUD-07] numéro inscrit : HTTP ${a.status} ${JSON.stringify(a.body)} ; numéro libre : HTTP ${b.status} ${JSON.stringify(b.body)}`);
        assert.equal(a.status, b.status, `resolve-phone révèle l'existence d'un compte : HTTP ${a.status} (inscrit) contre ${b.status} (libre)`);
    });
});
