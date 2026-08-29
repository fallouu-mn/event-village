import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function createSuperAdmin() {
    const email = 'superadmin@eventvillage.sn';
    const phone = '+221770000000';
    const password = 'Admin2026!';

    console.log(`Création du compte Superadmin racine: ${email} (${phone})...`);

    // 1. Vérifier si un compte existe déjà dans auth.users
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
    const existing = listData.users.find(u => u.email === email || u.phone === phone);

    let userId: string;

    if (existing) {
        console.log(`Compte auth existant (ID: ${existing.id}), mise à jour du mot de passe et métadonnées...`);
        userId = existing.id;
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
            user_metadata: {
                first_name: 'Super',
                last_name: 'Admin',
                phone: phone,
                role: 'SUPERADMIN',
            },
        });
        if (updateErr) console.error('Erreur mise à jour auth:', updateErr);
    } else {
        console.log('Création du nouvel utilisateur auth...');
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                first_name: 'Super',
                last_name: 'Admin',
                phone: phone,
                role: 'SUPERADMIN',
            },
        });
        if (createErr) {
            console.error('Erreur création auth:', createErr);
            return;
        }
        userId = newUser.user.id;
    }

    // 2. Synchronisation / Insertion dans public.users
    console.log(`Synchronisation dans public.users avec le rôle SUPERADMIN (ID: ${userId})...`);
    const { error: dbErr } = await supabaseAdmin.from('users').upsert({
        id: userId,
        first_name: 'Super',
        last_name: 'Admin',
        phone: phone,
        email: email,
        role: 'SUPERADMIN',
        status: 'ACTIF',
        referral_status: 'STANDARD',
        updated_at: new Date().toISOString(),
    });

    if (dbErr) {
        console.error('Erreur insertion public.users:', dbErr);
    } else {
        console.log('✅ COMPTE SUPERADMIN CRÉÉ ET VALIDÉ AVEC SUCCÈS !');
        console.log('--------------------------------------------------');
        console.log('Email       : ' + email);
        console.log('Téléphone   : ' + phone + ' (ou 770000000)');
        console.log('Mot de passe: ' + password);
        console.log('Rôle        : SUPERADMIN');
        console.log('--------------------------------------------------');
    }
}

createSuperAdmin();
