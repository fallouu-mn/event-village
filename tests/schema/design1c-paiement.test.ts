/**
 * Design 1c (point 5) — logos de paiement Wave et Orange Money.
 *  - sources du client gardées telles quelles (empreintes SHA-256 des PNG reçus) ;
 *  - fichiers servis optimisés : WebP 128 × 128, quelques Ko, et JAMAIS modifiés : chaque pixel reste celui de la source
 *    simplement réduite (écart moyen par canal ≤ 3 sur 255, aucun recadrage ni changement de couleur) ;
 *  - affichés sur l'écran de paiement (fenêtre et suivi) et sur la fiche (« Payer avec »), sur une pastille blanche dans
 *    les deux thèmes (jeton op-logo), image décorative, nom toujours écrit à côté.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const sha256 = (rel: string): string => createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');

const LOGOS = [
    { name: 'wave', sha: 'd95fe0c258cdc512953dac1b3be8ca6c4f12de8b56a74a7704e0098d4cf6c3f3' },
    { name: 'om', sha: 'b6e691a600ae8d7a6f9698774def45e5867c4af8c52f80b593321890507bbbe9' },
];

describe('design 1c — logos de paiement', () => {
    test('sources du client inchangées', () => {
        for (const l of LOGOS) assert.equal(sha256(`docs/design/paiement/${l.name}.png`), l.sha, `${l.name}.png`);
    });

    test('fichiers servis : WebP 128 × 128, moins de 10 Ko chacun', async () => {
        for (const l of LOGOS) {
            const rel = `public/images/paiement/${l.name}.webp`;
            const meta = await sharp(path.join(ROOT, rel)).metadata();
            assert.equal(meta.format, 'webp', rel);
            assert.equal(meta.width, 128, rel);
            assert.equal(meta.height, 128, rel);
            assert.ok(fs.statSync(path.join(ROOT, rel)).size < 10_240, `${rel} : ${fs.statSync(path.join(ROOT, rel)).size} octets`);
        }
    });

    test('logos jamais modifiés : la source réduite, pixel pour pixel (écart moyen ≤ 3 sur 255)', async () => {
        for (const l of LOGOS) {
            const ref = await sharp(path.join(ROOT, `docs/design/paiement/${l.name}.png`))
                .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
                .ensureAlpha().raw().toBuffer();
            const out = await sharp(path.join(ROOT, `public/images/paiement/${l.name}.webp`)).ensureAlpha().raw().toBuffer();
            assert.equal(out.length, ref.length, `${l.name} : même taille de pixels`);
            // Couleurs prémultipliées par l'opacité : un pixel transparent n'a pas de couleur à comparer
            let sum = 0;
            for (let i = 0; i < ref.length; i += 4) {
                for (let c = 0; c < 3; c++) sum += Math.abs((ref[i + c] * ref[i + 3]) / 255 - (out[i + c] * out[i + 3]) / 255);
                sum += Math.abs(ref[i + 3] - out[i + 3]);
            }
            const mean = sum / ref.length;
            assert.ok(mean <= 3, `${l.name} : écart moyen ${mean.toFixed(2)} par canal`);
        }
    });

    test('composant : pastille blanche dans les deux thèmes (jeton op-logo), image décorative', () => {
        const src = read('components/payment/OperatorLogo.tsx');
        assert.match(src, /WAVE: '\/images\/paiement\/wave\.webp'/);
        assert.match(src, /ORANGE_MONEY: '\/images\/paiement\/om\.webp'/);
        assert.match(src, /bg-op-logo/);
        assert.match(src, /aria-hidden="true"/);
        assert.match(src, /alt=""/);
        assert.doesNotMatch(src, /#[0-9a-fA-F]{6}/, 'aucune couleur en dur');
        assert.match(read('app/globals.css'), /--op-logo: 255 255 255;/);
        assert.match(read('tailwind.config.ts'), /'op-logo': tone\('op-logo'\)/);
    });

    test('écran de paiement : logo et nom de chaque opérateur', () => {
        const modal = read('components/payment/PaymentModal.tsx');
        assert.match(modal, /<OperatorLogo operator=\{op\} size="md"[^>]*\/>\n\s+<span className="flex min-w-0 flex-col items-start gap-0\.5">\n\s+<span className="[^"]*">\{operatorLabel\(op\)\}<\/span>/);
        const page = read('app/paiement/[id]/page.tsx');
        assert.match(page, /<OperatorLogo operator=\{payment\.operator\} size="sm" \/>\}\n\s+\{label \?\? 'Non renseigné'\}/);
    });

    test('fiche : « Payer avec », logo et nom écrits', () => {
        const src = read('components/event-page/EventTicketing.tsx');
        assert.match(src, /<span>Payer avec<\/span>/);
        assert.match(src, /<OperatorLogo operator="WAVE" size="sm" \/>\n\s+Wave\n/);
        assert.match(src, /<OperatorLogo operator="ORANGE_MONEY" size="sm" \/>\n\s+Orange Money\n/);
    });
});
