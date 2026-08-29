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

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspect() {
    console.log('--- 1. PARTNERS TABLE ---');
    const { data: partners, error: pErr } = await supabase.from('partners').select('*');
    if (pErr) console.error('partners error:', pErr);
    else console.log('Found partners count:', partners?.length, partners);

    console.log('--- 2. USERS TABLE ---');
    const { data: users, error: uErr } = await supabase.from('users').select('*');
    if (uErr) console.error('users error:', uErr);
    else console.log('Found users count:', users?.length, users);

    console.log('--- 3. AUDIT_LOGS TABLE ---');
    const { data: audit, error: aErr } = await supabase.from('audit_logs').select('*').limit(5);
    if (aErr) console.error('audit_logs error:', aErr);
    else console.log('Found audit count:', audit?.length, audit);

    console.log('--- 4. ORDERS TABLE ---');
    const { data: orders, error: oErr } = await supabase.from('orders').select('*').limit(5);
    if (oErr) console.error('orders error:', oErr);
    else console.log('Found orders count:', orders?.length);

    console.log('--- 5. COMMISSIONS TABLE ---');
    const { data: comms, error: cErr } = await supabase.from('commissions').select('*').limit(5);
    if (cErr) console.error('commissions error:', cErr);
    else console.log('Found commissions count:', comms?.length);
}

inspect();
