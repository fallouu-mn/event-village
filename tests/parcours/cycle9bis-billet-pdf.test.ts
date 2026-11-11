/**
 * Lot 9 bis, tâche 29 (R69 ; contrat 5.29, 4.3, B67) — PDF du billet : refus 503 TICKET_PDF_UNAVAILABLE « Billet
 * momentanément indisponible : réessayez dans un instant. » quand l'événement ou la catégorie ne se lisent pas, plus
 * aucune valeur inventée (organisateur, date du jour, heure, titulaire, titre, sous-titre, catégorie, lieu, ville,
 * version de sécurité).
 * Statique : le défaut de lecture ne se fabrique pas en base locale (clé étrangère, rôle service) ; il n'est pas
 * reproduit en exécution, preuve par lecture de `app/api/tickets/[id]/pdf/route.ts` (`:88-92` : lectures sans
 * contrôle d'erreur ; `:94-138` : valeurs de repli). Témoin vert existant : tests/parcours/legacy-billet-pdf.test.ts:86
 * (200 sur un billet lisible).
 * Rouge avant correctif : les dix valeurs de repli et les quatre lectures `{ data }` sans `error` sont présentes.
 * Suite sans base et sans écriture : aucune aide d'invariants en after() (signalé).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const PDF_ROUTE = path.join('app', 'api', 'tickets', '[id]', 'pdf', 'route.ts');

function code(): string {
    assert.ok(fs.existsSync(PDF_ROUTE), `${PDF_ROUTE} absent`);
    return fs.readFileSync(PDF_ROUTE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/[^\n]*/g, '$1');
}

describe('R69 — PDF du billet : aucune valeur inventée, refus 503 si une lecture échoue (contrôle statique)', () => {
    test('aucune valeur de repli : organisateur, heure, titulaire, titre, sous-titre, catégorie, lieu, ville, version, date du jour', () => {
        const src = code();
        const literals: Array<[RegExp, string]> = [
            [/['"`]Organisateur Officiel['"`]/, '« Organisateur Officiel » (:94) : ligne omise si l’organisateur est absent'],
            [/['"`]20:00['"`]/, '« 20:00 » (:106) : heure lue et formatée par lib/format'],
            [/['"`]Titulaire Event Village['"`]/, '« Titulaire Event Village » (:112) : numéro du titulaire seul si le nom manque'],
            [/['"`]Événement Event Village['"`]/, '« Événement Event Village » (:125)'],
            [/['"`]Spectacle & Événement['"`]/, '« Spectacle & Événement » (:126)'],
            [/['"`]Pass Standard['"`]/, '« Pass Standard » (:128)'],
            [/['"`]Dakar Arena['"`]/, '« Dakar Arena » (:133)'],
            [/['"`]Dakar['"`]/, '« Dakar » (:134)'],
            [/\|\|\s*1\b/, '`|| 1` sur la version de sécurité (:138)'],
            [/start_date\s*\)\s*:\s*new Date\(\s*\)/, 'date du jour à la place de la date de l’événement (:103)'],
        ];
        const found = literals.filter(([re]) => re.test(src)).map(([, label]) => label);
        assert.deepEqual(found, [], `valeurs inventées encore présentes :\n${found.join('\n')}`);
    });

    test('chaque lecture contrôle son erreur ; lecture impossible de l’événement ou de la catégorie → 503 TICKET_PDF_UNAVAILABLE au texte du contrat', () => {
        const src = code();
        const blind = src.match(/\{\s*data(?:\s*:\s*\w+)?\s*\}\s*(?:,|\]|=)/g) ?? [];
        assert.deepEqual(blind, [], `lectures sans contrôle d’erreur (aujourd’hui :88-92 et :96, { data } seul) : ${JSON.stringify(blind)}`);
        assert.match(src, /TICKET_PDF_UNAVAILABLE/, 'code TICKET_PDF_UNAVAILABLE');
        assert.match(src, /Billet momentanément indisponible : réessayez dans un instant\./, 'texte du contrat 4.3');
        assert.match(src, /status:\s*503/, 'refus en 503');
    });
});
