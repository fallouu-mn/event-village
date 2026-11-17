// Event Village — design phase 0 : captures du logo et des maquettes.
// 390 px (densité 2) et 1440 px (densité 1), thème clair (boutons B) et sombre (boutons A) → docs/design/captures/*.jpg.
//
// Lancer depuis la racine du dépôt (Playwright et sharp d'une copie du dépôt où « npm ci » a été fait) :
//   DEPENDANCES=<chemin vers un node_modules contenant playwright et sharp> node docs/design/outils/captures.mjs [page…]
// Les pages « écran » (carte) sont prises à la taille de l'écran ; les autres en entier, fenêtre agrandie à la
// hauteur de la page pour que les barres fixes (navigation, achat) tombent en bas de l'image.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dep = process.env.DEPENDANCES;
if (!dep) throw new Error('DEPENDANCES manquant : dossier node_modules contenant playwright et sharp.');
const req = createRequire(join(dep, 'x.js'));
const { chromium } = req('playwright');
const sharp = req('sharp');

const PAGES = [
    { nom: 'logo', fichier: 'docs/design/logo/index.html' },
    { nom: 'accueil', fichier: 'docs/design/maquettes/accueil.html' },
    { nom: 'fiche', fichier: 'docs/design/maquettes/fiche.html' },
    { nom: 'fiche-panier', fichier: 'docs/design/maquettes/fiche.html', requete: 'panier=2' },
    { nom: 'carte', fichier: 'docs/design/maquettes/carte.html', ecran: true },
    { nom: 'toasts', fichier: 'docs/design/maquettes/toasts.html' },
];
const LARGEURS = [{ l: 390, h: 844, d: 2 }, { l: 1440, h: 900, d: 1 }];
const THEMES = ['clair', 'sombre'];

const choix = process.argv.slice(2);
const sortie = join(racine, 'docs/design/captures');
mkdirSync(sortie, { recursive: true });

const navigateur = await chromium.launch();
let n = 0;
for (const p of PAGES.filter((x) => choix.length === 0 || choix.includes(x.nom))) {
    for (const v of LARGEURS) {
        for (const theme of THEMES) {
                const page = await navigateur.newPage({ viewport: { width: v.l, height: v.h }, deviceScaleFactor: v.d, reducedMotion: 'reduce' });
                const url = `${pathToFileURL(join(racine, p.fichier)).href}?theme=${theme}&capture=1${p.requete ? `&${p.requete}` : ''}`;
                await page.goto(url, { waitUntil: 'load' });
                await page.evaluate(() => document.fonts.ready);
                if (!p.ecran) {
                    const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
                    await page.setViewportSize({ width: v.l, height: Math.min(h, 16000) });
                    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
                }
                await page.waitForTimeout(150);
                const png = await page.screenshot({ fullPage: false });
                const fichier = `${p.nom}__${v.l}__${theme}.jpg`;
                await sharp(png).jpeg({ quality: 72, mozjpeg: true }).toFile(join(sortie, fichier));
                await page.close();
                n += 1;
                console.log(fichier);
        }
    }
}
await navigateur.close();
console.log(`${n} captures dans ${sortie}`);
