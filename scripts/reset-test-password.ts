/**
 * Lot 2.0 — changement du mot de passe d'un compte (le superadmin) du PROJET DE TEST distant,
 * celui de .env.local et lui seul. Le mot de passe de ce compte figure dans l'historique Git
 * public (rapport du lot 1C, section 4) : il doit être remplacé.
 *
 * À lancer par l'exploitant, dans un terminal interactif :
 *   npx tsx scripts/reset-test-password.ts [--email <adresse du compte>]
 *
 * - Le mot de passe se saisit au clavier, masqué, deux fois. Jamais en argument, jamais lu depuis
 *   un fichier, un tube ou une variable d'environnement : le script refuse de démarrer hors
 *   terminal interactif.
 * - Le projet ciblé est lu dans .env.local uniquement (les variables du shell ne peuvent pas le
 *   rediriger) ; sa référence doit être retapée pour confirmer.
 * - Après le changement, toutes les sessions du compte sont révoquées (signOut global avec un
 *   jeton obtenu par le nouveau mot de passe).
 * - Journal : .logs/reset-test-password.log (ignoré par Git), une ligne JSON par exécution, sans
 *   mot de passe, email masqué.
 *
 * Ce script n'est exécuté ni par les tests ni par la CI.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildJournalEntry, checkPasswordStrength, maskEmail, parseArgs, parseEnvFile, resolveTargetProject } from './reset-test-password.core';

const ROOT = path.resolve(__dirname, '..');
const JOURNAL = path.join(ROOT, '.logs', 'reset-test-password.log');

function writeJournal(line: string): void {
    fs.mkdirSync(path.dirname(JOURNAL), { recursive: true });
    fs.appendFileSync(JOURNAL, `${line}\n`, { encoding: 'utf8', mode: 0o600 });
    console.log(`Journal : ${JOURNAL}`);
}

/** Saisie masquée (rien n'est affiché), terminée par Entrée ; Ctrl+C interrompt. */
function readHidden(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const stdin = process.stdin;
        let value = '';
        const cleanup = () => {
            stdin.removeListener('data', onData);
            stdin.setRawMode(false);
            stdin.pause();
        };
        const onData = (chunk: string) => {
            for (const ch of chunk) {
                if (ch === '\r' || ch === '\n') {
                    cleanup();
                    process.stdout.write('\n');
                    resolve(value);
                    return;
                }
                if (ch === '\u0003') {
                    cleanup();
                    process.stdout.write('\n');
                    reject(new Error('Interrompu par l’exploitant.'));
                    return;
                }
                if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
                else value += ch;
            }
        };
        process.stdout.write(prompt);
        stdin.setEncoding('utf8');
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on('data', onData);
    });
}

async function findUserIdByEmail(authAdmin: SupabaseClient['auth']['admin'], email: string): Promise<string | null> {
    for (let page = 1; ; page++) {
        const { data, error } = await authAdmin.listUsers({ page, perPage: 200 });
        if (error) throw new Error(`Lecture des comptes impossible : ${error.message}`);
        const hit = data.users.find((u) => (u.email || '').toLowerCase() === email);
        if (hit) return hit.id;
        if (data.users.length < 200) return null;
    }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error('Terminal interactif requis : le mot de passe se saisit au clavier (aucune lecture depuis un tube ou un fichier).');
    }
    const envPath = path.join(ROOT, '.env.local');
    if (!fs.existsSync(envPath)) throw new Error(`.env.local introuvable (${envPath}).`);
    const target = resolveTargetProject(parseEnvFile(fs.readFileSync(envPath, 'utf8')), process.env);
    const operator = os.userInfo().username;

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    let email = args.email;
    let confirmRef = '';
    try {
        console.log(`Projet ciblé (.env.local) : ${target.url}`);
        if (!email) email = (await rl.question('Email du compte à modifier : ')).trim().toLowerCase();
        confirmRef = (await rl.question(`Pour confirmer, retapez la référence du projet (${target.ref}) : `)).trim();
    } finally {
        rl.close();
    }
    if (!email || !email.includes('@')) throw new Error('Email invalide.');
    if (confirmRef !== target.ref) {
        writeJournal(buildJournalEntry({ projectRef: target.ref, userId: null, email, outcome: 'ABORTED', sessionsRevoked: false, operator, detail: 'référence du projet non confirmée' }));
        throw new Error('Référence du projet non confirmée : aucune modification.');
    }

    const admin = createClient(target.url, target.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const userId = await findUserIdByEmail(admin.auth.admin, email);
    if (!userId) {
        writeJournal(buildJournalEntry({ projectRef: target.ref, userId: null, email, outcome: 'ABORTED', sessionsRevoked: false, operator, detail: 'compte introuvable' }));
        throw new Error(`Aucun compte ${maskEmail(email)} dans ce projet.`);
    }
    console.log(`Compte trouvé : ${userId} (${maskEmail(email)})`);

    const first = await readHidden('Nouveau mot de passe (masqué) : ');
    const problems = checkPasswordStrength(first);
    if (problems.length) throw new Error(`Mot de passe refusé : ${problems.join(', ')}.`);
    const second = await readHidden('Confirmez le mot de passe : ');
    if (first !== second) throw new Error('Les deux saisies diffèrent : aucune modification.');

    // Lot 9 quater (A3) : la base refuse tout changement de mot de passe sans permis à usage unique (60 s) posé juste avant
    const { data: permit, error: permitErr } = await admin.rpc('auth_write_permit_grant', { p: { user_id: userId, kind: 'PASSWORD' } });
    if (permitErr || (permit as { ok?: boolean } | null)?.ok !== true) {
        const detail = permitErr?.message ?? JSON.stringify(permit);
        writeJournal(buildJournalEntry({ projectRef: target.ref, userId, email, outcome: 'FAILED', sessionsRevoked: false, operator, detail: `permis refusé : ${detail}` }));
        throw new Error(`Permis de changement de mot de passe refusé (migration 20261111000001 appliquée ?) : ${detail}`);
    }
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, { password: first });
    if (updErr) {
        writeJournal(buildJournalEntry({ projectRef: target.ref, userId, email, outcome: 'FAILED', sessionsRevoked: false, operator, detail: updErr.message }));
        throw new Error(`Changement refusé par Supabase : ${updErr.message}`);
    }

    // Révocation de toutes les sessions : jeton obtenu avec le nouveau mot de passe, puis signOut global.
    let sessionsRevoked = false;
    let revokeDetail: string | undefined;
    const anon = createClient(target.url, target.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signIn, error: signErr } = await anon.auth.signInWithPassword({ email, password: first });
    if (signErr || !signIn.session) {
        revokeDetail = `connexion pour la révocation impossible : ${signErr?.message ?? 'aucune session'}`;
    } else {
        const { error: outErr } = await admin.auth.admin.signOut(signIn.session.access_token, 'global');
        if (outErr) revokeDetail = `révocation des sessions refusée : ${outErr.message}`;
        else sessionsRevoked = true;
    }
    writeJournal(buildJournalEntry({ projectRef: target.ref, userId, email, outcome: 'PASSWORD_CHANGED', sessionsRevoked, operator, detail: revokeDetail }));
    console.log('Mot de passe changé.');
    if (!sessionsRevoked) console.error(`ATTENTION : ${revokeDetail}. Révoquez les sessions depuis le tableau de bord Supabase.`);
}

main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
});
