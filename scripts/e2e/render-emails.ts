/**
 * Lot 7 (tâche 7.9, contrat 19.9, décision D98) — rendu des emails de confirmation pour la capture, sans aucune
 * route ni mode de test dans l'application livrée : le catalogue réel (lib/notifications/catalog.ts, même fonction
 * que l'envoyeur) rend chaque email à partir de données d'exemple FIXES et FICTIVES ; Playwright (e2e/emails.spec.ts)
 * les affiche ensuite par page.setContent, sans serveur d'application.
 *
 *   node --import tsx scripts/e2e/render-emails.ts [--out <dossier>]
 *
 * Emails rendus (7) : PURCHASE_CONFIRMED pour 1 billet, 4 billets de deux catégories et 12 billets (10 numéros puis
 * « et 2 autres ») ; FREE_TICKETS_CONFIRMED pour 2 billets ; TRANSFER_RECEIVED (nouveau numéro, sans montant).
 * Lot 9 bis (G.51, contrat 7.2, T11) : + EMAIL_VERIFICATION (lien de vérification, rendu par renderEmailVerification
 * comme lib/email/verification.ts, jeton factice jamais émis) et EVENT_CHANGED (changement de date, indispensable
 * générique, désormais aussi par email).
 * Sorties : <dossier>/<id>.html et <id>.txt (défaut .e2e-captures/emails/) ; la dernière ligne de la sortie standard
 * est le manifeste JSON { dir, emails: [{ id, type, subject, html, text }] }.
 * Lien de l'application : http://localhost:3000 (contrat 19.9), jamais une adresse de production. Aucune base,
 * aucun réseau, aucun secret : seul le module de rendu est importé (même modèle que scripts/e2e/clock-run.ts).
 */
import fs from 'node:fs';
import path from 'node:path';

const TAG = '[render-emails]';
const APP_URL = 'http://localhost:3000';

const EVENT = {
    event_id: '3c9e1f20-5b7a-4d8e-9f10-2a4b6c8d0e12',
    title: 'Nuit du Sabar — édition d’automne',
    start_at: '2026-11-14T20:30:00.000Z',
    location: 'Esplanade de la Corniche Ouest',
    city: 'Dakar',
};

/** Numéros au format réel TCK-AAAAMMJJ-XXXXXXXXXX, triés comme notif_ticket_lines (catégorie, puis numéro). */
function numbers(prefix: string, n: number): string[] {
    return Array.from({ length: n }, (_, i) => `TCK-20261104-${prefix}${String(i + 1).padStart(10 - prefix.length, '0')}`);
}

interface Sample {
    id: string;
    type: 'PURCHASE_CONFIRMED' | 'FREE_TICKETS_CONFIRMED' | 'TRANSFER_RECEIVED' | 'EVENT_CHANGED' | 'EMAIL_VERIFICATION';
    data: Record<string, unknown>;
}

/** Lot 9 bis : jeton factice du lien de vérification (format base64url du vrai, jamais émis ni enregistré). */
const VERIFICATION_TOKEN = 'e2e-jeton-factice-du-lien-de-verification-0123456789';

const TWELVE = numbers('7C2D', 12);

