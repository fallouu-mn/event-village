/**
 * Design 1b (décision du 18/11, run 406 : accueil 89, Mes billets 86 au téléphone de référence) — travail au chargement :
 *  - liens : aucun préchargement de page à l'affichage dans la mise en page commune, le logo, les cartes et les « Tout
 *    voir » ; préchargement à l'intention (survol, toucher, focus) ;
 *  - accueil : « Près de chez vous » et l'abonnement temps réel après l'affichage ;
 *  - Mes billets : décompte par seconde isolé (la carte ne se redessine plus chaque seconde), premier billet seul démarré
 *    tout de suite (code, lot hors ligne, QR), bibliothèque des QR à la demande, synchronisation hors ligne et temps réel
 *    après l'affichage.
 * Contrôle statique ; la mesure reste celle de la CI (scripts/e2e/perf-mobile.mjs, seuils et calibration inchangés).
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\r\n/g, '\n');

describe('design 1b — travail au chargement de l’accueil et de Mes billets', () => {
    test('liens préchargés à l’intention, jamais à l’affichage', () => {
        const intent = read('components/ui/IntentLink.tsx');
        assert.match(intent, /prefetch=\{prefetch \?\? false\}/);
        for (const ev of ['onPointerEnter', 'onTouchStart', 'onFocus']) assert.match(intent, new RegExp(`${ev}=\\{\\(e\\) => \\{ ${ev}\\?\\.\\(e\\); warm\\(\\); \\}\\}`));
        assert.match(intent, /router\.prefetch\(href\)/);
        const layout = read('components/layout/AppLayout.tsx');
        assert.match(layout, /^import Link from '@\/components\/ui\/IntentLink';$/m);
        assert.doesNotMatch(layout, /from 'next\/link'/);
        for (const m of layout.matchAll(/<LinkButton href="[^"]+"([^>]*)>/g)) assert.match(m[1], /prefetch=\{false\}/, `LinkButton sans prefetch={false} : ${m[0]}`);
        assert.match(read('components/ui/Logo.tsx'), /href="\/"\n\s*prefetch=\{false\}/);
        assert.match(read('components/events/EventCard.tsx'), /href=\{`\/events\/\$\{id\}`\}\n\s*prefetch=\{false\}/);
        const cards = read('components/events/CardLink.tsx');
        for (const ev of ['pointerover', 'touchstart', 'focusin']) assert.match(cards, new RegExp(`addEventListener\\('${ev}', onIntent`));
        assert.match(read('app/_accueil/sections.tsx'), /href=\{href\}\n\s*prefetch=\{false\}/);
    });

    test('accueil : « Près de chez vous » et temps réel après l’affichage', () => {
        const settled = read('hooks/usePageSettled.ts');
        assert.match(settled, /addEventListener\('load', whenIdle, \{ once: true \}\)/);
        assert.match(settled, /requestIdleCallback\(go, \{ timeout: 3_000 \}\)/);
        const nearby = read('app/_accueil/HomeNearby.tsx');
        assert.match(nearby, /return settled \|\| near \? <HomeDiscovery/);
        assert.match(nearby, /rootMargin: '400px 0px'/);
        assert.match(read('app/_accueil/HomeLive.tsx'), /enabled: settled,/);
    });

    test('Mes billets : décompte isolé, premier billet seul démarré, QR à la demande', () => {
        const card = read('components/tickets/TicketCard.tsx');
        assert.doesNotMatch(card, /^import [^\n]*from 'qrcode\.react';$/m, 'bibliothèque des QR jamais importée d’emblée');
        assert.match(card, /dynamic\(\(\) => import\('qrcode\.react'\)/);
        // Une seule minuterie par seconde, dans useSecondsLeft (petits composants QrSeconds, QrFullscreenLive)
        assert.equal(card.match(/setInterval\(/g)?.length, 1);
        const hookStart = card.indexOf('function useSecondsLeft');
        assert.ok(card.indexOf('setInterval(') > hookStart && card.indexOf('setInterval(') < card.indexOf('function QrSeconds'));
        assert.match(card, /<QrSeconds until=\{qrUntil\} min=\{qrMin\} \/>/);
        // Décision du 18/11 : plus de barre animée du pas du code, QR en attente = squelette fixe
        assert.doesNotMatch(card, /QrProgress|duration-1000/);
        assert.doesNotMatch(card, /animate-pulse/);
        assert.match(card, /const started = useStartWhenReady\(eager, cardRef\);/);
        assert.equal(card.match(/if \(!started\) return;/g)?.length, 2, 'code dynamique et lot hors ligne attendent le démarrage');
        assert.match(read('app/tickets/page.tsx'), /eager=\{index === 0\}/);
        assert.match(read('app/tickets/page.tsx'), /enabled: Boolean\(userId\) && pageSettled,/);
    });

    test('Mes billets : synchronisation hors ligne après l’affichage', () => {
        const auth = read('components/providers/AuthProvider.tsx');
        assert.match(auth, /const cancelWarm = warmWhenIdle\(load\);/);
        assert.match(auth, /window\.addEventListener\('online', load\);/);
    });
});
