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
export class RateLimiter {
    static async isRateLimited(identifier: string): Promise<{ limited: boolean; remainingSeconds?: number }> {
        try {
            const supabase = getServiceRoleClient();
            const now = new Date().toISOString();

            // Verifier s'il y a un verrou actif
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

            // Compter les tentatives dans la fenetre
            const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
            const { count } = await (supabase.from('rate_limits') as any)
                .select('*', { count: 'exact', head: true })
                .eq('identifier', identifier)
                .gte('attempted_at', windowStart);

            if (count !== null && count >= MAX_ATTEMPTS) {
                return { limited: true, remainingSeconds: LOCKOUT_SECONDS };
            }

            return { limited: false };
        } catch {
            return { limited: false };
        }
    }

    static async recordFailedAttempt(identifier: string): Promise<{
        attempts: number;
        locked: boolean;
        remainingAttempts: number;
        lockedUntilSeconds?: number;
    }> {
        try {
            const supabase = getServiceRoleClient();
            const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();

            // Inserer la tentative
            await (supabase.from('rate_limits') as any).insert({
                identifier,
                attempted_at: new Date().toISOString(),
            });

            // Compter les tentatives dans la fenetre
            const { count } = await (supabase.from('rate_limits') as any)
                .select('*', { count: 'exact', head: true })
                .eq('identifier', identifier)
                .gte('attempted_at', windowStart);

            const attempts = count ?? 1;
            let locked = false;
            let lockedUntilSeconds: number | undefined;

            if (attempts >= MAX_ATTEMPTS) {
                const lockedUntil = new Date(Date.now() + LOCKOUT_SECONDS * 1000).toISOString();
                await (supabase.from('rate_limits') as any).insert({
                    identifier,
                    attempted_at: new Date().toISOString(),
                    locked_until: lockedUntil,
                });
                locked = true;
                lockedUntilSeconds = LOCKOUT_SECONDS;
            }

            return {
                attempts,
                locked,
                remainingAttempts: Math.max(0, MAX_ATTEMPTS - attempts),
                lockedUntilSeconds,
            };
        } catch {
            return { attempts: 0, locked: false, remainingAttempts: MAX_ATTEMPTS };
        }
    }

    static async resetAttempts(identifier: string): Promise<void> {
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
