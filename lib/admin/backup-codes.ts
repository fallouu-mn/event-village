/**
 * Finition 3d (points 2b et 2c) — codes de secours du SUPERADMIN.
 *
 * 10 codes de 10 caractères (« ABCDE-FGH23 »), tirés au hasard dans 32 signes sans I ni O (pas de confusion avec 1 et 0) :
 * 50 bits chacun. Montrés une seule fois ; seule leur empreinte HMAC, liée au compte, est rangée en base
 * (admin_backup_codes). La saisie ignore les majuscules, les espaces et le tiret.
 */
import { randomInt } from 'node:crypto';
import { hashOtpCode } from '@/lib/auth/otp-store';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const BACKUP_CODE_COUNT = 10;

function oneCode(): string {
    let s = '';
    for (let i = 0; i < 10; i += 1) s += ALPHABET[randomInt(ALPHABET.length)];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
}

/** 10 codes distincts, à montrer une seule fois. */
export function newBackupCodes(): string[] {
    const codes = new Set<string>();
    while (codes.size < BACKUP_CODE_COUNT) codes.add(oneCode());
    return [...codes];
}

/** Saisie normalisée (« abcde fgh23 » → « ABCDEFGH23 ») ; null si ce n'est pas un code de secours. */
export function normalizeBackupCode(input: string): string | null {
    const s = input.toUpperCase().replace(/[\s-]/g, '');
    return /^[A-HJ-NP-Z2-9]{10}$/.test(s) ? s : null;
}

/** Empreinte rangée en base : liée au compte, jamais le code en clair. */
export function backupCodeHash(userId: string, code: string): string {
    const normalized = normalizeBackupCode(code);
    if (!normalized) throw new Error('code de secours illisible');
    return hashOtpCode(`admin-backup:${userId}`, normalized);
}