const SAMPLES: Sample[] = [
    {
        id: 'achat-1-billet', type: 'PURCHASE_CONFIRMED',
        data: {
            ...EVENT, payment_id: '1f6e2b9c-7d3a-4c8e-9b21-0a5d3e7f8c42', ticket_count: 1, service_fee: 250, total: 5_250,
            categories: [{ name: 'Standard', quantity: 1 }], ticket_numbers: ['TCK-20261104-3F9A1C7E2B'],
        },
    },
    {
        id: 'achat-4-billets', type: 'PURCHASE_CONFIRMED',
        data: {
            ...EVENT, payment_id: '2a7f3cad-8e4b-4d9f-8c32-1b6e4f8a9d53', ticket_count: 4, service_fee: 1_000, total: 41_000,
            categories: [{ name: 'Standard', quantity: 2 }, { name: 'VIP', quantity: 2 }],
            ticket_numbers: [...numbers('A1B', 2), ...numbers('B2C', 2)],
        },
    },
    {
        id: 'achat-12-billets', type: 'PURCHASE_CONFIRMED',
        data: {
            ...EVENT, payment_id: '3b8a4dbe-9f5c-4ea0-9d43-2c7f5a9bae64', ticket_count: 12, service_fee: 3_000, total: 63_000,
            categories: [{ name: 'Standard', quantity: 12 }], ticket_numbers: TWELVE.slice(0, 10),
        },
    },
    {
        id: 'gratuits-2-billets', type: 'FREE_TICKETS_CONFIRMED',
        data: {
            ...EVENT, title: 'Matinée gospel et chorales', location: 'Théâtre de verdure de Sicap', ticket_count: 2,
            ticket_id: '4c9b5ecf-a06d-4fb1-8e54-3d8a6bacbf75', categories: [{ name: 'Entrée libre', quantity: 2 }],
            ticket_numbers: numbers('E5F', 2),
        },
    },
    {
        id: 'transfert-recu', type: 'TRANSFER_RECEIVED',
        data: {
            ...EVENT, transfer_id: '5dac6fd0-b17e-40c2-9f65-4e9b7cbdc086', ticket_id: '6ebd70e1-c28f-41d3-8a76-5fac8dcede97',
            ticket_number: 'TCK-20261104-9E4B1C7A2F', category: 'VIP',
        },
    },
    // Lot 9 bis (G.51) : indispensable générique (date changée), envoyé seulement à une adresse vérifiée (B96)
    {
        id: 'changement-date', type: 'EVENT_CHANGED',
        data: { ...EVENT, changed_fields: ['start_date', 'start_time'], new_start_at: '2026-11-21T21:00:00.000Z', start_at: '2026-11-21T21:00:00.000Z' },
    },
    // Lot 9 bis (R87, G.51) : lien de vérification d'une adresse, synchrone (aucune donnée d'événement)
    { id: 'verification-email', type: 'EMAIL_VERIFICATION', data: { token: VERIFICATION_TOKEN } },
];

function outDir(argv: string[]): string {
    const i = argv.indexOf('--out');
    if (i === -1) return path.resolve(process.cwd(), '.e2e-captures', 'emails');
    const value = argv[i + 1];
    if (!value) {
        process.stderr.write(`${TAG} --out : dossier attendu\n`);
        process.exit(2);
    }
    return path.resolve(process.cwd(), value);
}

async function main(): Promise<void> {
    const dir = outDir(process.argv.slice(2));
    const { renderEmailVerification, renderNotification } = await import('../../lib/notifications/catalog');
    fs.mkdirSync(dir, { recursive: true });
    const emails: Array<{ id: string; type: string; subject: string; html: string; text: string }> = [];
    for (const sample of SAMPLES) {
        const rendered = sample.type === 'EMAIL_VERIFICATION'
            ? { channel: 'EMAIL' as const, ...renderEmailVerification(String(sample.data.token), { appUrl: APP_URL }) }
            : renderNotification(sample.type, 'EMAIL', sample.data, { appUrl: APP_URL });
        if (rendered.channel !== 'EMAIL') throw new Error(`${TAG} ${sample.id} : canal ${rendered.channel} au lieu de EMAIL`);
        const html = path.join(dir, `${sample.id}.html`);
        const text = path.join(dir, `${sample.id}.txt`);
        fs.writeFileSync(html, rendered.html, 'utf8');
        fs.writeFileSync(text, `Objet : ${rendered.subject}\n\n${rendered.text}\n`, 'utf8');
        emails.push({ id: sample.id, type: sample.type, subject: rendered.subject, html, text });
        process.stderr.write(`${TAG} ${sample.id} (${sample.type}) : « ${rendered.subject} », HTML ${rendered.html.length} caractères\n`);
    }
    process.stdout.write(`${JSON.stringify({ dir, emails })}\n`);
}

main().catch((err: unknown) => {
    process.stderr.write(`${TAG} ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    process.exit(1);
});
