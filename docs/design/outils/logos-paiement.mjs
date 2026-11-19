#!/usr/bin/env node
/**
 * Design 1c (point 5) — logos de paiement optimisés pour l'application.
 *
 * Sources : docs/design/paiement/wave.png (813 × 814, 465 Ko) et om.png (600 × 600, 15 Ko), fournies par le client.
 * Les logos ne sont JAMAIS modifiés : ni recadrage, ni couleur, ni retouche ; seulement mis à 128 × 128 px (contenu entier,
 * proportions gardées, fond transparent ajouté au besoin) et réencodés en WebP sans perte visible.
 * Sortie : public/images/paiement/wave.webp et om.webp (affichés à 64 px au plus, écran ×2).
 *
 *   node docs/design/outils/logos-paiement.mjs
 */
import { createRequire } from 'node:module';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const SIZE = 128;
for (const name of ['wave', 'om']) {
    const src = join('docs', 'design', 'paiement', `${name}.png`);
    const dst = join('public', 'images', 'paiement', `${name}.webp`);
    await sharp(src)
        .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
        .webp({ quality: 92, alphaQuality: 100, effort: 6, smartSubsample: true })
        .toFile(dst);
    console.log(`${dst} : ${statSync(dst).size} octets (source ${statSync(src).size} octets)`);
}
