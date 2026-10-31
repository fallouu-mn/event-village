/**
 * Promotion du premier SUPERADMIN (procédure d'exploitation, service_role).
 *
 * Usage (variables d'environnement du projet ciblé chargées dans le shell) :
 *   npx tsx scripts/bootstrap-superadmin.ts --phone +221773780756 --operator "Prénom Nom"
 *   npx tsx scripts/bootstrap-superadmin.ts --email admin@exemple.sn --operator "Prénom Nom"
 *   … --allow-existing   (uniquement si un SUPERADMIN existe déjà et qu'il faut en ajouter un)
 *
 * Le compte doit exister (inscription normale). Voir docs/deploiement-projet-neuf.md.
 */
import { bootstrapSuperadmin } from '../lib/admin/bootstrap-superadmin';

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
    const email = arg('email');
    const phone = arg('phone');
    const operator = arg('operator');
    if ((!email && !phone) || !operator) {
        console.error('Usage : npx tsx scripts/bootstrap-superadmin.ts (--email <email> | --phone <téléphone>) --operator "<nom>" [--allow-existing]');
        process.exit(2);
    }
    const target = process.env.NEXT_PUBLIC_SUPABASE_URL || '<NEXT_PUBLIC_SUPABASE_URL absente>';
    console.log(`Projet ciblé : ${target}`);
    const result = await bootstrapSuperadmin({
        email,
        phone,
        operator,
        allowWhenSuperadminExists: process.argv.includes('--allow-existing'),
    });
    console.log(`SUPERADMIN attribué : ${result.userId} (${result.email ?? result.phone ?? 'sans contact'})`);
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
