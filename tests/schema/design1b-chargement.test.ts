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
        assert.match(read('app/tickets/TicketsView.tsx'), /eager=\{index === 0\}/);
        assert.match(read('app/tickets/TicketsView.tsx'), /enabled: Boolean\(userId\) && pageSettled,/);
    });

    test('Mes billets (run 420) : relecture identique sans nouveau rendu ; billets suivants après le chargement', () => {
        const page = read('app/tickets/TicketsView.tsx');
        assert.match(page, /if \(json !== ticketsJsonRef\.current\) \{\n\s*ticketsJsonRef\.current = json;\n\s*setTickets\(list\);/);
        assert.match(page, /if \(json !== incomingJsonRef\.current\) \{\n\s*incomingJsonRef\.current = json;\n\s*setIncoming\(next\);/);
        assert.equal(page.match(/setTickets\(/g)?.length, 1, 'une seule écriture de la liste');
        // Tentative 3 du 19/11 : la carte ne se redessine que si ses données changent
        assert.match(read('components/tickets/TicketCard.tsx'), /export const TicketCard = React\.memo\(TicketCardView, sameCardData\);/);
        const card = read('components/tickets/TicketCard.tsx');
        assert.match(card, /const settled = usePageSettled\(\);[\s\S]*?return eager \|\| settled \|\| visible;/);
    });

    test('Mes billets : synchronisation hors ligne après l’affichage', () => {
        const auth = read('components/providers/AuthProvider.tsx');
        assert.match(auth, /const cancelWarm = warmWhenIdle\(load\);/);
        assert.match(auth, /window\.addEventListener\('online', load\);/);
    });

    test('décision du 19/11 : billet visible complet, les autres en vignettes dépliées à l’écran ou au toucher', () => {
        const wallet = read('components/tickets/TicketWallet.tsx');
        assert.match(wallet, /const full = !item\.thumb \|\| i === 0 \|\| i === index \|\| opened\.has\(item\.key\);/);
        assert.match(wallet, /\{ threshold: 0\.6, rootMargin: '200% 0px 200% 0px' \}/);
        assert.match(wallet, /item\.thumb\?\.\(\(\) => \{ open\(item\.key, true\); go\(i\); \}\)/);
        assert.match(wallet, /'ev-wallet-unfold'/);
        assert.match(read('app/globals.css'), /\.ev-wallet-unfold \{\n\s*animation: evRise 250ms var\(--ease-out\) both;/);
        const thumb = read('components/tickets/TicketThumb.tsx');
        assert.match(thumb, /aria-label=\{`Billet pour \$\{title\}`\} data-ev-ticket-thumb=""/);
        assert.match(thumb, /categoryClasses\(categoryColor\)/);
        assert.doesNotMatch(thumb, /QRCode|qrcode|live-code|offline/i, 'vignette légère : ni QR ni code ni lot');
        assert.match(read('app/tickets/TicketsView.tsx'), /thumb: \(open: \(\) => void\) => \(\n\s*<TicketThumb/);
    });

    test('décision du 19/11 : liste préparée par le serveur (même route, mêmes règles de session), jamais en cache', () => {
        const page = read('app/tickets/page.tsx');
        assert.doesNotMatch(page, /^'use client'/);
        assert.match(page, /import \{ GET as listMyTickets \} from '@\/app\/api\/tickets\/route';/);
        assert.match(page, /export const dynamic = 'force-dynamic';/);
        assert.match(page, /new NextRequest\(`\$\{proto\}:\/\/\$\{host\}\/api\/tickets`, \{ headers: new Headers\(h\) \}\)/);
        // Run 426 : la page n'attend pas la liste (en-tête aussitôt), la liste suit dans la même réponse
        // Design 1e (modification signalée) : portée « à venir » sur l'onglet par défaut
        assert.match(page, /const ticketsPromise = readTicketsOnServer\(!tab \|\| tab === 'a-venir'\);/);
        assert.doesNotMatch(page, /await readTicketsOnServer\(/);
        assert.match(page, /<TicketsView ticketsPromise=\{ticketsPromise\} initialTab=\{tab\} serverNow=\{Date\.now\(\)\} \/>/);
        const view = read('app/tickets/TicketsView.tsx');
        assert.match(view, /ticketsPromise\.then\(\(list\) => \{/);
        assert.match(view, /const now = useMinuteNow\(serverNow\);/);
        // Le service worker ne garde jamais /tickets (réseau seulement)
        assert.match(read('public/sw.js'), /const FALLBACK_NAV = new Set\(\['\/', '\/tickets'\]\);/);
    });
});
