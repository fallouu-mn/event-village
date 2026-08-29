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

const username = process.env.MTARGET_USERNAME;
const password = process.env.MTARGET_PASSWORD;
const service = process.env.MTARGET_SERVICE_ID || '36233';

async function checkDlrAndTestFormats() {
    console.log('=== TEST DLR ET FORMATS MTARGET ===');

    // 1. Tester la requête de statut (DLR) sur un ticket précédent
    const ticket = 'f83e14b1-a3cc-11f1-8938-00000a148c01';
    console.log(`\n1. Vérification DLR du ticket ${ticket}...`);
    try {
        const dlrUrl = `https://api-public-2.mtarget.fr/messages/${ticket}?username=${username}&password=${password}&service=${service}`;
        const resDlr = await fetch(dlrUrl);
        const textDlr = await resDlr.text();
        console.log(`DLR Status: ${resDlr.status}, Response: ${textDlr}`);
    } catch (e) {
        console.log('Erreur DLR:', e);
    }

    // 2. Tester l'envoi avec différents formats de numéro et sans tiret dans le sender
    // NOTE: Les pare-feux SMSC Orange/Free bloquent souvent les tirets '-' dans le sender ID
    const variations = [
        { name: '00221 + Sender alphanumérique pur "EVVillage"', msisdn: '00221778742285', sender: 'EVVillage' },
        { name: '221 (sans 00) + Sender "EVVillage"', msisdn: '221778742285', sender: 'EVVillage' },
        { name: '00221 + Sender par défaut "36233"', msisdn: '00221778742285', sender: '36233' },
        { name: '00221 + Sender "EVENT"', msisdn: '00221778742285', sender: 'EVENT' },
    ];

    for (const v of variations) {
        console.log(`\n--- Test: ${v.name} ---`);
        const payload = {
            username,
            password,
            service,
            sender: v.sender,
            msisdn: v.msisdn,
            msg: `Code Event Village: ${Math.floor(100000 + Math.random() * 900000)} (Test ${v.sender})`,
        };

        const res = await fetch('https://api-public-2.mtarget.fr/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const text = await res.text();
        console.log(`Response: ${res.status} ${text}`);
    }
}

checkDlrAndTestFormats();
