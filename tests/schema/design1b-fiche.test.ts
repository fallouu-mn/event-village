/**
 * Design 1b (points 1, 6, 7, 10, 11) — fiche publique et achat, SANS base : règles pures et lecture du code.
 *
 *  a. Règles pures (lib/events/event-detail.ts) : prix d'appel de la barre (« Dès … », « Gratuit », « Gratuit ou dès … »),
 *     prochain changement de la vente, ligne « Remboursement » seulement quand la règle est vraie (report : jusqu'au début).
 *  b. Page : composant serveur mis en cache 60 s, vrai 404, aucune session lue ; une seule image prioritaire, tailles
 *     données, même view-transition-name que la carte ; parties personnelles en îlots du navigateur.
 *  c. Billetterie : barre du téléphone dès l'ouverture (« Choisir mes billets », puis « Acheter (n) »), un seul grand bouton
 *     par écran, catégories avec leur couleur, guichet et remboursement seulement d'après la fiche servie.
 *  d. Bandeau de paiement en attente : même condition que le refus du serveur (lecture de findPendingTicketPayment et de
 *     la garde SQL de checkout_create_payment), plus de disparition à l'échéance de la réservation, « Annuler ce paiement ».
 *  e. Achat : opérateur non présélectionné, Wave et Orange Money en grands boutons à leurs couleurs, frais avant le
 *     bouton de paiement ; retour après achat vers /tickets?tab=a-venir&fete=1.
 *  f. Petite carte : nom de l'événement sur le repère, échappé ; fond de carte au toucher.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    fromPriceLabel,
    nextSaleBoundary,
    readPublicEventDetail,
    refundRuleApplies,
    POSTPONEMENT_REFUND_INFO,
    REFUND_INFO,
} from '../../lib/events/event-detail';
import { mapMarkerHtml } from '../../components/ui/MapMarker';
import { formatFcfa } from '../../lib/format';
import { TICKETS_AFTER_PURCHASE } from '../../components/event-page/signals';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
/** Code sans commentaires (blocs et lignes), pour ne pas compter un mot cité dans une explication. */
const code = (rel: string): string => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const PAGE = 'app/events/[id]/page.tsx';
const LAYOUT = 'app/events/[id]/layout.tsx';
const READER = 'lib/events/event-detail.server.ts';
const ROUTE = 'app/api/events/[id]/route.ts';
const TICKETING = 'components/event-page/EventTicketing.tsx';
const SLOT = 'components/event-page/PendingPaymentSlot.tsx';
const BANNER = 'components/payment/PendingPaymentBanner.tsx';
const MODAL = 'components/payment/PaymentModal.tsx';
const PAY_PAGE = 'app/paiement/[id]/page.tsx';
const VENUE_MAP = 'components/event-page/VenueMap.tsx';
const EVENT_MAP = 'components/ui/EventMap.tsx';
const ISLANDS = [TICKETING, SLOT, VENUE_MAP, 'components/event-page/LiveOnPoster.tsx', 'components/event-page/ShareButton.tsx'];

const NOW = new Date('2026-11-20T12:00:00Z');
const iso = (offsetHours: number): string => new Date(NOW.getTime() + offsetHours * 3600_000).toISOString();

