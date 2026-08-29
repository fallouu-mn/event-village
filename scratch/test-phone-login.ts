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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
const supabaseAnon = createClient(supabaseUrl, anonKey);

async function testPhoneLogin() {
    const phoneInput = '770000000';
    console.log(`Recherche de l'email pour le numéro ${phoneInput}...`);

    const { data: userRow, error: findErr } = await supabaseAdmin
        .from('users')
        .select('email, role')
        .eq('phone', '+221770000000')
        .maybeSingle();

    if (!userRow) {
        console.error('Utilisateur introuvable.');
        return;
    }

    console.log(`Email résolu : ${userRow.email}, Rôle : ${userRow.role}`);
    console.log('Tentative de connexion avec le mot de passe...');

    const { data: loginData, error: loginErr } = await supabaseAnon.auth.signInWithPassword({
        email: userRow.email,
        password: 'Admin2026!',
    });

    if (loginErr) {
        console.error('❌ Échec:', loginErr.message);
    } else {
        console.log('✅ CONNEXION PAR TÉLÉPHONE VALIDÉE !');
        console.log('User ID:', loginData.user.id);
    }
}

testPhoneLogin();
