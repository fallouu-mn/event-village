/**
 * Lot 1A.7 — validation des scripts de hotfix sur la base LOCALE (jamais le projet distant) :
 *  - 01-detection.sql s'exécute en lecture seule et renvoie les colonnes attendues ;
 *  - sa section A classe chaque rôle élevé réclamé (ALERTE / A_VERIFIER / INFO) d'après
 *    user_roles et la trace serveur, sur des comptes synthétiques (transaction annulée) ;
 *  - 02-hotfix.sql s'applique deux fois de suite sans erreur (idempotence), dans une
 *    transaction annulée depuis le lot 1B (il fige l'état du lot 1A) ;
 *  - 03-verification.sql ne renvoie que des OK sur une base migrée.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { inRolledBackTransaction, inspect } from '../helpers/db';

const DIR = path.resolve(process.cwd(), 'supabase/hotfix/2026-10-31-lot1a');
const read = (f: string) => fs.readFileSync(path.join(DIR, f), 'utf8');

describe('Scripts de hotfix du lot 1A', () => {
    test('01-detection.sql : exécution en lecture seule', async () => {
        const res = await inspect((c) => c.query(read('01-detection.sql')));
        const rows = Array.isArray(res) ? res[res.length - 1].rows : res.rows;
        const fields = (Array.isArray(res) ? res[res.length - 1].fields : res.fields).map((f: { name: string }) => f.name);
        assert.deepEqual(fields, ['controle', 'gravite', 'objet_id', 'cree_le', 'details']);
        const byControl: Record<string, number> = {};
        for (const r of rows) byControl[`${r.controle} [${r.gravite}]`] = (byControl[`${r.controle} [${r.gravite}]`] || 0) + 1;
        console.log('Détection sur la base locale de test :', JSON.stringify(byControl, null, 1));
        assert.ok(rows.some((r: { controle: string }) => r.controle === 'H_inventaire_comptes'), 'inventaire des comptes présent');
    });

    test('02-hotfix.sql : appliqué deux fois sans erreur (idempotent)', async () => {
        // Lot 1B : le script fige l'état du lot 1A. Appliqué pour de bon sur la base partagée, il
        // rétablissait users_select_policy avec is_controller() (supprimée par la migration 1B.3)
        // pour toutes les suites suivantes. Il est désormais appliqué deux fois dans une
        // transaction annulée : l'idempotence reste prouvée, la base n'est pas modifiée.
        const body = read('02-hotfix.sql');
        const lines = body.split(/\r?\n/);
        const begin = lines.findIndex((l) => /^\s*BEGIN\s*;\s*$/i.test(l));
        const commit = lines.map((l) => /^\s*COMMIT\s*;\s*$/i.test(l)).lastIndexOf(true);
        assert.ok(begin >= 0 && commit > begin, '02-hotfix.sql doit être encadré par BEGIN; … COMMIT;');
        const inner = lines.slice(begin + 1, commit).join('\n');
        await inRolledBackTransaction(async (c) => {
            await c.query(inner);
            await c.query(inner);
        });
    });

    test('01-detection.sql section A : gravité par rôle réclamé, selon user_roles et la trace serveur', async () => {
        // Comptes synthétiques créés dans une transaction annulée. L'UPDATE des métadonnées
        // reproduit ce que fait GoTrue après les triggers d'insertion : il réécrit
        // raw_user_meta_data avec les données envoyées au signUp.
        const ids = {
            bootstrap: crypto.randomUUID(), // SUPERADMIN via bootstrap serveur : rôles recopiés par le trigger, « role » = CLIENT
            forged: crypto.randomUUID(), // ADMIN réclamé à l'inscription et détenu, sans trace serveur
            attempt: crypto.randomUUID(), // SUPERADMIN réclamé, jamais détenu
            adminCreated: crypto.randomUUID(), // CONTROLEUR créé par l'API admin, sans affectation
        };
        const rows = await inRolledBackTransaction(async (c) => {
            for (const [label, id] of Object.entries(ids)) {
                await c.query(
                    `INSERT INTO auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
                     VALUES ($1, 'authenticated', 'authenticated', $2, '{}'::jsonb, '{}'::jsonb, now(), now())`,
                    [id, `detection-${label}-${id.slice(0, 8)}@test.eventvillage.local`],
                );
            }
            const grant = (id: string, role: string) => c.query('INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)', [id, role]);
            const audit = (id: string, action: string) =>
                c.query(`INSERT INTO public.audit_logs (action, object_type, object_id) VALUES ($1, 'users', $2)`, [action, id]);
            const signupMetadata = (id: string, meta: object) =>
                c.query('UPDATE auth.users SET raw_user_meta_data = $2::jsonb WHERE id = $1', [id, JSON.stringify(meta)]);

            await grant(ids.bootstrap, 'SUPERADMIN');
            await audit(ids.bootstrap, 'SUPERADMIN_BOOTSTRAP');
            await grant(ids.forged, 'ADMIN');
            await signupMetadata(ids.forged, { role: 'ADMIN' });
            await signupMetadata(ids.attempt, { role: 'SUPERADMIN', roles: ['SUPERADMIN'] });
            await grant(ids.adminCreated, 'CONTROLEUR');
            await audit(ids.adminCreated, 'CREATE_USER');

            const res = await c.query(read('01-detection.sql'));
            const last = Array.isArray(res) ? res[res.length - 1] : res;
            return last.rows as { controle: string; gravite: string; objet_id: string; details: { role_reclame?: string } }[];
        });
        const label = Object.fromEntries(Object.entries(ids).map(([k, v]) => [v, k]));
        const sectionA = rows
            .filter((r) => r.controle === 'A_metadata_role_eleve' && label[r.objet_id])
            .map((r) => `${label[r.objet_id]} ${r.details.role_reclame ?? '(rôle non exposé)'} ${r.gravite}`)
            .sort();
        console.log('Section A sur les comptes synthétiques :', JSON.stringify(sectionA, null, 1));
        assert.deepEqual(sectionA, [
            'adminCreated CONTROLEUR A_VERIFIER',
            'attempt SUPERADMIN INFO',
            'bootstrap SUPERADMIN A_VERIFIER',
            'forged ADMIN ALERTE',
        ]);
    });

    test('03-verification.sql : tous les points OK', async () => {
        const res = await inspect((c) => c.query(read('03-verification.sql')));
        const rows = Array.isArray(res) ? res[res.length - 1].rows : res.rows;
        for (const r of rows) console.log(`${r.statut.padEnd(5)} ${r.point} — ${r.detail}`);
        const failed = rows.filter((r: { statut: string }) => r.statut !== 'OK').map((r: { point: string; detail: string }) => `${r.point} (${r.detail})`);
        assert.ok(rows.length >= 20, `au moins 20 points vérifiés, obtenu ${rows.length}`);
        assert.deepEqual(failed, [], `points en ÉCHEC :\n${failed.join('\n')}`);
    });
});