describe('a. règles pures de la fiche', () => {
    test('prix d’appel : catégories en vente seulement ; « Dès … », « Gratuit », « Gratuit ou dès … », null', () => {
        assert.equal(fromPriceLabel([{ price: 5_000, isAvailable: true }, { price: 10_000, isAvailable: true }]), `Dès ${formatFcfa(5_000)}`);
        assert.equal(fromPriceLabel([{ price: 1_000, isAvailable: false }, { price: 10_000, isAvailable: true }]), `Dès ${formatFcfa(10_000)}`, 'une catégorie complète ne fait pas le prix d’appel');
        assert.equal(fromPriceLabel([{ price: 0, isAvailable: true }]), 'Gratuit');
        assert.equal(fromPriceLabel([{ price: 0, isAvailable: true }, { price: 2_500, isAvailable: true }]), `Gratuit ou dès ${formatFcfa(2_500)}`);
        assert.equal(fromPriceLabel([{ price: 5_000, isAvailable: false }]), null);
    });

    test('prochain changement de la vente : début ou fin de vente, fin de l’événement ; rien dans le passé', () => {
        const categories = [
            { saleStart: iso(-5), saleEnd: iso(3) },
            { saleStart: iso(1), saleEnd: null },
        ] as unknown as Parameters<typeof nextSaleBoundary>[0]['categories'];
        assert.equal(nextSaleBoundary({ categories, endsAt: iso(10) }, NOW)?.toISOString(), iso(1));
        assert.equal(nextSaleBoundary({ categories: [], endsAt: iso(10) }, NOW)?.toISOString(), iso(10));
        assert.equal(nextSaleBoundary({ categories: [], endsAt: iso(-1) }, NOW), null);
    });

    test('remboursement : annulation toujours vraie ; report vrai jusqu’au début seulement ; rien sans règle', () => {
        assert.equal(refundRuleApplies(null, iso(5), NOW), false);
        assert.equal(refundRuleApplies({ kind: 'ANNULATION', text: REFUND_INFO }, iso(-5), NOW), true);
        assert.equal(refundRuleApplies({ kind: 'REPORT', text: POSTPONEMENT_REFUND_INFO }, iso(5), NOW), true);
        assert.equal(refundRuleApplies({ kind: 'REPORT', text: POSTPONEMENT_REFUND_INFO }, iso(-1), NOW), false);
        assert.match(POSTPONEMENT_REFUND_INFO, /plus de 24 h/);
        assert.match(POSTPONEMENT_REFUND_INFO, /frais de service compris/);
        assert.match(REFUND_INFO, /espèces sont remboursés par l’organisateur/);
    });

    test('lecture de la réponse de la route : guichet faux et remboursement null par défaut', () => {
        const parsed = readPublicEventDetail({ event: { id: 'x', title: 'T', purchasable: true } });
        assert.equal(parsed?.counterSale, false);
        assert.equal(parsed?.refund, null);
        assert.deepEqual(parsed?.categories, []);
        assert.equal(readPublicEventDetail({ event: { id: 'x' } }), null);
    });
});

