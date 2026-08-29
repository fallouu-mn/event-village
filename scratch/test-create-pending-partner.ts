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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function createPendingPartner() {
    console.log('Création d\'un compte utilisateur gérant partenaire...');
    const partnerEmail = 'contact@terangaprestige.sn';
    const partnerPhone = '+221775556677';

    // 1. Create or get auth user
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: partnerEmail,
        password: 'Partner2026!',
        email_confirm: true,
        user_metadata: {
            first_name: 'Amadou',
            last_name: 'Ba',
            phone: partnerPhone,
            role: 'PARTENAIRE',
        },
    });

    let userId: string;
    if (authErr) {
        const { data: list } = await supabase.auth.admin.listUsers();
        const found = list.users.find(u => u.email === partnerEmail);
        userId = found!.id;
    } else {
        userId = authUser.user.id;
    }

    // 2. Insert into public.users
    await supabase.from('users').upsert({
        id: userId,
        first_name: 'Amadou',
        last_name: 'Ba',
        email: partnerEmail,
        phone: partnerPhone,
        role: 'PARTENAIRE',
        status: 'EN_ATTENTE',
        referral_status: 'STANDARD',
        updated_at: new Date().toISOString(),
    });

    // 3. Insert into public.partners
    const { data: existingPartner } = await supabase.from('partners').select('id').eq('user_id', userId).maybeSingle();
    let partnerId: string;

    if (existingPartner) {
        partnerId = existingPartner.id;
        await supabase.from('partners').update({
            company_name: 'Le Teranga Prestige Traiteur',
            commercial_name: 'Teranga Traiteur Dakar',
            status: 'EN_ATTENTE',
            is_verified: false,
        }).eq('id', partnerId);
    } else {
        const { data: newP, error: pErr } = await supabase.from('partners').insert({
            user_id: userId,
            company_name: 'Le Teranga Prestige Traiteur',
            commercial_name: 'Teranga Traiteur Dakar',
            description: 'Service traiteur gastronomique, buffets haut de gamme et réceptions privées.',
            address: 'Route des Almadies, Dakar',
            city: 'Dakar',
            phone: partnerPhone,
            email: partnerEmail,
            status: 'EN_ATTENTE',
            is_verified: false,
        }).select().single();

        if (pErr) {
            console.error('Erreur insert partner:', pErr);
            return;
        }
        partnerId = newP.id;
    }

    // 4. Insert activities
    await supabase.from('partner_activities').insert([
        { partner_id: partnerId, activity_type: 'RESTAURANT', is_active: true },
        { partner_id: partnerId, activity_type: 'TRAITEUR', is_active: true },
    ]);

    // 5. Insert audit log
    await supabase.from('audit_logs').insert({
        user_id: userId,
        user_role: 'PARTENAIRE',
        action: 'INSERT',
        object_type: 'partners',
        object_id: partnerId,
        old_value: null,
        new_value: { company_name: 'Le Teranga Prestige Traiteur', status: 'EN_ATTENTE' },
        metadata: { company_name: 'Le Teranga Prestige Traiteur' },
    });

    console.log('✅ Partenaire en attente créé avec succès (ID:', partnerId, ')');
}

createPendingPartner();
