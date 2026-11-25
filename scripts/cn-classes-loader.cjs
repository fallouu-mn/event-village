/**
 * Lot poids — chargeur webpack de components/ui/cn-classes.ts : remplace le fichier du dépôt par la table des classes du
 * projet calculée par scripts/cn-classes.cjs, pour toutes les constructions (navigateur, serveur, développement) : le
 * serveur et le navigateur fusionnent les classes avec la même table (aucun écart à l'hydratation).
 *
 * En développement, tout changement dans app/, components/, lib/ ou hooks/ recalcule la table (dépendances de dossier) : une
 * classe ajoutée est connue de la fusion sans relancer le serveur.
 */
const path = require('node:path');
const generateur = require('./cn-classes.cjs');

module.exports = function cnClassesLoader() {
    const root = this.rootContext || process.cwd();
    for (const d of generateur.DOSSIERS) this.addContextDependency(path.join(root, d));
    return generateur.sourceModule(root);
};
