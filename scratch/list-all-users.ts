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

async function listAll() {
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    console.log('--- AUTH USERS (' + authUsers.users.length + ') ---');
    authUsers.users.forEach(u => {
        console.log(`- ID: ${u.id}, Email: ${u.email}, Phone: ${u.phone || u.user_metadata?.phone}`);
    });

    const { data: dbUsers } = await supabaseAdmin.from('users').select('*');
    console.log('--- PUBLIC USERS (' + (dbUsers?.length || 0) + ') ---');
    dbUsers?.forEach(u => {
        console.log(`- ID: ${u.id}, Name: ${u.first_name} ${u.last_name}, Email: ${u.email}, Phone: ${u.phone}`);
    });
}

listAll();
