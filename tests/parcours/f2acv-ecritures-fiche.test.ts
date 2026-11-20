/**
 * Correctifs de la contre-vérification de la finition 2a, T1 — inventaire de TOUTES les écritures des routes
 * /api/partner/* et /api/controller/* (fichiers du disque) et de leur garde pour une fiche partenaire SUSPENDU. Sans base.
 *
 *  a. /api/partner/* : chaque écriture (POST, PUT, PATCH, DELETE) est soit refusée à une fiche SUSPENDU par la garde de la
 *     fiche (partnerEventWrite : 403 PARTNER_SUSPENDED), soit gardée par elle pour une raison écrite ci-dessous ; aucune
 *     écriture nouvelle ne passe sans décision. Toute écriture de l'équipe (/api/partner/team/*) et des caisses
 *     (/api/partner/shifts/*) est refusée.
 *  b. /api/controller/* : chaque écriture refuse la propriétaire d'un événement dont la fiche n'est pas VALIDE
 *     (ownEventFicheRefusal), ou est gardée pour une raison écrite ; les trois routes signalées par l'audit (incidents de
 *     scan, clôture de caisse, activation du compte) sont tranchées.
 *  c. aucune route de l'équipe n'écrit directement dans event_controllers ni controller_invitations : chaque écriture
 *     passe par une fonction de la base qui contrôle la fiche en tête (migration 20261116000004).
 * Rouge avant le correctif : l'équipe et les caisses hors de partnerEventWrite ; incidents de scan sans garde ; point
 * d'entrée et retraits écrits directement dans event_controllers. Sortie brute `[F2ACV-T1]` (inventaire du rapport).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { partnerEventWrite } from '../../lib/auth/partner-fiche-guard';

const ROOT = process.cwd();
const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
const SAMPLE_UUID = '00000000-0000-4000-8000-000000000000';

interface Route { key: string; method: string; pattern: string; url: string; file: string; source: string }

/** Écritures exportées des route.ts sous app/api/<base>, clé « MÉTHODE /api/…/* » (segment dynamique = *). */
function writeRoutes(base: string): Route[] {
    const out: Route[] = [];
    const dirRoot = path.join(ROOT, 'app', 'api', base);
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
                continue;
            }
            if (e.name !== 'route.ts') continue;
            const source = fs.readFileSync(full, 'utf8');
            const segments = path.relative(path.join(ROOT, 'app'), dir).split(path.sep);
            const pattern = `/${segments.map((s) => (/^\[.+\]$/.test(s) ? '*' : s)).join('/')}`;
            const url = `/${segments.map((s) => (/^\[.+\]$/.test(s) ? SAMPLE_UUID : s)).join('/')}`;
            for (const method of WRITE_METHODS) {
                if (new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\b`).test(source)) {
                    out.push({ key: `${method} ${pattern}`, method, pattern, url, file: path.relative(ROOT, full).split(path.sep).join('/'), source });
                }
            }
        }
    };
    walk(dirRoot);
    return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** Écritures /api/partner/* qu'une fiche SUSPENDU garde, avec la raison (rapport de la finition, correctifs, T1). */
const PARTNER_KEPT: Readonly<Record<string, string>> = {
    'POST /api/partner/activation': 'période d’essai du compte (idempotente) : aucun événement, aucune équipe',
    'POST /api/partner/documents/upload': 'pièces du dossier : une fiche suspendue peut devoir compléter son dossier',
    'POST /api/partner/dossier/complete': 'complément du dossier, même raison',
    'POST /api/partner/events/*/participants-export': 'lecture envoyée en POST (export de la liste des participants)',
    'PATCH /api/partner/profile': 'profil de la fiche (présentation, coordonnées) : pas un événement ; images contrôlées (T6)',
    'POST /api/partner/register': 'inscription d’une organisatrice (aucune fiche encore)',
    // Contre-vérification du lot 10b (T1, modification signalée au rapport) : les écritures des salles ne sont plus
    // gardées ; refusées à une fiche SUSPENDU (partnerEventWrite)
    'PATCH /api/partner/orders/*': 'service des commandes fermé (interrupteur, 404) : à trancher à son ouverture',
    'POST /api/partner/products': 'service des produits fermé (interrupteur, 404) : à trancher à son ouverture',
    'PATCH /api/partner/products/*': 'service des produits fermé (interrupteur, 404) : à trancher à son ouverture',
    'DELETE /api/partner/products/*': 'service des produits fermé (interrupteur, 404) : à trancher à son ouverture',
    'POST /api/partner/products/*/status': 'service des produits fermé (interrupteur, 404) : à trancher à son ouverture',
    'POST /api/partner/tables': 'service des tables fermé (interrupteur, 404) : à trancher à son ouverture',
    'PATCH /api/partner/tables/*': 'service des tables fermé (interrupteur, 404) : à trancher à son ouverture',
    'DELETE /api/partner/tables/*': 'service des tables fermé (interrupteur, 404) : à trancher à son ouverture',
    // Lot 11a (modification signalée au rapport) : POST /api/partner/tables/reservations supprimée (création d'une
    // réservation par la partenaire, sans contrôle) ; établissements ajoutés (création réservée à une fiche VALIDE)
    'POST /api/partner/venues': 'service des tables fermé (interrupteur, 404) ; création d’un établissement réservée à une fiche VALIDE (TableService.createVenue)',
    'PATCH /api/partner/venues/*': 'service des tables fermé (interrupteur, 404) : à trancher à son ouverture',
    'PATCH /api/partner/tables/reservations/*': 'service des tables fermé (interrupteur, 404) : à trancher à son ouverture',
    'DELETE /api/partner/tables/reservations/*': 'service des tables fermé (interrupteur, 404) : à trancher à son ouverture',
};

/** Écritures /api/controller/* sans ownEventFicheRefusal, avec la raison (décision du correctif T1). */
const CONTROLLER_KEPT: Readonly<Record<string, string>> = {
    'POST /api/controller/shifts/close': 'clôture de SA caisse ouverte : l’argent encaissé doit pouvoir être déclaré même après la suspension (sinon la caisse reste ouverte et le contrôleur ne peut plus être retiré)',
    'POST /api/controller/setup': 'activation du compte d’un contrôleur (mot de passe) : son compte, aucun événement',
    'PATCH /api/controller/profile': 'profil du contrôleur lui-même (nom) : aucun événement',
};

describe('a. /api/partner/* : chaque écriture refusée à une fiche SUSPENDU, ou gardée pour une raison écrite', () => {
    const routes = writeRoutes('partner');

    test('inventaire complet, aucune écriture sans décision', () => {
        const lines: string[] = [];
        const undecided: string[] = [];
        for (const r of routes) {
            const refused = partnerEventWrite(r.method, r.url);
            const kept = PARTNER_KEPT[r.key];
            lines.push(`${r.key} → ${refused ? 'refusée (403 PARTNER_SUSPENDED)' : kept ? `gardée : ${kept}` : 'SANS DÉCISION'}`);
            if (!refused && !kept) undecided.push(r.key);
            if (refused && kept) undecided.push(`${r.key} : refusée ET listée comme gardée`);
        }
        console.log(`[F2ACV-T1] /api/partner/* : ${routes.length} écritures\n${lines.join('\n')}`);
        assert.deepEqual(undecided, [], `écritures /api/partner/* sans décision pour une fiche SUSPENDU :\n${undecided.join('\n')}`);
        const unknown = Object.keys(PARTNER_KEPT).filter((k) => !routes.some((r) => r.key === k));
        assert.deepEqual(unknown, [], 'écritures listées comme gardées mais absentes du disque');
    });

    test('équipe (/api/partner/team/*) et caisses (/api/partner/shifts/*) : toute écriture refusée', () => {
        const team = routes.filter((r) => r.pattern.startsWith('/api/partner/team') || r.pattern.startsWith('/api/partner/shifts'));
        assert.ok(team.length >= 13, `précondition : écritures de l'équipe et des caisses trouvées (${team.length})`);
        const passing = team.filter((r) => !partnerEventWrite(r.method, r.url)).map((r) => r.key);
        assert.deepEqual(passing, [], `écritures de l'équipe ou des caisses permises à une fiche SUSPENDU :\n${passing.join('\n')}`);
    });

    test('lectures : jamais refusées (GET), export des participants en POST gardé', () => {
        assert.equal(partnerEventWrite('GET', '/api/partner/team'), false);
        assert.equal(partnerEventWrite('GET', `/api/partner/team/${SAMPLE_UUID}`), false);
        assert.equal(partnerEventWrite('POST', `/api/partner/events/${SAMPLE_UUID}/participants-export`), false);
    });
});

describe('b. /api/controller/* : la propriétaire d’un événement à fiche non VALIDE, refusée ou décision écrite', () => {
    test('inventaire complet ; incidents de scan refusés comme le scan', () => {
        const routes = writeRoutes('controller');
        const lines: string[] = [];
        const undecided: string[] = [];
        for (const r of routes) {
            const guarded = r.source.includes('ownEventFicheRefusal(');
            const kept = CONTROLLER_KEPT[r.key];
            lines.push(`${r.key} → ${guarded ? 'propriétaire à fiche non VALIDE refusée (ownEventFicheRefusal)' : kept ? `gardée : ${kept}` : 'SANS DÉCISION'}`);
            if (!guarded && !kept) undecided.push(r.key);
            if (guarded && kept) undecided.push(`${r.key} : gardée par la route ET listée comme gardée sans garde`);
        }
        console.log(`[F2ACV-T1] /api/controller/* : ${routes.length} écritures\n${lines.join('\n')}`);
        assert.deepEqual(undecided, [], `écritures /api/controller/* sans décision :\n${undecided.join('\n')}`);
        assert.ok(routes.some((r) => r.key === 'POST /api/controller/scan/incidents' && r.source.includes('ownEventFicheRefusal(')),
            'incidents de scan : la propriétaire à fiche non VALIDE n’est pas refusée');
    });
});

describe('c. équipe : aucune écriture directe dans event_controllers ni controller_invitations', () => {
    test('routes et modules de /api/partner/team : chaque écriture passe par une fonction de la base', () => {
        const dir = path.join(ROOT, 'app', 'api', 'partner', 'team');
        const direct: string[] = [];
        const walk = (d: string) => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, e.name);
                if (e.isDirectory()) walk(full);
                else if (e.name.endsWith('.ts')) {
                    const src = fs.readFileSync(full, 'utf8');
                    const re = /from\(\s*['"`](event_controllers|controller_invitations)['"`]\s*\)([\s\S]{0,400}?)\.(insert|update|upsert|delete)\s*\(/g;
                    for (const m of src.matchAll(re)) {
                        if (/\.select\(|\.from\(/.test(m[2])) continue; // lecture : une autre requête commence avant l'écriture
                        direct.push(`${path.relative(ROOT, full).split(path.sep).join('/')} : ${m[1]}.${m[3]}`);
                    }
                }
            }
        };
        walk(dir);
        console.log(`[F2ACV-T1] écritures directes de l'équipe : ${direct.length ? direct.join(' ; ') : 'aucune'}`);
        assert.deepEqual(direct, [], `écritures directes dans l'équipe (sans la fonction qui contrôle la fiche) :\n${direct.join('\n')}`);
    });
});
