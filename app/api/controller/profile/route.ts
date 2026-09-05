import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { AdminService } from '@/lib/admin/admin.service';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['CONTROLEUR', 'ADMIN', 'SUPERADMIN'] as const;

// GET /api/controller/profile
// Retourne le profil du contrôleur connecté avec ses assignations
export async function GET(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        if (!ALLOWED_ROLES.includes(user.role as any)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        const supabase = getServiceRoleClient();

        const { data: profile, error: profileErr } = await supabase
            .from('users')
            .select('id, first_name, last_name, phone, role, status, created_at')
            .eq('id', user.id)
            .maybeSingle();

        if (profileErr || !profile) {
            return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 });
        }

        const { data: assignments } = await supabase
            .from('event_controllers')
            .select(`
                id,
                can_accept_cash,
                created_at,
                events (id, title, start_date, start_time, location, status)
            `)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        const formattedAssignments = (assignments ?? []).map((a: any) => ({
            ...a,
            events: a.events ? {
                ...a.events,
                date: a.events.start_date,
            } : null,
        }));

        return NextResponse.json({
            success: true,
            profile,
            assignments: formattedAssignments,
        });
    } catch (err: unknown) {
        console.error('[GET /api/controller/profile]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}

const ChangePasswordSchema = z.object({
    current_password: z.string().min(1, 'Mot de passe actuel requis.'),
    new_password: z
        .string()
        .min(8, 'Le mot de passe doit comporter au moins 8 caractères.')
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
            'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre.'
        ),
});

// PATCH /api/controller/profile
// Changement de mot de passe — valide l'ancien avant de mettre à jour
export async function PATCH(req: NextRequest) {
    try {
        const user = await getServerSessionUser(req);
        if (!user) return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        if (!ALLOWED_ROLES.includes(user.role as any)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }

        let body: unknown;
        try { body = await req.json(); }
        catch { return NextResponse.json({ error: 'Payload JSON invalide.' }, { status: 400 }); }

        const parse = ChangePasswordSchema.safeParse(body);
        if (!parse.success) {
            return NextResponse.json({ error: parse.error.errors[0]?.message || 'Données invalides.' }, { status: 400 });
        }

        const { current_password, new_password } = parse.data;
        const supabase = getServiceRoleClient();

        // 1. Récupérer le numéro de téléphone pour la vérification de l'ancien mot de passe
        const { data: profile } = await supabase
            .from('users')
            .select('phone')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile?.phone) {
            return NextResponse.json({ error: 'Profil introuvable.' }, { status: 404 });
        }

        // 2. Résoudre l'email Supabase Auth depuis le numéro de téléphone
        const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
        const loginEmail = authUser?.user?.email;

        if (!loginEmail) {
            return NextResponse.json({ error: 'Impossible de vérifier l\'identité.' }, { status: 500 });
        }

        // 3. Valider l'ancien mot de passe via signInWithPassword (vrai check côté Supabase Auth)
        const { createClient } = await import('@supabase/supabase-js');
        const anonClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { error: signInErr } = await anonClient.auth.signInWithPassword({
            email: loginEmail,
            password: current_password,
        });

        if (signInErr) {
            return NextResponse.json({ error: 'Mot de passe actuel incorrect.' }, { status: 400 });
        }

        // 4. Mettre à jour avec le nouveau mot de passe
        const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
            password: new_password,
        });

        if (updateErr) {
            console.error('[PATCH /api/controller/profile] updateUserById:', updateErr.message);
            return NextResponse.json({ error: 'Impossible de mettre à jour le mot de passe.' }, { status: 500 });
        }

        // 5. Audit
        await AdminService.logAudit({
            userId: user.id,
            userRole: user.role as any,
            action: 'PASSWORD_CHANGED',
            objectType: 'users',
            objectId: user.id,
            metadata: { source: 'controller-profile' },
        });

        return NextResponse.json({
            success: true,
            message: 'Mot de passe mis à jour avec succès.',
        });
    } catch (err: unknown) {
        console.error('[PATCH /api/controller/profile]', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Erreur interne.' }, { status: 500 });
    }
}
