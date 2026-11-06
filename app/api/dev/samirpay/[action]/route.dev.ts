/**
 * Lot 8 (contrat 3.13, L20) — POST /api/dev/samirpay/[action] : valider ou refuser un paiement simulé.
 * Corps `{ transactionId }` ; réponse `{ ok: true, status }` ou `{ error, code }`.
 *
 * Fichier `.dev.ts` : route présente sous `next dev` seulement (premier verrou, next.config.mjs). Deuxième
 * verrou : middleware.ts. Troisième : le contrôle ci-dessous. La route n'appelle que le faux service local,
 * sur 127.0.0.1, jamais une URL reçue. Aucune session : le téléphone d'essai n'est pas forcément connecté.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CONTROL_PATHS = new Map([['validate', 'complete'], ['refuse', 'fail']]);
const DEFAULT_FAKE_PORT = 4010;

const bodySchema = z.object({ transactionId: z.string().uuid() });

function notFound(): NextResponse {
    return new NextResponse(null, { status: 404 });
}

function fakePort(): number | null {
    const raw = process.env.EV_DEV_FAKE_PORT;
    const port = raw ? Number(raw) : DEFAULT_FAKE_PORT;
    return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

export async function POST(req: NextRequest, { params }: { params: { action: string } }): Promise<NextResponse> {
    if (process.env.NODE_ENV !== 'development' || process.env.EV_INTEGRATIONS !== 'fake') return notFound();
    const controlPath = CONTROL_PATHS.get(params.action);
    if (!controlPath) return notFound();

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Paiement simulé invalide.', code: 'INVALID_TRANSACTION' }, { status: 400 });
    const port = fakePort();
    if (port === null) return NextResponse.json({ error: 'EV_DEV_FAKE_PORT invalide.', code: 'FAKE_PORT_INVALID' }, { status: 500 });

    let res: Response;
    try {
        res = await fetch(`http://127.0.0.1:${port}/__test/samirpay/${controlPath}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ transactionId: parsed.data.transactionId }),
            cache: 'no-store',
        });
    } catch (err) {
        console.error('[dev/samirpay] faux service injoignable :', err);
        return NextResponse.json({ error: 'Faux service injoignable : lancez npm run fake:samirpay.', code: 'FAKE_SERVICE_DOWN' }, { status: 503 });
    }

    if (res.ok) {
        const done = (await res.json()) as { status?: string };
        return NextResponse.json({ ok: true, status: done.status ?? null });
    }
    console.error(`[dev/samirpay] ${params.action} refusé par le faux service : HTTP ${res.status}`);
    if (res.status === 404) return NextResponse.json({ error: 'Paiement simulé introuvable.', code: 'TRANSACTION_NOT_FOUND' }, { status: 404 });
    if (res.status === 409) return NextResponse.json({ error: 'Ce paiement simulé est déjà traité.', code: 'TRANSACTION_ALREADY_DONE' }, { status: 409 });
    return NextResponse.json({ error: 'Action impossible, voir la console du faux service.', code: 'FAKE_SERVICE_ERROR' }, { status: 502 });
}
