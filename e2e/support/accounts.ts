/**
 * Lot 5.1 — comptes utilisés par Playwright et leur état de connexion (storageState dans `.auth/`).
 *  - comptes de démonstration (seed:demo) : captures d'écran ;
 *  - comptes du seed de test (seed:test) : test de fumée, indépendant des données de démonstration ;
 *    lot 7 (D80) : second client et contrôleur A, pour le projet terrain et la fumée prolongée.
 * Le mot de passe vient des constantes de fixtures (aucun mot de passe littéral, cf.
 * tests/schema/secrets-codes-en-dur.test.ts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { FIXTURE_USERS, TEST_PASSWORD } from '../../tests/helpers/fixture-data';
import { readDemoIds, type DemoAccountKey } from './demo-ids';

export { TEST_PASSWORD };

export const AUTH_DIR = path.resolve(process.cwd(), '.auth');

export type RoleKey =
    | 'organisateur' | 'admin' | 'client' | 'controleur'
    | 'fumee-organisateur' | 'fumee-superadmin' | 'fumee-client'
    | 'fumee-client-bis' | 'fumee-controleur';

export interface RoleSpec {
    key: RoleKey;
    libelle: string;
    source: 'demonstration' | 'fixtures';
    /** Page d'arrivée attendue après la connexion (redirection par rôle). */
    arrivee: RegExp;
    email: () => string;
}

function demoEmail(key: DemoAccountKey): () => string {
    return () => readDemoIds().accounts[key].email;
}

export const ROLES: readonly RoleSpec[] = [
    { key: 'organisateur', libelle: 'organisateur (démonstration)', source: 'demonstration', arrivee: /\/partner(\/|$)/, email: demoEmail('organisateur') },
    { key: 'admin', libelle: 'administrateur (démonstration, events.read et events.write)', source: 'demonstration', arrivee: /\/admin(\/|$)/, email: demoEmail('admin') },
    { key: 'client', libelle: 'client (démonstration)', source: 'demonstration', arrivee: /^\/$/, email: demoEmail('client') },
    { key: 'controleur', libelle: 'contrôleur (démonstration)', source: 'demonstration', arrivee: /\/controller\/scanner/, email: demoEmail('controleur') },
    { key: 'fumee-organisateur', libelle: 'organisateur A (seed de test)', source: 'fixtures', arrivee: /\/partner(\/|$)/, email: () => FIXTURE_USERS.PARTNER_A.email },
    { key: 'fumee-superadmin', libelle: 'superadmin (seed de test)', source: 'fixtures', arrivee: /\/admin(\/|$)/, email: () => FIXTURE_USERS.SUPERADMIN.email },
    { key: 'fumee-client', libelle: 'client (seed de test)', source: 'fixtures', arrivee: /^\/$/, email: () => FIXTURE_USERS.CLIENT.email },
    // Lot 7 (décision D80) : destinataire du transfert de la fumée prolongée et porteur des billets mesurés du
    // projet terrain (CLIENT_BIS) ; contrôleur des projets terrain et de la fumée prolongée (CONTROLLER_A).
    { key: 'fumee-client-bis', libelle: 'second client (seed de test)', source: 'fixtures', arrivee: /^\/$/, email: () => FIXTURE_USERS.CLIENT_BIS.email },
    { key: 'fumee-controleur', libelle: 'contrôleur A (seed de test)', source: 'fixtures', arrivee: /\/controller\/scanner/, email: () => FIXTURE_USERS.CONTROLLER_A.email },
];

export function roleSpec(key: RoleKey): RoleSpec {
    const spec = ROLES.find((r) => r.key === key);
    if (!spec) throw new Error(`[e2e] rôle inconnu : ${key}`);
    return spec;
}

export function storageStatePath(key: RoleKey): string {
    return path.join(AUTH_DIR, `${key}.json`);
}

/** Chemin de l'état de connexion ; erreur explicite si la connexion du rôle n'a pas abouti. */
export function requireStorageState(key: RoleKey): string {
    const file = storageStatePath(key);
    if (!fs.existsSync(file)) {
        throw new Error(
            `[e2e] état de connexion absent pour le rôle « ${roleSpec(key).libelle} » (${path.relative(process.cwd(), file)}) : ` +
            'la phase de connexion (e2e/auth.setup.ts) a échoué pour ce rôle.',
        );
    }
    return file;
}

/** Numéro de paiement (9 chiffres SamirPay) du client de la fumée : son numéro de compte du seed de test. */
export function fumeePayerPhone(): string {
    return FIXTURE_USERS.CLIENT.phone.replace(/^\+221/, '');
}
