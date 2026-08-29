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

async function testMagicLink() {
    const targetPhone = '+221778742285';
    console.log('Recherche du profil utilisateur pour le numéro:', targetPhone);

    const { data: userProfile, error: profileErr } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('phone', targetPhone)
        .maybeSingle();

    console.log('User Profile trouvé:', userProfile);

    if (userProfile?.email) {
        console.log('Génération du lien magiclink pour:', userProfile.email);
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: userProfile.email,
        });

        if (linkErr) {
            console.error('Erreur generateLink:', linkErr);
        } else {
            console.log('Link data généré:', {
                hashed_token: linkData.properties?.hashed_token,
                email_otp: linkData.properties?.email_otp,
                action_link: linkData.properties?.action_link,
            });
        }
    }
}

testMagicLink();
