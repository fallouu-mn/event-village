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

async function testPartnerRegisterAndSchema() {
    // Check partners table columns by selecting empty object
    const { data, error } = await supabase.from('partners').select('*').limit(1);
    console.log('partners error if any:', error);
    console.log('partners data:', data);

    const { data: auditCols } = await supabase.from('audit_logs').select('*').limit(1);
    console.log('audit_logs sample:', auditCols);
}

testPartnerRegisterAndSchema();