describe('b. page serveur en cache, vrai 404, îlots', () => {
    test('page : composant serveur, revalidate 60, aucune fiche préparée à la construction, aucune session lue', () => {
        const src = code(PAGE);
        assert.doesNotMatch(src, /^\s*['"]use client['"]/m, 'la page doit être un composant serveur');
        assert.match(src, /export const revalidate = 60;/);
        assert.match(src, /export function generateStaticParams\(\)[\s\S]{0,60}?return \[\];/);
        assert.match(src, /notFound\(\)/, 'fiche non publique : notFound()');
        assert.doesNotMatch(src, /next\/headers|useAuth|cookies\(|getSession/, 'aucune session dans la page en cache');
        assert.doesNotMatch(src, /\/api\/events\//, 'la page lit la fiche côté serveur, pas par la route');
        assert.match(src, /readPublicSheet\(/);
    });

    test('layout : vrai 404 sur la fiche en cache, plus de rendu forcé', () => {
        const src = code(LAYOUT);
        assert.match(src, /readPublicSheet\(/);
        assert.match(src, /notFound\(\)/);
        assert.doesNotMatch(src, /force-dynamic/);
    });

    test('lecture serveur : cache de 60 s ; une panne n’est jamais un 404 ; route sans cache servie par la même source', () => {
        const src = code(READER);
        assert.match(src, /unstable_cache\(/);
        assert.match(src, /PUBLIC_SHEET_REVALIDATE_SECONDS = 60/);
        assert.match(src, /kind: 'unavailable'/);
        assert.match(src, /isEventId\(eventId\)/, 'identifiant illisible : aucune lecture');
        const route = code(ROUTE);
        assert.match(route, /buildPublicEventDetail\(/);
        assert.match(route, /force-dynamic/, 'la route reste lue à chaque appel (temps réel de la billetterie)');
    });

    test('affiche : une seule image prioritaire, tailles données, place réservée 16/10, même nom de transition que la carte', () => {
        const src = code(PAGE);
        assert.equal((src.match(/\bpriority\b/g) ?? []).length, 1, 'priority sur la seule affiche');
        assert.match(src, /sizes=\{POSTER_SIZES\}/);
        assert.match(src, /aspect-\[16\/10\]/);
        assert.match(src, /viewTransitionName: `ev-poster-\$\{event\.id\}`/);
    });

    test('îlots du navigateur : use client ; le bandeau seulement pour une personne connectée', () => {
        for (const file of ISLANDS) assert.match(read(file), /^'use client';/, `${file} : îlot du navigateur`);
        const slot = code(SLOT);
        assert.match(slot, /if \(isLoading \|\| !isAuthenticated\) return null;/);
    });
});

describe('c. billetterie et barre d’achat du téléphone', () => {
    const src = code(TICKETING);

    test('barre fixe dès l’ouverture : « Billetterie » + prix d’appel + « Choisir mes billets », puis « Acheter (n) » ; place réservée', () => {
        assert.match(src, /'choose'/);
        assert.match(src, /Choisir mes billets/);
        assert.match(src, /`Acheter \(\$\{cartTotalQty\}\)`/);
        assert.match(src, /fromPriceLabel\(categories\)/);
        assert.match(src, /className="fixed inset-x-0 bottom-\[calc\(3\.3125rem\+env\(safe-area-inset-bottom\)\)\][^"]*lg:hidden"/);
        // Design 1c (point 1, modification signalée) : sous 390 px, le grand bouton passe sous le montant : place plus haute
        assert.match(src, /\{barKind && <div aria-hidden="true" className="h-36 min-\[390px\]:h-20 lg:hidden" \/>\}/, 'place réservée sous la barre');
        assert.match(src, /getElementById\('billetterie-titre'\)/, '« Choisir mes billets » amène aux catégories');
    });

    test('un seul grand bouton par écran : dégradé dans la barre (téléphone) ou dans le panneau (ordinateur)', () => {
        const gradients = src.match(/variant="gradient"[^>]*/g) ?? [];
        assert.ok(gradients.length >= 2, 'barre et panneau');
        const panel = gradients.filter((g) => /hidden lg:inline-flex/.test(g));
        assert.equal(panel.length, 1, 'le dégradé du panneau est masqué sur téléphone');
        assert.match(src, /variant="primary"\s+size="lg"\s+fullWidth\s+className="lg:hidden"/, 'bouton principal du panneau sur téléphone');
    });

    test('catégories en cartes avec leur couleur du contrôle (liseré), jamais en aplat', () => {
        assert.match(src, /CATEGORY_STRIPE\[cat\.scanColor\]/);
        const colors = read('components/event-page/category-colors.ts');
        for (const key of ['BLANC', 'OR', 'ARGENT', 'ROSE', 'TURQUOISE', 'BLEU', 'VIOLET', 'NOIR']) {
            assert.match(colors, new RegExp(`${key}: 'bg-scan-cat-${key.toLowerCase()}-bg'`));
        }
        assert.match(src, /absolute inset-y-0 left-0 w-1\.5/);
    });

    test('guichet et remboursement : seulement d’après la fiche servie (counterSale, refund)', () => {
        assert.match(src, /event\.counterSale/);
        assert.match(src, /Billets au guichet sur place/);
        assert.match(src, /refundRuleApplies\(event\.refund/);
        assert.match(src, /\{refund\.text\}/);
        assert.doesNotMatch(src, /remboursés automatiquement/, 'aucun texte de remboursement écrit à la main dans l’îlot');
        assert.match(src, /purchasable = event\.purchasable && !gone/, 'achat seulement si la vente en ligne est ouverte (route)');
    });

    test('temps réel du stock et relecture au changement de vente ; après un achat gratuit : la petite fête de Mes billets', () => {
        assert.match(src, /public_event_state/);
        assert.match(src, /public_category_stock/);
        assert.match(src, /nextSaleBoundary\(event, new Date\(\)\)/);
        assert.match(src, /router\.push\(TICKETS_AFTER_PURCHASE\)/);
        assert.equal(TICKETS_AFTER_PURCHASE, '/tickets?tab=a-venir&fete=1');
    });

    test('animations communes : cascade, pression, montée (classes ev-*)', () => {
        assert.match(src, /ev-stagger/);
        assert.match(src, /ev-press/);
        assert.match(code(SLOT), /ev-sheet-up/);
    });
});

describe('d. bandeau de paiement en attente : même condition que le serveur', () => {
    test('findPendingTicketPayment et la garde SQL lisent le même paiement (compte, événement, billets, PENDING), sans échéance', () => {
        const svc = read('lib/payments/checkout.service.ts');
        const fn = svc.slice(svc.indexOf('export async function findPendingTicketPayment'), svc.indexOf('async function existingPayment'));
        for (const [col, value] of [['client_id', 'clientId'], ['event_id', 'eventId'], ['payment_target', "'TICKET'"], ['status', "'PENDING'"]]) {
            assert.ok(fn.includes(`.eq('${col}', ${value})`), `findPendingTicketPayment : filtre ${col} absent`);
        }
        assert.doesNotMatch(fn, /\.(gt|gte|lt|lte)\(/, 'aucun filtre d’échéance : le serveur bloque encore après la réservation');

        const dir = path.join(ROOT, 'supabase', 'migrations');
        const latest = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
            .filter((f) => /FUNCTION public\.checkout_create_payment\b/.test(fs.readFileSync(path.join(dir, f), 'utf8'))).pop();
        assert.ok(latest, 'définition de checkout_create_payment introuvable');
        const sql = fs.readFileSync(path.join(dir, latest!), 'utf8');
        const guard = sql.slice(sql.indexOf('SELECT id INTO v_pending'), sql.indexOf("'PAYMENT_PENDING'"));
        for (const part of ["client_id = (p->>'client_id')::uuid", "event_id = (p->>'event_id')::uuid", "payment_target::text = 'TICKET'", "status::text = 'PENDING'"]) {
            assert.ok(guard.includes(part), `${latest} : garde PAYMENT_PENDING sans « ${part} »`);
        }
        assert.doesNotMatch(guard, /held_expires_at|expires_at/, `${latest} : la garde dépend de l’échéance (le bandeau devrait suivre)`);
    });

    test('le bandeau reste : plus de retrait à l’échéance ; relecture régulière ; « Annuler ce paiement » et « Suivre le paiement »', () => {
        const src = code(BANNER);
        assert.doesNotMatch(src, /setTimeout\(\(\) => setPending\(null\)/, 'le bandeau ne disparaît plus à l’échéance de la réservation');
        assert.match(src, /POLL_MS = 15_000/);
        assert.match(src, /visibilitychange/);
        assert.match(src, /Annuler ce paiement/);
        assert.match(src, /Suivre le paiement/);
        assert.match(src, /\/api\/payments\/\$\{encodeURIComponent\(pending\.paymentId\)\}\/cancel/);
        assert.match(src, /res\.status === 409 && code === 'PAYMENT_ALREADY_CONFIRMED'/);
        assert.match(src, /res\.status === 503/);
        assert.match(src, /<ConfirmDialog/, 'confirmation avant l’annulation');
    });
});

describe('e. achat et paiement', () => {
    test('fenêtre : opérateur non présélectionné, grands boutons aux couleurs de Wave et d’Orange Money, frais avant le bouton', () => {
        const src = code(MODAL);
        assert.match(src, /useState<SamirPayOperatorName \| null>\(null\)/, 'aucun opérateur présélectionné');
        assert.match(src, /WAVE: 'bg-op-wave'/);
        assert.match(src, /ORANGE_MONEY: 'bg-op-orange-money'/);
        assert.match(src, /OPERATOR_TILE\[op\]/);
        assert.match(src, /text-on-op/);
        const fees = src.indexOf('Frais de service');
        const submit = src.indexOf('type="submit"');
        assert.ok(fees > 0 && submit > fees, 'les frais s’affichent avant le bouton de paiement');
        assert.match(src, /dans Mes billets dès la confirmation/, 'ce que la personne va recevoir');
        assert.equal((src.match(/type="submit"/g) ?? []).length, 1, 'une seule confirmation');
    });

    test('suivi du paiement : billets confirmés → Mes billets avec la petite fête', () => {
        const src = code(PAY_PAGE);
        assert.match(src, /function afterPurchase\(path: string\): string \{\s*return path === '\/tickets' \? TICKETS_AFTER_PURCHASE : path;/);
        assert.match(src, /successUrl: afterPurchase\(/);
    });
});

describe('f. petite carte du lieu', () => {
    test('nom de l’événement sur le repère, échappé ; fond de carte au toucher, place réservée', () => {
        const html = mapMarkerHtml('choisi', 'Nuit <script>alert(1)</script> & co');
        assert.ok(!html.includes('<script>'), 'nom échappé');
        assert.match(html, /&lt;script&gt;/);
        assert.match(html, /ev-repere--choisi/);
        const venue = code(VENUE_MAP);
        assert.match(venue, /mapMarkerHtml\('choisi'/);
        assert.match(venue, /Afficher la carte/);
        assert.match(venue, /\{shown \? \(/, 'Leaflet seulement après le toucher');
        assert.match(venue, /relative h-48 w-full[^"]*sm:h-56/, 'place réservée');
        const map = code(EVENT_MAP);
        assert.match(map, /mapMarkerHtml\('choisi', markerName\(eventName\)\)/);
    });
});
