/**
 * Lot 8 (8.1, L23, contrat 5.2) — npm run seed:dev : comptes et données de démonstration sur le projet d'essai
 * manuel. Jamais sur l'instance des tests, qui a ses propres seeds : ce script n'importe pas leur environnement.
 *
 * Gardes, dans l'ordre : NODE_ENV absent ou development, terminal interactif, projet hébergé et identique au
 * shell, EV_DEV_PROJECT_REF, EV_INTEGRATIONS=fake, mot de passe EV_DEV_SEED_PASSWORD, schéma à jour (réseau),
 * nombre de comptes réels (réseau), confirmation tapée. Détail et données : scripts/dev/seed-dev.core.ts.
 */
import readline from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';
import { loadLocalEnv } from './env-local.mjs';
import {
    assertAccountLimit, assertSchemaReady, assertSeedAllowed, assertSeedPreconditions, countRealAccounts, listAuthUsers, runSeedDev, seedPassword,
} from './seed-dev.core';

async function askConfirmation(ref: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        return (await rl.question(`Pour confirmer, retapez la référence du projet (${ref}) : `)).trim();
    } finally {
        rl.close();
    }
}

async function main(): Promise<void> {
    const { fileEnv, shellEnv } = loadLocalEnv({ cwd: process.cwd() });
    const preconditions = {
        nodeEnv: process.env.NODE_ENV,
        isTty: Boolean(process.stdin.isTTY && process.stdout.isTTY),
        fileEnv,
        shellEnv,
    };
    const target = assertSeedPreconditions(preconditions);

    const client = createClient(target.url, target.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await assertSchemaReady(client);
    const realAccounts = countRealAccounts(await listAuthUsers(client));
    assertAccountLimit(realAccounts);

    console.log(`Projet ciblé (.env.local) : ${target.url}`);
    console.log(`Comptes réels trouvés : ${realAccounts}`);
    assertSeedAllowed({ ...preconditions, realAccounts, confirmation: await askConfirmation(target.ref) });

    const report = await runSeedDev(client, { password: seedPassword({ fileEnv, shellEnv }) });
    console.log(`Créés : ${report.created.length > 0 ? report.created.join(', ') : 'rien'}`);
    console.log(`Déjà présents, inchangés : ${report.kept.length > 0 ? report.kept.join(', ') : 'rien'}`);
    console.log('Comptes (mot de passe : EV_DEV_SEED_PASSWORD) :');
    for (const account of report.accounts) console.log(`  ${account.role.padEnd(10)} ${account.email}`);
}

main().catch((err: unknown) => {
    console.error(`[seed:dev] refus : ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
});
