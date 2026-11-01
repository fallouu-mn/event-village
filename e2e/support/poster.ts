/**
 * Lot 5.1 — affiches et logos générés (HTML rendu en PNG par Playwright), sans aucune image ni
 * police externe : rendu déterministe à partir des seules données de l'événement. Utilisé par le
 * seed de démonstration (tests/seed/seed-demo.ts) et par le test de fumée (affiche téléversée).
 * Toutes les données affichées sont fictives.
 */
import type { Browser } from '@playwright/test';

export interface PosterPalette {
    from: string;
    to: string;
    accent: string;
    ink: string;
}

export const PALETTES: Record<string, PosterPalette> = {
    terre: { from: '#7C2D12', to: '#C2410C', accent: '#FDE68A', ink: '#FFF7ED' },
    ocean: { from: '#0C4A6E', to: '#0E7490', accent: '#FDE047', ink: '#F0F9FF' },
    savane: { from: '#3F3F10', to: '#A16207', accent: '#FEF3C7', ink: '#FFFBEB' },
    nuit: { from: '#0F172A', to: '#1E3A8A', accent: '#F59E0B', ink: '#F8FAFC' },
    bissap: { from: '#701A2E', to: '#BE123C', accent: '#FBCFE8', ink: '#FFF1F2' },
    lagune: { from: '#134E4A', to: '#0F766E', accent: '#FCD34D', ink: '#F0FDFA' },
    sable: { from: '#78350F', to: '#D97706', accent: '#FFFBEB', ink: '#FFFBEB' },
    indigo: { from: '#172554', to: '#1D4ED8', accent: '#FDBA74', ink: '#EFF6FF' },
};

export type PosterMotif = 'soleil' | 'vagues' | 'bandes' | 'etoiles' | 'damier';

export interface PosterSpec {
    title: string;
    kicker: string;
    dateLabel: string;
    venue: string;
    city: string;
    organizer: string;
    palette: keyof typeof PALETTES;
    motif: PosterMotif;
}

export const POSTER_SIZE = { width: 1200, height: 750 } as const;

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function motifSvg(motif: PosterMotif, p: PosterPalette): string {
    switch (motif) {
        case 'soleil':
            return `<svg width="1200" height="750" viewBox="0 0 1200 750"><circle cx="930" cy="250" r="190" fill="${p.accent}" opacity="0.92"/>`
                + `<circle cx="930" cy="250" r="250" fill="none" stroke="${p.accent}" stroke-width="3" opacity="0.5"/>`
                + `<circle cx="930" cy="250" r="310" fill="none" stroke="${p.accent}" stroke-width="2" opacity="0.3"/></svg>`;
        case 'vagues':
            return `<svg width="1200" height="750" viewBox="0 0 1200 750">`
                + [0, 1, 2, 3, 4].map((i) => `<path d="M0 ${470 + i * 52} C 200 ${430 + i * 52}, 400 ${510 + i * 52}, 600 ${470 + i * 52} S 1000 ${430 + i * 52}, 1200 ${470 + i * 52}" fill="none" stroke="${p.accent}" stroke-width="${6 - i}" opacity="${0.85 - i * 0.14}"/>`).join('')
                + '</svg>';
        case 'bandes':
            return `<svg width="1200" height="750" viewBox="0 0 1200 750">`
                + Array.from({ length: 9 }, (_, i) => `<rect x="${760 + i * 48}" y="0" width="22" height="750" fill="${p.accent}" opacity="${0.15 + (i % 3) * 0.18}" transform="skewX(-12)"/>`).join('')
                + `<polygon points="820,560 960,300 1100,560" fill="none" stroke="${p.accent}" stroke-width="5"/></svg>`;
        case 'etoiles':
            return `<svg width="1200" height="750" viewBox="0 0 1200 750">`
                + Array.from({ length: 28 }, (_, i) => {
                    const x = 640 + ((i * 137) % 540);
                    const y = 40 + ((i * 89) % 640);
                    const r = 2 + (i % 4);
                    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.accent}" opacity="${0.4 + (i % 5) * 0.12}"/>`;
                }).join('')
                + `<path d="M980 120 a110 110 0 1 0 90 190 a90 90 0 1 1 -90 -190z" fill="${p.accent}"/></svg>`;
        case 'damier':
        default:
            return `<svg width="1200" height="750" viewBox="0 0 1200 750">`
                + Array.from({ length: 6 }, (_, r) => Array.from({ length: 6 }, (__, c) => ((r + c) % 2 === 0
                    ? `<rect x="${800 + c * 60}" y="${150 + r * 60}" width="60" height="60" fill="${p.accent}" opacity="${0.25 + ((r * 6 + c) % 4) * 0.15}"/>`
                    : '')).join('')).join('')
                + '</svg>';
    }
}

