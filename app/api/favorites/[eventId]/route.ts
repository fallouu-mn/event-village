import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { setFavorite } from '@/lib/favorites/favorites.server';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';

export const dynamic = 'force-dynamic';

/** Ajouts et retraits de favoris au plus par compte et par heure. */
const FAVORITE_WRITES_PER_HOUR = 300;

const REFUSALS = {
    EVENT_NOT_FOUND: { status: 404, error: 'Cet événement n’est pas disponible.' },
    ACCOUNT_INACTIVE: { status: 403, error: 'Votre compte n’est pas actif.' },
    FAVORITES_LIMIT: { status: 409, error: 'Vous avez atteint 500 favoris. Retirez-en un pour en ajouter un autre.' },
} as const;

/**
 * PUT (ajout) et DELETE (retrait) /api/favorites/[eventId] — design 1d, point 8. Compte de la session seulement
 * (requireActiveSession) ; ajout permis pour un événement publié et public, même réponse 404 pour tout autre (rien ne
 * laisse deviner un événement non public) ; quota par compte. Réponse `{ favorite }`.
 */
async function write(req: NextRequest, props: { params: Promise<{ eventId: string }> }, on: boolean) {
    const active = await requireActiveSession(req);
    if (active.response) return active.response;
    const { eventId } = await props.params;
    const quota = await reserveQuota(
        [{ scope: 'event_favorite_write', bucket: active.user.id, windowSecs: 3600, max: FAVORITE_WRITES_PER_HOUR }],
        'favori',
    );
    if (!quota.allowed) {
        return quotaRefusalResponse(quota, { error: 'Trop de changements de favoris en peu de temps. Réessayez plus tard.', code: 'FAVORITES_RATE_LIMITED' });
    }
    try {
        const result = await setFavorite(active.user.id, eventId, on);
        if (!result.ok) {
            const refusal = REFUSALS[result.code];
            return NextResponse.json({ error: refusal.error, code: result.code }, { status: refusal.status });
        }
        return NextResponse.json({ favorite: result.favorite }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (err) {
        console.error(`[favoris] écriture impossible pour ${active.user.id} :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Le favori n’a pas pu être enregistré. Réessayez.', code: 'FAVORITES_UNAVAILABLE' }, { status: 503 });
    }
}

export function PUT(req: NextRequest, props: { params: Promise<{ eventId: string }> }) {
    return write(req, props, true);
}

export function DELETE(req: NextRequest, props: { params: Promise<{ eventId: string }> }) {
    return write(req, props, false);
}
