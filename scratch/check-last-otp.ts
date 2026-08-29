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

async function checkLatestOtp() {
    console.log('--- RECHERCHE DU DERNIER CODE OTP ---');
    try {
        const { data: otps, error } = await (supabaseAdmin.from('otp_codes') as any)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.log('Table otp_codes introuvable ou erreur:', error.message);
        } else {
            console.log('Derniers codes OTP générés en base :', otps);
        }
    } catch (e) {
        console.error('Erreur query otp_codes:', e);
    }

    try {
        const { data: users } = await supabaseAdmin
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(3);

        console.log('Derniers utilisateurs créés dans public.users :', users);
    } catch (e) {
        console.error('Erreur query users:', e);
    }
}

checkLatestOtp();
