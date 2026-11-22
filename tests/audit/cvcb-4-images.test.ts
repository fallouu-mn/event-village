/**
 * Contre-vérification du lot Carte B (22/11/2026), point 3 — T5 : les images statiques de l'application doivent s'afficher
 * pour un visiteur sans session. Vert = image servie ; rouge = trou.
 *
 * Trouvé par l'e2e G4 (run 626, CSP sous HTTPS de même origine) : `/images/` n'est pas un préfixe public du middleware ;
 * sans session, `/images/paiement/wave.webp` (logo « Payer avec » de la fiche), `/images/event-placeholder.svg` (affiche de
 * repli des écrans publics, servie sans optimiseur) et `/images/og-image.png` (image de partage du site, lue sans session
 * par WhatsApp, Facebook…) sont redirigés vers /login. Sous HTTPS derrière un relais, la redirection est construite en
 * http:// (req.url) : la CSP la signale (img-src) avec l'adresse de départ.
 *
 * Écart signalé : suite sans écriture (middleware seul), elle n'appelle pas assertRecetteInvariants.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { callMiddleware } from '../helpers/middleware';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

function publicFiles(dir = PUBLIC_DIR): string[] {
    const out: string[] = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) out.push(...publicFiles(full));
        else out.push(`/${path.relative(PUBLIC_DIR, full).split(path.sep).join('/')}`);
    }
    return out.sort();
}

describe('T5 — images statiques servies sans session', () => {
    test('chaque fichier de public/ est servi à un visiteur sans session (aucune redirection vers /login)', async () => {
        const files = publicFiles();
        assert.ok(files.includes('/images/paiement/wave.webp') && files.includes('/images/og-image.png'), `fichiers : ${files.join(', ')}`);
        const refused: string[] = [];
        for (const f of files) {
            const r = await callMiddleware(f, []);
            if (!r.passedThrough) refused.push(`${f} → HTTP ${r.status}${r.location ? ` vers ${new URL(r.location).pathname}${new URL(r.location).search}` : ''}`);
        }
        assert.deepEqual(refused, [], `images refusées sans session (logos de paiement, affiche de repli, image de partage) :\n${refused.join('\n')}`);
    });
});
