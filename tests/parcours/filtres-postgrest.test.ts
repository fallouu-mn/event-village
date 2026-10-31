/**
 * Lot 1C.1 — filtres PostgREST construits par interpolation.
 *
 * postgrest-js insère tel quel le texte passé à .or() : une valeur externe interpolée peut y
 * ajouter des conditions (virgule, parenthèses, guillemets). Règle : dans un .or(`…`), toute
 * interpolation passe par un assainisseur de lib/security/postgrest-filter.ts (nom en pg…),
 * sauf les deux appels du paiement, listés pour le lot 2.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { bearer, signInAs } from '../helpers/fixtures';
import { GET as adminListUsers } from '../../app/api/admin/users/route';
import { BASE_URL } from './helpers';

/** Lot 2 : D1 et D2 (route de statut, webhook) corrigés par des .eq() séparés ; plus aucune exemption. */
const LOT2_ALLOWED = new Set<string>();

function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (p: string) => {
        const st = fs.statSync(p);
        if (st.isDirectory()) {
            for (const e of fs.readdirSync(p)) if (e !== 'node_modules') walk(path.join(p, e));
        } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(p)) out.push(p);
    };
    for (const d of ['app', 'lib', 'components', 'hooks', 'scripts', 'middleware.ts']) {
        if (fs.existsSync(d)) walk(d);
    }
    return out;
}

describe('Filtres PostgREST construits par interpolation', () => {
    test('aucune interpolation brute dans un .or() / .filter() hors paiement (lot 2)', () => {
        const offenders: string[] = [];
        for (const f of sourceFiles()) {
            const rel = f.replace(/\\/g, '/');
            const src = fs.readFileSync(f, 'utf8');
            for (const m of Array.from(src.matchAll(/\.(or|filter)\(\s*`([\s\S]*?)`/g))) {
                const interpolations = Array.from(m[2].matchAll(/\$\{([\s\S]*?)\}/g)).map((x) => x[1].trim());
                const unsafe = interpolations.filter((expr) => !/^pg[A-Z]\w*\(/.test(expr));
                if (unsafe.length && !LOT2_ALLOWED.has(rel)) {
                    const line = src.slice(0, m.index).split('\n').length;
                    offenders.push(`${rel}:${line} .${m[1]}(… ${unsafe.map((u) => '${' + u + '}').join(' ')} …)`);
                }
            }
        }
        assert.deepEqual(offenders, [], `interpolations non assainies :\n${offenders.join('\n')}`);
    });

    test('recherche admin : une virgule dans « search » n’ajoute pas de condition au filtre', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const injected = 'zzqxjv%,id.not.is.null';
        const res = await adminListUsers(new NextRequest(`${BASE_URL}/api/admin/users?search=${encodeURIComponent(injected)}`, {
            method: 'GET', headers: bearer(superadmin.accessToken),
        }));
        const body = await res.json();
        assert.equal(res.status, 200, `HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
        const users: unknown[] = body.users ?? body.data ?? [];
        assert.equal(users.length, 0, `la recherche « ${injected} » ne correspond à aucun compte ; obtenu ${users.length} comptes (filtre injecté)`);
    });
});
