import { getServiceRoleClient } from '@/lib/supabase/server';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 900; // 15 minutes
const LOCKOUT_SECONDS = 900; // 15 minutes

/**
 * Rate limiter persistant via Supabase PostgreSQL.
 * Fonctionne correctement en serverless (Vercel) contrairement au Map en mémoire.
 *
 * Requiert la table `rate_limits` — voir supabase/migrations/rate_limits.sql
 * Fallback silencieux si la table n'existe pas (aucun rate limiting dans ce cas).
 */
export interface RateLimitOptions {
    maxAttempts?: number;
    windowSeconds?: number;
    lockoutSeconds?: number;
    failClosed?: boolean;
}

/**
 * Rate limiter persistant via Supabase PostgreSQL.
 * Fonctionne correctement en serverless (Vercel) contrairement au Map en mémoire.
 *
 * Requiert la table `rate_limits` — voir supabase/migrations/rate_limits.sql
 * Supporte le fail-closed pour les endpoints d'authentification/sécurité sensibles.
 */
const inMemoryBurstCache = new Map<string, number[]>();

export class RateLimiter {
    static async isRateLimited(
        identifier: string,
        options?: RateLimitOptions
    ): Promise<{ limited: boolean; remainingSeconds?: number }> {
        const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS;
        const windowSeconds = options?.windowSeconds ?? WINDOW_SECONDS;
        const lockoutSeconds = options?.lockoutSeconds ?? LOCKOUT_SECONDS;
        const failClosed = options?.failClosed ?? false;

        const nowMs = Date.now();
        const windowMs = windowSeconds * 1000;
        const cached = inMemoryBurstCache.get(identifier) || [];
        const valid = cached.filter(t => nowMs - t < windowMs);
        if (valid.length >= maxAttempts) {
            return { limited: true, remainingSeconds: lockoutSeconds };
        }

        try {
            const supabase = getServiceRoleClient();
            const now = new Date().toISOString();

            // Verifier s'il y a un verrou actif
            const { data: lockRow, error: lockErr } = await (supabase.from('rate_limits') as any)
                .select('locked_until')
                .eq('identifier', identifier)
                .gt('locked_until', now)
                .order('locked_until', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lockErr) throw lockErr;

            if (lockRow?.locked_until) {
                const remaining = Math.ceil((new Date(lockRow.locked_until).getTime() - Date.now()) / 1000);
                if (remaining > 0) return { limited: true, remainingSeconds: remaining };
            }

            // Compter les tentatives dans la fenetre
            const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();
            const { count, error: countErr } = await (supabase.from('rate_limits') as any)
                .select('*', { count: 'exact', head: true })
                .eq('identifier', identifier)
                .gte('attempted_at', windowStart);

            if (countErr) throw countErr;

            if (count !== null && count >= maxAttempts) {
                return { limited: true, remainingSeconds: lockoutSeconds };
            }

            return { limited: false };
        } catch (err) {
            if (failClosed) {
                console.error(`[RateLimiter] Erreur SQL sur '${identifier}' — fail-closed activé (bloqué par sécurité):`, err);
                return { limited: true, remainingSeconds: lockoutSeconds };
            }
            return { limited: false };
        }
    }

