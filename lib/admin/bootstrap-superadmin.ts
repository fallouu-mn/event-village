/**
 * Bootstrap du premier SUPERADMIN — procédure serveur (service_role), lancée par un opérateur.
 *
 * Remplace l'ancien mécanisme du trigger d'inscription, qui accordait SUPERADMIN à tout compte
 * dont le téléphone (y compris en métadonnée, donc choisi par l'inscrit) valait 773780756.
 *
 * Règles :
 *  - le compte cible doit déjà exister (inscription normale, puis bootstrap) ;
 *  - refus s'il existe déjà un SUPERADMIN, sauf option explicite `allowWhenSuperadminExists`
 *    (les SUPERADMIN suivants se créent depuis l'administration) ;
 *  - l'opération est journalisée dans audit_logs.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { grantUserRoles } from '@/lib/auth/roles';
import { normalizePhoneNumber } from '@/lib/validations/auth';

export interface BootstrapSuperadminInput {
    /** Email ou téléphone du compte existant à promouvoir. */
    email?: string;
    phone?: string;
    allowWhenSuperadminExists?: boolean;
    /** Libellé de l'opérateur pour le journal d'audit (ex. nom de la personne qui lance le script). */
    operator: string;
}

export interface BootstrapSuperadminResult {
    userId: string;
    email: string | null;
    phone: string | null;
}

export async function bootstrapSuperadmin(input: BootstrapSuperadminInput): Promise<BootstrapSuperadminResult> {
    if (!input.email && !input.phone) {
        throw new Error('Indiquez l\'email ou le téléphone du compte à promouvoir.');
    }
    if (!input.operator || !input.operator.trim()) {
        throw new Error('Indiquez l\'opérateur (traçabilité).');
    }
    const supabase = getServiceRoleClient();

    const { count, error: countErr } = await supabase
        .from('user_roles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'SUPERADMIN');
    if (countErr) throw new Error(`Lecture des SUPERADMIN existants impossible : ${countErr.message}`);
    if ((count ?? 0) > 0 && !input.allowWhenSuperadminExists) {
        throw new Error('Un SUPERADMIN existe déjà : créez les suivants depuis l\'administration, ou passez --allow-existing.');
    }

    let query = supabase.from('users').select('id, email, phone');
    query = input.email
        ? query.eq('email', input.email.trim().toLowerCase())
        : query.eq('phone', normalizePhoneNumber(input.phone!.trim()));
    const { data: user, error: userErr } = await query.maybeSingle();
    if (userErr) throw new Error(`Recherche du compte impossible : ${userErr.message}`);
    if (!user) throw new Error('Aucun compte ne correspond : le compte doit d\'abord être créé par l\'inscription normale.');

    await grantUserRoles(user.id, ['SUPERADMIN']);

    const { error: profileErr } = await supabase
        .from('users')
        .update({ role: 'SUPERADMIN', status: 'ACTIF', updated_at: new Date().toISOString() })
        .eq('id', user.id);
    if (profileErr) throw new Error(`Mise à jour du profil impossible : ${profileErr.message}`);

    const { error: auditErr } = await supabase.from('audit_logs').insert({
        user_id: user.id,
        user_role: 'SUPERADMIN',
        action: 'SUPERADMIN_BOOTSTRAP',
        object_type: 'users',
        object_id: user.id,
        new_value: { role: 'SUPERADMIN' },
        metadata: { operator: input.operator.trim(), source: 'scripts/bootstrap-superadmin.ts' },
    });
    if (auditErr) throw new Error(`Rôle attribué mais journalisation impossible : ${auditErr.message}`);

    return { userId: user.id, email: user.email, phone: user.phone };
}
