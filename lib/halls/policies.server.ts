/**
 * Lot 10b — textes des trois règles d'annulation, tels que calculés en base (hall_cancel_terms : réglages halls.*).
 * Lu côté serveur par le formulaire d'une salle (choix de la règle) : aucun pourcentage écrit en dur à l'écran.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { cancellationText, type CancellationTerms } from './booking';

export type PolicyKey = 'SOUPLE' | 'MODEREE' | 'STRICTE';

/**
 * Contre-vérification du lot 10b (point ouvert) : valeurs réelles des réglages montrées au formulaire de la salle
 * (acompte par défaut en %, durée de garde d'une réservation non payée en minutes, échéance du solde en jours).
 */
export async function hallDefaults(): Promise<{ depositDefaultPercent: number; holdMinutes: number; balanceDueDays: number }> {
    const { data, error } = await getServiceRoleClient().from('platform_settings').select('key, value')
        .in('key', ['halls.deposit_default_percent', 'halls.hold_minutes', 'halls.balance_due_days']);
    if (error) throw new Error(`réglages des salles : ${error.message}`);
    const v = (key: string): number => Number(((data ?? []).find((s) => s.key === key)?.value as { value?: unknown } | undefined)?.value);
    return { depositDefaultPercent: v('halls.deposit_default_percent'), holdMinutes: v('halls.hold_minutes'), balanceDueDays: v('halls.balance_due_days') };
}

export async function policyTexts(): Promise<Record<PolicyKey, string>> {
    const supabase = getServiceRoleClient();
    const keys: PolicyKey[] = ['SOUPLE', 'MODEREE', 'STRICTE'];
    const out = {} as Record<PolicyKey, string>;
    await Promise.all(keys.map(async (k) => {
        const { data, error } = await supabase.rpc('hall_cancel_terms', { p_policy: k });
        if (error) throw new Error(`hall_cancel_terms ${k} : ${error.message}`);
        // Texte pour la partenaire : « vous » désigne le client dans cancellationText ; on parle ici « du client »
        out[k] = cancellationText(data as CancellationTerms).replace(/si vous annulez/g, 'si le client annule');
    }));
    return out;
}
