/**
 * Lot poids — chargeur webpack de components/ui/cn-classes.ts : remplace le fichier (vide dans le dépôt) par la table des
 * classes du projet calculée par scripts/cn-classes.mjs, pour toutes les constructions (navigateur, serveur, développement) :
 * le serveur et le navigateur fusionnent les classes avec la même table (aucun écart à l'hydratation).
 *
 * En développement, tout changement dans app/, components/, lib/ ou hooks/ recalcule la table (dépendances de dossier) : une
 * classe ajoutée est connue de la fusion sans relancer le serveur.
 */
const path = require('node:path');
const { pathToFileURL } = require('node:url');

module.exports = function cnClassesLoader() {
    const done = this.async();
    const root = this.rootContext || process.cwd();
    const generateur = pathToFileURL(path.join(__dirname, 'cn-classes.mjs')).href;
    import(generateur)
        .then((m) => {
            for (const d of m.DOSSIERS) this.addContextDependency(path.join(root, d));
            done(null, m.sourceModule(root));
        })
        .catch((err) => done(err));
};
