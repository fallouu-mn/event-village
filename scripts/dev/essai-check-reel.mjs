#!/usr/bin/env node
/**
 * Lot 9 bis, tâche I2 (contrat 4.7, 5.64, B109) — npm run essai:check-reel : contrôle avant le passage en réel.
 *
 * Lit `.env.local` du dossier de travail (scripts/dev/env-local.mjs, aucune valeur affichée), puis fait UN SEUL appel
 * en lecture : la RPC STABLE public.essai_check_reel, avec la clé service_role. Rien n'est écrit, nulle part.
 * Liste ce qui ferait partir de vrais messages ou de l'argent vers des comptes de démonstration : notifications en
 * file, paiements simulés en attente, versements simulés en cours, billets de démonstration sur des événements à venir.
 *
 * Sortie : 0 rien à signaler ; 1 au moins un point à traiter ; 2 contrôle impossible (refus, variable absente,
 * fonction absente, réponse illisible, réseau).
 */
import {
    EXIT_IMPOSSIBLE, MISSING_FUNCTION_TEXT, RPC_PATH, TAG, projectLine, readReply, report, resolveCheckTarget,
} from './essai-check-reel.core.mjs';
import { loadLocalEnv } from './env-local.mjs';

const TIMEOUT_MS = 15_000;

function impossible(message) {
    console.error(`${TAG} contrôle impossible : ${message}`);
    process.exitCode = EXIT_IMPOSSIBLE;
}

/** Code d'une erreur réseau de fetch (ECONNREFUSED…), jamais son message entier. */
function networkCode(err) {
    const cause = err instanceof Error ? err.cause : undefined;
    if (err instanceof Error && err.name === 'TimeoutError') return 'délai dépassé';
    return cause?.code ?? cause?.errors?.[0]?.code ?? 'erreur réseau';
}

async function main() {
    let target;
    try {
        loadLocalEnv({ required: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] });
        target = resolveCheckTarget(process.env);
    } catch (err) {
        impossible(err instanceof Error ? err.message : String(err));
        return;
    }
    console.log(projectLine(target.label));

    let status;
    let body;
    try {
        const res = await fetch(`${target.url}${RPC_PATH}`, {
            method: 'POST',
            headers: {
                apikey: target.key,
                Authorization: `Bearer ${target.key}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ p: {} }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        status = res.status;
        body = await res.text();
    } catch (err) {
        impossible(`connexion impossible à NEXT_PUBLIC_SUPABASE_URL (${networkCode(err)}).`);
        return;
    }

    const read = readReply(status, body);
    if (read.kind === 'missing') {
        console.error(MISSING_FUNCTION_TEXT);
        process.exitCode = EXIT_IMPOSSIBLE;
        return;
    }
    if (read.kind === 'error') {
        impossible(read.message);
        return;
    }
    const { lines, code } = report(read.reply);
    for (const line of lines) console.log(line);
    process.exitCode = code;
}

main().catch((err) => {
    impossible(err instanceof Error ? err.message : String(err));
});
