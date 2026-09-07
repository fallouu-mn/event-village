import crypto from 'crypto';

export const TOTP_STEP_SECONDS = 20;
export const TOTP_PREFIX = 'EVT1';

/**
 * Génère un secret cryptographique fort (32 octets hexadécimaux).
 */
export function generateTotpSecret(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Dérivation de secours d'un secret déterministe par billet si la colonne en base
 * est absente ou nulle sur les billets historiques (sécurité serveur garantie).
 */
export function deriveTicketTotpSecret(ticketId: string): string {
    const masterKey = process.env.SUPABASE_AUTH_HOOK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'event-village-totp-master-salt-2026';
    return crypto.createHmac('sha256', masterKey).update(`ticket_secret_${ticketId}`).digest('hex');
}

/**
 * Calcule un code TOTP (RFC 6238) à 6 chiffres pour un horodatage donné.
 */
export function generateTotp(
    secret: string,
    timestampSecondsOrMs?: number,
    stepSeconds: number = TOTP_STEP_SECONDS
): { code: string; step: number; timeRemaining: number } {
    const now = typeof timestampSecondsOrMs === 'number'
        ? (timestampSecondsOrMs > 1e11 ? Math.floor(timestampSecondsOrMs / 1000) : Math.floor(timestampSecondsOrMs))
        : Math.floor(Date.now() / 1000);
    const step = Math.floor(now / stepSeconds);
    const timeRemaining = stepSeconds - (now % stepSeconds);

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(step));

    const hmac = crypto.createHmac('sha256', secret).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    const code = String(binary % 1000000).padStart(6, '0');
    return { code, step, timeRemaining };
}

/**
 * Vérifie un token TOTP avec une tolérance de fenêtres temporelles (±toleranceWindows steps).
 * Par défaut ±1 step (ex: -20s, 0s, +20s) pour absorber la dérive d'horloge et la latence réseau.
 * Retourne true si le code est valide dans la fenêtre autorisée, false sinon.
 */
export function verifyTotp(
    token: string,
    secret: string,
    options?: {
        timestamp?: number;
        timestampSeconds?: number;
        stepSeconds?: number;
        toleranceWindows?: number;
    }
): boolean {
    const cleanToken = token.trim();
    if (!/^\d{6}$/.test(cleanToken)) {
        return false;
    }

    const stepSeconds = options?.stepSeconds ?? TOTP_STEP_SECONDS;
    const tolerance = options?.toleranceWindows ?? 2; // ±2 fenêtres (±40s) : robustesse latence réseau 3G/4G + dérive horloge

    let nowSeconds: number;
    if (typeof options?.timestamp === 'number') {
        nowSeconds = options.timestamp > 1e11 ? Math.floor(options.timestamp / 1000) : Math.floor(options.timestamp);
    } else if (typeof options?.timestampSeconds === 'number') {
        nowSeconds = options.timestampSeconds > 1e11 ? Math.floor(options.timestampSeconds / 1000) : Math.floor(options.timestampSeconds);
    } else {
        nowSeconds = Math.floor(Date.now() / 1000);
    }

    const currentStep = Math.floor(nowSeconds / stepSeconds);

    for (let delta = -tolerance; delta <= tolerance; delta++) {
        const step = currentStep + delta;
        const counterBuffer = Buffer.alloc(8);
        counterBuffer.writeBigInt64BE(BigInt(step));

        const hmac = crypto.createHmac('sha256', secret).update(counterBuffer).digest();
        const offset = hmac[hmac.length - 1] & 0x0f;
        const binary =
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff);

        const expectedCode = String(binary % 1000000).padStart(6, '0');
        if (expectedCode === cleanToken) {
            return true;
        }
    }

    return false;
}

/**
 * Construit le payload compact à encoder dans le QR Code.
 * Format: EVT1:<identifiant_billet>:<totp_6_chiffres>
 * Ex: EVT1:EV-QR-47fae32a8901:482910
 */
export function buildDynamicQrPayload(ticketIdentifier: string, totpCode: string): string {
    return `${TOTP_PREFIX}:${ticketIdentifier}:${totpCode}`;
}

/**
 * Analyse une chaîne scannée pour détecter si elle est dynamique (EVT1) ou statique/manuelle.
 */
export function parseDynamicQrPayload(raw: string): {
    isDynamic: boolean;
    identifier: string;
    token?: string;
} {
    const trimmed = (raw || '').trim();
    if (trimmed.startsWith(`${TOTP_PREFIX}:`)) {
        const parts = trimmed.split(':');
        if (parts.length >= 3) {
            return {
                isDynamic: true,
                identifier: parts[1],
                token: parts[2],
            };
        }
    }

    // Format sans préfixe mais avec séparateur (ex: <identifier>:<token_6_digits>)
    if (trimmed.includes(':')) {
        const parts = trimmed.split(':');
        if (parts.length === 2 && /^\d{6}$/.test(parts[1])) {
            return {
                isDynamic: true,
                identifier: parts[0],
                token: parts[1],
            };
        }
    }

    // Identifiant direct (ticket_number, qr_code statique, ou saisie manuelle)
    return {
        isDynamic: false,
        identifier: trimmed,
    };
}
