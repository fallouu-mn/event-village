/**
 * Téléphone payeur au format SamirPay : 9 chiffres sans indicatif, mobile sénégalais
 * (7[05678]XXXXXXX). Accepte les saisies « 77 123 45 67 », « +221771234567 », « 00221… ».
 * Renvoie null si la saisie n'est pas un mobile sénégalais (aucun numéro de repli).
 */
export function normalizePayerPhone(input: unknown): string | null {
    if (typeof input !== 'string') return null;
    let digits = input.replace(/[\s.\-()]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    if (digits.startsWith('00221')) digits = digits.slice(5);
    else if (digits.startsWith('221') && digits.length === 12) digits = digits.slice(3);
    return /^7[05678][0-9]{7}$/.test(digits) ? digits : null;
}

/** Numéro masqué pour les journaux : 77*****67. */
export function maskPhone(phone: string | null | undefined): string {
    if (!phone) return '***';
    const d = phone.replace(/\D/g, '');
    return d.length >= 4 ? `${d.slice(0, 2)}*****${d.slice(-2)}` : '***';
}