    /**
     * Enregistre immédiatement la tentative puis vérifie le quota dans la fenêtre.
     * Combine un cache local anti-race-condition pour les rafales concurrentes (Promise.allSettled)
     * et la persistance PostgreSQL dans rate_limits.
     */
    static async checkAndRecord(
        identifier: string,
        options?: RateLimitOptions
    ): Promise<{ limited: boolean; remainingSeconds?: number }> {
        const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS;
        const windowSeconds = options?.windowSeconds ?? WINDOW_SECONDS;
        const lockoutSeconds = options?.lockoutSeconds ?? LOCKOUT_SECONDS;
        const failClosed = options?.failClosed ?? false;

        const nowMs = Date.now();
        const windowMs = windowSeconds * 1000;

        // 1. Arbitrage synchrone instantané anti-race condition (rafales Promise.allSettled)
        const cached = inMemoryBurstCache.get(identifier) || [];
        const valid = cached.filter(t => nowMs - t < windowMs);
        if (valid.length >= maxAttempts) {
            return { limited: true, remainingSeconds: lockoutSeconds };
        }
        valid.push(nowMs);
        inMemoryBurstCache.set(identifier, valid);

        try {
            const supabase = getServiceRoleClient();
            const now = new Date(nowMs).toISOString();

            // 2. Vérifier s'il y a un verrou actif en base
            const { data: lockRow } = await (supabase.from('rate_limits') as any)
                .select('locked_until')
                .eq('identifier', identifier)
                .gt('locked_until', now)
                .order('locked_until', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (lockRow?.locked_until) {
                const remaining = Math.ceil((new Date(lockRow.locked_until).getTime() - Date.now()) / 1000);
                if (remaining > 0) return { limited: true, remainingSeconds: remaining };
            }

            // 3. Enregistrer la tentative immédiatement en base
            await (supabase.from('rate_limits') as any).insert({
                identifier,
                attempted_at: now,
            });

            return { limited: false };
        } catch (err) {
            if (failClosed) {
                console.error(`[RateLimiter] checkAndRecord error on '${identifier}' (fail-closed):`, err);
                return { limited: true, remainingSeconds: lockoutSeconds };
            }
            return { limited: false };
        }
    }

    static async recordAttempt(identifier: string): Promise<void> {
        const nowMs = Date.now();
        const cached = inMemoryBurstCache.get(identifier) || [];
        cached.push(nowMs);
        inMemoryBurstCache.set(identifier, cached);

        try {
            const supabase = getServiceRoleClient();
            await (supabase.from('rate_limits') as any).insert({
                identifier,
                attempted_at: new Date().toISOString(),
            });
        } catch (err) {
            console.warn(`[RateLimiter] recordAttempt échoué pour '${identifier}':`, err);
        }
    }

    static async recordFailedAttempt(
        identifier: string,
        options?: RateLimitOptions
    ): Promise<{
        attempts: number;
        locked: boolean;
        remainingAttempts: number;
        lockedUntilSeconds?: number;
    }> {
        const maxAttempts = options?.maxAttempts ?? MAX_ATTEMPTS;
        const windowSeconds = options?.windowSeconds ?? WINDOW_SECONDS;
        const lockoutSeconds = options?.lockoutSeconds ?? LOCKOUT_SECONDS;
        const failClosed = options?.failClosed ?? false;

        const nowMs = Date.now();
        const windowMs = windowSeconds * 1000;
        const cached = inMemoryBurstCache.get(identifier) || [];
        const valid = cached.filter(t => nowMs - t < windowMs);
        valid.push(nowMs);
        inMemoryBurstCache.set(identifier, valid);

        const memAttempts = valid.length;
        const memLocked = memAttempts >= maxAttempts;

        try {
            const supabase = getServiceRoleClient();
            const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

            // Inserer la tentative
            await (supabase.from('rate_limits') as any).insert({
                identifier,
                attempted_at: new Date().toISOString(),
            });

            // Compter les tentatives dans la fenetre
            const { count, error: countErr } = await (supabase.from('rate_limits') as any)
                .select('*', { count: 'exact', head: true })
                .eq('identifier', identifier)
                .gte('attempted_at', windowStart);

            if (countErr) throw countErr;

            const attempts = Math.max(memAttempts, count ?? 1);
            let locked = attempts >= maxAttempts;
            let lockedUntilSeconds: number | undefined = locked ? lockoutSeconds : undefined;

            if (locked) {
                const lockedUntil = new Date(Date.now() + lockoutSeconds * 1000).toISOString();
                await (supabase.from('rate_limits') as any).insert({
                    identifier,
                    attempted_at: new Date().toISOString(),
                    locked_until: lockedUntil,
                });
            }

            return {
                attempts,
                locked,
                remainingAttempts: Math.max(0, maxAttempts - attempts),
                lockedUntilSeconds,
            };
        } catch (err) {
            if (failClosed) {
                console.error(`[RateLimiter] recordFailedAttempt SQL error sur '${identifier}' (fail-closed):`, err);
                return { attempts: maxAttempts, locked: true, remainingAttempts: 0, lockedUntilSeconds: lockoutSeconds };
            }
            return {
                attempts: memAttempts,
                locked: memLocked,
                remainingAttempts: Math.max(0, maxAttempts - memAttempts),
                lockedUntilSeconds: memLocked ? lockoutSeconds : undefined,
            };
        }
    }

    static async resetAttempts(identifier: string): Promise<void> {
        inMemoryBurstCache.delete(identifier);
        try {
            const supabase = getServiceRoleClient();
            await (supabase.from('rate_limits') as any)
                .delete()
                .eq('identifier', identifier);
        } catch {
            // Silencieux
        }
    }
}

