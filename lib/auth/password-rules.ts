/**
 * Lot 9 quinquies (A7 : AUTH-11) — règle commune du mot de passe, décision du chef de projet.
 *
 * 10 caractères au moins, 64 au plus, sans obligation de majuscule, de chiffre ni de caractère spécial (ASVS 4.0
 * V2.1.1, V2.1.2, V2.1.9) ; refus des mots de passe évidents. Module partagé (client et serveur), sans la grande liste :
 * la liste des 10 000 mots de passe courants est vérifiée au serveur seulement (lib/auth/password-policy.server.ts).
 * Règles locales (refus) :
 *  - un même caractère répété (« aaaaaaaaaa ») ;
 *  - une suite de chiffres croissante ou décroissante (« 0123456789 », « 9876543210 ») ;
 *  - un numéro de téléphone : chiffres seuls commençant par 221 ou par 70, 75, 76, 77, 78 ;
 *  - un mot évident entouré seulement de chiffres et de signes : senegal, dakar, teranga, le nom de l'application
 *    (« Senegal2026! », « dakar12345 ») ; le nom de l'application n'est accepté nulle part dans le mot de passe.
 * S'applique aux NOUVEAUX mots de passe seulement : la connexion ne contrôle jamais la règle.
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 64;

export const PASSWORD_TOO_SHORT = `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`;
export const PASSWORD_TOO_LONG = `Le mot de passe doit contenir au plus ${PASSWORD_MAX_LENGTH} caractères.`;
export const PASSWORD_TOO_COMMON = 'Ce mot de passe est trop courant. Choisissez-en un autre, par exemple une phrase de plusieurs mots.';

/** Mots évidents (minuscules, sans accent) refusés quand ils forment tout le mot de passe, chiffres et signes mis à part. */
export const OBVIOUS_WORDS: readonly string[] = [
    'senegal', 'dakar', 'teranga', 'eventvillage', 'event', 'village', 'sunugal', 'galsen', 'touba', 'thies',
    'motdepasse', 'password', 'azerty', 'qwerty', 'bonjour', 'soleil', 'admin',
];

/** Minuscules, sans accent. */
export function normalizePassword(password: string): string {
    return password.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function isDigitRun(digits: string): boolean {
    if (digits.length < 3) return false;
    const up = Array.from(digits).every((d, i) => i === 0 || Number(d) === (Number(digits[i - 1]) + 1) % 10);
    const down = Array.from(digits).every((d, i) => i === 0 || Number(d) === (Number(digits[i - 1]) + 9) % 10);
    return up || down;
}

/** Raison d'un mot de passe évident (règles locales), ou null. */
export function obviousPasswordReason(password: string): 'REPETITION' | 'DIGIT_RUN' | 'PHONE' | 'OBVIOUS_WORD' | null {
    const norm = normalizePassword(password);
    const compact = norm.replace(/[^a-z0-9]/g, '');
    if (compact.length === 0 || /^(.)\1*$/.test(compact) || /^(.)\1*$/.test(norm.replace(/\s/g, ''))) return 'REPETITION';
    if (/^\d+$/.test(compact)) {
        if (isDigitRun(compact)) return 'DIGIT_RUN';
        if (/^221\d*$/.test(compact) || /^7[05678]\d*$/.test(compact)) return 'PHONE';
    }
    if (compact.includes('eventvillage')) return 'OBVIOUS_WORD';
    const letters = compact.replace(/\d/g, '');
    if (letters.length > 0) {
        for (const w of OBVIOUS_WORDS) {
            if (letters === w || letters === w.repeat(Math.max(1, Math.round(letters.length / w.length)))) return 'OBVIOUS_WORD';
        }
    }
    return null;
}

/** Message de refus de la règle locale (longueur, puis mot évident), ou null si le mot de passe la respecte. */
export function passwordRuleMessage(password: string): string | null {
    if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_TOO_SHORT;
    if (password.length > PASSWORD_MAX_LENGTH) return PASSWORD_TOO_LONG;
    return obviousPasswordReason(password) ? PASSWORD_TOO_COMMON : null;
}

/** Critères affichés sous le champ (liste de contrôle de l'écran), dans l'ordre. */
export const PASSWORD_CRITERIA_LABELS = {
    length: `Au moins ${PASSWORD_MIN_LENGTH} caractères`,
    max: `${PASSWORD_MAX_LENGTH} caractères au plus`,
    common: 'Pas un mot de passe trop courant (nom du pays, d’une ville, de l’application, numéro, suite de chiffres)',
} as const;

/** Aide courte sous le champ. */
export const PASSWORD_HINT = `${PASSWORD_MIN_LENGTH} caractères au moins. Une phrase de plusieurs mots est idéale ; majuscules et caractères spéciaux sont facultatifs.`;
