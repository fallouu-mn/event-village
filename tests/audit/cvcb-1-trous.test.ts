/**
 * Contre-vérification du lot Carte B (22/11/2026) — trous, sans base ni serveur (lecture du code et fonctions pures).
 * Vert = attaque bloquée ; rouge = trou. Les preuves de bout en bout (serveur construit) sont dans
 * e2e/cvcb.responsive.spec.ts.
 *
 *  T1 « Autour de moi » : après le centrage sur la position du téléphone, « Rechercher dans cette zone » envoie au serveur
 *     une zone dont le centre EST la position (bornes arrondies à 4 décimales, ~11 m) : la position quitte le téléphone.
 *  T2 Fin d'événement par la tâche planifiée (GET /api/cron/events-finish, events_finish_overdue) : passage à TERMINE
 *     sans invalidation des pages publiques (fiche : bandeau « Événement terminé » absent jusqu'à 60 s ; « À la une » :
 *     placement retiré par la base, accueil en cache).
 *  T3 Profil de la partenaire (PATCH /api/partner/profile, partner_profile_update) : nom commercial, raison sociale et logo
 *     affichés par la fiche (organisateur) et cherchés par le texte d'Explorer et de la carte ; aucune invalidation.
 *  T4 Vente en ligne confirmée (payment_confirm) : le stock change « Complet », le prix d'appel de la carte (catégorie plus
 *     achetable) et les tranches de la fiche ; aucune invalidation.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mapUrl } from '../../lib/events/map-client';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const INVALIDATE_IMPORT = /import \{[^}]*\binvalidatePublicEvent\b[^}]*\} from '@\/lib\/events\/public-cache\.server';/;

/** Distance approchée (m) entre deux points proches. */
function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const k = 111_320;
    const dy = (a.lat - b.lat) * k;
    const dx = (a.lng - b.lng) * k * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
    return Math.hypot(dx, dy);
}

describe('T1 — « Autour de moi » : la position ne quitte jamais le téléphone', () => {
    test('la zone envoyée par « Rechercher dans cette zone » juste après « Autour de moi » ne permet pas de retrouver la position à 1 km près', () => {
        // Vue d'un téléphone (390 × 600 px de carte) au zoom 13 de « Autour de moi » (goTo(latitude, longitude, 13)) : la
        // zone visible est centrée sur la position ; demi-largeur 195 px, demi-hauteur 300 px, 360 / (256 × 2^13) degré par px
        const degPerPx = 360 / (256 * 2 ** 13);
        const errors: number[] = [];
        for (let i = 0; i < 40; i++) {
            const pos = { lat: 14.66 + i * 0.00317, lng: -17.52 + i * 0.00241 };
            const halfLat = 300 * degPerPx * Math.cos(pos.lat * Math.PI / 180);
            const halfLng = 195 * degPerPx;
            const url = mapUrl('', { zone: { south: pos.lat - halfLat, west: pos.lng - halfLng, north: pos.lat + halfLat, east: pos.lng + halfLng } });
            const zone = new URL(url, 'http://x').searchParams.get('zone');
            assert.ok(zone, `adresse sans zone : ${url}`);
            const [s, w, n, e] = zone.split(',').map(Number);
            errors.push(metres(pos, { lat: (s + n) / 2, lng: (w + e) / 2 }));
        }
        errors.sort((a, b) => a - b);
        const median = errors[Math.floor(errors.length / 2)];
        assert.ok(
            median >= 1_000,
            `position retrouvée au centre de la zone envoyée : écart médian ${median.toFixed(1)} m, maximal ${errors[errors.length - 1].toFixed(1)} m `
            + `(exemple : ${mapUrl('', { zone: { south: 14.6702, west: -17.4935, north: 14.7698, east: -17.4265 } })})`,
        );
    });
});

describe('T2 — fin d’événement par la tâche planifiée : pages publiques invalidées', () => {
    test('GET /api/cron/events-finish : invalidatePublicEvent après events_finish_overdue quand des événements sont passés à TERMINE', () => {
        const rel = 'app/api/cron/events-finish/route.ts';
        const src = read(rel);
        assert.match(src, INVALIDATE_IMPORT, `${rel} : invalidatePublicEvent n'est pas importé (aucune invalidation après le passage à TERMINE)`);
        const write = src.indexOf("'events_finish_overdue'");
        const call = src.search(/invalidatePublicEvent\(/);
        assert.ok(write > 0, 'appel de events_finish_overdue introuvable');
        assert.ok(call > write, `${rel} : aucune invalidation après events_finish_overdue`);
    });
});

describe('T3 — profil de la partenaire : pages publiques invalidées', () => {
    test('PATCH /api/partner/profile : invalidatePublicEvent après partner_profile_update (nom commercial, raison sociale, logo affichés)', () => {
        const rel = 'app/api/partner/profile/route.ts';
        const src = read(rel);
        assert.match(src, INVALIDATE_IMPORT, `${rel} : invalidatePublicEvent n'est pas importé (la fiche garde l'ancien nom et l'ancien logo, la recherche par nom l'ancien nom, jusqu'à 60 s)`);
        const write = src.indexOf("'partner_profile_update'");
        const call = src.search(/invalidatePublicEvent\(/);
        assert.ok(write > 0, 'appel de partner_profile_update introuvable');
        assert.ok(call > write, `${rel} : aucune invalidation après partner_profile_update`);
    });
});

describe('T4 — vente confirmée : pages publiques invalidées', () => {
    test('confirmTicketPayment : invalidatePublicEvent après payment_confirm (« Complet », prix d’appel de la carte, tranches de la fiche)', () => {
        const rel = 'lib/payments/confirmation.service.ts';
        const src = read(rel);
        const start = src.indexOf('export async function confirmTicketPayment(');
        assert.ok(start >= 0, 'confirmTicketPayment introuvable');
        const end = src.indexOf('\nexport ', start + 10);
        const body = src.slice(start, end < 0 ? undefined : end);
        assert.ok(body.includes('rpcWithRetry'), 'appel de la confirmation introuvable');
        assert.ok(
            /invalidatePublicEvent\(/.test(body) && INVALIDATE_IMPORT.test(src),
            `${rel} : aucune invalidation après payment_confirm (une vente qui épuise une catégorie reste « en vente » jusqu'à 60 s sur le catalogue, l'accueil et la carte)`,
        );
    });
});
