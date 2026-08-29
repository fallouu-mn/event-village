import { getServiceRoleClient } from '@/lib/supabase/server';

interface InMemoryRateLimit {
    attempts: number;
    lockedUntil: number | null;
    lastAttemptAt: number;
}

const memoryStore = new Map<string, InMemoryRateLimit>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class RateLimiter {
    /**
     * Vérifie si un identifiant (IP, Téléphone, Email) est actuellement verrouillé
     */
    static isRateLimited(identifier: string): { limited: boolean; remainingSeconds?: number } {
        const now = Date.now();
        const entry = memoryStore.get(identifier);

        if (!entry) return { limited: false };

        // Si verrouillé
        if (entry.lockedUntil && entry.lockedUntil > now) {
            const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
            return { limited: true, remainingSeconds };
        }

        // Si la fenêtre de temps est dépassée, on réinitialise
        if (now - entry.lastAttemptAt > WINDOW_DURATION_MS) {
            memoryStore.delete(identifier);
            return { limited: false };
        }

        return { limited: false };
    }

    /**
     * Enregistre un échec d'authentification ou d'OTP
     */
    static recordFailedAttempt(identifier: string): {
        attempts: number;
        locked: boolean;
        remainingAttempts: number;
        lockedUntilSeconds?: number;
    } {
        const now = Date.now();
        let entry = memoryStore.get(identifier);

        if (!entry || now - entry.lastAttemptAt > WINDOW_DURATION_MS) {
            entry = { attempts: 1, lockedUntil: null, lastAttemptAt: now };
        } else {
            entry.attempts += 1;
            entry.lastAttemptAt = now;
        }

        let locked = false;
        let lockedUntilSeconds: number | undefined;

        if (entry.attempts >= MAX_ATTEMPTS) {
            entry.lockedUntil = now + LOCKOUT_DURATION_MS;
            locked = true;
            lockedUntilSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
        }

        memoryStore.set(identifier, entry);

        return {
            attempts: entry.attempts,
            locked,
            remainingAttempts: Math.max(0, MAX_ATTEMPTS - entry.attempts),
            lockedUntilSeconds,
        };
    }

    /**
     * Réinitialise les tentatives après une authentification réussie
     */
    static resetAttempts(identifier: string): void {
        memoryStore.delete(identifier);
    }
}
