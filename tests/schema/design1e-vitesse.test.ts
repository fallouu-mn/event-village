/**
 * Design 1e (point 5, vitesse) — causes trouvées par la mesure (requêtes et profil processeur des runs 519 à 523) et
 * corrigées sans rien changer à la sécurité (contrôles statiques ; preuve chiffrée : job perf et run complet).
 *  1. LinkButton ne précharge plus sa page à l'affichage (next/link préchargeait /explore pendant le chargement de chaque
 *     page) : préchargement à l'intention, comme les liens de la coquille depuis le design 1b ;
 *  2. session annoncée deux fois au chargement (INITIAL_SESSION puis SIGNED_IN, même jeton) : le doublon exact ne relit
 *     plus le profil ni ne redessine la page ; les effacements de fin de session et tout nouveau jeton passent comme avant ;
 *  3. temps réel de la cloche ouvert une fois la page chargée et le téléphone libre (comme Mes billets).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, ...rel.split('/')), 'utf8').replace(/\r\n/g, '\n');

describe('design 1e — vitesse : causes corrigées', () => {
    test('1. LinkButton : préchargement à l’intention (IntentLink, prefetch faux par défaut)', () => {
        const src = read('components/ui/LinkButton.tsx');
        assert.match(src, /^import Link from '\.\/IntentLink';$/m);
        assert.doesNotMatch(src, /from 'next\/link'/);
        assert.match(read('components/ui/IntentLink.tsx'), /prefetch=\{prefetch \?\? false\}/);
    });

    test('2. doublon exact de session ignoré, APRÈS les effacements ; SIGNED_OUT et nouveau jeton inchangés', () => {
        const src = read('components/providers/AuthProvider.tsx');
        const guard = src.indexOf("if (event !== 'SIGNED_OUT' && token !== null && token === appliedTokenRef.current) return;");
        assert.ok(guard > 0, 'garde du doublon absente');
        for (const purge of ["if (event === 'SIGNED_OUT') {", "} else if (event === 'SIGNED_IN' && nextUserId) {", "} else if (event === 'INITIAL_SESSION' && !nextUserId && sessionEnded()) {"]) {
            const at = src.indexOf(purge);
            assert.ok(at > 0 && at < guard, `effacement « ${purge} » avant la garde`);
        }
        assert.ok(src.indexOf('appliedTokenRef.current = token;') > guard);
        assert.ok(src.indexOf('await fetchUserProfile(newSession.user.id, newSession);') > guard, 'profil relu seulement après la garde');
    });

    test('3. cloche : temps réel après le chargement (usePageSettled), compteur lu tout de suite', () => {
        const src = read('components/notifications/NotificationBell.tsx');
        assert.match(src, /enabled: isUserLoggedIn && !!user\?\.id && settled,/);
        assert.match(src, /const settled = usePageSettled\(\);/);
        assert.match(src, /if \(!isUserLoggedIn \|\| !user\?\.id\) return;\n\s*void fetchNotifications\(\);/);
    });
});

describe('design 1e — vitesse : formateurs de lib/format.ts construits au premier usage', () => {
    test('aucun Intl.DateTimeFormat ni Intl.NumberFormat construit au chargement du module (profil du run 526 : 52 ms)', () => {
        const src = read('lib/format.ts');
        const topLevel = src.split('\n').filter((l) => /^(?:export )?const \w+ = new Intl\./.test(l));
        assert.deepEqual(topLevel, [], 'formateur construit au chargement du module');
        assert.match(src, /function lazily<T>\(make: \(\) => T\): \(\) => T/);
    });
    test('sorties inchangées (Dakar, insécables visibles)', async () => {
        const f = await import('../../lib/format');
        assert.equal(f.formatDateTime('2026-11-14T20:00:00Z'), 'sam. 14 nov. 2026 à 20:00');
        assert.equal(f.formatDate('2026-11-14'), 'sam. 14 nov. 2026');
        assert.equal(f.formatShortDate('2026-11-14'), '14 nov. 2026');
        assert.equal(f.formatTime('2026-11-14T08:05:00Z'), '08:05');
        assert.equal(f.formatFcfa(351000), '351 000 F CFA');
        assert.equal(f.formatFcfaPrecise(19.7), '19,7 F CFA');
        assert.equal(f.formatInteger(12345), '12 345');
        assert.equal(f.formatDateTime(null), '—');
    });
});
