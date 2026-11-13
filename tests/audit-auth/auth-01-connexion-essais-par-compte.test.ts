/**
 * Audit de l'authentification — AUTH-01 : aucune limite d'essais de mot de passe par COMPTE (OWASP ASVS 4.0, V2.2.1).
 *
 * POST /api/auth/login ne compte les essais que par adresse IP (`password_login_ip`, PASSWORD_LOGIN_PER_IP_HOUR = 30,
 * app/api/auth/login/route.ts:66-75 ; lib/env.ts:115). L'IP est lue dans x-forwarded-for (lib/security/client-ip.ts,
 * AUD-09 de l'audit du 13/11, renvoyé au lot de mise en ligne). Rien ne compte les échecs sur le compte visé : un
 * attaquant qui change d'adresse (réseau de machines, ou en-tête réécrit tant qu'AUD-09 n'est pas fermé) essaie des
 * mots de passe sur le même compte sans fin, SUPERADMIN compris (aucun second facteur). Le verrou de 5 échecs de
 * l'écran (components/auth/LoginForm.tsx:49-50, localStorage) n'existe que dans le navigateur.
 *
 * Test ROUGE tant que la faille existe : 20 mauvais mots de passe sur un même compte, depuis 20 adresses différentes
 * (une seule tentative par adresse, loin de la limite par IP), doivent finir par un refus 429 propre au compte.
 * Attendu d'un correctif : au plus 10 échecs par compte et par 15 minutes (valeur à fixer), puis 429 avec le délai.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { BASE_URL } from '../parcours/helpers';
import { newBuyer } from '../parcours/paiement-helpers';

const ATTEMPTS = 20;
const EXPECTED_LIMIT = 10;

async function login(identifier: string, password: string, ip: string): Promise<{ status: number; code: string | null }> {
    const { POST } = await import('../../app/api/auth/login/route');
    const res = await POST(new NextRequest(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ identifier, password }),
    }));
    const body = (await res.json().catch(() => null)) as { code?: string } | null;
    return { status: res.status, code: body?.code ?? null };
}

describe('AUTH-01 — essais de mot de passe limités par compte', () => {
    test(`${ATTEMPTS} mauvais mots de passe sur un même compte, depuis ${ATTEMPTS} adresses : refus 429 au plus tard après ${EXPECTED_LIMIT} échecs`, async () => {
        const target = await newBuyer('auth01');
        const statuses: string[] = [];
        let firstRefusal: number | null = null;
        for (let i = 1; i <= ATTEMPTS; i += 1) {
            const r = await login(target.email, `Faux#${i}-motdepasse`, `198.51.100.${i}`);
            statuses.push(`${i}:${r.status}${r.code ? `/${r.code}` : ''}`);
            if (r.status === 429 && firstRefusal === null) firstRefusal = i;
            assert.ok(r.status === 401 || r.status === 429, `essai ${i} : réponse inattendue ${r.status} ${r.code ?? ''}`);
        }
        console.log(`[AUTH-01] réponses : ${statuses.join(' ')}`);
        assert.notEqual(firstRefusal, null, `aucun refus par compte après ${ATTEMPTS} mauvais mots de passe venus de ${ATTEMPTS} adresses : ${statuses.join(' ')}`);
        assert.ok((firstRefusal ?? Infinity) <= EXPECTED_LIMIT + 1, `refus seulement à l'essai ${firstRefusal}, au-delà de ${EXPECTED_LIMIT} échecs`);
    });
});
