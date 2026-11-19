/**
 * Design 1b (points 8 et 9) — « Mes billets » façon Wallet et profil : règles vérifiables sans base ni navigateur.
 *  a. Compte à rebours jusqu'au début, à la minute, calculé sur le téléphone (components/tickets/wallet.ts) ; ordre du
 *     portefeuille (le prochain billet d'abord).
 *  b. « Prévenir par WhatsApp » : wa.me vers le numéro du destinataire (chiffres E.164 sans « + »), message avec l'adresse
 *     du site lue dans la configuration (NEXT_PUBLIC_APP_URL), l'adresse où accepter le billet et la vraie échéance ;
 *     numéro inconnu : aucun lien (repli « Partager »).
 *  c. Mots justes : jamais « Envoyé par Un utilisateur » ; « F CFA » (plus de « FCFA ») dans le PDF du billet ;
 *     « Disponible sans réseau ».
 *  d. Couleur de la catégorie : classes des jetons --scan-cat-* (palette fermée du scanner), texte d'au moins 4,5:1.
 *  e. Liens des avis vers Mes billets : chaque lien ouvre un onglet qui existe et qui montre le billet concerné.
 *  f. Réabonnement automatique aux notifications (lib/push/client.ts, faux navigateur, sans base) : seulement si la
 *     permission est déjà accordée, jamais de fenêtre d'autorisation, plus après « Désactiver » (réglage de l'appareil
 *     sans donnée du compte). Enregistrement pour le seul compte connecté, avec les vraies routes et la base :
 *     tests/parcours/design1b-billets.test.ts.
 *  g. Fête après l'achat : 300 ms de mouvement au plus, rien si « réduire les animations », annonce « Vos billets sont là. ».
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { byStart, categoryClasses, countdownLabel, msToNextMinute, NEUTRAL_CATEGORY_CLASSES, senderLine } from '../../components/tickets/wallet';
import { siteUrl, transferMessage, transferWhatsappUrl, whatsappDigits } from '../../components/tickets/transfer-whatsapp';
import { formatDateTime } from '../../lib/format';
import { SCAN_CATEGORY_COLORS } from '../../lib/scan/scan-result';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const MIN = 60_000;
const START = Date.parse('2026-11-20T20:00:00.000Z');
const END = Date.parse('2026-11-21T02:00:00.000Z');
const iso = (t: number): string => new Date(t).toISOString();

// ── a. Compte à rebours ────────────────────────────────────────────────────

describe('a. compte à rebours à la minute (heure du téléphone)', () => {
    const at = (msBefore: number): string | null => countdownLabel(iso(START), iso(END), START - msBefore);

    test('jours, heures, minutes ; arrondi à la minute supérieure', () => {
        assert.equal(at(3 * 1440 * MIN + 4 * 60 * MIN), 'Dans 3 jours et 4 h');
        assert.equal(at(1440 * MIN), 'Dans 1 jour');
        assert.equal(at(1440 * MIN + 30 * MIN), 'Dans 1 jour', 'au-delà d’un jour, les minutes ne sont pas dites');
        assert.equal(at(2 * 60 * MIN + 5 * MIN), 'Dans 2 h 5 min');
        assert.equal(at(60 * MIN), 'Dans 1 h');
        assert.equal(at(12 * MIN), 'Dans 12 min');
        assert.equal(at(11 * MIN + 1), 'Dans 12 min', '11 min et 1 ms : 12 min (minute entamée)');
        assert.equal(at(1), 'Dans 1 min', 'jusqu’au début, jamais « 0 min »');
    });

    test('« En cours » entre le début et la fin retenue ; rien après la fin ni sans heure', () => {
        assert.equal(countdownLabel(iso(START), iso(END), START), 'En cours');
        assert.equal(countdownLabel(iso(START), iso(END), END - 1), 'En cours');
        assert.equal(countdownLabel(iso(START), iso(END), END), null);
        assert.equal(countdownLabel(null, iso(END), START - MIN), null);
        assert.equal(countdownLabel('pas une date', iso(END), START - MIN), null);
    });

    test('la minuterie se cale sur le changement de minute ; le prochain billet d’abord', () => {
        const now = Date.parse('2026-11-18T10:15:42.300Z');
        const next = now + msToNextMinute(now);
        assert.equal(new Date(next).getUTCSeconds(), 0, 'réveil juste après le changement de minute');
        assert.ok(next > now && next - now <= MIN + 250);
        const list = [{ id: 'b', startsAt: iso(START + MIN) }, { id: 'sans', startsAt: null }, { id: 'a', startsAt: iso(START) }];
        assert.deepEqual([...list].sort(byStart).map((t) => t.id), ['a', 'b', 'sans']);
    });
});

// ── b. Prévenir par WhatsApp ───────────────────────────────────────────────

describe('b. « Prévenir par WhatsApp » après un transfert', () => {
    const EXPIRES = '2026-11-20T18:30:00.000Z';

    test('wa.me vers le numéro du destinataire, chiffres E.164 sans « + » ; message : site, onglet Reçus, vraie échéance', () => {
        const url = transferWhatsappUrl({ phone: '+221771234567', eventTitle: 'Gala Teranga', expiresAt: EXPIRES, site: 'https://eventvillage.sn' });
        assert.ok(url, 'lien attendu');
        const parsed = new URL(url!);
        assert.equal(parsed.origin, 'https://wa.me');
        assert.equal(parsed.pathname, '/221771234567');
        const text = parsed.searchParams.get('text') ?? '';
        assert.ok(text.includes('« Gala Teranga »'), text);
        assert.ok(text.includes('https://eventvillage.sn/tickets?tab=recus'), `adresse où accepter le billet : ${text}`);
        assert.ok(text.includes(`avant le ${formatDateTime(EXPIRES)}`), `échéance servie par le serveur : ${text}`);
        assert.ok(!/48 h/.test(text), 'aucune échéance supposée');
    });

    test('numéro inconnu ou invalide : aucun lien (repli « Partager ») ; sans échéance, rien d’inventé', () => {
        for (const phone of [null, undefined, '', 'abc', '+22177', 'awa@exemple.sn']) {
            assert.equal(transferWhatsappUrl({ phone, eventTitle: 'X', expiresAt: EXPIRES, site: 'https://eventvillage.sn' }), null, String(phone));
        }
        assert.equal(whatsappDigits('+221 77 123 45 67'), '221771234567');
        const text = transferMessage({ eventTitle: 'X', expiresAt: null, site: 'https://eventvillage.sn' });
        assert.ok(!/avant le/.test(text) && text.endsWith('https://eventvillage.sn/tickets?tab=recus'), text);
    });

    test('adresse du site : configuration NEXT_PUBLIC_APP_URL (sans « / » final), lue par la modale de transfert', () => {
        const saved = process.env.NEXT_PUBLIC_APP_URL;
        try {
            process.env.NEXT_PUBLIC_APP_URL = 'https://eventvillage.sn/';
            assert.equal(siteUrl(), 'https://eventvillage.sn');
        } finally {
            if (saved === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
            else process.env.NEXT_PUBLIC_APP_URL = saved;
        }
        const modal = read('components/tickets/TransferModal.tsx');
        assert.match(modal, /transferWhatsappUrl\(\{\s*phone: success\.recipient/, 'numéro du destinataire retenu par le serveur');
        assert.match(modal, /expiresAt: success\.expiresAt/, 'échéance du serveur');
        assert.match(modal, /Prévenir par WhatsApp/);
        assert.match(modal, /Prévenir mon proche/, 'repli « Partager » gardé');
        assert.doesNotMatch(modal, /window\.location\.origin/, 'adresse du site lue dans la configuration');
    });
});

// ── c. Mots justes ─────────────────────────────────────────────────────────

describe('c. mots justes', () => {
    test('expéditeur d’un billet reçu : le nom quand on l’a, sinon une formulation vraie', () => {
        assert.equal(senderLine('TRANSFER', 'Awa D.'), 'Envoyé par Awa D.');
        assert.equal(senderLine('TRANSFER', 'Un utilisateur Event Village'), 'Billet reçu');
        assert.equal(senderLine('TRANSFER', 'Un utilisateur'), 'Billet reçu');
        assert.equal(senderLine('TRANSFER', 'A***'), 'Billet reçu', 'initiale masquée : pas un nom');
        assert.equal(senderLine('TRANSFER', ''), 'Billet reçu');
        assert.equal(senderLine('INVITATION', 'L’organisateur de l’événement'), 'Invitation de l’organisateur');
        const incoming = read('components/tickets/IncomingTransfers.tsx');
        assert.doesNotMatch(incoming, /['"`]Un utilisateur/, 'plus de repli « Un utilisateur »');
        assert.match(incoming, /senderLine\(t\.kind, t\.sender_display\)/);
        assert.doesNotMatch(incoming, /`Envoyé par \$\{/);
    });

    test('« F CFA » dans le PDF du billet, plus « FCFA » ; « Disponible sans réseau »', () => {
        for (const rel of ['app/api/tickets/[id]/pdf/route.ts', 'lib/tickets/ticket-pdf.service.ts', 'components/tickets/TicketCard.tsx', 'app/tickets/page.tsx']) {
            assert.doesNotMatch(read(rel), /FCFA/, `${rel} : « FCFA » écrit à la main`);
        }
        assert.match(read('app/api/tickets/[id]/pdf/route.ts'), / F CFA/);
        assert.doesNotMatch(read('lib/tickets/ticket-pdf.service.ts'), /Porteur/);
        const badge = read('components/tickets/offline/OfflineStatusBadge.tsx');
        assert.match(badge, /'Disponible sans réseau'/);
        assert.doesNotMatch(badge, /return 'Disponible hors ligne'/);
    });
});

// ── d. Couleur de la catégorie ─────────────────────────────────────────────

function luminance(rgb: number[]): number {
    const [r, g, b] = rgb.map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('d. carte à la couleur de la catégorie', () => {
    test('chaque couleur de la palette du scanner a ses classes ; sans couleur : carte neutre', () => {
        const tailwind = read('tailwind.config.ts');
        for (const color of SCAN_CATEGORY_COLORS) {
            const key = color.toLowerCase();
            assert.equal(categoryClasses(color), `bg-scan-cat-${key}-bg text-scan-cat-${key}-fg`);
            assert.match(tailwind, new RegExp(`'cat-${key}-bg'`), `jeton cat-${key}-bg déclaré`);
        }
        assert.equal(categoryClasses(null), NEUTRAL_CATEGORY_CLASSES);
        assert.equal(categoryClasses('ROUGE'), NEUTRAL_CATEGORY_CLASSES, 'valeur hors palette : carte neutre');
    });

    test('texte de la catégorie lisible : contraste d’au moins 4,5:1 (mêmes valeurs en clair et en sombre)', () => {
        const css = read('app/globals.css');
        for (const color of SCAN_CATEGORY_COLORS) {
            const key = color.toLowerCase();
            const value = (name: string): number[] => {
                const m = new RegExp(`--scan-cat-${key}-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`).exec(css);
                assert.ok(m, `--scan-cat-${key}-${name} absent d'app/globals.css`);
                return [Number(m![1]), Number(m![2]), Number(m![3])];
            };
            const [a, b] = [luminance(value('bg')), luminance(value('fg'))].sort((x, y) => y - x);
            const ratio = (a + 0.05) / (b + 0.05);
            assert.ok(ratio >= 4.5, `${color} : contraste ${ratio.toFixed(2)}:1`);
        }
    });

    test('GET /api/tickets sert la couleur (palette fermée), le début et la fin ; réponse jamais mise en cache', () => {
        const route = read('app/api/tickets/route.ts');
        assert.match(route, /ticket_categories\(id, name, price, scan_color\)/);
        assert.match(route, /categoryColor: isScanCategoryColor\(scanColor\) \? scanColor : null/);
        assert.match(route, /startsAt:/);
        assert.match(route, /endsAt:/);
        assert.match(route, /'Cache-Control': 'private, no-store'/);
        assert.doesNotMatch(route, /unsplash/, 'plus de photo distante en repli (poids du premier affichage)');
    });
});

// ── e. Liens des avis ──────────────────────────────────────────────────────

describe('e. liens des avis vers le bon onglet de Mes billets', () => {
    const EXPECTED: Record<string, string> = {
        PURCHASE_CONFIRMED: 'a-venir', FREE_TICKETS_CONFIRMED: 'a-venir', TRANSFER_RECEIVED: 'a-venir', TRANSFER_EXPIRED: 'a-venir',
        TRANSFER_DECLINED_SENDER: 'a-venir', TRANSFER_RECIPIENT_CHANGED: 'a-venir', TRANSFER_CLAIMED_SENDER: 'a-venir',
        REMINDER_J1: 'a-venir', REMINDER_H3: 'a-venir',
        INVITATION_RECEIVED: 'recus', TRANSFER_OFFERED: 'recus', TRANSFER_CANCELLED: 'recus', TRANSFER_REVOKED: 'recus',
        TICKET_SCANNED: 'historique', EVENT_CANCELLED: 'historique', REFUND_REQUESTED: 'historique', REFUND_PAID: 'historique',
        REFUND_DELAYED: 'historique', PAYMENT_REFUND_STARTED: 'historique', TICKET_CANCELLED: 'historique', TICKET_REFUNDED_HOLDER: 'historique',
        EVENT_CLOSED_HOLDER: 'tous',
    };

    test('chaque lien vers /tickets porte un onglet qui existe dans la page', () => {
        const page = read('app/tickets/tabs.ts'); // décision du 19/11 : onglets partagés par la page serveur et la vue
        const tabs = /const TABS = \[([^\]]+)\] as const/.exec(page);
        assert.ok(tabs, 'liste TABS de app/tickets/tabs.ts');
        const known = new Set(Array.from(tabs![1].matchAll(/'([a-z-]+)'/g), (m) => m[1]));
        const catalog = NOTIFICATION_CATALOG as unknown as Record<string, { link?: (d: unknown) => string; sample?: unknown }>;
        const seen: string[] = [];
        for (const [type, tpl] of Object.entries(catalog)) {
            if (typeof tpl.link !== 'function') continue;
            let link: string;
            try {
                link = tpl.link(tpl.sample ?? {});
            } catch {
                continue; // lien qui exige des données propres au type : jamais vers Mes billets (contrôlé ci-dessous)
            }
            const url = new URL(link, 'https://exemple.sn');
            if (url.pathname !== '/tickets') continue;
            seen.push(type);
            const tab = url.searchParams.get('tab');
            assert.ok(tab && known.has(tab), `${type} : ${link} — onglet absent ou inconnu (onglets : ${[...known].join(', ')})`);
        }
        assert.deepEqual(seen.sort(), Object.keys(EXPECTED).sort(), 'types qui mènent à Mes billets');
    });

    test('onglet de chaque type : celui qui montre le billet concerné', () => {
        const catalog = NOTIFICATION_CATALOG as unknown as Record<string, { link: (d: unknown) => string; sample?: unknown }>;
        for (const [type, tab] of Object.entries(EXPECTED)) {
            assert.equal(catalog[type].link(catalog[type].sample ?? {}), `/tickets?tab=${tab}`, type);
        }
    });

    test('règles des onglets de la page : « À venir » = billet valable d’un événement pas fini, « Historique » = le reste', () => {
        const page = read('app/tickets/TicketsView.tsx');
        assert.match(page, /return t\.status === 'VALIDE' && t\.isUpcoming;/);
        assert.match(page, /tab === 'historique'\) return tickets\.filter\(\(t\) => !isActiveUpcoming\(t\)\)/);
    });
});

// ── f. Réabonnement automatique (faux navigateur, sans base) ───────────────

interface Sub { endpoint: string; options: { applicationServerKey: Buffer }; toJSON: () => unknown; unsubscribe: () => Promise<boolean> }

describe('f. réabonnement automatique de cet appareil aux notifications', () => {
    const publicKey = crypto.createECDH('prime256v1');
    publicKey.generateKeys();
    const VAPID = publicKey.getPublicKey().toString('base64url');
    const state = {
        permission: 'granted' as 'granted' | 'default' | 'denied',
        sub: null as Sub | null,
        storage: new Map<string, string>(),
        requests: 0,
        subscribes: 0,
        posts: [] as string[],
    };
    const saved: Array<[string, PropertyDescriptor | undefined]> = [];
    let client: typeof import('../../lib/push/client');

    function newSub(): Sub {
        const id = crypto.randomBytes(12).toString('base64url');
        const sub: Sub = {
            endpoint: `https://fcm.googleapis.com/fcm/send/${id}`,
            options: { applicationServerKey: Buffer.from(VAPID, 'base64url') },
            toJSON: () => ({ endpoint: sub.endpoint, keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }),
            unsubscribe: async () => { if (state.sub === sub) state.sub = null; return true; },
        };
        return sub;
    }

    function setGlobal(key: string, value: unknown): void {
        saved.push([key, Object.getOwnPropertyDescriptor(globalThis, key)]);
        Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    }

    before(async () => {
        const registration = {
            pushManager: {
                getSubscription: async () => state.sub,
                subscribe: async () => { state.subscribes += 1; state.sub = newSub(); return state.sub; },
            },
        };
        setGlobal('window', Object.assign(globalThis, {}));
        setGlobal('isSecureContext', true);
        setGlobal('PushManager', class {});
        setGlobal('Notification', class { static get permission() { return state.permission; } static async requestPermission() { state.requests += 1; return state.permission; } });
        setGlobal('navigator', { userAgent: 'test design 1b', serviceWorker: { getRegistration: async () => registration, register: async () => registration, ready: Promise.resolve(registration) } });
        setGlobal('localStorage', {
            getItem: (k: string) => state.storage.get(k) ?? null,
            setItem: (k: string, v: string) => { state.storage.set(k, String(v)); },
            removeItem: (k: string) => { state.storage.delete(k); },
        });
        setGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
            const url = new URL(String(input), 'https://exemple.sn').pathname;
            if (url === '/api/push/config') return new Response(JSON.stringify({ enabled: true, publicKey: VAPID }), { status: 200 });
            if (url === '/api/push/subscriptions' && init?.method === 'POST') {
                state.posts.push(JSON.parse(String(init.body)).endpoint);
                return new Response(JSON.stringify({ subscribed: true }), { status: 200 });
            }
            if (url === '/api/push/subscriptions' && init?.method === 'DELETE') return new Response(JSON.stringify({ removed: true }), { status: 200 });
            return new Response('{}', { status: 404 });
        });
        client = await import('../../lib/push/client');
    });

    after(() => {
        for (const [key, desc] of saved.reverse()) {
            if (desc) Object.defineProperty(globalThis, key, desc);
            else delete (globalThis as Record<string, unknown>)[key];
        }
    });

    beforeEach(() => {
        state.requests = 0;
        state.subscribes = 0;
        state.posts = [];
    });

    async function enabledThenSignedOut(): Promise<void> {
        state.permission = 'granted';
        state.sub = null;
        state.storage.clear();
        assert.equal(await client.enablePush(), 'enabled');
        assert.equal(state.storage.has(client.PUSH_DEVICE_KEY), false, 'appareil activé : aucun réglage « désactivé »');
        await state.sub!.unsubscribe(); // fin de session (« Déconnecter tous mes appareils ») : navigateur désabonné
        state.requests = 0;
        state.subscribes = 0;
        state.posts = [];
    }

    test('reconnexion, permission accordée : réabonné sans fenêtre d’autorisation, abonnement envoyé au serveur', async () => {
        await enabledThenSignedOut();
        assert.equal(await client.syncPushSubscription(), 'resubscribed');
        assert.equal(state.requests, 0, 'aucune demande d’autorisation');
        assert.equal(state.subscribes, 1);
        assert.deepEqual(state.posts, [state.sub!.endpoint]);
    });

    test('permission pas (ou plus) accordée : rien', async () => {
        await enabledThenSignedOut();
        for (const permission of ['default', 'denied'] as const) {
            state.permission = permission;
            assert.equal(await client.syncPushSubscription(), 'skipped', permission);
        }
        assert.equal(state.requests + state.subscribes + state.posts.length, 0);
    });

    test('notifications désactivées sur cet appareil : plus de réabonnement ; réglage sans donnée du compte ; « Activer » le retire', async () => {
        await enabledThenSignedOut();
        state.sub = newSub();
        await client.disablePush();
        assert.equal(state.storage.get(client.PUSH_DEVICE_KEY), 'desactive', 'réglage de l’appareil, valeur fixe');
        assert.equal(await client.syncPushSubscription(), 'skipped');
        assert.equal(state.subscribes + state.posts.length, 0);
        assert.equal(await client.enablePush(), 'enabled');
        assert.equal(state.storage.has(client.PUSH_DEVICE_KEY), false, '« Activer » retire le réglage');
    });

    test('compte changé avant l’enregistrement : rien n’est envoyé, aucun abonnement ne reste', async () => {
        await enabledThenSignedOut();
        assert.equal(await client.syncPushSubscription(() => false), 'skipped');
        assert.equal(state.posts.length, 0);
        assert.equal(state.sub, null);
    });

    test('appelée par AuthProvider à la connexion (compte actif, permission accordée), à la demande, sans demande d’autorisation', () => {
        const provider = read('components/providers/AuthProvider.tsx');
        assert.match(provider, /import\('@\/lib\/push\/client'\)\.then\(\(m\) => m\.syncPushSubscription\(\(\) => current\)\)/);
        assert.match(provider, /profile\.status !== 'SUSPENDU'/, 'jamais pour un compte suspendu');
        assert.match(provider, /Notification\.permission !== 'granted'\) return;/, 'module chargé seulement si la permission est accordée');
        assert.doesNotMatch(provider, /requestPermission/);
    });
});

// ── g. Fête après l'achat ──────────────────────────────────────────────────

describe('g. petite fête après l’achat (?fete=1)', () => {
    test('300 ms de mouvement, rien si « réduire les animations », annonce, paramètre retiré', () => {
        const fete = read('components/tickets/PurchaseCelebration.tsx');
        assert.match(fete, /const MOTION_MS = 300;/);
        assert.match(fete, /prefers-reduced-motion: reduce/);
        assert.match(fete, /CELEBRATION_MESSAGE = 'Vos billets sont là\.'/);
        assert.match(fete, /toastRef\.current\.success\(CELEBRATION_MESSAGE\)/, 'annonce par la zone status des toasts');
        assert.match(fete, /pointer-events-none fixed/, 'calque sans pointeur, aucun saut de mise en page');
        const page = read('app/tickets/TicketsView.tsx');
        assert.match(page, /get\('fete'\) === '1'/);
        assert.match(page, /url\.searchParams\.delete\('fete'\)/);
        assert.match(page, /window\.history\.replaceState/);
    });

    test('QR en grand : fond blanc, écran gardé allumé quand le navigateur sait le faire, sans bloquer sinon', () => {
        const big = read('components/tickets/QrFullscreen.tsx');
        assert.match(big, /bg-white/);
        assert.match(big, /wakeLock\.request\('screen'\)/);
        assert.match(big, /if \(!wakeLock \|\| document\.visibilityState !== 'visible'\) return;/);
        assert.match(big, /showModal\(\)/);
        const card = read('components/tickets/TicketCard.tsx');
        assert.match(card, /import\('@\/components\/tickets\/QrFullscreen'\)/, 'chargé à la demande');
    });
});
