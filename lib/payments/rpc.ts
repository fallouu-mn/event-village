/**
 * Appel des RPC de la chaîne de paiement (service_role). Un interblocage (40P01) ou un échec de
 * sérialisation (40001) est rejoué, au plus 3 fois, avec une courte attente ; toute autre erreur
 * est renvoyée telle quelle à l'appelant (jamais ignorée).
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { getServiceRoleClient } from '@/lib/supabase/server';

const RETRYABLE = new Set(['40P01', '40001']);

export async function rpcWithRetry<T = unknown>(fn: string, args: Record<string, unknown>, attempts = 3): Promise<{ data: T | null; error: PostgrestError | null }> {
    const supabase = getServiceRoleClient();
    for (let i = 1; ; i++) {
        const { data, error } = await supabase.rpc(fn, args);
        if (!error) return { data: data as T, error: null };
        if (!RETRYABLE.has(error.code) || i >= attempts) return { data: null, error };
        console.warn(`[rpc] ${fn} : ${error.code} (tentative ${i}/${attempts}), nouvel essai`);
        await new Promise((r) => setTimeout(r, 25 * i + Math.floor(Math.random() * 40)));
    }
}
