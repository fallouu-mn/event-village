/**
 * Lot 1C.9 — un compte existe-t-il déjà pour ce numéro ou cet email ?
 * Vérifié AVANT tout envoi de SMS d'inscription : un numéro déjà inscrit ne doit déclencher
 * aucun SMS facturé. Égalité exacte (formes stockées du numéro), aucune interpolation.
 * Une erreur de lecture est levée (pas de repli).
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { phoneStorageForms } from '@/lib/validations/auth';

export async function findExistingAccount(e164Phone: string, email: string | null | undefined): Promise<{ id: string } | null> {
    const supabase = getServiceRoleClient();
    const { data: byPhone, error: phoneErr } = await supabase
        .from('users')
        .select('id')
        .in('phone', phoneStorageForms(e164Phone))
        .limit(1);
    if (phoneErr) throw new Error(`recherche d'un compte par téléphone impossible : ${phoneErr.message}`);
    if (byPhone && byPhone.length > 0) return { id: byPhone[0].id as string };

    const normalizedEmail = (email ?? '').trim().toLowerCase();
    if (!normalizedEmail) return null;
    const { data: byEmail, error: emailErr } = await supabase
        .from('users')
        .select('id')
        .eq('email', normalizedEmail)
        .limit(1);
    if (emailErr) throw new Error(`recherche d'un compte par email impossible : ${emailErr.message}`);
    return byEmail && byEmail.length > 0 ? { id: byEmail[0].id as string } : null;
}
