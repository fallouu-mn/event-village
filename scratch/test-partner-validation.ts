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

async function testValidation() {
    const partnerId = '5c0a23d5-db8a-422c-b2e4-24bcbe13fe24';
    console.log(`Test de validation du partenaire ${partnerId}...`);

    // 1. Update status to VALIDE
    const { data: updatedP, error: pErr } = await supabase
        .from('partners')
        .update({
            status: 'VALIDE',
            is_verified: true,
            updated_at: new Date().toISOString(),
        })
        .eq('id', partnerId)
        .select('*, users(*)').single();

    if (pErr) console.error('Erreur update partner:', pErr);

    // 2. Insert audit log
    await supabase.from('audit_logs').insert({
        user_id: updatedP?.user_id,
        user_role: 'SUPERADMIN',
        action: 'STATUS_CHANGE',
        object_type: 'partners',
        object_id: partnerId,
        old_value: { status: 'EN_ATTENTE' },
        new_value: { status: 'VALIDE', is_verified: true },
        metadata: { company_name: updatedP?.company_name, updated_by: 'SUPERADMIN' },
    });

    console.log('✅ Partenaire validé avec audit log :', updatedP?.company_name, 'Statut:', updatedP?.status);

    // Revert back to EN_ATTENTE for user interactive testing
    await supabase.from('partners').update({ status: 'EN_ATTENTE', is_verified: false }).eq('id', partnerId);
    console.log('🔄 Partenaire remis à "EN_ATTENTE" pour que le Superadmin puisse cliquer sur "Valider" dans l\'UI !');
}

testValidation();
