/**
 * Formatage des numéros pour l'API MTarget (00221XXXXXXXXX).
 * Repris de tests/legacy/mtarget-sms.test.ts (cas 1 à 6) au lot 1C.9 ; les cas 7 à 9 de
 * l'ancienne suite visaient un constructeur et un hook non authentifié qui n'existent plus.
 */
import './helpers/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMTargetPhoneNumber } from '../lib/sms/mtarget.service';

const CASES: Array<[string, string, string]> = [
    ['numéro local sénégalais', '77 123 45 67', '00221771234567'],
    ['numéro international', '+221771234567', '00221771234567'],
    ['numéro avec espaces', '+221 78 987 65 43', '00221789876543'],
    ['numéro brut avec indicatif', '221761112233', '00221761112233'],
    ['déjà au format 00221', '00221701234567', '00221701234567'],
    ['tirets et parenthèses', '(+221) 75-555-44-33', '00221755554433'],
];

for (const [label, input, expected] of CASES) {
    test(`formatage MTarget : ${label} « ${input} »`, () => {
        assert.equal(formatMTargetPhoneNumber(input), expected);
    });
}
