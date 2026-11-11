/**
 * Lot 9 bis (H3, contrat 4.5, 5.56, B104) — signature facultative du webhook SamirPay v1.2.
 * En-tête `X-SamirPay-Signature: t=<secondes>,v1=<hex>[,v1=<hex>]` : chaque v1 est le HMAC-SHA256 hexadécimal, avec le
 * secret ENTIER comme clé (préfixe whsec_ compris, à confirmer en bac à sable), de `t + "." + corps brut` (octets reçus,
 * jamais une forme décodée puis réencodée). Écart de 300 secondes au plus entre `t` et maintenant, dans les deux sens.
 * Pendant un renouvellement du secret, deux v1 sont présents : un seul juste suffit. Comparaison en temps constant
 * (timingSafeEqual) de chaque candidat, sans sortie anticipée ; un v1 qui n'a pas 64 caractères hexadécimaux est
 * écarté sans comparaison.
 * Verdicts : OK ; ABSENTE (en-tête absent ou vide) ; PERIMEE (t hors de la fenêtre) ; INVALIDE (en-tête illisible,
 * sans t ou sans v1, ou aucun v1 juste).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type SamirPaySignatureVerdict = 'OK' | 'ABSENTE' | 'PERIMEE' | 'INVALIDE';

/** Nom de l'en-tête (les en-têtes HTTP sont lus sans casse). */
export const SAMIRPAY_SIGNATURE_HEADER = 'x-samirpay-signature';

/** Écart admis entre l'horodatage signé et maintenant, en secondes (v1.2 : 5 minutes). */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

const HEX64 = /^[0-9a-f]{64}$/i;
const SECONDS = /^\d{1,12}$/;

export function verifySamirPaySignature(header: string | null, rawBody: Buffer, secret: string, nowSec: number): SamirPaySignatureVerdict {
    if (!header || !header.trim()) return 'ABSENTE';
    let stamp: number | null = null;
    const candidates: Buffer[] = [];
    for (const part of header.split(',')) {
        const at = part.indexOf('=');
        if (at <= 0) return 'INVALIDE';
        const key = part.slice(0, at).trim();
        const value = part.slice(at + 1).trim();
        if (key === 't') {
            if (!SECONDS.test(value)) return 'INVALIDE';
            stamp = Number(value);
        } else if (key === 'v1' && HEX64.test(value)) {
            candidates.push(Buffer.from(value, 'hex'));
        }
    }
    if (stamp === null || candidates.length === 0) return 'INVALIDE';
    if (Math.abs(nowSec - stamp) > SIGNATURE_TOLERANCE_SECONDS) return 'PERIMEE';
    const mac = createHmac('sha256', secret).update(`${stamp}.`, 'utf8').update(rawBody).digest();
    let matched = false;
    for (const candidate of candidates) {
        if (timingSafeEqual(candidate, mac)) matched = true;
    }
    return matched ? 'OK' : 'INVALIDE';
}
