import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Lecture de .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [k, ...v] = trimmed.split('=');
            if (k) process.env[k.trim()] = v.join('=').trim();
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Variables Supabase manquantes.');
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function deleteUserByEmailOrPhone() {
    const targetEmail = 'falloundiaye778742285@gmail.com';
    const targetPhone = '+221778742285';
    console.log(`Recherche de l'utilisateur avec email: ${targetEmail} ou phone: ${targetPhone}...`);

    // 1. Lister les utilisateurs auth.users
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
        console.error('Erreur listUsers:', listError);
        return;
    }

    const matchedUsers = usersData.users.filter(u => 
        u.email?.toLowerCase() === targetEmail.toLowerCase() ||
        u.phone === targetPhone ||
        u.user_metadata?.phone === targetPhone ||
        u.email?.includes('221778742285')
    );

    console.log(`Nombre d'utilisateurs trouvés dans auth.users : ${matchedUsers.length}`);

    for (const u of matchedUsers) {
        console.log(`Suppression de l'utilisateur auth : ID ${u.id} (${u.email || u.phone})...`);
        const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
        if (delAuthErr) {
            console.error(`Erreur suppression auth ${u.id}:`, delAuthErr);
        } else {
            console.log(`Utilisateur auth ${u.id} supprimé avec succès.`);
        }

        // Nettoyage public.users
        const { error: delProfileErr } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', u.id);
        if (delProfileErr) {
            console.warn('Warning suppression public.users:', delProfileErr);
        } else {
            console.log(`Profil public.users pour ${u.id} supprimé.`);
        }
    }

    // Nettoyage supplémentaire dans public.users par email ou téléphone
    await supabaseAdmin
        .from('users')
        .delete()
        .or(`email.eq.${targetEmail},phone.eq.${targetPhone}`);

    // Nettoyage otp_codes
    try {
        await (supabaseAdmin.from('otp_codes') as any)
            .delete()
            .or(`phone.eq.${targetPhone},phone.eq.00221778742285`);
        console.log('Codes OTP purgés.');
    } catch {}

    console.log('=== NETTOYAGE DU COMPTE TERMINÉ AVEC SUCCÈS ===');
}

deleteUserByEmailOrPhone();
