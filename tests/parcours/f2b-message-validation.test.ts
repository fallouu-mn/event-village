/**
 * Finition 2b (D, E-25) — message de validation à l'organisateur (cloche, push, email) : les prochaines étapes (régler les
 * portes, inviter les contrôleurs, générer le code PIN de caisse, publier) ; SMS inchangé, un segment. Sans base : rendu
 * du modèle EVENT_VALIDATED du catalogue (lib/notifications/catalog.ts) sur son exemple.
 * Rouge avant le correctif : « … est validé. Vous pouvez le publier depuis votre espace. » seulement. Sortie brute
 * `[F2B-D2]`. Suite sans base ni écriture : aucun appel d'invariants (comme les suites statiques).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { smsSegments } from '../../lib/notifications/sms-format';

const CTX = { appUrl: 'https://eventvillage.sn' };
const tpl = NOTIFICATION_CATALOG.EVENT_VALIDATED;
const STEPS = [/régl\w* les portes/i, /invit\w* vos contrôleurs/i, /génér\w* le code PIN de caisse/i, /publi\w*/i];

describe('Message de validation : prochaines étapes', () => {
    test('cloche : les quatre étapes', () => {
        const r = tpl.inApp!(tpl.sample);
        console.log(`[F2B-D2] cloche : ${JSON.stringify(r)}`);
        assert.equal(r.title, 'Événement validé');
        for (const re of STEPS) assert.match(r.content, re);
    });
    test('push : les quatre étapes, sans coupure (160 caractères au plus)', () => {
        const p = tpl.push!(tpl.sample);
        assert.ok(p.body.length <= 160 && !p.body.endsWith('…'), `push coupé : ${p.body}`);
        for (const re of STEPS) assert.match(p.body, re);
    });
    test('email : liste « Prochaines étapes », bouton vers l’événement', () => {
        const e = tpl.email!(tpl.sample, CTX);
        assert.match(e.text, /Prochaines étapes/);
        for (const re of STEPS) assert.match(e.text, re);
        // Run 256 : bouton générique « Ouvrir Event Village » (contrat G4) ; il mène à la fiche de l'événement
        assert.match(e.html, /Ouvrir Event Village/);
        assert.match(e.html, /\/partner\/events\//);
    });
    test('SMS inchangé, un segment', () => {
        const sms = tpl.sms!(tpl.sample, CTX);
        assert.equal(sms, `Event Village : votre événement ${String(tpl.sample.title)} est validé. Publiez-le depuis votre espace : ${CTX.appUrl}/partner/events`);
        assert.equal(smsSegments(sms).segments, 1, sms);
    });
});
