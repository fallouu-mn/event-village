/**
 * Cache mémoire global pour les codes OTP (partagé entre les routes Next.js)
 */
export interface OtpCacheEntry {
    code: string;
    expiresAt: number;
    attempts: number;
}

// Utilisation d'un objet global pour persister le cache entre les requêtes en développement et production Node.js
const globalForOtp = global as unknown as { otpMemoryCache: Map<string, OtpCacheEntry> };

export const otpMemoryCache = globalForOtp.otpMemoryCache || new Map<string, OtpCacheEntry>();

if (process.env.NODE_ENV !== 'production') {
    globalForOtp.otpMemoryCache = otpMemoryCache;
}
