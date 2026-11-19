/**
 * Design 1b (décision du 18/11, erreur React n° 418 « HTML » des runs 376 à 401) — rendu identique côté serveur et au
 * premier rendu du navigateur :
 *  - textes qui dépendent de l'heure (« En cours », « se termine vers », remboursement d'un report, fin de l'événement) :
 *    faux ou absents au rendu serveur, calculés une fois la page chargée dans le navigateur (effets) ;
 *  - pas de CSS écrit dans la page (experimental.inlineCss) : les <style> insérés par Next dans le flux des pages en
 *    streaming n'étaient pas attendus par React (erreur intermittente sur la fiche, la fumée client et organisateur,
 *    la recette ; jamais sur main ni avant le design 1a).
 * La preuve en navigateur : capture fiche-en-cours chargée trois fois de suite, toute exception de page bloquante.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');

describe('design 1b — rendu identique serveur / navigateur (erreur 418)', () => {
    test('aucun CSS écrit dans la page', () => {
        assert.doesNotMatch(read('next.config.mjs'), /^\s*experimental:\s*\{[^}]*inlineCss:\s*true/m);
    });

    test('« En cours » : faux au premier rendu, calculé dans un effet', () => {
        const hook = read('components/events/useLiveNow.ts');
        assert.match(hook, /const \[live, setLive\] = useState\(false\);/);
        assert.match(hook, /useEffect\(\(\) => \{[\s\S]*?const now = new Date\(\);/);
        const poster = read('components/event-page/LiveOnPoster.tsx');
        assert.match(poster, /if \(!live \|\| !window\) return null;/);
        const cards = read('components/events/CardLiveBadge.tsx');
        assert.doesNotMatch(cards.split('useEffect')[0], /new Date\(\)|Date\.now\(\)/, 'aucune heure lue avant les effets');
    });

    test('billetterie de la fiche : heure du téléphone nulle au premier rendu', () => {
        const src = read('components/event-page/EventTicketing.tsx');
        assert.match(src, /const \[now, setNow\] = useState<number \| null>\(null\);/);
        // Design 1c bis (modification signalée, plus stricte) : TOUT l'état de la billetterie qui dépend de l'heure passe
        // par withClock, sans heure au premier rendu (même rendu que le HTML en cache)
        assert.match(src, /withClock\(sheet, now === null \? null : new Date\(now\)\)/);
        assert.match(src, /const ended = now !== null && /);
    });

    test('capture fiche-en-cours : trois chargements de suite', () => {
        const src = read('e2e/support/screens.ts');
        const i = src.indexOf("id: 'fiche-en-cours'");
        assert.ok(i > 0);
        assert.match(src.slice(i, i + 1600), /for \(let passage = 1; passage <= 3; passage\+\+\) \{\n\s*await page\.reload\(\);/);
    });
});
