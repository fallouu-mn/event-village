/**
 * Design 1d (point 5) — image d'aperçu de partage d'un événement publié (1 200 × 630, PNG) : affiche entière à gauche
 * sur la couleur de l'affiche, à droite le logo Bras levés, le titre, la date et l'heure (Dakar), le lieu et le prix
 * d'appel en orange. Rendue par next/og (satori), polices Plus Jakarta Sans statiques (lib/og/fonts, licence OFL).
 * L'affiche n'est lue que dans le stockage public du projet (isProjectStorageImage), convertie en JPEG par sharp ; sans
 * affiche lisible, le logo prend sa place. Module serveur. La règle « événement publié seulement » est appliquée par la
 * route (app/api/events/[id]/apercu/route.ts) AVANT tout appel ici.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import sharp from 'sharp';
import { ImageResponse } from 'next/og';
import { isProjectStorageImage } from '@/lib/events/event-image';
import { posterColorOrFallback } from '@/lib/events/poster-color';
import { SHARE_PREVIEW_HEIGHT, SHARE_PREVIEW_WIDTH } from '@/lib/events/share-preview';
import { IMAGE_MAX_INPUT_PIXELS } from '@/lib/images/encode-image';

export interface SharePreviewData {
    title: string;
    /** « Samedi 21 novembre 2026 · 20:00 ». */
    when: string;
    /** « Grand Théâtre · Dakar ». */
    place: string;
    /** « Dès 5 000 F CFA », null : rien. */
    price: string | null;
    posterUrl: string | null;
    posterColor: string | null;
}

const POSTER_W = 440;
const POSTER_H = 550;
const POSTER_FETCH_TIMEOUT_MS = 5000;
/** Colonne du texte : 1 200 - 2 × 40 (marges) - 440 (affiche) - 48 (écart). */
const TEXT_W = SHARE_PREVIEW_WIDTH - 80 - POSTER_W - 48;

type Font = { name: string; data: Buffer; weight: 600 | 700 | 800; style: 'normal' };
let fontsPromise: Promise<Font[]> | null = null;
let logoPromise: Promise<string> | null = null;

function loadFonts(): Promise<Font[]> {
    fontsPromise ??= Promise.all(([['SemiBold', 600], ['Bold', 700], ['ExtraBold', 800]] as const).map(async ([file, weight]) => ({
        name: 'Plus Jakarta Sans',
        data: await fs.readFile(path.join(process.cwd(), 'lib/og/fonts', `PlusJakartaSans-${file}.ttf`)),
        weight,
        style: 'normal' as const,
    })));
    return fontsPromise;
}

function loadLogo(): Promise<string> {
    logoPromise ??= fs.readFile(path.join(process.cwd(), 'public/branding/bras-leves-symbole.svg'))
        .then((svg) => `data:image/svg+xml;base64,${svg.toString('base64')}`);
    return logoPromise;
}

/** Affiche du stockage du projet en JPEG (data:), contenue dans 440 × 550 sur la couleur de l'affiche ; null sinon. */
async function posterData(url: string | null, background: string): Promise<string | null> {
    if (!isProjectStorageImage(url)) return null;
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(POSTER_FETCH_TIMEOUT_MS), cache: 'no-store' });
        if (!res.ok) {
            console.warn(`[aperçu] affiche illisible (${res.status}) : ${url}`);
            return null;
        }
        const jpeg = await sharp(Buffer.from(await res.arrayBuffer()), { limitInputPixels: IMAGE_MAX_INPUT_PIXELS })
            .rotate()
            .resize({ width: POSTER_W, height: POSTER_H, fit: 'contain', background })
            .flatten({ background })
            .jpeg({ quality: 82 })
            .toBuffer();
        return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
    } catch (err) {
        console.warn(`[aperçu] affiche non chargée : ${url} :`, err instanceof Error ? err.message : String(err));
        return null;
    }
}

function titleSize(title: string): number {
    if (title.length > 70) return 44;
    if (title.length > 40) return 52;
    return 62;
}

/** Titre coupé proprement (trois lignes au plus à l'écran : 110 caractères au plus). */
function shortTitle(title: string): string {
    const clean = title.replace(/\s+/g, ' ').trim();
    if (clean.length <= 110) return clean;
    return `${clean.slice(0, 107).replace(/\s+\S*$/, '')}…`;
}

/** PNG de l'aperçu. */
export async function renderSharePreview(data: SharePreviewData): Promise<Buffer> {
    const color = posterColorOrFallback(data.posterColor);
    const [fonts, logo, poster] = await Promise.all([loadFonts(), loadLogo(), posterData(data.posterUrl, color)]);
    const title = shortTitle(data.title);
    const h = React.createElement;

    const tree = h('div', {
        style: {
            display: 'flex', width: '100%', height: '100%', backgroundColor: color, color: '#ffffff',
            fontFamily: 'Plus Jakarta Sans', padding: 40, gap: 48, alignItems: 'center',
            backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)',
        },
    },
    h('div', {
        style: {
            display: 'flex', width: POSTER_W, height: POSTER_H, flexShrink: 0, borderRadius: 28, overflow: 'hidden',
            alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.18)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
        },
    }, poster
        ? h('img', { src: poster, width: POSTER_W, height: POSTER_H, style: { objectFit: 'contain' } })
        : h('img', { src: logo, width: 220, height: 200 })),
    h('div', { style: { display: 'flex', flexDirection: 'column', width: TEXT_W, height: POSTER_H, justifyContent: 'space-between' } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 16 } },
            h('img', { src: logo, width: 56, height: 51 }),
            h('div', { style: { display: 'flex', fontSize: 30, fontWeight: 800, letterSpacing: -0.5 } }, 'Event Village')),
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 18 } },
            h('div', { style: { display: 'flex', width: TEXT_W, fontSize: titleSize(title), fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 } }, title),
            h('div', { style: { display: 'flex', fontSize: 30, fontWeight: 700 } }, data.when),
            data.place ? h('div', { style: { display: 'flex', fontSize: 26, fontWeight: 600, color: 'rgba(255,255,255,0.88)' } }, data.place) : null),
        h('div', { style: { display: 'flex', alignItems: 'center' } },
            data.price
                ? h('div', {
                    style: {
                        display: 'flex', backgroundColor: '#FF8A3D', color: '#1A1A1A', fontSize: 32, fontWeight: 800,
                        padding: '14px 28px', borderRadius: 999,
                    },
                }, data.price)
                : h('div', { style: { display: 'flex', fontSize: 28, fontWeight: 700 } }, 'Billets sur Event Village'))));

    const res = new ImageResponse(tree, { width: SHARE_PREVIEW_WIDTH, height: SHARE_PREVIEW_HEIGHT, fonts });
    return Buffer.from(await res.arrayBuffer());
}
