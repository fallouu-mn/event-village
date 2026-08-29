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

async function testFetchAdminData() {
    console.log('--- TEST PARTNERS LIST ---');
    const { data: partners } = await supabase
        .from('partners')
        .select('id, company_name, status, phone, users(first_name, last_name, role), partner_activities(activity_type)');
    
    console.log('Partenaires réels trouvés:', JSON.stringify(partners, null, 2));

    console.log('--- TEST KPIS ---');
    const { data: allPartners } = await supabase.from('partners').select('status');
    const pending = allPartners?.filter(p => p.status === 'EN_ATTENTE').length || 0;
    const validated = allPartners?.filter(p => p.status === 'VALIDE').length || 0;
    console.log(`KPIs Réels: ${pending} en attente, ${validated} validés.`);
}

testFetchAdminData();
