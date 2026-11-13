import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Taille maximale d'un rapport (un rapport de navigateur fait moins de 2 Ko). */
const MAX_REPORT_BYTES = 8 * 1024;
/** Violations distinctes journalisées par processus (au-delà, plus rien n'est écrit : aucun remplissage du journal). */
const MAX_DISTINCT = 200;

const seen = new Set<string>();

function text(v: unknown, max = 200): string {
    return typeof v === 'string' ? v.slice(0, max) : '';
}

/** Chemin seul d'une adresse de page (jamais la requête : elle peut porter un jeton). */
function pathOf(v: unknown): string {
    try {
        return new URL(String(v)).pathname.slice(0, 200);
    } catch {
        return '';
    }
}

/**
 * POST /api/csp-report — lot 9 quater (F4 : AUD-11). Reçoit les rapports de la CSP en mode rapport seulement
 * (`Content-Security-Policy-Report-Only`, next.config.mjs) et journalise chaque violation distincte une fois par
 * processus, ligne `[CSP-REPORT] {directive} {adresse bloquée} {page}` : relevées dans next-start.log de la CI pour le
 * rapport, avant la CSP bloquante du lot de mise en ligne. Publique (le navigateur l'appelle sans session), corps de
 * 8 Ko au plus, toujours 204, rien n'est stocké en base.
 */
export async function POST(req: NextRequest) {
    const announced = Number(req.headers.get('content-length') ?? '');
    if (Number.isFinite(announced) && announced > MAX_REPORT_BYTES) return new NextResponse(null, { status: 413 });
    let raw: string;
    try {
        raw = await req.text();
    } catch (err) {
        console.warn('[CSP-REPORT] rapport illisible :', err instanceof Error ? err.message : String(err));
        return new NextResponse(null, { status: 204 });
    }
    if (raw.length > MAX_REPORT_BYTES) return new NextResponse(null, { status: 413 });
    let body: unknown;
    try {
        body = JSON.parse(raw);
    } catch {
        return new NextResponse(null, { status: 204 });
    }
    const report = (body && typeof body === 'object' && 'csp-report' in body ? (body as Record<string, unknown>)['csp-report'] : body) as Record<string, unknown> | null;
    if (!report || typeof report !== 'object') return new NextResponse(null, { status: 204 });
    const directive = text(report['effective-directive'] ?? report['violated-directive'], 80);
    const blocked = text(report['blocked-uri'], 200);
    const page = pathOf(report['document-uri']);
    const key = `${directive} ${blocked}`;
    if (!seen.has(key) && seen.size < MAX_DISTINCT) {
        seen.add(key);
        console.warn(`[CSP-REPORT] ${directive} ${blocked || '(inline)'} ${page}`);
    }
    return new NextResponse(null, { status: 204 });
}
