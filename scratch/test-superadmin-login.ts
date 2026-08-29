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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabaseClient = createClient(supabaseUrl, anonKey);

async function testLogin() {
    console.log('Test de connexion avec superadmin@eventvillage.sn...');
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: 'superadmin@eventvillage.sn',
        password: 'Admin2026!',
    });

    if (error) {
        console.error('❌ Échec connexion:', error.message);
    } else {
        console.log('✅ CONNEXION RÉUSSIE !');
        console.log('Utilisateur connecté ID:', data.user.id);
        console.log('Email:', data.user.email);
        console.log('Rôle metadata:', data.user.user_metadata?.role);
    }
}

testLogin();