export function posterHtml(spec: PosterSpec): string {
    const p = PALETTES[spec.palette];
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${POSTER_SIZE.width}px; height: ${POSTER_SIZE.height}px; overflow: hidden; }
body { background: linear-gradient(135deg, ${p.from} 0%, ${p.to} 100%); color: ${p.ink};
  font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif; position: relative; }
.motif { position: absolute; inset: 0; }
.grain { position: absolute; inset: 0; background: radial-gradient(circle at 20% 110%, rgba(0,0,0,0.35), transparent 55%); }
.content { position: absolute; left: 72px; top: 72px; width: 660px; }
.kicker { display: inline-block; font-size: 22px; letter-spacing: 6px; text-transform: uppercase; color: ${p.accent};
  border: 2px solid ${p.accent}; padding: 8px 18px; border-radius: 999px; }
h1 { font-family: "DejaVu Serif", "Liberation Serif", Georgia, serif; font-size: 70px; line-height: 1.04; margin-top: 34px; font-weight: 700; }
.date { margin-top: 34px; font-size: 30px; font-weight: 700; }
.venue { margin-top: 10px; font-size: 26px; opacity: 0.92; }
.organizer { position: absolute; left: 72px; bottom: 56px; font-size: 20px; letter-spacing: 3px; text-transform: uppercase; opacity: 0.85; }
.bar { position: absolute; left: 72px; bottom: 100px; width: 120px; height: 6px; background: ${p.accent}; }
</style></head><body>
<div class="motif">${motifSvg(spec.motif, p)}</div><div class="grain"></div>
<div class="content"><span class="kicker">${esc(spec.kicker)}</span><h1>${esc(spec.title)}</h1>
<p class="date">${esc(spec.dateLabel)}</p><p class="venue">${esc(spec.venue)} · ${esc(spec.city)}</p></div>
<div class="bar"></div><p class="organizer">${esc(spec.organizer)}</p>
</body></html>`;
}

export function logoHtml(initials: string, palette: keyof typeof PALETTES): string {
    const p = PALETTES[palette];
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>
* { margin: 0; padding: 0; } html, body { width: 256px; height: 256px; overflow: hidden; background: transparent; }
.l { width: 256px; height: 256px; border-radius: 50%; background: linear-gradient(135deg, ${p.from}, ${p.to});
  display: flex; align-items: center; justify-content: center; color: ${p.ink};
  font-family: "DejaVu Serif", "Liberation Serif", Georgia, serif; font-size: 104px; font-weight: 700; letter-spacing: -2px; }
</style></head><body><div class="l">${esc(initials)}</div></body></html>`;
}

/** Rendu PNG d'un document HTML autonome (aucune ressource réseau : tout est en ligne). */
export async function renderPng(browser: Browser, html: string, size: { width: number; height: number }, transparent = false): Promise<Buffer> {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, colorScheme: 'light' });
    try {
        await context.route('**/*', (route) => route.abort('blockedbyclient'));
        const page = await context.newPage();
        await page.setContent(html, { waitUntil: 'load' });
        return await page.screenshot({ type: 'png', omitBackground: transparent, animations: 'disabled' });
    } finally {
        await context.close();
    }
}

/** Date en français, fuseau Africa/Dakar : « samedi 15 novembre 2026 · 20:00 ». */
export function dakarDateLabel(at: Date): string {
    const day = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(at);
    const time = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar', hour: '2-digit', minute: '2-digit', hour12: false }).format(at);
    return `${day} · ${time}`;
}
