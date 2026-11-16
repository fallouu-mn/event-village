/**
 * Correctifs de la contre-vérification de la finition 2a (T5) — réencode une fois les affiches déjà citées par un
 * événement mais déposées avant la finition (fichier tel qu'il a été déposé, métadonnées et position GPS comprises).
 * Procédure d'exploitation (compte de service), après la fusion et les migrations 20261116… ; voir le rapport de la
 * finition 2a, correctifs de la contre-vérification, T5 (contrôle avant et après).
 *
 * Usage (variables d'environnement du projet visé chargées dans le shell, comme scripts/bootstrap-superadmin.ts) :
 *   npx tsx scripts/reencode-posters.ts               à blanc : liste ce qui sera fait, rien n'est écrit
 *   npx tsx scripts/reencode-posters.ts --appliquer   réencode (même dossier, nom de la route), met à jour l'adresse de
 *                                                     chaque événement, efface l'ancien fichier s'il n'est plus cité
 * 50 fichiers au plus par passage : relancer tant que « restants » n'est pas 0. Rejouable : un passage de plus ne trouve
 * plus rien.
 */
import { reencodeLegacyPosters } from '../lib/events/poster-reencode';

async function main(): Promise<void> {
    const apply = process.argv.includes('--appliquer');
    const report = await reencodeLegacyPosters({ apply });
    console.log(apply ? 'Réencodage des affiches d’avant la finition' : 'À blanc : rien n’est écrit (ajoutez --appliquer pour réencoder)');
    console.log(`Affiches d’avant la finition citées par un événement : ${report.candidates}`);
    for (const p of report.planned) console.log(`  serait réencodée : ${p.path} (événements : ${p.events.join(', ')})`);
    for (const d of report.done) {
        console.log(`  réencodée : ${d.from} → ${d.to} (événements : ${d.events.join(', ')}) ; ancien fichier ${d.oldRemoved ? 'effacé' : 'gardé (encore cité ailleurs)'}`);
    }
    for (const s of report.skipped) console.log(`  laissée telle quelle : ${s.path} (${s.reason} ; événements : ${s.events.join(', ')})`);
    console.log(`Restants pour un passage suivant : ${report.remaining}`);
}

main().catch((err: unknown) => {
    console.error('Réencodage des affiches interrompu :', err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
});
