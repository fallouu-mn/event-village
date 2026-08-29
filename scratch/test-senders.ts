import fs from 'fs';
import path from 'path';

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

async function testSenderOptions() {
    const username = process.env.MTARGET_USERNAME;
    const password = process.env.MTARGET_PASSWORD;
    const service = process.env.MTARGET_SERVICE_ID || '36233';
    const apiUrl = 'https://api-public-2.mtarget.fr/messages';
    const recipient = '00221778742285';

    const senders = ['EV-Village', '36233', 'EventVillage', 'Village'];

    for (const sender of senders) {
        console.log(`\n--- Test avec Sender: "${sender}" ---`);
        const payload = {
            username,
            password,
            service,
            sender,
            msisdn: recipient,
            msg: `Event Village code OTP: 356478 (Sender: ${sender})`,
        };

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        console.log(`Status: ${res.status}, Response: ${text}`);
    }
}

testSenderOptions();
