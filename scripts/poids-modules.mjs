/**
 * Lot poids — relevé des modules de chaque morceau JavaScript du navigateur (diagnostic, aucun verdict).
 *
 * Actif seulement si EV_ANALYSE_POIDS=1 (job « perf » de la CI) : next.config.mjs ajoute alors ce greffon à la
 * construction du navigateur (ni serveur, ni développement). Il n'ajoute ni ne modifie aucun fichier servi : il lit
 * le graphe des morceaux après l'écriture et écrit `.verify/poids-modules.tsv` :
 *   morceau (identifiant webpack) · fichiers .js du morceau · module (chemin lisible, sans chargeurs) · octets du source
 * Les modules concaténés (« scope hoisting ») sont détaillés un par un. Les octets sont ceux du source AVANT
 * minification : ils servent à classer, pas à mesurer (la mesure reste scripts/js-budget.mjs, gzip des fichiers).
 *
 * Exploitation : node scripts/poids-rapport.mjs (somme par paquet et par fichier pour les morceaux du premier chargement).
 */
import fs from 'node:fs';
import path from 'node:path';

function lisible(mod, shortener) {
    let id = '';
    try {
        id = mod.readableIdentifier(shortener);
    } catch {
        id = String(mod.identifier?.() ?? '?');
    }
    // Chargeurs retirés (« …loader.js?options!./components/x.tsx » → « ./components/x.tsx »), requête bornée
    const dernier = id.lastIndexOf('!');
    if (dernier >= 0) id = id.slice(dernier + 1);
    id = id.replace(/\s+/g, ' ');
    return id.length > 240 ? `${id.slice(0, 240)}…` : id;
}

export class PoidsModulesPlugin {
    constructor(out) {
        this.out = out;
    }

    apply(compiler) {
        compiler.hooks.afterEmit.tap('PoidsModulesPlugin', (compilation) => {
            const { chunkGraph, requestShortener } = compilation;
            const lignes = ['morceau\tfichiers\tmodule\toctets_source'];
            for (const chunk of compilation.chunks) {
                const fichiers = [...chunk.files].filter((f) => f.endsWith('.js')).sort().join(',');
                const id = chunk.id ?? chunk.name ?? '?';
                for (const mod of chunkGraph.getChunkModulesIterable(chunk)) {
                    const internes = mod.modules ? [...mod.modules] : [mod];
                    for (const m of internes) {
                        let taille = 0;
                        try {
                            taille = m.size();
                        } catch {
                            taille = 0;
                        }
                        lignes.push(`${id}\t${fichiers}\t${lisible(m, requestShortener)}\t${taille}`);
                    }
                }
            }
            fs.mkdirSync(path.dirname(this.out), { recursive: true });
            fs.writeFileSync(this.out, `${lignes.join('\n')}\n`, 'utf8');
            console.log(`[POIDS] relevé des modules : ${lignes.length - 1} ligne(s) → ${this.out}`);
        });
    }
}
