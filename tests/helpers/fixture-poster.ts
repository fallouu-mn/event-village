/**
 * Lot 5.1 — affiche PNG des fixtures du seed de test : petite image déterministe (320×200, bandes
 * diagonales aux couleurs dérivées du nom), encodée ici sans dépendance ni navigateur (le seed de
 * test tourne aussi dans l'étape verify, où Chromium n'est pas installé).
 * Module pur : aucun client Supabase.
 */
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const CRC_TABLE: number[] = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(buf: Buffer): number {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
}

/** PNG RVB 8 bits, identique d'une exécution à l'autre pour un même `name`. */
export function fixturePosterPng(name: string, width = 320, height = 200): Buffer {
    const h = createHash('sha256').update(name).digest();
    const dark = [40 + (h[0] % 60), 30 + (h[1] % 50), 30 + (h[2] % 70)];
    const light = [180 + (h[3] % 70), 120 + (h[4] % 100), 60 + (h[5] % 90)];
    const band = 18 + (h[6] % 14);
    const rows: Buffer[] = [];
    for (let y = 0; y < height; y++) {
        const row = Buffer.alloc(1 + width * 3);
        row[0] = 0; // filtre « aucun »
        for (let x = 0; x < width; x++) {
            const c = Math.floor((x + y) / band) % 2 === 0 ? dark : light;
            row[1 + x * 3] = c[0];
            row[2 + x * 3] = c[1];
            row[3 + x * 3] = c[2];
        }
        rows.push(row);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // profondeur
    ihdr[9] = 2; // RVB
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(Buffer.concat(rows), { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}
