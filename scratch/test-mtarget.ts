import fs from 'fs';
import path from 'path';

// Parsing manuel du fichier .env.local
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

async function testDirectMTarget() {
    const username = process.env.MTARGET_USERNAME;
    const password = process.env.MTARGET_PASSWORD;
    const service = process.env.MTARGET_SERVICE_ID || '36233';
    const sender = process.env.MTARGET_SENDER || 'EV-Village';
    const apiUrl = process.env.MTARGET_API_URL || 'https://api-public-2.mtarget.fr/messages';
    const recipient = '00221778742285';
    const msg = 'Test Event Village Code OTP : 123456';

    console.log('=== TEST MTARGET ENVOI DIRECT ===');
    console.log('API URL:', apiUrl);
    console.log('Username:', username);
    console.log('Password length:', password?.length);
    console.log('Service:', service);
    console.log('Sender:', sender);
    console.log('Recipient:', recipient);

    // Test 1: JSON Payload
    console.log('\n--- Tentative 1: application/json ---');
    try {
        const jsonPayload = {
            username,
            password,
            service,
            sender,
            msisdn: recipient,
            msg,
        };
        const resJson = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(jsonPayload),
        });
        const textJson = await resJson.text();
        console.log(`Status JSON: ${resJson.status} ${resJson.statusText}`);
        console.log('Response JSON:', textJson);
    } catch (e) {
        console.error('Erreur JSON:', e);
    }

    // Test 2: URL Encoded Form Payload (standard historique MTarget)
    console.log('\n--- Tentative 2: application/x-www-form-urlencoded ---');
    try {
        const formParams = new URLSearchParams();
        formParams.append('username', username || '');
        formParams.append('password', password || '');
        formParams.append('service', service);
        formParams.append('sender', sender);
        formParams.append('msisdn', recipient);
        formParams.append('msg', msg);

        const resForm = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formParams.toString(),
        });
        const textForm = await resForm.text();
        console.log(`Status Form: ${resForm.status} ${resForm.statusText}`);
        console.log('Response Form:', textForm);
    } catch (e) {
        console.error('Erreur Form:', e);
    }

    // Test 3: GET query params (MTarget HTTP GET API)
    console.log('\n--- Tentative 3: GET avec query params ---');
    try {
        const getUrl = new URL(apiUrl);
        getUrl.searchParams.set('username', username || '');
        getUrl.searchParams.set('password', password || '');
        getUrl.searchParams.set('service', service);
        getUrl.searchParams.set('sender', sender);
        getUrl.searchParams.set('msisdn', recipient);
        getUrl.searchParams.set('msg', msg);

        const resGet = await fetch(getUrl.toString(), { method: 'GET' });
        const textGet = await resGet.text();
        console.log(`Status GET: ${resGet.status} ${resGet.statusText}`);
        console.log('Response GET:', textGet);
    } catch (e) {
        console.error('Erreur GET:', e);
    }
}

testDirectMTarget();
