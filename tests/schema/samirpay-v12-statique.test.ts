/**
 * Lot 9 bis, tâche H3 — signature du webhook SamirPay v1.2, sans base (contrat 5.56, 4.5, B104 ; découverte
 * 9bis/discovery-9bis-samirpay.md section 4).
 *  1. lib/samirpay/webhook-signature.ts : verifySamirPaySignature(en-tête, corps brut en octets, secret, maintenant en
 *     secondes) rend 'OK' | 'ABSENTE' | 'PERIMEE' | 'INVALIDE' : HMAC-SHA256 hexadécimal du secret ENTIER (préfixe
 *     whsec_ compris) sur `t + "." + corps`, écart de 300 secondes au plus, plusieurs v1 admis (renouvellement) ;
 *  2. statique : comparaison en temps constant (timingSafeEqual), aucune comparaison === ou !== d'une signature ;
 *     lib/payments/webhook.service.ts lit le corps en octets (arrayBuffer) et appelle verifySamirPaySignature.
 * Rouge aujourd'hui : le module n'existe pas (import dynamique, patron tests/schema/reset-test-password.test.ts:17-18),
 * webhook.service.ts lit le corps en texte (:38) et ne vérifie rien. Suite sans écriture : aucune aide d'invariants.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const MODULE = '../../lib/samirpay/webhook-signature';
const MODULE_FILE = 'lib/samirpay/webhook-signature.ts';
const SERVICE_FILE = 'lib/payments/webhook.service.ts';
const SECRET = `whsec_${randomBytes(24).toString('hex')}`;
const BODY = Buffer.from('transaction_id=3f1c2a9e-0000-4000-8000-000000000001&order_id=ORD-EV-1-ABCDEF12&status=success', 'utf8');
const NOW = 1_800_000_000;

type Verdict = 'OK' | 'ABSENTE' | 'PERIMEE' | 'INVALIDE';
type Verify = (header: string | null, rawBody: Buffer, secret: string, nowSec: number) => Verdict;

async function verifier(): Promise<Verify> {
    let mod: Record<string, unknown>;
    try {
        const spec = MODULE;
        mod = await import(spec) as Record<string, unknown>;
    } catch (err) {
        assert.fail(`${MODULE_FILE} absent (contrat 4.5, fix(9b.H3)) — ${String((err as Error).message).split('\n')[0]}`);
    }
    assert.equal(typeof mod.verifySamirPaySignature, 'function', `${MODULE_FILE} : verifySamirPaySignature non exportée`);
    return mod.verifySamirPaySignature as Verify;
}

/** v1 de la v1.2 : HMAC-SHA256 hexadécimal du secret entier sur `t + "." + corps brut`. */
function v1(secret: string, t: number, body: Buffer): string {
    return createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${t}.`, 'utf8'), body])).digest('hex');
}

describe('H3 — verifySamirPaySignature (lib/samirpay/webhook-signature.ts)', () => {
    test('signature juste → OK ; secret pris en entier, préfixe whsec_ compris', async () => {
        const verify = await verifier();
        assert.equal(verify(`t=${NOW},v1=${v1(SECRET, NOW, BODY)}`, BODY, SECRET, NOW), 'OK');
        assert.equal(verify(`t=${NOW},v1=${v1(SECRET.slice('whsec_'.length), NOW, BODY)}`, BODY, SECRET, NOW), 'INVALIDE', 'clé sans le préfixe whsec_ : refusée (B104, à confirmer en bac à sable)');
    });

    test('en-tête absent ou vide → ABSENTE', async () => {
        const verify = await verifier();
        assert.deepEqual([verify(null, BODY, SECRET, NOW), verify('', BODY, SECRET, NOW)], ['ABSENTE', 'ABSENTE']);
    });

    test('écart de plus de 300 secondes (passé ou futur) → PERIMEE ; 300 secondes tout juste → OK', async () => {
        const verify = await verifier();
        for (const shift of [-301, 301]) {
            const t = NOW + shift;
            assert.equal(verify(`t=${t},v1=${v1(SECRET, t, BODY)}`, BODY, SECRET, NOW), 'PERIMEE', `t décalé de ${shift} s`);
        }
        assert.equal(verify(`t=${NOW - 300},v1=${v1(SECRET, NOW - 300, BODY)}`, BODY, SECRET, NOW), 'OK', '5 minutes tout juste');
    });

    test('v1 faux, corps modifié d’un octet, v1 de longueur fausse → INVALIDE', async () => {
        const verify = await verifier();
        const good = v1(SECRET, NOW, BODY);
        assert.equal(verify(`t=${NOW},v1=${randomBytes(32).toString('hex')}`, BODY, SECRET, NOW), 'INVALIDE', 'v1 faux');
        assert.equal(verify(`t=${NOW},v1=${good}`, Buffer.concat([BODY, Buffer.from('&')]), SECRET, NOW), 'INVALIDE', 'corps modifié d’un octet');
        assert.equal(verify(`t=${NOW},v1=${good.slice(0, 63)}`, BODY, SECRET, NOW), 'INVALIDE', 'v1 de 63 caractères');
    });

    test('deux v1 pendant un renouvellement (l’ancien faux, le nouveau juste, dans les deux ordres) → OK', async () => {
        const verify = await verifier();
        const good = v1(SECRET, NOW, BODY);
        const old = v1(`whsec_${randomBytes(24).toString('hex')}`, NOW, BODY);
        assert.deepEqual([verify(`t=${NOW},v1=${old},v1=${good}`, BODY, SECRET, NOW), verify(`t=${NOW},v1=${good},v1=${old}`, BODY, SECRET, NOW)], ['OK', 'OK']);
    });
});

// ── Statique ───────────────────────────────────────────────────────────────

function parse(rel: string): ts.SourceFile {
    const file = path.join(process.cwd(), rel);
    assert.ok(fs.existsSync(file), `${rel} absent (contrat 4.5, fix(9b.H3))`);
    return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function nodes(root: ts.Node): ts.Node[] {
    const out: ts.Node[] = [];
    const visit = (n: ts.Node): void => {
        out.push(n);
        n.forEachChild(visit);
    };
    visit(root);
    return out;
}

const SIGNATURE_NAME = /signature|v1|hmac|digest|expected|computed|candidate/i;
const isLiteral = (n: ts.Expression): boolean => ts.isLiteralExpression(n) || n.kind === ts.SyntaxKind.NullKeyword || n.kind === ts.SyntaxKind.UndefinedKeyword
    || n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword || ts.isPrefixUnaryExpression(n) || ts.isTypeOfExpression(n);

describe('H3 — comparaison en temps constant (statique)', () => {
    test(`${MODULE_FILE} : timingSafeEqual, aucune comparaison === ou !== d’une signature`, () => {
        const sf = parse(MODULE_FILE);
        assert.match(sf.getText(), /\btimingSafeEqual\s*\(/, 'timingSafeEqual absent : comparaison en temps constant exigée (§7)');
        const strict = nodes(sf).filter((n): n is ts.BinaryExpression => ts.isBinaryExpression(n)
            && (n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken || n.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
                || n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken || n.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken))
            .filter((n) => !isLiteral(n.left) && !isLiteral(n.right))
            .filter((n) => ![n.left, n.right].some((side) => /\.length$/.test(side.getText(sf))))
            .filter((n) => SIGNATURE_NAME.test(n.left.getText(sf)) || SIGNATURE_NAME.test(n.right.getText(sf)));
        assert.deepEqual(strict.map((n) => n.getText(sf)), [], 'comparaison directe d’une signature (fuite par le temps de réponse)');
    });

    test(`${SERVICE_FILE} : corps lu en octets (arrayBuffer) et vérifié par verifySamirPaySignature`, () => {
        const text = parse(SERVICE_FILE).getText();
        assert.match(text, /\.arrayBuffer\(\)/, 'corps brut lu en octets : la signature porte sur les octets reçus (contrat 4.5)');
        assert.match(text, /\bverifySamirPaySignature\s*\(/, 'verifySamirPaySignature non appelée par le webhook');
        assert.match(text, /REJECTED_SIGNATURE/, 'résultat REJECTED_SIGNATURE absent du journal');
    });
});
