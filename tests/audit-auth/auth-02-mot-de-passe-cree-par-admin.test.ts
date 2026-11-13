/**
 * Audit de l'authentification — AUTH-02 : un compte créé par un admin reçoit n'importe quel mot de passe
 * (OWASP ASVS 4.0, V2.1.1 longueur, V2.3.1 mot de passe initial).
 *
 * POST /api/admin/users (`users.write`) ne contrôle que la présence du mot de passe (app/api/admin/users/route.ts:125-130)
 * puis le passe tel quel à GoTrue (`createUser`, :157-160), dont le minimum local est 6 caractères
 * (supabase/config.toml, minimum_password_length = 6). L'écran l'appelle « Mot de passe temporaire »
 * (app/admin/users/page.tsx:649) mais rien ne le rend temporaire : aucun changement imposé à la première connexion,
 * aucun message au titulaire, et l'admin qui l'a choisi le connaît pour toujours. La règle commune
 * (StrongPasswordSchema, lib/validations/auth.ts:93-97) s'applique à l'inscription, à la réinitialisation et au
 * changement depuis le profil, pas ici. Le lot 9 quater (A5) l'applique à l'activation d'un contrôleur, pas à ce chemin.
 *
 * Test ROUGE tant que la faille existe : un SUPERADMIN qui crée un compte avec un mot de passe de 6 caractères minuscules et
 * chiffres, tiré au hasard (aucune majuscule ni caractère spécial), doit être refusé (400, champ password), comme toute
 * autre pose de mot de passe. Valeur générée : aucune valeur littérale (tests/schema/secrets-codes-en-dur.test.ts).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL, randomSenegalPhone } from '../parcours/helpers';
import { bearer, signInAs } from '../helpers/fixtures';

describe('AUTH-02 — mot de passe d\'un compte créé par un admin', () => {
    test('POST /api/admin/users avec un mot de passe de 6 minuscules et chiffres : refusé comme trop faible (400)', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const weak = randomBytes(3).toString('hex');
        const { POST } = await import('../../app/api/admin/users/route');
        const res = await POST(new NextRequest(`${BASE_URL}/api/admin/users`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', ...bearer(superadmin.accessToken) },
            body: JSON.stringify({ firstName: 'Audit', lastName: 'Faible', phone: randomSenegalPhone('77'), password: weak, role: 'CLIENT' }),
        }));
        const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        console.log(`[AUTH-02] création avec un mot de passe de 6 minuscules et chiffres : HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
        assert.equal(res.status, 400, `compte créé avec un mot de passe de 6 minuscules et chiffres (HTTP ${res.status}) : aucune règle de mot de passe sur ce chemin`);
    });
});
